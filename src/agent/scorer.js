/**
 * Tee Time Scorer & Ranker
 * Scores and ranks tee times based on user preferences and multiple factors
 */

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Default weights for scoring factors
const DEFAULT_WEIGHTS = {
  price: 0.30,          // 30% weight on price
  time_match: 0.25,     // 25% weight on time preference match
  distance: 0.20,       // 20% weight on distance
  quality: 0.15,        // 15% weight on course quality/rating
  value: 0.10           // 10% weight on deal/discount
};

/**
 * Score a single tee time based on user preferences
 * @param {Object} teeTime - Tee time with course info
 * @param {Object} params - Parsed search parameters
 * @param {Object} context - Additional context (user location, etc.)
 * @returns {Object} Tee time with score breakdown
 */
function scoreTeeTime(teeTime, params, context = {}) {
  const scores = {};
  const weights = { ...DEFAULT_WEIGHTS, ...(params.weights || {}) };

  // 1. Price Score (0-100)
  // Lower price = higher score, relative to max_price or average
  scores.price = calculatePriceScore(teeTime, params);

  // 2. Time Match Score (0-100)
  // How well the tee time matches the preferred time window
  scores.time_match = calculateTimeScore(teeTime, params);

  // 3. Distance Score (0-100)
  // Closer = higher score
  scores.distance = calculateDistanceScore(teeTime, params, context);

  // 4. Quality Score (0-100)
  // Based on course rating and user quality preference
  scores.quality = calculateQualityScore(teeTime, params);

  // 5. Value Score (0-100)
  // Bonus for discounts, deals, good price-to-quality ratio
  scores.value = calculateValueScore(teeTime, params);

  // Calculate weighted total score
  const totalScore =
    scores.price * weights.price +
    scores.time_match * weights.time_match +
    scores.distance * weights.distance +
    scores.quality * weights.quality +
    scores.value * weights.value;

  return {
    ...teeTime,
    scores,
    totalScore: Math.round(totalScore * 100) / 100,
    matchReasons: generateMatchReasons(scores, teeTime, params)
  };
}

/**
 * Calculate price score (0-100)
 */
function calculatePriceScore(teeTime, params) {
  const price = teeTime.price;

  if (!price || price <= 0) return 50; // Unknown price = neutral

  // If user specified max price
  if (params.max_price) {
    if (price > params.max_price) return 0; // Over budget
    // Score based on how much under budget
    const savings = (params.max_price - price) / params.max_price;
    return 50 + (savings * 50); // 50-100 range
  }

  // Default: score based on typical Bay Area prices ($30-$200)
  const minTypical = 30;
  const maxTypical = 200;

  if (price <= minTypical) return 100;
  if (price >= maxTypical) return 20;

  // Linear scale between min and max
  return 100 - ((price - minTypical) / (maxTypical - minTypical) * 80);
}

/**
 * Calculate time match score (0-100)
 */
function calculateTimeScore(teeTime, params) {
  if (!params.time_range) return 80; // No preference = good match

  const teeTimeHour = parseInt(teeTime.time.split(':')[0]);
  const teeTimeMin = parseInt(teeTime.time.split(':')[1]);
  const teeTimeDecimal = teeTimeHour + teeTimeMin / 60;

  const startHour = parseInt(params.time_range.start.split(':')[0]);
  const endHour = parseInt(params.time_range.end.split(':')[0]);

  // Perfect match if within range
  if (teeTimeDecimal >= startHour && teeTimeDecimal <= endHour) {
    return 100;
  }

  // Calculate how far outside the range
  const distanceOutside = teeTimeDecimal < startHour
    ? startHour - teeTimeDecimal
    : teeTimeDecimal - endHour;

  // Penalize: lose 15 points per hour outside range
  return Math.max(0, 100 - distanceOutside * 15);
}

/**
 * Calculate distance score (0-100)
 */
function calculateDistanceScore(teeTime, params, context) {
  // If no user location, return neutral score
  if (!context.userLocation || !teeTime.latitude || !teeTime.longitude) {
    return 70;
  }

  const distance = calculateDistance(
    context.userLocation.lat,
    context.userLocation.lng,
    teeTime.latitude,
    teeTime.longitude
  );

  // Store distance for display
  teeTime.distance_miles = Math.round(distance * 10) / 10;

  // If user specified max distance
  if (params.max_distance_miles) {
    if (distance > params.max_distance_miles) return 0;
    return 100 - (distance / params.max_distance_miles * 30); // 70-100 range if within limit
  }

  // Default scoring: closer is better
  // Under 10 miles = 100, 10-20 miles = 80-100, 20-40 miles = 60-80, over 40 = 40-60
  if (distance <= 10) return 100;
  if (distance <= 20) return 100 - (distance - 10) * 2;
  if (distance <= 40) return 80 - (distance - 20);
  return Math.max(40, 60 - (distance - 40) * 0.5);
}

/**
 * Calculate quality score (0-100)
 */
