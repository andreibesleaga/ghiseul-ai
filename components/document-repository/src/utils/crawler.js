const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const { logger } = require('../../shared-lib');

class Crawler {
  constructor(pool = null) {
    logger.debug('Crawler instance created.');
    if (pool && !['string', 'object'].includes(typeof pool)) {
      logger.error('Invalid pool type provided to Crawler constructor.', { poolType: typeof pool });
      throw new Error('url pool should be string, array or tuple');
    }
    this.pool = pool;
    this.headers = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7', // The numbers here mean the priority of languages, higher means more preferred
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
    };
    this.fetchedPool = new Set();
    logger.debug('Crawler initialized', { pool: this.pool });
  }

  getSublinks($) {
    logger.debug('Entering getSublinks...');
    const sublinks = [];
    $('a').each((_, el) => {
      sublinks.push(String($(el).attr('href')));
    });
    logger.debug(`Found ${sublinks.length} raw sublinks.`);
    return sublinks;
  }

  getHyperlink($, baseUrl) {
    logger.debug(`Entering getHyperlink with baseUrl: ${baseUrl}`);
    const sublinks = [];
    const baseDomain = new URL(baseUrl).hostname;
    
    $('a').each((_, el) => {
      let link = String($(el).attr('href'));
      if (!link || link.startsWith('#') || link === 'None') {
        logger.debug(`Filtering link: ${link} (reason: empty/hash/None)`);
        return;
      }
      
      const suffix = link.split('/').pop();
      if (suffix.includes('.') && !['html', 'htmld'].includes(suffix.split('.').pop())) {
        logger.debug(`Filtering link: ${link} (reason: invalid file extension)`);
        return;
      }

      let linkUrl;
      try {
        linkUrl = new URL(link, baseUrl);
      } catch (error) {
        logger.warn(`Could not parse URL for link: ${link}. Base: ${baseUrl}`, error);
        return;
      }
      
      if (linkUrl.hostname !== baseDomain) {
        logger.debug(`Filtering link: ${linkUrl.toString()} (reason: external domain ${linkUrl.hostname})`);
        return;
      }
      if (!linkUrl.pathname) {
        logger.debug(`Filtering link: ${linkUrl.toString()} (reason: no pathname)`);
        return;
      }
      sublinks.push(linkUrl.toString());
    });
    logger.debug(`Extracted ${sublinks.length} valid hyperlinks from page.`);
    return sublinks;
  }

  async fetch(url, headers = null, maxTimes = 5) {
    logger.debug(`Attempting to fetch URL: ${url} (max retries: ${maxTimes})`);
    headers = headers || this.headers;
    let lastError;
    const totalAttempts = maxTimes; // Store original value

    while (maxTimes > 0) {
      const attempt = totalAttempts - maxTimes + 1;
      logger.debug(`Fetching ${url}, attempt ${attempt}/${totalAttempts}...`);
      try {
        if (!/^https?:\/\//i.test(url)) {
          logger.debug(`Prepending 'http://' to URL: ${url}`);
          url = 'http://' + url;
        }
        
        const response = await axios.get(url, { headers, responseType: 'text', validateStatus: null });
        
        if (response.status !== 200) {
          lastError = new Error(`fail to fetch ${url}, response status code: ${response.status}`);
          logger.warn(`Fetch attempt ${attempt} failed for ${url}: status code ${response.status}`);
        } else {
          logger.info(`Successfully fetched ${url} with status 200.`);
          
          // Try to detect encoding from headers or meta
          let encoding = 'utf-8'; // Default
          const contentType = (response.headers['content-type'] || '').toLowerCase();
          
          if (contentType.includes('charset=')) {
            encoding = contentType.split('charset=')[1].split(';')[0].trim();
            logger.debug(`Encoding detected from 'content-type' header: ${encoding}`);
          } else {
            // Check meta tags as fallback
            const metaCharset = response.data.match(/<meta\s+charset=["']?([^"'>]+)["']?/i);
            if (metaCharset) {
              encoding = metaCharset[1];
              logger.debug(`Encoding detected from <meta charset>: ${encoding}`);
            } else {
              const metaHttpEquiv = response.data.match(/<meta\s+http-equiv=["']?content-type["']?\s+content=["']?[^"']*charset=([^"'>]+)["']?/i);
              if (metaHttpEquiv) {
                encoding = metaHttpEquiv[1];
                logger.debug(`Encoding detected from <meta http-equiv>: ${encoding}`);
              } else {
                logger.debug(`No specific encoding detected, defaulting to ${encoding}.`);
              }
            }
          }
          // axios handles encoding automatically, so just return response
          return response;
        }
      } catch (e) {
        lastError = e;
        logger.warn(`Fetch attempt ${attempt} for ${url} failed with error: ${e.message}`);
      }
      maxTimes -= 1;
    }
    
    logger.error(`Failed to fetch ${url} after ${totalAttempts} attempts.`, lastError);
    throw lastError;
  }

  getTitle(html) {
    logger.debug('Entering getTitle...');
    try {
      const $ = cheerio.load(html);
      const title = $('title').text().trim() || 'untitled';
      logger.debug(`Extracted title: ${title}`);
      return title;
    } catch (error) {
      logger.warn('Failed to extract title, returning "untitled".', error);
      return 'untitled';
    }
  }

  getLanguage(html) {
    logger.debug('Entering getLanguage...');
    try {
      const $ = cheerio.load(html, { lowerCaseTags: true, lowerCaseAttributeNames: true });
      // Try to get lang attribute from <html>
      let lang = $('html').attr('lang');
      if (lang) {
        lang = lang.split('-')[0].toLowerCase();
        logger.debug(`Extracted language from <html> tag: ${lang}`);
        return lang;
      }
      // Fallback: regex search for lang attribute in <html ...>
      const match = html.match(/<html[^>]*\slang=["']?([a-zA-Z0-9-]+)["']?/i);
      if (match && match[1]) {
        lang = match[1].split('-')[0].toLowerCase();
        logger.debug(`Extracted language via regex fallback: ${lang}`);
        return lang;
      }
      logger.debug('Could not determine language, returning empty string.');
      return '';
    } catch (error) {
      logger.warn('Failed to extract language, returning empty string.', error);
      return '';
    }
  }

  async processWork(subUrl, work) {
    logger.debug(`Entering processWork for URL: ${subUrl}`);
    try {
      const response = await this.fetch(subUrl);
      if (!response) {
        logger.warn(`processWork: Fetch returned no response for ${subUrl}. Aborting.`);
        return [];
      }
      this.fetchedPool.add(subUrl);
      logger.debug(`Adding ${subUrl} to fetchedPool. Pool size: ${this.fetchedPool.size}`);
      
      const $ = this.parse(response.data);
      const baseUrl = this.getBaseUrl(subUrl);
      const sublinks = this.getHyperlink($, baseUrl);
      
      if (work) {
        logger.debug(`Executing custom 'work' function for ${subUrl}`);
        await work(subUrl, $);
      }
      logger.debug(`processWork for ${subUrl} found ${sublinks.length} new links.`);
      return sublinks;
    } catch (error) {
      logger.error(`Error during processWork for ${subUrl}: ${error.message}`, error);
      return []; // Return empty array on failure to not break Promise.all
    }
  }

  async crawl(pool, work = null, maxDepth = 10, workers = 10) {
    // Note: 'workers' param is not used in the original logic, concurrency is unlimited via Promise.all
    logger.info(`Starting new crawl. Max depth: ${maxDepth}, Concurrency: ${workers} (Note: concurrency is not strictly limited)`);
    try {
      let urlPool = new Set();
      for (const url of pool) {
        logger.info(`Processing seed URL: ${url}`);
        const baseUrl = this.getBaseUrl(url);
        const response = await this.fetch(url);
        const $ = this.parse(response.data);
        const sublinks = this.getHyperlink($, baseUrl);
        
        this.fetchedPool.add(url);
        logger.debug(`Adding seed URL ${url} to fetchedPool. Pool size: ${this.fetchedPool.size}`);
        
        sublinks.forEach(link => urlPool.add(link));
        logger.debug(`Seeded urlPool with ${urlPool.size} links from ${url}.`);

        let depth = 0;
        while (urlPool.size > 0 && depth < maxDepth) {
          logger.info(`Starting crawl depth ${depth}. URL pool size: ${urlPool.size}`);
          const tasks = [];
          let taskCount = 0;
          for (const subUrl of urlPool) {
            if (!this.fetchedPool.has(subUrl)) {
              logger.debug(`Queueing task for: ${subUrl}`);
              tasks.push(this.processWork(subUrl, work));
              taskCount++;
            }
          }

          logger.info(`Awaiting ${taskCount} new tasks for depth ${depth}.`);
          const results = await Promise.all(tasks);
          
          urlPool = new Set();
          for (const sublinks of results) {
            sublinks.forEach(link => {
              if (!this.fetchedPool.has(link)) { // Only add links not yet fetched
                urlPool.add(link);
              }
            });
          }
          logger.debug(`Depth ${depth} complete. New urlPool size: ${urlPool.size}`);
          depth += 1;
        }
        logger.info(`Crawl finished. Reached max depth ${maxDepth} or exhausted pool.`);
      }
    } catch (error) {
      logger.error(`Crawl failed: ${error.message}`, error);
    }
  }

  parse(htmlDoc) {
    logger.debug('Parsing HTML document with Cheerio...');
    return cheerio.load(htmlDoc);
  }

  async download(url, fileName) {
    logger.info(`Downloading ${url} to ${fileName}...`);
    try {
      logger.debug(`Sending stream download request for ${url}`);
      const response = await axios.get(url, { headers: this.headers, responseType: 'stream' });
      const fs = require('fs');
      const writer = fs.createWriteStream(fileName);
      
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info(`Successfully downloaded and saved ${fileName}.`);
          resolve();
        });
        writer.on('error', (error) => {
          logger.error(`File stream writer error for ${fileName}: ${error.message}`, error);
          reject(error);
        });
      });
    } catch (e) {
      logger.error(`Failed to download ${url}: ${e.message}`, e);
    }
  }

  getBaseUrl(url) {
    logger.debug(`Entering getBaseUrl for: ${url}`);
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}`;
    } catch (error) {
      logger.warn(`Could not parse URL to get base: ${url}. Returning original.`, error);
      return url;
    }
  }

  cleanText(text) {
    logger.debug('Entering cleanText...');
    const cleaned = String(text)
      .replace(/\r/g, '\n')
      .replace(/ +/g, ' ')
      .replace(/\n+/g, '\n')
      .split('\n')
      .filter(line => line && line !== ' ')
      .join('\n')
      .trim();
    logger.debug('Text cleaning complete.');
    return cleaned;
  }
}

module.exports = Crawler;