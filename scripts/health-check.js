#!/usr/bin/env node
/**
 * Health Check Script for Bay Area Golf Times
 *
 * Performs comprehensive diagnostics:
 * 1. Database connectivity check
 * 2. Verifies each scraper source has recent data (within 24 hours)
 * 3. Reports courses with no tee times
 * 4. Identifies booking_system mismatches between DB and scraper configs
 * 5. Outputs actionable summary report
 *
 * Usage: node scripts/health-check.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

// Scraper source configurations - must match what scrapers insert
const SCRAPER_SOURCES = {
  golfnow: {
    name: 'GolfNow',
    bookingSystems: ['golfnow'],
    description: 'GolfNow marketplace courses'
  },
  totaleintegrated: {
    name: 'TotaleIntegrated',
    bookingSystems: ['totaleintegrated'],
    description: 'TotaleIntegrated/CourseCo API courses'
  },
  chronogolf: {
    name: 'Chronogolf',
    bookingSystems: ['chronogolf'],
    description: 'Chronogolf platform courses'
  },
  cpsgolf: {
    name: 'CPS Golf',
    bookingSystems: ['cpsgolf'],
    description: 'CPS.Golf booking system'
  },
  quick18: {
    name: 'Quick18',
    bookingSystems: ['quick18'],
    description: 'Quick18 booking platform'
  }
};

// Courses configured in each scraper
const SCRAPER_COURSE_CONFIGS = {
  totaleintegrated: [
    'Boundary Oak Golf Course',
    'Metropolitan Golf Links',
    'San Jose Municipal Golf Course',
    'Pacific Grove Golf Links',
    'Laguna Seca Golf Ranch',
    'Valley of the Moon Club',
    'Napa Golf Course',
    'Ancil Hoffman Golf Course',
    'Mather Golf Course',
    'Cherry Island Golf Course'
  ],
  chronogolf: [
    'Half Moon Bay Golf Links - Old Course',
    'Half Moon Bay Golf Links - Ocean Course',
    'Santa Teresa Golf Club',
    'Tilden Park Golf Course',
    'Redwood Canyon Golf Course',
    'Canyon Lakes Golf Course',
    'Blue Rock Springs Golf Club',
    'De Laveaga Golf Course',
    'Pasatiempo Golf Club',
    'Seascape Golf Club',
    'Pajaro Valley Golf Club',
    'Los Lagos Golf Course',
    'Gilroy Golf Course',
    'Salinas Fairways Golf Course',
    'Rooster Run Golf Club'
  ],
  cpsgolf: [
    'Diablo Creek Golf Course',
    'Northwood Golf Club'
  ],
  quick18: [
    'Baylands Golf Links'
  ]
  // golfnow uses golfnow_id field in DB, not hardcoded names
};

// Terminal colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + '='.repeat(70));
  console.log(colorize(` ${title}`, 'bold'));
  console.log('='.repeat(70));
}

function printSection(title) {
  console.log('\n' + colorize(`--- ${title} ---`, 'cyan'));
}

function printStatus(label, status, detail = '') {
  const icon = status === 'ok' ? colorize('[OK]', 'green') :
               status === 'warn' ? colorize('[WARN]', 'yellow') :
               status === 'fail' ? colorize('[FAIL]', 'red') :
               colorize('[INFO]', 'blue');
  console.log(`  ${icon} ${label}${detail ? ': ' + detail : ''}`);
}

async function runHealthCheck() {
  const startTime = Date.now();
  const issues = [];
  const warnings = [];

  printHeader('BAY AREA GOLF TIMES - HEALTH CHECK');
  console.log(`Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT`);

  // =========================================================================
  // 1. DATABASE CONNECTIVITY
  // =========================================================================
  printSection('1. Database Connectivity');

  let db;
  try {
    if (!process.env.TURSO_DATABASE_URL) {
      throw new Error('TURSO_DATABASE_URL environment variable not set');
    }
    if (!process.env.TURSO_AUTH_TOKEN) {
      throw new Error('TURSO_AUTH_TOKEN environment variable not set');
    }

    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });

    // Test query
    const testResult = await db.execute("SELECT datetime('now') as server_time");
    printStatus('Connection', 'ok', `Server time: ${testResult.rows[0].server_time}`);

    // Get database stats
    const courseCount = await db.execute('SELECT COUNT(*) as cnt FROM courses');
    const teeTimeCount = await db.execute('SELECT COUNT(*) as cnt FROM tee_times');
    printStatus('Courses in DB', 'ok', courseCount.rows[0].cnt.toString());
    printStatus('Total tee times', 'ok', teeTimeCount.rows[0].cnt.toString());

  } catch (error) {
    printStatus('Connection', 'fail', error.message);
    issues.push(`Database connection failed: ${error.message}`);
    console.log('\n' + colorize('Cannot continue health check without database connection.', 'red'));
    process.exit(1);
  }

  // =========================================================================
  // 2. SCRAPER DATA FRESHNESS (within 24 hours)
  // =========================================================================
  printSection('2. Scraper Data Freshness (last 24 hours)');

  const freshnessQuery = await db.execute(`
    SELECT
      source,
      COUNT(*) as tee_time_count,
      COUNT(DISTINCT course_id) as course_count,
      MIN(scraped_at) as oldest_scrape,
      MAX(scraped_at) as newest_scrape
    FROM tee_times
    WHERE scraped_at >= datetime('now', '-24 hours')
    GROUP BY source
    ORDER BY source
  `);

  const freshSources = new Set();
  freshnessQuery.rows.forEach(row => {
    freshSources.add(row.source);
    const hoursAgo = row.newest_scrape ?
      Math.round((Date.now() - new Date(row.newest_scrape + 'Z').getTime()) / 3600000 * 10) / 10 :
      'N/A';
    printStatus(
      `${SCRAPER_SOURCES[row.source]?.name || row.source}`,
      'ok',
      `${row.tee_time_count} times, ${row.course_count} courses (last scrape: ${hoursAgo}h ago)`
    );
  });

  // Check for stale/missing sources
  for (const [source, config] of Object.entries(SCRAPER_SOURCES)) {
    if (!freshSources.has(source)) {
      // Check if source has ANY data
      const anyData = await db.execute({
        sql: `SELECT MAX(scraped_at) as last_scrape, COUNT(*) as cnt FROM tee_times WHERE source = ?`,
        args: [source]
      });

      if (anyData.rows[0].cnt > 0) {
        const lastScrape = anyData.rows[0].last_scrape;
        const hoursAgo = Math.round((Date.now() - new Date(lastScrape + 'Z').getTime()) / 3600000);
        printStatus(config.name, 'warn', `No data in last 24h (last scrape: ${hoursAgo}h ago)`);
        warnings.push(`${config.name}: No fresh data (last scraped ${hoursAgo}h ago)`);
      } else {
        printStatus(config.name, 'fail', 'No data in database');
        issues.push(`${config.name}: No tee time data found in database`);
      }
    }
  }

  // =========================================================================
  // 3. COURSES WITH NO TEE TIMES
  // =========================================================================
  printSection('3. Courses Without Tee Times');

  // Get courses that have a booking system but no tee times
  const noTeeTimesQuery = await db.execute(`
    SELECT
      c.id,
      c.name,
      c.booking_system,
      c.city,
      c.region
    FROM courses c
    LEFT JOIN tee_times tt ON c.id = tt.course_id AND tt.date >= date('now')
    WHERE c.booking_system IS NOT NULL
      AND c.booking_system != 'other'
      AND c.booking_system != ''
    GROUP BY c.id
    HAVING COUNT(tt.id) = 0
    ORDER BY c.booking_system, c.name
  `);

  if (noTeeTimesQuery.rows.length === 0) {
    printStatus('All active courses have tee times', 'ok');
  } else {
    printStatus(`${noTeeTimesQuery.rows.length} courses without tee times`, 'warn');

    // Group by booking system
    const bySystem = {};
    noTeeTimesQuery.rows.forEach(row => {
      if (!bySystem[row.booking_system]) {
        bySystem[row.booking_system] = [];
      }
      bySystem[row.booking_system].push(row);
    });

    for (const [system, courses] of Object.entries(bySystem)) {
      console.log(`\n  ${colorize(system, 'yellow')} (${courses.length} courses):`);
      courses.forEach(c => {
        console.log(`    - ${c.name} (${c.city})`);
        warnings.push(`No tee times: ${c.name} [${system}]`);
      });
    }
  }

  // =========================================================================
  // 4. BOOKING SYSTEM MISMATCHES
  // =========================================================================
  printSection('4. Booking System Configuration Mismatches');

  let mismatchCount = 0;

  // Check TotaleIntegrated courses
  for (const courseName of SCRAPER_COURSE_CONFIGS.totaleintegrated) {
    const result = await db.execute({
      sql: `SELECT id, name, booking_system FROM courses WHERE name = ?`,
      args: [courseName]
    });

    if (result.rows.length === 0) {
      printStatus(`Missing in DB`, 'fail', `${courseName} (expected: totaleintegrated)`);
      issues.push(`Course "${courseName}" is in totaleintegrated scraper config but not in database`);
      mismatchCount++;
    } else if (result.rows[0].booking_system !== 'totaleintegrated') {
      printStatus(`Mismatch`, 'warn',
        `${courseName}: DB says "${result.rows[0].booking_system}", scraper expects "totaleintegrated"`);
      warnings.push(`Booking system mismatch: ${courseName} (DB: ${result.rows[0].booking_system}, Scraper: totaleintegrated)`);
      mismatchCount++;
    }
  }

  // Check Chronogolf courses
  for (const courseName of SCRAPER_COURSE_CONFIGS.chronogolf) {
    const result = await db.execute({
      sql: `SELECT id, name, booking_system FROM courses WHERE name = ?`,
      args: [courseName]
    });

    if (result.rows.length === 0) {
      printStatus(`Missing in DB`, 'fail', `${courseName} (expected: chronogolf)`);
      issues.push(`Course "${courseName}" is in chronogolf scraper config but not in database`);
      mismatchCount++;
    } else if (result.rows[0].booking_system !== 'chronogolf') {
      printStatus(`Mismatch`, 'warn',
        `${courseName}: DB says "${result.rows[0].booking_system}", scraper expects "chronogolf"`);
      warnings.push(`Booking system mismatch: ${courseName} (DB: ${result.rows[0].booking_system}, Scraper: chronogolf)`);
      mismatchCount++;
    }
  }

  // Check CPS Golf courses
  for (const courseName of SCRAPER_COURSE_CONFIGS.cpsgolf) {
    const result = await db.execute({
      sql: `SELECT id, name, booking_system FROM courses WHERE name = ?`,
      args: [courseName]
    });

    if (result.rows.length === 0) {
      printStatus(`Missing in DB`, 'fail', `${courseName} (expected: cpsgolf)`);
      issues.push(`Course "${courseName}" is in cpsgolf scraper config but not in database`);
      mismatchCount++;
    } else if (result.rows[0].booking_system !== 'cpsgolf') {
      printStatus(`Mismatch`, 'warn',
        `${courseName}: DB says "${result.rows[0].booking_system}", scraper expects "cpsgolf"`);
      warnings.push(`Booking system mismatch: ${courseName} (DB: ${result.rows[0].booking_system}, Scraper: cpsgolf)`);
      mismatchCount++;
    }
  }

  // Check Quick18 courses
  for (const courseName of SCRAPER_COURSE_CONFIGS.quick18) {
    const result = await db.execute({
      sql: `SELECT id, name, booking_system FROM courses WHERE name = ?`,
      args: [courseName]
    });

    if (result.rows.length === 0) {
      printStatus(`Missing in DB`, 'fail', `${courseName} (expected: quick18)`);
      issues.push(`Course "${courseName}" is in quick18 scraper config but not in database`);
      mismatchCount++;
    } else if (result.rows[0].booking_system !== 'quick18') {
      printStatus(`Mismatch`, 'warn',
        `${courseName}: DB says "${result.rows[0].booking_system}", scraper expects "quick18"`);
      warnings.push(`Booking system mismatch: ${courseName} (DB: ${result.rows[0].booking_system}, Scraper: quick18)`);
      mismatchCount++;
    }
  }

  // Check for GolfNow courses with golfnow_id but different booking_system
  const golfnowMismatch = await db.execute(`
    SELECT name, booking_system, golfnow_id
    FROM courses
    WHERE golfnow_id IS NOT NULL
      AND booking_system != 'golfnow'
  `);

  golfnowMismatch.rows.forEach(row => {
    printStatus(`Mismatch`, 'warn',
      `${row.name}: Has golfnow_id="${row.golfnow_id}" but booking_system="${row.booking_system}"`);
    warnings.push(`GolfNow ID mismatch: ${row.name} has golfnow_id but booking_system="${row.booking_system}"`);
    mismatchCount++;
  });

  if (mismatchCount === 0) {
    printStatus('All booking systems configured correctly', 'ok');
  }

  // Check for courses in DB with booking systems not in any scraper
  const orphanedCourses = await db.execute(`
    SELECT name, booking_system, city
    FROM courses
    WHERE booking_system IS NOT NULL
      AND booking_system != 'other'
      AND booking_system != ''
      AND booking_system NOT IN ('golfnow', 'totaleintegrated', 'chronogolf', 'cpsgolf', 'quick18')
  `);

  if (orphanedCourses.rows.length > 0) {
    console.log(`\n  ${colorize('Unknown booking systems:', 'yellow')}`);
    orphanedCourses.rows.forEach(row => {
      console.log(`    - ${row.name}: "${row.booking_system}"`);
      warnings.push(`Unknown booking system: ${row.name} uses "${row.booking_system}"`);
    });
  }

  // =========================================================================
  // 5. ADDITIONAL DIAGNOSTICS
  // =========================================================================
  printSection('5. Additional Diagnostics');

  // Check for duplicate courses
  const duplicates = await db.execute(`
    SELECT name, COUNT(*) as cnt
    FROM courses
    GROUP BY name
    HAVING cnt > 1
  `);

  if (duplicates.rows.length > 0) {
    printStatus('Duplicate course names found', 'warn');
    duplicates.rows.forEach(row => {
      console.log(`    - "${row.name}" appears ${row.cnt} times`);
      warnings.push(`Duplicate course: "${row.name}" (${row.cnt} entries)`);
    });
  } else {
    printStatus('No duplicate course names', 'ok');
  }

  // Check for future tee times distribution
  const futureDistribution = await db.execute(`
    SELECT
      date,
      COUNT(*) as cnt,
      COUNT(DISTINCT course_id) as courses
    FROM tee_times
    WHERE date >= date('now')
    GROUP BY date
    ORDER BY date
    LIMIT 7
  `);

  console.log(`\n  Tee time distribution (next 7 days):`);
  futureDistribution.rows.forEach(row => {
    const bar = '#'.repeat(Math.min(50, Math.floor(row.cnt / 100)));
    console.log(`    ${row.date}: ${row.cnt.toString().padStart(5)} times across ${row.courses.toString().padStart(2)} courses ${colorize(bar, 'dim')}`);
  });

  // Check data staleness
  const staleData = await db.execute(`
    SELECT COUNT(*) as cnt FROM tee_times WHERE date < date('now')
  `);

  if (staleData.rows[0].cnt > 0) {
    printStatus('Past tee times in database', 'warn', `${staleData.rows[0].cnt} records`);
    warnings.push(`${staleData.rows[0].cnt} past tee times should be cleaned up`);
  } else {
    printStatus('No past tee times (data is clean)', 'ok');
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  printHeader('HEALTH CHECK SUMMARY');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nCompleted in ${elapsed}s\n`);

  if (issues.length === 0 && warnings.length === 0) {
    console.log(colorize('  All systems healthy. No issues detected.', 'green'));
  } else {
    if (issues.length > 0) {
      console.log(colorize(`\n  CRITICAL ISSUES (${issues.length}):`, 'red'));
      issues.forEach((issue, i) => {
        console.log(`    ${i + 1}. ${issue}`);
      });
    }

    if (warnings.length > 0) {
      console.log(colorize(`\n  WARNINGS (${warnings.length}):`, 'yellow'));
      warnings.slice(0, 10).forEach((warning, i) => {
        console.log(`    ${i + 1}. ${warning}`);
      });
      if (warnings.length > 10) {
        console.log(`    ... and ${warnings.length - 10} more warnings`);
      }
    }
  }

  // Action items
  if (issues.length > 0 || warnings.length > 0) {
    console.log(colorize('\n  RECOMMENDED ACTIONS:', 'cyan'));

    if (issues.some(i => i.includes('No tee time data'))) {
      console.log('    1. Run full scrape: node scripts/full-scrape-parallel.js');
    }

    if (warnings.some(w => w.includes('No fresh data'))) {
      console.log('    2. Check scraper logs for failing sources');
    }

    if (warnings.some(w => w.includes('mismatch'))) {
      console.log('    3. Update src/db/courses.js to fix booking_system mismatches');
    }

    if (warnings.some(w => w.includes('past tee times'))) {
      console.log('    4. Run cleanup: DELETE FROM tee_times WHERE date < date("now")');
    }

    if (warnings.some(w => w.includes('Duplicate course'))) {
      console.log('    5. Review and deduplicate courses in src/db/courses.js');
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Exit with appropriate code
  process.exit(issues.length > 0 ? 1 : 0);
}

// Run health check
runHealthCheck().catch(error => {
  console.error(colorize(`\nFATAL ERROR: ${error.message}`, 'red'));
  console.error(error.stack);
  process.exit(1);
});
