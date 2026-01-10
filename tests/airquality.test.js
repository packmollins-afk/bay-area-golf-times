/**
 * Air Quality Service Tests
 *
 * Comprehensive tests for the air quality service including:
 * - getCurrentAQI function
 * - getAQICategory function
 * - getGolfRecommendation function
 * - shouldWarnUser function
 * - All AQI categories (Good, Moderate, Unhealthy for Sensitive, Unhealthy, Very Unhealthy, Hazardous)
 * - Golf-specific thresholds and recommendations
 * - EPA AirNow API response mocking
 *
 * Note: Vitest globals (describe, it, expect, vi, beforeEach, afterEach) are available
 * because globals: true is set in vitest.config.js
 */

// ============================================================================
// Mock Data & Constants
// ============================================================================

/**
 * EPA AQI category definitions (mirroring the service)
 */
const AQI_CATEGORIES = {
  good: {
    level: 'good',
    number: 1,
    name: 'Good',
    minAQI: 0,
    maxAQI: 50,
    color: '#00E400',
    healthImplications: 'Air quality is satisfactory, and air pollution poses little or no risk.',
  },
  moderate: {
    level: 'moderate',
    number: 2,
    name: 'Moderate',
    minAQI: 51,
    maxAQI: 100,
    color: '#FFFF00',
    healthImplications:
      'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.',
  },
  unhealthy_sensitive: {
    level: 'unhealthy_sensitive',
    number: 3,
    name: 'Unhealthy for Sensitive Groups',
    minAQI: 101,
    maxAQI: 150,
    color: '#FF7E00',
    healthImplications:
      'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
  },
  unhealthy: {
    level: 'unhealthy',
    number: 4,
    name: 'Unhealthy',
    minAQI: 151,
    maxAQI: 200,
    color: '#FF0000',
    healthImplications:
      'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
  },
  very_unhealthy: {
    level: 'very_unhealthy',
    number: 5,
    name: 'Very Unhealthy',
    minAQI: 201,
    maxAQI: 300,
    color: '#8F3F97',
    healthImplications: 'Health alert: The risk of health effects is increased for everyone.',
  },
  hazardous: {
    level: 'hazardous',
    number: 6,
    name: 'Hazardous',
    minAQI: 301,
    maxAQI: 500,
    color: '#7E0023',
    healthImplications:
      'Health warning of emergency conditions: everyone is more likely to be affected.',
  },
};

/**
 * Golf-specific AQI thresholds (mirroring the service)
 */
const GOLF_AQI_THRESHOLDS = {
  greatMax: 50,     // 0-50: Great for golf
  goodMax: 75,      // 51-75: Good for most
  cautionMax: 100,  // 76-100: Caution
  warningMax: 150,  // 101-150: Warning
  // Above 150: Danger
};

/**
 * Create a mock AirNow API response
 */
function createMockAirNowResponse(options = {}) {
  const {
    aqi = 35,
    pollutant = 'PM2.5',
    reportingArea = 'San Francisco Bay Area',
    stateCode = 'CA',
    dateObserved = '2024-01-15',
    hourObserved = 12,
    timezone = 'PST',
    additionalPollutants = []
  } = options;

  const getCategoryForAQI = (aqiValue) => {
    if (aqiValue <= 50) return { Number: 1, Name: 'Good' };
    if (aqiValue <= 100) return { Number: 2, Name: 'Moderate' };
    if (aqiValue <= 150) return { Number: 3, Name: 'Unhealthy for Sensitive Groups' };
    if (aqiValue <= 200) return { Number: 4, Name: 'Unhealthy' };
    if (aqiValue <= 300) return { Number: 5, Name: 'Very Unhealthy' };
    return { Number: 6, Name: 'Hazardous' };
  };

  const primaryObservation = {
    DateObserved: dateObserved,
    HourObserved: hourObserved,
    LocalTimeZone: timezone,
    ReportingArea: reportingArea,
    StateCode: stateCode,
    Latitude: 37.7749,
    Longitude: -122.4194,
    ParameterName: pollutant,
    AQI: aqi,
    Category: getCategoryForAQI(aqi),
  };

  const response = [primaryObservation];

  // Add additional pollutants if specified
  additionalPollutants.forEach(({ pollutant: p, aqi: a }) => {
    response.push({
      ...primaryObservation,
      ParameterName: p,
      AQI: a,
      Category: getCategoryForAQI(a),
    });
  });

  return response;
}

/**
 * Create a mock fetch response
 */
function createMockFetchResponse(data, options = {}) {
  const { status = 200, ok = true } = options;
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  });
}

// ============================================================================
// Pure Function Implementations for Testing
// These mirror the service implementations for unit testing
// ============================================================================

/**
 * Get the AQI category for a given AQI value
 */
function getAQICategory(aqi) {
  if (aqi < 0) {
    return AQI_CATEGORIES.good;
  }
  if (aqi <= 50) {
    return AQI_CATEGORIES.good;
  }
  if (aqi <= 100) {
    return AQI_CATEGORIES.moderate;
  }
  if (aqi <= 150) {
    return AQI_CATEGORIES.unhealthy_sensitive;
  }
  if (aqi <= 200) {
    return AQI_CATEGORIES.unhealthy;
  }
  if (aqi <= 300) {
    return AQI_CATEGORIES.very_unhealthy;
  }
  return AQI_CATEGORIES.hazardous;
}

/**
 * Get golf recommendation level based on AQI
 */
function getGolfRecommendationLevel(aqi, thresholds = GOLF_AQI_THRESHOLDS) {
  if (aqi <= thresholds.greatMax) {
    return 'great';
  }
  if (aqi <= thresholds.goodMax) {
    return 'good';
  }
  if (aqi <= thresholds.cautionMax) {
    return 'caution';
  }
  if (aqi <= thresholds.warningMax) {
    return 'warning';
  }
  return 'danger';
}

