const db = require('./schema');

// Bay Area Public Golf Courses
const courses = [
  // San Francisco
  { name: "TPC Harding Park", city: "San Francisco", region: "San Francisco", holes: 18, golfnow_id: "8276", booking_url: "https://www.golfnow.com/tee-times/facility/8276-tpc-harding-park-golf-club/search", booking_system: "golfnow" },
  { name: "Lincoln Park Golf Course", city: "San Francisco", region: "San Francisco", holes: 18, golfnow_id: "556", booking_url: "https://www.golfnow.com/tee-times/facility/556-lincoln-park-golf-course/search", booking_system: "golfnow" },
  { name: "Sharp Park Golf Course", city: "Pacifica", region: "San Francisco", holes: 18, golfnow_id: "619", booking_url: "https://www.golfnow.com/tee-times/facility/619-sharp-park-golf-course/search", booking_system: "golfnow" },
  { name: "Presidio Golf Course", city: "San Francisco", region: "San Francisco", holes: 18, golfnow_id: "148", booking_url: "https://www.golfnow.com/tee-times/facility/148-presidio-golf-course/search", booking_system: "golfnow" },
  { name: "Golden Gate Park Golf Course", city: "San Francisco", region: "San Francisco", holes: 9, golfnow_id: null, booking_url: "https://sfrecpark.org/", booking_system: "other" },
  { name: "Fleming Golf Course", city: "San Francisco", region: "San Francisco", holes: 9, golfnow_id: null, booking_url: "https://sfrecpark.org/", booking_system: "other" },

  // South Bay - Santa Clara County
  { name: "San Jose Municipal Golf Course", city: "San Jose", region: "South Bay", holes: 18, golfnow_id: "614", booking_url: "https://www.golfnow.com/tee-times/facility/614-san-jose-municipal-golf-course/search", booking_system: "golfnow" },
  { name: "Cinnabar Hills Golf Club", city: "San Jose", region: "South Bay", holes: 27, golfnow_id: "465", booking_url: "https://www.golfnow.com/tee-times/facility/465-cinnabar-hills-golf-club/search", booking_system: "golfnow" },
  { name: "Los Lagos Golf Course", city: "San Jose", region: "South Bay", holes: 18, golfnow_id: "561", booking_url: "https://www.golfnow.com/tee-times/facility/561-los-lagos-golf-course/search", booking_system: "golfnow" },
  { name: "Santa Teresa Golf Club", city: "San Jose", region: "South Bay", holes: 18, golfnow_id: "617", booking_url: "https://www.golfnow.com/tee-times/facility/617-santa-teresa-golf-club/search", booking_system: "golfnow" },
  { name: "Boulder Ridge Golf Club", city: "San Jose", region: "South Bay", holes: 18, golfnow_id: "8267", booking_url: "https://www.golfnow.com/tee-times/facility/8267-boulder-ridge-golf-club/search", booking_system: "golfnow" },
  { name: "Pruneridge Golf Club", city: "Santa Clara", region: "South Bay", holes: 9, golfnow_id: "596", booking_url: "https://www.golfnow.com/tee-times/facility/596-pruneridge-golf-club/search", booking_system: "golfnow" },
  { name: "Deep Cliff Golf Course", city: "Cupertino", region: "South Bay", holes: 18, golfnow_id: "474", booking_url: "https://www.golfnow.com/tee-times/facility/474-deep-cliff-golf-course/search", booking_system: "golfnow" },
  { name: "Sunnyvale Golf Course", city: "Sunnyvale", region: "South Bay", holes: 18, golfnow_id: "639", booking_url: "https://www.golfnow.com/tee-times/facility/639-sunnyvale-golf-course/search", booking_system: "golfnow" },
  { name: "Sunken Gardens Golf Course", city: "Sunnyvale", region: "South Bay", holes: 9, golfnow_id: "638", booking_url: "https://www.golfnow.com/tee-times/facility/638-sunken-gardens-golf-course/search", booking_system: "golfnow" },
  { name: "Spring Valley Golf Course", city: "Milpitas", region: "South Bay", holes: 18, golfnow_id: "630", booking_url: "https://www.golfnow.com/tee-times/facility/630-spring-valley-golf-course/search", booking_system: "golfnow" },
  { name: "Coyote Creek Golf Club", city: "Morgan Hill", region: "South Bay", holes: 36, golfnow_id: "469", booking_url: "https://www.golfnow.com/tee-times/facility/469-coyote-creek-golf-club/search", booking_system: "golfnow" },
  { name: "Moffett Field Golf Course", city: "Mountain View", region: "South Bay", holes: 18, golfnow_id: "573", booking_url: "https://www.golfnow.com/tee-times/facility/573-moffett-field-golf-course/search", booking_system: "golfnow" },
  { name: "Blackberry Farm Golf Course", city: "Cupertino", region: "South Bay", holes: 9, golfnow_id: null, booking_url: "https://www.cupertino.org/", booking_system: "other" },
  { name: "Palo Alto Golf Course", city: "Palo Alto", region: "South Bay", holes: 18, golfnow_id: "586", booking_url: "https://www.golfnow.com/tee-times/facility/586-palo-alto-golf-course/search", booking_system: "golfnow" },

  // East Bay - Alameda County
  { name: "Corica Park - South Course", city: "Alameda", region: "East Bay", holes: 18, golfnow_id: "8136", foreup_id: "22822", booking_url: "https://www.golfnow.com/tee-times/facility/8136-corica-park-south-course/search", booking_system: "golfnow" },
  { name: "Corica Park - North Course", city: "Alameda", region: "East Bay", holes: 18, golfnow_id: "514", foreup_id: "22822", booking_url: "https://www.golfnow.com/tee-times/facility/514-corica-park-north-course/search", booking_system: "golfnow" },
  { name: "Corica Park - Mif Albright Par 3", city: "Alameda", region: "East Bay", holes: 9, golfnow_id: "8713", booking_url: "https://www.golfnow.com/tee-times/facility/8713-corica-park-mif-albright-par-3/search", booking_system: "golfnow" },
  { name: "Metropolitan Golf Links", city: "Oakland", region: "East Bay", holes: 18, golfnow_id: "570", booking_url: "https://www.golfnow.com/tee-times/facility/570-metropolitan-golf-links/search", booking_system: "golfnow" },
  { name: "Lake Chabot Golf Course", city: "Oakland", region: "East Bay", holes: 27, golfnow_id: "549", booking_url: "https://www.golfnow.com/tee-times/facility/549-lake-chabot-golf-course/search", booking_system: "golfnow" },
  { name: "Tilden Park Golf Course", city: "Berkeley", region: "East Bay", holes: 18, golfnow_id: "649", booking_url: "https://www.golfnow.com/tee-times/facility/649-tilden-park-golf-course/search", booking_system: "golfnow" },
  { name: "Redwood Canyon Golf Course", city: "Castro Valley", region: "East Bay", holes: 9, golfnow_id: "602", booking_url: "https://www.golfnow.com/tee-times/facility/602-redwood-canyon-golf-course/search", booking_system: "golfnow" },
  { name: "Monarch Bay Golf Club", city: "San Leandro", region: "East Bay", holes: 18, golfnow_id: "574", booking_url: "https://www.golfnow.com/tee-times/facility/574-monarch-bay-golf-club/search", booking_system: "golfnow" },
  { name: "Montclair Golf Course", city: "Oakland", region: "East Bay", holes: 9, golfnow_id: "575", booking_url: "https://www.golfnow.com/tee-times/facility/575-montclair-golf-course/search", booking_system: "golfnow" },

  // East Bay - Contra Costa County
  { name: "Boundary Oak Golf Course", city: "Walnut Creek", region: "East Bay", holes: 18, golfnow_id: "456", booking_url: "https://www.golfnow.com/tee-times/facility/456-boundary-oak-golf-course/search", booking_system: "golfnow" },
  { name: "Diablo Hills Golf Course", city: "Walnut Creek", region: "East Bay", holes: 9, golfnow_id: "478", booking_url: "https://www.golfnow.com/tee-times/facility/478-diablo-hills-golf-course/search", booking_system: "golfnow" },
  { name: "Franklin Canyon Golf Course", city: "Hercules", region: "East Bay", holes: 18, golfnow_id: "498", booking_url: "https://www.golfnow.com/tee-times/facility/498-franklin-canyon-golf-course/search", booking_system: "golfnow" },
  { name: "Poppy Ridge Golf Course", city: "Livermore", region: "East Bay", holes: 27, golfnow_id: "593", booking_url: "https://www.golfnow.com/tee-times/facility/593-poppy-ridge-golf-course/search", booking_system: "golfnow" },
  { name: "Las Positas Golf Course", city: "Livermore", region: "East Bay", holes: 18, golfnow_id: "553", booking_url: "https://www.golfnow.com/tee-times/facility/553-las-positas-golf-course/search", booking_system: "golfnow" },
  { name: "Pleasanton Golf Center", city: "Pleasanton", region: "East Bay", holes: 9, golfnow_id: "591", booking_url: "https://www.golfnow.com/tee-times/facility/591-pleasanton-golf-center/search", booking_system: "golfnow" },
  { name: "Willow Park Golf Course", city: "Castro Valley", region: "East Bay", holes: 18, golfnow_id: "659", booking_url: "https://www.golfnow.com/tee-times/facility/659-willow-park-golf-course/search", booking_system: "golfnow" },

  // Marin County
  { name: "Peacock Gap Golf Club", city: "San Rafael", region: "Marin", holes: 18, golfnow_id: "588", booking_url: "https://www.golfnow.com/tee-times/facility/588-peacock-gap-golf-club/search", booking_system: "golfnow" },
  { name: "Indian Valley Golf Club", city: "Novato", region: "Marin", holes: 18, golfnow_id: "538", booking_url: "https://www.golfnow.com/tee-times/facility/538-indian-valley-golf-club/search", booking_system: "golfnow" },
  { name: "StoneTree Golf Club", city: "Novato", region: "Marin", holes: 18, golfnow_id: "633", booking_url: "https://www.golfnow.com/tee-times/facility/633-stonetree-golf-club/search", booking_system: "golfnow" },
  { name: "McInnis Park Golf Center", city: "San Rafael", region: "Marin", holes: 9, golfnow_id: "566", booking_url: "https://www.golfnow.com/tee-times/facility/566-mcinnis-park-golf-center/search", booking_system: "golfnow" },
  { name: "Mill Valley Golf Course", city: "Mill Valley", region: "Marin", holes: 9, golfnow_id: "572", booking_url: "https://www.golfnow.com/tee-times/facility/572-mill-valley-golf-course/search", booking_system: "golfnow" },
];

