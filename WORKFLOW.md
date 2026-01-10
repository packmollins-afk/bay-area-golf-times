# Bay Area Golf - Project Workflows

## Adding New Courses to the Database

When new courses are added to the database, follow these steps to ensure they appear correctly on the homepage map:

### Step 1: Add Course to Database
Courses are added via the `/api/courses` endpoint or directly to the Turso database with required fields:
- `name` (must match exactly with homepage `data-course` attribute)
- `slug` (URL-friendly identifier)
- `region` (San Francisco, South Bay, East Bay, North Bay, Napa)
- `latitude`, `longitude`
- `booking_url`

### Step 2: Add Scraper Support
If the course uses a supported booking system, add it to the appropriate scraper:
- `scripts/golfnow-optimized.js` - GolfNow courses (auto-discovers by golfnow_id)
- `scripts/chrono-api.js` - Chronogolf courses (requires UUID)
- `scripts/cps-optimized.js` - CPS Golf courses (Diablo Creek, Northwood)
- `scripts/totale-api.js` - TotaleIntegrated courses
- `scripts/quick18.js` - Quick18 courses (Baylands)

### Step 3: Add Course to Homepage Map (`public/index.html`)

#### 3a. Add HTML Element
Add a fairway link element in the appropriate region section:
```html
<a href="/course/{slug}" class="fairway fw-{shortname}" data-course="{Exact Course Name}" data-initial="{2-3 letter abbrev}">
  <span class="price-tag"></span>
</a>
```

**Critical**: The `data-course` attribute MUST match the course `name` in the database exactly (case-sensitive) for price data to flow through.

#### 3b. Add CSS Positioning
Add a CSS rule for the fairway position on the map:
```css
.fw-{shortname} {
  top: {Y}%;
  left: {X}%;
  width: {W}px;
  height: {H}px;
  border-radius: 50%;
  transform: rotate({angle}deg);
}
```

Position values are percentages of the map area:
- SF Peninsula: left ~41-44%, top ~42-52%
- East Bay: left ~55-90%, top ~32-52%
- South Bay: left ~64-98%, top ~62-90%
- North Bay: left ~24-48%, top ~3-35%
- Monterey/Santa Cruz: left ~69-97%, top ~86-98%

### Step 4: Add Course Image
Every course MUST have a beautiful hole photo (not just a logo). Options:

#### Option A: Auto-fetch from Pexels (recommended for batch updates)
```bash
node scripts/fetch-course-photos.js
```

#### Option B: Manual URL (for specific courses)
Add the photo URL to `src/scripts/update-course-photos.js`:
```javascript
"Course Name": "https://example.com/beautiful-hole.jpg",
```
Then run: `node src/scripts/update-course-photos.js`

#### Option C: Local file
Save image to `public/images/courses/{slug}.jpg` and update database:
```sql
UPDATE courses SET photo_url = '/images/courses/{slug}.jpg' WHERE slug = '{slug}';
```

**Image requirements:**
- Must show an actual golf hole (fairway, green, scenic view)
- Landscape orientation preferred
- Minimum 800px width
- NO logos or text graphics

### Step 5: Verify Data Flow
1. Run the scraper: `node scripts/full-scrape-parallel.js`
2. Check API returns course data: `curl https://bayareagolf.now/api/tee-times/next-available`
3. Verify homepage shows price tags for new courses
4. Verify course page shows beautiful hole photo

### Debugging Course Data Mismatches

To find courses with data not showing on homepage:
```sql
-- Courses with tee time data
SELECT DISTINCT c.name, c.slug
FROM courses c
JOIN tee_times t ON c.id = t.course_id;
```

Compare against `data-course` attributes in `public/index.html`.

Common issues:
- Name mismatch (e.g., "Wente Vineyards" vs "The Course at Wente Vineyards")
- Missing CSS positioning class
- Missing HTML element on homepage

### Map Interaction Rules

**CRITICAL**: Never add features that block pointer events on the map. The homepage map must always support:
- Dragging/panning
- Zoom in/out buttons
- Clicking on course fairways

Any overlays or UI elements must use `pointer-events: none` or be positioned outside the interactive map area.
