/**
 * Services Index
 * Central export point for all services
 */

// ============================================================================
// Weather Service
// ============================================================================

export {
  // Main API functions
  getHourlyForecast,
  getDailyForecast,
  getFullForecast,

  // Playability calculation
  calculatePlayabilityScore,
  calculateTemperatureScore,
  calculateWindScore,
  calculatePrecipitationScore,
  calculateCloudCoverScore,
  getPlayabilityRating,

  // Formatting helpers
  degreesToCardinal,
  getCloudDescription,
  formatTemperature,
  formatWind,
  formatPrecipitation,
  formatHourlyWeather,
  formatDailyWeather,

  // Utility functions
  findBestTeeTime,
  findBestDay,
  getWeatherSummaryForDate,
} from './weather';

// Weather Types
export type {
  Coordinates,
  HourlyForecastOptions,
  DailyForecastOptions,
  HourlyWeather,
  DailyWeather,
  HourlyWeatherWithPlayability,
  DailyWeatherWithPlayability,
  PlayabilityScore,
  PlayabilityRating,
  PlayabilityFactors,
  WeatherForecast,
  WeatherResult,
  WeatherServiceError,
  FormattedWeather,
  FormattedDailyWeather,
  CardinalDirection,
} from './weather.types';

// ============================================================================
// Air Quality Service
// ============================================================================

export {
  // Main functions
  getAQICategory,
  getGolfRecommendationLevel,
  getGolfRecommendation,
  shouldWarnUser,
  shouldSuggestReschedule,
  getAirQualitySummary,
  createAirQualityService,
  GOLF_AQI_THRESHOLDS,
} from './airquality';

// Air Quality Types
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

// Default export is the AirQualityService class
export { default as AirQualityService } from './airquality';
