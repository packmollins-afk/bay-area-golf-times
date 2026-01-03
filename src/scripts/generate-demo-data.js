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

  CREATE INDEX IF NOT EXISTS idx_tee_times_datetime ON tee_times(datetime);
  CREATE INDEX IF NOT EXISTS idx_tee_times_date ON tee_times(date);
  CREATE INDEX IF NOT EXISTS idx_tee_times_course ON tee_times(course_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id);
  CREATE INDEX IF NOT EXISTS idx_photos_course ON course_photos(course_id);
  CREATE INDEX IF NOT EXISTS idx_food_course ON food_items(course_id);
`);

// Course data with extended info - booking URLs point to each course's own website
const courses = [
  // San Francisco
  { name: "TPC Harding Park", city: "San Francisco", region: "San Francisco", holes: 18, par: 72, yardage: 7169, slope_rating: 139, course_rating: 75.2, golfnow_id: "8276", booking_url: "https://tpc.com/hardingpark/tee-times/", website_url: "https://tpc.com/hardingpark/", booking_system: "course", latitude: 37.7231, longitude: -122.4784, avg_rating: 4.5, total_reviews: 1247, course_record_score: 61, course_record_holder: "Tiger Woods", course_record_date: "2005", course_record_details: "Shot during WGC-American Express Championship practice round", phone_number: "(415) 664-4690", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 89, photo_url: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800" },
  { name: "Lincoln Park Golf Course", city: "San Francisco", region: "San Francisco", holes: 18, par: 68, yardage: 5181, slope_rating: 113, course_rating: 65.1, golfnow_id: "556", booking_url: "http://www.lincolnparkgolfcourse.com/rates.html", website_url: "http://www.lincolnparkgolfcourse.com/", booking_system: "course", latitude: 37.7873, longitude: -122.4932, avg_rating: 4.3, total_reviews: 892, course_record_score: 58, course_record_holder: "Ken Venturi", course_record_date: "1956", course_record_details: "Local legend and US Open champion", phone_number: "(415) 221-9911", has_driving_range: 0, has_practice_green: 1, has_pro_shop: 1, base_price: 52, photo_url: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800" },
  { name: "Sharp Park Golf Course", city: "Pacifica", region: "San Francisco", holes: 18, par: 72, yardage: 6274, slope_rating: 120, course_rating: 70.1, golfnow_id: "619", booking_url: "https://sfrecpark.org/1384/Rates-and-Tee-Times", website_url: "https://sfrecpark.org/facilities/facility/details/Sharp-Park-Golf-Course-42", booking_system: "course", latitude: 37.6183, longitude: -122.4893, avg_rating: 4.1, total_reviews: 654, course_record_score: 62, course_record_holder: "Mark Lye", course_record_date: "1978", course_record_details: "Alister MacKenzie designed links course", phone_number: "(650) 359-3380", has_driving_range: 0, has_practice_green: 1, has_pro_shop: 1, base_price: 48, photo_url: "https://images.unsplash.com/photo-1592919505780-303950717480?w=800" },
  { name: "Presidio Golf Course", city: "San Francisco", region: "San Francisco", holes: 18, par: 72, yardage: 6449, slope_rating: 136, course_rating: 71.7, golfnow_id: "148", booking_url: "https://www.presidiogolf.com/tee-times/", website_url: "https://www.presidiogolf.com/", booking_system: "course", latitude: 37.7912, longitude: -122.4634, avg_rating: 4.4, total_reviews: 1089, course_record_score: 63, course_record_holder: "Johnny Miller", course_record_date: "1971", course_record_details: "Historic course founded in 1895", phone_number: "(415) 561-4661", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 165, photo_url: "https://images.unsplash.com/photo-1600928796590-d0393bce4d08?w=800" },
  { name: "Golden Gate Park Golf Course", city: "San Francisco", region: "San Francisco", holes: 9, par: 27, yardage: 1357, slope_rating: 84, course_rating: 54.2, golfnow_id: null, booking_url: "https://www.goldengateparkgolf.com/tee-times/", website_url: "https://www.goldengateparkgolf.com/", booking_system: "course", latitude: 37.7694, longitude: -122.4862, avg_rating: 4.0, total_reviews: 234, course_record_score: 24, course_record_holder: "Mike Davis", course_record_date: "2019", course_record_details: "Executive 9-hole course", phone_number: "(415) 751-8987", has_driving_range: 0, has_practice_green: 1, has_pro_shop: 0, base_price: 24, photo_url: "https://images.unsplash.com/photo-1611374243147-44a702c2d44c?w=800" },

  // South Bay
  { name: "San Jose Municipal Golf Course", city: "San Jose", region: "South Bay", holes: 18, par: 72, yardage: 6717, slope_rating: 123, course_rating: 72.0, golfnow_id: "614", booking_url: "https://www.sanjoseca.gov/your-government/departments-offices/parks-recreation-neighborhood-services/outdoor-activities/golf", website_url: "https://www.sanjoseca.gov/your-government/departments-offices/parks-recreation-neighborhood-services/outdoor-activities/golf", booking_system: "course", latitude: 37.3894, longitude: -121.8892, avg_rating: 4.0, total_reviews: 567, course_record_score: 63, course_record_holder: "Bob Tway", course_record_date: "1985", course_record_details: "William P. Bell design from 1968", phone_number: "(408) 441-4653", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 45, photo_url: "https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=800" },
  { name: "Cinnabar Hills Golf Club", city: "San Jose", region: "South Bay", holes: 27, par: 72, yardage: 6859, slope_rating: 133, course_rating: 73.1, golfnow_id: "465", booking_url: "https://www.cinnabarhills.com/tee-times/", website_url: "https://www.cinnabarhills.com/", booking_system: "course", latitude: 37.2431, longitude: -121.7842, avg_rating: 4.6, total_reviews: 1456, course_record_score: 64, course_record_holder: "Charlie Wi", course_record_date: "2003", course_record_details: "John Harbottle III design, 27 holes", phone_number: "(408) 323-5200", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 79, photo_url: "https://images.unsplash.com/photo-1596727362302-b8d891c42ab8?w=800" },
  { name: "Santa Teresa Golf Club", city: "San Jose", region: "South Bay", holes: 18, par: 71, yardage: 6738, slope_rating: 128, course_rating: 72.3, golfnow_id: "617", booking_url: "https://www.playstgc.com/tee-times/", website_url: "https://www.playstgc.com/", booking_system: "course", latitude: 37.2156, longitude: -121.7912, avg_rating: 4.2, total_reviews: 723, course_record_score: 62, course_record_holder: "Scott Simpson", course_record_date: "1982", course_record_details: "George Santana design in foothills", phone_number: "(408) 225-2650", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 65, photo_url: "https://images.unsplash.com/photo-1580156872433-95adc8dd3783?w=800" },
  { name: "Palo Alto Golf Course", city: "Palo Alto", region: "South Bay", holes: 18, par: 72, yardage: 6727, slope_rating: 126, course_rating: 72.4, golfnow_id: "586", booking_url: "https://www.baylandsgolflinks.com/tee-times/", website_url: "https://www.baylandsgolflinks.com/", booking_system: "course", latitude: 37.4419, longitude: -122.1430, avg_rating: 4.1, total_reviews: 445, course_record_score: 64, course_record_holder: "Tom Watson", course_record_date: "1970", course_record_details: "While attending Stanford nearby", phone_number: "(650) 856-0881", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 62, photo_url: "https://images.unsplash.com/photo-1609861933606-8eab76a7d96c?w=800" },
  { name: "Deep Cliff Golf Course", city: "Cupertino", region: "South Bay", holes: 18, par: 60, yardage: 3017, slope_rating: 92, course_rating: 56.8, golfnow_id: "474", booking_url: "https://www.deepcliffgolf.com/tee-times/", website_url: "https://www.deepcliffgolf.com/", booking_system: "course", latitude: 37.3228, longitude: -122.0441, avg_rating: 4.0, total_reviews: 389, course_record_score: 50, course_record_holder: "Lee Janzen", course_record_date: "1995", course_record_details: "Executive course since 1961", phone_number: "(408) 253-5357", has_driving_range: 0, has_practice_green: 1, has_pro_shop: 1, base_price: 38, photo_url: "https://images.unsplash.com/photo-1622396636133-aea830a1a0d8?w=800" },

  // East Bay
  { name: "Corica Park - South Course", city: "Alameda", region: "East Bay", holes: 18, par: 71, yardage: 6874, slope_rating: 127, course_rating: 72.8, golfnow_id: "8136", foreup_id: "22822", booking_url: "https://www.coricapark.com/tee-times/", website_url: "https://www.coricapark.com/", booking_system: "course", latitude: 37.7374, longitude: -122.2477, avg_rating: 4.7, total_reviews: 2134, course_record_score: 63, course_record_holder: "Collin Morikawa", course_record_date: "2018", course_record_details: "Rees Jones redesign 2018, sandbelt style", phone_number: "(510) 747-7800", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 75, photo_url: "https://images.unsplash.com/photo-1632339786027-33252be06ed2?w=800" },
  { name: "Corica Park - North Course", city: "Alameda", region: "East Bay", holes: 18, par: 70, yardage: 6017, slope_rating: 118, course_rating: 68.9, golfnow_id: "514", foreup_id: "22822", booking_url: "https://www.coricapark.com/tee-times/", website_url: "https://www.coricapark.com/", booking_system: "course", latitude: 37.7381, longitude: -122.2489, avg_rating: 4.3, total_reviews: 987, course_record_score: 61, course_record_holder: "Tony Lema", course_record_date: "1963", course_record_details: "Classic layout, more forgiving than South", phone_number: "(510) 747-7800", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 55, photo_url: "https://images.unsplash.com/photo-1595841055997-96bc57f8b7cf?w=800" },
  { name: "Metropolitan Golf Links", city: "Oakland", region: "East Bay", holes: 18, par: 72, yardage: 6959, slope_rating: 130, course_rating: 73.4, golfnow_id: "570", booking_url: "https://www.playmetro.com/tee-times/", website_url: "https://www.playmetro.com/", booking_system: "course", latitude: 37.7284, longitude: -122.2089, avg_rating: 4.2, total_reviews: 856, course_record_score: 64, course_record_holder: "Fred Bliss", course_record_date: "2001", course_record_details: "Johnny Miller design near Oakland Airport", phone_number: "(510) 569-5555", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 68, photo_url: "https://images.unsplash.com/photo-1560420025-9453f02b4751?w=800" },
  { name: "Tilden Park Golf Course", city: "Berkeley", region: "East Bay", holes: 18, par: 70, yardage: 6298, slope_rating: 125, course_rating: 70.2, golfnow_id: "649", booking_url: "https://tildenparkgc.com/tee-times/", website_url: "https://tildenparkgc.com/", booking_system: "course", latitude: 37.8921, longitude: -122.2489, avg_rating: 4.4, total_reviews: 1234, course_record_score: 60, course_record_holder: "Ken Venturi", course_record_date: "1958", course_record_details: "Stunning Bay views from elevated 16th tee", phone_number: "(510) 848-7373", has_driving_range: 0, has_practice_green: 1, has_pro_shop: 1, base_price: 52, photo_url: "https://images.unsplash.com/photo-1558369178-6556d97855d0?w=800" },
  { name: "Boundary Oak Golf Course", city: "Walnut Creek", region: "East Bay", holes: 18, par: 72, yardage: 7043, slope_rating: 134, course_rating: 73.8, golfnow_id: "456", booking_url: "https://www.playboundaryoak.com/tee-times/", website_url: "https://www.playboundaryoak.com/", booking_system: "course", latitude: 37.9012, longitude: -122.0634, avg_rating: 4.3, total_reviews: 945, course_record_score: 63, course_record_holder: "Rich Beem", course_record_date: "1999", course_record_details: "Robert Muir Graves design with oak-lined fairways", phone_number: "(925) 934-6211", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 54, photo_url: "https://images.unsplash.com/photo-1633683914504-43a0e977cf22?w=800" },
  { name: "Poppy Ridge Golf Course", city: "Livermore", region: "East Bay", holes: 27, par: 72, yardage: 7100, slope_rating: 135, course_rating: 74.2, golfnow_id: "593", booking_url: "https://poppyridgegolf.ncga.org/tee-times/", website_url: "https://poppyridgegolf.ncga.org/", booking_system: "course", latitude: 37.6512, longitude: -121.8134, avg_rating: 4.5, total_reviews: 1567, course_record_score: 64, course_record_holder: "Cameron Champ", course_record_date: "2016", course_record_details: "Rees Jones design in wine country, 27 holes", phone_number: "(925) 456-8202", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 72, photo_url: "https://images.unsplash.com/photo-1610991148581-6f8a6a0f1c7b?w=800" },

  // North Bay
  { name: "Peacock Gap Golf Club", city: "San Rafael", region: "North Bay", holes: 18, par: 71, yardage: 6261, slope_rating: 120, course_rating: 69.8, golfnow_id: "588", booking_url: "https://www.peacockgapgolfclub.com/tee-times/", website_url: "https://www.peacockgapgolfclub.com/", booking_system: "course", latitude: 37.9789, longitude: -122.4912, avg_rating: 4.2, total_reviews: 678, course_record_score: 61, course_record_holder: "George Archer", course_record_date: "1975", course_record_details: "William F. Bell design, renovated 2000s", phone_number: "(415) 453-4940", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 75, photo_url: "https://images.unsplash.com/photo-1599224943918-f1e55f24fb50?w=800" },
  { name: "Indian Valley Golf Club", city: "Novato", region: "North Bay", holes: 18, par: 72, yardage: 6374, slope_rating: 123, course_rating: 70.4, golfnow_id: "538", booking_url: "https://www.ivgc.com/tee-times/", website_url: "https://www.ivgc.com/", booking_system: "course", latitude: 38.0789, longitude: -122.5712, avg_rating: 4.1, total_reviews: 534, course_record_score: 62, course_record_holder: "Johnny Miller", course_record_date: "1968", course_record_details: "Hidden gem with unique elevator between holes", phone_number: "(415) 897-1118", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 55, photo_url: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800" },
  { name: "StoneTree Golf Club", city: "Novato", region: "North Bay", holes: 18, par: 72, yardage: 6898, slope_rating: 133, course_rating: 72.9, golfnow_id: "633", booking_url: "https://www.bayclubs.com/clubs/stonetree/golf/", website_url: "https://www.bayclubs.com/clubs/stonetree", booking_system: "course", latitude: 38.1234, longitude: -122.5423, avg_rating: 4.4, total_reviews: 892, course_record_score: 64, course_record_holder: "Maverick McNealy", course_record_date: "2015", course_record_details: "Premium course with stunning wetland views", phone_number: "(415) 209-6090", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 89, photo_url: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800" },
  { name: "Mill Valley Golf Course", city: "Mill Valley", region: "North Bay", holes: 9, par: 28, yardage: 1519, slope_rating: 88, course_rating: 55.6, golfnow_id: "572", booking_url: "https://www.cityofmillvalley.org/departments/recreation", website_url: "https://www.cityofmillvalley.org/departments/recreation", booking_system: "course", latitude: 37.9056, longitude: -122.5412, avg_rating: 4.3, total_reviews: 312, course_record_score: 23, course_record_holder: "Unknown Local", course_record_date: "2020", course_record_details: "Alister MacKenzie design among redwoods", phone_number: "(415) 388-9982", has_driving_range: 0, has_practice_green: 1, has_pro_shop: 0, base_price: 32, photo_url: "https://images.unsplash.com/photo-1629039853896-a42c7b9db76f?w=800" },
  { name: "TPC Harding Park - Fleming 9", city: "San Francisco", region: "San Francisco", holes: 9, par: 32, yardage: 2232, slope_rating: 102, course_rating: 60.4, golfnow_id: "8277", booking_url: "https://tpc.com/hardingpark/tee-times/", website_url: "https://tpc.com/hardingpark/golf/", booking_system: "course", latitude: 37.7235, longitude: -122.4790, avg_rating: 4.2, total_reviews: 456, course_record_score: 27, course_record_holder: "Casey Martin", course_record_date: "2010", course_record_details: "Executive 9-hole course adjacent to main TPC layout", phone_number: "(415) 664-4690", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 42, photo_url: "https://images.unsplash.com/photo-1535132011086-b8818f016104?w=800" },
  { name: "Crystal Springs Golf Course", city: "Burlingame", region: "North Bay", holes: 18, par: 72, yardage: 6634, slope_rating: 131, course_rating: 72.1, golfnow_id: "471", booking_url: "https://www.playcrystalsprings.com/tee-times/", website_url: "https://www.playcrystalsprings.com/", booking_system: "course", latitude: 37.5168, longitude: -122.3652, avg_rating: 4.4, total_reviews: 1123, course_record_score: 63, course_record_holder: "Bobby Clampett", course_record_date: "1982", course_record_details: "Stunning views of Crystal Springs Reservoir", phone_number: "(650) 342-0603", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 85, photo_url: "https://images.unsplash.com/photo-1600928796590-d0393bce4d08?w=800" },
  { name: "Half Moon Bay - Old Course", city: "Half Moon Bay", region: "North Bay", holes: 18, par: 72, yardage: 7014, slope_rating: 134, course_rating: 73.8, golfnow_id: "509", booking_url: "https://halfmoonbaygolf.com/golf/tee-times/", website_url: "https://halfmoonbaygolf.com/", booking_system: "course", latitude: 37.4285, longitude: -122.4438, avg_rating: 4.6, total_reviews: 1876, course_record_score: 64, course_record_holder: "Tom Kite", course_record_date: "1995", course_record_details: "Arnold Palmer design with Pacific Ocean views", phone_number: "(650) 726-1800", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 175, photo_url: "https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=800" },
  { name: "Half Moon Bay - Ocean Course", city: "Half Moon Bay", region: "North Bay", holes: 18, par: 72, yardage: 6732, slope_rating: 132, course_rating: 72.6, golfnow_id: "510", booking_url: "https://halfmoonbaygolf.com/golf/tee-times/", website_url: "https://halfmoonbaygolf.com/", booking_system: "course", latitude: 37.4279, longitude: -122.4452, avg_rating: 4.7, total_reviews: 2341, course_record_score: 65, course_record_holder: "Phil Mickelson", course_record_date: "2001", course_record_details: "Arthur Hills design, dramatic cliffside finishing holes", phone_number: "(650) 726-1800", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 195, photo_url: "https://images.unsplash.com/photo-1592919505780-303950717480?w=800" },

  // New courses
  { name: "The Links at Bodega Harbour", city: "Bodega Bay", region: "North Bay", holes: 18, par: 70, yardage: 6275, slope_rating: 127, course_rating: 71.4, golfnow_id: "149", booking_url: "https://www.golfnow.com/tee-times/facility/149-the-links-at-bodega-harbour/search", website_url: "https://www.bodegaharbourgolf.com/", booking_system: "golfnow", latitude: 38.3293, longitude: -123.0352, avg_rating: 4.5, total_reviews: 687, course_record_score: 65, course_record_holder: "Johnny Miller", course_record_date: "1992", course_record_details: "Robert Trent Jones Jr design with Pacific Ocean views from every hole", phone_number: "(707) 875-3538", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 85, photo_url: "https://www.bodegaharbourgolf.com/images/slideshows/The-Links-At-Bodega-Harbour_Home-Homepage-Carousel_July-2023-The-Links-At-Bodega-Harbour-Home-Homepage-Carousel_July-2023-Homepage-Slideshow-Banner-NEW-Background-Image-1.jpg" },
  { name: "Northwood Golf Club", city: "Monte Rio", region: "North Bay", holes: 9, par: 36, yardage: 2893, slope_rating: 115, course_rating: 34.4, golfnow_id: null, booking_url: "https://www.northwoodgolf.com/", website_url: "https://www.northwoodgolf.com/", booking_system: "course", latitude: 38.4673, longitude: -123.0089, avg_rating: 4.6, total_reviews: 523, course_record_score: 30, course_record_holder: "Jack Burke Jr", course_record_date: "1956", course_record_details: "Alister MacKenzie's only 9-hole design in America, set among majestic redwoods", phone_number: "(707) 865-1116", has_driving_range: 0, has_practice_green: 1, has_pro_shop: 1, base_price: 55, photo_url: "https://www.northwoodgolf.com/images/slideshows/banner_3-northwoodGC.jpg" },
  { name: "Pasatiempo Golf Club", city: "Santa Cruz", region: "South Bay", holes: 18, par: 70, yardage: 6439, slope_rating: 139, course_rating: 72.6, golfnow_id: null, booking_url: "https://www.pasatiempo.com/tee-times/", website_url: "https://www.pasatiempo.com/", booking_system: "course", latitude: 37.0012, longitude: -122.0234, avg_rating: 4.8, total_reviews: 2145, course_record_score: 62, course_record_holder: "Ken Venturi", course_record_date: "1961", course_record_details: "Alister MacKenzie's personal favorite design, his home bordered the 6th fairway", phone_number: "(831) 459-9155", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 295, photo_url: "https://www.pasatiempo.com/images/galleries/current/hole-16.jpg" },
  { name: "Diablo Creek Golf Course", city: "Concord", region: "East Bay", holes: 18, par: 71, yardage: 6830, slope_rating: 123, course_rating: 72.4, golfnow_id: "1448", booking_url: "https://www.golfnow.com/tee-times/facility/1448-diablo-creek-golf-course/search", website_url: "https://www.diablocreekgc.com/", booking_system: "golfnow", latitude: 37.9912, longitude: -122.0134, avg_rating: 4.1, total_reviews: 876, course_record_score: 63, course_record_holder: "Scott McCarron", course_record_date: "1998", course_record_details: "Bob E. Baldock design from 1963, renovated by Robert Muir Graves in 1990", phone_number: "(925) 686-6262", has_driving_range: 1, has_practice_green: 1, has_pro_shop: 1, base_price: 52, photo_url: "https://www.diablocreekgc.com/images/slideshows/banner_1.jpg" },
];

// Sample review texts
const reviewTexts = [
  { rating: 5, text: "Absolutely stunning course! The greens were in perfect condition and the views are incredible. Will definitely be back." },
  { rating: 5, text: "Best public course in the Bay Area. Staff was super friendly and the pace of play was great." },
  { rating: 4, text: "Great layout and well maintained. A bit pricey but worth it for the quality. The clubhouse food is also really good." },
  { rating: 4, text: "Solid course with challenging holes. The back nine is especially scenic. Hamburger at the turn was excellent!" },
  { rating: 5, text: "Played here for a work outing and everyone loved it. Course conditions were top notch." },
  { rating: 3, text: "Course is good but was pretty crowded. Had to wait on almost every hole. The hot dog was surprisingly good though." },
  { rating: 4, text: "Nice course in a beautiful setting. Pro shop staff was helpful and the practice facilities are solid." },
  { rating: 5, text: "My new favorite course! The redesign is fantastic. Grabbed breakfast burrito before the round - highly recommend." },
  { rating: 4, text: "Well maintained fairways and fast greens. Cart paths could use some work but overall great experience." },
  { rating: 3, text: "Decent muni course. Nothing special but fair price. The fish tacos at the grill are actually really tasty." },
  { rating: 5, text: "Championship quality at a public course price. Tiger played here and I can see why. Try the tri-tip sandwich!" },
  { rating: 4, text: "Great value for the area. Course is in good shape and the layout is fun. Clam chowder is a must-try." },
];

// Sample food items
const foodItems = [
  { name: "Tri-Tip Sandwich", description: "House-smoked tri-tip with caramelized onions and horseradish aioli", avg_rating: 4.8 },
  { name: "Breakfast Burrito", description: "Scrambled eggs, chorizo, cheese, and pico de gallo", avg_rating: 4.7 },
  { name: "Fish Tacos", description: "Beer-battered cod with cabbage slaw and chipotle crema", avg_rating: 4.6 },
  { name: "Classic Burger", description: "1/2 lb Angus beef with all the fixings", avg_rating: 4.5 },
  { name: "Clam Chowder", description: "New England style in a sourdough bread bowl", avg_rating: 4.7 },
  { name: "BBQ Pulled Pork", description: "Slow-cooked pork with house BBQ sauce on brioche", avg_rating: 4.6 },
  { name: "Cobb Salad", description: "Grilled chicken, bacon, avocado, blue cheese", avg_rating: 4.4 },
  { name: "Hot Dog", description: "All-beef dog with your choice of toppings", avg_rating: 4.2 },
  { name: "Chicken Wings", description: "Crispy wings with buffalo or teriyaki sauce", avg_rating: 4.5 },
  { name: "Nachos Grande", description: "Loaded with beef, cheese, jalapeños, guac", avg_rating: 4.4 },
];

// Sample author names
const authorNames = [
  "Mike Johnson", "Sarah Chen", "David Williams", "Jennifer Lopez", "Robert Kim",
  "Emily Davis", "James Wilson", "Lisa Park", "Michael Brown", "Amanda Taylor",
  "Chris Martinez", "Nicole Anderson", "Kevin Lee", "Rachel Garcia", "Brian Thompson"
];

// Insert courses
console.log('Seeding courses...');
const insertCourse = db.prepare(`
  INSERT OR REPLACE INTO courses (name, city, region, holes, par, yardage, slope_rating, course_rating, golfnow_id, foreup_id, booking_url, website_url, booking_system, latitude, longitude, avg_rating, total_reviews, course_record_score, course_record_holder, course_record_date, course_record_details, phone_number, has_driving_range, has_practice_green, has_pro_shop, photo_url)
  VALUES (@name, @city, @region, @holes, @par, @yardage, @slope_rating, @course_rating, @golfnow_id, @foreup_id, @booking_url, @website_url, @booking_system, @latitude, @longitude, @avg_rating, @total_reviews, @course_record_score, @course_record_holder, @course_record_date, @course_record_details, @phone_number, @has_driving_range, @has_practice_green, @has_pro_shop, @photo_url)
