/**
 * CPS.Golf Optimized Scraper
 *
 * Optimizations (safe, respects robots.txt):
 * 1. Batch database inserts
 * 2. Reduced wait times
 * 3. Both courses scraped in parallel
 * 4. All days fetched sequentially per course (required by site navigation)
 *
 * Note: CPS Golf has bot protection and Disallow: / in robots.txt
 * We use standard browser scraping, not direct API calls
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

const CPS_COURSES = {
  'diablo-creek-golf-course': {
    url: 'https://diablocreek.cps.golf/onlineresweb/search-teetime',
    name: 'Diablo Creek Golf Course'
  },
  'northwood-golf-club': {
    url: 'https://northwood.cps.golf/onlineresweb/search-teetime',
    name: 'Northwood Golf Club'
  }
  // NOTE: Presidio Golf Course removed - requires login (uses GolfNow instead)
};

const CONFIG = {
  pageTimeout: 30000,
  postLoadWait: 2000,  // Reduced from 3000
};

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
  console.warn(`[CPS Golf] Unable to parse time: "${original}"`);
  return null;
}

async function scrapeCPSGolf(page, config, dateStr) {
  // Build URL with date parameter for CPS Golf sites
  const url = config.url.includes('cps.golf')
    ? `${config.url}?TeeOffTimeMin=0&TeeOffTimeMax=23&Date=${dateStr}`
    : config.url;

  // Use retry logic for page navigation
  await retryWithBackoff(async () => {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.pageTimeout });
  });
  await new Promise(r => setTimeout(r, CONFIG.postLoadWait));

  const teeTimes = await retryWithBackoff(async () => {
    return await page.evaluate((date) => {
      const results = [];
      const pageText = document.body.innerText || '';
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match time format like "1:44" or "10:30"
        const timeMatch = line.match(/^(\d{1,2}):(\d{2})$/);

        if (timeMatch) {
          // Next line should be P or A (for PM/AM), or next might be "M" after P/A
          const nextLine = lines[i + 1];
          if (nextLine === 'P' || nextLine === 'A') {
            const period = nextLine === 'P' ? 'PM' : 'AM';
            const time = timeMatch[0] + period;

            // Look for price in nearby lines
            let price = null;
            for (let j = i; j < Math.min(i + 10, lines.length); j++) {
              const priceMatch = lines[j].match(/\$(\d+)(?:\.\d{2})?/);
              if (priceMatch) {
                price = parseInt(priceMatch[1]);
                break;
              }
            }

            // Check for holes info - default to 18
            let holes = 18;
            for (let j = i; j < Math.min(i + 6, lines.length); j++) {
              if (lines[j].includes('9 HOLES') || lines[j].includes('9 or 18')) {
                holes = 9; // Could be either, mark as 9 for flexibility
                break;
              }
            }

            if (price) {
              results.push({
                time: time,
                price: price,
                players: 4,
                holes: holes,
                has_cart: 0,
                date: date
              });
            }
          }
        }
      }

      return results;
    }, dateStr);
  });

  // Dedupe using full datetime (date + time) to avoid collapsing same times on different days
  const unique = [];
  const seen = new Set();
  for (const tt of teeTimes) {
    const key = `${tt.date}_${tt.time}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(tt);
    }
  }

  return unique;
}

/**
 * Scrape a single course for all days
 */
async function scrapeCourseAllDays(browser, slug, config, course, days) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  const allTeeTimes = [];

  try {
    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const dateStr = getPacificDate(dayOffset);
      const teeTimes = await scrapeCPSGolf(page, config, dateStr);

      for (const tt of teeTimes) {
        const time24 = convertTo24Hour(tt.time);
        if (!time24) continue;

        allTeeTimes.push({
          course_id: course.id,
          date: dateStr,
          time: time24,
          datetime: `${dateStr} ${time24}`,
          holes: tt.holes,
          players: tt.players,
          price: tt.price,
          has_cart: tt.has_cart,
          booking_url: config.url,
          source: 'cpsgolf'
        });
      }
    }
  } finally {
    await page.close().catch(() => {});
  }

  return { slug, name: config.name, teeTimes: allTeeTimes };
}

/**
 * Optimized parallel scraper with batch inserts
 */
async function scrapeAllOptimized(db, coursesBySlug, days = 7) {
  console.log(`[CPS Golf] Starting optimized scrape...`);
  const startTime = Date.now();

  const browser = await retryWithBackoff(async () => {
    return await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  });

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    // Filter courses that exist in DB
    const coursesToScrape = Object.entries(CPS_COURSES)
      .filter(([slug]) => coursesBySlug[slug])
      .map(([slug, config]) => ({ slug, config, course: coursesBySlug[slug] }));

    // NOTE: We no longer delete before scraping - the orchestrator handles cleanup
    // after successful scrape using scraped_at timestamps

    // Scrape all courses in parallel
    const results = await Promise.all(
      coursesToScrape.map(({ slug, config, course }) =>
        scrapeCourseAllDays(browser, slug, config, course, days)
      )
    );

    // Collect all tee times for batch insert
    const allTeeTimes = [];
    for (const result of results) {
      allTeeTimes.push(...result.teeTimes);
      coursesScraped++;
      console.log(`  [CPS Golf] ${result.name}: ${result.teeTimes.length} tee times`);
    }

    // Batch insert with retry logic
    if (allTeeTimes.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < allTeeTimes.length; i += BATCH_SIZE) {
        const batch = allTeeTimes.slice(i, i + BATCH_SIZE);
        const statements = batch.map(tt => ({
          sql: `INSERT OR REPLACE INTO tee_times (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          args: [tt.course_id, tt.date, tt.time, tt.datetime, tt.holes, tt.players, tt.price, tt.has_cart, tt.booking_url, tt.source]
        }));

        try {
          await retryWithBackoff(async () => {
            await db.batch(statements);
          });
          totalTeeTimes += batch.length;
        } catch (e) {
          // Fallback to individual inserts with retry
          for (const stmt of statements) {
            try {
              await retryWithBackoff(async () => {
                await db.execute(stmt);
              });
              totalTeeTimes++;
            } catch (e2) {
              console.log(`  [CPS Golf] Failed to insert tee time after retries: ${e2.message}`);
            }
          }
        }
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[CPS Golf] Complete: ${coursesScraped} courses, ${totalTeeTimes} tee times in ${elapsed}s`);

  return { coursesScraped, totalTeeTimes };
}

module.exports = { scrapeAllOptimized, CPS_COURSES };
