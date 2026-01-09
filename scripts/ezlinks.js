/**
 * EZLinks Scraper - Enhanced with Cloudflare Bypass
 *
 * Puppeteer-extra stealth-based scraper for EZLinks booking system.
 * Targets Baylands Golf Links and any future EZLinks courses.
 *
 * Cloudflare Bypass Techniques:
 * 1. puppeteer-extra with stealth plugin
 * 2. Human-like timing and delays
 * 3. Realistic browser fingerprinting
 * 4. Session persistence and cookie reuse
 * 5. Hybrid approach: browser session + API calls where available
 * 6. Retry logic with exponential backoff
 *
 * EZLinks Site Structure:
 * - URL: https://baylandsbw.ezlinksgolf.com
 * - Uses JavaScript-rendered tee time grid
 * - Tee times displayed in time slots with prices
 * - May have underlying REST API for tee time data
 *
 * Features:
 * - 7-day lookahead (configurable)
 * - Retry logic with exponential backoff
 * - Batch database inserts
 * - Session persistence across date scrapes
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Configure stealth plugin with all evasions
puppeteer.use(StealthPlugin());

// ============================================================================
// CONFIGURATION
// ============================================================================

// EZLinks course configurations
// Slugs must match database exactly
const EZLINKS_COURSES = {
  'baylands-golf-links': {
    url: 'https://baylandsbw.ezlinksgolf.com',
    name: 'Baylands Golf Links',
    holes: 18,
    // EZLinks API endpoint if discovered (hybrid approach)
    apiEndpoint: null
  }
  // Add more EZLinks courses here as needed
};

const CONFIG = {
  // Timeouts
  pageTimeout: 60000,
  navigationTimeout: 45000,
  waitForSelectorTimeout: 15000,

  // Human-like delays (randomized)
  postLoadWaitMin: 2000,
  postLoadWaitMax: 4000,
  navigationWaitMin: 1500,
  navigationWaitMax: 3000,
  betweenActionsMin: 500,
  betweenActionsMax: 1500,

  // Cloudflare challenge handling
  challengeWait: 8000,         // Wait for Cloudflare challenge to complete
  maxChallengeRetries: 3,

  // Retry configuration
  maxRetries: 3,
  retryDelayBase: 3000,

  // Browser configuration
  headless: 'new',
  viewport: { width: 1366, height: 768 }
};

// Realistic User-Agent strings (Chrome on macOS/Windows)
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get random User-Agent
 */
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Random delay between min and max milliseconds
 */
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a random human-like duration
 */
