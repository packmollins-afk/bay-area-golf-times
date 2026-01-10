/**
 * Air Quality Types for Bay Area Golf App
 * Types for EPA AirNow API responses and golf-specific air quality assessments
 */

// ============================================================================
// AQI Category Types
// ============================================================================

/**
 * EPA AQI category levels
 * Based on EPA Air Quality Index scale
 */
export type AQICategoryLevel =
  | 'good'
  | 'moderate'
  | 'unhealthy_sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

/**
 * AQI category with full details
 */
export interface AQICategory {
  /** Category level identifier */
  level: AQICategoryLevel;
  /** EPA category number (1-6) */
  number: number;
  /** Display name for the category */
  name: string;
  /** AQI range minimum (inclusive) */
  minAQI: number;
  /** AQI range maximum (inclusive) */
  maxAQI: number;
  /** Color code for display (hex) */
  color: string;
  /** Description of health implications */
  healthImplications: string;
}

/**
 * Golf-specific recommendation levels
 */
export type GolfRecommendationLevel =
  | 'great'      // Perfect for golf
  | 'good'       // Fine for most golfers
  | 'caution'    // Sensitive individuals should consider limiting time
  | 'warning'    // Consider rescheduling, especially for sensitive groups
  | 'danger';    // Strongly recommend rescheduling

/**
 * Golf-specific recommendation based on AQI
 */
export interface GolfRecommendation {
  /** Recommendation level */
  level: GolfRecommendationLevel;
  /** Short summary for display */
  summary: string;
  /** Detailed recommendation text */
  details: string;
  /** Whether to show a warning banner/alert */
  showWarning: boolean;
  /** Whether to suggest rescheduling */
  suggestReschedule: boolean;
  /** Additional tips for golfers */
  tips: string[];
}

// ============================================================================
// AirNow API Response Types
// ============================================================================

/**
 * Single observation from AirNow API
 * Represents one pollutant measurement at a location
 */
export interface AirNowObservation {
  /** Date of observation (local time) */
  DateObserved: string;
  /** Hour of observation (local time, 0-23) */
  HourObserved: number;
  /** Local timezone name */
  LocalTimeZone: string;
  /** Reporting area name (e.g., "San Francisco Bay Area") */
  ReportingArea: string;
  /** State code (e.g., "CA") */
  StateCode: string;
  /** Latitude of the reporting area centroid */
  Latitude: number;
  /** Longitude of the reporting area centroid */
  Longitude: number;
  /** Pollutant parameter name (e.g., "PM2.5", "O3") */
  ParameterName: string;
  /** Air Quality Index value (0-500+) */
  AQI: number;
  /** Category object from API */
  Category: {
    /** Category number (1-6) */
    Number: number;
    /** Category name from API */
    Name: string;
  };
}

/**
 * Raw API response (array of observations)
 */
export type AirNowAPIResponse = AirNowObservation[];

// ============================================================================
// Parsed Air Quality Data Types
// ============================================================================

/**
 * Pollutant types tracked by AirNow
 */
export type Pollutant = 'PM2.5' | 'PM10' | 'O3' | 'NO2' | 'CO' | 'SO2';

/**
 * Single pollutant reading (parsed from API)
 */
export interface PollutantReading {
  /** Pollutant type */
  pollutant: Pollutant;
  /** AQI value for this pollutant */
  aqi: number;
  /** Category for this pollutant */
  category: AQICategory;
}

/**
 * Complete air quality data for a location
 */
export interface AirQualityData {
  /** Location coordinates */
  location: {
    latitude: number;
    longitude: number;
  };
  /** Reporting area name */
  reportingArea: string;
  /** State code */
  stateCode: string;
  /** Observation timestamp (ISO 8601) */
  observedAt: string;
  /** Local timezone */
  timezone: string;
  /** Overall/primary AQI (highest among all pollutants) */
  aqi: number;
  /** Primary pollutant (the one with highest AQI) */
  primaryPollutant: Pollutant;
  /** Overall category based on primary AQI */
  category: AQICategory;
  /** Individual pollutant readings */
  pollutants: PollutantReading[];
  /** Golf-specific recommendation */
  golfRecommendation: GolfRecommendation;
  /** When this data was fetched */
  fetchedAt: Date;
}