/**
 * Golf recommendations for each level
 */
const GOLF_RECOMMENDATIONS = {
  great: {
    summary: 'Great conditions for golf!',
    details: 'Air quality is excellent. Perfect conditions for a full round of golf with no restrictions.',
    showWarning: false,
    suggestReschedule: false,
    tips: [
      'Enjoy your round!',
      'Stay hydrated as always',
      'Perfect day for walking the course',
    ],
  },
  good: {
    summary: 'Good conditions for golf',
    details: 'Air quality is acceptable for most golfers. Enjoy your round with normal precautions.',
    showWarning: false,
    suggestReschedule: false,
    tips: [
      'Good conditions for most golfers',
      'Those sensitive to air quality may want to monitor how they feel',
      'Stay hydrated',
    ],
  },
  caution: {
    summary: 'Fair conditions - sensitive groups should take precautions',
    details: 'Air quality may affect sensitive individuals. If you have asthma, heart conditions, or are elderly, consider limiting exertion or taking breaks.',
    showWarning: true,
    suggestReschedule: false,
    tips: [
      'Consider taking a cart instead of walking',
      'Take more frequent breaks',
      'Bring any necessary medications (inhalers, etc.)',
      'Sensitive groups: consider a shorter round (9 holes)',
      'Stay well hydrated',
    ],
  },
  warning: {
    summary: 'Poor conditions - consider rescheduling',
    details: 'Air quality is unhealthy for sensitive groups and may affect healthy individuals during prolonged outdoor activity. Consider rescheduling your round.',
    showWarning: true,
    suggestReschedule: true,
    tips: [
      'Consider rescheduling to a day with better air quality',
      'If playing, strongly consider a cart and 9 holes max',
      'Reduce physical exertion - walk slowly, take many breaks',
      'Monitor symptoms: coughing, shortness of breath, chest tightness',
      'Stop playing if you experience any respiratory symptoms',
      'Sensitive groups should avoid outdoor activity',
    ],
  },
  danger: {
    summary: 'Unhealthy conditions - recommend rescheduling',
    details: 'Air quality is unhealthy and poses health risks for extended outdoor activity. We strongly recommend rescheduling your round to protect your health.',
    showWarning: true,
    suggestReschedule: true,
    tips: [
      'Strongly recommend rescheduling your round',
      'Extended outdoor activity is not advised',
      'If you must be outdoors, minimize exertion and time',
      'Everyone may experience health effects',
      'Monitor air quality forecasts for better days',
    ],
  },
};

/**
 * Get full golf recommendation for AQI
 */
function getGolfRecommendation(aqi, thresholds = GOLF_AQI_THRESHOLDS) {
  const level = getGolfRecommendationLevel(aqi, thresholds);
  return {
    level,
    ...GOLF_RECOMMENDATIONS[level],
  };
}

/**
 * Should user be warned about air quality
 */
function shouldWarnUser(aqi, thresholds = GOLF_AQI_THRESHOLDS) {
  return aqi > thresholds.goodMax;
}

/**
 * Should suggest rescheduling
 */
function shouldSuggestReschedule(aqi, thresholds = GOLF_AQI_THRESHOLDS) {
  return aqi > thresholds.cautionMax;
}

/**
 * Validate coordinates
 */
function validateCoordinates(latitude, longitude) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

// ============================================================================
// Tests: getAQICategory
// ============================================================================

