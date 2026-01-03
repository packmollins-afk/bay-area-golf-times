const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('../src/db/schema');
const { seedCourses, getAllCourses, getCoursesByRegion, getTournamentHistory, getCourseBySlug, getStaffPicks, setStaffPick } = require('../src/db/courses');
const { runScraper } = require('../src/scrapers/golfnow');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple password hashing (in production, use bcrypt)
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password + 'baygolf_salt_2024').digest('hex');
};

// Generate session token
const generateToken = () => crypto.randomBytes(32).toString('hex');

// Database session helpers
const createSession = (userId) => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt);
  return token;
};

const getSession = (token) => {
  if (!token) return null;
  const session = db.prepare(`
    SELECT s.*, u.email, u.display_name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
  `).get(token);
  if (!session) return null;
  return { id: session.user_id, email: session.email, displayName: session.display_name };
};

const deleteSession = (token) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
};

// Clean up expired sessions periodically
const cleanExpiredSessions = () => {
  try {
    db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  } catch (e) {}
};
setInterval(cleanExpiredSessions, 60 * 60 * 1000); // Every hour

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// User auth middleware
const userAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = getSession(token);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  next();
};

// Optional auth - doesn't fail, just adds user if logged in
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = getSession(token);
  if (user) {
    req.user = user;
  }
  next();
};

/**
 * GET /api/courses
 * Get all courses, optionally filtered by region or staff_picks
 * Query params: region, all, staff_picks
 */
