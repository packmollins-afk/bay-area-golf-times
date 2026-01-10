# Domain Migration Guide: bayareagolf.now → golfthebay.com

## Overview
This guide covers the safe migration from `bayareagolf.now` to `golfthebay.com` while keeping the site operational throughout the transition.

---

## Environment Variables

### During Migration (Set These First)
```bash
# Keep old domain working during transition
PRIMARY_DOMAIN=bayareagolf.now

# Keep using old email sender until new domain is verified in Resend
RESEND_FROM_EMAIL="Bay Area Golf <noreply@bayareagolf.now>"
```

### After Migration Complete (Update These)
```bash
# Switch to new domain
PRIMARY_DOMAIN=golfthebay.com

# Use new email sender (after verifying domain in Resend)
RESEND_FROM_EMAIL="Golf The Bay <noreply@golfthebay.com>"
```

---

## Safe Deployment Steps

### Phase 1: Deploy Code (Can Do Immediately)

The code now supports both domains simultaneously:
- CORS allows requests from both `bayareagolf.now` and `golfthebay.com`
- Email URLs use `PRIMARY_DOMAIN` env var (defaults to old domain if not set)
- 301 redirects are configured but only activate when new domain is set up

```bash
# 1. Commit and deploy
cd bay-area-golf-times
git add .
git commit -m "Rebrand to Golf The Bay with migration safety"
git push  # Triggers Vercel deploy
```

**Result**: Site continues working on bayareagolf.now with no changes to user experience.

---

### Phase 2: Set Up New Domain (When Ready)

#### 2a. Add Domain to Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Click "Add Domain"
3. Enter `golfthebay.com`
4. Also add `www.golfthebay.com`

#### 2b. Configure DNS
At your domain registrar (where you bought golfthebay.com):

```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

#### 2c. Wait for SSL
Vercel will automatically provision SSL. Wait until the domain shows as "Valid" in Vercel dashboard (~5-10 minutes).

#### 2d. Test New Domain
- Visit https://golfthebay.com - should load the site
- Visit https://bayareagolf.now - should redirect to golfthebay.com

---

### Phase 3: Update Email Domain (When Ready)

#### 3a. Add Domain to Resend
1. Go to Resend Dashboard → Domains
2. Add `golfthebay.com`
3. Add the DNS records Resend provides (SPF, DKIM, DMARC)
4. Wait for verification (can take up to 24 hours)

#### 3b. Update Environment Variable
In Vercel Dashboard → Settings → Environment Variables:

```bash
RESEND_FROM_EMAIL="Golf The Bay <noreply@golfthebay.com>"
PRIMARY_DOMAIN=golfthebay.com
```

Redeploy after updating env vars.

---

### Phase 4: Google Search Console Migration

1. Add `golfthebay.com` as a new property in Search Console
2. Verify ownership (DNS TXT record or HTML file)
3. Go to old property (`bayareagolf.now`) → Settings → Change of Address
4. Select `golfthebay.com` as the new site
5. Submit the change

---

## Timeline Recommendation

| Day | Action |
|-----|--------|
| Day 1 | Deploy code (Phase 1) |
| Day 1 | Add golfthebay.com to Vercel, configure DNS (Phase 2a-2c) |
| Day 1 | Test both domains work (Phase 2d) |
| Day 2-3 | Add golfthebay.com to Resend, wait for verification (Phase 3a) |
| Day 3+ | Update env vars to use new domain (Phase 3b) |
| Day 7+ | Complete Google Search Console migration (Phase 4) |
| Day 30+ | Remove old domain from CORS (cleanup) |

---

## Rollback Plan

If anything goes wrong:

1. **Revert env vars** to old domain values:
   ```bash
   PRIMARY_DOMAIN=bayareagolf.now
   RESEND_FROM_EMAIL="Bay Area Golf <noreply@bayareagolf.now>"
   ```

2. **Old domain still works** - CORS is configured to accept both domains

3. **Redirects are in Vercel config** - can be removed by editing `vercel.json` if needed

---

## Cleanup (After 30 Days)

Once confident the migration is complete:

1. Remove old domain from CORS in `api/index.js`:
   ```javascript
   // Remove these lines from allowedOrigins:
   'https://bayareagolf.now',
   'https://www.bayareagolf.now',
   ```

2. Remove `PRIMARY_DOMAIN` env var (code defaults to golfthebay.com)

3. Keep the 301 redirects in `vercel.json` permanently for SEO

---

## What's Already Done

- [x] All meta tags updated (og:, twitter:, canonical)
- [x] Sitemap URLs updated
- [x] robots.txt updated
- [x] Package name updated
- [x] PWA manifest updated
- [x] Email templates updated
- [x] JSON-LD structured data updated
- [x] 301 redirect configuration added
- [x] CORS configured for both domains
- [x] Tests updated
- [x] Documentation updated

---

## Files Changed

See git diff for complete list. Key files:
- `vercel.json` - redirect config
- `api/index.js` - CORS, emails, sitemap
- `app/sitemap.ts`, `app/robots.ts` - SEO
- `app/layout.tsx` - metadata
- `public/*.html` - all HTML files
- `public/manifest.json`, `public/site.webmanifest`
- `services/*.js` - calendar services
- `package.json` - project name
