const puppeteer = require('puppeteer');
const { db } = require('../db/turso');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  pageTimeout: 30000,
  waitTimeout: 15000,
  scrollDelay: 2000,
};

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Bay Area search locations to cover all courses
const SEARCH_LOCATIONS = [
  { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
  { lat: 37.3382, lng: -121.8863, name: 'San Jose' },
  { lat: 37.8044, lng: -122.2712, name: 'Oakland' },
  { lat: 38.2975, lng: -122.2869, name: 'Napa' },
  { lat: 37.6879, lng: -122.4702, name: 'Pacifica' },
];

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browser;
}

async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

// ============================================================================
// SCRAPE SEARCH RESULTS
// ============================================================================

async function scrapeSearchResults(page, date) {
  const formattedDate = date.toISOString().split('T')[0];

  // Extract tee times from search results
  const teeTimes = await page.evaluate((dateStr) => {
    const results = [];
    const seen = new Set();

    // Find all elements with facility links
    document.querySelectorAll('a[href*="/facility/"]').forEach(link => {
      // Navigate up to find container with tee time data
      let container = link;
      for (let i = 0; i < 5 && container.parentElement; i++) {
        container = container.parentElement;
        const text = container.innerText || '';

        // Check if this container has both time and price patterns
        const hasTime = /\d{1,2}:\d{2}\s*(?:AM|PM)/i.test(text);
        const hasPrice = /\$\d+/.test(text);

        if (hasTime && hasPrice && text.length < 500) {
          // Skip simulators
          if (text.toLowerCase().includes('simulator')) return;

          // Extract facility ID
          const hrefMatch = link.href.match(/facility\/(\d+)/);
          if (!hrefMatch) return;
          const facilityId = hrefMatch[1];

          // Skip if already processed
          const key = `${facilityId}-${dateStr}`;
          if (seen.has(key)) return;
          seen.add(key);

          // Extract course name - look for text before location pattern
          const nameMatch = text.match(/^(?:Top Pick\s*\|?\s*|Featured\s*\|?\s*|League Available\s*\|?\s*)?([^|]+?)(?:\s*\||\s+[A-Z][a-z]+,\s*California)/);
          const courseName = nameMatch ? nameMatch[1].trim() : '';

          // Extract time range (e.g., "7:30AM - 6:30PM")
          const timeRangeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

          // Extract price range - prices like "$3449" = $34.49, "$6549" = $65.49
          const priceMatch = text.match(/\$(\d{2,4})\d{2}\s*-\s*\$(\d{2,4})\d{2}/);

          if (timeRangeMatch) {
            // Parse price (remove cents portion)
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

          break;  // Found container, stop looking
        }
      }
    });

    return results;
  }, formattedDate);

  return teeTimes;
}

async function scrapeLocation(location, date) {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1280, height: 800 });

  // Build search URL (without date - GolfNow defaults to today which is what we want for first day)
  const searchUrl = `https://www.golfnow.com/tee-times/search#q=location&latitude=${location.lat}&longitude=${location.lng}&radius=50`;

  console.log(`  Searching ${location.name}...`);

  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: CONFIG.pageTimeout });

    // Wait for results
    await page.waitForSelector('[class*="course"], [class*="tile"]', { timeout: CONFIG.waitTimeout }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    // Scroll to load more results
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, CONFIG.scrollDelay));
    }

    const teeTimes = await scrapeSearchResults(page, date);
    console.log(`    Found ${teeTimes.length} courses with tee times`);

    await page.close();
    return teeTimes;

  } catch (error) {
    console.log(`    Error: ${error.message}`);
    await page.close().catch(() => {});
    return [];
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function getCourseMappings() {
  // Get courses from database and create mapping by golfnow_id
  const result = await db.execute('SELECT id, name, golfnow_id FROM courses WHERE golfnow_id IS NOT NULL');
  const mapping = {};
  result.rows.forEach(c => {
    mapping[c.golfnow_id] = { id: c.id, name: c.name };
  });
  return mapping;
}

async function clearOldTeeTimes(dates) {
  if (dates.length === 0) return;
  const placeholders = dates.map(() => '?').join(', ');
  await db.execute({
    sql: `DELETE FROM tee_times WHERE date IN (${placeholders}) AND source = 'golfnow'`,
    args: dates
  });
  console.log(`Cleared old GolfNow tee times for ${dates.length} dates`);
}

async function insertTeeTimes(teeTimes, courseMappings) {
  if (teeTimes.length === 0) return 0;

  let inserted = 0;

  for (const tt of teeTimes) {
    const course = courseMappings[tt.facilityId];
    if (!course) continue;  // Course not in our database

    try {
      // Insert a representative tee time (first available time at min price)
      await db.execute({
        sql: `INSERT OR REPLACE INTO tee_times
              (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          course.id,
          tt.date,
          tt.firstTime,
          `${tt.date} ${tt.firstTime}`,
          18,
          4,
          tt.minPrice,
          0,
          `https://www.golfnow.com/tee-times/facility/${tt.facilityId}/search`,
          'golfnow'
        ]
      });
      inserted++;
    } catch (error) {
      // Ignore duplicate errors
    }
  }

  return inserted;
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

async function runScraper(daysAhead = 7) {
  console.log('='.repeat(60));
  console.log('GolfNow Scraper (Location Search Method)');
  console.log('='.repeat(60));

  const startTime = Date.now();
  const today = new Date();
  let totalTeeTimes = 0;

  // Get course mappings from database
  const courseMappings = await getCourseMappings();
  console.log(`Loaded ${Object.keys(courseMappings).length} course mappings`);

  // Collect dates
  const dates = [];
  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  // Clear old data
  await clearOldTeeTimes(dates);

  try {
    for (let i = 0; i < daysAhead; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      console.log(`\n[Day ${i + 1}/${daysAhead}] ${dateStr}`);

      // Scrape all locations and combine results
      const allTeeTimes = new Map();  // Use Map to dedupe by facilityId

      for (const location of SEARCH_LOCATIONS) {
        const teeTimes = await scrapeLocation(location, date);

        teeTimes.forEach(tt => {
          // Keep first occurrence of each course
          if (!allTeeTimes.has(tt.facilityId)) {
            allTeeTimes.set(tt.facilityId, tt);
          }
        });

        // Small delay between searches
        await new Promise(r => setTimeout(r, 1000));
      }

      const uniqueTeeTimes = Array.from(allTeeTimes.values());
      console.log(`  Total unique: ${uniqueTeeTimes.length} courses`);

      if (uniqueTeeTimes.length > 0) {
        const saved = await insertTeeTimes(uniqueTeeTimes, courseMappings);
        console.log(`  Saved ${saved} tee times`);
        totalTeeTimes += saved;
      }

      // Restart browser between days
      await closeBrowser();
    }
  } finally {
    await closeBrowser();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log(`Complete! ${totalTeeTimes} tee times in ${elapsed}s`);
  console.log('='.repeat(60));

  return totalTeeTimes;
}

module.exports = {
  runScraper,
  closeBrowser,
  CONFIG
};
