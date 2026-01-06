/**
 * Scrape GolfNow tee times and update Turso database
 * Run via GitHub Actions on schedule or manually
 */

const { createClient } = require('@libsql/client');
const puppeteer = require('puppeteer');

// Database connection
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// GolfNow facility IDs for Bay Area courses
// Format: course_slug -> golfnow_facility_id
// IDs verified from golfnow.com/tee-times/facility/{id}/search URLs
const GOLFNOW_IDS = {
  // San Francisco
  'tpc-harding-park': '8276',
  'lincoln-park-golf-course': '9723',
  'sharp-park-golf-course': '9722',
  'presidio-golf-course': '148',
  'golden-gate-park-golf-course': '9721',  // SF muni

  // East Bay - Oakland/Berkeley
  'metropolitan-golf-links': '161',
  'tilden-park-golf-course': '306',
  'redwood-canyon-golf-course': '3796',

  // East Bay - Tri-Valley/Concord
  'boundary-oak-golf-course': '1845',
  'diablo-creek-golf-course': '1448',
  'san-ramon-golf-club': '241',
  'las-positas-golf-course': '1457',
  'callippe-preserve-golf-course': '1432',
  'poppy-ridge-golf-course': '106',

  // East Bay - Alameda
  'corica-park-south-course': '9717',
  'corica-park-north-course': '9717', // Same facility

  // North Bay - Marin
  'peacock-gap-golf-club': '218',
  'indian-valley-golf-club': '1431',
  'stonetree-golf-club': '290',
  'mill-valley-golf-course': '166',
  'mcinnis-park-golf-center': '1459',

  // Peninsula
  'crystal-springs-golf-course': '1398',
  'half-moon-bay-old-course': '175',
  'half-moon-bay-ocean-course': '14024',
  'palo-alto-golf-course': '9719',

  // South Bay
  'deep-cliff-golf-course': '929',
  'cinnabar-hills-golf-club': '3821',
  'santa-teresa-golf-club': '9720',
  'san-jose-municipal-golf-course': '9718'
};

// Get Pacific date string for a given offset
function getPacificDate(dayOffset = 0) {
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  pst.setDate(pst.getDate() + dayOffset);
  const year = pst.getFullYear();
  const month = String(pst.getMonth() + 1).padStart(2, '0');
  const day = String(pst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Scrape a single GolfNow facility
async function scrapeGolfNowFacility(page, facilityId, date) {
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).replace(',', '');

  const url = `https://www.golfnow.com/tee-times/facility/${facilityId}/search#date=${encodeURIComponent(dateStr)}&sortby=Date&view=List&holes=3`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for tee times to load
    await page.waitForFunction(
      () => document.body.innerText.includes('AM') ||
            document.body.innerText.includes('PM') ||
            document.body.innerText.includes('no tee times'),
      { timeout: 15000 }
    ).catch(() => {});

    // Additional wait for dynamic content
    await new Promise(r => setTimeout(r, 2000));

    // Extract tee time data
    const teeTimes = await page.evaluate((dateArg) => {
      const results = [];

      // Find elements with data-players attribute (these are tee time cards)
      document.querySelectorAll('[data-players]').forEach(el => {
        const text = el.innerText || '';

        // Extract time (e.g., "7:30AM" or "7:30 AM")
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (!timeMatch) return;

        // Extract price - GolfNow uses cents format (e.g., $15348 = $153.48)
        const allPrices = text.match(/\$(\d+)/g) || [];
        let price = null;
        for (const p of allPrices) {
          const val = parseInt(p.replace('$', ''));
          if (val > 500 && val < 50000) {
            price = Math.round(val / 100);
            break;
          } else if (val >= 30 && val <= 500) {
            price = val;
            break;
          }
        }

        // Extract players from data attribute
        const players = parseInt(el.dataset.players) || 4;

        // Extract holes info
        const holesMatch = text.match(/(\d+)\s*\/\s*\d+-\d+/);
        const holes = holesMatch ? parseInt(holesMatch[1]) : 18;

        // Check for cart included
        const hasCart = text.toLowerCase().includes('cart') && !text.toLowerCase().includes('no cart');

        // Get booking URL
        const link = el.querySelector('a')?.href || el.closest('a')?.href;

        results.push({
          time: timeMatch[1].replace(/\s+/g, ''),
          price,
          players,
          holes,
          has_cart: hasCart ? 1 : 0,
          booking_url: link,
          date: dateArg
        });
      });

      return results;
    }, date.toISOString().split('T')[0]);

    // Dedupe by time+price
    const unique = [];
    const seen = new Set();
    for (const tt of teeTimes) {
      const key = `${tt.time}-${tt.price}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(tt);
      }
    }

    return unique;
  } catch (error) {
    console.error(`Error scraping facility ${facilityId}:`, error.message);
    return [];
  }
}

// Convert time string to 24-hour format
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

// Main scraping function
async function scrapeAndUpdate() {
  console.log('Starting GolfNow scraper...');
  console.log(`Database URL: ${process.env.TURSO_DATABASE_URL ? 'Set' : 'NOT SET'}`);
  console.log(`Current date: ${new Date().toISOString()}`);

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Database credentials not set');
  }

  // Get courses from database
  const coursesResult = await db.execute('SELECT id, slug, name, booking_url FROM courses');
  const courses = coursesResult.rows;
  console.log(`Found ${courses.length} courses in database`);

  // Create course lookup by slug
  const coursesBySlug = {};
  for (const course of courses) {
    coursesBySlug[course.slug] = course;
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    // Scrape each course with a GolfNow ID
    for (const [slug, facilityId] of Object.entries(GOLFNOW_IDS)) {
      const course = coursesBySlug[slug];
      if (!course) {
        console.log(`Course not found for slug: ${slug}`);
        continue;
      }

      console.log(`\nScraping ${course.name}...`);

      // Scrape next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);

        const teeTimes = await scrapeGolfNowFacility(page, facilityId, date);

        if (teeTimes.length > 0) {
          const dateStr = getPacificDate(dayOffset);

          // Delete existing tee times for this course/date
          await db.execute({
            sql: 'DELETE FROM tee_times WHERE course_id = ? AND date = ?',
            args: [course.id, dateStr]
          });

          // Insert new tee times
          for (const tt of teeTimes) {
            const time24 = convertTo24Hour(tt.time);
            if (!time24) continue;

            const datetime = `${dateStr} ${time24}`;

            try {
              await db.execute({
                sql: `INSERT OR IGNORE INTO tee_times (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                  course.id,
                  dateStr,
                  time24,
                  datetime,
                  tt.holes,
                  tt.players,
                  tt.price,
                  tt.has_cart,
                  tt.booking_url || course.booking_url,
                  'golfnow'
                ]
              });
              totalTeeTimes++;
            } catch (e) {
              // Ignore duplicate errors
            }
          }

          console.log(`  ${dateStr}: ${teeTimes.length} tee times`);
        }

        // Small delay between dates
        await new Promise(r => setTimeout(r, 500));
      }

      coursesScraped++;

      // Longer delay between courses to be respectful
      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    await browser.close();
  }

  console.log(`\n=== Scrape Complete ===`);
  console.log(`Courses scraped: ${coursesScraped}`);
  console.log(`Total tee times: ${totalTeeTimes}`);
}

// Run
scrapeAndUpdate()
  .then(() => {
    console.log('Scraper finished successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Scraper failed:', err);
    process.exit(1);
  });
