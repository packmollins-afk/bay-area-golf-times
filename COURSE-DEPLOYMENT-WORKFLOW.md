# Bay Area Golf - Course Deployment Workflow

> **IMPORTANT**: This document reflects the actual codebase structure. Read it fully before adding courses.

## Architecture Overview

### Data Sources (A course touches ALL of these)

| Location | Purpose | When to Update |
|----------|---------|----------------|
| `src/db/courses.js` | `courses` array - seeds Turso DB | Every new course |
| `api/index.js` | `COURSE_BASE_PRICES` - demo/fallback pricing | Every new course |
| Scraper config file | Scraper-specific course config | Only if scraper exists for booking system |
| `public/index.html` | Fairway CSS + HTML on homepage map | Every new course |
| Turso cloud DB | Production database | Auto-seeded from courses.js |

### Scraper Status (as of codebase review)

| Booking System | Scraper Status | Config Location | How It Works |
|----------------|----------------|-----------------|--------------|
| **golfnow** | ✓ Active | DB `golfnow_id` field | Auto-discovers via Bay Area location search. Just set `golfnow_id` in courses.js |
| **chronogolf** | ✓ Active | `src/scrapers/chronogolf.js` → `CHRONOGOLF_COURSES` | Hardcoded object - must add entry manually |
| **totaleintegrated** | ✓ Active | `src/scrapers/totaleintegrated.js` → `TOTALE_COURSES` | Hardcoded object - must add entry manually |
| **quick18** | ✓ Active | `src/scrapers/quick18.js` → `QUICK18_COURSES` | Hardcoded object - must add entry manually |
| **cpsgolf** | ✓ Active | `src/scrapers/cpsgolf.js` → `CPS_COURSES` | Hardcoded object - must add entry manually |
| **foreup** | ⚠ File exists, NOT integrated | `src/scrapers/foreup.js` | Not called in scrape.js - needs integration |
| **ezlinks** | ⚠ File exists, NOT integrated | `src/scrapers/ezlinks.js` | Not called in scrape.js - needs integration |
| **teesnap** | ⚠ File exists, NOT integrated | `src/scrapers/teesnap.js` | Not called in scrape.js - needs integration |
| **other** | N/A | None | Static/display only - uses demo data |

### Course Status Tiers

| Tier | Scraper | Live Prices | Demo Fallback |
|------|---------|-------------|---------------|
| **LIVE** | Working scraper populates tee_times table | Yes | Falls back to demo if scraper fails |
| **STATIC** | No scraper or booking_system='other' | No | Yes - uses COURSE_BASE_PRICES |

---

## Workflow A: Add GolfNow Course (Easiest)

GolfNow scraper auto-discovers courses by location. You just need the `golfnow_id`.

### Find the golfnow_id
1. Go to golfnow.com and search for the course
2. URL will be: `https://www.golfnow.com/tee-times/facility/XXXXX-course-name/search`
3. The `XXXXX` is the golfnow_id

### Claude Code Prompt
```
Add [COURSE NAME] to bayareagolf.now (GolfNow course)

COURSE DATA:
- name: [Full Name]
- city: [City]
- region: [San Francisco | South Bay | East Bay | North Bay | Napa]
- holes: [9/18/27/36]
- par: [number]
- yardage: [number]
- latitude: [lat]
- longitude: [lng]
- phone_number: [phone]
- golfnow_id: "[XXXXX]"
- booking_url: "https://www.golfnow.com/tee-times/facility/[XXXXX]-[course-name]/search"
- booking_system: "golfnow"

ESTIMATED PRICE: $[XX] (for demo fallback)

MAP POSITION:
- CSS class: fw-[shortname]
- top: [Y]%
- left: [X]%
- rotation: [D]deg

FILES TO EDIT:
1. src/db/courses.js - Add to `courses` array
2. api/index.js - Add to COURSE_BASE_PRICES object
3. public/index.html - Add fairway CSS + HTML

DO NOT edit scraper files - GolfNow auto-discovers via golfnow_id.
```

---

## Workflow B: Add Chronogolf Course

