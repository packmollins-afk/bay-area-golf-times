/**
 * CPS.Golf Scraper (Club Prophet Systems)
 * Scrapes tee times from CPS.Golf booking sites
 * Used by: Presidio Golf Course, Diablo Creek Golf Course
 */

const puppeteer = require('puppeteer');

// CPS.Golf courses configuration
const CPS_COURSES = {
  'presidio-golf-course': {
    url: 'https://presidio.cps.golf/',
    name: 'Presidio Golf Course',
    requiresLogin: true
  },
  'diablo-creek-golf-course': {
    url: 'https://diablocreek.cps.golf/',
    name: 'Diablo Creek Golf Course'
  },
  'northwood-golf-club': {
    url: 'https://www.northwoodgolf.com/bookteetimes',
    name: 'Northwood Golf Club'
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
 * Scrape tee times from CPS.Golf via Puppeteer
 * CPS.Golf shows tee times in format: "12:56\nP\nM\n...Golf Course\n9 or 18 HOLES...\n$27.00"
 */
async function scrapeCPSGolf(page, config, date) {
  try {
    await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for the app to load
    await new Promise(r => setTimeout(r, 4000));

    // Extract tee time data by parsing the page text
    const teeTimes = await page.evaluate((dateStr) => {
      const results = [];
      const pageText = document.body.innerText || '';
      const lines = pageText.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Match time like "12:56" or "1:04" (without AM/PM - CPS uses P\nM format)
        const timeMatch = line.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          // Next line should be AM/PM indicator (P or A for PM/AM)
          const ampm = lines[i + 1]?.trim();
          if (ampm === 'P' || ampm === 'A') {
            const period = ampm === 'P' ? 'PM' : 'AM';
            const time = timeMatch[0] + period;

            // Look for price in nearby lines (usually within next 5-6 lines)
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
                date: dateStr
              });
            }
          }
        }
      }

      return results;
    }, date);

    // Dedupe
    const unique = [];
    const seen = new Set();
    for (const tt of teeTimes) {
      const key = tt.time;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(tt);
      }
    }

    return unique;
  } catch (error) {
    console.error(`Error scraping CPS.Golf ${config.name}:`, error.message);
    return [];
  }
}

/**
 * Convert time string to 24-hour format
 */
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
 * Main function to scrape all CPS.Golf courses
 */
async function scrapeAllCPSGolf(db, coursesBySlug) {
  console.log('\n--- CPS.Golf Scraper ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    for (const [slug, config] of Object.entries(CPS_COURSES)) {
      // Skip courses that require login for now
      if (config.requiresLogin) {
        console.log(`Skipping ${config.name} (requires login)`);
        continue;
      }

      const course = coursesBySlug[slug];
      if (!course) {
        console.log(`  Course not found for slug: ${slug}`);
        continue;
      }

      console.log(`\nScraping ${config.name} (CPS.Golf)...`);

      // Scrape next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const dateStr = getPacificDate(dayOffset);

        const teeTimes = await scrapeCPSGolf(page, config, dateStr);

        if (teeTimes.length > 0) {
          await db.execute({
            sql: 'DELETE FROM tee_times WHERE course_id = ? AND date = ? AND source = ?',
            args: [course.id, dateStr, 'cpsgolf']
          });

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
                  config.url,
                  'cpsgolf'
                ]
              });
              totalTeeTimes++;
            } catch (e) {
              // Ignore errors
            }
          }

          console.log(`  ${dateStr}: ${teeTimes.length} tee times`);
        }

        await new Promise(r => setTimeout(r, 1500));
      }

      coursesScraped++;
      await new Promise(r => setTimeout(r, 3000));
    }
  } finally {
    await browser.close();
  }

  console.log(`\nCPS.Golf: ${coursesScraped} courses, ${totalTeeTimes} tee times`);
  return { coursesScraped, totalTeeTimes };
}

module.exports = {
  CPS_COURSES,
  scrapeCPSGolf,
  scrapeAllCPSGolf
};
