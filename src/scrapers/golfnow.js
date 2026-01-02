const cheerio = require('cheerio');
const db = require('../db/schema');

// GolfNow API endpoint for tee times
const GOLFNOW_API_BASE = 'https://www.golfnow.com/api/tee-times/tee-time-results';

/**
 * Fetch tee times from GolfNow for a specific facility
 */
async function fetchGolfNowTeeTimes(facilityId, date) {
  const formattedDate = date.toISOString().split('T')[0];

  // GolfNow uses a specific URL pattern for their API
  const url = `https://www.golfnow.com/tee-times/facility/${facilityId}/search?date=${formattedDate}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    return parseGolfNowHTML(html, facilityId, formattedDate);
  } catch (error) {
    console.error(`Error fetching tee times for facility ${facilityId}:`, error.message);
    return [];
  }
}

/**
 * Parse GolfNow HTML response for tee time data
 */
function parseGolfNowHTML(html, facilityId, date) {
  const $ = cheerio.load(html);
  const teeTimes = [];

  // GolfNow embeds tee time data in various ways
  // Look for tee time cards/rows
  $('[data-teetime], .tee-time-card, .time-slot, [class*="teetime"]').each((i, el) => {
    const $el = $(el);

    // Try to extract time
    const timeText = $el.find('[class*="time"], .time, time').first().text().trim() ||
                     $el.attr('data-time') ||
                     $el.text().match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i)?.[0];

    if (!timeText) return;

    // Try to extract price
    const priceText = $el.find('[class*="price"], .price').first().text().trim() ||
                      $el.attr('data-price');
    const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null;

    // Try to extract holes
    const holesText = $el.find('[class*="hole"], .holes').first().text().trim();
    const holes = holesText ? parseInt(holesText) : 18;

    // Try to extract players
    const playersText = $el.find('[class*="player"], .players').first().text().trim();
    const players = playersText ? parseInt(playersText) : 4;

    // Get booking URL
    const bookingUrl = $el.find('a').first().attr('href') ||
                       `https://www.golfnow.com/tee-times/facility/${facilityId}/search?date=${date}`;

    teeTimes.push({
      time: timeText,
      date: date,
      price: price,
      holes: holes,
      players: players,
      booking_url: bookingUrl.startsWith('http') ? bookingUrl : `https://www.golfnow.com${bookingUrl}`,
      source: 'golfnow'
    });
  });

  // Also try to parse JSON data embedded in the page
  const scriptTags = $('script').toArray();
  for (const script of scriptTags) {
    const content = $(script).html();
    if (content && content.includes('teeTimes') || content.includes('teeTimeResults')) {
      try {
        // Look for JSON data patterns
        const jsonMatch = content.match(/(?:teeTimes|teeTimeResults)\s*[=:]\s*(\[[\s\S]*?\])/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[1]);
          for (const item of data) {
            teeTimes.push({
              time: item.time || item.teeTime,
              date: date,
              price: item.price || item.greenFee,
              holes: item.holes || 18,
              players: item.players || item.maxPlayers || 4,
              booking_url: item.bookingUrl || `https://www.golfnow.com/tee-times/facility/${facilityId}/search?date=${date}`,
              source: 'golfnow'
            });
          }
        }
      } catch (e) {
        // JSON parsing failed, continue
      }
    }
  }

  return teeTimes;
}

/**
 * Alternative: Use GolfNow's internal API directly
 */