async function humanDelay(min = CONFIG.betweenActionsMin, max = CONFIG.betweenActionsMax) {
  const delay = randomDelay(min, max);
  await new Promise(r => setTimeout(r, delay));
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = CONFIG.maxRetries, baseDelay = CONFIG.retryDelayBase) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt) + randomDelay(0, 1000);
      console.log(`  [EZLinks] Attempt ${attempt + 1} failed: ${error.message}, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Get Pacific date string
 */
function getPacificDate(dayOffset = 0) {
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  pst.setDate(pst.getDate() + dayOffset);
  const year = pst.getFullYear();
  const month = String(pst.getMonth() + 1).padStart(2, '0');
  const day = String(pst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date for EZLinks URL/calendar selection
 * EZLinks typically uses MM/DD/YYYY format
 */
function formatDateForEZLinks(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

/**
 * Robust time parser that handles multiple formats
 */
function convertTo24Hour(timeStr, context = null) {
  if (!timeStr) return null;

  const original = timeStr;
  const normalized = timeStr.trim().toUpperCase();

  // Pattern 1: Already in 24-hour format (HH:MM)
  const match24 = normalized.match(/^(\d{2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1]);
    if (hours >= 0 && hours <= 23) {
      return `${match24[1]}:${match24[2]}`;
    }
  }

  // Pattern 2: Full format with optional space - "7:30 AM", "7:30AM"
  const matchFull = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (matchFull) {
    let hours = parseInt(matchFull[1]);
    const minutes = matchFull[2];
    const period = matchFull[3];

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Pattern 3: Truncated period - "7:30 A", "7:30 P"
  const matchTruncated = normalized.match(/^(\d{1,2}):(\d{2})\s*([AP])$/);
  if (matchTruncated) {
    let hours = parseInt(matchTruncated[1]);
    const minutes = matchTruncated[2];
    const period = matchTruncated[3];

    if (period === 'P' && hours !== 12) hours += 12;
    if (period === 'A' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Pattern 4: Hour only with period - "7 AM", "7AM"
  const matchHourOnly = normalized.match(/^(\d{1,2})\s*(AM|PM)$/);
  if (matchHourOnly) {
    let hours = parseInt(matchHourOnly[1]);
    const period = matchHourOnly[2];

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:00`;
  }

  // Pattern 5: Hour only with truncated period - "7 A", "7A"
  const matchHourTruncated = normalized.match(/^(\d{1,2})\s*([AP])$/);
  if (matchHourTruncated) {
    let hours = parseInt(matchHourTruncated[1]);
    const period = matchHourTruncated[2];

    if (period === 'P' && hours !== 12) hours += 12;
    if (period === 'A' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:00`;
  }

  // Pattern 6: Time without period - "7:30" (ambiguous, pad hours)
  const matchNoPeriod = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (matchNoPeriod) {
    const hours = parseInt(matchNoPeriod[1]);
    const minutes = matchNoPeriod[2];
    if (context) {
      const ctxUpper = context.toUpperCase();
      if (ctxUpper === 'PM' || ctxUpper === 'P') {
        const adjHours = hours !== 12 ? hours + 12 : hours;
        return `${adjHours.toString().padStart(2, '0')}:${minutes}`;
      } else if (ctxUpper === 'AM' || ctxUpper === 'A') {
        const adjHours = hours === 12 ? 0 : hours;
        return `${adjHours.toString().padStart(2, '0')}:${minutes}`;
      }
    }
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  console.warn(`[EZLinks] Unable to parse time: "${original}"`);
  return null;
}

// ============================================================================
// CLOUDFLARE BYPASS HELPERS
// ============================================================================

/**
 * Check if page shows Cloudflare challenge
 */
async function isCloudflareChallenge(page) {
  try {
    const content = await page.content();
    const indicators = [
      'Checking your browser',
      'Just a moment',
      'cf-browser-verification',
      'cf_chl_opt',
      'Cloudflare',
      'Ray ID:',
      '_cf_chl_tk'
    ];
    return indicators.some(indicator => content.includes(indicator));
  } catch {
    return false;
  }
}

/**
 * Wait for Cloudflare challenge to complete
 */
async function waitForChallengeCompletion(page, maxWait = CONFIG.challengeWait) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    if (!(await isCloudflareChallenge(page))) {
      console.log('  [EZLinks] Cloudflare challenge completed');
      return true;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return !(await isCloudflareChallenge(page));
}

/**
 * Configure page with stealth settings
 */
async function configurePage(page) {
  const userAgent = getRandomUserAgent();
  await page.setUserAgent(userAgent);
  await page.setViewport(CONFIG.viewport);

  // Set realistic headers
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  });

  // Override navigator properties for additional stealth
  await page.evaluateOnNewDocument(() => {
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' }
      ]
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

    // Mock permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );

    // Mock chrome runtime
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };
  });

  return userAgent;
}

// ============================================================================
// SCRAPING FUNCTIONS
// ============================================================================

/**
 * Establish browser session and pass Cloudflare
 */
async function establishSession(page, baseUrl) {
  console.log('  [EZLinks] Establishing session...');

  for (let attempt = 0; attempt < CONFIG.maxChallengeRetries; attempt++) {
    try {
      await page.goto(baseUrl, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.navigationTimeout
      });

      // Check for Cloudflare challenge
      if (await isCloudflareChallenge(page)) {
        console.log('  [EZLinks] Cloudflare challenge detected, waiting...');
        const passed = await waitForChallengeCompletion(page);
        if (!passed) {
          throw new Error('Cloudflare challenge timeout');
        }
      }

      // Add human-like delay after page load
      await humanDelay(CONFIG.postLoadWaitMin, CONFIG.postLoadWaitMax);

      console.log('  [EZLinks] Session established successfully');
      return true;

    } catch (error) {
      console.log(`  [EZLinks] Session attempt ${attempt + 1} failed: ${error.message}`);
      if (attempt < CONFIG.maxChallengeRetries - 1) {
        await humanDelay(2000, 4000);
      }
    }
  }

  throw new Error('Failed to establish session after multiple attempts');
}

/**
 * Try to discover and use EZLinks API (hybrid approach)
 */
async function tryApiApproach(page, config, dateStr) {
  // Monitor network requests to discover API endpoints
  const apiRequests = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api') || url.includes('teetime') || url.includes('availability')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          apiRequests.push({
            url,
            method: response.request().method(),
            headers: response.request().headers()
          });
        }
      } catch {}
    }
  });

  // Trigger date navigation to capture API calls
  try {
    const formattedDate = formatDateForEZLinks(dateStr);

    // Look for date input and change it
    await page.evaluate((date) => {
      const dateInputs = document.querySelectorAll('input[type="date"], input[name*="date"], input[id*="date"]');
      dateInputs.forEach(input => {
        input.value = date;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }, dateStr);

    await humanDelay(1000, 2000);

    // If we discovered an API, try to use it
    if (apiRequests.length > 0) {
      console.log(`  [EZLinks] Discovered ${apiRequests.length} potential API endpoints`);
      // Could implement API-based fetching here
      // For now, fall back to DOM scraping
    }
  } catch (error) {
    // API discovery failed, continue with DOM scraping
  }

  return null; // Fall back to DOM scraping
}

/**
 * Navigate to specific date on EZLinks page
 */
async function navigateToDate(page, config, dateStr) {
  const formattedDate = formatDateForEZLinks(dateStr);

  // Try URL-based date navigation first
  const urlsToTry = [
    `${config.url}?date=${encodeURIComponent(formattedDate)}`,
    `${config.url}?teedate=${encodeURIComponent(dateStr)}`,
    `${config.url}/teetimes?date=${encodeURIComponent(formattedDate)}`,
    `${config.url}#date=${encodeURIComponent(formattedDate)}`
  ];

  for (const url of urlsToTry) {
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.navigationTimeout
      });

      // Check for Cloudflare challenge after navigation
      if (await isCloudflareChallenge(page)) {
        await waitForChallengeCompletion(page);
      }

      await humanDelay(CONFIG.postLoadWaitMin, CONFIG.postLoadWaitMax);
      return true;
    } catch (e) {
      // Try next URL pattern
    }
  }

  // Fall back to calendar/date picker interaction
  try {
    await page.evaluate(async (targetDate, formattedDate) => {
      // Try various date input selectors
      const selectors = [
        'input[type="date"]',
        'input[name*="date"]',
        'input[id*="date"]',
        'input[class*="date"]',
        '[data-date]',
        '.datepicker input',
        '.date-picker input'
      ];

      for (const selector of selectors) {
        const inputs = document.querySelectorAll(selector);
        for (const input of inputs) {
          try {
            // Native value setter for React/Vue inputs
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, 'value'
            ).set;
            nativeInputValueSetter.call(input, targetDate);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          } catch {}
        }
      }

      // Also try clicking calendar buttons
      const calendarButtons = document.querySelectorAll(
        '[class*="calendar"], [class*="date-picker"], [aria-label*="date"], button[class*="date"]'
      );
      if (calendarButtons.length > 0) {
        calendarButtons[0].click();
      }
    }, dateStr, formattedDate);

    await humanDelay(CONFIG.navigationWaitMin, CONFIG.navigationWaitMax);
    return true;
  } catch (error) {
    console.log(`  [EZLinks] Date navigation failed: ${error.message}`);
    return false;
  }
}

