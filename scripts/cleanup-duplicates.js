#!/usr/bin/env node
/**
 * Database Cleanup Script
 * Removes duplicate records from Turso database
 *
 * Issues fixed:
 * 1. Duplicate tee_times (same course/date/time, different sources)
 * 2. Duplicate courses (Napa Golf Course)
 *
 * Usage: node scripts/cleanup-duplicates.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const isDryRun = process.argv.includes('--dry-run');

async function cleanup() {
  console.log('=================================================================');
  console.log('DATABASE CLEANUP SCRIPT');
  console.log(isDryRun ? 'MODE: DRY RUN (no changes will be made)' : 'MODE: LIVE');
  console.log('=================================================================\n');

  try {
    // =================================================================
    // ISSUE 1: Duplicate tee_times
    // =================================================================
    console.log('--- ISSUE 1: Duplicate Tee Times ---\n');

    // First, find current duplicates (they may have changed since analysis)
    const dupes = await db.execute(`
      SELECT t1.id as id1, t2.id as id2,
             t1.price as price1, t2.price as price2,
             t1.source as source1, t2.source as source2,
             t1.course_id, t1.date, t1.time
      FROM tee_times t1
      INNER JOIN tee_times t2
        ON t1.course_id = t2.course_id
        AND t1.date = t2.date
        AND t1.time = t2.time
        AND t1.id < t2.id
      ORDER BY t1.course_id, t1.date, t1.time
    `);

    if (dupes.rows.length === 0) {
      console.log('No duplicate tee times found.\n');
    } else {
      console.log(`Found ${dupes.rows.length} duplicate tee time pairs:\n`);

      const idsToDelete = [];
      dupes.rows.forEach(row => {
        // Keep the one with lower price; if same price, keep older (lower ID)
        const deleteId = row.price1 <= row.price2 ? row.id2 : row.id1;
        const keepId = row.price1 <= row.price2 ? row.id1 : row.id2;
        idsToDelete.push(deleteId);

        console.log(`  Course ${row.course_id}, ${row.date} ${row.time}:`);
        console.log(`    Keep ID ${keepId} (${row.price1 <= row.price2 ? row.source1 : row.source2}, $${row.price1 <= row.price2 ? row.price1 : row.price2})`);
        console.log(`    Delete ID ${deleteId} (${row.price1 <= row.price2 ? row.source2 : row.source1}, $${row.price1 <= row.price2 ? row.price2 : row.price1})\n`);
      });

      if (!isDryRun) {
        const result = await db.execute(
          `DELETE FROM tee_times WHERE id IN (${idsToDelete.join(', ')})`
        );
        console.log(`Deleted ${result.rowsAffected} duplicate tee time records.\n`);
      } else {
        console.log(`Would delete ${idsToDelete.length} records: [${idsToDelete.join(', ')}]\n`);
      }
    }

    // =================================================================
    // ISSUE 2: Duplicate courses (Napa Golf Course)
    // =================================================================
    console.log('--- ISSUE 2: Duplicate Courses ---\n');

    // Check if both Napa courses still exist
    const napaCourses = await db.execute(`
      SELECT id, name, golfnow_id, booking_system
      FROM courses
      WHERE id IN (403, 429)
      ORDER BY id
    `);

    if (napaCourses.rows.length === 2) {
      console.log('Found duplicate Napa Golf Course entries:');
      napaCourses.rows.forEach(row => {
        console.log(`  ID ${row.id}: "${row.name}" (${row.booking_system})`);
      });
      console.log('');

      if (!isDryRun) {
        // Step 1: Transfer tee_times
        const ttResult = await db.execute(
          'UPDATE tee_times SET course_id = 429 WHERE course_id = 403'
        );
        console.log(`Transferred ${ttResult.rowsAffected} tee times from course 403 to 429.`);

        // Step 2: Transfer related records
        const revResult = await db.execute(
          'UPDATE course_reviews SET course_id = 429 WHERE course_id = 403'
        );
        console.log(`Transferred ${revResult.rowsAffected} course_reviews.`);

        const favResult = await db.execute(
          'UPDATE user_favorites SET course_id = 429 WHERE course_id = 403'
        );
        console.log(`Transferred ${favResult.rowsAffected} favorites.`);

        const roundResult = await db.execute(
          'UPDATE rounds SET course_id = 429 WHERE course_id = 403'
        );
        console.log(`Transferred ${roundResult.rowsAffected} rounds.`);

        // Step 3: Copy valuable data
        await db.execute(`
          UPDATE courses
          SET golfnow_id = '129',
              website_url = 'https://www.playnapa.com/'
          WHERE id = 429
          AND golfnow_id IS NULL
        `);
        console.log('Updated course 429 with golfnow_id and website_url.');

        // Step 4: Delete duplicate
        const delResult = await db.execute('DELETE FROM courses WHERE id = 403');
        console.log(`Deleted ${delResult.rowsAffected} duplicate course record.\n`);
      } else {
        console.log('Would merge course 403 into 429 and delete course 403.\n');
      }
    } else if (napaCourses.rows.length === 1) {
      console.log(`Only one Napa course found (ID ${napaCourses.rows[0].id}). Already cleaned up.\n`);
    } else {
      console.log('Neither Napa course found. Skipping.\n');
    }

    // =================================================================
    // Verification
    // =================================================================
    console.log('--- VERIFICATION ---\n');

    const remainingDupes = await db.execute(`
      SELECT COUNT(*) as count FROM (
        SELECT course_id, date, time
        FROM tee_times
        GROUP BY course_id, date, time
        HAVING COUNT(*) > 1
      )
    `);
    console.log(`Remaining duplicate tee times: ${remainingDupes.rows[0].count}`);

    const orphaned = await db.execute(`
      SELECT COUNT(*) as count
      FROM tee_times t
      LEFT JOIN courses c ON t.course_id = c.id
      WHERE c.id IS NULL
    `);
    console.log(`Orphaned tee times: ${orphaned.rows[0].count}`);

    const stats = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM courses) as total_courses,
        (SELECT COUNT(*) FROM tee_times) as total_tee_times
    `);
    console.log(`Total courses: ${stats.rows[0].total_courses}`);
    console.log(`Total tee times: ${stats.rows[0].total_tee_times}`);

    console.log('\n=================================================================');
    console.log('CLEANUP COMPLETE');
    console.log('=================================================================');

  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanup();
