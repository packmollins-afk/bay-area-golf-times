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
const GOLFNOW_IDS = {
  'tpc-harding-park': '8685',
  'lincoln-park-golf-course': '8632',
  'sharp-park-golf-course': '8663',
  'presidio-golf-course': '8655',
  'golden-gate-park-golf-course': '8616',
  'corica-park-south-course': '8589',
  'corica-park-north-course': '8589', // Same facility
  'metropolitan-golf-links': '8638',
  'tilden-park-golf-course': '8668',
  'boundary-oak-golf-course': '8580',
  'peacock-gap-golf-club': '8651',
  'indian-valley-golf-club': '8625',
  'stonetree-golf-club': '8665',
  'mill-valley-golf-course': '8640',
  'crystal-springs-golf-course': '8594',
  'half-moon-bay-old-course': '8619',
  'half-moon-bay-ocean-course': '8619',
  'diablo-creek-golf-course': '8596',
  'san-ramon-golf-club': '8661',
  'las-positas-golf-course': '8631',
  'callippe-preserve-golf-course': '8583',
  'mcinnis-park-golf-center': '8637',
  'redwood-canyon-golf-course': '8657',
  'palo-alto-golf-course': '8649',
  'deep-cliff-golf-course': '8595',
  'cinnabar-hills-golf-club': '8586',
  'santa-teresa-golf-club': '8662',
  'san-jose-municipal-golf-course': '8660',
  'poppy-ridge-golf-course': '8653'
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
