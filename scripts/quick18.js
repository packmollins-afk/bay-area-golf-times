/**
 * Quick18 Scraper
 *
 * Puppeteer-based scraper for Quick18 booking system.
 * Targets Baylands Golf Links and any future Quick18 courses.
 *
 * Features:
 * - 7-day lookahead
 * - Retry logic with exponential backoff
 * - Batch database inserts
 * - Parallel day scraping per course
 */

const puppeteer = require('puppeteer');

const QUICK18_COURSES = {
  'baylands-golf-links': {
    url: 'https://baylandswalking.quick18.com/teetimes/searchmatrix',
    name: 'Baylands Golf Links'
  }
};

const CONFIG = {
  pageTimeout: 30000,
  postLoadWait: 3000,
  maxRetries: 3,
  retryDelayBase: 2000 // Exponential backoff: 2s, 4s, 8s
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

function formatDateForUrl(dateStr) {
  // Convert YYYY-MM-DD to MM/DD/YYYY for Quick18 URL
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

function convertTo24Hour(timeStr) {
  // Handle formats like "7:00 AM", "12:30 PM", "7:00AM", etc.
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeQuick18WithRetry(page, config, dateStr, retries = CONFIG.maxRetries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await scrapeQuick18(page, config, dateStr);
    } catch (error) {
      if (attempt === retries) {
        console.error(`  [Quick18] Failed after ${retries} attempts for ${dateStr}: ${error.message}`);
        return [];
      }
      const delay = CONFIG.retryDelayBase * Math.pow(2, attempt - 1);
      console.log(`  [Quick18] Attempt ${attempt} failed for ${dateStr}, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  return [];
}

async function scrapeQuick18(page, config, dateStr) {
  // Build URL with date parameter
  const formattedDate = formatDateForUrl(dateStr);
  const url = `${config.url}?date=${encodeURIComponent(formattedDate)}`;

  await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.pageTimeout });
  await sleep(CONFIG.postLoadWait);

  const teeTimes = await page.evaluate((date) => {
    const results = [];

    // Quick18 uses a matrix/grid layout for tee times
    // Look for tee time slots which typically contain time, price, and availability info

    // Try multiple selectors that Quick18 sites commonly use
    const selectors = [
      '.tee-time', '.teetime', '.time-slot', '.slot',
      '[data-teetime]', '[data-time]',
      '.matrix-cell', '.time-cell',
      'table td', '.booking-slot'
    ];

    // First try to find tee time elements with structured data
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(el => {
          const text = el.innerText || el.textContent || '';

          // Look for time pattern
          const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (!timeMatch) return;

          const time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;

          // Look for price
          const priceMatch = text.match(/\$(\d+)(?:\.\d{2})?/);
          const price = priceMatch ? parseInt(priceMatch[1]) : null;

          // Look for player count (usually 1-4)
          const playerMatch = text.match(/(\d)\s*(?:player|golfer|spot)/i);
          const players = playerMatch ? parseInt(playerMatch[1]) : 4;

          // Look for holes info
          const holesMatch = text.match(/(\d+)\s*hole/i);
          const holes = holesMatch ? parseInt(holesMatch[1]) : 18;

          if (price) {
            results.push({
              time: time,
              price: price,
              players: players,
              holes: holes,
              has_cart: 0, // Quick18 walking courses typically don't include cart
              date: date
            });
          }
        });
        if (results.length > 0) break;
      }
    }

    // Fallback: Parse the entire page text for tee time patterns
    if (results.length === 0) {
      const pageText = document.body.innerText || '';
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match time format like "7:00 AM" or "12:30PM"
        const timeMatch = line.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
          const time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;

          // Look for price in this line or nearby lines
          let price = null;
          for (let j = Math.max(0, i - 2); j < Math.min(i + 5, lines.length); j++) {
            const priceMatch = lines[j].match(/\$(\d+)(?:\.\d{2})?/);
            if (priceMatch) {
              price = parseInt(priceMatch[1]);
              break;
            }
          }

          // Determine holes (Baylands is 18-hole course)
          let holes = 18;
          for (let j = Math.max(0, i - 2); j < Math.min(i + 3, lines.length); j++) {
            if (lines[j].match(/9\s*hole/i)) {
              holes = 9;
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

  // Dedupe by time
  const unique = [];
  const seen = new Set();
  for (const tt of teeTimes) {
    if (!seen.has(tt.time)) {
      seen.add(tt.time);
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
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  const allTeeTimes = [];

  try {
    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const dateStr = getPacificDate(dayOffset);
      const teeTimes = await scrapeQuick18WithRetry(page, config, dateStr);

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
          source: 'quick18'
        });
      }

      // Log progress for each day
      console.log(`  [Quick18] ${config.name} ${dateStr}: ${teeTimes.length} tee times`);
    }
  } finally {
    await page.close().catch(() => {});
  }

  return { slug, name: config.name, teeTimes: allTeeTimes };
}

/**
 * Main scraper function - parallel execution with batch inserts
 */
async function scrapeAllOptimized(db, coursesBySlug, days = 7) {
  console.log(`[Quick18] Starting optimized scrape...`);
  const startTime = Date.now();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    // Filter courses that exist in DB
    const coursesToScrape = Object.entries(QUICK18_COURSES)
      .filter(([slug]) => coursesBySlug[slug])
      .map(([slug, config]) => ({ slug, config, course: coursesBySlug[slug] }));

    if (coursesToScrape.length === 0) {
      console.log('[Quick18] No Quick18 courses found in database');
      return { coursesScraped: 0, totalTeeTimes: 0 };
    }

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
      console.log(`  [Quick18] ${result.name}: ${result.teeTimes.length} total tee times`);
    }

    // Batch insert
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
          await db.batch(statements);
          totalTeeTimes += batch.length;
        } catch (e) {
          // Fallback to individual inserts
          for (const stmt of statements) {
            try {
              await db.execute(stmt);
              totalTeeTimes++;
            } catch (e2) {}
          }
        }
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Quick18] Complete: ${coursesScraped} courses, ${totalTeeTimes} tee times in ${elapsed}s`);

  return { coursesScraped, totalTeeTimes };
}

module.exports = { scrapeAllOptimized, QUICK18_COURSES };
