/**
 * Air Quality Service for Bay Area Golf App
 * Integrates with EPA AirNow API to provide golf-specific air quality assessments
 *
 * @module services/airquality
 */

import type {
  AQICategory,
  AQICategoryLevel,
  AirQualityData,
  AirQualityResult,
  AirQualityServiceConfig,
  AirQualityServiceError,
  AirQualityErrorCode,
  AirQualitySummary,
  AirNowAPIResponse,
  AirNowObservation,
  GetCurrentAQIOptions,
  GolfRecommendation,
  GolfRecommendationLevel,
  Pollutant,
  PollutantReading,
  GolfAQIThresholds,
} from './airquality.types';

import { GOLF_AQI_THRESHOLDS } from './airquality.types';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BASE_URL = 'https://www.airnowapi.org';
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const DEFAULT_SEARCH_DISTANCE = 25; // miles

/**
 * EPA AQI category definitions
 * Based on official EPA Air Quality Index scale
 */
const AQI_CATEGORIES: Record<AQICategoryLevel, AQICategory> = {
  good: {
    level: 'good',
    number: 1,
    name: 'Good',
    minAQI: 0,
    maxAQI: 50,
    color: '#00E400',
    healthImplications: 'Air quality is satisfactory, and air pollution poses little or no risk.',
  },
  moderate: {
    level: 'moderate',
    number: 2,
    name: 'Moderate',
    minAQI: 51,
    maxAQI: 100,
    color: '#FFFF00',
    healthImplications:
      'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.',
  },
  unhealthy_sensitive: {
    level: 'unhealthy_sensitive',
    number: 3,
    name: 'Unhealthy for Sensitive Groups',
    minAQI: 101,
    maxAQI: 150,
    color: '#FF7E00',
    healthImplications:
      'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
  },
  unhealthy: {
    level: 'unhealthy',
    number: 4,
    name: 'Unhealthy',
    minAQI: 151,
    maxAQI: 200,
    color: '#FF0000',
    healthImplications:
      'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
  },
  very_unhealthy: {
    level: 'very_unhealthy',
    number: 5,
    name: 'Very Unhealthy',
    minAQI: 201,
    maxAQI: 300,
    color: '#8F3F97',
    healthImplications: 'Health alert: The risk of health effects is increased for everyone.',
  },
  hazardous: {
    level: 'hazardous',
    number: 6,
    name: 'Hazardous',
    minAQI: 301,
    maxAQI: 500,
    color: '#7E0023',
    healthImplications:
      'Health warning of emergency conditions: everyone is more likely to be affected.',
  },
};

/**
 * Golf-specific recommendations for each AQI category
 */
const GOLF_RECOMMENDATIONS: Record<GolfRecommendationLevel, Omit<GolfRecommendation, 'level'>> = {
  great: {
    summary: 'Great conditions for golf!',
    details:
      'Air quality is excellent. Perfect conditions for a full round of golf with no restrictions.',
    showWarning: false,
    suggestReschedule: false,
    tips: [
      'Enjoy your round!',
      'Stay hydrated as always',
      'Perfect day for walking the course',
    ],
  },
  good: {
    summary: 'Good conditions for golf',
    details:
      'Air quality is acceptable for most golfers. Enjoy your round with normal precautions.',
    showWarning: false,
    suggestReschedule: false,
    tips: [
      'Good conditions for most golfers',
      'Those sensitive to air quality may want to monitor how they feel',
      'Stay hydrated',
    ],
  },
  caution: {
    summary: 'Fair conditions - sensitive groups should take precautions',
    details:
      'Air quality may affect sensitive individuals. If you have asthma, heart conditions, or are elderly, consider limiting exertion or taking breaks.',
    showWarning: true,
    suggestReschedule: false,
    tips: [
      'Consider taking a cart instead of walking',
      'Take more frequent breaks',
      'Bring any necessary medications (inhalers, etc.)',
      'Sensitive groups: consider a shorter round (9 holes)',
      'Stay well hydrated',
    ],
  },
  warning: {
    summary: 'Poor conditions - consider rescheduling',
    details:
      'Air quality is unhealthy for sensitive groups and may affect healthy individuals during prolonged outdoor activity. Consider rescheduling your round.',
    showWarning: true,
    suggestReschedule: true,
    tips: [
      'Consider rescheduling to a day with better air quality',
      'If playing, strongly consider a cart and 9 holes max',
      'Reduce physical exertion - walk slowly, take many breaks',
      'Monitor symptoms: coughing, shortness of breath, chest tightness',
      'Stop playing if you experience any respiratory symptoms',
      'Sensitive groups should avoid outdoor activity',
    ],
  },
  danger: {
    summary: 'Unhealthy conditions - recommend rescheduling',
    details:
      'Air quality is unhealthy and poses health risks for extended outdoor activity. We strongly recommend rescheduling your round to protect your health.',
    showWarning: true,
    suggestReschedule: true,
    tips: [
      'Strongly recommend rescheduling your round',
      'Extended outdoor activity is not advised',
      'If you must be outdoors, minimize exertion and time',
      'Everyone may experience health effects',
      'Monitor air quality forecasts for better days',
    ],
  },
};

