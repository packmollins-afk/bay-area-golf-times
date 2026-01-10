/**
 * Weather Service Tests
 * Comprehensive test suite for the Open-Meteo weather service
 *
 * Run with: npx ts-node services/weather.test.ts
 * Or with a test runner like Jest/Vitest after proper setup
 */

import {
  // Playability calculation functions
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
  formatHourlyWeather,
  formatDailyWeather,

  // Utility functions
  findBestTeeTime,
  findBestDay,
  getWeatherSummaryForDate,

  // API functions
  getHourlyForecast,
  getDailyForecast,
  getFullForecast,
} from './weather';

import type {
  HourlyWeather,
  DailyWeather,
  HourlyWeatherWithPlayability,
  DailyWeatherWithPlayability,
  PlayabilityRating,
} from './weather.types';

// ============================================================================
// Test Utilities
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    testResults.push({ name, passed: true });
    console.log(`  PASS: ${name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    testResults.push({ name, passed: false, error: errorMsg });
    console.log(`  FAIL: ${name}`);
    console.log(`        ${errorMsg}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertInRange(value: number, min: number, max: number, message?: string): void {
  if (value < min || value > max) {
    throw new Error(
      message || `Expected value between ${min} and ${max}, got ${value}`
    );
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message || `Expected true, got false`);
  }
}

function assertFalse(value: boolean, message?: string): void {
  if (value) {
    throw new Error(message || `Expected false, got true`);
  }
}

function assertNotNull<T>(value: T | null, message?: string): asserts value is T {
  if (value === null) {
    throw new Error(message || `Expected non-null value, got null`);
  }
}

function assertNull<T>(value: T | null, message?: string): void {
  if (value !== null) {
    throw new Error(message || `Expected null, got ${JSON.stringify(value)}`);
  }
}

// ============================================================================
// Mock Data Factories
// ============================================================================

function createMockHourlyWeather(overrides: Partial<HourlyWeather> = {}): HourlyWeather {
  const now = new Date();
  return {
    time: now.toISOString(),
    date: now,
    temperature: 72,
    feelsLike: 70,
    precipitationProbability: 10,
    windSpeed: 8,
    windDirection: 270,
    cloudCover: 30,
    ...overrides,
  };
}

function createMockDailyWeather(overrides: Partial<DailyWeather> = {}): DailyWeather {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],
    dateObj: now,
    temperatureMax: 75,
    temperatureMin: 58,
    feelsLikeMax: 73,
    feelsLikeMin: 56,
    precipitationProbability: 15,
    windSpeedMax: 12,
    windDirection: 315,
    sunrise: '2025-01-09T07:24:00',
    sunset: '2025-01-09T17:18:00',
    ...overrides,
  };
}

function createMockHourlyWithPlayability(
  overrides: Partial<HourlyWeather> = {}
): HourlyWeatherWithPlayability {
  const hourly = createMockHourlyWeather(overrides);
  const playability = calculatePlayabilityScore(
    hourly.temperature,
    hourly.windSpeed,
    hourly.precipitationProbability,
    hourly.cloudCover
  );
  return { ...hourly, playability };
}

function createMockDailyWithPlayability(
  overrides: Partial<DailyWeather> = {}
): DailyWeatherWithPlayability {
  const daily = createMockDailyWeather(overrides);
  const avgTemp = (daily.temperatureMax + daily.temperatureMin) / 2;
  const playability = calculatePlayabilityScore(
    avgTemp,
    daily.windSpeedMax,
    daily.precipitationProbability,
    50 // estimated cloud cover
  );
  return { ...daily, playability };
}

// ============================================================================
// Temperature Score Tests
// ============================================================================

console.log('\n--- Temperature Score Tests ---');

test('Perfect temperature (72F) should score 100', () => {
  const score = calculateTemperatureScore(72);
  assertEqual(score, 100);
});

