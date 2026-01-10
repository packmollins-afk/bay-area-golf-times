# Affiliate Implementation - Quick Start Guide

**For Development Team | January 2026**

---

## Phase 1: Activation (1-2 Days)

### Step 1: Get Credentials
```bash
# Apply here: https://affiliate.gnsvc.com/getting-started
# You will receive:
# - GOLFNOW_AFFILIATE_ID (e.g., "12345")
# - GOLFNOW_CHANNEL_ID (e.g., "11329")
# - GOLFNOW_USERNAME (API user)
# - GOLFNOW_PASSWORD (API password)
# - GOLFNOW_CLIENT_SECRET (for HMAC-SHA256)
```

### Step 2: Configure Environment Variables
```bash
# Add to Vercel dashboard:
# https://vercel.com/bayareagolf-now/settings/environment-variables

GOLFNOW_AFFILIATE_ID=your_affiliate_id_here
GOLFNOW_CHANNEL_ID=your_channel_id_here
GOLFNOW_USERNAME=your_api_username
GOLFNOW_PASSWORD=your_api_password
GOLFNOW_CLIENT_SECRET=your_client_secret
```

### Step 3: Verify Implementation (Already Done!)
The `/go/:slug` endpoint already includes this code:

```javascript
// Line 2813-2815 in api/index.js
if (process.env.GOLFNOW_AFFILIATE_ID && course.booking_system === 'golfnow') {
  redirectUrl += `&affiliate=${process.env.GOLFNOW_AFFILIATE_ID}`;
}
```

✅ **No code changes needed for Phase 1**

### Step 4: Test the Endpoint
```bash
# Visit this URL (replace with actual course slug):
# https://bayareagolf.now/api/go/presidio-golf-course

# You should see a redirect to GolfNow with parameters:
# https://golfnow.com/tee-times/...?utm_source=bayareagolf&utm_medium=web&utm_campaign=presidio-golf-course&affiliate=YOUR_ID
```

### Step 5: Verify in GolfNow Dashboard
```bash
# Login to: https://affiliate.gnsvc.com/dashboard
# Look for: "Impressions" counter incrementing
# You should see your affiliate ID being tracked
```

---

## Current Implementation Details

### Redirect Flow
```
User clicks "Book" on Presidio Golf Course
  ↓
GET /go/presidio-golf-course
  ↓
Database lookup: presidio-golf-course → booking_url="https://golfnow.com/..."
  ↓
Build redirect URL with parameters:
  - utm_source=bayareagolf
  - utm_medium=web
  - utm_campaign=presidio-golf-course
  - utm_content=regular (or "deal" if ?deal=true)
  - affiliate=YOUR_AFFILIATE_ID (if GolfNow course)
  ↓
HTTP 302 Redirect to GolfNow
  ↓
Track click in Turso database (clicks table)
```

### Database Tracking (Automatic)
```sql
-- Already stored in clicks table (44 columns):
INSERT INTO clicks (
  course_slug,
  course_name,
  booking_system,
  visitor_id,
  session_id,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  clicked_at,
  device_type,
  country,
  region,
  city,
  ...44 columns total
) VALUES (...)
```

### UTM Parameter Reference
| Parameter | Value | Example |
|-----------|-------|---------|
| `utm_source` | Always "bayareagolf" | utm_source=bayareagolf |
| `utm_medium` | Always "web" | utm_medium=web |
| `utm_campaign` | Course slug | utm_campaign=presidio-golf-course |
| `utm_content` | "deal" or "regular" | utm_content=regular |
| `affiliate` | Your affiliate ID (GolfNow only) | affiliate=12345 |

---

## Testing Checklist

- [ ] Environment variables set in Vercel dashboard
- [ ] Deploy new environment configuration
- [ ] Visit `/go/{golfnow-course-slug}` and get redirected to GolfNow
- [ ] Verify `&affiliate=YOUR_ID` appears in final redirect URL
- [ ] Check Turso clicks table for new entry
- [ ] Login to GolfNow affiliate dashboard
- [ ] Verify impressions are being counted
- [ ] Check that non-GolfNow courses DON'T have affiliate parameter

---

