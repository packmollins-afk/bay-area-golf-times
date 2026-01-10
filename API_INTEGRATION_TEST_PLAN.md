# Comprehensive API Integration Test Plan
## Bay Area Golf Tee Times - Live API Testing

**Document Version:** 1.0
**Last Updated:** 2026-01-09
**Target APIs:** LocationIQ, Open-Meteo, SunriseSunset.io, NOAA Tides, AirNow, Pexels, ICS Generation

---

## Table of Contents

1. [Bay Area Golf Course Test Coordinates](#1-bay-area-golf-course-test-coordinates)
2. [API Test Checklists](#2-api-test-checklists)
3. [Real API Endpoint Tests](#3-real-api-endpoint-tests)
4. [Performance Benchmarks](#4-performance-benchmarks)
5. [Error Scenario Testing](#5-error-scenario-testing)
6. [Regression Test Checklist](#6-regression-test-checklist)
7. [Browser Compatibility](#7-browser-compatibility)
8. [Test Execution Scripts](#8-test-execution-scripts)

---

## 1. Bay Area Golf Course Test Coordinates

### Primary Test Courses (Use for All API Tests)

| Course | City | Latitude | Longitude | Region | Notes |
|--------|------|----------|-----------|--------|-------|
| Half Moon Bay - Ocean Course | Half Moon Bay | 37.4328 | -122.4542 | Coastal | Tide-affected, strong coastal winds |
| TPC Harding Park | San Francisco | 37.7240 | -122.4930 | Urban Coastal | PGA venue, moderate coastal influence |
| Pebble Beach Golf Links | Pebble Beach | 36.5725 | -121.9486 | Monterey Coastal | Premium coastal, high winds |
| Presidio Golf Course | San Francisco | 37.7905 | -122.4657 | Urban | Fog-prone, microclimate |
| Tilden Park Golf Course | Berkeley | 37.8881 | -122.2441 | East Bay Hills | Elevation changes, inland weather |
| Cinnabar Hills Golf Club | San Jose | 37.2419 | -121.7750 | South Bay Inland | Warmer, less wind |
| Sharp Park Golf Course | Pacifica | 37.6239 | -122.4894 | Coastal | MacKenzie design, tidal influence |
| The Links at Bodega Harbour | Bodega Bay | 38.3340 | -123.0470 | North Coast | Most coastal, extreme wind exposure |

### NOAA Tide Station References

| Station ID | Location | Best For Courses |
|------------|----------|------------------|
| 9414290 | San Francisco | Harding Park, Lincoln Park, Sharp Park, Half Moon Bay |
| 9413450 | Monterey | Pebble Beach, Pacific Grove, Bayonet/Black Horse |
| 9415020 | Point Reyes | Bodega Harbour, North Bay coastal courses |

---

## 2. API Test Checklists

### 2.1 Open-Meteo Weather API

#### Functional Tests
- [ ] **OM-001:** Hourly forecast returns valid temperature data (Fahrenheit)
- [ ] **OM-002:** Hourly forecast returns wind speed in mph
- [ ] **OM-003:** Hourly forecast returns wind direction (0-360 degrees)
- [ ] **OM-004:** Hourly forecast returns precipitation probability (0-100%)
- [ ] **OM-005:** Hourly forecast returns cloud cover (0-100%)
- [ ] **OM-006:** Hourly forecast returns feels-like temperature
- [ ] **OM-007:** Daily forecast returns sunrise/sunset times
- [ ] **OM-008:** Daily forecast returns min/max temperatures
- [ ] **OM-009:** Timezone parameter correctly adjusts times to America/Los_Angeles
- [ ] **OM-010:** forecast_hours parameter limits response correctly (24, 48, 72 hours)
- [ ] **OM-011:** forecast_days parameter limits response correctly (1-16 days)
- [ ] **OM-012:** Combined hourly+daily request returns both datasets

#### Data Validation Tests
- [ ] **OM-013:** Temperature values are within reasonable range (-20F to 120F for Bay Area)
- [ ] **OM-014:** Wind speed values are non-negative (0-100 mph reasonable)
- [ ] **OM-015:** All array lengths match (time, temp, wind, etc. have same count)
- [ ] **OM-016:** Time strings are valid ISO 8601 format
- [ ] **OM-017:** Sunrise time is before sunset time for each day

#### Integration Tests
- [ ] **OM-018:** Playability score calculation produces valid scores (0-100)
- [ ] **OM-019:** Playability rating matches score thresholds (excellent >= 85, good >= 70, etc.)
- [ ] **OM-020:** Wind score penalizes high wind correctly (> 20 mph = lower score)
- [ ] **OM-021:** Precipitation score penalizes rain probability correctly
- [ ] **OM-022:** findBestTeeTime returns optimal hour within constraints
- [ ] **OM-023:** Weather data caches correctly (no duplicate requests within TTL)

### 2.2 SunriseSunset.io API

#### Functional Tests
- [ ] **SS-001:** Returns sunrise time in expected format (HH:MM:SS AM/PM)
- [ ] **SS-002:** Returns sunset time in expected format
- [ ] **SS-003:** Returns first_light (civil twilight begin)
- [ ] **SS-004:** Returns last_light (civil twilight end)
- [ ] **SS-005:** Returns golden_hour time
- [ ] **SS-006:** Returns day_length in HH:MM:SS format
- [ ] **SS-007:** Date parameter accepts "today", "tomorrow", "YYYY-MM-DD"
- [ ] **SS-008:** Future dates return valid predictions (up to 365 days)

#### Data Validation Tests
- [ ] **SS-009:** first_light is before sunrise
- [ ] **SS-010:** sunrise is before golden_hour
- [ ] **SS-011:** golden_hour is before sunset
- [ ] **SS-012:** sunset is before last_light
- [ ] **SS-013:** Day length varies correctly by season (shorter in winter)
- [ ] **SS-014:** Times adjust correctly for different coordinates

#### Golf-Specific Tests
- [ ] **SS-015:** Playable window calculation (first_light to last_light) is accurate
- [ ] **SS-016:** Golden hour alerts trigger at correct time for sunset rounds
- [ ] **SS-017:** Winter vs summer day length difference is > 4 hours

### 2.3 NOAA Tides API

#### Functional Tests
- [ ] **NT-001:** Returns tide predictions for valid station (9414290)
- [ ] **NT-002:** Returns High (H) and Low (L) tide types
- [ ] **NT-003:** Returns tide height in feet (v field)
- [ ] **NT-004:** Returns time in local timezone (lst_ldt parameter)
- [ ] **NT-005:** Date range query returns multiple predictions
- [ ] **NT-006:** MLLW datum returns consistent baseline heights

#### Data Validation Tests
- [ ] **NT-007:** High tides have greater v values than adjacent low tides
- [ ] **NT-008:** Typically 2 high and 2 low tides per day (semi-diurnal)
- [ ] **NT-009:** Tide times are within expected range (not null/empty)
- [ ] **NT-010:** Height values are within typical range (-2 to 8 feet for SF Bay)

#### Golf-Specific Integration Tests
- [ ] **NT-011:** High tide correlation with wind condition flagged correctly
- [ ] **NT-012:** Low tide + morning = "calm window" alert triggers
- [ ] **NT-013:** Tide data displays correctly on coastal course pages
- [ ] **NT-014:** Non-coastal courses do not show tide information

### 2.4 EPA AirNow API

#### Functional Tests
- [ ] **AQ-001:** Returns current AQI for valid coordinates
- [ ] **AQ-002:** Returns AQI category name (Good, Moderate, etc.)
- [ ] **AQ-003:** Returns pollutant type (O3, PM2.5, PM10, etc.)
- [ ] **AQ-004:** Distance parameter filters to nearest monitoring station
- [ ] **AQ-005:** DateObserved and HourObserved fields are current

#### Data Validation Tests
- [ ] **AQ-006:** AQI value is within valid range (0-500)
- [ ] **AQ-007:** Category number matches AQI value brackets
  - 1: Good (0-50)
  - 2: Moderate (51-100)
  - 3: Unhealthy for Sensitive (101-150)
  - 4: Unhealthy (151-200)
  - 5: Very Unhealthy (201-300)
  - 6: Hazardous (301-500)
- [ ] **AQ-008:** Response is valid JSON array (may be empty if no data)

#### Golf-Specific Integration Tests
- [ ] **AQ-009:** AQI > 100 triggers health warning on booking page
- [ ] **AQ-010:** AQI > 150 suggests rescheduling in UI
- [ ] **AQ-011:** AQI widget displays color-coded indicator
- [ ] **AQ-012:** Wildfire smoke events (common Bay Area summer) handled gracefully

### 2.5 LocationIQ Geocoding API

#### Functional Tests (Forward Geocoding)
- [ ] **LQ-001:** Search by course name returns coordinates
- [ ] **LQ-002:** Search by address returns coordinates
- [ ] **LQ-003:** Returns display_name with formatted address
- [ ] **LQ-004:** Returns lat/lon as strings (need to parse to float)
- [ ] **LQ-005:** format=json returns proper JSON response

#### Functional Tests (Reverse Geocoding)
- [ ] **LQ-006:** Coordinates return nearby address
- [ ] **LQ-007:** Returns city, state, country breakdown
- [ ] **LQ-008:** Works for all 8 test course coordinates

#### Data Validation Tests
- [ ] **LQ-009:** Returned coordinates are within Bay Area bounds
  - Latitude: 36.0 to 39.0
  - Longitude: -123.5 to -121.0
- [ ] **LQ-010:** Course name searches return relevant golf-related results
- [ ] **LQ-011:** Rate limiting respected (2 requests/second on free tier)

#### Integration Tests
- [ ] **LQ-012:** User location detection feeds into "courses near me" search
- [ ] **LQ-013:** Geocoded addresses stored in database for faster lookup
- [ ] **LQ-014:** Invalid addresses return graceful error, not crash

### 2.6 Pexels API

#### Functional Tests
- [ ] **PX-001:** Search for "golf course" returns photo results
- [ ] **PX-002:** Response includes src.original, src.large, src.medium URLs
- [ ] **PX-003:** Response includes photographer attribution
- [ ] **PX-004:** per_page parameter limits results correctly
- [ ] **PX-005:** Authorization header with API key is accepted

#### Data Validation Tests
- [ ] **PX-006:** Image URLs are valid and accessible (return 200)
- [ ] **PX-007:** Photo IDs are unique within response
- [ ] **PX-008:** alt text is present for accessibility

#### Integration Tests
- [ ] **PX-009:** Golf imagery displays on course pages without own hosting
- [ ] **PX-010:** Fallback image shows when API fails
- [ ] **PX-011:** Photographer credit displays per Pexels requirements
- [ ] **PX-012:** Images cached client-side to reduce API calls

### 2.7 ICS Calendar Generation

#### Functional Tests
- [ ] **IC-001:** Generated ICS file is valid per RFC 5545
- [ ] **IC-002:** Event contains SUMMARY with course name
- [ ] **IC-003:** Event contains DTSTART and DTEND
- [ ] **IC-004:** Event contains LOCATION with course address
- [ ] **IC-005:** Event contains DESCRIPTION with booking details
- [ ] **IC-006:** Event contains URL back to booking confirmation
- [ ] **IC-007:** Timezone (America/Los_Angeles) is correctly encoded

#### Data Validation Tests
- [ ] **IC-008:** DTSTART is before DTEND
- [ ] **IC-009:** Event duration is reasonable (3-5 hours for round of golf)
- [ ] **IC-010:** UID is unique for each generated event
- [ ] **IC-011:** Special characters in course name are properly escaped

#### Integration Tests
- [ ] **IC-012:** Download triggers file save dialog in browser
- [ ] **IC-013:** File imports successfully into Google Calendar
- [ ] **IC-014:** File imports successfully into Apple Calendar
- [ ] **IC-015:** File imports successfully into Outlook
- [ ] **IC-016:** Add-to-calendar button generates correct deep links

---

## 3. Real API Endpoint Tests

### 3.1 Open-Meteo Test Cases

#### Test Case: OM-TC-001 - Hourly Forecast for Half Moon Bay
```
Endpoint: https://api.open-meteo.com/v1/forecast
Method: GET
Parameters:
  - latitude: 37.4328
  - longitude: -122.4542
  - hourly: temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,cloud_cover
  - temperature_unit: fahrenheit
  - wind_speed_unit: mph
  - timezone: America/Los_Angeles
  - forecast_hours: 48

Expected Response:
- Status: 200 OK
- Content-Type: application/json
- Body contains: hourly.time[] with 48 elements
- Body contains: hourly.temperature_2m[] with 48 numeric values
- All temperature values between 30-90F (reasonable for Half Moon Bay)
- All wind_speed values between 0-50 mph (typical coastal)
```

#### Test Case: OM-TC-002 - Daily Forecast for Pebble Beach
```
Endpoint: https://api.open-meteo.com/v1/forecast
Method: GET
Parameters:
  - latitude: 36.5725
  - longitude: -121.9486
  - daily: temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max
  - temperature_unit: fahrenheit
  - wind_speed_unit: mph
  - timezone: America/Los_Angeles
  - forecast_days: 7

Expected Response:
- Status: 200 OK
- daily.time[] has 7 date strings
- daily.sunrise[] has 7 ISO datetime strings
- daily.sunset[] has 7 ISO datetime strings
- Each sunrise is before corresponding sunset
```

#### Test Case: OM-TC-003 - Playability Score Calculation
```
Input Weather Data:
  - temperature: 72F
  - windSpeed: 8 mph
  - precipitationProbability: 10%
  - cloudCover: 35%

Expected Playability Output:
  - score: >= 80 (good to excellent conditions)
  - rating: "good" or "excellent"
  - factors.temperature: >= 90 (ideal range)
  - factors.wind: >= 80 (low wind)
  - factors.precipitation: >= 90 (low rain chance)
  - summary: contains positive message
```

### 3.2 SunriseSunset.io Test Cases

#### Test Case: SS-TC-001 - Today's Daylight for Harding Park
```
Endpoint: https://api.sunrisesunset.io/json
Method: GET
Parameters:
  - lat: 37.7240
  - lng: -122.4930
  - date: today

Expected Response:
- Status: 200 OK
- results.status: "OK"
- results.sunrise: matches pattern "H:MM:SS AM"
- results.sunset: matches pattern "H:MM:SS PM"
- results.first_light: earlier than sunrise
- results.golden_hour: between 1-2 hours before sunset
- results.day_length: matches pattern "HH:MM:SS"
```

#### Test Case: SS-TC-002 - Summer vs Winter Day Length Comparison
```
Test 1 (Winter - January 9):
  - lat: 37.4328, lng: -122.4542
  - date: 2026-01-09
  - Expected day_length: approximately 9:30:00 to 10:30:00

Test 2 (Summer - June 21):
  - lat: 37.4328, lng: -122.4542
  - date: 2026-06-21
  - Expected day_length: approximately 14:30:00 to 15:00:00

Validation: Summer day_length - Winter day_length > 4 hours
```

### 3.3 NOAA Tides Test Cases

#### Test Case: NT-TC-001 - San Francisco Bay Tides
```
Endpoint: https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
Method: GET
Parameters:
  - begin_date: 20260109
  - end_date: 20260110
  - station: 9414290
  - product: predictions
  - datum: MLLW
  - time_zone: lst_ldt
  - interval: hilo
  - units: english
  - format: json

Expected Response:
- Status: 200 OK
- predictions[]: array with 4-6 entries (2 days of tides)
- Each prediction has: t (datetime), v (height in ft), type (H or L)
- Alternating H and L types
- v values range: -2.0 to 8.0 feet
```

#### Test Case: NT-TC-002 - Monterey Station for Pebble Beach
```
Endpoint: https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
Method: GET
Parameters:
  - station: 9413450
  - begin_date: 20260109
  - end_date: 20260109
  - product: predictions
  - datum: MLLW
  - time_zone: lst_ldt
  - interval: hilo
  - units: english
  - format: json

Expected Response:
- Status: 200 OK
- predictions[]: 2-3 entries for single day
- All entries have valid t, v, type fields
```

### 3.4 AirNow Test Cases

#### Test Case: AQ-TC-001 - Current AQI for San Jose
```
Endpoint: https://www.airnowapi.org/aq/observation/latLong/current/
Method: GET
Parameters:
  - format: application/json
  - latitude: 37.2419
  - longitude: -121.7750
  - distance: 25
  - API_KEY: [your_key]

Expected Response:
- Status: 200 OK
- Response is JSON array (may be empty if no current data)
- If data present:
  - [0].AQI: number between 0-500
  - [0].Category.Number: 1-6
  - [0].Category.Name: one of defined category names
  - [0].ParameterName: "O3" or "PM2.5" or "PM10"
```

#### Test Case: AQ-TC-002 - Multiple Pollutant Response
```
Endpoint: https://www.airnowapi.org/aq/observation/latLong/current/
Method: GET
Parameters:
  - latitude: 37.7240
  - longitude: -122.4930
  - distance: 50
  - API_KEY: [your_key]

Expected Response:
- May return multiple array entries for different pollutants
- Use highest AQI value for display
- Primary pollutant indicated in response
```

### 3.5 LocationIQ Test Cases

#### Test Case: LQ-TC-001 - Forward Geocoding Golf Course
```
Endpoint: https://us1.locationiq.com/v1/search
Method: GET
Parameters:
  - key: [your_key]
  - q: Half Moon Bay Golf Links
  - format: json

Expected Response:
- Status: 200 OK
- Array with at least 1 result
- [0].lat: approximately "37.43" (string)
- [0].lon: approximately "-122.45" (string)
- [0].display_name: contains "Half Moon Bay"
```

#### Test Case: LQ-TC-002 - Reverse Geocoding from Coordinates
```
Endpoint: https://us1.locationiq.com/v1/reverse
Method: GET
Parameters:
  - key: [your_key]
  - lat: 37.7240
  - lon: -122.4930
  - format: json

Expected Response:
- Status: 200 OK
- display_name: contains "San Francisco"
- address.city: "San Francisco" or similar
- address.state: "California"
```

### 3.6 Pexels Test Cases

#### Test Case: PX-TC-001 - Search Golf Course Images
```
Endpoint: https://api.pexels.com/v1/search
Method: GET
Headers:
  - Authorization: [your_api_key]
Parameters:
  - query: golf course bay area
  - per_page: 10
  - orientation: landscape

Expected Response:
- Status: 200 OK
- photos[]: array with up to 10 items
- Each photo has:
  - id: unique number
  - src.original: valid URL
  - src.large: valid URL (for page display)
  - src.medium: valid URL (for thumbnails)
  - photographer: non-empty string
  - alt: descriptive text
```

### 3.7 ICS Generation Test Cases

#### Test Case: IC-TC-001 - Generate Valid ICS for Tee Time
```
Input:
  - courseName: "Half Moon Bay - Ocean Course"
  - date: "2026-01-15"
  - time: "08:00"
  - duration: 4 hours
  - location: "2 Miramontes Point Rd, Half Moon Bay, CA 94019"
  - bookingId: "HMB-12345"

Expected ICS Output:
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Bay Area Golf//EN
BEGIN:VEVENT
UID:HMB-12345@bayareagolf.now
DTSTAMP:20260109T...
DTSTART;TZID=America/Los_Angeles:20260115T080000
DTEND;TZID=America/Los_Angeles:20260115T120000
SUMMARY:Tee Time at Half Moon Bay - Ocean Course
LOCATION:2 Miramontes Point Rd, Half Moon Bay, CA 94019
DESCRIPTION:Booking #HMB-12345...
URL:https://bayareagolf.now/booking/HMB-12345
END:VEVENT
END:VCALENDAR

Validation:
- File parses without error in icalendar validators
- DTSTART and DTEND reflect correct timezone
- Duration is 4 hours
```

---

## 4. Performance Benchmarks

### 4.1 Response Time Targets

| API | Target P50 | Target P95 | Max Acceptable | Notes |
|-----|------------|------------|----------------|-------|
| Open-Meteo | < 200ms | < 500ms | 2000ms | No auth, should be fast |
| SunriseSunset.io | < 150ms | < 400ms | 1500ms | Simple calculation API |
| NOAA Tides | < 300ms | < 800ms | 3000ms | Government infrastructure |
| AirNow | < 400ms | < 1000ms | 3000ms | Government infrastructure |
| LocationIQ | < 250ms | < 600ms | 2000ms | CDN-backed geocoder |
| Pexels | < 300ms | < 700ms | 2000ms | CDN for images |
| ICS Generation | < 50ms | < 100ms | 500ms | Local generation |

### 4.2 Performance Test Script
```javascript
// performance-test.js
const endpoints = [
  {
    name: 'Open-Meteo Hourly',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=37.4328&longitude=-122.4542&hourly=temperature_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_hours=24',
    method: 'GET'
  },
  {
    name: 'SunriseSunset',
    url: 'https://api.sunrisesunset.io/json?lat=37.4328&lng=-122.4542&date=today',
    method: 'GET'
  },
  {
    name: 'NOAA Tides',
    url: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=20260109&end_date=20260109&station=9414290&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&format=json',
    method: 'GET'
  }
];

async function runPerformanceTest(iterations = 10) {
  for (const endpoint of endpoints) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await fetch(endpoint.url);
        const duration = performance.now() - start;
        times.push(duration);
      } catch (e) {
        console.error(`${endpoint.name} failed:`, e.message);
      }
      // Rate limit protection
      await new Promise(r => setTimeout(r, 200));
    }

    times.sort((a, b) => a - b);
    console.log(`${endpoint.name}:`);
    console.log(`  P50: ${times[Math.floor(times.length * 0.5)].toFixed(0)}ms`);
    console.log(`  P95: ${times[Math.floor(times.length * 0.95)].toFixed(0)}ms`);
    console.log(`  Max: ${Math.max(...times).toFixed(0)}ms`);
  }
}
```

### 4.3 Concurrent Request Load Test
```javascript
// Simulate 10 concurrent users loading course weather
async function loadTest() {
  const courses = [
    { lat: 37.4328, lon: -122.4542 }, // Half Moon Bay
    { lat: 37.7240, lon: -122.4930 }, // Harding Park
    { lat: 36.5725, lon: -121.9486 }, // Pebble Beach
    { lat: 37.7905, lon: -122.4657 }, // Presidio
    { lat: 37.8881, lon: -122.2441 }, // Tilden Park
  ];

  const start = performance.now();

  await Promise.all(courses.map(async (course) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${course.lat}&longitude=${course.lon}&hourly=temperature_2m&forecast_hours=24`;
    await fetch(url);
  }));

  const duration = performance.now() - start;
  console.log(`5 concurrent weather requests: ${duration.toFixed(0)}ms`);
  // Target: < 1000ms for all 5 to complete
}
```

---

## 5. Error Scenario Testing

### 5.1 Network Failure Tests

#### Test: NET-001 - API Timeout Handling
```javascript
// Simulate slow network with AbortController
async function testTimeout() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=37.4328&longitude=-122.4542&hourly=temperature_2m',
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    return { success: true, data: await response.json() };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: { code: 'NETWORK_ERROR', message: 'Request timed out' }};
    }
    throw error;
  }
}

