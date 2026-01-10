/**
 * Open-Meteo Weather Service for Golf App
 * Production-ready weather service with golf-specific playability scoring
 */

import type {
  Coordinates,
  HourlyForecastOptions,
  DailyForecastOptions,
  OpenMeteoHourlyResponse,
  OpenMeteoDailyResponse,
  OpenMeteoFullResponse,
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
// Constants
// ============================================================================

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/** Hourly parameters to request from Open-Meteo */
const HOURLY_PARAMS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_direction_10m',
  'cloud_cover',
].join(',');

/** Daily parameters to request from Open-Meteo */
const DAILY_PARAMS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_direction_10m_dominant',
  'sunrise',
  'sunset',
].join(',');

/** Default timezone for Bay Area */
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT = 10000;

// ============================================================================
// Golf Playability Score Calculation
// ============================================================================

/**
 * Ideal golf playing conditions (used as baseline for scoring)
 */
const IDEAL_CONDITIONS = {
  temperature: { min: 65, max: 80 }, // Fahrenheit
  wind: { ideal: 5, acceptable: 15 }, // mph
  precipitation: { ideal: 0, acceptable: 20 }, // percentage
  cloudCover: { ideal: 30, acceptable: 70 }, // percentage
};

/**
 * Weights for each factor in the overall playability score
 * Total should equal 1.0
 */
const PLAYABILITY_WEIGHTS = {
  temperature: 0.30,
  wind: 0.35,
  precipitation: 0.25,
  cloudCover: 0.10,
};

/**
 * Calculate temperature score (0-100)
 * Best: 65-80F, Acceptable: 50-90F, Poor: <40F or >95F
 */
export function calculateTemperatureScore(temp: number): number {
  const { min, max } = IDEAL_CONDITIONS.temperature;

  // Perfect temperature range
  if (temp >= min && temp <= max) {
    return 100;
  }

  // Too cold
  if (temp < min) {
    if (temp >= 50) return 80 - (min - temp) * 2;
    if (temp >= 40) return 60 - (50 - temp) * 3;
    if (temp >= 32) return 30 - (40 - temp) * 2;
    return Math.max(0, 10 - (32 - temp));
  }

  // Too hot
  if (temp > max) {
    if (temp <= 90) return 80 - (temp - max) * 2;
    if (temp <= 95) return 60 - (temp - 90) * 4;
    if (temp <= 100) return 40 - (temp - 95) * 4;
    return Math.max(0, 20 - (temp - 100) * 2);
  }

  return 50;
}

/**
 * Calculate wind score (0-100)
 * Best: <5 mph, Acceptable: 5-15 mph, Challenging: 15-25 mph, Poor: >25 mph
 */
export function calculateWindScore(windSpeed: number): number {
  if (windSpeed <= 5) return 100;
  if (windSpeed <= 10) return 90 - (windSpeed - 5) * 2;
  if (windSpeed <= 15) return 80 - (windSpeed - 10) * 4;
  if (windSpeed <= 20) return 60 - (windSpeed - 15) * 4;
  if (windSpeed <= 25) return 40 - (windSpeed - 20) * 4;
  if (windSpeed <= 30) return 20 - (windSpeed - 25) * 2;
  return Math.max(0, 10 - (windSpeed - 30));
}

/**
 * Calculate precipitation score (0-100)
 * Best: 0%, Acceptable: <20%, Risky: 20-50%, Poor: >50%
 */
export function calculatePrecipitationScore(precipProb: number): number {
  if (precipProb === 0) return 100;
  if (precipProb <= 10) return 95 - precipProb * 0.5;
  if (precipProb <= 20) return 90 - (precipProb - 10) * 1;
  if (precipProb <= 30) return 80 - (precipProb - 20) * 2;
  if (precipProb <= 50) return 60 - (precipProb - 30) * 1.5;
  if (precipProb <= 70) return 30 - (precipProb - 50) * 0.75;
  return Math.max(0, 15 - (precipProb - 70) * 0.5);
}

