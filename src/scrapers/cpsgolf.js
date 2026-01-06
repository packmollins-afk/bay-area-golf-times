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
    name: 'Presidio Golf Course'
  },
  'diablo-creek-golf-course': {
    url: 'https://diablocreek.cps.golf/',
    name: 'Diablo Creek Golf Course'
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
 */
async function scrapeCPSGolf(page, config, date) {
  try {
    await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for the app to load
    await new Promise(r => setTimeout(r, 5000));

    // Wait for tee time elements
    await page.waitForSelector('[class*="tee"], [class*="time"], [class*="slot"], .mat-card', { timeout: 20000 }).catch(() => {});

    // Try to select the target date
    const [year, month, day] = date.split('-');
    try {
      await page.evaluate((targetDay, targetMonth) => {
        // Look for date picker or calendar
        const dayButtons = document.querySelectorAll('button, [role="button"], .day, [class*="calendar"]');
        dayButtons.forEach(btn => {
          if (btn.textContent.trim() === targetDay) {
            btn.click();
          }
        });
      }, day, month);
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      // Date selection might work differently
    }

    // Extract tee time data
    const teeTimes = await page.evaluate((dateStr) => {
      const results = [];
      const text = document.body.innerText || '';

      // Find all time patterns in the page
      const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/gi;
      const times = text.match(timePattern) || [];

      // Find all price patterns
      const pricePattern = /\$(\d+(?:\.\d{2})?)/g;
      const prices = [];
      let match;
      while ((match = pricePattern.exec(text)) !== null) {
        const val = parseFloat(match[1]);
        if (val >= 20 && val <= 400) {
          prices.push(Math.round(val));
        }
      }

      // Try to find structured tee time elements
      document.querySelectorAll('[class*="tee-time"], [class*="slot"], .mat-card, [class*="reservation"]').forEach(el => {
        const elText = el.innerText || '';
        const timeMatch = elText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (!timeMatch) return;

        const priceMatch = elText.match(/\$(\d+(?:\.\d{2})?)/);
        let price = priceMatch ? parseFloat(priceMatch[1]) : null;
        if (price) price = Math.round(price);

        const spotsMatch = elText.match(/(\d+)\s*(?:spot|player|available)/i);
        const players = spotsMatch ? parseInt(spotsMatch[1]) : 4;

        results.push({
          time: timeMatch[1].toUpperCase().replace(/\s+/g, ''),
          price,
          players,
          holes: 18,
          has_cart: elText.toLowerCase().includes('cart') ? 1 : 0,
          date: dateStr
        });
      });

      // Fallback: create tee times from found patterns
      if (results.length === 0 && times.length > 0) {
        const avgPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null;
        times.slice(0, 20).forEach(time => {
          results.push({
            time: time.toUpperCase().replace(/\s+/g, ''),
            price: avgPrice,
            players: 4,
            holes: 18,
            has_cart: 0,
            date: dateStr
          });
        });
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