Expected Behavior:
- Returns error object, not throw
- UI shows "Weather data temporarily unavailable"
- Retry button appears
- Cached data used if available
```

#### Test: NET-002 - DNS Resolution Failure
```
Scenario: API domain unreachable
Mock: Intercept requests to api.open-meteo.com, return network error

Expected Behavior:
- Error caught and logged
- Fallback message displayed
- No crash or white screen
- Graceful degradation (show course info without weather)
```

#### Test: NET-003 - Partial Response / Connection Reset
```
Scenario: Connection drops mid-response
Mock: Return partial JSON then close connection

Expected Behavior:
- JSON parse error caught
- User sees "Connection interrupted, retrying..."
- Automatic retry (up to 3 attempts)
- Exponential backoff between retries
```

### 5.2 Rate Limit Tests

#### Test: RATE-001 - Open-Meteo Rate Limiting
```
Scenario: Exceed 10,000 requests/day quota

Expected Response:
- HTTP 429 Too Many Requests
- Response body may include retry-after

Expected Behavior:
- Log rate limit hit
- Display cached weather if available
- Show "Weather updates temporarily paused"
- Implement request queuing for next day
```

#### Test: RATE-002 - LocationIQ Rate Limiting (2 req/sec)
```javascript
// Test rapid-fire requests
async function testLocationIQRateLimit() {
  const requests = [];
  for (let i = 0; i < 10; i++) {
    requests.push(
      fetch(`https://us1.locationiq.com/v1/search?key=${API_KEY}&q=golf+course+${i}&format=json`)
    );
  }

  const results = await Promise.allSettled(requests);
  const rateLimited = results.filter(r =>
    r.status === 'rejected' || r.value?.status === 429
  ).length;

  console.log(`Rate limited: ${rateLimited}/10 requests`);
  // Expect: At least 8/10 rate limited (only ~2 should succeed)
}

