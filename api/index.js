const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('../src/db/schema');
const { seedCourses, getAllCourses, getCoursesByRegion, getTournamentHistory } = require('../src/db/courses');
const { runScraper } = require('../src/scrapers/golfnow');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

/**
 * GET /api/courses
 * Get all courses, optionally filtered by region
 * Only returns courses that have tee times available
 */
app.get('/api/courses', (req, res) => {
  try {
    const { region, all } = req.query;

    // Only return courses with tee times unless 'all' param is set
    let sql = `
      SELECT DISTINCT c.* FROM courses c
      INNER JOIN tee_times t ON c.id = t.course_id
      WHERE t.datetime >= datetime('now', '-8 hours')
    `;
    const params = [];

    if (region) {
      sql += ' AND c.region = ?';
      params.push(region);
    }

    sql += ' ORDER BY c.region, c.city, c.name';

    const courses = db.prepare(sql).all(...params);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/regions
 * Get all unique regions
 */
app.get('/api/regions', (req, res) => {
  try {
    const regions = db.prepare('SELECT DISTINCT region FROM courses ORDER BY region').all();
    res.json(regions.map(r => r.region));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tee-times
 * Get tee times with filters
 * Query params: date, region, course_id, min_time, max_time, max_price, holes, players, next_available
 */
app.get('/api/tee-times', (req, res) => {
  try {
    const {
      date,
      region,
      course_id,
      min_time,
      max_time,
      max_price,
      holes,
      players,
      next_available,
      sort_by = 'datetime',
      sort_order = 'ASC',
      limit = 100,
      offset = 0
    } = req.query;

    let sql = `
      SELECT
        t.*,
        c.name as course_name,
        c.city,
        c.region,
        c.holes as course_holes,
        c.avg_rating
      FROM tee_times t
      JOIN courses c ON t.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // Always filter out past tee times (use Pacific time: UTC-8)
    sql += " AND t.datetime >= datetime('now', '-8 hours')";

    // If not next_available mode, also filter by specific date
    if (next_available !== 'true' && next_available !== '1' && date) {
      sql += ' AND t.date = ?';
      params.push(date);
    }

    if (region) {
      sql += ' AND c.region = ?';
      params.push(region);
    }

    if (course_id) {
      sql += ' AND t.course_id = ?';
      params.push(course_id);
    }

    if (min_time) {
      sql += ' AND t.time >= ?';
      params.push(min_time);
    }

    if (max_time) {
      sql += ' AND t.time <= ?';
      params.push(max_time);
    }

    if (max_price) {
      sql += ' AND t.price <= ?';
      params.push(parseFloat(max_price));
    }

    if (holes) {
      sql += ' AND t.holes = ?';
      params.push(parseInt(holes));
    }

    // Filter by minimum available players (e.g., players=1 means at least 1 spot available)
    if (players) {
      sql += ' AND t.players >= ?';
      params.push(parseInt(players));
    }

    // Validate sort parameters
    const validSortFields = ['datetime', 'time', 'price', 'course_name', 'avg_rating'];
    const validSortOrders = ['ASC', 'DESC'];

    let sortField = validSortFields.includes(sort_by) ? sort_by : 'datetime';
    const order = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';

    // Map sort fields to proper column references
    if (sortField === 'avg_rating') sortField = 'c.avg_rating';
    if (sortField === 'course_name') sortField = 'c.name';

    sql += ` ORDER BY ${sortField} ${order}`;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const teeTimes = db.prepare(sql).all(...params);
    res.json(teeTimes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tee-times/dates
 * Get available dates with tee time counts
 */
app.get('/api/tee-times/dates', (req, res) => {
  try {
    const dates = db.prepare(`
      SELECT date, COUNT(*) as count
      FROM tee_times
      WHERE date >= date('now')
      GROUP BY date
      ORDER BY date
    `).all();
    res.json(dates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tee-times/summary
 * Get summary stats
 */
app.get('/api/tee-times/summary', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_tee_times,
        COUNT(DISTINCT course_id) as courses_with_times,
        COUNT(DISTINCT date) as days_available,
        MIN(price) as min_price,
        MAX(price) as max_price,
        AVG(price) as avg_price
      FROM tee_times
      WHERE date >= date('now')
    `).get();

    const byRegion = db.prepare(`
      SELECT c.region, COUNT(*) as count
      FROM tee_times t
      JOIN courses c ON t.course_id = c.id
      WHERE t.date >= date('now')
      GROUP BY c.region
    `).all();

    res.json({ ...stats, by_region: byRegion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/scrape
 * Trigger a scrape (for manual refresh)
 */
app.post('/api/scrape', async (req, res) => {
  try {
    const { days = 7 } = req.body;
    res.json({ message: 'Scrape started', days });

    // Run scraper in background
    runScraper(days).catch(console.error);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/courses/:id
 * Get detailed course info including reviews, photos, food, records
 */
app.get('/api/courses/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get course basic info
    const course = db.prepare(`
      SELECT * FROM courses WHERE id = ?
    `).get(id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get 10 most recent reviews
    const reviews = db.prepare(`
      SELECT * FROM reviews
      WHERE course_id = ?
      ORDER BY time DESC
      LIMIT 10
    `).all(id);

    // Calculate recent avg rating
    const recentAvg = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    // Get course photos
    const photos = db.prepare(`
      SELECT * FROM course_photos
      WHERE course_id = ?
      ORDER BY is_primary DESC, scraped_at DESC
    `).all(id);

    // Get top-rated food item
    const topFood = db.prepare(`
      SELECT * FROM food_items
      WHERE course_id = ?
      ORDER BY avg_rating DESC, mention_count DESC
      LIMIT 1
    `).get(id);

    // Get upcoming tee times count
    const teeTimeCount = db.prepare(`
      SELECT COUNT(*) as count FROM tee_times
      WHERE course_id = ? AND datetime >= datetime('now', 'localtime')
    `).get(id);

    // Get tournament history
    const tournaments = getTournamentHistory(id);

    res.json({
      ...course,
      recent_avg_rating: recentAvg,
      reviews,
      photos,
      top_food: topFood,
      upcoming_tee_times: teeTimeCount?.count || 0,
      tournament_history: tournaments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend for all other routes (Express 5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Bay Area Golf Tee Times API running on http://localhost:${PORT}`);
});

module.exports = app;
