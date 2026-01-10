# Sitemap Structure & Visual Guide

Complete reference for the Bay Area Golf sitemap hierarchy and URL structure.

## Overview

```
Sitemap (101 URLs)
├── Main Pages (5 URLs)
├── Regional Pages (7 URLs)
└── Course Pages (89 URLs)
```

---

## 1. Main Pages (Priority 0.5-1.0)

These are the primary entry points to the site.

```
https://bayareagolf.now/
├── Priority: 1.0 (Highest)
├── Change Freq: daily
├── Purpose: Homepage/Directory
└── Last Mod: Today's date

https://bayareagolf.now/app.html
├── Priority: 0.9
├── Change Freq: hourly
├── Purpose: Search/Filter interface
└── Last Mod: Today's date

https://bayareagolf.now/courses.html
├── Priority: 0.8
├── Change Freq: weekly
├── Purpose: Course listing/discovery
└── Last Mod: Today's date

https://bayareagolf.now/scorebook.html
├── Priority: 0.5
├── Change Freq: weekly
├── Purpose: User scorecard tracking
└── Last Mod: Today's date

https://bayareagolf.now/community.html
├── Priority: 0.5
├── Change Freq: weekly
├── Purpose: Community/social features
└── Last Mod: Today's date
```

---

## 2. Regional Landing Pages (Priority 0.8)

Geographic sections supporting local SEO.

```
Regional Pages (7 total)
├── San Francisco Region
│   └── https://bayareagolf.now/sf-golf
│       ├── Courses: TPC Harding Park, Lincoln Park, Presidio, etc.
│       └── Keyword Target: "golf courses san francisco", "tee times sf"
│
├── East Bay Region
│   └── https://bayareagolf.now/east-bay-golf
│       ├── Courses: Corica Park, Metropolitan, Lake Chabot, etc.
│       └── Keyword Target: "east bay golf", "oakland golf courses"
│
├── South Bay Region
│   └── https://bayareagolf.now/south-bay-golf
│       ├── Courses: San Jose Municipal, Cinnabar Hills, Boulder Ridge, etc.
│       └── Keyword Target: "south bay golf", "san jose tee times"
│
├── North Bay Region
│   └── https://bayareagolf.now/north-bay-golf
│       ├── Keyword Target: "north bay golf", "marin county golf"
│       └── Last Mod: Weekly
│
├── Peninsula Region
│   └── https://bayareagolf.now/peninsula-golf
│       ├── Keyword Target: "peninsula golf courses", "palo alto golf"
│       └── Last Mod: Weekly
│
├── Monterey/Coast Region
│   └── https://bayareagolf.now/monterey-golf
│       ├── Keyword Target: "monterey golf", "central coast golf"
│       └── Last Mod: Weekly
│
└── Sacramento/Central Valley Region
    └── https://bayareagolf.now/sacramento-golf
        ├── Keyword Target: "sacramento golf", "valley golf courses"
        └── Last Mod: Weekly

All Regional Pages:
├── Priority: 0.8
├── Change Freq: weekly
└── Last Mod: Today's date
```

---

## 3. Individual Course Pages (Priority 0.7)

The core content - 89 golf courses across Bay Area and beyond.

### URL Pattern
```
https://bayareagolf.now/course/{slug}

Where {slug} is kebab-case version of course name:
- "TPC Harding Park" → tpc-harding-park
- "Lincoln Park Golf Course" → lincoln-park-golf-course
- "Boulder Ridge Golf Club" → boulder-ridge-golf-club
```

### All Course URLs by Region

#### San Francisco (6 courses)
```
1. https://bayareagolf.now/course/tpc-harding-park
2. https://bayareagolf.now/course/lincoln-park-golf-course
3. https://bayareagolf.now/course/sharp-park-golf-course
4. https://bayareagolf.now/course/presidio-golf-course
5. https://bayareagolf.now/course/golden-gate-park-golf-course
6. https://bayareagolf.now/course/fleming-golf-course
```