### Claude Code Prompt
```
Add [COURSE NAME] to bayareagolf.now (Chronogolf course)

COURSE DATA:
- name: [Full Name]
- slug: [url-slug]
- city: [City]
- region: [region]
- holes: [number]
- par: [number]
- yardage: [number]
- latitude: [lat]
- longitude: [lng]
- phone_number: [phone]
- booking_url: "https://www.chronogolf.com/club/[club-slug]"
- booking_system: "chronogolf"

ESTIMATED PRICE: $[XX]

MAP POSITION:
- CSS class: fw-[shortname]
- top: [Y]%
- left: [X]%
- rotation: [D]deg

FILES TO EDIT:
1. src/db/courses.js - Add to `courses` array
2. api/index.js - Add to COURSE_BASE_PRICES object
3. src/scrapers/chronogolf.js - Add to CHRONOGOLF_COURSES object:
   '[slug]': {
     url: 'https://www.chronogolf.com/club/[club-slug]',
     name: '[Full Name]'
   }
4. public/index.html - Add fairway CSS + HTML
```

---

## Workflow C: Add TotaleIntegrated Course

### Claude Code Prompt
```
Add [COURSE NAME] to bayareagolf.now (TotaleIntegrated course)

COURSE DATA:
- name: [Full Name]
- slug: [url-slug]
- city: [City]
- region: [region]
- holes: [number]
- par: [number]
- booking_url: "[totaleintegrated URL]"
- booking_system: "totaleintegrated"

ESTIMATED PRICE: $[XX]

MAP POSITION: [coordinates]

FILES TO EDIT:
1. src/db/courses.js - Add to `courses` array
2. api/index.js - Add to COURSE_BASE_PRICES object
3. src/scrapers/totaleintegrated.js - Add to TOTALE_COURSES object:
   '[slug]': {
     url: '[booking URL]',
     name: '[Full Name]'
   }
4. public/index.html - Add fairway CSS + HTML
```

---

## Workflow D: Add Quick18 Course

### Claude Code Prompt
```
Add [COURSE NAME] to bayareagolf.now (Quick18 course)

COURSE DATA:
- name: [Full Name]
- slug: [url-slug]
- booking_url: "https://[subdomain].quick18.com/teetimes/searchmatrix"
- booking_system: "quick18"
[rest of course data]

FILES TO EDIT:
1. src/db/courses.js
2. api/index.js - COURSE_BASE_PRICES
3. src/scrapers/quick18.js - Add to QUICK18_COURSES object
4. public/index.html - fairway
```

---

## Workflow E: Add CPSGolf Course

### Claude Code Prompt
```
Add [COURSE NAME] to bayareagolf.now (CPSGolf course)

COURSE DATA:
- name: [Full Name]
- slug: [url-slug]
- booking_url: "https://[name].cps.golf/"
- booking_system: "cpsgolf"
[rest of course data]

FILES TO EDIT:
1. src/db/courses.js
2. api/index.js - COURSE_BASE_PRICES
3. src/scrapers/cpsgolf.js - Add to CPS_COURSES object
4. public/index.html - fairway
```

---

## Workflow F: Add Static Course (No Scraper)

For courses where:
- Booking system has no scraper
- Scraper doesn't work
- You just want map/page presence

### Claude Code Prompt
```
Add [COURSE NAME] to bayareagolf.now (STATIC - no live scraper)

COURSE DATA:
- name: [Full Name]
- slug: [url-slug]
- booking_url: "[direct booking link]"
- booking_system: "other"
[rest of course data]

ESTIMATED PRICE: $[XX] (used for demo data display)

FILES TO EDIT:
1. src/db/courses.js - Add to `courses` array
2. api/index.js - Add to COURSE_BASE_PRICES object
3. public/index.html - Add fairway CSS + HTML

DO NOT edit any scraper files.
Course will display with demo/fallback pricing.
```

---

## File Edit Templates

### 1. src/db/courses.js - Add to `courses` array

```javascript
// Add in appropriate region section
{ 
  name: "Course Name", 
  city: "City", 
  region: "Region", 
  holes: 18, 
  par: 72, 
  yardage: 6500, 
  latitude: 37.XXXX, 
  longitude: -122.XXXX, 
  phone_number: "(XXX) XXX-XXXX", 
  golfnow_id: "XXXXX",  // or null if not GolfNow
  booking_url: "https://...", 
  booking_system: "golfnow"  // or chronogolf, totaleintegrated, quick18, cpsgolf, other
},
```

### 2. api/index.js - Add to COURSE_BASE_PRICES (~line 450)

```javascript
const COURSE_BASE_PRICES = {
  // ... existing courses ...
  'Course Name': XX,  // Base price in dollars
};
```

### 3. public/index.html - Add Fairway

