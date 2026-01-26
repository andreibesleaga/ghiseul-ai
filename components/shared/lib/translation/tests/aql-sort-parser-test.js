/**
 * @file aql-sort-parser-test.js
 * @description Comprehensive test suite for the SORT statement parser.
 */

const getSortStatementTests = () => [
    // --- from admin-dashboard-service.js ---
    {
        description: '[ADS-2] Get Last Month Analytics',
        aql: `FOR a IN analytics FILTER a.period == 'monthly' AND a.startDate >= @twoMonthsAgoDate AND a.startDate < @oneMonthAgoDate SORT a.startDate DESC`,
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
                            right: { type: 'Literal', value: 'monthly' }
                        },
                        right: {
                            type: 'BinaryOperation', operator: '>=',
                            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'startDate' },
                            right: { type: 'Identifier', name: '@twoMonthsAgoDate' }
                        }
                    },
                    right: {
                        type: 'BinaryOperation', operator: '<',
                        left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'startDate' },
                        right: { type: 'Identifier', name: '@oneMonthAgoDate' }
                    }
                }
            },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'a' }, property: 'startDate' },
                        direction: 'DESC'
                    }
                ]
            }
        ]
    },
    {
        description: '[ADS-14] Get sample user list',
        aql: `FOR u IN users SORT u.updatedAt DESC`,
        expected: [
            { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'u' }, property: 'updatedAt' },
                        direction: 'DESC'
                    }
                ]
            }
        ]
    },
    {
        description: '[ADS-17] searchUsers with term',
        aql: `FOR u IN users FILTER LOWER(u.loginName) LIKE @term SORT u.updatedAt DESC`,
        expected: [
            { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
            {
                type: 'FilterStatement',
                condition: {
                    type: 'BinaryOperation', operator: 'LIKE',
                    left: { type: 'FunctionCall', functionName: 'LOWER', args: [{ type: 'MemberExpression', object: { type: 'Identifier', name: 'u' }, property: 'loginName' }] },
                    right: { type: 'Identifier', name: '@term' }
                }
            },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'u' }, property: 'updatedAt' },
                        direction: 'DESC'
                    }
                ]
            }
        ]
    },
    {
        description: '[ADS-19] searchUsers no term',
        aql: `FOR u IN users SORT u.updatedAt DESC`,
        expected: [
            { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'u' }, property: 'updatedAt' },
                        direction: 'DESC'
                    }
                ]
            }
        ]
    },
    // --- from chat-history-service.js ---
    {
        description: '[CHS-3] addMessage get latest sequence',
        aql: `FOR msg IN messages FILTER msg.conversationId == @conversationId SORT msg.sequence DESC`,
        expected: [
            { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
            {
                type: 'FilterStatement',
                condition: {
                    type: 'BinaryOperation', operator: '==',
                    left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'msg' }, property: 'conversationId' },
                    right: { type: 'Identifier', name: '@conversationId' }
                }
            },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'msg' }, property: 'sequence' },
                        direction: 'DESC'
                    }
                ]
            }
        ]
    },
    {
        description: '[CHS-4] getConversation messagesCursor',
        aql: `FOR msg IN messages FILTER msg.conversationId == @conversationId SORT msg.sequence ASC`,
        expected: [
            { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
            {
                type: 'FilterStatement',
                condition: {
                    type: 'BinaryOperation', operator: '==',
                    left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'msg' }, property: 'conversationId' },
                    right: { type: 'Identifier', name: '@conversationId' }
                }
            },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'msg' }, property: 'sequence' },
                        direction: 'ASC'
                    }
                ]
            }
        ]
    },
    {
        description: '[CHS-7] getUserConversations main query',
        aql: `FOR edge IN userConversations FILTER edge._from == @userId LET conversation = DOCUMENT(edge._to) FILTER conversation.isArchived == false SORT conversation.updated DESC`,
        expected: [
            { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
            {
                type: 'FilterStatement',
                condition: {
                    type: 'BinaryOperation', operator: '==',
                    left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'edge' }, property: '_from' },
                    right: { type: 'Identifier', name: '@userId' }
                }
            },
            {
                type: 'LetStatement',
                variableName: 'conversation',
                expression: {
                    type: 'FunctionCall',
                    functionName: 'DOCUMENT',
                    args: [{ type: 'MemberExpression', object: { type: 'Identifier', name: 'edge' }, property: '_to' }]
                }
            },
            {
                type: 'FilterStatement',
                condition: {
                    type: 'BinaryOperation', operator: '==',
                    left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'conversation' }, property: 'isArchived' },
                    right: { type: 'Literal', value: false }
                }
            },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'conversation' }, property: 'updated' },
                        direction: 'DESC'
                    }
                ]
            }
        ]
    },
    {
        description: '[CHS-32] getFolder child folders',
        aql: `FOR folder IN folders FILTER folder.parentFolderId == 'abc' SORT folder.order ASC, folder.created ASC`,
        expected: [
            { type: 'ForStatement', variableName: 'folder', collectionName: 'folders' },
            {
                type: 'FilterStatement',
                condition: {
                    type: 'BinaryOperation', operator: '==',
                    left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'folder' }, property: 'parentFolderId' },
                    right: { type: 'Literal', value: 'abc' }
                }
            },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'folder' }, property: 'order' },
                        direction: 'ASC'
                    },
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'folder' }, property: 'created' },
                        direction: 'ASC'
                    }
                ]
            }
        ]
    },
    // --- from query-service.js ---
    {
        description: '[QS-2] searchQueries main query',
        aql: `FOR q IN queries FILTER q.userId == @userId AND q.userFeedback != null SORT q.timestamp DESC`,
        expected: [
            { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
            {
                type: 'FilterStatement',
                condition: {
                    type: 'BinaryOperation', operator: 'AND',
                    left: {
                        type: 'BinaryOperation', operator: '==',
                        left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'q' }, property: 'userId' },
                        right: { type: 'Identifier', name: '@userId' }
                    },
                    right: {
                        type: 'BinaryOperation', operator: '!=',
                        left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'q' }, property: 'userFeedback' },
                        right: { type: 'Literal', value: null }
                    }
                }
            },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'q' }, property: 'timestamp' },
                        direction: 'DESC'
                    }
                ]
            }
        ]
    },
    {
        description: '[QS-11] getPopularQueries',
        aql: `FOR q IN queries COLLECT text = q.text WITH COUNT INTO count SORT count DESC`,
        expected: [
            { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'Identifier', name: 'count' },
                        direction: 'DESC'
                    }
                ]
            }
        ]
    },
    // --- from service-category-service.js ---
    {
        description: '[SCS-3] getAllCategoriesWithServices',
        aql: `FOR category IN serviceCategories SORT category.order ASC`,
        expected: [
            { type: 'ForStatement', variableName: 'category', collectionName: 'serviceCategories' },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'category' }, property: 'order' },
                        direction: 'ASC'
                    }
                ]
            }
        ]
    },
    // --- from session-service.js ---
    {
        description: '[SS-1] getActiveSession',
        aql: `FOR session IN sessions FILTER session.userId == @userId AND session.active == true AND session.endTime == null SORT session.startTime DESC`,
        expected: [
            { type: 'ForStatement', variableName: 'session', collectionName: 'sessions' },
            {
                type: 'FilterStatement',
                condition: {
                    type: 'BinaryOperation', operator: 'AND',
                    left: {
                        type: 'BinaryOperation', operator: 'AND',
                        left: {
                            type: 'BinaryOperation', operator: '==',
                            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'session' }, property: 'userId' },
                            right: { type: 'Identifier', name: '@userId' }
                        },
                        right: {
                            type: 'BinaryOperation', operator: '==',
                            left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'session' }, property: 'active' },
                            right: { type: 'Literal', value: true }
                        }
                    },
                    right: {
                        type: 'BinaryOperation', operator: '==',
                        left: { type: 'MemberExpression', object: { type: 'Identifier', name: 'session' }, property: 'endTime' },
                        right: { type: 'Literal', value: null }
                    }
                }
            },
            {
                type: 'SortStatement',
                criteria: [
                    {
                        expression: { type: 'MemberExpression', object: { type: 'Identifier', name: 'session' }, property: 'startTime' },
                        direction: 'DESC'
                    }
                ]
            }
        ]
    }
];

module.exports = { getSortStatementTests };