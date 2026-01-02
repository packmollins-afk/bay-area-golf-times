/**
 * Generate demo tee time data for testing the app
 * This simulates what the scrapers would produce
 */

const path = require('path');
const Database = require('better-sqlite3');

// Initialize database
const dbPath = path.join(__dirname, '../../data/golf.db');
const db = new Database(dbPath);

// Create tables if they don't exist
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

// Course data
const courses = [
  // San Francisco
  { name: "TPC Harding Park", city: "San Francisco", region: "San Francisco", holes: 18, golfnow_id: "8276", booking_url: "https://www.golfnow.com/tee-times/facility/8276-tpc-harding-park-golf-club/search", booking_system: "golfnow", base_price: 89 },
  { name: "Lincoln Park Golf Course", city: "San Francisco", region: "San Francisco", holes: 18, golfnow_id: "556", booking_url: "https://www.golfnow.com/tee-times/facility/556-lincoln-park-golf-course/search", booking_system: "golfnow", base_price: 52 },
  { name: "Sharp Park Golf Course", city: "Pacifica", region: "San Francisco", holes: 18, golfnow_id: "619", booking_url: "https://www.golfnow.com/tee-times/facility/619-sharp-park-golf-course/search", booking_system: "golfnow", base_price: 48 },
  { name: "Presidio Golf Course", city: "San Francisco", region: "San Francisco", holes: 18, golfnow_id: "148", booking_url: "https://www.golfnow.com/tee-times/facility/148-presidio-golf-course/search", booking_system: "golfnow", base_price: 165 },
  { name: "Golden Gate Park Golf Course", city: "San Francisco", region: "San Francisco", holes: 9, golfnow_id: null, booking_url: "https://sfrecpark.org/", booking_system: "other", base_price: 24 },

  // South Bay
  { name: "San Jose Municipal Golf Course", city: "San Jose", region: "South Bay", holes: 18, golfnow_id: "614", booking_url: "https://www.golfnow.com/tee-times/facility/614-san-jose-municipal-golf-course/search", booking_system: "golfnow", base_price: 45 },
  { name: "Cinnabar Hills Golf Club", city: "San Jose", region: "South Bay", holes: 27, golfnow_id: "465", booking_url: "https://www.golfnow.com/tee-times/facility/465-cinnabar-hills-golf-club/search", booking_system: "golfnow", base_price: 79 },
  { name: "Los Lagos Golf Course", city: "San Jose", region: "South Bay", holes: 18, golfnow_id: "561", booking_url: "https://www.golfnow.com/tee-times/facility/561-los-lagos-golf-course/search", booking_system: "golfnow", base_price: 42 },
  { name: "Santa Teresa Golf Club", city: "San Jose", region: "South Bay", holes: 18, golfnow_id: "617", booking_url: "https://www.golfnow.com/tee-times/facility/617-santa-teresa-golf-club/search", booking_system: "golfnow", base_price: 65 },
  { name: "Deep Cliff Golf Course", city: "Cupertino", region: "South Bay", holes: 18, golfnow_id: "474", booking_url: "https://www.golfnow.com/tee-times/facility/474-deep-cliff-golf-course/search", booking_system: "golfnow", base_price: 38 },
  { name: "Sunnyvale Golf Course", city: "Sunnyvale", region: "South Bay", holes: 18, golfnow_id: "639", booking_url: "https://www.golfnow.com/tee-times/facility/639-sunnyvale-golf-course/search", booking_system: "golfnow", base_price: 58 },
  { name: "Palo Alto Golf Course", city: "Palo Alto", region: "South Bay", holes: 18, golfnow_id: "586", booking_url: "https://www.golfnow.com/tee-times/facility/586-palo-alto-golf-course/search", booking_system: "golfnow", base_price: 62 },
  { name: "Coyote Creek Golf Club", city: "Morgan Hill", region: "South Bay", holes: 36, golfnow_id: "469", booking_url: "https://www.golfnow.com/tee-times/facility/469-coyote-creek-golf-club/search", booking_system: "golfnow", base_price: 85 },

  // East Bay
  { name: "Corica Park - South Course", city: "Alameda", region: "East Bay", holes: 18, golfnow_id: "8136", booking_url: "https://www.golfnow.com/tee-times/facility/8136-corica-park-south-course/search", booking_system: "golfnow", base_price: 75 },
  { name: "Corica Park - North Course", city: "Alameda", region: "East Bay", holes: 18, golfnow_id: "514", booking_url: "https://www.golfnow.com/tee-times/facility/514-corica-park-north-course/search", booking_system: "golfnow", base_price: 55 },
  { name: "Metropolitan Golf Links", city: "Oakland", region: "East Bay", holes: 18, golfnow_id: "570", booking_url: "https://www.golfnow.com/tee-times/facility/570-metropolitan-golf-links/search", booking_system: "golfnow", base_price: 68 },
  { name: "Lake Chabot Golf Course", city: "Oakland", region: "East Bay", holes: 27, golfnow_id: "549", booking_url: "https://www.golfnow.com/tee-times/facility/549-lake-chabot-golf-course/search", booking_system: "golfnow", base_price: 48 },
  { name: "Tilden Park Golf Course", city: "Berkeley", region: "East Bay", holes: 18, golfnow_id: "649", booking_url: "https://www.golfnow.com/tee-times/facility/649-tilden-park-golf-course/search", booking_system: "golfnow", base_price: 52 },
  { name: "Boundary Oak Golf Course", city: "Walnut Creek", region: "East Bay", holes: 18, golfnow_id: "456", booking_url: "https://www.golfnow.com/tee-times/facility/456-boundary-oak-golf-course/search", booking_system: "golfnow", base_price: 54 },
  { name: "Poppy Ridge Golf Course", city: "Livermore", region: "East Bay", holes: 27, golfnow_id: "593", booking_url: "https://www.golfnow.com/tee-times/facility/593-poppy-ridge-golf-course/search", booking_system: "golfnow", base_price: 72 },
  { name: "Las Positas Golf Course", city: "Livermore", region: "East Bay", holes: 18, golfnow_id: "553", booking_url: "https://www.golfnow.com/tee-times/facility/553-las-positas-golf-course/search", booking_system: "golfnow", base_price: 58 },

  // Marin
  { name: "Peacock Gap Golf Club", city: "San Rafael", region: "Marin", holes: 18, golfnow_id: "588", booking_url: "https://www.golfnow.com/tee-times/facility/588-peacock-gap-golf-club/search", booking_system: "golfnow", base_price: 75 },
  { name: "Indian Valley Golf Club", city: "Novato", region: "Marin", holes: 18, golfnow_id: "538", booking_url: "https://www.golfnow.com/tee-times/facility/538-indian-valley-golf-club/search", booking_system: "golfnow", base_price: 55 },
  { name: "StoneTree Golf Club", city: "Novato", region: "Marin", holes: 18, golfnow_id: "633", booking_url: "https://www.golfnow.com/tee-times/facility/633-stonetree-golf-club/search", booking_system: "golfnow", base_price: 89 },
  { name: "Mill Valley Golf Course", city: "Mill Valley", region: "Marin", holes: 9, golfnow_id: "572", booking_url: "https://www.golfnow.com/tee-times/facility/572-mill-valley-golf-course/search", booking_system: "golfnow", base_price: 32 },
];