Expected Behavior:
- Implement request debouncing (min 500ms between geocode calls)
- Queue requests and process at allowed rate
- Show loading state during queue processing
```

#### Test: RATE-003 - Pexels Rate Limiting (200 req/hour)
```
Scenario: Image search rate limit exceeded

Expected Behavior:
- Return cached images for popular searches
- Fall back to placeholder golf images
- Log warning for monitoring
- Resume normal operation after cooldown
```

#### Test: RATE-004 - AirNow Rate Limiting (500 req/hour)
```
Scenario: AQI requests exceed hourly quota

Expected Behavior:
- Cache AQI data for 30 minutes minimum
- Share AQI across nearby courses (< 10 miles)
- Display "AQI data updating..." when rate limited
- Critical: Never block page load for AQI
```

### 5.3 Invalid Data Tests

#### Test: DATA-001 - Invalid Coordinates
```javascript
const invalidCoords = [
  { lat: 91, lon: -122, error: 'INVALID_COORDINATES' },  // lat out of range
  { lat: 37, lon: -181, error: 'INVALID_COORDINATES' },  // lon out of range
  { lat: 'abc', lon: -122, error: 'INVALID_COORDINATES' }, // non-numeric
  { lat: null, lon: null, error: 'INVALID_COORDINATES' },  // null values
];

