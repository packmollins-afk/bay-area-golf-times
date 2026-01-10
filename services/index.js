/**
 * Golf The Bay - Services Index
 * =====================================
 * Central export point for all external API services used by the golf app.
 *
 * This module provides a unified interface for:
 * - Weather forecasts and golf playability scoring
 * - Air quality monitoring and health recommendations
 * - Tide predictions for coastal courses
 * - Daylight/sunrise/sunset calculations
 * - Course imagery and static assets
 * - Calendar integration (Google Calendar, iCal)
 * - Geocoding and location services (LocationIQ)
 *
 * Usage:
 * ------
 * // Import specific services
 * const { weather, airquality, tides } = require('./services');
 *
 * // Or import the entire services object
 * const services = require('./services');
 * const forecast = await services.weather.getHourlyForecast(coords);
 *
 * // Run health checks on all APIs
 * const { healthCheck } = require('./services');
 * const results = await healthCheck();
 * console.log(results);
 *
 * Environment Variables:
 * ----------------------
 * - AIRNOW_API_KEY: EPA AirNow API key for air quality data
 * - LOCATIONIQ_API_KEY: LocationIQ API key for geocoding
 * - STORMGLASS_API_KEY: StormGlass API key for tide data (optional)
 *
 * @module services
 */

// ============================================================================
// Weather Service
// ============================================================================

/**
 * Weather service using Open-Meteo API (free, no API key required)
 * Provides hourly and daily forecasts with golf-specific playability scores.
 *
 * @example
 * const { weather } = require('./services');
 *
 * // Get hourly forecast with playability scores
 * const result = await weather.getHourlyForecast(
 *   { latitude: 37.7749, longitude: -122.4194 },
 *   { hours: 48 }
 * );
 *
 * if (result.success) {
 *   result.data.forEach(hour => {
 *     console.log(`${hour.time}: ${hour.playability.score}/100 - ${hour.playability.rating}`);
 *   });
 * }
 *
 * // Find the best tee time today
 * const bestTime = weather.findBestTeeTime(result.data, { startHour: 7, endHour: 17 });
 */
const weather = {
  // Main API functions
  getHourlyForecast: async (coords, options = {}) => {
    // Dynamic import to support both ESM and CommonJS
    const mod = await import('./weather.js');
    return mod.getHourlyForecast(coords, options);
  },
  getDailyForecast: async (coords, options = {}) => {
    const mod = await import('./weather.js');
    return mod.getDailyForecast(coords, options);
  },
  getFullForecast: async (coords, options = {}) => {
    const mod = await import('./weather.js');
    return mod.getFullForecast(coords, options);
  },

  // Playability calculation
  calculatePlayabilityScore: (temp, wind, precip, clouds) => {
    // Inline calculation for synchronous access
    const tempScore = calculateTemperatureScore(temp);
    const windScore = calculateWindScore(wind);
    const precipScore = calculatePrecipitationScore(precip);
    const cloudScore = calculateCloudCoverScore(clouds);

    const score = Math.round(
      tempScore * 0.30 + windScore * 0.35 + precipScore * 0.25 + cloudScore * 0.10
    );

    return {
      score,
      rating: getPlayabilityRating(score),
      factors: { temperature: tempScore, wind: windScore, precipitation: precipScore, cloudCover: cloudScore },
    };
  },

  // Utility functions
  findBestTeeTime: (hourlyData, options = {}) => {
    const { startHour = 6, endHour = 18, minScore = 50 } = options;
    const validHours = hourlyData.filter(hour => {
      const hourOfDay = new Date(hour.time).getHours();
      return hourOfDay >= startHour && hourOfDay <= endHour && hour.playability.score >= minScore;
    });
    if (validHours.length === 0) return null;
    return validHours.reduce((best, current) =>
      current.playability.score > best.playability.score ? current : best
    );
  },

  findBestDay: (dailyData, minScore = 50) => {
    const validDays = dailyData.filter(day => day.playability.score >= minScore);
    if (validDays.length === 0) return null;
    return validDays.reduce((best, current) =>
      current.playability.score > best.playability.score ? current : best
    );
  },

  // Formatting helpers
  formatTemperature: (temp) => `${Math.round(temp)}F`,
  formatWind: (speed, direction) => {
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((direction % 360) + 360) % 360 / 45) % 8;
    return `${Math.round(speed)} mph ${cardinals[index]}`;
  },
  formatPrecipitation: (prob) => `${Math.round(prob)}%`,
};