/**
 * Calculate cloud cover score (0-100)
 * Partly cloudy is actually preferred for comfort
 * Best: 20-40%, Good: 0-60%, Acceptable: >60%
 */
export function calculateCloudCoverScore(cloudCover: number): number {
  // Partly cloudy is ideal - provides some shade
  if (cloudCover >= 20 && cloudCover <= 40) return 100;
  if (cloudCover < 20) return 90 + cloudCover * 0.5;
  if (cloudCover <= 60) return 90 - (cloudCover - 40) * 0.5;
  if (cloudCover <= 80) return 80 - (cloudCover - 60) * 1;
  return Math.max(50, 60 - (cloudCover - 80) * 0.5);
}

/**
 * Get playability rating from score
 */
export function getPlayabilityRating(score: number): PlayabilityRating {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'unplayable';
}

/**
 * Generate summary based on playability factors
 */
function generatePlayabilitySummary(
  rating: PlayabilityRating,
  factors: PlayabilityFactors,
  weather: { temperature: number; windSpeed: number; precipitationProbability: number }
): string {
  switch (rating) {
    case 'excellent':
      return 'Perfect conditions for golf!';
    case 'good':
      return 'Great day to hit the links.';
    case 'fair':
      if (factors.wind < 60) return 'Playable but windy - club up on approach shots.';
      if (factors.precipitation < 60) return 'Some rain risk - bring rain gear.';
      if (factors.temperature < 60) {
        return weather.temperature < 50
          ? 'Chilly conditions - dress in layers.'
          : 'Warm conditions - stay hydrated.';
      }
      return 'Decent conditions with some challenges.';
    case 'poor':
      if (factors.wind < 40) return 'Very windy - expect ball flight issues.';
      if (factors.precipitation < 40) return 'High rain probability - consider rescheduling.';
      if (factors.temperature < 40) {
        return weather.temperature < 40
          ? 'Too cold for comfortable play.'
          : 'Extreme heat - limit your round.';
      }
      return 'Challenging conditions - play at your own risk.';
    case 'unplayable':
      return 'Not recommended for golf today.';
  }
}

/**
 * Generate specific recommendations based on conditions
 */
function generateRecommendations(
  _factors: PlayabilityFactors,
  weather: { temperature: number; windSpeed: number; precipitationProbability: number; cloudCover: number }
): string[] {
  const recommendations: string[] = [];

  // Temperature recommendations
  if (weather.temperature < 50) {
    recommendations.push('Wear layers and consider hand warmers');
  } else if (weather.temperature < 60) {
    recommendations.push('Bring a light jacket');
  } else if (weather.temperature > 90) {
    recommendations.push('Bring plenty of water and sunscreen');
    recommendations.push('Consider playing early morning or late afternoon');
  } else if (weather.temperature > 85) {
    recommendations.push('Stay hydrated throughout your round');
  }

  // Wind recommendations
  if (weather.windSpeed > 20) {
    recommendations.push('Use lower ball flights and club up into the wind');
    recommendations.push('Consider playing from forward tees');
  } else if (weather.windSpeed > 15) {
    recommendations.push('Factor wind into club selection');
  }

  // Precipitation recommendations
  if (weather.precipitationProbability > 50) {
    recommendations.push('Pack rain gear and extra towels');
    recommendations.push('Consider booking a later tee time if storms are expected');
  } else if (weather.precipitationProbability > 30) {
    recommendations.push('Bring rain gear just in case');
  }

  // Cloud cover recommendations
  if (weather.cloudCover < 20 && weather.temperature > 75) {
    recommendations.push('Apply sunscreen regularly');
    recommendations.push('Wear a hat for sun protection');
  }

  // General good conditions
  if (recommendations.length === 0) {
    recommendations.push('Enjoy your round!');
  }

  return recommendations;
}