#### South Bay - Santa Clara County (14 courses)
```
1. https://bayareagolf.now/course/san-jose-municipal-golf-course
2. https://bayareagolf.now/course/cinnabar-hills-golf-club
3. https://bayareagolf.now/course/los-lagos-golf-course
4. https://bayareagolf.now/course/santa-teresa-golf-club
5. https://bayareagolf.now/course/boulder-ridge-golf-club
6. https://bayareagolf.now/course/pruneridge-golf-club
7. https://bayareagolf.now/course/deep-cliff-golf-course
8. https://bayareagolf.now/course/sunnyvale-golf-course
9. https://bayareagolf.now/course/sunken-gardens-golf-course
10. https://bayareagolf.now/course/spring-valley-golf-course
11. https://bayareagolf.now/course/coyote-creek-golf-club
12. https://bayareagolf.now/course/moffett-field-golf-course
13. https://bayareagolf.now/course/blackberry-farm-golf-course
14. https://bayareagolf.now/course/palo-alto-golf-course
15. https://bayareagolf.now/course/baylands-golf-links
```

#### East Bay - Alameda County (10 courses)
```
1. https://bayareagolf.now/course/corica-park-south-course
2. https://bayareagolf.now/course/corica-park-north-course
3. https://bayareagolf.now/course/corica-park-mif-albright-par-3
4. https://bayareagolf.now/course/metropolitan-golf-links
5. https://bayareagolf.now/course/lake-chabot-golf-course
6. https://bayareagolf.now/course/tilden-park-golf-course
7. https://bayareagolf.now/course/redwood-canyon-golf-course
8. https://bayareagolf.now/course/monarch-bay-golf-club
9. https://bayareagolf.now/course/montclair-golf-course
10. https://bayareagolf.now/course/sunol-golf-club
```

#### Peninsula (8 courses)
```
1. https://bayareagolf.now/course/crystal-springs-golf-club
2. https://bayareagolf.now/course/san-geronimo-golf-club
3. https://bayareagolf.now/course/half-moon-bay-golf-links
4. https://bayareagolf.now/course/cow-palace-par-3
5. https://bayareagolf.now/course/ocean-view-golf-club
6. https://bayareagolf.now/course/burlingame-country-club
7. https://bayareagolf.now/course/poppy-ridge-golf-course
8. https://bayareagolf.now/course/cinnabar-creek-golf-club
```

#### North Bay (12 courses)
```
1. https://bayareagolf.now/course/northgate-golf-course
2. https://bayareagolf.now/course/santa-rosa-golf-club
3. https://bayareagolf.now/course/fountaingrove-resort-golf-club
4. https://bayareagolf.now/course/windsor-golf-club
5. https://bayareagolf.now/course/sebastopol-golf-course
6. https://bayareagolf.now/course/bodega-harbour-golf-course
7. https://bayareagolf.now/course/napa-golf-course
8. https://bayareagolf.now/course/silverado-resort-and-spa
9. https://bayareagolf.now/course/oak-valley-golf-club
10. https://bayareagolf.now/course/penngrove-golf-club
11. https://bayareagolf.now/course/fairfield-ranch-golf-club
12. https://bayareagolf.now/course/black-oak-golf-course
```

#### Central Valley (18 courses)
```
1. https://bayareagolf.now/course/castle-oaks-golf-club
2. https://bayareagolf.now/course/dry-creek-golf-course
3. https://bayareagolf.now/course/lincoln-hills-golf-course
4. https://bayareagolf.now/course/rancho-murieta-country-club
5. https://bayareagolf.now/course/sunridge-golf-club
6. https://bayareagolf.now/course/waterford-golf-course
7. https://bayareagolf.now/course/turkey-creek-golf-club
8. https://bayareagolf.now/course/foothill-oaks-golf-course
9. https://bayareagolf.now/course/twelve-bridges-golf-club
10. https://bayareagolf.now/course/sierra-vista-golf-course
11. https://bayareagolf.now/course/oak-point-golf-course
12. https://bayareagolf.now/course/poppy-hills-golf-course
13. https://bayareagolf.now/course/stockton-golf-club
14. https://bayareagolf.now/course/meadowlawn-golf-course
15. https://bayareagolf.now/course/empire-west-golf-course
16. https://bayareagolf.now/course/spring-creek-golf-club
17. https://bayareagolf.now/course/country-club-at-woodcreek
18. https://bayareagolf.now/course/loch-lomond-golf-club
```

