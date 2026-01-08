require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const UAParser = require('ua-parser-js');
const { createClient } = require('@libsql/client');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

// Turso database connection
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://bay-area-golf-bayareagolfnow.aws-us-west-2.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Resend email client (optional - emails won't send if not configured)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Simple password hashing (in production, use bcrypt)
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password + 'baygolf_salt_2024').digest('hex');
};

// Send verification email with welcome info
const sendVerificationEmail = async (email, token, displayName) => {
  if (!resend) {
    console.log('Resend not configured - skipping verification email');
    return;
  }

  const verifyUrl = `https://bayareagolf.now/api/auth/verify?token=${token}`;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Bay Area Golf <noreply@bayareagolf.now>',
    to: email,
    subject: 'Welcome to Bay Area Golf - Verify Your Account',
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f9f6ef;">
        <div style="background: #2d5a27; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #f4f1e8; font-size: 28px; margin: 0;">Bay Area Golf</h1>
        </div>

        <div style="background: white; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #ddd0bc; border-top: none;">
          <h2 style="color: #2d5a27; font-size: 24px; margin: 0 0 16px 0;">Welcome, ${displayName}!</h2>

          <p style="color: #3d2914; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Thanks for joining Bay Area Golf - your home for discovering and booking tee times across 40+ public courses in the San Francisco Bay Area.
          </p>

          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${verifyUrl}" style="display: inline-block; background: #2d5a27; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Verify Your Email
            </a>
          </div>

          <hr style="border: none; border-top: 2px solid #e8efe6; margin: 32px 0;">

          <h3 style="color: #2d5a27; font-size: 18px; margin: 0 0 16px 0;">What You Can Do:</h3>

          <div style="margin-bottom: 20px;">
            <div style="display: flex; margin-bottom: 16px;">
              <div style="background: #e8efe6; border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; margin-right: 12px; flex-shrink: 0; color: #2d5a27; font-weight: bold;">1</div>
              <div>
                <strong style="color: #3d2914;">Find Tee Times</strong>
                <p style="color: #6b5344; font-size: 14px; margin: 4px 0 0 0;">Search and compare tee times across Bay Area courses. Filter by date, time, price, and region.</p>
              </div>
            </div>

            <div style="display: flex; margin-bottom: 16px;">
              <div style="background: #e8efe6; border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; margin-right: 12px; flex-shrink: 0; color: #2d5a27; font-weight: bold;">2</div>
              <div>
                <strong style="color: #3d2914;">Explore 40+ Courses</strong>
                <p style="color: #6b5344; font-size: 14px; margin: 4px 0 0 0;">Browse detailed course info including yardage, slope rating, photos, and upcoming tee times. Check out our Staff Picks!</p>
              </div>
            </div>

            <div style="display: flex; margin-bottom: 16px;">
              <div style="background: #e8efe6; border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; margin-right: 12px; flex-shrink: 0; color: #2d5a27; font-weight: bold;">3</div>
              <div>
                <strong style="color: #3d2914;">Track Your Rounds</strong>
                <p style="color: #6b5344; font-size: 14px; margin: 4px 0 0 0;">Log your scores in the Scorebook to track your progress and see your stats over time.</p>
              </div>
            </div>

            <div style="display: flex; margin-bottom: 16px;">
              <div style="background: #e8efe6; border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; margin-right: 12px; flex-shrink: 0; color: #2d5a27; font-weight: bold;">4</div>
              <div>
                <strong style="color: #3d2914;">Earn Your Passport</strong>
                <p style="color: #6b5344; font-size: 14px; margin: 4px 0 0 0;">Play different courses to collect stamps on your Bay Area Golf Passport. How many can you visit?</p>
              </div>
            </div>

            <div style="display: flex;">
              <div style="background: #e8efe6; border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; margin-right: 12px; flex-shrink: 0; color: #2d5a27; font-weight: bold;">5</div>
              <div>
                <strong style="color: #3d2914;">Join the Community</strong>
                <p style="color: #6b5344; font-size: 14px; margin: 4px 0 0 0;">See the leaderboard, connect with other Bay Area golfers, and share your golfing journey.</p>
              </div>
            </div>
          </div>

          <hr style="border: none; border-top: 2px solid #e8efe6; margin: 32px 0;">

          <div style="text-align: center;">
            <p style="color: #3d2914; font-size: 16px; margin-bottom: 16px;"><strong>Ready to play?</strong></p>
            <a href="https://bayareagolf.now/app.html" style="display: inline-block; background: white; color: #2d5a27; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; border: 2px solid #2d5a27; margin-right: 8px;">
              Find Tee Times
            </a>
            <a href="https://bayareagolf.now/courses.html" style="display: inline-block; background: white; color: #2d5a27; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; border: 2px solid #2d5a27;">
              Browse Courses
            </a>
          </div>
        </div>

        <p style="color: #6b5344; font-size: 12px; text-align: center; margin-top: 24px;">
          If you didn't create this account, you can safely ignore this email.
        </p>
      </div>
    `
  });
};

// Generate session token
const generateToken = () => crypto.randomBytes(32).toString('hex');

// Database session helpers (async)
const createSession = async (userId) => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.execute({
    sql: 'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    args: [token, userId, expiresAt]
  });
  return token;
};

const getSession = async (token) => {
  if (!token) return null;
  const result = await db.execute({
    sql: `SELECT s.*, u.email, u.display_name, u.profile_picture, u.home_course_id, u.handicap,
          c.name as home_course_name, c.slug as home_course_slug
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          LEFT JOIN courses c ON u.home_course_id = c.id
          WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))`,
    args: [token]
  });
  if (!result.rows.length) return null;
  const session = result.rows[0];
  return {
    id: session.user_id,
    email: session.email,
    displayName: session.display_name,
    profilePicture: session.profile_picture,
    homeCourseId: session.home_course_id,
    homeCourseName: session.home_course_name,
    homeCourseSlug: session.home_course_slug,
    handicap: session.handicap
  };
};

const deleteSession = async (token) => {
  await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
};

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize clicks table for tracking
(async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_slug TEXT NOT NULL,
      course_name TEXT,
      booking_system TEXT,
      clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      source TEXT DEFAULT 'regular',
      visitor_id TEXT,
      session_id TEXT,
      is_returning_visitor INTEGER DEFAULT 0,
      visit_count INTEGER DEFAULT 1,
      referrer TEXT,
      referrer_domain TEXT,
      referrer_type TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_term TEXT,
      utm_content TEXT,
      landing_page TEXT,
      ip_hash TEXT,
      country TEXT,
      country_code TEXT,
      region TEXT,
      city TEXT,
      latitude REAL,
      longitude REAL,
      timezone TEXT,
      user_agent TEXT,
      device_type TEXT,
      device_brand TEXT,
      device_model TEXT,
      os_name TEXT,
      os_version TEXT,
      browser TEXT,
      browser_version TEXT,
      is_bot INTEGER DEFAULT 0,
      screen_width INTEGER,
      screen_height INTEGER,
      viewport_width INTEGER,
      viewport_height INTEGER,
      pixel_ratio REAL,
      color_depth INTEGER,
      language TEXT,
      languages TEXT,
      timezone_offset INTEGER,
      has_touch INTEGER,
      connection_type TEXT,
      is_golfnow INTEGER DEFAULT 0,
      is_mobile INTEGER DEFAULT 0,
      is_tablet INTEGER DEFAULT 0,
      is_desktop INTEGER DEFAULT 0
    )
  `);

  // Indexes for fast queries
  await db.execute('CREATE INDEX IF NOT EXISTS idx_clicks_slug ON clicks(course_slug)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_clicks_date ON clicks(clicked_at)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_clicks_golfnow ON clicks(is_golfnow)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_clicks_visitor ON clicks(visitor_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_clicks_session ON clicks(session_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_clicks_country ON clicks(country_code)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_clicks_device ON clicks(device_type)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_clicks_referrer_type ON clicks(referrer_type)');

  // Visitors table for tracking return visits
  await db.execute(`
    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      visit_count INTEGER DEFAULT 1,
      click_count INTEGER DEFAULT 0,
      country TEXT,
      city TEXT,
      device_type TEXT,
      browser TEXT
    )
  `);
})();

// Async user auth middleware
const userAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = await getSession(token);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  next();
};

// Async optional auth
const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = await getSession(token);
  if (user) req.user = user;
  next();
};

// ========== SITEMAP ENDPOINT ==========