invalidCoords.forEach(async ({ lat, lon, error }) => {
  const result = await getHourlyForecast({ latitude: lat, longitude: lon });
  console.assert(result.success === false);
  console.assert(result.error.code === error);
});
```

#### Test: DATA-002 - Malformed API Response
```javascript
// Mock API returning invalid JSON
const malformedResponses = [
  '{"hourly": }',  // Invalid JSON
  '{"hourly": {"time": []}}',  // Empty arrays
  '{"hourly": {"time": ["2026-01-09"], "temperature_2m": []}}',  // Mismatched lengths
  null,  // Null response
];

Expected Behavior:
- Each case caught without crash
- Error logged with response body for debugging
- User sees friendly "Weather data unavailable"
- No partial/broken data displayed
```

#### Test: DATA-003 - Unexpected Data Types
```javascript
// Test type coercion issues
const unexpectedTypes = {
  temperature: "72",  // String instead of number
  windSpeed: null,     // Null instead of number
  precipProb: -5,      // Negative percentage
  cloudCover: 150,     // Over 100%
};

Expected Behavior:
- String numbers parsed correctly
- Null values replaced with "N/A" or default
- Out-of-range values clamped to valid range
- Type errors never shown to user
```

#### Test: DATA-004 - Empty/Missing API Response
```javascript
// Test handling of empty responses
const emptyScenarios = [
  { api: 'NOAA', response: { predictions: [] } },
  { api: 'AirNow', response: [] },
  { api: 'Pexels', response: { photos: [] } },
];

