/**
 * SunriseSunset.io Daylight Service for Bay Area Golf Times
 *
 * Provides comprehensive daylight information for golf courses including:
 * - Sunrise, sunset, and twilight times
 * - Golden hour calculations for scenic rounds
 * - Playable window recommendations
 * - Formatted daylight data for display
 *
 * No API key required - SunriseSunset.io is free to use.
 * Browser-compatible with built-in caching.
 *
 * @module services/daylight
 */

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG = {
  baseUrl: 'https://api.sunrisesunset.io/json',
  timeoutMs: 10000,
  retryAttempts: 3,
  roundDurationMinutes: 240, // 4 hours for 18 holes
  duskBufferMinutes: 30,
  cacheTTLMinutes: 60, // Cache results for 1 hour
};

/** Golden hour typically lasts about 1 hour before sunset / after sunrise */
const GOLDEN_HOUR_DURATION_MINUTES = 60;

/** Minimum daylight hours needed for a comfortable 18-hole round */
const MIN_DAYLIGHT_FOR_FULL_ROUND_HOURS = 5;

// ============================================================================
// Cache Implementation
// ============================================================================

/**
 * Simple in-memory cache with TTL support
 * Falls back gracefully in environments without Map support
 */
const cache = {
  _store: new Map(),

  /**
   * Generate a cache key from location and date
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} dateStr - Date string in YYYY-MM-DD format
   * @returns {string} Cache key
   */
  _makeKey(lat, lng, dateStr) {
    return `${lat.toFixed(4)},${lng.toFixed(4)},${dateStr}`;
  },

  /**
   * Get cached data if still valid
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} dateStr - Date string
   * @param {number} ttlMinutes - Time to live in minutes
   * @returns {object|null} Cached data or null if expired/missing
   */
  get(lat, lng, dateStr, ttlMinutes) {
    const key = this._makeKey(lat, lng, dateStr);
    const entry = this._store.get(key);

    if (!entry) return null;

    const now = Date.now();
    const age = (now - entry.timestamp) / (1000 * 60);

    if (age > ttlMinutes) {
      this._store.delete(key);
      return null;
    }

    return entry.data;
  },

  /**
   * Store data in cache
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} dateStr - Date string
   * @param {object} data - Data to cache
   */
  set(lat, lng, dateStr, data) {
    const key = this._makeKey(lat, lng, dateStr);
    this._store.set(key, {
      data,
      timestamp: Date.now(),
    });
  },

  /**
   * Clear all cached entries
   */
  clear() {
    this._store.clear();
  },

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  stats() {
    return {
      size: this._store.size,
      keys: Array.from(this._store.keys()),
    };
  }
};

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error class for daylight service errors
 */
class DaylightServiceError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Error} [cause] - Original error that caused this
   */
  constructor(message, code, cause) {
    super(message);
    this.name = 'DaylightServiceError';
    this.code = code;
    this.cause = cause;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates latitude and longitude coordinates
 * @param {number} latitude - Latitude value
 * @param {number} longitude - Longitude value
 * @throws {DaylightServiceError} If coordinates are invalid
 */
function validateCoordinates(latitude, longitude) {
  if (latitude < -90 || latitude > 90) {
    throw new DaylightServiceError(
      `Invalid latitude: ${latitude}. Must be between -90 and 90.`,
      'INVALID_COORDINATES'
    );
  }

  if (longitude < -180 || longitude > 180) {
    throw new DaylightServiceError(
      `Invalid longitude: ${longitude}. Must be between -180 and 180.`,
      'INVALID_COORDINATES'
    );
  }
}

/**
 * Formats a Date object to YYYY-MM-DD string for API
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateForApi(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses time string in "HH:MM:SS AM/PM" format to Date object
 * @param {string} timeStr - Time string from API
 * @param {Date} baseDate - Base date for the time
 * @returns {Date} Parsed Date object
 */
function parseTimeString(timeStr, baseDate) {
  // Handle edge cases like "None" for polar regions
  if (!timeStr || timeStr.toLowerCase() === 'none') {
    throw new Error(`Invalid time value: ${timeStr}`);
  }

  const match = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    throw new Error(`Unable to parse time string: ${timeStr}`);
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const period = match[4].toUpperCase();

  // Convert to 24-hour format
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  const result = new Date(baseDate);
  result.setHours(hours, minutes, seconds, 0);

  return result;
}

/**
 * Parses day length string in "HH:MM:SS" format to minutes
 * @param {string} dayLengthStr - Day length string from API
 * @returns {number} Day length in minutes
 */
function parseDayLength(dayLengthStr) {
  const match = dayLengthStr.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(`Unable to parse day length: ${dayLengthStr}`);
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);

  return hours * 60 + minutes + Math.round(seconds / 60);
}