/**
 * Extract tee times from the page DOM
 */
async function extractTeeTimes(page, dateStr, defaultHoles) {
  return await page.evaluate((date, holes) => {
    const results = [];
    const seenTimes = new Set();

    // EZLinks-specific selectors (prioritized)
    const containerSelectors = [
      '.tee-time-list',
      '.teetime-container',
      '.teetimes',
      '.booking-grid',
      '.time-grid',
      '.schedule-grid',
      '[class*="teetime"]',
      '[class*="tee-time"]',
      '.rate-card',
      '.time-slot-container',
      '.available-times',
      '.tee-sheet',
      '#tee-times',
      '#teeTimes'
    ];

    const timeSlotSelectors = [
      '.tee-time',
      '.teetime',
      '.time-slot',
      '.slot',
      '[class*="time-slot"]',
      '[class*="teetime"]',
      '.rate-row',
      '.booking-row',
      '.tee-row',
      'tr[class*="time"]',
      'div[class*="time"]',
      '.available-time',
      '[data-time]'
    ];

    // Try structured selectors first
    for (const containerSel of containerSelectors) {
      const container = document.querySelector(containerSel);
      if (container) {
        for (const slotSel of timeSlotSelectors) {
          const slots = container.querySelectorAll(slotSel);
          if (slots.length > 0) {
            slots.forEach(slot => {
              const text = slot.innerText || slot.textContent || '';

              // Extract time
              const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
              if (!timeMatch) return;

              const time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;

              if (seenTimes.has(time)) return;
              seenTimes.add(time);

              // Extract price
              const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
              const price = priceMatch ? parseFloat(priceMatch[1]) : null;

              // Extract players
              const playersMatch = text.match(/(\d)\s*(?:player|golfer|spot|available|open)/i);
              const players = playersMatch ? parseInt(playersMatch[1]) : 4;

              // Extract holes
              let slotHoles = holes;
              if (text.match(/9\s*hole/i)) slotHoles = 9;
              else if (text.match(/18\s*hole/i)) slotHoles = 18;

              // Cart info
              const hasCart = text.toLowerCase().includes('cart') ? 1 : 0;

              if (price !== null) {
                results.push({
                  time,
                  price,
                  players,
                  holes: slotHoles,
                  has_cart: hasCart,
                  date
                });
              }
            });
            if (results.length > 0) return results;
          }
        }
      }
    }

    // Fallback: Parse entire page text
    const pageText = document.body.innerText || '';
    const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const timeMatch = line.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!timeMatch) continue;

      const time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;

      if (seenTimes.has(time)) continue;

      // Look for price in nearby lines
      let price = null;
      for (let j = Math.max(0, i - 3); j < Math.min(i + 6, lines.length); j++) {
        const priceMatch = lines[j].match(/\$(\d+(?:\.\d{2})?)/);
        if (priceMatch) {
          price = parseFloat(priceMatch[1]);
          break;
        }
      }

      // Determine holes from context
      let slotHoles = holes;
      for (let j = Math.max(0, i - 2); j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].match(/9\s*hole/i)) {
          slotHoles = 9;
          break;
        }
      }

      // Check for cart
      let hasCart = 0;
      for (let j = Math.max(0, i - 2); j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].toLowerCase().includes('cart')) {
          hasCart = 1;
          break;
        }
      }

      if (price !== null) {
        seenTimes.add(time);
        results.push({
          time,
          price,
          players: 4,
          holes: slotHoles,
          has_cart: hasCart,
          date
        });
      }
    }

    return results;
  }, dateStr, defaultHoles);
}

