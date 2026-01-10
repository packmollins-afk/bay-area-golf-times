/**
 * Verify sample GolfNow courses have actual tee times with Puppeteer
 */
const puppeteer = require('puppeteer');

async function verifyGolfNowCourse(facilityId, name) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    const url = `https://www.golfnow.com/tee-times/facility/${facilityId}/search`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Check for tee times with prices
    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const priceMatch = text.match(/\$(\d+)/g);
      const hasTeeTimes = priceMatch && priceMatch.length > 0;
      const timeMatch = text.match(/\d{1,2}:\d{2}\s*(AM|PM)/gi);
      return {
        hasPrices: hasTeeTimes,
        priceCount: priceMatch ? priceMatch.length : 0,
        samplePrices: priceMatch ? priceMatch.slice(0, 5) : [],
        hasTimeslots: timeMatch && timeMatch.length > 0,
        timeslotCount: timeMatch ? timeMatch.length : 0
      };
    });

    await browser.close();
    return { facilityId, name, ...result, status: result.hasPrices ? 'VERIFIED' : 'FAILED' };
  } catch (e) {
    await browser.close();
    return { facilityId, name, status: 'ERROR', error: e.message };
  }
}

// Test a sample of courses from different regions
const testCourses = [
  { id: '918', name: 'Diamond Oaks Golf Course', region: 'Sacramento' },
  { id: '585', name: 'Hiddenbrooke Golf Club', region: 'East Bay' },
  { id: '6012', name: 'Shoreline Golf Links', region: 'South Bay' },
  { id: '98', name: 'DeLaveaga Golf Course', region: 'Monterey' },
  { id: '1490', name: 'Lake Chabot Golf Course', region: 'East Bay' },
  { id: '456', name: 'The Reserve at Spanos Park', region: 'East Bay' },
  { id: '3801', name: 'Gleneagles Golf Course', region: 'San Francisco' },
  { id: '9980', name: 'Creekside Golf Course', region: 'Central Valley' },
];

(async () => {
  console.log('=== PUPPETEER VERIFICATION (JavaScript enabled) ===\n');

  let verified = 0;
  let failed = 0;

  for (const course of testCourses) {
    const result = await verifyGolfNowCourse(course.id, course.name);
    console.log(`${result.status}: ${result.name} (ID: ${result.facilityId}) [${course.region}]`);
    if (result.hasPrices) {
      console.log(`   Prices: ${result.priceCount} found, Sample: ${result.samplePrices.join(', ')}`);
      console.log(`   Timeslots: ${result.timeslotCount} found`);
      verified++;
    } else if (result.error) {
      console.log(`   Error: ${result.error}`);
      failed++;
    } else {
      console.log(`   No tee times with prices found`);
      failed++;
    }
    console.log('');
  }

  console.log('=== SUMMARY ===');
  console.log(`Verified: ${verified}/${testCourses.length}`);
  console.log(`Failed: ${failed}/${testCourses.length}`);
})();
