"""
Golf Course Schema.org JSON-LD Generator
Dynamically generates Schema.org structured data for golf courses
"""

import json
from datetime import datetime, time
from typing import List, Dict, Optional, Tuple


class GolfCourseSchema:
    """Generate Schema.org LocalBusiness + GolfCourse markup"""

    def __init__(
        self,
        name: str,
        url: str,
        telephone: str,
        email: str,
        street_address: str,
        city: str,
        state: str,
        postal_code: str,
        latitude: float,
        longitude: float,
    ):
        self.name = name
        self.url = url
        self.telephone = telephone
        self.email = email
        self.street_address = street_address
        self.city = city
        self.state = state
        self.postal_code = postal_code
        self.latitude = latitude
        self.longitude = longitude
        self.images: List[str] = []
        self.opening_hours: List[Dict] = []
        self.amenities: List[str] = []
        self.course_specs: Dict = {}
        self.social_profiles: List[str] = []

    def add_image(self, image_url: str) -> "GolfCourseSchema":
        """Add image URL (1200x628px minimum for hero)"""
        self.images.append(image_url)
        return self

    def add_opening_hours(self, day_of_week: List[str], opens: str, closes: str) -> "GolfCourseSchema":
        """Add opening hours specification

        Args:
            day_of_week: List of days e.g., ["Monday", "Tuesday", "Wednesday"]
            opens: Time as HH:MM e.g., "07:00"
            closes: Time as HH:MM e.g., "17:00"
        """
        self.opening_hours.append({
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": day_of_week,
            "opens": opens,
            "closes": closes,
        })
        return self

    def add_amenity(self, amenity_name: str) -> "GolfCourseSchema":
        """Add amenity feature"""
        self.amenities.append(amenity_name)
        return self

    def set_course_specs(
        self,
        par: int,
        holes: int,
        rating: float,
        slope: int,
        length_yards: int = None,
        architect: str = None,
        established: int = None,
    ) -> "GolfCourseSchema":
        """Set golf-specific course specifications"""
        self.course_specs = {
            "par": par,
            "holes": holes,
            "rating": rating,
            "slope": slope,
            "length_yards": length_yards,
            "architect": architect,
            "established": established,
        }
        return self

    def add_social_profile(self, profile_url: str) -> "GolfCourseSchema":
        """Add social media profile URL"""
        self.social_profiles.append(profile_url)
        return self

    def build_address(self) -> Dict:
        """Build PostalAddress schema"""
        return {
            "@type": "PostalAddress",
            "streetAddress": self.street_address,
            "addressLocality": self.city,
            "addressRegion": self.state,
            "postalCode": self.postal_code,
            "addressCountry": "US",
        }

    def build_geo(self) -> Dict:
        """Build GeoCoordinates schema"""
        return {
            "@type": "GeoCoordinates",
            "latitude": self.latitude,
            "longitude": self.longitude,
        }

    def build_amenities(self) -> List[Dict]:
        """Build LocationFeatureSpecification array"""
        return [
            {
                "@type": "LocationFeatureSpecification",
                "name": amenity,
            }
            for amenity in self.amenities
        ]

    def build_course_properties(self) -> List[Dict]:
        """Build additionalProperty array for golf specs"""
        properties = []

        if self.course_specs.get("par"):
            properties.append({
                "@type": "PropertyValue",
                "name": "Par",
                "value": str(self.course_specs["par"]),
            })

        if self.course_specs.get("holes"):
            properties.append({
                "@type": "PropertyValue",
                "name": "Holes",
                "value": str(self.course_specs["holes"]),
            })

        if self.course_specs.get("length_yards"):
            properties.append({
                "@type": "PropertyValue",
                "name": "Length",
                "value": str(self.course_specs["length_yards"]),
            })
            properties.append({
                "@type": "PropertyValue",
                "name": "Length Unit",
                "value": "yards",
            })

        if self.course_specs.get("rating"):
            properties.append({
                "@type": "PropertyValue",
                "name": "Course Rating",
                "value": str(self.course_specs["rating"]),
            })

        if self.course_specs.get("slope"):
            properties.append({
                "@type": "PropertyValue",
                "name": "Slope Rating",
                "value": str(self.course_specs["slope"]),
            })

        if self.course_specs.get("architect"):
            properties.append({
                "@type": "PropertyValue",
                "name": "Course Architect",
                "value": self.course_specs["architect"],
            })

        if self.course_specs.get("established"):
            properties.append({
                "@type": "PropertyValue",
                "name": "Established",
                "value": str(self.course_specs["established"]),
            })

        return properties

    def to_json(self) -> Dict:
        """Generate complete LocalBusiness + GolfCourse schema"""
        schema = {
            "@context": "https://schema.org",
            "@type": ["LocalBusiness", "GolfCourse"],
            "name": self.name,
            "url": self.url,
            "telephone": self.telephone,
            "email": self.email,
            "address": self.build_address(),
            "geo": self.build_geo(),
        }

        # Add optional fields if provided
        if self.images:
            schema["image"] = self.images if len(self.images) > 1 else self.images[0]

        if self.opening_hours:
            schema["openingHoursSpecification"] = self.opening_hours

        if self.amenities:
            schema["amenityFeature"] = self.build_amenities()

        if self.course_specs:
            schema["additionalProperty"] = self.build_course_properties()

        if self.social_profiles:
            schema["sameAs"] = self.social_profiles

        return schema

    def to_json_ld(self) -> str:
        """Generate JSON-LD script tag ready for HTML insertion"""
        return json.dumps(self.to_json(), indent=2)

    def to_html_script(self) -> str:
        """Generate complete HTML script tag"""
        return f'<script type="application/ld+json">\n{self.to_json_ld()}\n</script>'


