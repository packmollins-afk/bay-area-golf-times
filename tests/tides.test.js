/**
 * Tides Service Unit Tests
 * Comprehensive test suite for the NOAA Tides service
 *
 * Tests cover:
 * - getTidePredictions: Fetching tide data from NOAA API
 * - getNextHighTide: Finding the next high tide from a given time
 * - getNextLowTide: Finding the next low tide from a given time
 * - getTideStatus: Calculating current tide status (rising, falling, high, low)
 * - isCalmWindow: Detecting calm water conditions for coastal golf
 *
 * Run with: npm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Mock NOAA API response for tide predictions
 * Station 9414290 - San Francisco
 */
const mockNOAAResponse = {
  predictions: [
    { t: '2026-01-09 00:18', v: '5.847', type: 'H' },
    { t: '2026-01-09 06:42', v: '2.134', type: 'L' },
    { t: '2026-01-09 12:54', v: '5.523', type: 'H' },
    { t: '2026-01-09 19:06', v: '1.876', type: 'L' },
    { t: '2026-01-10 01:12', v: '5.632', type: 'H' },
    { t: '2026-01-10 07:36', v: '2.245', type: 'L' },
    { t: '2026-01-10 13:48', v: '5.411', type: 'H' },
    { t: '2026-01-10 20:00', v: '1.765', type: 'L' },
  ],
};

/**
 * Mock NOAA API response with extreme tides (King Tides)
 */
const mockKingTidesResponse = {
  predictions: [
    { t: '2026-01-09 00:18', v: '7.234', type: 'H' },
    { t: '2026-01-09 06:42', v: '-0.532', type: 'L' },
    { t: '2026-01-09 12:54', v: '6.987', type: 'H' },
    { t: '2026-01-09 19:06', v: '-0.234', type: 'L' },
  ],
};

/**
 * Mock NOAA API error response
 */
const mockNOAAErrorResponse = {
  error: {
    message: 'Station not found',
  },
};

/**
 * Mock empty predictions response
 */
const mockEmptyResponse = {
  predictions: [],
};

// ============================================================================
// Mock Service Implementation (simulates the tides service)
// ============================================================================

/**
 * Parse NOAA tide prediction to structured object
 */
function parseTidePrediction(prediction) {
  return {
    time: new Date(prediction.t.replace(' ', 'T') + ':00'),
    height: parseFloat(prediction.v),
    type: prediction.type === 'H' ? 'high' : 'low',
  };
}

/**
 * Mock fetch function for NOAA API
 */
const createMockFetch = (response, status = 200) => {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(response),
  });
};

// ============================================================================
// Tides Service Functions (to be tested)
// ============================================================================

/**
 * NOAA Tides API configuration
 */
const NOAA_API_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

/**
 * Station IDs for Bay Area
 */
const TIDE_STATIONS = {
  SAN_FRANCISCO: '9414290',
  MONTEREY: '9413450',
  POINT_REYES: '9415020',
};

/**
 * Fetch tide predictions from NOAA API
 * @param {string} stationId - NOAA station ID
 * @param {Date} beginDate - Start date for predictions
 * @param {Date} endDate - End date for predictions
 * @param {Function} fetchFn - Fetch function (for dependency injection)
 * @returns {Promise<Object>} Result with success status and data or error
 */
async function getTidePredictions(stationId, beginDate, endDate, fetchFn = fetch) {
  // Validate inputs
  if (!stationId || typeof stationId !== 'string') {
    return {
      success: false,
      error: { code: 'INVALID_STATION', message: 'Station ID is required' },
    };
  }

  if (!(beginDate instanceof Date) || isNaN(beginDate.getTime())) {
    return {
      success: false,
      error: { code: 'INVALID_DATE', message: 'Begin date is invalid' },
    };
  }

  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    return {
      success: false,
      error: { code: 'INVALID_DATE', message: 'End date is invalid' },
    };
  }

  if (beginDate > endDate) {
    return {
      success: false,
      error: { code: 'INVALID_DATE_RANGE', message: 'Begin date must be before end date' },
    };
  }

  // Format dates for NOAA API (YYYYMMDD)
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const params = new URLSearchParams({
    station: stationId,
    begin_date: formatDate(beginDate),
    end_date: formatDate(endDate),
    product: 'predictions',
    datum: 'MLLW',
    time_zone: 'lst_ldt',
    interval: 'hilo',
    units: 'english',
    format: 'json',
  });

  try {
    const response = await fetchFn(`${NOAA_API_BASE}?${params}`);

    if (!response.ok) {
      return {
        success: false,
        error: { code: 'API_ERROR', message: `NOAA API returned status ${response.status}` },
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: { code: 'NOAA_ERROR', message: data.error.message },
      };
    }

    if (!data.predictions || !Array.isArray(data.predictions)) {
      return {
        success: false,
        error: { code: 'INVALID_RESPONSE', message: 'No predictions in response' },
      };
    }

    const predictions = data.predictions.map(parseTidePrediction);

    return {
      success: true,
      data: {
        stationId,
        predictions,
        retrievedAt: new Date(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: error.message },
    };
  }
}

