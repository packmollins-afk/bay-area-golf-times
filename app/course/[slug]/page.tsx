import { notFound } from "next/navigation"
import Link from "next/link"
import { MapPin, Phone, ExternalLink, Flag, Ruler, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { courses, getCourseBySlug } from "@/lib/courses-data"

export async function generateStaticParams() {
  return courses.map((course) => ({
    slug: course.slug,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = getCourseBySlug(slug)

  if (!course) {
    return { title: "Course Not Found" }
  }

  return {
    title: `${course.name} Tee Times | Bay Area Golf`,
    description: `Book tee times at ${course.name} in ${course.city}. ${course.holes} holes, par ${course.par}. ${course.description || ""}`,
  }
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = getCourseBySlug(slug)

  console.log("[v0] Course page slug:", slug)
  console.log("[v0] Course found:", course?.name || "NOT FOUND")

  if (!course) {
    notFound()
  }

  // Get nearby courses (same region)
  const nearbyCourses = courses.filter((c) => c.region === course.region && c.slug !== course.slug).slice(0, 4)

  const courseImage = `/placeholder.svg?height=400&width=800&query=${encodeURIComponent(course.name + " golf course")}`

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 sticky top-0 z-50">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold font-serif">
            Bay Area Golf
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="outline" size="sm" className="bg-white text-primary hover:bg-gray-100">
                Home
              </Button>
            </Link>
            <Link href="/tee-times">
              <Button variant="outline" size="sm" className="bg-white text-primary hover:bg-gray-100">
                Tee Times
              </Button>
            </Link>
            <Link href="/courses">
              <Button variant="outline" size="sm" className="bg-white text-primary hover:bg-gray-100">
                Courses
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Image */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        <img src={courseImage || "/placeholder.svg"} alt={course.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      {/* Breadcrumb */}
      <div className="bg-muted border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary">
              Home
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/courses" className="text-muted-foreground hover:text-primary">
              Courses
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{course.name}</span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Left Column - Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Course Title */}
            <div>
              <Badge className="mb-2">{course.region}</Badge>
              <h1 className="text-3xl md:text-4xl font-bold font-serif mb-2">{course.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{course.city}, CA</span>
              </div>
            </div>

            {/* Course Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Course Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  {course.description ||
                    `${course.name} is a ${course.holes}-hole golf course located in ${course.city}, California.`}
                </p>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <Flag className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <div className="text-2xl font-bold">{course.holes}</div>
                    <div className="text-sm text-muted-foreground">Holes</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="w-6 h-6 mx-auto mb-2 text-primary font-bold text-lg">P</div>
                    <div className="text-2xl font-bold">{course.par || "N/A"}</div>
                    <div className="text-sm text-muted-foreground">Par</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <Ruler className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <div className="text-2xl font-bold">{course.yardage?.toLocaleString() || "N/A"}</div>
                    <div className="text-sm text-muted-foreground">Yards</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Nearby Courses */}
            {nearbyCourses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif">Nearby Courses in {course.region}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {nearbyCourses.map((nearby) => (
                      <Link
                        key={nearby.slug}
                        href={`/course/${nearby.slug}`}
                        className="p-4 border rounded-lg hover:border-primary hover:bg-muted/50 transition-colors"
                      >
                        <h3 className="font-semibold mb-1">{nearby.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {nearby.city} • {nearby.holes} holes • Par {nearby.par || "N/A"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-4">
            {/* Book Now Card */}
            <Card className="border-primary">
              <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
                <CardTitle className="font-serif text-center">Book a Tee Time</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {course.booking_url ? (
                  <a href={course.booking_url} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full" size="lg">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Book Online
                    </Button>
                  </a>
                ) : (
                  <Button className="w-full" size="lg" disabled>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Online Booking Unavailable
                  </Button>
                )}

                {course.phone_number && (
                  <a href={`tel:${course.phone_number.replace(/[^\d+]/g, "")}`}>
                    <Button variant="outline" className="w-full bg-white mt-2" size="lg">
                      <Phone className="w-4 h-4 mr-2" />
                      {course.phone_number}
                    </Button>
                  </a>
                )}

                <Button variant="ghost" className="w-full" size="lg">
                  <Heart className="w-4 h-4 mr-2" />
                  Add to Favorites
                </Button>
              </CardContent>
            </Card>

            {/* Location Card */}
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Location</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-lg mb-4 flex items-center justify-center">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${course.latitude},${course.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center"
                  >
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground hover:text-primary">View on Google Maps</span>
                  </a>
                </div>
                <p className="text-sm text-muted-foreground">{course.city}, California</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Bay Area Golf. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
