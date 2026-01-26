const { logger } = require('./logger');

/**
 * ArangoToArcadeGraphTranslator Class
 *
 * This class translates ArangoDB graph operations, particularly those from the arangojs driver,
 * into ArcadeDB-compatible queries. It primarily targets ArcadeDB's SQL MATCH syntax, which
 * is similar to openCypher, for graph traversals.
 *
 * As with the AQL translator, this is a foundational implementation focusing on common
 * use cases. Translating every possible AQL graph query is a highly complex task.
 */
class ArangoToArcadeGraphTranslator {
  constructor() {
    logger.info('ArangoToArcadeGraphTranslator initialized.');
  }

  /**
   * Translates an arangojs `graph.traversal()` operation into an ArcadeDB MATCH query.
   * @param {string} startVertex The ID of the starting vertex (e.g., 'vertices/12345').
   * @param {object} options The traversal options from arangojs.
   * @property {string} options.direction - 'outbound', 'inbound', or 'any'.
   * @property {number} options.minDepth - The minimum traversal depth (default: 1).
   * @property {number} options.maxDepth - The maximum traversal depth (default: 1).
   * @returns {{query: string, params: object, language: string}} The translated query object.
   */
  translateTraversal(startVertex, options = {}) {
    logger.debug(`[GRAPH_TRANSLATE] Original traversal from: ${startVertex} with options: ${JSON.stringify(options)}`);

    const startKey = startVertex.includes('/') ? startVertex.split('/')[1] : startVertex;
    const params = { startKey };

    // Determine traversal direction
    let edgeDirection = '';
    switch (options.direction) {
      case 'inbound':
        edgeDirection = '<-';
        break;
      case 'any':
        edgeDirection = '-';
        break;
      case 'outbound':
      default:
        edgeDirection = '-'; // Arcade MATCH uses -[edge]-> for outbound
        break;
    }
    const arrow = options.direction === 'inbound' ? '' : '->';


    // Determine traversal depth
    const minDepth = options.minDepth || 1;
    const maxDepth = options.maxDepth || 1;
    let depthClause = '';
    if (minDepth === 1 && maxDepth === 1) {
        // No clause needed for default depth of 1
    } else if (minDepth === maxDepth) {
        depthClause = `*${minDepth}`;
    } else {
        depthClause = `*${minDepth}..${maxDepth}`;
    }

    // Construct the MATCH query
    // This query finds the starting vertex 'a', traverses edges 'e' of any type,
    // and returns the distinct destination vertices 'b'.
    const query = `MATCH {type: V, as: a} ${edgeDirection}[${depthClause}]${arrow}{type: V, as: b} WHERE a._key = :startKey RETURN DISTINCT b`;

    logger.debug(`[GRAPH_TRANSLATE] Translated to MATCH query: ${query}`);
    
    // ArcadeDB's MATCH is part of its SQL dialect.
    return { query, params, language: 'sql' };
  }

  /**
   * Translates an arangojs `graph.addEdgeDefinition()` operation.
   * In ArcadeDB, this is a schema operation. The translation ensures the edge
   * type (collection) exists. A full implementation could add constraints.
   * @param {object} edgeDefinition The arangojs edge definition.
   * @property {string} edgeDefinition.collection - The name of the edge collection.
   * @property {string[]} edgeDefinition.from - The names of the 'from' vertex collections.
   * @property {string[]} edgeDefinition.to - The names of the 'to' vertex collections.
   * @returns {{command: string, params: object}} The translated SQL command.
   */
  translateAddEdgeDefinition(edgeDefinition) {
    logger.debug(`[GRAPH_TRANSLATE] Translating addEdgeDefinition for edge: ${edgeDefinition.collection}`);

    if (!edgeDefinition.collection) {
        throw new Error("Edge definition must contain a 'collection' name.");
    }

    // The primary action is to ensure the Edge Type exists.
    // The IF NOT EXISTS clause makes this operation idempotent.
    const command = `CREATE EDGE TYPE ${edgeDefinition.collection} IF NOT EXISTS`;

    // Note: A more advanced implementation could iterate through `from` and `to`
    // collections to create constraints between the vertex and edge types, but
    // that is a more complex schema management task.
    logger.warn(`[GRAPH_TRANSLATE] Basic translation creates edge type. For full enforcement, manually create constraints in ArcadeDB between vertex types (${edgeDefinition.from.join(', ')}) and edge type ${edgeDefinition.collection}.`);
    
    logger.debug(`[GRAPH_TRANSLATE] Translated to SQL command: ${command}`);
    return { command, params: {} };
  }
}

module.exports = { ArangoToArcadeGraphTranslator };
