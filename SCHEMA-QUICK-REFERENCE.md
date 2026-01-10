# Golf Course Schema.org - Quick Reference Card

## Copy-Paste Ready Templates

### Minimal LocalBusiness + GolfCourse (Required)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "GolfCourse"],
  "name": "COURSE_NAME",
  "url": "https://yourdomain.com/course-page",
  "telephone": "+1-XXXXXXXXXX",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "STREET_ADDRESS",
    "addressLocality": "CITY",
    "addressRegion": "STATE",
    "postalCode": "ZIP",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": LATITUDE,
    "longitude": LONGITUDE
  }
}
</script>
```

**Required replacements**:
- `COURSE_NAME`: Your golf course name
- `https://yourdomain.com/course-page`: Your actual URL
- `+1-XXXXXXXXXX`: Your phone with country code
- `STREET_ADDRESS`: Full street address
- `CITY`: City name
- `STATE`: 2-letter state code
- `ZIP`: 5-digit postal code
- `LATITUDE`: Decimal number (e.g., 39.8093)
- `LONGITUDE`: Decimal number (e.g., -74.8902)

---

### LocalBusiness + GolfCourse (Recommended)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "GolfCourse"],
  "name": "Pine Valley Golf Club",
  "url": "https://example.com/courses/pine-valley",
  "telephone": "+1-609-465-3886",
  "email": "reservations@pinevalley.com",
  "image": "https://example.com/images/hero-1200x628.jpg",
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
```

---

### AggregateRating + Reviews (Optional but Recommended)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Pine Valley Golf Club",
  "url": "https://example.com/courses/pine-valley",
  "image": "https://example.com/images/course.jpg",
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
      "reviewBody": "Exceptional course condition and outstanding service. Worth every penny.",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5"
      },
      "datePublished": "2026-01-08",
      "author": {
        "@type": "Person",
        "name": "John Smith"
      }
    }
  ]
}
</script>
```

---

### BreadcrumbList (Recommended)

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
      "name": "Pine Valley Golf Club"
    }
  ]
}
</script>
```

---

### Tee Time Event (For Booking Pages)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Golf Tee Time - 8:00 AM",
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
      "postalCode": "08021"
    }
  },
  "offers": {
    "@type": "Offer",
    "price": "185.00",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
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

---

## Property Quick Reference

### LocalBusiness Properties

| Property | Required | Example | Notes |
|----------|----------|---------|-------|
| `@context` | Yes | `"https://schema.org"` | Always this |
| `@type` | Yes | `["LocalBusiness", "GolfCourse"]` | Array of types |
| `name` | Yes | `"Pine Valley"` | Must match GBP |
| `url` | Yes | `"https://example.com/course"` | Course page URL |
| `telephone` | Yes | `"+1-609-465-3886"` | E.164 format |
| `address` | Yes | PostalAddress object | Full address |
| `geo` | Yes | GeoCoordinates object | lat/long |
| `email` | Recommended | `"contact@course.com"` | Contact email |
| `image` | Recommended | `"https://...jpg"` | Hero image URL |
| `description` | Recommended | Course description | 50-160 chars |
| `openingHoursSpecification` | Recommended | Hours array | All day/time combos |
| `priceRange` | Recommended | `"$$$"` | $ to $$$$ |
| `sameAs` | Recommended | Social URLs | Facebook, Instagram, etc |
| `acceptsReservations` | Recommended | `true` | Online booking |
| `amenityFeature` | Recommended | Array | Pro shop, lessons, etc |
| `additionalProperty` | Recommended | Array | Par, rating, slope |

### PostalAddress Properties

```javascript
"address": {
  "@type": "PostalAddress",
  "streetAddress": "123 Fairway Drive",
  "addressLocality": "Pine Valley",
  "addressRegion": "NJ",
  "postalCode": "08021",
  "addressCountry": "US"
}
```

### GeoCoordinates Properties

```javascript
"geo": {
  "@type": "GeoCoordinates",
  "latitude": 39.8093,
  "longitude": -74.8902
}
```

### OpeningHoursSpecification Properties

```javascript
"openingHoursSpecification": [
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday"],
    "opens": "07:00",        // 24-hour format
    "closes": "17:00"        // 24-hour format
  }
]
```

### AggregateRating Properties

```javascript
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.8",      // 1-5, can have decimal
  "bestRating": "5",         // Always "5"
  "worstRating": "1",        // Always "1"
  "ratingCount": 247,        // Total ratings
  "reviewCount": 187         // Reviews with text
}
```

### Review Properties

```javascript
"review": [
  {
    "@type": "Review",
    "headline": "Great course",
    "reviewBody": "Detailed review text here",
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": "5"     // 1-5
    },
    "datePublished": "2026-01-08",  // YYYY-MM-DD
    "author": {
      "@type": "Person",
      "name": "John Smith"
    }
  }
]
```

---

## Common Values Reference

### Day of Week Options
```javascript
"dayOfWeek": [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
]
```

### Price Range Values
```javascript
"priceRange": "$"      // Budget
"priceRange": "$$"     // Moderate
"priceRange": "$$$"    // Expensive
"priceRange": "$$$$"   // Very Expensive
```

### Availability Values (for events)
```javascript
"availability": "https://schema.org/InStock"     // Available
"availability": "https://schema.org/OutOfStock"  // Fully booked
"availability": "https://schema.org/PreOrder"    // Future booking
```

### Event Status Values
```javascript
"eventStatus": "https://schema.org/EventScheduled"
"eventStatus": "https://schema.org/EventCancelled"
"eventStatus": "https://schema.org/EventRescheduled"
"eventStatus": "https://schema.org/EventPostponed"
```

### Event Attendance Mode
```javascript
"eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode"  // In-person
"eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode"   // Virtual
"eventAttendanceMode": "https://schema.org/MixedEventAttendanceMode"    // Both
```

---

## Time Format Reference

### Hours Format (24-hour)
```
Opens 7:00 AM  → "opens": "07:00"
Opens 8:30 AM  → "opens": "08:30"
Closes 5:00 PM → "closes": "17:00"
Closes 6:30 PM → "closes": "18:30"
```

### Date Format (ISO 8601)
```
January 15, 2026 8:00 AM EST → "2026-01-15T08:00:00-05:00"
June 1, 2026 7:00 AM EDT     → "2026-06-01T07:00:00-04:00"
```

### Timezone Offsets
```
PST/PDT:  -08:00 or -07:00
MST/MDT:  -07:00 or -06:00
CST/CDT:  -06:00 or -05:00
EST/EDT:  -05:00 or -04:00
UTC:      +00:00
```

---

## Validation Checklist

### Before Deploying
```
[ ] JSON syntax valid - https://jsonlint.com/
[ ] Google Rich Results Test passes - https://search.google.com/test/rich-results
[ ] Phone matches GBP exactly
[ ] Address matches GBP exactly
[ ] Hours cover all day/time variations
[ ] Coordinates verified with Google Maps
[ ] All URLs start with https://
[ ] All dates in ISO 8601 format
[ ] Images at least 1200x628px
[ ] Only first-party reviews included
```

### After Deploying
```
[ ] Check Google Search Console for errors
[ ] Monitor search results for rich snippet
[ ] Test voice assistant (Alexa, Siri)
[ ] Test mobile display
[ ] Check Google Maps appearance
[ ] Verify AI search engines (ChatGPT, Gemini)
```

---

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|----------------|-----|
| Using relative URLs | Search engines can't follow | Use full URLs: `https://domain.com/page` |
| Third-party reviews | Google won't display them | Only include reviews from your site |
| Wrong date format | Schema validation fails | Use ISO 8601: `2026-01-15T08:00:00-05:00` |
| Missing timezone | Date is ambiguous | Always include timezone offset: `-05:00` |
| Phone without country code | Won't work in some regions | Add +1: `+1-609-465-3886` |
| Single quotes | Invalid JSON | Use double quotes: `"name"` |
| Trailing commas | JSON syntax error | Remove comma after last property |
| Imprecise coordinates | Maps to wrong location | Use 4 decimal places: `39.8093` |
| Mismatched data | Confusion for users/engines | Keep schema = GBP = website |

