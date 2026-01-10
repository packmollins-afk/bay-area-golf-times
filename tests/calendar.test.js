/**
 * Calendar Service Tests
 *
 * Comprehensive tests for the calendar/ICS service including:
 * - ICS file generation and format validity
 * - Date formatting
 * - Text escaping
 * - Line folding (RFC 5545)
 * - URL generation for Google, Outlook, and Yahoo calendars
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
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
} from '../src/services/calendar.js';

// Test fixtures
const createTestEvent = (overrides = {}) => ({
  title: 'Golf Tee Time at Presidio Golf Course',
  description: 'Booked via Bay Area Golf',
  location: 'Presidio Golf Course, San Francisco, CA',
  startDate: new Date('2024-06-15T14:30:00Z'),
  endDate: new Date('2024-06-15T18:30:00Z'),
  url: 'https://bayareagolf.now/book/presidio',
  ...overrides
});

describe('Calendar Service', () => {
  describe('escapeICSText', () => {
    it('should escape backslashes', () => {
      expect(escapeICSText('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('should escape semicolons', () => {
      expect(escapeICSText('item1;item2;item3')).toBe('item1\\;item2\\;item3');
    });

    it('should escape commas', () => {
      expect(escapeICSText('San Francisco, CA')).toBe('San Francisco\\, CA');
    });

    it('should escape newlines', () => {
      expect(escapeICSText('line1\nline2')).toBe('line1\\nline2');
    });

    it('should remove carriage returns', () => {
      expect(escapeICSText('line1\r\nline2')).toBe('line1\\nline2');
    });

    it('should handle multiple special characters', () => {
      const input = 'Golf; Course\\Name, Location\nDetails';
      const expected = 'Golf\\; Course\\\\Name\\, Location\\nDetails';
      expect(escapeICSText(input)).toBe(expected);
    });

    it('should return empty string for null input', () => {
      expect(escapeICSText(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(escapeICSText(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(escapeICSText('')).toBe('');
    });

    it('should handle text with no special characters', () => {
      expect(escapeICSText('Simple text')).toBe('Simple text');
    });
  });

  describe('foldLine', () => {
    it('should not fold lines under 75 characters', () => {
      const shortLine = 'SUMMARY:Short event title';
      expect(foldLine(shortLine)).toBe(shortLine);
    });

    it('should not fold lines exactly 75 characters', () => {
      const line75 = 'A'.repeat(75);
      expect(foldLine(line75)).toBe(line75);
    });

    it('should fold lines over 75 characters', () => {
      const longLine = 'DESCRIPTION:' + 'A'.repeat(100);
      const folded = foldLine(longLine);

      // Should contain line breaks
      expect(folded).toContain('\r\n');

      // Each line after the first should start with a space
      const lines = folded.split('\r\n');
      expect(lines.length).toBeGreaterThan(1);
      for (let i = 1; i < lines.length; i++) {
        expect(lines[i][0]).toBe(' ');
      }
    });

    it('should fold very long lines into multiple segments', () => {
      const veryLongLine = 'DESCRIPTION:' + 'X'.repeat(200);
      const folded = foldLine(veryLongLine);
      const lines = folded.split('\r\n');

      // Should have multiple folded lines
      expect(lines.length).toBeGreaterThan(2);

      // First line should be 75 chars max
      expect(lines[0].length).toBeLessThanOrEqual(75);

      // Subsequent lines should be 75 chars max (including leading space)
      for (let i = 1; i < lines.length; i++) {
        expect(lines[i].length).toBeLessThanOrEqual(75);
      }
    });

    it('should maintain content integrity after folding', () => {
      const original = 'DESCRIPTION:' + 'ABCDEFGHIJ'.repeat(15);
      const folded = foldLine(original);

      // Reconstruct by removing folding
      const reconstructed = folded.split('\r\n').map((line, i) =>
        i === 0 ? line : line.substring(1)
      ).join('');

      expect(reconstructed).toBe(original);
    });
  });

  describe('formatICSDateTime', () => {
    it('should format a date in UTC format', () => {
      const date = new Date('2024-06-15T14:30:45Z');
      expect(formatICSDateTime(date)).toBe('20240615T143045Z');
    });

    it('should handle midnight correctly', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      expect(formatICSDateTime(date)).toBe('20240101T000000Z');
    });

    it('should handle end of day correctly', () => {
      const date = new Date('2024-12-31T23:59:59Z');
      expect(formatICSDateTime(date)).toBe('20241231T235959Z');
    });

    it('should pad single digit months and days', () => {
      const date = new Date('2024-01-05T09:05:05Z');
      expect(formatICSDateTime(date)).toBe('20240105T090505Z');
    });

    it('should throw for invalid date', () => {
      expect(() => formatICSDateTime(new Date('invalid'))).toThrow('Invalid date provided');
    });

    it('should throw for non-Date object', () => {
      expect(() => formatICSDateTime('2024-06-15')).toThrow('Invalid date provided');
    });

    it('should throw for null', () => {
      expect(() => formatICSDateTime(null)).toThrow();
    });
  });

  describe('formatICSDate', () => {
    it('should format a date without time', () => {
      const date = new Date('2024-06-15T14:30:45Z');
      // Note: This uses local time, so result depends on timezone
      const result = formatICSDate(date);
      expect(result).toMatch(/^\d{8}$/);
    });

    it('should handle single digit months and days', () => {
      const date = new Date(2024, 0, 5); // January 5, 2024 local time
      expect(formatICSDate(date)).toBe('20240105');
    });

    it('should throw for invalid date', () => {
      expect(() => formatICSDate(new Date('invalid'))).toThrow('Invalid date provided');
    });

    it('should throw for non-Date object', () => {
      expect(() => formatICSDate('2024-06-15')).toThrow('Invalid date provided');
    });
  });

  describe('generateUID', () => {
    it('should generate a unique identifier', () => {
      const uid = generateUID();
      expect(uid).toBeTruthy();
      expect(typeof uid).toBe('string');
    });

    it('should include domain suffix', () => {
      const uid = generateUID();
      expect(uid).toContain('@bayareagolf.now');
    });

    it('should generate different UIDs on successive calls', () => {
      const uid1 = generateUID();
      const uid2 = generateUID();
      expect(uid1).not.toBe(uid2);
    });

    it('should contain timestamp and random component', () => {
      const uid = generateUID();
      const parts = uid.split('@')[0].split('-');
      expect(parts.length).toBe(2);
      expect(Number(parts[0])).toBeGreaterThan(0); // timestamp
      expect(parts[1].length).toBeGreaterThan(0); // random string
    });
  });

  describe('generateICS', () => {
    let testEvent;

    beforeEach(() => {
      testEvent = createTestEvent();
    });

    describe('VCALENDAR structure', () => {
      it('should start with BEGIN:VCALENDAR', () => {
        const ics = generateICS(testEvent);
        expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
      });

      it('should end with END:VCALENDAR', () => {
        const ics = generateICS(testEvent);
        expect(ics.endsWith('END:VCALENDAR')).toBe(true);
      });

      it('should include VERSION:2.0', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('VERSION:2.0');
      });

      it('should include PRODID', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('PRODID:-//Bay Area Golf//Tee Time Booking//EN');
      });

      it('should include CALSCALE:GREGORIAN', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('CALSCALE:GREGORIAN');
      });

      it('should include METHOD:PUBLISH', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('METHOD:PUBLISH');
      });
    });

    describe('VEVENT structure', () => {
      it('should contain BEGIN:VEVENT', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('BEGIN:VEVENT');
      });

      it('should contain END:VEVENT', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('END:VEVENT');
      });

      it('should include UID', () => {
        const ics = generateICS(testEvent);
        expect(ics).toMatch(/UID:[\w-]+@bayareagolf\.now/);
      });

      it('should include DTSTAMP', () => {
        const ics = generateICS(testEvent);
        expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
      });

      it('should include DTSTART', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('DTSTART:20240615T143000Z');
      });

      it('should include DTEND', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('DTEND:20240615T183000Z');
      });

      it('should include SUMMARY with escaped title', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('SUMMARY:Golf Tee Time at Presidio Golf Course');
      });
    });

    describe('optional fields', () => {
      it('should include DESCRIPTION when provided', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('DESCRIPTION:Booked via Bay Area Golf');
      });

      it('should not include DESCRIPTION when not provided', () => {
        const event = createTestEvent({ description: undefined });
        const ics = generateICS(event);
        expect(ics).not.toContain('DESCRIPTION:');
      });

      it('should include LOCATION when provided', () => {
        const ics = generateICS(testEvent);
        // Location has commas which should be escaped
        expect(ics).toContain('LOCATION:Presidio Golf Course\\, San Francisco\\, CA');
      });

      it('should not include LOCATION when not provided', () => {
        const event = createTestEvent({ location: undefined });
        const ics = generateICS(event);
        expect(ics).not.toContain('LOCATION:');
      });

      it('should include URL when provided', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('URL:https://bayareagolf.now/book/presidio');
      });

      it('should not include URL when not provided', () => {
        const event = createTestEvent({ url: undefined });
        const ics = generateICS(event);
        expect(ics).not.toContain('URL:');
      });
    });

    describe('all-day events', () => {
      it('should use VALUE=DATE format for all-day events', () => {
        const event = createTestEvent({
          allDay: true,
          startDate: new Date(2024, 5, 15), // June 15, 2024
          endDate: new Date(2024, 5, 16)    // June 16, 2024
        });
        const ics = generateICS(event);

        expect(ics).toContain('DTSTART;VALUE=DATE:');
        expect(ics).toContain('DTEND;VALUE=DATE:');
        expect(ics).not.toMatch(/DTSTART:\d{8}T/);
      });
    });

    describe('line endings', () => {
      it('should use CRLF line endings', () => {
        const ics = generateICS(testEvent);
        expect(ics).toContain('\r\n');
        // Should not have standalone LF
        const withoutCRLF = ics.replace(/\r\n/g, '');
        expect(withoutCRLF).not.toContain('\n');
      });
    });

    describe('validation', () => {
      it('should throw error when event is null', () => {
        expect(() => generateICS(null)).toThrow('Event must have title, startDate, and endDate');
      });

      it('should throw error when event is undefined', () => {
        expect(() => generateICS(undefined)).toThrow('Event must have title, startDate, and endDate');
      });

      it('should throw error when title is missing', () => {
        const event = createTestEvent({ title: undefined });
        expect(() => generateICS(event)).toThrow('Event must have title, startDate, and endDate');
      });

      it('should throw error when startDate is missing', () => {
        const event = createTestEvent({ startDate: undefined });
        expect(() => generateICS(event)).toThrow('Event must have title, startDate, and endDate');
      });

      it('should throw error when endDate is missing', () => {
        const event = createTestEvent({ endDate: undefined });
        expect(() => generateICS(event)).toThrow('Event must have title, startDate, and endDate');
      });
    });

    describe('special characters in content', () => {
      it('should escape semicolons in title', () => {
        const event = createTestEvent({ title: 'Golf; Tee Time' });
        const ics = generateICS(event);
        expect(ics).toContain('SUMMARY:Golf\\; Tee Time');
      });

      it('should escape commas in description', () => {
        const event = createTestEvent({ description: 'Player 1, Player 2, Player 3' });
        const ics = generateICS(event);
        expect(ics).toContain('DESCRIPTION:Player 1\\, Player 2\\, Player 3');
      });

      it('should escape newlines in description', () => {
        const event = createTestEvent({ description: 'Line 1\nLine 2' });
        const ics = generateICS(event);
        expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2');
      });

      it('should handle backslashes in location', () => {
        const event = createTestEvent({ location: 'Course\\Section A' });
        const ics = generateICS(event);
        expect(ics).toContain('LOCATION:Course\\\\Section A');
      });
    });

    describe('line folding', () => {
      it('should fold long description lines', () => {
        const longDescription = 'A'.repeat(100);
        const event = createTestEvent({ description: longDescription });
        const ics = generateICS(event);

        // Find the DESCRIPTION line
        const descriptionMatch = ics.match(/DESCRIPTION:[^\r]*(\r\n [^\r]*)*/);
        expect(descriptionMatch).toBeTruthy();

        // Check that no single line exceeds 75 characters
        const lines = ics.split('\r\n');
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(75);
        }
      });

      it('should fold long location lines', () => {
        const longLocation = 'Very Long Golf Course Name ' + 'in Location '.repeat(10);
        const event = createTestEvent({ location: longLocation });
        const ics = generateICS(event);

        const lines = ics.split('\r\n');
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(75);
        }
      });
    });
  });

  describe('generateGoogleCalendarUrl', () => {
    let testEvent;

    beforeEach(() => {
      testEvent = createTestEvent();
    });

    it('should generate a valid Google Calendar URL', () => {
      const url = generateGoogleCalendarUrl(testEvent);
      expect(url).toContain('https://calendar.google.com/calendar/render');
    });

    it('should include action=TEMPLATE', () => {
      const url = generateGoogleCalendarUrl(testEvent);
      expect(url).toContain('action=TEMPLATE');
    });

    it('should include encoded title', () => {
      const url = generateGoogleCalendarUrl(testEvent);
      expect(url).toContain('text=Golf+Tee+Time+at+Presidio+Golf+Course');
    });

    it('should include formatted dates', () => {
      const url = generateGoogleCalendarUrl(testEvent);
      expect(url).toContain('dates=20240615T143000Z%2F20240615T183000Z');
    });

    it('should include details when description is provided', () => {
      const url = generateGoogleCalendarUrl(testEvent);
      expect(url).toContain('details=Booked+via+Bay+Area+Golf');
    });

    it('should not include details when description is not provided', () => {
      const event = createTestEvent({ description: undefined });
      const url = generateGoogleCalendarUrl(event);
      expect(url).not.toContain('details=');
    });

    it('should include location when provided', () => {
      const url = generateGoogleCalendarUrl(testEvent);
      expect(url).toContain('location=');
      expect(url).toContain('Presidio');
    });

    it('should not include location when not provided', () => {
      const event = createTestEvent({ location: undefined });
      const url = generateGoogleCalendarUrl(event);
      expect(url).not.toContain('location=');
    });

    it('should properly encode special characters', () => {
      const event = createTestEvent({
        title: 'Golf & Lunch',
        description: 'Includes: food, drinks & fun!'
      });
      const url = generateGoogleCalendarUrl(event);

      // URL should be properly encoded
      expect(url).toContain('text=Golf+%26+Lunch');
      expect(url).toContain('details=Includes');
    });

    it('should throw error when event is missing required fields', () => {
      expect(() => generateGoogleCalendarUrl(null)).toThrow('Event must have title, startDate, and endDate');
      expect(() => generateGoogleCalendarUrl({ title: 'Test' })).toThrow('Event must have title, startDate, and endDate');
    });
  });

  describe('generateOutlookUrl', () => {
    let testEvent;

    beforeEach(() => {
      testEvent = createTestEvent();
    });

    it('should generate a valid Outlook URL', () => {
      const url = generateOutlookUrl(testEvent);
      expect(url).toContain('https://outlook.live.com/calendar/0/deeplink/compose');
    });

    it('should include path parameter', () => {
      const url = generateOutlookUrl(testEvent);
      expect(url).toContain('path=%2Fcalendar%2Faction%2Fcompose');
    });

    it('should include rru=addevent', () => {
      const url = generateOutlookUrl(testEvent);
      expect(url).toContain('rru=addevent');
    });

    it('should include subject', () => {
      const url = generateOutlookUrl(testEvent);
      expect(url).toContain('subject=Golf+Tee+Time+at+Presidio+Golf+Course');
    });

    it('should include ISO formatted start date', () => {
      const url = generateOutlookUrl(testEvent);
      // ISO format: 2024-06-15T14:30:00.000Z
      expect(url).toContain('startdt=2024-06-15T14');
    });

    it('should include ISO formatted end date', () => {
      const url = generateOutlookUrl(testEvent);
      expect(url).toContain('enddt=2024-06-15T18');
    });

    it('should include body when description is provided', () => {
      const url = generateOutlookUrl(testEvent);
      expect(url).toContain('body=Booked+via+Bay+Area+Golf');
    });

    it('should not include body when description is not provided', () => {
      const event = createTestEvent({ description: undefined });
      const url = generateOutlookUrl(event);
      expect(url).not.toContain('body=');
    });

    it('should include location when provided', () => {
      const url = generateOutlookUrl(testEvent);
      expect(url).toContain('location=');
    });

    it('should not include location when not provided', () => {
      const event = createTestEvent({ location: undefined });
      const url = generateOutlookUrl(event);
      expect(url).not.toContain('location=');
    });

    it('should throw error when event is missing required fields', () => {
      expect(() => generateOutlookUrl(null)).toThrow('Event must have title, startDate, and endDate');
    });
  });

  describe('generateYahooUrl', () => {
    let testEvent;

    beforeEach(() => {
      testEvent = createTestEvent();
    });

    it('should generate a valid Yahoo Calendar URL', () => {
      const url = generateYahooUrl(testEvent);
      expect(url).toContain('https://calendar.yahoo.com/');
    });

    it('should include v=60', () => {
      const url = generateYahooUrl(testEvent);
      expect(url).toContain('v=60');
    });

    it('should include title', () => {
      const url = generateYahooUrl(testEvent);
      expect(url).toContain('title=Golf+Tee+Time+at+Presidio+Golf+Course');
    });

    it('should include start time (st)', () => {
      const url = generateYahooUrl(testEvent);
      expect(url).toContain('st=20240615T143000Z');
    });

    it('should include duration (dur)', () => {
      const url = generateYahooUrl(testEvent);
      // 4 hour duration = 0400
      expect(url).toContain('dur=0400');
    });

    it('should include desc when description is provided', () => {
      const url = generateYahooUrl(testEvent);
      expect(url).toContain('desc=Booked+via+Bay+Area+Golf');
    });

    it('should not include desc when description is not provided', () => {
      const event = createTestEvent({ description: undefined });
      const url = generateYahooUrl(event);
      expect(url).not.toContain('desc=');
    });

    it('should include in_loc when location is provided', () => {
      const url = generateYahooUrl(testEvent);
      expect(url).toContain('in_loc=');
    });

    it('should not include in_loc when location is not provided', () => {
      const event = createTestEvent({ location: undefined });
      const url = generateYahooUrl(event);
      expect(url).not.toContain('in_loc=');
    });

    it('should throw error when event is missing required fields', () => {
      expect(() => generateYahooUrl(null)).toThrow('Event must have title, startDate, and endDate');
    });
  });

  describe('calculateYahooDuration', () => {
    it('should calculate 1 hour duration', () => {
      const start = new Date('2024-06-15T14:00:00Z');
      const end = new Date('2024-06-15T15:00:00Z');
      expect(calculateYahooDuration(start, end)).toBe('0100');
    });

    it('should calculate 4 hour duration', () => {
      const start = new Date('2024-06-15T14:00:00Z');
      const end = new Date('2024-06-15T18:00:00Z');
      expect(calculateYahooDuration(start, end)).toBe('0400');
    });

    it('should calculate duration with minutes', () => {
      const start = new Date('2024-06-15T14:00:00Z');
      const end = new Date('2024-06-15T15:30:00Z');
      expect(calculateYahooDuration(start, end)).toBe('0130');
    });

    it('should handle durations over 24 hours', () => {
      const start = new Date('2024-06-15T14:00:00Z');
      const end = new Date('2024-06-16T16:00:00Z');
      expect(calculateYahooDuration(start, end)).toBe('2600');
    });

    it('should handle zero duration', () => {
      const start = new Date('2024-06-15T14:00:00Z');
      const end = new Date('2024-06-15T14:00:00Z');
      expect(calculateYahooDuration(start, end)).toBe('0000');
    });

    it('should pad single digit hours and minutes', () => {
      const start = new Date('2024-06-15T14:00:00Z');
      const end = new Date('2024-06-15T14:05:00Z');
      expect(calculateYahooDuration(start, end)).toBe('0005');
    });
  });

  describe('formatGoogleDate', () => {
    it('should format date in ICS datetime format', () => {
      const date = new Date('2024-06-15T14:30:00Z');
      expect(formatGoogleDate(date)).toBe('20240615T143000Z');
    });
  });

  describe('formatOutlookDate', () => {
    it('should format date in ISO 8601 format', () => {
      const date = new Date('2024-06-15T14:30:00Z');
      expect(formatOutlookDate(date)).toBe('2024-06-15T14:30:00.000Z');
    });
  });

  describe('formatYahooDate', () => {
    it('should format date in ICS datetime format', () => {
      const date = new Date('2024-06-15T14:30:00Z');
      expect(formatYahooDate(date)).toBe('20240615T143000Z');
    });
  });

  describe('URL encoding', () => {
    it('should properly encode spaces in Google Calendar URL', () => {
      const event = createTestEvent({ title: 'Golf Tee Time' });
      const url = generateGoogleCalendarUrl(event);
      expect(url).not.toContain(' ');
      expect(url).toContain('+');
    });

    it('should properly encode ampersands in all URLs', () => {
      const event = createTestEvent({ title: 'Golf & Tennis' });

      const googleUrl = generateGoogleCalendarUrl(event);
      const outlookUrl = generateOutlookUrl(event);
      const yahooUrl = generateYahooUrl(event);

      // Should be encoded as %26
      expect(googleUrl).toContain('%26');
      expect(outlookUrl).toContain('%26');
      expect(yahooUrl).toContain('%26');
    });

    it('should properly encode unicode characters', () => {
      const event = createTestEvent({ title: 'Golf at Pebble Beach' });
      const url = generateGoogleCalendarUrl(event);

      // URL should be parseable
      expect(() => new URL(url)).not.toThrow();
    });

    it('should properly encode question marks and equals signs', () => {
      const event = createTestEvent({ description: 'Questions? Contact us at help=support' });

      const googleUrl = generateGoogleCalendarUrl(event);
      expect(() => new URL(googleUrl)).not.toThrow();

      const outlookUrl = generateOutlookUrl(event);
      expect(() => new URL(outlookUrl)).not.toThrow();

      const yahooUrl = generateYahooUrl(event);
      expect(() => new URL(yahooUrl)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string title', () => {
      const event = createTestEvent({ title: '' });
      expect(() => generateICS(event)).toThrow();
    });

    it('should handle very long titles', () => {
      const longTitle = 'Golf '.repeat(100);
      const event = createTestEvent({ title: longTitle });

      const ics = generateICS(event);
      expect(ics).toContain('SUMMARY:');

      // Verify line folding is applied
      const lines = ics.split('\r\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(75);
      }
    });

    it('should handle dates in different timezones', () => {
      // PST date
      const event = createTestEvent({
        startDate: new Date('2024-06-15T14:30:00-07:00'),
        endDate: new Date('2024-06-15T18:30:00-07:00')
      });

      const ics = generateICS(event);
      // Should be converted to UTC
      expect(ics).toContain('DTSTART:20240615T213000Z');
      expect(ics).toContain('DTEND:20240616T013000Z');
    });

    it('should handle dates at year boundaries', () => {
      const event = createTestEvent({
        startDate: new Date('2024-12-31T23:00:00Z'),
        endDate: new Date('2025-01-01T02:00:00Z')
      });

      const ics = generateICS(event);
      expect(ics).toContain('DTSTART:20241231T230000Z');
      expect(ics).toContain('DTEND:20250101T020000Z');
    });

    it('should handle minimum valid event', () => {
      const minimalEvent = {
        title: 'T',
        startDate: new Date('2024-06-15T14:30:00Z'),
        endDate: new Date('2024-06-15T15:30:00Z')
      };

      const ics = generateICS(minimalEvent);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('SUMMARY:T');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('should handle event with all optional fields', () => {
      const fullEvent = {
        title: 'Complete Event',
        description: 'Full description',
        location: 'Full location',
        startDate: new Date('2024-06-15T14:30:00Z'),
        endDate: new Date('2024-06-15T18:30:00Z'),
        url: 'https://example.com'
      };

      const ics = generateICS(fullEvent);
      expect(ics).toContain('SUMMARY:');
      expect(ics).toContain('DESCRIPTION:');
      expect(ics).toContain('LOCATION:');
      expect(ics).toContain('URL:');
    });
  });

  describe('ICS format compliance', () => {
    let testEvent;

    beforeEach(() => {
      testEvent = createTestEvent();
    });

    it('should produce valid ICS structure order', () => {
      const ics = generateICS(testEvent);
      const lines = ics.split('\r\n').filter(l => l && !l.startsWith(' '));

      // VCALENDAR must be first
      expect(lines[0]).toBe('BEGIN:VCALENDAR');

      // VERSION should come early
      expect(lines.indexOf('VERSION:2.0')).toBeGreaterThan(0);
      expect(lines.indexOf('VERSION:2.0')).toBeLessThan(lines.indexOf('BEGIN:VEVENT'));

      // VEVENT should be inside VCALENDAR
      expect(lines.indexOf('BEGIN:VEVENT')).toBeLessThan(lines.indexOf('END:VEVENT'));
      expect(lines.indexOf('END:VEVENT')).toBeLessThan(lines.indexOf('END:VCALENDAR'));

      // VCALENDAR must be last
      expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
    });

    it('should have matching BEGIN/END pairs', () => {
      const ics = generateICS(testEvent);

      const beginCalendar = (ics.match(/BEGIN:VCALENDAR/g) || []).length;
      const endCalendar = (ics.match(/END:VCALENDAR/g) || []).length;
      expect(beginCalendar).toBe(1);
      expect(endCalendar).toBe(1);

      const beginEvent = (ics.match(/BEGIN:VEVENT/g) || []).length;
      const endEvent = (ics.match(/END:VEVENT/g) || []).length;
      expect(beginEvent).toBe(1);
      expect(endEvent).toBe(1);
    });

    it('should not have empty lines in output', () => {
      const ics = generateICS(testEvent);
      const lines = ics.split('\r\n');

      // Filter out continuation lines (start with space)
      const nonContinuationLines = lines.filter(l => !l.startsWith(' '));

      // No empty lines allowed except potentially at the very end
      for (let i = 0; i < nonContinuationLines.length - 1; i++) {
        expect(nonContinuationLines[i]).not.toBe('');
      }
    });
  });
});
