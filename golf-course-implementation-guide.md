# Golf Course Schema.org Implementation Guide

## Overview

This guide provides complete, production-ready JSON-LD markup for golf course SEO pages. Proper schema implementation can improve click-through rates by 20-30% and ensure visibility across Google Search, Maps, voice assistants, and AI search engines.

---

## 1. LocalBusiness + GolfCourse Schema (Primary)

### What It Does
Combines LocalBusiness and GolfCourse types to tell Google exactly what your business is, where it is, and what makes it unique.

### When to Use
Include on every golf course detail page as your main schema markup.

### Minimal Implementation (Required Properties)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "GolfCourse"],
  "name": "Pine Valley Golf Club",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Fairway Drive",
    "addressLocality": "Pine Valley",
    "addressRegion": "NJ",
    "postalCode": "08021",
    "addressCountry": "US"
  },
  "telephone": "+1-609-465-3886",
  "url": "https://example.com/courses/pine-valley",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 39.8093,
    "longitude": -74.8902
  }
}
</script>
```

### Comprehensive Implementation (Recommended)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "GolfCourse"],
  "id": "https://example.com/courses/pine-valley#course",
  "name": "Pine Valley Golf Club",
  "url": "https://example.com/courses/pine-valley",
  "description": "Ranked among the top golf courses in the world. Pine Valley offers an 18-hole championship course with pristine conditions and exclusive membership.",
  "telephone": "+1-609-465-3886",
  "email": "reservations@pinevalley.com",
  "image": [
    "https://example.com/images/pine-valley-hero-1200x628.jpg",
    "https://example.com/images/clubhouse-800x600.jpg",
    "https://example.com/images/course-map-800x600.jpg"
  ],
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Fairway Drive",
    "addressLocality": "Pine Valley",
    "addressRegion": "NJ",
    "postalCode": "08021",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 39.8093,
    "longitude": -74.8902
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "07:00",
      "closes": "17:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Saturday", "Sunday"],
      "opens": "06:00",
      "closes": "17:00"
    }
  ],
  "acceptsReservations": true,
  "priceRange": "$$$",
  "sameAs": [
    "https://www.facebook.com/pinevalley",
    "https://www.instagram.com/pinevalley",
    "https://twitter.com/pinevalley",
    "https://www.youtube.com/pinevalley"
  ],
  "hasMap": "https://goo.gl/maps/pinevalley",
  "founder": "George Arthur Crump",
  "foundingDate": "1913",
  "amenityFeature": [
    {
      "@type": "LocationFeatureSpecification",
      "name": "Pro Shop"
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Golf Lessons"
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Restaurant"
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Bar & Lounge"
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Golf Cart Rental"
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Club Rental"
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Handicap Accessible"
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Wedding Venue"
    }
  ],
  "additionalProperty": [
    {
      "@type": "PropertyValue",
      "name": "Par",
      "value": "72"
    },
    {
      "@type": "PropertyValue",
      "name": "Holes",
      "value": "18"
    },
    {
      "@type": "PropertyValue",
      "name": "Course Rating",
      "value": "76.5"
    },
    {
      "@type": "PropertyValue",
      "name": "Slope Rating",
      "value": "147"
    },
    {
      "@type": "PropertyValue",
      "name": "Course Architect",
      "value": "George Arthur Crump, Hugh Wilson"
    },
    {
      "@type": "PropertyValue",
      "name": "Established",
      "value": "1913"
    },
    {
      "@type": "PropertyValue",
      "name": "Course Type",
      "value": "Private Championship"
    }
  ]
}
</script>
```

### Key Properties Explained

| Property | Required | Example | Notes |
|----------|----------|---------|-------|
| `name` | Yes | "Pine Valley Golf Club" | Must match Google Business Profile exactly |
| `address` | Yes | PostalAddress object | Complete street address with postal code |
| `telephone` | Yes | "+1-609-465-3886" | Include country code |
| `url` | Yes | "https://example.com/courses/pine-valley" | Course detail page URL |
| `geo` | Yes | {latitude, longitude} | GPS of clubhouse entrance |
| `image` | Highly Recommended | Array of images | 1200x628px minimum for hero |
| `openingHoursSpecification` | Recommended | Array of hours | Cover all variations (weekday/weekend) |
| `acceptsReservations` | Recommended | true/false | Whether online booking is available |
| `email` | Recommended | "contact@course.com" | Direct email contact |
| `description` | Recommended | Course overview | 50-160 characters for meta snippet |
| `sameAs` | Recommended | Social profile URLs | Facebook, Instagram, Twitter, YouTube |
| `amenityFeature` | Recommended | Array of features | Pro shop, lessons, dining, carts |
| `additionalProperty` | Recommended | Par, rating, slope | Golf-specific course specs |

