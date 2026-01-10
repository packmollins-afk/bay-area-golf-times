const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://bay-area-golf-bayareagolfnow.aws-us-west-2.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkDataFreshness() {
  console.log('=== TEE TIME DATA FRESHNESS REPORT ===\n');
  console.log('Current time (UTC):', new Date().toISOString());
  console.log('');

  // 1. Check scraped_at timestamps
  console.log('--- 1. SCRAPED_AT TIMESTAMP ANALYSIS ---\n');

  // Get min/max scraped_at
  const timestampStats = await db.execute(`
    SELECT
      MIN(scraped_at) as oldest_scrape,
      MAX(scraped_at) as newest_scrape,
      COUNT(*) as total_tee_times
    FROM tee_times
  `);
  console.log('Timestamp Statistics:');
  console.log(JSON.stringify(timestampStats.rows[0], null, 2));
  console.log('');

  // Check how many tee times have scraped_at within last hour
  const recentScrapes = await db.execute(`
    SELECT
      COUNT(*) as within_last_hour,
      (SELECT COUNT(*) FROM tee_times) as total
    FROM tee_times
    WHERE scraped_at >= datetime('now', '-1 hour')
  `);
  console.log('Recent Scrapes (within last hour):');
  console.log(JSON.stringify(recentScrapes.rows[0], null, 2));
  console.log('');

  // Get scrape age distribution
  const scrapeAgeDistribution = await db.execute(`
    SELECT
      CASE
        WHEN scraped_at >= datetime('now', '-1 hour') THEN 'Within 1 hour'
        WHEN scraped_at >= datetime('now', '-6 hours') THEN '1-6 hours ago'
        WHEN scraped_at >= datetime('now', '-24 hours') THEN '6-24 hours ago'
        WHEN scraped_at >= datetime('now', '-7 days') THEN '1-7 days ago'
        ELSE 'Older than 7 days'
      END as age_bucket,
      COUNT(*) as count
    FROM tee_times
    GROUP BY 1
    ORDER BY
      CASE
        WHEN scraped_at >= datetime('now', '-1 hour') THEN 1
        WHEN scraped_at >= datetime('now', '-6 hours') THEN 2
        WHEN scraped_at >= datetime('now', '-24 hours') THEN 3
        WHEN scraped_at >= datetime('now', '-7 days') THEN 4
        ELSE 5
      END
  `);
  console.log('Scrape Age Distribution:');
  for (const row of scrapeAgeDistribution.rows) {
    console.log('  ' + row.age_bucket + ': ' + row.count + ' tee times');
  }
  console.log('');

  // 2. Check date range coverage
  console.log('--- 2. DATE RANGE COVERAGE (Next 7 Days) ---\n');

  const today = new Date().toISOString().split('T')[0];
  const next7Days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    next7Days.push(d.toISOString().split('T')[0]);
  }
  console.log('Expected dates:', next7Days.join(', '));
  console.log('');

  // Get tee times count by date for next 7 days
  const dateDistribution = await db.execute(`
    SELECT
      date,
      COUNT(*) as tee_time_count,
      COUNT(DISTINCT course_id) as courses_with_data
    FROM tee_times
    WHERE date >= date('now')
    AND date <= date('now', '+7 days')
    GROUP BY date
    ORDER BY date
  `);
  console.log('Date Distribution (next 7 days):');
  for (const row of dateDistribution.rows) {
    console.log('  ' + row.date + ': ' + row.tee_time_count + ' tee times across ' + row.courses_with_data + ' courses');
  }
  console.log('');

  // Check for missing dates
  const datesWithData = dateDistribution.rows.map(r => r.date);
  const missingDates = next7Days.filter(d => !datesWithData.includes(d));
  if (missingDates.length > 0) {
    console.log('MISSING DATES:', missingDates.join(', '));
  } else {
    console.log('All 7 days have data coverage');
  }
  console.log('');

  // 3. Check for gaps - courses without recent tee times
  console.log('--- 3. COURSE DATA GAPS ---\n');

  // Get total courses
  const totalCourses = await db.execute('SELECT COUNT(*) as count FROM courses');
  console.log('Total courses in database:', totalCourses.rows[0].count);

  // Get courses with tee times today or later
  const coursesWithData = await db.execute(`
    SELECT COUNT(DISTINCT course_id) as count
    FROM tee_times
    WHERE date >= date('now')
  `);
  console.log('Courses with future tee times:', coursesWithData.rows[0].count);
  console.log('');

  // Get courses without any tee time data for next 7 days
  const coursesWithoutData = await db.execute(`
    SELECT c.id, c.name, c.booking_system
    FROM courses c
    WHERE c.id NOT IN (
      SELECT DISTINCT course_id
      FROM tee_times
      WHERE date >= date('now')
    )
    ORDER BY c.name
  `);
  console.log('Courses WITHOUT future tee times (' + coursesWithoutData.rows.length + '):');
  for (const row of coursesWithoutData.rows) {
    console.log('  - ' + row.name + ' (ID: ' + row.id + ', System: ' + (row.booking_system || 'unknown') + ')');
  }
  console.log('');

  // 4. Per-course scrape freshness
  console.log('--- 4. PER-COURSE SCRAPE FRESHNESS ---\n');

  const perCourseFreshness = await db.execute(`
    SELECT
      c.name,
      c.booking_system,
      MAX(t.scraped_at) as last_scraped,
      COUNT(t.id) as tee_time_count,
      ROUND((julianday('now') - julianday(MAX(t.scraped_at))) * 24 * 60, 1) as minutes_since_scrape
    FROM courses c
    LEFT JOIN tee_times t ON c.id = t.course_id AND t.date >= date('now')
    GROUP BY c.id
    HAVING tee_time_count > 0
    ORDER BY minutes_since_scrape DESC
    LIMIT 20
  `);
  console.log('Courses with OLDEST scrapes (potential staleness):');
  for (const row of perCourseFreshness.rows) {
    const ageMinutes = row.minutes_since_scrape || 0;
    const status = ageMinutes > 60 ? '[STALE]' : '[OK]';
    console.log('  ' + status + ' ' + row.name + ': ' + ageMinutes + ' min ago (' + row.tee_time_count + ' tee times)');
  }
  console.log('');

  // Summary
  console.log('=== SUMMARY ===');
  const withinHour = recentScrapes.rows[0].within_last_hour;
  const total = recentScrapes.rows[0].total;
  const pctFresh = total > 0 ? ((withinHour / total) * 100).toFixed(1) : '0';
  console.log('Data freshness: ' + pctFresh + '% of tee times scraped within last hour');
  console.log('Date coverage: ' + (7 - missingDates.length) + '/7 days have data');
  console.log('Course coverage: ' + coursesWithData.rows[0].count + '/' + totalCourses.rows[0].count + ' courses have future tee times');
}

checkDataFreshness().catch(console.error);
