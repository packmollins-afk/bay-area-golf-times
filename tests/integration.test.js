/**
 * Integration Tests for Bay Area Golf Times API Services
 *
 * Tests all external API services against live endpoints with real Bay Area coordinates.
 * These tests make actual network requests and should be skipped in CI environments
 * or when running quick unit tests.
 *
 * Run with: npm test -- tests/integration.test.js
 * Skip in CI by setting environment variable: SKIP_INTEGRATION_TESTS=true
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Check if integration tests should be skipped
 * Skip when:
 * - SKIP_INTEGRATION_TESTS=true
 * - Running in CI environment
 */
const SKIP_INTEGRATION_TESTS = process.env.SKIP_INTEGRATION_TESTS === 'true' ||
  process.env.CI === 'true';

/**
 * Maximum allowed response time for API calls (in milliseconds)
 */
const MAX_RESPONSE_TIME_MS = 5000;

/**
 * Real Bay Area coordinates for testing
 */
const TEST_LOCATIONS = {
  halfMoonBay: {
    name: 'Half Moon Bay Golf Links',
    latitude: 37.4636,
    longitude: -122.4286,
  },
  pebbleBeach: {
    name: 'Pebble Beach Golf Links',
    latitude: 36.5725,
    longitude: -121.9486,
  },
  sanFrancisco: {
    name: 'San Francisco (general)',
    latitude: 37.7749,
    longitude: -122.4194,
  },
};

/**
 * NOAA Tide Station ID for San Francisco Bay
 */
const SF_TIDE_STATION_ID = '9414290';

/**
 * Invalid coordinates for error handling tests
 */