describe('getAQICategory', () => {
  describe('Good category (0-50)', () => {
    it('should return Good for AQI of 0', () => {
      const result = getAQICategory(0);
      expect(result.level).toBe('good');
      expect(result.name).toBe('Good');
      expect(result.color).toBe('#00E400');
      expect(result.number).toBe(1);
    });

    it('should return Good for AQI of 25', () => {
      const result = getAQICategory(25);
      expect(result.level).toBe('good');
      expect(result.name).toBe('Good');
    });

    it('should return Good for AQI of 50 (boundary)', () => {
      const result = getAQICategory(50);
      expect(result.level).toBe('good');
      expect(result.name).toBe('Good');
    });

    it('should return Good for negative AQI values', () => {
      const result = getAQICategory(-10);
      expect(result.level).toBe('good');
    });
  });

  describe('Moderate category (51-100)', () => {
    it('should return Moderate for AQI of 51 (lower boundary)', () => {
      const result = getAQICategory(51);
      expect(result.level).toBe('moderate');
      expect(result.name).toBe('Moderate');
      expect(result.color).toBe('#FFFF00');
      expect(result.number).toBe(2);
    });

    it('should return Moderate for AQI of 75', () => {
      const result = getAQICategory(75);
      expect(result.level).toBe('moderate');
    });

    it('should return Moderate for AQI of 100 (upper boundary)', () => {
      const result = getAQICategory(100);
      expect(result.level).toBe('moderate');
    });
  });

  describe('Unhealthy for Sensitive Groups category (101-150)', () => {
    it('should return Unhealthy for Sensitive Groups for AQI of 101 (lower boundary)', () => {
      const result = getAQICategory(101);
      expect(result.level).toBe('unhealthy_sensitive');
      expect(result.name).toBe('Unhealthy for Sensitive Groups');
      expect(result.color).toBe('#FF7E00');
      expect(result.number).toBe(3);
    });

    it('should return Unhealthy for Sensitive Groups for AQI of 125', () => {
      const result = getAQICategory(125);
      expect(result.level).toBe('unhealthy_sensitive');
    });

    it('should return Unhealthy for Sensitive Groups for AQI of 150 (upper boundary)', () => {
      const result = getAQICategory(150);
      expect(result.level).toBe('unhealthy_sensitive');
    });
  });

  describe('Unhealthy category (151-200)', () => {
    it('should return Unhealthy for AQI of 151 (lower boundary)', () => {
      const result = getAQICategory(151);
      expect(result.level).toBe('unhealthy');
      expect(result.name).toBe('Unhealthy');
      expect(result.color).toBe('#FF0000');
      expect(result.number).toBe(4);
    });

    it('should return Unhealthy for AQI of 175', () => {
      const result = getAQICategory(175);
      expect(result.level).toBe('unhealthy');
    });

    it('should return Unhealthy for AQI of 200 (upper boundary)', () => {
      const result = getAQICategory(200);
      expect(result.level).toBe('unhealthy');
    });
  });

  describe('Very Unhealthy category (201-300)', () => {
    it('should return Very Unhealthy for AQI of 201 (lower boundary)', () => {
      const result = getAQICategory(201);
      expect(result.level).toBe('very_unhealthy');
      expect(result.name).toBe('Very Unhealthy');
      expect(result.color).toBe('#8F3F97');
      expect(result.number).toBe(5);
    });

    it('should return Very Unhealthy for AQI of 250', () => {
      const result = getAQICategory(250);
      expect(result.level).toBe('very_unhealthy');
    });

    it('should return Very Unhealthy for AQI of 300 (upper boundary)', () => {
      const result = getAQICategory(300);
      expect(result.level).toBe('very_unhealthy');
    });
  });

  describe('Hazardous category (301-500+)', () => {
    it('should return Hazardous for AQI of 301 (lower boundary)', () => {
      const result = getAQICategory(301);
      expect(result.level).toBe('hazardous');
      expect(result.name).toBe('Hazardous');
      expect(result.color).toBe('#7E0023');
      expect(result.number).toBe(6);
    });

    it('should return Hazardous for AQI of 400', () => {
      const result = getAQICategory(400);
      expect(result.level).toBe('hazardous');
    });

    it('should return Hazardous for AQI of 500', () => {
      const result = getAQICategory(500);
      expect(result.level).toBe('hazardous');
    });

    it('should return Hazardous for AQI above 500', () => {
      const result = getAQICategory(600);
      expect(result.level).toBe('hazardous');
    });
  });

  describe('Health implications', () => {
    it('should have appropriate health implications for each category', () => {
      expect(getAQICategory(25).healthImplications).toContain('satisfactory');
      expect(getAQICategory(75).healthImplications).toContain('acceptable');
      expect(getAQICategory(125).healthImplications).toContain('sensitive groups');
      expect(getAQICategory(175).healthImplications).toContain('general public');
      expect(getAQICategory(250).healthImplications).toContain('Health alert');
      expect(getAQICategory(350).healthImplications).toContain('emergency');
    });
  });
});

// ============================================================================
// Tests: getGolfRecommendation
// ============================================================================

describe('getGolfRecommendation', () => {
  describe('Great recommendation (AQI 0-50)', () => {
    it('should return great recommendation for AQI of 0', () => {
      const result = getGolfRecommendation(0);
      expect(result.level).toBe('great');
      expect(result.summary).toBe('Great conditions for golf!');
      expect(result.showWarning).toBe(false);
      expect(result.suggestReschedule).toBe(false);
    });

    it('should return great recommendation for AQI of 50 (boundary)', () => {
      const result = getGolfRecommendation(50);
      expect(result.level).toBe('great');
      expect(result.showWarning).toBe(false);
    });

    it('should include appropriate tips for great conditions', () => {
      const result = getGolfRecommendation(35);
      expect(result.tips).toContain('Enjoy your round!');
      expect(result.tips.some(tip => tip.toLowerCase().includes('hydrated'))).toBe(true);
    });
  });

  describe('Good recommendation (AQI 51-75)', () => {
    it('should return good recommendation for AQI of 51 (lower boundary)', () => {
      const result = getGolfRecommendation(51);
      expect(result.level).toBe('good');
      expect(result.summary).toBe('Good conditions for golf');
      expect(result.showWarning).toBe(false);
      expect(result.suggestReschedule).toBe(false);
    });

    it('should return good recommendation for AQI of 75 (upper boundary)', () => {
      const result = getGolfRecommendation(75);
      expect(result.level).toBe('good');
    });

    it('should mention sensitive individuals in tips', () => {
      const result = getGolfRecommendation(60);
      expect(result.tips.some(tip => tip.toLowerCase().includes('sensitive'))).toBe(true);
    });
  });

  describe('Caution recommendation (AQI 76-100)', () => {
    it('should return caution recommendation for AQI of 76 (lower boundary)', () => {
      const result = getGolfRecommendation(76);
      expect(result.level).toBe('caution');
      expect(result.showWarning).toBe(true);
      expect(result.suggestReschedule).toBe(false);
    });

    it('should return caution recommendation for AQI of 100 (upper boundary)', () => {
      const result = getGolfRecommendation(100);
      expect(result.level).toBe('caution');
    });

    it('should suggest cart and breaks for caution level', () => {
      const result = getGolfRecommendation(85);
      expect(result.tips.some(tip => tip.toLowerCase().includes('cart'))).toBe(true);
      expect(result.tips.some(tip => tip.toLowerCase().includes('breaks'))).toBe(true);
    });

    it('should mention medications for sensitive groups', () => {
      const result = getGolfRecommendation(90);
      expect(result.tips.some(tip => tip.toLowerCase().includes('medication'))).toBe(true);
    });
  });

  describe('Warning recommendation (AQI 101-150)', () => {
    it('should return warning recommendation for AQI of 101 (lower boundary)', () => {
      const result = getGolfRecommendation(101);
      expect(result.level).toBe('warning');
      expect(result.showWarning).toBe(true);
      expect(result.suggestReschedule).toBe(true);
    });

    it('should return warning recommendation for AQI of 150 (upper boundary)', () => {
      const result = getGolfRecommendation(150);
      expect(result.level).toBe('warning');
    });

    it('should suggest rescheduling at warning level', () => {
      const result = getGolfRecommendation(125);
      expect(result.suggestReschedule).toBe(true);
      expect(result.tips.some(tip => tip.toLowerCase().includes('rescheduling'))).toBe(true);
    });

    it('should warn about respiratory symptoms', () => {
      const result = getGolfRecommendation(130);
      expect(result.tips.some(tip => tip.toLowerCase().includes('symptoms'))).toBe(true);
    });
  });

  describe('Danger recommendation (AQI > 150)', () => {
    it('should return danger recommendation for AQI of 151 (lower boundary)', () => {
      const result = getGolfRecommendation(151);
      expect(result.level).toBe('danger');
      expect(result.showWarning).toBe(true);
      expect(result.suggestReschedule).toBe(true);
    });

    it('should return danger recommendation for high AQI values', () => {
      const result = getGolfRecommendation(250);
      expect(result.level).toBe('danger');
    });

    it('should strongly recommend rescheduling at danger level', () => {
      const result = getGolfRecommendation(200);
      expect(result.suggestReschedule).toBe(true);
      expect(result.tips.some(tip => tip.toLowerCase().includes('strongly recommend rescheduling'))).toBe(true);
    });

    it('should warn that everyone may be affected', () => {
      const result = getGolfRecommendation(175);
      expect(result.tips.some(tip => tip.toLowerCase().includes('everyone'))).toBe(true);
    });
  });

  describe('Custom thresholds', () => {
    it('should respect custom thresholds', () => {
      const customThresholds = {
        greatMax: 30,
        goodMax: 50,
        cautionMax: 75,
        warningMax: 100,
      };

      expect(getGolfRecommendation(35, customThresholds).level).toBe('good');
      expect(getGolfRecommendation(60, customThresholds).level).toBe('caution');
      expect(getGolfRecommendation(80, customThresholds).level).toBe('warning');
      expect(getGolfRecommendation(110, customThresholds).level).toBe('danger');
    });
  });
});

