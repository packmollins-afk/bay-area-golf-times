/**
 * Comprehensive tests for Weather Service
 * Tests playability scoring, forecast fetching, formatting, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // Playability scoring functions
  calculateTemperatureScore,
  calculateWindScore,
  calculatePrecipitationScore,
  calculateCloudCoverScore,
  calculatePlayabilityScore,
  getPlayabilityRating,

  // Formatting functions
  degreesToCardinal,
  getCloudDescription,
  formatTemperature,
  formatWind,
  formatPrecipitation,
  formatTime,
  formatDateShort,
  formatDateLong,
  formatHourlyWeather,
  formatDailyWeather,

  // API functions
  getHourlyForecast,
  getDailyForecast,
  getFullForecast,

  // Utility functions
  findBestTeeTime,
  findBestDay,
  getWeatherSummaryForDate,
} from '../services/weather.ts';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a mock Open-Meteo hourly API response
 */
function createMockHourlyResponse(overrides = {}) {
  return {
    latitude: 37.7749,
    longitude: -122.4194,
    generationtime_ms: 0.5,
    utc_offset_seconds: -28800,
    timezone: 'America/Los_Angeles',
    timezone_abbreviation: 'PST',
    elevation: 10,
    hourly_units: {
      time: 'iso8601',
      temperature_2m: '°F',
      apparent_temperature: '°F',
      precipitation_probability: '%',
      wind_speed_10m: 'mp/h',
      wind_direction_10m: '°',
      cloud_cover: '%',
    },
    hourly: {
      time: [
        '2025-01-09T06:00',
        '2025-01-09T07:00',
        '2025-01-09T08:00',
        '2025-01-09T09:00',
        '2025-01-09T10:00',
      ],
      temperature_2m: [55, 58, 62, 68, 72],
      apparent_temperature: [52, 55, 60, 66, 70],
      precipitation_probability: [0, 5, 10, 5, 0],
      wind_speed_10m: [3, 5, 8, 10, 12],
      wind_direction_10m: [270, 280, 290, 300, 315],
      cloud_cover: [10, 20, 30, 40, 50],
    },
    ...overrides,
  };
}

/**
 * Creates a mock Open-Meteo daily API response
 */
function createMockDailyResponse(overrides = {}) {
  return {
    latitude: 37.7749,
    longitude: -122.4194,
    generationtime_ms: 0.5,
    utc_offset_seconds: -28800,
    timezone: 'America/Los_Angeles',
    timezone_abbreviation: 'PST',
    elevation: 10,
    daily_units: {
      time: 'iso8601',
      temperature_2m_max: '°F',
      temperature_2m_min: '°F',
      apparent_temperature_max: '°F',
      apparent_temperature_min: '°F',
      precipitation_probability_max: '%',
      wind_speed_10m_max: 'mp/h',
      wind_direction_10m_dominant: '°',
      sunrise: 'iso8601',
      sunset: 'iso8601',
    },
    daily: {
      time: ['2025-01-09', '2025-01-10', '2025-01-11'],
      temperature_2m_max: [72, 68, 75],
      temperature_2m_min: [52, 48, 55],
      apparent_temperature_max: [70, 65, 73],
      apparent_temperature_min: [50, 45, 53],
      precipitation_probability_max: [10, 60, 5],
      wind_speed_10m_max: [12, 20, 8],
      wind_direction_10m_dominant: [270, 180, 90],
      sunrise: ['2025-01-09T07:25', '2025-01-10T07:25', '2025-01-11T07:25'],
      sunset: ['2025-01-09T17:15', '2025-01-10T17:16', '2025-01-11T17:17'],
    },
    ...overrides,
  };
}

/**
 * Creates a mock HourlyWeather object
 */
function createMockHourlyWeather(overrides = {}) {
  return {
    time: '2025-01-09T10:00',
    date: new Date('2025-01-09T10:00'),
    temperature: 72,
    feelsLike: 70,
    precipitationProbability: 10,
    windSpeed: 8,
    windDirection: 270,
    cloudCover: 30,
    ...overrides,
  };
}

/**
 * Creates a mock DailyWeather object
 */
function createMockDailyWeather(overrides = {}) {
  return {
    date: '2025-01-09',
    dateObj: new Date('2025-01-09'),
    temperatureMax: 72,
    temperatureMin: 52,
    feelsLikeMax: 70,
    feelsLikeMin: 50,
    precipitationProbability: 10,
    windSpeedMax: 12,
    windDirection: 270,
    sunrise: '2025-01-09T07:25',
    sunset: '2025-01-09T17:15',
    ...overrides,
  };
}

/**
 * Creates mock HourlyWeatherWithPlayability data for utility function tests
 */
function createMockHourlyWithPlayability(hour, score = 85) {
  const date = new Date('2025-01-09');
  date.setHours(hour, 0, 0, 0);

  return {
    time: date.toISOString(),
    date: date,
    temperature: 72,
    feelsLike: 70,
    precipitationProbability: 10,
    windSpeed: 8,
    windDirection: 270,
    cloudCover: 30,
    playability: {
      score,
      rating: score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor',
      factors: { temperature: 100, wind: 80, precipitation: 90, cloudCover: 100 },
      summary: 'Great conditions',
      recommendations: ['Enjoy your round!'],
    },
  };
}

// ============================================================================
// Temperature Score Tests
// ============================================================================