// Insert courses if they don't exist
const insertCourse = db.prepare(`
  INSERT OR IGNORE INTO courses (name, city, region, holes, golfnow_id, foreup_id, booking_url, booking_system)
  VALUES (@name, @city, @region, @holes, @golfnow_id, @foreup_id, @booking_url, @booking_system)
`);

const insertMany = db.transaction((courses) => {
  for (const course of courses) {
    insertCourse.run({
      name: course.name,
      city: course.city,
      region: course.region,
      holes: course.holes,
      golfnow_id: course.golfnow_id || null,
      foreup_id: course.foreup_id || null,
      booking_url: course.booking_url,
      booking_system: course.booking_system
    });
  }
});

function seedCourses() {
  insertMany(courses);
  console.log(`Seeded ${courses.length} courses`);
}

function getAllCourses() {
  return db.prepare('SELECT * FROM courses ORDER BY region, city, name').all();
}

function getCoursesByRegion(region) {
  return db.prepare('SELECT * FROM courses WHERE region = ? ORDER BY city, name').all(region);
}

function getCoursesWithGolfNow() {
  return db.prepare('SELECT * FROM courses WHERE golfnow_id IS NOT NULL ORDER BY region, city, name').all();
}

module.exports = {
  seedCourses,
  getAllCourses,
  getCoursesByRegion,
  getCoursesWithGolfNow,
  courses
};
