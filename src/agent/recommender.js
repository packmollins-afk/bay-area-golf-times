/**
 * AI Recommendation Generator
 * Generates natural language recommendations using Claude
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

const RECOMMENDER_SYSTEM_PROMPT = `You are a friendly and knowledgeable Bay Area golf concierge. Your job is to present tee time recommendations in a helpful, conversational way.

Guidelines:
- Be concise but informative
- Highlight the key reasons why each option is a good match
- Use a friendly, casual tone (like talking to a golf buddy)
- Include practical details: price, time, course highlights
- If there are trade-offs, mention them honestly
- For the top recommendation, give a brief "why this one" explanation
- Format prices with $ and times in 12-hour format (e.g., 8:30am)
- Keep your response under 300 words total

Course knowledge you can reference:
- TPC Harding Park: Championship course, hosted PGA events, challenging but fair
- Presidio: Beautiful setting in SF, historic course, well-maintained
- Lincoln Park: Amazing SF/Golden Gate views, affordable, hilly terrain
- Corica Park South: Recently renovated, excellent conditions, great value
- Half Moon Bay: Stunning oceanside, two courses, resort-style experience
- Tilden Park: East Bay favorite, tree-lined, peaceful setting
- Crystal Springs: Peninsula gem, gorgeous scenery, challenging layout
- Pasatiempo: Alister MacKenzie design, bucket-list course

You'll receive:
1. The user's original request
2. Parsed search parameters
3. Top-ranked tee time options with scores

Respond with a natural recommendation. Start with your top pick, then briefly mention 1-2 alternatives if relevant.`;

/**
 * Generate a natural language recommendation
 * @param {string} originalQuery - User's original request
 * @param {Object} params - Parsed search parameters
 * @param {Array} rankedResults - Top ranked tee times (with scores)
 * @param {Object} context - Additional context
 * @returns {Object} Recommendation response
 */
async function generateRecommendation(originalQuery, params, rankedResults, context = {}) {
  // Take top 5 results for consideration
  const topResults = rankedResults.slice(0, 5);

  if (topResults.length === 0) {
    return {
      message: generateNoResultsMessage(params),
      recommendations: [],
      hasResults: false
    };
  }

  // Build the prompt with context
  const userMessage = buildRecommendationPrompt(originalQuery, params, topResults);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: RECOMMENDER_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });

    const recommendation = response.content[0].text.trim();

    return {
      message: recommendation,
      recommendations: formatRecommendations(topResults.slice(0, 3)),
      hasResults: true,
      topPick: formatRecommendation(topResults[0]),
      alternatives: topResults.slice(1, 3).map(formatRecommendation),
      searchSummary: generateSearchSummary(params, rankedResults.length)
    };
  } catch (error) {
    console.error('Recommendation generation error:', error);
    // Fallback to structured response without AI
    return {
      message: generateFallbackMessage(topResults),
      recommendations: formatRecommendations(topResults.slice(0, 3)),
      hasResults: true,
      topPick: formatRecommendation(topResults[0]),
      alternatives: topResults.slice(1, 3).map(formatRecommendation),
      searchSummary: generateSearchSummary(params, rankedResults.length)
    };
  }
}

/**
 * Build the prompt for recommendation generation
 */
function buildRecommendationPrompt(originalQuery, params, topResults) {
  let prompt = `User's request: "${originalQuery}"\n\n`;

  prompt += `Search parameters:\n`;
  if (params.dates) prompt += `- Dates: ${params.dates.join(', ')}\n`;
  if (params.time_range) prompt += `- Time: ${params.time_range.start} - ${params.time_range.end}\n`;
  if (params.max_price) prompt += `- Max price: $${params.max_price}\n`;
  if (params.location) prompt += `- Location: ${params.location}\n`;
  if (params.quality_preference) prompt += `- Looking for: ${params.quality_preference}\n`;

  prompt += `\nTop ${topResults.length} options found:\n\n`;

  topResults.forEach((tt, index) => {
    const time12 = formatTime12(tt.time);
    const dayName = getDayName(tt.date);

    prompt += `${index + 1}. ${tt.course_name || tt.name}\n`;
    prompt += `   ${dayName} ${tt.date} at ${time12}\n`;
    prompt += `   $${tt.price}${tt.original_price ? ` (was $${tt.original_price})` : ''}\n`;
    prompt += `   Score: ${tt.totalScore}/100\n`;
    if (tt.avg_rating) prompt += `   Rating: ${tt.avg_rating}★\n`;
    if (tt.city) prompt += `   Location: ${tt.city}\n`;
    if (tt.distance_miles) prompt += `   Distance: ${tt.distance_miles} miles\n`;
    if (tt.matchReasons?.length) prompt += `   Highlights: ${tt.matchReasons.join(', ')}\n`;
    prompt += '\n';
  });

  prompt += `Please give a friendly recommendation based on these options.`;

  return prompt;
}

