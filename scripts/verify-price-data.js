#!/usr/bin/env node

/**
 * Price Data Quality Verification Script
 *
 * Checks for:
 * 1. $0 or negative prices
 * 2. Outlier prices (>$500)
 * 3. Price distribution analysis
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function verifyPriceData() {
  console.log('='.repeat(60));
  console.log('PRICE DATA QUALITY VERIFICATION');
  console.log('='.repeat(60));
  console.log();

  // 1. Check for $0 or negative prices
  console.log('1. CHECKING FOR $0 OR NEGATIVE PRICES');
  console.log('-'.repeat(40));

  const zeroOrNegative = await db.execute(`
    SELECT
      tt.id,
      tt.price,
      tt.date,
      tt.time,
      tt.holes,
      tt.players,
      tt.source,
      c.name as course_name
    FROM tee_times tt
    JOIN courses c ON tt.course_id = c.id
    WHERE tt.price <= 0
    ORDER BY tt.price ASC
    LIMIT 50
  `);

  if (zeroOrNegative.rows.length === 0) {
    console.log('No $0 or negative prices found.');
  } else {
    console.log(`Found ${zeroOrNegative.rows.length} records with $0 or negative prices:\n`);
    for (const row of zeroOrNegative.rows) {
      console.log(`  ID: ${row.id} | Price: $${row.price} | Course: ${row.course_name}`);
      console.log(`    Date: ${row.date} ${row.time} | Holes: ${row.holes} | Players: ${row.players} | Source: ${row.source}`);
    }
  }

  // Get total count
  const zeroNegCount = await db.execute(`
    SELECT COUNT(*) as count FROM tee_times WHERE price <= 0
  `);
  console.log(`\nTotal records with price <= $0: ${zeroNegCount.rows[0].count}`);
  console.log();

  // 2. Check for outlier prices (>$500)
  console.log('2. CHECKING FOR OUTLIER PRICES (>$500)');
  console.log('-'.repeat(40));

  const outliers = await db.execute(`
    SELECT
      tt.id,
      tt.price,
      tt.original_price,
      tt.date,
      tt.time,
      tt.holes,
      tt.players,
      tt.has_cart,
      tt.source,
      c.name as course_name
    FROM tee_times tt
    JOIN courses c ON tt.course_id = c.id
    WHERE tt.price > 500
    ORDER BY tt.price DESC
    LIMIT 50
  `);

  if (outliers.rows.length === 0) {
    console.log('No outlier prices (>$500) found.');
  } else {
    console.log(`Found ${outliers.rows.length} records with price >$500:\n`);
    for (const row of outliers.rows) {
      console.log(`  ID: ${row.id} | Price: $${row.price} | Course: ${row.course_name}`);
      console.log(`    Date: ${row.date} ${row.time} | Holes: ${row.holes} | Players: ${row.players}`);
      console.log(`    Has Cart: ${row.has_cart ? 'Yes' : 'No'} | Original Price: $${row.original_price || 'N/A'} | Source: ${row.source}`);
    }
  }

  // Get total count
  const outlierCount = await db.execute(`
    SELECT COUNT(*) as count FROM tee_times WHERE price > 500
  `);
  console.log(`\nTotal records with price > $500: ${outlierCount.rows[0].count}`);
  console.log();

  // 3. Price distribution analysis
  console.log('3. PRICE DISTRIBUTION ANALYSIS');
  console.log('-'.repeat(40));

  // Basic stats
  const stats = await db.execute(`
    SELECT
      COUNT(*) as total_records,
      COUNT(DISTINCT course_id) as courses_with_prices,
      MIN(price) as min_price,
      MAX(price) as max_price,
      AVG(price) as avg_price,
      SUM(CASE WHEN price IS NULL THEN 1 ELSE 0 END) as null_prices
    FROM tee_times
  `);

  const s = stats.rows[0];
  console.log('Basic Statistics:');
  console.log(`  Total tee time records: ${s.total_records}`);
  console.log(`  Courses with prices: ${s.courses_with_prices}`);
  console.log(`  Minimum price: $${s.min_price !== null ? Number(s.min_price).toFixed(2) : 'N/A'}`);
  console.log(`  Maximum price: $${s.max_price !== null ? Number(s.max_price).toFixed(2) : 'N/A'}`);
  console.log(`  Average price: $${s.avg_price !== null ? Number(s.avg_price).toFixed(2) : 'N/A'}`);
  console.log(`  NULL prices: ${s.null_prices}`);
  console.log();

  // Median (approximate using percentiles)
  const median = await db.execute(`
    SELECT price FROM tee_times
    WHERE price IS NOT NULL AND price > 0
    ORDER BY price
    LIMIT 1 OFFSET (SELECT COUNT(*) / 2 FROM tee_times WHERE price IS NOT NULL AND price > 0)
  `);
  if (median.rows.length > 0) {
    console.log(`  Median price (approx): $${Number(median.rows[0].price).toFixed(2)}`);
  }
  console.log();

  // Price ranges
  console.log('Price Distribution by Range:');
  const ranges = await db.execute(`
    SELECT
      CASE
        WHEN price IS NULL THEN 'NULL'
        WHEN price <= 0 THEN '$0 or less'
        WHEN price <= 20 THEN '$1-$20'
        WHEN price <= 40 THEN '$21-$40'
        WHEN price <= 60 THEN '$41-$60'
        WHEN price <= 80 THEN '$61-$80'
        WHEN price <= 100 THEN '$81-$100'
        WHEN price <= 150 THEN '$101-$150'
        WHEN price <= 200 THEN '$151-$200'
        WHEN price <= 300 THEN '$201-$300'
        WHEN price <= 500 THEN '$301-$500'
        ELSE '>$500'
      END as price_range,
      COUNT(*) as count
    FROM tee_times
    GROUP BY price_range
    ORDER BY
      CASE price_range
        WHEN 'NULL' THEN 0
        WHEN '$0 or less' THEN 1
        WHEN '$1-$20' THEN 2
        WHEN '$21-$40' THEN 3
        WHEN '$41-$60' THEN 4
        WHEN '$61-$80' THEN 5
        WHEN '$81-$100' THEN 6
        WHEN '$101-$150' THEN 7
        WHEN '$151-$200' THEN 8
        WHEN '$201-$300' THEN 9
        WHEN '$301-$500' THEN 10
        ELSE 11
      END
  `);

  let totalWithPrices = 0;
  for (const row of ranges.rows) {
    if (row.price_range !== 'NULL') {
      totalWithPrices += Number(row.count);
    }
    const pct = s.total_records > 0 ? ((Number(row.count) / Number(s.total_records)) * 100).toFixed(1) : '0.0';
    const bar = '#'.repeat(Math.round(pct / 2));
    console.log(`  ${row.price_range.padEnd(12)} : ${String(row.count).padStart(6)} (${pct.padStart(5)}%) ${bar}`);
  }
  console.log();

  // Price by holes
  console.log('Average Price by Holes:');
  const byHoles = await db.execute(`
    SELECT
      holes,
      COUNT(*) as count,
      AVG(price) as avg_price,
      MIN(price) as min_price,
      MAX(price) as max_price
    FROM tee_times
    WHERE price IS NOT NULL AND price > 0
    GROUP BY holes
    ORDER BY holes
  `);

  for (const row of byHoles.rows) {
    console.log(`  ${row.holes || 'Unknown'} holes: Avg $${Number(row.avg_price).toFixed(2)} (Min: $${Number(row.min_price).toFixed(2)}, Max: $${Number(row.max_price).toFixed(2)}) - ${row.count} records`);
  }
  console.log();

  // Price by source/booking system
  console.log('Average Price by Source:');
  const bySource = await db.execute(`
    SELECT
      source,
      COUNT(*) as count,
      AVG(price) as avg_price,
      MIN(price) as min_price,
      MAX(price) as max_price
    FROM tee_times
    WHERE price IS NOT NULL AND price > 0
    GROUP BY source
    ORDER BY count DESC
  `);

  for (const row of bySource.rows) {
    console.log(`  ${(row.source || 'Unknown').padEnd(15)} : Avg $${Number(row.avg_price).toFixed(2).padStart(6)} (Min: $${Number(row.min_price).toFixed(2).padStart(6)}, Max: $${Number(row.max_price).toFixed(2).padStart(6)}) - ${row.count} records`);
  }
  console.log();

  // Top 10 most expensive tee times
  console.log('Top 10 Most Expensive Tee Times:');
  const top10 = await db.execute(`
    SELECT
      tt.price,
      tt.date,
      tt.time,
      tt.holes,
      tt.players,
      tt.source,
      c.name as course_name
    FROM tee_times tt
    JOIN courses c ON tt.course_id = c.id
    WHERE tt.price IS NOT NULL
    ORDER BY tt.price DESC
    LIMIT 10
  `);

  for (let i = 0; i < top10.rows.length; i++) {
    const row = top10.rows[i];
    console.log(`  ${i + 1}. $${Number(row.price).toFixed(2)} - ${row.course_name}`);
    console.log(`     ${row.date} ${row.time} | ${row.holes} holes | ${row.players} players | ${row.source}`);
  }
  console.log();

  // Check for potential data issues
  console.log('4. POTENTIAL DATA QUALITY ISSUES');
  console.log('-'.repeat(40));

  // Prices that seem too low for full rounds
  const tooLow = await db.execute(`
    SELECT
      COUNT(*) as count
    FROM tee_times
    WHERE price > 0 AND price < 10 AND holes >= 18
  `);
  console.log(`  18+ hole rounds priced under $10: ${tooLow.rows[0].count}`);

  // Original price lower than discounted price
  const priceInversion = await db.execute(`
    SELECT
      COUNT(*) as count
    FROM tee_times
    WHERE original_price IS NOT NULL
      AND price IS NOT NULL
      AND original_price < price
  `);
  console.log(`  Records where original_price < price: ${priceInversion.rows[0].count}`);

  // Check for suspiciously round numbers that might indicate placeholder data
  const roundNumbers = await db.execute(`
    SELECT
      price,
      COUNT(*) as count
    FROM tee_times
    WHERE price IS NOT NULL
      AND price = CAST(price AS INTEGER)
      AND price % 10 = 0
    GROUP BY price
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log(`\n  Most common round-number prices (potential placeholders):`);
  for (const row of roundNumbers.rows) {
    console.log(`    $${row.price}: ${row.count} occurrences`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(60));
}

verifyPriceData()
  .catch(err => {
    console.error('Error running verification:', err);
    process.exit(1);
  });
