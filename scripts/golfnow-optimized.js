/**
 * GolfNow Optimized Puppeteer Scraper
 *
 * Optimizations (safe, doesn't violate robots.txt):
 * 1. Reduced scroll delays (1500ms -> 800ms)
 * 2. Fewer scrolls (5 -> 3)
 * 3. Reduced post-load wait (1500ms -> 800ms)
 * 4. More concurrent days (3 -> 4)
 * 5. Fewer locations (6 -> 4, covers same area)
 * 6. Batch database inserts
 *
 * Expected: ~85s -> ~40-50s
 */

const puppeteer = require('puppeteer');
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const CONFIG = {
  pageTimeout: 30000,
  waitTimeout: 10000,
  scrollDelay: 800,      // Reduced from 1500
  postLoadWait: 800,     // Reduced from 1500
  numScrolls: 3,         // Reduced from 5
  maxConcurrentDays: 4,  // Increased from 3
};

// Retry utility with exponential backoff
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

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Reduced from 6 to 4 locations - these cover the Bay Area well with less overlap
const SEARCH_LOCATIONS = [
  { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
  { lat: 37.3382, lng: -121.8863, name: 'San Jose' },
  { lat: 38.2975, lng: -122.2869, name: 'Napa' },
  { lat: 38.4405, lng: -122.7144, name: 'Santa Rosa' },
];

// ============================================================================
// SCRAPE FUNCTIONS
// ============================================================================

async function scrapeSearchResults(page, date) {
  const formattedDate = date.toISOString().split('T')[0];

  const teeTimes = await page.evaluate((dateStr) => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll('a[href*="/facility/"]').forEach(link => {
      let container = link;
      for (let i = 0; i < 5 && container.parentElement; i++) {
        container = container.parentElement;
        const text = container.innerText || '';

        const hasTime = /\d{1,2}:\d{2}\s*(?:AM|PM)/i.test(text);
        const hasPrice = /\$\d+/.test(text);

        if (hasTime && hasPrice && text.length < 500) {
          if (text.toLowerCase().includes('simulator')) return;

          const hrefMatch = link.href.match(/facility\/(\d+)/);
          if (!hrefMatch) return;
          const facilityId = hrefMatch[1];

          const key = `${facilityId}-${dateStr}`;
          if (seen.has(key)) return;
          seen.add(key);

          const nameMatch = text.match(/^(?:Top Pick\s*\|?\s*|Featured\s*\|?\s*|League Available\s*\|?\s*)?([^|]+?)(?:\s*\||\s+[A-Z][a-z]+,\s*California)/);
          const courseName = nameMatch ? nameMatch[1].trim() : '';

          const timeRangeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          const priceMatch = text.match(/\$(\d{2,4})\d{2}\s*-\s*\$(\d{2,4})\d{2}/);

          if (timeRangeMatch) {
            let minPrice = null;
            if (priceMatch) {
              minPrice = parseInt(priceMatch[1]);
            }

            results.push({
              facilityId,
              courseName,
              date: dateStr,
              firstTime: timeRangeMatch[1].replace(/\s+/g, ''),
              lastTime: timeRangeMatch[2].replace(/\s+/g, ''),
              minPrice,
              source: 'golfnow'
            });
          }
          break;
        }
      }
    });

    return results;
  }, formattedDate);

  return teeTimes;
}

async function scrapeLocationWithPage(browser, location, date) {
  const dateStr = date.toISOString().split('T')[0];
  const searchUrl = `https://www.golfnow.com/tee-times/search#q=location&latitude=${location.lat}&longitude=${location.lng}&radius=50&date=${dateStr}`;

  return retryWithBackoff(async () => {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });

    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: CONFIG.pageTimeout });
      await page.waitForSelector('[class*="course"], [class*="tile"]', { timeout: CONFIG.waitTimeout }).catch(() => {});
      await new Promise(r => setTimeout(r, CONFIG.postLoadWait));

      // Scroll to load more results (reduced scrolls)
      for (let i = 0; i < CONFIG.numScrolls; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, CONFIG.scrollDelay));
      }

      const teeTimes = await scrapeSearchResults(page, date);
      await page.close();
      return teeTimes;

    } catch (error) {
      await page.close().catch(() => {});
      throw error; // Re-throw to trigger retry
    }
  }, 3, 1000).catch((error) => {
    console.log(`  [GolfNow] Failed to scrape ${location.name} for ${dateStr} after retries: ${error.message}`);
    return []; // Return empty array only after all retries exhausted
  });
}

/**
 * Scrape a single day (all locations in parallel using multiple pages)
 */