// Insert courses
console.log('Seeding courses...');
const insertCourse = db.prepare(`
  INSERT OR REPLACE INTO courses (name, city, region, holes, golfnow_id, booking_url, booking_system)
  VALUES (@name, @city, @region, @holes, @golfnow_id, @booking_url, @booking_system)
`);

const insertManyCourses = db.transaction((courses) => {
  for (const course of courses) {
    insertCourse.run({
      name: course.name,
      city: course.city,
      region: course.region,
      holes: course.holes,
      golfnow_id: course.golfnow_id,
      booking_url: course.booking_url,
      booking_system: course.booking_system
    });
  }
});

insertManyCourses(courses);
console.log(`Seeded ${courses.length} courses`);

// Get all courses from DB to get their IDs
const dbCourses = db.prepare('SELECT * FROM courses').all();
const courseMap = {};
for (const c of dbCourses) {
  courseMap[c.name] = { ...c, base_price: courses.find(x => x.name === c.name)?.base_price || 50 };
}

// Generate tee times for the next 7 days
console.log('Generating demo tee times...');

const insertTeeTime = db.prepare(`
  INSERT OR REPLACE INTO tee_times
  (course_id, date, time, datetime, holes, players, price, original_price, has_cart, booking_url, source, scraped_at)
  VALUES (@course_id, @date, @time, @datetime, @holes, @players, @price, @original_price, @has_cart, @booking_url, @source, datetime('now'))
`);

function generateTeeTimes() {
  const teeTimes = [];
  const today = new Date();

  for (const [courseName, course] of Object.entries(courseMap)) {
    // Skip courses without golfnow_id for demo
    if (!course.golfnow_id) continue;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split('T')[0];

      // Is it a weekend?
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const priceMultiplier = isWeekend ? 1.3 : 1.0;

      // Generate tee times from 6:00 AM to 5:00 PM
      const startHour = 6;
      const endHour = 17;

      for (let hour = startHour; hour <= endHour; hour++) {
        // Random number of tee times per hour (0-4)
        const timesThisHour = Math.floor(Math.random() * 4);

        for (let i = 0; i < timesThisHour; i++) {
          const minutes = Math.floor(Math.random() * 6) * 10; // 0, 10, 20, 30, 40, 50
          const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

          // Calculate price with some variation
          let price = course.base_price * priceMultiplier;
          const hasDiscount = Math.random() < 0.2; // 20% chance of discount
          const originalPrice = hasDiscount ? price : null;
          if (hasDiscount) {
            price = price * (0.7 + Math.random() * 0.2); // 10-30% off
          }

          // Add time-based pricing (twilight is cheaper)
          if (hour >= 14) {
            price = price * 0.8; // Twilight discount
          }

          // Round price
          price = Math.round(price);

          const hasCart = Math.random() < 0.5;
          const players = Math.random() < 0.7 ? 4 : (Math.random() < 0.5 ? 3 : 2);

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
            source: 'demo'
          });
        }
      }
    }
  }

  return teeTimes;
}

const teeTimes = generateTeeTimes();

const insertManyTeeTimes = db.transaction((teeTimes) => {
  for (const tt of teeTimes) {
    try {
      insertTeeTime.run(tt);
    } catch (e) {
      // Ignore duplicates
    }
  }
});

insertManyTeeTimes(teeTimes);
console.log(`Generated ${teeTimes.length} demo tee times`);

// Show summary
const summary = db.prepare(`
  SELECT
    COUNT(*) as total,
    COUNT(DISTINCT course_id) as courses,
    COUNT(DISTINCT date) as days,
    MIN(price) as min_price,
    MAX(price) as max_price
  FROM tee_times
`).get();

console.log('\nSummary:');
console.log(`  Total tee times: ${summary.total}`);
console.log(`  Courses: ${summary.courses}`);
console.log(`  Days: ${summary.days}`);
console.log(`  Price range: $${summary.min_price} - $${summary.max_price}`);

console.log('\nDemo data generation complete!');
console.log('Run `npm start` to start the server.');
