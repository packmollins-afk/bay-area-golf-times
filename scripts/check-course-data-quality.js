const { createClient } = require('@libsql/client');

// Turso connection
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://bay-area-golf-bayareagolfnow.aws-us-west-2.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkDataQuality() {
  console.log('=== Course Data Quality Report ===\n');

  // 1. Get total course count
  const totalResult = await db.execute('SELECT COUNT(*) as count FROM courses');
  const totalCourses = totalResult.rows[0].count;
  console.log(`Total courses in database: ${totalCourses}\n`);

  // 2. Check for missing name, city, region
  console.log('--- Check 1: Courses missing name, city, or region ---');
  const missingBasicInfo = await db.execute(`
    SELECT id, name, city, region
    FROM courses
    WHERE name IS NULL OR name = ''
       OR city IS NULL OR city = ''
       OR region IS NULL OR region = ''
  `);

  if (missingBasicInfo.rows.length === 0) {
    console.log('PASS: All courses have name, city, and region');
  } else {
    console.log(`FAIL: ${missingBasicInfo.rows.length} courses missing basic info:`);
    missingBasicInfo.rows.forEach(row => {
      console.log(`  ID ${row.id}: name="${row.name}", city="${row.city}", region="${row.region}"`);
    });
  }

  // 3. Check for missing booking_system and booking_url
  console.log('\n--- Check 2: Courses missing booking_system or booking_url ---');
  const missingBookingSystem = await db.execute(`
    SELECT id, name, booking_system, booking_url
    FROM courses
    WHERE booking_system IS NULL OR booking_system = ''
    ORDER BY name
  `);

  const missingBookingUrl = await db.execute(`
    SELECT id, name, booking_system, booking_url
    FROM courses
    WHERE booking_url IS NULL OR booking_url = ''
    ORDER BY name
  `);

  console.log(`\nCourses missing booking_system: ${missingBookingSystem.rows.length}`);
  if (missingBookingSystem.rows.length > 0) {
    missingBookingSystem.rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.name} (booking_url: ${row.booking_url || 'NULL'})`);
    });
  }

  console.log(`\nCourses missing booking_url: ${missingBookingUrl.rows.length}`);
  if (missingBookingUrl.rows.length > 0) {
    missingBookingUrl.rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.name} (booking_system: ${row.booking_system || 'NULL'})`);
    });
  }

  // 4. Check for duplicate courses (by name)
  console.log('\n--- Check 3: Duplicate courses (by name) ---');
  const duplicatesByName = await db.execute(`
    SELECT name, COUNT(*) as count, GROUP_CONCAT(id) as ids
    FROM courses
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);

  if (duplicatesByName.rows.length === 0) {
    console.log('PASS: No duplicate courses by name');
  } else {
    console.log(`FAIL: ${duplicatesByName.rows.length} duplicate course names found:`);
    duplicatesByName.rows.forEach(row => {
      console.log(`  "${row.name}" appears ${row.count} times (IDs: ${row.ids})`);
    });
  }

  // 5. Check for duplicate slugs
  console.log('\n--- Check 4: Duplicate slugs ---');
  const duplicateSlugs = await db.execute(`
    SELECT slug, COUNT(*) as count, GROUP_CONCAT(id) as ids
    FROM courses
    WHERE slug IS NOT NULL AND slug != ''
    GROUP BY slug
    HAVING COUNT(*) > 1
  `);

  if (duplicateSlugs.rows.length === 0) {
    console.log('PASS: No duplicate slugs');
  } else {
    console.log(`FAIL: ${duplicateSlugs.rows.length} duplicate slugs found:`);
    duplicateSlugs.rows.forEach(row => {
      console.log(`  "${row.slug}" appears ${row.count} times (IDs: ${row.ids})`);
    });
  }

  // 6. Check for orphaned courses (courses without any tee times ever)
  console.log('\n--- Check 5: Orphaned courses (no tee times ever) ---');
  const orphanedCourses = await db.execute(`
    SELECT c.id, c.name, c.booking_system
    FROM courses c
    LEFT JOIN tee_times t ON c.id = t.course_id
    WHERE t.id IS NULL
    ORDER BY c.name
  `);

  console.log(`Courses with no tee times: ${orphanedCourses.rows.length}`);
  if (orphanedCourses.rows.length > 0) {
    orphanedCourses.rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.name} (booking_system: ${row.booking_system || 'NULL'})`);
    });
  }

  // 7. Summary by booking system
  console.log('\n--- Summary by Booking System ---');
  const byBookingSystem = await db.execute(`
    SELECT
      COALESCE(booking_system, 'NULL') as booking_system,
      COUNT(*) as count
    FROM courses
    GROUP BY booking_system
    ORDER BY count DESC
  `);

  byBookingSystem.rows.forEach(row => {
    console.log(`  ${row.booking_system}: ${row.count} courses`);
  });

  // 8. Summary by region
  console.log('\n--- Summary by Region ---');
  const byRegion = await db.execute(`
    SELECT
      COALESCE(region, 'NULL') as region,
      COUNT(*) as count
    FROM courses
    GROUP BY region
    ORDER BY count DESC
  `);

  byRegion.rows.forEach(row => {
    console.log(`  ${row.region}: ${row.count} courses`);
  });

  // 9. List all courses with their booking info
  console.log('\n--- All Courses Overview ---');
  const allCourses = await db.execute(`
    SELECT id, name, city, region, booking_system,
           CASE WHEN booking_url IS NOT NULL AND booking_url != '' THEN 'Yes' ELSE 'No' END as has_booking_url
    FROM courses
    ORDER BY name
  `);

  console.log(`\nID | Name | City | Region | Booking System | Has URL`);
  console.log('---|------|------|--------|----------------|--------');
  allCourses.rows.forEach(row => {
    console.log(`${row.id} | ${row.name} | ${row.city} | ${row.region} | ${row.booking_system || 'NULL'} | ${row.has_booking_url}`);
  });

  // Final summary
  console.log('\n=== Data Quality Summary ===');
  const coursesWithAllBasicInfo = totalCourses - missingBasicInfo.rows.length;
  const coursesWithBookingSystem = totalCourses - missingBookingSystem.rows.length;
  const coursesWithBookingUrl = totalCourses - missingBookingUrl.rows.length;

  console.log(`Total courses: ${totalCourses}`);
  console.log(`Courses with name/city/region: ${coursesWithAllBasicInfo} (${(coursesWithAllBasicInfo/totalCourses*100).toFixed(1)}%)`);
  console.log(`Courses with booking_system: ${coursesWithBookingSystem} (${(coursesWithBookingSystem/totalCourses*100).toFixed(1)}%)`);
  console.log(`Courses with booking_url: ${coursesWithBookingUrl} (${(coursesWithBookingUrl/totalCourses*100).toFixed(1)}%)`);
  console.log(`Duplicate course names: ${duplicatesByName.rows.length}`);
  console.log(`Courses without tee times: ${orphanedCourses.rows.length}`);
}

checkDataQuality()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
