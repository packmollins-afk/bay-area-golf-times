require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const newCourses = [
  { name: 'Silverado Resort - North Course', city: 'Napa', region: 'North Bay', holes: 18, par: 72, yardage: 6896, latitude: 38.3047, longitude: -122.2632, golfnow_id: '620', booking_url: 'https://www.golfnow.com/tee-times/facility/620-silverado-resort-north-course/search', booking_system: 'golfnow' },
  { name: 'Silverado Resort - South Course', city: 'Napa', region: 'North Bay', holes: 18, par: 72, yardage: 6632, latitude: 38.3037, longitude: -122.2622, golfnow_id: '621', booking_url: 'https://www.golfnow.com/tee-times/facility/621-silverado-resort-south-course/search', booking_system: 'golfnow' },
  { name: 'Napa Golf Course at Kennedy Park', city: 'Napa', region: 'North Bay', holes: 18, par: 72, yardage: 6738, latitude: 38.2847, longitude: -122.2732, golfnow_id: '129', booking_url: 'https://www.golfnow.com/tee-times/facility/129-napa-golf-course/search', booking_system: 'golfnow' },
  { name: "Vintner's Golf Club", city: 'Yountville', region: 'North Bay', holes: 9, par: 34, yardage: 2645, latitude: 38.4147, longitude: -122.3532, golfnow_id: '1676', booking_url: 'https://www.golfnow.com/tee-times/facility/1676-vintners-golf-club/search', booking_system: 'golfnow' },
  { name: 'San Ramon Golf Club', city: 'San Ramon', region: 'East Bay', holes: 18, par: 71, yardage: 6376, latitude: 37.7547, longitude: -121.9532, golfnow_id: '241', booking_url: 'https://www.golfnow.com/tee-times/facility/241-san-ramon-golf-club/search', booking_system: 'golfnow' },
  { name: 'The Bridges Golf Club', city: 'San Ramon', region: 'East Bay', holes: 18, par: 72, yardage: 7104, latitude: 37.7347, longitude: -121.9232, golfnow_id: '5141', booking_url: 'https://www.golfnow.com/tee-times/facility/5141-the-bridges-golf-club/search', booking_system: 'golfnow' },
  { name: 'Eagle Vines Golf Club', city: 'Napa', region: 'North Bay', holes: 18, par: 72, yardage: 7015, latitude: 38.2447, longitude: -122.2832, golfnow_id: '486', booking_url: 'https://www.golfnow.com/tee-times/facility/486-eagle-vines-golf-club/search', booking_system: 'golfnow' },
  { name: 'Chardonnay Golf Club', city: 'American Canyon', region: 'North Bay', holes: 18, par: 72, yardage: 6816, latitude: 38.1747, longitude: -122.2332, golfnow_id: '463', booking_url: 'https://www.golfnow.com/tee-times/facility/463-chardonnay-golf-club/search', booking_system: 'golfnow' },
  { name: 'Callippe Preserve Golf Course', city: 'Pleasanton', region: 'East Bay', holes: 18, par: 72, yardage: 6767, latitude: 37.6247, longitude: -121.8532, golfnow_id: '5023', booking_url: 'https://www.golfnow.com/tee-times/facility/5023-callippe-preserve-golf-course/search', booking_system: 'golfnow' },
  { name: 'Las Positas Golf Course', city: 'Livermore', region: 'East Bay', holes: 18, par: 72, yardage: 6725, latitude: 37.6760, longitude: -121.7540, golfnow_id: '553', booking_url: 'https://www.golfnow.com/tee-times/facility/553-las-positas-golf-course/search', booking_system: 'golfnow' },
  { name: 'McInnis Park Golf Center', city: 'San Rafael', region: 'North Bay', holes: 9, par: 31, yardage: 2130, latitude: 38.0140, longitude: -122.5320, golfnow_id: '566', booking_url: 'https://www.golfnow.com/tee-times/facility/566-mcinnis-park-golf-center/search', booking_system: 'golfnow' },
  { name: 'Redwood Canyon Golf Course', city: 'Castro Valley', region: 'East Bay', holes: 9, par: 34, yardage: 2580, latitude: 37.7215, longitude: -122.0680, golfnow_id: '602', booking_url: 'https://www.golfnow.com/tee-times/facility/602-redwood-canyon-golf-course/search', booking_system: 'golfnow' },
];

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function syncCourses() {
  let inserted = 0;
  let updated = 0;

  for (const course of newCourses) {
    const existing = await db.execute({
      sql: 'SELECT id FROM courses WHERE name = ?',
      args: [course.name]
    });

    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO courses (name, city, region, holes, par, yardage, latitude, longitude, golfnow_id, booking_url, booking_system, slug)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [course.name, course.city, course.region, course.holes, course.par, course.yardage,
               course.latitude, course.longitude, course.golfnow_id, course.booking_url, course.booking_system,
               course.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')]
      });
      console.log('Inserted:', course.name);
      inserted++;
    } else {
      await db.execute({
        sql: `UPDATE courses SET golfnow_id = ?, booking_url = ?, booking_system = ?, latitude = ?, longitude = ?
              WHERE name = ? AND (golfnow_id IS NULL OR golfnow_id = '')`,
        args: [course.golfnow_id, course.booking_url, course.booking_system, course.latitude, course.longitude, course.name]
      });
      updated++;
    }
  }

  console.log('\nInserted:', inserted, 'courses');
  console.log('Checked/updated:', updated, 'courses');

  const total = await db.execute('SELECT COUNT(*) as cnt FROM courses');
  console.log('Total courses in DB:', total.rows[0].cnt);
}

syncCourses().catch(console.error);