---

## 2. AggregateRating + Review Schema

### What It Does
Shows star ratings and review count in Google Search results (rich result). Increases click-through rate.

### Critical Warning
Only include reviews that are hosted on your own website. Do NOT mark up reviews from Google, Yelp, TripAdvisor, or other third-party review sites.

### Basic Implementation

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Pine Valley Golf Club",
  "url": "https://example.com/courses/pine-valley",
  "image": "https://example.com/images/pine-valley.jpg",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "bestRating": "5",
    "worstRating": "1",
    "ratingCount": 247,
    "reviewCount": 187
  }
}
</script>
```

### Advanced Implementation with Reviews

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Pine Valley Golf Club",
  "url": "https://example.com/courses/pine-valley",
  "image": "https://example.com/images/pine-valley.jpg",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "bestRating": "5",
    "worstRating": "1",
    "ratingCount": 247,
    "reviewCount": 187,
    "name": "Pine Valley Golf Club Reviews"
  },
  "review": [
    {
      "@type": "Review",
      "headline": "World-class experience from start to finish",
      "reviewBody": "Exceptional course condition, outstanding service, and unforgettable views. Every detail is perfect. Highly recommend for serious golfers.",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5",
        "worstRating": "1"
      },
      "datePublished": "2026-01-08",
      "author": {
        "@type": "Person",
        "name": "Michael Johnson"
      }
    },
    {
      "@type": "Review",
      "headline": "Pristine conditions and challenging layout",
      "reviewBody": "Beautifully maintained course with strategic design. The greens are quick and the rough is penal. Worth the green fee for the experience.",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5",
        "worstRating": "1"
      },
      "datePublished": "2026-01-05",
      "author": {
        "@type": "Person",
        "name": "David Williams"
      }
    },
    {
      "@type": "Review",
      "headline": "Great course, competitive pace of play",
      "reviewBody": "The course is in excellent shape with beautiful holes. Groups moved at a good pace. Would play again.",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "4",
        "bestRating": "5",
        "worstRating": "1"
      },
      "datePublished": "2025-12-28",
      "author": {
        "@type": "Person",
        "name": "Robert Brown"
      }
    }
  ]
}
</script>
```

### Review Best Practices

- Include 3-5 representative reviews
- Mix of 4 and 5-star reviews (not all perfect)
- Use actual review dates (not all same day)
- Include reviewer names (can be first name + initial)
- Write original review content (2-3 sentences)
- Cover different aspects (course condition, service, value, difficulty)
- Update monthly with new reviews

---

## 3. SportsActivityLocation Schema

### What It Does
Emphasizes golf-specific activities and capabilities (equipment rental, accessibility, etc.).

### When to Use
Include alongside LocalBusiness schema to provide golf-specific details.

### Implementation

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  "name": "Pine Valley Golf Club",
  "url": "https://example.com/courses/pine-valley",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Fairway Drive",
    "addressLocality": "Pine Valley",
    "addressRegion": "NJ",
    "postalCode": "08021",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 39.8093,
    "longitude": -74.8902
  },
  "numberOfHoles": 18,
  "par": 72,
  "courseRating": 76.5,
  "slopeRating": 147,
  "guestCanBringOwnEquipment": true,
  "equipmentRental": [
    {
      "@type": "Thing",
      "name": "Golf Clubs"
    },
    {
      "@type": "Thing",
      "name": "Golf Cart"
    },
    {
      "@type": "Thing",
      "name": "Pull Cart"
    }
  ]
}
</script>
```

### Golf-Specific Properties

- `numberOfHoles`: Total holes (typically 18 or 9)
- `par`: Total par for course
- `courseRating`: USGA course rating
- `slopeRating`: USGA slope rating
- `guestCanBringOwnEquipment`: true/false for clubs
- `equipmentRental`: Available rental items
- `handicapAccessible`: true/false

---

## 4. BreadcrumbList Schema

### What It Does
Shows hierarchical navigation path in search results, improving CTR and site structure clarity.

### When to Use
Include on every course detail page and relevant listing pages.

### Example 1: Simple Breadcrumb

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://example.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Golf Courses",
      "item": "https://example.com/courses"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "New Jersey",
      "item": "https://example.com/courses/new-jersey"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Pine Valley Golf Club",
      "item": "https://example.com/courses/pine-valley"
    }
  ]
}
</script>
```

