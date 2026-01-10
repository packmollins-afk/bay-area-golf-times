/**
 * Weather Types for Golf App
 * Types for Open-Meteo API responses and golf-specific weather data
 */

// ============================================================================
// Open-Meteo API Response Types
// ============================================================================

/**
 * Hourly weather data units from Open-Meteo API
 */
export interface HourlyUnits {
  time: string;
  temperature_2m: string;
  apparent_temperature: string;
  precipitation_probability: string;
  wind_speed_10m: string;
  wind_direction_10m: string;
  cloud_cover: string;
}

/**
 * Hourly weather data arrays from Open-Meteo API
 */
export interface HourlyData {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation_probability: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  cloud_cover: number[];
}

/**
 * Daily weather data units from Open-Meteo API
 */
export interface DailyUnits {
  time: string;
  temperature_2m_max: string;
  temperature_2m_min: string;
  apparent_temperature_max: string;
  apparent_temperature_min: string;
  precipitation_probability_max: string;
  wind_speed_10m_max: string;
  wind_direction_10m_dominant: string;
  sunrise: string;
  sunset: string;
}

/**
 * Daily weather data arrays from Open-Meteo API
 */
export interface DailyData {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  wind_direction_10m_dominant: number[];
  sunrise: string[];
  sunset: string[];
}

/**
 * Complete Open-Meteo API response for hourly forecast
 */
export interface OpenMeteoHourlyResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units: HourlyUnits;
  hourly: HourlyData;
}

/**
 * Complete Open-Meteo API response for daily forecast
 */
export interface OpenMeteoDailyResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  daily_units: DailyUnits;
  daily: DailyData;
}

/**
 * Combined Open-Meteo API response when requesting both hourly and daily
 */
export interface OpenMeteoFullResponse extends OpenMeteoHourlyResponse {
  daily_units: DailyUnits;
  daily: DailyData;
}

// ============================================================================
// Parsed Weather Data Types
// ============================================================================

/**
 * Single hour weather data point (parsed from API response)
 */
export interface HourlyWeather {
  /** ISO 8601 timestamp */
  time: string;
  /** Date object for easier manipulation */
  date: Date;
  /** Temperature in Fahrenheit */
  temperature: number;
  /** Feels-like temperature in Fahrenheit */
  feelsLike: number;
  /** Precipitation probability (0-100%) */
  precipitationProbability: number;
  /** Wind speed in mph */
  windSpeed: number;
  /** Wind direction in degrees (0-360) */
  windDirection: number;
  /** Cloud cover percentage (0-100%) */
  cloudCover: number;
}

/**
 * Single day weather summary (parsed from API response)
 */
export interface DailyWeather {
  /** ISO 8601 date string (YYYY-MM-DD) */
  date: string;
  /** Date object for easier manipulation */
  dateObj: Date;
  /** Maximum temperature in Fahrenheit */
  temperatureMax: number;
  /** Minimum temperature in Fahrenheit */
  temperatureMin: number;
  /** Maximum feels-like temperature in Fahrenheit */
  feelsLikeMax: number;
  /** Minimum feels-like temperature in Fahrenheit */
  feelsLikeMin: number;
  /** Maximum precipitation probability (0-100%) */
  precipitationProbability: number;
  /** Maximum wind speed in mph */
  windSpeedMax: number;
  /** Dominant wind direction in degrees (0-360) */
  windDirection: number;
  /** Sunrise time ISO string */
  sunrise: string;
  /** Sunset time ISO string */
  sunset: string;
}

// ============================================================================
// Golf Playability Types
// ============================================================================

/**
 * Playability rating categories
 */
export type PlayabilityRating = 'excellent' | 'good' | 'fair' | 'poor' | 'unplayable';

/**
 * Individual factor scores for playability calculation
 */
export interface PlayabilityFactors {
  /** Temperature score (0-100) */
  temperature: number;
  /** Wind score (0-100) */
  wind: number;
  /** Precipitation score (0-100) */
  precipitation: number;
  /** Cloud cover score (0-100) - affects comfort */
  cloudCover: number;
}

/**
 * Complete playability assessment for a weather period
 */
export interface PlayabilityScore {
  /** Overall score (0-100) */
  score: number;
  /** Qualitative rating */
  rating: PlayabilityRating;
  /** Individual factor scores */
  factors: PlayabilityFactors;
  /** Human-readable summary */
  summary: string;
  /** Specific recommendations or warnings */
  recommendations: string[];
}

/**
 * Hourly weather with playability score attached
 */
export interface HourlyWeatherWithPlayability extends HourlyWeather {
  playability: PlayabilityScore;
}

/**
 * Daily weather with playability score attached
 */
export interface DailyWeatherWithPlayability extends DailyWeather {
  playability: PlayabilityScore;
}

// ============================================================================
// Display Formatting Types
// ============================================================================

/**
 * Wind direction as cardinal direction
 */
export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * Formatted weather data for display
 */
export interface FormattedWeather {
  /** e.g., "72F" */
  temperature: string;
  /** e.g., "Feels like 68F" */
  feelsLike: string;
  /** e.g., "12 mph NW" */
  wind: string;
  /** e.g., "30%" */
  precipitation: string;
  /** e.g., "Partly Cloudy" */
  cloudDescription: string;
  /** e.g., "Thursday, Jan 9" */
  dateShort: string;
  /** e.g., "Thursday, January 9, 2025" */
  dateLong: string;
  /** e.g., "2:00 PM" */
  time: string;
}

/**
 * Formatted daily weather summary for display
 */
export interface FormattedDailyWeather {
  /** e.g., "Thu" */
  dayShort: string;
  /** e.g., "Thursday" */
  dayLong: string;
  /** e.g., "Jan 9" */
  date: string;
  /** e.g., "72F / 58F" */
  temperatureRange: string;
  /** e.g., "12 mph NW" */
  windMax: string;
  /** e.g., "30%" */
  precipitation: string;
  /** e.g., "6:52 AM" */
  sunrise: string;
  /** e.g., "5:18 PM" */
  sunset: string;
}

// ============================================================================
// Service Request/Response Types
// ============================================================================

/**
 * Location coordinates for weather requests
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Options for hourly forecast request
 */
export interface HourlyForecastOptions {
  /** Number of hours to forecast (default: 48) */
  hours?: number;
  /** Timezone for response (default: 'America/Los_Angeles') */
  timezone?: string;
}

/**
 * Options for daily forecast request
 */
export interface DailyForecastOptions {
  /** Number of days to forecast (default: 7) */
  days?: number;
  /** Timezone for response (default: 'America/Los_Angeles') */
  timezone?: string;
}

/**
 * Complete forecast response with both hourly and daily data
 */
export interface WeatherForecast {
  /** Location coordinates */
  location: Coordinates;
  /** Timezone used for the forecast */
  timezone: string;
  /** Hourly forecast data */
  hourly: HourlyWeatherWithPlayability[];
  /** Daily forecast summary */
  daily: DailyWeatherWithPlayability[];
  /** When the forecast was fetched */
  fetchedAt: Date;
}

/**
 * Error response from weather service
 */
export interface WeatherServiceError {
  code: 'NETWORK_ERROR' | 'API_ERROR' | 'INVALID_COORDINATES' | 'RATE_LIMITED' | 'UNKNOWN';
  message: string;
  details?: unknown;
}

/**
 * Result type for weather service operations
 */
export type WeatherResult<T> =
  | { success: true; data: T }
  | { success: false; error: WeatherServiceError };
