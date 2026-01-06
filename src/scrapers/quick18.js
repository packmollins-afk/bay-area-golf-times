/**
 * Quick18 Scraper
 * Scrapes tee times from Quick18/Sagacity Golf booking sites
 * Used by: Baylands Golf Links
 */

const puppeteer = require('puppeteer');

// Quick18 sites for Bay Area courses
const QUICK18_COURSES = {
  'baylands-golf-links': {
    url: 'https://baylandswalking.quick18.com/teetimes/searchmatrix',
    name: 'Baylands Golf Links'
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

// Format date for Quick18 URL (YYYYMMDD)
function formatDateForQuick18(dateStr) {
  return dateStr.replace(/-/g, '');
}

/**
 * Scrape tee times from a Quick18 site
 */
async function scrapeQuick18(page, siteUrl, date) {
  try {
    const dateParam = formatDateForQuick18(date);
    const url = `${siteUrl}?teedate=${dateParam}`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for tee times table to load
    await page.waitForSelector('.matrixTable, table, .tee-time', { timeout: 15000 }).catch(() => {});

    // Additional wait for dynamic content
    await new Promise(r => setTimeout(r, 3000));

    // Extract tee time data
    const teeTimes = await page.evaluate((dateStr) => {
      const results = [];

      // Find all table rows with tee time data
      const rows = document.querySelectorAll('table tr, .matrixTable tr');

      rows.forEach(row => {
        const text = row.innerText || '';

        // Skip header rows
        if (text.includes('Tee Time') && text.includes('Players')) return;
        if (text.includes('Public') && text.includes('Resident')) return;

        // Extract time (e.g., "7:30 AM" or "7:30AM")
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (!timeMatch) return;

        // Extract price - look for dollar amounts, prioritize first (public) price
        const priceMatches = text.match(/\$(\d+(?:\.\d{2})?)/g) || [];
        let price = null;
        for (const p of priceMatches) {
          const val = parseFloat(p.replace('$', ''));
          if (val >= 15 && val <= 500) {
            price = Math.round(val);
            break;
          }
        }

        // Check for cells with prices
        const cells = row.querySelectorAll('td');
        if (!price && cells.length > 1) {
          for (const cell of cells) {
            const cellText = cell.innerText || '';
            const cellPrice = cellText.match(/\$(\d+(?:\.\d{2})?)/);
            if (cellPrice) {
              const val = parseFloat(cellPrice[1]);
              if (val >= 15 && val <= 500) {
                price = Math.round(val);
                break;
              }
            }
          }
        }

        // Check for "Book" button/link to determine availability
        const bookButton = row.querySelector('a[href*="book"], button, input[type="submit"], .book-btn');
        if (!bookButton && !price) return; // Skip unavailable times

        // Get booking link if available
        const link = row.querySelector('a')?.href;

        results.push({
          time: timeMatch[1].replace(/\s+/g, ''),
          price,
          players: 4,
          holes: 18,
          has_cart: 0, // Baylands is walking only
          booking_url: link,
          date: dateStr
        });
      });

      // Alternative: look for specific tee time elements
      if (results.length === 0) {
        document.querySelectorAll('.tee-time, .teetime-row, [data-time]').forEach(el => {
          const text = el.innerText || '';
          const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          if (!timeMatch) return;

          const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
          const price = priceMatch ? Math.round(parseFloat(priceMatch[1])) : null;

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
 * Main function to scrape all Quick18 courses
 */
async function scrapeAllQuick18(db, coursesBySlug) {
  console.log('\n--- Quick18 Scraper ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    for (const [slug, siteInfo] of Object.entries(QUICK18_COURSES)) {
      const course = coursesBySlug[slug];
      if (!course) {
        console.log(`  Course not found for slug: ${slug}`);
        continue;
      }

      console.log(`\nScraping ${siteInfo.name} (Quick18)...`);

      // Scrape next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const dateStr = getPacificDate(dayOffset);

        const teeTimes = await scrapeQuick18(page, siteInfo.url, dateStr);

        if (teeTimes.length > 0) {
          // Delete existing tee times for this course/date/source
          await db.execute({
            sql: 'DELETE FROM tee_times WHERE course_id = ? AND date = ? AND source = ?',
            args: [course.id, dateStr, 'quick18']
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
                  'quick18'
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

  console.log(`\nQuick18: ${coursesScraped} courses, ${totalTeeTimes} tee times`);
  return { coursesScraped, totalTeeTimes };
}

module.exports = {
  QUICK18_COURSES,
  scrapeQuick18,
  scrapeAllQuick18
};