`);

const insertManyCourses = db.transaction((courses) => {
  for (const course of courses) {
    insertCourse.run({
      name: course.name,
      city: course.city,
      region: course.region,
      holes: course.holes,
      par: course.par || null,
      yardage: course.yardage || null,
      slope_rating: course.slope_rating || null,
      course_rating: course.course_rating || null,
      golfnow_id: course.golfnow_id || null,
      foreup_id: course.foreup_id || null,
      booking_url: course.booking_url,
      website_url: course.website_url || null,
      booking_system: course.booking_system,
      latitude: course.latitude || null,
      longitude: course.longitude || null,
      avg_rating: course.avg_rating || null,
      total_reviews: course.total_reviews || 0,
      course_record_score: course.course_record_score || null,
      course_record_holder: course.course_record_holder || null,
      course_record_date: course.course_record_date || null,
      course_record_details: course.course_record_details || null,
      phone_number: course.phone_number || null,
      has_driving_range: course.has_driving_range || 0,
      has_practice_green: course.has_practice_green || 0,
      has_pro_shop: course.has_pro_shop || 0,
      photo_url: course.photo_url || null
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

// Generate reviews for each course
console.log('Generating reviews...');
const insertReview = db.prepare(`
  INSERT INTO reviews (course_id, author_name, rating, text, time, relative_time, source)
  VALUES (@course_id, @author_name, @rating, @text, @time, @relative_time, @source)
