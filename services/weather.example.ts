/**
 * Weather Service Usage Examples
 *
 * This file demonstrates how to use the weather service in a golf app.
 * Run with: npx ts-node services/weather.example.ts
 */

import {
  getHourlyForecast,
  getDailyForecast,
  getFullForecast,
  formatHourlyWeather,
  formatDailyWeather,
  findBestTeeTime,
  findBestDay,
  calculatePlayabilityScore,
} from './weather';

// ============================================================================
// Example 1: Get weather for a golf course
// ============================================================================

async function exampleGetCourseWeather(): Promise<void> {
  console.log('\n=== Example 1: Get Course Weather ===\n');

  // Presidio Golf Course, San Francisco
  const presidioCoords = {
    latitude: 37.7872,
    longitude: -122.4604,
  };

  const result = await getHourlyForecast(presidioCoords, { hours: 24 });

  if (!result.success) {
    console.error('Failed to fetch weather:', result.error.message);
    return;
  }

  console.log(`Fetched ${result.data.length} hours of forecast\n`);

  // Show first 3 hours
  console.log('Next 3 hours at Presidio Golf Course:');
  console.log('-'.repeat(60));

  for (const hour of result.data.slice(0, 3)) {
    const formatted = formatHourlyWeather(hour);
    console.log(`${formatted.time}: ${formatted.temperature} (${formatted.feelsLike})`);
    console.log(`  Wind: ${formatted.wind}`);
    console.log(`  Rain: ${formatted.precipitation}`);
    console.log(`  Sky: ${formatted.cloudDescription}`);
    console.log(`  Playability: ${hour.playability.score}/100 (${hour.playability.rating})`);
    console.log(`  ${hour.playability.summary}`);
    console.log('');
  }
}

// ============================================================================
// Example 2: Find the best tee time
// ============================================================================

async function exampleFindBestTeeTime(): Promise<void> {
  console.log('\n=== Example 2: Find Best Tee Time ===\n');

  // Sharp Park Golf Course, Pacifica
  const sharpParkCoords = {
    latitude: 37.6341,
    longitude: -122.4858,
  };

  const result = await getHourlyForecast(sharpParkCoords, { hours: 48 });

  if (!result.success) {
    console.error('Failed to fetch weather:', result.error.message);
    return;
  }

  // Find best tee time between 7 AM and 4 PM
  const bestTime = findBestTeeTime(result.data, {
    startHour: 7,
    endHour: 16,
    minScore: 50,
  });

  if (!bestTime) {
    console.log('No suitable tee times found in the next 48 hours');
    return;
  }

  const formatted = formatHourlyWeather(bestTime);

  console.log('Best Tee Time Found!');
  console.log('-'.repeat(40));
  console.log(`Date: ${formatted.dateLong}`);
  console.log(`Time: ${formatted.time}`);
  console.log(`Temperature: ${formatted.temperature} (${formatted.feelsLike})`);
  console.log(`Wind: ${formatted.wind}`);
  console.log(`Rain Chance: ${formatted.precipitation}`);
  console.log(`Playability Score: ${bestTime.playability.score}/100`);
  console.log(`Rating: ${bestTime.playability.rating.toUpperCase()}`);
  console.log('');
  console.log('Recommendations:');
  bestTime.playability.recommendations.forEach(rec => {
    console.log(`  - ${rec}`);
  });
}

// ============================================================================
// Example 3: Weekly forecast for planning
// ============================================================================

async function exampleWeeklyForecast(): Promise<void> {
  console.log('\n=== Example 3: Weekly Golf Forecast ===\n');

  // Half Moon Bay Golf Links
  const hmBayCoords = {
    latitude: 37.4636,
    longitude: -122.4286,
  };

  const result = await getDailyForecast(hmBayCoords, { days: 7 });

  if (!result.success) {
    console.error('Failed to fetch weather:', result.error.message);
    return;
  }

  console.log('7-Day Golf Forecast for Half Moon Bay:');
  console.log('-'.repeat(70));
  console.log(
    'Day'.padEnd(12) +
    'High/Low'.padEnd(14) +
    'Wind'.padEnd(14) +
    'Rain'.padEnd(8) +
    'Score'.padEnd(8) +
    'Rating'
  );
  console.log('-'.repeat(70));

  for (const day of result.data) {
    const formatted = formatDailyWeather(day);
    console.log(
      `${formatted.dayShort} ${formatted.date}`.padEnd(12) +
      formatted.temperatureRange.padEnd(14) +
      formatted.windMax.padEnd(14) +
      formatted.precipitation.padEnd(8) +
      `${day.playability.score}/100`.padEnd(8) +
      day.playability.rating
    );
  }

  // Find best day
  const bestDay = findBestDay(result.data);
  if (bestDay) {
    const formatted = formatDailyWeather(bestDay);
    console.log('');
    console.log(`Best Day to Play: ${formatted.dayLong}, ${formatted.date}`);
    console.log(`  ${bestDay.playability.summary}`);
  }
}