### Example 2: Geographic Breadcrumb

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Golf Times",
      "item": "https://example.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Northeast",
      "item": "https://example.com/northeast"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "New Jersey",
      "item": "https://example.com/northeast/new-jersey"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Pine Valley Area",
      "item": "https://example.com/northeast/new-jersey/pine-valley"
    },
    {
      "@type": "ListItem",
      "position": 5,
      "name": "Pine Valley Golf Club"
    }
  ]
}
</script>
```

### Breadcrumb Best Practices

- 3-5 levels deep is optimal
- Position numbering starts at 1
- Last item typically doesn't need URL
- Should match visible breadcrumb on page
- Use clear, descriptive names
- URLs should be actual links on page

---

## 5. Event Schema for Tee Times

### What It Does
Marks specific tee times and tournaments as events, enabling special search features and increased visibility.

### When to Use
Include on pages showing specific available tee times or major tournaments.

### Tee Time Booking Example

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Golf Tee Time - Pine Valley Golf Club",
  "description": "18-hole round at Pine Valley Golf Club. Championship course with pristine conditions.",
  "startDate": "2026-02-15T08:00:00-05:00",
  "endDate": "2026-02-15T12:00:00-05:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "GolfCourse",
    "name": "Pine Valley Golf Club",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Fairway Drive",
      "addressLocality": "Pine Valley",
      "addressRegion": "NJ",
      "postalCode": "08021",
      "addressCountry": "US"
    }
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/book-tee-time?date=2026-02-15&time=0800",
    "price": "185.00",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "availabilityEnds": "2026-02-15T08:00:00-05:00",
    "validFrom": "2026-01-08T00:00:00Z"
  },
  "organizer": {
    "@type": "Organization",
    "name": "Pine Valley Golf Club",
    "url": "https://example.com",
    "telephone": "+1-609-465-3886"
  }
}
</script>
```

### Tournament Example

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Annual Invitational Championship 2026",
  "description": "Premier 54-hole invitational tournament at Pine Valley. Limited field of 70 players.",
  "startDate": "2026-06-01T07:00:00-04:00",
  "endDate": "2026-06-03T18:00:00-04:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/MixedEventAttendanceMode",
  "location": {
    "@type": "GolfCourse",
    "name": "Pine Valley Golf Club"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/tournaments/invitational-2026",
    "price": "5000.00",
    "priceCurrency": "USD",
    "availability": "https://schema.org/OutOfStock",
    "validFrom": "2025-12-01T00:00:00Z"
  },
  "organizer": {
    "@type": "Organization",
    "name": "Pine Valley Golf Club",
    "url": "https://example.com"
  },
  "image": "https://example.com/images/tournament-hero.jpg"
}
</script>
```

### Event Status Reference

- `EventScheduled` - Event is confirmed and on calendar
- `EventCancelled` - Event has been cancelled
- `EventRescheduled` - Event moved to different date/time
- `EventPostponed` - Event delayed, new date TBD

### Availability Status

- `InStock` - Slots available for booking
- `OutOfStock` - Event fully booked
- `PreOrder` - Can book in advance, not yet available
- `Discontinued` - Event no longer offered

---

## Complete Page Implementation

Here's the full markup to include on a golf course detail page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Pine Valley Golf Club - Championship Golf Course</title>
  <meta name="description" content="Ranked among the top golf courses in the world. Pine Valley offers an 18-hole championship course with pristine conditions.">

  <!-- Schema 1: Main LocalBusiness + GolfCourse -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "GolfCourse"],
    "id": "https://example.com/courses/pine-valley#course",
    "name": "Pine Valley Golf Club",
    "url": "https://example.com/courses/pine-valley",
    "description": "Championship 18-hole golf course ranked among the world's best.",
    "telephone": "+1-609-465-3886",
    "email": "reservations@pinevalley.com",
    "image": "https://example.com/images/pine-valley-hero.jpg",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Fairway Drive",
      "addressLocality": "Pine Valley",
      "addressRegion": "NJ",
      "postalCode": "08021",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 39.8093,
      "longitude": -74.8902
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "07:00",
        "closes": "17:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Saturday", "Sunday"],
        "opens": "06:00",
        "closes": "17:00"
      }
    ],
    "acceptsReservations": true,
    "priceRange": "$$$",
    "sameAs": [
      "https://www.facebook.com/pinevalley",
      "https://www.instagram.com/pinevalley",
      "https://twitter.com/pinevalley"
    ],
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "Par",
        "value": "72"
      },
      {
        "@type": "PropertyValue",
        "name": "Holes",
        "value": "18"
      },
      {
        "@type": "PropertyValue",
        "name": "Course Rating",
        "value": "76.5"
      },
      {
        "@type": "PropertyValue",
        "name": "Slope Rating",
        "value": "147"
      }
    ]
  }
  </script>

  <!-- Schema 2: AggregateRating -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Pine Valley Golf Club",
    "url": "https://example.com/courses/pine-valley",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "bestRating": "5",
      "worstRating": "1",
      "ratingCount": 247,
      "reviewCount": 187
    },
    "review": [
      {
        "@type": "Review",
        "headline": "World-class experience",
        "reviewBody": "Exceptional course condition and outstanding service.",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5"
        },
        "datePublished": "2026-01-08",
        "author": {
          "@type": "Person",
          "name": "Michael Johnson"
        }
      }
    ]
  }
  </script>

  <!-- Schema 3: BreadcrumbList -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://example.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Golf Courses",
        "item": "https://example.com/courses"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "New Jersey",
        "item": "https://example.com/courses/new-jersey"
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": "Pine Valley Golf Club"
      }
    ]
  }
  </script>

</head>
<body>
  <!-- Page content -->
</body>
</html>
```

