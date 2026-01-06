/**
 * Golf Booking AI Agent
 * Main entry point - orchestrates parsing, scoring, and recommendations
 */

const { parseQuery } = require('./parser');
const { processTeeTimes } = require('./scorer');
const {
  generateRecommendation,
  generateFollowUpSuggestions,
  formatRecommendations
} = require('./recommender');

/**
 * Main agent function - processes a natural language golf booking request
 *
 * @param {string} query - Natural language query from user
 * @param {Array} availableTeeTimes - All available tee times from database
 * @param {Object} context - User context (location, preferences, conversation history)
 * @returns {Object} Agent response with recommendations
 */
async function processBookingRequest(query, availableTeeTimes, context = {}) {
  const startTime = Date.now();

  try {
    // Step 1: Parse the natural language query
    const parsedParams = await parseQuery(query, context);

    // Step 2: Filter and score tee times
    const processed = processTeeTimes(availableTeeTimes, parsedParams, context);

    // Step 3: Generate AI recommendation
    const recommendation = await generateRecommendation(
      query,
      parsedParams,
      processed.results,
      context
    );

    // Step 4: Generate follow-up suggestions
    const followUps = generateFollowUpSuggestions(
      parsedParams,
      processed.results.slice(0, 5)
    );

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      query: query,
      parsedParams,
      message: recommendation.message,
      topPick: recommendation.topPick,
      alternatives: recommendation.alternatives,
      allResults: processed.results.slice(0, 20), // Limit full results
      summary: {
        totalAvailable: processed.totalFound,
        matchingCriteria: processed.matchingCount,
        filtersApplied: processed.filters_applied
      },
      followUpSuggestions: followUps,
      processingTimeMs: processingTime
    };

  } catch (error) {
    console.error('Agent error:', error);
    return {
      success: false,
      query: query,
      error: error.message,
      message: "Sorry, I had trouble processing your request. Please try again or be more specific about what you're looking for.",
      processingTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Quick search - faster version that skips AI generation
 * Useful for real-time filtering as user types
 */
async function quickSearch(query, availableTeeTimes, context = {}) {
  const parsedParams = await parseQuery(query, context);
  const processed = processTeeTimes(availableTeeTimes, parsedParams, context);

  return {
    success: true,
    parsedParams,
    results: formatRecommendations(processed.results.slice(0, 10)),
    totalMatches: processed.matchingCount
  };
}

/**
 * Refine search - adjusts existing search with new constraints
 */
async function refineSearch(previousParams, refinement, availableTeeTimes, context = {}) {
  // Merge refinement with previous params
  const mergedParams = {
    ...previousParams,
    ...refinement
  };

  // Re-process with merged params
  const processed = processTeeTimes(availableTeeTimes, mergedParams, context);

  return {
    success: true,
    parsedParams: mergedParams,
    results: formatRecommendations(processed.results.slice(0, 10)),
    totalMatches: processed.matchingCount
  };
}

/**
 * Get course recommendation for a specific course
 */
function getCourseInsight(courseName, teeTimes) {
  const courseTeeTimes = teeTimes.filter(tt =>
    (tt.course_name || tt.name || '').toLowerCase().includes(courseName.toLowerCase())
  );

  if (courseTeeTimes.length === 0) {
    return {
      available: false,
      message: `No tee times currently available for ${courseName}`
    };
  }

  // Find price range
  const prices = courseTeeTimes.map(tt => tt.price).filter(p => p);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Find available dates
  const dates = [...new Set(courseTeeTimes.map(tt => tt.date))].sort();

  // Find best deal
  const deals = courseTeeTimes.filter(tt => tt.original_price && tt.price < tt.original_price);
  const bestDeal = deals.length > 0
    ? deals.reduce((best, curr) =>
        (curr.original_price - curr.price) > (best.original_price - best.price) ? curr : best
      )
    : null;

  return {
    available: true,
    courseName: courseTeeTimes[0].course_name || courseTeeTimes[0].name,
    totalTeeTimes: courseTeeTimes.length,
    priceRange: { min: minPrice, max: maxPrice },
    availableDates: dates,
    bestDeal: bestDeal ? {
      date: bestDeal.date,
      time: bestDeal.time,
      price: bestDeal.price,
      originalPrice: bestDeal.original_price,
      savings: bestDeal.original_price - bestDeal.price
    } : null
  };
}

/**
 * Conversation state management for multi-turn interactions
 */
class ConversationState {
  constructor(userId) {
    this.userId = userId;
    this.history = [];
    this.lastParams = null;
    this.lastResults = null;
    this.context = {};
  }

  addTurn(query, response) {
    this.history.push({
      timestamp: new Date().toISOString(),
      query,
      response: {
        message: response.message,
        topPick: response.topPick,
        matchCount: response.summary?.matchingCriteria
      }
    });

    this.lastParams = response.parsedParams;
    this.lastResults = response.allResults;
  }

  getContext() {
    return {
      ...this.context,
      conversationHistory: this.history.slice(-3), // Last 3 turns
      previousParams: this.lastParams
    };
  }

  setUserLocation(lat, lng, city) {
    this.context.userLocation = { lat, lng, city };
  }

  setUserPreferences(prefs) {
    this.context.userPreferences = prefs;
  }
}

module.exports = {
  processBookingRequest,
  quickSearch,
  refineSearch,
  getCourseInsight,
  ConversationState
};
