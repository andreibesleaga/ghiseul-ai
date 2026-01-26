// Required modules
require('dotenv').config();
const { Database } = require('arangojs');
const fs = require('fs');

// Setup logging
const logStream = fs.createWriteStream('test-data-generation.log', { flags: 'a' });
const debug = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
};

// Enhanced compatible timestamp function that ensures ArangoDB compatibility
const createCompatibleTimestamp = (date) => {
  // Ensure we're working with a proper Date object
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  // Format the date in a way that ArangoDB's DATE_NOW() can directly compare
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
  
  // Use explicit formatting instead of toISOString to ensure consistency
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
};

// Initialize ArangoDB connection
const initDB = () => {
  const db = new Database({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'node-services',
    auth: {
      username: process.env.ARANGO_USERNAME || 'root',
      password: process.env.ARANGO_PASSWORD || 'test'
    }
  });
  return db;
};

// Special debug function to work around DATE_NOW() issues
const debugDateFormats = async (db) => {
  debug('Testing DATE_NOW() compatibility with sample timestamps...');
  
  try {
    // Create a simple query that tests various date functions
    const query = `
      LET now = DATE_NOW()
      LET nowISO = DATE_ISO8601(DATE_NOW())
      LET testDate = DATE_ISO8601("${createCompatibleTimestamp(new Date())}")
      
      LET sampleTimestamps = (
        FOR q IN queries
          SORT RAND()
          LIMIT 5
          RETURN q.timestamp
      )
      
      RETURN {
        now: now,
        nowISO: nowISO,
        testDate: testDate,
        sampleTimestamps: sampleTimestamps,
        dateTypeNow: TYPENAME(now),
        dateTypeISO: TYPENAME(nowISO),
        dateTypeTest: TYPENAME(testDate)
      }
    `;
    
    const cursor = await db.query(query);
    if (await cursor.hasNext()) {
      const result = await cursor.next();
      debug('DATE_NOW() debug results:');
      debug(JSON.stringify(result, null, 2));
    } else {
      debug('No results from DATE_NOW() debug query - database may be empty');
    }
  } catch (err) {
    debug(`Error in debug date query: ${err.message}`);
  }
};

// Updated service categories based on the ServiceTreePanelComponent.vue
const SERVICE_CATEGORIES = [
  { 
    _key: '1', 
    nameEN: 'Identity & Civil Registration', 
    nameFR: 'Identité et état civil', 
    nameSW: 'Utambulisho na Usajili wa Raia', 
    order: 1 
  },
  // Keeping all categories, as they represent the structure, not volume
  { 
    _key: '2', 
    nameEN: 'Healthcare & Social Services', 
    nameFR: 'Santé et services sociaux', 
    nameSW: 'Afya na Huduma za Kijamii', 
    order: 2 
  },
  // ... remaining categories are preserved
  { 
    _key: '3', 
    nameEN: 'Education & Learning', 
    nameFR: 'Éducation et apprentissage', 
    nameSW: 'Elimu na Mafunzo', 
    order: 3 
  },
  { 
    _key: '4', 
    nameEN: 'Employment & Labor Services', 
    nameFR: 'Emploi et services du travail', 
    nameSW: 'Ajira na Huduma za Kazi', 
    order: 4 
  },
  { 
    _key: '5', 
    nameEN: 'Taxes & Revenue', 
    nameFR: 'Impôts et revenus', 
    nameSW: 'Kodi na Mapato', 
    order: 5 
  },
  { 
    _key: '6', 
    nameEN: 'Public Safety & Justice', 
    nameFR: 'Sécurité publique et justice', 
    nameSW: 'Usalama wa Umma na Haki', 
    order: 6 
  },
  { 
    _key: '7', 
    nameEN: 'Transportation & Mobility', 
    nameFR: 'Transport et mobilité', 
    nameSW: 'Usafiri na Usafiri', 
    order: 7 
  },
  { 
    _key: '8', 
    nameEN: 'Business & Trade', 
    nameFR: 'Affaires et commerce', 
    nameSW: 'Biashara na Biashara', 
    order: 8 
  },
  { 
    _key: '9', 
    nameEN: 'Housing & Urban Development', 
    nameFR: 'Logement et développement urbain', 
    nameSW: 'Nyumba na Maendeleo ya Mjini', 
    order: 9 
  },
  { 
    _key: '10', 
    nameEN: 'Utilities & Environment', 
    nameFR: 'Services publics et environnement', 
    nameSW: 'Huduma na Mazingira', 
    order: 10 
  },
  { 
    _key: '11', 
    nameEN: 'Culture & Recreation', 
    nameFR: 'Culture et loisirs', 
    nameSW: 'Utamaduni na Burudani', 
    order: 11 
  },
  { 
    _key: '12', 
    nameEN: 'Immigration & Citizenship', 
    nameFR: 'Immigration et citoyenneté', 
    nameSW: 'Uhamiaji na Uraia', 
    order: 12 
  },
  { 
    _key: '13', 
    nameEN: 'Social Security & Pensions', 
    nameFR: 'Sécurité sociale et retraites', 
    nameSW: 'Hifadhi ya Jamii na Pensheni', 
    order: 13 
  }
];

