# API Directory - PROTECTED

## DO NOT MODIFY without following these steps:

1. **Test locally first**: `node api/index.js`
2. **Verify all endpoints work**:
   - GET /api/health
   - GET /api/courses
   - GET /api/tee-times
   - GET /api/regions
3. **Run the test script**: `npm run test:api`
4. **Only then commit and push**

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/health | Health check |
| GET /api/courses | List courses with tee times |
| GET /api/courses/:id | Course details + tournament history |
| GET /api/tee-times | Search tee times with filters |
| GET /api/tee-times/dates | Available dates |
| GET /api/tee-times/summary | Stats summary |
| GET /api/regions | List regions |
| POST /api/scrape | Trigger scraper |

## If API breaks after deployment:

1. Restore vercel.json from backup: `cp vercel.json.backup vercel.json`
2. Redeploy: `./node_modules/.bin/vercel --prod --force`
