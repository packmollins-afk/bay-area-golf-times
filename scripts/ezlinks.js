/**
 * EZLinks Scraper
 *
 * Puppeteer-based scraper for EZLinks booking system.
 * Targets Baylands Golf Links.
 *
 * Note: EZLinks uses Cloudflare protection - currently returns 0 tee times.
 * Future: Consider puppeteer-extra-plugin-stealth or API approach.
 */

const puppeteer = require('puppeteer');

const EZLINKS_COURSES = {
  'baylands-golf-links': {
    url: 'https://baylandsbw.ezlinksgolf.com',
    name: 'Baylands Golf Links',
    holes: 18
  }
};

const CONFIG = {
  pageTimeout: 45000,
  postLoadWait: 3000
};

function getPacificDate(dayOffset = 0) {
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  pst.setDate(pst.getDate() + dayOffset);
  const year = pst.getFullYear();
  const month = String(pst.getMonth() + 1).padStart(2, '0');
  const day = String(pst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function convertTo24Hour(timeStr) {
  if (!timeStr) return null;
  const normalized = timeStr.trim().toUpperCase();
  const matchFull = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (matchFull) {
    let hours = parseInt(matchFull[1]);
    const minutes = matchFull[2];
    const period = matchFull[3];
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  return null;
}

async function scrapeAllOptimized(db, coursesBySlug, days = 7) {
  console.log(`[EZLinks] Starting scrape...`);
  const startTime = Date.now();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    const coursesToScrape = Object.entries(EZLINKS_COURSES)
      .filter(([slug]) => coursesBySlug[slug])
      .map(([slug, config]) => ({ slug, config, course: coursesBySlug[slug] }));

    if (coursesToScrape.length === 0) {
      console.log('[EZLinks] No EZLinks courses found in database');
      await browser.close().catch(() => {});
      return { coursesScraped: 0, totalTeeTimes: 0 };
    }

    for (const { slug, config, course } of coursesToScrape) {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.setViewport({ width: 1280, height: 800 });

      const allTeeTimes = [];

      try {
        for (let dayOffset = 0; dayOffset < days; dayOffset++) {
          const dateStr = getPacificDate(dayOffset);

          try {
            await page.goto(config.url, { waitUntil: 'networkidle2', timeout: CONFIG.pageTimeout });
            await new Promise(r => setTimeout(r, CONFIG.postLoadWait));

            // EZLinks is Cloudflare protected - this will likely return 0 results
            const teeTimes = await page.evaluate((date, defaultHoles) => {
              const results = [];
              const pageText = document.body.innerText || '';
              const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);

              for (let i = 0; i < lines.length; i++) {
                const timeMatch = lines[i].match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                if (timeMatch) {
                  const time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;
                  let price = null;
                  for (let j = Math.max(0, i - 2); j < Math.min(i + 5, lines.length); j++) {
                    const priceMatch = lines[j].match(/\$(\d+)/);
                    if (priceMatch) {
                      price = parseInt(priceMatch[1]);
                      break;
                    }
                  }
                  if (price) {
                    results.push({ time, price, players: 4, holes: defaultHoles, has_cart: 0, date });
                  }
                }
              }
              return results;
            }, dateStr, config.holes);

            for (const tt of teeTimes) {
              const time24 = convertTo24Hour(tt.time);
              if (!time24) continue;
              allTeeTimes.push({
                course_id: course.id,
                date: dateStr,
                time: time24,
                datetime: `${dateStr} ${time24}`,
                holes: tt.holes,
                players: tt.players,
                price: tt.price,
                has_cart: tt.has_cart,
                booking_url: config.url,
                source: 'ezlinks'
              });
            }

            console.log(`  [EZLinks] ${config.name} ${dateStr}: ${teeTimes.length} tee times`);
          } catch (e) {
            console.log(`  [EZLinks] ${config.name} ${dateStr}: error - ${e.message}`);
          }
        }

        coursesScraped++;
        console.log(`  [EZLinks] ${config.name}: ${allTeeTimes.length} total tee times`);

        if (allTeeTimes.length > 0) {
          const BATCH_SIZE = 50;
          for (let i = 0; i < allTeeTimes.length; i += BATCH_SIZE) {
            const batch = allTeeTimes.slice(i, i + BATCH_SIZE);
            const statements = batch.map(tt => ({
              sql: `INSERT OR REPLACE INTO tee_times (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
              args: [tt.course_id, tt.date, tt.time, tt.datetime, tt.holes, tt.players, tt.price, tt.has_cart, tt.booking_url, tt.source]
            }));
            try {
              await db.batch(statements);
              totalTeeTimes += batch.length;
            } catch (e) {
              for (const stmt of statements) {
                try { await db.execute(stmt); totalTeeTimes++; } catch {}
              }
            }
          }
        }
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[EZLinks] Complete: ${coursesScraped} courses, ${totalTeeTimes} tee times in ${elapsed}s`);

  return { coursesScraped, totalTeeTimes };
}

module.exports = { scrapeAllOptimized, EZLINKS_COURSES };