/**
 * Find the next high tide from a given time
 * @param {Array} predictions - Array of tide predictions
 * @param {Date} fromTime - Reference time
 * @returns {Object|null} Next high tide or null if not found
 */
function getNextHighTide(predictions, fromTime) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return null;
  }

  const fromTimestamp = fromTime.getTime();

  const nextHigh = predictions.find(
    (p) => p.type === 'high' && p.time.getTime() > fromTimestamp
  );

  return nextHigh || null;
}

/**
 * Find the next low tide from a given time
 * @param {Array} predictions - Array of tide predictions
 * @param {Date} fromTime - Reference time
 * @returns {Object|null} Next low tide or null if not found
 */
function getNextLowTide(predictions, fromTime) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return null;
  }

  const fromTimestamp = fromTime.getTime();

  const nextLow = predictions.find(
    (p) => p.type === 'low' && p.time.getTime() > fromTimestamp
  );

  return nextLow || null;
}

/**
 * Calculate current tide status
 * @param {Array} predictions - Array of tide predictions
 * @param {Date} atTime - Time to check status for
 * @returns {Object} Tide status with type, trend, and percentage
 */
function getTideStatus(predictions, atTime) {
  if (!Array.isArray(predictions) || predictions.length < 2) {
    return {
      status: 'unknown',
      trend: 'unknown',
      percentage: null,
      message: 'Insufficient tide data',
    };
  }

  const atTimestamp = atTime.getTime();

  // Find the tide events before and after the current time
  let previousTide = null;
  let nextTide = null;

  for (let i = 0; i < predictions.length; i++) {
    const prediction = predictions[i];
    const predTime = prediction.time.getTime();

    if (predTime <= atTimestamp) {
      previousTide = prediction;
    } else if (predTime > atTimestamp && !nextTide) {
      nextTide = prediction;
      break;
    }
  }

  // Handle edge cases
  if (!previousTide && !nextTide) {
    return {
      status: 'unknown',
      trend: 'unknown',
      percentage: null,
      message: 'Time is outside prediction range',
    };
  }

  // If we're at or very close to a tide event (within 15 minutes)
  const TIDE_THRESHOLD_MS = 15 * 60 * 1000;

  if (previousTide) {
    const timeSincePrevious = atTimestamp - previousTide.time.getTime();
    if (timeSincePrevious <= TIDE_THRESHOLD_MS) {
      return {
        status: previousTide.type,
        trend: previousTide.type === 'high' ? 'turning' : 'turning',
        percentage: 100,
        height: previousTide.height,
        message: `At ${previousTide.type} tide`,
      };
    }
  }

  if (nextTide) {
    const timeUntilNext = nextTide.time.getTime() - atTimestamp;
    if (timeUntilNext <= TIDE_THRESHOLD_MS) {
      return {
        status: nextTide.type,
        trend: 'approaching',
        percentage: 95,
        height: nextTide.height,
        message: `Approaching ${nextTide.type} tide`,
      };
    }
  }

  // Calculate trend and percentage between tides
  if (previousTide && nextTide) {
    const totalDuration = nextTide.time.getTime() - previousTide.time.getTime();
    const elapsed = atTimestamp - previousTide.time.getTime();
    const percentage = Math.round((elapsed / totalDuration) * 100);

    const trend = nextTide.type === 'high' ? 'rising' : 'falling';
    const currentHeight =
      previousTide.height + (nextTide.height - previousTide.height) * (percentage / 100);

    return {
      status: trend,
      trend,
      percentage,
      height: Math.round(currentHeight * 100) / 100,
      previousTide: {
        type: previousTide.type,
        time: previousTide.time,
        height: previousTide.height,
      },
      nextTide: {
        type: nextTide.type,
        time: nextTide.time,
        height: nextTide.height,
      },
      message: `Tide is ${trend} (${percentage}% to next ${nextTide.type} tide)`,
    };
  }

  // Only have one reference point
  if (previousTide && !nextTide) {
    const trend = previousTide.type === 'high' ? 'falling' : 'rising';
    return {
      status: trend,
      trend,
      percentage: null,
      message: `Tide is ${trend} after ${previousTide.type} tide`,
    };
  }

  if (!previousTide && nextTide) {
    const trend = nextTide.type === 'high' ? 'rising' : 'falling';
    return {
      status: trend,
      trend,
      percentage: null,
      message: `Tide is ${trend} toward ${nextTide.type} tide`,
    };
  }

  return {
    status: 'unknown',
    trend: 'unknown',
    percentage: null,
    message: 'Unable to determine tide status',
  };
}

