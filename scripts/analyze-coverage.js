/**
 * Analyze 7-day tee time coverage by source
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  console.log('=== CURRENT 7-DAY COVERAGE ANALYSIS ===\n');

  // Get date distribution by source
  const distribution = await db.execute(`
    SELECT date, source, COUNT(*) as count
    FROM tee_times
    WHERE date >= date('now')
    GROUP BY date, source
    ORDER BY date, source
  `);

  // Organize by date
  const byDate = {};
  distribution.rows.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = {};
    byDate[r.date][r.source] = r.count;
  });

  console.log('Date       | GolfNow | Chrono | Totale | CPS  | Total');
  console.log('-'.repeat(60));

  let totalBySource = { golfnow: 0, chronogolf: 0, totaleintegrated: 0, cpsgolf: 0 };

  Object.entries(byDate).sort().forEach(([date, sources]) => {
    const golfnow = sources.golfnow || 0;
    const chrono = sources.chronogolf || 0;
    const totale = sources.totaleintegrated || 0;
    const cps = sources.cpsgolf || 0;
    const total = golfnow + chrono + totale + cps;

    totalBySource.golfnow += golfnow;
    totalBySource.chronogolf += chrono;
    totalBySource.totaleintegrated += totale;
    totalBySource.cpsgolf += cps;

    console.log(`${date} | ${String(golfnow).padStart(7)} | ${String(chrono).padStart(6)} | ${String(totale).padStart(6)} | ${String(cps).padStart(4)} | ${String(total).padStart(5)}`);
  });

  // Summary
  const dates = Object.keys(byDate).sort();
  console.log('-'.repeat(60));
  console.log(`TOTAL      | ${String(totalBySource.golfnow).padStart(7)} | ${String(totalBySource.chronogolf).padStart(6)} | ${String(totalBySource.totaleintegrated).padStart(6)} | ${String(totalBySource.cpsgolf).padStart(4)} |`);

  console.log('\n--- COVERAGE SUMMARY ---');
  console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  console.log(`Days with data: ${dates.length}`);

  // Get Pacific time now
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const today = pst.toISOString().split('T')[0];
  console.log(`\nCurrent Pacific Date: ${today}`);
  console.log(`Current Pacific Time: ${pst.toTimeString().split(' ')[0]}`);

  // Calculate expected 7-day range
  console.log('\n--- EXPECTED 7-DAY RANGE ---');
  for (let i = 0; i < 7; i++) {
    const d = new Date(pst);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const hasData = byDate[dateStr] ? '✓' : '✗';
    const count = byDate[dateStr] ? Object.values(byDate[dateStr]).reduce((a, b) => a + b, 0) : 0;
    console.log(`Day ${i}: ${dateStr} ${hasData} (${count} tee times)`);
  }

  // Identify gaps
  const gaps = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(pst);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    if (!byDate[dateStr] || Object.values(byDate[dateStr]).reduce((a, b) => a + b, 0) < 100) {
      gaps.push({ day: i, date: dateStr, count: byDate[dateStr] ? Object.values(byDate[dateStr]).reduce((a, b) => a + b, 0) : 0 });
    }
  }

  if (gaps.length > 0) {
    console.log('\n⚠️  COVERAGE GAPS (< 100 tee times):');
    gaps.forEach(g => console.log(`   Day ${g.day} (${g.date}): ${g.count} tee times`));
  } else {
    console.log('\n✅ All 7 days have good coverage (100+ tee times each)');
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
