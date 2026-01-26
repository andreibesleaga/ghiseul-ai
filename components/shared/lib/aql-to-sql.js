const { logger } = require('./logger');

/**
 * AqlToSqlTranslator Class
 *
 * Translates ArangoDB AQL to ArcadeDB-compatible SQL with improved handling for:
 * - COLLECT and AGGREGATE clauses with proper GROUP BY.
 * - Correct SELECT variable usage (avoiding SELECT *).
 * - Proper LIMIT and OFFSET syntax.
 * - Accurate DATE function translations.
 * - Robust UPDATE and DELETE with RETURN clauses.
 * - Enhanced graph traversal with expand() for DOCUMENT.
 * - Nested FOR loops with JOINs.
 */
class AqlToSqlTranslator {
  constructor() {
    logger.info('AqlToSqlTranslator initialized.');
    this.functionMap = {
      'DATE_TIMESTAMP': 'date',
      'TO_NUMBER': 'toFloat',
      'LOWER': 'lower',
      'LIKE': 'like',
      'HAS': (args) => `(${args[0]}.${args[1].replace(/['"]/g, '')} IS NOT NULL AND ${args[0]}.${args[1].replace(/['"]/g, '')} != {})`,
      'CONCAT': 'concat',
      'DOCUMENT': (args) => {
        const docIdExpr = args[0];
        logger.debug(`[AQL_TRANSLATE_FUNCTIONS] Translating DOCUMENT(${docIdExpr})`);
        if (docIdExpr.startsWith("'") && docIdExpr.includes('/')) {
          const [collection, key] = docIdExpr.replace(/'/g, '').split('/');
          return `(SELECT * FROM ${collection} WHERE _key = '${key}' LIMIT 1)`;
        }
        return `(SELECT * FROM ${docIdExpr})`;
      },
      'FIRST': (args) => `${args[0]}[0]`,
      'LENGTH': this._handleLength.bind(this),
      'COUNT': (args) => `COUNT(${args.length && args[0] !== '' ? args.join(', ') : '*'})`,
      'SUM': 'sum',
      'AVERAGE': 'avg',
      'AQL::TO_STRING': 'toString',
      'DATE_SUBTRACT': (args) => args.length === 3 ? `date_add(${args[0]}, '${args[2].replace(/['"]/g, '')}', -${args[1]})` : `DATE_SUBTRACT(${args.join(', ')})`,
      'DATE_ADD': (args) => args.length === 3 ? `date_add(${args[0]}, '${args[2].replace(/['"]/g, '')}', ${args[1]})` : `DATE_ADD(${args.join(', ')})`,
      'DATE_NOW': 'sysdate()',
      'DATE_ISO8601': (args) => `TO_CHAR(${args[0]}, 'YYYY-MM-DDTHH24:MI:SSZ')`,
      'DATE_HOUR': (args) => `EXTRACT(HOUR FROM ${args[0]})`,
      'DATE_FORMAT': (args) => `format_date(${args[0]}, ${args[1]})`,
      'UNIQUE': (args) => `(SELECT COLLECT(DISTINCT value) FROM UNNEST(${args[0]}) AS value)`,
      'ATTRIBUTES': (args) => `JSON_KEYS(${args[0]})`,
      'DATE_DIFF': (args) => `DATEDIFF(${args[2]}, ${args[0]}, ${args[1]})`,
      'PARSE_IDENTIFIER': (args) => `SUBSTRING(${args[0]}, POSITION(${args[0]}, '/') + 1)`,
      'UNION': (args) => `UNIONALL(${args.join(', ')})`,
      'RAND': () => 'RAND()',
      'MERGE': (args) => `${args.join(', ')}`,
      'SUBSTRING': 'SUBSTRING'
    };
    this.intoVar = null;
  }

  _handleLength(args) {
    const arg = args[0];
    if (arg.trim().toUpperCase().startsWith('FOR ')) {
      const subquery = this.translateQuery(arg, {}).sql;
      return `COUNT() FROM (${subquery})`;
    }
    return `size(${arg})`;
  }

  translateQuery(aqlQuery, bindVars = {}) {
    let sql = aqlQuery.trim().replace(/\s+/g, ' ');
    sql = sql.replace(/@(\w+)/g, ':$1');
    logger.debug(`[AQL_TRANSLATE] Starting translation of AQL query: ${sql}`);
    let params = { ...bindVars };
    if (sql.endsWith('[0]')) {
      const innerSql = sql.slice(0, -3).trim();
      const transInner = this.translateQuery(innerSql, params).sql;
      return { sql: `(${transInner})[0]`, params, type: 'select' };
    }
    if (sql.toUpperCase() === 'RETURN 1') {
      logger.debug(`[AQL_TRANSLATE] Detected health check, translating to: SELECT 1 as health_check`);
      return { sql: 'SELECT 1 as health_check', params: {}, type: 'select' };
    }
    if (sql.toUpperCase().startsWith('RETURN ')) {
      let returnExpr = sql.replace(/^RETURN/i, '').trim();
      let processed = returnExpr.replace(/\{([^}]+)\}/, (m, fields) => {
        return fields.split(',').map(f => {
          const split = f.trim().split(':').map(s => s.trim());
          const alias = split[0];
          const val = this._translateExpression(split[1] || split[0]);
          return `${val} AS ${alias}`;
        }).join(', ');
      });
      return { sql: `SELECT ${processed}`, params, type: 'select' };
    }
    if (sql.toUpperCase().startsWith('UPDATE')) return this._translateDirectUpdate(sql, params);
    if (sql.toUpperCase().startsWith('INSERT')) return this._translateDirectInsert(sql, params);
    if (sql.includes(' REMOVE ')) return this._translateForRemove(sql, params);
    if (sql.toUpperCase().startsWith('RETURN LENGTH(')) return this._translateReturnLength(sql, params);
    if (sql.match(/LET\s+.*=\s*\((.|\n)*\)\s*RETURN\s*LENGTH/i)) return this._translateLetReturnLength(sql, params);
    if (this.isGraphTraversal(sql)) return this._translateGraphTraversal(sql, params);
    if (sql.toUpperCase().startsWith('LET ')) return this._translateTopLet(sql, params);
    if (sql.match(/LET\s+.*=\s*\((.|\n)*\)/)) return this._translateComplexLet(sql, params);
    if (this.isNestedFor(sql)) return this._translateNestedFor(sql, params);
    return this._translateCoreForLoop(sql, params);
  }

