// init-service-categories.js
// Load environment variables from .env file
require('dotenv').config();

const { Database } = require('arangojs');

// Create a simple ServiceCategoryService implementation directly in this file
class ServiceCategoryService {
  constructor() {
    // Database connection configuration
    const config = {
      url: process.env.ARANGO_URL || 'http://localhost:8529',
      databaseName: process.env.ARANGO_DB || 'chatbot_analytics',
      auth: {
        username: process.env.ARANGO_USERNAME || 'root',
        password: process.env.ARANGO_PASSWORD || ''
      }
    };

    console.log('Using database:', config.databaseName);
    
    // Validate configuration
    if (!config.auth.password) {
      throw new Error('ERROR: No ArangoDB password provided! Set ARANGO_PASSWORD in your .env file');
    }

    // Connect directly to the target database
    this.db = new Database({
      url: config.url,
      databaseName: config.databaseName,
      auth: {
        username: config.auth.username,
        password: config.auth.password
      }
    });
    
    // Get collections
    this.serviceCategories = this.db.collection('serviceCategories');
    this.services = this.db.collection('services');
    this.categoryServices = this.db.collection('categoryServices');
  }

  /**
   * Initialize default categories and services for a new system
   * @returns {Promise<Object>} Initialization result
   */
  async initializeDefaultCategoriesAndServices() {
    try {
      // Test connection first
      try {
        const info = await this.db.version();
        console.log(`Connected to ArangoDB version: ${info.version}`);
      } catch (error) {
        console.error("Connection failed:", error.message);
        throw new Error(`Authentication failed. Please check your ArangoDB credentials. Error: ${error.message}`);
      }
      
      // Check if we already have categories
      const existingCategories = await this.db.query(`
        FOR category IN serviceCategories
          COLLECT WITH COUNT INTO count
          RETURN count
      `);
      
      const count = await existingCategories.next();
      
      if (count > 0) {
        return { message: 'Categories already initialized', count };
      }
      
      // Default categories based on ServiceTreePanelComponent data
      const defaultCategories = [
        {
          catKey: 'category1',
          name: 'Health & Social Services',
          children: ['Medical Services', 'Social Assistance', 'Healthcare Programs', 'Mental Health']
        },
        {
          catKey: 'category2',
          name: 'Education & Learning',
          children: ['K-12 Schools', 'Higher Education', 'Adult Learning', 'Educational Resources']
        },
        {
          catKey: 'category3',
          name: 'Business & Economy',
          children: ['Business Registration', 'Economic Development', 'Trade', 'Small Business Support']
        },
        {
          catKey: 'category4',
          name: 'Environment & Resources',
          children: ['Natural Resources', 'Environmental Protection', 'Parks & Recreation', 'Wildlife']
        },
        {
          catKey: 'category5',
          name: 'Transportation',
          children: ['Driver Services', 'Public Transit', 'Roads & Highways', 'Aviation']
        },
        {
          catKey: 'category6',
          name: 'Public Safety & Law',
          children: ['Police Services', 'Courts', 'Legal Services', 'Emergency Services']
        },
        {
          catKey: 'category7',
          name: 'Housing & Properties',
          children: ['Housing Programs', 'Property Assessment', 'Rental Assistance', 'Homeownership']
        },
        {
          catKey: 'category8',
          name: 'Employment & Labor',
          children: ['Job Search', 'Labor Rights', 'Workplace Safety', 'Career Development']
        },
        {
          catKey: 'category9',
          name: 'Culture & Recreation',
          children: ['Arts & Culture', 'Heritage', 'Sports & Recreation', 'Tourism']
        },
        {
          catKey: 'category10',
          name: 'Taxes & Revenue',
          children: ['Income Tax', 'Sales Tax', 'Property Tax', 'Tax Credits']
        },
        {
          catKey: 'category11',
          name: 'Government & Democracy',
          children: ['Elections', 'Government Agencies', 'Public Records', 'Civic Engagement']
        },
        {
          catKey: 'category12',
          name: 'Immigration & Citizenship',
          children: ['Immigration Services', 'Citizenship Applications', 'Visas', 'Refugee Programs']
        }
      ];
      
      // Initialize all categories and their services
      const result = await this.upsertCategories(defaultCategories);
      
      return { 
        message: 'Successfully initialized categories and services',
        categoriesCreated: result.length
      };
    } catch (error) {
      console.error('Error initializing default categories and services:', error);
      throw error;
    }
  }