`);

const now = Math.floor(Date.now() / 1000);

for (const [courseName, course] of Object.entries(courseMap)) {
  // Generate 10-15 reviews per course
  const numReviews = 10 + Math.floor(Math.random() * 6);

  for (let i = 0; i < numReviews; i++) {
    const review = reviewTexts[Math.floor(Math.random() * reviewTexts.length)];
    const daysAgo = Math.floor(Math.random() * 180); // Within last 6 months
    const timeStamp = now - (daysAgo * 24 * 60 * 60);

    insertReview.run({
      course_id: course.id,
      author_name: authorNames[Math.floor(Math.random() * authorNames.length)],
      rating: review.rating,
      text: review.text,
      time: timeStamp,
      relative_time: daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`,
      source: 'google'
    });
  }
}
console.log('Generated reviews for all courses');

// Generate photos for each course
console.log('Generating course photos...');
const insertPhoto = db.prepare(`
  INSERT INTO course_photos (course_id, url, caption, photo_type, year_taken, source, is_primary)
  VALUES (@course_id, @url, @caption, @photo_type, @year_taken, @source, @is_primary)
`);

const photoTypes = ['aerial', 'fairway', 'green', 'clubhouse', 'scenic'];
const photoCaptions = [
  'Signature hole with stunning views',
  'Aerial view of the course layout',
  'The challenging 18th green',
  'Beautiful morning on the first tee',
  'Clubhouse and practice green',
  'Rolling fairways through oak trees',
  'Ocean views from the back nine',
  'Fall colors on the course'
];