/**
 * Calculate comprehensive golf playability score
 */
export function calculatePlayabilityScore(
  temperature: number,
  windSpeed: number,
  precipitationProbability: number,
  cloudCover: number
): PlayabilityScore {
  const factors: PlayabilityFactors = {
    temperature: calculateTemperatureScore(temperature),
    wind: calculateWindScore(windSpeed),
    precipitation: calculatePrecipitationScore(precipitationProbability),
    cloudCover: calculateCloudCoverScore(cloudCover),
  };

  // Calculate weighted score
  const score = Math.round(
    factors.temperature * PLAYABILITY_WEIGHTS.temperature +
    factors.wind * PLAYABILITY_WEIGHTS.wind +
    factors.precipitation * PLAYABILITY_WEIGHTS.precipitation +
    factors.cloudCover * PLAYABILITY_WEIGHTS.cloudCover
  );

  const rating = getPlayabilityRating(score);
  const weather = { temperature, windSpeed, precipitationProbability, cloudCover };

  return {
    score,
    rating,
    factors,
    summary: generatePlayabilitySummary(rating, factors, weather),
    recommendations: generateRecommendations(factors, weather),
  };
}

// ============================================================================
// Weather Display Formatting Helpers
// ============================================================================

/**
 * Convert degrees to cardinal direction
 */
export function degreesToCardinal(degrees: number): CardinalDirection {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions: CardinalDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Get cloud cover description
 */
export function getCloudDescription(cloudCover: number): string {
  if (cloudCover <= 10) return 'Clear';
  if (cloudCover <= 25) return 'Mostly Clear';
  if (cloudCover <= 50) return 'Partly Cloudy';
  if (cloudCover <= 75) return 'Mostly Cloudy';
  if (cloudCover <= 90) return 'Cloudy';
  return 'Overcast';
}

/**
 * Format temperature for display
 */
export function formatTemperature(temp: number): string {
  return `${Math.round(temp)}°F`;
}

/**
 * Format wind for display
 */
export function formatWind(speed: number, direction: number): string {
  const cardinal = degreesToCardinal(direction);
  return `${Math.round(speed)} mph ${cardinal}`;
}

/**
 * Format precipitation probability for display
 */
export function formatPrecipitation(probability: number): string {
  return `${Math.round(probability)}%`;
}

/**
 * Format time from ISO string (e.g., "2:00 PM")
 */
export function formatTime(isoString: string, timezone: string = DEFAULT_TIMEZONE): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

/**
 * Format date short (e.g., "Thu, Jan 9")
 */
export function formatDateShort(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
}

/**
 * Format date long (e.g., "Thursday, January 9, 2025")
 */
export function formatDateLong(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
}

/**
 * Format complete hourly weather data for display
 */
export function formatHourlyWeather(
  weather: HourlyWeather,
  timezone: string = DEFAULT_TIMEZONE
): FormattedWeather {
  return {
    temperature: formatTemperature(weather.temperature),
    feelsLike: `Feels like ${formatTemperature(weather.feelsLike)}`,
    wind: formatWind(weather.windSpeed, weather.windDirection),
    precipitation: formatPrecipitation(weather.precipitationProbability),
    cloudDescription: getCloudDescription(weather.cloudCover),
    dateShort: formatDateShort(weather.date, timezone),
    dateLong: formatDateLong(weather.date, timezone),
    time: formatTime(weather.time, timezone),
  };
}

/**
 * Format complete daily weather data for display
 */
export function formatDailyWeather(
  weather: DailyWeather,
  timezone: string = DEFAULT_TIMEZONE
): FormattedDailyWeather {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = weather.dateObj.getDay();

  return {
    dayShort: dayNames[dayIndex].slice(0, 3),
    dayLong: dayNames[dayIndex],
    date: weather.dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    }),
    temperatureRange: `${formatTemperature(weather.temperatureMax)} / ${formatTemperature(weather.temperatureMin)}`,
    windMax: formatWind(weather.windSpeedMax, weather.windDirection),
    precipitation: formatPrecipitation(weather.precipitationProbability),
    sunrise: formatTime(weather.sunrise, timezone),
    sunset: formatTime(weather.sunset, timezone),
  };
}