async function fetchGolfNowAPI(facilityId, date, latitude = 37.7749, longitude = -122.4194) {
  const formattedDate = date.toISOString().split('T')[0];

  // GolfNow's internal API endpoint
  const apiUrl = 'https://www.golfnow.com/api/tee-times/tee-time-results';

  const params = new URLSearchParams({
    FacilityId: facilityId,
    Date: formattedDate,
    Latitude: latitude,
    Longitude: longitude,
    Radius: 50,
    PageSize: 50,
    PageNumber: 1,
    SortBy: 'Date',
    SortByRollup: 'Date',
    View: 'Grouping',
    ExcludeFacilitiesWithNoRates: false,
    ExcludeFacilitiesNotInOriginalPriceModel: false,
    AllowStandbyReservation: false
  });

  try {
    const response = await fetch(`${apiUrl}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.5',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.golfnow.com/tee-times/facility/${facilityId}/search`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return parseGolfNowAPIResponse(data, facilityId, formattedDate);
  } catch (error) {
    console.error(`API error for facility ${facilityId}:`, error.message);
    return [];
  }
}

/**
 * Parse GolfNow API JSON response
 */
function parseGolfNowAPIResponse(data, facilityId, date) {
  const teeTimes = [];

  if (!data || !data.TeeTimeResults) {
    return teeTimes;
  }

  for (const result of data.TeeTimeResults) {
    if (result.TeeTimesByFacility) {
      for (const facility of result.TeeTimesByFacility) {
        if (facility.TeeTimes) {
          for (const teeTime of facility.TeeTimes) {
            teeTimes.push({
              time: teeTime.Time,
              date: date,
              price: teeTime.DisplayPrice || teeTime.Price,
              original_price: teeTime.OriginalPrice,
              holes: teeTime.Holes || 18,
              players: teeTime.MaxPlayers || 4,
              has_cart: teeTime.CartIncluded ? 1 : 0,
              booking_url: teeTime.BookingUrl || `https://www.golfnow.com/tee-times/facility/${facilityId}/search?date=${date}`,
              source: 'golfnow'
            });
          }
        }
      }
    }
  }

  return teeTimes;
}

/**
 * Scrape tee times for a single course
 */
async function scrapeCourse(course, date) {
  if (!course.golfnow_id) {
    console.log(`Skipping ${course.name} - no GolfNow ID`);
    return [];
  }

  console.log(`Scraping ${course.name}...`);

  // Try API first, fall back to HTML parsing
  let teeTimes = await fetchGolfNowAPI(course.golfnow_id, date);

  if (teeTimes.length === 0) {
    teeTimes = await fetchGolfNowTeeTimes(course.golfnow_id, date);
  }

  // Add course_id to each tee time
  return teeTimes.map(tt => ({
    ...tt,
    course_id: course.id
  }));
}

/**
 * Scrape all courses for a given date
 */
async function scrapeAllCourses(date) {
  const { getCoursesWithGolfNow } = require('../db/courses');
  const courses = getCoursesWithGolfNow();
  const allTeeTimes = [];

  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < courses.length; i += batchSize) {
    const batch = courses.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(course => scrapeCourse(course, date)));

    for (const teeTimes of results) {
      allTeeTimes.push(...teeTimes);
    }

    // Small delay between batches
    if (i + batchSize < courses.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return allTeeTimes;
}

/**
 * Save tee times to database
 */
function saveTeeTimes(teeTimes) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO tee_times
    (course_id, date, time, datetime, holes, players, price, original_price, has_cart, booking_url, source, scraped_at)
    VALUES (@course_id, @date, @time, @datetime, @holes, @players, @price, @original_price, @has_cart, @booking_url, @source, datetime('now'))
  `);

  const insertMany = db.transaction((teeTimes) => {
    let count = 0;
    for (const tt of teeTimes) {
      try {
        insert.run({
          course_id: tt.course_id,
          date: tt.date,
          time: tt.time,
          datetime: `${tt.date} ${tt.time}`,
          holes: tt.holes || 18,
          players: tt.players || 4,
          price: tt.price,
          original_price: tt.original_price || null,
          has_cart: tt.has_cart || 0,
          booking_url: tt.booking_url,
          source: tt.source
        });
        count++;
      } catch (error) {
        console.error(`Error saving tee time:`, error.message);
      }
    }
    return count;
  });

  return insertMany(teeTimes);
}

/**
 * Main scrape function
 */
async function runScraper(daysAhead = 7) {
  console.log('Starting GolfNow scraper...');

  const today = new Date();
  let totalTeeTimes = 0;

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    console.log(`\nScraping for ${date.toISOString().split('T')[0]}...`);
    const teeTimes = await scrapeAllCourses(date);

    if (teeTimes.length > 0) {
      const saved = saveTeeTimes(teeTimes);
      console.log(`Saved ${saved} tee times`);
      totalTeeTimes += saved;
    }

    // Delay between days
    if (i < daysAhead - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\nScraping complete! Total tee times saved: ${totalTeeTimes}`);
  return totalTeeTimes;
}

module.exports = {
  fetchGolfNowTeeTimes,
  fetchGolfNowAPI,
  scrapeCourse,
  scrapeAllCourses,
  saveTeeTimes,
  runScraper
};
