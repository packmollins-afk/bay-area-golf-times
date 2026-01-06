/**
 * Golf Query Parser
 * Parses natural language queries into structured search parameters using Claude
 */

const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic();

// System prompt for parsing golf booking requests
const PARSER_SYSTEM_PROMPT = `You are a golf tee time search query parser. Your job is to extract structured search parameters from natural language requests.

IMPORTANT: Today's date is {{TODAY_DATE}} and the current time is {{CURRENT_TIME}} (Pacific Time).

Extract the following parameters when present:
- date_preference: "today", "tomorrow", "this_weekend", "next_weekend", or specific date (YYYY-MM-DD)
- time_preference: "early_morning" (before 8am), "morning" (8am-11am), "midday" (11am-2pm), "afternoon" (2pm-5pm), "twilight" (after 5pm), or specific time range
- max_price: maximum price in dollars (number only)
- min_price: minimum price in dollars (number only)
- location: city name, region, or "near me" with coordinates
- max_distance_miles: maximum distance willing to travel (number)
- course_names: specific course names mentioned (array)
- players: number of players (1-4)
- holes: 9 or 18
- quality_preference: "any", "high_rated", "best_value", "hidden_gems"
- special_requests: any other requirements (string)

Bay Area regions: "San Francisco", "East Bay", "South Bay", "North Bay", "Peninsula"

Popular Bay Area courses include:
- TPC Harding Park, Lincoln Park, Presidio, Golden Gate Park (San Francisco)
- Corica Park, Tilden Park, Metropolitan Golf Links, Boundary Oak (East Bay)
- Palo Alto Golf Course, Deep Cliff, Cinnabar Hills (South Bay)
- Peacock Gap, StoneTree, Indian Valley (North Bay)
- Crystal Springs, Half Moon Bay, Sharp Park (Peninsula)

Respond ONLY with valid JSON, no explanation. If a parameter is not specified, omit it from the response.

Example input: "Find me something cheap this weekend, morning tee time, somewhere in the East Bay"
Example output:
{
  "date_preference": "this_weekend",
  "time_preference": "morning",
  "quality_preference": "best_value",
  "location": "East Bay"
}

Example input: "I want to play Harding Park tomorrow afternoon for under $100"
Example output:
{
  "date_preference": "tomorrow",
  "time_preference": "afternoon",
  "max_price": 100,
  "course_names": ["TPC Harding Park"]
}`;

/**
 * Parse a natural language golf booking query into structured parameters
 * @param {string} query - Natural language query
 * @param {Object} context - Additional context (user location, preferences, etc.)
 * @returns {Object} Structured search parameters
 */
async function parseQuery(query, context = {}) {
  // Get current date/time in Pacific timezone
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const todayDate = pacificTime.toISOString().split('T')[0];
  const currentTime = pacificTime.toTimeString().slice(0, 5);

  // Build the system prompt with current date/time
  const systemPrompt = PARSER_SYSTEM_PROMPT
    .replace('{{TODAY_DATE}}', todayDate)
    .replace('{{CURRENT_TIME}}', currentTime);

  // Add user context to the query if available
  let enrichedQuery = query;
  if (context.userLocation) {
    enrichedQuery += `\n\nUser's location: ${context.userLocation.city || 'Unknown'} (lat: ${context.userLocation.lat}, lng: ${context.userLocation.lng})`;
  }
  if (context.userPreferences) {
    enrichedQuery += `\n\nUser's usual preferences: ${JSON.stringify(context.userPreferences)}`;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: enrichedQuery }
      ]
    });

    const content = response.content[0].text.trim();

    // Parse the JSON response
    const params = JSON.parse(content);

    // Post-process and validate
    return normalizeParams(params, todayDate);
  } catch (error) {
    console.error('Query parsing error:', error);
    // Return a basic fallback parse
    return fallbackParse(query, todayDate);
  }
}

/**
 * Normalize and validate parsed parameters
 */
function normalizeParams(params, todayDate) {
  const normalized = { ...params };

  // Convert date preferences to actual dates
  if (params.date_preference) {
    normalized.dates = resolveDatePreference(params.date_preference, todayDate);
  }

  // Convert time preferences to time ranges
  if (params.time_preference) {
    normalized.time_range = resolveTimePreference(params.time_preference);
  }

  // Ensure price is a number
  if (params.max_price) {
    normalized.max_price = parseFloat(params.max_price);
  }
  if (params.min_price) {
    normalized.min_price = parseFloat(params.min_price);
  }

  // Ensure players is valid
  if (params.players) {
    normalized.players = Math.min(4, Math.max(1, parseInt(params.players)));
  }

  return normalized;
}

