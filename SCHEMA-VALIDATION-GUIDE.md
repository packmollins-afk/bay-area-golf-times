# Golf Course Schema.org Validation & Testing Guide

## Quick Validation Checklist

### Before Deployment
- [ ] Validate JSON syntax with https://jsonlint.com/
- [ ] Test with Google Rich Results Test: https://search.google.com/test/rich-results
- [ ] Phone number matches Google Business Profile exactly
- [ ] Address matches Google Business Profile exactly
- [ ] Coordinates verified with Google Maps (within 10 meters)
- [ ] All URLs are absolute (start with https://)
- [ ] Hero image is at least 1200x628 pixels
- [ ] All dates in ISO 8601 format with timezone
- [ ] Reviews are from your own website only
- [ ] Opening hours cover all day/time variations

### After Deployment
- [ ] Check Google Search Console for structured data errors
- [ ] Monitor search results for rich snippet appearance
- [ ] Test voice search (Alexa, Siri, Google Assistant)
- [ ] Verify in Google Maps
- [ ] Check AI search engines (ChatGPT, Gemini)
- [ ] Set up Google Search Console alerts

---

## Detailed Validation Guide

### 1. JSON Syntax Validation

**Tool**: https://jsonlint.com/

Copy your JSON-LD code (without the `<script>` tags) and paste into JSONLint.

**Common JSON errors to watch for**:
```javascript
// ❌ WRONG: Missing comma between properties
{
  "name": "Pine Valley Golf Club"
  "telephone": "+1-609-465-3886"
}

// ✅ CORRECT: Comma after each property except last
{
  "name": "Pine Valley Golf Club",
  "telephone": "+1-609-465-3886"
}
```

```javascript
// ❌ WRONG: Trailing comma before closing brace
{
  "name": "Pine Valley Golf Club",
  "telephone": "+1-609-465-3886",
}

// ✅ CORRECT: No comma after last property
{
  "name": "Pine Valley Golf Club",
  "telephone": "+1-609-465-3886"
}
```

```javascript
// ❌ WRONG: Single quotes instead of double quotes
{
  'name': 'Pine Valley Golf Club'
}

// ✅ CORRECT: Double quotes for all strings
{
  "name": "Pine Valley Golf Club"
}
```

### 2. Google Rich Results Test

**Tool**: https://search.google.com/test/rich-results

Steps:
1. Copy your complete HTML page URL or code
2. Click "Test URL" or "Test HTML"
3. Wait for results

**Expected results for LocalBusiness**:
- ✅ Rich result type: Business
- ✅ Shows course name, address, phone
- ✅ Shows star rating (if review schema included)
- ✅ Shows opening hours

**Expected results for review schema**:
- ✅ Shows 5-star rating
- ✅ Shows review count
- ✅ Rich snippet appears in search preview

**Expected results for BreadcrumbList**:
- ✅ Shows breadcrumb path
- ✅ Shows in search results preview
- ✅ Clickable breadcrumb navigation

**Common issues**:
- Warning: "Missing recommended property" - Add missing property to schema
- Error: "Invalid value for property" - Fix property value (e.g., date format)
- Error: "Missing required property" - Add required field
- Warning: "Reviews not from page" - Ensure reviews are from your domain

### 3. Data Accuracy Validation

#### Phone Number Format
```
❌ WRONG: "609-465-3886" (no country code)
❌ WRONG: "(609) 465-3886" (formatting)
❌ WRONG: "+1609-465-3886" (missing hyphen)
✅ CORRECT: "+1-609-465-3886" (E.164 format)
✅ CORRECT: "+16094653886" (E.164 format, no hyphens)
```

**Action**: Compare your schema phone with Google Business Profile

#### Address Format
```
❌ WRONG: "123 Fairway Dr., Pine Valley, NJ 08021"
❌ WRONG: "123 Fairway Drive, Pine Valley, New Jersey 08021"
✅ CORRECT:
{
  "streetAddress": "123 Fairway Drive",
  "addressLocality": "Pine Valley",
  "addressRegion": "NJ",
  "postalCode": "08021"
}
```

**Action**: Copy address from Google Business Profile exactly

#### Latitude/Longitude Verification
1. Go to https://maps.google.com
2. Search for your golf course
3. Click on course name
4. Look for coordinates in URL or info panel
5. Verify they're within 10 meters of clubhouse entrance

```
❌ WRONG:
"latitude": 39.81,
"longitude": -74.89
(Too imprecise)

✅ CORRECT:
"latitude": 39.8093,
"longitude": -74.8902
(At least 4 decimal places)
```

### 4. URL Validation

**Rule**: All URLs must be absolute, starting with https://

```
❌ WRONG:
"url": "/courses/pine-valley"
"image": "/images/hero.jpg"

✅ CORRECT:
"url": "https://example.com/courses/pine-valley"
"image": "https://example.com/images/hero.jpg"
```

**Action**: Search for all relative URLs and add full domain

### 5. Image Validation

**Recommended sizes**:
- Hero image: 1200x628px (for social sharing)
- Minimum: 1200x628px
- Multiple images: 3-4 images total

**Check**:
1. Image URLs are absolute (https://...)
2. Image URLs are accessible (not 404 errors)
3. Images are high quality (compressed but clear)
4. Hero image has correct aspect ratio

**Tool**: Right-click image → "Open image in new tab" to verify it loads

### 6. Date & Time Validation

**Format**: ISO 8601 with timezone offset

```
❌ WRONG: "2026-01-15 08:00 AM" (not ISO 8601)
❌ WRONG: "2026-01-15T08:00:00" (missing timezone)
✅ CORRECT: "2026-01-15T08:00:00-05:00" (EST timezone)
✅ CORRECT: "2026-01-15T08:00:00+00:00" (UTC timezone)
```

**Timezone offsets by region**:
```
Pacific:  -08:00 (standard) or -07:00 (daylight)
Mountain: -07:00 (standard) or -06:00 (daylight)
Central:  -06:00 (standard) or -05:00 (daylight)
Eastern:  -05:00 (standard) or -04:00 (daylight)
UTC:      +00:00
```

**Action**: Determine your timezone and use correct offset

### 7. Review Schema Validation

**Critical**: Only include reviews hosted on your website

**Check each review**:
1. Review is from your domain (not Google, Yelp, etc.)
2. Review text is original and substantial (2+ sentences)
3. Rating is 1-5 integer
4. Date is in ISO 8601 format (YYYY-MM-DD)
5. Author name is real person (not anonymous)
6. Mix of ratings (not all 5-stars)

```javascript
// ❌ WRONG: Third-party review
{
  "@type": "Review",
  "headline": "5 stars on Google",
  "reviewBody": "This comment from a Google review",
  "url": "https://maps.google.com/..." // NO!
}

// ✅ CORRECT: First-party review
{
  "@type": "Review",
  "headline": "World-class experience",
  "reviewBody": "Stayed on our website, original content written by golfer",
  "author": {
    "@type": "Person",
    "name": "John Smith"
  }
}
```

### 8. Opening Hours Validation

**Requirements**:
1. Specify for each day/hour variation
2. Use 24-hour time format (HH:MM)
3. Cover all operating hours
4. Match Google Business Profile

```javascript
// ❌ WRONG: Missing hours for weekend
{
  "openingHoursSpecification": [
    {
      "dayOfWeek": ["Monday", "Tuesday"],
      "opens": "07:00",
      "closes": "17:00"
    }
  ]
}

// ✅ CORRECT: All days specified
{
  "openingHoursSpecification": [
    {
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "07:00",
      "closes": "17:00"
    },
    {
      "dayOfWeek": ["Saturday", "Sunday"],
      "opens": "06:00",
      "closes": "17:00"
    }
  ]
}
```

**Note**: If hours vary by date (seasonal), use multiple specifications

### 9. Aggregate Rating Validation

**Requirements**:
1. ratingValue: 1.0-5.0 (can be decimal)
2. bestRating: must be "5"
3. worstRating: must be "1"
4. ratingCount: match actual count
5. reviewCount: match number of reviews included

```javascript
// ❌ WRONG: Fake aggregate rating
{
  "aggregateRating": {
    "ratingValue": "5",
    "ratingCount": 10000  // Don't make up numbers!
  }
}

// ✅ CORRECT: Real aggregate data
{
  "aggregateRating": {
    "ratingValue": "4.7",
    "bestRating": "5",
    "worstRating": "1",
    "ratingCount": 247,
    "reviewCount": 187
  }
}
```

**Action**: Pull actual numbers from your review system

### 10. Event Schema Validation (Tee Times)

**For each tee time event, validate**:

```javascript
// ✅ CORRECT example
{
  "@type": "SportsEvent",
  "name": "Golf Tee Time - 8:00 AM",
  "startDate": "2026-02-15T08:00:00-05:00",  // ISO 8601
  "endDate": "2026-02-15T12:00:00-05:00",    // Must be after start
  "eventStatus": "https://schema.org/EventScheduled",  // Valid value
  "location": {
    "@type": "GolfCourse",
    "name": "Pine Valley Golf Club"
  },
  "offers": {
    "@type": "Offer",
    "price": "185.00",
    "priceCurrency": "USD",  // ISO 4217 currency code
    "availability": "https://schema.org/InStock"  // Valid value
  }
}
```

**Validate**:
- Event name is descriptive
- startDate is before endDate
- Price matches your website
- Currency is correct (USD, EUR, etc.)
- Availability is realistic

---

## Post-Launch Monitoring

### 1. Google Search Console

1. Go to https://search.google.com/search-console
2. Select your property
3. Go to "Enhancements" → "Rich Results"
4. Look for "Business" or "Rating" enhancements
5. Check for "Valid" vs "Errors"

**Actions**:
- Fix any errors shown
- Click on success items to see sample rich snippets
- Monitor for new errors after updates

### 2. Structured Data Test Tool

Re-test your page periodically:
1. https://search.google.com/test/rich-results
2. Paste your URL
3. Check for green checkmarks
4. Look for warnings or errors

**Frequency**: Test after any page changes

### 3. Search Results Visibility

1. Search Google for your golf course name
2. Check if rich snippet appears (star rating, hours, etc.)
3. May take 2-4 weeks to show in live results
4. Click on your listing to verify content

### 4. Voice Search Testing

Test with voice assistants:

```
Alexa: "Open Alexa app → search for your course"
Siri: Ask from Apple device
Google Assistant: Use Google Home or Assistant app
```

Examples:
- "What are the hours at Pine Valley Golf Club?"
- "What's the phone number for Pine Valley?"
- "How much is a round at Pine Valley?"

### 5. AI Search Engine Testing

Check these AI platforms:
- ChatGPT: https://chat.openai.com
- Google Gemini: https://gemini.google.com
- Bing Chat: https://copilot.microsoft.com
- Perplexity: https://www.perplexity.ai

**Test queries**:
- "What is Pine Valley Golf Club?"
- "Where is Pine Valley located?"
- "What is the phone number for Pine Valley?"

**Expected**: Accurate course info pulled from your schema

---

## Common Problems & Solutions

### Problem 1: "Invalid value for type"

**Error message**:
```
Invalid value for property "ratingValue". Value "Poor" does not conform to the defined format.
```

**Solution**:
- ratingValue must be a number (1-5)
- Not text like "Poor" or "Good"

```javascript
❌ "ratingValue": "Excellent"
✅ "ratingValue": "4.8"
```

### Problem 2: "Missing required property"

**Error message**:
```
Missing required property "address"
```

**Solution**: Add complete PostalAddress object

```javascript
✅ CORRECT:
"address": {
  "@type": "PostalAddress",
  "streetAddress": "123 Fairway Drive",
  "addressLocality": "Pine Valley",
  "addressRegion": "NJ",
  "postalCode": "08021",
  "addressCountry": "US"
}
```

### Problem 3: "Rich results not eligible"

**Error message**:
```
Rich result type "Business" is not eligible for this page
```

**Possible causes**:
1. Missing required properties (name, address, phone)
2. Data mismatches between page and schema
3. Page marked as noindex
4. Schema has validation errors

**Solutions**:
1. Verify all required properties are present
2. Check data accuracy (addresses, phone, etc.)
3. Remove noindex tag if applied
4. Fix validation errors
5. Retest in Rich Results Test tool

### Problem 4: Third-party reviews marked up

**Error message**:
```
Warning: Review not from this site
```

**Solution**: Only include reviews from your domain

```javascript
❌ WRONG - Don't do this:
{
  "review": [
    {
      "headline": "Review from Google",
      "url": "https://maps.google.com/..." // Google review
    }
  ]
}

✅ CORRECT:
{
  "review": [
    {
      "headline": "Review from our site",
      "author": { "name": "Actual Golfer" }
      // No URL - means it's hosted here
    }
  ]
}
```

### Problem 5: Coordinates showing wrong location

**Check**:
1. Go to Google Maps
2. Search for your golf club
3. Click on the marker
4. Get the coordinates from the URL

**Example URL**:
```
https://maps.google.com/?q=39.8093,-74.8902
```
Coordinates: `39.8093, -74.8902`

**Update schema**:
```javascript
"geo": {
  "@type": "GeoCoordinates",
  "latitude": 39.8093,
  "longitude": -74.8902
}
```

### Problem 6: Hours don't match Google Business Profile

**Solution**:
1. Log into Google Business Profile
2. Check "Hours" section
3. Update your schema to match exactly
4. If hours are complex, create separate specifications

```javascript
// If GBP says Mon-Fri 7am-5pm, Sat-Sun 6am-5pm:
"openingHoursSpecification": [
  {
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "opens": "07:00",
    "closes": "17:00"
  },
  {
    "dayOfWeek": ["Saturday", "Sunday"],
    "opens": "06:00",
    "closes": "17:00"
  }
]
```

---

## Schema Validation Tools Summary

| Tool | Purpose | URL |
|------|---------|-----|
| JSONLint | Validate JSON syntax | https://jsonlint.com/ |
| Rich Results Test | Test rich snippets | https://search.google.com/test/rich-results |
| Schema.org Validator | Validate Schema.org markup | https://validator.schema.org/ |
| Google Search Console | Monitor live results | https://search.google.com/search-console |
| Structured Data Tool | Test structured data | https://developers.google.com/search/tools |
| Google Maps | Verify coordinates | https://maps.google.com |

---

## Testing Checklist - Before Going Live

### Technical Validation
- [ ] JSON syntax valid (JSONLint)
- [ ] Google Rich Results Test passes
- [ ] Schema Markup Validator shows no errors
- [ ] All URLs are absolute (https://...)
- [ ] All dates in ISO 8601 format
- [ ] Images 1200x628px minimum
- [ ] No relative paths in schema

### Data Accuracy
- [ ] Name matches Google Business Profile exactly
- [ ] Phone matches Google Business Profile exactly
- [ ] Address matches Google Business Profile exactly
- [ ] Hours match Google Business Profile
- [ ] Coordinates verified with Google Maps
- [ ] Email is active and monitored
- [ ] All social profile URLs are correct

### Review Schema
- [ ] Only first-party reviews included
- [ ] Reviewer names are real (not anonymous)
- [ ] Review ratings are 1-5
- [ ] Review dates are accurate
- [ ] At least 3-5 reviews for credibility
- [ ] Mix of 4-5 star ratings (realistic)
- [ ] Review text is substantial (2+ sentences)

### Business Info
- [ ] All required properties present
- [ ] All amenities relevant to golf
- [ ] Course specs (Par, rating, slope) correct
- [ ] Business hours cover all variations
- [ ] Founder/established date accurate
- [ ] Logo/images high quality

### Post-Deployment (First 2 Weeks)
- [ ] Monitor Search Console daily
- [ ] Check search results for rich snippets
- [ ] Verify voice assistant responses
- [ ] Test mobile display
- [ ] Monitor for ranking improvements
- [ ] Fix any reported errors

---

## Maintenance Tasks

### Weekly
- [ ] Check Google Search Console for new errors
- [ ] Monitor search results for rich snippet appearance
- [ ] Check that page is indexed

### Monthly
- [ ] Re-test with Rich Results Test tool
- [ ] Update review schema with new reviews
- [ ] Check that hours still match GBP
- [ ] Verify images are still loading

### Quarterly
- [ ] Audit all property values for accuracy
- [ ] Update course specs if changed
- [ ] Check competitor schemas for improvements
- [ ] Test with AI search engines

---

## SEO Benefits You Should See

**Within 2-4 weeks**:
- Rich snippets appear in search results
- Star ratings visible in business cards
- Opening hours displayed
- Click-through rate increase

**Within 1-3 months**:
- Better visibility in Google Maps
- More voice assistant traffic
- Improved local pack ranking
- Increased reservation inquiries

**Long-term**:
- Sustained competitive advantage
- Better AI assistant representation
- Improved answer engine visibility
- Authority building for golf niche