app.get('/api/courses', (req, res) => {
  try {
    const { region, all, staff_picks } = req.query;

    // Staff picks mode - return only staff picks
    if (staff_picks === 'true' || staff_picks === '1') {
      const picks = getStaffPicks();
      return res.json(picks);
    }

    // Return all courses if 'all' param is set
    if (all === 'true' || all === '1') {
      let sql = 'SELECT * FROM courses WHERE 1=1';
      const params = [];

      if (region) {
        sql += ' AND region = ?';
        params.push(region);
      }

      sql += ' ORDER BY region, city, name';
      const courses = db.prepare(sql).all(...params);
      return res.json(courses);
    }

    // Only return courses with upcoming tee times
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
      staff_picks,
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

    // Filter by staff picks
    if (staff_picks === 'true' || staff_picks === '1') {
      sql += ' AND c.is_staff_pick = 1';
    }

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
 * GET /api/courses/slug/:slug
 * Get course by URL slug
 */
app.get('/api/courses/slug/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const course = getCourseBySlug(slug);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get additional details like the ID-based endpoint
    const reviews = db.prepare(`
      SELECT * FROM reviews
      WHERE course_id = ?
      ORDER BY time DESC
      LIMIT 10
    `).all(course.id);

    const recentAvg = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    const photos = db.prepare(`
      SELECT * FROM course_photos
      WHERE course_id = ?
      ORDER BY is_primary DESC, scraped_at DESC
    `).all(course.id);

    const topFood = db.prepare(`
      SELECT * FROM food_items
      WHERE course_id = ?
      ORDER BY avg_rating DESC, mention_count DESC
      LIMIT 1
    `).get(course.id);

    const teeTimeCount = db.prepare(`
      SELECT COUNT(*) as count FROM tee_times
      WHERE course_id = ? AND datetime >= datetime('now', 'localtime')
    `).get(course.id);

    const tournaments = getTournamentHistory(course.id);

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

// ========== USER AUTH ENDPOINTS ==========

/**
 * POST /api/auth/signup
 * Create a new user account
 */
app.post('/api/auth/signup', (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Create user
    const passwordHash = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, display_name)
      VALUES (?, ?, ?)
    `).run(email.toLowerCase(), passwordHash, displayName || email.split('@')[0]);

    // Create session in database
    const token = createSession(result.lastInsertRowid);
    const user = { id: result.lastInsertRowid, email: email.toLowerCase(), displayName: displayName || email.split('@')[0] };

    res.json({ success: true, token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create session in database
    const token = createSession(user.id);
    const userData = { id: user.id, email: user.email, displayName: user.display_name };

    res.json({ success: true, token, user: userData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Logout current session
 */
app.post('/api/auth/logout', userAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  deleteSession(token);
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
app.get('/api/auth/me', userAuth, (req, res) => {
  res.json({ user: req.user });
});

// ========== USER FAVORITES ==========

/**
 * GET /api/user/favorites
 * Get user's favorite courses
 */
app.get('/api/user/favorites', userAuth, (req, res) => {
  try {
    const favorites = db.prepare(`
      SELECT c.* FROM courses c
      INNER JOIN user_favorites uf ON c.id = uf.course_id
      WHERE uf.user_id = ?
      ORDER BY uf.created_at DESC
    `).all(req.user.id);
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/favorites/:courseId
 * Add course to favorites
 */
app.post('/api/user/favorites/:courseId', userAuth, (req, res) => {
  try {
    const { courseId } = req.params;
    db.prepare(`
      INSERT OR IGNORE INTO user_favorites (user_id, course_id)
      VALUES (?, ?)
    `).run(req.user.id, courseId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/user/favorites/:courseId
 * Remove course from favorites
 */
app.delete('/api/user/favorites/:courseId', userAuth, (req, res) => {
  try {
    const { courseId } = req.params;
    db.prepare(`
      DELETE FROM user_favorites WHERE user_id = ? AND course_id = ?
    `).run(req.user.id, courseId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ROUNDS / SCOREBOOK ==========

/**
 * GET /api/user/rounds
 * Get user's round history
 */
app.get('/api/user/rounds', userAuth, (req, res) => {
  try {
    const rounds = db.prepare(`
      SELECT r.*, c.name as course_name, c.city, c.slug
      FROM rounds r
      INNER JOIN courses c ON r.course_id = c.id
      WHERE r.user_id = ?
      ORDER BY r.date DESC
      LIMIT 50
    `).all(req.user.id);
    res.json(rounds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/rounds
 * Log a new round
 */
app.post('/api/user/rounds', userAuth, (req, res) => {
  try {
    const { courseId, date, totalScore, totalPutts, notes, holes } = req.body;

    const result = db.prepare(`
      INSERT INTO rounds (user_id, course_id, date, total_score, total_putts, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, courseId, date, totalScore, totalPutts, notes);

    const roundId = result.lastInsertRowid;

    // Insert hole-by-hole data if provided
    if (holes && holes.length > 0) {
      const insertHole = db.prepare(`
        INSERT INTO round_holes (round_id, hole_number, par, score, putts, fairway_hit, gir)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const hole of holes) {
        insertHole.run(roundId, hole.number, hole.par, hole.score, hole.putts, hole.fairwayHit ? 1 : 0, hole.gir ? 1 : 0);
      }
    }

    res.json({ success: true, roundId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/stats
 * Get user's golf stats
 */
app.get('/api/user/stats', userAuth, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_rounds,
        COUNT(DISTINCT course_id) as courses_played,
        AVG(total_score) as avg_score,
        MIN(total_score) as best_score,
        AVG(total_putts) as avg_putts
      FROM rounds
      WHERE user_id = ?
    `).get(req.user.id);

    const recentRounds = db.prepare(`
      SELECT r.*, c.name as course_name
      FROM rounds r
      INNER JOIN courses c ON r.course_id = c.id
      WHERE r.user_id = ?
      ORDER BY r.date DESC
      LIMIT 5
    `).all(req.user.id);

    res.json({ stats, recentRounds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/passport
 * Get user's passport progress (courses played)
 */
app.get('/api/user/passport', userAuth, (req, res) => {
  try {
    const played = db.prepare(`
      SELECT DISTINCT c.id, c.name, c.slug, c.city, c.region,
        MIN(r.date) as first_played,
        COUNT(r.id) as times_played,
        MIN(r.total_score) as best_score
      FROM courses c
      INNER JOIN rounds r ON c.id = r.course_id
      WHERE r.user_id = ?
      GROUP BY c.id
      ORDER BY c.region, c.name
    `).all(req.user.id);

    const total = db.prepare('SELECT COUNT(*) as count FROM courses').get();

    res.json({
      played,
      totalCourses: total.count,
      completionPercent: Math.round((played.length / total.count) * 100)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== COMMUNITY / LEADERBOARD ==========

/**
 * GET /api/community/leaderboard
 * Get community leaderboard
 */
app.get('/api/community/leaderboard', (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let dateFilter = "date >= date('now', '-30 days')";
    if (period === 'week') dateFilter = "date >= date('now', '-7 days')";
    if (period === 'all') dateFilter = '1=1';

    const leaderboard = db.prepare(`
      SELECT
        u.id,
        u.display_name,
        COUNT(DISTINCT r.course_id) as courses_played,
        COUNT(r.id) as total_rounds,
        ROUND(AVG(r.total_score), 1) as avg_score
      FROM users u
      INNER JOIN rounds r ON u.id = r.user_id
      WHERE ${dateFilter}
      GROUP BY u.id
      ORDER BY courses_played DESC, total_rounds DESC
      LIMIT 20
    `).all();

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/community/activity
 * Get recent community activity
 */
app.get('/api/community/activity', (req, res) => {
  try {
    const activity = db.prepare(`
      SELECT
        r.id,
        r.date,
        r.total_score,
        u.display_name,
        c.name as course_name,
        c.slug as course_slug
      FROM rounds r
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN courses c ON r.course_id = c.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `).all();

    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoints
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'baygolf2024';

/**
 * POST /api/admin/login
 * Simple password auth for admin
 */
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: Buffer.from(ADMIN_PASSWORD).toString('base64') });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Simple auth middleware
const adminAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const token = auth.replace('Bearer ', '');
  if (Buffer.from(token, 'base64').toString() !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
};

/**
 * GET /api/admin/courses
 * Get all courses with staff pick status
 */
app.get('/api/admin/courses', adminAuth, (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT id, name, city, region, slug, is_staff_pick, staff_pick_order
      FROM courses
      ORDER BY name
    `).all();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/courses/:id
 * Update staff pick status for a course
 */
app.patch('/api/admin/courses/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { is_staff_pick, staff_pick_order } = req.body;

    setStaffPick(id, is_staff_pick, staff_pick_order);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/staff-picks
 * Bulk update staff picks order
 */
app.put('/api/admin/staff-picks', adminAuth, (req, res) => {
  try {
    const { picks } = req.body; // Array of { id, order }

    // Clear all staff picks first
    db.prepare('UPDATE courses SET is_staff_pick = 0, staff_pick_order = NULL').run();

    // Set new picks with order
    const updateStmt = db.prepare('UPDATE courses SET is_staff_pick = 1, staff_pick_order = ? WHERE id = ?');
    for (const pick of picks) {
      updateStmt.run(pick.order, pick.id);
    }

    res.json({ success: true, count: picks.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend for all other routes (Express 5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Bay Area Golf Tee Times API running on http://localhost:${PORT}`);
});

module.exports = app;