app.get('/sitemap.xml', async (req, res) => {
  try {
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

  <!-- Individual Course Pages -->
${courses.map(c => `  <url>
    <loc>https://bayareagolf.now/course/${c.slug}</loc>
    <lastmod>${c.updated_at ? c.updated_at.split('T')[0] : today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// ========== COURSE ENDPOINTS ==========

app.get('/api/courses', async (req, res) => {
  try {
    const { region, all, staff_picks } = req.query;

    if (staff_picks === 'true') {
      const result = await db.execute('SELECT * FROM courses WHERE is_staff_pick = 1 ORDER BY staff_pick_order ASC, name ASC');
      return res.json(result.rows);
    }

    if (all === 'true') {
      const result = await db.execute('SELECT * FROM courses ORDER BY region, city, name');
      return res.json(result.rows);
    }

    if (region) {
      const result = await db.execute({ sql: 'SELECT * FROM courses WHERE region = ? ORDER BY city, name', args: [region] });
      return res.json(result.rows);
    }

    // Default: courses with prices (using Pacific timezone for comparisons)
    const pacificNow = getPacificNow();
    const result = await db.execute({
      sql: `SELECT c.*,
        (SELECT MIN(t.price) FROM tee_times t WHERE t.course_id = c.id AND t.datetime >= ?) as next_price,
        (SELECT t.datetime FROM tee_times t WHERE t.course_id = c.id AND t.datetime >= ? ORDER BY t.datetime LIMIT 1) as next_time
      FROM courses c
      ORDER BY c.region, c.city, c.name`,
      args: [pacificNow, pacificNow]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compare two courses - MUST be before :idOrSlug route
app.get('/api/courses/compare', async (req, res) => {
  try {
    const { course1, course2 } = req.query;

    if (!course1 || !course2) {
      return res.status(400).json({ error: 'Two course IDs required' });
    }

    const [c1Result, c2Result] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM courses WHERE id = ?', args: [parseInt(course1)] }),
      db.execute({ sql: 'SELECT * FROM courses WHERE id = ?', args: [parseInt(course2)] })
    ]);

    if (!c1Result.rows.length || !c2Result.rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get current date/time in Pacific timezone for comparison
    const now = new Date();
    const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const todayStr = pst.toISOString().split('T')[0];
    const currentTime = pst.toTimeString().slice(0, 5);

    const [tt1Result, tt2Result] = await Promise.all([
      db.execute({
        sql: `SELECT * FROM tee_times WHERE course_id = ? AND (date > ? OR (date = ? AND time >= ?)) ORDER BY date, time LIMIT 20`,
        args: [parseInt(course1), todayStr, todayStr, currentTime]
      }),
      db.execute({
        sql: `SELECT * FROM tee_times WHERE course_id = ? AND (date > ? OR (date = ? AND time >= ?)) ORDER BY date, time LIMIT 20`,
        args: [parseInt(course2), todayStr, todayStr, currentTime]
      })
    ]);

    const getPriceStats = (teeTimes) => {
      if (!teeTimes.length) return null;
      const prices = teeTimes.map(t => t.price).filter(p => p);
      if (!prices.length) return null;
      return {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      };
    };

    res.json({
      course1: { ...c1Result.rows[0], teeTimes: tt1Result.rows, priceStats: getPriceStats(tt1Result.rows) },
      course2: { ...c2Result.rows[0], teeTimes: tt2Result.rows, priceStats: getPriceStats(tt2Result.rows) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/courses/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let result;

    if (/^\d+$/.test(idOrSlug)) {
      result = await db.execute({ sql: 'SELECT * FROM courses WHERE id = ?', args: [parseInt(idOrSlug)] });
    } else {
      result = await db.execute({ sql: 'SELECT * FROM courses WHERE slug = ?', args: [idOrSlug] });
    }

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = result.rows[0];

    // Ensure we have fresh tee times
    await ensureTeeTimesExist();

    // Get tee times (using Pacific timezone)
    const pacificNow = getPacificNow();
    const teeTimesResult = await db.execute({
      sql: `SELECT * FROM tee_times WHERE course_id = ? AND datetime >= ? ORDER BY datetime LIMIT 50`,
      args: [course.id, pacificNow]
    });

    // Get tournament history
    const tournamentsResult = await db.execute({
      sql: 'SELECT * FROM tournament_history WHERE course_id = ? ORDER BY year DESC LIMIT 5',
      args: [course.id]
    });

    // Get users with this as home course
    const homeUsersResult = await db.execute({
      sql: 'SELECT id, display_name, handicap FROM users WHERE home_course_id = ? LIMIT 10',
      args: [course.id]
    });

    res.json({
      ...course,
      teeTimes: teeTimesResult.rows,
      tournamentHistory: tournamentsResult.rows,
      homeUsers: homeUsersResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/courses/:id/tee-times', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, minPrice, maxPrice, time } = req.query;

    // Use Pacific timezone for filtering
    const pacificNow = getPacificNow();
    let sql = `SELECT * FROM tee_times WHERE course_id = ? AND datetime >= ?`;
    const args = [parseInt(id), pacificNow];

    if (date) {
      sql += ' AND date = ?';
      args.push(date);
    }
    if (minPrice) {
      sql += ' AND price >= ?';
      args.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      sql += ' AND price <= ?';
      args.push(parseFloat(maxPrice));
    }

    sql += ' ORDER BY datetime LIMIT 100';

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TEE TIME ENDPOINTS ==========

// Helper to get current Pacific datetime string
const getPacificNow = () => {
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const year = pst.getFullYear();
  const month = String(pst.getMonth() + 1).padStart(2, '0');
  const day = String(pst.getDate()).padStart(2, '0');
  const hours = String(pst.getHours()).padStart(2, '0');
  const mins = String(pst.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}`;
};

// Helper to get Pacific date string for a given offset
const getPacificDate = (dayOffset = 0) => {
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  pst.setDate(pst.getDate() + dayOffset);
  const year = pst.getFullYear();
  const month = String(pst.getMonth() + 1).padStart(2, '0');
  const day = String(pst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Base prices for courses (used for on-the-fly generation)
const COURSE_BASE_PRICES = {
  'TPC Harding Park': 89, 'Lincoln Park Golf Course': 52, 'Sharp Park Golf Course': 48,
  'Presidio Golf Course': 165, 'Golden Gate Park Golf Course': 24, 'San Jose Municipal Golf Course': 45,
  'Cinnabar Hills Golf Club': 79, 'Santa Teresa Golf Club': 65, 'Palo Alto Golf Course': 62,
  'Deep Cliff Golf Course': 38, 'Corica Park - South Course': 75, 'Corica Park - North Course': 55,
  'Metropolitan Golf Links': 68, 'Tilden Park Golf Course': 52, 'Boundary Oak Golf Course': 54,
  'Poppy Ridge Golf Course': 72, 'Peacock Gap Golf Club': 75, 'Indian Valley Golf Club': 55,
  'StoneTree Golf Club': 89, 'Mill Valley Golf Course': 32, 'TPC Harding Park - Fleming 9': 42,
  'Crystal Springs Golf Course': 85, 'Half Moon Bay - Old Course': 175, 'Half Moon Bay - Ocean Course': 195,
  'The Links at Bodega Harbour': 85, 'Northwood Golf Club': 55, 'Pasatiempo Golf Club': 295,
  'Diablo Creek Golf Course': 52, 'The Bridges Golf Club': 95, 'San Ramon Golf Club': 65,
  'Las Positas Golf Course': 58, 'Callippe Preserve Golf Course': 72, 'McInnis Park Golf Center': 52,
  'Redwood Canyon Golf Course': 58, 'Chardonnay Golf Club': 75, 'Eagle Vines Golf Club': 85,
  'Napa Golf Course at Kennedy Park': 55, "Vintner's Golf Club": 45, 'Silverado Resort - North Course': 195,
  'Silverado Resort - South Course': 175,
  // Sonoma
  'Bennett Valley Golf Course': 55, 'Windsor Golf Club': 65, 'Valley of the Moon Club': 55,
  'Sonoma Golf Club': 95, 'Fairgrounds Golf Course': 22, 'Oakmont Golf Club': 40,
  // Monterey
  'Pacific Grove Golf Links': 52, 'Bayonet Golf Course': 95, 'Black Horse Golf Club': 95,
  'Del Monte Golf Course': 120, 'Laguna Seca Golf Ranch': 75, 'The Quail Golf Club': 175,
  'Carmel Valley Ranch': 195, 'Corral de Tierra Country Club': 85, 'Twin Creeks Golf Course': 20,
  'The Club at Crazy Horse Ranch': 65, 'Salinas Fairways Golf Course': 18, 'Monterey Pines Golf Club': 45,
  // Napa - CourseCo
  'Napa Golf Course': 65,
  // Sacramento - CourseCo
  'Ancil Hoffman Golf Course': 52,
  'Mather Golf Course': 48,
  'Cherry Island Golf Course': 45
};

// Generate demo tee times on-the-fly for a course
const generateDemoTeeTimesForCourse = (course, daysAhead = 7) => {
  const teeTimes = [];
  const basePrice = COURSE_BASE_PRICES[course.name] || 50;

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const dateStr = getPacificDate(dayOffset);
    const date = new Date(dateStr);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const priceMultiplier = isWeekend ? 1.3 : 1.0;

    // Generate tee times from 6am to 5pm
    for (let hour = 6; hour <= 17; hour++) {
      // 2-4 times per hour
      const timesThisHour = 2 + Math.floor(Math.random() * 3);

      for (let i = 0; i < timesThisHour; i++) {
        const minutes = Math.floor(Math.random() * 6) * 10;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        let price = basePrice * priceMultiplier;
        const hasDiscount = Math.random() < 0.2;
        const originalPrice = hasDiscount ? price : null;
        if (hasDiscount) price = price * (0.7 + Math.random() * 0.2);
        if (hour >= 14) price = price * 0.8; // Twilight discount
        price = Math.round(price);

        const hasCart = Math.random() < 0.5;
        const players = 4; // All times show 4 spots - actual availability confirmed when booking

        teeTimes.push({
          course_id: course.id,
          date: dateStr,
          time: timeStr,
          datetime: `${dateStr} ${timeStr}`,
          holes: course.holes >= 18 ? 18 : 9,
          players: players,
          price: price,
          original_price: originalPrice ? Math.round(originalPrice) : null,
          has_cart: hasCart ? 1 : 0,
          booking_url: course.booking_url,
          source: 'demo',
          course_name: course.name,
          city: course.city,
          region: course.region,
          course_slug: course.slug,
          avg_rating: course.avg_rating
        });
      }
    }
  }

  return teeTimes;
};

// Ensure tee times exist for the next 7 days (regenerates if stale)
const ensureTeeTimesExist = async () => {
  const pacificNow = getPacificNow();
  const day7 = getPacificDate(6); // Check if we have times for day 7

  // Check if we have tee times for day 7 (ensures full 7-day coverage)
  const day7Result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM tee_times WHERE date = ?`,
    args: [day7]
  });

  const day7Count = day7Result.rows[0]?.count || 0;

  // If we have tee times for day 7, we're good
  if (day7Count >= 50) {
    return;
  }

  console.log(`Regenerating tee times (day 7 has ${day7Count} times, need at least 50)...`);

  // Get all courses
  const coursesResult = await db.execute('SELECT * FROM courses');
  const courses = coursesResult.rows;

  // Clear old tee times
  await db.execute({
    sql: `DELETE FROM tee_times WHERE datetime < ?`,
    args: [pacificNow]
  });

  // Generate new tee times for each course
  for (const course of courses) {
    const teeTimes = generateDemoTeeTimesForCourse(course, 7);

    for (const tt of teeTimes) {
      try {
        await db.execute({
          sql: `INSERT OR REPLACE INTO tee_times (course_id, date, time, datetime, holes, players, price, original_price, has_cart, booking_url, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [tt.course_id, tt.date, tt.time, tt.datetime, tt.holes, tt.players, tt.price, tt.original_price, tt.has_cart, tt.booking_url, tt.source]
        });
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
  }

  console.log(`Regenerated tee times for ${courses.length} courses`);
};

app.get('/api/tee-times', async (req, res) => {
  try {
    const { date, region, minPrice, maxPrice, min_time, max_price, players, course_id, staff_picks, sort_by, sort_order, limit } = req.query;

    // Ensure we have fresh tee times (regenerates if stale)
    await ensureTeeTimesExist();

    // Use Pacific timezone for filtering since tee times are stored in Pacific time
    const pacificNow = getPacificNow();

    let sql = `
      SELECT t.*, c.name as course_name, c.city, c.region, c.slug as course_slug, c.avg_rating
      FROM tee_times t
      JOIN courses c ON t.course_id = c.id
      WHERE t.datetime >= ?
    `;
    const args = [pacificNow];

    if (date) {
      sql += ' AND t.date = ?';
      args.push(date);
    }
    if (region) {
      sql += ' AND c.region = ?';
      args.push(region);
    }
    if (staff_picks === 'true') {
      sql += ' AND c.is_staff_pick = 1';
    }
    if (course_id) {
      sql += ' AND t.course_id = ?';
      args.push(parseInt(course_id));
    }
    if (minPrice) {
      sql += ' AND t.price >= ?';
      args.push(parseFloat(minPrice));
    }
    // Support both maxPrice and max_price
    const maxPriceVal = maxPrice || max_price;
    if (maxPriceVal) {
      sql += ' AND t.price <= ?';
      args.push(parseFloat(maxPriceVal));
    }
    if (min_time) {
      sql += ' AND t.time >= ?';
      args.push(min_time);
    }
    if (players) {
      sql += ' AND t.players >= ?';
      args.push(parseInt(players));
    }

    // Sorting
    const validSortColumns = ['datetime', 'price', 'course_name', 'avg_rating'];
    const sortCol = validSortColumns.includes(sort_by) ? (sort_by === 'course_name' ? 'c.name' : sort_by === 'avg_rating' ? 'c.avg_rating' : `t.${sort_by}`) : 't.datetime';
    const sortDir = sort_order === 'DESC' ? 'DESC' : 'ASC';
    sql += ` ORDER BY ${sortCol} ${sortDir}`;

    // Limit
    const resultLimit = Math.min(parseInt(limit) || 200, 500);
    sql += ` LIMIT ${resultLimit}`;

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get the cheapest next available tee time per course (for map display)
app.get('/api/tee-times/next-available', async (req, res) => {
  try {
    await ensureTeeTimesExist();
    const pacificNow = getPacificNow();
    const region = req.query.region;

    // Get minimum price tee time per course, optionally filtered by region
    let sql = `
      SELECT t.*, c.name as course_name, c.city, c.region, c.slug as course_slug, c.avg_rating
      FROM tee_times t
      JOIN courses c ON t.course_id = c.id
      WHERE t.id IN (
        SELECT t2.id FROM tee_times t2
        WHERE t2.course_id = t.course_id
          AND t2.datetime >= ?
          AND t2.price IS NOT NULL
          AND t2.price > 0
        ORDER BY t2.price ASC
        LIMIT 1
      )
    `;
    const args = [pacificNow];

    if (region) {
      sql += ` AND c.region = ?`;
      args.push(region);
    }

    sql += ` ORDER BY c.name`;

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tee-times/deals', async (req, res) => {
  try {
    // Ensure we have fresh tee times
    await ensureTeeTimesExist();

    // Use Pacific timezone for filtering
    const pacificNow = getPacificNow();
    const result = await db.execute({
      sql: `SELECT t.*, c.name as course_name, c.city, c.region, c.slug as course_slug,
             (t.original_price - t.price) as savings,
             ROUND((t.original_price - t.price) * 100.0 / t.original_price, 0) as discount_pct
      FROM tee_times t
      JOIN courses c ON t.course_id = c.id
      WHERE t.datetime >= ?
        AND t.original_price IS NOT NULL
        AND t.price < t.original_price
      ORDER BY discount_pct DESC
      LIMIT 20`,
      args: [pacificNow]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== USER AUTH ENDPOINTS ==========

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase()] });
    if (existing.rows.length) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Create verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Create user with verification token
    const passwordHash = hashPassword(password);
    const name = displayName || email.split('@')[0];
    const result = await db.execute({
      sql: `INSERT INTO users (email, password_hash, display_name, email_verified, verification_token, verification_expires)
            VALUES (?, ?, ?, 0, ?, ?)`,
      args: [email.toLowerCase(), passwordHash, name, verificationToken, verificationExpires]
    });

    const userId = Number(result.lastInsertRowid);

    // Send verification email
    try {
      await sendVerificationEmail(email.toLowerCase(), verificationToken, name);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue anyway - user can request resend
    }

    // Create session (user can use the app but some features may be limited)
    const token = await createSession(userId);

    res.json({
      token,
      user: { id: userId, email: email.toLowerCase(), displayName: name, emailVerified: false },
      message: 'Account created! Please check your email to verify your account.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email verification endpoint
app.get('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect('/account?error=missing_token');
    }

    // Find user with this verification token
    const result = await db.execute({
      sql: `SELECT id, email, display_name FROM users
            WHERE verification_token = ? AND verification_expires > datetime('now')`,
      args: [token]
    });

    if (!result.rows.length) {
      return res.redirect('/account?error=invalid_token');
    }

    const user = result.rows[0];

    // Mark email as verified
    await db.execute({
      sql: `UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL, updated_at = datetime('now')
            WHERE id = ?`,
      args: [user.id]
    });

    // Redirect to account page with success message
    res.redirect('/account?verified=true');
  } catch (error) {
    console.error('Verification error:', error);
    res.redirect('/account?error=verification_failed');
  }
});

// Resend verification email
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    const session = await getSession(authToken);
    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user
    const result = await db.execute({
      sql: 'SELECT id, email, display_name, email_verified FROM users WHERE id = ?',
      args: [session.id]
    });

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: 'UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?',
      args: [verificationToken, verificationExpires, user.id]
    });

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken, user.display_name);

    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase()] });
    const user = result.rows[0];

    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = await createSession(user.id);

    res.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.display_name }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await deleteSession(token);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== USER PROFILE ENDPOINTS ==========

app.get('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const result = await db.execute({
      sql: `SELECT u.id, u.email, u.display_name, u.profile_picture, u.home_course_id, u.handicap,
            c.name as home_course_name, c.city as home_course_city, c.slug as home_course_slug
            FROM users u
            LEFT JOIN courses c ON u.home_course_id = c.id
            WHERE u.id = ?`,
      args: [user.id]
    });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const { displayName, homeCourseId, handicap } = req.body;

    // Parse values properly - handle empty strings
    const courseId = homeCourseId ? parseInt(homeCourseId) : null;
    const hcap = handicap !== '' && handicap != null ? parseFloat(handicap) : null;

    await db.execute({
      sql: `UPDATE users SET display_name = COALESCE(?, display_name), home_course_id = ?, handicap = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [displayName || null, courseId, hcap, user.id]
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/profile/picture', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const { image } = req.body;
    if (!image || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    if (image.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 1.5MB)' });
    }

    await db.execute({
      sql: 'UPDATE users SET profile_picture = ?, updated_at = datetime("now") WHERE id = ?',
      args: [image, user.id]
    });

    res.json({ success: true, profilePicture: image });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/user/stats', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const result = await db.execute({
      sql: `SELECT COUNT(*) as total_rounds, COUNT(DISTINCT course_id) as courses_played, AVG(total_score) as avg_score FROM rounds WHERE user_id = ?`,
      args: [user.id]
    });
    res.json({ stats: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== USER FAVORITES ==========

app.get('/api/user/favorites', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const result = await db.execute({
      sql: `SELECT c.* FROM user_favorites f JOIN courses c ON f.course_id = c.id WHERE f.user_id = ? ORDER BY f.created_at DESC`,
      args: [user.id]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/favorites/:courseId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    await db.execute({
      sql: 'INSERT OR IGNORE INTO user_favorites (user_id, course_id) VALUES (?, ?)',
      args: [user.id, parseInt(req.params.courseId)]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/user/favorites/:courseId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    await db.execute({
      sql: 'DELETE FROM user_favorites WHERE user_id = ? AND course_id = ?',
      args: [user.id, parseInt(req.params.courseId)]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ROUNDS / SCOREBOOK ==========

app.get('/api/user/rounds', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const result = await db.execute({
      sql: `SELECT r.*, c.name as course_name, c.par as course_par, c.slug as course_slug
            FROM rounds r JOIN courses c ON r.course_id = c.id
            WHERE r.user_id = ? ORDER BY r.date DESC LIMIT 50`,
      args: [user.id]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/rounds', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const { courseId, date, totalScore, totalPutts, notes, holes } = req.body;

    const result = await db.execute({
      sql: 'INSERT INTO rounds (user_id, course_id, date, total_score, total_putts, notes) VALUES (?, ?, ?, ?, ?, ?)',
      args: [user.id, courseId, date, totalScore, totalPutts, notes]
    });

    const roundId = Number(result.lastInsertRowid);

    if (holes && Array.isArray(holes)) {
      for (const hole of holes) {
        await db.execute({
          sql: 'INSERT INTO round_holes (round_id, hole_number, par, score, putts, fairway_hit, gir) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [roundId, hole.holeNumber, hole.par, hole.score, hole.putts, hole.fairwayHit ? 1 : 0, hole.gir ? 1 : 0]
        });
      }
    }

    res.json({ success: true, roundId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/user/rounds/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const roundResult = await db.execute({
      sql: `SELECT r.*, c.name as course_name, c.par as course_par, c.slug as course_slug
            FROM rounds r JOIN courses c ON r.course_id = c.id
            WHERE r.id = ? AND r.user_id = ?`,
      args: [parseInt(req.params.id), user.id]
    });

    if (!roundResult.rows.length) {
      return res.status(404).json({ error: 'Round not found' });
    }

    const holesResult = await db.execute({
      sql: 'SELECT * FROM round_holes WHERE round_id = ? ORDER BY hole_number',
      args: [parseInt(req.params.id)]
    });

    res.json({ ...roundResult.rows[0], holes: holesResult.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/user/rounds/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    await db.execute({ sql: 'DELETE FROM round_holes WHERE round_id = ?', args: [parseInt(req.params.id)] });
    await db.execute({ sql: 'DELETE FROM rounds WHERE id = ? AND user_id = ?', args: [parseInt(req.params.id), user.id] });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== COMMUNITY ENDPOINTS ==========

app.get('/api/community/leaderboard', async (req, res) => {
  try {
    const { period } = req.query;
    let dateFilter = '1=1';

    if (period === 'month') {
      dateFilter = "r.date >= date('now', '-30 days')";
    } else if (period === 'week') {
      dateFilter = "r.date >= date('now', '-7 days')";
    }

    const result = await db.execute(`
      SELECT u.id, u.display_name, COUNT(DISTINCT r.course_id) as courses_played,
             COUNT(r.id) as total_rounds, ROUND(AVG(r.total_score), 1) as avg_score
      FROM users u
      INNER JOIN rounds r ON u.id = r.user_id
      WHERE ${dateFilter}
      GROUP BY u.id
      ORDER BY courses_played DESC, total_rounds DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/community/recent-rounds', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT r.id, r.date, r.total_score, u.display_name, c.name as course_name, c.slug as course_slug
      FROM rounds r
      INNER JOIN users u ON r.user_id = u.id
      INNER JOIN courses c ON r.course_id = c.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/community/members', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const result = await db.execute({
      sql: `
        SELECT u.id, u.display_name, u.profile_picture, u.home_course_id, u.handicap,
               c.name as home_course_name, c.slug as home_course_slug,
               COUNT(r.id) as rounds_played, ROUND(AVG(r.total_score), 1) as avg_score
        FROM users u
        LEFT JOIN courses c ON u.home_course_id = c.id
        LEFT JOIN rounds r ON u.id = r.user_id
        GROUP BY u.id
        ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, rounds_played DESC, u.display_name ASC
      `,
      args: [user.id]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get individual member profile with recent rounds
app.get('/api/community/members/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await getSession(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const memberId = parseInt(req.params.id);

    // Get member profile
    const profileResult = await db.execute({
      sql: `SELECT u.id, u.display_name, u.profile_picture, u.home_course_id, u.handicap, u.created_at,
             c.name as home_course_name, c.slug as home_course_slug,
             COUNT(r.id) as rounds_played,
             COUNT(DISTINCT r.course_id) as courses_played,
             ROUND(AVG(r.total_score), 1) as avg_score,
             MIN(r.total_score) as best_score
      FROM users u
      LEFT JOIN courses c ON u.home_course_id = c.id
      LEFT JOIN rounds r ON u.id = r.user_id
      WHERE u.id = ?
      GROUP BY u.id`,
      args: [memberId]
    });

    if (!profileResult.rows.length) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get recent rounds
    const roundsResult = await db.execute({
      sql: `SELECT r.id, r.date, r.total_score, r.total_putts,
             c.name as course_name, c.slug as course_slug, c.par as course_par
      FROM rounds r
      JOIN courses c ON r.course_id = c.id
      WHERE r.user_id = ?
      ORDER BY r.date DESC
      LIMIT 5`,
      args: [memberId]
    });

    // Get passport progress (courses played)
    const passportResult = await db.execute({
      sql: `SELECT COUNT(DISTINCT course_id) as courses_played,
             (SELECT COUNT(*) FROM courses) as total_courses
      FROM rounds WHERE user_id = ?`,
      args: [memberId]
    });

    res.json({
      ...profileResult.rows[0],
      recentRounds: roundsResult.rows,
      passport: passportResult.rows[0],
      isOwnProfile: user.id === memberId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ANALYTICS TRACKING ==========

// Track page views and events (called from frontend)
app.post('/api/analytics/event', async (req, res) => {
  try {
    const { event_type, event_data, page_url, course_id } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';

    // Create table if not exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        event_data TEXT,
        page_url TEXT,
        course_id INTEGER,
        user_agent TEXT,
        ip_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Hash IP for privacy
    const ipHash = crypto.createHash('sha256').update(ip + 'analytics_salt').digest('hex').substring(0, 16);

    await db.execute({
      sql: 'INSERT INTO analytics_events (event_type, event_data, page_url, course_id, user_agent, ip_hash) VALUES (?, ?, ?, ?, ?, ?)',
      args: [event_type, JSON.stringify(event_data || {}), page_url, course_id || null, userAgent.substring(0, 255), ipHash]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics error:', error);
    res.json({ success: true }); // Don't fail silently for analytics
  }
});

// Track search queries
app.post('/api/analytics/search', async (req, res) => {
  try {
    const { query, results_count, filters } = req.body;

    await db.execute(`
      CREATE TABLE IF NOT EXISTS search_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        results_count INTEGER DEFAULT 0,
        filters TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute({
      sql: 'INSERT INTO search_analytics (query, results_count, filters) VALUES (?, ?, ?)',
      args: [query, results_count || 0, JSON.stringify(filters || {})]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Search analytics error:', error);
    res.json({ success: true });
  }
});

// ========== PUBLIC ANNOUNCEMENTS ==========

app.get('/api/announcements/active', async (req, res) => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        link_url TEXT,
        link_text TEXT,
        is_active INTEGER DEFAULT 1,
        starts_at DATETIME,
        ends_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await db.execute(`
      SELECT * FROM announcements
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= datetime('now'))
        AND (ends_at IS NULL OR ends_at >= datetime('now'))
      ORDER BY created_at DESC
      LIMIT 3
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PUBLIC FEATURED DEALS ==========

app.get('/api/featured-deals', async (req, res) => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS featured_deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        discount_text TEXT,
        promo_code TEXT,
        link_url TEXT,
        is_active INTEGER DEFAULT 1,
        starts_at DATETIME,
        ends_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id)
      )
    `);

    const result = await db.execute(`
      SELECT fd.*, c.name as course_name, c.slug as course_slug, c.city, c.region
      FROM featured_deals fd
      JOIN courses c ON fd.course_id = c.id
      WHERE fd.is_active = 1
        AND (fd.starts_at IS NULL OR fd.starts_at <= datetime('now'))
        AND (fd.ends_at IS NULL OR fd.ends_at >= datetime('now'))
      ORDER BY fd.created_at DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ADMIN ENDPOINTS ==========

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'baygolf2024';

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    // Set cookie for stats dashboard
    res.cookie('admin_token', ADMIN_PASSWORD, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    res.json({ success: true, token: Buffer.from(ADMIN_PASSWORD).toString('base64') });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

const adminAuth = (req, res, next) => {
  // Support both Basic auth (from admin.html) and cookie auth (from admin-stats.html)
  const auth = req.headers.authorization;
  const cookieToken = req.cookies?.admin_token;

  // Check cookie first (for stats dashboard)
  if (cookieToken === ADMIN_PASSWORD) {
    return next();
  }

  // Fall back to Basic auth (for existing admin panel)
  if (auth) {
    const token = auth.replace('Bearer ', '');
    if (Buffer.from(token, 'base64').toString() === ADMIN_PASSWORD) {
      return next();
    }
  }

  return res.status(401).json({ error: 'Authorization required' });
};

app.get('/api/admin/courses', adminAuth, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM courses ORDER BY region, city, name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/courses/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const setClauses = [];
    const args = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      setClauses.push(`${dbKey} = ?`);
      args.push(value);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    args.push(parseInt(id));
    await db.execute({
      sql: `UPDATE courses SET ${setClauses.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      args
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/staff-picks', adminAuth, async (req, res) => {
  try {
    const { courseIds } = req.body;

    await db.execute('UPDATE courses SET is_staff_pick = 0, staff_pick_order = NULL');

    for (let i = 0; i < courseIds.length; i++) {
      await db.execute({
        sql: 'UPDATE courses SET is_staff_pick = 1, staff_pick_order = ? WHERE id = ?',
        args: [i + 1, courseIds[i]]
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ADMIN ANALYTICS ENDPOINTS ==========

// Dashboard overview
app.get('/api/admin/analytics/dashboard', adminAuth, async (req, res) => {
  try {
    // Ensure tables exist
    await db.execute(`CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, event_data TEXT, page_url TEXT,
      course_id INTEGER, user_agent TEXT, ip_hash TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const [
      totalUsers,
      usersToday,
      usersThisWeek,
      usersThisMonth,
      totalRounds,
      roundsThisWeek,
      pageViewsToday,
      pageViewsThisWeek,
      bookingClicksToday,
      bookingClicksThisWeek,
      uniqueVisitorsToday,
      uniqueVisitorsWeek,
      uniqueVisitorsMonth
    ] = await Promise.all([
      db.execute("SELECT COUNT(*) as count FROM users"),
      db.execute("SELECT COUNT(*) as count FROM users WHERE created_at >= date('now')"),
      db.execute("SELECT COUNT(*) as count FROM users WHERE created_at >= date('now', '-7 days')"),
      db.execute("SELECT COUNT(*) as count FROM users WHERE created_at >= date('now', '-30 days')"),
      db.execute("SELECT COUNT(*) as count FROM rounds"),
      db.execute("SELECT COUNT(*) as count FROM rounds WHERE created_at >= date('now', '-7 days')"),
      db.execute("SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= date('now')"),
      db.execute("SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= date('now', '-7 days')"),
      db.execute("SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'booking_click' AND created_at >= date('now')"),
      db.execute("SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'booking_click' AND created_at >= date('now', '-7 days')"),
      db.execute("SELECT COUNT(DISTINCT ip_hash) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= date('now')"),
      db.execute("SELECT COUNT(DISTINCT ip_hash) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= date('now', '-7 days')"),
      db.execute("SELECT COUNT(DISTINCT ip_hash) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= date('now', '-30 days')")
    ]);

    // Daily signups for chart (last 14 days)
    const dailySignups = await db.execute(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= date('now', '-14 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `);

    // Daily page views for chart
    const dailyPageViews = await db.execute(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM analytics_events
      WHERE event_type = 'page_view' AND created_at >= date('now', '-14 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `);

    // Daily unique visitors for chart (last 14 days)
    const dailyUniqueVisitors = await db.execute(`
      SELECT date(created_at) as date, COUNT(DISTINCT ip_hash) as count
      FROM analytics_events
      WHERE event_type = 'page_view' AND created_at >= date('now', '-14 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `);

    res.json({
      users: {
        total: totalUsers.rows[0]?.count || 0,
        today: usersToday.rows[0]?.count || 0,
        thisWeek: usersThisWeek.rows[0]?.count || 0,
        thisMonth: usersThisMonth.rows[0]?.count || 0
      },
      rounds: {
        total: totalRounds.rows[0]?.count || 0,
        thisWeek: roundsThisWeek.rows[0]?.count || 0
      },
      pageViews: {
        today: pageViewsToday.rows[0]?.count || 0,
        thisWeek: pageViewsThisWeek.rows[0]?.count || 0
      },
      bookingClicks: {
        today: bookingClicksToday.rows[0]?.count || 0,
        thisWeek: bookingClicksThisWeek.rows[0]?.count || 0
      },
      uniqueVisitors: {
        today: uniqueVisitorsToday.rows[0]?.count || 0,
        thisWeek: uniqueVisitorsWeek.rows[0]?.count || 0,
        thisMonth: uniqueVisitorsMonth.rows[0]?.count || 0
      },
      charts: {
        dailySignups: dailySignups.rows,
        dailyPageViews: dailyPageViews.rows,
        dailyUniqueVisitors: dailyUniqueVisitors.rows
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Popular courses analytics
app.get('/api/admin/analytics/popular-courses', adminAuth, async (req, res) => {
  try {
    // Most viewed courses
    const mostViewed = await db.execute(`
      SELECT c.id, c.name, c.slug, c.city, c.region, COUNT(ae.id) as view_count
      FROM courses c
      LEFT JOIN analytics_events ae ON ae.course_id = c.id AND ae.event_type = 'course_view'
      GROUP BY c.id
      ORDER BY view_count DESC
      LIMIT 20
    `);

    // Most booking clicks
    const mostClicked = await db.execute(`
      SELECT c.id, c.name, c.slug, c.city, c.region, COUNT(ae.id) as click_count
      FROM courses c
      LEFT JOIN analytics_events ae ON ae.course_id = c.id AND ae.event_type = 'booking_click'
      GROUP BY c.id
      ORDER BY click_count DESC
      LIMIT 20
    `);

    // Most favorited
    const mostFavorited = await db.execute(`
      SELECT c.id, c.name, c.slug, c.city, c.region, COUNT(uf.id) as favorite_count
      FROM courses c
      LEFT JOIN user_favorites uf ON uf.course_id = c.id
      GROUP BY c.id
      ORDER BY favorite_count DESC
      LIMIT 20
    `);

    // Most played (rounds logged)
    const mostPlayed = await db.execute(`
      SELECT c.id, c.name, c.slug, c.city, c.region, COUNT(r.id) as rounds_count
      FROM courses c
      LEFT JOIN rounds r ON r.course_id = c.id
      GROUP BY c.id
      ORDER BY rounds_count DESC
      LIMIT 20
    `);

    res.json({
      mostViewed: mostViewed.rows,
      mostClicked: mostClicked.rows,
      mostFavorited: mostFavorited.rows,
      mostPlayed: mostPlayed.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search analytics
app.get('/api/admin/analytics/searches', adminAuth, async (req, res) => {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS search_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT, results_count INTEGER, filters TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Top searches
    const topSearches = await db.execute(`
      SELECT query, COUNT(*) as search_count, AVG(results_count) as avg_results
      FROM search_analytics
      WHERE created_at >= date('now', '-30 days')
      GROUP BY LOWER(query)
      ORDER BY search_count DESC
      LIMIT 50
    `);

    // Failed searches (0 results)
    const failedSearches = await db.execute(`
      SELECT query, COUNT(*) as search_count
      FROM search_analytics
      WHERE results_count = 0 AND created_at >= date('now', '-30 days')
      GROUP BY LOWER(query)
      ORDER BY search_count DESC
      LIMIT 30
    `);

    // Search volume over time
    const searchVolume = await db.execute(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM search_analytics
      WHERE created_at >= date('now', '-14 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `);

    res.json({
      topSearches: topSearches.rows,
      failedSearches: failedSearches.rows,
      searchVolume: searchVolume.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversion funnel
app.get('/api/admin/analytics/conversions', adminAuth, async (req, res) => {
  try {
    const period = req.query.period || '7';
    const dateFilter = `created_at >= date('now', '-${period} days')`;

    const [pageViews, courseViews, teeTimeViews, bookingClicks] = await Promise.all([
      db.execute(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND ${dateFilter}`),
      db.execute(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'course_view' AND ${dateFilter}`),
      db.execute(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'tee_time_view' AND ${dateFilter}`),
      db.execute(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'booking_click' AND ${dateFilter}`)
    ]);

    res.json({
      period: parseInt(period),
      funnel: [
        { stage: 'Page Views', count: pageViews.rows[0]?.count || 0 },
        { stage: 'Course Views', count: courseViews.rows[0]?.count || 0 },
        { stage: 'Tee Time Views', count: teeTimeViews.rows[0]?.count || 0 },
        { stage: 'Booking Clicks', count: bookingClicks.rows[0]?.count || 0 }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ADMIN CONTENT MANAGEMENT ENDPOINTS ==========

// Full course editor - get single course with all fields
app.get('/api/admin/courses/:id/full', adminAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM courses WHERE id = ?',
      args: [parseInt(req.params.id)]
    });
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Announcements CRUD
app.get('/api/admin/announcements', adminAuth, async (req, res) => {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, message TEXT NOT NULL, type TEXT DEFAULT 'info',
      link_url TEXT, link_text TEXT, is_active INTEGER DEFAULT 1, starts_at DATETIME, ends_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const result = await db.execute('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/announcements', adminAuth, async (req, res) => {
  try {
    const { title, message, type, link_url, link_text, is_active, starts_at, ends_at } = req.body;
    const result = await db.execute({
      sql: 'INSERT INTO announcements (title, message, type, link_url, link_text, is_active, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [title, message, type || 'info', link_url, link_text, is_active ? 1 : 0, starts_at, ends_at]
    });
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/announcements/:id', adminAuth, async (req, res) => {
  try {
    const { title, message, type, link_url, link_text, is_active, starts_at, ends_at } = req.body;
    await db.execute({
      sql: 'UPDATE announcements SET title = ?, message = ?, type = ?, link_url = ?, link_text = ?, is_active = ?, starts_at = ?, ends_at = ? WHERE id = ?',
      args: [title, message, type, link_url, link_text, is_active ? 1 : 0, starts_at, ends_at, parseInt(req.params.id)]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/announcements/:id', adminAuth, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM announcements WHERE id = ?', args: [parseInt(req.params.id)] });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Featured Deals CRUD
app.get('/api/admin/featured-deals', adminAuth, async (req, res) => {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS featured_deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT,
      discount_text TEXT, promo_code TEXT, link_url TEXT, is_active INTEGER DEFAULT 1, starts_at DATETIME, ends_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const result = await db.execute(`
      SELECT fd.*, c.name as course_name, c.slug as course_slug
      FROM featured_deals fd
      LEFT JOIN courses c ON fd.course_id = c.id
      ORDER BY fd.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/featured-deals', adminAuth, async (req, res) => {
  try {
    const { course_id, title, description, discount_text, promo_code, link_url, is_active, starts_at, ends_at } = req.body;
    const result = await db.execute({
      sql: 'INSERT INTO featured_deals (course_id, title, description, discount_text, promo_code, link_url, is_active, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [course_id, title, description, discount_text, promo_code, link_url, is_active ? 1 : 0, starts_at, ends_at]
    });
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/featured-deals/:id', adminAuth, async (req, res) => {
  try {
    const { course_id, title, description, discount_text, promo_code, link_url, is_active, starts_at, ends_at } = req.body;
    await db.execute({
      sql: 'UPDATE featured_deals SET course_id = ?, title = ?, description = ?, discount_text = ?, promo_code = ?, link_url = ?, is_active = ?, starts_at = ?, ends_at = ? WHERE id = ?',
      args: [course_id, title, description, discount_text, promo_code, link_url, is_active ? 1 : 0, starts_at, ends_at, parseInt(req.params.id)]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/featured-deals/:id', adminAuth, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM featured_deals WHERE id = ?', args: [parseInt(req.params.id)] });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scraper status (mock for now - can be expanded with real scraper data)
app.get('/api/admin/scraper-status', adminAuth, async (req, res) => {
  try {
    // Get tee time freshness per course (using Pacific timezone)
    const pacificNow = getPacificNow();
    const result = await db.execute({
      sql: `SELECT c.id, c.name, c.slug, c.booking_url,
        COUNT(t.id) as tee_time_count,
        MAX(t.created_at) as last_scraped,
        MIN(t.datetime) as next_available
      FROM courses c
      LEFT JOIN tee_times t ON t.course_id = c.id AND t.datetime >= ?
      GROUP BY c.id
      ORDER BY last_scraped ASC NULLS FIRST`,
      args: [pacificNow]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ADMIN USER MANAGEMENT ENDPOINTS ==========

// Get all users with stats
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT u.id, u.email, u.display_name, u.profile_picture, u.handicap, u.email_verified, u.created_at,
        c.name as home_course_name,
        COUNT(DISTINCT r.id) as rounds_count,
        COUNT(DISTINCT uf.id) as favorites_count,
        MAX(r.date) as last_round_date
      FROM users u
      LEFT JOIN courses c ON u.home_course_id = c.id
      LEFT JOIN rounds r ON r.user_id = u.id
      LEFT JOIN user_favorites uf ON uf.user_id = u.id
    `;
    const args = [];

    if (search) {
      sql += ` WHERE u.email LIKE ? OR u.display_name LIKE ?`;
      args.push(`%${search}%`, `%${search}%`);
    }

    sql += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    args.push(parseInt(limit), offset);

    const result = await db.execute({ sql, args });

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM users';
    const countArgs = [];
    if (search) {
      countSql += ` WHERE email LIKE ? OR display_name LIKE ?`;
      countArgs.push(`%${search}%`, `%${search}%`);
    }
    const countResult = await db.execute({ sql: countSql, args: countArgs });

    res.json({
      users: result.rows,
      total: countResult.rows[0]?.total || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single user details
app.get('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const userResult = await db.execute({
      sql: `SELECT u.*, c.name as home_course_name FROM users u LEFT JOIN courses c ON u.home_course_id = c.id WHERE u.id = ?`,
      args: [parseInt(req.params.id)]
    });

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const roundsResult = await db.execute({
      sql: `SELECT r.*, c.name as course_name FROM rounds r JOIN courses c ON r.course_id = c.id WHERE r.user_id = ? ORDER BY r.date DESC LIMIT 20`,
      args: [parseInt(req.params.id)]
    });

    res.json({
      user: userResult.rows[0],
      rounds: roundsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    // Delete related data
    await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM round_holes WHERE round_id IN (SELECT id FROM rounds WHERE user_id = ?)', args: [userId] });
    await db.execute({ sql: 'DELETE FROM rounds WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM user_favorites WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reviews management (create table and endpoints)
app.get('/api/admin/reviews', adminAuth, async (req, res) => {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS course_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT,
      content TEXT,
      is_flagged INTEGER DEFAULT 0,
      flag_reason TEXT,
      is_approved INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    const { flagged_only } = req.query;
    let sql = `
      SELECT cr.*, u.display_name, u.email, c.name as course_name, c.slug as course_slug
      FROM course_reviews cr
      JOIN users u ON cr.user_id = u.id
      JOIN courses c ON cr.course_id = c.id
    `;
    if (flagged_only === 'true') {
      sql += ' WHERE cr.is_flagged = 1';
    }
    sql += ' ORDER BY cr.created_at DESC LIMIT 100';

    const result = await db.execute(sql);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/reviews/:id/approve', adminAuth, async (req, res) => {
  try {
    await db.execute({
      sql: 'UPDATE course_reviews SET is_approved = 1, is_flagged = 0, flag_reason = NULL WHERE id = ?',
      args: [parseInt(req.params.id)]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/reviews/:id/reject', adminAuth, async (req, res) => {
  try {
    await db.execute({
      sql: 'UPDATE course_reviews SET is_approved = 0 WHERE id = ?',
      args: [parseInt(req.params.id)]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/reviews/:id', adminAuth, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM course_reviews WHERE id = ?', args: [parseInt(req.params.id)] });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email broadcast
app.post('/api/admin/email-broadcast', adminAuth, async (req, res) => {
  try {
    const { subject, html_content, segment } = req.body;

    if (!resend) {
      return res.status(400).json({ error: 'Email service not configured' });
    }

    // Get users based on segment
    let sql = 'SELECT email, display_name FROM users WHERE email_verified = 1';
    if (segment === 'active') {
      sql += " AND id IN (SELECT DISTINCT user_id FROM rounds WHERE created_at >= date('now', '-30 days'))";
    } else if (segment === 'inactive') {
      sql += " AND id NOT IN (SELECT DISTINCT user_id FROM rounds WHERE created_at >= date('now', '-30 days'))";
    }

    const usersResult = await db.execute(sql);
    const users = usersResult.rows;

    if (users.length === 0) {
      return res.status(400).json({ error: 'No users match the selected segment' });
    }

    // Send emails (batch)
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Bay Area Golf <noreply@bayareagolf.now>',
          to: user.email,
          subject: subject,
          html: html_content.replace('{{name}}', user.display_name || 'Golfer')
        });
        sent++;
      } catch (e) {
        console.error(`Failed to send to ${user.email}:`, e);
        failed++;
      }
    }

    res.json({ success: true, sent, failed, total: users.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get email segments stats
app.get('/api/admin/email-segments', adminAuth, async (req, res) => {
  try {
    const [all, verified, active, inactive] = await Promise.all([
      db.execute('SELECT COUNT(*) as count FROM users'),
      db.execute('SELECT COUNT(*) as count FROM users WHERE email_verified = 1'),
      db.execute("SELECT COUNT(*) as count FROM users WHERE email_verified = 1 AND id IN (SELECT DISTINCT user_id FROM rounds WHERE created_at >= date('now', '-30 days'))"),
      db.execute("SELECT COUNT(*) as count FROM users WHERE email_verified = 1 AND id NOT IN (SELECT DISTINCT user_id FROM rounds WHERE created_at >= date('now', '-30 days'))")
    ]);

    res.json({
      all: all.rows[0]?.count || 0,
      verified: verified.rows[0]?.count || 0,
      active: active.rows[0]?.count || 0,
      inactive: inactive.rows[0]?.count || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== AI BOOKING AGENT ENDPOINTS ==========

// Import agent modules
const {
  processBookingRequest,
  quickSearch,
  refineSearch,
  getCourseInsight,
  ConversationState
} = require('../src/agent');

// Store conversation states (in production, use Redis or database)
const conversationStates = new Map();

// Helper to get all tee times for agent
const getAgentTeeTimes = async () => {
  const pacificNow = getPacificNow();
  const result = await db.execute({
    sql: `
      SELECT t.*, c.name as course_name, c.city, c.region, c.slug as course_slug,
             c.avg_rating, c.latitude, c.longitude, c.booking_url as course_booking_url
      FROM tee_times t
      JOIN courses c ON t.course_id = c.id
      WHERE t.datetime >= ?
      ORDER BY t.datetime
      LIMIT 10000
    `,
    args: [pacificNow]
  });
  return result.rows;
};

// Main agent endpoint - process natural language booking request
app.post('/api/agent/search', async (req, res) => {
  try {
    const { query, sessionId, location } = req.body;

    if (!query || query.trim().length < 3) {
      return res.status(400).json({ error: 'Please provide a search query' });
    }

    // Ensure we have fresh tee times
    await ensureTeeTimesExist();

    // Get all available tee times
    const teeTimes = await getAgentTeeTimes();

    // Get or create conversation state
    let convState = conversationStates.get(sessionId);
    if (!convState) {
      convState = new ConversationState(sessionId || 'anonymous');
      if (sessionId) conversationStates.set(sessionId, convState);
    }

    // Set user location if provided
    if (location?.lat && location?.lng) {
      convState.setUserLocation(location.lat, location.lng, location.city);
    }

    // Process the booking request
    const result = await processBookingRequest(
      query,
      teeTimes,
      convState.getContext()
    );

    // Save to conversation history
    if (result.success) {
      convState.addTurn(query, result);
    }

    res.json(result);

  } catch (error) {
    console.error('Agent search error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Sorry, I couldn't process your request. Please try again."
    });
  }
});

// Quick search endpoint - faster, no AI generation
app.post('/api/agent/quick-search', async (req, res) => {
  try {
    const { query, location } = req.body;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query too short' });
    }

    await ensureTeeTimesExist();
    const teeTimes = await getAgentTeeTimes();

    const context = {};
    if (location?.lat && location?.lng) {
      context.userLocation = location;
    }

    const result = await quickSearch(query, teeTimes, context);
    res.json(result);

  } catch (error) {
    console.error('Quick search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Refine search - adjust existing search with new constraints
app.post('/api/agent/refine', async (req, res) => {
  try {
    const { sessionId, refinement } = req.body;

    const convState = conversationStates.get(sessionId);
    if (!convState || !convState.lastParams) {
      return res.status(400).json({
        error: 'No previous search found. Please start a new search.'
      });
    }

    await ensureTeeTimesExist();
    const teeTimes = await getAgentTeeTimes();

    const result = await refineSearch(
      convState.lastParams,
      refinement,
      teeTimes,
      convState.getContext()
    );

    res.json(result);

  } catch (error) {
    console.error('Refine search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Course insight endpoint
app.get('/api/agent/course/:name', async (req, res) => {
  try {
    const { name } = req.params;

    await ensureTeeTimesExist();
    const teeTimes = await getAgentTeeTimes();

    const insight = getCourseInsight(decodeURIComponent(name), teeTimes);
    res.json(insight);

  } catch (error) {
    console.error('Course insight error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Example queries endpoint - help users get started
app.get('/api/agent/examples', (req, res) => {
  res.json({
    examples: [
      {
        query: "Find me something under $60 this weekend in the East Bay",
        description: "Budget-friendly weekend round"
      },
      {
        query: "I want to play Harding Park tomorrow morning",
        description: "Specific course request"
      },
      {
        query: "Best deal for 4 players this Saturday afternoon",
        description: "Group booking with time preference"
      },
      {
        query: "Show me twilight rates near San Francisco",
        description: "Time-based discount search"
      },
      {
        query: "High-rated courses under $100 this week",
        description: "Quality-focused search"
      },
      {
        query: "Cheap 9-hole option for tomorrow",
        description: "Quick round on a budget"
      }
    ]
  });
});

// ========== BOOKING REQUEST ENDPOINTS ==========

// In-memory booking queue (in production, use Redis or database)
const bookingQueue = new Map();

// Create a booking request
app.post('/api/bookings/request', optionalAuth, async (req, res) => {
  try {
    const { teeTimeId, courseId, date, time, players, contact, bookingUrl } = req.body;

    // Validate required fields
    if (!contact?.email || !contact?.firstName || !contact?.lastName) {
      return res.status(400).json({ error: 'Contact information required (firstName, lastName, email)' });
    }

    if (!bookingUrl && !teeTimeId) {
      return res.status(400).json({ error: 'Either bookingUrl or teeTimeId required' });
    }

    // Get tee time details if teeTimeId provided
    let teeTime = null;
    if (teeTimeId) {
      const result = await db.execute({
        sql: `SELECT t.*, c.name as course_name, c.slug as course_slug
              FROM tee_times t
              JOIN courses c ON t.course_id = c.id
              WHERE t.id = ?`,
        args: [parseInt(teeTimeId)]
      });
      teeTime = result.rows[0];
    }

    // Create booking request
    const bookingId = 'bk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const booking = {
      id: bookingId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      userId: req.user?.id || null,
      teeTime: teeTime || {
        course_id: courseId,
        date,
        time,
        booking_url: bookingUrl
      },
      players: players || 1,
      contact: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone
      },
      bookingUrl: bookingUrl || teeTime?.booking_url
    };

    // Store in queue
    bookingQueue.set(bookingId, booking);

    // In production, this would trigger the booking automation
    // For now, we return the prepared booking with a deep link

    // Generate deep booking link for GolfNow
    const deepLink = booking.bookingUrl || `https://www.golfnow.com/tee-times/facility/${teeTime?.course_id}/search#date=${date}&time=${time}&players=${players}`;

    res.json({
      success: true,
      booking: {
        id: bookingId,
        status: 'pending',
        message: 'Booking request created. Use the link below to complete your reservation.',
        deepLink,
        teeTime: {
          course: teeTime?.course_name || 'Selected Course',
          date: teeTime?.date || date,
          time: teeTime?.time || time,
          price: teeTime?.price
        },
        contact: { email: contact.email }
      }
    });

  } catch (error) {
    console.error('Booking request error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get booking status
app.get('/api/bookings/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const booking = bookingQueue.get(id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check authorization
    if (booking.userId && req.user?.id !== booking.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({ booking });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel booking request
app.delete('/api/bookings/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const booking = bookingQueue.get(id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId && req.user?.id !== booking.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (booking.status === 'confirmed') {
      return res.status(400).json({ error: 'Cannot cancel confirmed booking through API' });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date().toISOString();

    res.json({ success: true, message: 'Booking request cancelled' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's booking history
app.get('/api/bookings', userAuth, async (req, res) => {
  try {
    // Get bookings from queue for this user
    const userBookings = Array.from(bookingQueue.values())
      .filter(b => b.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ bookings: userBookings });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SPA fallback (Express 5 compatible)
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }

  const publicPath = path.join(__dirname, '../public');

  if (req.path.startsWith('/course/')) {
    return res.sendFile(path.join(publicPath, 'course.html'));
  }
  if (req.path === '/courses') {
    return res.sendFile(path.join(publicPath, 'courses.html'));
  }
  if (req.path === '/scorebook') {
    return res.sendFile(path.join(publicPath, 'scorebook.html'));
  }
  if (req.path === '/community') {
    return res.sendFile(path.join(publicPath, 'community.html'));
  }
  if (req.path === '/account') {
    return res.sendFile(path.join(publicPath, 'account.html'));
  }
  if (req.path === '/admin') {
    return res.sendFile(path.join(publicPath, 'admin.html'));
  }

  res.sendFile(path.join(publicPath, 'app.html'));
});

// ========== ADVANCED CLICK TRACKING ==========

// Generate unique IDs
const generateId = () => crypto.randomBytes(16).toString('hex');

// Parse referrer to extract domain and type
const parseReferrer = (ref) => {
  if (!ref) return { domain: null, type: 'direct' };
  try {
    const url = new URL(ref);
    const domain = url.hostname.replace('www.', '');

    // Categorize referrer type
    let type = 'other';
    if (/google\.|bing\.|yahoo\.|duckduckgo\.|baidu\./i.test(domain)) type = 'search';
    else if (/facebook\.|instagram\.|twitter\.|x\.com|linkedin\.|tiktok\.|pinterest\./i.test(domain)) type = 'social';
    else if (/bayareagolf\.now|localhost/i.test(domain)) type = 'internal';
    else if (/reddit\.|discord\.|slack\./i.test(domain)) type = 'community';
    else if (/mail\.|outlook\.|gmail\./i.test(domain)) type = 'email';

    return { domain, type };
  } catch {
    return { domain: ref.substring(0, 100), type: 'other' };
  }
};

// Detect bots from user agent
const isBot = (ua) => {
  if (!ua) return false;
  return /bot|crawler|spider|scraper|headless|phantom|selenium|puppeteer/i.test(ua);
};

// Tracking page - serves HTML that collects client data then redirects
app.get('/go/:slug', async (req, res) => {
  const { slug } = req.params;
  const isDeal = req.query.deal === 'true';

  try {
    // Look up course
    const result = await db.execute({
      sql: 'SELECT name, booking_url, booking_system, slug FROM courses WHERE slug = ?',
      args: [slug]
    });

    const course = result.rows[0];
    if (!course || !course.booking_url) {
      return res.redirect('/courses.html');
    }

    // Build final redirect URL
    let redirectUrl = course.booking_url;
    const separator = redirectUrl.includes('?') ? '&' : '?';
    redirectUrl += `${separator}utm_source=bayareagolf&utm_medium=web&utm_campaign=${slug}&utm_content=${isDeal ? 'deal' : 'regular'}`;
    if (process.env.GOLFNOW_AFFILIATE_ID && course.booking_system === 'golfnow') {
      redirectUrl += `&affiliate=${process.env.GOLFNOW_AFFILIATE_ID}`;
    }

    // Get/create visitor ID from cookie
    let visitorId = req.cookies?.bag_visitor;
    let isReturning = false;
    if (!visitorId) {
      visitorId = generateId();
    } else {
      isReturning = true;
    }

    // Get/create session ID
    let sessionId = req.cookies?.bag_session;
    if (!sessionId) {
      sessionId = generateId();
    }

    // Set cookies
    res.cookie('bag_visitor', visitorId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });
    res.cookie('bag_session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000 // 30 min session
    });

    // Collect server-side data
    const ua = req.headers['user-agent'] || '';
    const parser = new UAParser(ua);
    const uaResult = parser.getResult();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || '';
    const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16) : null;

    const refInfo = parseReferrer(req.headers.referer);

    // Server-side data object
    const serverData = {
      course_slug: slug,
      course_name: course.name,
      booking_system: course.booking_system,
      source: isDeal ? 'deal' : 'regular',
      visitor_id: visitorId,
      session_id: sessionId,
      is_returning_visitor: isReturning ? 1 : 0,
      referrer: req.headers.referer?.substring(0, 500) || null,
      referrer_domain: refInfo.domain,
      referrer_type: refInfo.type,
      utm_source: req.query.utm_source || null,
      utm_medium: req.query.utm_medium || null,
      utm_campaign: req.query.utm_campaign || null,
      utm_term: req.query.utm_term || null,
      utm_content: req.query.utm_content || null,
      landing_page: req.headers.referer?.includes('bayareagolf') ? req.headers.referer : null,
      ip_hash: ipHash,
      country: req.headers['x-vercel-ip-country'] || null,
      country_code: req.headers['x-vercel-ip-country'] || null,
      region: req.headers['x-vercel-ip-country-region'] || null,
      city: req.headers['x-vercel-ip-city'] || null,
      latitude: req.headers['x-vercel-ip-latitude'] ? parseFloat(req.headers['x-vercel-ip-latitude']) : null,
      longitude: req.headers['x-vercel-ip-longitude'] ? parseFloat(req.headers['x-vercel-ip-longitude']) : null,
      timezone: req.headers['x-vercel-ip-timezone'] || null,
      user_agent: ua.substring(0, 500),
      device_type: uaResult.device.type || 'desktop',
      device_brand: uaResult.device.vendor || null,
      device_model: uaResult.device.model || null,
      os_name: uaResult.os.name || null,
      os_version: uaResult.os.version || null,
      browser: uaResult.browser.name || null,
      browser_version: uaResult.browser.version || null,
      is_bot: isBot(ua) ? 1 : 0,
      is_golfnow: course.booking_system === 'golfnow' ? 1 : 0,
      is_mobile: uaResult.device.type === 'mobile' ? 1 : 0,
      is_tablet: uaResult.device.type === 'tablet' ? 1 : 0,
      is_desktop: (!uaResult.device.type || uaResult.device.type === 'desktop') ? 1 : 0
    };

    // Serve tracking page that collects client-side data and redirects
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex">
  <title>Redirecting to ${course.name}...</title>
  <style>
    body { font-family: Georgia, serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f4ebe0; }
    .loader { text-align: center; color: #2d5a27; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e8dcc8; border-top-color: #2d5a27; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Taking you to ${course.name}...</p>
  </div>
  <script>
    (function() {
      // Collect client-side data
      var clientData = {
        screen_width: screen.width,
        screen_height: screen.height,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        pixel_ratio: window.devicePixelRatio || 1,
        color_depth: screen.colorDepth,
        language: navigator.language,
        languages: navigator.languages ? navigator.languages.join(',') : navigator.language,
        timezone_offset: new Date().getTimezoneOffset(),
        has_touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 1 : 0,
        connection_type: navigator.connection ? navigator.connection.effectiveType : null
      };

      // Merge with server data
      var data = Object.assign(${JSON.stringify(serverData)}, clientData);

      // Send tracking beacon
      var sent = false;
      function sendAndRedirect() {
        if (sent) return;
        sent = true;

        // Use sendBeacon if available (doesn't block redirect)
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/track', JSON.stringify(data));
        } else {
          // Fallback: sync XHR
          var xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/track', false);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(JSON.stringify(data));
        }

        // Redirect
        window.location.href = '${redirectUrl}';
      }

      // Send after brief delay to ensure beacon fires
      setTimeout(sendAndRedirect, 100);

      // Fallback: redirect after 2s no matter what
      setTimeout(function() { window.location.href = '${redirectUrl}'; }, 2000);
    })();
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  </noscript>
</body>
</html>`);

  } catch (error) {
    console.error('Tracking error:', error);
    res.redirect('/courses.html');
  }
});

// Tracking beacon endpoint - receives data from client
app.post('/api/track', async (req, res) => {
  try {
    const d = req.body;

    // Insert click
    await db.execute({
      sql: `INSERT INTO clicks (
        course_slug, course_name, booking_system, source,
        visitor_id, session_id, is_returning_visitor,
        referrer, referrer_domain, referrer_type,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page,
        ip_hash, country, country_code, region, city, latitude, longitude, timezone,
        user_agent, device_type, device_brand, device_model, os_name, os_version, browser, browser_version, is_bot,
        screen_width, screen_height, viewport_width, viewport_height, pixel_ratio, color_depth,
        language, languages, timezone_offset, has_touch, connection_type,
        is_golfnow, is_mobile, is_tablet, is_desktop
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        d.course_slug, d.course_name, d.booking_system, d.source,
        d.visitor_id, d.session_id, d.is_returning_visitor,
        d.referrer, d.referrer_domain, d.referrer_type,
        d.utm_source, d.utm_medium, d.utm_campaign, d.utm_term, d.utm_content, d.landing_page,
        d.ip_hash, d.country, d.country_code, d.region, d.city, d.latitude, d.longitude, d.timezone,
        d.user_agent, d.device_type, d.device_brand, d.device_model, d.os_name, d.os_version, d.browser, d.browser_version, d.is_bot,
        d.screen_width, d.screen_height, d.viewport_width, d.viewport_height, d.pixel_ratio, d.color_depth,
        d.language, d.languages, d.timezone_offset, d.has_touch, d.connection_type,
        d.is_golfnow, d.is_mobile, d.is_tablet, d.is_desktop
      ]
    });

    // Update visitor record
    if (d.visitor_id) {
      await db.execute({
        sql: `INSERT INTO visitors (id, country, city, device_type, browser, click_count)
              VALUES (?, ?, ?, ?, ?, 1)
              ON CONFLICT(id) DO UPDATE SET
                last_seen = CURRENT_TIMESTAMP,
                visit_count = visit_count + 1,
                click_count = click_count + 1`,
        args: [d.visitor_id, d.country, d.city, d.device_type, d.browser]
      });
    }

    res.status(204).end();
  } catch (error) {
    console.error('Track error:', error);
    res.status(204).end(); // Don't fail the redirect
  }
});

// ========== CLICK TRACKING ADMIN STATS ==========

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

// Admin stats - ALL TIME, comprehensive demographics
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    // ===== BASIC COUNTS =====
    const [total, golfnow, deals, bots] = await Promise.all([
      db.execute('SELECT COUNT(*) as count FROM clicks'),
      db.execute('SELECT COUNT(*) as count FROM clicks WHERE is_golfnow = 1'),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM clicks WHERE source = ?', args: ['deal'] }),
      db.execute('SELECT COUNT(*) as count FROM clicks WHERE is_bot = 1')
    ]);

    // Date range
    const dateRange = await db.execute('SELECT MIN(clicked_at) as first, MAX(clicked_at) as last FROM clicks');

    // ===== VISITOR METRICS =====
    const visitorStats = await db.execute(`
      SELECT
        COUNT(DISTINCT visitor_id) as unique_visitors,
        COUNT(DISTINCT session_id) as total_sessions,
        SUM(CASE WHEN is_returning_visitor = 1 THEN 1 ELSE 0 END) as returning_clicks,
        SUM(CASE WHEN is_returning_visitor = 0 THEN 1 ELSE 0 END) as new_clicks
      FROM clicks WHERE visitor_id IS NOT NULL
    `);

    // Top returning visitors
    const topVisitors = await db.execute(`
      SELECT visitor_id, COUNT(*) as clicks, MIN(clicked_at) as first_click, MAX(clicked_at) as last_click
      FROM clicks WHERE visitor_id IS NOT NULL
      GROUP BY visitor_id
      HAVING clicks > 1
      ORDER BY clicks DESC
      LIMIT 20
    `);

    // ===== BY COURSE =====
    const byCourse = await db.execute(`
      SELECT course_slug, course_name, booking_system,
             COUNT(*) as clicks,
             SUM(CASE WHEN source = 'deal' THEN 1 ELSE 0 END) as deal_clicks,
             COUNT(DISTINCT visitor_id) as unique_visitors,
             MAX(is_golfnow) as is_golfnow
      FROM clicks
      GROUP BY course_slug
      ORDER BY clicks DESC
    `);

    // ===== BY BOOKING SYSTEM =====
    const bySystem = await db.execute(`
      SELECT booking_system, COUNT(*) as clicks, COUNT(DISTINCT visitor_id) as unique_visitors
      FROM clicks
      GROUP BY booking_system
      ORDER BY clicks DESC
    `);

    // ===== TIME ANALYSIS =====
    const byDay = await db.execute(`
      SELECT DATE(clicked_at) as date,
             COUNT(*) as clicks,
             SUM(CASE WHEN is_golfnow = 1 THEN 1 ELSE 0 END) as golfnow_clicks,
             SUM(CASE WHEN source = 'deal' THEN 1 ELSE 0 END) as deal_clicks,
             COUNT(DISTINCT visitor_id) as unique_visitors
      FROM clicks
      GROUP BY DATE(clicked_at)
      ORDER BY date DESC
    `);

    const byHour = await db.execute(`
      SELECT CAST(strftime('%H', clicked_at) AS INTEGER) as hour, COUNT(*) as clicks
      FROM clicks GROUP BY hour ORDER BY hour
    `);

    const byWeekday = await db.execute(`
      SELECT CAST(strftime('%w', clicked_at) AS INTEGER) as day, COUNT(*) as clicks
      FROM clicks GROUP BY day ORDER BY day
    `);
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // ===== DEVICE & PLATFORM =====
    const byDeviceType = await db.execute(`
      SELECT device_type, COUNT(*) as clicks, COUNT(DISTINCT visitor_id) as unique_visitors
      FROM clicks GROUP BY device_type ORDER BY clicks DESC
    `);

    const byOS = await db.execute(`
      SELECT os_name, os_version, COUNT(*) as clicks
      FROM clicks WHERE os_name IS NOT NULL
      GROUP BY os_name, os_version ORDER BY clicks DESC LIMIT 20
    `);

    const byBrowser = await db.execute(`
      SELECT browser, browser_version, COUNT(*) as clicks
      FROM clicks WHERE browser IS NOT NULL
      GROUP BY browser, browser_version ORDER BY clicks DESC LIMIT 20
    `);

    const byDeviceBrand = await db.execute(`
      SELECT device_brand, device_model, COUNT(*) as clicks
      FROM clicks WHERE device_brand IS NOT NULL
      GROUP BY device_brand, device_model ORDER BY clicks DESC LIMIT 20
    `);

    // ===== SCREEN & VIEWPORT =====
    const byScreenSize = await db.execute(`
      SELECT screen_width, screen_height, COUNT(*) as clicks
      FROM clicks WHERE screen_width IS NOT NULL
      GROUP BY screen_width, screen_height ORDER BY clicks DESC LIMIT 20
    `);

    const avgViewport = await db.execute(`
      SELECT
        AVG(viewport_width) as avg_width,
        AVG(viewport_height) as avg_height,
        AVG(pixel_ratio) as avg_pixel_ratio
      FROM clicks WHERE viewport_width IS NOT NULL
    `);

    // ===== GEOGRAPHIC =====
    const byCountry = await db.execute(`
      SELECT country, country_code, COUNT(*) as clicks, COUNT(DISTINCT visitor_id) as unique_visitors
      FROM clicks WHERE country IS NOT NULL
      GROUP BY country, country_code ORDER BY clicks DESC
    `);

    const byCity = await db.execute(`
      SELECT city, region, country, COUNT(*) as clicks, COUNT(DISTINCT visitor_id) as unique_visitors
      FROM clicks WHERE city IS NOT NULL
      GROUP BY city, region, country ORDER BY clicks DESC LIMIT 30
    `);

    const byTimezone = await db.execute(`
      SELECT timezone, COUNT(*) as clicks
      FROM clicks WHERE timezone IS NOT NULL
      GROUP BY timezone ORDER BY clicks DESC LIMIT 20
    `);

    // ===== TRAFFIC SOURCES =====
    const byReferrerType = await db.execute(`
      SELECT referrer_type, COUNT(*) as clicks, COUNT(DISTINCT visitor_id) as unique_visitors
      FROM clicks GROUP BY referrer_type ORDER BY clicks DESC
    `);

    const byReferrerDomain = await db.execute(`
      SELECT referrer_domain, referrer_type, COUNT(*) as clicks
      FROM clicks WHERE referrer_domain IS NOT NULL
      GROUP BY referrer_domain ORDER BY clicks DESC LIMIT 30
    `);

    const byUTMSource = await db.execute(`
      SELECT utm_source, utm_medium, utm_campaign, COUNT(*) as clicks
      FROM clicks WHERE utm_source IS NOT NULL
      GROUP BY utm_source, utm_medium, utm_campaign ORDER BY clicks DESC LIMIT 20
    `);

    // ===== LANGUAGE & LOCALE =====
    const byLanguage = await db.execute(`
      SELECT language, COUNT(*) as clicks
      FROM clicks WHERE language IS NOT NULL
      GROUP BY language ORDER BY clicks DESC LIMIT 20
    `);

    // ===== CONNECTION =====
    const byConnection = await db.execute(`
      SELECT connection_type, COUNT(*) as clicks
      FROM clicks WHERE connection_type IS NOT NULL
      GROUP BY connection_type ORDER BY clicks DESC
    `);

    const touchVsNonTouch = await db.execute(`
      SELECT
        SUM(CASE WHEN has_touch = 1 THEN 1 ELSE 0 END) as touch,
        SUM(CASE WHEN has_touch = 0 THEN 1 ELSE 0 END) as non_touch
      FROM clicks WHERE has_touch IS NOT NULL
    `);

    // ===== RECENT CLICKS =====
    const recent = await db.execute(`
      SELECT course_name, course_slug, source, booking_system, clicked_at,
             city, region, country, device_type, browser, os_name,
             is_returning_visitor, referrer_type, screen_width, screen_height
      FROM clicks
      ORDER BY clicked_at DESC
      LIMIT 100
    `);

    res.json({
      // Summary
      first_click: dateRange.rows[0]?.first,
      last_click: dateRange.rows[0]?.last,
      total_clicks: total.rows[0]?.count || 0,
      golfnow_clicks: golfnow.rows[0]?.count || 0,
      deal_clicks: deals.rows[0]?.count || 0,
      bot_clicks: bots.rows[0]?.count || 0,

      // Visitor metrics
      unique_visitors: visitorStats.rows[0]?.unique_visitors || 0,
      total_sessions: visitorStats.rows[0]?.total_sessions || 0,
      returning_clicks: visitorStats.rows[0]?.returning_clicks || 0,
      new_visitor_clicks: visitorStats.rows[0]?.new_clicks || 0,
      top_returning_visitors: topVisitors.rows,

      // By course
      by_course: byCourse.rows,

      // By system
      by_booking_system: bySystem.rows,

      // Time analysis
      by_day: byDay.rows,
      by_hour: byHour.rows,
      by_weekday: byWeekday.rows.map(r => ({ day: weekdayNames[r.day], clicks: r.clicks })),

      // Device & platform
      by_device_type: byDeviceType.rows,
      by_os: byOS.rows,
      by_browser: byBrowser.rows,
      by_device_brand: byDeviceBrand.rows,

      // Screen & viewport
      by_screen_size: byScreenSize.rows,
      avg_viewport: avgViewport.rows[0],

      // Geographic
      by_country: byCountry.rows,
      by_city: byCity.rows,
      by_timezone: byTimezone.rows,

      // Traffic sources
      by_referrer_type: byReferrerType.rows,
      by_referrer_domain: byReferrerDomain.rows,
      by_utm: byUTMSource.rows,

      // Language & connection
      by_language: byLanguage.rows,
      by_connection: byConnection.rows,
      touch_stats: touchVsNonTouch.rows[0],

      // Recent
      recent_clicks: recent.rows
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin CSV export - all fields
app.get('/api/admin/export', adminAuth, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT * FROM clicks ORDER BY clicked_at DESC
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }

    const headers = Object.keys(result.rows[0]);
    let csv = headers.join(',') + '\n';

    for (const row of result.rows) {
      csv += headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bayareagolf-clicks-full.csv');
    res.send(csv);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Only start server if not being imported (for Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