/**
 * Sleep utility for retry backoff
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculates morning and evening golden hour periods
 * @param {object} data - Daylight data
 * @returns {object} Golden hour periods
 */
function calculateGoldenHourPeriods(data) {
  // Morning golden hour: from sunrise to ~1 hour after
  const morningStart = new Date(data.sunrise);
  const morningEnd = new Date(morningStart);
  morningEnd.setMinutes(morningEnd.getMinutes() + GOLDEN_HOUR_DURATION_MINUTES);

  // Evening golden hour: the API provides golden_hour as the START of evening golden hour
  const eveningStart = new Date(data.goldenHourStart);
  const eveningEnd = new Date(data.sunset);

  return {
    morning: {
      start: morningStart,
      end: morningEnd,
      durationMinutes: GOLDEN_HOUR_DURATION_MINUTES,
    },
    evening: {
      start: eveningStart,
      end: eveningEnd,
      durationMinutes: Math.round(
        (eveningEnd.getTime() - eveningStart.getTime()) / (1000 * 60)
      ),
    },
  };
}

/**
 * Determines the lighting condition for a given time
 * @param {Date} time - Time to check
 * @param {object} data - Daylight data
 * @returns {string} Lighting condition
 */
function getLightingCondition(time, data) {
  const timeMs = time.getTime();
  const goldenHours = calculateGoldenHourPeriods(data);

  // Before first light or after last light
  if (timeMs < data.firstLight.getTime() || timeMs > data.lastLight.getTime()) {
    return 'too_dark';
  }

  // Between first light and dawn, or between dusk and last light
  if (
    (timeMs >= data.firstLight.getTime() && timeMs < data.dawn.getTime()) ||
    (timeMs > data.dusk.getTime() && timeMs <= data.lastLight.getTime())
  ) {
    return 'low_light';
  }

  // Morning golden hour
  if (
    timeMs >= goldenHours.morning.start.getTime() &&
    timeMs <= goldenHours.morning.end.getTime()
  ) {
    return 'golden_hour_morning';
  }

  // Evening golden hour
  if (
    timeMs >= goldenHours.evening.start.getTime() &&
    timeMs <= goldenHours.evening.end.getTime()
  ) {
    return 'golden_hour_evening';
  }

  return 'bright_daylight';
}

// ============================================================================
// Core API Functions
// ============================================================================

/**
 * Fetches daylight data from SunriseSunset.io API with caching
 *
 * @param {object} location - Location coordinates
 * @param {number} location.latitude - Latitude
 * @param {number} location.longitude - Longitude
 * @param {Date} [date=new Date()] - Date to fetch data for
 * @param {object} [config={}] - Configuration options
 * @returns {Promise<object>} Parsed daylight data with Date objects
 * @throws {DaylightServiceError} On network or parsing errors
 *
 * @example
 * const data = await getDaylightData({ latitude: 37.7749, longitude: -122.4194 });
 * console.log(data.sunrise); // Date object for sunrise
 */
async function getDaylightData(location, date = new Date(), config = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { latitude, longitude } = location;

  validateCoordinates(latitude, longitude);

  const dateString = formatDateForApi(date);

  // Check cache first
  const cached = cache.get(latitude, longitude, dateString, mergedConfig.cacheTTLMinutes);
  if (cached) {
    return cached;
  }

  // Build API URL
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lng: longitude.toString(),
    date: dateString,
  });
  const url = `${mergedConfig.baseUrl}?${params.toString()}`;

  // Fetch with retry logic
  let lastError;
  for (let attempt = 1; attempt <= mergedConfig.retryAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), mergedConfig.timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new DaylightServiceError(
          `API returned status ${response.status}: ${response.statusText}`,
          'API_ERROR'
        );
      }

      const apiResponse = await response.json();

      if (apiResponse.status !== 'OK') {
        throw new DaylightServiceError(
          `API returned error status: ${apiResponse.status}`,
          apiResponse.status === 'INVALID_REQUEST' ? 'INVALID_COORDINATES' : 'API_ERROR'
        );
      }

      // Parse API response
      const results = apiResponse.results;
      const data = {
        date: date,
        sunrise: parseTimeString(results.sunrise, date),
        sunset: parseTimeString(results.sunset, date),
        firstLight: parseTimeString(results.first_light, date),
        lastLight: parseTimeString(results.last_light, date),
        dawn: parseTimeString(results.dawn, date),
        dusk: parseTimeString(results.dusk, date),
        solarNoon: parseTimeString(results.solar_noon, date),
        goldenHourStart: parseTimeString(results.golden_hour, date),
        dayLengthMinutes: parseDayLength(results.day_length),
        timezone: results.timezone,
        utcOffsetMinutes: results.utc_offset,
      };

      // Cache the result
      cache.set(latitude, longitude, dateString, data);

      return data;
    } catch (error) {
      lastError = error;

      if (error instanceof DaylightServiceError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new DaylightServiceError(
          `Request timed out after ${mergedConfig.timeoutMs}ms`,
          'TIMEOUT',
          error
        );
      }

      // Retry with exponential backoff
      if (attempt < mergedConfig.retryAttempts) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        await sleep(backoffMs);
      }
    }
  }

  throw new DaylightServiceError(
    `Network error after ${mergedConfig.retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`,
    'NETWORK_ERROR',
    lastError
  );
}