class ReviewSchema:
    """Generate AggregateRating + Review markup"""

    def __init__(self, course_name: str, course_url: str, course_image: str):
        self.course_name = course_name
        self.course_url = course_url
        self.course_image = course_image
        self.reviews: List[Dict] = []
        self.rating_value: float = 0
        self.rating_count: int = 0

    def add_review(
        self,
        headline: str,
        body: str,
        rating: int,
        date_published: str,
        author_name: str,
    ) -> "ReviewSchema":
        """Add individual review

        Args:
            headline: Review title
            body: Review body text
            rating: 1-5 star rating
            date_published: ISO 8601 date (YYYY-MM-DD)
            author_name: Reviewer name
        """
        self.reviews.append({
            "@type": "Review",
            "headline": headline,
            "reviewBody": body,
            "reviewRating": {
                "@type": "Rating",
                "ratingValue": str(rating),
                "bestRating": "5",
                "worstRating": "1",
            },
            "datePublished": date_published,
            "author": {
                "@type": "Person",
                "name": author_name,
            },
        })
        return self

    def set_aggregate_rating(self, rating_value: float, rating_count: int) -> "ReviewSchema":
        """Set aggregate rating and count"""
        self.rating_value = rating_value
        self.rating_count = rating_count
        return self

    def to_json(self) -> Dict:
        """Generate complete AggregateRating schema"""
        schema = {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": self.course_name,
            "url": self.course_url,
            "image": self.course_image,
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": str(self.rating_value),
                "bestRating": "5",
                "worstRating": "1",
                "ratingCount": self.rating_count,
                "reviewCount": len(self.reviews),
            },
        }

        if self.reviews:
            schema["review"] = self.reviews

        return schema

    def to_json_ld(self) -> str:
        """Generate JSON-LD"""
        return json.dumps(self.to_json(), indent=2)

    def to_html_script(self) -> str:
        """Generate complete HTML script tag"""
        return f'<script type="application/ld+json">\n{self.to_json_ld()}\n</script>'


class BreadcrumbSchema:
    """Generate BreadcrumbList markup"""

    def __init__(self):
        self.items: List[Dict] = []

    def add_item(self, name: str, url: str = None) -> "BreadcrumbSchema":
        """Add breadcrumb item

        Args:
            name: Display name of breadcrumb
            url: URL (optional for last item)
        """
        position = len(self.items) + 1
        item = {
            "@type": "ListItem",
            "position": position,
            "name": name,
        }
        if url:
            item["item"] = url

        self.items.append(item)
        return self

    def to_json(self) -> Dict:
        """Generate complete BreadcrumbList schema"""
        return {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": self.items,
        }

    def to_json_ld(self) -> str:
        """Generate JSON-LD"""
        return json.dumps(self.to_json(), indent=2)

    def to_html_script(self) -> str:
        """Generate complete HTML script tag"""
        return f'<script type="application/ld+json">\n{self.to_json_ld()}\n</script>'


