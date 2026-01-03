const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../data/golf.db'));

// Create tables
db.exec(`
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

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
  );

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
  );

  CREATE TABLE IF NOT EXISTS course_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    photo_type TEXT,
    year_taken INTEGER,
    source TEXT,
    width INTEGER,
    height INTEGER,
    is_primary INTEGER DEFAULT 0,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS food_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    avg_rating REAL,
    mention_count INTEGER DEFAULT 1,
    photo_url TEXT,
    source TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );

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
  );

  CREATE INDEX IF NOT EXISTS idx_tee_times_datetime ON tee_times(datetime);
  CREATE INDEX IF NOT EXISTS idx_tee_times_date ON tee_times(date);
  CREATE INDEX IF NOT EXISTS idx_tee_times_course ON tee_times(course_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id);
  CREATE INDEX IF NOT EXISTS idx_photos_course ON course_photos(course_id);
  CREATE INDEX IF NOT EXISTS idx_food_course ON food_items(course_id);
  CREATE INDEX IF NOT EXISTS idx_tournament_course ON tournament_history(course_id);
`);

module.exports = db;
