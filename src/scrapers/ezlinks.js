/**
 * EZLinks Scraper
 * Scrapes tee times from EZLinks Golf booking sites
 * Used by: Half Moon Bay Golf Links (Ocean & Old courses)
 */

const puppeteer = require('puppeteer');

// EZLinks courses configuration
const EZLINKS_COURSES = {
  'half-moon-bay-ocean-course': {
    url: 'https://halfmoonbay.ezlinksgolf.com/',
    name: 'Half Moon Bay - Ocean Course',
    courseFilter: 'ocean'
  },
  'half-moon-bay-old-course': {
    url: 'https://halfmoonbay.ezlinksgolf.com/',
    name: 'Half Moon Bay - Old Course',
    courseFilter: 'old'
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
 * Scrape tee times from EZLinks via Puppeteer
 */
async function scrapeEZLinks(page, config, date) {
  try {
    await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for page to load
    await new Promise(r => setTimeout(r, 4000));

    // Wait for tee time elements
    await page.waitForSelector('[class*="tee"], [class*="time"], .slot, .booking', { timeout: 20000 }).catch(() => {});

    // Try to select the date
    const [year, month, day] = date.split('-');
    try {
      await page.evaluate((y, m, d) => {
        // Look for date inputs
        const dateInputs = document.querySelectorAll('input[type="date"], input[name*="date"], [class*="date"] input');
        dateInputs.forEach(input => {
          input.value = `${y}-${m}-${d}`;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Look for calendar day buttons
        const dayNum = parseInt(d);
        document.querySelectorAll('.day, [class*="calendar"] button, td[data-day]').forEach(el => {
          if (el.textContent.trim() === String(dayNum)) {
            el.click();
          }
        });
      }, year, month, day);
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      // Date selection error
    }

    // If there's a course filter, try to apply it
    if (config.courseFilter) {
      try {
        await page.evaluate((filter) => {
          const selects = document.querySelectorAll('select, [class*="course"] select');
          selects.forEach(sel => {
            const options = sel.querySelectorAll('option');
            options.forEach(opt => {
              if (opt.textContent.toLowerCase().includes(filter)) {
                sel.value = opt.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });
          });

          // Also try radio buttons or tabs
          document.querySelectorAll('input[type="radio"], button, [role="tab"]').forEach(el => {
            if (el.textContent && el.textContent.toLowerCase().includes(filter)) {
              el.click();
            }
          });
        }, config.courseFilter);
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        // Course filter error
      }
    }

    // Extract tee times
    const teeTimes = await page.evaluate((dateStr, courseFilter) => {
      const results = [];

      // Find tee time elements
      document.querySelectorAll('[class*="tee-time"], [class*="slot"], .time-row, .booking-slot, tr').forEach(el => {
        const text = el.innerText || '';

        // Skip if course filter doesn't match
        if (courseFilter) {
          const textLower = text.toLowerCase();
          if (!textLower.includes(courseFilter) && !textLower.includes('all')) {
            // Check if this row has course info that doesn't match
            if (textLower.includes('ocean') || textLower.includes('old')) {
              if (!textLower.includes(courseFilter)) return;
            }
          }
        }

        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (!timeMatch) return;

        const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
        let price = priceMatch ? parseFloat(priceMatch[1]) : null;
        if (price) price = Math.round(price);

        const spotsMatch = text.match(/(\d+)\s*(?:spot|player|avail)/i);
        const players = spotsMatch ? parseInt(spotsMatch[1]) : 4;

        const holesMatch = text.match(/(\d+)\s*hole/i);
        const holes = holesMatch ? parseInt(holesMatch[1]) : 18;

        results.push({
          time: timeMatch[1].toUpperCase().replace(/\s+/g, ''),
          price,
          players,
          holes,
          has_cart: text.toLowerCase().includes('cart') ? 1 : 0,
          date: dateStr
        });
      });

      // Fallback: scan for times and prices in page
      if (results.length === 0) {
        const pageText = document.body.innerText || '';
        const times = pageText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/gi) || [];
        const prices = [];
        let match;
        const priceRe = /\$(\d+(?:\.\d{2})?)/g;
        while ((match = priceRe.exec(pageText)) !== null) {
          const val = parseFloat(match[1]);
          if (val >= 50 && val <= 500) prices.push(Math.round(val));
        }

        const avgPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null;

        times.slice(0, 15).forEach(time => {
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
    }, date, config.courseFilter);

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
    console.error(`Error scraping EZLinks ${config.name}:`, error.message);
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
 * Main function to scrape all EZLinks courses
 */
async function scrapeAllEZLinks(db, coursesBySlug) {
  console.log('\n--- EZLinks Scraper ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    for (const [slug, config] of Object.entries(EZLINKS_COURSES)) {
      const course = coursesBySlug[slug];
      if (!course) {
        console.log(`  Course not found for slug: ${slug}`);
        continue;
      }

      console.log(`\nScraping ${config.name} (EZLinks)...`);

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const dateStr = getPacificDate(dayOffset);

        const teeTimes = await scrapeEZLinks(page, config, dateStr);

        if (teeTimes.length > 0) {
          await db.execute({
            sql: 'DELETE FROM tee_times WHERE course_id = ? AND date = ? AND source = ?',
            args: [course.id, dateStr, 'ezlinks']
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
                  'ezlinks'
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

  console.log(`\nEZLinks: ${coursesScraped} courses, ${totalTeeTimes} tee times`);
  return { coursesScraped, totalTeeTimes };
}

module.exports = {
  EZLINKS_COURSES,
  scrapeEZLinks,
  scrapeAllEZLinks
};
