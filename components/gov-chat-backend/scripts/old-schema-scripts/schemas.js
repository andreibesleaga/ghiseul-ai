// schemas.js
// This file just returns the collection names since schema validation is not supported
// in your version of ArangoDB driver

// Document Collections 
const usersCollection = 'users';
const sessionsCollection = 'sessions';
const serviceCategoriesCollection = 'serviceCategories';
const servicesCollection = 'services';
const queriesCollection = 'queries';
const analyticsCollection = 'analytics';

// Edge Collections
const userSessionsEdgeCollection = 'userSessions';
const sessionQueriesEdgeCollection = 'sessionQueries';
const categoryServicesEdgeCollection = 'categoryServices';
const queryCategoriesEdgeCollection = 'queryCategories';

// Export collection names
module.exports = {
  usersCollection,
  sessionsCollection,
  serviceCategoriesCollection,
  servicesCollection,
  queriesCollection,
  analyticsCollection,
  userSessionsEdgeCollection,
  sessionQueriesEdgeCollection,
  categoryServicesEdgeCollection,
  queryCategoriesEdgeCollection
};