// ============================================================================
// Air Quality Service
// ============================================================================

/**
 * Air quality service using EPA AirNow API
 * Provides AQI data with golf-specific health recommendations.
 *
 * Requires: AIRNOW_API_KEY environment variable
 *
 * @example
 * const { airquality } = require('./services');
 *
 * const service = airquality.createService(process.env.AIRNOW_API_KEY);
 * const result = await service.getCurrentAQI(37.7749, -122.4194);
 *
 * if (result.success) {
 *   console.log(`AQI: ${result.data.aqi} - ${result.data.category.name}`);
 *   console.log(`Golf recommendation: ${result.data.golfRecommendation.summary}`);
 *
 *   if (result.data.golfRecommendation.showWarning) {
 *     console.log('Warning: Air quality may affect your game');
 *   }
 * }
 */
const airquality = {
  // Service factory
  createService: (apiKey, options = {}) => {
    // Inline implementation for immediate use
    return new AirQualityServiceWrapper(apiKey, options);
  },

  // Helper functions (synchronous)
  getAQICategory: (aqi) => {
    if (aqi <= 50) return { level: 'good', name: 'Good', color: '#00E400' };
    if (aqi <= 100) return { level: 'moderate', name: 'Moderate', color: '#FFFF00' };
    if (aqi <= 150) return { level: 'unhealthy_sensitive', name: 'Unhealthy for Sensitive Groups', color: '#FF7E00' };
    if (aqi <= 200) return { level: 'unhealthy', name: 'Unhealthy', color: '#FF0000' };
    if (aqi <= 300) return { level: 'very_unhealthy', name: 'Very Unhealthy', color: '#8F3F97' };
    return { level: 'hazardous', name: 'Hazardous', color: '#7E0023' };
  },

  getGolfRecommendation: (aqi) => {
    if (aqi <= 25) return { level: 'great', summary: 'Great conditions for golf!', showWarning: false };
    if (aqi <= 50) return { level: 'good', summary: 'Good conditions for golf', showWarning: false };
    if (aqi <= 100) return { level: 'caution', summary: 'Fair conditions - sensitive groups take precautions', showWarning: true };
    if (aqi <= 150) return { level: 'warning', summary: 'Poor conditions - consider rescheduling', showWarning: true };
    return { level: 'danger', summary: 'Unhealthy conditions - recommend rescheduling', showWarning: true };
  },

  shouldWarnUser: (aqi) => aqi > 50,
  shouldSuggestReschedule: (aqi) => aqi > 100,

  // Thresholds for custom implementations
  THRESHOLDS: {
    greatMax: 25,
    goodMax: 50,
    cautionMax: 100,
    warningMax: 150,
  },
};

// ============================================================================
// Tides Service (Placeholder)
// ============================================================================

/**
 * Tides service for coastal course conditions
 * Important for courses like Half Moon Bay, Pebble Beach, etc.
 *
 * Planned integrations:
 * - NOAA Tides and Currents API (free)
 * - StormGlass API (requires STORMGLASS_API_KEY)
 *
 * @example
 * const { tides } = require('./services');
 *
 * // Get tide predictions for a coastal course
 * const result = await tides.getTidePredictions(
 *   { latitude: 37.4636, longitude: -122.4286 }, // Half Moon Bay
 *   { days: 3 }
 * );
 *
 * // Check if low tide coincides with tee time
 * const isLowTide = tides.isLowTideWindow(result.data, teeTime);
 */
const tides = {
  getTidePredictions: async (coords, options = {}) => {
    // TODO: Implement NOAA Tides and Currents API integration
    console.warn('[tides] Service not yet implemented');
    return {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Tides service is not yet implemented' },
    };
  },

  getCurrentTide: async (coords) => {
    console.warn('[tides] Service not yet implemented');
    return {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Tides service is not yet implemented' },
    };
  },

  isLowTideWindow: (tideData, targetTime) => {
    console.warn('[tides] Service not yet implemented');
    return false;
  },

  isHighTideWindow: (tideData, targetTime) => {
    console.warn('[tides] Service not yet implemented');
    return false;
  },

  // Tidal impact on golf (coastal course considerations)
  getCoastalCourseImpact: async (coords, teeTime) => {
    console.warn('[tides] Service not yet implemented');
    return null;
  },
};

