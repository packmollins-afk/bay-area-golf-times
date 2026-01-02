/**
 * Run the scraper to fetch real tee time data
 */

const path = require('path');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
require('../db/schema');
const { seedCourses } = require('../db/courses');
const { runScraper } = require('../scrapers/golfnow');

async function main() {
  console.log('Bay Area Golf Tee Times Scraper\n');

  // Seed courses first
  seedCourses();

  // Get number of days from command line args
  const days = parseInt(process.argv[2]) || 7;

  console.log(`Scraping tee times for the next ${days} days...\n`);

  try {
    await runScraper(days);
  } catch (error) {
    console.error('Scraper error:', error);
    process.exit(1);
  }
}

main();
