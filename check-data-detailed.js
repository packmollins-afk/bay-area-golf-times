const { createClient } = require('@libsql/client');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Turso connection
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function generateDetailedReport() {
  try {
    console.log('='.repeat(80));
    console.log('COURSE DATA COMPLETENESS REPORT FOR SEO PAGES');
    console.log('='.repeat(80));
    console.log('');

    // Total count
    const totalResult = await db.execute('SELECT COUNT(*) as count FROM courses');
    const totalCourses = totalResult.rows[0].count;
    console.log(`TOTAL COURSES: ${totalCourses}\n`);

    // 1. LATITUDE/LONGITUDE COMPLETENESS
    console.log('1. LATITUDE/LONGITUDE (Required for Interactive Maps)');
    console.log('-'.repeat(80));
    const coordResult = await db.execute(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as complete
      FROM courses
    `);
    const coordData = coordResult.rows[0];
    const coordPct = ((coordData.complete / totalCourses) * 100).toFixed(2);
    console.log(`Status: ${coordData.complete}/${totalCourses} courses have coordinates (${coordPct}%)`);
    console.log(`Missing: ${totalCourses - coordData.complete} courses`);

    const missingCoordCourses = await db.execute(`
      SELECT id, name, city FROM courses
      WHERE latitude IS NULL OR longitude IS NULL
      ORDER BY name
    `);
    if (missingCoordCourses.rows.length > 0) {
      console.log('\nCourses missing coordinates:');
      for (const course of missingCoordCourses.rows) {
        console.log(`  - ${course.name} (${course.city})`);
      }
    }
    console.log('');

    // 2. PHONE NUMBERS COMPLETENESS
    console.log('2. PHONE NUMBERS (Important for User Contact)');
    console.log('-'.repeat(80));
    const phoneResult = await db.execute(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END) as complete
      FROM courses
    `);
    const phoneData = phoneResult.rows[0];
    const phonePct = ((phoneData.complete / totalCourses) * 100).toFixed(2);
    console.log(`Status: ${phoneData.complete}/${totalCourses} courses have phone numbers (${phonePct}%)`);
    console.log(`Missing: ${totalCourses - phoneData.complete} courses`);

    const missingPhoneCourses = await db.execute(`
      SELECT id, name, city FROM courses
      WHERE phone_number IS NULL
      ORDER BY name
    `);
    if (missingPhoneCourses.rows.length > 0) {
      console.log('\nCourses missing phone numbers:');
      for (const course of missingPhoneCourses.rows) {
        console.log(`  - ${course.name} (${course.city})`);
      }
    }
    console.log('');

    // 3. PAR/YARDAGE COMPLETENESS
    console.log('3. PAR & YARDAGE DATA (Critical for SEO & Course Info)');
    console.log('-'.repeat(80));
    const parYardageResult = await db.execute(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN par IS NOT NULL THEN 1 END) as with_par,
        COUNT(CASE WHEN yardage IS NOT NULL THEN 1 END) as with_yardage,
        COUNT(CASE WHEN par IS NOT NULL AND yardage IS NOT NULL THEN 1 END) as with_both
      FROM courses
    `);
    const pyData = parYardageResult.rows[0];
    const parPct = ((pyData.with_par / totalCourses) * 100).toFixed(2);
    const yardagePct = ((pyData.with_yardage / totalCourses) * 100).toFixed(2);
    const bothPct = ((pyData.with_both / totalCourses) * 100).toFixed(2);
    console.log(`Par data: ${pyData.with_par}/${totalCourses} courses (${parPct}%)`);
    console.log(`Yardage data: ${pyData.with_yardage}/${totalCourses} courses (${yardagePct}%)`);
    console.log(`Both par & yardage: ${pyData.with_both}/${totalCourses} courses (${bothPct}%)`);
    console.log(`Missing both: ${totalCourses - pyData.with_both} courses`);

    const missingParYardageCourses = await db.execute(`
      SELECT id, name, city, par, yardage FROM courses
      WHERE par IS NULL OR yardage IS NULL
      ORDER BY name
    `);
    if (missingParYardageCourses.rows.length > 0) {
      console.log('\nCourses missing par and/or yardage:');
      for (const course of missingParYardageCourses.rows) {
        const missing = [];
        if (course.par === null) missing.push('par');
        if (course.yardage === null) missing.push('yardage');
        console.log(`  - ${course.name} (${course.city}): missing ${missing.join(', ')}`);
      }
    }
    console.log('');

    // 4. BOOKING URLS COMPLETENESS
    console.log('4. BOOKING URLS (Required for Tee Time Availability)');
    console.log('-'.repeat(80));
    const bookingResult = await db.execute(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN booking_url IS NOT NULL THEN 1 END) as complete,
        COUNT(CASE WHEN booking_url IS NULL THEN 1 END) as missing
      FROM courses
    `);
    const bookingData = bookingResult.rows[0];
    const bookingPct = ((bookingData.complete / totalCourses) * 100).toFixed(2);
    console.log(`Status: ${bookingData.complete}/${totalCourses} courses have booking URLs (${bookingPct}%)`);
    console.log(`Missing: ${bookingData.missing}`);
    console.log('');

    // 5. BOOKING SYSTEM DISTRIBUTION
    console.log('5. BOOKING SYSTEM DISTRIBUTION');
    console.log('-'.repeat(80));
    const bookingSystemResult = await db.execute(`
      SELECT booking_system, COUNT(*) as count
      FROM courses
      GROUP BY booking_system
      ORDER BY count DESC
    `);
    for (const system of bookingSystemResult.rows) {
      const sysPct = ((system.count / totalCourses) * 100).toFixed(2);
      console.log(`  ${system.booking_system}: ${system.count} courses (${sysPct}%)`);
    }
    console.log('');

    // 6. SEO-SPECIFIC METRICS
    console.log('6. SEO PAGE DATA COMPLETENESS');
    console.log('-'.repeat(80));
    const seoResult = await db.execute(`
      SELECT
        COUNT(CASE WHEN
          name IS NOT NULL AND
          city IS NOT NULL AND
          region IS NOT NULL AND
          latitude IS NOT NULL AND
          longitude IS NOT NULL AND
          phone_number IS NOT NULL AND
          par IS NOT NULL AND
          yardage IS NOT NULL AND
          booking_url IS NOT NULL AND
          slug IS NOT NULL
        THEN 1 END) as seo_ready,
        COUNT(*) as total
      FROM courses
    `);
    const seoData = seoResult.rows[0];
    const seoPct = ((seoData.seo_ready / totalCourses) * 100).toFixed(2);
    console.log(`Courses SEO-ready (all essential fields): ${seoData.seo_ready}/${totalCourses} (${seoPct}%)`);
    console.log(`Courses needing SEO work: ${totalCourses - seoData.seo_ready}`);
    console.log('');

    // 7. DATA QUALITY METRICS
    console.log('7. DATA QUALITY SUMMARY');
    console.log('-'.repeat(80));
    const summaryResult = await db.execute(`
      SELECT
        name,
        city,
        region,
        CASE WHEN latitude IS NULL OR longitude IS NULL THEN 0 ELSE 1 END as has_coords,
        CASE WHEN phone_number IS NULL THEN 0 ELSE 1 END as has_phone,
        CASE WHEN par IS NULL OR yardage IS NULL THEN 0 ELSE 1 END as has_par_yardage,
        CASE WHEN booking_url IS NULL THEN 0 ELSE 1 END as has_booking_url
      FROM courses
      ORDER BY
        (CASE WHEN latitude IS NULL OR longitude IS NULL THEN 0 ELSE 1 END +
         CASE WHEN phone_number IS NULL THEN 0 ELSE 1 END +
         CASE WHEN par IS NULL OR yardage IS NULL THEN 0 ELSE 1 END +
         CASE WHEN booking_url IS NULL THEN 0 ELSE 1 END) ASC,
        name
    `);

    let fullCount = 0, partial = 0, minimal = 0;
    for (const course of summaryResult.rows) {
      const score = course.has_coords + course.has_phone + course.has_par_yardage + course.has_booking_url;
      if (score === 4) fullCount++;
      else if (score >= 2) partial++;
      else minimal++;
    }

    console.log(`Courses with full SEO data (4/4 metrics): ${fullCount}`);
    console.log(`Courses with partial data (2-3/4 metrics): ${partial}`);
    console.log(`Courses with minimal data (0-1/4 metrics): ${minimal}`);
    console.log('');

    // 8. RECOMMENDATIONS
    console.log('8. RECOMMENDATIONS FOR SEO IMPROVEMENT');
    console.log('-'.repeat(80));
    console.log(`CRITICAL: Add missing data to improve SEO pages`);
    console.log(`  - ${totalCourses - coordData.complete} courses need coordinates (affects maps)`);
    console.log(`  - ${totalCourses - phoneData.complete} courses need phone numbers (affects user experience)`);
    console.log(`  - ${totalCourses - pyData.with_both} courses need par/yardage data (affects SEO)`);
    console.log(`  - Priority: Update the ${Math.min(10, totalCourses - coordData.complete)} courses with most missing data`);
    console.log('');

    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

generateDetailedReport().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