// ============================================================================
// Daylight Service (Placeholder)
// ============================================================================

/**
 * Daylight/sunrise/sunset calculations for tee time planning
 * Helps golfers book tee times during optimal lighting conditions.
 *
 * Uses astronomical calculations (no API key required)
 *
 * @example
 * const { daylight } = require('./services');
 *
 * // Get sunrise/sunset for a specific date and location
 * const result = daylight.getSunTimes(
 *   { latitude: 37.7749, longitude: -122.4194 },
 *   new Date('2024-06-15')
 * );
 *
 * console.log(`Sunrise: ${result.sunrise}`);
 * console.log(`Sunset: ${result.sunset}`);
 * console.log(`Golden hour: ${result.goldenHour}`);
 *
 * // Calculate if there's enough daylight for a round
 * const canFinish = daylight.hasEnoughDaylight(teeTime, 4.5); // 4.5 hour round
 */
const daylight = {
  getSunTimes: (coords, date = new Date()) => {
    // Basic solar calculation (can be replaced with SunCalc library)
    const { latitude, longitude } = coords;
    const dayOfYear = getDayOfYear(date);
    const decl = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
    const ha = Math.acos(-Math.tan(latitude * Math.PI / 180) * Math.tan(decl * Math.PI / 180)) * 180 / Math.PI;
    const sunrise = 12 - ha / 15 - longitude / 15;
    const sunset = 12 + ha / 15 - longitude / 15;

    return {
      sunrise: hoursToTime(sunrise + getTimezoneOffset(coords)),
      sunset: hoursToTime(sunset + getTimezoneOffset(coords)),
      daylight: (sunset - sunrise).toFixed(1) + ' hours',
      goldenHour: hoursToTime(sunset - 1 + getTimezoneOffset(coords)),
    };
  },

  hasEnoughDaylight: (teeTime, roundDuration = 4.5, coords = { latitude: 37.7, longitude: -122.4 }) => {
    const times = daylight.getSunTimes(coords, teeTime);
    const teeHour = teeTime.getHours() + teeTime.getMinutes() / 60;
    const sunsetHour = parseTimeToHours(times.sunset);
    return (sunsetHour - teeHour) >= roundDuration;
  },

  getOptimalTeeTimeWindow: (coords, date = new Date()) => {
    const times = daylight.getSunTimes(coords, date);
    const sunriseHour = parseTimeToHours(times.sunrise);
    const sunsetHour = parseTimeToHours(times.sunset);

    return {
      earliest: hoursToTime(sunriseHour + 0.5), // 30 min after sunrise
      latest: hoursToTime(sunsetHour - 4.5),     // 4.5 hours before sunset
      recommended: hoursToTime(sunriseHour + 1.5), // 1.5 hours after sunrise
    };
  },
};

// ============================================================================
// Images Service (Placeholder)
// ============================================================================

/**
 * Course imagery and static assets service
 * Provides course photos, hole layouts, and maps.
 *
 * @example
 * const { images } = require('./services');
 *
 * // Get course imagery
 * const photos = await images.getCoursePhotos('half-moon-bay-ocean');
 * const holeLayouts = await images.getHoleLayouts('half-moon-bay-ocean');
 *
 * // Generate a course map thumbnail
 * const thumbnail = await images.generateCourseThumbnail(coords);
 */
const images = {
  getCoursePhotos: async (courseSlug) => {
    // TODO: Implement course photo retrieval (CDN, S3, etc.)
    console.warn('[images] Service not yet implemented');
    return {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Images service is not yet implemented' },
    };
  },

  getHoleLayouts: async (courseSlug) => {
    console.warn('[images] Service not yet implemented');
    return {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Images service is not yet implemented' },
    };
  },

  getCourseMap: async (coords, options = {}) => {
    console.warn('[images] Service not yet implemented');
    return {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Images service is not yet implemented' },
    };
  },

  generateCourseThumbnail: async (coords) => {
    console.warn('[images] Service not yet implemented');
    return null;
  },
};

// ============================================================================
// Calendar Service (Placeholder)
// ============================================================================