// Updated category services mapping based on the ServiceTreePanelComponent.vue fallbackData
// Keeping all services, as they represent the structure, not volume
const CATEGORY_SERVICES = {
  '1': {
    en: ['Birth Registration', 'National ID Cards', 'Passport Services', 'Vital Records'],
    fr: ['Enregistrement des naissances', 'Cartes d\'identité nationale', 'Services de passeport', 'État civil'],
    sw: ['Usajili wa Kuzaliwa', 'Vitambulisho vya Kitaifa', 'Huduma za Pasipoti', 'Kumbukumbu za Muhimu']
  },
  // ... remaining services kept the same
  '2': {
    en: ['Medical Services', 'Social Assistance', 'Healthcare Programs', 'Mental Health'],
    fr: ['Services médicaux', 'Aide sociale', 'Programmes de santé', 'Santé mentale'],
    sw: ['Huduma za Matibabu', 'Msaada wa Kijamii', 'Programu za Afya', 'Afya ya Akili']
  },
  '3': {
    en: ['K-12 Schools', 'Higher Education', 'Adult Learning', 'Educational Resources'],
    fr: ['Écoles K-12', 'Enseignement supérieur', 'Formation des adultes', 'Ressources éducatives'],
    sw: ['Shule za K-12', 'Elimu ya Juu', 'Mafunzo ya Watu Wazima', 'Rasilimali za Elimu']
  },
  '4': {
    en: ['Job Search', 'Labor Rights', 'Workplace Safety', 'Career Development'],
    fr: ['Recherche d\'emploi', 'Droits du travail', 'Sécurité au travail', 'Développement de carrière'],
    sw: ['Utafutaji wa Kazi', 'Haki za Wafanyakazi', 'Usalama Kazini', 'Maendeleo ya Kazi']
  },
  '5': {
    en: ['Income Tax', 'Sales Tax', 'Property Tax', 'Tax Credits'],
    fr: ['Impôt sur le revenu', 'Taxe de vente', 'Impôt foncier', 'Crédits d\'impôt'],
    sw: ['Kodi ya Mapato', 'Kodi ya Mauzo', 'Kodi ya Mali', 'Punguzo za Kodi']
  },
  '6': {
    en: ['Police Services', 'Courts', 'Legal Services', 'Emergency Services'],
    fr: ['Services de police', 'Tribunaux', 'Services juridiques', 'Services d\'urgence'],
    sw: ['Huduma za Polisi', 'Mahakama', 'Huduma za Kisheria', 'Huduma za Dharura']
  },
  '7': {
    en: ['Driver Services', 'Public Transit', 'Roads & Highways', 'Aviation'],
    fr: ['Services aux conducteurs', 'Transport en commun', 'Routes et autoroutes', 'Aviation'],
    sw: ['Huduma za Dereva', 'Usafiri wa Umma', 'Barabara na Barabara Kuu', 'Usafiri wa Anga']
  },
  '8': {
    en: ['Business Registration', 'Economic Development', 'Trade', 'Small Business Support'],
    fr: ['Enregistrement d\'entreprise', 'Développement économique', 'Commerce', 'Soutien aux petites entreprises'],
    sw: ['Usajili wa Biashara', 'Maendeleo ya Kiuchumi', 'Biashara', 'Msaada wa Biashara Ndogo']
  },
  '9': {
    en: ['Housing Programs', 'Property Assessment', 'Rental Assistance', 'Homeownership'],
    fr: ['Programmes de logement', 'Évaluation des propriétés', 'Aide à la location', 'Accession à la propriété'],
    sw: ['Programu za Nyumba', 'Tathmini ya Mali', 'Msaada wa Kukodi', 'Umiliki wa Nyumba']
  },
  '10': {
    en: ['Natural Resources', 'Environmental Protection', 'Parks & Recreation', 'Wildlife'],
    fr: ['Ressources naturelles', 'Protection de l\'environnement', 'Parcs et loisirs', 'Faune'],
    sw: ['Rasilimali za Asili', 'Uhifadhi wa Mazingira', 'Mbuga na Burudani', 'Wanyamapori']
  },
  '11': {
    en: ['Arts & Culture', 'Heritage', 'Sports & Recreation', 'Tourism'],
    fr: ['Arts et culture', 'Patrimoine', 'Sports et loisirs', 'Tourisme'],
    sw: ['Sanaa na Utamaduni', 'Urithi', 'Michezo na Burudani', 'Utalii']
  },
  '12': {
    en: ['Immigration Services', 'Citizenship Applications', 'Visas', 'Refugee Programs', 'Elections and Voting'],
    fr: ['Services d\'immigration', 'Demandes de citoyenneté', 'Visas', 'Programmes pour réfugiés', 'Élections et vote'],
    sw: ['Huduma za Uhamiaji', 'Maombi ya Uraia', 'Visa', 'Programu za Wakimbizi', 'Uchaguzi na Kupiga Kura']
  },
  '13': {
    en: ['Retirement benefits', 'Pension fund management', 'Survivor benefits', 'Disability pensions'],
    fr: ['Allocations de retraite', 'Gestion des fonds de pension', 'Allocations de survivant', 'Pensions pour invalidité'],
    sw: ['Manufaa ya kustaafu', 'Usimamizi wa mfuko wa pensheni', 'Manufaa ya warithi', 'Pensheni za ulemavu']
  }
};

// Top queries mapping to the new numeric category keys
const TOP_QUERIES = [
  { text: 'How do I apply for a national ID card?', categoryKey: '1', count: 2347, avgTime: 2.3 },
  { text: 'Where can I find tax forms?', categoryKey: '5', count: 1982, avgTime: 1.8 },
  { text: 'How to renew my driver\'s license?', categoryKey: '7', count: 1645, avgTime: 2.1 },
  { text: 'What documents do I need for passport application?', categoryKey: '1', count: 1423, avgTime: 3.4 },
  { text: 'When are property taxes due?', categoryKey: '5', count: 1289, avgTime: 1.9 }
];