async function scrapeDayParallel(browser, date, dateStr) {
  console.log(`  [GolfNow] Scraping ${dateStr}...`);

  // Run all locations in parallel
  const locationResults = await Promise.all(
    SEARCH_LOCATIONS.map(loc => scrapeLocationWithPage(browser, loc, date))
  );

  // Dedupe results
  const dayTeeTimes = new Map();
  locationResults.flat().forEach(tt => {
    const key = `${tt.facilityId}-${tt.date}`;
    if (!dayTeeTimes.has(key)) {
      dayTeeTimes.set(key, tt);
    }
  });

  console.log(`  [GolfNow] ${dateStr}: ${dayTeeTimes.size} courses`);
  return Array.from(dayTeeTimes.values());
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

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
  console.warn(`[GolfNow] Unable to parse time: "${original}"`);
  return null;
}

async function getCourseMappings() {
  const result = await retryWithBackoff(async () => {
    return await db.execute('SELECT id, name, golfnow_id FROM courses WHERE golfnow_id IS NOT NULL');
  }, 3, 1000);
  const mapping = {};
  result.rows.forEach(c => {
    if (!mapping[c.golfnow_id]) {
      mapping[c.golfnow_id] = [];
    }
    mapping[c.golfnow_id].push({ id: c.id, name: c.name });
  });
  return mapping;
}

async function clearOldTeeTimes(dates) {
  if (dates.length === 0) return;
  const placeholders = dates.map(() => '?').join(', ');
  await retryWithBackoff(async () => {
    await db.execute({
      sql: `DELETE FROM tee_times WHERE date IN (${placeholders}) AND source = 'golfnow'`,
      args: dates
    });
  }, 3, 1000);
}

/**
 * Batch insert tee times for better performance
 */
async function insertTeeTimesBatch(teeTimes, courseMappings) {
  if (teeTimes.length === 0) return 0;

  const inserts = [];

  for (const tt of teeTimes) {
    const courses = courseMappings[tt.facilityId];
    if (!courses || courses.length === 0) continue;

    for (const course of courses) {
      const time24 = convertTo24Hour(tt.firstTime);
      if (!time24) continue;

      inserts.push({
        sql: `INSERT OR REPLACE INTO tee_times
              (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          course.id,
          tt.date,
          time24,
          `${tt.date} ${time24}`,
          18,
          4,
          tt.minPrice,
          0,
          `https://www.golfnow.com/tee-times/facility/${tt.facilityId}/search`,
          'golfnow'
        ]
      });
    }
  }

  // Batch insert in chunks with retry logic
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE);
    try {
      await retryWithBackoff(async () => {
        await db.batch(batch);
      }, 3, 500);
      inserted += batch.length;
    } catch (e) {
      // Fallback to individual inserts with retry
      for (const stmt of batch) {
        try {
          await retryWithBackoff(async () => {
            await db.execute(stmt);
          }, 2, 500);
          inserted++;
        } catch (e2) {
          console.log(`  [GolfNow] Failed to insert tee time after retries: ${e2.message}`);
        }
      }
    }
  }

  return inserted;
}

// ============================================================================
// MAIN OPTIMIZED SCRAPER
// ============================================================================

async function runScraperOptimized(daysAhead = 7) {
  console.log('[GolfNow] Starting optimized scrape...');
  const startTime = Date.now();
  const today = new Date();

  const courseMappings = await getCourseMappings();
  console.log(`[GolfNow] Loaded ${Object.keys(courseMappings).length} course mappings`);

  // Prepare dates
  const dates = [];
  const dateObjects = [];
  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
    dateObjects.push(date);
  }

  // NOTE: We no longer delete before scraping - the orchestrator handles cleanup
  // after successful scrape using scraped_at timestamps

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const allTeeTimes = new Map();

  try {
    // Process days in batches with increased concurrency
    for (let i = 0; i < daysAhead; i += CONFIG.maxConcurrentDays) {
      const batch = dateObjects.slice(i, i + CONFIG.maxConcurrentDays);
      const batchDates = dates.slice(i, i + CONFIG.maxConcurrentDays);

      const batchResults = await Promise.all(
        batch.map((date, idx) => scrapeDayParallel(browser, date, batchDates[idx]))
      );

      // Merge results
      batchResults.flat().forEach(tt => {
        const key = `${tt.facilityId}-${tt.date}`;
        if (!allTeeTimes.has(key)) {
          allTeeTimes.set(key, tt);
        }
      });
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const uniqueTeeTimes = Array.from(allTeeTimes.values());

  console.log(`[GolfNow] Scraped ${uniqueTeeTimes.length} tee time entries, inserting...`);
  const totalTeeTimes = await insertTeeTimesBatch(uniqueTeeTimes, courseMappings);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[GolfNow] Complete: ${totalTeeTimes} tee times in ${elapsed}s`);

  return totalTeeTimes;
}

module.exports = { runScraperOptimized };
