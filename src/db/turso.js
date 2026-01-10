const { createClient } = require('@libsql/client');

// Turso connection - uses environment variables
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://bay-area-golf-bayareagolfnow.aws-us-west-2.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Initialize schema
async function initSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      region TEXT NOT NULL,
      holes INTEGER NOT NULL,
      par INTEGER,
      yardage INTEGER,
      slope_rating REAL,
      course_rating REAL,
      golfnow_id TEXT,
      foreup_id TEXT,
      google_place_id TEXT,
      booking_url TEXT,
      website_url TEXT,
      booking_system TEXT,
      latitude REAL,
      longitude REAL,
      avg_rating REAL,
      total_reviews INTEGER DEFAULT 0,
      recent_avg_rating REAL,
      course_record_score INTEGER,
      course_record_holder TEXT,
      course_record_date TEXT,
      course_record_details TEXT,
      phone_number TEXT,
      has_driving_range INTEGER DEFAULT 0,
      has_practice_green INTEGER DEFAULT 0,
      has_pro_shop INTEGER DEFAULT 0,
      photo_url TEXT,
      slug TEXT UNIQUE,
      is_staff_pick INTEGER DEFAULT 0,
      staff_pick_order INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tee_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      datetime TEXT NOT NULL,
      holes INTEGER,
      players INTEGER,
      price REAL,
      original_price REAL,
      has_cart INTEGER DEFAULT 0,
      booking_url TEXT,
      source TEXT,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id),
      UNIQUE(course_id, datetime, source)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      author_name TEXT,
      rating INTEGER,
      text TEXT,
      time INTEGER,
      relative_time TEXT,
      profile_photo_url TEXT,
      source TEXT DEFAULT 'google',
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      profile_picture TEXT,
      home_course_id INTEGER,
      handicap REAL,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      UNIQUE(user_id, course_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_score INTEGER,
      total_putts INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS round_holes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      hole_number INTEGER NOT NULL,
      par INTEGER,
      score INTEGER,
      putts INTEGER,
      fairway_hit INTEGER,
      gir INTEGER,
      FOREIGN KEY (round_id) REFERENCES rounds(id),
      UNIQUE(round_id, hole_number)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tournament_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      tournament_name TEXT NOT NULL,
      tournament_type TEXT,
      year INTEGER NOT NULL,
      winner_name TEXT NOT NULL,
      winning_score TEXT,
      score_to_par TEXT,
      runner_up TEXT,
      notes TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  // Add password reset columns if they don't exist
  try {
    await db.execute('ALTER TABLE users ADD COLUMN reset_token TEXT');
  } catch (e) { /* Column already exists */ }
  try {
    await db.execute('ALTER TABLE users ADD COLUMN reset_token_expires DATETIME');
  } catch (e) { /* Column already exists */ }

  // Create indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_tee_times_datetime ON tee_times(datetime)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_tee_times_date ON tee_times(date)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_tee_times_course ON tee_times(course_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_user_favorites ON user_favorites(user_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_rounds_user ON rounds(user_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_rounds_course ON rounds(course_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug)');

  console.log('Turso schema initialized');
}

module.exports = { db, initSchema };
