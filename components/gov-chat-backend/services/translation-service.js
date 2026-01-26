const { logger } = require('../shared-lib');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const crypto = require('crypto'); // For generating cache key
const Redis = require('ioredis');  // For Redis cache

// --- Read settings from environment variables ---
const DEFAULT_THREADS = 4;
const DEFAULT_BATCHES = 5;

const intraOpNumThreads = parseInt(process.env.TRANSLATION_THREADS, 10) || DEFAULT_THREADS;
const numParallelBatches = parseInt(process.env.TRANSLATION_BATCHES, 10) || DEFAULT_BATCHES;
const cacheEnabled = process.env.TRANSLATION_CACHE === 'on';

// --- Get Redis cache settings from env ---
const redisHost = process.env.TRANSLATION_CACHE_HOST || 'localhost';
const redisPort = parseInt(process.env.TRANSLATION_CACHE_PORT, 10) || 6379;
const redisPassword = process.env.TRANSLATION_CACHE_PASSWORD || null;

/**
 * @class TranslationService
 * @description A singleton service for on-the-fly text translation using a self-hosted AI model.
 */
class TranslationService {
  constructor() {
    this.translator = null;
    this.unified = null;
    this.remarkParse = null;
    this.remarkStringify = null;
    this.visit = null;
    this.initialized = false;
    this.cacheClient = null; // For Redis client
    
    // Map application language codes to the NLLB model's specific codes.
    // Full list: https://huggingface.co/facebook/nllb-200-distilled-600M
    this.langCodeMap = {
        en: 'eng_Latn',
        ar: 'arb_Arab', // Corrected
        th: 'tha_Thai',
        zh: 'zho_Hans',
        de: 'deu_Latn',
        fr: 'fra_Latn',
        id: 'ind_Latn',
        es: 'spa_Latn',
        ru: 'rus_Cyrl',
        pt: 'por_Latn',
        sw: 'swh_Latn', // Kiswahili
    };
    logger.info('TranslationService constructor called');
    logger.info(`[TRANSLATION-CONFIG] Using ${intraOpNumThreads} threads per job.`);
    logger.info(`[TRANSLATION-CONFIG] Using ${numParallelBatches} parallel batches.`);
    logger.info(`[TRANSLATION-CONFIG] Cache enabled: ${cacheEnabled}`);

    if (cacheEnabled) {
      logger.info(`[TRANSLATION-CONFIG] Cache connecting to Redis at ${redisHost}:${redisPort}`);
      
      // Initialize Redis Client
      this.cacheClient = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        // Optional: Add retry logic
        retryStrategy(times) {
          const delay = Math.min(times * 500, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        // Prevent hanging if Redis is down on startup
        enableOfflineQueue: false, 
      });

      this.cacheClient.on('error', (err) => {
        logger.error(`[TRANSLATION-CACHE] Redis client error: ${err.message}`);
      });
      this.cacheClient.on('connect', () => {
        logger.info('[TRANSLATION-CACHE] Connected to Redis successfully.');
      });
    }
  }

  /**
   * @method init
   * @description Initializes the service by loading the translation model.
   * This is a long-running, one-time operation on first startup.
   */
  async init() {
    if (this.initialized) {
      logger.debug('TranslationService already initialized, skipping');
      return;
    }
    try {
      logger.info('Starting TranslationService initialization: Loading AI model...');
      
      // Import ONNX runtime first
      const ort = await import('onnxruntime-web');
      ort.env.logLevel = 'fatal';
      ort.env.debug = false; 
      logger.debug('Set ONNX global log level to fatal');
      
      // Dynamically import the ESM-only transformers.js library
      const { pipeline } = await import('@xenova/transformers');
      logger.debug('Loaded transformers.js pipeline');

      // Load the quantized translation pipeline for faster performance
      this.translator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
        quantized: true,  // Use quantized model for speed and lower memory
        session_options: {
          executionMode: 'parallel',
          intraOpNumThreads: intraOpNumThreads,
          interOpNumThreads: 1,
          graphOptimizationLevel: 'all',
          // FIX #1: Suppress ONNX warnings directly in the session
          // 0:VERBOSE, 1:INFO, 2:WARNING, 3:ERROR, 4:FATAL
          logSeverityLevel: 4,
        }
      });
      logger.debug(`Loaded quantized translation pipeline with ${intraOpNumThreads} threads.`);

