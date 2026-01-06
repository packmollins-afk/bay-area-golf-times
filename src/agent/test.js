/**
 * Test script for Golf Booking AI Agent
 * Run with: ANTHROPIC_API_KEY=your_key node src/agent/test.js
 */

require('dotenv').config();

const { parseQuery, fallbackParse } = require('./parser');
const { processTeeTimes, scoreTeeTime } = require('./scorer');
const { generateRecommendation, formatTime12, getDayName } = require('./recommender');
const { processBookingRequest, quickSearch, getCourseInsight } = require('./index');

// Sample tee time data for testing
const sampleTeeTimes = [
  {
    id: 1,
    course_id: 1,
    course_name: 'Corica Park - South Course',
    city: 'Alameda',
    region: 'East Bay',
    date: getDateString(0), // Today
    time: '08:30',
    datetime: `${getDateString(0)} 08:30`,
    price: 52,
    original_price: 65,
    avg_rating: 4.2,
    holes: 18,
    players: 4,
    booking_url: 'https://golfnow.com/...',
    latitude: 37.7649,
    longitude: -122.2494
  },
  {
    id: 2,
    course_id: 2,
    course_name: 'TPC Harding Park',
    city: 'San Francisco',
    region: 'San Francisco',
    date: getDateString(1), // Tomorrow
    time: '10:00',
    datetime: `${getDateString(1)} 10:00`,
    price: 95,
    avg_rating: 4.5,
    holes: 18,
    players: 4,
    booking_url: 'https://golfnow.com/...',
    latitude: 37.7249,
    longitude: -122.4894
  },
  {
    id: 3,
    course_id: 3,
    course_name: 'Lincoln Park Golf Course',
    city: 'San Francisco',
    region: 'San Francisco',
    date: getDateString(0), // Today
    time: '14:30',
    datetime: `${getDateString(0)} 14:30`,
    price: 42,
    avg_rating: 4.0,
    holes: 18,
    players: 4,
    booking_url: 'https://golfnow.com/...',
    latitude: 37.7849,
    longitude: -122.5094
  },
  {
    id: 4,
    course_id: 4,
    course_name: 'Tilden Park Golf Course',
    city: 'Berkeley',
    region: 'East Bay',
    date: getDateString(2), // Day after tomorrow
    time: '07:00',
    datetime: `${getDateString(2)} 07:00`,
    price: 48,
    avg_rating: 3.9,
    holes: 18,
    players: 4,
    booking_url: 'https://golfnow.com/...',
    latitude: 37.8749,
    longitude: -122.2394
  },
  {
    id: 5,
    course_id: 5,
    course_name: 'Presidio Golf Course',
    city: 'San Francisco',
    region: 'San Francisco',
    date: getDateString(1), // Tomorrow
    time: '09:00',
    datetime: `${getDateString(1)} 09:00`,
    price: 165,
    avg_rating: 4.4,
    holes: 18,
    players: 4,
    booking_url: 'https://golfnow.com/...',
    latitude: 37.7949,
    longitude: -122.4594
  }
];

// Get date string for testing
function getDateString(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

// Test queries
const testQueries = [
  "Find me something under $60 this weekend in the East Bay",
  "I want to play tomorrow morning, prefer San Francisco",
  "Best deal for afternoon golf today",
  "Show me cheap options near me",
  "Harding Park this week",
  "High-rated courses under $100"
];

async function runTests() {
  console.log('='.repeat(60));
  console.log('Golf Booking AI Agent - Test Suite');
  console.log('='.repeat(60));
  console.log();

  // Test 1: Fallback Parser (no API)
  console.log('TEST 1: Fallback Parser (no API required)');
  console.log('-'.repeat(40));

  for (const query of testQueries.slice(0, 3)) {
    const today = new Date().toISOString().split('T')[0];
    const params = fallbackParse(query, today);
    console.log(`Query: "${query}"`);
    console.log('Parsed:', JSON.stringify(params, null, 2));
    console.log();
  }

  // Test 2: Scorer
  console.log('TEST 2: Tee Time Scorer');
  console.log('-'.repeat(40));

  const testParams = {
    max_price: 60,
    time_range: { start: '08:00', end: '11:00' },
    location: 'East Bay',
    quality_preference: 'best_value'
  };

  const context = {
    userLocation: { lat: 37.8044, lng: -122.2712, city: 'Oakland' }
  };

  const processed = processTeeTimes(sampleTeeTimes, testParams, context);
  console.log(`Filtered: ${processed.matchingCount} of ${processed.totalFound} tee times`);
  console.log('\nTop Results:');

  processed.results.slice(0, 3).forEach((tt, i) => {
    console.log(`${i + 1}. ${tt.course_name}`);
    console.log(`   ${getDayName(tt.date)} ${tt.time} - $${tt.price}`);
    console.log(`   Score: ${tt.totalScore} | Distance: ${tt.distance_miles || 'N/A'} mi`);
    console.log(`   Reasons: ${tt.matchReasons.join(', ') || 'None'}`);
  });
  console.log();

  // Test 3: Course Insight
  console.log('TEST 3: Course Insight');
  console.log('-'.repeat(40));

  const insight = getCourseInsight('Corica', sampleTeeTimes);
  console.log('Course Insight for "Corica":');
  console.log(JSON.stringify(insight, null, 2));
  console.log();

  // Test 4: Full Agent (requires API key)
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('TEST 4: Full Agent Pipeline (with Claude)');
    console.log('-'.repeat(40));

    const testQuery = "Find me something under $60 tomorrow morning in the East Bay";
    console.log(`Query: "${testQuery}"`);
    console.log('Processing...');

    try {
      const result = await processBookingRequest(testQuery, sampleTeeTimes, context);

      console.log('\nAgent Response:');
      console.log('Success:', result.success);
      console.log('Message:', result.message);
      console.log('\nParsed Params:', JSON.stringify(result.parsedParams, null, 2));

      if (result.topPick) {
        console.log('\nTop Pick:');
        console.log(`  ${result.topPick.courseName}`);
        console.log(`  ${result.topPick.dayName} ${result.topPick.time12} - $${result.topPick.price}`);
      }

      console.log(`\nProcessing Time: ${result.processingTimeMs}ms`);

    } catch (error) {
      console.error('Agent test error:', error.message);
    }
  } else {
    console.log('TEST 4: Skipped (no ANTHROPIC_API_KEY)');
    console.log('Set ANTHROPIC_API_KEY environment variable to test full agent');
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Tests Complete');
  console.log('='.repeat(60));
}

// Run tests
runTests().catch(console.error);
