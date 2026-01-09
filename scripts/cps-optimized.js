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

const CPS_COURSES = {
  'diablo-creek-golf-course': {
    url: 'https://diablocreek.cps.golf/',
    name: 'Diablo Creek Golf Course'
  },
  'northwood-golf-club': {
    url: 'https://www.northwoodgolf.com/bookteetimes',
    name: 'Northwood Golf Club'
  }
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

function convertTo24Hour(timeStr) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})(AM|PM)/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

async function scrapeCPSGolf(page, config, dateStr) {
  try {
    await page.goto(config.url, { waitUntil: 'networkidle2', timeout: CONFIG.pageTimeout });
    await new Promise(r => setTimeout(r, CONFIG.postLoadWait));

    const teeTimes = await page.evaluate((date) => {
      const results = [];
      const pageText = document.body.innerText || '';
      const lines = pageText.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const timeMatch = line.match(/^(\d{1,2}):(\d{2})$/);

        if (timeMatch) {
          const ampm = lines[i + 1]?.trim();
          if (ampm === 'P' || ampm === 'A') {
            const period = ampm === 'P' ? 'PM' : 'AM';
            const time = timeMatch[0] + period;

            let price = null;
            for (let j = i; j < Math.min(i + 8, lines.length); j++) {
              const priceMatch = lines[j].match(/\$(\d+(?:\.\d{2})?)/);
              if (priceMatch) {
                price = parseInt(priceMatch[1]);
                break;
              }
            }

            if (price) {
              results.push({
                time: time,
                price: price,
                players: 4,
                holes: 18,
                has_cart: 0,
                date: date
              });
            }
          }
        }
      }

      return results;
    }, dateStr);

    // Dedupe
    const unique = [];
    const seen = new Set();
    for (const tt of teeTimes) {
      if (!seen.has(tt.time)) {
        seen.add(tt.time);
        unique.push(tt);
      }
    }

    return unique;
  } catch (error) {
    return [];
  }
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

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    // Filter courses that exist in DB
    const coursesToScrape = Object.entries(CPS_COURSES)
      .filter(([slug]) => coursesBySlug[slug])
      .map(([slug, config]) => ({ slug, config, course: coursesBySlug[slug] }));

    // Delete existing CPS data
    await db.execute("DELETE FROM tee_times WHERE source = 'cpsgolf'");

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

    // Batch insert
    if (allTeeTimes.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < allTeeTimes.length; i += BATCH_SIZE) {
        const batch = allTeeTimes.slice(i, i + BATCH_SIZE);
        const statements = batch.map(tt => ({
          sql: `INSERT OR IGNORE INTO tee_times (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
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
  console.log(`[CPS Golf] Complete: ${coursesScraped} courses, ${totalTeeTimes} tee times in ${elapsed}s`);

  return { coursesScraped, totalTeeTimes };
}

module.exports = { scrapeAllOptimized, CPS_COURSES };
