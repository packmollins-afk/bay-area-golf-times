/**
 * Calendar Service for Golf The Bay
 *
 * Browser-compatible ICS calendar file generation and calendar URL creation
 * for integrating tee time bookings with popular calendar applications.
 *
 * No external dependencies - pure vanilla JavaScript.
 */

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TEE_TIME_DURATION_MINUTES = 240; // 4 hours for 18 holes
const DEFAULT_ALARM_MINUTES = 60; // 1 hour reminder
const DEFAULT_PROD_ID = '-//Golf The Bay//Calendar//EN';
const ICS_LINE_LENGTH = 75;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a unique identifier for calendar events
 * @param {string} bookingId - Unique identifier for the booking
 * @returns {string} Unique event UID
 */
function generateEventUID(bookingId) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}-${bookingId}@golfthebay.com`;
}

/**
 * Formats a Date object to ICS datetime format (YYYYMMDDTHHmmssZ)
 * @param {Date} date - Date to format
 * @param {boolean} utc - Whether to use UTC time
 * @returns {string} ICS formatted datetime string
 */
function formatICSDateTime(date, utc = true) {
  if (utc) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  } else {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  }
}

/**
 * Formats a Date object to ICS date-only format (YYYYMMDD)
 * @param {Date} date - Date to format
 * @returns {string} ICS formatted date string
 */
function formatICSDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Escapes special characters in ICS text fields
 * Per RFC 5545: backslash, semicolon, comma, and newlines need escaping
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeICSText(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Folds long lines according to RFC 5545 (max 75 octets per line)
 * Continuation lines start with a space
 * @param {string} line - Line to fold
 * @returns {string} Folded line
 */
function foldICSLine(line) {
  if (line.length <= ICS_LINE_LENGTH) {
    return line;
  }

  const result = [];
  let currentLine = line;

  // First line can be full length
  result.push(currentLine.substring(0, ICS_LINE_LENGTH));
  currentLine = currentLine.substring(ICS_LINE_LENGTH);

  // Continuation lines start with space, so effective length is 74
  while (currentLine.length > 0) {
    const chunkLength = ICS_LINE_LENGTH - 1;
    result.push(' ' + currentLine.substring(0, chunkLength));
    currentLine = currentLine.substring(chunkLength);
  }

  return result.join('\r\n');
}

/**
 * Converts a Date to Google Calendar format
 * @param {Date} date - Date to convert
 * @returns {string} Google Calendar formatted date string
 */
function toGoogleCalendarDate(date) {
  return date.toISOString().replace(/-|:|\.\d{3}/g, '');
}

/**
 * Parses a date string or Date object into a Date
 * @param {string|Date} date - Date to parse
 * @returns {Date} Parsed date
 */
function parseDate(date) {
  if (date instanceof Date) {
    return date;
  }
  return new Date(date);
}

// ============================================================================
// Tee Time Event Generation
// ============================================================================

/**
 * Creates a tee time booking object
 * @param {Object} options - Tee time options
 * @param {string} options.courseName - Name of the golf course
 * @param {string|Date} options.date - Date of the tee time
 * @param {string} options.time - Time of the tee time (e.g., "7:30 AM")
 * @param {number} options.players - Number of players
 * @param {string[]} [options.playerNames] - Names of the players
 * @param {number} [options.holes=18] - Number of holes (9 or 18)
 * @param {string} [options.courseAddress] - Course address
 * @param {string} [options.courseCity] - Course city
 * @param {string} [options.coursePhone] - Course phone number
 * @param {string} [options.courseWebsite] - Course website URL
 * @param {string} [options.confirmationNumber] - Booking confirmation number
 * @param {string} [options.notes] - Additional notes
 * @param {number} [options.durationMinutes] - Duration in minutes
 * @returns {Object} Tee time booking object
 */
function createTeeTimeBooking(options) {
  const {
    courseName,
    date,
    time,
    players,
    playerNames = [],
    holes = 18,
    courseAddress = '',
    courseCity = '',
    coursePhone = '',
    courseWebsite = '',
    confirmationNumber = '',
    notes = '',
    durationMinutes = DEFAULT_TEE_TIME_DURATION_MINUTES
  } = options;

  // Parse the date and time
  let dateTime;
  if (typeof date === 'string' && time) {
    // Combine date and time
    const dateStr = date.split('T')[0]; // Handle ISO date strings
    dateTime = new Date(`${dateStr} ${time}`);
  } else {
    dateTime = parseDate(date);
  }

  return {
    courseName,
    dateTime,
    players,
    playerNames,
    holes,
    courseAddress,
    courseCity,
    coursePhone,
    courseWebsite,
    confirmationNumber: confirmationNumber || generateEventUID('booking'),
    notes,
    durationMinutes
  };
}

/**
 * Generates the event title for a tee time
 * @param {Object} booking - Tee time booking object
 * @returns {string} Event title
 */
function generateEventTitle(booking) {
  const holes = booking.holes || 18;
  return `Golf: ${holes} Holes at ${booking.courseName}`;
}

/**
 * Generates the event description for a tee time
 * @param {Object} booking - Tee time booking object
 * @returns {string} Event description
 */
function generateEventDescription(booking) {
  const lines = [];
  const dateTime = parseDate(booking.dateTime);

  // Header
  lines.push('TEE TIME DETAILS');
  lines.push('==============================');
  lines.push('');

  // Booking details
  if (booking.confirmationNumber) {
    lines.push(`Confirmation #: ${booking.confirmationNumber}`);
  }
  lines.push(`Date: ${dateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}`);
  lines.push(`Time: ${dateTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })}`);
  lines.push(`Holes: ${booking.holes || 18}`);
  lines.push(`Players: ${booking.players}`);
  lines.push('');

  // Course information
  lines.push('COURSE');
  lines.push('------------------------------');
  lines.push(booking.courseName);
  if (booking.courseAddress) {
    lines.push(booking.courseAddress);
  }
  if (booking.courseCity) {
    lines.push(booking.courseCity);
  }
  if (booking.coursePhone) {
    lines.push(`Phone: ${booking.coursePhone}`);
  }
  if (booking.courseWebsite) {
    lines.push(`Website: ${booking.courseWebsite}`);
  }
  lines.push('');

  // Player names
  if (booking.playerNames && booking.playerNames.length > 0) {
    lines.push('PLAYERS');
    lines.push('------------------------------');
    booking.playerNames.forEach((name, index) => {
      lines.push(`${index + 1}. ${name}`);
    });
    lines.push('');
  }

  // Notes
  if (booking.notes) {
    lines.push('NOTES');
    lines.push('------------------------------');
    lines.push(booking.notes);
    lines.push('');
  }

  // Footer
  lines.push('------------------------------');
  lines.push('Golf The Bay');
  lines.push('https://golfthebay.com');

  return lines.join('\n');
}