// ============================================================================
// Example 4: Full forecast with hourly and daily
// ============================================================================

async function exampleFullForecast(): Promise<void> {
  console.log('\n=== Example 4: Complete Forecast ===\n');

  // Pebble Beach (for fun)
  const pebbleBeachCoords = {
    latitude: 36.5725,
    longitude: -121.9486,
  };

  const result = await getFullForecast(pebbleBeachCoords, {
    hours: 24,
    days: 5,
  });

  if (!result.success) {
    console.error('Failed to fetch weather:', result.error.message);
    return;
  }

  const { hourly, daily, timezone, fetchedAt } = result.data;

  console.log(`Pebble Beach Golf Links Weather`);
  console.log(`Timezone: ${timezone}`);
  console.log(`Fetched: ${fetchedAt.toLocaleString()}`);
  console.log('');

  // Show today's hourly breakdown
  console.log('Today - Hour by Hour:');
  console.log('-'.repeat(50));

  const todayHours = hourly.filter(h => {
    const hour = h.date.getHours();
    return hour >= 6 && hour <= 18;
  }).slice(0, 13);

  for (const hour of todayHours) {
    const formatted = formatHourlyWeather(hour);
    const scoreBar = '='.repeat(Math.floor(hour.playability.score / 5));
    console.log(
      `${formatted.time.padEnd(10)} ${formatted.temperature.padEnd(6)} ` +
      `${formatted.wind.padEnd(12)} [${scoreBar.padEnd(20)}] ${hour.playability.score}`
    );
  }

  console.log('');
  console.log('5-Day Overview:');
  console.log('-'.repeat(50));

  for (const day of daily) {
    const formatted = formatDailyWeather(day);
    console.log(
      `${formatted.dayLong.padEnd(12)} ${formatted.temperatureRange.padEnd(14)} ` +
      `${day.playability.rating.padEnd(10)} (${day.playability.score}/100)`
    );
  }
}

// ============================================================================
// Example 5: Direct playability calculation
// ============================================================================

function examplePlayabilityCalculation(): void {
  console.log('\n=== Example 5: Manual Playability Calculation ===\n');

  // Calculate playability for specific conditions
  const scenarios = [
    { name: 'Perfect Day', temp: 72, wind: 5, precip: 0, clouds: 30 },
    { name: 'Hot Summer', temp: 95, wind: 8, precip: 0, clouds: 10 },
    { name: 'Windy Coast', temp: 58, wind: 25, precip: 10, clouds: 60 },
    { name: 'Rainy Day', temp: 55, wind: 12, precip: 80, clouds: 100 },
    { name: 'Cold Morning', temp: 42, wind: 5, precip: 0, clouds: 20 },
  ];

  console.log('Scenario'.padEnd(15) + 'Temp'.padEnd(8) + 'Wind'.padEnd(8) +
              'Rain%'.padEnd(8) + 'Score'.padEnd(8) + 'Rating');
  console.log('-'.repeat(60));

  for (const s of scenarios) {
    const result = calculatePlayabilityScore(s.temp, s.wind, s.precip, s.clouds);
    console.log(
      s.name.padEnd(15) +
      `${s.temp}°F`.padEnd(8) +
      `${s.wind}mph`.padEnd(8) +
      `${s.precip}%`.padEnd(8) +
      `${result.score}`.padEnd(8) +
      result.rating
    );
  }

  // Show detailed breakdown for one scenario
  console.log('\nDetailed breakdown for "Windy Coast":');
  const windy = calculatePlayabilityScore(58, 25, 10, 60);
  console.log(`  Temperature Score: ${windy.factors.temperature}/100`);
  console.log(`  Wind Score: ${windy.factors.wind}/100`);
  console.log(`  Precipitation Score: ${windy.factors.precipitation}/100`);
  console.log(`  Cloud Cover Score: ${windy.factors.cloudCover}/100`);
  console.log(`  Summary: ${windy.summary}`);
  console.log('  Recommendations:');
  windy.recommendations.forEach(r => console.log(`    - ${r}`));
}

// ============================================================================
// Run all examples
// ============================================================================

async function main(): Promise<void> {
  console.log('Weather Service Examples');
  console.log('========================\n');

  // Run the non-API example first
  examplePlayabilityCalculation();

  // Check if we should run API examples
  const runApi = process.argv.includes('--api');

  if (runApi) {
    try {
      await exampleGetCourseWeather();
      await exampleFindBestTeeTime();
      await exampleWeeklyForecast();
      await exampleFullForecast();
    } catch (error) {
      console.error('Error running API examples:', error);
    }
  } else {
    console.log('\n(Skipping API examples - run with --api flag to include them)');
  }

  console.log('\nExamples complete!');
}

main();
