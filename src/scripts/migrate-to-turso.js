#!/usr/bin/env node
/**
 * Migrate data from local SQLite to Turso
 */

const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');
const path = require('path');

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://bay-area-golf-bayareagolfnow.aws-us-west-2.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_TOKEN) {
  console.error('TURSO_AUTH_TOKEN environment variable required');
  process.exit(1);
}

const localDb = new Database(path.join(__dirname, '../../data/golf.db'));
const tursoDb = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function migrate() {
  console.log('Starting migration to Turso...');

  // Initialize schema
  console.log('Creating tables...');

  await tursoDb.execute(`
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

  await tursoDb.execute(`
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
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  await tursoDb.execute(`
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

  await tursoDb.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await tursoDb.execute(`
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

  await tursoDb.execute(`
    CREATE TABLE IF NOT EXISTS round_holes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      hole_number INTEGER NOT NULL,
      par INTEGER,
      score INTEGER,
      putts INTEGER,
      fairway_hit INTEGER,
      gir INTEGER,
      FOREIGN KEY (round_id) REFERENCES rounds(id)
    )
  `);

  await tursoDb.execute(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  await tursoDb.execute(`
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

  // Create indexes
  await tursoDb.execute('CREATE INDEX IF NOT EXISTS idx_tee_times_datetime ON tee_times(datetime)');
  await tursoDb.execute('CREATE INDEX IF NOT EXISTS idx_tee_times_date ON tee_times(date)');
  await tursoDb.execute('CREATE INDEX IF NOT EXISTS idx_tee_times_course ON tee_times(course_id)');
  await tursoDb.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await tursoDb.execute('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
  await tursoDb.execute('CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug)');

  // Migrate courses
  console.log('Migrating courses...');
  const courses = localDb.prepare('SELECT * FROM courses').all();

  for (const course of courses) {
    await tursoDb.execute({
      sql: `INSERT OR REPLACE INTO courses (id, name, city, region, holes, par, yardage, slope_rating, course_rating,
            golfnow_id, foreup_id, google_place_id, booking_url, website_url, booking_system, latitude, longitude,
            avg_rating, total_reviews, recent_avg_rating, course_record_score, course_record_holder, course_record_date,
            course_record_details, phone_number, has_driving_range, has_practice_green, has_pro_shop, photo_url,
            slug, is_staff_pick, staff_pick_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        course.id, course.name, course.city, course.region, course.holes, course.par, course.yardage,
        course.slope_rating, course.course_rating, course.golfnow_id, course.foreup_id, course.google_place_id,
        course.booking_url, course.website_url, course.booking_system, course.latitude, course.longitude,
        course.avg_rating, course.total_reviews, course.recent_avg_rating, course.course_record_score,
        course.course_record_holder, course.course_record_date, course.course_record_details, course.phone_number,
        course.has_driving_range, course.has_practice_green, course.has_pro_shop, course.photo_url,
        course.slug, course.is_staff_pick, course.staff_pick_order, course.created_at, course.updated_at
      ]
    });
  }
  console.log(`Migrated ${courses.length} courses`);

  // Migrate tee times
  console.log('Migrating tee times...');
  const teeTimes = localDb.prepare('SELECT * FROM tee_times').all();

  for (const tt of teeTimes) {
    await tursoDb.execute({
      sql: `INSERT OR REPLACE INTO tee_times (id, course_id, date, time, datetime, holes, players, price,
            original_price, has_cart, booking_url, source, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        tt.id, tt.course_id, tt.date, tt.time, tt.datetime, tt.holes, tt.players, tt.price,
        tt.original_price, tt.has_cart, tt.booking_url, tt.source, tt.scraped_at
      ]
    });
  }
  console.log(`Migrated ${teeTimes.length} tee times`);

  // Migrate tournament history
  console.log('Migrating tournament history...');
  try {
    const tournaments = localDb.prepare('SELECT * FROM tournament_history').all();
    for (const t of tournaments) {
      await tursoDb.execute({
        sql: `INSERT OR REPLACE INTO tournament_history (id, course_id, tournament_name, tournament_type, year,
              winner_name, winning_score, score_to_par, runner_up, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [t.id, t.course_id, t.tournament_name, t.tournament_type, t.year,
               t.winner_name, t.winning_score, t.score_to_par, t.runner_up, t.notes]
      });
    }
    console.log(`Migrated ${tournaments.length} tournament records`);
  } catch (e) {
    console.log('No tournament history to migrate');
  }

  // Migrate existing users (if any)
  console.log('Migrating users...');
  try {
    const users = localDb.prepare('SELECT * FROM users').all();
    for (const user of users) {
      await tursoDb.execute({
        sql: `INSERT OR REPLACE INTO users (id, email, password_hash, display_name, profile_picture,
              home_course_id, handicap, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [user.id, user.email, user.password_hash, user.display_name, user.profile_picture,
               user.home_course_id, user.handicap, user.created_at, user.updated_at]
      });
    }
    console.log(`Migrated ${users.length} users`);
  } catch (e) {
    console.log('No users to migrate');
  }

  // Migrate rounds
  console.log('Migrating rounds...');
  try {
    const rounds = localDb.prepare('SELECT * FROM rounds').all();
    for (const r of rounds) {
      await tursoDb.execute({
        sql: `INSERT OR REPLACE INTO rounds (id, user_id, course_id, date, total_score, total_putts, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [r.id, r.user_id, r.course_id, r.date, r.total_score, r.total_putts, r.notes, r.created_at]
      });
    }
    console.log(`Migrated ${rounds.length} rounds`);
  } catch (e) {
    console.log('No rounds to migrate');
  }

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
