/**
 * Chronogolf Scraper
 * Scrapes tee times from Chronogolf booking sites
 * Used by: Half Moon Bay, Santa Teresa, Tilden Park, Redwood Canyon, Canyon Lakes, BayView Club, Blue Rock Springs
 */

const puppeteer = require('puppeteer');

// Chronogolf courses configuration
const CHRONOGOLF_COURSES = {
  'half-moon-bay-ocean-course': {
    url: 'https://www.chronogolf.com/club/half-moon-bay-golf-links',
    name: 'Half Moon Bay - Ocean Course',
    courseFilter: 'Ocean'
  },
  'half-moon-bay-old-course': {
    url: 'https://www.chronogolf.com/club/half-moon-bay-golf-links',
    name: 'Half Moon Bay - Old Course',
    courseFilter: 'Old'
  },
  'santa-teresa-golf-club': {
    url: 'https://www.chronogolf.com/club/santa-teresa-golf-club',
    name: 'Santa Teresa Golf Club'
  },
  'tilden-park-golf-course': {
    url: 'https://www.chronogolf.com/club/tilden-park-golf-course-california-berkeley',
    name: 'Tilden Park Golf Course'
  },
  'redwood-canyon-golf-course': {
    url: 'https://www.chronogolf.com/club/redwood-canyon-public-golf-course',
    name: 'Redwood Canyon Golf Course'
  },
  'canyon-lakes-golf-course': {
    url: 'https://www.chronogolf.com/club/canyon-lakes-golf-course-and-brewery',
    name: 'Canyon Lakes Golf Course'
  },
  'blue-rock-springs-golf-club': {
    url: 'https://www.chronogolf.com/club/blue-rock-springs-golf-club',
    name: 'Blue Rock Springs Golf Club'
  }
};

// Get Pacific date string
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
 * Convert time string to 24-hour format
 */
function convertTo24Hour(timeStr) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

/**
 * Scrape tee times from Chronogolf
 * Chronogolf uses URL parameter for date: ?date=YYYY-MM-DD
 */
async function scrapeChronogolf(page, config, dateStr) {
  try {
    // Navigate to the tee times page with date parameter
    const teeTimesUrl = `${config.url}/teetimes?date=${dateStr}`;
    console.log(`    Loading ${teeTimesUrl}...`);

    await page.goto(teeTimesUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for tee times to load
    await new Promise(r => setTimeout(r, 4000));

    // Extract tee times from page
    // Format: "7:30 am\nfrom\n$180\nOld Course\n1\n18\nIncluded"
    const teeTimes = await page.evaluate((courseFilter) => {
      const results = [];
      const text = document.body.innerText || '';
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match time like "7:30 am" or "7:30 AM"
        const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:am|pm))$/i);
        if (timeMatch) {
          // Look ahead for course name and price
          let courseName = null;
          let price = null;

          for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
            const nextLine = lines[j];

            // Check for course name
            if (nextLine.includes('Old Course')) {
              courseName = 'Old Course';
            } else if (nextLine.includes('Ocean Course')) {
              courseName = 'Ocean Course';
            } else if (!courseName && nextLine.match(/^[A-Z][a-z]+ Course$/)) {
              // Generic course name pattern
              courseName = nextLine;
            }

            // Check for price
            const priceMatch = nextLine.match(/\$(\d+)/);
            if (priceMatch) {
              const val = parseInt(priceMatch[1]);
              if (val >= 20 && val <= 500) {
                price = val;
              }
            }

            // If we have both, we're done
            if (courseName && price) break;
          }

          // If courseFilter specified, check if this matches
          if (courseFilter && courseName && !courseName.includes(courseFilter)) continue;

          // Only add if we found a course name (to avoid calendar numbers)
          if (courseName || price) {
            results.push({
              time: timeMatch[1].replace(/\s+/g, '').toUpperCase(),
              price: price,
              courseName: courseName,
              players: 4,
              holes: 18,
              has_cart: 1
            });
          }
        }
      }

      return results;
    }, config.courseFilter || null);

    // Return first tee time only (fast scraper approach)
    if (teeTimes.length > 0) {
      return [teeTimes[0]];
    }

    return [];
  } catch (error) {
    console.error(`    Error scraping ${config.name}:`, error.message);
    return [];
  }
}

/**
 * Main function to scrape all Chronogolf courses
 */
async function scrapeAllChronogolf(db, coursesBySlug) {
  console.log('\n--- Chronogolf Scraper ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  // Scrape tomorrow's date (today often has no times available)
  const dateStr = getPacificDate(1);

  try {
    for (const [slug, config] of Object.entries(CHRONOGOLF_COURSES)) {
      const course = coursesBySlug[slug];
      if (!course) {
        console.log(`  Skipping ${config.name} (not in DB)`);
        continue;
      }

      console.log(`  ${config.name}...`);

      const teeTimes = await scrapeChronogolf(page, config, dateStr);

      if (teeTimes.length > 0) {
        // Delete existing chronogolf data for this course
        await db.execute({
          sql: 'DELETE FROM tee_times WHERE course_id = ? AND source = ?',
          args: [course.id, 'chronogolf']
        });

        for (const tt of teeTimes) {
          const time24 = convertTo24Hour(tt.time);
          if (!time24) continue;

          const datetime = `${dateStr} ${time24}`;

          try {
            await db.execute({
              sql: `INSERT OR IGNORE INTO tee_times (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
              args: [
                course.id,
                dateStr,
                time24,
                datetime,
                tt.holes,
                tt.players,
                tt.price,
                tt.has_cart,
                config.url + '/teetimes',
                'chronogolf'
              ]
            });
            totalTeeTimes++;
            console.log(`    ✓ ${tt.time} - $${tt.price || '?'}`);
          } catch (e) {
            // Ignore errors
          }
        }
      } else {
        console.log(`    ✗ No tee times found`);
      }

      coursesScraped++;
      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    await browser.close();
  }

  console.log(`Chronogolf: ${coursesScraped} courses, ${totalTeeTimes} tee times`);
  return { coursesScraped, totalTeeTimes };
}

module.exports = {
  CHRONOGOLF_COURSES,
  scrapeChronogolf,
  scrapeAllChronogolf
};