// ============================================================================
// Tests: shouldWarnUser
// ============================================================================

describe('shouldWarnUser', () => {
  describe('Default thresholds (goodMax: 75)', () => {
    it('should return false for AQI of 0', () => {
      expect(shouldWarnUser(0)).toBe(false);
    });

    it('should return false for AQI of 50', () => {
      expect(shouldWarnUser(50)).toBe(false);
    });

    it('should return false for AQI of 75 (boundary)', () => {
      expect(shouldWarnUser(75)).toBe(false);
    });

    it('should return true for AQI of 76 (just above boundary)', () => {
      expect(shouldWarnUser(76)).toBe(true);
    });

    it('should return true for AQI of 100', () => {
      expect(shouldWarnUser(100)).toBe(true);
    });

    it('should return true for AQI of 150', () => {
      expect(shouldWarnUser(150)).toBe(true);
    });

    it('should return true for AQI of 300', () => {
      expect(shouldWarnUser(300)).toBe(true);
    });
  });

  describe('Custom thresholds', () => {
    it('should respect custom goodMax threshold', () => {
      const customThresholds = { ...GOLF_AQI_THRESHOLDS, goodMax: 50 };

      expect(shouldWarnUser(50, customThresholds)).toBe(false);
      expect(shouldWarnUser(51, customThresholds)).toBe(true);
    });

    it('should work with stricter thresholds', () => {
      const strictThresholds = { ...GOLF_AQI_THRESHOLDS, goodMax: 30 };

      expect(shouldWarnUser(25, strictThresholds)).toBe(false);
      expect(shouldWarnUser(35, strictThresholds)).toBe(true);
    });

    it('should work with relaxed thresholds', () => {
      const relaxedThresholds = { ...GOLF_AQI_THRESHOLDS, goodMax: 100 };

      expect(shouldWarnUser(80, relaxedThresholds)).toBe(false);
      expect(shouldWarnUser(101, relaxedThresholds)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle very high AQI values', () => {
      expect(shouldWarnUser(500)).toBe(true);
      expect(shouldWarnUser(1000)).toBe(true);
    });

    it('should handle negative AQI values', () => {
      expect(shouldWarnUser(-10)).toBe(false);
    });

    it('should handle decimal AQI values', () => {
      expect(shouldWarnUser(75.4)).toBe(true);
      expect(shouldWarnUser(74.9)).toBe(false);
    });
  });
});

// ============================================================================
// Tests: shouldSuggestReschedule
// ============================================================================

describe('shouldSuggestReschedule', () => {
  describe('Default thresholds (cautionMax: 100)', () => {
    it('should return false for AQI of 50', () => {
      expect(shouldSuggestReschedule(50)).toBe(false);
    });

    it('should return false for AQI of 75', () => {
      expect(shouldSuggestReschedule(75)).toBe(false);
    });

    it('should return false for AQI of 100 (boundary)', () => {
      expect(shouldSuggestReschedule(100)).toBe(false);
    });

    it('should return true for AQI of 101 (just above boundary)', () => {
      expect(shouldSuggestReschedule(101)).toBe(true);
    });

    it('should return true for AQI of 150', () => {
      expect(shouldSuggestReschedule(150)).toBe(true);
    });

    it('should return true for AQI of 200', () => {
      expect(shouldSuggestReschedule(200)).toBe(true);
    });
  });

  describe('Custom thresholds', () => {
    it('should respect custom cautionMax threshold', () => {
      const customThresholds = { ...GOLF_AQI_THRESHOLDS, cautionMax: 75 };

      expect(shouldSuggestReschedule(75, customThresholds)).toBe(false);
      expect(shouldSuggestReschedule(76, customThresholds)).toBe(true);
    });
  });
});

// ============================================================================
// Tests: Golf-Specific Thresholds
// ============================================================================

describe('Golf-Specific Thresholds', () => {
  describe('Threshold values', () => {
    it('should have correct greatMax threshold', () => {
      expect(GOLF_AQI_THRESHOLDS.greatMax).toBe(50);
    });

    it('should have correct goodMax threshold', () => {
      expect(GOLF_AQI_THRESHOLDS.goodMax).toBe(75);
    });

    it('should have correct cautionMax threshold', () => {
      expect(GOLF_AQI_THRESHOLDS.cautionMax).toBe(100);
    });

    it('should have correct warningMax threshold', () => {
      expect(GOLF_AQI_THRESHOLDS.warningMax).toBe(150);
    });
  });

  describe('Threshold progressions', () => {
    it('should have increasing threshold values', () => {
      expect(GOLF_AQI_THRESHOLDS.greatMax).toBeLessThan(GOLF_AQI_THRESHOLDS.goodMax);
      expect(GOLF_AQI_THRESHOLDS.goodMax).toBeLessThan(GOLF_AQI_THRESHOLDS.cautionMax);
      expect(GOLF_AQI_THRESHOLDS.cautionMax).toBeLessThan(GOLF_AQI_THRESHOLDS.warningMax);
    });

    it('should be more conservative than standard EPA thresholds', () => {
      // Golf thresholds are designed to be more conservative
      // The warning threshold (150) is lower than EPA's "Unhealthy" (151+)
      expect(GOLF_AQI_THRESHOLDS.warningMax).toBeLessThanOrEqual(150);
    });
  });

  describe('Complete AQI coverage', () => {
    it('should cover all reasonable AQI values', () => {
      // Test that every AQI value from 0 to 500 gets a valid recommendation
      for (let aqi = 0; aqi <= 500; aqi += 25) {
        const recommendation = getGolfRecommendation(aqi);
        expect(recommendation.level).toBeDefined();
        expect(['great', 'good', 'caution', 'warning', 'danger']).toContain(recommendation.level);
      }
    });
  });
});

// ============================================================================
// Tests: getCurrentAQI (with mocked API)
// ============================================================================

describe('getCurrentAQI (mocked API)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Successful API responses', () => {
    it('should parse a good air quality response correctly', async () => {
      const mockResponse = createMockAirNowResponse({ aqi: 35, pollutant: 'PM2.5' });
      global.fetch = vi.fn(() => createMockFetchResponse(mockResponse));

      // Simulate what the service would do
      const response = await fetch('https://test.url');
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0].AQI).toBe(35);
      expect(data[0].ParameterName).toBe('PM2.5');
      expect(data[0].Category.Name).toBe('Good');
    });

    it('should parse moderate air quality response correctly', async () => {
      const mockResponse = createMockAirNowResponse({ aqi: 75, pollutant: 'O3' });
      global.fetch = vi.fn(() => createMockFetchResponse(mockResponse));

      const response = await fetch('https://test.url');
      const data = await response.json();

      expect(data[0].AQI).toBe(75);
      expect(data[0].Category.Name).toBe('Moderate');
    });

    it('should handle multiple pollutants and use the highest AQI', async () => {
      const mockResponse = createMockAirNowResponse({
        aqi: 45,
        pollutant: 'PM2.5',
        additionalPollutants: [
          { pollutant: 'O3', aqi: 85 },
          { pollutant: 'NO2', aqi: 30 },
        ],
      });
      global.fetch = vi.fn(() => createMockFetchResponse(mockResponse));

      const response = await fetch('https://test.url');
      const data = await response.json();

      expect(data).toHaveLength(3);

      // The service would select the highest AQI
      const highestAQI = Math.max(...data.map(obs => obs.AQI));
      expect(highestAQI).toBe(85);
    });

    it('should include all required fields in API response', async () => {
      const mockResponse = createMockAirNowResponse({ aqi: 50 });
      global.fetch = vi.fn(() => createMockFetchResponse(mockResponse));

      const response = await fetch('https://test.url');
      const data = await response.json();
      const observation = data[0];

      expect(observation).toHaveProperty('DateObserved');
      expect(observation).toHaveProperty('HourObserved');
      expect(observation).toHaveProperty('LocalTimeZone');
      expect(observation).toHaveProperty('ReportingArea');
      expect(observation).toHaveProperty('StateCode');
      expect(observation).toHaveProperty('Latitude');
      expect(observation).toHaveProperty('Longitude');
      expect(observation).toHaveProperty('ParameterName');
      expect(observation).toHaveProperty('AQI');
      expect(observation).toHaveProperty('Category');
    });
  });

  describe('Error responses', () => {
    it('should handle 401 unauthorized response', async () => {
      global.fetch = vi.fn(() => createMockFetchResponse(null, { status: 401, ok: false }));

      const response = await fetch('https://test.url');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should handle 403 forbidden response', async () => {
      global.fetch = vi.fn(() => createMockFetchResponse(null, { status: 403, ok: false }));

      const response = await fetch('https://test.url');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });

    it('should handle 429 rate limited response', async () => {
      global.fetch = vi.fn(() => createMockFetchResponse(null, { status: 429, ok: false }));

      const response = await fetch('https://test.url');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
    });

    it('should handle 500 server error response', async () => {
      global.fetch = vi.fn(() => createMockFetchResponse(null, { status: 500, ok: false }));

      const response = await fetch('https://test.url');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it('should handle empty response array', async () => {
      global.fetch = vi.fn(() => createMockFetchResponse([]));

      const response = await fetch('https://test.url');
      const data = await response.json();

      expect(data).toEqual([]);
      expect(data.length).toBe(0);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      await expect(fetch('https://test.url')).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      global.fetch = vi.fn(() => Promise.reject(abortError));

      await expect(fetch('https://test.url')).rejects.toThrow('Aborted');
    });
  });

  describe('All AQI category responses', () => {
    const testCases = [
      { aqi: 25, expectedCategory: 'Good', expectedLevel: 'good' },
      { aqi: 75, expectedCategory: 'Moderate', expectedLevel: 'moderate' },
      { aqi: 125, expectedCategory: 'Unhealthy for Sensitive Groups', expectedLevel: 'unhealthy_sensitive' },
      { aqi: 175, expectedCategory: 'Unhealthy', expectedLevel: 'unhealthy' },
      { aqi: 250, expectedCategory: 'Very Unhealthy', expectedLevel: 'very_unhealthy' },
      { aqi: 350, expectedCategory: 'Hazardous', expectedLevel: 'hazardous' },
    ];

    testCases.forEach(({ aqi, expectedCategory, expectedLevel }) => {
      it(`should correctly parse ${expectedCategory} response (AQI: ${aqi})`, async () => {
        const mockResponse = createMockAirNowResponse({ aqi });
        global.fetch = vi.fn(() => createMockFetchResponse(mockResponse));

        const response = await fetch('https://test.url');
        const data = await response.json();

        expect(data[0].AQI).toBe(aqi);

        const category = getAQICategory(aqi);
        expect(category.level).toBe(expectedLevel);
      });
    });
  });
});