for (const [courseName, course] of Object.entries(courseMap)) {
  // Generate 3-5 photos per course
  const numPhotos = 3 + Math.floor(Math.random() * 3);

  for (let i = 0; i < numPhotos; i++) {
    const photoType = photoTypes[Math.floor(Math.random() * photoTypes.length)];
    const yearTaken = 2020 + Math.floor(Math.random() * 5); // 2020-2024

    insertPhoto.run({
      course_id: course.id,
      url: `https://picsum.photos/seed/${course.id}-${i}/800/500`,
      caption: photoCaptions[Math.floor(Math.random() * photoCaptions.length)],
      photo_type: photoType,
      year_taken: yearTaken,
      source: 'website',
      is_primary: i === 0 ? 1 : 0
    });
  }
}
console.log('Generated photos for all courses');

// Generate food items for each course
console.log('Generating food items...');
const insertFood = db.prepare(`
  INSERT INTO food_items (course_id, name, description, avg_rating, mention_count, photo_url, source)
  VALUES (@course_id, @name, @description, @avg_rating, @mention_count, @photo_url, @source)
`);

for (const [courseName, course] of Object.entries(courseMap)) {
  // Pick 2-4 food items per course
  const numItems = 2 + Math.floor(Math.random() * 3);
  const shuffled = [...foodItems].sort(() => Math.random() - 0.5);

  for (let i = 0; i < numItems; i++) {
    const food = shuffled[i];
    insertFood.run({
      course_id: course.id,
      name: food.name,
      description: food.description,
      avg_rating: food.avg_rating + (Math.random() * 0.4 - 0.2), // Add some variance
      mention_count: 5 + Math.floor(Math.random() * 20),
      photo_url: `https://picsum.photos/seed/food-${course.id}-${i}/400/300`,
      source: 'reviews'
    });
  }
}
console.log('Generated food items for all courses');

