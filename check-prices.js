require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function check() {
  const result = await db.execute(`
    SELECT c.name,
           MIN(t.price) as min_price,
           COUNT(t.id) as count,
           MIN(t.date) as earliest_date
    FROM courses c
    LEFT JOIN tee_times t ON c.id = t.course_id
      AND t.date >= date('now')
      AND t.price IS NOT NULL
      AND t.price > 0
    GROUP BY c.id
    ORDER BY count DESC
  `);

  const withPrices = result.rows.filter(r => r.count > 0 && r.min_price > 0);
  const withoutPrices = result.rows.filter(r => r.count === 0 || !r.min_price);

  console.log('Courses WITH valid prices (' + withPrices.length + '):');
  withPrices.forEach(r => {
    console.log('✓', r.name, '| min: $' + r.min_price, '| count:', r.count);
  });

  console.log('\nCourses WITHOUT valid prices (' + withoutPrices.length + '):');
  withoutPrices.forEach(r => {
    console.log('✗', r.name);
  });
}
check().catch(console.error);
