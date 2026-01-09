/**
 * Optimized Full Scrape - Parallel Execution
 *
 * Optimizations:
 * 1. All 5 scrapers run in parallel (not sequentially)
 * 2. Each scraper runs days in parallel internally
 * 3. Safe delete pattern: only removes stale data AFTER successful scrape
 *
 * Scrapers: GolfNow, TotaleIntegrated, Chronogolf, CPS Golf, Quick18
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
const { scrapeAllOptimized: runQuick18Optimized } = require('./quick18'); // Quick18 Puppeteer

async function fullScrapeParallel(daysAhead = 7) {
  console.log('='.repeat(60));
  console.log('PARALLEL FULL SCRAPE - 7 DAY UPDATE');
  console.log('='.repeat(60));
  console.log('Started:', new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const start = Date.now();

  // Record the start time for this scrape run (used to identify stale data later)
  // IMPORTANT: Use SQLite's datetime format to match what scrapers insert with datetime('now')
  // JavaScript ISO format (2026-01-09T06:04:09.123Z) != SQLite format (2026-01-09 06:04:09)
  const timeResult = await db.execute("SELECT datetime('now') as now");
  const scrapeStartTime = timeResult.rows[0].now;

  // Get courses for scrapers
  const res = await db.execute('SELECT id, name, slug FROM courses');
  const coursesBySlug = {};
  res.rows.forEach(c => coursesBySlug[c.slug] = c);
  console.log('Courses in DB:', res.rows.length);

  // NOTE: We do NOT delete data before scraping anymore.
  // Scrapers use INSERT OR REPLACE which updates scraped_at timestamp.
  // After successful scrape, we'll clean up stale data.
  console.log('');

  // Run ALL scrapers in parallel
  console.log('Starting all scrapers in parallel...\n');

  const scraperResults = [];
  const errors = [];

  const results = await Promise.allSettled([
    runGolfNowOptimized(daysAhead).then(count => {
      console.log(`[OK] GolfNow complete: ${count} tee times`);
      const result = { name: 'GolfNow', count, success: true };
      scraperResults.push(result);
      return result;
    }).catch(e => {
      console.error(`[FAIL] GolfNow error: ${e.message}`);
      const result = { name: 'GolfNow', count: 0, success: false, error: e.message };
      scraperResults.push(result);
      errors.push(result);
      return result;
    }),

    runTotaleAPI(db, coursesBySlug, daysAhead).then(r => {
      console.log(`[OK] TotaleIntegrated API complete: ${r.totalTeeTimes} tee times`);
      const result = { name: 'TotaleIntegrated', count: r.totalTeeTimes, success: true };
      scraperResults.push(result);
      return result;
    }).catch(e => {
      console.error(`[FAIL] TotaleIntegrated error: ${e.message}`);
      const result = { name: 'TotaleIntegrated', count: 0, success: false, error: e.message };
      scraperResults.push(result);
      errors.push(result);
      return result;
    }),

    runChronoAPI(db, coursesBySlug, daysAhead).then(r => {
      console.log(`[OK] Chronogolf API complete: ${r.totalTeeTimes} tee times`);
      const result = { name: 'Chronogolf', count: r.totalTeeTimes, success: true };
      scraperResults.push(result);
      return result;
    }).catch(e => {
      console.error(`[FAIL] Chronogolf error: ${e.message}`);
      const result = { name: 'Chronogolf', count: 0, success: false, error: e.message };
      scraperResults.push(result);
      errors.push(result);
      return result;
    }),

    runCPSOptimized(db, coursesBySlug, daysAhead).then(r => {
      console.log(`[OK] CPS Golf complete: ${r.totalTeeTimes} tee times`);
      const result = { name: 'CPS', count: r.totalTeeTimes, success: true };
      scraperResults.push(result);
      return result;
    }).catch(e => {
      console.error(`[FAIL] CPS Golf error: ${e.message}`);
      const result = { name: 'CPS', count: 0, success: false, error: e.message };
      scraperResults.push(result);
      errors.push(result);
      return result;
    }),

    runQuick18Optimized(db, coursesBySlug, daysAhead).then(r => {
      console.log(`[OK] Quick18 complete: ${r.totalTeeTimes} tee times`);
      const result = { name: 'Quick18', count: r.totalTeeTimes, success: true };
      scraperResults.push(result);
      return result;
    }).catch(e => {
      console.error(`[FAIL] Quick18 error: ${e.message}`);
      const result = { name: 'Quick18', count: 0, success: false, error: e.message };
      scraperResults.push(result);
      errors.push(result);
      return result;
    })
  ]);

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);

  // Calculate totals
  const totalScraped = scraperResults.reduce((sum, r) => sum + r.count, 0);
  const successfulScrapers = scraperResults.filter(r => r.success).length;
  const failedScrapers = errors.length;

  // Clean up stale data only if we had successful scrapes
  let staleDeleted = 0;
  let pastDeleted = 0;

  if (successfulScrapers > 0 && totalScraped > 0) {
    console.log('\nCleaning up stale data...');

    // Delete past tee times (before today in Pacific Time)
    // Note: SQLite date('now') is UTC, scrapers store Pacific Time dates
    // Use -8 hours offset to approximate Pacific Time
    const pastResult = await db.execute("DELETE FROM tee_times WHERE date < date('now', '-8 hours')");
    pastDeleted = pastResult.rowsAffected || 0;

    // Delete tee times that weren't updated in this scrape run
    // (scraped_at is older than when we started AND date is in the future)
    // Only delete for sources that completed successfully
    const successfulSources = scraperResults
      .filter(r => r.success && r.count > 0)
      .map(r => {
        // Map scraper names to source values used in the database
        const sourceMap = {
          'GolfNow': 'golfnow',
          'TotaleIntegrated': 'totaleintegrated',
          'Chronogolf': 'chronogolf',
          'CPS': 'cpsgolf',
          'Quick18': 'quick18'
        };
        return sourceMap[r.name] || r.name.toLowerCase();
      });

    if (successfulSources.length > 0) {
      const placeholders = successfulSources.map(() => '?').join(',');
      const staleResult = await db.execute({
        sql: `DELETE FROM tee_times
              WHERE scraped_at < ?
              AND date >= date('now', '-8 hours')
              AND source IN (${placeholders})`,
        args: [scrapeStartTime, ...successfulSources]
      });
      staleDeleted = staleResult.rowsAffected || 0;
    }

    console.log(`  Deleted ${pastDeleted} past tee times`);
    console.log(`  Deleted ${staleDeleted} stale tee times (not updated this run)`);
  } else {
    console.log('\nWARNING: No successful scrapes with data - skipping cleanup to preserve existing data');
  }

  // Get final stats
  const stats = await db.execute('SELECT COUNT(*) as cnt, COUNT(DISTINCT course_id) as courses FROM tee_times');

  console.log('\n' + '='.repeat(60));
  console.log('PARALLEL SCRAPE COMPLETE');
  console.log('='.repeat(60));
  console.log('Time:', elapsed, 'minutes');
  console.log('');

  // Summary by source
  console.log('Results by Source:');
  scraperResults.forEach(r => {
    const status = r.success ? '[OK]' : '[FAIL]';
    console.log(`  ${status} ${r.name}: ${r.count} tee times${r.error ? ` - ${r.error}` : ''}`);
  });
  console.log('');

  // Overall stats
  console.log('Summary:');
  console.log(`  Scrapers succeeded: ${successfulScrapers}/5`);
  console.log(`  Scrapers failed: ${failedScrapers}/5`);
  console.log(`  Total tee times scraped this run: ${totalScraped}`);
  console.log(`  Stale records cleaned up: ${staleDeleted}`);
  console.log(`  Past records cleaned up: ${pastDeleted}`);
  console.log('');
  console.log('Database Status:');
  console.log(`  TOTAL TEE TIMES: ${stats.rows[0].cnt}`);
  console.log(`  COURSES WITH DATA: ${stats.rows[0].courses} / 82`);

  // Error summary if any failures
  if (errors.length > 0) {
    console.log('');
    console.log('ERROR SUMMARY:');
    errors.forEach(e => {
      console.log(`  ${e.name}: ${e.error}`);
    });
  }

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