---

## Testing & Validation

### Before Launch

1. **Validate JSON syntax**
   - Use https://jsonlint.com/
   - Check for missing commas, quotes, brackets

2. **Test with Google Rich Results Test**
   - Go to https://search.google.com/test/rich-results
   - Paste your page URL or HTML
   - Look for green checkmarks

3. **Verify data accuracy**
   - Phone number matches Google Business Profile
   - Address matches exactly
   - Hours cover all day/time combinations
   - Coordinates point to correct location

4. **Check all URLs are absolute**
   - No relative paths like "/courses/pine-valley"
   - Must be full URLs: "https://example.com/courses/pine-valley"

5. **Test review markup**
   - Ensure reviews are from your own website
   - No third-party review aggregation
   - Dates are in ISO 8601 format

### After Launch

1. Monitor Google Search Console for structured data errors
2. Check Google Search results for rich results appearance
3. Test with voice assistants (Alexa, Siri, Google Assistant)
4. Verify course appears correctly in Google Maps
5. Check AI search engines (ChatGPT, Gemini, Perplexity)

---

## Common Mistakes to Avoid

1. **Using third-party reviews**
   - Only include reviews hosted on your website
   - Never mark up Google, Yelp, or TripAdvisor reviews

2. **Incorrect coordinates**
   - Make sure latitude/longitude point to clubhouse
   - Use Google Maps to verify location
   - Should be within 10 meters of actual entrance

3. **Mismatched data**
   - Ensure phone, address, hours match Google Business Profile exactly
   - Update schema when you update GBP

4. **Missing required properties**
   - LocalBusiness MUST have: name, address, phone, url, geo
   - AggregateRating MUST have: ratingValue, bestRating, worstRating, ratingCount

5. **Relative URLs**
   - All URLs must be absolute
   - "https://example.com/courses/pine-valley" not "/courses/pine-valley"

6. **Incorrect date formats**
   - Use ISO 8601: "2026-01-15T08:00:00-05:00"
   - Include timezone offset

7. **Fake ratings**
   - Only use real aggregate data from your reviews
   - Don't artificially inflate ratingCount or ratingValue

---

## SEO Impact Summary

With proper schema implementation, you can expect:

- **20-30% CTR improvement** in search results
- **Rich results appearance** (star ratings, price, amenities)
- **Better mobile visibility** in Google Maps
- **Voice search compatibility** (Alexa, Siri, Google Assistant)
- **AI assistant accuracy** (ChatGPT, Gemini, Bing Chat)
- **Improved local pack ranking** (top 3 results)

---

## Tools & Resources

- **Google Rich Results Test**: https://search.google.com/test/rich-results
- **Schema.org Validator**: https://validator.schema.org/
- **Google Search Central**: https://developers.google.com/search/docs
- **Schema.org Reference**: https://schema.org/
- **JSON Lint Validator**: https://jsonlint.com/