/**
 * Resolve date preference to actual date(s)
 */
function resolveDatePreference(preference, todayDate) {
  const today = new Date(todayDate + 'T12:00:00');
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

  switch (preference) {
    case 'today':
      return [todayDate];

    case 'tomorrow': {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return [tomorrow.toISOString().split('T')[0]];
    }

    case 'this_weekend': {
      const dates = [];
      // Find this Saturday
      const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
      const saturday = new Date(today);
      saturday.setDate(saturday.getDate() + (dayOfWeek === 6 ? 0 : daysUntilSat));
      dates.push(saturday.toISOString().split('T')[0]);

      // Sunday
      const sunday = new Date(saturday);
      sunday.setDate(sunday.getDate() + 1);
      dates.push(sunday.toISOString().split('T')[0]);

      return dates;
    }

    case 'next_weekend': {
      const dates = [];
      // Find next Saturday (at least 7 days away)
      const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
      const saturday = new Date(today);
      saturday.setDate(saturday.getDate() + daysUntilSat + (dayOfWeek === 6 ? 7 : 0));
      if (daysUntilSat < 7) {
        saturday.setDate(saturday.getDate() + 7);
      }
      dates.push(saturday.toISOString().split('T')[0]);

      const sunday = new Date(saturday);
      sunday.setDate(sunday.getDate() + 1);
      dates.push(sunday.toISOString().split('T')[0]);

      return dates;
    }

    default:
      // Assume it's a specific date
      if (/^\d{4}-\d{2}-\d{2}$/.test(preference)) {
        return [preference];
      }
      // Default to next 7 days
      return getNextNDays(7, todayDate);
  }
}

/**
 * Get array of next N days
 */
function getNextNDays(n, startDate) {
  const dates = [];
  const start = new Date(startDate + 'T12:00:00');
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Resolve time preference to time range
 */
function resolveTimePreference(preference) {
  const ranges = {
    'early_morning': { start: '05:00', end: '08:00' },
    'morning': { start: '08:00', end: '11:00' },
    'midday': { start: '11:00', end: '14:00' },
    'afternoon': { start: '14:00', end: '17:00' },
    'twilight': { start: '17:00', end: '20:00' }
  };

  return ranges[preference] || null;
}

/**
 * Fallback parser when Claude is unavailable
 */
function fallbackParse(query, todayDate) {
  const q = query.toLowerCase();
  const params = {};

  // Date detection
  if (q.includes('today')) params.date_preference = 'today';
  else if (q.includes('tomorrow')) params.date_preference = 'tomorrow';
  else if (q.includes('this weekend')) params.date_preference = 'this_weekend';
  else if (q.includes('next weekend')) params.date_preference = 'next_weekend';

  // Time detection
  if (q.includes('morning') || q.includes('early')) params.time_preference = 'morning';
  else if (q.includes('afternoon')) params.time_preference = 'afternoon';
  else if (q.includes('twilight') || q.includes('evening')) params.time_preference = 'twilight';

  // Price detection
  const priceMatch = q.match(/under\s*\$?(\d+)/i) || q.match(/less than\s*\$?(\d+)/i) || q.match(/max(?:imum)?\s*\$?(\d+)/i);
  if (priceMatch) params.max_price = parseInt(priceMatch[1]);

  // Region detection
  const regions = ['san francisco', 'east bay', 'south bay', 'north bay', 'peninsula'];
  for (const region of regions) {
    if (q.includes(region)) {
      params.location = region.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  // Quality detection
  if (q.includes('cheap') || q.includes('budget') || q.includes('deal')) {
    params.quality_preference = 'best_value';
  } else if (q.includes('best') || q.includes('nice') || q.includes('quality')) {
    params.quality_preference = 'high_rated';
  }

  // Normalize
  return normalizeParams(params, todayDate);
}

module.exports = {
  parseQuery,
  normalizeParams,
  resolveDatePreference,
  resolveTimePreference,
  fallbackParse
};