// ============================================================================
// API Helpers
// ============================================================================

/**
 * Build URL for Open-Meteo API request
 */
function buildApiUrl(
  coords: Coordinates,
  params: {
    hourly?: string;
    daily?: string;
    forecast_hours?: number;
    forecast_days?: number;
    timezone?: string;
  }
): string {
  const url = new URL(OPEN_METEO_BASE_URL);
  url.searchParams.set('latitude', coords.latitude.toString());
  url.searchParams.set('longitude', coords.longitude.toString());
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');

  if (params.hourly) {
    url.searchParams.set('hourly', params.hourly);
  }
  if (params.daily) {
    url.searchParams.set('daily', params.daily);
  }
  if (params.forecast_hours) {
    url.searchParams.set('forecast_hours', params.forecast_hours.toString());
  }
  if (params.forecast_days) {
    url.searchParams.set('forecast_days', params.forecast_days.toString());
  }
  if (params.timezone) {
    url.searchParams.set('timezone', params.timezone);
  }

  return url.toString();
}

/**
 * Validate coordinates
 */
function validateCoordinates(coords: Coordinates): WeatherServiceError | null {
  if (coords.latitude < -90 || coords.latitude > 90) {
    return {
      code: 'INVALID_COORDINATES',
      message: 'Latitude must be between -90 and 90 degrees',
    };
  }
  if (coords.longitude < -180 || coords.longitude > 180) {
    return {
      code: 'INVALID_COORDINATES',
      message: 'Longitude must be between -180 and 180 degrees',
    };
  }
  return null;
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse API error response
 */
function parseApiError(status: number, body: unknown): WeatherServiceError {
  if (status === 429) {
    return {
      code: 'RATE_LIMITED',
      message: 'Too many requests to weather API. Please try again later.',
      details: body,
    };
  }

  return {
    code: 'API_ERROR',
    message: `Weather API returned status ${status}`,
    details: body,
  };
}

// ============================================================================
// Data Parsing Helpers
// ============================================================================

/**
 * Parse hourly API response into HourlyWeather array
 */
function parseHourlyData(response: OpenMeteoHourlyResponse): HourlyWeather[] {
  const { hourly } = response;
  const results: HourlyWeather[] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    results.push({
      time: hourly.time[i],
      date: new Date(hourly.time[i]),
      temperature: hourly.temperature_2m[i],
      feelsLike: hourly.apparent_temperature[i],
      precipitationProbability: hourly.precipitation_probability[i],
      windSpeed: hourly.wind_speed_10m[i],
      windDirection: hourly.wind_direction_10m[i],
      cloudCover: hourly.cloud_cover[i],
    });
  }

  return results;
}

/**
 * Parse daily API response into DailyWeather array
 */
function parseDailyData(response: OpenMeteoDailyResponse): DailyWeather[] {
  const { daily } = response;
  const results: DailyWeather[] = [];

  for (let i = 0; i < daily.time.length; i++) {
    results.push({
      date: daily.time[i],
      dateObj: new Date(daily.time[i]),
      temperatureMax: daily.temperature_2m_max[i],
      temperatureMin: daily.temperature_2m_min[i],
      feelsLikeMax: daily.apparent_temperature_max[i],
      feelsLikeMin: daily.apparent_temperature_min[i],
      precipitationProbability: daily.precipitation_probability_max[i],
      windSpeedMax: daily.wind_speed_10m_max[i],
      windDirection: daily.wind_direction_10m_dominant[i],
      sunrise: daily.sunrise[i],
      sunset: daily.sunset[i],
    });
  }

  return results;
}

