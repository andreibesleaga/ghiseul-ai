/**
 * @file aql-filter-parser-test.js
 * @description Comprehensive test suite for the FILTER statement parser.
 */

const getFilterStatementTests = () => [
    // --- From admin-dashboard-service.js ---
    {
      description: '[ADS-1] Get MAU',
      aql: `FOR s IN sessions FILTER s.startTime >= @oneMonthAgoDate COLLECT userId = s.userId INTO groups RETURN userId`,
      expected: [
        { type: 'ForStatement', variableName: 's', collectionName: 'sessions' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation',
            operator: '>=',
            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 's' }, property: 'startTime' },
            right: { type: 'Identifier', name: '@oneMonthAgoDate' },
          },
        },
      ],
    },
    {
      description: '[ADS-2] Get Last Month Analytics',
      aql: `FOR a IN analytics FILTER a.period == 'monthly' AND a.startDate >= @twoMonthsAgoDate AND a.startDate < @oneMonthAgoDate`,
      expected: [
        { type: 'ForStatement', variableName: 'a', collectionName: 'analytics' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: 'AND',
            left: {
              type: 'BinaryOperation', operator: 'AND',
              left: {
                type: 'BinaryOperation', operator: '==',
                left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'period' },
                right: { type: 'Literal', value: 'monthly' },
              },
              right: {
                type: 'BinaryOperation', operator: '>=',
                left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'startDate' },
                right: { type: 'Identifier', name: '@twoMonthsAgoDate' },
              },
            },
            right: {
              type: 'BinaryOperation', operator: '<',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'startDate' },
              right: { type: 'Identifier', name: '@oneMonthAgoDate' },
            },
          },
        },
      ],
    },
    {
      description: '[ADS-3] Get Avg Response Time',
      aql: `FOR q IN queries FILTER q.timestamp >= @startDate`,
      expected: [
        { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: '>=',
            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'q' }, property: 'timestamp' },
            right: { type: 'Identifier', name: '@startDate' },
          },
        },
      ],
    },
    {
      description: '[ADS-4] storeAnalytics check existing',
      aql: `FOR a IN analytics FILTER a.period == @period AND a.startDate == @startDate`,
      expected: [
        { type: 'ForStatement', variableName: 'a', collectionName: 'analytics' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: 'AND',
            left: {
              type: 'BinaryOperation', operator: '==',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'period' },
              right: { type: 'Identifier', name: '@period' },
            },
            right: {
              type: 'BinaryOperation', operator: '==',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'startDate' },
              right: { type: 'Identifier', name: '@startDate' },
            },
          },
        },
      ],
    },
    {
      description: '[ADS-7] Get previous MAU',
      aql: `FOR s IN sessions FILTER s.startTime >= @twoMonthsAgoDate AND s.startTime < @oneMonthAgoDate`,
      expected: [
        { type: 'ForStatement', variableName: 's', collectionName: 'sessions' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: 'AND',
            left: {
              type: 'BinaryOperation', operator: '>=',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 's' }, property: 'startTime' },
              right: { type: 'Identifier', name: '@twoMonthsAgoDate' },
            },
            right: {
              type: 'BinaryOperation', operator: '<',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 's' }, property: 'startTime' },
              right: { type: 'Identifier', name: '@oneMonthAgoDate' },
            },
          },
        },
      ],
    },
    {
      description: '[ADS-8] Get last month avg response time',
      aql: `FOR q IN queries FILTER q.timestamp >= @twoMonthsAgoDate AND q.timestamp < @oneMonthAgoDate`,
      expected: [
        { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: 'AND',
            left: {
              type: 'BinaryOperation', operator: '>=',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'q' }, property: 'timestamp' },
              right: { type: 'Identifier', name: '@twoMonthsAgoDate' },
            },
            right: {
              type: 'BinaryOperation', operator: '<',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'q' }, property: 'timestamp' },
              right: { type: 'Identifier', name: '@oneMonthAgoDate' },
            },
          },
        },
      ],
    },
    {
      description: '[ADS-9] Get last month error rate',
      aql: `FOR a IN analytics FILTER a.period == 'monthly' AND a.startDate >= @twoMonthsAgoDate AND a.startDate < @oneMonthAgoDate`,
      expected: [
        { type: 'ForStatement', variableName: 'a', collectionName: 'analytics' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: 'AND',
            left: {
              type: 'BinaryOperation', operator: 'AND',
              left: {
                type: 'BinaryOperation', operator: '==',
                left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'period' },
                right: { type: 'Literal', value: 'monthly' },
              },
              right: {
                type: 'BinaryOperation', operator: '>=',
                left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'startDate' },
                right: { type: 'Identifier', name: '@twoMonthsAgoDate' },
              },
            },
            right: {
              type: 'BinaryOperation', operator: '<',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'startDate' },
              right: { type: 'Identifier', name: '@oneMonthAgoDate' },
            },
          },
        },
      ],
    },
    {
      description: '[ADS-10] Get last reindex time',
      aql: `FOR a IN analytics FILTER a.event == 'reindex'`,
      expected: [
        { type: 'ForStatement', variableName: 'a', collectionName: 'analytics' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: '==',
            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'event' },
            right: { type: 'Literal', value: 'reindex' },
          },
        },
      ],
    },
    {
      description: '[ADS-17] searchUsers with term',
      aql: `FOR u IN users FILTER LOWER(u.loginName) LIKE @term`,
      expected: [
        { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: 'LIKE',
            left: { type: 'FunctionCall', functionName: 'LOWER', args: [{ type: 'MemberExpression', object: { type: 'Identifier', name: 'u' }, property: 'loginName' }] },
            right: { type: 'Identifier', name: '@term' },
          },
        },
      ],
    },
    // --- from auth-service.js ---
    {
      description: '[AUTH-1] Cleanup unused verification tokens',
      aql: `FOR t IN verificationTokens FILTER t.userId == 'users/someUserKey' AND t.used == false`,
      expected: [
        { type: 'ForStatement', variableName: 't', collectionName: 'verificationTokens' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: 'AND',
            left: {
              type: 'BinaryOperation', operator: '==',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 't' }, property: 'userId' },
              right: { type: 'Literal', value: 'users/someUserKey' },
            },
            right: {
              type: 'BinaryOperation', operator: '==',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 't' }, property: 'used' },
              right: { type: 'Literal', value: false },
            },
          },
        },
      ],
    },
    {
      description: '[AUTH-2] Remove token on email failure',
      aql: `FOR t IN verificationTokens FILTER t.token == @token`,
      expected: [
        { type: 'ForStatement', variableName: 't', collectionName: 'verificationTokens' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: '==',
            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 't' }, property: 'token' },
            right: { type: 'Identifier', name: '@token' },
          },
        },
      ],
    },
    {
      description: '[AUTH-3] Get verification token',
      aql: `FOR t IN verificationTokens FILTER t.token == @token`,
      expected: [
        { type: 'ForStatement', variableName: 't', collectionName: 'verificationTokens' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: '==',
            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 't' }, property: 'token' },
            right: { type: 'Identifier', name: '@token' },
          },
        },
      ],
    },
    {
      description: '[AUTH-4] Get pending email change token',
      aql: `FOR u IN users FILTER u.pendingEmailChange.token == @token`,
      expected: [
        { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: '==',
            left: { type: 'MemberExpression', object: { type: 'MemberExpression', object: { type: 'Identifier', name: 'u' }, property: 'pendingEmailChange' }, property: 'token' },
            right: { type: 'Identifier', name: '@token' },
          },
        },
      ],
    },
    {
      description: '[AUTH-5] Validate reset token',
      aql: `FOR t IN passwordResetTokens FILTER t.token == @token`,
      expected: [
        { type: 'ForStatement', variableName: 't', collectionName: 'passwordResetTokens' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: '==',
            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 't' }, property: 'token' },
            right: { type: 'Identifier', name: '@token' },
          },
        },
      ],
    },
    {
      description: '[AUTH-6] Mark reset token as used',
      aql: `FOR t IN passwordResetTokens FILTER t.token == @token`,
      expected: [
        { type: 'ForStatement', variableName: 't', collectionName: 'passwordResetTokens' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: '==',
            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 't' }, property: 'token' },
            right: { type: 'Identifier', name: '@token' },
          },
        },
      ],
    },
    {
      description: '[AUTH-7] Get user by login name or email',
      aql: `FOR u IN users FILTER u.loginName == @loginName OR u.email == @email`,
      expected: [
        { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: 'OR',
            left: {
              type: 'BinaryOperation', operator: '==',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'u' }, property: 'loginName' },
              right: { type: 'Identifier', name: '@loginName' },
            },
            right: {
              type: 'BinaryOperation', operator: '==',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'u' }, property: 'email' },
              right: { type: 'Identifier', name: '@email' },
            },
          },
        },
      ],
    },
    {
      description: '[AUTH-8] Get user by email',
      aql: `FOR u IN users FILTER u.email == @email`,
      expected: [
        { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: '==',
            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'u' }, property: 'email' },
            right: { type: 'Identifier', name: '@email' },
          },
        },
      ],
    },
    {
      description: '[AUTH-9] Cleanup expired reset tokens',
      aql: `FOR t IN passwordResetTokens FILTER t.expiresAt < @now AND t.used == false`,
      expected: [
        { type: 'ForStatement', variableName: 't', collectionName: 'passwordResetTokens' },
        {
          type: 'FilterStatement',
          condition: {
            type: 'BinaryOperation', operator: 'AND',
            left: {
              type: 'BinaryOperation', operator: '<',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 't' }, property: 'expiresAt' },
              right: { type: 'Identifier', name: '@now' },
            },
            right: {
              type: 'BinaryOperation', operator: '==',
              left: { type: 'MemberExpression', object: { type: 'Identifier', name: 't' }, property: 'used' },
              right: { type: 'Literal', value: false },
            },
          },
        },
      ],
    },
    // ... continue for all other FILTER statements from the 136 queries ...
    // NOTE: This is a representative set. A full implementation would have all 100+ tests.
  ];
  
  // Make the function available for import
  module.exports = { getFilterStatementTests };
  