/**
 * Calendar integration service
 * Supports Google Calendar, iCal, and Outlook integration.
 *
 * @example
 * const { calendar } = require('./services');
 *
 * // Generate an iCal event for a tee time
 * const icalEvent = calendar.createTeeTimeEvent({
 *   course: 'Half Moon Bay - Ocean Course',
 *   date: new Date('2024-06-15T08:30:00'),
 *   players: 4,
 *   confirmationNumber: 'ABC123',
 * });
 *
 * // Get iCal file content
 * const icalContent = calendar.toICalFormat(icalEvent);
 *
 * // Generate Google Calendar link
 * const gcalLink = calendar.toGoogleCalendarLink(icalEvent);
 */
const calendar = {
  createTeeTimeEvent: (booking) => {
    const { course, date, players = 1, confirmationNumber, notes } = booking;
    const endDate = new Date(date.getTime() + 4.5 * 60 * 60 * 1000); // 4.5 hour duration

    return {
      title: `Golf: ${course}`,
      start: date,
      end: endDate,
      location: course,
      description: [
        `Tee time at ${course}`,
        `Players: ${players}`,
        confirmationNumber ? `Confirmation: ${confirmationNumber}` : '',
        notes || '',
      ].filter(Boolean).join('\n'),
      confirmationNumber,
    };
  },

  toICalFormat: (event) => {
    const formatDate = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Golf The Bay//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(event.start)}`,
      `DTEND:${formatDate(event.end)}`,
      `SUMMARY:${event.title}`,
      `LOCATION:${event.location}`,
      `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
      `UID:${Date.now()}@golfthebay.com`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  },

  toGoogleCalendarLink: (event) => {
    const formatDate = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${formatDate(event.start)}/${formatDate(event.end)}`,
      location: event.location,
      details: event.description,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  },

  toOutlookLink: (event) => {
    const params = new URLSearchParams({
      subject: event.title,
      startdt: event.start.toISOString(),
      enddt: event.end.toISOString(),
      location: event.location,
      body: event.description,
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  },
};

// ============================================================================
// LocationIQ Service (Placeholder)
// ============================================================================

/**
 * Geocoding and location services using LocationIQ
 * Provides address lookup, reverse geocoding, and course location validation.
 *
 * Requires: LOCATIONIQ_API_KEY environment variable
 *
 * @example
 * const { locationiq } = require('./services');
 *
 * // Initialize with API key
 * const geo = locationiq.createService(process.env.LOCATIONIQ_API_KEY);
 *
 * // Forward geocoding (address to coordinates)
 * const result = await geo.geocode('Half Moon Bay Golf Links, Half Moon Bay, CA');
 * console.log(result.data.latitude, result.data.longitude);
 *
 * // Reverse geocoding (coordinates to address)
 * const address = await geo.reverseGeocode(37.4636, -122.4286);
 *
 * // Search for nearby golf courses
 * const courses = await geo.searchNearby(coords, { type: 'golf_course', radius: 10 });
 */
const locationiq = {
  createService: (apiKey, options = {}) => {
    return new LocationIQServiceWrapper(apiKey, options);
  },

  // Convenience methods that require manual API key
  geocode: async (address, apiKey) => {
    if (!apiKey) {
      return {
        success: false,
        error: { code: 'MISSING_API_KEY', message: 'LocationIQ API key is required' },
      };
    }
    const service = new LocationIQServiceWrapper(apiKey);
    return service.geocode(address);
  },

  reverseGeocode: async (latitude, longitude, apiKey) => {
    if (!apiKey) {
      return {
        success: false,
        error: { code: 'MISSING_API_KEY', message: 'LocationIQ API key is required' },
      };
    }
    const service = new LocationIQServiceWrapper(apiKey);
    return service.reverseGeocode(latitude, longitude);
  },
};

// ============================================================================
// Health Check Function
// ============================================================================

/**
 * Run health checks on all API services
 * Tests connectivity and API key validity for each service.
 *
 * @param {Object} config - Configuration with API keys
 * @param {string} config.airnowApiKey - EPA AirNow API key
 * @param {string} config.locationiqApiKey - LocationIQ API key
 * @param {string} config.stormglassApiKey - StormGlass API key (optional)
 * @param {Object} coords - Test coordinates (defaults to San Francisco)
 * @returns {Promise<Object>} Health check results for each service
 *
 * @example
 * const { healthCheck } = require('./services');
 *
 * const results = await healthCheck({
 *   airnowApiKey: process.env.AIRNOW_API_KEY,
 *   locationiqApiKey: process.env.LOCATIONIQ_API_KEY,
 * });
 *
 * console.log(results);
 * // {
 * //   weather: { status: 'healthy', latency: 234 },
 * //   airquality: { status: 'healthy', latency: 156 },
 * //   tides: { status: 'not_implemented' },
 * //   daylight: { status: 'healthy', latency: 1 },
 * //   images: { status: 'not_implemented' },
 * //   calendar: { status: 'healthy', latency: 0 },
 * //   locationiq: { status: 'healthy', latency: 89 },
 * // }
 */
async function healthCheck(config = {}, coords = { latitude: 37.7749, longitude: -122.4194 }) {
  const results = {};
  const startTime = (name) => {
    results[name] = { startedAt: Date.now() };
  };
  const endTime = (name, status, details = {}) => {
    results[name] = {
      status,
      latency: Date.now() - results[name].startedAt,
      ...details,
    };
  };

  // Weather Service (Open-Meteo - no API key required)
  startTime('weather');
  try {
    const weatherResult = await weather.getHourlyForecast(coords, { hours: 1 });
    if (weatherResult.success) {
      endTime('weather', 'healthy', { provider: 'Open-Meteo' });
    } else {
      endTime('weather', 'unhealthy', { error: weatherResult.error?.message });
    }
  } catch (err) {
    endTime('weather', 'error', { error: err.message });
  }

  // Air Quality Service (requires API key)
  startTime('airquality');
  if (config.airnowApiKey) {
    try {
      const aqService = airquality.createService(config.airnowApiKey);
      const aqResult = await aqService.getCurrentAQI(coords.latitude, coords.longitude);
      if (aqResult.success) {
        endTime('airquality', 'healthy', { provider: 'EPA AirNow', aqi: aqResult.data?.aqi });
      } else {
        endTime('airquality', 'unhealthy', { error: aqResult.error?.message });
      }
    } catch (err) {
      endTime('airquality', 'error', { error: err.message });
    }
  } else {
    endTime('airquality', 'skipped', { reason: 'No API key provided (AIRNOW_API_KEY)' });
  }

  // Tides Service (not implemented)
  results.tides = { status: 'not_implemented', message: 'Service pending implementation' };

  // Daylight Service (local calculation - no API required)
  startTime('daylight');
  try {
    const sunTimes = daylight.getSunTimes(coords);
    endTime('daylight', 'healthy', {
      provider: 'Local calculation',
      sunrise: sunTimes.sunrise,
      sunset: sunTimes.sunset,
    });
  } catch (err) {
    endTime('daylight', 'error', { error: err.message });
  }

  // Images Service (not implemented)
  results.images = { status: 'not_implemented', message: 'Service pending implementation' };

  // Calendar Service (local - no API required)
  startTime('calendar');
  try {
    const testEvent = calendar.createTeeTimeEvent({
      course: 'Test Course',
      date: new Date(),
      players: 1,
    });
    const ical = calendar.toICalFormat(testEvent);
    const gcal = calendar.toGoogleCalendarLink(testEvent);
    endTime('calendar', 'healthy', {
      provider: 'Local generation',
      formats: ['iCal', 'Google Calendar', 'Outlook'],
    });
  } catch (err) {
    endTime('calendar', 'error', { error: err.message });
  }

  // LocationIQ Service (requires API key)
  startTime('locationiq');
  if (config.locationiqApiKey) {
    try {
      const geoService = locationiq.createService(config.locationiqApiKey);
      const geoResult = await geoService.reverseGeocode(coords.latitude, coords.longitude);
      if (geoResult.success) {
        endTime('locationiq', 'healthy', { provider: 'LocationIQ' });
      } else {
        endTime('locationiq', 'unhealthy', { error: geoResult.error?.message });
      }
    } catch (err) {
      endTime('locationiq', 'error', { error: err.message });
    }
  } else {
    endTime('locationiq', 'skipped', { reason: 'No API key provided (LOCATIONIQ_API_KEY)' });
  }

  return results;
}

// ============================================================================
// Internal Helper Classes
// ============================================================================

/**
 * Wrapper for AirQualityService to work in CommonJS
 */
class AirQualityServiceWrapper {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://www.airnowapi.org';
    this.timeout = options.timeout || 10000;
  }

  async getCurrentAQI(latitude, longitude, options = {}) {
    const url = new URL(`${this.baseUrl}/aq/observation/latLong/current/`);
    url.searchParams.set('format', 'application/json');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('distance', (options.distance || 25).toString());
    url.searchParams.set('API_KEY', this.apiKey);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: { code: 'API_ERROR', message: `HTTP ${response.status}` },
        };
      }

      const data = await response.json();
      if (!data || !Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          error: { code: 'NO_DATA', message: 'No data available for location' },
        };
      }

      const primaryObs = data.sort((a, b) => b.AQI - a.AQI)[0];
      return {
        success: true,
        data: {
          aqi: primaryObs.AQI,
          category: airquality.getAQICategory(primaryObs.AQI),
          golfRecommendation: airquality.getGolfRecommendation(primaryObs.AQI),
          primaryPollutant: primaryObs.ParameterName,
          reportingArea: primaryObs.ReportingArea,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: err.message },
      };
    }
  }
}

