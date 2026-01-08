/**
 * TotaleIntegrated Fast Scraper
 * Scrapes CourseCo courses NOT on GolfNow: Bay Area, Monterey, Napa, Sacramento
 * Gets first available tee time for today only (fast like GolfNow scraper)
 */

const puppeteer = require('puppeteer');

// Only courses that are NOT on GolfNow
const TOTALE_COURSES = {
  'boundary-oak-golf-course': {
    url: 'https://playboundaryoak.totaleintegrated.com/',
    name: 'Boundary Oak Golf Course'
  },
  'metropolitan-golf-links': {
    url: 'https://playmetro.totaleintegrated.com/',
    name: 'Metropolitan Golf Links'
  },
  'san-jose-municipal-golf-course': {
    url: 'https://sanjose.totaleintegrated.net/web/tee-times',
    name: 'San Jose Municipal Golf Course'
  },
  // Monterey Region (CourseCo - no GolfNow inventory)
  'pacific-grove-golf-links': {
    url: 'https://playpacificgrove.totaleintegrated.com/',
    name: 'Pacific Grove Golf Links'
  },
  'laguna-seca-golf-ranch': {
    url: 'https://lagunasecagolf.totaleintegrated.com/',
    name: 'Laguna Seca Golf Ranch'
  },
  // North Bay / Napa Region (CourseCo - no GolfNow inventory)
  'valley-of-the-moon-club': {
    url: 'https://vom.totaleintegrated.net/web/tee-times',
    name: 'Valley of the Moon Club'
  },
  'napa-golf-course': {
    url: 'https://playnapa.totaleintegrated.com/',
    name: 'Napa Golf Course'
  },
  // Sacramento Region (CourseCo - no GolfNow inventory)
  'ancil-hoffman-golf-course': {
    url: 'https://playancilhoffman.totaleintegrated.com/',
    name: 'Ancil Hoffman Golf Course'
  },
  'mather-golf-course': {
    url: 'https://playmather.totaleintegrated.com/',
    name: 'Mather Golf Course'
  },
  'cherry-island-golf-course': {
    url: 'https://playgolfcherryisland.totaleintegrated.com/',
    name: 'Cherry Island Golf Course'
  }
};

function getPacificDate() {
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const year = pst.getFullYear();
  const month = String(pst.getMonth() + 1).padStart(2, '0');
  const day = String(pst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fast scrape - just get first available time and price from landing page
 */
async function scrapeFast(page, siteUrl, timeout = 30000) {
  try {
    await page.goto(siteUrl, { waitUntil: 'networkidle2', timeout });

    // Wait for content to render
    await new Promise(r => setTimeout(r, 8000));

    // Extract first available tee time and price
    const result = await page.evaluate(() => {
      const text = document.body.innerText || '';

      // Find first time pattern
      const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (!timeMatch) return null;

      // Find first price
      const priceMatches = text.match(/\$(\d+(?:\.\d{2})?)/g) || [];
      let price = null;
      for (const p of priceMatches) {
        const val = parseFloat(p.replace('$', ''));
        if (val >= 15 && val <= 300) {
          price = Math.round(val);
          break;
        }
      }

      return {
        time: timeMatch[1].replace(/\s+/g, ''),
        price
      };
    });

    return result;
  } catch (error) {
    console.log(`    Error: ${error.message}`);
    return null;
  }
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

/**
 * Fast scraper - only today, only non-GolfNow courses
 */
async function scrapeAllTotaleIntegrated(db, coursesBySlug) {
  console.log('--- TotaleIntegrated Fast Scraper ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const dateStr = getPacificDate();
  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    for (const [slug, config] of Object.entries(TOTALE_COURSES)) {
      const course = coursesBySlug[slug];
      if (!course) {
        console.log(`  Skipping ${config.name} (not in DB)`);
        continue;
      }

      console.log(`  ${config.name}...`);

      const result = await scrapeFast(page, config.url);

      if (result && result.time) {
        const time24 = convertTo24Hour(result.time);
        if (time24) {
          // Clear old data and insert new
          await db.execute({
            sql: 'DELETE FROM tee_times WHERE course_id = ? AND source = ?',
            args: [course.id, 'totaleintegrated']
          });

          await db.execute({
            sql: `INSERT OR REPLACE INTO tee_times
                  (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            args: [course.id, dateStr, time24, `${dateStr} ${time24}`, 18, 4, result.price, 0, config.url, 'totaleintegrated']
          });

          console.log(`    ✓ ${result.time} - $${result.price || '?'}`);
          totalTeeTimes++;
        }
      } else {
        console.log(`    ✗ No tee times found`);
      }

      coursesScraped++;
    }
  } finally {
    await browser.close();
  }

  console.log(`TotaleIntegrated: ${coursesScraped} courses, ${totalTeeTimes} tee times`);
  return { coursesScraped, totalTeeTimes };
}

module.exports = {
  TOTALE_COURSES,
  scrapeAllTotaleIntegrated
};