Expected Behavior:
- Each empty case handled without error
- Appropriate "No data available" messages
- UI doesn't break (no "undefined" text)
```

### 5.4 API Unavailability Tests

#### Test: AVAIL-001 - Open-Meteo Downtime
```
Scenario: Open-Meteo API returns 500/502/503

Expected Behavior:
- Show last cached weather (with "Updated X ago" timestamp)
- If no cache: "Weather service temporarily unavailable"
- Background retry every 5 minutes
- Alert if downtime > 30 minutes
```

#### Test: AVAIL-002 - NOAA Maintenance Window
```
NOAA occasionally has scheduled maintenance

Expected Behavior:
- Tide section shows "Tide data updating"
- Hide tide info rather than show stale data
- Check NOAA status page link provided
- Log maintenance periods for pattern analysis
```

#### Test: AVAIL-003 - AirNow Sensor Outage
```
Scenario: No AQI data for region (sensor offline)

Expected Behavior:
- Show "AQI data unavailable for this area"
- Don't show outdated AQI (> 2 hours old)
- Suggest checking airnow.gov directly
- Log which regions have data gaps
```

---

## 6. Regression Test Checklist

### 6.1 Core Booking Flow Tests

- [ ] **REG-001:** Homepage map loads with all course markers
- [ ] **REG-002:** Course search returns results for "Harding Park"
- [ ] **REG-003:** Course page displays correct course info (name, par, yardage)
- [ ] **REG-004:** Tee time list populates for next 7 days
- [ ] **REG-005:** Price sorting (low to high) works correctly
- [ ] **REG-006:** Time filtering (morning/afternoon/twilight) works
- [ ] **REG-007:** Date picker navigates forward/backward correctly
- [ ] **REG-008:** "Book Now" button links to correct booking system
- [ ] **REG-009:** Booking confirmation page displays all details
- [ ] **REG-010:** "Add to Calendar" button generates valid ICS file

### 6.2 Weather Integration Regression

- [ ] **REG-011:** Weather widget appears on course pages
- [ ] **REG-012:** Playability score displays (0-100 scale)
- [ ] **REG-013:** Playability badge shows correct color (green/yellow/red)
- [ ] **REG-014:** Weather forecast shows next 48 hours
- [ ] **REG-015:** "Best time to play" recommendation displays
- [ ] **REG-016:** Wind direction shows with arrow icon
- [ ] **REG-017:** Weather data updates without page refresh
- [ ] **REG-018:** Weather fails gracefully when API unavailable

### 6.3 Tide Integration Regression (Coastal Courses Only)

- [ ] **REG-019:** Tide info appears on Half Moon Bay course page
- [ ] **REG-020:** Tide info appears on Harding Park course page
- [ ] **REG-021:** Tide info appears on Pebble Beach course page
- [ ] **REG-022:** Tide info does NOT appear on Tilden Park (inland)
- [ ] **REG-023:** High/low tide times display correctly
- [ ] **REG-024:** "Calm window" indicator shows when conditions align

### 6.4 Air Quality Regression

- [ ] **REG-025:** AQI badge displays on all course pages
- [ ] **REG-026:** AQI color matches category (green=good, yellow=moderate, etc.)
- [ ] **REG-027:** AQI health warning appears when > 100
- [ ] **REG-028:** AQI tooltip shows pollutant type
- [ ] **REG-029:** AQI updates at least hourly

### 6.5 User Account Regression

- [ ] **REG-030:** Login with email/password works
- [ ] **REG-031:** Password reset email sends correctly
- [ ] **REG-032:** Saved courses appear in user profile
- [ ] **REG-033:** Booking history shows past tee times
- [ ] **REG-034:** Email preferences can be updated
- [ ] **REG-035:** Account deletion removes all user data

### 6.6 Mobile/Responsive Regression

- [ ] **REG-036:** Homepage map is draggable on touch devices
- [ ] **REG-037:** Course page layout adapts to mobile width
- [ ] **REG-038:** Tee time cards are tap-friendly (min 44x44px)
- [ ] **REG-039:** Date picker is usable on mobile
- [ ] **REG-040:** Weather widget stacks vertically on narrow screens

### 6.7 Performance Regression

- [ ] **REG-041:** Homepage loads in < 3 seconds (LCP)
- [ ] **REG-042:** Course page loads in < 2 seconds
- [ ] **REG-043:** Search results appear in < 1 second
- [ ] **REG-044:** Weather data loads in < 500ms after page load
- [ ] **REG-045:** No layout shift during weather/tide data load

---

## 7. Browser Compatibility

### 7.1 Supported Browsers

| Browser | Minimum Version | Test Priority |
|---------|----------------|---------------|
| Chrome | 90+ | High |
| Safari | 14+ | High |
| Firefox | 88+ | Medium |
| Edge | 90+ | Medium |
| Safari iOS | 14+ | High |
| Chrome Android | 90+ | High |
| Samsung Internet | 14+ | Low |

### 7.2 Browser-Specific Test Cases

#### Test: BROWSER-001 - Fetch API Support
```javascript
// All target browsers support fetch, but verify error handling
if (!window.fetch) {
  console.error('Fetch API not supported');
  // Show upgrade browser message
}
```

#### Test: BROWSER-002 - AbortController Support
```javascript
// Required for request timeouts
// Supported in all target browsers, but verify
if (!window.AbortController) {
  console.warn('AbortController not supported, timeouts disabled');
}
```

#### Test: BROWSER-003 - Geolocation API
```javascript
// For "courses near me" feature
if (!navigator.geolocation) {
  // Hide "Near Me" button
  // Fall back to manual location entry
}
```

#### Test: BROWSER-004 - Local Storage for Caching
```javascript
// Used for weather data caching
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
} catch (e) {
  console.warn('LocalStorage not available, using memory cache');
}
```

#### Test: BROWSER-005 - Date/Time Formatting
```javascript
// Verify Intl.DateTimeFormat for consistent time display
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'America/Los_Angeles'
});