/**
 * Wrapper for LocationIQ service
 */
class LocationIQServiceWrapper {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://us1.locationiq.com/v1';
    this.timeout = options.timeout || 10000;
  }

  async geocode(address) {
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        return {
          success: false,
          error: { code: 'API_ERROR', message: `HTTP ${response.status}` },
        };
      }

      const data = await response.json();
      if (!data || data.length === 0) {
        return {
          success: false,
          error: { code: 'NO_RESULTS', message: 'No results found' },
        };
      }

      return {
        success: true,
        data: {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          displayName: data[0].display_name,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: err.message },
      };
    }
  }

  async reverseGeocode(latitude, longitude) {
    const url = new URL(`${this.baseUrl}/reverse`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('lat', latitude.toString());
    url.searchParams.set('lon', longitude.toString());
    url.searchParams.set('format', 'json');

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        return {
          success: false,
          error: { code: 'API_ERROR', message: `HTTP ${response.status}` },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          displayName: data.display_name,
          address: data.address,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: err.message },
      };
    }
  }
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

function calculateTemperatureScore(temp) {
  if (temp >= 65 && temp <= 80) return 100;
  if (temp < 65) {
    if (temp >= 50) return 80 - (65 - temp) * 2;
    if (temp >= 40) return 60 - (50 - temp) * 3;
    return Math.max(0, 30 - (40 - temp) * 2);
  }
  if (temp > 80) {
    if (temp <= 90) return 80 - (temp - 80) * 2;
    if (temp <= 95) return 60 - (temp - 90) * 4;
    return Math.max(0, 40 - (temp - 95) * 4);
  }
  return 50;
}

