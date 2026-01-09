/**
 * Scheduled Scraper - Production Cron Job
 *
 * Runs full scrape 4x daily at safe intervals:
 * - 5:00 AM PST - Catch early morning tee time releases
 * - 11:00 AM PST - Mid-day refresh, catch cancellations
 * - 5:00 PM PST - Evening refresh, people planning after work
 * - 9:00 PM PST - Final update, catch late cancellations
 *
 * Usage: npm run scrape:scheduled
 */

require('dotenv').config({ path: '.env.local' });
const cron = require('node-cron');
const { fullScrapeParallel } = require('./full-scrape-parallel');

// Timezone for scheduling
const TIMEZONE = 'America/Los_Angeles';

// Schedule: 5 AM, 11 AM, 5 PM, 9 PM PST
const SCHEDULE = '0 5,11,17,21 * * *';

function formatTime() {
  return new Date().toLocaleString('en-US', {
    timeZone: TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'medium'
  });
}

async function runScheduledScrape() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SCHEDULED SCRAPE - ${formatTime()}`);
  console.log('='.repeat(60));

  try {
    await fullScrapeParallel(7);
    console.log(`\nNext scrape scheduled per cron: ${SCHEDULE}`);
  } catch (error) {
    console.error('Scrape failed:', error.message);
  }
}

// Validate cron expression
if (!cron.validate(SCHEDULE)) {
  console.error('Invalid cron schedule:', SCHEDULE);
  process.exit(1);
}

console.log('='.repeat(60));
console.log('BAY AREA GOLF - SCHEDULED SCRAPER');
console.log('='.repeat(60));
console.log(`Started: ${formatTime()}`);
console.log(`Schedule: ${SCHEDULE} (${TIMEZONE})`);
console.log('Times: 5:00 AM, 11:00 AM, 5:00 PM, 9:00 PM PST');
console.log('='.repeat(60));

// Run immediately on startup
console.log('\nRunning initial scrape...');
runScheduledScrape();

// Schedule future runs
cron.schedule(SCHEDULE, runScheduledScrape, {
  timezone: TIMEZONE
});

console.log('\nScheduler running. Press Ctrl+C to stop.');

// Keep process alive
process.on('SIGINT', () => {
  console.log('\nScheduler stopped.');
  process.exit(0);
});
