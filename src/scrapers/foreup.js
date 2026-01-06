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
  const foreupDate = formatDateForForeUp(date);

  try {
    // Construct URL with date parameter
    const url = `${config.url}#date=${foreupDate}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for tee times to load
    await page.waitForSelector('.booking-start-time, .time-block, [class*="tee-time"]', { timeout: 15000 }).catch(() => {});

    // Additional wait for JavaScript rendering
    await new Promise(r => setTimeout(r, 3000));

    // Try clicking on the date to refresh
    try {
      await page.evaluate((dateStr) => {
        // Look for date input/selector
        const dateInputs = document.querySelectorAll('input[type="date"], input[name*="date"], .date-picker input');
        dateInputs.forEach(input => {
          if (input) {
            input.value = dateStr;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }, foreupDate);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      // Date selection may work differently
    }

    // Extract tee time data
    const teeTimes = await page.evaluate((dateStr) => {
      const results = [];

      // ForeUp tee time elements
      const timeElements = document.querySelectorAll('.booking-start-time, .time-block, .tee-time-slot, [data-time]');

      timeElements.forEach(el => {
        const text = el.innerText || el.textContent || '';

        // Extract time
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
        if (!timeMatch) return;

        // Extract price
        const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
        let price = priceMatch ? parseFloat(priceMatch[1]) : null;
        if (price) price = Math.round(price);

        // Extract available spots
        const spotsMatch = text.match(/(\d+)\s*(?:spot|player|opening|available)/i);
        const players = spotsMatch ? parseInt(spotsMatch[1]) : 4;

        // Extract holes
        const holesMatch = text.match(/(\d+)\s*hole/i);
        const holes = holesMatch ? parseInt(holesMatch[1]) : 18;

        // Check for cart
        const hasCart = text.toLowerCase().includes('cart');

        // Get booking link
        const link = el.querySelector('a')?.href || el.closest('a')?.href;

        results.push({
          time: timeMatch[1].toUpperCase().replace(/\s+/g, ''),
          price,
          players,
          holes,
          has_cart: hasCart ? 1 : 0,
          booking_url: link,
          date: dateStr
        });
      });

      // Alternative: look for the main tee time list structure
      if (results.length === 0) {
        document.querySelectorAll('.times-container .time, .availability-row, [class*="booking"]').forEach(el => {
          const text = el.innerText || '';
          const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          if (!timeMatch) return;

          const priceMatch = text.match(/\$(\d+)/);
          const price = priceMatch ? parseInt(priceMatch[1]) : null;

          results.push({
            time: timeMatch[1].toUpperCase().replace(/\s+/g, ''),
            price,
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