#### Monterey & Central Coast (15 courses)
```
1. https://bayareagolf.now/course/monterey-peninsula-country-club
2. https://bayareagolf.now/course/pebble-beach-golf-links
3. https://bayareagolf.now/course/spyglass-hill-golf-course
4. https://bayareagolf.now/course/spanish-bay-golf-course
5. https://bayareagolf.now/course/old-del-monte-golf-course
6. https://bayareagolf.now/course/poppy-hills-golf-course
7. https://bayareagolf.now/course/carmel-valley-ranch-golf-club
8. https://bayareagolf.now/course/black-horse-golf-course
9. https://bayareagolf.now/course/salinas-valley-country-club
10. https://bayareagolf.now/course/rancho-canada-golf-club
11. https://bayareagolf.now/course/corral-de-tierra-country-club
12. https://bayareagolf.now/course/bayonet-black-horse-golf-club
13. https://bayareagolf.now/course/pacific-grove-golf-links
14. https://bayareagolf.now/course/quail-lodge-golf-course
15. https://bayareagolf.now/course/castle-rock-country-club
```

#### Sierra & Mountain (6 courses)
```
1. https://bayareagolf.now/course/chardonnay-golf-club
2. https://bayareagolf.now/course/iron-horse-golf-club
3. https://bayareagolf.now/course/silver-oaks-golf-course
4. https://bayareagolf.now/course/alta-sierra-country-club
5. https://bayareagolf.now/course/northstar-california-golf-course
6. https://bayareagolf.now/course/sierra-star-golf-course
```

### Course Page Metadata

Each course page in the sitemap includes:
```xml
<url>
  <loc>https://bayareagolf.now/course/{slug}</loc>
  <lastmod>2026-01-08</lastmod>  <!-- From courses.updated_at -->
  <changefreq>weekly</changefreq>
  <priority>0.7</priority>
</url>
```

**Properties:**
- **loc:** Full URL to course detail page
- **lastmod:** Date from `courses.updated_at` field (updated when course info changes)
- **changefreq:** "weekly" (course info changes less frequently than tee times)
- **priority:** 0.7 (important for SEO but lower than homepage)

---

## 4. Sitemap Hierarchy Visualization

```
bayareagolf.now
│
├─ / (Homepage) - Priority 1.0
│  ├─ Search & Filter Links
│  ├─ Course Map
│  ├─ Featured Courses
│  └─ Regional Navigation
│
├─ /app.html (Search App) - Priority 0.9
│  ├─ Filters: Date, Time, Price, Holes
│  ├─ Regional Selection
│  ├─ Course Details
│  └─ Booking Links
│
├─ /courses.html (Course Directory) - Priority 0.8
│  ├─ All Courses Listed
│  ├─ Regional Grouping
│  ├─ Course Info
│  └─ Next Tee Time
│
├─ Regional Pages - Priority 0.8
│  ├─ /sf-golf
│  ├─ /east-bay-golf
│  ├─ /south-bay-golf
│  ├─ /north-bay-golf
│  ├─ /peninsula-golf
│  ├─ /monterey-golf
│  └─ /sacramento-golf
│
├─ /course/{slug} Pages - Priority 0.7 (89 courses)
│  ├─ Course Details
│  ├─ Next Available Tee Times
│  ├─ Pricing Info
│  ├─ Course Images
│  ├─ Booking Links
│  └─ Related Courses
│
├─ /scorebook.html - Priority 0.5
│  ├─ User Scorecard
│  ├─ Stats & Analytics
│  └─ Round History
│
└─ /community.html - Priority 0.5
   ├─ User Profiles
   ├─ Activity Feed
   └─ Discussion Forums
```

---

## 5. URL Naming Conventions

### Slug Generation Rules

