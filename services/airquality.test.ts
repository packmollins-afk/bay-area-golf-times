/**
 * Air Quality Service Unit Tests
 * Tests for helper functions and service logic
 *
 * Run with: npx ts-node --esm services/airquality.test.ts
 * Or integrate with your test framework (Jest, Vitest, etc.)
 */

import {
  getAQICategory,
  getGolfRecommendation,
  getGolfRecommendationLevel,
  shouldWarnUser,
  shouldSuggestReschedule,
  getAirQualitySummary,
  GOLF_AQI_THRESHOLDS,
  AirQualityService,
  createAirQualityService,
} from './airquality';

// ============================================================================
// Test Utilities
// ============================================================================

let testsRun = 0;
let testsPassed = 0;

function test(description: string, fn: () => void): void {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`  PASS: ${description}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  FAIL: ${description}`);
    console.log(`        ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
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

function assertIncludes(array: unknown[], value: unknown, message?: string): void {
  if (!array.includes(value)) {
    throw new Error(message || `Expected array to include ${JSON.stringify(value)}`);
  }
}

// ============================================================================
// getAQICategory Tests
// ============================================================================

function testGetAQICategory(): void {
  console.log('\ngetAQICategory():');

  test('returns "good" for AQI 0', () => {
    const result = getAQICategory(0);
    assertEqual(result.level, 'good');
    assertEqual(result.name, 'Good');
  });

  test('returns "good" for AQI 50', () => {
    const result = getAQICategory(50);
    assertEqual(result.level, 'good');
  });

  test('returns "moderate" for AQI 51', () => {
    const result = getAQICategory(51);
    assertEqual(result.level, 'moderate');
    assertEqual(result.name, 'Moderate');
  });

  test('returns "moderate" for AQI 100', () => {
    const result = getAQICategory(100);
    assertEqual(result.level, 'moderate');
  });

  test('returns "unhealthy_sensitive" for AQI 101', () => {
    const result = getAQICategory(101);
    assertEqual(result.level, 'unhealthy_sensitive');
    assertEqual(result.name, 'Unhealthy for Sensitive Groups');
  });

  test('returns "unhealthy_sensitive" for AQI 150', () => {
    const result = getAQICategory(150);
    assertEqual(result.level, 'unhealthy_sensitive');
  });

  test('returns "unhealthy" for AQI 151', () => {
    const result = getAQICategory(151);
    assertEqual(result.level, 'unhealthy');
    assertEqual(result.name, 'Unhealthy');
  });

  test('returns "unhealthy" for AQI 200', () => {
    const result = getAQICategory(200);
    assertEqual(result.level, 'unhealthy');
  });

  test('returns "very_unhealthy" for AQI 201', () => {
    const result = getAQICategory(201);
    assertEqual(result.level, 'very_unhealthy');
    assertEqual(result.name, 'Very Unhealthy');
  });

  test('returns "hazardous" for AQI 301', () => {
    const result = getAQICategory(301);
    assertEqual(result.level, 'hazardous');
    assertEqual(result.name, 'Hazardous');
  });

  test('returns "hazardous" for AQI 500+', () => {
    const result = getAQICategory(999);
    assertEqual(result.level, 'hazardous');
  });

  test('handles negative AQI gracefully', () => {
    const result = getAQICategory(-10);
    assertEqual(result.level, 'good');
  });

  test('includes correct color for each category', () => {
    assertEqual(getAQICategory(25).color, '#00E400'); // Good - Green
    assertEqual(getAQICategory(75).color, '#FFFF00'); // Moderate - Yellow
    assertEqual(getAQICategory(125).color, '#FF7E00'); // Unhealthy Sensitive - Orange
    assertEqual(getAQICategory(175).color, '#FF0000'); // Unhealthy - Red
    assertEqual(getAQICategory(250).color, '#8F3F97'); // Very Unhealthy - Purple
    assertEqual(getAQICategory(400).color, '#7E0023'); // Hazardous - Maroon
  });
}

// ============================================================================
// getGolfRecommendationLevel Tests
// ============================================================================

function testGetGolfRecommendationLevel(): void {
  console.log('\ngetGolfRecommendationLevel():');

  test('returns "great" for AQI 0-50', () => {
    assertEqual(getGolfRecommendationLevel(0), 'great');
    assertEqual(getGolfRecommendationLevel(25), 'great');
    assertEqual(getGolfRecommendationLevel(50), 'great');
  });

  test('returns "good" for AQI 51-75', () => {
    assertEqual(getGolfRecommendationLevel(51), 'good');
    assertEqual(getGolfRecommendationLevel(65), 'good');
    assertEqual(getGolfRecommendationLevel(75), 'good');
  });

  test('returns "caution" for AQI 76-100', () => {
    assertEqual(getGolfRecommendationLevel(76), 'caution');
    assertEqual(getGolfRecommendationLevel(85), 'caution');
    assertEqual(getGolfRecommendationLevel(100), 'caution');
  });

  test('returns "warning" for AQI 101-150', () => {
    assertEqual(getGolfRecommendationLevel(101), 'warning');
    assertEqual(getGolfRecommendationLevel(125), 'warning');
    assertEqual(getGolfRecommendationLevel(150), 'warning');
  });

  test('returns "danger" for AQI > 150', () => {
    assertEqual(getGolfRecommendationLevel(151), 'danger');
    assertEqual(getGolfRecommendationLevel(200), 'danger');
    assertEqual(getGolfRecommendationLevel(500), 'danger');
  });

  test('uses custom thresholds when provided', () => {
    const customThresholds = {
      greatMax: 30,
      goodMax: 50,
      cautionMax: 80,
      warningMax: 120,
    };
    assertEqual(getGolfRecommendationLevel(40, customThresholds), 'good');
    assertEqual(getGolfRecommendationLevel(60, customThresholds), 'caution');
    assertEqual(getGolfRecommendationLevel(100, customThresholds), 'warning');
    assertEqual(getGolfRecommendationLevel(130, customThresholds), 'danger');
  });
}

// ============================================================================
// getGolfRecommendation Tests
// ============================================================================

function testGetGolfRecommendation(): void {
  console.log('\ngetGolfRecommendation():');

  test('returns complete recommendation object', () => {
    const result = getGolfRecommendation(75);
    assertTrue('level' in result);
    assertTrue('summary' in result);
    assertTrue('details' in result);
    assertTrue('showWarning' in result);
    assertTrue('suggestReschedule' in result);
    assertTrue('tips' in result);
    assertTrue(Array.isArray(result.tips));
  });

  test('great recommendation has no warnings', () => {
    const result = getGolfRecommendation(25);
    assertEqual(result.level, 'great');
    assertFalse(result.showWarning);
    assertFalse(result.suggestReschedule);
  });

  test('good recommendation has no warnings', () => {
    const result = getGolfRecommendation(65);
    assertEqual(result.level, 'good');
    assertFalse(result.showWarning);
    assertFalse(result.suggestReschedule);
  });

  test('caution recommendation shows warning but no reschedule', () => {
    const result = getGolfRecommendation(90);
    assertEqual(result.level, 'caution');
    assertTrue(result.showWarning);
    assertFalse(result.suggestReschedule);
  });

  test('warning recommendation suggests rescheduling', () => {
    const result = getGolfRecommendation(125);
    assertEqual(result.level, 'warning');
    assertTrue(result.showWarning);
    assertTrue(result.suggestReschedule);
  });

  test('danger recommendation strongly suggests rescheduling', () => {
    const result = getGolfRecommendation(175);
    assertEqual(result.level, 'danger');
    assertTrue(result.showWarning);
    assertTrue(result.suggestReschedule);
  });

  test('includes relevant tips for each level', () => {
    const great = getGolfRecommendation(25);
    assertTrue(great.tips.length > 0);

    const caution = getGolfRecommendation(90);
    assertTrue(caution.tips.some((tip) => tip.toLowerCase().includes('cart')));

    const warning = getGolfRecommendation(125);
    assertTrue(warning.tips.some((tip) => tip.toLowerCase().includes('reschedul')));
  });
}

// ============================================================================
// shouldWarnUser Tests
// ============================================================================

function testShouldWarnUser(): void {
  console.log('\nshouldWarnUser():');

  test('returns false for AQI <= 75 (default threshold)', () => {
    assertFalse(shouldWarnUser(0));
    assertFalse(shouldWarnUser(50));
    assertFalse(shouldWarnUser(75));
  });

  test('returns true for AQI > 75 (default threshold)', () => {
    assertTrue(shouldWarnUser(76));
    assertTrue(shouldWarnUser(100));
    assertTrue(shouldWarnUser(150));
    assertTrue(shouldWarnUser(200));
  });

  test('respects custom thresholds', () => {
    const customThresholds = { ...GOLF_AQI_THRESHOLDS, goodMax: 50 };
    assertFalse(shouldWarnUser(50, customThresholds));
    assertTrue(shouldWarnUser(51, customThresholds));
  });
}

// ============================================================================
// shouldSuggestReschedule Tests
// ============================================================================

function testShouldSuggestReschedule(): void {
  console.log('\nshouldSuggestReschedule():');

  test('returns false for AQI <= 100 (default threshold)', () => {
    assertFalse(shouldSuggestReschedule(0));
    assertFalse(shouldSuggestReschedule(75));
    assertFalse(shouldSuggestReschedule(100));
  });

  test('returns true for AQI > 100 (default threshold)', () => {
    assertTrue(shouldSuggestReschedule(101));
    assertTrue(shouldSuggestReschedule(150));
    assertTrue(shouldSuggestReschedule(200));
  });
}

// ============================================================================
// getAirQualitySummary Tests
// ============================================================================

function testGetAirQualitySummary(): void {
  console.log('\ngetAirQualitySummary():');

  test('returns complete summary object', () => {
    const result = getAirQualitySummary(50);
    assertTrue('aqi' in result);
    assertTrue('categoryLevel' in result);
    assertTrue('color' in result);
    assertTrue('label' in result);
    assertTrue('golfLevel' in result);
    assertTrue('golfSummary' in result);
    assertTrue('showWarning' in result);
  });

  test('returns correct values for good AQI', () => {
    const result = getAirQualitySummary(35);
    assertEqual(result.aqi, 35);
    assertEqual(result.categoryLevel, 'good');
    assertEqual(result.label, 'Good');
    assertEqual(result.golfLevel, 'great');
    assertFalse(result.showWarning);
  });

  test('returns correct values for moderate AQI', () => {
    const result = getAirQualitySummary(85);
    assertEqual(result.aqi, 85);
    assertEqual(result.categoryLevel, 'moderate');
    assertEqual(result.golfLevel, 'caution');
    assertTrue(result.showWarning);
  });

  test('returns correct values for unhealthy AQI', () => {
    const result = getAirQualitySummary(175);
    assertEqual(result.aqi, 175);
    assertEqual(result.categoryLevel, 'unhealthy');
    assertEqual(result.golfLevel, 'danger');
    assertTrue(result.showWarning);
  });
}

// ============================================================================
// AirQualityService Tests
// ============================================================================

function testAirQualityService(): void {
  console.log('\nAirQualityService:');

  test('throws error when created without API key', () => {
    let threw = false;
    try {
      new AirQualityService({ apiKey: '' });
    } catch {
      threw = true;
    }
    assertTrue(threw, 'Should throw when API key is empty');
  });

  test('createAirQualityService factory function works', () => {
    const service = createAirQualityService('test-key');
    assertTrue(service instanceof AirQualityService);
  });

  test('service has required methods', () => {
    const service = createAirQualityService('test-key');
    assertTrue(typeof service.getCurrentAQI === 'function');
    assertTrue(typeof service.getAQISummary === 'function');
    assertTrue(typeof service.isSafeForGolf === 'function');
    assertTrue(typeof service.clearCache === 'function');
  });

  test('rejects invalid coordinates', async () => {
    const service = createAirQualityService('test-key');

    // Invalid latitude
    const result1 = await service.getCurrentAQI(100, -122);
    assertFalse(result1.success);
    if (!result1.success) {
      assertEqual(result1.error.code, 'INVALID_COORDINATES');
    }

    // Invalid longitude
    const result2 = await service.getCurrentAQI(37, -200);
    assertFalse(result2.success);
    if (!result2.success) {
      assertEqual(result2.error.code, 'INVALID_COORDINATES');
    }

    // NaN values
    const result3 = await service.getCurrentAQI(NaN, -122);
    assertFalse(result3.success);
    if (!result3.success) {
      assertEqual(result3.error.code, 'INVALID_COORDINATES');
    }
  });
}

// ============================================================================
// GOLF_AQI_THRESHOLDS Tests
// ============================================================================

function testGolfAQIThresholds(): void {
  console.log('\nGOLF_AQI_THRESHOLDS:');

  test('has all required threshold properties', () => {
    assertTrue('greatMax' in GOLF_AQI_THRESHOLDS);
    assertTrue('goodMax' in GOLF_AQI_THRESHOLDS);
    assertTrue('cautionMax' in GOLF_AQI_THRESHOLDS);
    assertTrue('warningMax' in GOLF_AQI_THRESHOLDS);
  });

  test('thresholds are in ascending order', () => {
    assertTrue(GOLF_AQI_THRESHOLDS.greatMax < GOLF_AQI_THRESHOLDS.goodMax);
    assertTrue(GOLF_AQI_THRESHOLDS.goodMax < GOLF_AQI_THRESHOLDS.cautionMax);
    assertTrue(GOLF_AQI_THRESHOLDS.cautionMax < GOLF_AQI_THRESHOLDS.warningMax);
  });

  test('thresholds match expected golf-specific values', () => {
    assertEqual(GOLF_AQI_THRESHOLDS.greatMax, 50);
    assertEqual(GOLF_AQI_THRESHOLDS.goodMax, 75);
    assertEqual(GOLF_AQI_THRESHOLDS.cautionMax, 100);
    assertEqual(GOLF_AQI_THRESHOLDS.warningMax, 150);
  });
}

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Air Quality Service Tests');
  console.log('='.repeat(60));

  testGetAQICategory();
  testGetGolfRecommendationLevel();
  testGetGolfRecommendation();
  testShouldWarnUser();
  testShouldSuggestReschedule();
  testGetAirQualitySummary();
  testGolfAQIThresholds();
  testAirQualityService();

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${testsPassed}/${testsRun} tests passed`);
  console.log('='.repeat(60));

  if (testsPassed < testsRun) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);
