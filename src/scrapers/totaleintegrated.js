/**
 * TotaleIntegrated Scraper
 * Scrapes CourseCo courses NOT on GolfNow: Bay Area, Monterey, Napa, Sacramento
 * Supports multi-day scraping like GolfNow
 */

const puppeteer = require('puppeteer');

// Only courses that are NOT on GolfNow
const TOTALE_COURSES = {
  'boundary-oak-golf-course': {
    url: 'https://boundaryoak.totaleintegrated.net/web/tee-times',
    name: 'Boundary Oak Golf Course'
  },
  'metropolitan-golf-links': {
    url: 'https://metro.totaleintegrated.net/web/tee-times',
    name: 'Metropolitan Golf Links'
  },
  'san-jose-municipal-golf-course': {
    url: 'https://sanjose.totaleintegrated.net/web/tee-times',
    name: 'San Jose Municipal Golf Course'
  },
  // Monterey Region (CourseCo - no GolfNow inventory)
  'pacific-grove-golf-links': {
    url: 'https://pacificgrove.totaleintegrated.net/web/tee-times',
    name: 'Pacific Grove Golf Links'
  },
  'laguna-seca-golf-ranch': {
    url: 'https://lagunaseca.totaleintegrated.net/web/tee-times',
    name: 'Laguna Seca Golf Ranch'
  },
  // North Bay / Napa Region (CourseCo - no GolfNow inventory)
  'valley-of-the-moon-club': {
    url: 'https://vom.totaleintegrated.net/web/tee-times',
    name: 'Valley of the Moon Club'
  },
  'napa-golf-course': {
    url: 'https://napa.totaleintegrated.net/web/tee-times',
    name: 'Napa Golf Course'
  },
  // Sacramento Region (CourseCo - no GolfNow inventory)
  'ancil-hoffman-golf-course': {
    url: 'https://ancilhoffman.totaleintegrated.net/web/tee-times',
    name: 'Ancil Hoffman Golf Course'
  },
  'mather-golf-course': {
    url: 'https://mather.totaleintegrated.net/web/tee-times',
    name: 'Mather Golf Course'
  },
  'cherry-island-golf-course': {
    url: 'https://cherryisland.totaleintegrated.net/web/tee-times',
    name: 'Cherry Island Golf Course'
  }
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
 * Scrape tee times - click Search button to load times
 */
async function scrapeTimes(page, siteUrl, dayOffset = 0, timeout = 30000) {
  try {
    await page.goto(siteUrl, { waitUntil: 'networkidle2', timeout });
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss any popup modals (e.g., "Attention Players" at Valley of the Moon)
    // Some sites have multiple modals, so click all Dismiss buttons
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await page.evaluate(el => el.textContent, btn);
          if (text && text.includes('Dismiss')) {
            await btn.click();
            await new Promise(r => setTimeout(r, 500));
          }
        }
      } catch (e) {
        // No modal to dismiss
      }
    }

    // Navigate to correct day using chevron buttons
    for (let i = 0; i < dayOffset; i++) {
      try {
        await page.click('text=chevron_right');
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        break;
      }
    }

    // Click Search button to load tee times
    try {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Search')) {
          await btn.click();
          break;
        }
      }
    } catch (e) {
      // Continue anyway
    }

    await new Promise(r => setTimeout(r, 4000));

    // Extract all tee times and prices
    const results = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const times = [];

      // Find all time patterns
      const timeMatches = text.matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM))/gi);
      const priceMatches = text.match(/\$(\d+(?:\.\d{2})?)/g) || [];

      // Get first valid price
      let price = null;
      for (const p of priceMatches) {
        const val = parseFloat(p.replace('$', ''));
        if (val >= 15 && val <= 300) {
          price = Math.round(val);
          break;
        }
      }

      // Collect unique times
      const seenTimes = new Set();
      for (const match of timeMatches) {
        const time = match[1].replace(/\s+/g, '').toUpperCase();
        if (!seenTimes.has(time)) {
          seenTimes.add(time);
          times.push({ time, price });
        }
      }

      return times.slice(0, 30); // Max 30 times per day
    });

    return results;
  } catch (error) {
    return [];
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
 * Multi-day scraper for TotaleIntegrated courses
 */
async function scrapeAllTotaleIntegrated(db, coursesBySlug, days = 7) {
  console.log(`--- TotaleIntegrated Scraper (${days} days) ---`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    // Clear old totaleintegrated data
    await db.execute({ sql: 'DELETE FROM tee_times WHERE source = ?', args: ['totaleintegrated'] });

    for (const [slug, config] of Object.entries(TOTALE_COURSES)) {
      const course = coursesBySlug[slug];
      if (!course) {
        console.log(`  Skipping ${config.name} (not in DB)`);
        continue;
      }

      console.log(`  ${config.name}...`);
      let courseTeeTimes = 0;

      // Scrape each day
      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const dateStr = getPacificDate(dayOffset);
        const results = await scrapeTimes(page, config.url, dayOffset);

        for (const tt of results) {
          const time24 = convertTo24Hour(tt.time);
          if (!time24) continue;

          try {
            await db.execute({
              sql: `INSERT OR IGNORE INTO tee_times
                    (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
              args: [course.id, dateStr, time24, `${dateStr} ${time24}`, 18, 4, tt.price, 0, config.url, 'totaleintegrated']
            });
            courseTeeTimes++;
            totalTeeTimes++;
          } catch (e) {
            // Ignore duplicates
          }
        }
      }

      console.log(`    ✓ ${courseTeeTimes} tee times`);
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