// ============================================================================
// Simple In-Memory Cache
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultDuration: number;

  constructor(defaultDuration: number = DEFAULT_CACHE_DURATION) {
    this.defaultDuration = defaultDuration;
  }

  set(key: string, data: T, duration?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (duration ?? this.defaultDuration),
    });
  }

  get(key: string): { data: T; cached: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return { data: entry.data, cached: true };
  }

  clear(): void {
    this.cache.clear();
  }

  /** Remove expired entries */
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the AQI category for a given AQI value
 *
 * @param aqi - The AQI value (0-500+)
 * @returns The corresponding AQI category
 *
 * @example
 * ```typescript
 * const category = getAQICategory(75);
 * console.log(category.name); // "Moderate"
 * console.log(category.color); // "#FFFF00"
 * ```
 */
export function getAQICategory(aqi: number): AQICategory {
  if (aqi < 0) {
    return AQI_CATEGORIES.good;
  }
  if (aqi <= 50) {
    return AQI_CATEGORIES.good;
  }
  if (aqi <= 100) {
    return AQI_CATEGORIES.moderate;
  }
  if (aqi <= 150) {
    return AQI_CATEGORIES.unhealthy_sensitive;
  }
  if (aqi <= 200) {
    return AQI_CATEGORIES.unhealthy;
  }
  if (aqi <= 300) {
    return AQI_CATEGORIES.very_unhealthy;
  }
  return AQI_CATEGORIES.hazardous;
}

/**
 * Get the golf-specific recommendation level for a given AQI
 * Uses more conservative thresholds for outdoor exercise
 *
 * @param aqi - The AQI value
 * @param thresholds - Optional custom thresholds (defaults to GOLF_AQI_THRESHOLDS)
 * @returns The golf recommendation level
 *
 * @example
 * ```typescript
 * const level = getGolfRecommendationLevel(125);
 * console.log(level); // "warning"
 * ```
 */
export function getGolfRecommendationLevel(
  aqi: number,
  thresholds: GolfAQIThresholds = GOLF_AQI_THRESHOLDS
): GolfRecommendationLevel {
  if (aqi <= thresholds.greatMax) {
    return 'great';
  }
  if (aqi <= thresholds.goodMax) {
    return 'good';
  }
  if (aqi <= thresholds.cautionMax) {
    return 'caution';
  }
  if (aqi <= thresholds.warningMax) {
    return 'warning';
  }
  return 'danger';
}

/**
 * Get the full golf recommendation for a given AQI
 * Includes summary, details, tips, and warning flags
 *
 * @param aqi - The AQI value
 * @param thresholds - Optional custom thresholds
 * @returns Complete golf recommendation
 *
 * @example
 * ```typescript
 * const recommendation = getGolfRecommendation(85);
 * console.log(recommendation.summary); // "Fair conditions - sensitive groups should take precautions"
 * console.log(recommendation.showWarning); // true
 * console.log(recommendation.tips); // ["Consider taking a cart...", ...]
 * ```
 */
