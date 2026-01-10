#!/usr/bin/env node

/**
 * Price Statistics Query
 * Queries the Turso database for comprehensive price statistics
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function queryPriceStats() {
  console.log('='.repeat(60));
  console.log('PRICE STATISTICS REPORT');
  console.log('='.repeat(60));
  console.log();

  // 1. Basic price statistics (min, max, avg)
  console.log('--- BASIC PRICE STATISTICS ---');
  const basicStats = await db.execute(`
    SELECT
      COUNT(*) as total_tee_times,
      MIN(price) as min_price,
      MAX(price) as max_price,
      ROUND(AVG(price), 2) as avg_price,
      ROUND(AVG(price) FILTER (WHERE price > 0), 2) as avg_price_nonzero
    FROM tee_times
  `);
  console.log('Total tee times:', basicStats.rows[0].total_tee_times);
  console.log('Min price:', basicStats.rows[0].min_price);
  console.log('Max price:', basicStats.rows[0].max_price);
  console.log('Avg price (all):', basicStats.rows[0].avg_price);
  console.log('Avg price (non-zero):', basicStats.rows[0].avg_price_nonzero);
  console.log();

  // 2. Zero prices
  console.log('--- ZERO PRICES ---');
  const zeroPrices = await db.execute(`
    SELECT
      COUNT(*) as zero_price_count,
      ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM tee_times), 2) as zero_percent
    FROM tee_times
    WHERE price = 0
  `);
  console.log('Count with price = 0:', zeroPrices.rows[0].zero_price_count);
  console.log('Percentage:', zeroPrices.rows[0].zero_percent + '%');
  console.log();

  // 3. Null prices
  console.log('--- NULL PRICES ---');
  const nullPrices = await db.execute(`
    SELECT
      COUNT(*) as null_price_count,
      ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM tee_times), 2) as null_percent
    FROM tee_times
    WHERE price IS NULL
  `);
  console.log('Count with price IS NULL:', nullPrices.rows[0].null_price_count);
  console.log('Percentage:', nullPrices.rows[0].null_percent + '%');
  console.log();

  // 4. Price distribution (buckets)
  console.log('--- PRICE DISTRIBUTION ---');
  const distribution = await db.execute(`
    SELECT
      CASE
        WHEN price IS NULL THEN 'NULL'
        WHEN price = 0 THEN '$0'
        WHEN price < 25 THEN '$1-24'
        WHEN price < 50 THEN '$25-49'
        WHEN price < 75 THEN '$50-74'
        WHEN price < 100 THEN '$75-99'
        WHEN price < 150 THEN '$100-149'
        WHEN price < 200 THEN '$150-199'
        WHEN price < 300 THEN '$200-299'
        ELSE '$300+'
      END as price_range,
      COUNT(*) as count,
      ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM tee_times), 2) as percent
    FROM tee_times
    GROUP BY
      CASE
        WHEN price IS NULL THEN 'NULL'
        WHEN price = 0 THEN '$0'
        WHEN price < 25 THEN '$1-24'
        WHEN price < 50 THEN '$25-49'
        WHEN price < 75 THEN '$50-74'
        WHEN price < 100 THEN '$75-99'
        WHEN price < 150 THEN '$100-149'
        WHEN price < 200 THEN '$150-199'
        WHEN price < 300 THEN '$200-299'
        ELSE '$300+'
      END
    ORDER BY
      CASE
        WHEN price IS NULL THEN 0
        WHEN price = 0 THEN 1
        WHEN price < 25 THEN 2
        WHEN price < 50 THEN 3
        WHEN price < 75 THEN 4
        WHEN price < 100 THEN 5
        WHEN price < 150 THEN 6
        WHEN price < 200 THEN 7
        WHEN price < 300 THEN 8
        ELSE 9
      END
  `);
  console.log('Price Range       | Count      | Percent');
  console.log('-'.repeat(45));
  for (const row of distribution.rows) {
    const range = (row.price_range || 'NULL').padEnd(17);
    const count = String(row.count).padStart(10);
    const pct = String(row.percent + '%').padStart(8);
    console.log(`${range} | ${count} | ${pct}`);
  }
  console.log();

  // 5. Zero/Null prices by source
  console.log('--- ZERO/NULL PRICES BY SOURCE ---');
  const bySource = await db.execute(`
    SELECT
      source,
      COUNT(*) as total,
      SUM(CASE WHEN price = 0 THEN 1 ELSE 0 END) as zero_count,
      SUM(CASE WHEN price IS NULL THEN 1 ELSE 0 END) as null_count,
      ROUND(100.0 * SUM(CASE WHEN price = 0 THEN 1 ELSE 0 END) / COUNT(*), 2) as zero_pct,
      ROUND(100.0 * SUM(CASE WHEN price IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as null_pct
    FROM tee_times
    GROUP BY source
    ORDER BY total DESC
  `);
  console.log('Source           | Total     | Zero     | Null     | Zero%   | Null%');
  console.log('-'.repeat(70));
  for (const row of bySource.rows) {
    const source = (row.source || 'unknown').padEnd(16);
    const total = String(row.total).padStart(9);
    const zero = String(row.zero_count).padStart(8);
    const nullC = String(row.null_count).padStart(8);
    const zeroPct = String(row.zero_pct + '%').padStart(7);
    const nullPct = String(row.null_pct + '%').padStart(7);
    console.log(`${source} | ${total} | ${zero} | ${nullC} | ${zeroPct} | ${nullPct}`);
  }
  console.log();

  // 6. Sample of zero-price tee times
  console.log('--- SAMPLE ZERO-PRICE TEE TIMES (up to 10) ---');
  const zeroSamples = await db.execute(`
    SELECT t.id, c.name as course_name, t.date, t.time, t.source, t.holes, t.players
    FROM tee_times t
    JOIN courses c ON t.course_id = c.id
    WHERE t.price = 0
    LIMIT 10
  `);
  if (zeroSamples.rows.length === 0) {
    console.log('No zero-price tee times found');
  } else {
    for (const row of zeroSamples.rows) {
      console.log(`  ID ${row.id}: ${row.course_name} - ${row.date} ${row.time} (${row.source}, ${row.holes}H, ${row.players}P)`);
    }
  }
  console.log();

  // 7. Sample of null-price tee times
  console.log('--- SAMPLE NULL-PRICE TEE TIMES (up to 10) ---');
  const nullSamples = await db.execute(`
    SELECT t.id, c.name as course_name, t.date, t.time, t.source, t.holes, t.players
    FROM tee_times t
    JOIN courses c ON t.course_id = c.id
    WHERE t.price IS NULL
    LIMIT 10
  `);
  if (nullSamples.rows.length === 0) {
    console.log('No null-price tee times found');
  } else {
    for (const row of nullSamples.rows) {
      console.log(`  ID ${row.id}: ${row.course_name} - ${row.date} ${row.time} (${row.source}, ${row.holes}H, ${row.players}P)`);
    }
  }
  console.log();

  // 8. Price stats by holes (9 vs 18)
  console.log('--- PRICE STATS BY HOLES ---');
  const byHoles = await db.execute(`
    SELECT
      holes,
      COUNT(*) as count,
      ROUND(AVG(price), 2) as avg_price,
      MIN(price) as min_price,
      MAX(price) as max_price
    FROM tee_times
    WHERE price > 0
    GROUP BY holes
    ORDER BY holes
  `);
  console.log('Holes | Count     | Avg Price | Min   | Max');
  console.log('-'.repeat(50));
  for (const row of byHoles.rows) {
    const holes = String(row.holes || 'NULL').padEnd(5);
    const count = String(row.count).padStart(9);
    const avg = String('$' + row.avg_price).padStart(10);
    const min = String('$' + row.min_price).padStart(6);
    const max = String('$' + row.max_price).padStart(6);
    console.log(`${holes} | ${count} | ${avg} | ${min} | ${max}`);
  }
  console.log();

  console.log('='.repeat(60));
  console.log('REPORT COMPLETE');
  console.log('='.repeat(60));
}

queryPriceStats()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
