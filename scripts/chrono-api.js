/**
 * Chronogolf Hybrid API Scraper
 *
 * Uses Puppeteer to get Cloudflare cookie, then makes API calls in browser context
 * This bypasses CF bot protection while getting API speed benefits
 *
 * API: https://www.chronogolf.com/marketplace/v2/teetimes
 */

const puppeteer = require('puppeteer');

// Course UUIDs for all Chronogolf courses
const CHRONOGOLF_COURSES = {
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

function convertTo24Hour(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return timeStr;

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();

  // If no AM/PM, assume it's already in reasonable format
  if (!period) {
    // API returns times like "7:30" which is PST
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

/**
 * Fetch all tee times from within the browser context (bypasses CF protection)
 */
async function fetchAllTeeTimesInBrowser(page, dates, courseUUIDs) {
  const uuidsParam = courseUUIDs.join(',');

  // Execute API calls from within the browser
  const results = await page.evaluate(async (dates, uuidsParam) => {
    const allResults = [];

    // Fetch all dates in parallel from within the browser
    const promises = dates.map(async (date) => {
      try {
        const url = `https://www.chronogolf.com/marketplace/v2/teetimes?start_date=${date}&course_ids=${encodeURIComponent(uuidsParam)}&holes=18&page=1`;
        const resp = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });

        if (!resp.ok) {
          return { date, teeTimes: [], error: resp.status };
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
      } catch (e) {
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

  // Delete existing chronogolf data
  await db.execute("DELETE FROM tee_times WHERE source = 'chronogolf'");

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
    await page.goto('https://www.chronogolf.com/club/half-moon-bay-golf-links/teetimes', {
      waitUntil: 'networkidle2',
      timeout: 30000
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
        sql: `INSERT OR IGNORE INTO tee_times (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
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
