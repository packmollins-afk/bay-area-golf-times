/**
 * Calendar Service
 *
 * Provides utilities for generating calendar events in various formats:
 * - ICS (iCalendar) file format for download
 * - Google Calendar URL
 * - Outlook Calendar URL
 * - Yahoo Calendar URL
 */

/**
 * Escapes special characters for ICS format
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeICSText(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Folds lines longer than 75 characters as per RFC 5545
 * @param {string} line - Line to fold
 * @returns {string} - Folded line
 */
function foldLine(line) {
  const MAX_LENGTH = 75;
  if (line.length <= MAX_LENGTH) {
    return line;
  }

  const lines = [];
  let remaining = line;
  let isFirst = true;

  while (remaining.length > 0) {
    // First line can be 75 chars, subsequent lines 74 (75 minus space)
    const maxLen = isFirst ? MAX_LENGTH : MAX_LENGTH - 1;
    const chunk = remaining.substring(0, maxLen);

    if (isFirst) {
      lines.push(chunk);
      isFirst = false;
    } else {
      lines.push(' ' + chunk);
    }

    remaining = remaining.substring(maxLen);
  }

  return lines.join('\r\n');
}

/**
 * Formats a Date object to ICS datetime format (UTC)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted datetime string (e.g., "20240115T143000Z")
 */
function formatICSDateTime(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Formats a Date object to ICS date format (no time)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string (e.g., "20240115")
 */
function formatICSDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

/**
 * Generates a unique identifier for ICS events
 * @returns {string} - Unique identifier
 */
function generateUID() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}@golfthebay.com`;
}

/**
 * Generates an ICS (iCalendar) file content
 * @param {Object} event - Event details
 * @param {string} event.title - Event title/summary
 * @param {string} [event.description] - Event description
 * @param {string} [event.location] - Event location
 * @param {Date} event.startDate - Event start date/time
 * @param {Date} event.endDate - Event end date/time
 * @param {string} [event.url] - URL associated with the event
 * @param {boolean} [event.allDay] - Whether this is an all-day event
 * @returns {string} - ICS file content
 */
function generateICS(event) {
  if (!event || !event.title || !event.startDate || !event.endDate) {
    throw new Error('Event must have title, startDate, and endDate');
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Golf The Bay//Tee Time Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${generateUID()}`,
    `DTSTAMP:${formatICSDateTime(new Date())}`
  ];

  // Add start and end dates
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(event.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatICSDate(event.endDate)}`);
  } else {
    lines.push(`DTSTART:${formatICSDateTime(event.startDate)}`);
    lines.push(`DTEND:${formatICSDateTime(event.endDate)}`);
  }

  // Add summary (title)
  lines.push(foldLine(`SUMMARY:${escapeICSText(event.title)}`));

  // Add optional fields
  if (event.description) {
    lines.push(foldLine(`DESCRIPTION:${escapeICSText(event.description)}`));
  }

  if (event.location) {
    lines.push(foldLine(`LOCATION:${escapeICSText(event.location)}`));
  }

  if (event.url) {
    lines.push(foldLine(`URL:${event.url}`));
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Formats a Date for Google Calendar URL (YYYYMMDDTHHmmssZ)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatGoogleDate(date) {
  return formatICSDateTime(date);
}

/**
 * Generates a Google Calendar URL for adding an event
 * @param {Object} event - Event details
 * @param {string} event.title - Event title
 * @param {string} [event.description] - Event description
 * @param {string} [event.location] - Event location
 * @param {Date} event.startDate - Event start date/time
 * @param {Date} event.endDate - Event end date/time
 * @returns {string} - Google Calendar URL
 */
function generateGoogleCalendarUrl(event) {
  if (!event || !event.title || !event.startDate || !event.endDate) {
    throw new Error('Event must have title, startDate, and endDate');
  }

  const baseUrl = 'https://calendar.google.com/calendar/render';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(event.endDate)}`
  });

  if (event.description) {
    params.append('details', event.description);
  }

  if (event.location) {
    params.append('location', event.location);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Formats a Date for Outlook URL (ISO 8601)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatOutlookDate(date) {
  return date.toISOString();
}

/**
 * Generates an Outlook Calendar URL for adding an event
 * @param {Object} event - Event details
 * @param {string} event.title - Event title
 * @param {string} [event.description] - Event description
 * @param {string} [event.location] - Event location
 * @param {Date} event.startDate - Event start date/time
 * @param {Date} event.endDate - Event end date/time
 * @returns {string} - Outlook Calendar URL
 */
function generateOutlookUrl(event) {
  if (!event || !event.title || !event.startDate || !event.endDate) {
    throw new Error('Event must have title, startDate, and endDate');
  }

  const baseUrl = 'https://outlook.live.com/calendar/0/deeplink/compose';
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: formatOutlookDate(event.startDate),
    enddt: formatOutlookDate(event.endDate)
  });

  if (event.description) {
    params.append('body', event.description);
  }

  if (event.location) {
    params.append('location', event.location);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Formats a Date for Yahoo Calendar URL (YYYYMMDDTHHmmssZ)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatYahooDate(date) {
  return formatICSDateTime(date);
}

/**
 * Calculates duration in hours and minutes for Yahoo Calendar
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {string} - Duration string (e.g., "0200" for 2 hours)
 */
function calculateYahooDuration(startDate, endDate) {
  const durationMs = endDate.getTime() - startDate.getTime();
  const totalMinutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
}

/**
 * Generates a Yahoo Calendar URL for adding an event
 * @param {Object} event - Event details
 * @param {string} event.title - Event title
 * @param {string} [event.description] - Event description
 * @param {string} [event.location] - Event location
 * @param {Date} event.startDate - Event start date/time
 * @param {Date} event.endDate - Event end date/time
 * @returns {string} - Yahoo Calendar URL
 */
function generateYahooUrl(event) {
  if (!event || !event.title || !event.startDate || !event.endDate) {
    throw new Error('Event must have title, startDate, and endDate');
  }

  const baseUrl = 'https://calendar.yahoo.com/';
  const params = new URLSearchParams({
    v: '60',
    title: event.title,
    st: formatYahooDate(event.startDate),
    dur: calculateYahooDuration(event.startDate, event.endDate)
  });

  if (event.description) {
    params.append('desc', event.description);
  }

  if (event.location) {
    params.append('in_loc', event.location);
  }

  return `${baseUrl}?${params.toString()}`;
}

// ES Module exports
export {
  // Main generation functions
  generateICS,
  generateGoogleCalendarUrl,
  generateOutlookUrl,
  generateYahooUrl,

  // Helper functions (exported for testing)
  escapeICSText,
  foldLine,
  formatICSDateTime,
  formatICSDate,
  generateUID,
  formatGoogleDate,
  formatOutlookDate,
  formatYahooDate,
  calculateYahooDuration
};

// CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateICS,
    generateGoogleCalendarUrl,
    generateOutlookUrl,
    generateYahooUrl,
    escapeICSText,
    foldLine,
    formatICSDateTime,
    formatICSDate,
    generateUID,
    formatGoogleDate,
    formatOutlookDate,
    formatYahooDate,
    calculateYahooDuration
  };
}