test('Temperature in ideal range (65-80F) should score 100', () => {
  assertEqual(calculateTemperatureScore(65), 100);
  assertEqual(calculateTemperatureScore(70), 100);
  assertEqual(calculateTemperatureScore(80), 100);
});

test('Cold temperature (50F) should score well but not perfect', () => {
  const score = calculateTemperatureScore(50);
  assertInRange(score, 50, 85);
});

test('Very cold temperature (35F) should score poorly', () => {
  const score = calculateTemperatureScore(35);
  assertInRange(score, 10, 40);
});

test('Hot temperature (90F) should score moderately', () => {
  const score = calculateTemperatureScore(90);
  assertInRange(score, 50, 85);
});

test('Very hot temperature (100F) should score poorly', () => {
  const score = calculateTemperatureScore(100);
  assertInRange(score, 10, 45);
});

test('Extreme cold (25F) should score very low', () => {
  const score = calculateTemperatureScore(25);
  assertInRange(score, 0, 20);
});

// ============================================================================
// Wind Score Tests
// ============================================================================

console.log('\n--- Wind Score Tests ---');

test('Calm wind (3 mph) should score 100', () => {
  const score = calculateWindScore(3);
  assertEqual(score, 100);
});

test('Light wind (5 mph) should score 100', () => {
  const score = calculateWindScore(5);
  assertEqual(score, 100);
});

test('Moderate wind (12 mph) should score well', () => {
  const score = calculateWindScore(12);
  assertInRange(score, 65, 85);
});

test('Strong wind (20 mph) should score moderately', () => {
  const score = calculateWindScore(20);
  assertInRange(score, 35, 55);
});

test('Very strong wind (30 mph) should score poorly', () => {
  const score = calculateWindScore(30);
  assertInRange(score, 5, 25);
});

test('Extreme wind (40 mph) should score near zero', () => {
  const score = calculateWindScore(40);
  assertInRange(score, 0, 10);
});

// ============================================================================
// Precipitation Score Tests
// ============================================================================

console.log('\n--- Precipitation Score Tests ---');

test('No precipitation (0%) should score 100', () => {
  const score = calculatePrecipitationScore(0);
  assertEqual(score, 100);
});

test('Low precipitation chance (10%) should score very well', () => {
  const score = calculatePrecipitationScore(10);
  assertInRange(score, 85, 100);
});

test('Moderate precipitation chance (30%) should score moderately', () => {
  const score = calculatePrecipitationScore(30);
  assertInRange(score, 55, 75);
});

test('High precipitation chance (60%) should score poorly', () => {
  const score = calculatePrecipitationScore(60);
  assertInRange(score, 15, 35);
});

test('Certain precipitation (100%) should score very low', () => {
  const score = calculatePrecipitationScore(100);
  assertInRange(score, 0, 15);
});

// ============================================================================
// Cloud Cover Score Tests
// ============================================================================

console.log('\n--- Cloud Cover Score Tests ---');

test('Clear skies (0%) should score very well', () => {
  const score = calculateCloudCoverScore(0);
  assertInRange(score, 85, 100);
});

test('Partly cloudy (30%) - ideal for golf - should score 100', () => {
  const score = calculateCloudCoverScore(30);
  assertEqual(score, 100);
});

test('Mostly cloudy (70%) should score moderately', () => {
  const score = calculateCloudCoverScore(70);
  assertInRange(score, 60, 85);
});

test('Overcast (100%) should score lowest but still acceptable', () => {
  const score = calculateCloudCoverScore(100);
  assertInRange(score, 45, 65);
});

// ============================================================================
// Playability Rating Tests
// ============================================================================

console.log('\n--- Playability Rating Tests ---');

test('Score 90 should be excellent', () => {
  assertEqual(getPlayabilityRating(90), 'excellent');
});

test('Score 85 should be excellent', () => {
  assertEqual(getPlayabilityRating(85), 'excellent');
});

