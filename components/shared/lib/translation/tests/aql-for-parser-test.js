/**
 * @file aql-for-parser-test.js
 * @description Test suite for the FOR statement parser.
 * @note These tests are true unit tests and only contain the FOR clause itself.
 */

const getForStatementTests = () => [
    {
      description: '[ADS-1] Get MAU',
      aql: `FOR s IN sessions`,
      expected: { type: 'ForStatement', variableName: 's', collectionName: 'sessions' },
    },
    {
      description: '[ADS-2] Get Last Month Analytics',
      aql: `FOR a IN analytics`,
      expected: { type: 'ForStatement', variableName: 'a', collectionName: 'analytics' },
    },
    {
      description: '[ADS-3] Get Avg Response Time',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[ADS-4] storeAnalytics check existing',
      aql: `FOR a IN analytics`,
      expected: { type: 'ForStatement', variableName: 'a', collectionName: 'analytics' },
    },
    {
      description: '[ADS-7] Get previous MAU',
      aql: `FOR s IN sessions`,
      expected: { type: 'ForStatement', variableName: 's', collectionName: 'sessions' },
    },
    {
      description: '[ADS-8] Get last month avg response time',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[ADS-9] Get last month error rate',
      aql: `FOR a IN analytics`,
      expected: { type: 'ForStatement', variableName: 'a', collectionName: 'analytics' },
    },
    {
      description: '[ADS-10] Get last reindex time',
      aql: `FOR a IN analytics`,
      expected: { type: 'ForStatement', variableName: 'a', collectionName: 'analytics' },
    },
    {
      description: '[ADS-14] Get sample user list',
      aql: `FOR u IN users`,
      expected: { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
    },
    {
      description: '[ADS-17] searchUsers with term',
      aql: `FOR u IN users`,
      expected: { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
    },
    {
      description: '[ADS-19] searchUsers no term',
      aql: `FOR u IN users`,
      expected: { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
    },
    {
      description: '[AUTH-1] Cleanup unused verification tokens',
      aql: `FOR t IN verificationTokens`,
      expected: { type: 'ForStatement', variableName: 't', collectionName: 'verificationTokens' },
    },
    {
      description: '[AUTH-2] Remove token on email failure',
      aql: `FOR t IN verificationTokens`,
      expected: { type: 'ForStatement', variableName: 't', collectionName: 'verificationTokens' },
    },
    {
      description: '[AUTH-3] Get verification token',
      aql: `FOR t IN verificationTokens`,
      expected: { type: 'ForStatement', variableName: 't', collectionName: 'verificationTokens' },
    },
    {
      description: '[AUTH-4] Get pending email change token',
      aql: `FOR u IN users`,
      expected: { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
    },
    {
      description: '[AUTH-5] Validate reset token',
      aql: `FOR t IN passwordResetTokens`,
      expected: { type: 'ForStatement', variableName: 't', collectionName: 'passwordResetTokens' },
    },
    {
      description: '[AUTH-6] Mark reset token as used',
      aql: `FOR t IN passwordResetTokens`,
      expected: { type: 'ForStatement', variableName: 't', collectionName: 'passwordResetTokens' },
    },
    {
      description: '[AUTH-7] Get user by login name or email',
      aql: `FOR u IN users`,
      expected: { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
    },
    {
      description: '[AUTH-8] Get user by email',
      aql: `FOR u IN users`,
      expected: { type: 'ForStatement', variableName: 'u', collectionName: 'users' },
    },
    {
      description: '[AUTH-9] Cleanup expired reset tokens',
      aql: `FOR t IN passwordResetTokens`,
      expected: { type: 'ForStatement', variableName: 't', collectionName: 'passwordResetTokens' },
    },
    {
      description: '[AUTH-10] Cleanup expired verification tokens',
      aql: `FOR t IN verificationTokens`,
      expected: { type: 'ForStatement', variableName: 't', collectionName: 'verificationTokens' },
    },
    {
      description: '[ANALYTICS-1] getUniqueUsersCount test query',
      aql: `FOR a IN analytics`,
      expected: { type: 'ForStatement', variableName: 'a', collectionName: 'analytics' },
    },
    {
      description: '[ANALYTICS-5] getTimeSeriesData query',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[ANALYTICS-6] getSatisfactionGaugeData query',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[ANALYTICS-7] getSatisfactionHeatmapData query',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[CHS-1] createConversation get category name',
      aql: `FOR cat IN serviceCategories`,
      expected: { type: 'ForStatement', variableName: 'cat', collectionName: 'serviceCategories' },
    },
    {
      description: '[CHS-2] createConversation count messages',
      aql: `FOR msg IN messages`,
      expected: { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
    },
    {
      description: '[CHS-3] addMessage get latest sequence',
      aql: `FOR msg IN messages`,
      expected: { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
    },
    {
      description: '[CHS-4] getConversation messagesCursor',
      aql: `FOR msg IN messages`,
      expected: { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
    },
    {
      description: '[CHS-5] getConversation get category details',
      aql: `FOR edge IN conversationCategories`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'conversationCategories' },
    },
    {
      description: '[CHS-6] getConversation get owners',
      aql: `FOR edge IN userConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
    },
    {
      description: '[CHS-7] getUserConversations main query',
      aql: `FOR edge IN userConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
    },
    {
      description: '[CHS-9] getConversationMessages main query',
      aql: `FOR msg IN messages`,
      expected: { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
    },
    {
      description: '[CHS-10] getConversationMessages count query',
      aql: `FOR msg IN messages`,
      expected: { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
    },
    {
      description: '[CHS-11] updateConversation remove category edges',
      aql: `FOR edge IN conversationCategories`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'conversationCategories' },
    },
    {
      description: '[CHS-12] markMessagesAsRead update specific',
      aql: `FOR msgId IN @messageIdsJson`,
      expected: { type: 'ForStatement', variableName: 'msgId', collectionName: '@messageIdsJson' },
    },
    {
      description: '[CHS-13] markMessagesAsRead update all',
      aql: `FOR msg IN messages`,
      expected: { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
    },
    {
      description: '[CHS-14] markMessagesAsRead update last viewed',
      aql: `FOR edge IN userConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
    },
    {
      description: '[CHS-15] getConversationOwnerId',
      aql: `FOR edge IN userConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
    },
    {
      description: '[CHS-16] deleteConversation permission check',
      aql: `FOR edge IN userConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
    },
    {
      description: '[CHS-17] deleteConversation get message IDs',
      aql: `FOR msg IN messages`,
      expected: { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
    },
    {
      description: '[CHS-18] deleteConversation delete query-message edges',
      aql: `FOR edge IN queryMessages`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'queryMessages' },
    },
    {
      description: '[CHS-19] deleteConversation delete messages',
      aql: `FOR msg IN messages`,
      expected: { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
    },
    {
      description: '[CHS-20] deleteConversation delete user edges',
      aql: `FOR edge IN userConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
    },
    {
      description: '[CHS-21] deleteConversation delete category edges',
      aql: `FOR edge IN conversationCategories`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'conversationCategories' },
    },
    {
      description: '[CHS-22] findMessagesForQuery',
      aql: `FOR edge IN queryMessages`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'queryMessages' },
    },
    {
      description: '[CHS-23] findOriginatingQuery',
      aql: `FOR edge IN queryMessages`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'queryMessages' },
    },
    {
      description: '[CHS-24] linkQueryToConversation existing link check',
      aql: `FOR edge IN queryMessages`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'queryMessages' },
    },
    {
      description: '[CHS-25] linkQueryToConversation category exists check',
      aql: `FOR edge IN conversationCategories`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'conversationCategories' },
    },
    {
      description: '[CHS-26] linkQueryToConversation get category name',
      aql: `FOR cat IN serviceCategories`,
      expected: { type: 'ForStatement', variableName: 'cat', collectionName: 'serviceCategories' },
    },
    {
      description: '[CHS-27] searchConversations',
      aql: `FOR edge IN userConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
    },
    {
      description: '[CHS-30] getFolder conversations',
      aql: `FOR edge IN folderConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'folderConversations' },
    },
    {
      description: '[CHS-31] getFolder owners',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-32] getFolder child folders',
      aql: `FOR folder IN folders`,
      expected: { type: 'ForStatement', variableName: 'folder', collectionName: 'folders' },
    },
    {
      description: '[CHS-33] getUserFolders base query',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-34] getUserFolders folder keys query',
      aql: `FOR folder IN folders`,
      expected: { type: 'ForStatement', variableName: 'folder', collectionName: 'folders' },
    },
    {
      description: '[CHS-35] getUserFolders main query',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-36] deleteFolder permission query',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-37] deleteFolder conversation link query',
      aql: `FOR edge IN folderConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'folderConversations' },
    },
    {
      description: '[CHS-38] deleteFolder delete user edge',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-39] deleteFolder get child folders',
      aql: `FOR folder IN folders`,
      expected: { type: 'ForStatement', variableName: 'folder', collectionName: 'folders' },
    },
    {
      description: '[CHS-40] addConversationToFolder folder permission',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-41] addConversationToFolder convo permission',
      aql: `FOR edge IN userConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
    },
    {
      description: '[CHS-42] addConversationToFolder existing link',
      aql: `FOR edge IN folderConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'folderConversations' },
    },
    {
      description: '[CHS-43] removeConversationFromFolder permission',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-44] removeConversationFromFolder link query',
      aql: `FOR edge IN folderConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'folderConversations' },
    },
    {
      description: '[CHS-45] searchFolders',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-46] moveConversation convo permission',
      aql: `FOR edge IN userConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userConversations' },
    },
    {
      description: '[CHS-47] moveConversation folder permission',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-48] moveConversation existing link',
      aql: `FOR edge IN folderConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'folderConversations' },
    },
    {
      description: '[CHS-49] findConversationFolder',
      aql: `FOR edge IN folderConversations`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'folderConversations' },
    },
    {
      description: '[CHS-50] reorderFolders permission check',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-51] reorderFolders folder parent check',
      aql: `FOR folder IN folders`,
      expected: { type: 'ForStatement', variableName: 'folder', collectionName: 'folders' },
    },
    {
      description: '[CHS-52] shareFolder owner check',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-53] shareFolder existing share check',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-54] removeFolderShare owner check',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-55] removeFolderShare find share',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-56] getSharedFolders',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-57] getFolderUsers permission check',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[CHS-58] getFolderUsers get users',
      aql: `FOR edge IN userFolders`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'userFolders' },
    },
    {
      description: '[QS-1] setQueryCategory find edge',
      aql: `FOR edge IN queryCategories`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'queryCategories' },
    },
    {
      description: '[QS-2] searchQueries main query',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[QS-3] searchQueries count query',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[QS-4] deleteQuery delete session edge',
      aql: `FOR edge IN sessionQueries`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'sessionQueries' },
    },
    {
      description: '[QS-5] deleteQuery delete category edge',
      aql: `FOR edge IN queryCategories`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'queryCategories' },
    },
    {
      description: '[QS-6] getSimilarQueries',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[QS-7] getSavedQueries main query',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[QS-8] getSavedQueries count query',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[QS-9] getQueryRecommendations recent queries',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[QS-11] getPopularQueries',
      aql: `FOR q IN queries`,
      expected: { type: 'ForStatement', variableName: 'q', collectionName: 'queries' },
    },
    {
      description: '[QS-12] linkQueryToMessage find message',
      aql: `FOR msg IN messages`,
      expected: { type: 'ForStatement', variableName: 'msg', collectionName: 'messages' },
    },
    {
      description: '[SCS-1] getTranslatedName for category',
      aql: `FOR trans IN serviceCategoryTranslations`,
      expected: { type: 'ForStatement', variableName: 'trans', collectionName: 'serviceCategoryTranslations' },
    },
    {
      description: '[SCS-2] getTranslatedName for service',
      aql: `FOR trans IN serviceTranslations`,
      expected: { type: 'ForStatement', variableName: 'trans', collectionName: 'serviceTranslations' },
    },
    {
      description: '[SCS-3] getAllCategoriesWithServices',
      aql: `FOR category IN serviceCategories`,
      expected: { type: 'ForStatement', variableName: 'category', collectionName: 'serviceCategories' },
    },
    {
      description: '[SCS-5] deleteCategory delete service translations',
      aql: `FOR edge IN categoryServices`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'categoryServices' },
    },
    {
      description: '[SCS-6] deleteCategory delete services and edges',
      aql: `FOR edge IN categoryServices`,
      expected: { type: 'ForStatement', variableName: 'edge', collectionName: 'categoryServices' },
    },
    {
      description: '[SCS-7] deleteCategory delete category translations',
      aql: `FOR trans IN serviceCategoryTranslations`,
      expected: { type: 'ForStatement', variableName: 'trans', collectionName: 'serviceCategoryTranslations' },
    },
    {
      description: '[SS-1] getActiveSession',
      aql: `FOR session IN sessions`,
      expected: { type: 'ForStatement', variableName: 'session', collectionName: 'sessions' },
    },
    {
      description: '[SS-2] getUserSessions (active only)',
      aql: `FOR session IN sessions`,
      expected: { type: 'ForStatement', variableName: 'session', collectionName: 'sessions' },
    },
    {
      description: '[SS-3] getUserSessions (all)',
      aql: `FOR session IN sessions`,
      expected: { type: 'ForStatement', variableName: 'session', collectionName: 'sessions' },
    },
    {
      description: '[SS-4] cleanupExpiredSessions',
      aql: `FOR session IN sessions`,
      expected: { type: 'ForStatement', variableName: 'session', collectionName: 'sessions' },
    },
  ];
  
  // Make the function available for import
  module.exports = { getForStatementTests };
  