console.log(timeFormatter.format(new Date()));
// Expected: "2:30 PM" format
```

### 7.3 Progressive Enhancement Checklist

- [ ] **PE-001:** Core booking works without JavaScript (server-rendered fallback)
- [ ] **PE-002:** Weather widget shows "Loading..." then populates
- [ ] **PE-003:** Map shows static image if WebGL unavailable
- [ ] **PE-004:** ICS download works in all browsers
- [ ] **PE-005:** Form validation uses HTML5 attributes as baseline

### 7.4 Accessibility Considerations

- [ ] **A11Y-001:** Weather data has text alternatives (not just icons)
- [ ] **A11Y-002:** AQI colors have text labels too
- [ ] **A11Y-003:** Tide times are readable by screen readers
- [ ] **A11Y-004:** Playability score announced (e.g., "85 out of 100")
- [ ] **A11Y-005:** Loading states announced to screen readers

---

## 8. Test Execution Scripts

### 8.1 Full Integration Test Suite

```javascript
// test/integration/api-integration.test.js
const assert = require('assert');

const TEST_COURSES = {
  halfMoonBay: { lat: 37.4328, lon: -122.4542, name: 'Half Moon Bay' },
  hardingPark: { lat: 37.7240, lon: -122.4930, name: 'Harding Park' },
  pebbleBeach: { lat: 36.5725, lon: -121.9486, name: 'Pebble Beach' },
  tildenPark: { lat: 37.8881, lon: -122.2441, name: 'Tilden Park' },
};