function calculateQualityScore(teeTime, params) {
  const rating = teeTime.avg_rating;

  // Handle quality preference
  switch (params.quality_preference) {
    case 'high_rated':
      // Heavily favor high-rated courses
      if (!rating) return 30;
      return Math.min(100, rating * 22); // 4.5 rating = 99

    case 'best_value':
      // Quality matters less for value seekers
      if (!rating) return 60;
      return 50 + (rating * 10); // More modest boost for quality

    case 'hidden_gems':
      // Favor good courses with fewer reviews (if we had review count)
      if (!rating) return 70; // Unknown could be a gem!
      return rating >= 4.0 ? 90 : 60 + (rating * 10);

    default:
      // Balanced: quality is a factor but not dominant
      if (!rating) return 50;
      return rating * 20; // 4.0 = 80, 4.5 = 90, 5.0 = 100
  }
}

/**
 * Calculate value score (0-100)
 */
function calculateValueScore(teeTime, params) {
  let score = 50; // Base score

  // Bonus for discounts
  if (teeTime.original_price && teeTime.price < teeTime.original_price) {
    const discountPct = (teeTime.original_price - teeTime.price) / teeTime.original_price;
    score += discountPct * 50; // Up to 50 bonus points for big discounts
  }

  // Price-to-quality ratio bonus
  if (teeTime.avg_rating && teeTime.price) {
    // Good value = high rating relative to price
    // $50 with 4.5 rating = excellent value
    // $200 with 4.0 rating = okay value
    const valueRatio = (teeTime.avg_rating * 50) / teeTime.price;
    score += Math.min(30, valueRatio * 10);
  }

  return Math.min(100, score);
}

/**
 * Generate human-readable match reasons
 */
function generateMatchReasons(scores, teeTime, params) {
  const reasons = [];

  if (scores.price >= 90) {
    reasons.push(`Great price at $${teeTime.price}`);
  } else if (scores.price >= 70 && params.max_price) {
    reasons.push(`$${params.max_price - teeTime.price} under your budget`);
  }

  if (scores.time_match >= 95) {
    reasons.push('Perfect time match');
  } else if (scores.time_match >= 80) {
    reasons.push('Good time slot');
  }

  if (scores.distance >= 90 && teeTime.distance_miles) {
    reasons.push(`Only ${teeTime.distance_miles} miles away`);
  }

  if (scores.quality >= 85 && teeTime.avg_rating) {
    reasons.push(`Highly rated (${teeTime.avg_rating}★)`);
  }

  if (scores.value >= 80) {
    if (teeTime.original_price) {
      const savings = teeTime.original_price - teeTime.price;
      reasons.push(`$${Math.round(savings)} discount`);
    } else {
      reasons.push('Excellent value');
    }
  }

  return reasons;
}

/**
 * Rank a list of tee times based on user preferences
 * @param {Array} teeTimes - Array of tee times with course info
 * @param {Object} params - Parsed search parameters
 * @param {Object} context - Additional context
 * @returns {Array} Sorted array with scores
 */
function rankTeeTimes(teeTimes, params, context = {}) {
  // Score all tee times
  const scored = teeTimes.map(tt => scoreTeeTime(tt, params, context));

  // Sort by total score (descending)
  scored.sort((a, b) => b.totalScore - a.totalScore);

  // Add rank
  return scored.map((tt, index) => ({
    ...tt,
    rank: index + 1
  }));
}

/**
 * Filter tee times based on hard constraints
 */
function filterTeeTimes(teeTimes, params) {
  return teeTimes.filter(tt => {
    // Price filter
    if (params.max_price && tt.price > params.max_price) return false;
    if (params.min_price && tt.price < params.min_price) return false;

    // Date filter
    if (params.dates && params.dates.length > 0) {
      if (!params.dates.includes(tt.date)) return false;
    }

    // Time filter (allow some flexibility)
    if (params.time_range) {
      const teeHour = parseInt(tt.time.split(':')[0]);
      const startHour = parseInt(params.time_range.start.split(':')[0]);
      const endHour = parseInt(params.time_range.end.split(':')[0]);
      // Allow 1 hour flexibility
      if (teeHour < startHour - 1 || teeHour > endHour + 1) return false;
    }

    // Region filter
    if (params.location) {
      const location = params.location.toLowerCase();
      const courseRegion = (tt.region || '').toLowerCase();
      const courseCity = (tt.city || '').toLowerCase();
      if (!courseRegion.includes(location) && !courseCity.includes(location)) {
        return false;
      }
    }

    // Course name filter
    if (params.course_names && params.course_names.length > 0) {
      const courseName = (tt.course_name || tt.name || '').toLowerCase();
      const matches = params.course_names.some(name =>
        courseName.includes(name.toLowerCase())
      );
      if (!matches) return false;
    }

    // Players filter
    if (params.players && tt.players && tt.players < params.players) {
      return false;
    }

    // Holes filter
    if (params.holes && tt.holes && tt.holes !== params.holes) {
      return false;
    }

    return true;
  });
}

/**
 * Main function: filter, score, and rank tee times
 */
function processTeeTimes(teeTimes, params, context = {}) {
  // First, apply hard filters
  const filtered = filterTeeTimes(teeTimes, params);

  // Then score and rank
  const ranked = rankTeeTimes(filtered, params, context);

  return {
    results: ranked,
    totalFound: teeTimes.length,
    matchingCount: filtered.length,
    filters_applied: {
      max_price: params.max_price,
      dates: params.dates,
      time_range: params.time_range,
      location: params.location,
      course_names: params.course_names
    }
  };
}

module.exports = {
  scoreTeeTime,
  rankTeeTimes,
  filterTeeTimes,
  processTeeTimes,
  calculateDistance,
  DEFAULT_WEIGHTS
};