  isGraphTraversal(sql) {
    return sql.match(/FOR\s+\w+\s+IN\s+\w+\s+FILTER\s+\w+\._(from|to)\s*==/i) &&
           sql.match(/LET\s+\w+\s*=\s*DOCUMENT\s*\(\s*\w+\._(to|from)\s*\)/i);
  }

  isNestedFor(sql) {
    return sql.match(/FOR\s+\w+\s+IN\s+\w+\s+FILTER\s+.+FOR\s+\w+\s+IN\s+\w+/i);
  }

  _translateNestedFor(sql, params) {
    logger.debug(`[AQL_TRANSLATE_NESTED_FOR] Starting nested FOR translation for: ${sql}`);
    const match = sql.match(/FOR\s+(\w+)\s+IN\s+(\w+)\s+FILTER\s+(.+?)\s+FOR\s+(\w+)\s+IN\s+(\w+)\s+FILTER\s+(.+?)(?:\s+RETURN\s+(.+)|$)/i);
    if (match) {
      const edgeVar = match[1];
      const edgeColl = match[2];
      let filter1 = this._translateExpression(match[3]);
      const docVar = match[4];
      const docColl = match[5];
      let filter2 = this._translateExpression(match[6]);
      const ret = match[7] || `{ _id: ${docVar}._id, nameEN: ${docVar}.nameEN, relevanceScore: ${edgeVar}.relevanceScore }`;
      const joinCondition = filter2.match(new RegExp(`${docVar}\\._id\\s*==\\s*${edgeVar}\\._(to|from)`, 'i'));
      if (joinCondition) {
        const direction = joinCondition[1];
        filter1 = filter1.replace(new RegExp(`${edgeVar}\\.`, 'g'), `${edgeVar}.`);
        filter2 = filter2.replace(joinCondition[0], '');
        if (filter2.trim().startsWith('AND')) {
          filter2 = filter2.trim().substring(3).trim();
        }
        filter2 = filter2.replace(new RegExp(`${docVar}\\.`, 'g'), `${docVar}.`);
        const whereClause = filter2 ? ` AND ${filter2}` : '';
        let returnProcessed = this._translateExpression(ret);
        returnProcessed = returnProcessed.replace(/\{([^}]+)\}/, (m, fields) => {
          return fields.split(',').map(f => {
            const split = f.trim().split(':').map(s => s.trim());
            const alias = split[0];
            const val = split[1] || alias;
            return `${val} AS ${alias}`;
          }).join(', ');
        });
        const finalSql = `SELECT ${returnProcessed} FROM ${edgeColl} AS ${edgeVar} JOIN ${docColl} AS ${docVar} ON ${docVar}._id = ${edgeVar}._${direction} WHERE ${filter1}${whereClause}`;
        logger.debug(`[AQL_TRANSLATE_NESTED_FOR] Translated to: ${finalSql}`);
        return { sql: finalSql, params, type: 'select' };
      }
    }
    logger.warn(`[AQL_TRANSLATE_NESTED_FOR] No matching pattern for: ${sql}`);
    return this._translateCoreForLoop(sql, params);
  }

  _translateTopLet(sql, params) {
    logger.debug(`[AQL_TRANSLATE_TOP_LET] Starting top-level LET translation for: ${sql}`);
    let withClauses = [];
    let current = sql;
    let match;
    let returnExpr = sql.match(/RETURN\s+(.+)/i)?.[1] || '';
    while ((match = current.match(/LET\s+(\w+)\s*=\s*(.+?)(?=\s+LET\s+|\s+RETURN\s+|$)/i))) {
      const varName = match[1];
      let expr = match[2].trim();
      let isArrayIndex = false;
      if (expr.endsWith('[0]')) {
        isArrayIndex = true;
        expr = expr.slice(0, -3).trim();
      }
      let translatedExpr = this.translateQuery(expr, params).sql;
      if (isArrayIndex) {
        translatedExpr = `(${translatedExpr})[0]`;
      }
      withClauses.push(`${varName} AS (${translatedExpr})`);
      returnExpr = returnExpr.replace(new RegExp('\\b' + varName + '\\b', 'g'), varName);
      current = current.substring(match.index + match[0].length).trim();
    }
    let translatedReturn = returnExpr.replace(/\{([^}]+)\}/, (m, fields) => {
      return fields.split(',').map(f => {
        const split = f.trim().split(':').map(s => s.trim());
        const alias = split[0];
        const val = this._translateExpression(split[1] || split[0]);
        return `${val} AS ${alias}`;
      }).join(', ');
    });
    const finalSql = `WITH ${withClauses.join(', ')} SELECT ${translatedReturn}`;
    logger.debug(`[AQL_TRANSLATE_TOP_LET] Translated to: ${finalSql}`);
    return { sql: finalSql, params, type: 'select' };
  }

  _translateGraphTraversal(sql, params) {
    logger.debug(`[AQL_TRANSLATE_GRAPH_TRAVERSAL] Starting graph traversal translation for: ${sql}`);
    const edgeMatch = sql.match(/FOR\s+(\w+)\s+IN\s+(\w+)\s+FILTER\s+\1\._(from|to)\s*==\s*(\S+)(?:\s+(.+))?/i);
    if (edgeMatch) {
      const edgeVar = edgeMatch[1];
      const coll = edgeMatch[2];
      const direction = edgeMatch[3];
      const id = edgeMatch[4];
      const remaining = edgeMatch[5] || '';
      const docMatch = remaining.match(/LET\s+(\w+)\s*=\s*DOCUMENT\s*\(\s*(\w+)\._(to|from)\s*\)/i);
      let finalSql = '';
      let returnProcessed = edgeVar;
      let type = 'select';
      let additionalClauses = '';
      if (docMatch && docMatch[2] === edgeVar) {
        const docVar = docMatch[1];
        const docDirection = docMatch[3];
        const postDoc = remaining.substring(docMatch[0].length).trim();
        const remMatch = postDoc.match(/(?:\s+FILTER\s+(.+?))?(?:\s+SORT\s+(.+?))?(?:\s+LIMIT\s+(.+?))?\s+RETURN\s+(.+)/i);
        if (remMatch) {
          const filter = remMatch[1] ? ` AND ${this._translateExpression(remMatch[1]).replace(new RegExp(`${docVar}\\.`, 'g'), docVar + '.')}` : '';
          const sort = remMatch[2] ? ` ORDER BY ${this._translateExpression(remMatch[2])}` : '';
          const limit = remMatch[3] || '';
          returnProcessed = this._translateExpression(remMatch[4]);
          let limitClause = '';
          if (limit) {
            const limitMatch = limit.match(/(\S+)\s*,\s*(\S+)/);
            if (limitMatch) {
              limitClause = ` LIMIT ${limitMatch[2]} OFFSET ${limitMatch[1]}`;
            } else {
              limitClause = ` LIMIT ${limit}`;
            }
          }
          additionalClauses = `${filter}${sort}${limitClause}`;
        }
        const joinType = direction === 'from' ? 'out' : 'in';
        const expandDir = direction === 'from' ? 'in' : 'out';
        finalSql = `SELECT ${returnProcessed} FROM (SELECT expand(${joinType}E('${coll}').${expandDir}) FROM ${id}) LET ${docVar} = @this${additionalClauses}`;
      } else {
        const remMatch = remaining.match(/(?:\s+SORT\s+(.+?))?(?:\s+LIMIT\s+(.+?))?\s+RETURN\s+(.+)/i);
        if (remMatch) {
          const sort = remMatch[1] ? ` ORDER BY ${this._translateExpression(remMatch[1])}` : '';
          const limit = remMatch[2] || '';
          returnProcessed = this._translateExpression(remMatch[3]);
          let limitClause = '';
          if (limit) {
            const limitMatch = limit.match(/(\S+)\s*,\s*(\S+)/);
            if (limitMatch) {
              limitClause = ` LIMIT ${limitMatch[2]} OFFSET ${limitMatch[1]}`;
            } else {
              limitClause = ` LIMIT ${limit}`;
            }
          }
          additionalClauses = `${sort}${limitClause}`;
        }
        finalSql = `SELECT ${returnProcessed} FROM ${coll} LET ${edgeVar} = @this WHERE ${edgeVar}._${direction} == ${id}${additionalClauses}`;
      }
      logger.debug(`[AQL_TRANSLATE_GRAPH_TRAVERSAL] Translated to: ${finalSql}`);
      return { sql: finalSql, params, type };
    }
    logger.warn(`[AQL_TRANSLATE_GRAPH_TRAVERSAL] No matching pattern for: ${sql}`);
    return this._translateCoreForLoop(sql, params);
  }

  _translateDirectUpdate(sql, params) {
    logger.debug(`[AQL_TRANSLATE_DIRECT_UPDATE] Starting UPDATE translation for: ${sql}`);
    let match = sql.match(/UPDATE\s+{\s*_key:\s*([^,]+),\s*(.+)}\s+IN\s+(\w+)/i);
    if (match) {
      const key = match[1].trim();
      const updates = match[2].trim();
      const coll = match[3];
      const setPairs = updates.split(',').map(p => {
        const [k, v] = p.split(':').map(s => s.trim());
        return `${k} = ${v}`;
      }).join(', ');
      const finalSql = `UPDATE ${coll} SET ${setPairs} WHERE _key = ${key}`;
      logger.debug(`[AQL_TRANSLATE_DIRECT_UPDATE] Translated to: ${finalSql}`);
      return { sql: finalSql, params, type: 'update' };
    }
    match = sql.match(/UPDATE\s+:(\w+)\s+WITH\s+:(\w+)\s+IN\s+(\w+)/i);
    if (match) {
      const keyVar = match[1];
      const dataVar = match[2];
      const coll = match[3];
      const finalSql = `UPDATE ${coll} SET content = :${dataVar} WHERE @rid = :${keyVar}`;
      logger.debug(`[AQL_TRANSLATE_DIRECT_UPDATE] Translated to: ${finalSql}`);
      return { sql: finalSql, params, type: 'update' };
    }
    logger.warn(`[AQL_TRANSLATE_DIRECT_UPDATE] No matching pattern for: ${sql}`);
    return { sql, params, type: 'update' };
  }

  _translateDirectInsert(sql, params) {
    logger.debug(`[AQL_TRANSLATE_DIRECT_INSERT] Starting INSERT translation for: ${sql}`);
    const match = sql.match(/INSERT\s+:(\w+)\s+INTO\s+(\w+)/i);
    if (match) {
      const dataVar = match[1];
      const coll = match[2];
      const finalSql = `INSERT :${dataVar} INTO ${coll}`;
      logger.debug(`[AQL_TRANSLATE_DIRECT_INSERT] Translated to: ${finalSql}`);
      return { sql: finalSql, params, type: 'insert' };
    }
    logger.warn(`[AQL_TRANSLATE_DIRECT_INSERT] No matching pattern for: ${sql}`);
    return { sql, params, type: 'insert' };
  }

  _translateForRemove(sql, params) {
    logger.debug(`[AQL_TRANSLATE_FOR_REMOVE] Starting REMOVE translation for: ${sql}`);
    const match = sql.match(/FOR\s+(\w+)\s+IN\s+(\w+)\s+FILTER\s+(.+)\s+REMOVE\s+\1\s+IN\s+\2(?:\s+RETURN\s+(.+))?/i);
    if (match) {
      const varName = match[1];
      const coll = match[2];
      const filters = this._translateExpression(match[3]).replace(new RegExp(`${varName}\\.`, 'gi'), '');
      let finalSql = `DELETE FROM ${coll} WHERE ${filters}`;
      if (match[4] === 'OLD') {
        finalSql += ' RETURN BEFORE';
      }
      logger.debug(`[AQL_TRANSLATE_FOR_REMOVE] Translated to: ${finalSql}`);
      return { sql: finalSql, params, type: 'delete' };
    }
    logger.warn(`[AQL_TRANSLATE_FOR_REMOVE] No matching pattern for: ${sql}`);
    return { sql, params, type: 'delete' };
  }

  _translateReturnLength(sql, params) {
    logger.debug(`[AQL_TRANSLATE_RETURN_LENGTH] Starting RETURN LENGTH translation for: ${sql}`);
    const match = sql.match(/RETURN\s+LENGTH\s*\((.+)\)/i);
    if (match) {
      const subquery = match[1];
      const translatedSub = this.translateQuery(subquery, params).sql;
      const finalSql = `SELECT COUNT() FROM (${translatedSub})`;
      logger.debug(`[AQL_TRANSLATE_RETURN_LENGTH] Translated to: ${finalSql}`);
      return { sql: finalSql, params, type: 'select' };
    }
    logger.warn(`[AQL_TRANSLATE_RETURN_LENGTH] No matching pattern for: ${sql}`);
    return { sql, params, type: 'select' };
  }

  _translateLetReturnLength(sql, params) {
    logger.debug(`[AQL_TRANSLATE_LET_RETURN_LENGTH] Starting LET RETURN LENGTH translation for: ${sql}`);
    const match = sql.match(/LET\s+(\w+)\s*=\s*\((.+)\)\s*RETURN\s+LENGTH\s*\((.+)\)/i);
    if (match) {
      const varName = match[1];
      const subquery1 = match[2];
      const subquery2 = match[3];
      const translatedSub1 = this.translateQuery(subquery1, params).sql;
      let finalSql;
      if (subquery2.trim() === varName) {
        finalSql = `WITH ${varName} AS (${translatedSub1}) SELECT size(${varName})`;
      } else {
        const translatedSub2 = this.translateQuery(subquery2, params).sql;
        finalSql = `WITH ${varName} AS (${translatedSub1}) SELECT COUNT() FROM (${translatedSub2})`;
      }
      logger.debug(`[AQL_TRANSLATE_LET_RETURN_LENGTH] Translated to: ${finalSql}`);
      return { sql: finalSql, params, type: 'select' };
    }
    logger.warn(`[AQL_TRANSLATE_LET_RETURN_LENGTH] No matching pattern for: ${sql}`);
    return { sql, params, type: 'select' };
  }

  _translateComplexLet(sql, params) {
    logger.debug(`[AQL_TRANSLATE_COMPLEX_LET] Starting COMPLEX LET translation for: ${sql}`);
    const match = sql.match(/LET\s+(\w+)\s*=\s*\((.+?)\)\s*(.+)/i);
    if (!match) {
      logger.warn(`[AQL_TRANSLATE_COMPLEX_LET] No matching pattern for: ${sql}`);
      return { sql, params, type: 'select' };
    }
    const varName = match[1];
    let subquery = match[2];
    let remaining = match[3];
    let isArrayIndex = false;
    if (remaining.startsWith('[0]')) {
      subquery += '[0]';
      remaining = remaining.substring(3).trim();
      isArrayIndex = true;
    }
    let translatedSub = this.translateQuery(subquery, params).sql;
    if (isArrayIndex) {
      translatedSub = `(${translatedSub})[0]`;
    }
    const translatedRemaining = this.translateQuery(remaining, params);
    let finalSql = `WITH ${varName} AS (${translatedSub}) ${translatedRemaining.sql}`;
    logger.debug(`[AQL_TRANSLATE_COMPLEX_LET] Translated to: ${finalSql}`);
    return { sql: finalSql, params, type: translatedRemaining.type };
  }

  _translateCoreForLoop(sql, params) {
    logger.debug(`[AQL_TRANSLATE_CORE_FOR_LOOP] Starting FOR loop translation for: ${sql}`);
    const clauseList = this._parseAqlClauses(sql);
    if (!clauseList.find(c => c.type === 'FOR')) {
      logger.warn(`[AQL_TRANSLATE_CORE_FOR_LOOP] No FOR clause found for: ${sql}`);
      return { sql: this._translateExpression(sql), params, type: 'select' };
    }
    const forC = clauseList.find(c => c.type === 'FOR').content;
    const forMatch = forC.match(/(\w+)\s+IN\s+(\w+)/i);
    if (!forMatch) {
      logger.warn(`[AQL_TRANSLATE_CORE_FOR_LOOP] Invalid FOR clause: ${forC}`);
      return { sql, params, type: 'select' };
    }
    const varName = forMatch[1];
    const coll = forMatch[2];
    let type = 'select';
    let finalSql = ` FROM ${coll} LET ${varName} = @this`;
    let selectClause = varName;
    let groupByClause = '';
    let aggVars = [];
    let hasAgg = false;
    let isGlobalAgg = false;
    let groupVar = null;
    let groupExpr = '';
    this.intoVar = '';
    let postWithClauses = [];
    let postCollectLets = [];
    let afterCollect = false;
    let havingClause = '';
    let returnContent = '';
    if (clauseList.find(c => c.type === 'RETURN')) {
      returnContent = clauseList.find(c => c.type === 'RETURN').content;
      let processed = returnContent.replace(/\{([^}]+)\}/, (m, fields) => {
        return fields.split(',').map(f => {
          const split = f.trim().split(':').map(s => s.trim());
          const alias = split[0];
          const val = this._translateExpression(split[1] || split[0]);
          return `${val} AS ${alias}`;
        }).join(', ');
      });
      selectClause = processed;
      if (returnContent.startsWith('DISTINCT ')) {
        selectClause = `DISTINCT ${this._translateExpression(returnContent.replace(/^DISTINCT\s+/i, ''))}`;
      }
      if (returnContent === 'NEW') {
        finalSql += ' RETURN AFTER';
      } else if (returnContent === 'OLD') {
        finalSql += ' RETURN BEFORE';
      }
    }

    for (let clause of clauseList.filter(c => c.type !== 'FOR' && c.type !== 'RETURN')) {
      if (clause.type === 'FILTER') {
        const translatedContent = this._translateExpression(clause.content);
        if (!afterCollect) {
          finalSql += ` WHERE ${translatedContent}`;
        } else {
          havingClause += ` HAVING ${translatedContent}`;
        }
      } else if (clause.type === 'LET') {
        const letMatch = clause.content.match(/(\w+)\s*=\s*(.+)/i);
        if (!letMatch) continue;
        const letVar = letMatch[1];
        let expr = letMatch[2].trim();
        let isArrayIndex = false;
        if (expr.endsWith('[0]')) {
          isArrayIndex = true;
          expr = expr.slice(0, -3).trim();
        }
        let translatedExpr;
        if (expr.match(/^(FOR|LET|RETURN)\s+/i)) {
          translatedExpr = this.translateQuery(expr, params).sql;
        } else {
          translatedExpr = this._translateExpression(expr);
        }
        if (isArrayIndex) {
          translatedExpr = `(${translatedExpr})[0]`;
        }
        if (afterCollect) {
          postCollectLets.push({ letVar, translatedExpr });
        } else {
          postWithClauses.push(`${letVar} = ${translatedExpr}`);
        }
      } else if (clause.type === 'COLLECT') {
        afterCollect = true;
        hasAgg = true;
        const collect = clause.content;
        if (collect.match(/AGGREGATE\s+/i)) {
          const aggMatch = collect.match(/AGGREGATE\s+(.+)/i);
          if (aggMatch) {
            selectClause = aggMatch[1].split(',').map(agg => {
              const [aggVar, expr] = agg.trim().split('=');
              const func = expr.match(/(\w+)\(/)[1].toUpperCase();
              let arg = expr.match(/\(([^)]*)\)/)[1];
              arg = this._translateExpression(arg);
              const funcValue = this.functionMap[func];
              let aggExpr;
              if (typeof funcValue === 'function') {
                aggExpr = funcValue([arg]);
              } else {
                aggExpr = `${funcValue || func}(${arg})`;
              }
              aggVars.push(aggVar.trim());
              return `${aggExpr} AS ${aggVar.trim()}`;
            }).join(', ');
            isGlobalAgg = true;
          }
        } else if (collect.match(/WITH COUNT INTO/i)) {
          this.intoVar = collect.match(/WITH COUNT INTO\s+(\w+)/i)[1];
          selectClause = `COUNT(*) AS ${this.intoVar}`;
          aggVars.push(this.intoVar);
          isGlobalAgg = true;
        } else {
          const collectMatch = collect.match(/(\w+)\s*=\s*([^ ]+)(?:\s+INTO\s+(\w+))?/i);
          if (collectMatch) {
            groupVar = collectMatch[1];
            groupExpr = this._translateExpression(collectMatch[2]);
            this.intoVar = collectMatch[3] || 'groups';
            groupByClause = ` GROUP BY ${groupExpr}`;
          }
        }
      } else if (clause.type === 'SORT') {
        finalSql += ` ORDER BY ${this._translateExpression(clause.content)}`;
      } else if (clause.type === 'LIMIT') {
        const limitMatch = clause.content.match(/(\S+)\s*,\s*(\S+)/);
        if (limitMatch) {
          finalSql += ` LIMIT ${limitMatch[2]} OFFSET ${limitMatch[1]}`;
        } else {
          finalSql += ` LIMIT ${clause.content.trim()}`;
        }
      } else if (clause.type === 'UPDATE') {
        const match = clause.content.match(/(\w+)\s+WITH\s+{([^}]+)}\s+IN\s+(\w+)/i);
        if (match) {
          const updateVar = match[1];
          const updates = match[2];
          const updateColl = match[3];
          const setPairs = updates.split(',').map(p => p.trim().split(':').map(s => s.trim()).join(' = ')).join(', ');
          finalSql = `UPDATE ${updateColl} SET ${setPairs}` + finalSql.replace(` FROM ${coll} LET ${varName} = @this`, '');
          finalSql = finalSql.replace(new RegExp(varName + '\\.', 'g'), '');
          type = 'update';
        }
      } else if (clause.type === 'REMOVE') {
        const match = clause.content.match(/(\w+)\s+IN\s+(\w+)/i);
        if (match) {
          const removeVar = match[1];
          const removeColl = match[2];
          finalSql = `DELETE FROM ${removeColl}` + finalSql.replace(` FROM ${coll} LET ${varName} = @this`, '');
          finalSql = finalSql.replace(new RegExp(varName + '\\.', 'g'), '');
          type = 'delete';
        }
      }
    }

    if (groupByClause) {
      finalSql += groupByClause;
    }

    if (hasAgg && !isGlobalAgg && groupVar) {
      if (returnContent === groupVar) {
        selectClause = groupExpr;
      } else {
        selectClause = selectClause.replace(new RegExp('\\b' + groupVar + '\\b'), groupExpr);
      }
    }

    postCollectLets.forEach(({ letVar, translatedExpr }) => {
      selectClause = selectClause.replace(new RegExp('\\b' + letVar + '\\b'), translatedExpr);
    });

    if (postWithClauses.length) {
      finalSql = ` WITH ${postWithClauses.join(', ')}` + finalSql;
    }

    if (type === 'select') {
      finalSql = `SELECT ${selectClause}` + finalSql;
    }

    if (havingClause) {
      finalSql += havingClause;
    }

    if (type === 'update' || type === 'delete') {
      if (returnContent === 'NEW') {
        finalSql += ' RETURN AFTER';
      } else if (returnContent === 'OLD') {
        finalSql += ' RETURN BEFORE';
      }
    }

    logger.debug(`[AQL_TRANSLATE_CORE_FOR_LOOP] Translated to: ${finalSql}`);
    return { sql: finalSql, params, type };
  }

  _parseAqlClauses(sql) {
    const clauseList = [];
    const keywords = ['FOR', 'FILTER', 'LET', 'COLLECT', 'SORT', 'LIMIT', 'RETURN', 'REMOVE', 'UPDATE'];
    let pos = 0;
    let currentKeyword = null;
    let depth = 0;
    let clauseStart = 0;
    const upperSql = sql.toUpperCase();
    while (pos < sql.length) {
      if (depth === 0) {
        for (let kw of keywords) {
          if (upperSql.substr(pos, kw.length) === kw && (pos + kw.length === sql.length || !/[a-zA-Z0-9_]/.test(sql[pos + kw.length]))) {
            if (currentKeyword) {
              const content = sql.substring(clauseStart, pos).trim();
              clauseList.push({ type: currentKeyword, content });
            }
            currentKeyword = kw;
            pos += kw.length;
            clauseStart = pos;
            break;
          }
        }
      }
      if (sql[pos] === '(') depth++;
      if (sql[pos] === ')') depth--;
      pos++;
    }
    if (currentKeyword) {
      const content = sql.substring(clauseStart).trim();
      clauseList.push({ type: currentKeyword, content });
    }
    return clauseList;
  }

  _translateExpression(expr) {
    expr = expr.replace(/\[\*\]/g, '[]');
    let oldExpr;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops
    do {
      oldExpr = expr;
      for (const [key, value] of Object.entries(this.functionMap)) {
        const regex = new RegExp(`${key}\\s*\\(\\s*([^)]*)\\s*\\)`, 'gi');
        expr = expr.replace(regex, (m, argsStr) => {
          const argArr = this._parseArgs(argsStr);
          const translatedArgs = argArr.map(arg => this._translateExpression(arg.trim()));
          if (typeof value === 'function') {
            return value(translatedArgs);
          } else {
            if (translatedArgs.length === 0) return value;
            return `${value}(${translatedArgs.join(', ')})`;
          }
        });
      }
      iterations++;
      if (iterations > maxIterations) {
        logger.error('[AQL_TRANSLATE_EXPRESSION] Max iterations exceeded, potential infinite loop');
        return oldExpr;
      }
    } while (expr !== oldExpr);
    return expr;
  }

  _parseArgs(str) {
    const args = [];
    let depth = 0;
    let current = '';
    for (let char of str) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current) args.push(current.trim());
    return args;
  }

  translateInsert(collectionName, doc, options = {}) {
    logger.debug(`[AQL_TRANSLATE_INSERT] Starting translation for INSERT in ${collectionName} with doc: ${JSON.stringify(doc)}`);
    const params = { doc: JSON.stringify(doc) };
    let sql = `INSERT :doc INTO ${collectionName}`;
    if (options.returnNew) {
      sql += ' RETURN @this';
    } else if (options.returnOld) {
      sql += ' RETURN BEFORE';
    }
    logger.debug(`[AQL_TRANSLATE_INSERT] Translated INSERT SQL: ${sql}`);
    return { sql, params };
  }

  translateGet(collectionName, key) {
    logger.debug(`[AQL_TRANSLATE_GET] Starting translation for GET in ${collectionName} with key: ${key}`);
    const params = { key };
    const sql = `SELECT FROM ${collectionName} WHERE _key = :key LIMIT 1`;
    logger.debug(`[AQL_TRANSLATE_GET] Translated GET SQL: ${sql}`);
    return { sql, params };
  }

  translateUpdate(collectionName, key, newData, options = {}) {
    logger.debug(`[AQL_TRANSLATE_UPDATE] Starting translation for UPDATE in ${collectionName} with key: ${key}, newData: ${JSON.stringify(newData)}`);
    const params = { key, newData: JSON.stringify(newData) };
    let sql = `UPDATE ${collectionName} MERGE :newData WHERE _key = :key`;
    if (options.returnNew) {
      sql += ' RETURN AFTER';
    } else if (options.returnOld) {
      sql += ' RETURN BEFORE';
    } else if (options.keepNull === false) {
      sql += ' WHERE :newData IS NOT NULL';
    }
    logger.debug(`[AQL_TRANSLATE_UPDATE] Translated UPDATE SQL: ${sql}`);
    return { sql, params };
  }

  translateReplace(collectionName, key, newData, options = {}) {
    logger.debug(`[AQL_TRANSLATE_REPLACE] Starting translation for REPLACE in ${collectionName} with key: ${key}, newData: ${JSON.stringify(newData)}`);
    const params = { key, newData: JSON.stringify(newData) };
    let sql = `UPDATE ${collectionName} CONTENT :newData WHERE _key = :key`;
    if (options.returnNew) {
      sql += ' RETURN AFTER';
    } else if (options.returnOld) {
      sql += ' RETURN BEFORE';
    }
    logger.debug(`[AQL_TRANSLATE_REPLACE] Translated REPLACE SQL: ${sql}`);
    return { sql, params };
  }

  translateRemove(collectionName, key, options = {}) {
    logger.debug(`[AQL_TRANSLATE_REMOVE] Starting translation for REMOVE in ${collectionName} with key: ${key}`);
    const params = { key };
    let sql = `DELETE FROM ${collectionName} WHERE _key = :key`;
    if (options.returnOld) {
      sql += ' RETURN BEFORE';
    }
    logger.debug(`[AQL_TRANSLATE_REMOVE] Translated REMOVE SQL: ${sql}`);
    return { sql, params };
  }
}

module.exports = { AqlToSqlTranslator };