  /**
   * Create or update service categories
   * @param {Array} categories - Array of category objects
   * @param {String} locale - Locale code (e.g., 'en', 'fr', 'sw')
   * @returns {Promise<Array>} The created/updated categories
   */
  async upsertCategories(categories, locale = 'en') {
    try {
      const results = [];
      const nameField = `name${locale.toUpperCase()}`;

      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const categoryKey = this.sanitizeKey(category.catKey || `category${i + 1}`);
        
        // Prepare category document
        const categoryDoc = {
          order: i + 1
        };
        
        // Set the locale-specific name
        categoryDoc[nameField] = category.name;
        
        try {
          // Check if category exists
          await this.serviceCategories.document(categoryKey);
          
          // Update existing category
          const updateData = {};
          updateData[nameField] = category.name;
          updateData.order = i + 1;
          
          const updatedCategory = await this.serviceCategories.update(
            categoryKey,
            updateData,
            { returnNew: true }
          );
          
          results.push(updatedCategory.new);
        } catch (err) {
          if (err.code === 404) {
            // Create new category
            const newCategory = await this.serviceCategories.save(categoryDoc, { key: categoryKey });
            results.push(newCategory);
          } else {
            throw err;
          }
        }
        
        // Handle children (services)
        if (category.children && Array.isArray(category.children)) {
          await this.upsertServices(categoryKey, category.children, locale);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error upserting categories:', error);
      throw error;
    }
  }
  
  /**
   * Create or update services for a category
   * @param {String} categoryKey - Category key
   * @param {Array} services - Array of service names
   * @param {String} locale - Locale code (e.g., 'en', 'fr', 'sw')
   * @returns {Promise<Array>} The created/updated services
   */
  async upsertServices(categoryKey, services, locale = 'en') {
    try {
      const results = [];
      const nameField = `name${locale.toUpperCase()}`;
      
      // Process each service
      for (let i = 0; i < services.length; i++) {
        const serviceName = services[i];
        const serviceKey = this.sanitizeKey(`service_${categoryKey}_${i + 1}`);
        
        // Prepare service document
        const serviceDoc = {
          categoryId: categoryKey,
          order: i + 1
        };
        
        serviceDoc[nameField] = serviceName;
        
        try {
          // Check if service exists
          await this.services.document(serviceKey);
          
          // Update existing service
          const updateData = {};
          updateData[nameField] = serviceName;
          updateData.order = i + 1;
          
          const updatedService = await this.services.update(
            serviceKey,
            updateData,
            { returnNew: true }
          );
          
          results.push(updatedService.new);
        } catch (err) {
          if (err.code === 404) {
            // Create new service
            const newService = await this.services.save(serviceDoc, { key: serviceKey });
            results.push(newService);
            
            // Create edge from category to service
            try {
              await this.categoryServices.save({
                _from: `serviceCategories/${categoryKey}`,
                _to: `services/${serviceKey}`
              });
            } catch (edgeErr) {
              console.error(`Error creating edge for service ${serviceKey}:`, edgeErr);
              // Continue despite error
            }
          } else {
            throw err;
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error(`Error upserting services for category ${categoryKey}:`, error);
      throw error;
    }
  }
  
  /**
   * Sanitize a key to be valid for ArangoDB
   * @param {String} key - Key to sanitize
   * @returns {String} Sanitized key
   */
  sanitizeKey(key) {
    // Remove any characters not allowed in ArangoDB keys
    // Only allow letters, numbers, and underscores
    return key.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}

/**
 * Initialize default service categories
 */
async function initializeServiceCategories() {
  try {
    console.log('Initializing default service categories...');
    
    const serviceCategoryService = new ServiceCategoryService();
    
    // Initialize default categories
    const result = await serviceCategoryService.initializeDefaultCategoriesAndServices();
    
    console.log(result.message);
    if (result.categoriesCreated) {
      console.log(`Categories created: ${result.categoriesCreated}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error initializing service categories:', error);
    throw error;
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeServiceCategories()
    .then(() => {
      console.log('Service category initialization complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Initialization failed:', error);
      process.exit(1);
    });
}

module.exports = initializeServiceCategories;
