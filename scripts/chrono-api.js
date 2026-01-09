/**
 * Chronogolf Hybrid API Scraper
 *
 * Uses Puppeteer to get Cloudflare cookie, then makes API calls in browser context
 * This bypasses CF bot protection while getting API speed benefits
 *
 * API: https://www.chronogolf.com/marketplace/v2/teetimes
 */

const puppeteer = require('puppeteer');

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

// Course UUIDs for all Chronogolf courses
const CHRONOGOLF_COURSES = {
  // Slugs must match database exactly
  'half-moon-bay-old-course': {
    uuid: '9f50b574-c281-4df7-a7cb-13d567406c36',
    name: 'Half Moon Bay - Old Course',
    clubUrl: 'https://www.chronogolf.com/club/half-moon-bay-golf-links'
  },
  'half-moon-bay-ocean-course': {
    uuid: '03274c09-51b5-4ad9-beb4-9177e3990e10',
    name: 'Half Moon Bay - Ocean Course',
    clubUrl: 'https://www.chronogolf.com/club/half-moon-bay-golf-links'
  },
  'santa-teresa-golf-club': {
    uuid: '27133c6d-1057-4630-a9bc-fb1f4407011d',
    name: 'Santa Teresa Golf Club',
    clubUrl: 'https://www.chronogolf.com/club/santa-teresa-golf-club'
  },
  'tilden-park-golf-course': {
    uuid: '650513a5-bd40-4b9f-af67-4e442ca69d34',
    name: 'Tilden Park Golf Course',
    clubUrl: 'https://www.chronogolf.com/club/tilden-park-golf-course-california-berkeley'
  },
  'redwood-canyon-golf-course': {
    uuid: '9a31aebe-9371-47ef-a98f-38de07ad7e91',
    name: 'Redwood Canyon Golf Course',
    clubUrl: 'https://www.chronogolf.com/club/redwood-canyon-public-golf-course'
  },
  'canyon-lakes-golf-course': {
    uuid: 'e172b6b1-f3cc-4d6d-8ad1-a0ef1737b3cd',
    name: 'Canyon Lakes Golf Course',
    clubUrl: 'https://www.chronogolf.com/club/canyon-lakes-golf-course-and-brewery'
  },
  'blue-rock-springs-golf-club': {
    uuid: '039d1b9b-2723-4b50-b02c-2925ae207f83',
    name: 'Blue Rock Springs Golf Club',
    clubUrl: 'https://www.chronogolf.com/club/blue-rock-springs-golf-club'
  },
  // New courses added 2026-01-08
  'de-laveaga-golf-course': {
    uuid: '56bdb490-575c-41b4-a096-8f5622cb66eb',
    name: 'De Laveaga Golf Course',
    clubUrl: 'https://www.chronogolf.com/club/de-laveaga-golf-course'
  },
  'pasatiempo-golf-club': {
    uuid: '9be5c60c-181e-4f0c-83c0-227f12e8c9b6',
    name: 'Pasatiempo Golf Club',
    clubUrl: 'https://www.chronogolf.com/club/pasatiempo-golf-club'
  },
  'seascape-golf-club': {
    uuid: '4fba84ed-8238-45ad-8e8f-3b7763b022e3',
    name: 'Seascape Golf Club',
    clubUrl: 'https://www.chronogolf.com/club/seascape-golf-club'
  },
  'pajaro-valley-golf-club': {
    uuid: 'c9f83cb5-f57f-44f6-b303-c61be2dda2f5',
    name: 'Pajaro Valley Golf Club',
    clubUrl: 'https://www.chronogolf.com/club/pajaro-valley-golf-club'
  },
  'los-lagos-golf-course': {
    uuid: '99b8dcea-ea2f-4803-8949-8126dd2eadee',
    name: 'Los Lagos Golf Course',
    clubUrl: 'https://www.chronogolf.com/club/los-lagos-golf-course'
  },
  'gilroy-golf-course': {
    uuid: 'b5f6d586-f369-400c-8d36-8c3be8a60192',
    name: 'Gilroy Golf Course',
    clubUrl: 'https://www.chronogolf.com/club/gilroy-golf-course'
  },
  'salinas-fairways-golf-course': {
    uuid: 'a337ef18-91f0-487a-b226-d56147f0e4b6',
    name: 'Salinas Fairways Golf Course',
    clubUrl: 'https://www.chronogolf.com/club/salinas-fairways-golf-course'
  },
  'rooster-run-golf-club': {
    uuid: 'b351720c-470a-45a8-a243-d50e59fcb6ca',
    name: 'Rooster Run Golf Club',
    clubUrl: 'https://www.chronogolf.com/club/rooster-run-golf-club'
  }
};

// Create reverse mapping from UUID to slug
const UUID_TO_SLUG = {};
Object.entries(CHRONOGOLF_COURSES).forEach(([slug, config]) => {
  UUID_TO_SLUG[config.uuid] = slug;
});

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
    // Return as-is with padded hours (API often returns times like "7:30" which are already local time)
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Could not parse - log and return null
  console.warn(`[Chronogolf] Unable to parse time: "${original}"`);
  return null;
}