/**
 * Add playability scores to hourly weather data
 */
function addHourlyPlayability(data: HourlyWeather[]): HourlyWeatherWithPlayability[] {
  return data.map(hour => ({
    ...hour,
    playability: calculatePlayabilityScore(
      hour.temperature,
      hour.windSpeed,
      hour.precipitationProbability,
      hour.cloudCover
    ),
  }));
}

/**
 * Add playability scores to daily weather data
 * Uses average of max/min temps and max wind for scoring
 */
function addDailyPlayability(data: DailyWeather[]): DailyWeatherWithPlayability[] {
  return data.map(day => {
    // Use the average temperature for scoring
    const avgTemp = (day.temperatureMax + day.temperatureMin) / 2;
    // Use daytime average (assume midday conditions)
    const estimatedCloudCover = 50; // Default estimate for daily

    return {
      ...day,
      playability: calculatePlayabilityScore(
        avgTemp,
        day.windSpeedMax,
        day.precipitationProbability,
        estimatedCloudCover
      ),
    };
  });
}

// ============================================================================
// Main API Functions
// ============================================================================

/**
 * Get hourly weather forecast
 *
 * @param coords - Location coordinates
 * @param options - Forecast options
 * @returns Hourly weather data with playability scores
 *
 * @example
 * ```typescript
 * const result = await getHourlyForecast(
 *   { latitude: 37.7749, longitude: -122.4194 },
 *   { hours: 24 }
 * );
 * if (result.success) {
 *   console.log(result.data[0].playability.score);
 * }
 * ```
 */
export async function getHourlyForecast(
  coords: Coordinates,
  options: HourlyForecastOptions = {}
): Promise<WeatherResult<HourlyWeatherWithPlayability[]>> {
  // Validate coordinates
  const coordError = validateCoordinates(coords);
  if (coordError) {
    return { success: false, error: coordError };
  }

  const { hours = 48, timezone = DEFAULT_TIMEZONE } = options;

  const url = buildApiUrl(coords, {
    hourly: HOURLY_PARAMS,
    forecast_hours: hours,
    timezone,
  });

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { success: false, error: parseApiError(response.status, body) };
    }

    const data = await response.json() as OpenMeteoHourlyResponse;
    const parsed = parseHourlyData(data);
    const withPlayability = addHourlyPlayability(parsed);

    return { success: true, data: withPlayability };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Request timed out',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown network error',
        details: error,
      },
    };
  }
}

/**
 * Get daily weather forecast
 *
 * @param coords - Location coordinates
 * @param options - Forecast options
 * @returns Daily weather summary with playability scores
 *
 * @example
 * ```typescript
 * const result = await getDailyForecast(
 *   { latitude: 37.7749, longitude: -122.4194 },
 *   { days: 7 }
 * );
 * if (result.success) {
 *   console.log(result.data[0].playability.rating);
 * }
 * ```
 */
export async function getDailyForecast(
  coords: Coordinates,
  options: DailyForecastOptions = {}
): Promise<WeatherResult<DailyWeatherWithPlayability[]>> {
  // Validate coordinates
  const coordError = validateCoordinates(coords);
  if (coordError) {
    return { success: false, error: coordError };
  }

  const { days = 7, timezone = DEFAULT_TIMEZONE } = options;

  const url = buildApiUrl(coords, {
    daily: DAILY_PARAMS,
    forecast_days: days,
    timezone,
  });

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { success: false, error: parseApiError(response.status, body) };
    }

    const data = await response.json() as OpenMeteoDailyResponse;
    const parsed = parseDailyData(data);
    const withPlayability = addDailyPlayability(parsed);

    return { success: true, data: withPlayability };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Request timed out',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown network error',
        details: error,
      },
    };
  }
}