describe('calculateTemperatureScore', () => {
  describe('ideal temperature range (65-80F)', () => {
    it('should return 100 for temperatures in ideal range', () => {
      expect(calculateTemperatureScore(65)).toBe(100);
      expect(calculateTemperatureScore(72)).toBe(100);
      expect(calculateTemperatureScore(80)).toBe(100);
    });

    it('should return 100 for mid-range ideal temperature', () => {
      expect(calculateTemperatureScore(73)).toBe(100);
    });
  });

  describe('cold temperatures', () => {
    it('should score 80-50 for temperatures 50-65F', () => {
      const score60 = calculateTemperatureScore(60);
      expect(score60).toBeGreaterThan(50);
      expect(score60).toBeLessThan(100);
    });

    it('should score 60-30 for temperatures 40-50F', () => {
      const score45 = calculateTemperatureScore(45);
      expect(score45).toBeGreaterThan(30);
      expect(score45).toBeLessThan(60);
    });

    it('should score 30-10 for temperatures 32-40F', () => {
      const score35 = calculateTemperatureScore(35);
      expect(score35).toBeGreaterThan(10);
      expect(score35).toBeLessThan(30);
    });

    it('should score near 0 for freezing temperatures', () => {
      const score25 = calculateTemperatureScore(25);
      expect(score25).toBeLessThanOrEqual(10);
      expect(score25).toBeGreaterThanOrEqual(0);
    });

    it('should never return negative scores', () => {
      expect(calculateTemperatureScore(0)).toBeGreaterThanOrEqual(0);
      expect(calculateTemperatureScore(-10)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hot temperatures', () => {
    it('should score 80-60 for temperatures 80-90F', () => {
      const score85 = calculateTemperatureScore(85);
      expect(score85).toBeGreaterThan(60);
      expect(score85).toBeLessThan(100);
    });

    it('should score 60-40 for temperatures 90-95F', () => {
      const score93 = calculateTemperatureScore(93);
      expect(score93).toBeGreaterThan(40);
      expect(score93).toBeLessThan(60);
    });

    it('should score 40-20 for temperatures 95-100F', () => {
      const score98 = calculateTemperatureScore(98);
      expect(score98).toBeGreaterThan(20);
      expect(score98).toBeLessThan(40);
    });

    it('should score low for extreme heat', () => {
      const score105 = calculateTemperatureScore(105);
      expect(score105).toBeLessThan(20);
    });

    it('should never return negative scores', () => {
      expect(calculateTemperatureScore(120)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('score progression', () => {
    it('should decrease monotonically as temperature decreases below ideal', () => {
      const score80 = calculateTemperatureScore(80);
      const score70 = calculateTemperatureScore(70);
      const score60 = calculateTemperatureScore(60);
      const score50 = calculateTemperatureScore(50);
      const score40 = calculateTemperatureScore(40);

      expect(score80).toBeGreaterThanOrEqual(score70);
      expect(score70).toBeGreaterThanOrEqual(score60);
      expect(score60).toBeGreaterThanOrEqual(score50);
      expect(score50).toBeGreaterThanOrEqual(score40);
    });

    it('should decrease monotonically as temperature increases above ideal', () => {
      const score80 = calculateTemperatureScore(80);
      const score85 = calculateTemperatureScore(85);
      const score90 = calculateTemperatureScore(90);
      const score95 = calculateTemperatureScore(95);
      const score100 = calculateTemperatureScore(100);

      expect(score80).toBeGreaterThanOrEqual(score85);
      expect(score85).toBeGreaterThanOrEqual(score90);
      expect(score90).toBeGreaterThanOrEqual(score95);
      expect(score95).toBeGreaterThanOrEqual(score100);
    });
  });
});

// ============================================================================
// Wind Score Tests
// ============================================================================

describe('calculateWindScore', () => {
  describe('calm to light wind', () => {
    it('should return 100 for wind speed 0-5 mph', () => {
      expect(calculateWindScore(0)).toBe(100);
      expect(calculateWindScore(3)).toBe(100);
      expect(calculateWindScore(5)).toBe(100);
    });
  });

  describe('moderate wind', () => {
    it('should score 80-90 for wind 5-10 mph', () => {
      const score8 = calculateWindScore(8);
      expect(score8).toBeGreaterThanOrEqual(80);
      expect(score8).toBeLessThanOrEqual(90);
    });

    it('should score 60-80 for wind 10-15 mph', () => {
      const score12 = calculateWindScore(12);
      expect(score12).toBeGreaterThanOrEqual(60);
      expect(score12).toBeLessThan(80);
    });
  });

  describe('strong wind', () => {
    it('should score 40-60 for wind 15-20 mph', () => {
      const score18 = calculateWindScore(18);
      expect(score18).toBeGreaterThanOrEqual(40);
      expect(score18).toBeLessThan(60);
    });

    it('should score 20-40 for wind 20-25 mph', () => {
      const score22 = calculateWindScore(22);
      expect(score22).toBeGreaterThanOrEqual(20);
      expect(score22).toBeLessThan(40);
    });
  });

  describe('high wind', () => {
    it('should score 10-20 for wind 25-30 mph', () => {
      const score28 = calculateWindScore(28);
      expect(score28).toBeGreaterThanOrEqual(10);
      expect(score28).toBeLessThan(20);
    });

    it('should score near 0 for wind over 30 mph', () => {
      const score35 = calculateWindScore(35);
      expect(score35).toBeLessThanOrEqual(10);
      expect(score35).toBeGreaterThanOrEqual(0);
    });

    it('should never return negative scores', () => {
      expect(calculateWindScore(50)).toBeGreaterThanOrEqual(0);
      expect(calculateWindScore(100)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('score progression', () => {
    it('should decrease monotonically as wind increases', () => {
      const scores = [0, 5, 10, 15, 20, 25, 30, 35].map(calculateWindScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });
  });
});

// ============================================================================
// Precipitation Score Tests
// ============================================================================

describe('calculatePrecipitationScore', () => {
  describe('no precipitation', () => {
    it('should return 100 for 0% precipitation probability', () => {
      expect(calculatePrecipitationScore(0)).toBe(100);
    });
  });

  describe('low precipitation risk', () => {
    it('should score 90-95 for 1-10% probability', () => {
      const score5 = calculatePrecipitationScore(5);
      expect(score5).toBeGreaterThanOrEqual(90);
      expect(score5).toBeLessThanOrEqual(95);
    });

    it('should score 80-90 for 10-20% probability', () => {
      const score15 = calculatePrecipitationScore(15);
      expect(score15).toBeGreaterThanOrEqual(80);
      expect(score15).toBeLessThan(90);
    });
  });

  describe('moderate precipitation risk', () => {
    it('should score 60-80 for 20-30% probability', () => {
      const score25 = calculatePrecipitationScore(25);
      expect(score25).toBeGreaterThanOrEqual(60);
      expect(score25).toBeLessThan(80);
    });

    it('should score 30-60 for 30-50% probability', () => {
      const score40 = calculatePrecipitationScore(40);
      expect(score40).toBeGreaterThanOrEqual(30);
      expect(score40).toBeLessThan(60);
    });
  });

  describe('high precipitation risk', () => {
    it('should score 15-30 for 50-70% probability', () => {
      const score60 = calculatePrecipitationScore(60);
      expect(score60).toBeGreaterThanOrEqual(15);
      expect(score60).toBeLessThan(30);
    });

    it('should score 0-15 for 70-100% probability', () => {
      const score80 = calculatePrecipitationScore(80);
      expect(score80).toBeLessThanOrEqual(15);
      expect(score80).toBeGreaterThanOrEqual(0);
    });

    it('should handle 100% probability', () => {
      const score100 = calculatePrecipitationScore(100);
      expect(score100).toBeGreaterThanOrEqual(0);
      expect(score100).toBeLessThanOrEqual(15);
    });
  });

  describe('score progression', () => {
    it('should decrease monotonically as probability increases', () => {
      const scores = [0, 10, 20, 30, 50, 70, 90, 100].map(calculatePrecipitationScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });
  });
});

// ============================================================================
// Cloud Cover Score Tests
// ============================================================================

describe('calculateCloudCoverScore', () => {
  describe('ideal cloud cover (partly cloudy)', () => {
    it('should return 100 for 20-40% cloud cover (ideal for golf)', () => {
      expect(calculateCloudCoverScore(20)).toBe(100);
      expect(calculateCloudCoverScore(30)).toBe(100);
      expect(calculateCloudCoverScore(40)).toBe(100);
    });
  });

  describe('clear skies', () => {
    it('should score 90-100 for 0-20% cloud cover', () => {
      const score0 = calculateCloudCoverScore(0);
      const score10 = calculateCloudCoverScore(10);
      expect(score0).toBeGreaterThanOrEqual(90);
      expect(score10).toBeGreaterThanOrEqual(90);
    });
  });

  describe('mostly cloudy', () => {
    it('should score 80-90 for 40-60% cloud cover', () => {
      const score50 = calculateCloudCoverScore(50);
      expect(score50).toBeGreaterThanOrEqual(80);
      expect(score50).toBeLessThanOrEqual(90);
    });

    it('should score 60-80 for 60-80% cloud cover', () => {
      const score70 = calculateCloudCoverScore(70);
      expect(score70).toBeGreaterThanOrEqual(60);
      expect(score70).toBeLessThanOrEqual(80);
    });
  });

  describe('overcast', () => {
    it('should score 50-60 for 80-100% cloud cover', () => {
      const score90 = calculateCloudCoverScore(90);
      expect(score90).toBeGreaterThanOrEqual(50);
      expect(score90).toBeLessThanOrEqual(60);
    });

    it('should handle 100% cloud cover', () => {
      const score100 = calculateCloudCoverScore(100);
      expect(score100).toBeGreaterThanOrEqual(50);
    });
  });
});

// ============================================================================
// Playability Rating Tests
// ============================================================================

describe('getPlayabilityRating', () => {
  it('should return "excellent" for scores >= 85', () => {
    expect(getPlayabilityRating(85)).toBe('excellent');
    expect(getPlayabilityRating(90)).toBe('excellent');
    expect(getPlayabilityRating(100)).toBe('excellent');
  });

  it('should return "good" for scores 70-84', () => {
    expect(getPlayabilityRating(70)).toBe('good');
    expect(getPlayabilityRating(77)).toBe('good');
    expect(getPlayabilityRating(84)).toBe('good');
  });

  it('should return "fair" for scores 50-69', () => {
    expect(getPlayabilityRating(50)).toBe('fair');
    expect(getPlayabilityRating(60)).toBe('fair');
    expect(getPlayabilityRating(69)).toBe('fair');
  });

  it('should return "poor" for scores 30-49', () => {
    expect(getPlayabilityRating(30)).toBe('poor');
    expect(getPlayabilityRating(40)).toBe('poor');
    expect(getPlayabilityRating(49)).toBe('poor');
  });

  it('should return "unplayable" for scores < 30', () => {
    expect(getPlayabilityRating(0)).toBe('unplayable');
    expect(getPlayabilityRating(15)).toBe('unplayable');
    expect(getPlayabilityRating(29)).toBe('unplayable');
  });
});

// ============================================================================
// Comprehensive Playability Score Tests
// ============================================================================

describe('calculatePlayabilityScore', () => {
  describe('excellent conditions', () => {
    it('should return excellent rating for ideal golf weather', () => {
      const result = calculatePlayabilityScore(
        72,  // Perfect temperature
        5,   // Light wind
        0,   // No rain
        30   // Ideal cloud cover
      );

      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.rating).toBe('excellent');
      expect(result.summary).toBe('Perfect conditions for golf!');
    });
  });

  describe('good conditions', () => {
    it('should return good rating for favorable but not perfect weather', () => {
      const result = calculatePlayabilityScore(
        68,  // Good temperature
        14,  // Moderate wind (slightly higher to lower score)
        20,  // Some rain chance
        50   // Some clouds
      );

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThan(85);
      expect(result.rating).toBe('good');
      expect(result.summary).toBe('Great day to hit the links.');
    });
  });

  describe('fair conditions', () => {
    it('should return fair rating for challenging but playable weather', () => {
      const result = calculatePlayabilityScore(
        55,  // Cool temperature
        18,  // Strong wind
        25,  // Some rain chance
        60   // Cloudy
      );

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(70);
      expect(result.rating).toBe('fair');
    });

    it('should mention wind challenges when wind is the limiting factor', () => {
      const result = calculatePlayabilityScore(
        72,  // Good temp
        22,  // High wind
        10,  // Low rain
        30   // Good clouds
      );

      // Wind factor should be low due to high wind
      expect(result.factors.wind).toBeLessThan(60);
    });
  });

  describe('poor conditions', () => {
    it('should return poor rating for difficult weather', () => {
      const result = calculatePlayabilityScore(
        95,  // Hot
        25,  // Very windy
        50,  // High rain chance
        80   // Overcast
      );

      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThan(50);
      expect(result.rating).toBe('poor');
    });
  });

  describe('unplayable conditions', () => {
    it('should return unplayable rating for extreme weather', () => {
      const result = calculatePlayabilityScore(
        30,  // Freezing
        35,  // Very high wind
        80,  // Very high rain chance
        100  // Complete overcast
      );

      expect(result.score).toBeLessThan(30);
      expect(result.rating).toBe('unplayable');
      expect(result.summary).toBe('Not recommended for golf today.');
    });
  });

  describe('factor breakdown', () => {
    it('should include individual factor scores', () => {
      const result = calculatePlayabilityScore(72, 10, 20, 30);

      expect(result.factors).toHaveProperty('temperature');
      expect(result.factors).toHaveProperty('wind');
      expect(result.factors).toHaveProperty('precipitation');
      expect(result.factors).toHaveProperty('cloudCover');

      // All factors should be 0-100
      Object.values(result.factors).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('recommendations', () => {
    it('should recommend layers for cold weather', () => {
      const result = calculatePlayabilityScore(45, 5, 0, 30);
      expect(result.recommendations.some(r =>
        r.toLowerCase().includes('layer') || r.toLowerCase().includes('jacket')
      )).toBe(true);
    });

    it('should recommend hydration for hot weather', () => {
      const result = calculatePlayabilityScore(92, 5, 0, 20);
      expect(result.recommendations.some(r =>
        r.toLowerCase().includes('hydrat') || r.toLowerCase().includes('water')
      )).toBe(true);
    });

    it('should recommend rain gear for high precipitation chance', () => {
      const result = calculatePlayabilityScore(72, 5, 55, 50);
      expect(result.recommendations.some(r =>
        r.toLowerCase().includes('rain')
      )).toBe(true);
    });

    it('should recommend club adjustments for high wind', () => {
      const result = calculatePlayabilityScore(72, 22, 0, 30);
      expect(result.recommendations.some(r =>
        r.toLowerCase().includes('wind') || r.toLowerCase().includes('club')
      )).toBe(true);
    });

    it('should recommend sunscreen for sunny hot conditions', () => {
      const result = calculatePlayabilityScore(78, 5, 0, 10);
      expect(result.recommendations.some(r =>
        r.toLowerCase().includes('sun')
      )).toBe(true);
    });

    it('should have "Enjoy your round!" for perfect conditions', () => {
      const result = calculatePlayabilityScore(72, 3, 0, 30);
      expect(result.recommendations).toContain('Enjoy your round!');
    });
  });
});

// ============================================================================
// Cardinal Direction Tests
// ============================================================================

describe('degreesToCardinal', () => {
  it('should return N for 0 degrees', () => {
    expect(degreesToCardinal(0)).toBe('N');
  });

  it('should return N for 360 degrees', () => {
    expect(degreesToCardinal(360)).toBe('N');
  });

  it('should return correct cardinal directions', () => {
    expect(degreesToCardinal(45)).toBe('NE');
    expect(degreesToCardinal(90)).toBe('E');
    expect(degreesToCardinal(135)).toBe('SE');
    expect(degreesToCardinal(180)).toBe('S');
    expect(degreesToCardinal(225)).toBe('SW');
    expect(degreesToCardinal(270)).toBe('W');
    expect(degreesToCardinal(315)).toBe('NW');
  });

  it('should handle values near boundaries', () => {
    expect(degreesToCardinal(22)).toBe('N');
    expect(degreesToCardinal(23)).toBe('NE');
    expect(degreesToCardinal(67)).toBe('NE');
    expect(degreesToCardinal(68)).toBe('E');
  });

  it('should handle negative degrees', () => {
    expect(degreesToCardinal(-90)).toBe('W');
    expect(degreesToCardinal(-180)).toBe('S');
  });

  it('should handle degrees > 360', () => {
    expect(degreesToCardinal(450)).toBe('E');
    expect(degreesToCardinal(720)).toBe('N');
  });
});

// ============================================================================
// Cloud Description Tests
// ============================================================================

describe('getCloudDescription', () => {
  it('should return "Clear" for 0-10%', () => {
    expect(getCloudDescription(0)).toBe('Clear');
    expect(getCloudDescription(5)).toBe('Clear');
    expect(getCloudDescription(10)).toBe('Clear');
  });

  it('should return "Mostly Clear" for 11-25%', () => {
    expect(getCloudDescription(11)).toBe('Mostly Clear');
    expect(getCloudDescription(20)).toBe('Mostly Clear');
    expect(getCloudDescription(25)).toBe('Mostly Clear');
  });

  it('should return "Partly Cloudy" for 26-50%', () => {
    expect(getCloudDescription(26)).toBe('Partly Cloudy');
    expect(getCloudDescription(40)).toBe('Partly Cloudy');
    expect(getCloudDescription(50)).toBe('Partly Cloudy');
  });

  it('should return "Mostly Cloudy" for 51-75%', () => {
    expect(getCloudDescription(51)).toBe('Mostly Cloudy');
    expect(getCloudDescription(65)).toBe('Mostly Cloudy');
    expect(getCloudDescription(75)).toBe('Mostly Cloudy');
  });

  it('should return "Cloudy" for 76-90%', () => {
    expect(getCloudDescription(76)).toBe('Cloudy');
    expect(getCloudDescription(85)).toBe('Cloudy');
    expect(getCloudDescription(90)).toBe('Cloudy');
  });

  it('should return "Overcast" for 91-100%', () => {
    expect(getCloudDescription(91)).toBe('Overcast');
    expect(getCloudDescription(95)).toBe('Overcast');
    expect(getCloudDescription(100)).toBe('Overcast');
  });
});

// ============================================================================
// Formatting Function Tests
// ============================================================================

describe('formatTemperature', () => {
  it('should format temperature with degree symbol and F', () => {
    expect(formatTemperature(72)).toBe('72°F');
    expect(formatTemperature(100)).toBe('100°F');
  });

  it('should round decimal temperatures', () => {
    expect(formatTemperature(72.4)).toBe('72°F');
    expect(formatTemperature(72.6)).toBe('73°F');
  });

  it('should handle negative temperatures', () => {
    expect(formatTemperature(-5)).toBe('-5°F');
  });
});

describe('formatWind', () => {
  it('should format wind speed with mph and cardinal direction', () => {
    expect(formatWind(10, 0)).toBe('10 mph N');
    expect(formatWind(15, 90)).toBe('15 mph E');
    expect(formatWind(20, 270)).toBe('20 mph W');
  });

  it('should round wind speed', () => {
    expect(formatWind(10.4, 0)).toBe('10 mph N');
    expect(formatWind(10.6, 0)).toBe('11 mph N');
  });
});

describe('formatPrecipitation', () => {
  it('should format precipitation as percentage', () => {
    expect(formatPrecipitation(0)).toBe('0%');
    expect(formatPrecipitation(50)).toBe('50%');
    expect(formatPrecipitation(100)).toBe('100%');
  });

  it('should round decimal percentages', () => {
    expect(formatPrecipitation(33.3)).toBe('33%');
    expect(formatPrecipitation(66.7)).toBe('67%');
  });
});

describe('formatTime', () => {
  it('should format ISO time string to readable time', () => {
    // Note: This test may be affected by timezone
    const result = formatTime('2025-01-09T14:30', 'America/Los_Angeles');
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
  });

  it('should handle different timezones', () => {
    const result1 = formatTime('2025-01-09T14:00', 'America/Los_Angeles');
    const result2 = formatTime('2025-01-09T14:00', 'America/New_York');
    // Times should be formatted (actual values depend on timezone handling)
    expect(result1).toBeTruthy();
    expect(result2).toBeTruthy();
  });
});

describe('formatDateShort', () => {
  it('should format date in short format', () => {
    const date = new Date('2025-01-09');
    const result = formatDateShort(date, 'America/Los_Angeles');
    // Should contain abbreviated day and month
    expect(result).toMatch(/\w{3},?\s*\w{3}\s*\d{1,2}/);
  });
});

describe('formatDateLong', () => {
  it('should format date in long format', () => {
    const date = new Date('2025-01-09');
    const result = formatDateLong(date, 'America/Los_Angeles');
    // Should contain full day name, month, and year
    expect(result).toContain('2025');
  });
});

// ============================================================================
// Format Weather Object Tests
// ============================================================================

describe('formatHourlyWeather', () => {
  it('should format all hourly weather properties', () => {
    const weather = createMockHourlyWeather();
    const result = formatHourlyWeather(weather);

    expect(result).toHaveProperty('temperature');
    expect(result).toHaveProperty('feelsLike');
    expect(result).toHaveProperty('wind');
    expect(result).toHaveProperty('precipitation');
    expect(result).toHaveProperty('cloudDescription');
    expect(result).toHaveProperty('dateShort');
    expect(result).toHaveProperty('dateLong');
    expect(result).toHaveProperty('time');
  });

  it('should format temperature correctly', () => {
    const weather = createMockHourlyWeather({ temperature: 72 });
    const result = formatHourlyWeather(weather);
    expect(result.temperature).toBe('72°F');
  });

  it('should format feels like with prefix', () => {
    const weather = createMockHourlyWeather({ feelsLike: 68 });
    const result = formatHourlyWeather(weather);
    expect(result.feelsLike).toBe('Feels like 68°F');
  });

  it('should format wind with speed and direction', () => {
    const weather = createMockHourlyWeather({ windSpeed: 15, windDirection: 180 });
    const result = formatHourlyWeather(weather);
    expect(result.wind).toBe('15 mph S');
  });

  it('should format precipitation as percentage', () => {
    const weather = createMockHourlyWeather({ precipitationProbability: 30 });
    const result = formatHourlyWeather(weather);
    expect(result.precipitation).toBe('30%');
  });

  it('should include cloud description', () => {
    const weather = createMockHourlyWeather({ cloudCover: 45 });
    const result = formatHourlyWeather(weather);
    expect(result.cloudDescription).toBe('Partly Cloudy');
  });
});

describe('formatDailyWeather', () => {
  it('should format all daily weather properties', () => {
    const weather = createMockDailyWeather();
    const result = formatDailyWeather(weather);

    expect(result).toHaveProperty('dayShort');
    expect(result).toHaveProperty('dayLong');
    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('temperatureRange');
    expect(result).toHaveProperty('windMax');
    expect(result).toHaveProperty('precipitation');
    expect(result).toHaveProperty('sunrise');
    expect(result).toHaveProperty('sunset');
  });

  it('should format temperature range with high/low', () => {
    const weather = createMockDailyWeather({ temperatureMax: 75, temperatureMin: 55 });
    const result = formatDailyWeather(weather);
    expect(result.temperatureRange).toBe('75°F / 55°F');
  });

  it('should include day name', () => {
    // Create a date that we know the day for (using UTC to avoid timezone issues)
    // January 9, 2025 at noon UTC is Thursday
    const dateObj = new Date(Date.UTC(2025, 0, 9, 12, 0, 0));
    const weather = createMockDailyWeather({ dateObj });
    const result = formatDailyWeather(weather);
    // Get the expected day based on what the date actually resolves to
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const expectedDayLong = dayNames[dateObj.getDay()];
    const expectedDayShort = expectedDayLong.slice(0, 3);
    expect(result.dayShort).toBe(expectedDayShort);
    expect(result.dayLong).toBe(expectedDayLong);
  });
});

// ============================================================================
// API Function Tests with Mocked Fetch
// ============================================================================

describe('getHourlyForecast', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('successful requests', () => {
    it('should return hourly forecast data with playability scores', async () => {
      const mockResponse = createMockHourlyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getHourlyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeInstanceOf(Array);
        expect(result.data.length).toBe(5);
        expect(result.data[0]).toHaveProperty('playability');
        expect(result.data[0].playability).toHaveProperty('score');
        expect(result.data[0].playability).toHaveProperty('rating');
      }
    });

    it('should parse all hourly data fields correctly', async () => {
      const mockResponse = createMockHourlyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getHourlyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(true);
      if (result.success) {
        const firstHour = result.data[0];
        expect(firstHour.temperature).toBe(55);
        expect(firstHour.feelsLike).toBe(52);
        expect(firstHour.precipitationProbability).toBe(0);
        expect(firstHour.windSpeed).toBe(3);
        expect(firstHour.windDirection).toBe(270);
        expect(firstHour.cloudCover).toBe(10);
      }
    });

    it('should use default options when not provided', async () => {
      const mockResponse = createMockHourlyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getHourlyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(fetch).toHaveBeenCalledTimes(1);
      const url = vi.mocked(fetch).mock.calls[0][0];
      expect(url).toContain('forecast_hours=48');
      expect(url).toContain('timezone=America%2FLos_Angeles');
    });

    it('should use custom options when provided', async () => {
      const mockResponse = createMockHourlyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getHourlyForecast(
        { latitude: 37.7749, longitude: -122.4194 },
        { hours: 24, timezone: 'America/New_York' }
      );

      const url = vi.mocked(fetch).mock.calls[0][0];
      expect(url).toContain('forecast_hours=24');
      expect(url).toContain('timezone=America%2FNew_York');
    });
  });

  describe('coordinate validation', () => {
    it('should reject invalid latitude (too high)', async () => {
      const result = await getHourlyForecast({ latitude: 91, longitude: -122.4194 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_COORDINATES');
        expect(result.error.message).toContain('Latitude');
      }
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should reject invalid latitude (too low)', async () => {
      const result = await getHourlyForecast({ latitude: -91, longitude: -122.4194 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_COORDINATES');
      }
    });

    it('should reject invalid longitude (too high)', async () => {
      const result = await getHourlyForecast({ latitude: 37.7749, longitude: 181 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_COORDINATES');
        expect(result.error.message).toContain('Longitude');
      }
    });

    it('should reject invalid longitude (too low)', async () => {
      const result = await getHourlyForecast({ latitude: 37.7749, longitude: -181 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_COORDINATES');
      }
    });

    it('should accept valid edge case coordinates', async () => {
      const mockResponse = createMockHourlyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // Valid: exactly at boundaries
      const result = await getHourlyForecast({ latitude: 90, longitude: 180 });
      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API errors (non-200 response)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
      });

      const result = await getHourlyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
        expect(result.error.message).toContain('500');
      }
    });

    it('should handle rate limiting (429 response)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'Too many requests' }),
      });

      const result = await getHourlyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMITED');
        expect(result.error.message).toContain('Too many requests');
      }
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));

      const result = await getHourlyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toContain('Network failure');
      }
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      vi.mocked(fetch).mockRejectedValue(abortError);

      const result = await getHourlyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toContain('timed out');
      }
    });

    it('should handle JSON parse errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await getHourlyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(false);
      // Should still return an error even if JSON parsing fails
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
      }
    });
  });
});

describe('getDailyForecast', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('successful requests', () => {
    it('should return daily forecast data with playability scores', async () => {
      const mockResponse = createMockDailyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getDailyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeInstanceOf(Array);
        expect(result.data.length).toBe(3);
        expect(result.data[0]).toHaveProperty('playability');
        expect(result.data[0]).toHaveProperty('sunrise');
        expect(result.data[0]).toHaveProperty('sunset');
      }
    });

    it('should parse all daily data fields correctly', async () => {
      const mockResponse = createMockDailyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getDailyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(true);
      if (result.success) {
        const firstDay = result.data[0];
        expect(firstDay.temperatureMax).toBe(72);
        expect(firstDay.temperatureMin).toBe(52);
        expect(firstDay.precipitationProbability).toBe(10);
        expect(firstDay.windSpeedMax).toBe(12);
        expect(firstDay.windDirection).toBe(270);
      }
    });

    it('should use default options when not provided', async () => {
      const mockResponse = createMockDailyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getDailyForecast({ latitude: 37.7749, longitude: -122.4194 });

      const url = vi.mocked(fetch).mock.calls[0][0];
      expect(url).toContain('forecast_days=7');
    });

    it('should use custom options when provided', async () => {
      const mockResponse = createMockDailyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getDailyForecast(
        { latitude: 37.7749, longitude: -122.4194 },
        { days: 14 }
      );

      const url = vi.mocked(fetch).mock.calls[0][0];
      expect(url).toContain('forecast_days=14');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server Error' }),
      });

      const result = await getDailyForecast({ latitude: 37.7749, longitude: -122.4194 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
      }
    });

    it('should validate coordinates', async () => {
      const result = await getDailyForecast({ latitude: 200, longitude: 0 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_COORDINATES');
      }
    });
  });
});

describe('getFullForecast', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return both hourly and daily data in one request', async () => {
    const mockResponse = {
      ...createMockHourlyResponse(),
      ...createMockDailyResponse(),
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await getFullForecast({ latitude: 37.7749, longitude: -122.4194 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('hourly');
      expect(result.data).toHaveProperty('daily');
      expect(result.data).toHaveProperty('location');
      expect(result.data).toHaveProperty('timezone');
      expect(result.data).toHaveProperty('fetchedAt');
      expect(result.data.hourly).toBeInstanceOf(Array);
      expect(result.data.daily).toBeInstanceOf(Array);
    }
  });

  it('should include location coordinates in response', async () => {
    const mockResponse = {
      ...createMockHourlyResponse(),
      ...createMockDailyResponse(),
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await getFullForecast({ latitude: 37.7749, longitude: -122.4194 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.location.latitude).toBe(37.7749);
      expect(result.data.location.longitude).toBe(-122.4194);
    }
  });

  it('should validate coordinates', async () => {
    const result = await getFullForecast({ latitude: 95, longitude: -122.4194 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_COORDINATES');
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('findBestTeeTime', () => {
  it('should find the hour with highest playability score', () => {
    const hourlyData = [
      createMockHourlyWithPlayability(8, 75),
      createMockHourlyWithPlayability(9, 90),
      createMockHourlyWithPlayability(10, 85),
      createMockHourlyWithPlayability(11, 80),
    ];

    const best = findBestTeeTime(hourlyData);

    expect(best).not.toBeNull();
    expect(best?.date.getHours()).toBe(9);
    expect(best?.playability.score).toBe(90);
  });

  it('should respect startHour and endHour constraints', () => {
    const hourlyData = [
      createMockHourlyWithPlayability(5, 95),  // Before start
      createMockHourlyWithPlayability(8, 80),
      createMockHourlyWithPlayability(10, 85),
      createMockHourlyWithPlayability(19, 95), // After end
    ];

    const best = findBestTeeTime(hourlyData, { startHour: 6, endHour: 18 });

    expect(best).not.toBeNull();
    expect(best?.date.getHours()).toBe(10);
  });

  it('should respect minimum score threshold', () => {
    const hourlyData = [
      createMockHourlyWithPlayability(8, 40),
      createMockHourlyWithPlayability(9, 45),
      createMockHourlyWithPlayability(10, 48),
    ];

    const best = findBestTeeTime(hourlyData, { minScore: 50 });

    expect(best).toBeNull();
  });

  it('should return null for empty data', () => {
    const best = findBestTeeTime([]);
    expect(best).toBeNull();
  });

  it('should use default options', () => {
    const hourlyData = [
      createMockHourlyWithPlayability(6, 85),  // At default start
      createMockHourlyWithPlayability(12, 90),
      createMockHourlyWithPlayability(18, 88), // At default end
    ];

    const best = findBestTeeTime(hourlyData);
    expect(best?.playability.score).toBe(90);
  });
});

describe('findBestDay', () => {
  it('should find the day with highest playability score', () => {
    const dailyData = [
      { ...createMockDailyWeather(), playability: { score: 75, rating: 'good' } },
      { ...createMockDailyWeather(), playability: { score: 90, rating: 'excellent' } },
      { ...createMockDailyWeather(), playability: { score: 80, rating: 'good' } },
    ];

    const best = findBestDay(dailyData);

    expect(best).not.toBeNull();
    expect(best?.playability.score).toBe(90);
  });

  it('should respect minimum score threshold', () => {
    const dailyData = [
      { ...createMockDailyWeather(), playability: { score: 40, rating: 'poor' } },
      { ...createMockDailyWeather(), playability: { score: 45, rating: 'poor' } },
    ];

    const best = findBestDay(dailyData, 50);

    expect(best).toBeNull();
  });

  it('should return null for empty data', () => {
    const best = findBestDay([]);
    expect(best).toBeNull();
  });
});

describe('getWeatherSummaryForDate', () => {
  it('should return morning and afternoon weather for a specific date', () => {
    const targetDate = new Date('2025-01-09');
    const hourlyData = [
      createMockHourlyWithPlayability(9, 85),   // 9 AM
      createMockHourlyWithPlayability(14, 80),  // 2 PM
    ];
    // Set the date to match target date
    hourlyData.forEach(h => {
      h.date = new Date('2025-01-09');
      h.date.setHours(hourlyData.indexOf(h) === 0 ? 9 : 14, 0, 0, 0);
    });

    const summary = getWeatherSummaryForDate(hourlyData, targetDate);

    expect(summary.morning).not.toBeNull();
    expect(summary.afternoon).not.toBeNull();
    expect(summary.avgPlayability).toBeGreaterThan(0);
  });

  it('should return null for morning/afternoon if not available', () => {
    const targetDate = new Date('2025-01-09');
    const hourlyData = [
      createMockHourlyWithPlayability(12, 85), // Only noon data
    ];
    hourlyData[0].date = new Date('2025-01-09T12:00:00');

    const summary = getWeatherSummaryForDate(hourlyData, targetDate);

    expect(summary.morning).toBeNull();
    expect(summary.afternoon).toBeNull();
  });

  it('should return 0 average for empty data', () => {
    const targetDate = new Date('2025-01-09');
    const summary = getWeatherSummaryForDate([], targetDate);

    expect(summary.avgPlayability).toBe(0);
    expect(summary.morning).toBeNull();
    expect(summary.afternoon).toBeNull();
  });

  it('should only include hours from the target date', () => {
    // Use a common base date - create dates using explicit year/month/day/hour
    const targetDate = new Date(2025, 0, 9); // January 9, 2025 (local time)

    // Create a date on a DIFFERENT day (Jan 10) at 9 AM
    const morningDate = new Date(2025, 0, 10, 9, 0, 0); // Jan 10, 9 AM

    // Create a date on the TARGET day (Jan 9) at 2 PM (hour 14)
    const afternoonDate = new Date(2025, 0, 9, 14, 0, 0); // Jan 9, 2 PM

    const morningOnDifferentDate = {
      time: morningDate.toISOString(),
      date: morningDate,
      temperature: 72,
      feelsLike: 70,
      precipitationProbability: 10,
      windSpeed: 8,
      windDirection: 270,
      cloudCover: 30,
      playability: {
        score: 85,
        rating: 'excellent',
        factors: { temperature: 100, wind: 80, precipitation: 90, cloudCover: 100 },
        summary: 'Great conditions',
        recommendations: ['Enjoy your round!'],
      },
    };

    const afternoonOnTargetDate = {
      time: afternoonDate.toISOString(),
      date: afternoonDate,
      temperature: 72,
      feelsLike: 70,
      precipitationProbability: 10,
      windSpeed: 8,
      windDirection: 270,
      cloudCover: 30,
      playability: {
        score: 80,
        rating: 'good',
        factors: { temperature: 100, wind: 80, precipitation: 90, cloudCover: 100 },
        summary: 'Great conditions',
        recommendations: ['Enjoy your round!'],
      },
    };

    const hourlyData = [morningOnDifferentDate, afternoonOnTargetDate];
    const summary = getWeatherSummaryForDate(hourlyData, targetDate);

    // Should only find afternoon since morning is on different date (Jan 10 vs Jan 9)
    expect(summary.morning).toBeNull();
    expect(summary.afternoon).not.toBeNull();
    expect(summary.afternoon?.playability.score).toBe(80);
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Edge Cases', () => {
  describe('boundary values', () => {
    it('should handle temperature at absolute zero (theoretical)', () => {
      const score = calculateTemperatureScore(-459.67);
      expect(score).toBe(0);
    });

    it('should handle extremely high temperatures', () => {
      const score = calculateTemperatureScore(150);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero wind', () => {
      const score = calculateWindScore(0);
      expect(score).toBe(100);
    });

    it('should handle hurricane force winds', () => {
      const score = calculateWindScore(75);
      expect(score).toBe(0);
    });
  });

  describe('decimal values', () => {
    it('should handle decimal temperatures', () => {
      const score = calculateTemperatureScore(72.5);
      expect(score).toBe(100);
    });

    it('should handle decimal wind speeds', () => {
      const score1 = calculateWindScore(5.0);
      const score2 = calculateWindScore(5.1);
      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle decimal precipitation probabilities', () => {
      const score = calculatePrecipitationScore(33.33);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });
  });

  describe('API URL construction', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('should construct correct API URL with all parameters', async () => {
      const mockResponse = createMockHourlyResponse();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getHourlyForecast(
        { latitude: 37.7749, longitude: -122.4194 },
        { hours: 24, timezone: 'America/Los_Angeles' }
      );

      const url = vi.mocked(fetch).mock.calls[0][0];
      expect(url).toContain('api.open-meteo.com');
      expect(url).toContain('latitude=37.7749');
      expect(url).toContain('longitude=-122.4194');
      expect(url).toContain('temperature_unit=fahrenheit');
      expect(url).toContain('wind_speed_unit=mph');
    });
  });
});
