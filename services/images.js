/**
 * Pexels Image Service for Bay Area Golf Times
 *
 * A browser-compatible vanilla JavaScript service module for fetching golf-related
 * images from Pexels. Provides search functionality, caching, and attribution handling.
 *
 * @see https://www.pexels.com/api/documentation/
 *
 * IMPORTANT: Pexels Terms of Service Requirements
 * - Always show a Pexels attribution ("Photo by [Photographer] on Pexels")
 * - Link to the photographer's Pexels profile
 * - Link back to the Pexels photo page
 * - Do not sell unaltered copies of images
 *
 * @example
 * // Using the service class
 * const imageService = new PexelsImageService({
 *   apiKey: 'your-api-key',
 *   enableCache: true,
 * });
 *
 * // Search for golf images
 * const results = await imageService.searchGolfImages({ count: 10 });
 *
 * // Using helper functions
 * const images = await searchGolfImages('golf course', { count: 10 });
 * const randomImage = await getRandomGolfImage();
 */

// ============================================================================
// Constants
// ============================================================================

const PEXELS_API_BASE = 'https://api.pexels.com/v1';
const SEARCH_ENDPOINT = `${PEXELS_API_BASE}/search`;
const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const DEFAULT_MAX_CACHE_ENTRIES = 100;
const DEFAULT_PER_PAGE = 15;
const MAX_PER_PAGE = 80;
const CACHE_PREFIX = 'pexels_golf_';

/** Default golf-related search queries for variety */
const GOLF_SEARCH_QUERIES = [
  'golf course',
  'golf fairway',
  'golf green',
  'golf course landscape',
  'golf course sunrise',
  'golf course sunset',
  'golf course aerial',
  'golf tee box',
  'golf bunker sand trap',
  'golf course water hazard',
];

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for Pexels service errors
 */
class PexelsError extends Error {
  constructor(message, code, statusCode, retryAfter) {
    super(message);
    this.name = 'PexelsError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when API key is invalid or missing
 */
class PexelsAuthError extends PexelsError {
  constructor(message = 'Invalid or missing Pexels API key') {
    super(message, 'INVALID_API_KEY', 401);
    this.name = 'PexelsAuthError';
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
class PexelsRateLimitError extends PexelsError {
  constructor(message = 'Pexels API rate limit exceeded', retryAfter) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, retryAfter);
    this.name = 'PexelsRateLimitError';
  }
}

/**
 * Error thrown for validation errors
 */
class PexelsValidationError extends PexelsError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'PexelsValidationError';
  }
}

// ============================================================================
// Cache Implementation
// ============================================================================

/**
 * In-memory cache with LRU eviction
 */