// Common questions for each category - keeping all questions, as they represent the variety, not volume
const CATEGORY_QUESTIONS = {
  '1': [
    'How do I get a birth certificate for my newborn?',
    'What documents are needed for a national ID application?',
    'How long does passport processing take?',
    'Can I get a replacement for a lost birth certificate?',
    'How do I register the death of a family member?',
    'What is the fee for a new passport?',
    'How do I correct errors on my national ID card?',
    'Can I apply for an emergency passport?',
    'Where are the nearest vital records offices?',
    'What is the process for name change on official documents?'
  ],
  // ... remaining questions kept the same
  '2': [
    'How do I register for public healthcare services?',
    'What vaccination programs are available for children?',
    'How can I apply for health insurance subsidies?',
    'Where are the nearest public hospitals?',
    'What mental health services are covered by government insurance?',
    'How do I qualify for disability benefits?',
    'What food assistance programs are available?',
    'How do I find a doctor in the public healthcare system?',
    'What are the operating hours for public health clinics?',
    'How can I access emergency medical services?'
  ],
  '3': [
    'How do I enroll my child in public school?',
    'What are the government university application deadlines?',
    'Are there adult education programs available in rural areas?',
    'How can I access digital learning resources provided by the government?',
    'What scholarships are available for higher education?',
    'How do I transfer my child between public schools?',
    'What vocational training programs does the government offer?',
    'Are there literacy programs for adults?',
    'How do I validate foreign educational qualifications?',
    'What special education services are available in public schools?'
  ],
  '4': [
    'How do I register for unemployment benefits?',
    'What are my rights regarding minimum wage?',
    'How do I report unsafe working conditions?',
    'What government career development programs are available?',
    'How do I file a complaint against my employer?',
    'Are there government-sponsored apprenticeship programs?',
    'What are the legal working hours regulations?',
    'How do I get job training through government programs?',
    'What are the maternity leave regulations?',
    'How do I find public sector job openings?'
  ],
  '5': [
    'When is the deadline for filing income tax returns?',
    'How do I calculate sales tax for my business?',
    'How can I pay my property taxes online?',
    'What tax credits are available for small businesses?',
    'How do I get a tax identification number?',
    'Can I get an extension for tax filing?',
    'How do I appeal a property tax assessment?',
    'What are the penalties for late tax payments?',
    'How do I report tax fraud?',
    'Are there tax exemptions for senior citizens?'
  ],
  '6': [
    'How do I file a police report?',
    'How do I find out about court dates?',
    'Where can I get legal aid services?',
    'What is the process for calling emergency services?',
    'How do I get a background check?',
    'What should I do if I receive a court summons?',
    'How do I apply for a restraining order?',
    'What are the procedures for reporting domestic violence?',
    'How do I contact the nearest police station?',
    'What consumer protection laws apply to online purchases?'
  ],
  '7': [
    'How do I renew my driver\'s license?',
    'What is the schedule for public transit in the city?',
    'How do I report road damage or potholes?',
    'What are the aviation regulations for domestic flights?',
    'How do I get a vehicle registration certificate?',
    'What are the fares for public transportation?',
    'How do I book a driving test?',
    'What are the highway toll rates?',
    'How do I report a traffic accident?',
    'What are the requirements for a commercial driving license?'
  ],
  '8': [
    'How do I register a new business?',
    'What economic development incentives are available for new businesses?',
    'What are the export regulations for local products?',
    'How do I apply for small business loans or grants?',
    'What are the requirements for business tax registration?',
    'How do I get a business operating license?',
    'What trade agreements affect local businesses?',
    'How do I participate in government procurement opportunities?',
    'What support is available for women-owned businesses?',
    'How do I register intellectual property for my business?'
  ],
  '9': [
    'How do I apply for government housing programs?',
    'How is property value assessed for tax purposes?',
    'What rental assistance programs are available?',
    'How do I qualify for first-time homebuyer programs?',
    'What are the requirements for housing subsidies?',
    'How do I apply for home renovation grants?',
    'What are tenant rights regarding eviction?',
    'How do I register a property deed?',
    'Are there housing programs for veterans?',
    'What zoning regulations apply to residential properties?'
  ],
  '10': [
    'How do I report illegal logging or mining?',
    'What environmental protection regulations apply to businesses?',
    'How do I get a permit for a park event?',
    'What wildlife conservation programs exist?',
    'How do I report polluted water sources?',
    'What are the regulations for waste disposal?',
    'How do I apply for a hunting or fishing license?',
    'What are the protected natural areas in the region?',
    'How can I participate in community tree planting?',
    'What are the camping regulations in national parks?'
  ],
  '11': [
    'What cultural grants are available for artists?',
    'How do I register a historical building for heritage status?',
    'What public sports facilities are available in my area?',
    'How do I get a tourism operator license?',
    'What cultural events are sponsored by the government?',
    'How do I apply for arts funding?',
    'What are the regulations for accessing historical archives?',
    'How do I register a sports club or team?',
    'What are the opening hours for public museums?',
    'How do I get permission for filming at heritage sites?'
  ],
  '12': [
    'How do I apply for a work visa?',
    'What is the process for citizenship application?',
    'How long does visa processing take?',
    'What services are available for refugees?',
    'How do I register to vote?',
    'What are the requirements for permanent residency?',
    'How do I renew my visa?',
    'What is the process for sponsoring a family member for immigration?',
    'How do I check my immigration application status?',
    'What are the voting procedures for upcoming elections?'
  ],
  '13': [
    'How do I apply for retirement benefits?',
    'How do I check my pension fund balance?',
    'What are the requirements for survivor benefits?',
    'How do I apply for disability pension?',
    'At what age can I start receiving social security benefits?',
    'How do I report changes that might affect my pension?',
    'What documents are needed for pension applications?',
    'How are pension benefits calculated?',
    'Can I collect pension while working part-time?',
    'How do I update my banking information for pension payments?'
  ]
};

// Generate a random integer between min and max (inclusive)
const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generate a random date within a range
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Generate a key that is purely numeric to maximize compatibility
let keyCounter = 0;
const generateKey = () => {
  keyCounter++;
  return String(keyCounter); // Just a string of digits, e.g., "1", "2", "3"
};

// Get a random query text from a specific category or random if no category
const getRandomQuery = (categoryKey = null) => {
  if (categoryKey && CATEGORY_QUESTIONS[categoryKey]) {
    const categoryQueries = CATEGORY_QUESTIONS[categoryKey];
    return categoryQueries[randomInt(0, categoryQueries.length - 1)];
  } else {
    // Random category, random query
    const randomCategory = SERVICE_CATEGORIES[randomInt(0, SERVICE_CATEGORIES.length - 1)]._key;
    const categoryQueries = CATEGORY_QUESTIONS[randomCategory];
    return categoryQueries[randomInt(0, categoryQueries.length - 1)];
  }
};

// Calculate users per month based on growth from 10 to 100 over 3 years (reduced by 10x)
const calculateUsersForMonth = (monthIndex, totalMonths) => {
  // Linear growth formula - reduced by 10x from original
  const growth = (100 - 10) / totalMonths;
  const users = Math.floor(10 + (growth * monthIndex));
  return users;
};

// Get a more realistic distribution of queries per session that follows natural chat patterns
// Keeping the distribution pattern but reducing absolute numbers
const getQueriesPerSession = (monthIndex, totalMonths) => {
  // As time progresses, users tend to have more complex conversations
  // This creates a gradual increase in average session length over time
  const progressFactor = monthIndex / totalMonths; // 0 to 1 based on time progression
  
  // Use different distributions based on user types
  const userType = Math.random();
  
  if (userType < 0.6) {
    // 60% are casual users with short sessions (2-5 queries) - reduced from 5-15
    // These increase slightly over time
    const baseMin = 2;
    const baseMax = 5;
    const min = Math.round(baseMin * (1 + progressFactor * 0.5));
    const max = Math.round(baseMax * (1 + progressFactor * 0.5));
    return randomInt(min, max);
  } else if (userType < 0.9) {
    // 30% are moderate users (5-10 queries) - reduced from 15-40
    // These increase moderately over time
    const baseMin = 5;
    const baseMax = 10;
    const min = Math.round(baseMin * (1 + progressFactor * 0.7));
    const max = Math.round(baseMax * (1 + progressFactor * 0.7));
    return randomInt(min, max);
  } else {
    // 10% are power users with long chat sessions (10-20 queries) - reduced from 40-100
    // These increase significantly over time
    const baseMin = 10;
    const baseMax = 15;
    const min = Math.round(baseMin * (1 + progressFactor * 0.8));
    const max = Math.round(baseMax * (1 + progressFactor));
    return randomInt(min, Math.min(20, max)); // Cap at 20 (reduced from 100)
  }
};