/**
 * Generates the location string for a tee time
 * @param {Object} booking - Tee time booking object
 * @returns {string} Location string
 */
function generateLocation(booking) {
  const parts = [booking.courseName];
  if (booking.courseAddress) {
    parts.push(booking.courseAddress);
  }
  if (booking.courseCity) {
    parts.push(booking.courseCity);
  }
  return parts.join(', ');
}

// ============================================================================
// ICS File Generation
// ============================================================================

/**
 * Generates a VALARM component for reminders
 * @param {number} minutesBefore - Minutes before event for reminder
 * @returns {string[]} VALARM lines
 */
function generateVAlarm(minutesBefore) {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: Tee time in ${minutesBefore} minutes`,
    `TRIGGER:-PT${minutesBefore}M`,
    'END:VALARM'
  ];
}

/**
 * Generates ICS file content for a tee time booking
 * @param {Object} booking - Tee time booking object
 * @param {Object} [options] - Generation options
 * @param {number} [options.alarmMinutes=60] - Minutes before for reminder
 * @param {string} [options.prodId] - Product identifier for ICS
 * @returns {string} ICS file content
 */
function generateICS(booking, options = {}) {
  const {
    alarmMinutes = DEFAULT_ALARM_MINUTES,
    prodId = DEFAULT_PROD_ID
  } = options;

  const startDate = parseDate(booking.dateTime);
  const endDate = new Date(startDate.getTime() + (booking.durationMinutes || DEFAULT_TEE_TIME_DURATION_MINUTES) * 60 * 1000);
  const now = new Date();
  const uid = booking.confirmationNumber || generateEventUID('teetime');

  const title = generateEventTitle(booking);
  const description = generateEventDescription(booking);
  const location = generateLocation(booking);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Golf The Bay',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDateTime(now)}`,
    `DTSTART:${formatICSDateTime(startDate)}`,
    `DTEND:${formatICSDateTime(endDate)}`,
    `SUMMARY:${escapeICSText(title)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    `LOCATION:${escapeICSText(location)}`,
    'CATEGORIES:Golf,Sports,Tee Time',
    'STATUS:CONFIRMED',
    `CREATED:${formatICSDateTime(now)}`,
    `LAST-MODIFIED:${formatICSDateTime(now)}`
  ];

  // Add course website as URL if available
  if (booking.courseWebsite) {
    lines.push(`URL:${booking.courseWebsite}`);
  }

  // Add alarm/reminder
  if (alarmMinutes > 0) {
    lines.push(...generateVAlarm(alarmMinutes));
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  // Fold long lines and join with CRLF
  return lines.map(line => foldICSLine(line)).join('\r\n');
}

/**
 * Generates a filename for the ICS file
 * @param {Object} booking - Tee time booking object
 * @returns {string} Suggested filename
 */
function generateICSFilename(booking) {
  const dateTime = parseDate(booking.dateTime);
  const dateStr = formatICSDate(dateTime);
  const courseName = booking.courseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `golf-${courseName}-${dateStr}.ics`;
}

/**
 * Creates a downloadable ICS file link (browser-compatible)
 * @param {Object} booking - Tee time booking object
 * @param {Object} [options] - Generation options
 * @returns {Object} Object with dataUrl, filename, and download function
 */
function createICSDownload(booking, options = {}) {
  const icsContent = generateICS(booking, options);
  const filename = generateICSFilename(booking);

  // Create a Blob and data URL for browser download
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const dataUrl = URL.createObjectURL(blob);

  return {
    content: icsContent,
    filename: filename,
    dataUrl: dataUrl,
    /**
     * Triggers a download of the ICS file in the browser
     */
    download: function() {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revoke the URL after a short delay to allow download to start
      setTimeout(() => URL.revokeObjectURL(dataUrl), 1000);
    },
    /**
     * Cleans up the data URL (call when no longer needed)
     */
    cleanup: function() {
      URL.revokeObjectURL(dataUrl);
    }
  };
}

// ============================================================================
// Calendar URL Generation
// ============================================================================

/**
 * Generates a Google Calendar add event URL
 * @param {Object} booking - Tee time booking object
 * @returns {string} Google Calendar URL
 */
function generateGoogleCalendarUrl(booking) {
  const startDate = parseDate(booking.dateTime);
  const endDate = new Date(startDate.getTime() + (booking.durationMinutes || DEFAULT_TEE_TIME_DURATION_MINUTES) * 60 * 1000);

  const title = generateEventTitle(booking);
  const description = generateEventDescription(booking);
  const location = generateLocation(booking);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toGoogleCalendarDate(startDate)}/${toGoogleCalendarDate(endDate)}`,
    details: description,
    location: location
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates an Outlook.com (web) add event URL
 * @param {Object} booking - Tee time booking object
 * @returns {string} Outlook.com Calendar URL
 */
function generateOutlookUrl(booking) {
  const startDate = parseDate(booking.dateTime);
  const endDate = new Date(startDate.getTime() + (booking.durationMinutes || DEFAULT_TEE_TIME_DURATION_MINUTES) * 60 * 1000);

  const title = generateEventTitle(booking);
  const description = generateEventDescription(booking);
  const location = generateLocation(booking);

  const params = new URLSearchParams({
    subject: title,
    body: description,
    location: location,
    startdt: startDate.toISOString(),
    enddt: endDate.toISOString(),
    path: '/calendar/action/compose',
    rru: 'addevent'
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generates an Office 365 add event URL
 * @param {Object} booking - Tee time booking object
 * @returns {string} Office 365 Calendar URL
 */
function generateOffice365Url(booking) {
  const startDate = parseDate(booking.dateTime);
  const endDate = new Date(startDate.getTime() + (booking.durationMinutes || DEFAULT_TEE_TIME_DURATION_MINUTES) * 60 * 1000);

  const title = generateEventTitle(booking);
  const description = generateEventDescription(booking);
  const location = generateLocation(booking);

  const params = new URLSearchParams({
    subject: title,
    body: description,
    location: location,
    startdt: startDate.toISOString(),
    enddt: endDate.toISOString(),
    path: '/calendar/action/compose',
    rru: 'addevent'
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generates a Yahoo Calendar add event URL
 * @param {Object} booking - Tee time booking object
 * @returns {string} Yahoo Calendar URL
 */
function generateYahooUrl(booking) {
  const startDate = parseDate(booking.dateTime);
  const endDate = new Date(startDate.getTime() + (booking.durationMinutes || DEFAULT_TEE_TIME_DURATION_MINUTES) * 60 * 1000);

  const title = generateEventTitle(booking);
  const description = generateEventDescription(booking);
  const location = generateLocation(booking);

  // Yahoo uses local datetime format without Z suffix
  const startStr = formatICSDateTime(startDate, false);
  const endStr = formatICSDateTime(endDate, false);

  // Calculate duration in HHMM format
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const duration = `${String(durationHours).padStart(2, '0')}${String(durationMinutes).padStart(2, '0')}`;

  const params = new URLSearchParams({
    v: '60',
    title: title,
    st: startStr,
    et: endStr,
    dur: duration,
    desc: description,
    in_loc: location
  });

  return `https://calendar.yahoo.com/?${params.toString()}`;
}

/**
 * Generates all calendar URLs for a tee time booking
 * @param {Object} booking - Tee time booking object
 * @returns {Object} Object containing URLs for different calendar services
 */
function generateAllCalendarUrls(booking) {
  return {
    google: generateGoogleCalendarUrl(booking),
    outlook: generateOutlookUrl(booking),
    office365: generateOffice365Url(booking),
    yahoo: generateYahooUrl(booking)
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Creates a complete tee time calendar integration from simple inputs
 * @param {string} courseName - Name of the golf course
 * @param {string|Date} date - Date of the tee time
 * @param {string} time - Time of the tee time (e.g., "7:30 AM")
 * @param {number} players - Number of players
 * @param {Object} [options] - Additional options
 * @returns {Object} Object with ICS content, download function, and calendar URLs
 */
function createTeeTimeCalendar(courseName, date, time, players, options = {}) {
  const booking = createTeeTimeBooking({
    courseName,
    date,
    time,
    players,
    ...options
  });

  const icsDownload = createICSDownload(booking, options);
  const calendarUrls = generateAllCalendarUrls(booking);

  return {
    booking: booking,
    ics: icsDownload,
    urls: calendarUrls,
    /**
     * Downloads the ICS file
     */
    downloadICS: icsDownload.download,
    /**
     * Opens Google Calendar to add the event
     */
    openGoogleCalendar: function() {
      window.open(calendarUrls.google, '_blank');
    },
    /**
     * Opens Outlook.com to add the event
     */
    openOutlookCalendar: function() {
      window.open(calendarUrls.outlook, '_blank');
    },
    /**
     * Opens Yahoo Calendar to add the event
     */
    openYahooCalendar: function() {
      window.open(calendarUrls.yahoo, '_blank');
    }
  };
}

// ============================================================================
// Export for different environments
// ============================================================================

// ES Module exports (for modern bundlers and browsers with type="module")
export {
  // Core functions
  generateICS,
  generateGoogleCalendarUrl,
  generateOutlookUrl,
  generateOffice365Url,
  generateYahooUrl,
  generateAllCalendarUrls,

  // Booking creation
  createTeeTimeBooking,
  createTeeTimeCalendar,
  createICSDownload,

  // Utility functions
  generateEventTitle,
  generateEventDescription,
  generateLocation,
  generateICSFilename,
  generateEventUID,

  // Date formatting
  formatICSDateTime,
  formatICSDate,
  parseDate
};

// Default export
export default {
  generateICS,
  generateGoogleCalendarUrl,
  generateOutlookUrl,
  generateOffice365Url,
  generateYahooUrl,
  generateAllCalendarUrls,
  createTeeTimeBooking,
  createTeeTimeCalendar,
  createICSDownload,
  generateEventTitle,
  generateEventDescription,
  generateLocation,
  generateICSFilename
};
