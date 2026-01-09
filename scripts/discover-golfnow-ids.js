/**
 * GolfNow ID Discovery Script
 *
 * Scans GolfNow search results and compares with database to find:
 * 1. Courses in DB without golfnow_id
 * 2. GolfNow courses not in DB at all
 * 3. Generates SQL/code to fix mismatches
 *
 * Usage: node scripts/discover-golfnow-ids.js
 */

require('dotenv').config({ path: '.env.local' });
const puppeteer = require('puppeteer');
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Search locations covering Bay Area
const SEARCH_LOCATIONS = [
  { lat: 37.7749, lng: -122.4194, name: 'San Francisco', region: 'San Francisco' },
  { lat: 37.3382, lng: -121.8863, name: 'San Jose', region: 'South Bay' },
  { lat: 37.8044, lng: -122.2712, name: 'Oakland', region: 'East Bay' },
  { lat: 38.2975, lng: -122.2869, name: 'Napa', region: 'Napa' },
  { lat: 38.4405, lng: -122.7144, name: 'Santa Rosa', region: 'North Bay' },
  { lat: 36.6002, lng: -121.8947, name: 'Monterey', region: 'Monterey' },
];

// Known indoor/simulator facilities to ignore
const IGNORE_PATTERNS = [
  /simulator/i, /screen golf/i, /indoor/i, /studio/i,
  /golfersbz/i, /golfballin/i, /primetime golf/i,
  /crafted swing/i, /100 yards/i, /clubhouse$/i
];

async function scrapeGolfNowCourses(browser, location) {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1280, height: 800 });

  const today = new Date().toISOString().split('T')[0];
  const url = `https://www.golfnow.com/tee-times/search#q=location&latitude=${location.lat}&longitude=${location.lng}&radius=75&date=${today}`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll to load all results
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 1000));
    }

    // Extract course data
    const courses = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      document.querySelectorAll('a[href*="/facility/"]').forEach(link => {
        const match = link.href.match(/facility\/(\d+)-([^/]+)/);
        if (match && !seen.has(match[1])) {
          seen.add(match[1]);

          // Try to find city from parent elements
          let container = link;
          let city = null;
          for (let i = 0; i < 5 && container.parentElement; i++) {
            container = container.parentElement;
            const text = container.innerText || '';
            const cityMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*California/);
            if (cityMatch) {
              city = cityMatch[1];
              break;
            }
          }

          results.push({
            id: match[1],
            slug: match[2],
            name: match[2].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            city: city
          });
        }
      });
      return results;
    });

    await page.close();
    return courses.map(c => ({ ...c, searchLocation: location.name, searchRegion: location.region }));

  } catch (error) {
    console.error(`Error scraping ${location.name}:`, error.message);
    await page.close();
    return [];
  }
}

function shouldIgnoreCourse(name) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(name));
}

async function main() {
  console.log('='.repeat(60));
  console.log('GOLFNOW ID DISCOVERY');
  console.log('='.repeat(60));
  console.log('');

  // Get all courses from DB
  const dbResult = await db.execute(`
    SELECT id, name, slug, golfnow_id, booking_system, city, region
    FROM courses
    ORDER BY name
  `);
  const dbCourses = dbResult.rows;
  const dbByGolfNowId = new Map();
  const dbByName = new Map();
  const dbBySlug = new Map();

  dbCourses.forEach(c => {
    if (c.golfnow_id) dbByGolfNowId.set(c.golfnow_id, c);
    dbByName.set(c.name.toLowerCase(), c);
    dbBySlug.set(c.slug, c);
  });

  console.log(`Database courses: ${dbCourses.length}`);
  console.log(`With golfnow_id: ${dbByGolfNowId.size}`);
  console.log('');

  // Launch browser and scrape all locations
  console.log('Scraping GolfNow search results...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allGolfNowCourses = new Map();

  for (const location of SEARCH_LOCATIONS) {
    console.log(`  Searching ${location.name}...`);
    const courses = await scrapeGolfNowCourses(browser, location);
    courses.forEach(c => {
      if (!allGolfNowCourses.has(c.id)) {
        allGolfNowCourses.set(c.id, c);
      }
    });
  }

  await browser.close();

  console.log(`\nFound ${allGolfNowCourses.size} unique GolfNow facilities`);
  console.log('');

  // Analyze results
  const matched = [];
  const missingId = [];    // In DB but golfnow_id not set
  const notInDb = [];      // On GolfNow but not in DB
  const ignored = [];      // Simulators, indoor, etc.

  for (const [id, course] of allGolfNowCourses) {
    if (shouldIgnoreCourse(course.name)) {
      ignored.push(course);
      continue;
    }

    if (dbByGolfNowId.has(id)) {
      matched.push({ golfnow: course, db: dbByGolfNowId.get(id) });
    } else {
      // Check if course exists in DB by name
      const nameKey = course.name.toLowerCase();
      const dbMatch = dbByName.get(nameKey) || dbBySlug.get(course.slug);

      if (dbMatch) {
        missingId.push({ golfnow: course, db: dbMatch });
      } else {
        notInDb.push(course);
      }
    }
  }

  // Report
  console.log('='.repeat(60));
  console.log('ANALYSIS RESULTS');
  console.log('='.repeat(60));
  console.log('');

  console.log(`✓ Matched (DB has correct golfnow_id): ${matched.length}`);
  console.log(`⚠ Missing ID (in DB but no golfnow_id): ${missingId.length}`);
  console.log(`✗ Not in DB (new courses to add): ${notInDb.length}`);
  console.log(`○ Ignored (simulators/indoor): ${ignored.length}`);
  console.log('');

  // Generate fixes for missing IDs
  if (missingId.length > 0) {
    console.log('='.repeat(60));
    console.log('SQL TO ADD MISSING GOLFNOW_IDS');
    console.log('='.repeat(60));
    console.log('');

    for (const { golfnow, db } of missingId) {
      console.log(`UPDATE courses SET golfnow_id = '${golfnow.id}' WHERE id = ${db.id};`);
      console.log(`  -- ${db.name} (${db.city})`);
    }
    console.log('');
  }

  // Report courses not in DB
  if (notInDb.length > 0) {
    console.log('='.repeat(60));
    console.log('NEW COURSES TO ADD TO DATABASE');
    console.log('='.repeat(60));
    console.log('');

    for (const course of notInDb) {
      console.log(`-- ${course.name}`);
      console.log(`   GolfNow ID: ${course.id}`);
      console.log(`   City: ${course.city || 'Unknown'}`);
      console.log(`   Found in: ${course.searchLocation} (${course.searchRegion})`);
      console.log(`   URL: https://www.golfnow.com/tee-times/facility/${course.id}-${course.slug}/search`);
      console.log('');
    }
  }

  // Check for DB courses without golfnow_id that should have one
  const dbMissingGolfNow = dbCourses.filter(c =>
    !c.golfnow_id &&
    c.booking_system === 'golfnow'
  );

  if (dbMissingGolfNow.length > 0) {
    console.log('='.repeat(60));
    console.log('DB COURSES WITH booking_system=golfnow BUT NO golfnow_id');
    console.log('='.repeat(60));
    console.log('');

    for (const c of dbMissingGolfNow) {
      console.log(`  ${c.id}: ${c.name} (${c.city})`);
      console.log(`     → Search manually on golfnow.com to find ID`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Current coverage: ${matched.length}/${allGolfNowCourses.size - ignored.length} GolfNow courses matched`);
  console.log(`After fixes: ${matched.length + missingId.length}/${allGolfNowCourses.size - ignored.length} courses`);
  console.log(`New courses available: ${notInDb.length}`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
  });
