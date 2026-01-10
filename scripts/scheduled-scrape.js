#!/usr/bin/env node
/**
 * Scheduled Full Scraper - 12x per day (every 2 hours)
 *
 * Scrapes 168 hours (7 days) of tee times from all booking systems.
 * Designed to be run via cron, launchd, or systemd.
 *
 * Usage:
 *   node scripts/scheduled-scrape.js           # Run once
 *   node scripts/scheduled-scrape.js --daemon  # Run continuously (every 2 hours)
 *
 * Cron example (12x/day, every 2 hours):
 *   0 0,2,4,6,8,10,12,14,16,18,20,22 * * * cd /path/to/project && node scripts/scheduled-scrape.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

// Import scrapers
const { runScraperOptimized: runGolfNow } = require('./golfnow-optimized');
const { scrapeAllAPI: runChronogolf } = require('./chrono-api');
const { scrapeAllAPI: runTotaleIntegrated } = require('./totale-api');
const { scrapeAllOptimized: runCPSGolf } = require('./cps-optimized');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const DAYS_TO_SCRAPE = 7; // 168 hours
const SCRAPE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

function getPacificTime() {
  return new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
}

function log(message) {
  const timestamp = getPacificTime();
  console.log(`[${timestamp}] ${message}`);
}

async function getCoursesBySlug() {
  const result = await db.execute('SELECT id, name, slug, booking_system, golfnow_id FROM courses');
  const bySlug = {};
  result.rows.forEach(c => {
    bySlug[c.slug] = c;
  });
  return bySlug;
}

async function cleanupStaleData() {
  // Delete tee times older than 1 hour that weren't updated in the last scrape
  const result = await db.execute(`
    DELETE FROM tee_times
    WHERE scraped_at < datetime('now', '-1 hour')
    AND date >= date('now')
  `);
  return result.rowsAffected || 0;
}

async function cleanupPastData() {
  // Delete tee times for past dates
  const result = await db.execute(`
    DELETE FROM tee_times WHERE date < date('now')
  `);
  return result.rowsAffected || 0;
}

async function runFullScrape() {
  const startTime = Date.now();
  log('='.repeat(60));
  log('SCHEDULED SCRAPE - 168 HOUR (7 DAY) COVERAGE');
  log('='.repeat(60));

  const coursesBySlug = await getCoursesBySlug();
  log(`Loaded ${Object.keys(coursesBySlug).length} courses`);

  const results = {
    golfnow: { success: false, teeTimes: 0, error: null },
    chronogolf: { success: false, teeTimes: 0, error: null },
    totaleintegrated: { success: false, teeTimes: 0, error: null },
    cpsgolf: { success: false, teeTimes: 0, error: null }
  };

  // Run all scrapers in parallel
  log('Starting parallel scrape...');

  const scraperPromises = [
    // GolfNow
    (async () => {
      try {
        const count = await runGolfNow(db, DAYS_TO_SCRAPE);
        results.golfnow = { success: true, teeTimes: count || 0, error: null };
        log(`[GolfNow] Complete: ${count} tee times`);
      } catch (e) {
        results.golfnow = { success: false, teeTimes: 0, error: e.message };
        log(`[GolfNow] Error: ${e.message}`);
      }
    })(),

    // Chronogolf
    (async () => {
      try {
        const result = await runChronogolf(db, coursesBySlug, DAYS_TO_SCRAPE);
        results.chronogolf = { success: true, teeTimes: result.totalTeeTimes || 0, error: null };
        log(`[Chronogolf] Complete: ${result.totalTeeTimes} tee times`);
      } catch (e) {
        results.chronogolf = { success: false, teeTimes: 0, error: e.message };
        log(`[Chronogolf] Error: ${e.message}`);
      }
    })(),

    // TotaleIntegrated
    (async () => {
      try {
        const result = await runTotaleIntegrated(db, coursesBySlug, DAYS_TO_SCRAPE);
        results.totaleintegrated = { success: true, teeTimes: result.totalTeeTimes || 0, error: null };
        log(`[TotaleIntegrated] Complete: ${result.totalTeeTimes} tee times`);
      } catch (e) {
        results.totaleintegrated = { success: false, teeTimes: 0, error: e.message };
        log(`[TotaleIntegrated] Error: ${e.message}`);
      }
    })(),

    // CPS Golf
    (async () => {
      try {
        const result = await runCPSGolf(db, coursesBySlug, DAYS_TO_SCRAPE);
        results.cpsgolf = { success: true, teeTimes: result.totalTeeTimes || 0, error: null };
        log(`[CPS Golf] Complete: ${result.totalTeeTimes} tee times`);
      } catch (e) {
        results.cpsgolf = { success: false, teeTimes: 0, error: e.message };
        log(`[CPS Golf] Error: ${e.message}`);
      }
    })()
  ];

  await Promise.all(scraperPromises);

  // Cleanup
  log('Cleaning up stale data...');
  const staleDeleted = await cleanupStaleData();
  const pastDeleted = await cleanupPastData();
  log(`Deleted ${staleDeleted} stale records, ${pastDeleted} past records`);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalTeeTimes = Object.values(results).reduce((sum, r) => sum + r.teeTimes, 0);
  const successCount = Object.values(results).filter(r => r.success).length;

  log('');
  log('='.repeat(60));
  log('SCRAPE COMPLETE');
  log('='.repeat(60));
  log(`Duration: ${elapsed}s`);
  log(`Scrapers: ${successCount}/4 successful`);
  log(`Total tee times: ${totalTeeTimes}`);
  log('');
  log('Results by source:');
  Object.entries(results).forEach(([source, r]) => {
    const status = r.success ? '✓' : '✗';
    log(`  ${status} ${source}: ${r.teeTimes} tee times${r.error ? ` (${r.error})` : ''}`);
  });
  log('');

  // Get database stats
  const stats = await db.execute(`
    SELECT
      COUNT(DISTINCT course_id) as courses_with_data,
      COUNT(*) as total_tee_times,
      MIN(date) as min_date,
      MAX(date) as max_date
    FROM tee_times
    WHERE date >= date('now')
  `);
  const s = stats.rows[0];
  log('Database status:');
  log(`  Courses with data: ${s.courses_with_data}`);
  log(`  Total tee times: ${s.total_tee_times}`);
  log(`  Date range: ${s.min_date} to ${s.max_date}`);
  log('='.repeat(60));

  return {
    success: successCount === 4,
    results,
    totalTeeTimes,
    elapsed
  };
}

async function runDaemon() {
  log('Starting daemon mode - scraping every 2 hours');
  log(`Next scrape: immediately`);

  while (true) {
    try {
      await runFullScrape();
    } catch (e) {
      log(`Scrape failed: ${e.message}`);
    }

    log(`Sleeping for 2 hours... Next scrape at ${new Date(Date.now() + SCRAPE_INTERVAL_MS).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
    await new Promise(r => setTimeout(r, SCRAPE_INTERVAL_MS));
  }
}

// Main
const args = process.argv.slice(2);
const isDaemon = args.includes('--daemon') || args.includes('-d');

if (isDaemon) {
  runDaemon().catch(e => {
    console.error('Daemon error:', e);
    process.exit(1);
  });
} else {
  runFullScrape()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(e => {
      console.error('Fatal error:', e);
      process.exit(1);
    });
}