/**
 * Scrape EZLinks page for a specific date
 */
async function scrapeEZLinksForDate(page, config, dateStr) {
  // Try API approach first (hybrid)
  const apiResult = await tryApiApproach(page, config, dateStr);
  if (apiResult) {
    return apiResult;
  }

  // Navigate to the specific date
  await navigateToDate(page, config, dateStr);

  // Wait for content to load with human-like timing
  await humanDelay(CONFIG.postLoadWaitMin, CONFIG.postLoadWaitMax);

  // Scroll down to trigger lazy loading (human-like behavior)
  await page.evaluate(() => {
    window.scrollTo({ top: 300, behavior: 'smooth' });
  });
  await humanDelay(800, 1200);

  await page.evaluate(() => {
    window.scrollTo({ top: 600, behavior: 'smooth' });
  });
  await humanDelay(500, 1000);

  // Extract tee times
  const teeTimes = await extractTeeTimes(page, dateStr, config.holes);

  return teeTimes;
}

/**
 * Scrape a single course for all days (with session persistence)
 */
async function scrapeCourseAllDays(browser, slug, config, course, days) {
  const page = await browser.newPage();
  await configurePage(page);

  const allTeeTimes = [];

  try {
    // Establish initial session (handle Cloudflare challenge once)
    await establishSession(page, config.url);

    // Scrape each day while maintaining session
    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const dateStr = getPacificDate(dayOffset);

      try {
        const teeTimes = await retryWithBackoff(async () => {
          return await scrapeEZLinksForDate(page, config, dateStr);
        }, CONFIG.maxRetries, CONFIG.retryDelayBase);

        for (const tt of teeTimes) {
          const time24 = convertTo24Hour(tt.time);
          if (!time24) continue;

          allTeeTimes.push({
            course_id: course.id,
            date: dateStr,
            time: time24,
            datetime: `${dateStr} ${time24}`,
            holes: tt.holes,
            players: tt.players,
            price: tt.price,
            has_cart: tt.has_cart,
            booking_url: config.url,
            source: 'ezlinks'
          });
        }

        console.log(`  [EZLinks] ${config.name} ${dateStr}: ${teeTimes.length} tee times`);

        // Human-like delay between date scrapes
        if (dayOffset < days - 1) {
          await humanDelay(1000, 2000);
        }

      } catch (error) {
        console.error(`  [EZLinks] ${config.name} ${dateStr}: failed - ${error.message}`);

        // Try to re-establish session if it seems broken
        try {
          await establishSession(page, config.url);
        } catch (sessionError) {
          console.error(`  [EZLinks] Session recovery failed: ${sessionError.message}`);
        }
      }
    }
  } finally {
    await page.close().catch(() => {});
  }

  return { slug, name: config.name, teeTimes: allTeeTimes };
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