// Create sample event data for the events collection - reduced by 10x
const createSampleEvents = async (db, userCount, startDate, endDate) => {
  const eventTypes = [
    'pageView', 'buttonClick', 'formSubmission', 'download', 
    'login', 'logout', 'search', 'categorySelection'
  ];
  
  const eventCollection = db.collection('events');
  // Reduced from 5 events per user to 2 events per user on average
  const totalEvents = Math.ceil(userCount * 2); 
  
  console.log(`Creating ${totalEvents} sample events...`);
  
  for (let i = 0; i < totalEvents; i++) {
    const userKey = randomInt(1, userCount);
    const eventType = eventTypes[randomInt(0, eventTypes.length - 1)];
    const eventDate = randomDate(startDate, endDate);
    
    try {
      await eventCollection.save({
        _key: generateKey(),
        userId: `users/${userKey}`,
        eventType: eventType,
        timestamp: createCompatibleTimestamp(eventDate),
        data: {
          page: ['/home', '/services', '/contact', '/profile', '/dashboard'][randomInt(0, 4)],
          component: ['header', 'footer', 'sidebar', 'main', 'form'][randomInt(0, 4)],
          action: ['click', 'view', 'submit', 'hover', 'select'][randomInt(0, 4)]
        },
        createdAt: createCompatibleTimestamp(eventDate)
      });
      
      if (i % 100 === 0) { // Reduced from 1000 to 100
        console.log(`Created ${i} events so far...`);
      }
    } catch (err) {
      console.error(`Error creating event for user ${userKey}:`, err.message);
    }
  }
  
  console.log(`Created ${totalEvents} events.`);
};

// Create required indexes for improved query performance - no changes needed here
const createIndexes = async (db) => {
  console.log('Creating necessary indexes for query performance...');
  
  const indexConfigs = [
    { collection: 'queries', fields: ['timestamp'], name: 'idx_queries_timestamp', type: 'persistent' },
    { collection: 'queries', fields: ['categoryId'], name: 'idx_queries_categoryId', type: 'persistent' },
    { collection: 'queries', fields: ['userId'], name: 'idx_queries_userId', type: 'persistent' },
    { collection: 'queries', fields: ['sessionId'], name: 'idx_queries_sessionId', type: 'persistent' },
    { collection: 'analytics', fields: ['timestamp'], name: 'idx_analytics_timestamp', type: 'persistent' },
    { collection: 'analytics', fields: ['type'], name: 'idx_analytics_type', type: 'persistent' },
    { collection: 'analytics', fields: ['userId'], name: 'idx_analytics_userId', type: 'persistent' },
    { collection: 'sessions', fields: ['startTime'], name: 'idx_sessions_startTime', type: 'persistent' },
    { collection: 'sessions', fields: ['userId'], name: 'idx_sessions_userId', type: 'persistent' }
  ];
  
  for (const config of indexConfigs) {
    try {
      const collection = db.collection(config.collection);
      
      // Check if index already exists
      const indexes = await collection.indexes();
      const exists = indexes.some(idx => 
        idx.type === config.type && 
        JSON.stringify(idx.fields) === JSON.stringify(config.fields)
      );
      
      if (exists) {
        console.log(`Index ${config.name} already exists on ${config.collection}`);
      } else {
        console.log(`Creating index ${config.name} on ${config.collection}...`);
        
        if (config.type === 'persistent') {
          await collection.ensureIndex({
            type: 'persistent',
            fields: config.fields,
            name: config.name
          });
        }
        
        console.log(`Created index ${config.name}`);
      }
    } catch (err) {
      console.error(`Error creating index ${config.name}:`, err.message);
    }
  }
  
  console.log('Index creation complete');
};

// Generate and save individual services - no changes needed since services represent structure not volume
const createServices = async (db, serviceCategories) => {
  console.log('Creating services for each category...');
  
  const services = db.collection('services');
  const categoryServicesEdge = db.collection('categoryServices');
  let serviceCount = 0;
  
  for (const category of SERVICE_CATEGORIES) {
    const categoryKey = category._key;
    const enServices = CATEGORY_SERVICES[categoryKey].en;
    const frServices = CATEGORY_SERVICES[categoryKey].fr;
    const swServices = CATEGORY_SERVICES[categoryKey].sw;
    
    for (let i = 0; i < enServices.length; i++) {
      const serviceKey = generateKey();
      
      try {
        // Save service
        await services.save({
          _key: serviceKey,
          categoryId: `serviceCategories/${categoryKey}`,
          nameEN: enServices[i],
          nameFR: frServices[i],
          nameSW: swServices[i],
          description: `${enServices[i]} service under ${category.nameEN} category`,
          order: i + 1
        });
        
        // Create edge from category to service
        await categoryServicesEdge.save({
          _from: `serviceCategories/${categoryKey}`,
          _to: `services/${serviceKey}`,
          _key: generateKey(),
          order: i + 1
        });
        
        serviceCount++;
      } catch (err) {
        console.error(`Error creating service ${enServices[i]} for category ${categoryKey}:`, err.message);
      }
    }
  }
  
  console.log(`Created ${serviceCount} services across all categories`);
  return serviceCount;
};

// Fix DATE_NOW() compatibility in test queries
const runTestQueriesWithWorkaround = async (db, startDate, endDate) => {
  try {
    debug('Running test queries with DATE_NOW() workaround...');
    
    // Create timestamps that will be directly compatible
    const startISO = createCompatibleTimestamp(startDate);
    const endISO = createCompatibleTimestamp(endDate);
    
    // Use direct ISO string comparison instead of DATE_NOW()
    const query = `
      // Use direct timestamp comparison instead of DATE_NOW()
      FOR q IN queries
        FILTER q.timestamp >= '${startISO}'
        FILTER q.timestamp <= '${endISO}'
        COLLECT WITH COUNT INTO count
        RETURN {
          dateRange: {
            start: '${startDate.toISOString().slice(0, 10)}',
            end: '${endDate.toISOString().slice(0, 10)}'
          },
          count: count
        }
    `;
    
    const cursor = await db.query(query);
    const result = await cursor.next();
    
    debug(`Test query results: ${JSON.stringify(result, null, 2)}`);
    
    return result;
  } catch (err) {
    debug(`Error in test query: ${err.message}`);
    return { error: err.message };
  }
};

// Generate follow-up queries that simulate natural conversation
const generateFollowUpQueries = (baseCategory, previousQuery, count) => {
  // Create a set of follow-up questions based on the category and previous query
  const followUps = [];
  
  // Generic follow-ups that work for any category
  const genericFollowUps = [
    "Can you explain that in more detail?",
    "What documents do I need to provide?",
    "How long does this process take?",
    "Is there an online option for this service?",
    "Where is the nearest office to get this done?",
    "What are the fees involved?",
    "Do I need to make an appointment?",
    "What are the office hours?",
    "Can someone else submit this on my behalf?",
    "What if I'm not a citizen?",
    "Is there a deadline I should be aware of?",
    "What happens after I submit everything?",
    "Are there any alternatives to this process?",
    "Why is this requirement necessary?",
    "What's the fastest way to get this done?"
  ];
  
  // First, try to add some category-specific follow-ups
  if (baseCategory) {
    const categoryQuestions = CATEGORY_QUESTIONS[baseCategory];
    // Select a few random questions from the same category
    for (let i = 0; i < Math.min(count, categoryQuestions.length); i++) {
      const randomIndex = randomInt(0, categoryQuestions.length - 1);
      followUps.push(categoryQuestions[randomIndex]);
      
      // Remove the selected question to avoid duplicates
      categoryQuestions.splice(randomIndex, 1);
      
      if (categoryQuestions.length === 0) break;
    }
  }
  
  // Fill the rest with generic follow-ups
  while (followUps.length < count) {
    const randomIndex = randomInt(0, genericFollowUps.length - 1);
    followUps.push(genericFollowUps[randomIndex]);
    
    // Remove the selected question to avoid duplicates
    genericFollowUps.splice(randomIndex, 1);
    
    if (genericFollowUps.length === 0) break;
  }
  
  return followUps;
};