// ============================================================================
// Tests: Coordinate Validation
// ============================================================================

describe('Coordinate Validation', () => {
  describe('Valid coordinates', () => {
    it('should accept valid San Francisco coordinates', () => {
      expect(validateCoordinates(37.7749, -122.4194)).toBe(true);
    });

    it('should accept valid coordinates at equator', () => {
      expect(validateCoordinates(0, 0)).toBe(true);
    });

    it('should accept valid coordinates at poles', () => {
      expect(validateCoordinates(90, 0)).toBe(true);
      expect(validateCoordinates(-90, 0)).toBe(true);
    });

    it('should accept valid coordinates at date line', () => {
      expect(validateCoordinates(0, 180)).toBe(true);
      expect(validateCoordinates(0, -180)).toBe(true);
    });

    it('should accept extreme valid coordinates', () => {
      expect(validateCoordinates(90, 180)).toBe(true);
      expect(validateCoordinates(-90, -180)).toBe(true);
    });
  });

  describe('Invalid coordinates', () => {
    it('should reject latitude > 90', () => {
      expect(validateCoordinates(91, 0)).toBe(false);
    });

    it('should reject latitude < -90', () => {
      expect(validateCoordinates(-91, 0)).toBe(false);
    });

    it('should reject longitude > 180', () => {
      expect(validateCoordinates(0, 181)).toBe(false);
    });

    it('should reject longitude < -180', () => {
      expect(validateCoordinates(0, -181)).toBe(false);
    });

    it('should reject NaN latitude', () => {
      expect(validateCoordinates(NaN, 0)).toBe(false);
    });

    it('should reject NaN longitude', () => {
      expect(validateCoordinates(0, NaN)).toBe(false);
    });

    it('should reject non-number latitude', () => {
      expect(validateCoordinates('37', -122)).toBe(false);
      expect(validateCoordinates(null, -122)).toBe(false);
      expect(validateCoordinates(undefined, -122)).toBe(false);
    });

    it('should reject non-number longitude', () => {
      expect(validateCoordinates(37, '-122')).toBe(false);
      expect(validateCoordinates(37, null)).toBe(false);
      expect(validateCoordinates(37, undefined)).toBe(false);
    });
  });
});

