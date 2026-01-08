/**
 * Bay Area Golf Tee Times Scraper
 * Fast, reliable scraper focused on GolfNow (main provider)
 */

const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
require('../db/schema');
const { seedCourses } = require('../db/courses');

// Import scrapers
const { runScraper: runGolfNow } = require('../scrapers/golfnow');
const { scrapeAllTotaleIntegrated } = require('../scrapers/totaleintegrated');
const { scrapeAllChronogolf } = require('../scrapers/chronogolf');
const { scrapeAllQuick18 } = require('../scrapers/quick18');
const { scrapeAllCPSGolf } = require('../scrapers/cpsgolf');
const { db } = require('../db/turso');

async function main() {
  const startTime = Date.now();
  console.log('Bay Area Golf Tee Times Scraper');
  console.log('================================\n');

  // Seed courses first
  seedCourses();

  const days = parseInt(process.argv[2]) || 7;
  console.log(`Scraping tee times for the next ${days} days...\n`);

  try {
    // Run GolfNow scraper (covers ~26 courses)
    const golfnowCount = await runGolfNow(days);

    // Get course data for other scrapers
    console.log('\n');
    const coursesResult = await db.execute('SELECT id, name, slug FROM courses');
    const coursesBySlug = {};
    for (const c of coursesResult.rows) {
      coursesBySlug[c.slug] = c;
    }

    // Run TotaleIntegrated scraper (Boundary Oak, Metropolitan, San Jose Muni)
    const totaleResult = await scrapeAllTotaleIntegrated(db, coursesBySlug);

    // Run Chronogolf scraper (Half Moon Bay, Santa Teresa, Tilden Park, etc.)
    const chronogolfResult = await scrapeAllChronogolf(db, coursesBySlug);

    // Run Quick18 scraper (Baylands)
    const quick18Result = await scrapeAllQuick18(db, coursesBySlug);

    // Run CPS Golf scraper (Diablo Creek, Northwood)
    const cpsgolfResult = await scrapeAllCPSGolf(db, coursesBySlug);

    const totalCount = golfnowCount + totaleResult.totalTeeTimes + chronogolfResult.totalTeeTimes + quick18Result.totalTeeTimes + cpsgolfResult.totalTeeTimes;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(50));
    console.log(`COMPLETE: ${totalCount} tee times in ${elapsed}s`);
    console.log(`  GolfNow: ${golfnowCount}`);
    console.log(`  TotaleIntegrated: ${totaleResult.totalTeeTimes}`);
    console.log(`  Chronogolf: ${chronogolfResult.totalTeeTimes}`);
    console.log(`  Quick18: ${quick18Result.totalTeeTimes}`);
    console.log(`  CPS Golf: ${cpsgolfResult.totalTeeTimes}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Scraper error:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
