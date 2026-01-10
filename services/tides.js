/**
 * NOAA Tides API Service Module
 *
 * Provides tide predictions for Bay Area coastal golf courses using
 * NOAA's CO-OPS Data Retrieval API (station 9414290 - San Francisco).
 *
 * API Documentation: https://api.tidesandcurrents.noaa.gov/api/prod/
 *
 * Works in both Node.js and browser environments.
 */

// =============================================================================
// Universal Module Definition (UMD)
// =============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js / CommonJS
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else {
    // Browser globals
    root.TidesService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ===========================================================================
  // Constants
  // ===========================================================================

  var NOAA_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

  /** San Francisco Bay station ID */
  var SF_BAY_STATION_ID = '9414290';

  /** Default configuration */
  var DEFAULT_CONFIG = {
    stationId: SF_BAY_STATION_ID,
    units: 'english',
    timeZone: 'lst_ldt',
    application: 'BayAreaGolfTimes'
  };

  /** Wind speed thresholds for golf (mph) */
  var WIND_THRESHOLDS = {
    ideal: 8,        // Under 8 mph is ideal
    moderate: 15,    // 8-15 mph is playable
    challenging: 25  // 15-25 mph is challenging
    // Over 25 mph is not recommended
  };

  /** Tide height thresholds for coastal conditions (feet) */
  var TIDE_THRESHOLDS = {
    veryLow: 1.0,    // Very low tide - exposed hazards
    low: 2.5,        // Low tide
    moderate: 4.0,   // Moderate tide
    high: 5.5,       // High tide
    veryHigh: 6.5    // Very high tide - potential flooding
  };

  /** Request timeout in milliseconds */
  var REQUEST_TIMEOUT = 15000;

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  /**
   * Format a date as YYYYMMDD for NOAA API
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string
   */
  function formatDateForAPI(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + month + day;
  }

  /**
   * Parse NOAA timestamp string to Date object
   * NOAA format: "YYYY-MM-DD HH:MM"
   * @param {string} timestamp - NOAA timestamp string
   * @returns {Date} Parsed Date object
   */
  function parseNOAATimestamp(timestamp) {
    var parts = timestamp.split(' ');
    var datePart = parts[0];
    var timePart = parts[1];
    var dateParts = datePart.split('-').map(Number);
    var timeParts = timePart.split(':').map(Number);
    return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);
  }

  /**
   * Format time for display (e.g., "2:30 PM")
   * @param {Date} date - The date to format
   * @returns {string} Formatted time string
   */
  function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Format date for display (e.g., "Jan 9, 2026")
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string
   */
  function formatDate(date) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Calculate sinusoidal interpolation between tides
   * Tides follow a roughly sinusoidal pattern
   * @param {Object} prevTide - Previous tide prediction
   * @param {Object} nextTide - Next tide prediction
   * @param {Date} currentTime - Current time
   * @returns {number} Estimated tide height
   */
  function interpolateTideHeight(prevTide, nextTide, currentTime) {
    var totalDuration = nextTide.time.getTime() - prevTide.time.getTime();
    var elapsed = currentTime.getTime() - prevTide.time.getTime();
    var progress = elapsed / totalDuration;

    // Use cosine interpolation for more accurate tide estimation
    var cosProgress = (1 - Math.cos(progress * Math.PI)) / 2;

    return prevTide.height + (nextTide.height - prevTide.height) * cosProgress;
  }

  /**
   * Merge configuration with defaults
   * @param {Object} config - User configuration
   * @returns {Object} Merged configuration
   */
  function mergeConfig(config) {
    var merged = {};
    for (var key in DEFAULT_CONFIG) {
      merged[key] = DEFAULT_CONFIG[key];
    }
    if (config) {
      for (var key in config) {
        if (config.hasOwnProperty(key)) {
          merged[key] = config[key];
        }
      }
    }
    return merged;
  }

  /**
   * Fetch with timeout - works in both Node.js and browser
   * @param {string} url - URL to fetch
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Response>} Fetch response
   */
  function fetchWithTimeout(url, timeout) {
    timeout = timeout || REQUEST_TIMEOUT;

    // Check if AbortController is available (modern browsers and Node.js 15+)
    if (typeof AbortController !== 'undefined') {
      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, timeout);

      return fetch(url, { signal: controller.signal })
        .then(function(response) {
          clearTimeout(timeoutId);
          return response;
        })
        .catch(function(error) {
          clearTimeout(timeoutId);
          throw error;
        });
    }

    // Fallback for older environments - race with timeout
    return Promise.race([
      fetch(url),
      new Promise(function(_, reject) {
        setTimeout(function() {
          reject(new Error('Request timed out'));
        }, timeout);
      })
    ]);
  }

  // ===========================================================================
  // Core API Functions
  // ===========================================================================

  /**
   * Fetch tide predictions from NOAA API
   *
   * @param {Date} startDate - Start date for predictions
   * @param {Date} endDate - End date for predictions
   * @param {Object} [config] - Service configuration options
   * @param {string} [config.stationId='9414290'] - NOAA station ID
   * @param {string} [config.units='english'] - Unit system ('english' or 'metric')
   * @param {string} [config.timeZone='lst_ldt'] - Time zone
   * @param {string} [config.application='BayAreaGolfTimes'] - Application identifier
   * @returns {Promise<Array<Object>>} Array of tide predictions
   * @throws {Error} If API request fails
   *
   * @example
   * var today = new Date();
   * var tomorrow = new Date();
   * tomorrow.setDate(tomorrow.getDate() + 1);
   * getTidePredictions(today, tomorrow).then(function(tides) {
   *   console.log(tides);
   * });
   */
  function getTidePredictions(startDate, endDate, config) {
    var mergedConfig = mergeConfig(config);

    var params = new URLSearchParams({
      begin_date: formatDateForAPI(startDate),
      end_date: formatDateForAPI(endDate),
      station: mergedConfig.stationId,
      product: 'predictions',
      datum: 'MLLW',
      time_zone: mergedConfig.timeZone,
      interval: 'hilo',
      units: mergedConfig.units,
      format: 'json',
      application: mergedConfig.application
    });

    var url = NOAA_BASE_URL + '?' + params.toString();

    return fetchWithTimeout(url)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('NOAA API request failed: ' + response.status + ' ' + response.statusText);
        }
        return response.json();
      })
      .then(function(data) {
        if (data.error) {
          throw new Error('NOAA API error: ' + data.error.message);
        }

        if (!data.predictions || !Array.isArray(data.predictions)) {
          throw new Error('Invalid response format from NOAA API');
        }

        return data.predictions.map(function(prediction) {
          var time = parseNOAATimestamp(prediction.t);
          return {
            time: time,
            height: parseFloat(prediction.v),
            type: prediction.type,
            typeLabel: prediction.type === 'H' ? 'High' : 'Low',
            formattedTime: formatTime(time),
            formattedDate: formatDate(time)
          };
        });
      });
  }

  /**
   * Get tide predictions for today
   *
   * @param {Object} [config] - Service configuration options
   * @returns {Promise<Array<Object>>} Array of today's tide predictions
   */
  function getTodayTides(config) {
    var today = new Date();
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return getTidePredictions(today, tomorrow, config);
  }

  /**
   * Get tide predictions for the next N days
   *
   * @param {number} [days=7] - Number of days to fetch
   * @param {Object} [config] - Service configuration options
   * @returns {Promise<Array<Object>>} Array of tide predictions
   */
  function getExtendedTideForecast(days, config) {
    days = days || 7;
    var startDate = new Date();
    var endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return getTidePredictions(startDate, endDate, config);
  }

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

  /**
   * Get the next high tide from now
   *
   * @param {Array<Object>} [predictions] - Array of tide predictions (or fetches if not provided)
   * @param {Date} [fromTime] - Reference time (default: now)
   * @param {Object} [config] - Service configuration options
   * @returns {Promise<Object|null>} Next high tide prediction or null if none found
   *
   * @example
   * getNextHighTide().then(function(tide) {
   *   if (tide) {
   *     console.log('Next high tide at ' + tide.formattedTime);
   *   }
   * });
   */
  function getNextHighTide(predictions, fromTime, config) {
    fromTime = fromTime || new Date();

    var tidesPromise = predictions
      ? Promise.resolve(predictions)
      : getTodayTides(config);

    return tidesPromise.then(function(tides) {
      // Find future high tide in current tides
      var todayHighTide = tides.find(function(tide) {
        return tide.type === 'H' && tide.time > fromTime;
      });

      if (todayHighTide) {
        return todayHighTide;
      }

      // If no future high tides today, fetch tomorrow's
      var tomorrow = new Date(fromTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      var dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      return getTidePredictions(tomorrow, dayAfter, config).then(function(tomorrowTides) {
        var allTides = tides.concat(tomorrowTides);
        return allTides.find(function(tide) {
          return tide.type === 'H' && tide.time > fromTime;
        }) || null;
      });
    });
  }

  /**
   * Get the next low tide from now
   *
   * @param {Array<Object>} [predictions] - Array of tide predictions (or fetches if not provided)
   * @param {Date} [fromTime] - Reference time (default: now)
   * @param {Object} [config] - Service configuration options
   * @returns {Promise<Object|null>} Next low tide prediction or null if none found
   *
   * @example
   * getNextLowTide().then(function(tide) {
   *   if (tide) {
   *     console.log('Next low tide at ' + tide.formattedTime);
   *   }
   * });
   */
  function getNextLowTide(predictions, fromTime, config) {
    fromTime = fromTime || new Date();

    var tidesPromise = predictions
      ? Promise.resolve(predictions)
      : getTodayTides(config);

    return tidesPromise.then(function(tides) {
      // Find future low tide in current tides
      var todayLowTide = tides.find(function(tide) {
        return tide.type === 'L' && tide.time > fromTime;
      });

      if (todayLowTide) {
        return todayLowTide;
      }

      // If no future low tides today, fetch tomorrow's
      var tomorrow = new Date(fromTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      var dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      return getTidePredictions(tomorrow, dayAfter, config).then(function(tomorrowTides) {
        var allTides = tides.concat(tomorrowTides);
        return allTides.find(function(tide) {
          return tide.type === 'L' && tide.time > fromTime;
        }) || null;
      });
    });
  }

  /**
   * Get current tide status including state, progress, and estimated height
   *
   * @param {Array<Object>} [predictions] - Array of tide predictions (or fetches if not provided)
   * @param {Date} [currentTime] - Reference time (default: now)
   * @param {Object} [config] - Service configuration options
   * @returns {Promise<Object>} Current tide status
   *
   * @example
   * getTideStatus().then(function(status) {
   *   console.log(status.description);
   *   console.log('Estimated height: ' + status.estimatedHeight + ' ft');
   * });
   */
  function getTideStatus(predictions, currentTime, config) {
    currentTime = currentTime || new Date();

    // Fetch extended predictions to ensure we have surrounding tides
    var yesterday = new Date(currentTime);
    yesterday.setDate(yesterday.getDate() - 1);
    var tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 2);

    var tidesPromise = predictions
      ? Promise.resolve(predictions)
      : getTidePredictions(yesterday, tomorrow, config);

    return tidesPromise.then(function(tides) {
      // Find previous and next tides
      var previousTide = null;
      for (var i = tides.length - 1; i >= 0; i--) {
        if (tides[i].time <= currentTime) {
          previousTide = tides[i];
          break;
        }
      }

      var nextTide = tides.find(function(tide) {
        return tide.time > currentTime;
      }) || null;

      // Calculate progress and state
      var progress = 0;
      var estimatedHeight = 0;
      var state = 'rising';

      if (previousTide && nextTide) {
        var totalDuration = nextTide.time.getTime() - previousTide.time.getTime();
        var elapsed = currentTime.getTime() - previousTide.time.getTime();
        progress = Math.min(1, Math.max(0, elapsed / totalDuration));

        estimatedHeight = interpolateTideHeight(previousTide, nextTide, currentTime);

        // Determine state based on tide types
        if (previousTide.type === 'L' && nextTide.type === 'H') {
          state = progress < 0.1 ? 'low' : 'rising';
        } else if (previousTide.type === 'H' && nextTide.type === 'L') {
          state = progress < 0.1 ? 'high' : 'falling';
        }
      } else if (previousTide) {
        estimatedHeight = previousTide.height;
        state = previousTide.type === 'H' ? 'falling' : 'rising';
      } else if (nextTide) {
        estimatedHeight = nextTide.type === 'H'
          ? nextTide.height - 2  // Rough estimate
          : nextTide.height + 2;
        state = nextTide.type === 'H' ? 'rising' : 'falling';
      }

      // Generate description
      var stateDescriptions = {
        rising: 'Tide is rising (incoming)',
        falling: 'Tide is falling (outgoing)',
        high: 'At or near high tide',
        low: 'At or near low tide'
      };

      var description = stateDescriptions[state];
      if (nextTide) {
        var minutesUntilNext = Math.round(
          (nextTide.time.getTime() - currentTime.getTime()) / (1000 * 60)
        );
        var hoursUntilNext = Math.floor(minutesUntilNext / 60);
        var remainingMinutes = minutesUntilNext % 60;

        if (hoursUntilNext > 0) {
          description += '. Next ' + nextTide.typeLabel.toLowerCase() + ' tide in ' + hoursUntilNext + 'h ' + remainingMinutes + 'm';
        } else {
          description += '. Next ' + nextTide.typeLabel.toLowerCase() + ' tide in ' + minutesUntilNext + ' minutes';
        }
      }

      return {
        state: state,
        previousTide: previousTide,
        nextTide: nextTide,
        progress: progress,
        estimatedHeight: Math.round(estimatedHeight * 10) / 10,
        description: description
      };
    });
  }

  /**
   * Determine if current conditions represent a calm window for golf
   *
   * @param {Object} tideStatus - Current tide status (from getTideStatus)
   * @param {Object} [windConditions] - Current wind conditions
   * @param {number} [windConditions.speed] - Wind speed in mph
   * @param {number} [windConditions.direction] - Wind direction in degrees
   * @param {number} [windConditions.gusts] - Wind gust speed in mph
   * @param {Date} [checkTime] - Time to check (default: now)
   * @returns {Object} Calm window assessment
   *
   * @example
   * getTideStatus().then(function(status) {
   *   var windConditions = { speed: 8, direction: 270, gusts: 12 };
   *   var calmWindow = isCalmWindow(status, windConditions);
   *   console.log(calmWindow.recommendation);
   * });
   */
  function isCalmWindow(tideStatus, windConditions, checkTime) {
    checkTime = checkTime || new Date();

    // Calculate tide score
    var tideScore = 50; // Base score

    // Slack tide (near high or low) is often calmer
    if (tideStatus.state === 'high' || tideStatus.state === 'low') {
      tideScore += 25;
    }

    // Moderate tide heights are preferable for coastal courses
    var height = tideStatus.estimatedHeight;
    if (height >= TIDE_THRESHOLDS.low && height <= TIDE_THRESHOLDS.high) {
      tideScore += 20;
    } else if (height < TIDE_THRESHOLDS.veryLow || height > TIDE_THRESHOLDS.veryHigh) {
      tideScore -= 20;
    }

    // Mid-tide transitions can have stronger currents affecting wind
    if (tideStatus.progress > 0.4 && tideStatus.progress < 0.6) {
      tideScore -= 10;
    }

    // Calculate wind score
    var windScore = 100; // Assume perfect if no data
    if (windConditions) {
      if (windConditions.speed <= WIND_THRESHOLDS.ideal) {
        windScore = 100;
      } else if (windConditions.speed <= WIND_THRESHOLDS.moderate) {
        windScore = 80 - (windConditions.speed - WIND_THRESHOLDS.ideal) * 3;
      } else if (windConditions.speed <= WIND_THRESHOLDS.challenging) {
        windScore = 50 - (windConditions.speed - WIND_THRESHOLDS.moderate) * 3;
      } else {
        windScore = Math.max(0, 20 - (windConditions.speed - WIND_THRESHOLDS.challenging) * 2);
      }

      // Gusts reduce score further
      if (windConditions.gusts && windConditions.gusts > windConditions.speed + 10) {
        windScore -= 15;
      }
    }

    // Calculate overall quality
    var qualityScore = Math.round((tideScore + windScore) / 2);
    var isCalm = qualityScore >= 60;

    // Determine tide condition
    var tideCondition = 'slack';
    if (tideStatus.state === 'rising') {
      tideCondition = 'incoming';
    } else if (tideStatus.state === 'falling') {
      tideCondition = 'outgoing';
    }

    // Calculate window duration estimate
    var durationMinutes = 60; // Base estimate
    var startTime = new Date(checkTime);
    var endTime = new Date(checkTime);

    if (tideStatus.nextTide) {
      var minutesToNextTide = Math.round(
        (tideStatus.nextTide.time.getTime() - checkTime.getTime()) / (1000 * 60)
      );

      // Slack water window is roughly 1 hour before and after tide turn
      if (minutesToNextTide <= 60) {
        // Approaching slack water
        durationMinutes = minutesToNextTide + 60;
        endTime = new Date(tideStatus.nextTide.time.getTime() + 60 * 60 * 1000);
      } else if (tideStatus.previousTide) {
        var minutesSincePrevTide = Math.round(
          (checkTime.getTime() - tideStatus.previousTide.time.getTime()) / (1000 * 60)
        );

        if (minutesSincePrevTide <= 60) {
          // Just past slack water
          durationMinutes = 60 - minutesSincePrevTide;
          startTime = tideStatus.previousTide.time;
          endTime = new Date(tideStatus.previousTide.time.getTime() + 60 * 60 * 1000);
        } else {
          // Mid-tide - estimate based on conditions
          durationMinutes = isCalm ? 120 : 30;
          endTime = new Date(checkTime.getTime() + durationMinutes * 60 * 1000);
        }
      }
    }

    // Generate recommendation
    var recommendation;
    if (qualityScore >= 80) {
      recommendation = 'Excellent conditions for coastal golf. Ideal time to play.';
    } else if (qualityScore >= 60) {
      recommendation = 'Good conditions. Suitable for most players.';
    } else if (qualityScore >= 40) {
      recommendation = 'Moderate conditions. Expect some wind challenges on exposed holes.';
    } else {
      recommendation = 'Challenging conditions. Consider postponing or playing protected inland holes.';
    }

    return {
      isCalm: isCalm,
      startTime: startTime,
      endTime: endTime,
      durationMinutes: durationMinutes,
      qualityScore: qualityScore,
      tideCondition: tideCondition,
      recommendation: recommendation
    };
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  return {
    // Core functions
    getTidePredictions: getTidePredictions,
    getTodayTides: getTodayTides,
    getExtendedTideForecast: getExtendedTideForecast,

    // Helper functions
    getNextHighTide: getNextHighTide,
    getNextLowTide: getNextLowTide,
    getTideStatus: getTideStatus,
    isCalmWindow: isCalmWindow,

    // Constants
    SF_BAY_STATION_ID: SF_BAY_STATION_ID,
    WIND_THRESHOLDS: WIND_THRESHOLDS,
    TIDE_THRESHOLDS: TIDE_THRESHOLDS,
    DEFAULT_CONFIG: DEFAULT_CONFIG,

    // Utility functions (exposed for testing/advanced use)
    formatTime: formatTime,
    formatDate: formatDate
  };

}));
