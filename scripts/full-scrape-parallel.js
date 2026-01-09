/**
 * Optimized Full Scrape - Parallel Execution
 *
 * Optimizations:
 * 1. All 4 scrapers run in parallel (not sequentially)
 * 2. Each scraper runs days in parallel internally
 *
 * Expected improvement: ~4x faster (20-30min → 5-8min)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Import scrapers
const { runScraperOptimized: runGolfNowOptimized } = require('./golfnow-optimized'); // Optimized Puppeteer
const { scrapeAllAPI: runTotaleAPI } = require('./totale-api'); // API-based - 55x faster!
const { scrapeAllAPI: runChronoAPI } = require('./chrono-api'); // Hybrid API - 12x faster!
const { scrapeAllOptimized: runCPSOptimized } = require('./cps-optimized'); // Optimized Puppeteer

async function fullScrapeParallel(daysAhead = 7) {
  console.log('='.repeat(60));
  console.log('PARALLEL FULL SCRAPE - 7 DAY UPDATE');
  console.log('='.repeat(60));
  console.log('Started:', new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const start = Date.now();

  // Get courses for scrapers
  const res = await db.execute('SELECT id, name, slug FROM courses');
  const coursesBySlug = {};
  res.rows.forEach(c => coursesBySlug[c.slug] = c);
  console.log('Courses in DB:', res.rows.length);

  // Clear old tee times first
  await db.execute("DELETE FROM tee_times WHERE date < date('now')");
  console.log('Cleared past tee times\n');

  // Run ALL scrapers in parallel
  console.log('Starting all scrapers in parallel...\n');

  const results = await Promise.allSettled([
    runGolfNowOptimized(daysAhead).then(count => {
      console.log(`✓ GolfNow complete: ${count} tee times`);
      return { name: 'GolfNow', count };
    }).catch(e => {
      console.error(`✗ GolfNow error: ${e.message}`);
      return { name: 'GolfNow', count: 0, error: e.message };
    }),

    runTotaleAPI(db, coursesBySlug, daysAhead).then(r => {
      console.log(`✓ TotaleIntegrated API complete: ${r.totalTeeTimes} tee times`);
      return { name: 'TotaleIntegrated', count: r.totalTeeTimes };
    }).catch(e => {
      console.error(`✗ TotaleIntegrated error: ${e.message}`);
      return { name: 'TotaleIntegrated', count: 0, error: e.message };
    }),

    runChronoAPI(db, coursesBySlug, daysAhead).then(r => {
      console.log(`✓ Chronogolf API complete: ${r.totalTeeTimes} tee times`);
      return { name: 'Chronogolf', count: r.totalTeeTimes };
    }).catch(e => {
      console.error(`✗ Chronogolf error: ${e.message}`);
      return { name: 'Chronogolf', count: 0, error: e.message };
    }),

    runCPSOptimized(db, coursesBySlug, daysAhead).then(r => {
      console.log(`✓ CPS Golf complete: ${r.totalTeeTimes} tee times`);
      return { name: 'CPS', count: r.totalTeeTimes };
    }).catch(e => {
      console.error(`✗ CPS Golf error: ${e.message}`);
      return { name: 'CPS', count: 0, error: e.message };
    })
  ]);

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);

  // Get final stats
  const stats = await db.execute('SELECT COUNT(*) as cnt, COUNT(DISTINCT course_id) as courses FROM tee_times');

  console.log('\n' + '='.repeat(60));
  console.log('PARALLEL SCRAPE COMPLETE');
  console.log('='.repeat(60));
  console.log('Time:', elapsed, 'minutes');
  console.log('');
  console.log('By System:');
  results.forEach(r => {
    const val = r.value || { name: 'Unknown', count: 0 };
    console.log(`  ${val.name}: ${val.count}${val.error ? ' (error)' : ''}`);
  });
  console.log('');
  console.log('TOTAL TEE TIMES:', stats.rows[0].cnt);
  console.log('COURSES WITH DATA:', stats.rows[0].courses, '/ 82');
  console.log('='.repeat(60));
}

// Run if called directly
if (require.main === module) {
  fullScrapeParallel(7)
    .then(() => process.exit(0))
    .catch(e => {
      console.error('Fatal:', e);
      process.exit(1);
    });
}

module.exports = { fullScrapeParallel };
