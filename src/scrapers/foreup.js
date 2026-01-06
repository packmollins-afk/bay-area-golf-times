/**
 * ForeUp Scraper
 * Scrapes tee times from ForeUp booking system
 * Used by: Corica Park (North, South, Mif Par-3)
 */

const puppeteer = require('puppeteer');

// ForeUp courses configuration
const FOREUP_COURSES = {
  'corica-park-south-course': {
    url: 'https://foreupsoftware.com/index.php/booking/22822/12057',
    courseId: 22822,
    scheduleId: 12057,
    name: 'Corica Park - South Course'
  },
  'corica-park-north-course': {
    url: 'https://foreupsoftware.com/index.php/booking/22822/12056',
    courseId: 22822,
    scheduleId: 12056,
    name: 'Corica Park - North Course'
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

// Format date for ForeUp API (MM-DD-YYYY)
function formatDateForForeUp(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${month}-${day}-${year}`;
}

/**
 * Scrape tee times from ForeUp via Puppeteer
 */
async function scrapeForeUp(page, config, date) {
  try {
    // Navigate to the booking page
    const url = config.url;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    // Click on "Public Rates" or similar schedule selector to load tee times
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, [onclick], div[class*="schedule"], span'));
      for (const link of links) {
        const text = (link.innerText || '').toLowerCase();
        if (text.includes('public rate') || text.includes('0 - 7 days')) {
          link.click();
          return true;
        }
      }
      // Try clicking the first schedule option
      const scheduleLinks = document.querySelectorAll('[class*="schedule"], [class*="booking-class"]');
      if (scheduleLinks.length > 0) {
        scheduleLinks[0].click();
        return true;
      }
      return false;
    });

    await new Promise(r => setTimeout(r, 4000));

    // Now try to navigate to the specific date if needed
    const [year, month, day] = date.split('-');
    const targetDay = parseInt(day);

    // Click on the target date if available
    await page.evaluate((targetDay, dateStr) => {
      // Look for date navigation
      const dateLinks = Array.from(document.querySelectorAll('a, button, div, span'));
      for (const link of dateLinks) {
        const text = link.innerText || '';
        // Match date patterns like "Jan 7th" or just the day number
        if (text.includes(targetDay + 'th') || text.includes(targetDay + 'st') ||
            text.includes(targetDay + 'nd') || text.includes(targetDay + 'rd')) {
          link.click();
          return true;
        }
      }
      return false;
    }, targetDay, date);

    await new Promise(r => setTimeout(r, 3000));

    // Extract tee time data from the page text
    const teeTimes = await page.evaluate((dateStr) => {
      const results = [];
      const pageText = document.body.innerText || '';

      // ForeUp displays times like: "12:55pm\nFRONT\n 9 or 18  2\n $55.00"
      // Split by lines and parse
      const lines = pageText.split('\n');
      let currentTime = null;
      let currentPrice = null;
      let currentPlayers = 4;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for time pattern (e.g., "12:55pm" or "1:05pm")
        const timeMatch = line.match(/^(\d{1,2}:\d{2}(?:am|pm))$/i);
        if (timeMatch) {
          // If we have a previous time with data, save it
          if (currentTime && currentPrice) {
            results.push({
              time: currentTime.toUpperCase(),
              price: currentPrice,
              players: currentPlayers,
              holes: 18,
              has_cart: 0,
              date: dateStr
            });
          }
          currentTime = timeMatch[1];
          currentPrice = null;
          currentPlayers = 4;
          continue;
        }

        // Check for price pattern (e.g., "$55.00" or "$45.00")
        const priceMatch = line.match(/\$(\d+)(?:\.\d{2})?/);
        if (priceMatch && currentTime) {
          currentPrice = parseInt(priceMatch[1]);
        }

        // Check for player count (e.g., "9 or 18  2" means 2 spots available)
        const playersMatch = line.match(/9 or 18\s+(\d+)/);
        if (playersMatch && currentTime) {
          currentPlayers = parseInt(playersMatch[1]);
        }
      }

      // Don't forget the last time
      if (currentTime && currentPrice) {
        results.push({
          time: currentTime.toUpperCase(),
          price: currentPrice,
          players: currentPlayers,
          holes: 18,
          has_cart: 0,
          date: dateStr
        });
      }

      return results;
    }, date);

    // Dedupe
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
    console.error(`Error scraping ForeUp ${config.name}:`, error.message);
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
 * Main function to scrape all ForeUp courses
 */
async function scrapeAllForeUp(db, coursesBySlug) {
  console.log('\n--- ForeUp Scraper ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    for (const [slug, config] of Object.entries(FOREUP_COURSES)) {
      const course = coursesBySlug[slug];
      if (!course) {
        console.log(`  Course not found for slug: ${slug}`);
        continue;
      }

      console.log(`\nScraping ${config.name} (ForeUp)...`);

      // Scrape next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const dateStr = getPacificDate(dayOffset);

        const teeTimes = await scrapeForeUp(page, config, dateStr);

        if (teeTimes.length > 0) {
          // Delete existing tee times for this course/date/source
          await db.execute({
            sql: 'DELETE FROM tee_times WHERE course_id = ? AND date = ? AND source = ?',
            args: [course.id, dateStr, 'foreup']
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
                  tt.booking_url || config.url,
                  'foreup'
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
        await new Promise(r => setTimeout(r, 1000));
      }

      coursesScraped++;

      // Delay between courses
      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    await browser.close();
  }

  console.log(`\nForeUp: ${coursesScraped} courses, ${totalTeeTimes} tee times`);
  return { coursesScraped, totalTeeTimes };
}

module.exports = {
  FOREUP_COURSES,
  scrapeForeUp,
  scrapeAllForeUp
};
