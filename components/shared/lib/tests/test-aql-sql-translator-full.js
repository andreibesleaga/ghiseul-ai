// test-translator.js - Unit and Integration Tests for aql-to-sql.js

const { AqlToSqlTranslator } = require('../aql-to-sql.js'); // Adjust path if needed
const dbService = require('../db-connection-service'); // Adjust path if needed

// --- Test Configuration ---

const RUN_INTEGRATION_TESTS = process.argv.includes('--integration');

// =================================================================
// Test Suite Definition
// =================================================================

// Instantiate with all known edge collections from the services
const translator = new AqlToSqlTranslator([
    'userSessions', 'userConversations', 'conversationCategories', 'queryMessages',
    'categoryServices', 'sessionQueries', 'userFolders', 'folderConversations'
]);

// The complete suite of 122 tests with REFINED expectedSql based on MetaAI feedback
const testSuite = [
    // --- from admin-dashboard-service.js (19 tests) ---
    {
        description: '[ADS-1] Get MAU',
        aql: `FOR s IN sessions FILTER s.startTime >= @oneMonthAgoDate COLLECT userId = s.userId INTO groups RETURN userId`,
        expectedSql: `SELECT s.userId FROM sessions LET s = @this WHERE s.startTime >= :oneMonthAgoDate GROUP BY s.userId`,
    },
    {
        description: '[ADS-2] Get Last Month Analytics',
        aql: `FOR a IN analytics FILTER a.period == 'monthly' AND a.startDate >= @twoMonthsAgoDate AND a.startDate < @oneMonthAgoDate SORT a.startDate DESC LIMIT 1 RETURN a`,
        expectedSql: `SELECT a FROM analytics LET a = @this WHERE a.period == 'monthly' AND a.startDate >= :twoMonthsAgoDate AND a.startDate < :oneMonthAgoDate ORDER BY a.startDate DESC LIMIT 1`,
    },
    {
        description: '[ADS-3] Get Avg Response Time',
        aql: `FOR q IN queries FILTER q.timestamp >= @startDate COLLECT AGGREGATE avgTime = AVERAGE(q.responseTime * 1000), count = COUNT() RETURN { avgTime, count }`,
        expectedSql: `SELECT AVERAGE(q.responseTime * 1000) AS avgTime, COUNT(*) AS count FROM queries LET q = @this WHERE q.timestamp >= :startDate`,
    },
    {
        description: '[ADS-4] storeAnalytics check existing',
        aql: `FOR a IN analytics FILTER a.period == @period AND a.startDate == @startDate LIMIT 1 RETURN a`,
        expectedSql: `SELECT a FROM analytics LET a = @this WHERE a.period == :period AND a.startDate == :startDate LIMIT 1`,
    },
    {
        description: '[ADS-5] storeAnalytics update',
        aql: `UPDATE @key WITH @data IN analytics`,
        expectedSql: `UPDATE analytics SET content = :data WHERE @rid = :key`,
    },
    {
        description: '[ADS-6] storeAnalytics insert',
        aql: `INSERT @data INTO analytics`,
        expectedSql: `INSERT :data INTO analytics`,
    },
    {
        description: '[ADS-7] Get previous MAU',
        aql: `FOR s IN sessions FILTER s.startTime >= @twoMonthsAgoDate AND s.startTime < @oneMonthAgoDate COLLECT userId = s.userId INTO groups RETURN userId`,
        expectedSql: `SELECT s.userId FROM sessions LET s = @this WHERE s.startTime >= :twoMonthsAgoDate AND s.startTime < :oneMonthAgoDate GROUP BY s.userId`,
    },
    {
        description: '[ADS-8] Get last month avg response time',
        aql: `FOR q IN queries FILTER q.timestamp >= @twoMonthsAgoDate AND q.timestamp < @oneMonthAgoDate COLLECT AGGREGATE avgTime = AVERAGE(q.responseTime * 1000) RETURN avgTime`,
        expectedSql: `SELECT avg(q.responseTime * 1000) AS avgTime FROM queries LET q = @this WHERE q.timestamp >= :twoMonthsAgoDate AND q.timestamp < :oneMonthAgoDate`,
    },
    {
        description: '[ADS-9] Get last month error rate',
        aql: `FOR a IN analytics FILTER a.period == 'monthly' AND a.startDate >= @twoMonthsAgoDate AND a.startDate < @oneMonthAgoDate SORT a.startDate DESC LIMIT 1 RETURN a.errorRate`,
        expectedSql: `SELECT a.errorRate FROM analytics LET a = @this WHERE a.period == 'monthly' AND a.startDate >= :twoMonthsAgoDate AND a.startDate < :oneMonthAgoDate ORDER BY a.startDate DESC LIMIT 1`,
    },
    {
        description: '[ADS-10] Get last reindex time',
        aql: `FOR a IN analytics FILTER a.event == 'reindex' SORT a.timestamp DESC LIMIT 1 RETURN a.timestamp`,
        expectedSql: `SELECT a.timestamp FROM analytics LET a = @this WHERE a.event == 'reindex' ORDER BY a.timestamp DESC LIMIT 1`,
    },
    {
        description: '[ADS-11] Get total user count',
        aql: `RETURN LENGTH(FOR u IN users RETURN 1)`,
        expectedSql: `SELECT COUNT(*) FROM (SELECT 1 FROM users LET u = @this)`,
    },
    {
        description: '[ADS-12] Get active users (last day) - REFINED',
        aql: `LET oneDayAgo = DATE_SUBTRACT(DATE_NOW(), 1, "day") RETURN LENGTH( FOR s IN sessions FILTER s.startTime >= oneDayAgo OR s.active == true COLLECT userId = s.userId RETURN 1 )`,
        expectedSql: `WITH oneDayAgo AS (SELECT date_add(sysdate(), 'day', -1) AS date) SELECT COUNT(*) FROM (SELECT 1 FROM sessions LET s = @this WHERE s.startTime >= (SELECT date FROM oneDayAgo) OR s.active == true GROUP BY s.userId)`,
    },
    {
        description: '[ADS-13] Get new users (last month)',
        aql: `LET oneMonthAgo = DATE_SUBTRACT(DATE_NOW(), 1, "month") RETURN LENGTH( FOR u IN users FILTER DATE_TIMESTAMP(u.createdAt) >= DATE_TIMESTAMP(oneMonthAgo) RETURN 1 )`,
        expectedSql: `WITH oneMonthAgo AS (date_add(sysdate(), 'month', -1)) SELECT COUNT(*) FROM (SELECT 1 FROM users LET u = @this WHERE date(u.createdAt) >= date(oneMonthAgo))`,
    },
    {
        description: '[ADS-14] Get sample user list',
        aql: `FOR u IN users SORT u.updatedAt DESC LIMIT 10 RETURN { _key: u._key, loginName: u.loginName, email: u.email, fullName: HAS(u, "personalIdentification") ? u.personalIdentification.fullName : "", role: HAS(u, "role") ? u.role : "User" }`,
        expectedSql: `SELECT u._key AS _key, u.loginName AS loginName, u.email AS email, (u.personalIdentification IS NOT NULL AND u.personalIdentification != {}) ? u.personalIdentification.fullName : "" AS fullName, (u.role IS NOT NULL AND u.role != {}) ? u.role : "User" AS role FROM users LET u = @this ORDER BY u.updatedAt DESC LIMIT 10`,
    },
    {
        description: '[ADS-15] Check DB Health',
        aql: `RETURN 1`,
        expectedSql: `SELECT 1 as health_check`,
    },
    {
        description: '[ADS-16] searchUsers count with term',
        aql: `RETURN LENGTH( FOR u IN users FILTER LOWER(u.loginName) LIKE @term RETURN 1 )`,
        expectedSql: `SELECT COUNT(*) FROM (SELECT 1 FROM users LET u = @this WHERE lower(u.loginName) LIKE :term)`,
    },
    {
        description: '[ADS-17] searchUsers with term',
        aql: `FOR u IN users FILTER LOWER(u.loginName) LIKE @term SORT u.updatedAt DESC LIMIT @offset, @limit RETURN { _key: u._key, loginName: u.loginName, email: u.email, role: u.role }`,
        expectedSql: `SELECT u._key AS _key, u.loginName AS loginName, u.email AS email, u.role AS role FROM users LET u = @this WHERE lower(u.loginName) LIKE :term ORDER BY u.updatedAt DESC LIMIT :limit OFFSET :offset`,
    },
    {
        description: '[ADS-18] searchUsers count no term',
        aql: `RETURN LENGTH( FOR u IN users RETURN 1 )`,
        expectedSql: `SELECT COUNT(*) FROM (SELECT 1 FROM users LET u = @this)`,
    },
    {
        description: '[ADS-19] searchUsers no term',
        aql: `FOR u IN users SORT u.updatedAt DESC LIMIT @offset, @limit RETURN { _key: u._key, loginName: u.loginName, email: u.email, role: u.role }`,
        expectedSql: `SELECT u._key AS _key, u.loginName AS loginName, u.email AS email, u.role AS role FROM users LET u = @this ORDER BY u.updatedAt DESC LIMIT :limit OFFSET :offset`,
    },

    // --- from auth-service.js (10 tests) ---
    {
        description: '[AUTH-1] Cleanup unused verification tokens - REFINED',
        aql: `FOR t IN verificationTokens FILTER t.userId == 'users/someUserKey' AND t.used == false REMOVE t IN verificationTokens`,
        expectedSql: `DELETE FROM verificationTokens WHERE userId == 'users/someUserKey' AND used == false`,
    },
    {
        description: '[AUTH-2] Remove token on email failure - REFINED',
        aql: `FOR t IN verificationTokens FILTER t.token == @token REMOVE t IN verificationTokens`,
        expectedSql: `DELETE FROM verificationTokens WHERE token == :token`,
    },
    {
        description: '[AUTH-3] Get verification token',
        aql: `FOR t IN verificationTokens FILTER t.token == @token RETURN t`,
        expectedSql: `SELECT t FROM verificationTokens LET t = @this WHERE t.token == :token`,
    },
    {
        description: '[AUTH-4] Get pending email change token',
        aql: `FOR u IN users FILTER u.pendingEmailChange.token == @token RETURN { userId: u._id, token: u.pendingEmailChange.token, email: u.pendingEmailChange.email, expiresAt: DATE_ADD(u.updatedAt, 24, 'hour'), used: false }`,
        expectedSql: `SELECT u._id AS userId, u.pendingEmailChange.token AS token, u.pendingEmailChange.email AS email, date_add(u.updatedAt, 'hour', 24) AS expiresAt, false AS used FROM users LET u = @this WHERE u.pendingEmailChange.token == :token`,
    },
    {
        description: '[AUTH-5] Validate reset token',
        aql: `FOR t IN passwordResetTokens FILTER t.token == @token RETURN t`,
        expectedSql: `SELECT t FROM passwordResetTokens LET t = @this WHERE t.token == :token`,
    },
    {
        description: '[AUTH-6] Mark reset token as used - REFINED',
        aql: `FOR t IN passwordResetTokens FILTER t.token == @token UPDATE t WITH { used: true } IN passwordResetTokens RETURN NEW`,
        expectedSql: `UPDATE passwordResetTokens SET used = true WHERE token == :token RETURN AFTER`,
    },
    {
        description: '[AUTH-7] Get user by login name or email',
        aql: `FOR u IN users FILTER u.loginName == @loginName OR u.email == @email RETURN u`,
        expectedSql: `SELECT u FROM users LET u = @this WHERE u.loginName == :loginName OR u.email == :email`,
    },
    {
        description: '[AUTH-8] Get user by email',
        aql: `FOR u IN users FILTER u.email == @email RETURN u`,
        expectedSql: `SELECT u FROM users LET u = @this WHERE u.email == :email`,
    },
    {
        description: '[AUTH-9] Cleanup expired reset tokens - REFINED',
        aql: `FOR t IN passwordResetTokens FILTER t.expiresAt < @now AND t.used == false REMOVE t IN passwordResetTokens RETURN OLD`,
        expectedSql: `DELETE FROM passwordResetTokens WHERE expiresAt < :now AND used == false RETURN BEFORE`,
    },
    {
        description: '[AUTH-10] Cleanup expired verification tokens - REFINED',
        aql: `FOR t IN verificationTokens FILTER t.expiresAt < @now AND t.used == false REMOVE t IN verificationTokens RETURN OLD`,
        expectedSql: `DELETE FROM verificationTokens WHERE expiresAt < :now AND used == false RETURN BEFORE`,
    },

    // --- from analytics-service.js (7 tests) ---
    {
        description: '[ANALYTICS-1] getUniqueUsersCount test query',
        aql: `FOR a IN analytics FILTER a.type == 'query' LIMIT 5 RETURN a.userId`,
        expectedSql: `SELECT a.userId FROM analytics LET a = @this WHERE a.type == 'query' LIMIT 5`,
    },
    {
        description: '[ANALYTICS-2] getUniqueUsersCount main query',
        aql: `LET usersList = ( FOR a IN analytics FILTER a.type == 'query' AND a.timestamp >= @startDate AND a.timestamp <= @endDate AND a.userId != null AND a.userId != "" RETURN DISTINCT a.userId ) RETURN LENGTH(usersList)`,
        expectedSql: `WITH usersList AS (SELECT DISTINCT a.userId FROM analytics LET a = @this WHERE a.type == 'query' AND a.timestamp >= :startDate AND a.timestamp <= :endDate AND a.userId != null AND a.userId != "") SELECT size(usersList)`,
    },
    {
        description: '[ANALYTICS-3] getDashboardAnalytics test query',
        aql: `RETURN { test: "Connection is working" }`,
        expectedSql: `SELECT "Connection is working" AS test`,
    },
    {
        description: '[ANALYTICS-4] getDashboardAnalytics main query (simplified)',
        aql: `LET totalQueriesCount = ( FOR a IN analytics FILTER a.type == 'query' AND a.timestamp >= @startDate AND a.timestamp <= @endDate COLLECT WITH COUNT INTO count RETURN count )[0] RETURN { queries: { total: totalQueriesCount } }`,
        expectedSql: `WITH totalQueriesCount AS (SELECT COUNT(*) AS count FROM analytics LET a = @this WHERE a.type == 'query' AND a.timestamp >= :startDate AND a.timestamp <= :endDate)[0] SELECT { "total" : totalQueriesCount } AS queries`,
    },
    {
        description: '[ANALYTICS-5] getTimeSeriesData query',
        aql: `FOR q IN queries FILTER q.timestamp >= @startDate AND q.timestamp <= @endDate COLLECT dateGroup = DATE_FORMAT(q.timestamp, @dateFormat) INTO groups LET uniqueUsers = LENGTH(UNIQUE(groups[*].q.userId)) LET totalQueries = LENGTH(groups) RETURN { date: dateGroup, totalQueries: totalQueries, uniqueUsers: uniqueUsers }`,
        expectedSql: `SELECT dateGroup AS date, size(groups) AS totalQueries, size((SELECT COLLECT(DISTINCT value) FROM UNNEST(groups[*].q.userId) AS value)) AS uniqueUsers FROM queries LET q = @this WHERE q.timestamp >= :startDate AND q.timestamp <= :endDate GROUP BY dateGroup = format_date(q.timestamp, :dateFormat)`,
    },
    {
        description: '[ANALYTICS-6] getSatisfactionGaugeData query',
        aql: `FOR q IN queries FILTER q.userFeedback != null AND q.userFeedback.rating != null AND DATE_TIMESTAMP(q.timestamp) >= @start AND DATE_TIMESTAMP(q.timestamp) <= @end COLLECT categoryId = q.categoryId AGGREGATE totalRatings = COUNT(), sumRatings = SUM(TO_NUMBER(q.userFeedback.rating)) FILTER totalRatings > 0 RETURN { categoryId, average: (sumRatings / totalRatings) }`,
        expectedSql: `SELECT categoryId, (sumRatings / totalRatings) AS average FROM queries LET q = @this WHERE q.userFeedback != null AND q.userFeedback.rating != null AND date(q.timestamp) >= :start AND date(q.timestamp) <= :end GROUP BY categoryId = q.categoryId LET totalRatings = COUNT(*), sumRatings = sum(toFloat(q.userFeedback.rating)) HAVING totalRatings > 0`,
    },
    {
        description: '[ANALYTICS-7] getSatisfactionHeatmapData query',
        aql: `FOR q IN queries FILTER q.userFeedback != null AND q.userFeedback.rating != null AND DATE_TIMESTAMP(q.timestamp) >= @start AND DATE_TIMESTAMP(q.timestamp) <= @end COLLECT categoryId = q.categoryId AGGREGATE totalRatings = COUNT(), sumRatings = SUM(TO_NUMBER(q.userFeedback.rating)) RETURN { categoryId, average: totalRatings > 0 ? (sumRatings / totalRatings) : 0 }`,
        expectedSql: `SELECT categoryId, (totalRatings > 0) ? (sumRatings / totalRatings) : 0 AS average FROM queries LET q = @this WHERE q.userFeedback != null AND q.userFeedback.rating != null AND date(q.timestamp) >= :start AND date(q.timestamp) <= :end GROUP BY categoryId = q.categoryId LET totalRatings = COUNT(*), sumRatings = sum(toFloat(q.userFeedback.rating))`,
    },

    // --- from chat-history-service.js (59 tests) ---
    { description: '[CHS-1] createConversation get category name', aql: `FOR cat IN serviceCategories FILTER cat._key == @categoryId RETURN cat.nameEN`, expectedSql: `SELECT cat.nameEN FROM serviceCategories LET cat = @this WHERE cat._key == :categoryId` },
    { description: '[CHS-2] createConversation count messages', aql: `FOR msg IN messages FILTER msg.conversationId == @generatedKey RETURN msg`, expectedSql: `SELECT msg FROM messages LET msg = @this WHERE msg.conversationId == :generatedKey` },
    { description: '[CHS-3] addMessage get latest sequence', aql: `FOR msg IN messages FILTER msg.conversationId == @conversationId SORT msg.sequence DESC LIMIT 1 RETURN msg.sequence`, expectedSql: `SELECT msg.sequence FROM messages LET msg = @this WHERE msg.conversationId == :conversationId ORDER BY msg.sequence DESC LIMIT 1` },
    { description: '[CHS-4] getConversation messagesCursor - REFINED', aql: `FOR msg IN messages FILTER msg.conversationId == @conversationId SORT msg.sequence ASC LET queryLink = ( FOR edge IN queryMessages FILTER edge._to == CONCAT('messages/', msg._key) FOR q IN queries FILTER q._id == edge._from RETURN q._key )[0] RETURN MERGE(msg, { queryId: queryLink })`, expectedSql: `SELECT msg, (SELECT q._key FROM queryMessages LET edge = @this JOIN queries ON q._id = edge._from WHERE edge._to == concat('messages/', msg._key))[0] AS queryLink FROM messages LET msg = @this WHERE msg.conversationId == :conversationId ORDER BY msg.sequence ASC` },
    { description: '[CHS-5] getConversation get category details - REFINED', aql: `FOR edge IN conversationCategories FILTER edge._from == @conversationId FOR cat IN serviceCategories FILTER cat._id == edge._to RETURN { _id: cat._id, nameEN: cat.nameEN, relevanceScore: edge.relevanceScore }`, expectedSql: `SELECT cat._id AS _id, cat.nameEN AS nameEN, edge.relevanceScore AS relevanceScore FROM conversationCategories as edge JOIN serviceCategories as cat ON cat._id = edge._to WHERE edge._from == :conversationId` },
    { description: '[CHS-6] getConversation get owners - REFINED', aql: `FOR edge IN userConversations FILTER edge._to == @conversationId FOR user IN users FILTER user._id == edge._from RETURN { _id: user._id, role: edge.role }`, expectedSql: `SELECT user._id AS _id, edge.role AS role FROM userConversations as edge JOIN users as user ON user._id = edge._from WHERE edge._to == :conversationId` },
    { description: '[CHS-7] getUserConversations main query - REFINED', aql: `FOR edge IN userConversations FILTER edge._from == @userId LET conversation = DOCUMENT(edge._to) FILTER conversation.isArchived == false SORT conversation.updated DESC LIMIT @offset, @limit RETURN conversation`, expectedSql: `SELECT conversation FROM (SELECT expand(outE('userConversations').in) FROM :userId) LET conversation = @this WHERE conversation.isArchived == false ORDER BY conversation.updated DESC LIMIT :limit OFFSET :offset` },
    { description: '[CHS-8] getUserConversations count query - REFINED', aql: `RETURN LENGTH( FOR edge IN userConversations FILTER edge._from == @userId LET conversation = DOCUMENT(edge._to) FILTER conversation.isArchived == false RETURN 1 )`, expectedSql: `SELECT COUNT(*) FROM (SELECT 1 FROM (SELECT expand(outE('userConversations').in) FROM :userId) LET conversation = @this WHERE conversation.isArchived == false)` },
    { description: '[CHS-9] getConversationMessages main query', aql: `FOR msg IN messages FILTER msg.conversationId == @conversationId SORT msg.sequence DESC LIMIT @offset, @limit LET queryInfo = ( FOR edge IN queryMessages FILTER edge._to == CONCAT('messages/', msg._key) RETURN 1 )[0] RETURN MERGE(msg, { queryInfo: queryInfo })`, expectedSql: `SELECT msg, (SELECT 1 FROM queryMessages LET edge = @this WHERE edge._to == concat('messages/', msg._key))[0] AS queryInfo FROM messages LET msg = @this WHERE msg.conversationId == :conversationId ORDER BY msg.sequence DESC LIMIT :limit OFFSET :offset` },
    { description: '[CHS-10] getConversationMessages count query', aql: `FOR msg IN messages FILTER msg.conversationId == @conversationId COLLECT WITH COUNT INTO total RETURN total`, expectedSql: `SELECT COUNT(*) AS total FROM messages LET msg = @this WHERE msg.conversationId == :conversationId` },
    { description: '[CHS-11] updateConversation remove category edges - REFINED', aql: `FOR edge IN conversationCategories FILTER edge._from == @conversationId REMOVE edge IN conversationCategories`, expectedSql: `DELETE FROM conversationCategories WHERE _from == :conversationId` },
    { description: '[CHS-12] markMessagesAsRead update specific', aql: `FOR msgId IN @messageIdsJson UPDATE { _key: msgId, readStatus: true } IN messages FILTER OLD.conversationId == "convId" AND OLD.readStatus == false RETURN NEW`, expectedSql: `FOR msgId IN :messageIdsJson UPDATE messages SET readStatus = true WHERE _key = msgId AND OLD.conversationId == "convId" AND OLD.readStatus == false RETURN AFTER` },
    { description: '[CHS-13] markMessagesAsRead update all', aql: `FOR msg IN messages FILTER msg.conversationId == "convId" AND msg.readStatus == false UPDATE msg WITH { readStatus: true } IN messages RETURN NEW`, expectedSql: `UPDATE messages SET readStatus = true WHERE conversationId == "convId" AND readStatus == false RETURN AFTER` },
    { description: '[CHS-14] markMessagesAsRead update last viewed', aql: `FOR edge IN userConversations FILTER edge._from == 'users/123' AND edge._to == 'conversations/abc' UPDATE edge WITH { lastViewedAt: @currentTime } IN userConversations`, expectedSql: `UPDATE userConversations SET lastViewedAt = :currentTime WHERE _from == 'users/123' AND _to == 'conversations/abc'` },
    { description: '[CHS-15] getConversationOwnerId', aql: `FOR edge IN userConversations FILTER edge._to == @conversationId AND edge.role == 'owner' RETURN SUBSTRING(edge._from, 6)`, expectedSql: `SELECT SUBSTRING(edge._from, 6) FROM userConversations LET edge = @this WHERE edge._to == :conversationId AND edge.role == 'owner'` },
    { description: '[CHS-16] deleteConversation permission check', aql: `FOR edge IN userConversations FILTER edge._to == 'conversations/abc' AND edge._from == 'users/123' RETURN edge`, expectedSql: `SELECT edge FROM userConversations LET edge = @this WHERE edge._to == 'conversations/abc' AND edge._from == 'users/123'` },
    { description: '[CHS-17] deleteConversation get message IDs', aql: `FOR msg IN messages FILTER msg.conversationId == "convId" RETURN msg._id`, expectedSql: `SELECT msg._id FROM messages LET msg = @this WHERE msg.conversationId == "convId"` },
    { description: '[CHS-18] deleteConversation delete query-message edges - REFINED', aql: `FOR edge IN queryMessages FILTER edge._to == @messageId REMOVE edge IN queryMessages`, expectedSql: `DELETE FROM queryMessages WHERE _to == :messageId` },
    { description: '[CHS-19] deleteConversation delete messages - REFINED', aql: `FOR msg IN messages FILTER msg.conversationId == "convId" REMOVE msg IN messages RETURN OLD`, expectedSql: `DELETE FROM messages WHERE conversationId == "convId" RETURN BEFORE` },
    { description: '[CHS-20] deleteConversation delete user edges - REFINED', aql: `FOR edge IN userConversations FILTER edge._to == 'conversations/abc' REMOVE edge IN userConversations`, expectedSql: `DELETE FROM userConversations WHERE _to == 'conversations/abc'` },
    { description: '[CHS-21] deleteConversation delete category edges - REFINED', aql: `FOR edge IN conversationCategories FILTER edge._from == 'conversations/abc' REMOVE edge IN conversationCategories`, expectedSql: `DELETE FROM conversationCategories WHERE _from == 'conversations/abc'` },
    { description: '[CHS-22] findMessagesForQuery - REFINED', aql: `FOR edge IN queryMessages FILTER edge._from == 'queries/123' FOR msg IN messages FILTER msg._id == edge._to LET conversation = ( FOR conv IN conversations FILTER conv._key == msg.conversationId RETURN conv )[0] RETURN { message: msg, conversation: conversation }`, expectedSql: `SELECT msg AS message, (SELECT conv FROM conversations LET conv = @this WHERE conv._key == msg.conversationId)[0] AS conversation FROM queryMessages as edge JOIN messages as msg ON msg._id = edge._to WHERE edge._from == 'queries/123'` },
    { description: '[CHS-23] findOriginatingQuery - REFINED', aql: `FOR edge IN queryMessages FILTER edge._to == 'messages/abc' FOR q IN queries FILTER q._id == edge._from RETURN { query: q }`, expectedSql: `SELECT q AS query FROM queryMessages as edge JOIN queries as q ON q._id = edge._from WHERE edge._to == 'messages/abc'` },
    { description: '[CHS-24] linkQueryToConversation existing link check', aql: `FOR edge IN queryMessages FILTER edge._from == @queryId AND edge._to == @messageId RETURN edge`, expectedSql: `SELECT edge FROM queryMessages LET edge = @this WHERE edge._from == :queryId AND edge._to == :messageId` },
    { description: '[CHS-25] linkQueryToConversation category exists check', aql: `FOR edge IN conversationCategories FILTER edge._from == @conversationId AND edge._to == @categoryId RETURN edge`, expectedSql: `SELECT edge FROM conversationCategories LET edge = @this WHERE edge._from == :conversationId AND edge._to == :categoryId` },
    { description: '[CHS-26] linkQueryToConversation get category name', aql: `FOR cat IN serviceCategories FILTER cat._key == @categoryId RETURN cat.nameEN`, expectedSql: `SELECT cat.nameEN FROM serviceCategories LET cat = @this WHERE cat._key == :categoryId` },
    { description: '[CHS-27] searchConversations - REFINED', aql: `FOR edge IN userConversations FILTER edge._from == 'users/123' FOR conv IN conversations FILTER conv._id == edge._to AND LIKE(LOWER(conv.title), "%term%") RETURN { conversation: conv }`, expectedSql: `SELECT conv AS conversation FROM (SELECT expand(outE('userConversations').in) FROM users WHERE _key = '123') LET conv = @this WHERE LIKE(lower(conv.title), "%term%")` },
    { description: '[CHS-28] getUserConversationStats - REFINED', aql: `LET userConvs = ( FOR edge IN userConversations FILTER edge._from == 'users/123' FOR conv IN conversations FILTER conv._id == edge._to RETURN conv ) LET totalCount = LENGTH(userConvs) RETURN { total: totalCount }`, expectedSql: `WITH userConvs AS (SELECT conv FROM (SELECT expand(outE('userConversations').in) FROM users WHERE _key = '123') LET conv = @this), totalCount AS (size(userConvs)) SELECT totalCount AS total` },
    { description: '[CHS-29] getRecentConversations - REFINED', aql: `FOR edge IN userConversations FILTER edge._from == 'users/123' FOR conv IN conversations FILTER conv._id == edge._to AND conv.isArchived == false SORT conv.updated DESC LIMIT 5 RETURN conv`, expectedSql: `SELECT conv FROM (SELECT expand(outE('userConversations').in) FROM users WHERE _key = '123') LET conv = @this WHERE conv.isArchived == false ORDER BY conv.updated DESC LIMIT 5` },
    { description: '[CHS-30] getFolder conversations - REFINED', aql: `FOR edge IN folderConversations FILTER edge._from == 'folders/abc' FOR conv IN conversations FILTER conv._id == edge._to SORT conv.updated DESC RETURN conv`, expectedSql: `SELECT conv FROM (SELECT expand(outE('folderConversations').in) FROM folders WHERE _key = 'abc') LET conv = @this ORDER BY conv.updated DESC` },
    { description: '[CHS-31] getFolder owners - REFINED', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' FOR user IN users FILTER user._id == edge._from RETURN user`, expectedSql: `SELECT user FROM (SELECT expand(inE('userFolders').out) FROM folders WHERE _key = 'abc') LET user = @this` },
    { description: '[CHS-32] getFolder child folders', aql: `FOR folder IN folders FILTER folder.parentFolderId == 'abc' SORT folder.order ASC, folder.created ASC RETURN folder`, expectedSql: `SELECT folder FROM folders LET folder = @this WHERE folder.parentFolderId == 'abc' ORDER BY folder.order ASC, folder.created ASC` },
    { description: '[CHS-33] getUserFolders base query', aql: `FOR edge IN userFolders FILTER edge._from == @userId LET folder = DOCUMENT(edge._to) RETURN { _id: folder._id }`, expectedSql: `SELECT folder._id AS _id FROM (SELECT expand(outE('userFolders').in) FROM :userId) LET folder = @this` },
    { description: '[CHS-34] getUserFolders folder keys query', aql: `FOR folder IN folders FILTER folder._id IN @folderIds RETURN folder`, expectedSql: `SELECT folder FROM folders LET folder = @this WHERE folder._id IN :folderIds` },
    { description: '[CHS-35] getUserFolders main query', aql: `FOR edge IN userFolders FILTER edge._from == @userId LET folder = DOCUMENT(edge._to) LET conversationCount = LENGTH( FOR convEdge IN folderConversations FILTER convEdge._from == folder._id RETURN 1 ) RETURN { name: folder.name, conversationCount: conversationCount }`, expectedSql: `SELECT folder.name AS name, conversationCount AS conversationCount FROM (SELECT expand(outE('userFolders').in) FROM :userId) LET folder = @this WITH conversationCount AS (SELECT COUNT(*) FROM (SELECT 1 FROM folderConversations LET convEdge = @this WHERE convEdge._from == folder._id))` },
    { description: '[CHS-36] deleteFolder permission query', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/123' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/123'` },
    { description: '[CHS-37] deleteFolder conversation link query', aql: `FOR edge IN folderConversations FILTER edge._from == 'folders/abc' RETURN edge`, expectedSql: `SELECT edge FROM folderConversations LET edge = @this WHERE edge._from == 'folders/abc'` },
    { description: '[CHS-38] deleteFolder delete user edge - REFINED', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' REMOVE edge IN userFolders`, expectedSql: `DELETE FROM userFolders WHERE _to == 'folders/abc'` },
    { description: '[CHS-39] deleteFolder get child folders', aql: `FOR folder IN folders FILTER folder.parentFolderId == 'abc' RETURN folder._key`, expectedSql: `SELECT folder._key FROM folders LET folder = @this WHERE folder.parentFolderId == 'abc'` },
    { description: '[CHS-40] addConversationToFolder folder permission', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/123' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/123'` },
    { description: '[CHS-41] addConversationToFolder convo permission', aql: `FOR edge IN userConversations FILTER edge._to == 'conversations/xyz' AND edge._from == 'users/123' RETURN edge`, expectedSql: `SELECT edge FROM userConversations LET edge = @this WHERE edge._to == 'conversations/xyz' AND edge._from == 'users/123'` },
    { description: '[CHS-42] addConversationToFolder existing link', aql: `FOR edge IN folderConversations FILTER edge._to == 'conversations/xyz' RETURN edge`, expectedSql: `SELECT edge FROM folderConversations LET edge = @this WHERE edge._to == 'conversations/xyz'` },
    { description: '[CHS-43] removeConversationFromFolder permission', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/123' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/123'` },
    { description: '[CHS-44] removeConversationFromFolder link query', aql: `FOR edge IN folderConversations FILTER edge._from == 'folders/abc' AND edge._to == 'conversations/xyz' RETURN edge`, expectedSql: `SELECT edge FROM folderConversations LET edge = @this WHERE edge._from == 'folders/abc' AND edge._to == 'conversations/xyz'` },
    { description: '[CHS-45] searchFolders - REFINED', aql: `FOR edge IN userFolders FILTER edge._from == 'users/123' FOR folder IN folders FILTER folder._id == edge._to AND LIKE(LOWER(folder.name), "%term%") RETURN folder`, expectedSql: `SELECT folder FROM (SELECT expand(outE('userFolders').in) FROM users WHERE _key = '123') LET folder = @this WHERE LIKE(lower(folder.name), "%term%")` },
    { description: '[CHS-46] moveConversation convo permission', aql: `FOR edge IN userConversations FILTER edge._to == 'conversations/xyz' AND edge._from == 'users/123' RETURN edge`, expectedSql: `SELECT edge FROM userConversations LET edge = @this WHERE edge._to == 'conversations/xyz' AND edge._from == 'users/123'` },
    { description: '[CHS-47] moveConversation folder permission', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/123' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/123'` },
    { description: '[CHS-48] moveConversation existing link', aql: `FOR edge IN folderConversations FILTER edge._to == 'conversations/xyz' RETURN edge`, expectedSql: `SELECT edge FROM folderConversations LET edge = @this WHERE edge._to == 'conversations/xyz'` },
    { description: '[CHS-49] findConversationFolder - REFINED', aql: `FOR edge IN folderConversations FILTER edge._to == 'conversations/xyz' LET folder = DOCUMENT(edge._from) RETURN folder`, expectedSql: `SELECT folder FROM (SELECT expand(inE('folderConversations').out) FROM conversations WHERE _key = 'xyz') LET folder = @this` },
    { description: '[CHS-50] reorderFolders permission check', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/123' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/123'` },
    { description: '[CHS-51] reorderFolders folder parent check', aql: `FOR folder IN folders FILTER folder._key == 'abc' RETURN folder.parentFolderId`, expectedSql: `SELECT folder.parentFolderId FROM folders LET folder = @this WHERE folder._key == 'abc'` },
    { description: '[CHS-52] shareFolder owner check', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/123' AND edge.role == 'owner' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/123' AND edge.role == 'owner'` },
    { description: '[CHS-53] shareFolder existing share check', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/456' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/456'` },
    { description: '[CHS-54] removeFolderShare owner check', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/123' AND edge.role == 'owner' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/123' AND edge.role == 'owner'` },
    { description: '[CHS-55] removeFolderShare find share', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/456' AND edge.role != 'owner' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/456' AND edge.role != 'owner'` },
    { description: '[CHS-56] getSharedFolders - REFINED', aql: `FOR edge IN userFolders FILTER edge._from == 'users/123' AND edge.role != 'owner' LET folder = DOCUMENT(edge._to) LET owner = ( FOR ownerEdge IN userFolders FILTER ownerEdge._to == edge._to AND ownerEdge.role == 'owner' RETURN DOCUMENT(ownerEdge._from) )[0] RETURN { folder, owner }`, expectedSql: `SELECT folder, (SELECT user FROM (SELECT expand(inE('userFolders').out) FROM folder) LET user = @this)[0] AS owner FROM (SELECT expand(outE('userFolders').in) FROM users WHERE _key = '123') LET folder = @this WHERE role != 'owner'` },
    { description: '[CHS-57] getFolderUsers permission check', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' AND edge._from == 'users/123' RETURN edge`, expectedSql: `SELECT edge FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' AND edge._from == 'users/123'` },
    { description: '[CHS-58] getFolderUsers get users', aql: `FOR edge IN userFolders FILTER edge._to == 'folders/abc' LET user = DOCUMENT(edge._from) RETURN { name: user.loginName, role: edge.role }`, expectedSql: `SELECT user.loginName AS name, edge.role AS role FROM userFolders LET edge = @this WHERE edge._to == 'folders/abc' WITH user AS (SELECT FROM users WHERE @rid = edge._from)` },
    { description: '[CHS-59] update { _key, ...} in messages', aql: `UPDATE { _key: "123", readStatus: true } IN messages`, expectedSql: `UPDATE messages SET readStatus = true WHERE _key = "123"` },

    // --- from database-operations-service.js (1 test) ---
    {
        description: '[DB-OPS-1] Test Connection',
        aql: `RETURN 1`,
        expectedSql: `SELECT 1 as health_check`,
    },

    // --- from query-service.js (12 tests) ---
    {
        description: '[QS-1] setQueryCategory find edge',
        aql: `FOR edge IN queryCategories FILTER edge._from == @queryId RETURN edge`,
        expectedSql: `SELECT edge FROM queryCategories LET edge = @this WHERE edge._from == :queryId`,
    },
    {
        description: '[QS-2] searchQueries main query',
        aql: `FOR q IN queries FILTER q.userId == @userId AND q.userFeedback != null SORT q.timestamp DESC LIMIT @offset, @limit RETURN q`,
        expectedSql: `SELECT q FROM queries LET q = @this WHERE q.userId == :userId AND q.userFeedback != null ORDER BY q.timestamp DESC LIMIT :limit OFFSET :offset`,
    },
    {
        description: '[QS-3] searchQueries count query',
        aql: `FOR q IN queries FILTER q.userId == @userId AND q.userFeedback != null COLLECT WITH COUNT INTO total RETURN total`,
        expectedSql: `SELECT COUNT(*) AS total FROM queries LET q = @this WHERE q.userId == :userId AND q.userFeedback != null`,
    },
    {
        description: '[QS-4] deleteQuery delete session edge - REFINED',
        aql: `FOR edge IN sessionQueries FILTER edge._to == @queryId REMOVE edge IN sessionQueries`,
        expectedSql: `DELETE FROM sessionQueries WHERE _to == :queryId`,
    },
    {
        description: '[QS-5] deleteQuery delete category edge - REFINED',
        aql: `FOR edge IN queryCategories FILTER edge._from == @queryId REMOVE edge IN queryCategories`,
        expectedSql: `DELETE FROM queryCategories WHERE _from == :queryId`,
    },
    {
        description: '[QS-6] getSimilarQueries',
        aql: `FOR q IN queries LET score = ( FOR word IN @words FILTER LOWER(q.text) LIKE CONCAT("%", word, "%") RETURN 1 ) FILTER LENGTH(score) > 0 SORT LENGTH(score) DESC, q.timestamp DESC LIMIT @limit RETURN q`,
        expectedSql: `SELECT q FROM queries LET q = @this WITH score AS (SELECT 1 FROM UNNEST(:words) AS word WHERE lower(q.text) LIKE concat("%", word, "%")) HAVING size(score) > 0 ORDER BY size(score) DESC, q.timestamp DESC LIMIT :limit`,
    },
    {
        description: '[QS-7] getSavedQueries main query',
        aql: `FOR q IN queries FILTER q.userId == @userId AND q.metadata.isSaved == true SORT q.timestamp DESC LIMIT @offset, @limit RETURN q`,
        expectedSql: `SELECT q FROM queries LET q = @this WHERE q.userId == :userId AND q.metadata.isSaved == true ORDER BY q.timestamp DESC LIMIT :limit OFFSET :offset`,
    },
    {
        description: '[QS-8] getSavedQueries count query',
        aql: `FOR q IN queries FILTER q.userId == @userId AND q.metadata.isSaved == true COLLECT WITH COUNT INTO total RETURN total`,
        expectedSql: `SELECT COUNT(*) AS total FROM queries LET q = @this WHERE q.userId == :userId AND q.metadata.isSaved == true`,
    },
    {
        description: '[QS-9] getQueryRecommendations recent queries',
        aql: `FOR q IN queries FILTER q.userId == @userId SORT q.timestamp DESC LIMIT 10 RETURN q`,
        expectedSql: `SELECT q FROM queries LET q = @this WHERE q.userId == :userId ORDER BY q.timestamp DESC LIMIT 10`,
    },
    {
        description: '[QS-10] getQueryRecommendations main query',
        aql: `LET categorySimilar = ( FOR q IN queries FILTER q.userId != @userId AND q.categoryId IN @categories RETURN DISTINCT q.text ) LET serviceSimilar = ( FOR q IN queries FILTER q.userId != @userId AND q.serviceId IN @services RETURN DISTINCT q.text ) LET combined = UNION(categorySimilar, serviceSimilar) FOR text IN combined SORT RAND() LIMIT @limit RETURN text`,
        expectedSql: `WITH categorySimilar AS (SELECT DISTINCT q.text FROM queries LET q = @this WHERE q.userId != :userId AND q.categoryId IN :categories), serviceSimilar AS (SELECT DISTINCT q.text FROM queries LET q = @this WHERE q.userId != :userId AND q.serviceId IN :services), combined AS (UNIONALL(categorySimilar, serviceSimilar)) SELECT text FROM combined ORDER BY RAND() LIMIT :limit`,
    },
    {
        description: '[QS-11] getPopularQueries',
        aql: `FOR q IN queries COLLECT text = q.text WITH COUNT INTO count SORT count DESC LIMIT @limit RETURN { text, count }`,
        expectedSql: `SELECT text, COUNT(*) AS count FROM queries LET q = @this GROUP BY text = q.text ORDER BY count DESC LIMIT :limit`,
    },
    {
        description: '[QS-12] linkQueryToMessage find message',
        aql: `FOR msg IN messages FILTER msg._key == @messageId RETURN { _key: msg._key, conversationId: msg.conversationId }`,
        expectedSql: `SELECT msg._key AS _key, msg.conversationId AS conversationId FROM messages LET msg = @this WHERE msg._key == :messageId`,
    },

    // --- from service-category-service.js (8 tests) ---
    {
        description: '[SCS-1] getTranslatedName for category',
        aql: `FOR trans IN serviceCategoryTranslations FILTER trans.serviceCategoryId == @documentId AND trans.languageCode == @upperLocale RETURN trans.translation`,
        expectedSql: `SELECT trans.translation FROM serviceCategoryTranslations LET trans = @this WHERE trans.serviceCategoryId == :documentId AND trans.languageCode == :upperLocale`,
    },
    {
        description: '[SCS-2] getTranslatedName for service',
        aql: `FOR trans IN serviceTranslations FILTER trans.serviceId == @documentId AND trans.languageCode == @upperLocale RETURN trans.translation`,
        expectedSql: `SELECT trans.translation FROM serviceTranslations LET trans = @this WHERE trans.serviceId == :documentId AND trans.languageCode == :upperLocale`,
    },
    {
        description: '[SCS-3] getAllCategoriesWithServices - REFINED',
        aql: `FOR category IN serviceCategories SORT category.order ASC LET categoryTranslation = FIRST( FOR trans IN serviceCategoryTranslations FILTER trans.serviceCategoryId == category._key AND trans.languageCode == @upperLocale RETURN trans.translation ) LET services = ( FOR edge IN categoryServices FILTER edge._from == category._id FOR service IN services FILTER service._id == edge._to LET serviceTranslation = FIRST( FOR trans IN serviceTranslations FILTER trans.serviceId == service._key AND trans.languageCode == @upperLocale RETURN trans.translation ) SORT edge.order ASC RETURN serviceTranslation ) RETURN { catKey: category._key, name: categoryTranslation, children: services }`,
        expectedSql: `SELECT category._key AS catKey, (SELECT trans.translation FROM serviceCategoryTranslations LET trans = @this WHERE trans.serviceCategoryId == category._key AND trans.languageCode == :upperLocale)[0] AS name, (SELECT serviceTranslation FROM (SELECT expand(outE('categoryServices').in) FROM category) LET service = @this WITH serviceTranslation AS ((SELECT trans.translation FROM serviceTranslations LET trans = @this WHERE trans.serviceId == service._key AND trans.languageCode == :upperLocale)[0]) ORDER BY edge.order ASC) AS children FROM serviceCategories LET category = @this ORDER BY category.order ASC`,
    },
    {
        description: '[SCS-4] getCategoryWithServices - REFINED',
        aql: `LET category = DOCUMENT(@categoryId) LET services = ( FOR edge IN categoryServices FILTER edge._from == @categoryId RETURN DOCUMENT(edge._to) ) RETURN { category, services }`,
        expectedSql: `WITH category AS (SELECT * FROM :categoryId), services AS (SELECT expand(outE('categoryServices').in) FROM :categoryId) SELECT category, services`,
    },
    {
        description: '[SCS-5] deleteCategory delete service translations - REFINED',
        aql: `FOR edge IN categoryServices FILTER edge._from == @categoryId LET service = DOCUMENT(edge._to) FOR trans IN serviceTranslations FILTER trans.serviceId == service._key REMOVE trans IN serviceTranslations`,
        expectedSql: `FOR service IN (SELECT expand(outE('categoryServices').in) FROM :categoryId) DELETE FROM serviceTranslations WHERE serviceId == service._key`,
    },
    {
        description: '[SCS-6] deleteCategory delete services and edges - REFINED',
        aql: `FOR edge IN categoryServices FILTER edge._from == @categoryId LET service = DOCUMENT(edge._to) REMOVE edge IN categoryServices REMOVE service IN services`,
        expectedSql: `LET services_to_delete = (SELECT expand(outE('categoryServices').in) FROM :categoryId) FOR service IN services_to_delete DELETE service._id FROM services; DELETE FROM categoryServices WHERE _from == :categoryId`,
    },
    {
        description: '[SCS-7] deleteCategory delete category translations - REFINED',
        aql: `FOR trans IN serviceCategoryTranslations FILTER trans.serviceCategoryId == @categoryKey REMOVE trans IN serviceCategoryTranslations`,
        expectedSql: `DELETE FROM serviceCategoryTranslations WHERE serviceCategoryId == :categoryKey`,
    },
    {
        description: '[SCS-8] searchCategoriesAndServices - REFINED',
        aql: `LET matchingCategories = ( FOR trans IN serviceCategoryTranslations FILTER trans.languageCode == @upperLocale AND LOWER(trans.translation) LIKE @lowerQuery RETURN { key: trans.serviceCategoryId, name: trans.translation } ) LET matchingServices = ( FOR trans IN serviceTranslations FILTER trans.languageCode == @upperLocale AND LOWER(trans.translation) LIKE @lowerQuery LET service = DOCUMENT(CONCAT('services/', trans.serviceId)) RETURN { key: service._key, name: trans.translation } ) RETURN { categories: matchingCategories, services: matchingServices }`,
        expectedSql: `WITH matchingCategories AS (SELECT trans.serviceCategoryId AS key, trans.translation AS name FROM serviceCategoryTranslations LET trans = @this WHERE trans.languageCode == :upperLocale AND lower(trans.translation) LIKE :lowerQuery), matchingServices AS (SELECT service._key AS key, trans.translation AS name FROM serviceTranslations LET trans = @this WHERE trans.languageCode == :upperLocale AND lower(trans.translation) LIKE :lowerQuery WITH service AS (SELECT * FROM services WHERE @rid = concat('services/', trans.serviceId))) SELECT matchingCategories, matchingServices`,
    },

    // --- from session-service.js (5 tests) ---
    {
        description: '[SS-1] getActiveSession',
        aql: `FOR session IN sessions FILTER session.userId == @userId AND session.active == true AND session.endTime == null SORT session.startTime DESC LIMIT 1 RETURN session`,
        expectedSql: `SELECT session FROM sessions LET session = @this WHERE session.userId == :userId AND session.active == true AND session.endTime == null ORDER BY session.startTime DESC LIMIT 1`,
    },
    {
        description: '[SS-2] getUserSessions (active only)',
        aql: `FOR session IN sessions FILTER session.userId == @userId AND session.active == true SORT session.startTime DESC RETURN session`,
        expectedSql: `SELECT session FROM sessions LET session = @this WHERE session.userId == :userId AND session.active == true ORDER BY session.startTime DESC`,
    },
    {
        description: '[SS-3] getUserSessions (all)',
        aql: `FOR session IN sessions FILTER session.userId == @userId SORT session.startTime DESC RETURN session`,
        expectedSql: `SELECT session FROM sessions LET session = @this WHERE session.userId == :userId ORDER BY session.startTime DESC`,
    },
    {
        description: '[SS-4] cleanupExpiredSessions',
        aql: `FOR session IN sessions FILTER session.active == true AND session.startTime < @expirationTime AND (session.lastActiveTime == null OR session.lastActiveTime < @expirationTime) RETURN session`,
        expectedSql: `SELECT session FROM sessions LET session = @this WHERE session.active == true AND session.startTime < :expirationTime AND (session.lastActiveTime == null OR session.lastActiveTime < :expirationTime)`,
    },
    {
        description: '[SS-5] getSessionStats',
        aql: `LET totalSessions = ( FOR session IN sessions FILTER session.startTime >= @startDate AND session.startTime <= @endDate COLLECT WITH COUNT INTO count RETURN count )[0] LET uniqueUsers = ( FOR session IN sessions FILTER session.startTime >= @startDate AND session.startTime <= @endDate COLLECT userId = session.userId WITH COUNT INTO count RETURN count )[0] RETURN { totalSessions, uniqueUsers }`,
        expectedSql: `WITH totalSessions AS (SELECT COUNT(*) AS count FROM sessions LET session = @this WHERE session.startTime >= :startDate AND session.startTime <= :endDate)[0], uniqueUsers AS (SELECT COUNT(DISTINCT userId) AS count FROM sessions LET session = @this WHERE session.startTime >= :startDate AND session.startTime <= :endDate)[0] SELECT totalSessions, uniqueUsers`,
    },

    // --- from test-worker.js (1 test) ---
    {
        description: '[WORKER-1] Health Check',
        aql: `RETURN 1`,
        expectedSql: `SELECT 1 as health_check`,
    },
];


// =================================================================
// Test Runner Logic with Detailed Failure Analysis
// =================================================================

class TestRunner {
    constructor() {
        this.total = 0;
        this.passed = 0;
        this.failed = 0;
        this.db = null;
    }

    async initializeDbService() {
        if (!RUN_INTEGRATION_TESTS) return;
        console.log('\n--- Initializing DB Service for Integration Tests ---');
        try {
            this.db = await dbService.getConnection('translator-integration-test');
            console.log(`Successfully got DB connection via service for mode: '${process.env.DB_TYPE}'`);
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', `FATAL: Could not get DB connection from service. Integration tests will be skipped.`);
            console.error(error.message);
            this.db = null;
        }
    }

    async run() {
        console.log('--- AQL-to-SQL Translator Test Runner ---');
        await this.initializeDbService();

        for (const test of testSuite) {
            this.total++;
            console.log(`\n[TEST ${this.total}] ${test.description}`);
            console.log(`   AQL: ${test.aql}`);

            try {
                const { sql } = translator.translateQuery(test.aql, {});
                console.log(`-> SQL: ${sql}`);

                if (sql.trim().replace(/\s+/g, ' ') !== test.expectedSql.trim().replace(/\s+/g, ' ')) {
                    this.fail(`Translation mismatch!`, test.expectedSql, sql);
                    continue;
                }

                if (RUN_INTEGRATION_TESTS && this.db && test.integration) {
                    await this.runIntegrationTest(test.integration, sql);
                } else {
                    this.pass('Translation successful (Unit Test)');
                }

            } catch (error) {
                this.fail(`An unexpected error occurred during translation.`);
                console.error(error);
            }
        }
        this.printSummary();
        if (this.db) {
            console.log('DB Service connection released.');
        }
    }

    async runIntegrationTest(integration, sql) {
        try {
            if (integration.setup) {
                for (const cmd of [].concat(integration.setup)) {
                    await this.db.query(cmd);
                }
            }
            const result = await this.db.query(sql);
            this.pass(`Translation and Execution successful (Integration Test)`);
        } catch (error) {
            this.fail(`Integration test execution failed!`);
            console.error('  Error:', error.message);
        } finally {
            if (integration.teardown) {
                try {
                    for (const cmd of [].concat(integration.teardown)) {
                        await this.db.query(cmd);
                    }
                } catch (teardownError) {
                    console.error('  WARNING: Teardown failed:', teardownError.message);
                }
            }
        }
    }

    pass(message) {
        console.log('\x1b[32m%s\x1b[0m', `  ✓ PASSED: ${message}`);
        this.passed++;
    }

    fail(message, expected, actual) {
        console.log('\x1b[31m%s\x1b[0m', `  ✗ FAILED: ${message}`);
        this.failed++;
        
        if (expected && actual) {
            console.log('   \x1b[36mExpected:\x1b[0m', expected);
            console.log('   \x1b[36mActual  :\x1b[0m', actual);
            this.analyzeFailure(expected, actual);
        }
    }

    analyzeFailure(expected, actual) {
        console.log('   \x1b[33m--- Failure Analysis ---');
        
        const normExpected = expected.replace(/\s+/g, ' ');
        const normActual = actual.replace(/\s+/g, ' ');

        const checks = [
            { name: 'Missing `GROUP BY` clause', regex: /GROUP BY/, expected: true },
            { name: 'Missing `ORDER BY` clause', regex: /ORDER BY/, expected: true },
            { name: 'Incorrect `LIMIT` translation (should contain OFFSET)', regex: /LIMIT \S+ OFFSET \S+/, expected: true },
            { name: 'Incorrect `SORT` keyword (should be `ORDER BY`)', regex: /\bSORT\b/, expected: false },
            { name: 'Incorrect `COLLECT` keyword (should be `GROUP BY` or similar)', regex: /\bCOLLECT\b/, expected: false },
            { name: 'Missing subquery parentheses `()`', regex: /\(/, expected: true },
            { name: 'Missing `WITH` clause for LET statement', regex: /^WITH/, expected: true },
            { name: 'Missing contextual `LET` clause for FOR loop', regex: /LET \w+ = @this/, expected: true },
            { name: 'Incorrect `REMOVE` translation (should be `DELETE FROM`)', regex: /^DELETE FROM/, expected: true },
            { name: 'Incorrect `UPDATE` translation (should contain `SET`)', regex: /\bSET\b/, expected: true },
            { name: 'Incorrect variable prefixing (e.g., `t.userId` vs `userId`)', regex: /\w+\.userId/, expected: false },
        ];

        let issuesFound = 0;
        for (const check of checks) {
            const expectedMatch = normExpected.match(check.regex);
            const actualMatch = normActual.match(check.regex);

            if (check.expected && expectedMatch && !actualMatch) {
                console.log(`     \x1b[31m- Missing feature:\x1b[0m ${check.name}.`);
                issuesFound++;
            } else if (!check.expected && !expectedMatch && actualMatch) {
                console.log(`     \x1b[31m- Incorrect keyword:\x1b[0m ${check.name}.`);
                issuesFound++;
            }
        }
        
        if (normActual.includes('t.userId')) {
             console.log(`     \x1b[31m- Incorrect variable prefixing:\x1b[0m Found 't.userId' where 'userId' was expected.`);
             issuesFound++;
        }

        if (issuesFound === 0) {
            console.log('     \x1b[33m- General structure or logic mismatch. Review the query structure and clause order.\x1b[0m');
        }
        console.log('   \x1b[33m--------------------------\x1b[0m');
    }

    printSummary() {
        console.log('\n-----------------------------------------');
        console.log('--- Test Summary ---');
        const color = this.failed > 0 ? '\x1b[31m' : '\x1b[32m';
        console.log(`${color}%s\x1b[0m`, `Total: ${this.total} | Passed: ${this.passed} | Failed: ${this.failed}`);
        console.log('-----------------------------------------');
        if (this.failed > 0) {
            process.exit(1);
        }
    }
}

// --- Run the tests ---
const runner = new TestRunner();
runner.run();