class TeeTimeEventSchema:
    """Generate SportsEvent markup for tee times"""

    def __init__(
        self,
        name: str,
        start_date: str,
        end_date: str,
        location_name: str,
        location_address: Dict,
        price: float,
        currency: str = "USD",
    ):
        """Initialize tee time event

        Args:
            name: Event name (e.g., "Golf Tee Time - 8:00 AM")
            start_date: ISO 8601 datetime (e.g., "2026-02-15T08:00:00-05:00")
            end_date: ISO 8601 datetime
            location_name: Golf course name
            location_address: PostalAddress dict
            price: Green fee price
            currency: Currency code (default: USD)
        """
        self.name = name
        self.start_date = start_date
        self.end_date = end_date
        self.location_name = location_name
        self.location_address = location_address
        self.price = price
        self.currency = currency
        self.availability = "InStock"
        self.organizer_name = ""
        self.organizer_url = ""
        self.organizer_phone = ""

    def set_availability(self, availability: str) -> "TeeTimeEventSchema":
        """Set availability status

        Args:
            availability: 'InStock', 'OutOfStock', or 'PreOrder'
        """
        self.availability = availability
        return self

    def set_organizer(self, name: str, url: str = None, phone: str = None) -> "TeeTimeEventSchema":
        """Set event organizer information"""
        self.organizer_name = name
        self.organizer_url = url
        self.organizer_phone = phone
        return self

    def to_json(self) -> Dict:
        """Generate complete SportsEvent schema"""
        organizer = {
            "@type": "Organization",
            "name": self.organizer_name,
        }
        if self.organizer_url:
            organizer["url"] = self.organizer_url
        if self.organizer_phone:
            organizer["telephone"] = self.organizer_phone

        schema = {
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            "name": self.name,
            "startDate": self.start_date,
            "endDate": self.end_date,
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "location": {
                "@type": "GolfCourse",
                "name": self.location_name,
                "address": self.location_address,
            },
            "offers": {
                "@type": "Offer",
                "price": str(self.price),
                "priceCurrency": self.currency,
                "availability": f"https://schema.org/{self.availability}",
            },
            "organizer": organizer,
        }

        return schema

    def to_json_ld(self) -> str:
        """Generate JSON-LD"""
        return json.dumps(self.to_json(), indent=2)

    def to_html_script(self) -> str:
        """Generate complete HTML script tag"""
        return f'<script type="application/ld+json">\n{self.to_json_ld()}\n</script>'


# ============================================================
# USAGE EXAMPLES
# ============================================================

