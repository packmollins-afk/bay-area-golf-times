const puppeteer = require('puppeteer');

/**
 * Scrape tee times from GolfNow using Puppeteer
 * Extracts real player availability data
 */

async function scrapeGolfNowFacility(facilityId, date, options = {}) {
  const { headless = true, timeout = 30000 } = options;

  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Format date for GolfNow URL
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).replace(',', '');

    const url = `https://www.golfnow.com/tee-times/facility/${facilityId}/search#date=${encodeURIComponent(dateStr)}&sortby=Date&view=List&holes=3`;

    console.log(`Scraping: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    // Wait for tee times to load
    await page.waitForFunction(
      () => document.body.innerText.includes('AM') || document.body.innerText.includes('PM') || document.body.innerText.includes('no tee times'),
      { timeout: 15000 }
    ).catch(() => {});

    // Additional wait for dynamic content
    await new Promise(r => setTimeout(r, 2000));

    // Extract tee time data
    const teeTimes = await page.evaluate((dateArg) => {
      const results = [];

      // Find tee time elements - look for rate links and result sections
      document.querySelectorAll('.select-rate-link, section.result, .teetime-row').forEach(el => {
        const text = el.innerText || '';

        // Extract time (e.g., "7:30AM" or "7:30 AM")
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (!timeMatch) return;

        // Extract price - GolfNow uses cents format (e.g., $15348 = $153.48)
        const allPrices = text.match(/\$(\d+)/g) || [];
        let price = null;
        for (const p of allPrices) {
          const val = parseInt(p.replace('$', ''));
          // Prices in cents are typically 5 digits (e.g., 15348 = $153)
          if (val > 500 && val < 50000) {
            price = Math.round(val / 100);
            break;
          } else if (val >= 30 && val <= 500) {
            // Already in dollars
            price = val;
            break;
          }
        }

        // Extract players - check self and parent elements
        let players = el.dataset?.players;
        let parent = el.parentElement;
        while (!players && parent) {
          players = parent.dataset?.players;
          parent = parent.parentElement;
        }
        players = parseInt(players) || 4;

        // Extract holes info (e.g., "18 / 2-4" means 18 holes)
        const holesMatch = text.match(/(\d+)\s*\/\s*\d+-\d+/);
        const holes = holesMatch ? parseInt(holesMatch[1]) : 18;

        // Check for cart included
        const hasCart = text.toLowerCase().includes('cart') && !text.toLowerCase().includes('no cart');

        // Get booking URL if available
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

    // Remove duplicates (same time/price)
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
  } finally {
    await browser.close();
  }
}

/**
 * Scrape multiple facilities for a date range
 */
async function scrapeMultipleFacilities(facilities, daysAhead = 7) {
  const allTeeTimes = [];

  // Create browser instance to reuse
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    for (const facility of facilities) {
      if (!facility.golfnow_id) continue;

      for (let d = 0; d < daysAhead; d++) {
        const date = new Date();
        date.setDate(date.getDate() + d);

        try {
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short', day: '2-digit', year: 'numeric'
          }).replace(',', '');

          const url = `https://www.golfnow.com/tee-times/facility/${facility.golfnow_id}/search#date=${encodeURIComponent(dateStr)}&sortby=Date&view=List&holes=3`;

          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

          await page.waitForFunction(
            () => document.body.innerText.includes('AM') || document.body.innerText.includes('PM') || document.body.innerText.includes('no tee times'),
            { timeout: 10000 }
          ).catch(() => {});

          await new Promise(r => setTimeout(r, 1500));

          const teeTimes = await page.evaluate((dateArg) => {
            const results = [];
            document.querySelectorAll('[data-players]').forEach(el => {
              const text = el.innerText || '';
              const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
              if (!timeMatch) return;

              const priceMatch = text.match(/\$(\d+)/);
              let price = priceMatch ? parseInt(priceMatch[1]) : null;
              if (price && price > 1000) price = Math.round(price / 100);

              const players = parseInt(el.dataset.players) || 4;
              const holesMatch = text.match(/(\d+)\s*\/\s*\d+-\d+/);
              const holes = holesMatch ? parseInt(holesMatch[1]) : 18;
              const hasCart = text.toLowerCase().includes('cart') && !text.toLowerCase().includes('no cart');
              const link = el.querySelector('a')?.href || el.closest('a')?.href;

              results.push({
                time: timeMatch[1].replace(/\s+/g, ''),
                price, players, holes,
                has_cart: hasCart ? 1 : 0,
                booking_url: link,
                date: dateArg
              });
            });
            return results;
          }, date.toISOString().split('T')[0]);

          // Add facility info and dedupe
          const seen = new Set();
          for (const tt of teeTimes) {
            const key = `${tt.time}-${tt.price}`;
            if (!seen.has(key)) {
              seen.add(key);
              allTeeTimes.push({
                ...tt,
                course_id: facility.id,
                course_name: facility.name,
                source: 'golfnow'
              });
            }
          }

          console.log(`${facility.name} ${date.toISOString().split('T')[0]}: ${teeTimes.length} tee times`);

          // Small delay between requests
          await new Promise(r => setTimeout(r, 500));

        } catch (err) {
          console.error(`Error scraping ${facility.name}:`, err.message);
        }
      }
    }
  } finally {
    await browser.close();
  }

  return allTeeTimes;
}

module.exports = {
  scrapeGolfNowFacility,
  scrapeMultipleFacilities
};
