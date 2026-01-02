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
    golfnow_id TEXT,
    foreup_id TEXT,
    booking_url TEXT,
    booking_system TEXT,
    latitude REAL,
    longitude REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  CREATE INDEX IF NOT EXISTS idx_tee_times_datetime ON tee_times(datetime);
  CREATE INDEX IF NOT EXISTS idx_tee_times_date ON tee_times(date);
  CREATE INDEX IF NOT EXISTS idx_tee_times_course ON tee_times(course_id);
`);

module.exports = db;