class MemoryCache {
  constructor(maxEntries = DEFAULT_MAX_CACHE_ENTRIES) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxEntries = maxEntries;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update access order (move to end)
    this._updateAccessOrder(key);
    return entry;
  }

  set(key, data, query, ttl) {
    // Evict old entries if at capacity
    while (this.cache.size >= this.maxEntries && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    const entry = {
      data,
      query,
      timestamp: now,
      expiresAt: now + ttl,
    };

    this.cache.set(key, entry);
    this._updateAccessOrder(key);
  }

  delete(key) {
    this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  has(key) {
    const entry = this.get(key);
    return entry !== null;
  }

  _updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxEntries,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * localStorage cache for client-side persistence (browser)
 */
class LocalStorageCache {
  constructor(maxEntries = DEFAULT_MAX_CACHE_ENTRIES) {
    this.maxEntries = maxEntries;
    this.memoryFallback = new MemoryCache(maxEntries);
    this.isAvailable = this._checkAvailability();
  }

  _checkAvailability() {
    try {
      const test = '__pexels_cache_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  get(key) {
    if (!this.isAvailable) {
      return this.memoryFallback.get(key);
    }

    try {
      const item = localStorage.getItem(CACHE_PREFIX + key);
      if (!item) return null;

      const entry = JSON.parse(item);

      if (Date.now() > entry.expiresAt) {
        this.delete(key);
        return null;
      }

      return entry;
    } catch {
      return null;
    }
  }

  set(key, data, query, ttl) {
    if (!this.isAvailable) {
      this.memoryFallback.set(key, data, query, ttl);
      return;
    }

    try {
      // Cleanup expired entries if needed
      this._cleanupExpired();

      const now = Date.now();
      const entry = {
        data,
        query,
        timestamp: now,
        expiresAt: now + ttl,
      };

      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (error) {
      // Handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clear();
        try {
          const now = Date.now();
          const entry = {
            data,
            query,
            timestamp: now,
            expiresAt: now + ttl,
          };
          localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
        } catch {
          // Fall back to memory cache
          this.memoryFallback.set(key, data, query, ttl);
        }
      }
    }
  }

  delete(key) {
    if (!this.isAvailable) {
      this.memoryFallback.delete(key);
      return;
    }
    localStorage.removeItem(CACHE_PREFIX + key);
  }

  clear() {
    if (!this.isAvailable) {
      this.memoryFallback.clear();
      return;
    }

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  has(key) {
    return this.get(key) !== null;
  }

  _cleanupExpired() {
    if (!this.isAvailable) return;

    const now = Date.now();
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const entry = JSON.parse(item);
            if (now > entry.expiresAt) {
              keysToRemove.push(key);
            }
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}

// ============================================================================
// Attribution Helper
// ============================================================================

/**
 * Format attribution for a Pexels photo
 *
 * Per Pexels Terms of Service:
 * - Credit the photographer
 * - Link to the photographer's Pexels profile
 * - Link to the Pexels photo page
 *
 * @param {Object} photo - The Pexels photo object
 * @returns {Object} Formatted attribution object with html, text, and links
 *
 * @example
 * const attribution = formatAttribution(photo);
 * // attribution.html: '<a href="...">Photo</a> by <a href="...">John Doe</a> on <a href="...">Pexels</a>'
 * // attribution.text: 'Photo by John Doe on Pexels'
 */
function formatAttribution(photo) {
  const photographerName = photo.photographer;
  const photographerUrl = photo.photographer_url;
  const photoUrl = photo.url;

  // HTML attribution with proper links
  const html = `<a href="${photoUrl}" target="_blank" rel="noopener noreferrer">Photo</a> by <a href="${photographerUrl}" target="_blank" rel="noopener noreferrer">${photographerName}</a> on <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a>`;

  // Plain text attribution
  const text = `Photo by ${photographerName} on Pexels`;

  return {
    photographerName,
    photographerUrl,
    photoUrl,
    html,
    text,
    alt: photo.alt || `Golf course photo by ${photographerName}`,
  };
}

// ============================================================================
// Photo Transformation
// ============================================================================

/**
 * Transform a Pexels photo to a simplified GolfImage format
 * @param {Object} photo - Pexels photo object
 * @returns {Object} Simplified golf image object
 */
function transformToGolfImage(photo) {
  return {
    id: photo.id,
    url: photo.src.landscape,
    thumbnail: photo.src.medium,
    fullSize: photo.src.original,
    width: photo.width,
    height: photo.height,
    avgColor: photo.avg_color,
    attribution: formatAttribution(photo),
    alt: photo.alt || 'Golf course image',
  };
}

// ============================================================================
// Main Service Class
// ============================================================================

/**
 * Pexels Image Service for Golf App
 *
 * Provides methods for searching and retrieving golf-related images
 * with built-in caching, error handling, and Pexels attribution compliance.
 */
class PexelsImageService {
  /**
   * Create a new Pexels image service instance
   *
   * @param {Object} config - Service configuration
   * @param {string} config.apiKey - Pexels API key (or will use window.PEXELS_API_KEY or process.env.PEXELS_API_KEY)
   * @param {boolean} [config.enableCache=true] - Enable caching
   * @param {number} [config.cacheTTL=3600000] - Cache TTL in milliseconds
   * @param {number} [config.maxCacheEntries=100] - Maximum cache entries
   * @param {number} [config.timeout=10000] - Request timeout in milliseconds
   * @param {boolean} [config.enableRetry=true] - Enable automatic retry on failure
   * @param {number} [config.maxRetries=3] - Maximum retry attempts
   * @param {number} [config.retryDelay=1000] - Initial retry delay in milliseconds
   * @param {number} [config.defaultPerPage=15] - Default results per page
   */
  constructor(config = {}) {
    // Try to get API key from various sources
    const apiKey = config.apiKey ||
      (typeof window !== 'undefined' && window.PEXELS_API_KEY) ||
      (typeof process !== 'undefined' && process.env && process.env.PEXELS_API_KEY);

    if (!apiKey) {
      throw new PexelsValidationError('Pexels API key is required. Pass it as config.apiKey, set window.PEXELS_API_KEY, or set PEXELS_API_KEY environment variable.');
    }

    this.config = {
      apiKey,
      enableCache: config.enableCache !== false,
      cacheTTL: config.cacheTTL || DEFAULT_CACHE_TTL,
      maxCacheEntries: config.maxCacheEntries || DEFAULT_MAX_CACHE_ENTRIES,
      timeout: config.timeout || 10000,
      enableRetry: config.enableRetry !== false,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      defaultPerPage: Math.min(config.defaultPerPage || DEFAULT_PER_PAGE, MAX_PER_PAGE),
    };

    // Use localStorage on client (browser), memory on server
    const isBrowser = typeof window !== 'undefined';
    this.cache = isBrowser
      ? new LocalStorageCache(this.config.maxCacheEntries)
      : new MemoryCache(this.config.maxCacheEntries);
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Search for photos using the Pexels API
   *
   * @param {Object} options - Search options
   * @param {string} options.query - Search query
   * @param {string} [options.orientation] - Image orientation ('landscape', 'portrait', 'square')
   * @param {string} [options.size] - Image size ('large', 'medium', 'small')
   * @param {string} [options.color] - Filter by color
   * @param {string} [options.locale] - Locale for search
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.per_page=15] - Results per page (max 80)
   * @returns {Promise<Object>} Search response with photos
   */
  async search(options) {
    const { query } = options;

    if (!query || !query.trim()) {
      throw new PexelsValidationError('Search query is required');
    }

    // Generate cache key
    const cacheKey = this._generateCacheKey('search', options);

    // Check cache
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    // Build URL with query parameters
    const params = new URLSearchParams({
      query: query.trim(),
      page: String(options.page || 1),
      per_page: String(Math.min(options.per_page || this.config.defaultPerPage, MAX_PER_PAGE)),
    });

    if (options.orientation) {
      params.set('orientation', options.orientation);
    }
    if (options.size) {
      params.set('size', options.size);
    }
    if (options.color) {
      params.set('color', options.color);
    }
    if (options.locale) {
      params.set('locale', options.locale);
    }

    const url = `${SEARCH_ENDPOINT}?${params.toString()}`;

    // Make request
    const response = await this._makeRequest(url);

    // Cache successful response
    if (this.config.enableCache && response.photos.length > 0) {
      this.cache.set(cacheKey, response, query, this.config.cacheTTL);
    }

    return response;
  }

  /**
   * Search for golf-specific images with simplified parameters
   *
   * @param {Object} [params={}] - Golf image search parameters
   * @param {string} [params.query='golf course'] - Search query
   * @param {string} [params.orientation='landscape'] - Image orientation
   * @param {string} [params.color] - Filter by color
   * @param {number} [params.count=15] - Number of results
   * @param {number} [params.page=1] - Page number
   * @returns {Promise<Object>} Golf image search result
   */
  async searchGolfImages(params = {}) {
    const {
      query = 'golf course',
      orientation = 'landscape',
      color,
      count = this.config.defaultPerPage,
      page = 1,
    } = params;

    // Ensure query is golf-related
    const golfQuery = query.toLowerCase().includes('golf')
      ? query
      : `golf ${query}`;

    const cacheKey = this._generateCacheKey('golf', {
      query: golfQuery,
      orientation,
      color,
      per_page: count,
      page,
    });

    // Check cache
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { ...cached.data, fromCache: true };
      }
    }

    const response = await this.search({
      query: golfQuery,
      orientation,
      color,
      per_page: count,
      page,
    });

    const result = {
      images: response.photos.map(transformToGolfImage),
      totalResults: response.total_results,
      page: response.page,
      perPage: response.per_page,
      hasMore: !!response.next_page,
      fromCache: false,
    };

    // Cache the transformed result
    if (this.config.enableCache && result.images.length > 0) {
      this.cache.set(cacheKey, result, golfQuery, this.config.cacheTTL);
    }

    return result;
  }

  /**
   * Get a random golf image from various golf-related queries
   *
   * @param {string} [orientation='landscape'] - Preferred image orientation
   * @returns {Promise<Object>} A single random golf image
   */
  async getRandomGolfImage(orientation = 'landscape') {
    // Select a random golf query
    const randomQuery = GOLF_SEARCH_QUERIES[
      Math.floor(Math.random() * GOLF_SEARCH_QUERIES.length)
    ];

    // Get a random page (between 1-5 for variety)
    const randomPage = Math.floor(Math.random() * 5) + 1;

    const results = await this.searchGolfImages({
      query: randomQuery,
      orientation,
      count: 15,
      page: randomPage,
    });

    if (results.images.length === 0) {
      // Fallback to basic query if no results
      const fallbackResults = await this.searchGolfImages({
        query: 'golf course',
        orientation,
        count: 15,
        page: 1,
      });

      if (fallbackResults.images.length === 0) {
        throw new PexelsError('No golf images found', 'UNKNOWN_ERROR', 404);
      }

      return fallbackResults.images[
        Math.floor(Math.random() * fallbackResults.images.length)
      ];
    }

    // Return a random image from results
    return results.images[Math.floor(Math.random() * results.images.length)];
  }

  /**
   * Get multiple random golf images
   *
   * @param {number} [count=5] - Number of images to retrieve
   * @param {string} [orientation='landscape'] - Preferred image orientation
   * @returns {Promise<Array>} Array of random golf images
   */
  async getRandomGolfImages(count = 5, orientation = 'landscape') {
    // Fetch more images than needed to ensure variety after deduplication
    const fetchCount = Math.min(count * 2, MAX_PER_PAGE);

    // Use multiple queries for variety
    const queries = [...GOLF_SEARCH_QUERIES]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const allImages = [];
    const seenIds = new Set();

    for (const query of queries) {
      try {
        const results = await this.searchGolfImages({
          query,
          orientation,
          count: Math.ceil(fetchCount / 3),
          page: Math.floor(Math.random() * 3) + 1,
        });

        for (const image of results.images) {
          if (!seenIds.has(image.id)) {
            seenIds.add(image.id);
            allImages.push(image);
          }
        }
      } catch {
        // Continue with other queries if one fails
        continue;
      }

      if (allImages.length >= count) break;
    }

    // Shuffle and return requested count
    return allImages
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
  }

  /**
   * Get a photo by ID
   *
   * @param {number} id - Photo ID
   * @returns {Promise<Object|null>} The photo or null if not found
   */
  async getPhoto(id) {
    const cacheKey = `photo_${id}`;

    // Check cache
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    try {
      const url = `${PEXELS_API_BASE}/photos/${id}`;
      const photo = await this._makeRequest(url);
      const golfImage = transformToGolfImage(photo);

      // Cache the result
      if (this.config.enableCache) {
        this.cache.set(cacheKey, golfImage, `photo_${id}`, this.config.cacheTTL);
      }

      return golfImage;
    } catch (error) {
      if (error instanceof PexelsError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Clear the image cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Check if a specific query is cached
   * @param {string} query - Query to check
   * @returns {boolean} Whether the query is cached
   */
  isCached(query) {
    const cacheKey = this._generateCacheKey('golf', { query });
    return this.cache.has(cacheKey);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Make an authenticated request to the Pexels API
   * @private
   */
  async _makeRequest(url, attempt = 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.config.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        throw this._handleHttpError(response);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (this._shouldRetry(attempt)) {
          await this._delay(this._getRetryDelay(attempt));
          return this._makeRequest(url, attempt + 1);
        }
        throw new PexelsError('Request timeout', 'TIMEOUT', 408);
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (this._shouldRetry(attempt)) {
          await this._delay(this._getRetryDelay(attempt));
          return this._makeRequest(url, attempt + 1);
        }
        throw new PexelsError('Network error', 'NETWORK_ERROR');
      }

      // Handle rate limit with retry
      if (error instanceof PexelsRateLimitError && this._shouldRetry(attempt)) {
        const waitTime = error.retryAfter || this._getRetryDelay(attempt);
        await this._delay(waitTime);
        return this._makeRequest(url, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Handle HTTP error responses
   * @private
   */
  _handleHttpError(response) {
    const retryAfter = response.headers.get('Retry-After');
    const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;

    switch (response.status) {
      case 401:
        return new PexelsAuthError('Invalid Pexels API key');
      case 403:
        return new PexelsAuthError('Access forbidden - check API key permissions');
      case 404:
        return new PexelsError('Resource not found', 'UNKNOWN_ERROR', 404);
      case 429:
        return new PexelsRateLimitError(
          'Pexels API rate limit exceeded. Please wait before retrying.',
          retryMs
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new PexelsError(
          `Pexels server error (${response.status})`,
          'SERVER_ERROR',
          response.status
        );
      default:
        return new PexelsError(
          `HTTP error ${response.status}`,
          'UNKNOWN_ERROR',
          response.status
        );
    }
  }

  /**
   * Determine if request should be retried
   * @private
   */
  _shouldRetry(attempt) {
    return this.config.enableRetry && attempt < this.config.maxRetries;
  }

  /**
   * Calculate retry delay with exponential backoff
   * @private
   */
  _getRetryDelay(attempt) {
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 500;
    return this.config.retryDelay * Math.pow(2, attempt - 1) + jitter;
  }

  /**
   * Promise-based delay
   * @private
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate cache key from request parameters
   * @private
   */
  _generateCacheKey(type, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .filter((key) => params[key] !== undefined)
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return `${type}_${sortedParams}`;
  }
}

// ============================================================================
// Singleton Instance & Factory
// ============================================================================

let defaultInstance = null;

/**
 * Get or create the default Pexels image service instance
 *
 * @param {string} [apiKey] - API key (required on first call unless set via window.PEXELS_API_KEY or env)
 * @returns {PexelsImageService} Pexels image service instance
 *
 * @example
 * // Initialize once (e.g., in app initialization)
 * getPexelsService('your-api-key');
 *
 * // Use anywhere
 * const service = getPexelsService();
 * const images = await service.searchGolfImages();
 */
function getPexelsService(apiKey) {
  if (!defaultInstance) {
    defaultInstance = new PexelsImageService({ apiKey });
  }
  return defaultInstance;
}

/**
 * Create a new Pexels image service with custom configuration
 *
 * @param {Object} config - Service configuration
 * @returns {PexelsImageService} New service instance
 */
function createPexelsService(config) {
  return new PexelsImageService(config);
}

/**
 * Reset the default service instance (useful for testing)
 */
function resetPexelsService() {
  defaultInstance = null;
}

// ============================================================================
// Convenience Helper Functions
// ============================================================================

/**
 * Search for golf images using the default service
 *
 * @param {string} [query='golf course'] - Search query
 * @param {Object} [options={}] - Search options
 * @param {number} [options.count=15] - Number of images
 * @param {number} [options.page=1] - Page number
 * @param {string} [options.orientation='landscape'] - Image orientation
 * @returns {Promise<Object>} Golf image search result
 *
 * @example
 * // Initialize service first
 * getPexelsService('your-api-key');
 *
 * // Then use helper function
 * const result = await searchGolfImages('golf fairway', { count: 10 });
 * result.images.forEach(img => {
 *   console.log(img.url, img.attribution.text);
 * });
 */
async function searchGolfImages(query = 'golf course', options = {}) {
  const service = getPexelsService();
  return service.searchGolfImages({
    query,
    orientation: options.orientation || 'landscape',
    count: options.count || 15,
    page: options.page || 1,
    color: options.color,
  });
}

/**
 * Get a random golf image using the default service
 *
 * @param {string} [orientation='landscape'] - Preferred image orientation
 * @returns {Promise<Object>} A random golf image
 *
 * @example
 * // Initialize service first
 * getPexelsService('your-api-key');
 *
 * // Get a random image
 * const image = await getRandomGolfImage();
 * console.log(`Using image: ${image.url}`);
 * console.log(`Credit: ${image.attribution.text}`);
 */
async function getRandomGolfImage(orientation = 'landscape') {
  const service = getPexelsService();
  return service.getRandomGolfImage(orientation);
}

// ============================================================================
// Exports (for different module systems)
// ============================================================================

// CommonJS / Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PexelsImageService,
    PexelsError,
    PexelsAuthError,
    PexelsRateLimitError,
    PexelsValidationError,
    formatAttribution,
    getPexelsService,
    createPexelsService,
    resetPexelsService,
    searchGolfImages,
    getRandomGolfImage,
    GOLF_SEARCH_QUERIES,
  };
}

// ES Module / Browser global
if (typeof window !== 'undefined') {
  window.PexelsImageService = PexelsImageService;
  window.PexelsError = PexelsError;
  window.PexelsAuthError = PexelsAuthError;
  window.PexelsRateLimitError = PexelsRateLimitError;
  window.PexelsValidationError = PexelsValidationError;
  window.formatAttribution = formatAttribution;
  window.getPexelsService = getPexelsService;
  window.createPexelsService = createPexelsService;
  window.resetPexelsService = resetPexelsService;
  window.searchGolfImages = searchGolfImages;
  window.getRandomGolfImage = getRandomGolfImage;
}