/**
 * Determine if current conditions represent a "calm window" for coastal golf
 * Calm windows typically occur:
 * - 1-2 hours around low tide (least water movement)
 * - Early morning with low tide (best conditions)
 * - When tide height is below average
 *
 * @param {Array} predictions - Array of tide predictions
 * @param {Date} atTime - Time to check
 * @param {Object} options - Configuration options
 * @returns {Object} Calm window status
 */
function isCalmWindow(predictions, atTime, options = {}) {
  const {
    calmWindowMinutes = 90, // Minutes before/after low tide
    idealMorningHour = 9, // Best morning hour
    heightThreshold = 3.0, // Max height in feet for calm
  } = options;

  if (!Array.isArray(predictions) || predictions.length === 0) {
    return {
      isCalm: false,
      confidence: 0,
      reason: 'No tide data available',
    };
  }

  const atTimestamp = atTime.getTime();
  const atHour = atTime.getHours();
  const calmWindowMs = calmWindowMinutes * 60 * 1000;

  // Find nearest low tide
  let nearestLowTide = null;
  let minDistance = Infinity;

  for (const prediction of predictions) {
    if (prediction.type === 'low') {
      const distance = Math.abs(prediction.time.getTime() - atTimestamp);
      if (distance < minDistance) {
        minDistance = distance;
        nearestLowTide = prediction;
      }
    }
  }

  if (!nearestLowTide) {
    return {
      isCalm: false,
      confidence: 0,
      reason: 'No low tide found in predictions',
    };
  }

  // Calculate factors
  const withinCalmWindow = minDistance <= calmWindowMs;
  const isMorning = atHour >= 6 && atHour <= 11;
  const isLowHeight = nearestLowTide.height < heightThreshold;

  // Calculate confidence score (0-100)
  let confidence = 0;
  const factors = [];

  if (withinCalmWindow) {
    // Higher confidence closer to low tide
    const proximityScore = Math.round((1 - minDistance / calmWindowMs) * 40);
    confidence += proximityScore;
    factors.push(`Near low tide (+${proximityScore})`);
  }

  if (isMorning) {
    confidence += 25;
    factors.push('Morning hours (+25)');
  }

  if (isLowHeight) {
    confidence += 20;
    factors.push('Low tide height (+20)');
  }

  // Bonus for ideal conditions (morning + low tide window)
  if (withinCalmWindow && isMorning && atHour <= idealMorningHour) {
    confidence += 15;
    factors.push('Ideal morning low tide (+15)');
  }

  const isCalm = confidence >= 50;

  return {
    isCalm,
    confidence: Math.min(confidence, 100),
    factors,
    nearestLowTide: {
      time: nearestLowTide.time,
      height: nearestLowTide.height,
      minutesAway: Math.round(minDistance / 60000),
    },
    reason: isCalm
      ? 'Good conditions for coastal golf'
      : 'Not an optimal calm window',
  };
}

// ============================================================================
// Tests: getTidePredictions
// ============================================================================

