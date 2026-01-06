const puppeteer = require('puppeteer');

async function scrape() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  await page.goto('https://www.golfnow.com/tee-times/facility/148-presidio-golf-course/search',
    { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  const teeTimes = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('section.result').forEach(el => {
      const text = el.innerText;
      const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      const priceMatch = text.match(/\$(\d+)/g);

      if (timeMatch) {
        results.push({
          time: timeMatch[1],
          prices: priceMatch || [],
          text: text.replace(/\s+/g, ' ').substring(0, 200)
        });
      }
    });
    return results;
  });

  console.log('Presidio tee times from GolfNow NOW:\n');
  teeTimes.forEach(t => {
    console.log(t.time, '| Prices:', t.prices.join(', ') || 'none');
  });

  await browser.close();
}

scrape().catch(e => console.error('Error:', e.message));