/**
 * Fetch all tee times from within the browser context (bypasses CF protection)
 */
async function fetchAllTeeTimesInBrowser(page, dates, courseUUIDs) {
  const uuidsParam = courseUUIDs.join(',');

  // Execute API calls from within the browser
  const results = await page.evaluate(async (dates, uuidsParam) => {
    // Retry helper for browser context
    async function browserRetryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
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

    // Fetch all dates in parallel from within the browser
    const promises = dates.map(async (date) => {
      try {
        return await browserRetryWithBackoff(async () => {
          const url = `https://www.chronogolf.com/marketplace/v2/teetimes?start_date=${date}&course_ids=${encodeURIComponent(uuidsParam)}&holes=18&page=1`;
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json' }
          });

          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }

          const data = await resp.json();

          // Paginate if needed (24 per page)
          let allTeeTimes = data.teetimes || [];
          const total = parseInt(resp.headers.get('total') || '0');
          const perPage = 24;

          if (total > perPage) {
            const pages = Math.ceil(total / perPage);
            for (let p = 2; p <= pages && p <= 10; p++) {
              const pageUrl = `${url}&page=${p}`;
              const pageResp = await fetch(pageUrl, {
                headers: { 'Accept': 'application/json' }
              });
              if (pageResp.ok) {
                const pageData = await pageResp.json();
                allTeeTimes = allTeeTimes.concat(pageData.teetimes || []);
              }
            }
          }

          return { date, teeTimes: allTeeTimes };
        });
      } catch (e) {
        // After all retries failed, return empty with error (allows other dates to proceed)
        return { date, teeTimes: [], error: e.message };
      }
    });

    return Promise.all(promises);
  }, dates, uuidsParam);

  return results;
}

/**
 * Scrape all courses for all days using hybrid approach
 * - Uses Puppeteer to establish CF cookie
 * - Then makes API calls from within browser context
 */
async function scrapeAllAPI(db, coursesBySlug, days = 7) {
  console.log(`[Chronogolf API] Starting hybrid API scrape...`);
  const startTime = Date.now();

  // Get all course UUIDs
  const allUUIDs = Object.values(CHRONOGOLF_COURSES).map(c => c.uuid);

  // Prepare dates
  const dates = [];
  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    dates.push(getPacificDate(dayOffset));
  }

  // NOTE: We no longer delete before scraping - the orchestrator handles cleanup
  // after successful scrape using scraped_at timestamps

  // Launch browser and establish CF cookie
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const allTeeTimes = [];
  const coursesWithData = new Set();

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // Visit a page to establish CF cookie
    console.log('  [Chronogolf API] Establishing session...');
    await retryWithBackoff(async () => {
      await page.goto('https://www.chronogolf.com/club/half-moon-bay-golf-links/teetimes', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    });

    // Now fetch all data via API from within the browser
    console.log('  [Chronogolf API] Fetching tee times via API...');
    const results = await fetchAllTeeTimesInBrowser(page, dates, allUUIDs);

    // Process results
    for (const { date, teeTimes, error } of results) {
      if (error) {
        console.log(`  [Chronogolf API] ${date}: error ${error}`);
        continue;
      }

      for (const tt of teeTimes) {
        const courseUUID = tt.course?.uuid;
        if (!courseUUID) continue;

        const slug = UUID_TO_SLUG[courseUUID];
        if (!slug) continue;

        const course = coursesBySlug[slug];
        if (!course) continue;

        coursesWithData.add(slug);

        const time24 = convertTo24Hour(tt.start_time);
        if (!time24) continue;

        const price = tt.default_price?.subtotal || tt.default_price?.green_fee || null;
        const clubUrl = CHRONOGOLF_COURSES[slug]?.clubUrl || 'https://www.chronogolf.com';

        allTeeTimes.push({
          course_id: course.id,
          date: date,
          time: time24,
          datetime: `${date} ${time24}`,
          holes: tt.course?.holes || 18,
          players: tt.max_player_size || 4,
          price: price,
          has_cart: tt.has_cart ? 1 : 0,
          booking_url: `${clubUrl}/teetimes`,
          source: 'chronogolf'
        });
      }
    }

    await page.close();
  } finally {
    await browser.close().catch(() => {});
  }

  // Batch insert
  if (allTeeTimes.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < allTeeTimes.length; i += BATCH_SIZE) {
      const batch = allTeeTimes.slice(i, i + BATCH_SIZE);
      const statements = batch.map(tt => ({
        sql: `INSERT OR REPLACE INTO tee_times (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [tt.course_id, tt.date, tt.time, tt.datetime, tt.holes, tt.players, tt.price, tt.has_cart, tt.booking_url, tt.source]
      }));

      try {
        await db.batch(statements);
      } catch (e) {
        // Fallback to individual inserts
        for (const stmt of statements) {
          try {
            await db.execute(stmt);
          } catch (e2) {}
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Chronogolf API] Complete: ${coursesWithData.size} courses, ${allTeeTimes.length} tee times in ${elapsed}s`);

  return { coursesScraped: coursesWithData.size, totalTeeTimes: allTeeTimes.length };
}

module.exports = { scrapeAllAPI, CHRONOGOLF_COURSES };