/**
 * Main scraper function - with Cloudflare bypass and session persistence
 */
async function scrapeAllOptimized(db, coursesBySlug, days = 7) {
  console.log(`[EZLinks] Starting optimized scrape with Cloudflare bypass...`);
  const startTime = Date.now();

  // Launch browser with stealth settings
  const browser = await retryWithBackoff(async () => {
    return await puppeteer.launch({
      headless: CONFIG.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1366,768',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    });
  });

  let totalTeeTimes = 0;
  let coursesScraped = 0;

  try {
    // Filter courses that exist in DB
    const coursesToScrape = Object.entries(EZLINKS_COURSES)
      .filter(([slug]) => coursesBySlug[slug])
      .map(([slug, config]) => ({ slug, config, course: coursesBySlug[slug] }));

    if (coursesToScrape.length === 0) {
      console.log('[EZLinks] No EZLinks courses found in database');
      await browser.close().catch(() => {});
      return { coursesScraped: 0, totalTeeTimes: 0 };
    }

    // NOTE: We no longer delete before scraping - the orchestrator handles cleanup
    // after successful scrape using scraped_at timestamps

    // Scrape courses sequentially to avoid detection
    // (Parallel requests might trigger Cloudflare rate limiting)
    const results = [];
    for (const { slug, config, course } of coursesToScrape) {
      const result = await scrapeCourseAllDays(browser, slug, config, course, days);
      results.push(result);

      // Delay between courses
      if (coursesToScrape.indexOf({ slug, config, course }) < coursesToScrape.length - 1) {
        await humanDelay(2000, 4000);
      }
    }

    // Collect all tee times for batch insert
    const allTeeTimes = [];
    for (const result of results) {
      allTeeTimes.push(...result.teeTimes);
      coursesScraped++;
      console.log(`  [EZLinks] ${result.name}: ${result.teeTimes.length} total tee times`);
    }

    // Batch insert with retry logic
    if (allTeeTimes.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < allTeeTimes.length; i += BATCH_SIZE) {
        const batch = allTeeTimes.slice(i, i + BATCH_SIZE);
        const statements = batch.map(tt => ({
          sql: `INSERT OR REPLACE INTO tee_times (course_id, date, time, datetime, holes, players, price, has_cart, booking_url, source, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          args: [tt.course_id, tt.date, tt.time, tt.datetime, tt.holes, tt.players, tt.price, tt.has_cart, tt.booking_url, tt.source]
        }));

        try {
          await retryWithBackoff(async () => {
            await db.batch(statements);
          });
          totalTeeTimes += batch.length;
        } catch (e) {
          // Fallback to individual inserts with retry
          for (const stmt of statements) {
            try {
              await retryWithBackoff(async () => {
                await db.execute(stmt);
              });
              totalTeeTimes++;
            } catch (e2) {
              console.log(`  [EZLinks] Failed to insert tee time after retries: ${e2.message}`);
            }
          }
        }
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[EZLinks] Complete: ${coursesScraped} courses, ${totalTeeTimes} tee times in ${elapsed}s`);

  return { coursesScraped, totalTeeTimes };
}

module.exports = { scrapeAllOptimized, EZLINKS_COURSES };
