const puppeteer = require('puppeteer');

async function getAllCourses() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const allCourses = [];

  // Search multiple Bay Area cities
  const searches = [
    { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
    { lat: 37.3382, lng: -121.8863, name: 'San Jose' },
    { lat: 37.8044, lng: -122.2712, name: 'Oakland' },
    { lat: 38.2975, lng: -122.2869, name: 'Napa' },
  ];

  for (const search of searches) {
    const searchUrl = `https://www.golfnow.com/tee-times/search#q=location&latitude=${search.lat}&longitude=${search.lng}&radius=50`;
    console.log(`Searching ${search.name}...`);

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to load more
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));

    const courses = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[href*="/facility/"]').forEach(a => {
        const href = a.href || '';
        const match = href.match(/facility\/(\d+)-([^/]+)/);
        if (match) {
          const parent = a.closest('[class*="course"], [class*="tile"], [class*="card"]');
          const text = parent?.innerText || a.innerText || '';
          const nameMatch = text.match(/^([^\n]+)/);
          const name = nameMatch ? nameMatch[1].trim() : match[2].replace(/-/g, ' ');

          // Skip simulators
          if (text.toLowerCase().includes('simulator') || name.toLowerCase().includes('simulator')) return;

          results.push({
            id: match[1],
            slug: match[2],
            name: name
          });
        }
      });
      return results;
    });

    courses.forEach(c => {
      const exists = allCourses.find(x => x.id === c.id);
      if (!exists) {
        allCourses.push(c);
      }
    });

    console.log(`  Found ${courses.length} courses (${allCourses.length} unique total)`);
  }

  console.log('\n=== All Bay Area GolfNow Courses ===');
  allCourses.sort((a, b) => a.name.localeCompare(b.name));
  allCourses.forEach(c => {
    console.log(`{ golfnow_id: "${c.id}", name: "${c.name}" },`);
  });

  await browser.close();
}

getAllCourses().catch(console.error);
