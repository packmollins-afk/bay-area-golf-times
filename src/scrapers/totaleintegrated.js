/**
 * TotaleIntegrated Scraper
 * Scrapes tee times from Bay Club / TotaleIntegrated booking sites
 * Used by: Boundary Oak, Callippe Preserve, Crystal Springs, Deep Cliff,
 *          Metropolitan Golf Links, Napa Golf Course, San Jose Municipal
 */

const puppeteer = require('puppeteer');

// TotaleIntegrated sites for Bay Area courses
const TOTALE_COURSES = {
  'boundary-oak-golf-course': {
    url: 'https://playboundaryoak.totaleintegrated.com/',
    name: 'Boundary Oak Golf Course'
  },
  'callippe-preserve-golf-course': {
    url: 'https://playcallippe.totaleintegrated.com/',
    name: 'Callippe Preserve Golf Course'
  },
  'crystal-springs-golf-course': {
    url: 'https://playcrystalsprings.totaleintegrated.com/',
    name: 'Crystal Springs Golf Course'
  },
  'deep-cliff-golf-course': {
    url: 'https://playdeepcliff.totaleintegrated.com/',
    name: 'Deep Cliff Golf Course'
  },
  'metropolitan-golf-links': {
    url: 'https://playmetro.totaleintegrated.com/',
    name: 'Metropolitan Golf Links'
  },
  'napa-golf-course-at-kennedy-park': {
    url: 'https://playnapa.totaleintegrated.com/',
    name: 'Napa Golf Course at Kennedy Park'
  },
  'san-jose-municipal-golf-course': {
    url: 'https://playsanjosemuni.totaleintegrated.com/',
    name: 'San Jose Municipal Golf Course'
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

// Format date for TotaleIntegrated calendar (MM/DD/YYYY)
function formatDateForTotale(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

/**
 * Scrape tee times from a TotaleIntegrated site
 */
async function scrapeTotaleIntegrated(page, siteUrl, date) {
  try {
    // Navigate to the site
    await page.goto(siteUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for tee times to load
    await page.waitForSelector('[id*="dlTeeTimes"]', { timeout: 15000 }).catch(() => {});

    // Additional wait for dynamic content
    await new Promise(r => setTimeout(r, 3000));

    // Try to set the date if there's a date picker
    const formattedDate = formatDateForTotale(date);
    try {
      await page.evaluate((targetDate) => {
        // Look for date input and try to set it
        const dateInputs = document.querySelectorAll('input[type="text"][id*="Date"], input[id*="Calendar"]');
        dateInputs.forEach(input => {
          if (input.value) {
            input.value = targetDate;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }, formattedDate);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      // Date picker might not exist or work differently
    }

    // Extract tee time data
    const teeTimes = await page.evaluate((dateStr) => {
      const results = [];

      // Find all tee time items - they're usually in a DataList or repeating elements
      const teeTimeElements = document.querySelectorAll('[id*="dlTeeTimes"] > div, [class*="tee-time"], [class*="teetime"], .tt-item');

      teeTimeElements.forEach(el => {
        const text = el.innerText || '';

        // Extract time (e.g., "7:30 AM" or "7:30AM")
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (!timeMatch) return;

        // Extract price - look for dollar amounts
        const priceMatches = text.match(/\$(\d+(?:\.\d{2})?)/g) || [];
        let price = null;
        for (const p of priceMatches) {
          const val = parseFloat(p.replace('$', ''));
          if (val >= 15 && val <= 500) {
            price = Math.round(val);
            break;
          }
        }

        // Check for hidden fields with price data
        const hiddenPrice = el.querySelector('[id*="hdnTotalPrice"], [id*="hdnPP18"]');
        if (hiddenPrice && hiddenPrice.value) {
          const hiddenVal = parseFloat(hiddenPrice.value);
          if (hiddenVal > 0 && hiddenVal < 500) {
            price = Math.round(hiddenVal);
          }
        }

        // Extract players available
        const playersMatch = text.match(/(\d)\s*(?:player|spot|opening)/i);
        const players = playersMatch ? parseInt(playersMatch[1]) : 4;

        // Check for holes info
        const holesMatch = text.match(/(\d+)\s*hole/i);
        const holes = holesMatch ? parseInt(holesMatch[1]) : 18;

        // Check for cart included
        const hasCart = text.toLowerCase().includes('cart included') ||
                       text.toLowerCase().includes('w/ cart') ||
                       text.toLowerCase().includes('with cart');

        // Get booking link if available
        const link = el.querySelector('a[href*="book"], a[href*="reserve"]')?.href;

        results.push({
          time: timeMatch[1].replace(/\s+/g, ''),
          price,
          players,
          holes,
          has_cart: hasCart ? 1 : 0,
          booking_url: link,
          date: dateStr
        });
      });

      // Also try alternative selector pattern
      if (results.length === 0) {
        document.querySelectorAll('.tee-time-row, .booking-slot, [data-teetime]').forEach(el => {
          const text = el.innerText || '';
          const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          if (!timeMatch) return;

          const priceMatch = text.match(/\$(\d+)/);
          const price = priceMatch ? parseInt(priceMatch[1]) : null;

          results.push({
            time: timeMatch[1].replace(/\s+/g, ''),
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

    // Dedupe by time
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
    console.error(`Error scraping ${siteUrl}:`, error.message);
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
 * Main function to scrape all TotaleIntegrated courses
 */
async function scrapeAllTotaleIntegrated(db, coursesBySlug) {
  console.log('\n--- TotaleIntegrated Scraper ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    for (const [slug, siteInfo] of Object.entries(TOTALE_COURSES)) {
      const course = coursesBySlug[slug];
      if (!course) {
        console.log(`  Course not found for slug: ${slug}`);
        continue;
      }

      console.log(`\nScraping ${siteInfo.name} (TotaleIntegrated)...`);

      // Scrape next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const dateStr = getPacificDate(dayOffset);

        const teeTimes = await scrapeTotaleIntegrated(page, siteInfo.url, dateStr);

        if (teeTimes.length > 0) {
          // Delete existing tee times for this course/date
          await db.execute({
            sql: 'DELETE FROM tee_times WHERE course_id = ? AND date = ? AND source = ?',
            args: [course.id, dateStr, 'totaleintegrated']
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
                  tt.booking_url || siteInfo.url,
                  'totaleintegrated'
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

      // Longer delay between courses
      await new Promise(r => setTimeout(r, 3000));
    }
  } finally {
    await browser.close();
  }

  console.log(`\nTotaleIntegrated: ${coursesScraped} courses, ${totalTeeTimes} tee times`);
  return { coursesScraped, totalTeeTimes };
}

module.exports = {
  TOTALE_COURSES,
  scrapeTotaleIntegrated,
  scrapeAllTotaleIntegrated
};