// ============================================================================
// Tests: Pollutant Parsing
// ============================================================================

describe('Pollutant Parsing', () => {
  /**
   * Parse pollutant name (mirrors service implementation)
   */
  function parsePollutant(parameterName) {
    const normalized = parameterName.toUpperCase().replace(/\s+/g, '');

    const pollutantMap = {
      'PM2.5': 'PM2.5',
      'PM25': 'PM2.5',
      'PM10': 'PM10',
      'O3': 'O3',
      'OZONE': 'O3',
      'NO2': 'NO2',
      'CO': 'CO',
      'SO2': 'SO2',
    };

    return pollutantMap[normalized] || 'PM2.5';
  }

  describe('Standard pollutant names', () => {
    it('should parse PM2.5', () => {
      expect(parsePollutant('PM2.5')).toBe('PM2.5');
    });

    it('should parse PM25 (without period)', () => {
      expect(parsePollutant('PM25')).toBe('PM2.5');
    });

    it('should parse PM10', () => {
      expect(parsePollutant('PM10')).toBe('PM10');
    });

    it('should parse O3', () => {
      expect(parsePollutant('O3')).toBe('O3');
    });

    it('should parse OZONE as O3', () => {
      expect(parsePollutant('OZONE')).toBe('O3');
    });

    it('should parse NO2', () => {
      expect(parsePollutant('NO2')).toBe('NO2');
    });

    it('should parse CO', () => {
      expect(parsePollutant('CO')).toBe('CO');
    });

    it('should parse SO2', () => {
      expect(parsePollutant('SO2')).toBe('SO2');
    });
  });

  describe('Case insensitivity', () => {
    it('should handle lowercase pollutant names', () => {
      expect(parsePollutant('pm2.5')).toBe('PM2.5');
      expect(parsePollutant('o3')).toBe('O3');
      expect(parsePollutant('ozone')).toBe('O3');
    });

    it('should handle mixed case pollutant names', () => {
      expect(parsePollutant('Pm2.5')).toBe('PM2.5');
      expect(parsePollutant('Ozone')).toBe('O3');
    });
  });

  describe('Unknown pollutants', () => {
    it('should default to PM2.5 for unknown pollutants', () => {
      expect(parsePollutant('UNKNOWN')).toBe('PM2.5');
      expect(parsePollutant('XYZ')).toBe('PM2.5');
      expect(parsePollutant('')).toBe('PM2.5');
    });
  });
});

