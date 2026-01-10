/**
 * Targeted scraper for newly added GolfNow courses
 * Visits each facility page directly to extract tee times
 */
require('dotenv').config({ path: '.env.local' });
const puppeteer = require('puppeteer');
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function scrapeFacilityTeeTimes(browser, courseId, golfnowId, courseName) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const teeTimes = [];

  try {
    const url = `https://www.golfnow.com/tee-times/facility/${golfnowId}/search`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to load more
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));

    // Extract tee times from the page
    const data = await page.evaluate(() => {
      const results = [];
      const text = document.body.innerText;

      // Find time patterns like "7:30 AM" or "10:00 PM"
      const timeRegex = /(\d{1,2}:\d{2})\s*(AM|PM)/gi;
      const times = new Set();
      let match;
      while ((match = timeRegex.exec(text)) !== null) {
        times.add(match[1] + ' ' + match[2].toUpperCase());
      }

      // Find prices
      const priceRegex = /\$(\d+)/g;
      const prices = [];
      while ((match = priceRegex.exec(text)) !== null) {
        prices.push(parseInt(match[1]));
      }

      return {
        times: Array.from(times).slice(0, 15),
        prices: prices.slice(0, 10),
        hasData: times.size > 0 && prices.length > 0
      };
    });

    if (data.hasData) {
      const today = new Date().toISOString().split('T')[0];
      // Get min price (filter out very small/large numbers)
      const validPrices = data.prices.filter(p => p >= 10 && p <= 500);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : data.prices[0];

      for (const timeStr of data.times) {
        // Convert to 24-hour
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) continue;

        let hours = parseInt(match[1]);
        const minutes = match[2];
        const period = match[3].toUpperCase();

        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        const time24 = hours.toString().padStart(2, '0') + ':' + minutes;

        teeTimes.push({
          courseId,
          date: today,
          time: time24,
          price: minPrice,
          golfnowId
        });
      }
    }

  } catch (e) {
    console.log(`  Error scraping ${courseName}: ${e.message}`);
  }

  await page.close();
  return teeTimes;
}

async function main() {
  console.log('=== TARGETED SCRAPE FOR NEW GOLFNOW COURSES ===\n');

  // Get our new courses
  const courses = await db.execute(
    "SELECT id, name, golfnow_id FROM courses WHERE golfnow_id IN ('6012', '1490', '160', '17999', '15719', '98', '1906')"
  );

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let totalInserted = 0;

  for (const course of courses.rows) {
    console.log(`Scraping: ${course.name} (ID ${course.golfnow_id})`);

    const teeTimes = await scrapeFacilityTeeTimes(
      browser,
      course.id,
      course.golfnow_id,
      course.name
    );

    if (teeTimes.length > 0) {
      console.log(`  Found ${teeTimes.length} tee times`);

      // Insert tee times
      for (const tt of teeTimes) {
        try {
          await db.execute({
            sql: `INSERT OR REPLACE INTO tee_times
                  (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            args: [
              tt.courseId,
              tt.date,
              tt.time,
              `${tt.date} ${tt.time}`,
              18,
              4,
              tt.price,
              0,
              `https://www.golfnow.com/tee-times/facility/${tt.golfnowId}/search`,
              'golfnow'
            ]
          });
          totalInserted++;
        } catch (e) {
          // Ignore duplicates
        }
      }
    } else {
      console.log('  No tee times found');
    }
  }

  await browser.close();

  console.log('\n=== COMPLETE ===');
  console.log(`Total tee times inserted: ${totalInserted}`);

  // Verify
  const verify = await db.execute(
    "SELECT c.name, COUNT(t.id) as count FROM courses c LEFT JOIN tee_times t ON c.id = t.course_id WHERE c.golfnow_id IN ('6012', '1490', '160', '17999', '15719', '98', '1906') GROUP BY c.id"
  );
  console.log('\nVerification:');
  verify.rows.forEach(r => console.log(`  ${r.name}: ${r.count} tee times`));
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