/**
 * Format time to 12-hour format
 */
function formatTime12(time24) {
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes}${ampm}`;
}

/**
 * Get day name from date
 */
function getDayName(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(dateStr + 'T12:00:00');
  return days[date.getDay()];
}

/**
 * Format a single recommendation for API response
 */
function formatRecommendation(tt) {
  return {
    id: tt.id,
    courseName: tt.course_name || tt.name,
    courseSlug: tt.course_slug || tt.slug,
    courseId: tt.course_id,
    date: tt.date,
    dayName: getDayName(tt.date),
    time: tt.time,
    time12: formatTime12(tt.time),
    price: tt.price,
    originalPrice: tt.original_price,
    discount: tt.original_price ? Math.round((tt.original_price - tt.price) / tt.original_price * 100) : null,
    rating: tt.avg_rating,
    city: tt.city,
    region: tt.region,
    holes: tt.holes,
    players: tt.players,
    hasCart: tt.has_cart,
    bookingUrl: tt.booking_url,
    distanceMiles: tt.distance_miles,
    score: tt.totalScore,
    matchReasons: tt.matchReasons || [],
    scores: tt.scores
  };
}

/**
 * Format multiple recommendations
 */
function formatRecommendations(teeTimes) {
  return teeTimes.map(formatRecommendation);
}

/**
 * Generate message when no results found
 */
function generateNoResultsMessage(params) {
  let msg = "I couldn't find any tee times matching your criteria. ";

  const suggestions = [];

  if (params.max_price && params.max_price < 50) {
    suggestions.push('try increasing your budget a bit');
  }
  if (params.dates && params.dates.length === 1) {
    suggestions.push('consider looking at additional days');
  }
  if (params.time_range) {
    suggestions.push('expand your time window');
  }
  if (params.location) {
    suggestions.push('search in other regions');
  }

  if (suggestions.length > 0) {
    msg += `You might want to ${suggestions.join(' or ')}.`;
  }

  return msg;
}

/**
 * Generate fallback message without AI
 */
function generateFallbackMessage(topResults) {
  const top = topResults[0];
  const time12 = formatTime12(top.time);
  const dayName = getDayName(top.date);

  let msg = `I found ${topResults.length} great options for you. `;
  msg += `My top pick is ${top.course_name || top.name} on ${dayName} at ${time12} for $${top.price}. `;

  if (top.matchReasons?.length) {
    msg += top.matchReasons[0] + '. ';
  }

  if (topResults.length > 1) {
    const alt = topResults[1];
    msg += `Also consider ${alt.course_name || alt.name} at ${formatTime12(alt.time)} for $${alt.price}.`;
  }

  return msg;
}

/**
 * Generate search summary
 */
function generateSearchSummary(params, totalMatches) {
  const parts = [];

  if (params.dates?.length === 1) {
    parts.push(getDayName(params.dates[0]));
  } else if (params.dates?.length > 1) {
    parts.push(`${params.dates.length} days`);
  }

  if (params.time_range) {
    const timeLabels = {
      '05:00-08:00': 'early morning',
      '08:00-11:00': 'morning',
      '11:00-14:00': 'midday',
      '14:00-17:00': 'afternoon',
      '17:00-20:00': 'twilight'
    };
    const key = `${params.time_range.start}-${params.time_range.end}`;
    parts.push(timeLabels[key] || 'specified times');
  }

  if (params.max_price) {
    parts.push(`under $${params.max_price}`);
  }

  if (params.location) {
    parts.push(params.location);
  }

  return {
    criteria: parts.join(', ') || 'all available',
    matchCount: totalMatches
  };
}

/**
 * Generate follow-up suggestions based on context
 */
function generateFollowUpSuggestions(params, results) {
  const suggestions = [];

  // If user got expensive results, suggest cheaper options
  if (results.length > 0) {
    const avgPrice = results.reduce((sum, r) => sum + r.price, 0) / results.length;
    if (avgPrice > 80 && !params.quality_preference) {
      suggestions.push({
        text: 'Show me cheaper options',
        action: { ...params, max_price: 60, quality_preference: 'best_value' }
      });
    }
  }

  // If searching specific date, suggest flexibility
  if (params.dates?.length === 1) {
    suggestions.push({
      text: 'Check other days this week',
      action: { ...params, date_preference: null, dates: null }
    });
  }

  // If no time preference, suggest prime time
  if (!params.time_range) {
    suggestions.push({
      text: 'Morning tee times only',
      action: { ...params, time_preference: 'morning' }
    });
  }

  return suggestions.slice(0, 3);
}

module.exports = {
  generateRecommendation,
  formatRecommendation,
  formatRecommendations,
  generateNoResultsMessage,
  generateSearchSummary,
  generateFollowUpSuggestions,
  formatTime12,
  getDayName
};