/**
 * Get complete weather forecast (both hourly and daily)
 *
 * @param coords - Location coordinates
 * @param options - Combined forecast options
 * @returns Complete forecast with hourly and daily data
 *
 * @example
 * ```typescript
 * const result = await getFullForecast(
 *   { latitude: 37.7749, longitude: -122.4194 }
 * );
 * if (result.success) {
 *   const { hourly, daily } = result.data;
 *   console.log(`Best day: ${daily[0].playability.rating}`);
 * }
 * ```
 */
export async function getFullForecast(
  coords: Coordinates,
  options: HourlyForecastOptions & DailyForecastOptions = {}
): Promise<WeatherResult<WeatherForecast>> {
  // Validate coordinates
  const coordError = validateCoordinates(coords);
  if (coordError) {
    return { success: false, error: coordError };
  }

  const {
    hours = 48,
    days = 7,
    timezone = DEFAULT_TIMEZONE
  } = options;

  const url = buildApiUrl(coords, {
    hourly: HOURLY_PARAMS,
    daily: DAILY_PARAMS,
    forecast_hours: hours,
    forecast_days: days,
    timezone,
  });

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { success: false, error: parseApiError(response.status, body) };
    }

    const data = await response.json() as OpenMeteoFullResponse;

    const hourlyParsed = parseHourlyData(data);
    const dailyParsed = parseDailyData(data);

    const forecast: WeatherForecast = {
      location: coords,
      timezone: data.timezone,
      hourly: addHourlyPlayability(hourlyParsed),
      daily: addDailyPlayability(dailyParsed),
      fetchedAt: new Date(),
    };

    return { success: true, data: forecast };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Request timed out',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown network error',
        details: error,
      },
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Find the best tee time window based on playability
 * Returns the hour with the highest playability score
 */
export function findBestTeeTime(
  hourlyData: HourlyWeatherWithPlayability[],
  options: {
    startHour?: number; // Earliest hour to consider (default: 6)
    endHour?: number;   // Latest hour to consider (default: 18)
    minScore?: number;  // Minimum acceptable score (default: 50)
  } = {}
): HourlyWeatherWithPlayability | null {
  const { startHour = 6, endHour = 18, minScore = 50 } = options;

  const validHours = hourlyData.filter(hour => {
    const hourOfDay = hour.date.getHours();
    return (
      hourOfDay >= startHour &&
      hourOfDay <= endHour &&
      hour.playability.score >= minScore
    );
  });

  if (validHours.length === 0) {
    return null;
  }

  return validHours.reduce((best, current) =>
    current.playability.score > best.playability.score ? current : best
  );
}

/**
 * Find the best day for golf in the forecast
 */
export function findBestDay(
  dailyData: DailyWeatherWithPlayability[],
  minScore: number = 50
): DailyWeatherWithPlayability | null {
  const validDays = dailyData.filter(day => day.playability.score >= minScore);

  if (validDays.length === 0) {
    return null;
  }

  return validDays.reduce((best, current) =>
    current.playability.score > best.playability.score ? current : best
  );
}

/**
 * Get weather summary for a specific date
 */
export function getWeatherSummaryForDate(
  hourlyData: HourlyWeatherWithPlayability[],
  targetDate: Date
): {
  morning: HourlyWeatherWithPlayability | null;
  afternoon: HourlyWeatherWithPlayability | null;
  avgPlayability: number;
} {
  const dayHours = hourlyData.filter(hour =>
    hour.date.toDateString() === targetDate.toDateString()
  );

  const morning = dayHours.find(h => h.date.getHours() === 9) || null;
  const afternoon = dayHours.find(h => h.date.getHours() === 14) || null;

  const avgPlayability = dayHours.length > 0
    ? Math.round(dayHours.reduce((sum, h) => sum + h.playability.score, 0) / dayHours.length)
    : 0;

  return { morning, afternoon, avgPlayability };
}

// ============================================================================
// Export all types
// ============================================================================

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
};
