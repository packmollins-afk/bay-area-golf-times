require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
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

// Send verification email
const sendVerificationEmail = async (email, token, displayName) => {
  if (!resend) {
    console.log('Resend not configured - skipping verification email');
    return;
  }

  const verifyUrl = `https://bayareagolf.now/api/auth/verify?token=${token}`;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Bay Area Golf <noreply@bayareagolf.now>',
    to: email,
    subject: 'Verify your Bay Area Golf account',
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #2d5a27; font-size: 28px; margin-bottom: 24px;">Welcome to Bay Area Golf, ${displayName}!</h1>
        <p style="color: #3d2914; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Thanks for signing up. Please verify your email address to complete your registration and start tracking your rounds.
        </p>
        <a href="${verifyUrl}" style="display: inline-block; background: #2d5a27; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
          Verify Email Address
        </a>
        <p style="color: #6b5344; font-size: 14px; margin-top: 32px;">
          If you didn't create this account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #ddd0bc; margin: 32px 0;">
        <p style="color: #6b5344; font-size: 12px;">
          Bay Area Golf - Track your rounds across the Bay
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
app.use(express.static(path.join(__dirname, '../public')));

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

    // Default: courses with prices
    const result = await db.execute(`
      SELECT c.*,
        (SELECT MIN(t.price) FROM tee_times t WHERE t.course_id = c.id AND t.datetime >= datetime('now')) as next_price,
        (SELECT t.datetime FROM tee_times t WHERE t.course_id = c.id AND t.datetime >= datetime('now') ORDER BY t.datetime LIMIT 1) as next_time
      FROM courses c
      ORDER BY c.region, c.city, c.name
    `);
    res.json(result.rows);
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

    // Get tee times
    const teeTimesResult = await db.execute({
      sql: `SELECT * FROM tee_times WHERE course_id = ? AND datetime >= datetime('now') ORDER BY datetime LIMIT 50`,
      args: [course.id]
    });

    // Get tournament history
    const tournamentsResult = await db.execute({
      sql: 'SELECT * FROM tournament_history WHERE course_id = ? ORDER BY year DESC LIMIT 5',
      args: [course.id]
    });

    res.json({
      ...course,
      teeTimes: teeTimesResult.rows,
      tournamentHistory: tournamentsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/courses/:id/tee-times', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, minPrice, maxPrice, time } = req.query;

    let sql = `SELECT * FROM tee_times WHERE course_id = ? AND datetime >= datetime('now')`;
    const args = [parseInt(id)];

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

    const [tt1Result, tt2Result] = await Promise.all([
      db.execute({ sql: `SELECT * FROM tee_times WHERE course_id = ? AND datetime >= datetime('now') ORDER BY datetime LIMIT 20`, args: [parseInt(course1)] }),
      db.execute({ sql: `SELECT * FROM tee_times WHERE course_id = ? AND datetime >= datetime('now') ORDER BY datetime LIMIT 20`, args: [parseInt(course2)] })
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

// ========== TEE TIME ENDPOINTS ==========

app.get('/api/tee-times', async (req, res) => {
  try {
    const { date, region, minPrice, maxPrice } = req.query;

    let sql = `
      SELECT t.*, c.name as course_name, c.city, c.region, c.slug as course_slug
      FROM tee_times t
      JOIN courses c ON t.course_id = c.id
      WHERE t.datetime >= datetime('now')
    `;
    const args = [];

    if (date) {
      sql += ' AND t.date = ?';
      args.push(date);
    }
    if (region) {
      sql += ' AND c.region = ?';
      args.push(region);
    }
    if (minPrice) {
      sql += ' AND t.price >= ?';
      args.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      sql += ' AND t.price <= ?';
      args.push(parseFloat(maxPrice));
    }

    sql += ' ORDER BY t.datetime LIMIT 200';

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tee-times/deals', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT t.*, c.name as course_name, c.city, c.region, c.slug as course_slug,
             (t.original_price - t.price) as savings,
             ROUND((t.original_price - t.price) * 100.0 / t.original_price, 0) as discount_pct
      FROM tee_times t
      JOIN courses c ON t.course_id = c.id
      WHERE t.datetime >= datetime('now')
        AND t.original_price IS NOT NULL
        AND t.price < t.original_price
      ORDER BY discount_pct DESC
      LIMIT 20
    `);
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
    await db.execute({
      sql: `UPDATE users SET display_name = COALESCE(?, display_name), home_course_id = ?, handicap = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [displayName, homeCourseId || null, handicap || null, user.id]
    });
    res.json({ success: true });
  } catch (error) {
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

    const result = await db.execute(`
      SELECT u.id, u.display_name, u.profile_picture, u.home_course_id, u.handicap,
             c.name as home_course_name, c.slug as home_course_slug,
             COUNT(r.id) as rounds_played, ROUND(AVG(r.total_score), 1) as avg_score
      FROM users u
      LEFT JOIN courses c ON u.home_course_id = c.id
      LEFT JOIN rounds r ON u.id = r.user_id
      GROUP BY u.id
      ORDER BY rounds_played DESC, u.display_name ASC
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
    res.json({ success: true, token: Buffer.from(ADMIN_PASSWORD).toString('base64') });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

const adminAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Authorization required' });
  const token = auth.replace('Bearer ', '');
  if (Buffer.from(token, 'base64').toString() !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
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

// Only start server if not being imported (for Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
