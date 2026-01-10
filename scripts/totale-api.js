/**
 * TotaleIntegrated API Scraper
 *
 * Uses direct API calls instead of Puppeteer for ~170x speedup
 * - Old Puppeteer method: ~11 minutes for 10 courses × 7 days
 * - New API method: ~30 seconds for same data
 */

const https = require('https');

async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`  [Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Course configurations with API parameters
// Note: Courses also on GolfNow removed to avoid duplicates (GolfNow has lower prices):
// - Boundary Oak, Metropolitan, Pacific Grove, Laguna Seca, Valley of the Moon, Napa
const TOTALE_COURSES_API = {
  // Bay Area / Sacramento
  'san-jose-municipal-golf-course': {
    courseId: 'SANJOSE',
    origin: 'https://sanjose.totaleintegrated.net',
    name: 'San Jose Municipal Golf Course'
  },
  'ancil-hoffman-golf-course': {
    courseId: 'ANCIL',
    origin: 'https://ancilhoffman.totaleintegrated.net',
    name: 'Ancil Hoffman Golf Course'
  },
  'mather-golf-course': {
    courseId: 'MATHER',
    origin: 'https://mather.totaleintegrated.net',
    name: 'Mather Golf Course'
  },
  'cherry-island-golf-course': {
    courseId: 'CHERRYISLAND',
    origin: 'https://cherryisland.totaleintegrated.net',
    name: 'Cherry Island Golf Course'
  },
  // Sacramento Extended
  'bidwell-park-golf-course': {
    courseId: 'BIDWELL',
    origin: 'https://bidwellpark.totaleintegrated.net',
    name: 'Bidwell Park Golf Course'
  },
  'haggin-oaks-golf-complex': {
    courseId: 'MORTON',
    origin: 'https://mortongolf.totaleintegrated.com',
    name: 'Haggin Oaks Golf Complex'
  },
  // Central Valley
  'riverside-golf-course': {
    courseId: 'RIVERSIDE',
    origin: 'https://playriverside.totaleintegrated.com',
    name: 'Riverside Golf Course'
  },
  'valley-oaks-golf-course': {
    courseId: 'VALLEYOAKS',
    origin: 'https://playvalleyoaks.totaleintegrated.com',
    name: 'Valley Oaks Golf Course'
  },
  // Inland Empire
  'green-river-golf-club': {
    courseId: 'GREENRIVER',
    origin: 'https://playgreenriver.totaleintegrated.com',
    name: 'Green River Golf Club'
  },
  // San Diego
  'reidy-creek-golf-course': {
    courseId: 'REIDYCREEK',
    origin: 'https://reidycreek.totaleintegrated.net',
    name: 'Reidy Creek Golf Course'
  }
};

// Concurrency settings
const MAX_CONCURRENT_REQUESTS = 5;

function getPacificDate(dayOffset = 0) {
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  pst.setDate(pst.getDate() + dayOffset);
  const year = pst.getFullYear();
  const month = String(pst.getMonth() + 1).padStart(2, '0');
  const day = String(pst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Robust time parser that handles multiple formats:
 * - "7:30 AM" or "7:30AM" (with/without space)
 * - "7:30 A" or "7:30 P" (truncated AM/PM)
 * - "7 AM" or "7AM" (no minutes)
 * - "07:30" (already 24-hour format)
 * - "7:30" (ambiguous, returned as-is with padded hours)
 */
function convertTo24Hour(timeStr, context = null) {
  if (!timeStr) return null;

  const original = timeStr;
  const normalized = timeStr.trim().toUpperCase();

  // Pattern 1: Already in 24-hour format (HH:MM)
  const match24 = normalized.match(/^(\d{2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1]);
    if (hours >= 0 && hours <= 23) {
      return `${match24[1]}:${match24[2]}`;
    }
  }

  // Pattern 2: Full format with optional space - "7:30 AM", "7:30AM", "7:30 PM", "7:30PM"
  const matchFull = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (matchFull) {
    let hours = parseInt(matchFull[1]);
    const minutes = matchFull[2];
    const period = matchFull[3];

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Pattern 3: Truncated period - "7:30 A", "7:30 P", "7:30A", "7:30P"
  const matchTruncated = normalized.match(/^(\d{1,2}):(\d{2})\s*([AP])$/);
  if (matchTruncated) {
    let hours = parseInt(matchTruncated[1]);
    const minutes = matchTruncated[2];
    const period = matchTruncated[3];

    if (period === 'P' && hours !== 12) hours += 12;
    if (period === 'A' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Pattern 4: Hour only with period - "7 AM", "7AM", "7 PM", "7PM"
  const matchHourOnly = normalized.match(/^(\d{1,2})\s*(AM|PM)$/);
  if (matchHourOnly) {
    let hours = parseInt(matchHourOnly[1]);
    const period = matchHourOnly[2];

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:00`;
  }

  // Pattern 5: Hour only with truncated period - "7 A", "7A", "7 P", "7P"
  const matchHourTruncated = normalized.match(/^(\d{1,2})\s*([AP])$/);
  if (matchHourTruncated) {
    let hours = parseInt(matchHourTruncated[1]);
    const period = matchHourTruncated[2];

    if (period === 'P' && hours !== 12) hours += 12;
    if (period === 'A' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:00`;
  }

  // Pattern 6: Time without period - "7:30" (ambiguous, but pad hours)
  const matchNoPeriod = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (matchNoPeriod) {
    const hours = parseInt(matchNoPeriod[1]);
    const minutes = matchNoPeriod[2];
    // If context provides AM/PM info, use it
    if (context) {
      const ctxUpper = context.toUpperCase();
      if (ctxUpper === 'PM' || ctxUpper === 'P') {
        const adjHours = hours !== 12 ? hours + 12 : hours;
        return `${adjHours.toString().padStart(2, '0')}:${minutes}`;
      } else if (ctxUpper === 'AM' || ctxUpper === 'A') {
        const adjHours = hours === 12 ? 0 : hours;
        return `${adjHours.toString().padStart(2, '0')}:${minutes}`;
      }
    }
    // Return as-is with padded hours
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Could not parse - log and return null
  console.warn(`[TotaleIntegrated] Unable to parse time: "${original}"`);
  return null;
}

/**
 * Fetch tee times from the TotaleIntegrated API
 */
function fetchTeeTimes(course, dateStr) {
  return retryWithBackoff(async () => {
    return new Promise((resolve, reject) => {
      const courseIdEncoded = encodeURIComponent(course.courseId);
      const url = `https://courseco-gateway.totaleintegrated.net/Booking/Teetimes?IsInitTeeTimeRequest=false&TeeTimeDate=${dateStr}&CourseID=${courseIdEncoded}&StartTime=05:00&EndTime=20:00&NumOfPlayers=4&Holes=18&IsNineHole=0&StartPrice=0&EndPrice=&CartIncluded=false&SpecialsOnly=0&IsClosest=0&PlayerIDs=&DateFilterChange=false&DateFilterChangeNoSearch=false&SearchByGroups=true&IsPrepaidOnly=0&QueryStringFilters=null`;

      const req = https.get(url, {
        headers: {
          'Accept': 'application/json',
          'Origin': course.origin,
          'Referer': course.origin + '/web/tee-times',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      }, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${course.courseId}`));
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const teeTimes = (json.TeeTimeData || []).map(tt => ({
              time: tt.Title,        // "1:33 PM"
              price: tt.PerPlayerCost,
              holes: tt.Holes,
              players: 4,
              time24: tt.Time?.split(':').slice(0, 2).join(':') || convertTo24Hour(tt.Title)
            }));
            resolve(teeTimes);
          } catch (e) {
            reject(new Error(`JSON parse error for ${course.courseId}: ${e.message}`));
          }
        });
      });
      req.on('error', (err) => reject(new Error(`Network error for ${course.courseId}: ${err.message}`)));
      req.end();
    });
  });
}

/**
 * Run with concurrency limit
 */
async function runWithConcurrency(tasks, limit) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);

    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

/**
 * Main API scraper
 */
async function scrapeAllAPI(db, coursesBySlug, days = 7) {
  console.log(`[TotaleIntegrated API] Starting scrape...`);
  const startTime = Date.now();

  // NOTE: We no longer delete before scraping - the orchestrator handles cleanup
  // after successful scrape using scraped_at timestamps

  // Build list of all tasks (course + date combinations)
  const tasks = [];

  for (const [slug, config] of Object.entries(TOTALE_COURSES_API)) {
    const course = coursesBySlug[slug];
    if (!course) continue;

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const dateStr = getPacificDate(dayOffset);
      tasks.push({
        slug,
        config,
        course,
        dateStr,
        fetch: () => fetchTeeTimes(config, dateStr)
      });
    }
  }

  console.log(`[TotaleIntegrated API] Fetching ${tasks.length} course-day combinations...`);

  // Execute all fetches with concurrency limit
  const fetchTasks = tasks.map(t => async () => {
    try {
      const teeTimes = await t.fetch();
      return { ...t, teeTimes };
    } catch (error) {
      console.log(`  [TotaleIntegrated API] Failed after retries: ${error.message}`);
      return { ...t, teeTimes: [] };
    }
  });

  const results = await runWithConcurrency(fetchTasks, MAX_CONCURRENT_REQUESTS);

  const fetchTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[TotaleIntegrated API] Fetched all data in ${fetchTime}s, inserting...`);

  // Collect all inserts for batch operation
  const inserts = [];
  const courseResults = {};

  for (const result of results) {
    const { course, config, dateStr, teeTimes } = result;

    if (!courseResults[config.name]) {
      courseResults[config.name] = 0;
    }

    for (const tt of teeTimes) {
      const time24 = tt.time24 || convertTo24Hour(tt.time);
      if (!time24) continue;

      inserts.push({
        sql: `INSERT OR REPLACE INTO tee_times
              (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          course.id,
          dateStr,
          time24,
          `${dateStr} ${time24}`,
          tt.holes || 18,
          tt.players || 4,
          tt.price,
          0,
          config.origin + '/web/tee-times',
          'totaleintegrated'
        ]
      });
      courseResults[config.name]++;
    }
  }

  // Batch insert in chunks (Turso has limits on batch size)
  const BATCH_SIZE = 100;
  let totalTeeTimes = 0;

  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE);
    try {
      await db.batch(batch);
      totalTeeTimes += batch.length;
    } catch (e) {
      // Fall back to individual inserts if batch fails
      for (const stmt of batch) {
        try {
          await db.execute(stmt);
          totalTeeTimes++;
        } catch (e2) {
          // Ignore duplicates
        }
      }
    }
  }

  // Log results per course
  let coursesScraped = 0;
  for (const [name, count] of Object.entries(courseResults)) {
    if (count > 0) {
      console.log(`  [TotaleIntegrated API] ${name}: ${count} tee times`);
      coursesScraped++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[TotaleIntegrated API] Complete: ${coursesScraped} courses, ${totalTeeTimes} tee times in ${elapsed}s`);

  return { coursesScraped, totalTeeTimes };
}

module.exports = {
  scrapeAllAPI,
  TOTALE_COURSES_API,
  fetchTeeTimes
};
