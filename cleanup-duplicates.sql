-- =================================================================
-- DATABASE CLEANUP SCRIPT
-- Generated: 2026-01-08
-- Database: bay-area-golf-bayareagolfnow.aws-us-west-2.turso.io
--
-- STATUS: COMPLETED on 2026-01-08
-- Results:
--   - Deleted 17 duplicate tee_time records
--   - Merged duplicate Napa Golf Course (ID 403 -> 429)
--   - Deleted 1 duplicate course record
--   - Final: 86 courses, 4160 tee_times, 0 duplicates, 0 orphans
-- =================================================================

-- =================================================================
-- ISSUE 1: DUPLICATE TEE TIMES (12 records)
-- =================================================================
-- These are the same tee times scraped from different booking sources
-- (chronogolf vs golfnow). The duplicates have HIGHER prices, so we
-- keep the lower-priced versions for better user value.
--
-- Affected courses:
--   - ID 380: Tilden Park Golf Course (6 duplicates)
--   - ID 400: Redwood Canyon Golf Course (6 duplicates)
-- =================================================================

DELETE FROM tee_times
WHERE id IN (
    204267,  -- course 380, 2026-01-09 07:10, chronogolf $59 (keeping golfnow $42)
    204515,  -- course 380, 2026-01-10 10:40, chronogolf $75 (keeping golfnow $45)
    204718,  -- course 380, 2026-01-11 09:10, chronogolf $75 (keeping golfnow $45)
    205133,  -- course 380, 2026-01-12 07:00, chronogolf $49 (keeping golfnow $39)
    205674,  -- course 380, 2026-01-13 07:00, chronogolf $49 (keeping golfnow $39)
    206117,  -- course 380, 2026-01-14 07:20, chronogolf $49 (keeping golfnow $39)
    204264,  -- course 400, 2026-01-09 07:00, chronogolf $44 (keeping golfnow $27)
    204522,  -- course 400, 2026-01-10 11:21, chronogolf $53 (keeping golfnow $28)
    204692,  -- course 400, 2026-01-11 07:09, chronogolf $53 (keeping golfnow $28)
    205132,  -- course 400, 2026-01-12 07:00, chronogolf $40 (keeping golfnow $26)
    205673,  -- course 400, 2026-01-13 07:00, chronogolf $40 (keeping golfnow $26)
    206112   -- course 400, 2026-01-14 07:00, chronogolf $40 (keeping golfnow $26)
);

-- =================================================================
-- ISSUE 2: DUPLICATE COURSES (Napa Golf Course)
-- =================================================================
-- Two entries exist for the same course:
--   - ID 403: "Napa Golf Course at Kennedy Park" (golfnow, 7 tee times)
--   - ID 429: "Napa Golf Course" (totaleintegrated, 520 tee times)
--
-- Both are 18 holes, par 72, located ~300m apart (GPS variance)
-- Strategy: Keep ID 429 (more tee times), merge data from ID 403
-- =================================================================

-- Step 1: Transfer tee_times from duplicate course to primary course
UPDATE tee_times SET course_id = 429 WHERE course_id = 403;

-- Step 2: Transfer related records (course_reviews, favorites, rounds)
UPDATE course_reviews SET course_id = 429 WHERE course_id = 403;
UPDATE user_favorites SET course_id = 429 WHERE course_id = 403;
UPDATE rounds SET course_id = 429 WHERE course_id = 403;

-- Step 3: Copy valuable data from duplicate to primary course
-- (golfnow_id and website_url)
UPDATE courses
SET golfnow_id = '129',
    website_url = 'https://www.playnapa.com/'
WHERE id = 429
AND golfnow_id IS NULL;

-- Step 4: Delete the duplicate course entry
DELETE FROM courses WHERE id = 403;

-- =================================================================
-- VERIFICATION QUERIES (run after cleanup to verify)
-- =================================================================

-- Verify no more duplicate tee times
-- SELECT course_id, date, time, COUNT(*) as count
-- FROM tee_times
-- GROUP BY course_id, date, time
-- HAVING COUNT(*) > 1;

-- Verify Napa course was properly merged
-- SELECT id, name, golfnow_id, booking_system FROM courses WHERE id = 429;

-- Verify no orphaned tee_times
-- SELECT COUNT(*) FROM tee_times t
-- LEFT JOIN courses c ON t.course_id = c.id
-- WHERE c.id IS NULL;

-- =================================================================
-- NOT DUPLICATES - These are legitimately different courses:
-- =================================================================
-- - Corica Park North/South: Different 18-hole courses at same complex
-- - Foxtail Golf Club North/South: Different courses at same facility
-- - Silverado Resort North/South: Different championship courses
-- - TPC Harding Park / Fleming 9: Main 18-hole vs 9-hole course
-- - Bay View Golf Club / Bayonet Golf Course: Different courses (different cities)
-- =================================================================
