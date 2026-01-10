# Sitemap Implementation Guide

Quick reference for implementing sitemap improvements and monitoring.

## Table of Contents
1. [Current Implementation](#current-implementation)
2. [Testing the Sitemap](#testing-the-sitemap)
3. [Performance Optimization](#performance-optimization)
4. [Cache Invalidation](#cache-invalidation)
5. [Monitoring Script](#monitoring-script)
6. [Search Console Integration](#search-console-integration)

---

## Current Implementation

### Location
- **Endpoint:** `/sitemap.xml` (served from `/api/index.js`)
- **Database Query:** `SELECT slug, updated_at FROM courses ORDER BY region, name`
- **Output:** XML 1.0 UTF-8

### Quick Stats
```
Total URLs:        101
Main Pages:        5
Regional Pages:    7
Course Pages:      89
Estimated Size:    ~20 KB
Last Update:       Real-time (on each request)
```

---

## Testing the Sitemap

### 1. Verify Accessibility

```bash
# Check sitemap is accessible
curl -i https://bayareagolf.now/sitemap.xml

# Expected output:
# HTTP/2 200
# content-type: application/xml
# content-length: (varies)
```

### 2. Validate XML Structure

```bash
# Verify XML is well-formed
curl -s https://bayareagolf.now/sitemap.xml | xmllint --noout -
# Should output: [nothing = valid] or show errors

# Using alternative validator if xmllint unavailable
curl -s https://bayareagolf.now/sitemap.xml | head -20
```

### 3. Count Total URLs

```bash
# Count URLs in sitemap
curl -s https://bayareagolf.now/sitemap.xml | grep -o '<loc>' | wc -l

# Expected: 101 URLs

# Breakdown by type
echo "=== Main Pages ==="
curl -s https://bayareagolf.now/sitemap.xml | grep '<loc>.*\(index\|app\.html\|courses\.html\|scorebook\|community\)' | wc -l

echo "=== Regional Pages ==="
curl -s https://bayareagolf.now/sitemap.xml | grep '<loc>.*\(-golf\|golf-courses\)' | wc -l

echo "=== Course Pages ==="
curl -s https://bayareagolf.now/sitemap.xml | grep '<loc>.*\/course\/' | wc -l
```

### 4. Verify Specific Courses

```bash
# Check if specific course appears in sitemap
curl -s https://bayareagolf.now/sitemap.xml | grep "tpc-harding-park"
# Expected: <loc>https://bayareagolf.now/course/tpc-harding-park</loc>

# Verify course pages are accessible
for course in tpc-harding-park lincoln-park-golf-course sharp-park-golf-course; do
  echo "Testing: /course/$course"
  curl -I https://bayareagolf.now/course/$course | grep HTTP
done

# Expected: HTTP/2 200 for each course
```

### 5. Check HTTP Headers

```bash
# Verify correct content type
curl -I https://bayareagolf.now/sitemap.xml | grep -i content-type
# Should show: content-type: application/xml

# Check for caching headers (if implemented)
curl -I https://bayareagolf.now/sitemap.xml | grep -i cache
```

### 6. Compare with Database

```bash
# Count courses in database
# (Run via API or database client)
curl -s 'https://bayareagolf.now/api/courses?all=true' | jq 'length'

# Compare with sitemap count
SITEMAP_COUNT=$(curl -s https://bayareagolf.now/sitemap.xml | grep '<loc>.*\/course\/' | wc -l)
echo "Courses in sitemap: $SITEMAP_COUNT"

# If different, sitemap may need regeneration
```

---

## Performance Optimization

### Current Performance
- Generation time: ~100-200ms (depends on database latency)
- Request overhead: Minimal (single database query)
- Caching: None (regenerated on each request)

### Recommended Optimization: Add Caching

**Benefits:**
- Reduce database load (especially during crawler activity)
- Faster responses to search engines
- Lower server CPU usage

**Implementation in `/api/index.js`:**

```javascript
// Add at top of file with other middleware setup
const sitemapCache = {
  xml: null,
  timestamp: null,
  maxAge: 3600000, // Cache for 1 hour (3600000 ms)
  isGenerating: false
};

// Updated sitemap endpoint
app.get('/sitemap.xml', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached sitemap if fresh
    if (sitemapCache.xml && (now - sitemapCache.timestamp) < sitemapCache.maxAge) {
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hour browser cache
      res.set('X-Cache', 'HIT');
      return res.send(sitemapCache.xml);
    }

    // Only one generation process at a time
    if (sitemapCache.isGenerating) {
      // Return stale cache if available while regenerating
      if (sitemapCache.xml) {
        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=60'); // Shorter cache while generating
        res.set('X-Cache', 'STALE');
        return res.send(sitemapCache.xml);
      }
      return res.status(503).send('Sitemap is being regenerated, please retry');
    }

    sitemapCache.isGenerating = true;

    // Generate fresh sitemap
    const coursesResult = await db.execute('SELECT slug, updated_at FROM courses ORDER BY region, name');
    const courses = coursesResult.rows;
    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Main Pages -->
  <url>
    <loc>https://bayareagolf.now/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/app.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/courses.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/scorebook.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/community.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>

  <!-- Regional Landing Pages -->
  <url>
    <loc>https://bayareagolf.now/sf-golf</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/east-bay-golf</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/south-bay-golf</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/north-bay-golf</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/peninsula-golf</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/monterey-golf</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bayareagolf.now/sacramento-golf</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Individual Course Pages -->
${courses.map(c => `  <url>
    <loc>https://bayareagolf.now/course/${c.slug}</loc>
    <lastmod>${c.updated_at ? c.updated_at.split('T')[0] : today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`;

    // Cache the result
    sitemapCache.xml = xml;
    sitemapCache.timestamp = now;
    sitemapCache.isGenerating = false;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour browser cache
    res.set('X-Cache', 'MISS');
    res.set('X-Generated-At', new Date().toISOString());
    res.send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    sitemapCache.isGenerating = false;
    res.status(500).send('Error generating sitemap');
  }
});
```

**Testing Cache Implementation:**

```bash
# First request - cache miss
time curl -s https://bayareagolf.now/sitemap.xml > /tmp/sitemap1.xml
curl -I https://bayareagolf.now/sitemap.xml | grep X-Cache
# Should show: X-Cache: MISS

# Second request - cache hit (should be much faster)
time curl -s https://bayareagolf.now/sitemap.xml > /tmp/sitemap2.xml
curl -I https://bayareagolf.now/sitemap.xml | grep X-Cache
# Should show: X-Cache: HIT

# Verify content is identical
diff /tmp/sitemap1.xml /tmp/sitemap2.xml
# Should show: [nothing = identical]
```

---

## Cache Invalidation

### Automatic Invalidation Triggers

Add cache invalidation to course management endpoints:

```javascript
// Helper function to invalidate sitemap cache
function invalidateSitemapCache() {
  sitemapCache.xml = null;
  sitemapCache.timestamp = null;
  console.log('[Sitemap] Cache invalidated');
}

// When creating a new course
app.post('/api/admin/courses', adminAuth, async (req, res) => {
  try {
    // ... course creation logic ...

    invalidateSitemapCache(); // Clear cache

    // ... rest of function ...
  } catch (error) {
    // ...
  }
});

// When updating a course slug
app.put('/api/admin/courses/:id', adminAuth, async (req, res) => {
  try {
    const { slug, /* other fields */ } = req.body;

    // ... course update logic ...

    if (/* slug was changed */) {
      invalidateSitemapCache(); // Clear cache on slug change
    }

    // ... rest of function ...
  } catch (error) {
    // ...
  }
});

// When deleting a course
app.delete('/api/admin/courses/:id', adminAuth, async (req, res) => {
  try {
    // ... course deletion logic ...

    invalidateSitemapCache(); // Clear cache

    // ... rest of function ...
  } catch (error) {
    // ...
  }
});
```

### Manual Cache Invalidation

Add an admin endpoint to manually clear the cache:

```javascript
// Admin endpoint to manually invalidate cache
app.post('/api/admin/sitemap/invalidate', adminAuth, async (req, res) => {
  try {
    invalidateSitemapCache();
    res.json({
      success: true,
      message: 'Sitemap cache invalidated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoint to get sitemap cache status
app.get('/api/admin/sitemap/status', adminAuth, async (req, res) => {
  try {
    const cacheAge = sitemapCache.timestamp ? Date.now() - sitemapCache.timestamp : null;
    res.json({
      cached: sitemapCache.xml !== null,
      cacheAge: cacheAge ? `${Math.round(cacheAge / 1000)}s` : 'No cache',
      maxAge: `${sitemapCache.maxAge / 1000}s`,
      isGenerating: sitemapCache.isGenerating,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Monitoring Script

### Daily Health Check Script

Create `/scripts/sitemap-health-check.js`:

```javascript
#!/usr/bin/env node

const https = require('https');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'https://bayareagolf.now';

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function httpRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    }).on('error', reject);
  });
}

async function runHealthCheck() {
  log('\n=== Bay Area Golf Sitemap Health Check ===\n', 'blue');

  const checks = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  try {
    // 1. Verify sitemap is accessible
    log('1. Checking sitemap accessibility...', 'blue');
    const sitemapResponse = await httpRequest(`${BASE_URL}/sitemap.xml`);

    if (sitemapResponse.status === 200) {
      log('   ✓ Sitemap returns 200 OK', 'green');
      checks.passed++;
    } else {
      log(`   ✗ Sitemap returns ${sitemapResponse.status}`, 'red');
      checks.failed++;
    }

    // 2. Verify content type
    log('\n2. Checking content type...', 'blue');
    const contentType = sitemapResponse.headers['content-type'];
    if (contentType && contentType.includes('xml')) {
      log(`   ✓ Content-Type is ${contentType}`, 'green');
      checks.passed++;
    } else {
      log(`   ✗ Content-Type is ${contentType}`, 'red');
      checks.failed++;
    }

    // 3. Validate XML structure
    log('\n3. Validating XML structure...', 'blue');
    const sitemapXml = sitemapResponse.body;
    if (sitemapXml.startsWith('<?xml')) {
      log('   ✓ Valid XML declaration found', 'green');
      checks.passed++;
    } else {
      log('   ✗ Invalid XML format', 'red');
      checks.failed++;
    }

    // 4. Count URLs
    log('\n4. Counting URLs in sitemap...', 'blue');
    const urlMatches = sitemapXml.match(/<loc>/g) || [];
    const totalUrls = urlMatches.length;
    const courseUrls = (sitemapXml.match(/\/course\//g) || []).length;

    log(`   ✓ Total URLs: ${totalUrls}`, 'green');
    log(`   ✓ Course pages: ${courseUrls}`, 'green');

    if (totalUrls >= 100) {
      log(`   ✓ URL count is healthy (>100)`, 'green');
      checks.passed++;
    } else if (totalUrls >= 80) {
      log(`   ⚠ URL count is lower than expected (${totalUrls})`, 'yellow');
      checks.warnings++;
    } else {
      log(`   ✗ URL count is critically low (${totalUrls})`, 'red');
      checks.failed++;
    }

    // 5. Verify homepage in sitemap
    log('\n5. Verifying main URLs...', 'blue');
    const mainUrls = [
      { name: 'Homepage', pattern: 'https://bayareagolf.now/<' },
      { name: 'App page', pattern: 'app.html<' },
      { name: 'Courses page', pattern: 'courses.html<' },
      { name: 'Sample course', pattern: 'course/tpc-harding-park<' }
    ];

    for (const url of mainUrls) {
      const regex = new RegExp(`<loc>${url.pattern.replace('<', '[^<]*')}`);
      if (regex.test(sitemapXml)) {
        log(`   ✓ ${url.name} found`, 'green');
        checks.passed++;
      } else {
        log(`   ✗ ${url.name} not found`, 'red');
        checks.failed++;
      }
    }

    // 6. Test sample course pages
    log('\n6. Testing sample course pages...', 'blue');
    const sampleCourses = [
      'tpc-harding-park',
      'lincoln-park-golf-course',
      'cinnabar-hills-golf-club'
    ];

    for (const course of sampleCourses) {
      const courseResponse = await httpRequest(`${BASE_URL}/course/${course}`);
      if (courseResponse.status === 200) {
        log(`   ✓ /course/${course} (${courseResponse.status})`, 'green');
        checks.passed++;
      } else {
        log(`   ✗ /course/${course} (${courseResponse.status})`, 'red');
        checks.failed++;
      }
    }

    // 7. Check robots.txt
    log('\n7. Checking robots.txt configuration...', 'blue');
    const robotsResponse = await httpRequest(`${BASE_URL}/robots.txt`);
    if (robotsResponse.body.includes('sitemap.xml')) {
      log('   ✓ robots.txt references sitemap.xml', 'green');
      checks.passed++;
    } else {
      log('   ✗ robots.txt does not reference sitemap.xml', 'red');
      checks.failed++;
    }

  } catch (error) {
    log(`\n✗ Error running health check: ${error.message}`, 'red');
    checks.failed++;
  }

  // Summary
  log('\n=== Health Check Summary ===\n', 'blue');
  log(`Passed:  ${checks.passed} ✓`, 'green');
  log(`Warnings: ${checks.warnings} ⚠`, 'yellow');
  log(`Failed:  ${checks.failed} ✗`, checks.failed > 0 ? 'red' : 'green');

  const totalChecks = checks.passed + checks.warnings + checks.failed;
  const percentage = Math.round((checks.passed / totalChecks) * 100);
  log(`\nOverall: ${percentage}%\n`, percentage >= 90 ? 'green' : percentage >= 70 ? 'yellow' : 'red');

  process.exit(checks.failed > 0 ? 1 : 0);
}

runHealthCheck();
```

### Running the Health Check

```bash
# Add to package.json scripts:
# "sitemap-check": "node scripts/sitemap-health-check.js"

# Run manually
BASE_URL=https://bayareagolf.now node scripts/sitemap-health-check.js

# Run locally during development
BASE_URL=http://localhost:3000 node scripts/sitemap-health-check.js

# Add to GitHub Actions (run daily)
# .github/workflows/sitemap-check.yml
```

---

## Search Console Integration

### 1. Setup in Google Search Console

1. **Go to** https://search.google.com/search-console
2. **Select property** "https://bayareagolf.now/"
3. **Navigate to** "Sitemaps" (left menu > Crawl > Sitemaps)
4. **URL bar** shows: `https://bayareagolf.now/`
5. **Add new sitemap:**
   - Click "Add/test sitemap"
   - Enter: `sitemap.xml`
   - Click "Submit"

### 2. Monitor Indexing Status

After submitting, check weekly:

1. **Coverage Report:**
   - Sitemaps > Select `bayareagolf.now/sitemap.xml`
   - Review "Coverage" tab
   - Should show:
     - Valid: ~101 URLs
     - Excluded: 0-5 (redirects, duplicates)
     - Error: 0 (if working properly)

2. **Common Issues:**
   - **Excluded (not indexed):** Pages may be blocked by robots.txt or have duplicate content
   - **Errors:** Check Search Console for specific error messages
   - **Warnings:** Review metadata (title, description) issues

### 3. Request Indexing

When you add new courses:

1. Go to Sitemaps section
2. Click "Request indexing" button
3. Google will recrawl updated URLs

### 4. Check Crawl Statistics

Under "Crawl stats" section, monitor:
- Total requests per day
- Peak hours (usually business hours)
- Crawl errors (should be minimal)

### 5. Submit to Bing

1. **Go to** https://www.bing.com/webmasters
2. **Select property** "bayareagolf.now"
3. **Navigate to** "Sitemaps"
4. **Submit:** `https://bayareagolf.now/sitemap.xml`

---

## Quick Command Reference

```bash
# Check sitemap is accessible
curl -I https://bayareagolf.now/sitemap.xml

# View first 30 lines
curl -s https://bayareagolf.now/sitemap.xml | head -30

# Count total URLs
curl -s https://bayareagolf.now/sitemap.xml | grep -c '<loc>'

# Count course URLs
curl -s https://bayareagolf.now/sitemap.xml | grep -c '/course/'

# Validate XML
curl -s https://bayareagolf.now/sitemap.xml | xmllint --noout -

# Search for specific course
curl -s https://bayareagolf.now/sitemap.xml | grep "course-name"

# Get sitemap size
curl -s https://bayareagolf.now/sitemap.xml | wc -c

# Get sitemap with headers
curl -v https://bayareagolf.now/sitemap.xml 2>&1 | head -20

# Test cache (requires cache implementation)
curl -I https://bayareagolf.now/sitemap.xml | grep -i x-cache
```

---

## Troubleshooting

### Sitemap not updating after adding course

```bash
# 1. Check if course is in database
curl -s 'https://bayareagolf.now/api/courses?all=true' | jq '.[] | select(.slug == "course-slug")'

# 2. Verify course slug is correct
# Check src/db/courses.js for name field

# 3. Force cache invalidation (if cache implemented)
curl -X POST https://bayareagolf.now/api/admin/sitemap/invalidate \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Wait 5 seconds and re-fetch sitemap
sleep 5
curl -s https://bayareagolf.now/sitemap.xml | grep "course-slug"
```

### Sitemap returns 500 error

```bash
# 1. Check server logs
tail -f logs/error.log

# 2. Verify database connection
echo "SELECT COUNT(*) FROM courses;" | sqlite3 database.db

# 3. Check API health
curl -s https://bayareagolf.now/api/health | jq .

# 4. Test locally
BASE_URL=http://localhost:3000 node scripts/sitemap-health-check.js
```

---

**Last Updated:** January 8, 2026