/**
 * Simplified air quality summary for quick display
 */
export interface AirQualitySummary {
  /** Overall AQI value */
  aqi: number;
  /** Category level */
  categoryLevel: AQICategoryLevel;
  /** Display color (hex) */
  color: string;
  /** Short description (e.g., "Good", "Moderate") */
  label: string;
  /** Golf recommendation level */
  golfLevel: GolfRecommendationLevel;
  /** Brief golf recommendation */
  golfSummary: string;
  /** Whether to show warning */
  showWarning: boolean;
}

// ============================================================================
// Air Quality with Weather Integration Types
// ============================================================================

/**
 * Combined air quality and weather assessment for golf
 */
export interface GolfConditionsAssessment {
  /** Air quality data */
  airQuality: AirQualityData | null;
  /** Whether air quality data is available */
  airQualityAvailable: boolean;
  /** Overall conditions rating (combines air quality with other factors) */
  overallRating: GolfRecommendationLevel;
  /** Combined summary message */
  summary: string;
  /** All warnings to display */
  warnings: string[];
  /** All tips to display */
  tips: string[];
}

// ============================================================================
// Service Configuration Types
// ============================================================================

/**
 * Configuration options for air quality service
 */
export interface AirQualityServiceConfig {
  /** AirNow API key (required) */
  apiKey: string;
  /** Base URL for AirNow API */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Cache duration in milliseconds (default: 30 minutes) */
  cacheDuration?: number;
  /** Whether to use mock data when API fails */
  useMockOnFailure?: boolean;
}

/**
 * Request options for getCurrentAQI
 */
export interface GetCurrentAQIOptions {
  /** Distance from coordinates to search (miles) */
  distance?: number;
  /** Whether to skip cache and fetch fresh data */
  forceRefresh?: boolean;
}

// ============================================================================
// Service Error Types
// ============================================================================

/**
 * Error codes for air quality service
 */
export type AirQualityErrorCode =
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'INVALID_API_KEY'
  | 'INVALID_COORDINATES'
  | 'NO_DATA_AVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Error response from air quality service
 */
export interface AirQualityServiceError {
  code: AirQualityErrorCode;
  message: string;
  details?: unknown;
  retryable: boolean;
}

/**
 * Result type for air quality service operations
 */
export type AirQualityResult<T> =
  | { success: true; data: T; cached: boolean }
  | { success: false; error: AirQualityServiceError };

// ============================================================================
// AQI Thresholds for Outdoor Exercise (Golf-Specific)
// ============================================================================

/**
 * AQI thresholds specifically calibrated for outdoor exercise like golf
 * These are more conservative than general AQI guidelines since golf involves
 * extended outdoor exposure (4+ hours) with moderate physical exertion
 */
export interface GolfAQIThresholds {
  /** AQI at or below this is great for golf */
  greatMax: number;
  /** AQI at or below this is good for most golfers */
  goodMax: number;
  /** AQI at or below this warrants caution for sensitive individuals */
  cautionMax: number;
  /** AQI at or below this warrants a warning */
  warningMax: number;
  /** AQI above warningMax is dangerous - suggest rescheduling */
}

/**
 * Default golf-specific AQI thresholds
 * More conservative than standard EPA guidelines due to:
 * - Extended outdoor exposure (4+ hours for 18 holes)
 * - Moderate physical exertion increases breathing rate
 * - Walking 4-6 miles during a round
 */
export const GOLF_AQI_THRESHOLDS: GolfAQIThresholds = {
  greatMax: 50,     // 0-50: Great for golf - no restrictions
  goodMax: 75,      // 51-75: Good for most - fine for healthy golfers
  cautionMax: 100,  // 76-100: Caution - sensitive groups should limit exertion
  warningMax: 150,  // 101-150: Warning - consider shorter round or rescheduling
  // Above 150: Danger - strongly recommend rescheduling
};
