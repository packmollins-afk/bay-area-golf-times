const puppeteer = require('puppeteer');
const db = require('../db/schema');

// Shared browser instance for efficiency
let browserInstance = null;

/**
 * Get or create browser instance
 */
async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browserInstance;
}

/**
 * Close browser instance
 */
async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Scrape tee times from GolfNow using Puppeteer
 * The GolfNow website is client-side rendered, so we need a real browser
 */
async function fetchGolfNowTeeTimes(facilityId, date) {
  const formattedDate = date.toISOString().split('T')[0];
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Format date for GolfNow URL (e.g., "Jan 07 2026")
    const dateObj = new Date(formattedDate);
    const dateStr = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).replace(',', '');

    const url = `https://www.golfnow.com/tee-times/facility/${facilityId}/search#date=${encodeURIComponent(dateStr)}&sortby=Date&view=List&holes=3`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for tee times to load
    await page.waitForFunction(
      () => document.body.innerText.includes('AM') || document.body.innerText.includes('PM') || document.body.innerText.includes('no tee times'),
      { timeout: 15000 }
    ).catch(() => {});

    // Additional wait for dynamic content
    await new Promise(r => setTimeout(r, 2000));

    // Extract tee time data from the page
    const teeTimes = await page.evaluate((dateArg, facilityIdArg) => {
      const results = [];
      const seen = new Set();

      // Look for elements with data-players attribute (most reliable)
      document.querySelectorAll('[data-players]').forEach(el => {
        const text = el.innerText || '';

        // Extract time (e.g., "7:30AM" or "7:30 AM")
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (!timeMatch) return;

        const time = timeMatch[1].replace(/\s+/g, '');

        // Extract price - handle GolfNow's cents format
        const allPrices = text.match(/\$(\d+)/g) || [];
        let price = null;
        for (const p of allPrices) {
          const val = parseInt(p.replace('$', ''));
          if (val > 500 && val < 50000) {
            // Price in cents (e.g., 15348 = $153)
            price = Math.round(val / 100);
            break;
          } else if (val >= 15 && val <= 500) {
            // Already in dollars
            price = val;
            break;
          }
        }

        // Get players from data attribute
        const players = parseInt(el.dataset.players) || 4;

        // Extract holes (e.g., "18 / 2-4")
        const holesMatch = text.match(/(\d+)\s*\/\s*\d+-\d+/);
        const holes = holesMatch ? parseInt(holesMatch[1]) : 18;

        // Check for cart
        const hasCart = text.toLowerCase().includes('cart') && !text.toLowerCase().includes('no cart');

        // Get booking URL
        const link = el.querySelector('a')?.href || el.closest('a')?.href;

        // Dedupe by time+price
        const key = `${time}-${price}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            time,
            date: dateArg,
            price,
            holes,
            players,
            has_cart: hasCart ? 1 : 0,
            booking_url: link || `https://www.golfnow.com/tee-times/facility/${facilityIdArg}/search`,
            source: 'golfnow'
          });
        }
      });

      // Fallback: look for other patterns if no data-players elements found
      if (results.length === 0) {
        document.querySelectorAll('.select-rate-link, section.result, .teetime-row, [class*="rate"]').forEach(el => {
          const text = el.innerText || '';
          const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          if (!timeMatch) return;

          const time = timeMatch[1].replace(/\s+/g, '');
          const priceMatch = text.match(/\$(\d+)/);
          let price = priceMatch ? parseInt(priceMatch[1]) : null;
          if (price && price > 1000) price = Math.round(price / 100);

          const key = `${time}-${price}`;
          if (!seen.has(key) && price && price >= 15 && price <= 500) {
            seen.add(key);
            results.push({
              time,
              date: dateArg,
              price,
              holes: 18,
              players: 4,
              has_cart: 0,
              booking_url: `https://www.golfnow.com/tee-times/facility/${facilityIdArg}/search`,
              source: 'golfnow'
            });
          }
        });
      }

      return results;
    }, formattedDate, facilityId);

    await page.close();
    return teeTimes;

  } catch (error) {
    console.error(`Error scraping facility ${facilityId}:`, error.message);
    return [];
  }
}

