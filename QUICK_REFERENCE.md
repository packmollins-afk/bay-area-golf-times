# Data Completeness - Quick Reference Guide

## Running the Analysis Tools

### Quick Check (30 seconds)
```bash
node check-data-completeness.js
```
Output: Summary of all data metrics with percentages

### Detailed Report (2 minutes)
```bash
node check-data-detailed.js
```
Output: Full analysis with course lists grouped by missing data

### SEO Priority Ranking (2 minutes)
```bash
node check-seo-priority.js
```
Output: Courses ranked by urgency with missing field details

---

## Key Findings

### Overall: 74.71% Complete
- 65 of 87 courses have full SEO data
- 22 courses missing at least one critical field

### By Metric:
- **Booking URLs**: 100% (87/87) ✓
- **Par Data**: 100% (87/87) ✓
- **Coordinates**: 81.61% (71/87) - 16 missing
- **Phone Numbers**: 74.71% (65/87) - 22 missing
- **Yardage**: 75.86% (66/87) - 21 missing

### Critical Issues:
16 courses missing **4 fields** (Lat/Lon, Phone, Yardage):
- Bay View, Brentwood, Coyote Creek (2), Dublin Ranch
- Eagle Ridge, Foxtail (2), Monarch Bay Tony Lema
- Seascape, Skywest, Spring Hills, Sunnyvale
- Swenson Park, Tracy, Whitney Oaks

---

## How to Fix Data Gaps

### Add Coordinates (16 courses)
Using Google Maps Geocoding API:
```javascript
const coords = await geocodeAddress(`${course.name}, ${course.city}, CA`);
db.prepare('UPDATE courses SET latitude = ?, longitude = ? WHERE id = ?')
  .run(coords.lat, coords.lng, course.id);
```

Data sources:
- Google Maps API
- Golf.com
- GolfCourse.com

### Add Phone Numbers (22 courses)
Manual research from:
- Course websites
- GolfNow listings
- Google Business pages

### Add Yardage Data (21 courses)
Sources:
- Course websites
- USGA Golf Ratings database
- Golf.com course profiles
- Scorecard images

---

## Database Queries

### Find all courses with missing data
```sql
SELECT name, city, region,
  CASE WHEN latitude IS NULL THEN '✗' ELSE '✓' END as coords,
  CASE WHEN phone_number IS NULL THEN '✗' ELSE '✓' END as phone,
  CASE WHEN yardage IS NULL THEN '✗' ELSE '✓' END as yardage,
  CASE WHEN booking_url IS NULL THEN '✗' ELSE '✓' END as booking
FROM courses
WHERE latitude IS NULL OR phone_number IS NULL
   OR yardage IS NULL OR booking_url IS NULL
ORDER BY name;
```

### Find courses missing specific fields
```sql
-- Missing coordinates
SELECT name, city FROM courses
WHERE latitude IS NULL OR longitude IS NULL;

-- Missing phone
SELECT name, city FROM courses
WHERE phone_number IS NULL;

-- Missing yardage
SELECT name, city FROM courses
WHERE yardage IS NULL;
```

### Update missing data
```sql
-- Add coordinates
UPDATE courses
SET latitude = ?, longitude = ?
WHERE id = ?;

-- Add phone
UPDATE courses
SET phone_number = ?
WHERE name = ? AND city = ?;

-- Add yardage
UPDATE courses
SET yardage = ?
WHERE id = ?;
```

---

## SEO Impact Priority

### Tier 1: Add Coordinates (Affects Maps)
**Impact**: Homepage map visualization, course discovery
**Priority**: HIGH
**Effort**: 2-3 hours (automated with Google API)

### Tier 2: Add Phone Numbers (Affects UX)
**Impact**: User contact, schema markup
**Priority**: MEDIUM-HIGH
**Effort**: 2-4 hours (manual)

### Tier 3: Add Yardage (Affects SEO Keywords)
**Impact**: Course detail pages, keyword targeting
**Priority**: MEDIUM
**Effort**: 3-5 hours (research + data entry)

---

## Courses by Missing Fields

### 4 Missing (Coordinates, Phone, Yardage)
- Bay View GC
- Brentwood GC
- Coyote Creek Tournament
- Coyote Creek Valley
- Dublin Ranch GC
- Eagle Ridge GC
- Foxtail GC North
- Foxtail GC South
- Monarch Bay Tony Lema
- Seascape GC
- Skywest GC
- Spring Hills GC
- Sunnyvale GC
- Swenson Park GC
- Tracy GC
- Whitney Oaks GC

### 2 Missing (Phone, Yardage)
- De Laveaga GC
- Gilroy GC
- Los Lagos GC
- Pajaro Valley GC
- Rooster Run GC

### 1 Missing (Phone)
- The Course at Wente Vineyards

---

## Success Metrics

### Current
- Overall: 74.71%
- Maps-ready: 81.61%
- SEO-ready: 74.71%

### Target (90%)
- Add data to Tier 1 & 2 courses
- Est. 10-15 hours work
- Expected improvement: +15-20% SEO effectiveness

---

## Scripts Available

| Script | Purpose | Runtime |
|--------|---------|---------|
| `check-data-completeness.js` | Quick metrics check | ~30s |
| `check-data-detailed.js` | Full analysis report | ~2m |
| `check-seo-priority.js` | Priority-ranked action items | ~2m |

All scripts read from Turso using `.env.local` credentials.

---

## Common Tasks

### Check single course
```sql
SELECT * FROM courses WHERE name LIKE '%course name%';
```

### Check by region
```sql
SELECT name, city, region,
  CASE WHEN latitude IS NULL THEN 'Missing' ELSE 'OK' END as coords
FROM courses
WHERE region = 'East Bay'
ORDER BY name;
```

### Count completeness by region
```sql
SELECT region,
  COUNT(*) as total,
  COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
    AND phone_number IS NOT NULL AND yardage IS NOT NULL THEN 1 END) as complete
FROM courses
GROUP BY region
ORDER BY region;
```

---

## Next Steps

1. **This week**: Run `check-seo-priority.js` to identify top 5 courses
2. **Next week**: Add coordinates using Google Maps API
3. **Following week**: Add phone numbers from web research
4. **Following week**: Add yardage data and validate

Expected completion: 2-3 weeks to reach 90% data completeness.
