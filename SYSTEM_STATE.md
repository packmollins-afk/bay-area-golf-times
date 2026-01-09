# Bay Area Golf Now - System State Reference

Last updated: 2026-01-08

## Quick Stats
- **Total Courses**: 82
- **Courses with Live Data**: 65 (79%)
- **Active Scrapers**: 4 (GolfNow, TotaleIntegrated, Chronogolf, CPS Golf)

## Data Provider Breakdown

| Provider | Courses | % | Method |
|----------|---------|---|--------|
| GolfNow | ~45 | 55% | Puppeteer browser scrape (100mi radius) |
| TotaleIntegrated | 10 | 12% | Direct JSON API (courseco-gateway) |
| Chronogolf | 7 | 9% | Puppeteer browser scrape |
| CPS Golf | 2 | 2% | Direct JSON API (cps.golf) |
| No scraper | ~18 | 22% | Missing - mostly inactive GolfNow listings |

## Scraper Details

### GolfNow (`src/scrapers/golfnow.js`)
- **Method**: Puppeteer headless browser
- **Endpoint**: `golfnow.com/tee-times/search#q=location&latitude=X&longitude=Y&radius=100`
- **Search Locations**: SF, San Jose, Oakland, Napa, Pacifica, Santa Rosa
- **Data Retrieved**: First/last tee time, min price per course per day
- **Matching**: Uses `golfnow_id` field in courses table

### TotaleIntegrated (`src/scrapers/totaleintegrated.js`)
- **Method**: Direct fetch to JSON API
- **Endpoint**: `courseco-gateway.totaleintegrated.net/Booking/Teetimes`
- **Courses**: Boundary Oak, Metropolitan, San Jose Muni, Pacific Grove, Laguna Seca, Valley of the Moon, Napa GC, Ancil Hoffman, Mather, Cherry Island
- **Data Retrieved**: Full tee time inventory with prices

### Chronogolf (`src/scrapers/chronogolf.js`)
- **Method**: Puppeteer headless browser
- **Endpoint**: `chronogolf.com/club/{slug}/teetimes`
- **Courses**: Half Moon Bay (2), Santa Teresa, Tilden Park, Redwood Canyon, Canyon Lakes, Blue Rock Springs
- **Data Retrieved**: First available time + price

### CPS Golf (`src/scrapers/cpsgolf.js`)
- **Method**: Direct fetch to JSON API
- **Endpoint**: `{course}.cps.golf/api/`
- **Courses**: Diablo Creek, Northwood
- **Note**: Presidio requires login (not scraped)

## Database Schema (Turso)

```sql
-- courses table
id, name, slug, region, lat, lng, par, holes, phone, website,
booking_system, booking_url, golfnow_id, created_at

-- tee_times table
id, course_id, date, time, datetime, holes, players, price,
has_cart, booking_url, source, scraped_at

-- clicks table
id, course_slug, course_name, visitor_id, user_agent,
referrer, clicked_at
```

## API Endpoints (Vercel)

| Endpoint | Purpose |
|----------|---------|
| `/api/tee-times/next-available` | Map markers - next time + min price per course |
| `/api/tee-times?course=slug` | Course detail - all tee times for course |
| `/api/courses` | All courses with metadata |
| `/go/:slug` | Click tracking + redirect to booking |
| `/api/track` | Analytics event tracking |

## Coverage by Region

| Region | Working | Total | % |
|--------|---------|-------|---|
| Sacramento | 5 | 5 | 100% |
| East Bay | 17 | 19 | 89% |
| Monterey | 10 | 12 | 83% |
| South Bay | 11 | 14 | 79% |
| North Bay | 9 | 12 | 75% |
| Napa | 5 | 7 | 71% |
| San Francisco | 4 | 6 | 67% |
| Sonoma | 4 | 7 | 57% |

## Known Missing Courses (17)

Mostly courses without active GolfNow inventory or requiring direct booking:

- **Silverado Resort** (North/South) - Private booking system
- **Presidio Golf Course** - Requires CPS Golf login
- **Golden Gate Park** - No active GolfNow listing
- **Baylands Golf Links** - Uses Quick18 (no scraper)
- Various others with empty GolfNow profiles

## Environment Variables

```
TURSO_DATABASE_URL=libsql://bay-area-golf-bayareagolfnow.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=<token>
```

## Full Scrape Command

```bash
cd ~/bay-area-golf-times
TURSO_DATABASE_URL="..." TURSO_AUTH_TOKEN="..." TZ=America/Los_Angeles node -e "
const { createClient } = require('@libsql/client');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const { runScraper: runGolfNow } = require('./src/scrapers/golfnow');
const { scrapeAllTotaleIntegrated } = require('./src/scrapers/totaleintegrated');
const { scrapeAllChronogolf } = require('./src/scrapers/chronogolf');
const { scrapeAllCPSGolf } = require('./src/scrapers/cpsgolf');
// ... run all scrapers
"
```

## Expected Tee Time Counts (7-day scrape)

- GolfNow: ~300 (one entry per course per day)
- TotaleIntegrated: ~1,600 (full inventory)
- Chronogolf: ~50 (one entry per course per day)
- CPS Golf: ~100 (full inventory)
- **Total**: ~2,000+ tee times

## Recent Changes (Jan 2026)

1. Added 16 new GolfNow courses (66 → 82 total)
2. Fixed GolfNow scraper to fetch all 7 days (was only doing today)
3. Increased search radius from 50mi to 100mi (picks up Monterey)
4. Implemented SEO foundation (meta tags, regional pages, JSON-LD)
5. Fixed click tracking (undefined → null for Turso)