/**
 * Scrape tee times for a single course
 */
async function scrapeCourse(course, date) {
  if (!course.golfnow_id) {
    return [];
  }

  console.log(`Scraping ${course.name}...`);

  const teeTimes = await fetchGolfNowTeeTimes(course.golfnow_id, date);

  // Add course_id to each tee time
  return teeTimes.map(tt => ({
    ...tt,
    course_id: course.id
  }));
}

/**
 * Scrape all courses for a given date
 * Uses longer delays and browser restarts to avoid GolfNow rate limiting
 */
async function scrapeAllCourses(date) {
  const { getCoursesWithGolfNow } = require('../db/courses');
  const rawCourses = getCoursesWithGolfNow();

  // Deduplicate courses by golfnow_id (keep first occurrence)
  const seenIds = new Set();
  const courses = rawCourses.filter(c => {
    if (seenIds.has(c.golfnow_id)) return false;
    seenIds.add(c.golfnow_id);
    return true;
  });

  console.log(`Scraping ${courses.length} unique GolfNow courses...`);
  const allTeeTimes = [];

  // Process sequentially with delays to avoid rate limiting
  const batchSize = 5; // Restart browser every N courses

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];

    // Restart browser every batchSize courses to avoid detection
    if (i > 0 && i % batchSize === 0) {
      console.log(`  [Restarting browser to avoid rate limiting...]`);
      await closeBrowser();
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second pause
    }

    const teeTimes = await scrapeCourse(course, date);
    allTeeTimes.push(...teeTimes);

    // Longer delay between courses (2-4 seconds randomized)
    const delay = 2000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return allTeeTimes;
}

/**
 * Save tee times to database
 */
function saveTeeTimes(teeTimes) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO tee_times
    (course_id, date, time, datetime, holes, players, price, original_price, has_cart, booking_url, source, scraped_at)
    VALUES (@course_id, @date, @time, @datetime, @holes, @players, @price, @original_price, @has_cart, @booking_url, @source, datetime('now'))
  `);

  const insertMany = db.transaction((teeTimes) => {
    let count = 0;
    for (const tt of teeTimes) {
      try {
        insert.run({
          course_id: tt.course_id,
          date: tt.date,
          time: tt.time,
          datetime: `${tt.date} ${tt.time}`,
          holes: tt.holes || 18,
          players: tt.players || 4,
          price: tt.price,
          original_price: tt.original_price || null,
          has_cart: tt.has_cart || 0,
          booking_url: tt.booking_url,
          source: tt.source
        });
        count++;
      } catch (error) {
        console.error(`Error saving tee time:`, error.message);
      }
    }
    return count;
  });

  return insertMany(teeTimes);
}

/**
 * Main scrape function
 */
async function runScraper(daysAhead = 7) {
  console.log('Starting GolfNow scraper (Puppeteer)...');

  const today = new Date();
  let totalTeeTimes = 0;

  try {
    for (let i = 0; i < daysAhead; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      console.log(`\nScraping for ${date.toISOString().split('T')[0]}...`);
      const teeTimes = await scrapeAllCourses(date);

      if (teeTimes.length > 0) {
        const saved = saveTeeTimes(teeTimes);
        console.log(`Saved ${saved} tee times`);
        totalTeeTimes += saved;
      }

      // Delay between days
      if (i < daysAhead - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } finally {
    // Always close the browser when done
    await closeBrowser();
  }

  console.log(`\nScraping complete! Total tee times saved: ${totalTeeTimes}`);
  return totalTeeTimes;
}

module.exports = {
  fetchGolfNowTeeTimes,
  scrapeCourse,
  scrapeAllCourses,
  saveTeeTimes,
  runScraper,
  closeBrowser
};
