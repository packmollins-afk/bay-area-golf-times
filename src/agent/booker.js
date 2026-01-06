/**
 * Golf Booking Automation Module
 * Automates the booking process on GolfNow using Puppeteer
 *
 * NOTE: This module is designed for authorized use only.
 * Ensure compliance with GolfNow's terms of service.
 */

const puppeteer = require('puppeteer');

// Booking status constants
const BookingStatus = {
  PENDING: 'pending',
  NAVIGATING: 'navigating',
  SELECTING_TIME: 'selecting_time',
  FILLING_FORM: 'filling_form',
  CONFIRMING: 'confirming',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * GolfNow Booking Automation
 */
class GolfNowBooker {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.options = {
      headless: options.headless !== false, // Default to headless
      timeout: options.timeout || 30000,
      debug: options.debug || false,
      screenshots: options.screenshots || false,
      screenshotDir: options.screenshotDir || './booking-screenshots'
    };
    this.status = BookingStatus.PENDING;
    this.statusCallbacks = [];
  }

  /**
   * Subscribe to status updates
   */
  onStatusChange(callback) {
    this.statusCallbacks.push(callback);
  }

  /**
   * Update and broadcast status
   */
  updateStatus(status, details = {}) {
    this.status = status;
    const update = { status, timestamp: new Date().toISOString(), ...details };
    this.statusCallbacks.forEach(cb => cb(update));
    if (this.options.debug) {
      console.log(`[Booker] Status: ${status}`, details);
    }
    return update;
  }

  /**
   * Initialize browser
   */
  async init() {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: this.options.headless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set default timeout
    this.page.setDefaultTimeout(this.options.timeout);
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name) {
    if (!this.options.screenshots || !this.page) return;
    const filename = `${this.options.screenshotDir}/${Date.now()}-${name}.png`;
    await this.page.screenshot({ path: filename, fullPage: true });
    return filename;
  }

  /**
   * Book a tee time on GolfNow
   *
   * @param {Object} bookingDetails - Booking information
   * @param {string} bookingDetails.bookingUrl - Direct GolfNow booking URL
   * @param {string} bookingDetails.courseName - Course name for verification
   * @param {string} bookingDetails.date - Date (YYYY-MM-DD)
   * @param {string} bookingDetails.time - Time (HH:MM)
   * @param {number} bookingDetails.players - Number of players (1-4)
   * @param {Object} bookingDetails.contact - Contact information
   * @param {string} bookingDetails.contact.firstName
   * @param {string} bookingDetails.contact.lastName
   * @param {string} bookingDetails.contact.email
   * @param {string} bookingDetails.contact.phone
   * @param {Object} bookingDetails.payment - Payment information (optional for hot deals)
   *
   * @returns {Object} Booking result with confirmation details
   */
  async book(bookingDetails) {
    const { bookingUrl, courseName, date, time, players, contact, payment } = bookingDetails;

    try {
      await this.init();
      this.updateStatus(BookingStatus.NAVIGATING, { url: bookingUrl });

      // Navigate to booking URL
      await this.page.goto(bookingUrl, { waitUntil: 'networkidle2' });
      await this.screenshot('01-landing');

      // Wait for page to load and check for availability
      await this.page.waitForSelector('body', { timeout: 10000 });

      // Check if we're on a tee time selection page or booking page
      const pageType = await this.detectPageType();
      this.updateStatus(BookingStatus.SELECTING_TIME, { pageType });

      if (pageType === 'search') {
        // Need to select the specific tee time
        await this.selectTeeTime(date, time, players);
      }

      await this.screenshot('02-tee-time-selected');
      this.updateStatus(BookingStatus.FILLING_FORM);

      // Fill contact information
      await this.fillContactInfo(contact);
      await this.screenshot('03-contact-filled');

      // Fill payment if required
      if (payment) {
        await this.fillPaymentInfo(payment);
        await this.screenshot('04-payment-filled');
      }

      // Review and confirm
      this.updateStatus(BookingStatus.CONFIRMING);

      // Look for confirm/book button
      const confirmButton = await this.findConfirmButton();
      if (!confirmButton) {
        throw new Error('Could not find confirmation button');
      }

      // Click confirm (in production, you might want to pause here for user verification)
      // await confirmButton.click();
      // await this.page.waitForNavigation({ waitUntil: 'networkidle2' });

      await this.screenshot('05-pre-confirm');

      // For safety, we'll return without actually clicking confirm
      // Remove this block to enable actual booking
      const result = {
        status: 'ready_to_confirm',
        message: 'Booking form filled. Ready for manual confirmation.',
        bookingDetails: {
          course: courseName,
          date,
          time,
          players,
          contact: { email: contact.email }
        },
        screenshot: await this.screenshot('06-ready-to-confirm')
      };

      this.updateStatus(BookingStatus.SUCCESS, result);
      return result;

      /* Uncomment to enable actual booking:
      await confirmButton.click();
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Extract confirmation number
      const confirmation = await this.extractConfirmation();

      const result = {
        status: 'confirmed',
        confirmationNumber: confirmation.number,
        message: `Booking confirmed! Confirmation #${confirmation.number}`,
        bookingDetails: {
          course: courseName,
          date,
          time,
          players,
          contact: { email: contact.email }
        }
      };

      this.updateStatus(BookingStatus.SUCCESS, result);
      return result;
      */

    } catch (error) {
      await this.screenshot('error');
      this.updateStatus(BookingStatus.FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Detect what type of GolfNow page we're on
   */
  async detectPageType() {
    const url = this.page.url();

    if (url.includes('/search') || url.includes('/tee-times')) {
      return 'search';
    }
    if (url.includes('/checkout') || url.includes('/book')) {
      return 'checkout';
    }
    if (url.includes('/confirmation')) {
      return 'confirmation';
    }

    // Check page content
    const hasSearchResults = await this.page.$('.tee-time-results, .search-results, [data-testid="tee-times"]');
    if (hasSearchResults) return 'search';

    const hasCheckoutForm = await this.page.$('form[action*="checkout"], .checkout-form, #checkout');
    if (hasCheckoutForm) return 'checkout';

    return 'unknown';
  }

  /**
   * Select a specific tee time from search results
   */
  async selectTeeTime(date, time, players) {
    // GolfNow tee time selection
    // This needs to be adapted based on actual GolfNow DOM structure

    // Wait for tee times to load
    await this.page.waitForSelector('.tee-time, [data-testid="tee-time"], .tt-row', { timeout: 15000 });

    // Format time for matching (e.g., "8:30 AM")
    const [hours, minutes] = time.split(':');
    const hour12 = parseInt(hours) % 12 || 12;
    const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
    const timePatterns = [
      `${hour12}:${minutes} ${ampm}`,
      `${hour12}:${minutes}${ampm.toLowerCase()}`,
      time
    ];

    // Find and click the matching tee time
    const teeTimeSelector = await this.page.evaluate((patterns) => {
      const allTimes = document.querySelectorAll('.tee-time, [data-testid="tee-time"], .tt-row, .time-slot');

      for (const el of allTimes) {
        const text = el.textContent;
        for (const pattern of patterns) {
          if (text.includes(pattern)) {
            // Return a selector that can identify this element
            return el.className ? `.${el.className.split(' ').join('.')}` : null;
          }
        }
      }
      return null;
    }, timePatterns);

    if (!teeTimeSelector) {
      // Try clicking any available tee time
      const firstAvailable = await this.page.$('.tee-time:not(.unavailable), [data-testid="tee-time"], .book-button');
      if (firstAvailable) {
        await firstAvailable.click();
      } else {
        throw new Error(`Could not find tee time for ${time}`);
      }
    } else {
      await this.page.click(teeTimeSelector);
    }

    // Wait for navigation or modal
    await this.page.waitForTimeout(2000);
  }

  /**
   * Fill contact information
   */
  async fillContactInfo(contact) {
    const { firstName, lastName, email, phone } = contact;

    // Common field selectors for GolfNow
    const fieldMappings = [
      { value: firstName, selectors: ['#firstName', '[name="firstName"]', '[name="first_name"]', 'input[placeholder*="First"]'] },
      { value: lastName, selectors: ['#lastName', '[name="lastName"]', '[name="last_name"]', 'input[placeholder*="Last"]'] },
      { value: email, selectors: ['#email', '[name="email"]', '[type="email"]', 'input[placeholder*="Email"]'] },
      { value: phone, selectors: ['#phone', '[name="phone"]', '[type="tel"]', 'input[placeholder*="Phone"]'] }
    ];

    for (const field of fieldMappings) {
      if (!field.value) continue;

      for (const selector of field.selectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            await element.click({ clickCount: 3 }); // Select all
            await element.type(field.value);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
  }

  /**
   * Fill payment information
   */
  async fillPaymentInfo(payment) {
    const { cardNumber, expiry, cvv, zip } = payment;

    // Payment fields are often in iframes
    const paymentFrame = await this.page.$('iframe[name*="card"], iframe[src*="payment"]');

    let paymentPage = this.page;
    if (paymentFrame) {
      paymentPage = await paymentFrame.contentFrame();
    }

    const paymentFields = [
      { value: cardNumber, selectors: ['#cardNumber', '[name="cardNumber"]', '[data-testid="card-number"]'] },
      { value: expiry, selectors: ['#expiry', '[name="expiry"]', '[name="exp"]', '[placeholder*="MM"]'] },
      { value: cvv, selectors: ['#cvv', '[name="cvv"]', '[name="cvc"]', '[placeholder*="CVV"]'] },
      { value: zip, selectors: ['#zip', '[name="zip"]', '[name="postalCode"]', '[placeholder*="ZIP"]'] }
    ];

    for (const field of paymentFields) {
      if (!field.value) continue;

      for (const selector of field.selectors) {
        try {
          const element = await paymentPage.$(selector);
          if (element) {
            await element.type(field.value);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
  }

  /**
   * Find the confirm/book button
   */
  async findConfirmButton() {
    const buttonSelectors = [
      'button[type="submit"]',
      '.confirm-booking',
      '.book-now',
      '#confirm-button',
      'button:contains("Confirm")',
      'button:contains("Book")',
      'button:contains("Complete")',
      '[data-testid="confirm-booking"]'
    ];

    for (const selector of buttonSelectors) {
      try {
        const button = await this.page.$(selector);
        if (button) {
          const isVisible = await button.isIntersectingViewport();
          if (isVisible) return button;
        }
      } catch (e) {
        continue;
      }
    }

    // Try finding by text content
    const buttons = await this.page.$$('button, .btn, [role="button"]');
    for (const button of buttons) {
      const text = await button.evaluate(el => el.textContent.toLowerCase());
      if (text.includes('confirm') || text.includes('book') || text.includes('complete')) {
        return button;
      }
    }

    return null;
  }

  /**
   * Extract confirmation details after successful booking
   */
  async extractConfirmation() {
    // Wait for confirmation page
    await this.page.waitForSelector('.confirmation, .booking-confirmed, [data-testid="confirmation"]', { timeout: 10000 });

    const confirmation = await this.page.evaluate(() => {
      // Try various selectors for confirmation number
      const confSelectors = [
        '.confirmation-number',
        '#confirmation-number',
        '[data-testid="confirmation-number"]',
        '.booking-reference'
      ];

      for (const sel of confSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          return { number: el.textContent.trim() };
        }
      }

      // Try to find it in the page text
      const pageText = document.body.textContent;
      const match = pageText.match(/confirmation[:\s#]*([A-Z0-9-]+)/i);
      if (match) {
        return { number: match[1] };
      }

      return { number: 'UNKNOWN' };
    });

    return confirmation;
  }

  /**
   * Check availability for a specific tee time
   */
  async checkAvailability(bookingUrl) {
    try {
      await this.init();
      await this.page.goto(bookingUrl, { waitUntil: 'networkidle2' });

      // Check for availability indicators
      const available = await this.page.evaluate(() => {
        // Check for "sold out" or "unavailable" messages
        const unavailableText = ['sold out', 'unavailable', 'no longer available', 'not available'];
        const pageText = document.body.textContent.toLowerCase();

        for (const text of unavailableText) {
          if (pageText.includes(text)) return false;
        }

        // Check for book button
        const bookButton = document.querySelector('.book-now, .book-button, [data-testid="book"]');
        return !!bookButton;
      });

      return { available, url: bookingUrl };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }
}

/**
 * Create a booking request (for API use)
 */
async function createBookingRequest(bookingDetails) {
  // Validate required fields
  const required = ['bookingUrl', 'contact'];
  for (const field of required) {
    if (!bookingDetails[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  const { contact } = bookingDetails;
  if (!contact.firstName || !contact.lastName || !contact.email) {
    throw new Error('Contact must include firstName, lastName, and email');
  }

  // Create booking record
  const booking = {
    id: 'bk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    status: BookingStatus.PENDING,
    createdAt: new Date().toISOString(),
    details: bookingDetails
  };

  return booking;
}

/**
 * Process a booking (execute the automation)
 */
async function processBooking(bookingDetails, options = {}) {
  const booker = new GolfNowBooker(options);

  try {
    const result = await booker.book(bookingDetails);
    return result;
  } finally {
    await booker.close();
  }
}

module.exports = {
  GolfNowBooker,
  BookingStatus,
  createBookingRequest,
  processBooking
};