describe('getTidePredictions', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = createMockFetch(mockNOAAResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('successful requests', () => {
    it('should fetch tide predictions for valid station and date range', async () => {
      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.stationId).toBe(TIDE_STATIONS.SAN_FRANCISCO);
      expect(result.data.predictions).toHaveLength(8);
    });

    it('should parse high and low tides correctly', async () => {
      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(true);

      const highTides = result.data.predictions.filter((p) => p.type === 'high');
      const lowTides = result.data.predictions.filter((p) => p.type === 'low');

      expect(highTides.length).toBe(4);
      expect(lowTides.length).toBe(4);
    });

    it('should parse tide heights as numbers', async () => {
      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(true);

      result.data.predictions.forEach((prediction) => {
        expect(typeof prediction.height).toBe('number');
        expect(prediction.height).not.toBeNaN();
      });
    });

    it('should parse tide times as Date objects', async () => {
      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(true);

      result.data.predictions.forEach((prediction) => {
        expect(prediction.time).toBeInstanceOf(Date);
        expect(prediction.time.getTime()).not.toBeNaN();
      });
    });

    it('should include retrievedAt timestamp', async () => {
      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(true);
      expect(result.data.retrievedAt).toBeInstanceOf(Date);
    });

    it('should work with different station IDs', async () => {
      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      for (const [name, stationId] of Object.entries(TIDE_STATIONS)) {
        const result = await getTidePredictions(stationId, beginDate, endDate, mockFetch);
        expect(result.success).toBe(true);
        expect(result.data.stationId).toBe(stationId);
      }
    });
  });

  describe('input validation', () => {
    it('should reject empty station ID', async () => {
      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions('', beginDate, endDate, mockFetch);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_STATION');
    });

    it('should reject null station ID', async () => {
      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(null, beginDate, endDate, mockFetch);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_STATION');
    });

    it('should reject invalid begin date', async () => {
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        'not-a-date',
        endDate,
        mockFetch
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_DATE');
    });

    it('should reject invalid end date', async () => {
      const beginDate = new Date('2026-01-09');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        'not-a-date',
        mockFetch
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_DATE');
    });

    it('should reject when begin date is after end date', async () => {
      const beginDate = new Date('2026-01-15');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  describe('API error handling', () => {
    it('should handle NOAA API error response', async () => {
      mockFetch = createMockFetch(mockNOAAErrorResponse);

      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        'invalid-station',
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOAA_ERROR');
    });

    it('should handle empty predictions response', async () => {
      mockFetch = createMockFetch(mockEmptyResponse);

      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(true);
      expect(result.data.predictions).toHaveLength(0);
    });

    it('should handle HTTP error status', async () => {
      mockFetch = createMockFetch({}, 500);

      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('API_ERROR');
    });

    it('should handle network errors', async () => {
      mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NETWORK_ERROR');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const beginDate = new Date('2026-01-09');
      const endDate = new Date('2026-01-10');

      const result = await getTidePredictions(
        TIDE_STATIONS.SAN_FRANCISCO,
        beginDate,
        endDate,
        mockFetch
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('URL construction', () => {
    it('should construct correct API URL with parameters', async () => {
      // Use explicit local dates to avoid timezone issues
      const beginDate = new Date(2026, 0, 9); // January 9, 2026 (local time)
      const endDate = new Date(2026, 0, 10); // January 10, 2026 (local time)

      await getTidePredictions(TIDE_STATIONS.SAN_FRANCISCO, beginDate, endDate, mockFetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(NOAA_API_BASE);
      expect(calledUrl).toContain('station=9414290');
      expect(calledUrl).toContain('begin_date=20260109');
      expect(calledUrl).toContain('end_date=20260110');
      expect(calledUrl).toContain('product=predictions');
      expect(calledUrl).toContain('datum=MLLW');
      expect(calledUrl).toContain('interval=hilo');
      expect(calledUrl).toContain('units=english');
      expect(calledUrl).toContain('format=json');
    });
  });
});

// ============================================================================
// Tests: getNextHighTide
// ============================================================================

describe('getNextHighTide', () => {
  const predictions = mockNOAAResponse.predictions.map(parseTidePrediction);

  it('should find the next high tide after a given time', () => {
    const fromTime = new Date('2026-01-09T03:00:00');
    const result = getNextHighTide(predictions, fromTime);

    expect(result).not.toBeNull();
    expect(result.type).toBe('high');
    expect(result.time.getTime()).toBeGreaterThan(fromTime.getTime());
  });

  it('should return the first high tide when searching from start of day', () => {
    const fromTime = new Date('2026-01-09T00:00:00');
    const result = getNextHighTide(predictions, fromTime);

    expect(result).not.toBeNull();
    expect(result.type).toBe('high');
    // First high tide is at 00:18
    expect(result.time.getHours()).toBe(0);
    expect(result.time.getMinutes()).toBe(18);
  });

  it('should skip past high tides that are before fromTime', () => {
    // After the first high tide at 00:18, next should be at 12:54
    const fromTime = new Date('2026-01-09T01:00:00');
    const result = getNextHighTide(predictions, fromTime);

    expect(result).not.toBeNull();
    expect(result.type).toBe('high');
    expect(result.time.getHours()).toBe(12);
  });

  it('should return null if no high tide exists after fromTime', () => {
    const fromTime = new Date('2026-01-11T00:00:00'); // After all predictions
    const result = getNextHighTide(predictions, fromTime);

    expect(result).toBeNull();
  });

  it('should return null for empty predictions array', () => {
    const fromTime = new Date('2026-01-09T03:00:00');
    const result = getNextHighTide([], fromTime);

    expect(result).toBeNull();
  });

  it('should return null for null predictions', () => {
    const fromTime = new Date('2026-01-09T03:00:00');
    const result = getNextHighTide(null, fromTime);

    expect(result).toBeNull();
  });

  it('should include height in the returned tide', () => {
    const fromTime = new Date('2026-01-09T00:00:00');
    const result = getNextHighTide(predictions, fromTime);

    expect(result).not.toBeNull();
    expect(typeof result.height).toBe('number');
    expect(result.height).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tests: getNextLowTide
// ============================================================================

describe('getNextLowTide', () => {
  const predictions = mockNOAAResponse.predictions.map(parseTidePrediction);

  it('should find the next low tide after a given time', () => {
    const fromTime = new Date('2026-01-09T03:00:00');
    const result = getNextLowTide(predictions, fromTime);

    expect(result).not.toBeNull();
    expect(result.type).toBe('low');
    expect(result.time.getTime()).toBeGreaterThan(fromTime.getTime());
  });

  it('should return the first low tide when searching from start of day', () => {
    const fromTime = new Date('2026-01-09T00:00:00');
    const result = getNextLowTide(predictions, fromTime);

    expect(result).not.toBeNull();
    expect(result.type).toBe('low');
    // First low tide is at 06:42
    expect(result.time.getHours()).toBe(6);
    expect(result.time.getMinutes()).toBe(42);
  });

  it('should skip past low tides that are before fromTime', () => {
    // After the first low tide at 06:42, next should be at 19:06
    const fromTime = new Date('2026-01-09T07:00:00');
    const result = getNextLowTide(predictions, fromTime);

    expect(result).not.toBeNull();
    expect(result.type).toBe('low');
    expect(result.time.getHours()).toBe(19);
  });

  it('should return null if no low tide exists after fromTime', () => {
    const fromTime = new Date('2026-01-11T00:00:00'); // After all predictions
    const result = getNextLowTide(predictions, fromTime);

    expect(result).toBeNull();
  });

  it('should return null for empty predictions array', () => {
    const fromTime = new Date('2026-01-09T03:00:00');
    const result = getNextLowTide([], fromTime);

    expect(result).toBeNull();
  });

  it('should return null for null predictions', () => {
    const fromTime = new Date('2026-01-09T03:00:00');
    const result = getNextLowTide(null, fromTime);

    expect(result).toBeNull();
  });

  it('should include height in the returned tide', () => {
    const fromTime = new Date('2026-01-09T00:00:00');
    const result = getNextLowTide(predictions, fromTime);

    expect(result).not.toBeNull();
    expect(typeof result.height).toBe('number');
    expect(result.height).toBeGreaterThan(0);
  });

  it('should correctly differentiate between high and low tides', () => {
    const fromTime = new Date('2026-01-09T00:00:00');

    const nextHigh = getNextHighTide(predictions, fromTime);
    const nextLow = getNextLowTide(predictions, fromTime);

    expect(nextHigh.type).toBe('high');
    expect(nextLow.type).toBe('low');
    expect(nextHigh.height).toBeGreaterThan(nextLow.height);
  });
});

// ============================================================================
// Tests: getTideStatus
// ============================================================================

describe('getTideStatus', () => {
  const predictions = mockNOAAResponse.predictions.map(parseTidePrediction);

  describe('rising tide detection', () => {
    it('should detect rising tide between low and high tide', () => {
      // Between low tide (06:42) and high tide (12:54) - tide should be rising
      const atTime = new Date('2026-01-09T09:00:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.status).toBe('rising');
      expect(result.trend).toBe('rising');
    });

    it('should calculate percentage progress correctly for rising tide', () => {
      // Midway between 06:42 and 12:54
      const atTime = new Date('2026-01-09T09:48:00'); // Approximately midpoint
      const result = getTideStatus(predictions, atTime);

      expect(result.status).toBe('rising');
      expect(result.percentage).toBeGreaterThan(40);
      expect(result.percentage).toBeLessThan(60);
    });

    it('should include previous and next tide information', () => {
      const atTime = new Date('2026-01-09T09:00:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.previousTide).toBeDefined();
      expect(result.previousTide.type).toBe('low');
      expect(result.nextTide).toBeDefined();
      expect(result.nextTide.type).toBe('high');
    });
  });

  describe('falling tide detection', () => {
    it('should detect falling tide between high and low tide', () => {
      // Between high tide (12:54) and low tide (19:06) - tide should be falling
      const atTime = new Date('2026-01-09T16:00:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.status).toBe('falling');
      expect(result.trend).toBe('falling');
    });

    it('should calculate percentage progress correctly for falling tide', () => {
      // Midway between 12:54 and 19:06
      const atTime = new Date('2026-01-09T16:00:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.status).toBe('falling');
      expect(result.percentage).toBeGreaterThan(40);
      expect(result.percentage).toBeLessThan(60);
    });

    it('should include previous and next tide information', () => {
      const atTime = new Date('2026-01-09T16:00:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.previousTide).toBeDefined();
      expect(result.previousTide.type).toBe('high');
      expect(result.nextTide).toBeDefined();
      expect(result.nextTide.type).toBe('low');
    });
  });

  describe('high tide detection', () => {
    it('should detect when at high tide (within threshold)', () => {
      // At high tide time 00:18
      const atTime = new Date('2026-01-09T00:18:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.status).toBe('high');
    });

    it('should detect when very close to high tide', () => {
      // Within 15 minutes of high tide at 00:18
      const atTime = new Date('2026-01-09T00:25:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.status).toBe('high');
      expect(result.trend).toBe('turning');
    });

    it('should report height at high tide', () => {
      const atTime = new Date('2026-01-09T00:18:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.height).toBeDefined();
      expect(result.height).toBeCloseTo(5.847, 1);
    });
  });

  describe('low tide detection', () => {
    it('should detect when at low tide (within threshold)', () => {
      // At low tide time 06:42
      const atTime = new Date('2026-01-09T06:42:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.status).toBe('low');
    });

    it('should detect when very close to low tide', () => {
      // Within 15 minutes of low tide at 06:42
      const atTime = new Date('2026-01-09T06:50:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.status).toBe('low');
      expect(result.trend).toBe('turning');
    });
  });

  describe('edge cases', () => {
    it('should handle time before all predictions', () => {
      const atTime = new Date('2026-01-08T00:00:00');
      const result = getTideStatus(predictions, atTime);

      // Should still work if there's a next tide
      expect(result.status).not.toBe('unknown');
    });

    it('should handle time after all predictions', () => {
      const atTime = new Date('2026-01-11T00:00:00');
      const result = getTideStatus(predictions, atTime);

      // Should still work if there's a previous tide
      expect(['unknown', 'rising', 'falling']).toContain(result.status);
    });

    it('should handle empty predictions array', () => {
      const atTime = new Date('2026-01-09T12:00:00');
      const result = getTideStatus([], atTime);

      expect(result.status).toBe('unknown');
      expect(result.message).toContain('Insufficient');
    });

    it('should handle single prediction', () => {
      const singlePrediction = [predictions[0]];
      const atTime = new Date('2026-01-09T12:00:00');
      const result = getTideStatus(singlePrediction, atTime);

      expect(result.status).toBe('unknown');
    });

    it('should include a human-readable message', () => {
      const atTime = new Date('2026-01-09T09:00:00');
      const result = getTideStatus(predictions, atTime);

      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('height interpolation', () => {
    it('should interpolate current height between tides', () => {
      const atTime = new Date('2026-01-09T09:00:00');
      const result = getTideStatus(predictions, atTime);

      // Height should be between low (2.134) and high (5.523)
      expect(result.height).toBeGreaterThan(2.134);
      expect(result.height).toBeLessThan(5.523);
    });

    it('should calculate reasonable height values', () => {
      const atTime = new Date('2026-01-09T09:48:00'); // Midpoint
      const result = getTideStatus(predictions, atTime);

      // Midpoint height should be approximately average
      const expectedMidpoint = (2.134 + 5.523) / 2;
      expect(result.height).toBeCloseTo(expectedMidpoint, 0);
    });
  });
});

// ============================================================================
// Tests: isCalmWindow
// ============================================================================

describe('isCalmWindow', () => {
  const predictions = mockNOAAResponse.predictions.map(parseTidePrediction);

  describe('calm window detection', () => {
    it('should detect calm window near low tide in morning', () => {
      // Near low tide at 06:42 in morning
      const atTime = new Date('2026-01-09T07:00:00');
      const result = isCalmWindow(predictions, atTime);

      expect(result.isCalm).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(50);
    });

    it('should return higher confidence for ideal morning low tide', () => {
      // Near low tide at 06:42 during prime golf hours
      const atTime = new Date('2026-01-09T07:30:00');
      const result = isCalmWindow(predictions, atTime);

      expect(result.isCalm).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(60);
    });

    it('should not detect calm window far from low tide', () => {
      // Far from any low tide, near high tide
      const atTime = new Date('2026-01-09T12:54:00');
      const result = isCalmWindow(predictions, atTime);

      expect(result.confidence).toBeLessThan(50);
    });

    it('should factor in morning hours', () => {
      // Morning time should boost confidence
      const morningTime = new Date('2026-01-09T08:00:00');
      const afternoonTime = new Date('2026-01-09T15:00:00');

      const morningResult = isCalmWindow(predictions, morningTime);
      const afternoonResult = isCalmWindow(predictions, afternoonTime);

      // Morning should have higher confidence (closer to low tide too)
      expect(morningResult.confidence).toBeGreaterThan(afternoonResult.confidence);
    });
  });

  describe('confidence scoring', () => {
    it('should include factors that contributed to confidence', () => {
      const atTime = new Date('2026-01-09T07:00:00');
      const result = isCalmWindow(predictions, atTime);

      expect(result.factors).toBeDefined();
      expect(Array.isArray(result.factors)).toBe(true);
      expect(result.factors.length).toBeGreaterThan(0);
    });

    it('should cap confidence at 100', () => {
      // Create ideal conditions
      const atTime = new Date('2026-01-09T06:45:00'); // Very close to low tide, morning
      const result = isCalmWindow(predictions, atTime);

      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should return 0 confidence with no data', () => {
      const atTime = new Date('2026-01-09T08:00:00');
      const result = isCalmWindow([], atTime);

      expect(result.isCalm).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe('nearest low tide information', () => {
    it('should include nearest low tide details', () => {
      const atTime = new Date('2026-01-09T08:00:00');
      const result = isCalmWindow(predictions, atTime);

      expect(result.nearestLowTide).toBeDefined();
      expect(result.nearestLowTide.time).toBeInstanceOf(Date);
      expect(typeof result.nearestLowTide.height).toBe('number');
      expect(typeof result.nearestLowTide.minutesAway).toBe('number');
    });

    it('should calculate minutes away correctly', () => {
      // 1.5 hours after low tide at 06:42
      const atTime = new Date('2026-01-09T08:12:00');
      const result = isCalmWindow(predictions, atTime);

      expect(result.nearestLowTide.minutesAway).toBe(90);
    });
  });

  describe('custom options', () => {
    it('should respect custom calm window minutes', () => {
      // With default 90 minutes, should be calm
      const atTime = new Date('2026-01-09T08:00:00'); // ~78 mins from low tide

      const defaultResult = isCalmWindow(predictions, atTime);
      const narrowResult = isCalmWindow(predictions, atTime, { calmWindowMinutes: 60 });

      // Default should detect calm (within 90 min)
      // Narrow window might not (depends on other factors)
      expect(defaultResult.confidence).toBeGreaterThan(narrowResult.confidence);
    });

    it('should respect custom height threshold', () => {
      const atTime = new Date('2026-01-09T06:45:00');

      // Default threshold is 3.0 feet
      const defaultResult = isCalmWindow(predictions, atTime);

      // Very low threshold - low tide height of 2.134 should still pass
      const lowThresholdResult = isCalmWindow(predictions, atTime, {
        heightThreshold: 2.5,
      });

      // Very strict threshold - low tide height of 2.134 should pass
      const strictResult = isCalmWindow(predictions, atTime, {
        heightThreshold: 1.0,
      });

      // All should find the tide, but confidence may vary
      expect(defaultResult.nearestLowTide).toBeDefined();
      expect(lowThresholdResult.nearestLowTide).toBeDefined();
      expect(strictResult.nearestLowTide).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty predictions', () => {
      const atTime = new Date('2026-01-09T08:00:00');
      const result = isCalmWindow([], atTime);

      expect(result.isCalm).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain('No tide data');
    });

    it('should handle null predictions', () => {
      const atTime = new Date('2026-01-09T08:00:00');
      const result = isCalmWindow(null, atTime);

      expect(result.isCalm).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle predictions with no low tides', () => {
      const highTidesOnly = predictions.filter((p) => p.type === 'high');
      const atTime = new Date('2026-01-09T08:00:00');
      const result = isCalmWindow(highTidesOnly, atTime);

      expect(result.isCalm).toBe(false);
      expect(result.reason).toContain('No low tide');
    });

    it('should provide a human-readable reason', () => {
      const atTime = new Date('2026-01-09T07:00:00');
      const result = isCalmWindow(predictions, atTime);

      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });

  describe('king tides handling', () => {
    const kingTidePredictions = mockKingTidesResponse.predictions.map(parseTidePrediction);

    it('should detect calm window with king tides', () => {
      // Near low tide at 06:42 during king tide event
      const atTime = new Date('2026-01-09T06:45:00');
      const result = isCalmWindow(kingTidePredictions, atTime);

      expect(result.nearestLowTide).toBeDefined();
    });

    it('should handle negative tide heights', () => {
      // King tides can have negative low tide heights
      const atTime = new Date('2026-01-09T06:45:00');
      const result = isCalmWindow(kingTidePredictions, atTime);

      expect(result.nearestLowTide.height).toBeLessThan(0);
    });
  });
});

// ============================================================================
// Tests: Integration scenarios
// ============================================================================

describe('Integration scenarios', () => {
  const predictions = mockNOAAResponse.predictions.map(parseTidePrediction);

  describe('coastal golf planning', () => {
    it('should recommend morning tee time near low tide', () => {
      // Check if 7 AM is a good time (near low tide at 06:42)
      const teeTime = new Date('2026-01-09T07:00:00');

      const status = getTideStatus(predictions, teeTime);
      const calm = isCalmWindow(predictions, teeTime);

      // Just after low tide, tide rising slowly
      expect(status.trend).toBe('rising');
      expect(calm.isCalm).toBe(true);
    });

    it('should warn about afternoon high tide conditions', () => {
      // Check if 1 PM is less ideal (at high tide 12:54)
      const teeTime = new Date('2026-01-09T13:00:00');

      const status = getTideStatus(predictions, teeTime);
      const calm = isCalmWindow(predictions, teeTime);

      // Near high tide, water at maximum
      expect(['high', 'falling']).toContain(status.status);
      expect(calm.isCalm).toBe(false);
    });

    it('should find best tee time for coastal course', () => {
      // Find the best window among potential tee times
      const potentialTimes = [
        new Date('2026-01-09T06:00:00'),
        new Date('2026-01-09T07:00:00'),
        new Date('2026-01-09T08:00:00'),
        new Date('2026-01-09T09:00:00'),
        new Date('2026-01-09T10:00:00'),
      ];

      const results = potentialTimes.map((time) => ({
        time,
        calm: isCalmWindow(predictions, time),
      }));

      // 7 AM should be best (closest to low tide at 06:42)
      const bestTime = results.reduce((best, current) =>
        current.calm.confidence > best.calm.confidence ? current : best
      );

      expect(bestTime.time.getHours()).toBe(7);
    });
  });

  describe('full tide cycle tracking', () => {
    it('should track tide through full cycle', () => {
      const checkTimes = [
        { time: new Date('2026-01-09T00:18:00'), expectedStatus: 'high' },
        { time: new Date('2026-01-09T03:30:00'), expectedStatus: 'falling' },
        { time: new Date('2026-01-09T06:42:00'), expectedStatus: 'low' },
        { time: new Date('2026-01-09T09:48:00'), expectedStatus: 'rising' },
        { time: new Date('2026-01-09T12:54:00'), expectedStatus: 'high' },
        { time: new Date('2026-01-09T16:00:00'), expectedStatus: 'falling' },
        { time: new Date('2026-01-09T19:06:00'), expectedStatus: 'low' },
      ];

      checkTimes.forEach(({ time, expectedStatus }) => {
        const result = getTideStatus(predictions, time);
        expect(result.status).toBe(expectedStatus);
      });
    });
  });
});

// ============================================================================
// Tests: Data validation (based on NOAA API test requirements)
// ============================================================================

describe('Data validation', () => {
  const predictions = mockNOAAResponse.predictions.map(parseTidePrediction);

  it('NT-007: High tides should have greater heights than adjacent low tides', () => {
    const highTides = predictions.filter((p) => p.type === 'high');
    const lowTides = predictions.filter((p) => p.type === 'low');

    highTides.forEach((high) => {
      lowTides.forEach((low) => {
        expect(high.height).toBeGreaterThan(low.height);
      });
    });
  });

  it('NT-008: Should typically have 2 high and 2 low tides per day', () => {
    // Filter predictions for just Jan 9
    const jan9Predictions = predictions.filter((p) => p.time.getDate() === 9);

    const highTides = jan9Predictions.filter((p) => p.type === 'high');
    const lowTides = jan9Predictions.filter((p) => p.type === 'low');

    expect(highTides.length).toBe(2);
    expect(lowTides.length).toBe(2);
  });

  it('NT-009: Tide times should be valid dates', () => {
    predictions.forEach((prediction) => {
      expect(prediction.time).toBeInstanceOf(Date);
      expect(prediction.time.getTime()).not.toBeNaN();
    });
  });

  it('NT-010: Height values should be within typical SF Bay range (-2 to 8 feet)', () => {
    predictions.forEach((prediction) => {
      expect(prediction.height).toBeGreaterThanOrEqual(-2);
      expect(prediction.height).toBeLessThanOrEqual(8);
    });
  });
});