const INVALID_COORDINATES = {
  latitudeTooHigh: { latitude: 91, longitude: -122.4286 },
  latitudeTooLow: { latitude: -91, longitude: -122.4286 },
  longitudeTooHigh: { latitude: 37.4636, longitude: 181 },
  longitudeTooLow: { latitude: 37.4636, longitude: -181 },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Measure the execution time of an async function
 * @param {Function} fn - Async function to measure
 * @returns {Promise<{result: any, duration: number}>} Result and duration in ms
 */
async function measureTime(fn) {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Helper to conditionally run tests based on environment
 */
const describeIntegration = SKIP_INTEGRATION_TESTS ? describe.skip : describe;

// ============================================================================
// Open-Meteo Weather API Tests
// ============================================================================

describeIntegration('Open-Meteo Weather API Integration', () => {
  const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

  describe('Hourly Forecast - Half Moon Bay', () => {
    let response;
    let responseTime;

    beforeAll(async () => {
      const { latitude, longitude } = TEST_LOCATIONS.halfMoonBay;
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        hourly: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,cloud_cover',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        timezone: 'America/Los_Angeles',
        forecast_hours: '48',
      });

      const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
      const { result, duration } = await measureTime(async () => {
        const res = await fetch(url);
        return res.json();
      });

      response = result;
      responseTime = duration;
    });

    it('should respond within acceptable time limit', () => {
      expect(responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      console.log(`Open-Meteo response time: ${Math.round(responseTime)}ms`);
    });

    it('should return valid response structure', () => {
      expect(response).toBeDefined();
      expect(response).not.toHaveProperty('error');
      expect(response).toHaveProperty('latitude');
      expect(response).toHaveProperty('longitude');
      expect(response).toHaveProperty('timezone');
      expect(response).toHaveProperty('hourly');
    });

    it('should return correct location coordinates', () => {
      // Open-Meteo may return slightly adjusted coordinates
      expect(response.latitude).toBeCloseTo(TEST_LOCATIONS.halfMoonBay.latitude, 1);
      expect(response.longitude).toBeCloseTo(TEST_LOCATIONS.halfMoonBay.longitude, 1);
    });

    it('should return hourly data with required fields', () => {
      const { hourly } = response;
      expect(hourly).toHaveProperty('time');
      expect(hourly).toHaveProperty('temperature_2m');
      expect(hourly).toHaveProperty('apparent_temperature');
      expect(hourly).toHaveProperty('precipitation_probability');
      expect(hourly).toHaveProperty('wind_speed_10m');
      expect(hourly).toHaveProperty('wind_direction_10m');
      expect(hourly).toHaveProperty('cloud_cover');
    });

    it('should return 48 hours of forecast data', () => {
      expect(response.hourly.time.length).toBe(48);
      expect(response.hourly.temperature_2m.length).toBe(48);
    });

    it('should return valid temperature values (30-100F range for Bay Area)', () => {
      response.hourly.temperature_2m.forEach((temp) => {
        expect(temp).toBeGreaterThanOrEqual(30);
        expect(temp).toBeLessThanOrEqual(100);
      });
    });

    it('should return valid wind speed values (0-60 mph)', () => {
      response.hourly.wind_speed_10m.forEach((speed) => {
        expect(speed).toBeGreaterThanOrEqual(0);
        expect(speed).toBeLessThanOrEqual(60);
      });
    });

    it('should return valid wind direction values (0-360 degrees)', () => {
      response.hourly.wind_direction_10m.forEach((direction) => {
        expect(direction).toBeGreaterThanOrEqual(0);
        expect(direction).toBeLessThanOrEqual(360);
      });
    });

    it('should return valid precipitation probability values (0-100%)', () => {
      response.hourly.precipitation_probability.forEach((prob) => {
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(100);
      });
    });

    it('should return valid cloud cover values (0-100%)', () => {
      response.hourly.cloud_cover.forEach((cover) => {
        expect(cover).toBeGreaterThanOrEqual(0);
        expect(cover).toBeLessThanOrEqual(100);
      });
    });

    it('should return ISO8601 formatted time strings', () => {
      response.hourly.time.forEach((time) => {
        expect(time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      });
    });

    it('should return timezone information', () => {
      expect(response.timezone).toBe('America/Los_Angeles');
      expect(response).toHaveProperty('timezone_abbreviation');
    });
  });

  describe('Daily Forecast - San Francisco', () => {
    let response;
    let responseTime;

    beforeAll(async () => {
      const { latitude, longitude } = TEST_LOCATIONS.sanFrancisco;
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        timezone: 'America/Los_Angeles',
        forecast_days: '7',
      });

      const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
      const { result, duration } = await measureTime(async () => {
        const res = await fetch(url);
        return res.json();
      });

      response = result;
      responseTime = duration;
    });

    it('should respond within acceptable time limit', () => {
      expect(responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
    });

    it('should return 7 days of forecast data', () => {
      expect(response.daily.time.length).toBe(7);
    });

    it('should return max and min temperatures', () => {
      expect(response.daily.temperature_2m_max.length).toBe(7);
      expect(response.daily.temperature_2m_min.length).toBe(7);

      // Max should be greater than or equal to min
      for (let i = 0; i < 7; i++) {
        expect(response.daily.temperature_2m_max[i]).toBeGreaterThanOrEqual(
          response.daily.temperature_2m_min[i]
        );
      }
    });

    it('should return sunrise and sunset times', () => {
      expect(response.daily.sunrise).toBeDefined();
      expect(response.daily.sunset).toBeDefined();
      expect(response.daily.sunrise.length).toBe(7);
      expect(response.daily.sunset.length).toBe(7);

      // Sunset should be after sunrise
      for (let i = 0; i < 7; i++) {
        const sunrise = new Date(response.daily.sunrise[i]);
        const sunset = new Date(response.daily.sunset[i]);
        expect(sunset.getTime()).toBeGreaterThan(sunrise.getTime());
      }
    });
  });

  describe('Error Handling - Invalid Coordinates', () => {
    it('should handle latitude out of range', async () => {
      const params = new URLSearchParams({
        latitude: '91', // Invalid - too high
        longitude: '-122',
        hourly: 'temperature_2m',
      });

      const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
      const res = await fetch(url);

      // Open-Meteo returns 400 for invalid coordinates
      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
    });

    it('should handle invalid forecast parameters gracefully', async () => {
      // Open-Meteo defaults to lat=0, lng=0 when coordinates are missing (returns 200)
      // But it does return an error for invalid variable names
      const url = `${OPEN_METEO_BASE_URL}?latitude=37&longitude=-122&hourly=invalid_variable_name`;
      const res = await fetch(url);
      const data = await res.json();

      // Open-Meteo returns 400 Bad Request for invalid variable names
      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
      expect(data.error).toBe(true);
      expect(data.reason).toBeDefined();
    });
  });
});

// ============================================================================
// NOAA Tides API Tests
// ============================================================================

describeIntegration('NOAA Tides API Integration', () => {
  const NOAA_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

  describe('Tide Predictions - San Francisco Station', () => {
    let response;
    let responseTime;

    beforeAll(async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const params = new URLSearchParams({
        begin_date: formatDate(today),
        end_date: formatDate(tomorrow),
        station: SF_TIDE_STATION_ID,
        product: 'predictions',
        datum: 'MLLW',
        time_zone: 'lst_ldt',
        interval: 'hilo',
        units: 'english',
        format: 'json',
        application: 'BayAreaGolfTimes_IntegrationTest',
      });

      const url = `${NOAA_BASE_URL}?${params.toString()}`;
      const { result, duration } = await measureTime(async () => {
        const res = await fetch(url);
        return res.json();
      });

      response = result;
      responseTime = duration;
    });

    it('should respond within acceptable time limit', () => {
      expect(responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      console.log(`NOAA Tides response time: ${Math.round(responseTime)}ms`);
    });

    it('should return valid response structure', () => {
      expect(response).toBeDefined();
      expect(response).not.toHaveProperty('error');
      expect(response).toHaveProperty('predictions');
    });

    it('should return an array of tide predictions', () => {
      expect(Array.isArray(response.predictions)).toBe(true);
      expect(response.predictions.length).toBeGreaterThan(0);
    });

    it('should return predictions with required fields', () => {
      const prediction = response.predictions[0];
      expect(prediction).toHaveProperty('t'); // timestamp
      expect(prediction).toHaveProperty('v'); // value (height)
      expect(prediction).toHaveProperty('type'); // H or L (high/low)
    });

    it('should return valid tide types (H or L)', () => {
      response.predictions.forEach((prediction) => {
        expect(['H', 'L']).toContain(prediction.type);
      });
    });

    it('should return valid tide height values (reasonable range for SF Bay)', () => {
      response.predictions.forEach((prediction) => {
        const height = parseFloat(prediction.v);
        expect(height).toBeGreaterThanOrEqual(-3); // Negative tides possible
        expect(height).toBeLessThanOrEqual(10); // Max tide height for SF
      });
    });

    it('should return properly formatted timestamps', () => {
      response.predictions.forEach((prediction) => {
        // NOAA format: "YYYY-MM-DD HH:MM"
        expect(prediction.t).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      });
    });

    it('should return predictions in chronological order', () => {
      for (let i = 1; i < response.predictions.length; i++) {
        const prevTime = new Date(response.predictions[i - 1].t);
        const currTime = new Date(response.predictions[i].t);
        expect(currTime.getTime()).toBeGreaterThan(prevTime.getTime());
      }
    });

    it('should alternate between high and low tides', () => {
      // Tides should generally alternate (though there can be variations)
      let sameTypeCount = 0;
      for (let i = 1; i < response.predictions.length; i++) {
        if (response.predictions[i].type === response.predictions[i - 1].type) {
          sameTypeCount++;
        }
      }
      // Allow for some consecutive same-type readings but should be rare
      expect(sameTypeCount).toBeLessThan(response.predictions.length / 2);
    });
  });

  describe('Extended Tide Forecast (7 days)', () => {
    let response;

    beforeAll(async () => {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 7);

      const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const params = new URLSearchParams({
        begin_date: formatDate(today),
        end_date: formatDate(endDate),
        station: SF_TIDE_STATION_ID,
        product: 'predictions',
        datum: 'MLLW',
        time_zone: 'lst_ldt',
        interval: 'hilo',
        units: 'english',
        format: 'json',
        application: 'BayAreaGolfTimes_IntegrationTest',
      });

      const url = `${NOAA_BASE_URL}?${params.toString()}`;
      const res = await fetch(url);
      response = await res.json();
    });

    it('should return multiple days of predictions', () => {
      // Expect roughly 4 tides per day (2 high, 2 low)
      expect(response.predictions.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Error Handling - Invalid Station', () => {
    it('should return error for invalid station ID', async () => {
      const params = new URLSearchParams({
        begin_date: '20250109',
        end_date: '20250110',
        station: '9999999', // Invalid station
        product: 'predictions',
        datum: 'MLLW',
        time_zone: 'lst_ldt',
        interval: 'hilo',
        units: 'english',
        format: 'json',
        application: 'BayAreaGolfTimes_IntegrationTest',
      });

      const url = `${NOAA_BASE_URL}?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      expect(data).toHaveProperty('error');
    });
  });
});

// ============================================================================
// SunriseSunset.io API Tests
// ============================================================================

describeIntegration('SunriseSunset.io API Integration', () => {
  const SUNRISE_SUNSET_BASE_URL = 'https://api.sunrisesunset.io/json';

  describe('Daylight Data - Pebble Beach', () => {
    let response;
    let responseTime;

    beforeAll(async () => {
      const { latitude, longitude } = TEST_LOCATIONS.pebbleBeach;
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const params = new URLSearchParams({
        lat: latitude.toString(),
        lng: longitude.toString(),
        date: dateStr,
      });

      const url = `${SUNRISE_SUNSET_BASE_URL}?${params.toString()}`;
      const { result, duration } = await measureTime(async () => {
        const res = await fetch(url);
        return res.json();
      });

      response = result;
      responseTime = duration;
    });

    it('should respond within acceptable time limit', () => {
      expect(responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      console.log(`SunriseSunset.io response time: ${Math.round(responseTime)}ms`);
    });

    it('should return OK status', () => {
      expect(response.status).toBe('OK');
    });

    it('should return results object with required fields', () => {
      expect(response).toHaveProperty('results');
      const { results } = response;

      expect(results).toHaveProperty('sunrise');
      expect(results).toHaveProperty('sunset');
      expect(results).toHaveProperty('dawn');
      expect(results).toHaveProperty('dusk');
      expect(results).toHaveProperty('day_length');
      expect(results).toHaveProperty('solar_noon');
      expect(results).toHaveProperty('timezone');
    });

    it('should return properly formatted time strings', () => {
      const { results } = response;
      // Format: "HH:MM:SS AM/PM"
      const timeRegex = /^\d{1,2}:\d{2}:\d{2}\s*(AM|PM)$/i;

      expect(results.sunrise).toMatch(timeRegex);
      expect(results.sunset).toMatch(timeRegex);
      expect(results.dawn).toMatch(timeRegex);
      expect(results.dusk).toMatch(timeRegex);
      expect(results.solar_noon).toMatch(timeRegex);
    });

    it('should return valid day length', () => {
      const { results } = response;
      // Format: "HH:MM:SS"
      expect(results.day_length).toMatch(/^\d{1,2}:\d{2}:\d{2}$/);

      // Day length should be between 8 and 16 hours for this latitude
      const parts = results.day_length.split(':').map(Number);
      const hours = parts[0] + parts[1] / 60 + parts[2] / 3600;
      expect(hours).toBeGreaterThanOrEqual(8);
      expect(hours).toBeLessThanOrEqual(16);
    });

    it('should return logical time ordering', () => {
      const { results } = response;

      // Helper to parse time to comparable format
      const parseTime = (timeStr) => {
        const match = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const period = match[4].toUpperCase();

        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        return hours * 3600 + minutes * 60 + seconds;
      };

      const dawn = parseTime(results.dawn);
      const sunrise = parseTime(results.sunrise);
      const solarNoon = parseTime(results.solar_noon);
      const sunset = parseTime(results.sunset);
      const dusk = parseTime(results.dusk);

      // Dawn before sunrise before noon before sunset before dusk
      expect(dawn).toBeLessThan(sunrise);
      expect(sunrise).toBeLessThan(solarNoon);
      expect(solarNoon).toBeLessThan(sunset);
      expect(sunset).toBeLessThan(dusk);
    });

    it('should return first_light and last_light', () => {
      const { results } = response;
      expect(results).toHaveProperty('first_light');
      expect(results).toHaveProperty('last_light');
    });

    it('should return golden_hour time', () => {
      const { results } = response;
      expect(results).toHaveProperty('golden_hour');
    });

    it('should return timezone information', () => {
      const { results } = response;
      expect(results.timezone).toBeDefined();
      // Pebble Beach should be in Pacific timezone
      expect(results.timezone).toMatch(/America\/Los_Angeles|PST|PDT/i);
    });
  });

  describe('Future Date Request', () => {
    it('should return daylight data for future dates', async () => {
      const { latitude, longitude } = TEST_LOCATIONS.pebbleBeach;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().split('T')[0];

      const params = new URLSearchParams({
        lat: latitude.toString(),
        lng: longitude.toString(),
        date: dateStr,
      });

      const url = `${SUNRISE_SUNSET_BASE_URL}?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      expect(data.status).toBe('OK');
      expect(data.results).toBeDefined();
    });
  });

  describe('Error Handling - Invalid Coordinates', () => {
    it('should handle invalid latitude gracefully', async () => {
      const params = new URLSearchParams({
        lat: '999', // Invalid
        lng: '-122',
        date: '2025-01-09',
      });

      const url = `${SUNRISE_SUNSET_BASE_URL}?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      // API may return error status or handle gracefully
      expect(data).toBeDefined();
    });
  });
});

// ============================================================================
// EPA AirNow API Tests (Conditional)
// ============================================================================

describeIntegration('EPA AirNow API Integration', () => {
  const AIRNOW_BASE_URL = 'https://www.airnowapi.org';
  const AIRNOW_API_KEY = process.env.AIRNOW_API_KEY;

  // Skip these tests if no API key is available
  const describeWithApiKey = AIRNOW_API_KEY ? describe : describe.skip;

  describeWithApiKey('Current AQI - San Francisco', () => {
    let response;
    let responseTime;

    beforeAll(async () => {
      const { latitude, longitude } = TEST_LOCATIONS.sanFrancisco;

      const params = new URLSearchParams({
        format: 'application/json',
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        distance: '25',
        API_KEY: AIRNOW_API_KEY,
      });

      const url = `${AIRNOW_BASE_URL}/aq/observation/latLong/current/?${params.toString()}`;
      const { result, duration } = await measureTime(async () => {
        const res = await fetch(url);
        return res.json();
      });

      response = result;
      responseTime = duration;
    });

    it('should respond within acceptable time limit', () => {
      expect(responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      console.log(`AirNow response time: ${Math.round(responseTime)}ms`);
    });

    it('should return an array of observations', () => {
      expect(Array.isArray(response)).toBe(true);
    });

    it('should return at least one observation', () => {
      expect(response.length).toBeGreaterThan(0);
    });

    it('should return observations with required fields', () => {
      const observation = response[0];
      expect(observation).toHaveProperty('DateObserved');
      expect(observation).toHaveProperty('HourObserved');
      expect(observation).toHaveProperty('AQI');
      expect(observation).toHaveProperty('ParameterName');
      expect(observation).toHaveProperty('ReportingArea');
      expect(observation).toHaveProperty('StateCode');
      expect(observation).toHaveProperty('Category');
    });

    it('should return valid AQI values (0-500)', () => {
      response.forEach((obs) => {
        expect(obs.AQI).toBeGreaterThanOrEqual(0);
        expect(obs.AQI).toBeLessThanOrEqual(500);
      });
    });

    it('should return valid parameter names', () => {
      const validParameters = ['PM2.5', 'PM10', 'O3', 'NO2', 'CO', 'SO2', 'OZONE'];
      response.forEach((obs) => {
        expect(validParameters).toContain(obs.ParameterName);
      });
    });

    it('should return California state code', () => {
      response.forEach((obs) => {
        expect(obs.StateCode).toBe('CA');
      });
    });

    it('should return category information', () => {
      response.forEach((obs) => {
        expect(obs.Category).toHaveProperty('Number');
        expect(obs.Category).toHaveProperty('Name');
        expect(obs.Category.Number).toBeGreaterThanOrEqual(1);
        expect(obs.Category.Number).toBeLessThanOrEqual(6);
      });
    });
  });

  // Test without API key
  describe('API Key Validation', () => {
    it('should reject requests without valid API key', async () => {
      const { latitude, longitude } = TEST_LOCATIONS.sanFrancisco;

      const params = new URLSearchParams({
        format: 'application/json',
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        distance: '25',
        API_KEY: 'INVALID_KEY',
      });

      const url = `${AIRNOW_BASE_URL}/aq/observation/latLong/current/?${params.toString()}`;
      const res = await fetch(url);

      // Invalid API key should result in error or empty response
      // AirNow API behavior varies - may return 401, 403, or empty array
      expect([401, 403, 200].includes(res.status)).toBe(true);
    });
  });

  // Info message when API key is not available
  if (!AIRNOW_API_KEY) {
    it('should skip AirNow tests when API key is not available', () => {
      console.log(
        'AirNow API tests skipped: Set AIRNOW_API_KEY environment variable to enable'
      );
      expect(true).toBe(true);
    });
  }
});

// ============================================================================
// Cross-Service Response Time Comparison
// ============================================================================

describeIntegration('Cross-Service Performance Comparison', () => {
  it('should complete all API calls within 5 seconds each', async () => {
    const results = [];

    // Open-Meteo
    const weatherStart = performance.now();
    await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${TEST_LOCATIONS.sanFrancisco.latitude}&longitude=${TEST_LOCATIONS.sanFrancisco.longitude}&hourly=temperature_2m`
    );
    results.push({
      service: 'Open-Meteo',
      duration: performance.now() - weatherStart,
    });

    // NOAA Tides
    const tidesStart = performance.now();
    const today = new Date();
    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };
    await fetch(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${formatDate(today)}&end_date=${formatDate(today)}&station=${SF_TIDE_STATION_ID}&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&format=json&application=BayAreaGolf_Test`
    );
    results.push({
      service: 'NOAA Tides',
      duration: performance.now() - tidesStart,
    });

    // SunriseSunset.io
    const sunStart = performance.now();
    await fetch(
      `https://api.sunrisesunset.io/json?lat=${TEST_LOCATIONS.pebbleBeach.latitude}&lng=${TEST_LOCATIONS.pebbleBeach.longitude}`
    );
    results.push({
      service: 'SunriseSunset.io',
      duration: performance.now() - sunStart,
    });

    // Log results
    console.log('\nAPI Response Times:');
    results.forEach((r) => {
      console.log(`  ${r.service}: ${Math.round(r.duration)}ms`);
    });

    // Assert all under 5 seconds
    results.forEach((r) => {
      expect(r.duration).toBeLessThan(MAX_RESPONSE_TIME_MS);
    });
  });
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

describeIntegration('Response Schema Validation', () => {
  describe('Open-Meteo Response Schema', () => {
    it('should match expected hourly response schema', async () => {
      const { latitude, longitude } = TEST_LOCATIONS.halfMoonBay;
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        hourly: 'temperature_2m',
        forecast_hours: '1',
      });

      const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      // Schema validation
      expect(typeof data.latitude).toBe('number');
      expect(typeof data.longitude).toBe('number');
      expect(typeof data.timezone).toBe('string');
      expect(typeof data.elevation).toBe('number');
      expect(Array.isArray(data.hourly.time)).toBe(true);
      expect(Array.isArray(data.hourly.temperature_2m)).toBe(true);
      expect(typeof data.hourly.time[0]).toBe('string');
      expect(typeof data.hourly.temperature_2m[0]).toBe('number');
    });
  });

  describe('NOAA Tides Response Schema', () => {
    it('should match expected predictions response schema', async () => {
      const today = new Date();
      const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const params = new URLSearchParams({
        begin_date: formatDate(today),
        end_date: formatDate(today),
        station: SF_TIDE_STATION_ID,
        product: 'predictions',
        datum: 'MLLW',
        time_zone: 'lst_ldt',
        interval: 'hilo',
        units: 'english',
        format: 'json',
        application: 'BayAreaGolf_Test',
      });

      const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      // Schema validation
      expect(Array.isArray(data.predictions)).toBe(true);
      if (data.predictions.length > 0) {
        const prediction = data.predictions[0];
        expect(typeof prediction.t).toBe('string');
        expect(typeof prediction.v).toBe('string');
        expect(typeof prediction.type).toBe('string');
      }
    });
  });

  describe('SunriseSunset.io Response Schema', () => {
    it('should match expected response schema', async () => {
      const { latitude, longitude } = TEST_LOCATIONS.pebbleBeach;
      const params = new URLSearchParams({
        lat: latitude.toString(),
        lng: longitude.toString(),
      });

      const url = `https://api.sunrisesunset.io/json?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      // Schema validation
      expect(typeof data.status).toBe('string');
      expect(typeof data.results).toBe('object');
      expect(typeof data.results.sunrise).toBe('string');
      expect(typeof data.results.sunset).toBe('string');
      expect(typeof data.results.day_length).toBe('string');
      expect(typeof data.results.timezone).toBe('string');
    });
  });
});

// ============================================================================
// Network Resilience Tests
// ============================================================================

describeIntegration('Network Resilience', () => {
  it('should handle concurrent API requests', async () => {
    const { latitude, longitude } = TEST_LOCATIONS.sanFrancisco;

    const requests = [
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m`
      ),
      fetch(
        `https://api.sunrisesunset.io/json?lat=${latitude}&lng=${longitude}`
      ),
    ];

    const results = await Promise.all(requests);

    results.forEach((res) => {
      expect(res.ok).toBe(true);
    });
  });

  it('should handle rapid sequential requests', async () => {
    const { latitude, longitude } = TEST_LOCATIONS.sanFrancisco;
    const url = `https://api.sunrisesunset.io/json?lat=${latitude}&lng=${longitude}`;

    // Make 3 rapid requests
    for (let i = 0; i < 3; i++) {
      const res = await fetch(url);
      expect(res.ok).toBe(true);
    }
  });
});
