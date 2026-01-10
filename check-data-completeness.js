const { createClient } = require('@libsql/client');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Turso connection using environment variables
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://bay-area-golf-bayareagolfnow.aws-us-west-2.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkDataCompleteness() {
  try {
    console.log('Connecting to Turso database...\n');

    // Get total count of courses
    const totalResult = await db.execute('SELECT COUNT(*) as count FROM courses');
    const totalCourses = totalResult.rows[0].count;
    console.log(`Total courses in database: ${totalCourses}\n`);

    // Check 1: Latitude/Longitude (for maps)
    console.log('--- LATITUDE/LONGITUDE (For Maps) ---');
    const coordResult = await db.execute(`
      SELECT
        COUNT(*) as count,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coords,
        COUNT(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 END) as missing_coords
      FROM courses
    `);
    const coordData = coordResult.rows[0];
    const coordPercentage = ((coordData.with_coords / totalCourses) * 100).toFixed(2);
    console.log(`Courses with coordinates: ${coordData.with_coords}/${totalCourses} (${coordPercentage}%)`);
    console.log(`Courses missing coordinates: ${coordData.missing_coords}\n`);

    // Check 2: Phone Numbers
    console.log('--- PHONE NUMBERS ---');
    const phoneResult = await db.execute(`
      SELECT
        COUNT(*) as count,
        COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END) as with_phone,
        COUNT(CASE WHEN phone_number IS NULL THEN 1 END) as missing_phone
      FROM courses
    `);
    const phoneData = phoneResult.rows[0];
    const phonePercentage = ((phoneData.with_phone / totalCourses) * 100).toFixed(2);
    console.log(`Courses with phone numbers: ${phoneData.with_phone}/${totalCourses} (${phonePercentage}%)`);
    console.log(`Courses missing phone numbers: ${phoneData.missing_phone}\n`);

    // Check 3: Par/Yardage Data
    console.log('--- PAR/YARDAGE DATA ---');
    const parYardageResult = await db.execute(`
      SELECT
        COUNT(*) as count,
        COUNT(CASE WHEN par IS NOT NULL AND yardage IS NOT NULL THEN 1 END) as with_both,
        COUNT(CASE WHEN par IS NOT NULL THEN 1 END) as with_par,
        COUNT(CASE WHEN yardage IS NOT NULL THEN 1 END) as with_yardage,
        COUNT(CASE WHEN par IS NULL AND yardage IS NULL THEN 1 END) as missing_both
      FROM courses
    `);
    const parYardageData = parYardageResult.rows[0];
    const bothPercentage = ((parYardageData.with_both / totalCourses) * 100).toFixed(2);
    const parPercentage = ((parYardageData.with_par / totalCourses) * 100).toFixed(2);
    const yardagePercentage = ((parYardageData.with_yardage / totalCourses) * 100).toFixed(2);
    console.log(`Courses with both par AND yardage: ${parYardageData.with_both}/${totalCourses} (${bothPercentage}%)`);
    console.log(`Courses with par: ${parYardageData.with_par}/${totalCourses} (${parPercentage}%)`);
    console.log(`Courses with yardage: ${parYardageData.with_yardage}/${totalCourses} (${yardagePercentage}%)`);
    console.log(`Courses missing both par AND yardage: ${parYardageData.missing_both}\n`);

    // Check 4: Booking URLs
    console.log('--- BOOKING URLS ---');
    const bookingResult = await db.execute(`
      SELECT
        COUNT(*) as count,
        COUNT(CASE WHEN booking_url IS NOT NULL THEN 1 END) as with_url,
        COUNT(CASE WHEN booking_url IS NULL THEN 1 END) as missing_url
      FROM courses
    `);
    const bookingData = bookingResult.rows[0];
    const bookingPercentage = ((bookingData.with_url / totalCourses) * 100).toFixed(2);
    console.log(`Courses with booking URLs: ${bookingData.with_url}/${totalCourses} (${bookingPercentage}%)`);
    console.log(`Courses missing booking URLs: ${bookingData.missing_url}\n`);

    // Check 5: Essential Data Completeness
    console.log('--- ESSENTIAL DATA (All of: Name, City, Latitude, Longitude, Phone, Par, Yardage, Booking URL) ---');
    const essentialResult = await db.execute(`
      SELECT
        COUNT(*) as count,
        COUNT(CASE WHEN
          name IS NOT NULL AND
          city IS NOT NULL AND
          latitude IS NOT NULL AND
          longitude IS NOT NULL AND
          phone_number IS NOT NULL AND
          par IS NOT NULL AND
          yardage IS NOT NULL AND
          booking_url IS NOT NULL
        THEN 1 END) as complete,
        COUNT(CASE WHEN
          name IS NOT NULL AND
          city IS NOT NULL AND
          latitude IS NOT NULL AND
          longitude IS NOT NULL AND
          phone_number IS NOT NULL AND
          par IS NOT NULL AND
          yardage IS NOT NULL AND
          booking_url IS NOT NULL
        THEN 0 ELSE 1 END) as incomplete
      FROM courses
    `);
    const essentialData = essentialResult.rows[0];
    const essentialPercentage = ((essentialData.complete / totalCourses) * 100).toFixed(2);
    console.log(`Courses with complete essential data: ${essentialData.complete}/${totalCourses} (${essentialPercentage}%)`);
    console.log(`Courses with incomplete essential data: ${essentialData.incomplete}\n`);

    // Get list of courses missing essential data
    console.log('--- COURSES WITH MISSING ESSENTIAL DATA ---');
    const missingResult = await db.execute(`
      SELECT id, name, city,
        CASE WHEN latitude IS NULL THEN 'MISSING_LAT' ELSE NULL END as lat_issue,
        CASE WHEN longitude IS NULL THEN 'MISSING_LON' ELSE NULL END as lon_issue,
        CASE WHEN phone_number IS NULL THEN 'MISSING_PHONE' ELSE NULL END as phone_issue,
        CASE WHEN par IS NULL THEN 'MISSING_PAR' ELSE NULL END as par_issue,
        CASE WHEN yardage IS NULL THEN 'MISSING_YARDAGE' ELSE NULL END as yardage_issue,
        CASE WHEN booking_url IS NULL THEN 'MISSING_BOOKING_URL' ELSE NULL END as booking_issue
      FROM courses
      WHERE
        latitude IS NULL OR
        longitude IS NULL OR
        phone_number IS NULL OR
        par IS NULL OR
        yardage IS NULL OR
        booking_url IS NULL
      ORDER BY name
    `);

    if (missingResult.rows.length > 0) {
      console.log(`Found ${missingResult.rows.length} courses with missing essential data:\n`);
      for (const row of missingResult.rows) {
        const issues = [row.lat_issue, row.lon_issue, row.phone_issue, row.par_issue, row.yardage_issue, row.booking_issue]
          .filter(issue => issue !== null)
          .join(', ');
        console.log(`  ${row.name} (${row.city}): ${issues}`);
      }
    } else {
      console.log('All courses have complete essential data!');
    }

    console.log('\n--- DATA COMPLETENESS SUMMARY ---');
    console.log(`Total Courses: ${totalCourses}`);
    console.log(`Maps Data (Lat/Lon): ${coordPercentage}%`);
    console.log(`Phone Numbers: ${phonePercentage}%`);
    console.log(`Par/Yardage: ${bothPercentage}%`);
    console.log(`Booking URLs: ${bookingPercentage}%`);
    console.log(`Full Essential Data: ${essentialPercentage}%`);

  } catch (error) {
    console.error('Error checking data completeness:', error);
    process.exit(1);
  }
}

checkDataCompleteness().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