export function getGolfRecommendation(
  aqi: number,
  thresholds: GolfAQIThresholds = GOLF_AQI_THRESHOLDS
): GolfRecommendation {
  const level = getGolfRecommendationLevel(aqi, thresholds);
  return {
    level,
    ...GOLF_RECOMMENDATIONS[level],
  };
}

/**
 * Determine if the user should be warned about air quality
 * Returns true if AQI warrants caution or worse
 *
 * @param aqi - The AQI value
 * @param thresholds - Optional custom thresholds
 * @returns True if a warning should be displayed
 *
 * @example
 * ```typescript
 * if (shouldWarnUser(95)) {
 *   showAirQualityWarning();
 * }
 * ```
 */
export function shouldWarnUser(
  aqi: number,
  thresholds: GolfAQIThresholds = GOLF_AQI_THRESHOLDS
): boolean {
  return aqi > thresholds.goodMax;
}

/**
 * Determine if rescheduling should be suggested
 * Returns true if AQI is in warning or danger zone
 *
 * @param aqi - The AQI value
 * @param thresholds - Optional custom thresholds
 * @returns True if rescheduling should be suggested
 */
export function shouldSuggestReschedule(
  aqi: number,
  thresholds: GolfAQIThresholds = GOLF_AQI_THRESHOLDS
): boolean {
  return aqi > thresholds.cautionMax;
}

/**
 * Get a simplified air quality summary for quick display
 *
 * @param aqi - The AQI value
 * @returns Simplified summary with all key display fields
 */
export function getAirQualitySummary(aqi: number): AirQualitySummary {
  const category = getAQICategory(aqi);
  const recommendation = getGolfRecommendation(aqi);

  return {
    aqi,
    categoryLevel: category.level,
    color: category.color,
    label: category.name,
    golfLevel: recommendation.level,
    golfSummary: recommendation.summary,
    showWarning: recommendation.showWarning,
  };
}

/**
 * Parse pollutant name from API to standard Pollutant type
 */
function parsePollutant(parameterName: string): Pollutant {
  const normalized = parameterName.toUpperCase().replace(/\s+/g, '');

  const pollutantMap: Record<string, Pollutant> = {
    'PM2.5': 'PM2.5',
    'PM25': 'PM2.5',
    'PM10': 'PM10',
    'O3': 'O3',
    'OZONE': 'O3',
    'NO2': 'NO2',
    'CO': 'CO',
    'SO2': 'SO2',
  };

  return pollutantMap[normalized] || 'PM2.5';
}

/**
 * Create a cache key for coordinates
 */
function createCacheKey(latitude: number, longitude: number): string {
  // Round to 2 decimal places for cache key (roughly 1km precision)
  const lat = Math.round(latitude * 100) / 100;
  const lon = Math.round(longitude * 100) / 100;
  return `aqi:${lat}:${lon}`;
}

/**
 * Create an error object
 */
function createError(
  code: AirQualityErrorCode,
  message: string,
  details?: unknown,
  retryable = true
): AirQualityServiceError {
  return { code, message, details, retryable };
}

/**
 * Validate coordinates
 */