---

## Testing Tools Bookmarks

Save these URLs for quick access:

1. **JSON Lint**: https://jsonlint.com/
2. **Rich Results Test**: https://search.google.com/test/rich-results
3. **Schema Validator**: https://validator.schema.org/
4. **Search Console**: https://search.google.com/search-console
5. **Google Maps**: https://maps.google.com
6. **GBP**: https://business.google.com

---

## Implementation Order (Priority)

1. **First** (CRITICAL): LocalBusiness + GolfCourse schema with required properties
2. **Second** (HIGH): Add opening hours and course specs
3. **Third** (HIGH): Add AggregateRating (if you have reviews)
4. **Fourth** (MEDIUM): Add BreadcrumbList
5. **Fifth** (MEDIUM): Add amenities and images
6. **Sixth** (LOW): Add event schema for tee times

---

## Expected SEO Results

**Without Schema**: Regular text listing in search results

**With Basic Schema**:
- Business card with hours
- Phone number clickable
- Address with map link

**With Full Schema**:
- 5-star rating displayed
- Hours prominently shown
- Rich snippet in results
- Click-through rate +20-30%
- Better voice assistant responses
- Improved local pack ranking

---

## Quick Troubleshooting

### "Schema not showing in results"
- Check Google Search Console for errors
- Verify data accuracy matches page
- Wait 2-4 weeks for indexing
- Test with Rich Results Test tool
- Check that page isn't noindex

### "Wrong information displayed"
- Update schema to match website content
- Update Google Business Profile
- Ensure phone/address/hours are identical across all three

### "Validation errors"
- Run through JSONLint to find syntax issues
- Check all dates are ISO 8601
- Verify all URLs are absolute
- Ensure properties are spelled correctly

### "Reviews not showing"
- Ensure reviews are from your domain
- Include datePublished for each review
- Have at least 3 reviews
- Check that author names are included

---

## Version History

- **v1.0** - Created 2026-01-08
- Covers Schema.org v13.0
- Google Guidelines as of February 2025
- Tested with Google Search, Maps, Alexa, Siri
