/**
 * @file ArangoDB AQL to ArcadeDB SQL Translator - Intermediary Representation (IR) Design
 * @description This file defines the language-agnostic data structures used to represent
 * an AQL query after parsing. This is the output of the Front-End (Parser) and the
 * input for the Back-End (Generator).
 */

// -----------------------------------------------------------------------------
// 1. IR Type Definitions (JSDoc)
// -----------------------------------------------------------------------------

/**
 * The base for all nodes in the Intermediary Representation (IR).
 * @typedef {object} Node
 * @property {string} type - The type of the node, e.g., 'Query', 'ForStatement'.
 */

// === Core Query Structure ===

/**
 * The root node of the IR, representing a complete AQL query.
 * @typedef {object} Query
 * @property {'Query'} type
 * @property {Statement[]} body - An array of statements that make up the query, in order of execution.
 */

/**
 * A union type representing any possible statement in the query body.
 * @typedef {ForStatement | FilterStatement | LetStatement | CollectStatement | SortStatement | LimitStatement | ReturnStatement | UpdateStatement | RemoveStatement | InsertStatement} Statement
 */


// === Statement Nodes ===

/**
 * Represents a FOR loop for iteration.
 * e.g., FOR u IN users
 * @typedef {object} ForStatement
 * @property {'ForStatement'} type
 * @property {string} variableName - The name of the iteration variable (e.g., 'u').
 * @property {string} collectionName - The name of the collection being iterated over (e.g., 'users').
 */

/**
 * Represents a FILTER condition.
 * e.g., FILTER u.age > 30
 * @typedef {object} FilterStatement
 * @property {'FilterStatement'} type
 * @property {Expression | 'Omitted'} condition - The expression that must evaluate to true for a document to pass, or 'Omitted' for simplified representation.
 */

/**
 * Represents a LET statement for variable assignment.
 * e.g., LET fullName = CONCAT(u.firstName, " ", u.lastName)
 * @typedef {object} LetStatement
 * @property {'LetStatement'} type
 * @property {string} variableName - The name of the new variable being assigned.
 * @property {Expression} expression - The expression whose result is assigned to the variable.
 */

/**
 * Represents a COLLECT statement for grouping and aggregation.
 * e.g., COLLECT city = u.city WITH COUNT INTO userCount
 * @typedef {object} CollectStatement
 * @property {'CollectStatement'} type
 * @property {Object<string, Expression>} groupKeys - Key-value pairs where the key is the new group variable name and the value is the expression to group by.
 * @property {CollectAggregation[]} aggregations - An array of aggregations to perform.
 */

/**
 * Represents an aggregation within a COLLECT statement.
 * @typedef {object} CollectAggregation
 * @property {string} method - The aggregation method (e.g., 'COUNT', 'AVERAGE', 'SUM').
 * @property {string} variableName - The variable name to store the aggregation result.
 * @property {Expression} [expression] - The expression to aggregate, if applicable (e.g., for AVERAGE or SUM).
 */

/**
 * Represents a SORT statement.
 * e.g., SORT u.age DESC
 * @typedef {object} SortStatement
 * @property {'SortStatement'} type
 * @property {SortCriterion[] | 'Omitted'} criteria - An array of sorting criteria, or 'Omitted' for simplified representation.
 */

/**
 * A single sorting criterion.
 * @typedef {object} SortCriterion
 * @property {Expression} expression - The expression to sort by.
 * @property {'ASC' | 'DESC'} direction - The sorting direction.
 */

/**
 * Represents a LIMIT statement.
 * e.g., LIMIT 10, 20
 * @typedef {object} LimitStatement
 * @property {'LimitStatement'} type
 * @property {number} offset - The number of records to skip.
 * @property {number} count - The maximum number of records to return.
 */

/**
 * Represents the final RETURN statement.
 * e.g., RETURN u.name
 * @typedef {object} ReturnStatement
 * @property {'ReturnStatement'} type
 * @property {Expression} expression - The expression defining the structure of the final output.
 */

/**
 * Represents an UPDATE statement.
 * e.g., UPDATE u WITH { name: "new" } IN users
 * @typedef {object} UpdateStatement
 * @property {'UpdateStatement'} type
 * @property {Expression} target - The document or key to update.
 * @property {Expression} withExpression - The update modifications.
 * @property {string} collectionName - The name of the collection being updated.
 */

/**
 * Represents a REMOVE statement.
 * e.g., REMOVE u IN users
 * @typedef {object} RemoveStatement
 * @property {'RemoveStatement'} type
 * @property {Expression} target - The document or key to remove.
 * @property {string} collectionName - The name of the collection.
 */

