/**
 * LocationIQ Geocoding Service
 *
 * A production-ready geocoding service module for Node.js and browser environments.
 * Provides forward and reverse geocoding with caching, rate limiting, and error handling.
 *
 * @module services/locationiq
 * @see https://locationiq.com/docs
 *
 * @example
 * ```javascript
 * const { createLocationIQService, forwardGeocode, reverseGeocode } = require('./locationiq');
 *
 * // Using the service class
 * const geocoder = createLocationIQService({
 *   apiKey: process.env.LOCATIONIQ_API_KEY,
 *   enableCache: true,
 *   cacheTTL: 86400000, // 24 hours
 * });
 *
 * const results = await geocoder.forwardGeocode('Pebble Beach Golf Links, CA');
 * const location = await geocoder.reverseGeocode(36.5725, -121.9486);
 *
 * // Or using standalone functions (requires initialization first)
 * initializeLocationIQ(process.env.LOCATIONIQ_API_KEY);
 * const results = await forwardGeocode('Half Moon Bay Golf Links');
 * ```
 */

'use strict';

// ============================================================================
// Constants
// ============================================================================

const BASE_URL = 'https://us1.locationiq.com/v1';
const SEARCH_ENDPOINT = `${BASE_URL}/search`;
const REVERSE_ENDPOINT = `${BASE_URL}/reverse`;

/** Default cache TTL: 24 hours in milliseconds */
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;

/** Default rate limit: 2 requests per second (free tier) */
const DEFAULT_RATE_LIMIT = 2;

/** Cache key prefix for storage */
const CACHE_PREFIX = 'locationiq_cache_';

/** Rate limiter storage key */
const RATE_LIMITER_KEY = 'locationiq_rate_limiter';

// ============================================================================
// Custom Errors
// ============================================================================

/**
 * Base error class for LocationIQ service errors
 */
