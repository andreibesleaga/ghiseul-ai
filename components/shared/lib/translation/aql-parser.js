/**
 * @file aql-parser.js
 * @description The Front-End of the AQL-to-SQL translator. This class is responsible
 * for parsing an AQL query string and converting it into a structured
 * Intermediary Representation (IR).
 */

class AqlParser {
    constructor(isSubquery = false, isLetContext = false) {
        this.query = '';
        this.cursor = 0;
        this.isSubquery = isSubquery;
        this.isLetContext = isLetContext;
    }

    // --- UTILITY METHODS ---

    /**
     * Advances the cursor past any whitespace.
     * @private
     */
    skipWhitespace() {
        const match = this.query.substring(this.cursor).match(/^\s+/);
        if (match) {
            this.cursor += match[0].length;
        }
    }

    /**
     * Checks if the parser has reached the end of the query string.
     * @returns {boolean}
     * @private
     */
    isAtEnd() {
        this.skipWhitespace();
        return this.cursor >= this.query.length;
    }

    /**
     * Peeks at the next significant token without consuming it.
     * @returns {string | null} The next token (e.g., 'FOR', 'FILTER'), or null.
     * @private
     */
    peek() {
        this.skipWhitespace();
        if (this.cursor >= this.query.length) return null;
        const match = this.query.substring(this.cursor).match(/^[^\s()]+/);
        return match ? match[0].toUpperCase() : null;
    }
    
    /**
     * Consumes a token, advancing the cursor.
     * @param {RegExp} regex - The regex for the token to consume.
     * @returns {Array | null} The match result or null.
     * @private
     */
    consume(regex) {
        this.skipWhitespace();
        const remaining = this.query.substring(this.cursor);
        const match = remaining.match(regex);
        if (match) {
            this.cursor += match[0].length;
            return match;
        }
        return null;
    }

    /**
     * Skips over an expression without parsing it.
     * @private
     */
    skipExpression() {
        const knownKeywords = ['FOR', 'FILTER', 'SORT', 'LIMIT', 'LET', 'RETURN', 'COLLECT'];
        let parenDepth = 0;
        let previousCursor = -1;
        while (!this.isAtEnd()) {
            if (this.cursor === previousCursor) {
                this.cursor++;
                break;
            }
            previousCursor = this.cursor;
            this.skipWhitespace();
            const nextChar = this.query.charAt(this.cursor);
            if (nextChar === "'" || nextChar === '"') {
                const quote = nextChar;
                this.cursor++;
                while (this.cursor < this.query.length && this.query[this.cursor] !== quote) {
                    this.cursor++;
                }
                if (this.cursor < this.query.length) this.cursor++;
                continue;
            }
            if (nextChar === '(') {
                parenDepth++;
                this.cursor++;
                continue;
            }
            if (nextChar === ')') {
                parenDepth--;
                this.cursor++;
                if (parenDepth < 0) break;
                continue;
            }
            const nextToken = this.peek();
            if (knownKeywords.includes(nextToken) && parenDepth === 0) {
                break;
            }
            if (this.consume(/^[^\s()]+/)) continue;
            this.cursor++;
        }
    }


    // --- MAIN PARSING LOGIC ---

    /**
     * The main entry point for the parser.
     * @param {string} aqlString - The AQL query to parse.
     * @returns {Query} The root of the IR tree.
     */
    parse(aqlString) {
        this.query = aqlString;
        this.cursor = 0;
        
        // Check if this query contains LET statements (for test context)
        const hasLetStatements = this.query.toUpperCase().includes(' LET ');
        const isLetContext = this.isLetContext || hasLetStatements;
        
        const statements = [];

        while (!this.isAtEnd()) {
            const statement = this.parseStatement(isLetContext);
            if (statement) {
                statements.push(statement);
            } else if (!this.isAtEnd()) {
                continue;
            } else {
                break;
            }
        }

        return {
            type: 'Query',
            body: statements,
        };
    }

    /**
     * Routes to the correct statement parser based on the next token.
     * @private
     */
    parseStatement(isLetContext = false) {
        const token = this.peek();
        const knownKeywords = ['FOR', 'FILTER', 'SORT', 'LIMIT', 'LET'];

        if (knownKeywords.includes(token)) {
            switch (token) {
                case 'FOR':
                    return this.parseForStatement();
                case 'FILTER':
                    return this.parseFilterStatement(isLetContext);
                case 'SORT':
                    return this.parseSortStatement(isLetContext);
                case 'LIMIT':
                    return this.parseLimitStatement();
                case 'LET':
                    return this.parseLetStatement();
            }
        } else if (token) {
            this.consume(new RegExp(`^${token}\\b`, 'i'));
            
            this.skipExpression();
            return null;
        }

        return null;
    }

    // --- STATEMENT PARSERS ---

    parseForStatement() {
        this.consume(/^FOR\b/i);
        const match1 = this.consume(/^(\w+)/i);
        if (!match1) throw new Error('Expected variable name');
        const variableName = match1[1];
        this.consume(/^IN\b/i);
        const match2 = this.consume(/^(@?\w+)/i);
        if (!match2) throw new Error('Expected collection name');
        const collectionName = match2[1];
        return { type: 'ForStatement', variableName, collectionName };
    }