async function runAllTests() {
  console.log('=== Bay Area Golf API Integration Tests ===\n');

  let passed = 0;
  let failed = 0;

  // Open-Meteo Tests
  console.log('--- Open-Meteo Weather API ---');
  for (const [id, course] of Object.entries(TEST_COURSES)) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${course.lat}&longitude=${course.lon}&hourly=temperature_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_hours=24`;
      const response = await fetch(url);
      const data = await response.json();

      assert(response.status === 200, `HTTP 200 expected, got ${response.status}`);
      assert(data.hourly?.time?.length === 24, 'Should have 24 hourly entries');
      assert(data.hourly?.temperature_2m?.length === 24, 'Should have 24 temp entries');

      console.log(`  [PASS] Open-Meteo: ${course.name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] Open-Meteo: ${course.name} - ${e.message}`);
      failed++;
    }
  }

  // SunriseSunset Tests
  console.log('\n--- SunriseSunset.io API ---');
  for (const [id, course] of Object.entries(TEST_COURSES)) {
    try {
      const url = `https://api.sunrisesunset.io/json?lat=${course.lat}&lng=${course.lon}&date=today`;
      const response = await fetch(url);
      const data = await response.json();

      assert(response.status === 200, `HTTP 200 expected`);
      assert(data.results?.sunrise, 'Should have sunrise');
      assert(data.results?.sunset, 'Should have sunset');
      assert(data.results?.golden_hour, 'Should have golden_hour');

      console.log(`  [PASS] SunriseSunset: ${course.name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] SunriseSunset: ${course.name} - ${e.message}`);
      failed++;
    }
  }

  // NOAA Tides Tests (coastal courses only)
  console.log('\n--- NOAA Tides API ---');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  try {
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${today}&end_date=${today}&station=9414290&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&format=json`;
    const response = await fetch(url);
    const data = await response.json();

    assert(response.status === 200, `HTTP 200 expected`);
    assert(Array.isArray(data.predictions), 'Should have predictions array');
    assert(data.predictions.length >= 2, 'Should have at least 2 tide entries');

    console.log(`  [PASS] NOAA Tides: San Francisco station`);
    passed++;
  } catch (e) {
    console.log(`  [FAIL] NOAA Tides - ${e.message}`);
    failed++;
  }

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  return { passed, failed };
}

runAllTests();
```

### 8.2 Quick Smoke Test (Pre-Deployment)

```bash
#!/bin/bash
# smoke-test.sh - Run before each deployment

echo "=== Pre-Deployment Smoke Test ==="

# Test Open-Meteo
echo -n "Open-Meteo API: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://api.open-meteo.com/v1/forecast?latitude=37.4328&longitude=-122.4542&hourly=temperature_2m")
if [ "$STATUS" = "200" ]; then echo "OK"; else echo "FAIL ($STATUS)"; exit 1; fi

# Test SunriseSunset
echo -n "SunriseSunset API: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://api.sunrisesunset.io/json?lat=37.4328&lng=-122.4542&date=today")
if [ "$STATUS" = "200" ]; then echo "OK"; else echo "FAIL ($STATUS)"; exit 1; fi

# Test NOAA
echo -n "NOAA Tides API: "
DATE=$(date +%Y%m%d)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=$DATE&end_date=$DATE&station=9414290&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&format=json")
if [ "$STATUS" = "200" ]; then echo "OK"; else echo "FAIL ($STATUS)"; exit 1; fi

echo ""
echo "All smoke tests passed! Safe to deploy."
```

### 8.3 Continuous Monitoring Script

```javascript
// monitoring/api-health.js
// Run every 5 minutes via cron

const endpoints = [
  {
    name: 'Open-Meteo',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=37.4328&longitude=-122.4542&hourly=temperature_2m',
    timeout: 5000,
    critical: true
  },
  {
    name: 'SunriseSunset',
    url: 'https://api.sunrisesunset.io/json?lat=37.4328&lng=-122.4542&date=today',
    timeout: 5000,
    critical: true
  },
  {
    name: 'NOAA Tides',
    url: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=20260109&end_date=20260109&station=9414290&product=predictions&format=json',
    timeout: 10000,
    critical: false
  },
  {
    name: 'AirNow',
    url: 'https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=37.4328&longitude=-122.4542&distance=25&API_KEY=' + process.env.AIRNOW_API_KEY,
    timeout: 10000,
    critical: false
  }
];

async function checkHealth() {
  const results = [];

  for (const endpoint of endpoints) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout);

      const response = await fetch(endpoint.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const latency = Date.now() - start;

      results.push({
        name: endpoint.name,
        status: response.status === 200 ? 'UP' : 'DEGRADED',
        latency,
        httpStatus: response.status,
        critical: endpoint.critical
      });
    } catch (error) {
      results.push({
        name: endpoint.name,
        status: 'DOWN',
        error: error.message,
        critical: endpoint.critical
      });
    }
  }

  // Log results
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    results
  }));

  // Alert on critical failures
  const criticalDown = results.filter(r => r.critical && r.status === 'DOWN');
  if (criticalDown.length > 0) {
    // Send alert (Slack, PagerDuty, email, etc.)
    console.error('CRITICAL API FAILURE:', criticalDown.map(r => r.name).join(', '));
  }
}

checkHealth();
```

---

## Appendix A: API Key Requirements

| API | Key Required | Free Tier | How to Obtain |
|-----|--------------|-----------|---------------|
| Open-Meteo | No | 10,000/day | N/A |
| SunriseSunset.io | No | Unlimited | N/A |
| NOAA Tides | No | Unlimited | N/A |
| AirNow | Yes | 500/hour | https://docs.airnowapi.org/account/request/ |
| LocationIQ | Yes | 5,000/day | https://locationiq.com/register |
| Pexels | Yes | 200/hour | https://www.pexels.com/api/ |

---

## Appendix B: Error Code Reference

| Code | Description | User Message | Action |
|------|-------------|--------------|--------|
| NETWORK_ERROR | Request failed/timeout | "Unable to load data. Check your connection." | Retry with backoff |
| API_ERROR | Non-200 HTTP response | "Service temporarily unavailable." | Use cached data |
| RATE_LIMITED | 429 response | "High traffic. Data updating shortly." | Exponential backoff |
| INVALID_COORDINATES | Bad lat/lon input | "Invalid location. Please try again." | Validate input |
| PARSE_ERROR | Invalid JSON response | "Data format error. Retrying..." | Log and retry |
| NO_DATA | Empty valid response | "No data available for this location." | Show N/A UI |

---

## Appendix C: Test Data - Expected Ranges

### Temperature (Fahrenheit) by Season - Bay Area

| Season | Coastal Min | Coastal Max | Inland Min | Inland Max |
|--------|-------------|-------------|------------|------------|
| Winter | 45 | 60 | 40 | 65 |
| Spring | 50 | 65 | 50 | 75 |
| Summer | 55 | 70 | 60 | 95 |
| Fall | 50 | 70 | 55 | 85 |

### Wind Speed Expectations (mph)

| Location Type | Calm | Moderate | High | Extreme |
|--------------|------|----------|------|---------|
| Coastal (HMB, Pebble) | 0-5 | 6-15 | 16-25 | 25+ |
| Urban Coastal (Harding) | 0-5 | 6-12 | 13-20 | 20+ |
| Inland (Tilden, Cinnabar) | 0-3 | 4-10 | 11-18 | 18+ |

### Tide Height Ranges (feet, MLLW datum)

| Station | Low Tide Min | Low Tide Max | High Tide Min | High Tide Max |
|---------|--------------|--------------|---------------|---------------|
| SF Bay (9414290) | -1.5 | 2.5 | 4.0 | 7.5 |
| Monterey (9413450) | -1.0 | 2.0 | 3.5 | 6.5 |

---

*Document maintained by Bay Area Golf Engineering Team*
*Last test execution: [Date of last run]*
*All tests passing: [Yes/No]*