// Generate tee times
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
    // Generate tee times for all courses (not just those with golfnow_id)
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split('T')[0];

      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const priceMultiplier = isWeekend ? 1.3 : 1.0;

      const startHour = 6;
      const endHour = 17;

      for (let hour = startHour; hour <= endHour; hour++) {
        const timesThisHour = Math.floor(Math.random() * 4);

        for (let i = 0; i < timesThisHour; i++) {
          const minutes = Math.floor(Math.random() * 6) * 10;
          const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

          let price = course.base_price * priceMultiplier;
          const hasDiscount = Math.random() < 0.2;
          const originalPrice = hasDiscount ? price : null;
          if (hasDiscount) {
            price = price * (0.7 + Math.random() * 0.2);
          }

          if (hour >= 14) {
            price = price * 0.8;
          }

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

const reviewCount = db.prepare('SELECT COUNT(*) as count FROM reviews').get();
const photoCount = db.prepare('SELECT COUNT(*) as count FROM course_photos').get();
const foodCount = db.prepare('SELECT COUNT(*) as count FROM food_items').get();

console.log('\nSummary:');
console.log(`  Courses: ${Object.keys(courseMap).length}`);
console.log(`  Tee times: ${summary.total}`);
console.log(`  Reviews: ${reviewCount.count}`);
console.log(`  Photos: ${photoCount.count}`);
console.log(`  Food items: ${foodCount.count}`);
console.log(`  Price range: $${summary.min_price} - $${summary.max_price}`);

console.log('\nDemo data generation complete!');
console.log('Run `npm start` to start the server.');