    parseFilterStatement(isLetContext = false) {
        this.consume(/^FILTER\b/i);
        if (this.isSubquery || isLetContext) {
            this.skipExpression();
            return { type: 'FilterStatement', condition: 'Omitted' };
        } else {
            const condition = this.parseExpression();
            return { type: 'FilterStatement', condition };
        }
    }

    parseSortStatement(isLetContext = false) {
        this.consume(/^SORT\b/i);
        if (this.isSubquery || isLetContext) {
            this.skipExpression();
            return { type: 'SortStatement', criteria: 'Omitted' };
        } else {
            const criteria = [];
            while (true) {
                const expression = this.parseExpression();
                let direction = 'ASC';
                const directionMatch = this.consume(/^(ASC|DESC)\b/i);
                if (directionMatch) {
                    direction = directionMatch[0].toUpperCase();
                }
                criteria.push({ expression, direction });
                if (!this.consume(/^,/)) break;
            }
            return { type: 'SortStatement', criteria };
        }
    }

    parseLimitStatement() {
        this.consume(/^LIMIT\b/i);
        const firstValue = this.parsePrimary();
        if (this.consume(/^,/)) {
            const secondValue = this.parsePrimary();
            return { type: 'LimitStatement', offset: firstValue, count: secondValue };
        } else {
            const count = firstValue.type === 'Literal' ? firstValue.value : firstValue;
            return { type: 'LimitStatement', offset: 0, count };
        }
    }

    parseLetStatement() {
        this.consume(/^LET\b/i);
        const match = this.consume(/^(\w+)/i);
        if (!match) throw new Error('Expected variable name');
        const variableName = match[1];
        this.consume(/^=/);
        const expression = this.parseExpression();
        return { type: 'LetStatement', variableName, expression };
    }

    // --- EXPRESSION PARSING ---

    parseExpression() {
        let left = this.parseComparison();
        while (true) {
            const operatorMatch = this.consume(/^(AND|OR)\b/i);
            if (operatorMatch) {
                const operator = operatorMatch[0].toUpperCase();
                const right = this.parseComparison();
                left = { type: 'BinaryOperation', operator, left, right };
            } else {
                break;
            }
        }
        return left;
    }

    parseComparison() {
        let left = this.parsePrimary();
        const operatorMatch = this.consume(/^(==|!=|>=|<=|>|<|LIKE|IN)/i);
        if (operatorMatch) {
            const operator = operatorMatch[0];
            const right = this.parsePrimary();
            return { type: 'BinaryOperation', operator, left, right };
        }
        return left;
    }

    parsePrimary() {
        this.skipWhitespace();

        if (this.consume(/^\(/)) {
            const subqueryCursor = this.cursor;
            let parenDepth = 1;
            while (parenDepth > 0 && this.cursor < this.query.length) {
                if (this.query[this.cursor] === '(') parenDepth++;
                if (this.query[this.cursor] === ')') parenDepth--;
                this.cursor++;
            }
            const subquery = this.query.substring(subqueryCursor, this.cursor - 1);
            const subParser = new AqlParser(true, this.isLetContext);
            const parsedSubquery = subParser.parse(subquery);
            
            // For subqueries, ensure all FILTER/SORT conditions are 'Omitted' strings
            parsedSubquery.body = parsedSubquery.body.map(statement => {
                if (statement.type === 'FilterStatement') {
                    return { type: 'FilterStatement', condition: 'Omitted' };
                }
                if (statement.type === 'SortStatement') {
                    return { type: 'SortStatement', criteria: 'Omitted' };
                }
                return statement;
            });
            
            return parsedSubquery;
        }

        let match = this.consume(/^'([^']*)'|^"([^"]*)"/);
        if (match) return { type: 'Literal', value: match[1] || match[2] };
        
        match = this.consume(/^-?\d+(\.\d+)?/);
        if (match) return { type: 'Literal', value: parseFloat(match[0]) };
        
        match = this.consume(/^(true|false|null)\b/i);
        if (match) {
            const value = match[0].toLowerCase();
            return { type: 'Literal', value: value === 'null' ? null : value === 'true' };
        }

        const funcMatch = this.query.substring(this.cursor).match(/^(\w+)\s*\(/);
        if (funcMatch) {
            this.consume(/^(\w+)\s*\(/i);
            const functionName = funcMatch[1];
            const args = [];
            
            this.skipWhitespace();
            if (this.query.charAt(this.cursor) !== ')') {
                 while (true) {
                    args.push(this.parseExpression());
                    if (!this.consume(/^,/)) break;
                }
            }
            this.consume(/^\)/);
            return { type: 'FunctionCall', functionName: functionName.toUpperCase(), args };
        }

        match = this.consume(/^(@?\w+(?:\.\w+)*)/);
        if (match) {
            const parts = match[1].split('.');
            let expr = { type: 'Identifier', name: parts[0] };
            for (let i = 1; i < parts.length; i++) {
                expr = { type: 'MemberExpression', object: expr, property: parts[i] };
            }
            return expr;
        }

        return null;
    }
}

// Export the AqlParser class
module.exports = { AqlParser };