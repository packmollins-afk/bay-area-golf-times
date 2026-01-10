import { NextResponse } from "next/server"
import { getCourseBySlug, courses } from "@/lib/courses-data"

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = getCourseBySlug(slug)

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 })
  }

  // Get nearby courses (same region, excluding current)
  const nearbyCourses = courses.filter((c) => c.region === course.region && c.slug !== slug).slice(0, 4)

  return NextResponse.json({
    ...course,
    nearbyCourses,
  })
}