/**
 * Checks if a specific time falls within golden hour
 *
 * @param {Date} time - Time to check
 * @param {object} data - Daylight data from getDaylightData
 * @returns {object} Result with isGoldenHour boolean and period
 *
 * @example
 * const data = await getDaylightData({ latitude: 37.7749, longitude: -122.4194 });
 * const result = isGoldenHour(new Date(), data);
 * console.log(result.isGoldenHour); // true or false
 * console.log(result.period); // 'morning', 'evening', or null
 */
function isGoldenHour(time, data) {
  const goldenHours = calculateGoldenHourPeriods(data);
  const timeMs = time.getTime();

  // Check morning golden hour
  if (
    timeMs >= goldenHours.morning.start.getTime() &&
    timeMs <= goldenHours.morning.end.getTime()
  ) {
    return { isGoldenHour: true, period: 'morning' };
  }

  // Check evening golden hour
  if (
    timeMs >= goldenHours.evening.start.getTime() &&
    timeMs <= goldenHours.evening.end.getTime()
  ) {
    return { isGoldenHour: true, period: 'evening' };
  }

  return { isGoldenHour: false, period: null };
}

/**
 * Gets the playable golf window for a given day
 *
 * @param {object} data - Daylight data from getDaylightData
 * @param {object} [config={}] - Configuration options
 * @param {number} [config.roundDurationMinutes=240] - Expected round duration
 * @param {number} [config.duskBufferMinutes=30] - Buffer before dusk
 * @returns {object} Playable window information
 *
 * @example
 * const data = await getDaylightData({ latitude: 37.7749, longitude: -122.4194 });
 * const window = getPlayableWindow(data);
 * console.log(window.earliestTeeTime); // Date object
 * console.log(window.latestTeeTime); // Date object
 * console.log(window.playableHours); // Number of hours
 */
function getPlayableWindow(data, config = {}) {
  const roundDuration = config.roundDurationMinutes ?? DEFAULT_CONFIG.roundDurationMinutes;
  const duskBuffer = config.duskBufferMinutes ?? DEFAULT_CONFIG.duskBufferMinutes;

  // Earliest tee time is at civil dawn (enough light to play)
  const earliestTeeTime = new Date(data.dawn);

  // Latest tee time needs to allow completion before dusk with buffer
  const latestTeeTime = new Date(data.dusk);
  latestTeeTime.setMinutes(latestTeeTime.getMinutes() - roundDuration - duskBuffer);

  // Calculate playable hours
  const playableMs = latestTeeTime.getTime() - earliestTeeTime.getTime();
  const playableHours = Math.max(0, playableMs / (1000 * 60 * 60));

  // Check if there's enough daylight for a full round
  const canPlayFullRound = data.dayLengthMinutes >= MIN_DAYLIGHT_FOR_FULL_ROUND_HOURS * 60;

  return {
    earliestTeeTime,
    latestTeeTime,
    playableHours: Math.round(playableHours * 10) / 10,
    canPlayFullRound,
  };
}

/**
 * Formats daylight data for display
 *
 * @param {object} data - Daylight data from getDaylightData
 * @param {boolean} [use24Hour=false] - Use 24-hour time format
 * @returns {object} Formatted daylight information
 *
 * @example
 * const data = await getDaylightData({ latitude: 37.7749, longitude: -122.4194 });
 * const formatted = formatDaylight(data);
 * console.log(formatted.sunrise); // "6:45 AM"
 * console.log(formatted.dayLength); // "10h 30m"
 */