/**
 * Represents an INSERT statement.
 * e.g., INSERT doc INTO users
 * @typedef {object} InsertStatement
 * @property {'InsertStatement'} type
 * @property {Expression} document - The document to insert.
 * @property {string} collectionName - The name of the collection.
 */


// === Expression Nodes ===

/**
 * A union type representing any possible expression.
 * @typedef {BinaryOperation | MemberExpression | FunctionCall | Literal | Identifier | ObjectExpression} Expression
 */

/**
 * Represents a binary operation.
 * e.g., u.age > 30, u.status == "active"
 * @typedef {object} BinaryOperation
 * @property {'BinaryOperation'} type
 * @property {string} operator - The operator (e.g., '==', '!=', '>', '<', 'AND', 'OR').
 * @property {Expression} left - The left-hand side expression.
 * @property {Expression} right - The right-hand side expression.
 */

/**
 * Represents accessing a property of an object.
 * e.g., u.name
 * @typedef {object} MemberExpression
 * @property {'MemberExpression'} type
 * @property {Identifier} object - The object whose property is being accessed.
 * @property {string} property - The name of the property being accessed.
 */

/**
 * Represents a function call.
 * e.g., CONCAT(u.firstName, " ", u.lastName)
 * @typedef {object} FunctionCall
 * @property {'FunctionCall'} type
 * @property {string} functionName - The name of the function being called.
 * @property {Expression[]} args - An array of arguments passed to the function.
 */

/**
 * Represents a literal value.
 * e.g., "active", 30, true, null
 * @typedef {object} Literal
 * @property {'Literal'} type
 * @property {string | number | boolean | null} value - The raw value.
 */

/**
 * Represents an identifier (a variable or collection name).
 * e.g., u, users, userCount
 * @typedef {object} Identifier
 * @property {'Identifier'} type
 * @property {string} name - The name of the identifier.
 */

/**
 * Represents an object literal expression.
 * e.g., { city: city, count: userCount }
 * @typedef {object} ObjectExpression
 * @property {'ObjectExpression'} type
 * @property {ObjectProperty[]} properties - An array of key-value pairs.
 */

/**
 * Represents a single property in an ObjectExpression.
 * @typedef {object} ObjectProperty
 * @property {string} key - The property key.
 * @property {Expression} value - The property value expression.
 */


// -----------------------------------------------------------------------------
// 2. Verification Example
// -----------------------------------------------------------------------------

// This is an example of how a moderately complex AQL query is translated
// into the Intermediary Representation defined above.
//
// AQL Query:
//
// FOR u IN users
// FILTER u.age > 30 AND u.status == "active"
// COLLECT city = u.city WITH COUNT INTO userCount
// SORT userCount DESC
// LIMIT 10
// RETURN { city: city, count: userCount }
//
const exampleIR = {
  type: 'Query',
  body: [
    // FOR u IN users
    {
      type: 'ForStatement',
      variableName: 'u',
      collectionName: 'users'
    },
    // FILTER u.age > 30 AND u.status == "active"
    {
      type: 'FilterStatement',
      condition: {
        type: 'BinaryOperation',
        operator: 'AND',
        left: {
          type: 'BinaryOperation',
          operator: '>',
          left: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: 'u' },
            property: 'age'
          },
          right: { type: 'Literal', value: 30 }
        },
        right: {
          type: 'BinaryOperation',
          operator: '==',
          left: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: 'u' },
            property: 'status'
          },
          right: { type: 'Literal', value: 'active' }
        }
      }
    },
    // COLLECT city = u.city WITH COUNT INTO userCount
    {
      type: 'CollectStatement',
      groupKeys: {
        city: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'u' },
          property: 'city'
        }
      },
      aggregations: [
        {
          method: 'COUNT',
          variableName: 'userCount'
        }
      ]
    },
    // SORT userCount DESC
    {
      type: 'SortStatement',
      criteria: [
        {
          expression: { type: 'Identifier', name: 'userCount' },
          direction: 'DESC'
        }
      ]
    },
    // LIMIT 10 (assuming offset 0 if not specified)
    {
      type: 'LimitStatement',
      offset: 0,
      count: 10
    },
    // RETURN { city: city, count: userCount }
    {
      type: 'ReturnStatement',
      expression: {
        type: 'ObjectExpression',
        properties: [
          { key: 'city', value: { type: 'Identifier', name: 'city' } },
          { key: 'count', value: { type: 'Identifier', name: 'userCount' } }
        ]
      }
    }
  ]
};