test('Score 75 should be good', () => {
  assertEqual(getPlayabilityRating(75), 'good');
});

test('Score 60 should be fair', () => {
  assertEqual(getPlayabilityRating(60), 'fair');
});

test('Score 40 should be poor', () => {
  assertEqual(getPlayabilityRating(40), 'poor');
});

test('Score 20 should be unplayable', () => {
  assertEqual(getPlayabilityRating(20), 'unplayable');
});

// ============================================================================
// Comprehensive Playability Score Tests
// ============================================================================

console.log('\n--- Comprehensive Playability Score Tests ---');

test('Perfect conditions should score excellent', () => {
  const result = calculatePlayabilityScore(72, 5, 0, 30);
  assertEqual(result.rating, 'excellent');
  assertInRange(result.score, 95, 100);
  assertTrue(result.recommendations.length > 0);
});

test('Good conditions should score good', () => {
  const result = calculatePlayabilityScore(68, 12, 15, 40);
  assertInRange(result.score, 70, 90);
  assertTrue(result.rating === 'excellent' || result.rating === 'good');
});

test('Challenging wind should lower score', () => {
  const result = calculatePlayabilityScore(72, 25, 0, 30);
  assertInRange(result.score, 50, 75);
  assertTrue(result.factors.wind < 50);
});

test('High rain chance should lower score', () => {
  const result = calculatePlayabilityScore(72, 5, 70, 30);
  assertInRange(result.score, 40, 70);
  assertTrue(result.factors.precipitation < 40);
});

test('Cold weather should provide appropriate recommendations', () => {
  const result = calculatePlayabilityScore(45, 10, 0, 30);
  assertTrue(
    result.recommendations.some(r => r.toLowerCase().includes('layer') || r.toLowerCase().includes('jacket'))
  );
});

test('Hot weather should provide hydration recommendations', () => {
  const result = calculatePlayabilityScore(95, 5, 0, 10);
  assertTrue(
    result.recommendations.some(r => r.toLowerCase().includes('water') || r.toLowerCase().includes('hydrat'))
  );
});

test('Windy conditions should provide wind recommendations', () => {
  const result = calculatePlayabilityScore(72, 22, 0, 30);
  assertTrue(
    result.recommendations.some(r => r.toLowerCase().includes('wind') || r.toLowerCase().includes('club'))
  );
});

// ============================================================================
// Cardinal Direction Tests
// ============================================================================

console.log('\n--- Cardinal Direction Tests ---');

test('0 degrees should be N', () => {
  assertEqual(degreesToCardinal(0), 'N');
});

test('45 degrees should be NE', () => {
  assertEqual(degreesToCardinal(45), 'NE');
});

test('90 degrees should be E', () => {
  assertEqual(degreesToCardinal(90), 'E');
});

test('180 degrees should be S', () => {
  assertEqual(degreesToCardinal(180), 'S');
});

test('270 degrees should be W', () => {
  assertEqual(degreesToCardinal(270), 'W');
});

test('360 degrees should be N', () => {
  assertEqual(degreesToCardinal(360), 'N');
});

test('Negative degrees should work correctly', () => {
  assertEqual(degreesToCardinal(-90), 'W');
});

// ============================================================================
// Cloud Description Tests
// ============================================================================

console.log('\n--- Cloud Description Tests ---');

test('0% clouds should be Clear', () => {
  assertEqual(getCloudDescription(0), 'Clear');
});

test('20% clouds should be Mostly Clear', () => {
  assertEqual(getCloudDescription(20), 'Mostly Clear');
});

test('40% clouds should be Partly Cloudy', () => {
  assertEqual(getCloudDescription(40), 'Partly Cloudy');
});

test('60% clouds should be Mostly Cloudy', () => {
  assertEqual(getCloudDescription(60), 'Mostly Cloudy');
});

test('85% clouds should be Cloudy', () => {
  assertEqual(getCloudDescription(85), 'Cloudy');
});