**CSS (around line 426-530):**
```css
/* [Region] */
.fw-[shortname] { top: [Y]%; left: [X]%; width: [W]px; height: [H]px; border-radius: 50%; transform: rotate([D]deg); }
```

**CSS counter-rotate (around line 562-590):**
```css
.fw-[shortname] .price-tag { --counter-rotate: [D]deg; }
```

**HTML (around line 1499-1550, in correct region section):**
```html
<a href="/course/[slug]" class="fairway fw-[shortname]" data-course="[Full Name]" data-initial="[XX]"><span class="price-tag loading">...</span></a>
```

### 4. Scraper Config (if applicable)

**Chronogolf** (`src/scrapers/chronogolf.js`):
```javascript
const CHRONOGOLF_COURSES = {
  // ... existing ...
  '[slug]': {
    url: 'https://www.chronogolf.com/club/[club-slug]',
    name: '[Full Name]'
  }
};
```

**TotaleIntegrated** (`src/scrapers/totaleintegrated.js`):
```javascript
const TOTALE_COURSES = {
  // ... existing ...
  '[slug]': {
    url: '[booking URL]',
    name: '[Full Name]'
  }
};
```

**Quick18** (`src/scrapers/quick18.js`):
```javascript
const QUICK18_COURSES = {
  '[slug]': {
    url: 'https://[subdomain].quick18.com/teetimes/searchmatrix',
    name: '[Full Name]'
  }
};
```

**CPSGolf** (`src/scrapers/cpsgolf.js`):
```javascript
const CPS_COURSES = {
  '[slug]': {
    url: 'https://[name].cps.golf/',
    name: '[Full Name]'
  }
};
```

---

## Slug Generation

Slugs are auto-generated from course name:
- Lowercase
- Spaces → hyphens
- Remove special characters
- Example: "TPC Harding Park" → "tpc-harding-park"

---

## Deployment Steps

After code changes:

```bash
# 1. Test locally (optional)
npm run dev

# 2. Commit
git add -A
git commit -m "Add [Course Name] to bayareagolf.now"

# 3. Push to trigger Vercel deploy
git push

# 4. Verify on production
# - Check homepage map shows fairway
# - Check /course/[slug] page loads
# - Check /courses.html lists course
```

---

## What Auto-Handles Itself

| Component | Auto-Generated From |
|-----------|---------------------|
| Course detail page (`/course/[slug]`) | Turso DB via slug |
| Courses list (`/courses.html`) | `/api/courses` endpoint |
| Price tags on homepage | `/api/tee-times/next-available` |
| Demo tee times | `COURSE_BASE_PRICES` + `generateDemoTeeTimesForCourse()` |

---

## Upgrading Static → Live

When a scraper becomes available for a static course:

```
Upgrade [COURSE NAME] from STATIC to LIVE

Current status: booking_system='other' with demo data
New scraper: [chronogolf/quick18/etc]

FILES TO EDIT:
1. src/db/courses.js - Update booking_system field
2. [scraper file] - Add to config object
3. Verify scraper runs successfully

api/index.js COURSE_BASE_PRICES - keep as fallback
public/index.html - no changes needed
```

---

## Expansion Regions

### Current Regions in DB
- San Francisco
- South Bay
- East Bay
- North Bay
- Napa

### To Add New Region

1. Use new region value in courses.js entries
2. Add region label to index.html map
3. Add region chip to courses.html filter
4. Extend map boundaries if needed (CSS)

### Planned Expansion

| Region | Priority | Notes |
|--------|----------|-------|
| Monterey | Phase 1 | High-value, mostly GolfNow |
| Sonoma | Phase 1 | North Bay extension |
| Sacramento | Phase 1 | Large market, GolfNow/ForeUp |
| Tahoe | Phase 2 | Seasonal May-Oct |
| Sierra Foothills | Phase 2 | Gold Country |

---

## Troubleshooting

**Course not showing on map?**
- Check fairway HTML is in correct region section in index.html
- Check CSS positioning (may be off-screen)
- Check browser console for JS errors

**Course page 404?**
- Check slug in courses.js matches URL
- Run seed script or deploy to update Turso

**No tee times showing?**
- Check COURSE_BASE_PRICES has entry (for demo)
- Check scraper config if LIVE course
- Check GitHub Actions scrape workflow ran

**Wrong price showing?**
- Demo prices come from COURSE_BASE_PRICES
- Live prices come from scraper → tee_times table
- Check scraper source field matches

---

## Version
v3.0 - 2026-01-08 - Full codebase alignment with actual architecture
