# Claude Code Project Instructions

## Project Overview
Bay Area Golf (bayareagolf.now) - A tee time aggregation platform for 80+ golf courses in the San Francisco Bay Area.

## Critical Rules

### Homepage Map Interaction
**NEVER** add features that block pointer events on the homepage map (`public/index.html`). The map must always support:
- Dragging/panning
- Zoom in/out buttons
- Clicking on course fairways

Any overlays or search UI must use `pointer-events: none` or link to `/app.html` instead of being interactive on the homepage.

### Adding New Courses Workflow
When courses are added to the database, they need FOUR things to appear correctly:

1. **Database entry** with exact `name` field
2. **HTML element** in `public/index.html` with `data-course` matching the database name exactly
3. **CSS positioning** class (`.fw-{shortname}`) with map coordinates
4. **Beautiful hole photo** (NOT a logo) - run `node scripts/fetch-course-photos.js` or add URL manually

See `WORKFLOW.md` for detailed steps.

### Data Flow Verification
After adding courses or running scrapers, verify:
\`\`\`bash
# Check courses with data
curl -s https://bayareagolf.now/api/tee-times/next-available | jq 'keys'

# Compare with homepage data-course attributes
grep 'data-course=' public/index.html
\`\`\`

## Tech Stack
- Frontend: Vanilla HTML/CSS/JS
- Database: Turso (libSQL)
- Scrapers: Puppeteer + API-based (Node.js)
- Hosting: Vercel
- Booking Systems: GolfNow, Chronogolf, CPS Golf, TotaleIntegrated, Quick18

## Key Files
- `public/index.html` - Homepage with interactive map
- `public/app.html` - Full search interface
- `api/index.js` - Vercel serverless API
- `scripts/full-scrape-parallel.js` - Main scraper orchestrator
- `scripts/golfnow-optimized.js` - GolfNow scraper (Puppeteer)
- `scripts/chrono-api.js` - Chronogolf scraper (Hybrid API)
- `scripts/totale-api.js` - TotaleIntegrated scraper (API)
- `scripts/cps-optimized.js` - CPS Golf scraper (Puppeteer)
- `scripts/quick18.js` - Quick18 scraper (Puppeteer)
- `scripts/discover-golfnow-ids.js` - GolfNow ID discovery tool
- `src/db/courses.js` - Course database seed data