test('95% clouds should be Overcast', () => {
  assertEqual(getCloudDescription(95), 'Overcast');
});

// ============================================================================
// Format Function Tests
// ============================================================================

console.log('\n--- Format Function Tests ---');

test('formatTemperature should format correctly', () => {
  assertEqual(formatTemperature(72), '72°F');
  assertEqual(formatTemperature(72.4), '72°F');
  assertEqual(formatTemperature(72.6), '73°F');
});

test('formatWind should format correctly', () => {
  const result = formatWind(12, 270);
  assertTrue(result.includes('12'));
  assertTrue(result.includes('mph'));
  assertTrue(result.includes('W'));
});

test('formatPrecipitation should format correctly', () => {
  assertEqual(formatPrecipitation(30), '30%');
  assertEqual(formatPrecipitation(30.4), '30%');
});

// ============================================================================
// Best Tee Time Tests
// ============================================================================

console.log('\n--- Best Tee Time Tests ---');

test('findBestTeeTime should find highest scoring hour in range', () => {
  const now = new Date();
  const hours: HourlyWeatherWithPlayability[] = [];

  // Create hours from 6 AM to 6 PM
  for (let h = 6; h <= 18; h++) {
    const hourDate = new Date(now);
    hourDate.setHours(h, 0, 0, 0);

    // Make 10 AM the best time (perfect conditions)
    const windSpeed = h === 10 ? 3 : 15;

    hours.push(createMockHourlyWithPlayability({
      time: hourDate.toISOString(),
      date: hourDate,
      windSpeed,
    }));
  }

  const best = findBestTeeTime(hours);
  assertNotNull(best);
  assertEqual(best.date.getHours(), 10);
});

test('findBestTeeTime should return null if no hours meet minimum score', () => {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  // Create terrible conditions
  const hours = [createMockHourlyWithPlayability({
    time: now.toISOString(),
    date: now,
    windSpeed: 40,
    precipitationProbability: 90,
    temperature: 105,
  })];

  const result = findBestTeeTime(hours, { minScore: 50 });
  assertNull(result);
});

test('findBestTeeTime should respect hour range', () => {
  const now = new Date();
  const hours: HourlyWeatherWithPlayability[] = [];

  // Create hours, with 5 AM having perfect conditions (outside default range)
  for (let h = 5; h <= 20; h++) {
    const hourDate = new Date(now);
    hourDate.setHours(h, 0, 0, 0);

    const windSpeed = h === 5 ? 0 : 20; // 5 AM is best but out of range

    hours.push(createMockHourlyWithPlayability({
      time: hourDate.toISOString(),
      date: hourDate,
      windSpeed,
    }));
  }

  const best = findBestTeeTime(hours, { startHour: 6, endHour: 18 });
  assertNotNull(best);
  assertTrue(best.date.getHours() >= 6);
  assertTrue(best.date.getHours() <= 18);
});

// ============================================================================
// Best Day Tests
// ============================================================================

console.log('\n--- Best Day Tests ---');

test('findBestDay should find highest scoring day', () => {
  const days: DailyWeatherWithPlayability[] = [];

  for (let d = 0; d < 5; d++) {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() + d);

    // Make day 2 the best (lowest wind)
    const windSpeedMax = d === 2 ? 5 : 20;

    days.push(createMockDailyWithPlayability({
      date: dayDate.toISOString().split('T')[0],
      dateObj: dayDate,
      windSpeedMax,
    }));
  }

  const best = findBestDay(days);
  assertNotNull(best);
  const dayIndex = new Date(best.date).getDate() - new Date().getDate();
  assertEqual(dayIndex, 2);
});

// ============================================================================
// Weather Summary Tests
// ============================================================================

console.log('\n--- Weather Summary Tests ---');