## Phase 2: Conversion Tracking (Week 3-4)

When ready, add conversion token tracking:

```javascript
// In /go/:slug endpoint, add:
const conversionToken = crypto.randomBytes(16).toString('hex');

// Append to redirect URL
redirectUrl += `&bag_conversion=${conversionToken}`;

// Store for later validation
await db.execute(`
  INSERT INTO affiliate_conversions
  (conversion_token, click_id, booking_system, course_slug, status)
  VALUES (?, ?, ?, ?, 'pending')
`, [conversionToken, clickId, bookingSystem, slug]);
```

---

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `/api/index.js` (lines 2793-2815) | Redirect + affiliate param | ✅ READY |
| `VERIFIED_AFFILIATE_IMPLEMENTATION_PLAN.md` | Full documentation | ✅ COMPLETE |
| `VERIFICATION_SUMMARY.md` | Quick reference | ✅ COMPLETE |
| GolfNow API docs | Integration reference | 📖 External |

---

## GolfNow Integration (Optional - Phase 2)

For more advanced tracking, use GolfNow API:

```javascript
// Query GolfNow for verified bookings
const golfNowAPI = require('./golfnow-integration');

const getAffiliateBookings = async (startDate, endDate) => {
  const response = await golfNowAPI.getAffiliateReservations(startDate, endDate);
  return response.reservations;
  // Returns: Array of {reservationId, bookingAmount, conversionTime, ...}
};
```

See `docs/golfnow-api-integration-guide.md` for full API reference.

---

## Monthly Revenue Report (Post-Launch)

Once Phase 2 is complete, generate monthly reports:

```javascript
// GET /api/admin/affiliate-metrics?month=2026-01

{
  "period": "2026-01",
  "clicks": {
    "golfnow": 150,
    "other": 50,
    "total": 200
  },
  "conversions": {
    "verified": 3,
    "pending": 2
  },
  "revenue": {
    "estimated": $9,
    "commission_rate": 3.00
  }
}
```

---

## Common Issues & Solutions

### Issue: Affiliate parameter not appearing in redirect
**Solution:** Check that `GOLFNOW_AFFILIATE_ID` environment variable is set in Vercel
```bash
vercel env pull  # Pull current environment
grep GOLFNOW_AFFILIATE_ID .env.local  # Verify it's there
```

### Issue: GolfNow impressions not counting
**Solution:** Verify your affiliate ID is correct and the course has `booking_system='golfnow'`
```sql
SELECT booking_system FROM courses WHERE slug='presidio-golf-course';
-- Should return: golfnow
```

### Issue: Redirect URL is too long
**Solution:** This shouldn't happen - URL builder already handles it, but if you see 414 errors:
```javascript
// Check that redirectUrl isn't exceeding 2048 characters
console.log(redirectUrl.length); // Should be <2000
```

---

## Support Resources

- **GolfNow Affiliate Portal:** https://affiliate.gnsvc.com/dashboard
- **GolfNow API Docs:** https://api.gnsvc.com/
- **GolfNow Support:** https://affiliate.gnsvc.com/support
- **Getting Started:** https://affiliate.gnsvc.com/getting-started

---

## Verification Checklist (Sign-Off)

**Phase 1 - Environment Setup:**
- [ ] GOLFNOW_AFFILIATE_ID environment variable set
- [ ] GOLFNOW_CHANNEL_ID environment variable set
- [ ] All 5 variables configured in Vercel
- [ ] Deployment includes new environment variables

**Phase 1 - Testing:**
- [ ] Test redirect: `/go/{golfnow-course}`
- [ ] Verify affiliate parameter in redirect URL
- [ ] Verify click recorded in Turso clicks table
- [ ] GolfNow dashboard shows impression count

**Ready for Launch:**
- [ ] All Phase 1 items complete
- [ ] GolfNow business agreement signed
- [ ] Commission reporting structure confirmed
- [ ] Team briefed on revenue tracking

---

**Status:** Phase 1 Ready to Implement
**Estimated Effort:** 2-4 hours (mostly waiting on GolfNow approval)
**Risk Level:** Very Low (0 code changes needed for Phase 1)

---

Last Updated: January 8, 2026