      // Load markdown processing libraries
      const { unified } = await import('unified');
      this.unified = unified;
      logger.debug('Loaded unified');

      const remarkParseModule = await import('remark-parse');
      this.remarkParse = remarkParseModule.default;
      logger.debug('Loaded remark-parse');

      const remarkStringifyModule = await import('remark-stringify');
      this.remarkStringify = remarkStringifyModule.default;
      logger.debug('Loaded remark-stringify');

      const { visit } = await import('unist-util-visit');
      this.visit = visit;
      logger.debug('Loaded unist-util-visit');
      
      this.initialized = true;
      logger.info('TranslationService initialized successfully. Quantized model is ready.');
    } catch (error) {
      logger.error(`Error initializing TranslationService: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * @method translate
   * @description Translates a batch of texts from a source language to a target language.
   * @param {string[]} texts - An array of text strings to translate.
   * @param {string} sourceLang - The source language code (e.g., 'en', 'fr').
   * @param {string} targetLang - The target language code (e.g., 'fr', 'de').
   * @returns {Promise<string[]>} A promise that resolves to an array of translated text strings.
   */
  async translate(texts, sourceLang, targetLang) {
    if (!this.initialized || !this.translator) {
      logger.error('TranslationService not initialized. Cannot perform translation.');
      throw new Error('TranslationService is not ready.');
    }

    if (!texts || texts.length === 0) {
      logger.warn('[TRANSLATION-SERVICE] translate method called with empty array.');
      return [];
    }

    logger.info(`[TRANSLATION-SERVICE] Starting translation for ${texts.length} texts from ${sourceLang} to ${targetLang}`);

    const sourceLangCode = this.langCodeMap[sourceLang];
    if (!sourceLangCode) {
      logger.warn(`[TRANSLATION-SERVICE] Unsupported source language code provided: ${sourceLang}`);
      throw new Error(`Unsupported source language: ${sourceLang}`);
    }

    const targetLangCode = this.langCodeMap[targetLang];
    if (!targetLangCode) {
      logger.warn(`[TRANSLATION-SERVICE] Unsupported target language code provided: ${targetLang}`);
      throw new Error(`Unsupported target language: ${targetLang}`);
    }

    try {
      logger.debug('[TRANSLATION-SERVICE] Starting model inference');
      const startTime = Date.now();
      const translations = await this.translator(texts, {
        src_lang: sourceLangCode, // Use the provided source language
        tgt_lang: targetLangCode,
      });
      
      const duration = Date.now() - startTime;
      logger.info(`[TRANSLATION-SERVICE] Translation completed in ${duration}ms.`);

      const translatedTexts = translations.map(item => item.translation_text);
      logger.debug(`[TRANSLATION-SERVICE] Extracted ${translatedTexts.length} translated texts`);
      return translatedTexts;

    } catch (error) {
      logger.error(`[TRANSLATION-SERVICE] AI model failed to translate: ${error.message}`, { 
        stack: error.stack,
        sourceLang: sourceLang,
        targetLang: targetLang 
      });
      throw new Error('Failed to perform translation.');
    }
  }

  /**
   * @method translateMarkdown
   * @description Translates the content of a markdown file while preserving the markdown structure.
   * Caches the result to Redis permanently if caching is enabled.
   * @param {string} markdownContent - The markdown content as a string.
   * @param {string} sourceLang - The source language code (e.g., 'en').
   * @param {string} targetLang - The target language code (e.g., 'fr').
   * @returns {Promise<string>} The translated markdown content as a string.
   */
  async translateMarkdown(markdownContent, sourceLang, targetLang) {
    if (!this.initialized) {
      logger.error('TranslationService not initialized. Cannot perform markdown translation.');
      throw new Error('TranslationService is not ready.');
    }

    // --- REDIS CACHE LOGIC (GET) ---
    // Generate a unique <name> by hashing the markdown content.
    const docName = crypto.createHash('md5').update(markdownContent).digest('hex');
    // Create the cache key in the format <prefix>:<name>:<locale>
    const cacheKey = `translation:${docName}:${targetLang}`;

    if (cacheEnabled && this.cacheClient) {
      try {
        const cachedResult = await this.cacheClient.get(cacheKey);
        if (cachedResult) {
          logger.info(`[TRANSLATION-CACHE] HIT: Returning from Redis key ${cacheKey}`);
          return cachedResult;
        }
        logger.info(`[TRANSLATION-CACHE] MISS: No cache in Redis for key ${cacheKey}. Translating...`);
      } catch (error) {
         logger.warn(`[TRANSLATION-CACHE] Redis GET error. Translating anyway. ${error.message}`);
      }
    }
    // --- REDIS CACHE LOGIC (END) ---

    logger.info(`[TRANSLATION-SERVICE] Starting markdown translation from ${sourceLang} to ${targetLang}`);
    const startTime = Date.now();

    // Parse the markdown into an AST
    const processor = this.unified().use(this.remarkParse);
    const tree = processor.parse(markdownContent);

    // Collect all text nodes
    const textNodes = [];
    this.visit(tree, 'text', (node) => {
      textNodes.push(node);
    });

    const texts = textNodes.map(node => node.value);
    logger.info(`[TRANSLATION-SERVICE] Extracted ${texts.length} text nodes for translation`);

    if (texts.length === 0) {
        logger.warn('[TRANSLATION-SERVICE] No text nodes found to translate. Returning original content.');
        return markdownContent;
    }

    // --- Controlled Concurrency Logic ---
    const numBatches = numParallelBatches;
    const batchSize = Math.ceil(texts.length / numBatches);
    const batches = [];

    logger.info(`[TRANSLATION-SERVICE] Splitting ${texts.length} texts into ${numBatches} parallel batches of size ~${batchSize}`);

    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }

    // Create an array of promises, one for each batch
    const translationPromises = batches.map((batch, index) => {
      logger.debug(`[TRANSLATION-SERVICE] Starting parallel batch ${index + 1}/${batches.length}`);
      return this.translate(batch, sourceLang, targetLang);
    });

    // Run all batches concurrently
    const translatedBatches = await Promise.all(translationPromises);

    // Flatten the array of arrays back into a single array
    const translatedTexts = translatedBatches.flat();

    const duration = Date.now() - startTime;
    logger.info(`[TRANSLATION-SERVICE] All ${batches.length} batches completed in ${duration}ms. Received ${translatedTexts.length} total translations.`);

    // Sanity check
    if (translatedTexts.length !== textNodes.length) {
        logger.error(`[TRANSLATION-SERVICE] Mismatch in text node count. Original: ${textNodes.length}, Translated: ${translatedTexts.length}. Aborting.`);
        // This is the corrected syntax
        throw new Error('Translation failed due to text count mismatch.');
    }

    // Replace original texts with translated ones
    textNodes.forEach((node, index) => {
      node.value = translatedTexts[index];
    });

    // Stringify back to markdown
    const translatedMarkdown = this.unified()
      .use(this.remarkStringify)
      .stringify(tree);
    
    logger.info('[TRANSLATION-SERVICE] Markdown translation completed successfully');

    // --- REDIS CACHE LOGIC (SET) ---
    if (cacheEnabled && this.cacheClient) {
      try {
        // This command now sets the key permanently, with no expiration.
        await this.cacheClient.set(cacheKey, translatedMarkdown);
        logger.info(`[TRANSLATION-CACHE] SET: Stored translation PERMANENTLY in Redis key ${cacheKey}`);
      } catch (error) {
        logger.error(`[TRANSLATION-CACHE] FAILED to write cache to Redis: ${error.message}`);
      }
    }
    // --- REDIS CACHE LOGIC (END) ---

    return translatedMarkdown;
  }
}

// Export singleton instance
module.exports = new TranslationService();