function formatDaylight(data, use24Hour = false) {
  /**
   * Format a Date to time string
   * @param {Date} date - Date to format
   * @returns {string} Formatted time
   */
  const formatTime = (date) => {
    if (use24Hour) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /**
   * Format minutes to duration string
   * @param {number} minutes - Minutes
   * @returns {string} Formatted duration
   */
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const playable = getPlayableWindow(data);

  return {
    date: data.date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    sunrise: formatTime(data.sunrise),
    sunset: formatTime(data.sunset),
    firstLight: formatTime(data.firstLight),
    lastLight: formatTime(data.lastLight),
    dawn: formatTime(data.dawn),
    dusk: formatTime(data.dusk),
    solarNoon: formatTime(data.solarNoon),
    goldenHourStart: formatTime(data.goldenHourStart),
    dayLength: formatDuration(data.dayLengthMinutes),
    playableWindow: `${formatTime(playable.earliestTeeTime)} - ${formatTime(playable.latestTeeTime)} (${playable.playableHours} hours)`,
  };
}

// ============================================================================
// Additional Utility Functions
// ============================================================================

/**
 * Gets both morning and evening golden hour periods
 *
 * @param {object} data - Daylight data from getDaylightData
 * @returns {object} Golden hour periods with start, end, and duration
 */
function getGoldenHourPeriods(data) {
  return calculateGoldenHourPeriods(data);
}

/**
 * Quick check if current time is golden hour
 *
 * @param {object} data - Daylight data from getDaylightData
 * @returns {object} Result with isGoldenHour, period, and minutesRemaining
 */
function isCurrentlyGoldenHour(data) {
  const now = new Date();
  const result = isGoldenHour(now, data);

  if (!result.isGoldenHour) {
    return { ...result, minutesRemaining: null };
  }

  const goldenHours = calculateGoldenHourPeriods(data);
  const endTime = result.period === 'morning'
    ? goldenHours.morning.end
    : goldenHours.evening.end;

  const minutesRemaining = Math.round(
    (endTime.getTime() - now.getTime()) / (1000 * 60)
  );

  return { ...result, minutesRemaining };
}

/**
 * Gets time until next golden hour
 *
 * @param {object} data - Daylight data from getDaylightData
 * @returns {object} Info about next golden hour
 */
function getTimeUntilGoldenHour(data) {
  const now = new Date();
  const goldenHours = calculateGoldenHourPeriods(data);

  // Check if we're before morning golden hour
  if (now < goldenHours.morning.start) {
    return {
      nextPeriod: 'morning',
      minutesUntil: Math.round(
        (goldenHours.morning.start.getTime() - now.getTime()) / (1000 * 60)
      ),
      startsAt: goldenHours.morning.start,
    };
  }

  // Check if we're between morning and evening golden hour
  if (now > goldenHours.morning.end && now < goldenHours.evening.start) {
    return {
      nextPeriod: 'evening',
      minutesUntil: Math.round(
        (goldenHours.evening.start.getTime() - now.getTime()) / (1000 * 60)
      ),
      startsAt: goldenHours.evening.start,
    };
  }

  // After evening golden hour - next is tomorrow morning
  const tomorrowMorning = new Date(goldenHours.morning.start);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);

  return {
    nextPeriod: 'tomorrow_morning',
    minutesUntil: Math.round(
      (tomorrowMorning.getTime() - now.getTime()) / (1000 * 60)
    ),
    startsAt: tomorrowMorning,
  };
}

/**
 * Clear the daylight data cache
 */
function clearCache() {
  cache.clear();
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
function getCacheStats() {
  return cache.stats();
}

// ============================================================================
// Exports
// ============================================================================

// Export for ES modules (browser with type="module")
export {
  getDaylightData,
  isGoldenHour,
  getPlayableWindow,
  formatDaylight,
  getGoldenHourPeriods,
  isCurrentlyGoldenHour,
  getTimeUntilGoldenHour,
  getLightingCondition,
  clearCache,
  getCacheStats,
  DaylightServiceError,
  DEFAULT_CONFIG,
};

// Default export for convenience
export default {
  getDaylightData,
  isGoldenHour,
  getPlayableWindow,
  formatDaylight,
  getGoldenHourPeriods,
  isCurrentlyGoldenHour,
  getTimeUntilGoldenHour,
  getLightingCondition,
  clearCache,
  getCacheStats,
  DaylightServiceError,
  DEFAULT_CONFIG,
};
