"use client"

/**
 * Air Quality Service Usage Examples
 * Demonstrates how to use the air quality service in the Bay Area Golf app
 */

import {
  AirQualityService,
  createAirQualityService,
  getAQICategory,
  getGolfRecommendation,
  shouldWarnUser,
  shouldSuggestReschedule,
  type getAirQualitySummary,
} from "./airquality"

// ============================================================================
// Basic Usage Examples
// ============================================================================

/**
 * Example 1: Create service and get current AQI
 */
async function basicUsageExample() {
  // Create service with API key from environment
  const apiKey = process.env.AIRNOW_API_KEY
  if (!apiKey) {
    console.error("AIRNOW_API_KEY environment variable is required")
    return
  }

  const service = createAirQualityService(apiKey)

  // San Francisco coordinates
  const latitude = 37.7749
  const longitude = -122.4194

  const result = await service.getCurrentAQI(latitude, longitude)

  if (result.success) {
    console.log("Air Quality Data:")
    console.log(`  AQI: ${result.data.aqi}`)
    console.log(`  Category: ${result.data.category.name}`)
    console.log(`  Primary Pollutant: ${result.data.primaryPollutant}`)
    console.log(`  Reporting Area: ${result.data.reportingArea}`)
    console.log(`  Cached: ${result.cached}`)
    console.log("\nGolf Recommendation:")
    console.log(`  Level: ${result.data.golfRecommendation.level}`)
    console.log(`  Summary: ${result.data.golfRecommendation.summary}`)
    console.log(`  Show Warning: ${result.data.golfRecommendation.showWarning}`)
  } else {
    console.error("Error:", result.error.message)
    console.error("Code:", result.error.code)
    console.error("Retryable:", result.error.retryable)
  }
}

/**
 * Example 2: Using helper functions directly (no API call)
 */
function helperFunctionsExample() {
  // Example AQI values to test
  const testAQIs = [25, 65, 85, 125, 175]

  console.log("Helper Functions Demo:\n")

  for (const aqi of testAQIs) {
    const category = getAQICategory(aqi)
    const recommendation = getGolfRecommendation(aqi)
    const warn = shouldWarnUser(aqi)
    const reschedule = shouldSuggestReschedule(aqi)

    console.log(`AQI ${aqi}:`)
    console.log(`  Category: ${category.name} (${category.color})`)
    console.log(`  Golf Level: ${recommendation.level}`)
    console.log(`  Summary: ${recommendation.summary}`)
    console.log(`  Should Warn: ${warn}`)
    console.log(`  Suggest Reschedule: ${reschedule}`)
    console.log(`  Tips:`)
    recommendation.tips.forEach((tip) => console.log(`    - ${tip}`))
    console.log("")
  }
}

/**
 * Example 3: Getting a simplified summary for UI display
 */
async function summaryExample() {
  const apiKey = process.env.AIRNOW_API_KEY
  if (!apiKey) return

  const service = createAirQualityService(apiKey)

  // Pebble Beach coordinates
  const result = await service.getAQISummary(36.5725, -121.9486)

  if (result.success) {
    const { data } = result
    console.log("Air Quality Summary for Pebble Beach:")
    console.log(`  AQI: ${data.aqi}`)
    console.log(`  Label: ${data.label}`)
    console.log(`  Color: ${data.color}`)
    console.log(`  Golf Level: ${data.golfLevel}`)
    console.log(`  Golf Summary: ${data.golfSummary}`)
    console.log(`  Show Warning: ${data.showWarning}`)
  }
}

/**
 * Example 4: Quick safety check
 */
async function safetyCheckExample() {
  const apiKey = process.env.AIRNOW_API_KEY
  if (!apiKey) return

  const service = createAirQualityService(apiKey)

  // Check multiple Bay Area courses
  const courses = [
    { name: "Harding Park", lat: 37.7275, lon: -122.4939 },
    { name: "TPC Harding Park", lat: 37.7227, lon: -122.4915 },
    { name: "Sharp Park", lat: 37.6175, lon: -122.4783 },
    { name: "Presidio Golf Course", lat: 37.7875, lon: -122.4569 },
  ]

  console.log("Safety Check for Bay Area Courses:\n")

  for (const course of courses) {
    const result = await service.isSafeForGolf(course.lat, course.lon)
    if (result.success) {
      console.log(`  ${course.name}: ${result.data ? "Safe" : "Caution advised"}`)
    } else {
      console.log(`  ${course.name}: Unable to check (${result.error.code})`)
    }
  }
}