test('getWeatherSummaryForDate should find morning and afternoon hours', () => {
  const targetDate = new Date();
  targetDate.setHours(0, 0, 0, 0);

  const hours: HourlyWeatherWithPlayability[] = [];

  for (let h = 6; h <= 18; h++) {
    const hourDate = new Date(targetDate);
    hourDate.setHours(h, 0, 0, 0);

    hours.push(createMockHourlyWithPlayability({
      time: hourDate.toISOString(),
      date: hourDate,
    }));
  }

  const summary = getWeatherSummaryForDate(hours, targetDate);
  assertNotNull(summary.morning);
  assertNotNull(summary.afternoon);
  assertEqual(summary.morning.date.getHours(), 9);
  assertEqual(summary.afternoon.date.getHours(), 14);
  assertTrue(summary.avgPlayability > 0);
});

test('getWeatherSummaryForDate should handle missing hours', () => {
  const targetDate = new Date();
  targetDate.setHours(12, 0, 0, 0);

  // Only include noon hour
  const hours: HourlyWeatherWithPlayability[] = [
    createMockHourlyWithPlayability({
      time: targetDate.toISOString(),
      date: targetDate,
    }),
  ];

  const summary = getWeatherSummaryForDate(hours, targetDate);
  assertNull(summary.morning);
  assertNull(summary.afternoon);
  assertTrue(summary.avgPlayability > 0);
});

// ============================================================================
// Integration Tests (API calls - optional, can be skipped in CI)
// ============================================================================

async function runIntegrationTests(): Promise<void> {
  console.log('\n--- Integration Tests (Live API) ---');

  // San Francisco coordinates
  const coords = { latitude: 37.7749, longitude: -122.4194 };

  test('getHourlyForecast should return valid data', async () => {
    const result = await getHourlyForecast(coords, { hours: 24 });

    assertTrue(result.success, 'API call should succeed');
    if (result.success) {
      assertTrue(result.data.length > 0, 'Should have hourly data');
      assertTrue(result.data.length <= 24, 'Should respect hours limit');

      const firstHour = result.data[0];
      assertTrue(typeof firstHour.temperature === 'number');
      assertTrue(typeof firstHour.playability.score === 'number');
      assertInRange(firstHour.playability.score, 0, 100);
    }
  });

  test('getDailyForecast should return valid data', async () => {
    const result = await getDailyForecast(coords, { days: 3 });

    assertTrue(result.success, 'API call should succeed');
    if (result.success) {
      assertTrue(result.data.length > 0, 'Should have daily data');
      assertTrue(result.data.length <= 3, 'Should respect days limit');

      const firstDay = result.data[0];
      assertTrue(typeof firstDay.temperatureMax === 'number');
      assertTrue(firstDay.temperatureMax >= firstDay.temperatureMin);
    }
  });

  test('getFullForecast should return both hourly and daily', async () => {
    const result = await getFullForecast(coords);

    assertTrue(result.success, 'API call should succeed');
    if (result.success) {
      assertTrue(result.data.hourly.length > 0);
      assertTrue(result.data.daily.length > 0);
      assertTrue(result.data.timezone.length > 0);
      assertEqual(result.data.location.latitude, coords.latitude);
    }
  });

  test('Invalid coordinates should return error', async () => {
    const result = await getHourlyForecast({ latitude: 999, longitude: -122 });

    assertFalse(result.success);
    if (!result.success) {
      assertEqual(result.error.code, 'INVALID_COORDINATES');
    }
  });
}

// ============================================================================
// Run Tests
// ============================================================================

async function main(): Promise<void> {
  console.log('Running Weather Service Tests...\n');

  // Check if we should run integration tests
  const runIntegration = process.argv.includes('--integration');

  if (runIntegration) {
    await runIntegrationTests();
  } else {
    console.log('(Skipping integration tests - run with --integration flag to include them)\n');
  }

  // Summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;

  console.log(`Total: ${testResults.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    testResults
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  - ${r.name}`);
        console.log(`    ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
