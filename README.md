# Bay Area Golf Tee Times

An OpenTable-style aggregator for public golf course tee times across the Bay Area. Search and filter available tee times across 40+ courses in San Francisco, South Bay, East Bay, and Marin County.

## Features

- **40+ Public Courses**: Aggregates tee times from courses across all Bay Area regions
- **Real-time Filtering**: Filter by date, time, price, region, and holes
- **Sorted Results**: Sort by time, price, or course name
- **Direct Booking**: Links directly to booking pages
- **Hot Deals**: Highlights discounted tee times

## Quick Start

```bash
# Install dependencies
npm install

# Generate demo data
npm run setup

# Start the server
npm start

# Open http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the production server |
| `npm run dev` | Start with auto-reload for development |
| `npm run setup` | Initialize database with demo data |
| `npm run scrape` | Fetch real tee times from GolfNow |
| `npm run scrape 14` | Scrape for the next 14 days |

## API Endpoints

### GET /api/tee-times
Search for tee times with filters.

Query parameters:
- `date` - Filter by date (YYYY-MM-DD)
- `region` - Filter by region (San Francisco, South Bay, East Bay, Marin)
- `course_id` - Filter by specific course
- `min_time` - Filter times after (HH:MM)
- `max_time` - Filter times before (HH:MM)
- `max_price` - Maximum price filter
- `holes` - Filter by holes (9 or 18)
- `sort_by` - Sort field (datetime, price, course_name)
- `sort_order` - ASC or DESC
- `limit` - Results per page (default 100)
- `offset` - Pagination offset

### GET /api/courses
Get all courses, optionally filtered by region.

### GET /api/regions
Get list of available regions.

### GET /api/tee-times/summary
Get summary statistics (total times, average price, etc.)

### POST /api/scrape
Trigger a manual scrape. Body: `{ "days": 7 }`

## Courses by Region

### San Francisco (6 courses)
- TPC Harding Park
- Presidio Golf Course
- Lincoln Park Golf Course
- Sharp Park Golf Course (Pacifica)
- Golden Gate Park Golf Course
- Fleming Golf Course

### South Bay (15+ courses)
- Cinnabar Hills Golf Club
- San Jose Municipal
- Palo Alto Golf Course
- Coyote Creek Golf Club
- And more...

### East Bay (15+ courses)
- Corica Park (North & South)
- Metropolitan Golf Links
- Tilden Park Golf Course
- Poppy Ridge Golf Course
- And more...

### Marin County (5 courses)
- Peacock Gap Golf Club
- StoneTree Golf Club
- Indian Valley Golf Club
- Mill Valley Golf Course
- McInnis Park Golf Center

## Architecture

```
bay-area-golf-times/
├── src/
│   ├── api/
│   │   └── server.js      # Express API server
│   ├── db/
│   │   ├── schema.js      # SQLite database schema
│   │   └── courses.js     # Course data and queries
│   ├── scrapers/
│   │   └── golfnow.js     # GolfNow scraper
│   └── scripts/
│       ├── setup.js       # Initialize with demo data
│       ├── scrape.js      # Run scrapers
│       └── generate-demo-data.js
├── public/
│   └── index.html         # Frontend SPA
├── data/
│   └── golf.db            # SQLite database
└── package.json
```

## Extending the Scrapers

The app is designed to support multiple booking platforms. To add a new scraper:

1. Create a new file in `src/scrapers/`
2. Implement the scraping logic
3. Return tee times in this format:

```javascript
{
  course_id: 1,
  date: '2024-01-15',
  time: '08:30',
  datetime: '2024-01-15 08:30',
  holes: 18,
  players: 4,
  price: 65,
  original_price: null, // if discounted
  has_cart: 0,
  booking_url: 'https://...',
  source: 'your-source'
}
```

## Booking Platforms Identified

| Platform | Courses | Status |
|----------|---------|--------|
| GolfNow | ~35 courses | Implemented |
| ForeUp | Corica Park, others | Planned |
| CPS Golf | Presidio | Planned |
| EZLinks | TPC Harding | Planned |

## Revenue Model Ideas

- **Affiliate Program**: GolfNow pays $2-5 per booking
- **Premium Tier**: Alerts for prime times, weather integration
- **Regional Expansion**: Bay Area → California → National

## Tech Stack

- **Backend**: Node.js, Express 5
- **Database**: SQLite (better-sqlite3)
- **Scraping**: Cheerio, Puppeteer (optional)
- **Frontend**: Vanilla HTML/CSS/JS

## License

MIT