/**
 * Example 5: Service with custom configuration
 */
async function customConfigExample() {
  const apiKey = process.env.AIRNOW_API_KEY
  if (!apiKey) return

  const service = new AirQualityService({
    apiKey,
    baseUrl: "https://www.airnowapi.org", // Default
    timeout: 15000, // 15 second timeout
    cacheDuration: 60 * 60 * 1000, // 1 hour cache
    useMockOnFailure: true, // Use mock data if API fails
  })

  const result = await service.getCurrentAQI(37.7749, -122.4194, {
    distance: 50, // Search within 50 miles
    forceRefresh: false, // Use cache if available
  })

  if (result.success) {
    console.log(`AQI: ${result.data.aqi}, Cached: ${result.cached}`)
  }
}

/**
 * Example 6: Integration with golf tee time display
 */
interface TeeTime {
  courseId: string
  courseName: string
  time: string
  price: number
  latitude: number
  longitude: number
}

interface TeeTimeWithAirQuality extends TeeTime {
  airQuality?: {
    aqi: number
    label: string
    color: string
    warning?: string
  }
}

async function enrichTeeTimesWithAirQuality(
  teeTimes: TeeTime[],
  service: AirQualityService,
): Promise<TeeTimeWithAirQuality[]> {
  // Get unique locations to avoid duplicate API calls
  const locationMap = new Map<string, { lat: number; lon: number }>()
  for (const tt of teeTimes) {
    const key = `${tt.latitude.toFixed(2)},${tt.longitude.toFixed(2)}`
    if (!locationMap.has(key)) {
      locationMap.set(key, { lat: tt.latitude, lon: tt.longitude })
    }
  }

  // Fetch air quality for each unique location
  const aqiCache = new Map<string, ReturnType<typeof getAirQualitySummary>>()
  for (const [key, loc] of locationMap.entries()) {
    const result = await service.getAQISummary(loc.lat, loc.lon)
    if (result.success) {
      aqiCache.set(key, result.data)
    }
  }

  // Enrich tee times with air quality data
  return teeTimes.map((tt) => {
    const key = `${tt.latitude.toFixed(2)},${tt.longitude.toFixed(2)}`
    const aqi = aqiCache.get(key)

    if (!aqi) {
      return tt
    }

    return {
      ...tt,
      airQuality: {
        aqi: aqi.aqi,
        label: aqi.label,
        color: aqi.color,
        warning: aqi.showWarning ? aqi.golfSummary : undefined,
      },
    }
  })
}

/**
 * Example 7: React component integration pattern
 * (TypeScript type definitions for React usage)
 */
/*
import { useState, useEffect } from 'react';

function useAirQuality(latitude: number, longitude: number) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/air-quality?lat=${latitude}&lon=${longitude}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      })
      .finally(() => setLoading(false));
  }, [latitude, longitude]);

  return { data, loading, error };
}

function AirQualityBadge({ latitude, longitude }: { latitude: number; longitude: number }) {
  const { data, loading, error } = useAirQuality(latitude, longitude);

  if (loading) return <span>Loading AQI...</span>;
  if (error) return null;
  if (!data) return null;

  return (
    <span
      style={{
        backgroundColor: data.color,
        padding: '2px 8px',
        borderRadius: '4px',
      }}
    >
      AQI: {data.aqi}
      {data.showWarning && <span> !</span>}
    </span>
  );
}
*/

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log("=".repeat(60))
  console.log("Air Quality Service Examples")
  console.log("=".repeat(60))
  console.log("\n")

  // Helper functions work without API key
  helperFunctionsExample()

  // API-based examples require AIRNOW_API_KEY
  if (process.env.AIRNOW_API_KEY) {
    console.log("\n" + "=".repeat(60))
    console.log("API Examples (with AIRNOW_API_KEY)")
    console.log("=".repeat(60) + "\n")

    await basicUsageExample()
    await summaryExample()
    await safetyCheckExample()
  } else {
    console.log("\nNote: Set AIRNOW_API_KEY environment variable to run API examples.")
    console.log("Get a free API key at: https://docs.airnowapi.org/account/request/")
  }
}

// Export for direct execution
export {
  basicUsageExample,
  helperFunctionsExample,
  summaryExample,
  safetyCheckExample,
  customConfigExample,
  enrichTeeTimesWithAirQuality,
}

// Run if executed directly
// main().catch(console.error);
