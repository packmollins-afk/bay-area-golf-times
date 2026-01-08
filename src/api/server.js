require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('../db/schema');
const { seedCourses, getAllCourses, getCoursesByRegion, getTournamentHistory } = require('../db/courses');
const { runScraper } = require('../scrapers/golfnow');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

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
 * Query params: date (REQUIRED), region (REQUIRED), course_id, min_time, max_time, max_price, holes, players
 * Returns 400 if region or date is missing (to reduce API load)
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

    // Require region and date for app.html (reduces API load)
    // Allow bypass for course.html and index.html via course_id or next_available
    const isCourseSpecific = course_id;
    const isNextAvailableMode = next_available === 'true' || next_available === '1';

    if (!isCourseSpecific && !isNextAvailableMode) {
      if (!region) {
        return res.status(400).json({ error: 'Region is required. Please select a region.' });
      }
      if (!date) {
        return res.status(400).json({ error: 'Date is required. Please select a date.' });
      }
    }

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

    // Filter by date (required unless next_available mode)
    if (!isNextAvailableMode && date) {
      sql += ' AND t.date = ?';
      params.push(date);
    }

    // Filter by region (required unless course_id specified)
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
 * GET /api/tee-times/next-available
 * Get the cheapest next available tee time for each course
 * Used by homepage to show price tags
 */
app.get('/api/tee-times/next-available', (req, res) => {
  try {
    // Get the first (cheapest by time) future tee time per course
    const teeTimes = db.prepare(`
      SELECT
        t.*,
        c.name as course_name,
        c.city,
        c.region
      FROM tee_times t
      JOIN courses c ON t.course_id = c.id
      WHERE t.datetime >= datetime('now', '-8 hours')
      AND t.id IN (
        SELECT MIN(t2.id)
        FROM tee_times t2
        WHERE t2.course_id = t.course_id
          AND t2.datetime >= datetime('now', '-8 hours')
        GROUP BY t2.course_id
      )
      ORDER BY c.name
    `).all();
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
 * GET /api/courses/compare
 * Compare two courses - stats, weather, costs, tee times, ratings
 * Query params: course1, course2 (course IDs)
 */
app.get('/api/courses/compare', (req, res) => {
  try {
    const { course1, course2 } = req.query;

    if (!course1 || !course2) {
      return res.status(400).json({ error: 'Both course1 and course2 IDs are required' });
    }

    // Get both courses
    const courseData1 = db.prepare(`
      SELECT id, name, slug, city, region, holes, par, yardage, slope_rating, course_rating,
             phone_number, website_url, booking_url, latitude, longitude, photo_url, avg_rating
      FROM courses WHERE id = ?
    `).get(course1);

    const courseData2 = db.prepare(`
      SELECT id, name, slug, city, region, holes, par, yardage, slope_rating, course_rating,
             phone_number, website_url, booking_url, latitude, longitude, photo_url, avg_rating
      FROM courses WHERE id = ?
    `).get(course2);

    if (!courseData1 || !courseData2) {
      return res.status(404).json({ error: 'One or both courses not found' });
    }

    // Get tee times for next 7 days for both courses
    const today = new Date();
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    const todayStr = today.toISOString().split('T')[0];
    const weekStr = weekLater.toISOString().split('T')[0];

    const teeTimes1 = db.prepare(`
      SELECT date, time, price, holes, players, has_cart, booking_url
      FROM tee_times
      WHERE course_id = ? AND date >= ? AND date < ?
        AND datetime >= datetime('now', '-8 hours')
      ORDER BY datetime ASC
    `).all(course1, todayStr, weekStr);

    const teeTimes2 = db.prepare(`
      SELECT date, time, price, holes, players, has_cart, booking_url
      FROM tee_times
      WHERE course_id = ? AND date >= ? AND date < ?
        AND datetime >= datetime('now', '-8 hours')
      ORDER BY datetime ASC
    `).all(course2, todayStr, weekStr);

    // Calculate price stats
    const calcPriceStats = (times) => {
      if (!times.length) return { min: null, max: null, avg: null };
      const prices = times.map(t => t.price);
      return {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      };
    };

    res.json({
      course1: {
        ...courseData1,
        teeTimes: teeTimes1,
        priceStats: calcPriceStats(teeTimes1),
        availableCount: teeTimes1.length
      },
      course2: {
        ...courseData2,
        teeTimes: teeTimes2,
        priceStats: calcPriceStats(teeTimes2),
        availableCount: teeTimes2.length
      }
    });
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
 * GET /api/courses/:id/booking-info
 * Get course info from Golf Course API and tee times for next 2 days
 * This is the simplified endpoint for the booking popup
 */
app.get('/api/courses/:id/booking-info', async (req, res) => {
  try {
    const { id } = req.params;

    // Get course basic info from our database
    const course = db.prepare(`
      SELECT id, name, slug, city, region, holes, par, yardage, slope_rating, course_rating,
             phone_number, website_url, booking_url, latitude, longitude, photo_url
      FROM courses WHERE id = ?
    `).get(id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get tee times for next 2 days
    const today = new Date();
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);

    const todayStr = today.toISOString().split('T')[0];
    const twoDaysStr = twoDaysLater.toISOString().split('T')[0];

    const teeTimes = db.prepare(`
      SELECT * FROM tee_times
      WHERE course_id = ?
        AND date >= ?
        AND date < ?
        AND datetime >= datetime('now', '-8 hours')
      ORDER BY datetime ASC
    `).all(id, todayStr, twoDaysStr);

    // Fetch external course info from Golf Course API (RapidAPI)
    let externalCourseInfo = null;
    const rapidApiKey = process.env.RAPIDAPI_KEY;

    if (rapidApiKey) {
      try {
        const searchResponse = await fetch(
          `https://golf-course-api.p.rapidapi.com/search?name=${encodeURIComponent(course.name)}`,
          {
            headers: {
              'X-RapidAPI-Key': rapidApiKey,
              'X-RapidAPI-Host': 'golf-course-api.p.rapidapi.com'
            }
          }
        );

        if (searchResponse.ok) {
          const searchResults = await searchResponse.json();
          // Find the best match (first result or match by location)
          if (searchResults && searchResults.length > 0) {
            externalCourseInfo = searchResults[0];

            // Try to find a better match by city
            const cityMatch = searchResults.find(c =>
              c.city?.toLowerCase() === course.city?.toLowerCase() ||
              c.address?.toLowerCase().includes(course.city?.toLowerCase())
            );
            if (cityMatch) {
              externalCourseInfo = cityMatch;
            }
          }
        }
      } catch (apiError) {
        console.error('Golf Course API error:', apiError.message);
        // Continue without external data
      }
    }

    res.json({
      course: {
        ...course,
        external: externalCourseInfo
      },
      teeTimes,
      dates: {
        today: todayStr,
        tomorrow: new Date(today.getTime() + 24*60*60*1000).toISOString().split('T')[0]
      }
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