class LocationIQError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'LocationIQError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
class RateLimitError extends LocationIQError {
  constructor(message = 'Rate limit exceeded. Please wait before making another request.', retryAfter) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when API key is invalid or missing
 */
class AuthenticationError extends LocationIQError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 'AUTHENTICATION_FAILED', 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when no results are found
 */
class NotFoundError extends LocationIQError {
  constructor(message = 'No results found for the given query') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when request validation fails
 */
class ValidationError extends LocationIQError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Check if running in Node.js environment
 * @returns {boolean}
 */
function isNodeEnvironment() {
  return typeof window === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node;
}

/**
 * Check if localStorage is available
 * @returns {boolean}
 */
function isLocalStorageAvailable() {
  if (typeof localStorage === 'undefined') return false;
  try {
    const test = '__locationiq_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Cache Implementation
// ============================================================================

/**
 * In-memory cache implementation for server-side use
 */
class MemoryCache {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(key, data, ttl) {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * localStorage cache implementation for client-side use
 */
class LocalStorageCache {
  constructor() {
    this.isAvailable = isLocalStorageAvailable();
  }

  get(key) {
    if (!this.isAvailable) return null;

    try {
      const item = localStorage.getItem(CACHE_PREFIX + key);
      if (!item) return null;

      const entry = JSON.parse(item);

      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }

      return entry;
    } catch {
      return null;
    }
  }

  set(key, data, ttl) {
    if (!this.isAvailable) return;

    try {
      const now = Date.now();
      const entry = {
        data,
        timestamp: now,
        expiresAt: now + ttl,
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (error) {
      // Handle quota exceeded by clearing old entries
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clearExpired();
        try {
          const now = Date.now();
          const entry = {
            data,
            timestamp: now,
            expiresAt: now + ttl,
          };
          localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
        } catch {
          // Silently fail if still can't store
        }
      }
    }
  }

  delete(key) {
    if (!this.isAvailable) return;
    localStorage.removeItem(CACHE_PREFIX + key);
  }

  clear() {
    if (!this.isAvailable) return;

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  clearExpired() {
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
// Rate Limiter Implementation
// ============================================================================

/**
 * Token bucket rate limiter
 */
class RateLimiter {
  constructor(requestsPerSecond) {
    this.maxTokens = requestsPerSecond;
    this.refillRate = requestsPerSecond / 1000; // tokens per millisecond
    this.tokens = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to acquire a token for making a request
   * @returns {boolean} true if token acquired, false if rate limited
   */
  tryAcquire() {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get time until next token is available (in ms)
   * @returns {number}
   */
  getWaitTime() {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillRate);
  }

  /**
   * Wait until a token is available
   * @returns {Promise<void>}
   */
  async waitForToken() {
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.tryAcquire();
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// ============================================================================
// Main Service Class
// ============================================================================

/**
 * LocationIQ Geocoding Service
 *
 * Provides forward and reverse geocoding with caching, rate limiting,
 * and comprehensive error handling.
 */
class LocationIQService {
  /**
   * Create a new LocationIQ service instance
   * @param {Object} config - Service configuration options
   * @param {string} config.apiKey - LocationIQ API key (required)
   * @param {boolean} [config.enableCache=true] - Enable caching
   * @param {number} [config.cacheTTL=86400000] - Cache time-to-live in milliseconds (default: 24 hours)
   * @param {boolean} [config.serverSideCache] - Use server-side caching instead of localStorage (default: auto-detect)
   * @param {boolean} [config.enableRateLimiting=true] - Enable rate limiting
   * @param {number} [config.rateLimit=2] - Requests per second limit (default: 2 for free tier)
   * @param {number} [config.timeout=10000] - Request timeout in milliseconds
   * @param {boolean} [config.enableRetry=true] - Retry failed requests
   * @param {number} [config.maxRetries=3] - Maximum retry attempts
   * @param {number} [config.retryDelay=1000] - Base delay for exponential backoff in ms
   * @param {string} [config.defaultLanguage='en'] - Default language for results
   * @throws {ValidationError} If API key is not provided
   */
  constructor(config) {
    if (!config || !config.apiKey) {
      throw new ValidationError('API key is required');
    }

    // Determine if we're running server-side
    const isServer = isNodeEnvironment();

    this.config = {
      apiKey: config.apiKey,
      enableCache: config.enableCache !== false,
      cacheTTL: config.cacheTTL || DEFAULT_CACHE_TTL,
      serverSideCache: config.serverSideCache !== undefined ? config.serverSideCache : isServer,
      enableRateLimiting: config.enableRateLimiting !== false,
      rateLimit: config.rateLimit || DEFAULT_RATE_LIMIT,
      timeout: config.timeout || 10000,
      enableRetry: config.enableRetry !== false,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      defaultLanguage: config.defaultLanguage || 'en',
    };

    // Initialize cache
    this.cache = this.config.serverSideCache
      ? new MemoryCache()
      : new LocalStorageCache();

    // Initialize rate limiter
    this.rateLimiter = this.config.enableRateLimiting
      ? new RateLimiter(this.config.rateLimit)
      : null;
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Perform forward geocoding (address to coordinates)
   *
   * @param {string} query - Address or place name to search for
   * @param {Object} [options={}] - Additional search options
   * @param {number} [options.limit=10] - Maximum number of results
   * @param {string[]} [options.countrycodes] - Limit results to specific countries
   * @param {Object} [options.viewbox] - Bounding box to prefer results from
   * @param {boolean} [options.bounded] - Restrict results to viewbox
   * @param {boolean} [options.addressdetails=true] - Include address breakdown
   * @param {string} [options['accept-language']] - Response language
   * @returns {Promise<Object[]>} Array of matching locations
   * @throws {ValidationError} If query is empty
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {AuthenticationError} If API key is invalid
   * @throws {NotFoundError} If no results are found
   * @throws {LocationIQError} For other API errors
   *
   * @example
   * ```javascript
   * const results = await geocoder.forwardGeocode('Pebble Beach Golf Links', {
   *   limit: 5,
   *   countrycodes: ['us'],
   *   addressdetails: true,
   * });
   * ```
   */
  async forwardGeocode(query, options = {}) {
    // Validate input
    const trimmedQuery = query ? query.trim() : '';
    if (!trimmedQuery) {
      throw new ValidationError('Search query cannot be empty');
    }

    // Generate cache key
    const cacheKey = this._generateCacheKey('forward', trimmedQuery, options);

    // Check cache
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    // Build request URL
    const params = new URLSearchParams({
      key: this.config.apiKey,
      q: trimmedQuery,
      format: options.format || 'json',
      limit: String(options.limit || 10),
      addressdetails: String(options.addressdetails !== false ? 1 : 0),
      'accept-language': options['accept-language'] || this.config.defaultLanguage,
    });

    if (options.countrycodes && options.countrycodes.length) {
      params.set('countrycodes', options.countrycodes.join(','));
    }

    if (options.viewbox) {
      params.set(
        'viewbox',
        `${options.viewbox.minLon},${options.viewbox.minLat},${options.viewbox.maxLon},${options.viewbox.maxLat}`
      );
    }

    if (options.bounded) {
      params.set('bounded', '1');
    }

    if (options.normalizeaddress) {
      params.set('normalizeaddress', '1');
    }

    if (options.normalizecity) {
      params.set('normalizecity', '1');
    }

    const url = `${SEARCH_ENDPOINT}?${params.toString()}`;

    // Make request with retry logic
    const response = await this._makeRequest(url);

    // Normalize results
    const normalized = response.map((result) => this._normalizeSearchResult(result));

    // Cache results
    if (this.config.enableCache && normalized.length > 0) {
      this.cache.set(cacheKey, normalized, this.config.cacheTTL);
    }

    return normalized;
  }

  /**
   * Perform reverse geocoding (coordinates to address)
   *
   * @param {number} latitude - Latitude coordinate (-90 to 90)
   * @param {number} longitude - Longitude coordinate (-180 to 180)
   * @param {Object} [options={}] - Additional reverse geocoding options
   * @param {number} [options.zoom] - Level of detail (0-18)
   * @param {boolean} [options.addressdetails=true] - Include address breakdown
   * @param {string} [options['accept-language']] - Response language
   * @returns {Promise<Object>} Location information for the coordinates
   * @throws {ValidationError} If coordinates are invalid
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {AuthenticationError} If API key is invalid
   * @throws {NotFoundError} If no results are found
   * @throws {LocationIQError} For other API errors
   *
   * @example
   * ```javascript
   * const location = await geocoder.reverseGeocode(37.7749, -122.4194, {
   *   zoom: 18,
   *   addressdetails: true,
   * });
   * ```
   */
  async reverseGeocode(latitude, longitude, options = {}) {
    // Validate coordinates
    this._validateCoordinates(latitude, longitude);

    // Generate cache key
    const cacheKey = this._generateCacheKey('reverse', `${latitude},${longitude}`, options);

    // Check cache
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    // Build request URL
    const params = new URLSearchParams({
      key: this.config.apiKey,
      lat: String(latitude),
      lon: String(longitude),
      format: options.format || 'json',
      addressdetails: String(options.addressdetails !== false ? 1 : 0),
      'accept-language': options['accept-language'] || this.config.defaultLanguage,
    });

    if (options.zoom !== undefined) {
      params.set('zoom', String(Math.min(18, Math.max(0, options.zoom))));
    }

    if (options.normalizeaddress) {
      params.set('normalizeaddress', '1');
    }

    const url = `${REVERSE_ENDPOINT}?${params.toString()}`;

    // Make request with retry logic
    const response = await this._makeRequest(url);

    // Normalize result
    const normalized = this._normalizeReverseResult(response);

    // Cache result
    if (this.config.enableCache) {
      this.cache.set(cacheKey, normalized, this.config.cacheTTL);
    }

    return normalized;
  }

  /**
   * Perform forward geocoding and return only the first result
   *
   * @param {string} query - Address or place name to search for
   * @param {Object} [options={}] - Additional search options
   * @returns {Promise<Object|null>} First matching location or null
   *
   * @example
   * ```javascript
   * const location = await geocoder.geocode('Harding Park Golf Course, San Francisco');
   * if (location) {
   *   console.log(`Coordinates: ${location.coordinates.latitude}, ${location.coordinates.longitude}`);
   * }
   * ```
   */
  async geocode(query, options = {}) {
    try {
      const results = await this.forwardGeocode(query, { ...options, limit: 1 });
      return results[0] || null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Batch geocode multiple addresses
   *
   * @param {string[]} queries - Array of addresses to geocode
   * @param {Object} [options={}] - Additional search options
   * @returns {Promise<Map<string, Object|Error>>} Map of query to results (or error)
   *
   * @example
   * ```javascript
   * const results = await geocoder.batchGeocode([
   *   'Pebble Beach Golf Links, CA',
   *   'TPC Harding Park, San Francisco',
   *   'Half Moon Bay Golf Links, CA',
   * ]);
   * ```
   */
  async batchGeocode(queries, options = {}) {
    const results = new Map();

    // Process sequentially to respect rate limits
    for (const query of queries) {
      try {
        const location = await this.geocode(query, options);
        if (location) {
          results.set(query, location);
        } else {
          results.set(query, new NotFoundError(`No results found for: ${query}`));
        }
      } catch (error) {
        results.set(query, error instanceof Error ? error : new Error(String(error)));
      }
    }

    return results;
  }

  /**
   * Clear the geocoding cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Remove a specific entry from the cache
   * @param {string} type - 'forward' or 'reverse'
   * @param {string} query - The original query or coordinates
   */
  invalidateCache(type, query) {
    const cacheKey = this._generateCacheKey(type, query, {});
    this.cache.delete(cacheKey);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Make an HTTP request with rate limiting, retry logic, and error handling
   * @private
   */
  async _makeRequest(url, attempt = 1) {
    // Check rate limit
    if (this.rateLimiter) {
      if (!this.rateLimiter.tryAcquire()) {
        if (this.config.enableRetry) {
          await this.rateLimiter.waitForToken();
        } else {
          throw new RateLimitError(
            'Rate limit exceeded',
            this.rateLimiter.getWaitTime()
          );
        }
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        let errorBody = {};
        try {
          errorBody = await response.json();
        } catch {
          // Ignore JSON parse errors
        }
        throw this._handleHttpError(response.status, errorBody);
      }

      const data = await response.json();

      // Handle empty results
      if (Array.isArray(data) && data.length === 0) {
        throw new NotFoundError();
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (this._shouldRetry(attempt)) {
          await this._delay(this._getRetryDelay(attempt));
          return this._makeRequest(url, attempt + 1);
        }
        throw new LocationIQError('Request timeout', 'TIMEOUT', 408);
      }

      // Handle network errors (Node.js fetch might throw TypeError)
      if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
        if (this._shouldRetry(attempt)) {
          await this._delay(this._getRetryDelay(attempt));
          return this._makeRequest(url, attempt + 1);
        }
        throw new LocationIQError('Network error', 'NETWORK_ERROR');
      }

      // Handle rate limit with retry
      if (error instanceof RateLimitError && this._shouldRetry(attempt)) {
        await this._delay(error.retryAfter || this._getRetryDelay(attempt));
        return this._makeRequest(url, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Handle HTTP error responses
   * @private
   */
  _handleHttpError(status, body) {
    const message = (body && body.error) || 'Unknown error';

    switch (status) {
      case 400:
        return new ValidationError(message);
      case 401:
        return new AuthenticationError(message);
      case 403:
        return new AuthenticationError('Access forbidden - check API key permissions');
      case 404:
        return new NotFoundError(message);
      case 429:
        return new RateLimitError(message);
      case 500:
      case 502:
      case 503:
      case 504:
        return new LocationIQError(`Server error: ${message}`, 'SERVER_ERROR', status);
      default:
        return new LocationIQError(message, 'UNKNOWN_ERROR', status);
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
    return this.config.retryDelay * Math.pow(2, attempt - 1);
  }

  /**
   * Promise-based delay
   * @private
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate latitude and longitude coordinates
   * @private
   */
  _validateCoordinates(latitude, longitude) {
    if (typeof latitude !== 'number' || isNaN(latitude)) {
      throw new ValidationError('Latitude must be a valid number');
    }
    if (typeof longitude !== 'number' || isNaN(longitude)) {
      throw new ValidationError('Longitude must be a valid number');
    }
    if (latitude < -90 || latitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90');
    }
    if (longitude < -180 || longitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180');
    }
  }

  /**
   * Generate cache key from request parameters
   * @private
   */
  _generateCacheKey(type, query, options) {
    const optionsKey = JSON.stringify(options);
    return `${type}_${query}_${optionsKey}`;
  }

  /**
   * Normalize search result to common format
   * @private
   */
  _normalizeSearchResult(result) {
    return {
      placeId: result.place_id,
      coordinates: {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      },
      displayName: result.display_name,
      address: this._normalizeAddress(result.address),
      boundingBox: result.boundingbox
        ? {
            south: parseFloat(result.boundingbox[0]),
            north: parseFloat(result.boundingbox[1]),
            west: parseFloat(result.boundingbox[2]),
            east: parseFloat(result.boundingbox[3]),
          }
        : undefined,
      type: result.type,
      class: result.class,
      importance: result.importance,
      raw: result,
    };
  }

  /**
   * Normalize reverse geocoding result to common format
   * @private
   */
  _normalizeReverseResult(result) {
    return {
      placeId: result.place_id,
      coordinates: {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      },
      displayName: result.display_name,
      address: this._normalizeAddress(result.address),
      boundingBox: result.boundingbox
        ? {
            south: parseFloat(result.boundingbox[0]),
            north: parseFloat(result.boundingbox[1]),
            west: parseFloat(result.boundingbox[2]),
            east: parseFloat(result.boundingbox[3]),
          }
        : undefined,
      raw: result,
    };
  }

  /**
   * Normalize address components
   * @private
   */
  _normalizeAddress(address) {
    if (!address) {
      return {};
    }

    return {
      street: address.road,
      houseNumber: address.house_number,
      city: address.city || address.town || address.village || address.municipality,
      county: address.county,
      state: address.state,
      stateCode: address.state_code,
      postalCode: address.postcode,
      country: address.country,
      countryCode: address.country_code,
      neighbourhood: address.neighbourhood || address.suburb,
    };
  }
}

// ============================================================================
// Factory Function & Singleton
// ============================================================================

let defaultInstance = null;

/**
 * Get or create the default LocationIQ service instance
 *
 * @param {string} [apiKey] - API key (only required on first call or to reinitialize)
 * @returns {LocationIQService} LocationIQ service instance
 *
 * @example
 * ```javascript
 * // Initialize once (e.g., at app startup)
 * getLocationIQService(process.env.LOCATIONIQ_API_KEY);
 *
 * // Use anywhere
 * const geocoder = getLocationIQService();
 * const results = await geocoder.forwardGeocode('San Francisco');
 * ```
 */
function getLocationIQService(apiKey) {
  if (!defaultInstance) {
    if (!apiKey) {
      throw new ValidationError(
        'API key is required for initial service creation. ' +
        'Pass the API key or initialize with createLocationIQService first.'
      );
    }
    defaultInstance = new LocationIQService({ apiKey });
  }
  return defaultInstance;
}

/**
 * Create a new LocationIQ service instance with custom configuration
 *
 * @param {Object} config - Service configuration
 * @returns {LocationIQService} New LocationIQ service instance
 *
 * @example
 * ```javascript
 * const customGeocoder = createLocationIQService({
 *   apiKey: process.env.LOCATIONIQ_API_KEY,
 *   enableCache: true,
 *   cacheTTL: 3600000, // 1 hour
 *   rateLimit: 10, // 10 requests per second (paid tier)
 * });
 * ```
 */
function createLocationIQService(config) {
  return new LocationIQService(config);
}

/**
 * Initialize the default LocationIQ service instance
 *
 * @param {string} apiKey - LocationIQ API key
 * @param {Object} [config={}] - Additional configuration options
 */
function initializeLocationIQ(apiKey, config = {}) {
  defaultInstance = new LocationIQService({ apiKey, ...config });
}

// ============================================================================
// Standalone Functions (convenience wrappers)
// ============================================================================

/**
 * Forward geocode an address using the default service instance
 *
 * @param {string} query - Address or place name to search for
 * @param {Object} [options={}] - Additional search options
 * @returns {Promise<Object[]>} Array of matching locations
 */
async function forwardGeocode(query, options = {}) {
  return getLocationIQService().forwardGeocode(query, options);
}

/**
 * Reverse geocode coordinates using the default service instance
 *
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {Object} [options={}] - Additional options
 * @returns {Promise<Object>} Location information
 */
async function reverseGeocode(latitude, longitude, options = {}) {
  return getLocationIQService().reverseGeocode(latitude, longitude, options);
}

/**
 * Geocode an address and return only the first result
 *
 * @param {string} query - Address or place name to search for
 * @param {Object} [options={}] - Additional search options
 * @returns {Promise<Object|null>} First matching location or null
 */
async function geocode(query, options = {}) {
  return getLocationIQService().geocode(query, options);
}

/**
 * Batch geocode multiple addresses
 *
 * @param {string[]} queries - Array of addresses to geocode
 * @param {Object} [options={}] - Additional search options
 * @returns {Promise<Map<string, Object|Error>>} Map of query to results
 */
async function batchGeocode(queries, options = {}) {
  return getLocationIQService().batchGeocode(queries, options);
}

/**
 * Clear the geocoding cache of the default service instance
 */
function clearGeocodingCache() {
  if (defaultInstance) {
    defaultInstance.clearCache();
  }
}

// ============================================================================
// Bay Area Golf Course Helpers
// ============================================================================

/**
 * Viewbox for Bay Area region (for biased search results)
 */
const BAY_AREA_VIEWBOX = {
  minLon: -123.0,
  minLat: 36.8,
  maxLon: -121.5,
  maxLat: 38.5,
};

/**
 * Search for golf courses in the Bay Area
 *
 * @param {string} query - Golf course name or partial name
 * @param {Object} [options={}] - Additional search options
 * @returns {Promise<Object[]>} Array of matching locations
 *
 * @example
 * ```javascript
 * const courses = await searchBayAreaGolfCourses('Pebble Beach');
 * ```
 */
async function searchBayAreaGolfCourses(query, options = {}) {
  return getLocationIQService().forwardGeocode(query, {
    ...options,
    countrycodes: ['us'],
    viewbox: BAY_AREA_VIEWBOX,
    bounded: false, // Prefer but don't restrict to viewbox
  });
}

/**
 * Get the distance between two coordinates in miles
 *
 * @param {Object} coord1 - First coordinate { latitude, longitude }
 * @param {Object} coord2 - Second coordinate { latitude, longitude }
 * @returns {number} Distance in miles
 */
function getDistanceMiles(coord1, coord2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.latitude)) *
      Math.cos(toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 * @private
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// ============================================================================
// Exports
// ============================================================================

// Export for CommonJS (Node.js)
module.exports = {
  // Service class
  LocationIQService,

  // Factory functions
  createLocationIQService,
  getLocationIQService,
  initializeLocationIQ,

  // Standalone functions
  forwardGeocode,
  reverseGeocode,
  geocode,
  batchGeocode,
  clearGeocodingCache,

  // Bay Area helpers
  searchBayAreaGolfCourses,
  getDistanceMiles,
  BAY_AREA_VIEWBOX,

  // Error classes
  LocationIQError,
  RateLimitError,
  AuthenticationError,
  NotFoundError,
  ValidationError,

  // Cache classes (for advanced usage)
  MemoryCache,
  LocalStorageCache,

  // Rate limiter (for advanced usage)
  RateLimiter,

  // Constants
  DEFAULT_CACHE_TTL,
  DEFAULT_RATE_LIMIT,
};

// Also support ES modules via default export
module.exports.default = LocationIQService;