if __name__ == "__main__":

    # Example 1: Create a GolfCourseSchema
    print("=" * 60)
    print("EXAMPLE 1: Golf Course Schema")
    print("=" * 60)

    course = (
        GolfCourseSchema(
            name="Pine Valley Golf Club",
            url="https://example.com/courses/pine-valley",
            telephone="+1-609-465-3886",
            email="reservations@pinevalley.com",
            street_address="123 Fairway Drive",
            city="Pine Valley",
            state="NJ",
            postal_code="08021",
            latitude=39.8093,
            longitude=-74.8902,
        )
        .add_image("https://example.com/images/pine-valley-hero.jpg")
        .add_image("https://example.com/images/clubhouse.jpg")
        .add_opening_hours(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "07:00", "17:00")
        .add_opening_hours(["Saturday", "Sunday"], "06:00", "17:00")
        .add_amenity("Pro Shop")
        .add_amenity("Golf Instruction")
        .add_amenity("Restaurant & Bar")
        .add_amenity("Golf Cart Rental")
        .add_amenity("Club Rental")
        .set_course_specs(
            par=72,
            holes=18,
            rating=76.5,
            slope=147,
            length_yards=6701,
            architect="George Arthur Crump, Hugh Wilson",
            established=1913,
        )
        .add_social_profile("https://www.facebook.com/pinevalley")
        .add_social_profile("https://www.instagram.com/pinevalley")
        .add_social_profile("https://twitter.com/pinevalley")
    )

    print(course.to_html_script())
    print()

    # Example 2: Create ReviewSchema
    print("=" * 60)
    print("EXAMPLE 2: Review & Rating Schema")
    print("=" * 60)

    reviews = (
        ReviewSchema(
            course_name="Pine Valley Golf Club",
            course_url="https://example.com/courses/pine-valley",
            course_image="https://example.com/images/pine-valley.jpg",
        )
        .add_review(
            headline="World-class course with exceptional service",
            body="Pine Valley exceeded all expectations. Impeccable conditions and outstanding staff.",
            rating=5,
            date_published="2026-01-05",
            author_name="Michael Thompson",
        )
        .add_review(
            headline="Pristine conditions and challenging holes",
            body="The greens are lightning quick and the rough is genuinely penal. Worth every penny.",
            rating=5,
            date_published="2025-12-28",
            author_name="David Williams",
        )
        .add_review(
            headline="Great experience, premium pricing",
            body="Exceptional golf course. The price is steep but you get what you pay for.",
            rating=4,
            date_published="2025-12-15",
            author_name="Robert Johnson",
        )
        .set_aggregate_rating(rating_value=4.9, rating_count=427)
    )

    print(reviews.to_html_script())
    print()

    # Example 3: Create BreadcrumbSchema
    print("=" * 60)
    print("EXAMPLE 3: Breadcrumb Navigation Schema")
    print("=" * 60)

    breadcrumbs = (
        BreadcrumbSchema()
        .add_item("Home", "https://example.com")
        .add_item("Golf Courses", "https://example.com/courses")
        .add_item("New Jersey", "https://example.com/courses/new-jersey")
        .add_item("Pine Valley Golf Club", "https://example.com/courses/pine-valley")
    )

    print(breadcrumbs.to_html_script())
    print()

    # Example 4: Create TeeTimeEventSchema
    print("=" * 60)
    print("EXAMPLE 4: Tee Time Event Schema")
    print("=" * 60)

    tee_time = (
        TeeTimeEventSchema(
            name="Golf Tee Time - 8:00 AM",
            start_date="2026-02-15T08:00:00-05:00",
            end_date="2026-02-15T12:00:00-05:00",
            location_name="Pine Valley Golf Club",
            location_address={
                "@type": "PostalAddress",
                "streetAddress": "123 Fairway Drive",
                "addressLocality": "Pine Valley",
                "addressRegion": "NJ",
                "postalCode": "08021",
            },
            price=185.00,
            currency="USD",
        )
        .set_availability("InStock")
        .set_organizer(
            name="Pine Valley Golf Club",
            url="https://example.com",
            phone="+1-609-465-3886",
        )
    )

    print(tee_time.to_html_script())
    print()

    # Example 5: Full integration example
    print("=" * 60)
    print("EXAMPLE 5: Full Page Integration")
    print("=" * 60)

    html = """<!DOCTYPE html>
<html>
<head>
  <title>Pine Valley Golf Club</title>

  <!-- Schema 1: Golf Course -->
  """ + course.to_html_script() + """

  <!-- Schema 2: Reviews -->
  """ + reviews.to_html_script() + """

  <!-- Schema 3: Navigation -->
  """ + breadcrumbs.to_html_script() + """

</head>
<body>
  <h1>Pine Valley Golf Club</h1>
</body>
</html>"""

    print(html)

    # Example 6: Generate JSON files for API response
    print("=" * 60)
    print("EXAMPLE 6: Exporting to JSON files")
    print("=" * 60)

    with open("course_schema.json", "w") as f:
        json.dump(course.to_json(), f, indent=2)
    print("✓ Saved course_schema.json")

    with open("reviews_schema.json", "w") as f:
        json.dump(reviews.to_json(), f, indent=2)
    print("✓ Saved reviews_schema.json")

    with open("breadcrumb_schema.json", "w") as f:
        json.dump(breadcrumbs.to_json(), f, indent=2)
    print("✓ Saved breadcrumb_schema.json")

    with open("tee_time_schema.json", "w") as f:
        json.dump(tee_time.to_json(), f, indent=2)
    print("✓ Saved tee_time_schema.json")