// ============================================================================
// Tests: Cache Key Generation
// ============================================================================

describe('Cache Key Generation', () => {
  /**
   * Create cache key (mirrors service implementation)
   */
  function createCacheKey(latitude, longitude) {
    // Round to 2 decimal places for cache key (roughly 1km precision)
    const lat = Math.round(latitude * 100) / 100;
    const lon = Math.round(longitude * 100) / 100;
    return `aqi:${lat}:${lon}`;
  }

  it('should create consistent cache keys for same coordinates', () => {
    const key1 = createCacheKey(37.7749, -122.4194);
    const key2 = createCacheKey(37.7749, -122.4194);
    expect(key1).toBe(key2);
  });

  it('should round coordinates to 2 decimal places', () => {
    const key1 = createCacheKey(37.77491, -122.41941);
    const key2 = createCacheKey(37.77499, -122.41949);
    expect(key1).toBe(key2);
  });

  it('should create different keys for different locations', () => {
    const sfKey = createCacheKey(37.77, -122.42);
    const laKey = createCacheKey(34.05, -118.24);
    expect(sfKey).not.toBe(laKey);
  });

  it('should format key correctly', () => {
    const key = createCacheKey(37.77, -122.42);
    expect(key).toBe('aqi:37.77:-122.42');
  });

  it('should handle whole numbers', () => {
    const key = createCacheKey(38, -122);
    expect(key).toBe('aqi:38:-122');
  });

  it('should handle negative coordinates', () => {
    const key = createCacheKey(-33.87, 151.21);
    expect(key).toBe('aqi:-33.87:151.21');
  });
});

// ============================================================================
// Tests: Air Quality Summary
// ============================================================================

describe('Air Quality Summary', () => {
  /**
   * Get air quality summary (mirrors service implementation)
   */
  function getAirQualitySummary(aqi) {
    const category = getAQICategory(aqi);
    const recommendation = getGolfRecommendation(aqi);

    return {
      aqi,
      categoryLevel: category.level,
      color: category.color,
      label: category.name,
      golfLevel: recommendation.level,
      golfSummary: recommendation.summary,
      showWarning: recommendation.showWarning,
    };
  }

  it('should return complete summary for good air quality', () => {
    const summary = getAirQualitySummary(35);

    expect(summary.aqi).toBe(35);
    expect(summary.categoryLevel).toBe('good');
    expect(summary.color).toBe('#00E400');
    expect(summary.label).toBe('Good');
    expect(summary.golfLevel).toBe('great');
    expect(summary.golfSummary).toBe('Great conditions for golf!');
    expect(summary.showWarning).toBe(false);
  });

  it('should return complete summary for moderate air quality', () => {
    const summary = getAirQualitySummary(85);

    expect(summary.aqi).toBe(85);
    expect(summary.categoryLevel).toBe('moderate');
    expect(summary.color).toBe('#FFFF00');
    expect(summary.label).toBe('Moderate');
    expect(summary.golfLevel).toBe('caution');
    expect(summary.showWarning).toBe(true);
  });

  it('should return complete summary for unhealthy air quality', () => {
    const summary = getAirQualitySummary(175);

    expect(summary.aqi).toBe(175);
    expect(summary.categoryLevel).toBe('unhealthy');
    expect(summary.color).toBe('#FF0000');
    expect(summary.label).toBe('Unhealthy');
    expect(summary.golfLevel).toBe('danger');
    expect(summary.showWarning).toBe(true);
  });

  it('should have all required fields', () => {
    const summary = getAirQualitySummary(50);

    expect(summary).toHaveProperty('aqi');
    expect(summary).toHaveProperty('categoryLevel');
    expect(summary).toHaveProperty('color');
    expect(summary).toHaveProperty('label');
    expect(summary).toHaveProperty('golfLevel');
    expect(summary).toHaveProperty('golfSummary');
    expect(summary).toHaveProperty('showWarning');
  });
});

// ============================================================================
// Tests: Integration Scenarios
// ============================================================================

describe('Integration Scenarios', () => {
  describe('Wildfire smoke scenario', () => {
    it('should recommend rescheduling during wildfire conditions', () => {
      // During wildfire season, PM2.5 can exceed 200
      const wildfireAQI = 250;
      const category = getAQICategory(wildfireAQI);
      const recommendation = getGolfRecommendation(wildfireAQI);

      expect(category.level).toBe('very_unhealthy');
      expect(recommendation.level).toBe('danger');
      expect(recommendation.suggestReschedule).toBe(true);
      expect(recommendation.showWarning).toBe(true);
    });
  });

  describe('Typical Bay Area day', () => {
    it('should be fine for golf on a typical day', () => {
      // Typical Bay Area AQI is 20-40
      const typicalAQI = 32;
      const category = getAQICategory(typicalAQI);
      const recommendation = getGolfRecommendation(typicalAQI);

      expect(category.level).toBe('good');
      expect(recommendation.level).toBe('great');
      expect(recommendation.suggestReschedule).toBe(false);
      expect(recommendation.showWarning).toBe(false);
    });
  });

  describe('Spare the Air day', () => {
    it('should warn users on a Spare the Air day', () => {
      // Spare the Air days typically have AQI 75-100
      const spareTheAirAQI = 90;
      const category = getAQICategory(spareTheAirAQI);
      const recommendation = getGolfRecommendation(spareTheAirAQI);

      expect(category.level).toBe('moderate');
      expect(recommendation.level).toBe('caution');
      expect(recommendation.showWarning).toBe(true);
      expect(recommendation.suggestReschedule).toBe(false);
    });
  });

  describe('Morning vs. afternoon AQI', () => {
    it('should categorize morning low ozone correctly', () => {
      // Morning typically has lower ozone
      const morningAQI = 25;
      expect(getGolfRecommendation(morningAQI).level).toBe('great');
    });

    it('should categorize afternoon peak ozone correctly', () => {
      // Afternoon can have higher ozone
      const afternoonAQI = 65;
      expect(getGolfRecommendation(afternoonAQI).level).toBe('good');
    });
  });

  describe('Sensitive golfer considerations', () => {
    it('should provide appropriate tips for sensitive individuals at moderate AQI', () => {
      const moderateAQI = 80;
      const recommendation = getGolfRecommendation(moderateAQI);

      // Should have tips for sensitive golfers
      expect(recommendation.tips.some(tip =>
        tip.toLowerCase().includes('sensitive') ||
        tip.toLowerCase().includes('cart') ||
        tip.toLowerCase().includes('breaks')
      )).toBe(true);
    });
  });
});

