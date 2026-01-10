const { createClient } = require('@libsql/client');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Turso connection
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function generateSEOPriority() {
  try {
    console.log('');
    console.log('='.repeat(100));
    console.log('HIGH-PRIORITY COURSES FOR SEO DATA COMPLETION');
    console.log('='.repeat(100));
    console.log('');

    // Identify courses with the most missing critical SEO data
    const priorityResult = await db.execute(`
      SELECT
        id,
        name,
        city,
        region,
        booking_system,
        (CASE WHEN latitude IS NULL THEN 1 ELSE 0 END +
         CASE WHEN longitude IS NULL THEN 1 ELSE 0 END +
         CASE WHEN phone_number IS NULL THEN 1 ELSE 0 END +
         CASE WHEN yardage IS NULL THEN 1 ELSE 0 END) as missing_count,
        CASE WHEN latitude IS NULL OR longitude IS NULL THEN 'Yes' ELSE 'No' END as needs_coords,
        CASE WHEN phone_number IS NULL THEN 'Yes' ELSE 'No' END as needs_phone,
        CASE WHEN yardage IS NULL THEN 'Yes' ELSE 'No' END as needs_yardage
      FROM courses
      WHERE
        latitude IS NULL OR
        longitude IS NULL OR
        phone_number IS NULL OR
        yardage IS NULL
      ORDER BY missing_count DESC, name
    `);

    console.log('COURSES RANKED BY NUMBER OF MISSING SEO FIELDS');
    console.log('-'.repeat(100));
    console.log('');

    let currentMissingCount = -1;
    for (const course of priorityResult.rows) {
      if (course.missing_count !== currentMissingCount) {
        currentMissingCount = course.missing_count;
        console.log(`\n[${course.missing_count} MISSING FIELDS]`);
        console.log('-'.repeat(100));
      }

      const missingFields = [];
      if (course.needs_coords === 'Yes') missingFields.push('Lat/Lon');
      if (course.needs_phone === 'Yes') missingFields.push('Phone');
      if (course.needs_yardage === 'Yes') missingFields.push('Yardage');

      console.log(`${course.name}`);
      console.log(`  Location: ${course.city}, ${course.region}`);
      console.log(`  Booking System: ${course.booking_system}`);
      console.log(`  Missing: ${missingFields.join(', ')}`);
      console.log('');
    }

    // Summary by booking system
    console.log('');
    console.log('='.repeat(100));
    console.log('MISSING DATA BY BOOKING SYSTEM');
    console.log('='.repeat(100));
    console.log('');

    const bySystemResult = await db.execute(`
      SELECT
        booking_system,
        COUNT(*) as total_courses,
        COUNT(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 END) as missing_coords,
        COUNT(CASE WHEN phone_number IS NULL THEN 1 END) as missing_phone,
        COUNT(CASE WHEN yardage IS NULL THEN 1 END) as missing_yardage
      FROM courses
      GROUP BY booking_system
      ORDER BY total_courses DESC
    `);

    for (const system of bySystemResult.rows) {
      if (system.missing_coords > 0 || system.missing_phone > 0 || system.missing_yardage > 0) {
        console.log(`${system.booking_system.toUpperCase()}: ${system.total_courses} total courses`);
        console.log(`  - Missing coordinates: ${system.missing_coords} courses`);
        console.log(`  - Missing phone: ${system.missing_phone} courses`);
        console.log(`  - Missing yardage: ${system.missing_yardage} courses`);
        console.log('');
      }
    }

    // Quick action items
    console.log('='.repeat(100));
    console.log('QUICK ACTION ITEMS FOR DEVELOPERS');
    console.log('='.repeat(100));
    console.log('');

    const topMissingCoords = await db.execute(`
      SELECT name, city FROM courses
      WHERE latitude IS NULL OR longitude IS NULL
      ORDER BY name
      LIMIT 5
    `);

    console.log('1. ADD COORDINATES TO TOP 5 COURSES (affects maps):');
    for (const course of topMissingCoords.rows) {
      console.log(`   - Use Google Maps API or similar to get lat/lon for "${course.name}, ${course.city}"`);
    }
    console.log('');

    const topMissingPhone = await db.execute(`
      SELECT name, city FROM courses
      WHERE phone_number IS NULL
      ORDER BY name
      LIMIT 5
    `);

    console.log('2. ADD PHONE NUMBERS TO TOP 5 COURSES (affects UX):');
    for (const course of topMissingPhone.rows) {
      console.log(`   - Search online for phone number of "${course.name}, ${course.city}"`);
    }
    console.log('');

    const topMissingYardage = await db.execute(`
      SELECT name, city FROM courses
      WHERE yardage IS NULL
      ORDER BY name
      LIMIT 5
    `);

    console.log('3. ADD YARDAGE TO TOP 5 COURSES (affects SEO):');
    for (const course of topMissingYardage.rows) {
      console.log(`   - Find yardage data from course website or Golf.com for "${course.name}, ${course.city}"`);
    }
    console.log('');
    console.log('='.repeat(100));
    console.log('');

  } catch (error) {
    console.error('Error generating SEO priority report:', error);
    process.exit(1);
  }
}

generateSEOPriority().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