function validateCoordinates(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

// ============================================================================
// Air Quality Service Class
// ============================================================================

/**
 * Air Quality Service for fetching and processing EPA AirNow data
 *
 * @example
 * ```typescript
 * const service = new AirQualityService({ apiKey: 'your-api-key' });
 *
 * // Get current AQI for a location
 * const result = await service.getCurrentAQI(37.7749, -122.4194);
 * if (result.success) {
 *   console.log(`AQI: ${result.data.aqi}`);
 *   console.log(`Recommendation: ${result.data.golfRecommendation.summary}`);
 * }
 * ```
 */
export class AirQualityService {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private cache: SimpleCache<AirQualityData>;
  private useMockOnFailure: boolean;

  constructor(config: AirQualityServiceConfig) {
    if (!config.apiKey) {
      throw new Error('AirNow API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.cache = new SimpleCache(config.cacheDuration ?? DEFAULT_CACHE_DURATION);
    this.useMockOnFailure = config.useMockOnFailure ?? false;
  }

  /**
   * Get current air quality data for a location
   *
   * @param latitude - Location latitude
   * @param longitude - Location longitude
   * @param options - Optional request options
   * @returns Air quality data or error
   */
  async getCurrentAQI(
    latitude: number,
    longitude: number,
    options: GetCurrentAQIOptions = {}
  ): Promise<AirQualityResult<AirQualityData>> {
    // Validate coordinates
    if (!validateCoordinates(latitude, longitude)) {
      return {
        success: false,
        error: createError(
          'INVALID_COORDINATES',
          `Invalid coordinates: latitude=${latitude}, longitude=${longitude}`,
          undefined,
          false
        ),
      };
    }

    const cacheKey = createCacheKey(latitude, longitude);

    // Check cache unless force refresh
    if (!options.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { success: true, data: cached.data, cached: true };
      }
    }

    // Build API URL
    const distance = options.distance ?? DEFAULT_SEARCH_DISTANCE;
    const url = new URL(`${this.baseUrl}/aq/observation/latLong/current/`);
    url.searchParams.set('format', 'application/json');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('distance', distance.toString());
    url.searchParams.set('API_KEY', this.apiKey);

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            error: createError(
              'INVALID_API_KEY',
              'Invalid or missing AirNow API key',
              { status: response.status },
              false
            ),
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            error: createError(
              'RATE_LIMITED',
              'AirNow API rate limit exceeded',
              { status: response.status },
              true
            ),
          };
        }
        return {
          success: false,
          error: createError(
            'API_ERROR',
            `AirNow API error: ${response.status} ${response.statusText}`,
            { status: response.status },
            true
          ),
        };
      }

      const data: AirNowAPIResponse = await response.json();

      // Handle empty response
      if (!data || !Array.isArray(data) || data.length === 0) {
        if (this.useMockOnFailure) {
          const mockData = this.createMockData(latitude, longitude);
          return { success: true, data: mockData, cached: false };
        }
        return {
          success: false,
          error: createError(
            'NO_DATA_AVAILABLE',
            'No air quality data available for this location',
            undefined,
            true
          ),
        };
      }

      // Parse and process the response
      const airQualityData = this.parseAPIResponse(data, latitude, longitude);

      // Cache the result
      this.cache.set(cacheKey, airQualityData);

      return { success: true, data: airQualityData, cached: false };
    } catch (error) {
      // Handle network/timeout errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: createError(
              'TIMEOUT',
              `Request timed out after ${this.timeout}ms`,
              undefined,
              true
            ),
          };
        }

        // Network error - check if we should use mock data
        if (this.useMockOnFailure) {
          const mockData = this.createMockData(latitude, longitude);
          return { success: true, data: mockData, cached: false };
        }

        return {
          success: false,
          error: createError(
            'NETWORK_ERROR',
            `Network error: ${error.message}`,
            { originalError: error.message },
            true
          ),
        };
      }

      return {
        success: false,
        error: createError('UNKNOWN', 'An unknown error occurred', error, true),
      };
    }
  }

  /**
   * Get simplified air quality summary for a location
   * Convenience method that returns only essential display data
   */
  async getAQISummary(
    latitude: number,
    longitude: number,
    options: GetCurrentAQIOptions = {}
  ): Promise<AirQualityResult<AirQualitySummary>> {
    const result = await this.getCurrentAQI(latitude, longitude, options);

    if (result.success === false) {
      return result;
    }

    const summary = getAirQualitySummary(result.data.aqi);
    return { success: true, data: summary, cached: result.cached };
  }

  /**
   * Check if a location is safe for golf
   * Quick boolean check for simple UI decisions
   */
  async isSafeForGolf(
    latitude: number,
    longitude: number,
    options: GetCurrentAQIOptions = {}
  ): Promise<AirQualityResult<boolean>> {
    const result = await this.getCurrentAQI(latitude, longitude, options);

    if (result.success === false) {
      return result;
    }

    const isSafe = !shouldWarnUser(result.data.aqi);
    return { success: true, data: isSafe, cached: result.cached };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Parse API response into structured AirQualityData
   */
  private parseAPIResponse(
    response: AirNowAPIResponse,
    requestLat: number,
    requestLon: number
  ): AirQualityData {
    // Find the observation with the highest AQI (primary pollutant)
    const sortedObservations = [...response].sort((a, b) => b.AQI - a.AQI);
    const primaryObservation = sortedObservations[0];

    // Parse all pollutant readings
    const pollutants: PollutantReading[] = response.map((obs) => ({
      pollutant: parsePollutant(obs.ParameterName),
      aqi: obs.AQI,
      category: getAQICategory(obs.AQI),
    }));

    // Build observation timestamp
    const observedAt = this.buildObservationTimestamp(primaryObservation);

    // Get overall category and golf recommendation based on highest AQI
    const aqi = primaryObservation.AQI;
    const category = getAQICategory(aqi);
    const golfRecommendation = getGolfRecommendation(aqi);

    return {
      location: {
        latitude: requestLat,
        longitude: requestLon,
      },
      reportingArea: primaryObservation.ReportingArea,
      stateCode: primaryObservation.StateCode,
      observedAt,
      timezone: primaryObservation.LocalTimeZone,
      aqi,
      primaryPollutant: parsePollutant(primaryObservation.ParameterName),
      category,
      pollutants,
      golfRecommendation,
      fetchedAt: new Date(),
    };
  }

  /**
   * Build ISO timestamp from observation data
   */
  private buildObservationTimestamp(observation: AirNowObservation): string {
    const { DateObserved, HourObserved, LocalTimeZone } = observation;

    // Parse the date (format: "YYYY-MM-DD")
    const [year, month, day] = DateObserved.split('-').map(Number);

    // Create a basic ISO string
    const hour = HourObserved.toString().padStart(2, '0');
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour}:00:00`;
  }

  /**
   * Create mock data for development/fallback
   */
  private createMockData(latitude: number, longitude: number): AirQualityData {
    const mockAQI = 35; // Good air quality

    return {
      location: { latitude, longitude },
      reportingArea: 'San Francisco Bay Area',
      stateCode: 'CA',
      observedAt: new Date().toISOString(),
      timezone: 'PST',
      aqi: mockAQI,
      primaryPollutant: 'PM2.5',
      category: getAQICategory(mockAQI),
      pollutants: [
        { pollutant: 'PM2.5', aqi: mockAQI, category: getAQICategory(mockAQI) },
        { pollutant: 'O3', aqi: 28, category: getAQICategory(28) },
      ],
      golfRecommendation: getGolfRecommendation(mockAQI),
      fetchedAt: new Date(),
    };
  }
}

// ============================================================================
// Factory Function & Default Export
// ============================================================================

/**
 * Create an AirQualityService instance
 *
 * @param apiKey - AirNow API key
 * @param options - Optional configuration
 * @returns Configured AirQualityService instance
 *
 * @example
 * ```typescript
 * const service = createAirQualityService(process.env.AIRNOW_API_KEY);
 * const result = await service.getCurrentAQI(37.7749, -122.4194);
 * ```
 */
export function createAirQualityService(
  apiKey: string,
  options: Omit<AirQualityServiceConfig, 'apiKey'> = {}
): AirQualityService {
  return new AirQualityService({ apiKey, ...options });
}

// Export types for consumers
export type {
  AQICategory,
  AQICategoryLevel,
  AirQualityData,
  AirQualityResult,
  AirQualityServiceConfig,
  AirQualityServiceError,
  AirQualityErrorCode,
  AirQualitySummary,
  GolfRecommendation,
  GolfRecommendationLevel,
  Pollutant,
  PollutantReading,
  GolfAQIThresholds,
  GetCurrentAQIOptions,
} from './airquality.types';

export { GOLF_AQI_THRESHOLDS } from './airquality.types';

// Default export
export default AirQualityService;