// Main function to generate and save test data
const generateTestData = async () => {
  try {
    debug('Starting reduced test data generation (10% of original volume)...');
    console.log('Connecting to ArangoDB...');
    const db = initDB();
    
    // Create or get collections
    console.log('Setting up collections...');
    
    // Helper function to ensure collection exists
    const ensureCollection = async (name, type = 'document') => {
      try {
        const collections = await db.listCollections();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes(name)) {
          console.log(`Creating ${name} collection (${type})...`);
          if (type === 'edge') {
            await db.createEdgeCollection(name);
          } else {
            await db.createCollection(name);
          }
          console.log(`Created ${name} collection successfully`);
        } else {
          console.log(`Collection ${name} already exists`);
        }
        
        return db.collection(name);
      } catch (err) {
        console.error(`Error ensuring collection ${name}:`, err.message);
        throw err;
      }
    };
    
    // Ensure all required collections exist
    const serviceCategories = await ensureCollection('serviceCategories');
    const services = await ensureCollection('services');
    const users = await ensureCollection('users');
    const sessions = await ensureCollection('sessions');
    const queries = await ensureCollection('queries');
    const analytics = await ensureCollection('analytics');
    const analyticsMetrics = await ensureCollection('analyticsMetrics');
    const events = await ensureCollection('events');
    
    // Ensure edge collections exist
    const userSessions = await ensureCollection('userSessions', 'edge');
    const sessionQueries = await ensureCollection('sessionQueries', 'edge');
    const queryCategories = await ensureCollection('queryCategories', 'edge');
    const categoryServices = await ensureCollection('categoryServices', 'edge');
    
    // Clear all collections first
    console.log('Clearing existing data...');
    await serviceCategories.truncate();
    await services.truncate();
    await users.truncate();
    await sessions.truncate();
    await queries.truncate();
    await analytics.truncate();
    await analyticsMetrics.truncate();
    await events.truncate();
    await userSessions.truncate();
    await sessionQueries.truncate();
    await queryCategories.truncate();
    await categoryServices.truncate();
    
    // Create service categories
    console.log('Creating service categories...');
    for (const category of SERVICE_CATEGORIES) {
      try {
        await serviceCategories.save(category);
        console.log(`Created category: ${category.nameEN}`);
      } catch (err) {
        console.error(`Error saving category ${category._key}:`, err.message);
      }
    }
    
    // Create services for each category
    const serviceCount = await createServices(db, serviceCategories);
    
    // Create required indexes for better query performance
    await createIndexes(db);
    
    // Create 3 years of data
    const endDate = new Date(); // Today
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 3); // 3 years ago
    
    const totalMonths = 36; // 3 years x 12 months
    
    // Generate months array with user and query distribution
    const months = [];
    for (let i = 0; i < totalMonths; i++) {
      const currentDate = new Date(startDate);
      currentDate.setMonth(startDate.getMonth() + i);
      
      // Calculate number of users for this month (growing from 10 to 100) - reduced by 10x
      const activeUsers = calculateUsersForMonth(i, totalMonths);
      
      // Generate month data
      months.push({
        month: i,
        date: currentDate,
        activeUsers: activeUsers,
        // On average, each user makes queries on 2-3 different days per month (reduced from 3-5)
        activeDays: Math.min(28, activeUsers * randomInt(2, 3)), 
        totalQueries: 0 // Will be calculated later
      });
    }
    
    // Generate users (200 instead of 2000, still more than max monthly users to simulate churn)
    console.log('Creating users...');
    const totalUsers = 200; // Reduced by 10x from 2000
    
    for (let i = 0; i < totalUsers; i++) {
      const userKey = generateKey();
      const user = {
        _key: userKey,
        email: `user${userKey}@example.com`,
        createdAt: createCompatibleTimestamp(randomDate(startDate, endDate)),
        updatedAt: createCompatibleTimestamp(new Date()),
        
        // Required nested fields according to schema
        personalIdentification: {
          fullName: `Test User ${userKey}`,
          dob: '1990-01-01',
          gender: ['Male', 'Female', 'Other', 'Unknown'][randomInt(0, 3)],
          nationality: ['USA', 'Canada', 'UK', 'Australia', 'Kenya', 'France', 'Germany', 'Unknown'][randomInt(0, 7)],
          maritalStatus: ['Single', 'Married', 'Divorced', 'Widowed', 'Unknown'][randomInt(0, 4)]
        },
        
        // Required nested field according to schema
        addressResidency: {
          currentAddress: `${randomInt(100, 9999)} ${['Main St', 'Oak Ave', 'Maple Rd', 'First Blvd', 'Park Place'][randomInt(0, 4)]}`
        }
      };
      
      try {
        await users.save(user);
        if (i % 50 === 0) { // Reduced from 200 to 50
          console.log(`Created ${i} users so far...`);
        }
      } catch (err) {
        console.error(`Error saving user ${userKey}:`, err.message);
      }
    }
    
    console.log(`Created ${totalUsers} users`);
    
    // Create sessions, queries for each month
    console.log('Creating sessions and queries for 3 years of data...');
    let totalSessions = 0;
    let totalQueries = 0;
    
    // Make sure to include the current month data
    console.log('Ensuring current month data is included...');
    const currentMonth = new Date();
    currentMonth.setDate(1); // First day of current month
    currentMonth.setHours(0, 0, 0, 0);
    
    let hasCurrentMonth = false;
    for (const monthData of months) {
      if (monthData.date.getFullYear() === currentMonth.getFullYear() && 
          monthData.date.getMonth() === currentMonth.getMonth()) {
        hasCurrentMonth = true;
        break;
      }
    }
    
    if (!hasCurrentMonth) {
      console.log(`Adding current month (${currentMonth.toISOString().slice(0, 7)}) to ensure complete data...`);
      months.push({
        month: months.length,
        date: new Date(currentMonth),
        activeUsers: 100, // Reduced from 1000 to 100
        activeDays: Math.min(28, 100 * randomInt(2, 3)), // Reduced from 3-5 to 2-3
        totalQueries: 0
      });
    }
    
    // Process each month
    for (const monthData of months) {
      const currentMonth = monthData.date;
      const monthUsers = monthData.activeUsers;
      
      console.log(`Processing month ${monthData.month + 1} (${currentMonth.toLocaleDateString()}) with ${monthUsers} active users`);
      
      // For current month, only process days up to today
      const isCurrentMonth = currentMonth.getFullYear() === new Date().getFullYear() && 
                             currentMonth.getMonth() === new Date().getMonth();
      
      let daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
      if (isCurrentMonth) {
        daysInMonth = Math.min(daysInMonth, new Date().getDate()); // Only up to today
        console.log(`Current month - processing ${daysInMonth} days (up to today)`);
      }
      
      // Create session days (not every user is active every day)
      for (let day = 1; day <= daysInMonth; day++) {
        // Calculate how many users are active this day - more sparse distribution than original
        const dailyActiveUsers = Math.min(monthUsers, Math.floor(monthData.activeDays / daysInMonth * monthUsers * (0.6 + Math.random() * 0.4)));
        
        // Use a different subset of users each day
        const dayUserStartIdx = randomInt(0, totalUsers - dailyActiveUsers);
        
        // Create a session for each active user this day
        for (let userIdx = 0; userIdx < dailyActiveUsers; userIdx++) {
          const userKey = String(dayUserStartIdx + userIdx + 1); // +1 because keys start at 1
          
          // Create a session
          const sessionKey = generateKey();
          const sessionDate = new Date(currentMonth);
          sessionDate.setDate(day);
          sessionDate.setHours(randomInt(8, 20)); // Between 8 AM and 8 PM
          
          const session = {
            _key: sessionKey,
            userId: `users/${userKey}`,
            startTime: createCompatibleTimestamp(sessionDate),
            endTime: createCompatibleTimestamp(new Date(sessionDate.getTime() + randomInt(5, 60) * 60000)), // 5-60 minutes
            device: ['desktop', 'mobile', 'tablet'][randomInt(0, 2)],
            platform: ['Windows', 'macOS', 'iOS', 'Android', 'Linux'][randomInt(0, 4)],
            active: false,
            createdAt: createCompatibleTimestamp(sessionDate)
          };
          
          try {
            await sessions.save(session);
            totalSessions++;
            
            if (totalSessions % 100 === 0) { // Reduced from 1000 to 100
              console.log(`Created ${totalSessions} sessions so far...`);
            }
            
            // Create edge from user to session
            await userSessions.save({
              _key: generateKey(),
              _from: session.userId,
              _to: `sessions/${sessionKey}`,
              createdAt: createCompatibleTimestamp(sessionDate)
            });
            
            // Get a more realistic number of queries per session that follows chat patterns
            // This now ranges from 2-20 queries depending on user type and time (reduced from 5-100)
            const queriesPerSession = getQueriesPerSession(monthData.month, totalMonths);
            
            // Track the current category to help generate related follow-up questions
            let currentCategory = null;
            let previousQuery = null;
            
            // Generate initial queries and follow-ups for this session
            for (let j = 0; j < queriesPerSession; j++) {
              // Start a new topic every 2-5 queries (reduced from 5-10)
              if (j === 0 || (j % randomInt(2, 5) === 0 && j < queriesPerSession - 2)) {
                // 75% of queries should have a category assigned
                const hasCategoryAssigned = Math.random() < 0.75;
                
                // Select a random category
                const categoryIdx = randomInt(0, SERVICE_CATEGORIES.length - 1);
                const category = SERVICE_CATEGORIES[categoryIdx];
                
                currentCategory = hasCategoryAssigned ? category._key : null;
                
                // Get a seed question based on the category
                previousQuery = hasCategoryAssigned ? getRandomQuery(currentCategory) : getRandomQuery();
              } else {
                // This is a follow-up question in the same conversation
                // Generate a related follow-up based on the current topic
                const followUps = generateFollowUpQueries(currentCategory, previousQuery, 3); // Reduced from 5 to 3
                previousQuery = followUps[randomInt(0, followUps.length - 1)];
              }
              
              const queryKey = generateKey();
              const queryTimestamp = new Date(sessionDate.getTime() + j * randomInt(10, 60) * 1000); // Spread queries 10-60 seconds apart
              
              const query = {
                _key: queryKey,
                userId: session.userId,
                sessionId: `sessions/${sessionKey}`,
                text: previousQuery,
                categoryId: currentCategory ? `serviceCategories/${currentCategory}` : null,
                timestamp: createCompatibleTimestamp(queryTimestamp),
                responseTime: parseFloat((Math.random() * 3 + 0.5).toFixed(1)),
                isAnswered: Math.random() > 0.1 // 90% are answered
              };
              
              await queries.save(query);
              totalQueries++;
              
              if (totalQueries % 1000 === 0) {
                console.log(`Created ${totalQueries} queries so far...`);
              }
              
              // Create edge from session to query
              await sessionQueries.save({
                _key: generateKey(),
                _from: `sessions/${sessionKey}`,
                _to: `queries/${queryKey}`,
                createdAt: createCompatibleTimestamp(queryTimestamp)
              });
              
              // Create edge from query to category if category is assigned
              if (currentCategory) {
                await queryCategories.save({
                  _key: generateKey(),
                  _from: `queries/${queryKey}`,
                  _to: `serviceCategories/${currentCategory}`,
                  confidence: 0.7 + Math.random() * 0.3
                });
              }
              
              // Create analytics record
              await analytics.save({
                _key: generateKey(),
                type: 'query',
                timestamp: query.timestamp,
                userId: query.userId,
                queryId: `queries/${queryKey}`,
                data: {
                  text: query.text,
                  categoryId: query.categoryId,
                  responseTime: query.responseTime,
                  isAnswered: query.isAnswered
                }
              });
              
              // 25% of queries get feedback (reduced from 30%)
              if (Math.random() < 0.25) {
                // Rating distribution skews positive (most users only provide feedback when happy)
                let rating;
                const randVal = Math.random();
                if (randVal < 0.6) {
                  rating = randomInt(4, 5); // 60% chance of 4-5 stars
                } else if (randVal < 0.85) {
                  rating = 3; // 25% chance of 3 stars
                } else {
                  rating = randomInt(1, 2); // 15% chance of 1-2 stars
                }
                
                const feedbackTime = new Date(queryTimestamp.getTime() + randomInt(5, 300) * 1000);
                
                await analytics.save({
                  _key: generateKey(),
                  type: 'feedback',
                  timestamp: createCompatibleTimestamp(feedbackTime),
                  userId: query.userId,
                  queryId: `queries/${queryKey}`,
                  data: { 
                    rating,
                    comment: rating >= 4 ? 
                      ['Very helpful!', 'Great response!', 'Exactly what I needed!', 'Thank you!'][randomInt(0, 3)] : 
                      rating === 3 ? 
                        ['OK but could be more detailed', 'Somewhat helpful', 'Could be better'][randomInt(0, 2)] :
                        ['Not helpful', 'Didn\'t answer my question', 'Incorrect information', 'Too vague'][randomInt(0, 3)]
                  }
                });
                
                // Update query with feedback
                await queries.update(queryKey, {
                  userFeedback: {
                    rating: rating,
                    comment: rating >= 4 ? 
                      ['Very helpful!', 'Great response!', 'Exactly what I needed!', 'Thank you!'][randomInt(0, 3)] : 
                      rating === 3 ? 
                        ['OK but could be more detailed', 'Somewhat helpful', 'Could be better'][randomInt(0, 2)] :
                        ['Not helpful', 'Didn\'t answer my question', 'Incorrect information', 'Too vague'][randomInt(0, 3)],
                    providedAt: createCompatibleTimestamp(feedbackTime)
                  }
                });
              }
            }
            
            // Update the month's total queries
            monthData.totalQueries += queriesPerSession;
            
          } catch (err) {
            console.error(`Error creating session ${sessionKey}:`, err.message);
          }
        }
      }
      
      // Create metrics records for this month
      try {
        // Calculate overall data for the month
        const satisfactionRate = 70 + Math.floor(Math.random() * 20); // 70-90% satisfaction
        
        // Create daily metrics for the month
        const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        
        // For current month, only process days up to today
        const maxDaysToProcess = isCurrentMonth ? Math.min(daysInMonth, new Date().getDate()) : daysInMonth;
        
        for (let day = 1; day <= maxDaysToProcess; day++) {
          const dayDate = new Date(currentMonth);
          dayDate.setDate(day);
          
          // Daily metrics
          const dailyQueries = Math.floor(monthData.totalQueries / daysInMonth * (0.7 + Math.random() * 0.6)); // Some variance day to day
          const dailyUsers = Math.floor(monthData.activeUsers / 3 * (0.7 + Math.random() * 0.6)); // Assume ~1/3 of monthly users active on a given day
          
          const metricsKey = generateKey();
          const startOfDay = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0, 0);
          const endOfDay = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 23, 59, 59);
          
          const metricsRecord = {
            _key: metricsKey,
            period: "daily",
            startDate: createCompatibleTimestamp(startOfDay),
            endDate: createCompatibleTimestamp(endOfDay),
            totalQueries: dailyQueries,
            uniqueUsers: dailyUsers,
            averageResponseTime: parseFloat((1.5 + Math.random() * 2).toFixed(1)),
            satisfactionRate: satisfactionRate + randomInt(-5, 5), // Slight daily variation
            
            // Distribute queries across categories
            queryDistribution: SERVICE_CATEGORIES.map(cat => {
              const weight = randomInt(5, 15); // Random distribution weight
              return {
                categoryId: `serviceCategories/${cat._key}`,
                count: Math.floor(dailyQueries * 0.75 * (weight / 70)) // 75% have categories, distribute by weights
              };
            }),
            
            topQueries: TOP_QUERIES.map(query => ({
              text: query.text,
              count: Math.floor(Math.random() * dailyQueries * 0.05), // Each top query gets up to 5% of daily queries
              avgTime: (query.avgTime * 0.8 + query.avgTime * 0.4 * Math.random()).toFixed(1)
            })),
            
            lastUpdated: createCompatibleTimestamp(new Date())
          };
          
          await analyticsMetrics.save(metricsRecord);
        }
        
        // Create monthly metrics record
        const monthlyMetricsKey = generateKey();
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1, 0, 0, 0);
        const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
        
        const monthlyMetricsRecord = {
          _key: monthlyMetricsKey,
          period: "monthly",
          startDate: createCompatibleTimestamp(startOfMonth),
          endDate: createCompatibleTimestamp(endOfMonth),
          totalQueries: monthData.totalQueries,
          uniqueUsers: monthData.activeUsers,
          averageResponseTime: parseFloat((1.5 + Math.random() * 2).toFixed(1)),
          satisfactionRate: satisfactionRate,
          
          queryDistribution: SERVICE_CATEGORIES.map(cat => {
            const weight = randomInt(5, 15); // Random distribution weight
            return {
              categoryId: `serviceCategories/${cat._key}`,
              count: Math.floor(monthData.totalQueries * 0.75 * (weight / 70)) // 75% have categories, distribute by weights
            };
          }),
          
          topQueries: TOP_QUERIES.map(query => ({
            text: query.text,
            count: Math.floor(Math.random() * monthData.totalQueries * 0.03), // Each top query gets up to 3% of monthly queries
            avgTime: (query.avgTime * 0.8 + query.avgTime * 0.4 * Math.random()).toFixed(1)
          })),
          
          lastUpdated: createCompatibleTimestamp(new Date())
        };
        
        await analyticsMetrics.save(monthlyMetricsRecord);
        
      } catch (err) {
        console.error(`Error creating metrics for month ${monthData.month + 1}:`, err.message);
      }
    }
    
    // Create sample events
    await createSampleEvents(db, totalUsers, startDate, endDate);
    
    // Print summary
    console.log(`
Summary of Reduced Data Generation (10% of original volume):
- Service Categories: ${SERVICE_CATEGORIES.length}
- Services: ${serviceCount}
- Users: ${totalUsers} (reduced from 2000 to 200)
- Sessions: ${totalSessions}
- Queries: ${totalQueries}
- Analytics Records: ~${Math.round(totalQueries * 1.25)} (queries + feedback)
- Data Period: 3 years (${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()})
    `);
    
    // Test query compatibility
    await debugDateFormats(db);
    
    // Test query for the most recent month using workaround
    console.log('Testing dashboard analytics query with workaround...');
    
    try {
      // Create 30 day range for testing
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago
      
      const result = await runTestQueriesWithWorkaround(db, recentDate, new Date());
      
      console.log('Dashboard analytics test result for recent month:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.count > 0) {
        console.log('✅ Analytics data test successful!');
      } else {
        console.log('⚠️ Analytics data may have issues, please check the output.');
      }
      
      // Now try direct date comparison instead of DATE_NOW()
      console.log('Testing direct date comparison...');
      const directQuery = `
        FOR q IN queries
          FILTER q.timestamp >= '${createCompatibleTimestamp(recentDate)}'
          FILTER q.timestamp <= '${createCompatibleTimestamp(new Date())}'
          COLLECT WITH COUNT INTO count
          RETURN count
      `;
      
      const cursor = await db.query(directQuery);
      const directResult = await cursor.next();
      
      console.log(`Direct date comparison found ${directResult} queries in the last 30 days`);
      
      // Verify percentage of queries with categories
      const categorizedQuery = `
        LET totalQueries = (
          FOR q IN queries
            COLLECT WITH COUNT INTO queryCount
            RETURN queryCount
        )[0]
        
        LET categorizedQueries = (
          FOR q IN queries
            FILTER q.categoryId != null
            COLLECT WITH COUNT INTO queryCount
            RETURN queryCount
        )[0]
        
        RETURN {
          totalQueries: totalQueries,
          categorizedQueries: categorizedQueries,
          percentage: (categorizedQueries / totalQueries) * 100
        }
      `;
      
      console.log('Verifying percentage of categorized queries...');
      const catCursor = await db.query(categorizedQuery);
      const catResult = await catCursor.next();
      
      console.log('Categorization statistics:');
      console.log(JSON.stringify(catResult, null, 2));
      
      if (catResult.percentage >= 74 && catResult.percentage <= 76) {
        console.log('✅ Categorization target achieved: Approximately 75% of queries have categories assigned.');
      } else {
        console.log(`⚠️ Categorization target not met: ${catResult.percentage.toFixed(1)}% of queries have categories (target: 75%).`);
      }
      
      // Test query distribution per user/session
      const userQueryDistributionQuery = `
        FOR s IN sessions
          LET queryCount = (
            FOR q IN queries
              FILTER q.sessionId == CONCAT('sessions/', s._key)
              COLLECT WITH COUNT INTO count
              RETURN count
          )[0]
          
          FILTER queryCount > 0
          
          COLLECT numQueries = queryCount WITH COUNT INTO countSessions
          
          SORT numQueries ASC
          RETURN {
            queriesPerSession: numQueries,
            numberOfSessions: countSessions
          }
      `;
      
      console.log('Testing query distribution per session...');
      const distCursor = await db.query(userQueryDistributionQuery);
      const distribution = await distCursor.all();
      
      // Group by ranges for better readability
      const ranges = {
        '1-5': 0,
        '6-10': 0,
        '11-15': 0,
        '16-20': 0,
        '20+': 0
      };
      
      let totalSessions = 0;
      let totalQueriesInSample = 0;
      
      for (const item of distribution) {
        totalSessions += item.numberOfSessions;
        totalQueriesInSample += (item.queriesPerSession * item.numberOfSessions);
        
        if (item.queriesPerSession <= 5) {
          ranges['1-5'] += item.numberOfSessions;
        } else if (item.queriesPerSession <= 10) {
          ranges['6-10'] += item.numberOfSessions;
        } else if (item.queriesPerSession <= 15) {
          ranges['11-15'] += item.numberOfSessions;
        } else if (item.queriesPerSession <= 20) {
          ranges['16-20'] += item.numberOfSessions;
        } else {
          ranges['20+'] += item.numberOfSessions;
        }
      }
      
      console.log('Query distribution by range:');
      for (const [range, count] of Object.entries(ranges)) {
        const percentage = ((count / totalSessions) * 100).toFixed(1);
        console.log(`${range} queries: ${count} sessions (${percentage}%)`);
      }
      
      console.log(`Average queries per session: ${(totalQueriesInSample / totalSessions).toFixed(1)}`);
      
      // Test with different date formats to debug DATE_NOW() issue
      const dateFormatTests = [
        { name: "ISO", format: `q.timestamp >= '${new Date(Date.now() - 86400000).toISOString()}'` },
        { name: "ISO with createCompatibleTimestamp", format: `q.timestamp >= '${createCompatibleTimestamp(new Date(Date.now() - 86400000))}'` },
        { name: "DATE_ISO8601", format: `q.timestamp >= DATE_ISO8601('${new Date(Date.now() - 86400000).toISOString()}')` },
        { name: "Custom DATE_ISO8601", format: `q.timestamp >= DATE_ISO8601('${createCompatibleTimestamp(new Date(Date.now() - 86400000))}')` },
        { name: "DATE_NOW()", format: `q.timestamp <= DATE_NOW()` }
      ];
      
      for (const test of dateFormatTests) {
        try {
          console.log(`Testing date format: ${test.name}`);
          const testQuery = `
            FOR q IN queries
              FILTER ${test.format}
              LIMIT 5
              RETURN q.timestamp
          `;
          
          const testCursor = await db.query(testQuery);
          const testResults = await testCursor.all();
          
          console.log(`Results: Found ${testResults.length} queries`);
          if (testResults.length > 0) {
            console.log(`Sample timestamp: ${testResults[0]}`);
          }
        } catch (err) {
          console.error(`Error testing format ${test.name}: ${err.message}`);
        }
      }
      
      // Special test for DATE_NOW() with ISO 8601 compatibility
      console.log('Performing special DATE_NOW() compatibility test...');
      const dateNowTest = `
        LET now = DATE_NOW()
        LET nowStr = DATE_ISO8601(now)
        LET nowTimestamp = DATE_TIMESTAMP(now)
        
        LET recent = (
          FOR q IN queries
            SORT q.timestamp DESC
            LIMIT 5
            RETURN {
              timestamp: q.timestamp,
              nowCompare: q.timestamp < now ? "before now" : "after now",
              isoCompare: q.timestamp < nowStr ? "before iso now" : "after iso now",
              difference: DATE_DIFF(q.timestamp, now, "ms")
            }
        )
        
        RETURN {
          now: now,
          nowStr: nowStr,
          nowTimestamp: nowTimestamp,
          recentQueries: recent
        }
      `;
      
      try {
        const nowCursor = await db.query(dateNowTest);
        const nowResult = await nowCursor.next();
        console.log('DATE_NOW() compatibility test results:');
        console.log(JSON.stringify(nowResult, null, 2));
        
        // Add a fallback solution if DATE_NOW() is still not working
        if (nowResult.recentQueries.some(q => q.nowCompare === "after now")) {
          console.log('⚠️ DATE_NOW() compatibility issue detected. Implementing fallback...');
          
          // Create a fallback solution by generating an ArangoDB function that fixes DATE_NOW()
          const createFixFunction = `
            CREATE OR REPLACE FUNCTION fixed_date_now() RETURNS DATE
            RETURN DATE_ISO8601(DATE_NOW())
          `;
          
          try {
            await db.query(createFixFunction);
            console.log('✅ Created fixed_date_now() function as a workaround');
            
            // Test the fixed function
            const fixTest = `
              LET fixedNow = fixed_date_now()
              
              FOR q IN queries
                FILTER q.timestamp <= fixedNow
                SORT q.timestamp DESC
                LIMIT 5
                RETURN {
                  timestamp: q.timestamp,
                  fixedCompare: q.timestamp <= fixedNow ? "correct" : "incorrect"
                }
            `;
            
            const fixCursor = await db.query(fixTest);
            const fixResults = await fixCursor.all();
            console.log('Fixed date function test results:');
            console.log(JSON.stringify(fixResults, null, 2));
          } catch (err) {
            console.error('Error creating fixed date function:', err.message);
          }
        }
      } catch (err) {
        console.error('Error in DATE_NOW() compatibility test:', err.message);
      }
      
    } catch (err) {
      console.error('Error testing analytics data:', err.message);
    }
    
    console.log('✅ Reduced test data generation complete (10% of original volume)!');
    
  } catch (error) {
    debug(`Error in test data generation: ${error.message}`);
    console.error('❌ Error generating test data:', error);
  } finally {
    // Close the log file
    logStream.end();
  }
};

// Export the module with the generateTestData function
module.exports = { generateTestData };

// If this script is run directly (not imported as a module)
if (require.main === module) {
  generateTestData().catch(err => {
    console.error('Fatal error in test data generation:', err);
    process.exit(1);
  });
}