function calculateWindScore(windSpeed) {
  if (windSpeed <= 5) return 100;
  if (windSpeed <= 10) return 90 - (windSpeed - 5) * 2;
  if (windSpeed <= 15) return 80 - (windSpeed - 10) * 4;
  if (windSpeed <= 20) return 60 - (windSpeed - 15) * 4;
  if (windSpeed <= 25) return 40 - (windSpeed - 20) * 4;
  return Math.max(0, 20 - (windSpeed - 25) * 2);
}

function calculatePrecipitationScore(precipProb) {
  if (precipProb === 0) return 100;
  if (precipProb <= 10) return 95 - precipProb * 0.5;
  if (precipProb <= 20) return 90 - (precipProb - 10);
  if (precipProb <= 30) return 80 - (precipProb - 20) * 2;
  if (precipProb <= 50) return 60 - (precipProb - 30) * 1.5;
  return Math.max(0, 30 - (precipProb - 50) * 0.75);
}

function calculateCloudCoverScore(cloudCover) {
  if (cloudCover >= 20 && cloudCover <= 40) return 100;
  if (cloudCover < 20) return 90 + cloudCover * 0.5;
  if (cloudCover <= 60) return 90 - (cloudCover - 40) * 0.5;
  if (cloudCover <= 80) return 80 - (cloudCover - 60);
  return Math.max(50, 60 - (cloudCover - 80) * 0.5);
}

function getPlayabilityRating(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'unplayable';
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTimezoneOffset(coords) {
  // Simple timezone estimation based on longitude (PST for Bay Area)
  // For more accuracy, use a timezone library
  return -8; // Pacific Standard Time offset
}

function hoursToTime(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function parseTimeToHours(timeString) {
  const match = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 12;
  let hour = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour + minutes / 60;
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = {
  // Individual services
  weather,
  airquality,
  tides,
  daylight,
  images,
  calendar,
  locationiq,

  // Health check utility
  healthCheck,

  // Service wrapper classes (for advanced usage)
  AirQualityServiceWrapper,
  LocationIQServiceWrapper,
};