```javascript
// Algorithm for converting course names to slugs:

function generateSlug(name) {
  return name
    .toLowerCase()                    // "TPC Harding Park" → "tpc harding park"
    .replace(/[^\w\s-]/g, '')         // Remove special characters
    .replace(/\s+/g, '-')             // Replace spaces with hyphens
    .replace(/-+/g, '-')              // Replace multiple hyphens with single
    .trim()                           // Remove leading/trailing spaces
}

// Examples:
"TPC Harding Park"           → "tpc-harding-park"
"Lincoln Park Golf Course"   → "lincoln-park-golf-course"
"Boulder Ridge Golf Club"    → "boulder-ridge-golf-club"
"Los Lagos Golf Course"      → "los-lagos-golf-course"
"Palo Alto Golf Course"      → "palo-alto-golf-course"
"Santa Teresa Golf Club"     → "santa-teresa-golf-club"
"Corica Park - South Course" → "corica-park-south-course"
"Mif Albright Par 3"         → "mif-albright-par-3"
"Golden Gate Park Golf Course" → "golden-gate-park-golf-course"
```

---

## 6. SEO Keyword Distribution

### By Page Type

**Homepage (1.0 priority)**
- "Bay Area golf tee times"
- "Find tee times near me"
- "Book golf courses"
- "San Francisco Bay Area golf"

**App/Search (0.9 priority)**
- "Search golf tee times"
- "Compare course prices"
- "Book tee times online"
- "[Course name] availability"

**Regional Pages (0.8 priority)**
- "[Region] golf courses"
- "[City] tee times"
- "Book golf in [region]"
- "[County] golf clubs"

**Course Pages (0.7 priority)**
- "[Course name] tee times"
- "[Course name] prices"
- "[Course name] booking"
- "[Course name] reviews"
- "[City] [course type] golf"

**Supporting Pages (0.5 priority)**
- "Golf scorecard"
- "Track golf scores"
- "Golf community"
- "Golf tips & advice"

---

## 7. Mobile & Desktop Variants

Current strategy: **Responsive Design (No separate mobile URLs)**

The sitemap serves:
- Desktop: https://bayareagolf.now/course/tpc-harding-park
- Mobile: https://bayareagolf.now/course/tpc-harding-park (same URL, responsive design)

**Note:** Not using separate mobile URLs (`m.bayareagolf.now`) or `?mobile=1` parameters.

---

## 8. Sitemap Stats

### Current Size
```
Total Entries:     101
Main Pages:        5
Regional Pages:    7
Course Pages:      89

Total Courses:     89
  - San Francisco:       6
  - South Bay:          14
  - East Bay:           10
  - Peninsula:           8
  - North Bay:          12
  - Central Valley:     18
  - Monterey Coast:     15
  - Sierra/Mountain:     6

Estimated XML Size: ~20 KB
Last Generated:     Real-time (per request)
```

### Growth Projections

```
Courses → Sitemap Size → Sitemap Entries
100 → 30 KB → 115 URLs
200 → 50 KB → 220 URLs
500 → 100 KB → 515 URLs
1000 → 200 KB → 1,015 URLs
5000 → 1 MB → 5,015 URLs (need Sitemap Index)
```

---

## 9. XML Structure Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Main Pages Section -->
  <url>
    <loc>https://bayareagolf.now/</loc>
    <lastmod>2026-01-08</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <url>
    <loc>https://bayareagolf.now/app.html</loc>
    <lastmod>2026-01-08</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- Regional Pages Section -->
  <url>
    <loc>https://bayareagolf.now/sf-golf</loc>
    <lastmod>2026-01-08</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Course Pages Section -->
  <url>
    <loc>https://bayareagolf.now/course/tpc-harding-park</loc>
    <lastmod>2026-01-08</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- ... 97 more URLs ... -->

</urlset>
```

---

## 10. URL Accessibility Verification

### Testing Individual URLs

```bash
# Test homepage
curl -I https://bayareagolf.now/
# Expected: 200 OK

# Test app page
curl -I https://bayareagolf.now/app.html
# Expected: 200 OK

# Test regional page
curl -I https://bayareagolf.now/sf-golf
# Expected: 200 OK or 404 if not yet implemented

# Test course page
curl -I https://bayareagolf.now/course/tpc-harding-park
# Expected: 200 OK

# Test all courses (loop)
for course in tpc-harding-park lincoln-park-golf-course sharp-park-golf-course; do
  echo "$course:"
  curl -s -I https://bayareagolf.now/course/$course | grep HTTP
done
```

---

**Last Updated:** January 8, 2026
**Total URLs:** 101
**Sitemap Version:** 1.0
