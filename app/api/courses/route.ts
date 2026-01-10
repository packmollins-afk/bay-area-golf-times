import { NextResponse } from "next/server"
import { courses, getStaffPicks, getCoursesByRegion, getAllRegions } from "@/lib/courses-data"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const region = searchParams.get("region")
  const staffPicks = searchParams.get("staffPicks")

  if (staffPicks === "true") {
    return NextResponse.json(getStaffPicks())
  }

  if (region) {
    return NextResponse.json(getCoursesByRegion(region))
  }

  return NextResponse.json({
    courses,
    regions: getAllRegions(),
    total: courses.length,
  })
}