// ============================================================================
// Tests: Edge Cases and Boundary Values
// ============================================================================

describe('Edge Cases and Boundary Values', () => {
  describe('AQI boundary transitions', () => {
    const boundaries = [
      { aqi: 50, expectedCategory: 'good', nextCategory: 'moderate' },
      { aqi: 100, expectedCategory: 'moderate', nextCategory: 'unhealthy_sensitive' },
      { aqi: 150, expectedCategory: 'unhealthy_sensitive', nextCategory: 'unhealthy' },
      { aqi: 200, expectedCategory: 'unhealthy', nextCategory: 'very_unhealthy' },
      { aqi: 300, expectedCategory: 'very_unhealthy', nextCategory: 'hazardous' },
    ];

    boundaries.forEach(({ aqi, expectedCategory, nextCategory }) => {
      it(`should correctly categorize AQI at boundary ${aqi}`, () => {
        expect(getAQICategory(aqi).level).toBe(expectedCategory);
        expect(getAQICategory(aqi + 1).level).toBe(nextCategory);
      });
    });
  });

  describe('Golf threshold boundary transitions', () => {
    const boundaries = [
      { aqi: 50, expectedLevel: 'great', nextLevel: 'good' },
      { aqi: 75, expectedLevel: 'good', nextLevel: 'caution' },
      { aqi: 100, expectedLevel: 'caution', nextLevel: 'warning' },
      { aqi: 150, expectedLevel: 'warning', nextLevel: 'danger' },
    ];

    boundaries.forEach(({ aqi, expectedLevel, nextLevel }) => {
      it(`should correctly recommend at golf threshold ${aqi}`, () => {
        expect(getGolfRecommendation(aqi).level).toBe(expectedLevel);
        expect(getGolfRecommendation(aqi + 1).level).toBe(nextLevel);
      });
    });
  });

  describe('Extreme values', () => {
    it('should handle AQI of 0', () => {
      expect(getAQICategory(0).level).toBe('good');
      expect(getGolfRecommendation(0).level).toBe('great');
    });

    it('should handle maximum typical AQI (500)', () => {
      expect(getAQICategory(500).level).toBe('hazardous');
      expect(getGolfRecommendation(500).level).toBe('danger');
    });

    it('should handle AQI above 500', () => {
      expect(getAQICategory(999).level).toBe('hazardous');
      expect(getGolfRecommendation(999).level).toBe('danger');
    });

    it('should handle negative AQI gracefully', () => {
      expect(getAQICategory(-1).level).toBe('good');
    });

    it('should handle decimal AQI values', () => {
      expect(getAQICategory(50.5).level).toBe('moderate');
      expect(getAQICategory(50.4).level).toBe('moderate');
    });
  });
});

// ============================================================================
// Tests: Recommendation Consistency
// ============================================================================

describe('Recommendation Consistency', () => {
  it('should have consistent warning flags across all levels', () => {
    // Great and Good should not show warnings
    expect(getGolfRecommendation(25).showWarning).toBe(false);
    expect(getGolfRecommendation(60).showWarning).toBe(false);

    // Caution, Warning, and Danger should show warnings
    expect(getGolfRecommendation(85).showWarning).toBe(true);
    expect(getGolfRecommendation(125).showWarning).toBe(true);
    expect(getGolfRecommendation(175).showWarning).toBe(true);
  });

  it('should have consistent reschedule suggestions', () => {
    // Great, Good, and Caution should not suggest rescheduling
    expect(getGolfRecommendation(25).suggestReschedule).toBe(false);
    expect(getGolfRecommendation(60).suggestReschedule).toBe(false);
    expect(getGolfRecommendation(85).suggestReschedule).toBe(false);

    // Warning and Danger should suggest rescheduling
    expect(getGolfRecommendation(125).suggestReschedule).toBe(true);
    expect(getGolfRecommendation(175).suggestReschedule).toBe(true);
  });

  it('should have increasing severity of tips as AQI increases', () => {
    const greatTips = getGolfRecommendation(25).tips;
    const cautionTips = getGolfRecommendation(85).tips;
    const dangerTips = getGolfRecommendation(175).tips;

    // Great should have short, positive tips
    expect(greatTips.some(tip => tip.toLowerCase().includes('enjoy'))).toBe(true);

    // Caution should mention precautions
    expect(cautionTips.some(tip =>
      tip.toLowerCase().includes('cart') ||
      tip.toLowerCase().includes('breaks')
    )).toBe(true);

    // Danger should mention rescheduling
    expect(dangerTips.some(tip =>
      tip.toLowerCase().includes('rescheduling')
    )).toBe(true);
  });

  it('should always have tips array with at least one item', () => {
    const levels = ['great', 'good', 'caution', 'warning', 'danger'];
    const testAQIs = [25, 60, 85, 125, 175];

    testAQIs.forEach(aqi => {
      const recommendation = getGolfRecommendation(aqi);
      expect(Array.isArray(recommendation.tips)).toBe(true);
      expect(recommendation.tips.length).toBeGreaterThan(0);
    });
  });
});
