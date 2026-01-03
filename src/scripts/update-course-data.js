/**
 * Update course data from Greenskeeper.org
 * Run with: node src/scripts/update-course-data.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../data/golf.db'));

// Comprehensive course data from Greenskeeper.org
const courseData = [
  {
    id: 311, // TPC Harding Park
    name: 'TPC Harding Park',
    par: 73,
    yardage: 6845,
    slope_rating: 126,
    course_rating: 72.8,
    phone_number: '(415) 664-4690',
    website_url: 'https://tpc.com/hardingpark/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Willie Watson/Sandy Tatum',
    year_built: 1925,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_francisco_and_north_bay_area/Harding_Park_Golf_Course/',
    description: 'Historic championship course that hosted the 2020 PGA Championship. Features Bent/Poa Annua greens and Rye/Blue fairways. The back nine is considered the most inspiring portion of the layout.'
  },
  {
    id: 312, // Lincoln Park
    name: 'Lincoln Park Golf Course',
    par: 68,
    yardage: 5416,
    slope_rating: 107,
    course_rating: 65.5,
    phone_number: '(415) 221-9911',
    website_url: 'https://www.lincolnparkgolfcourse.com/',
    has_driving_range: 0,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Tom Bendelow/Jack Fleming',
    year_built: 1914,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_francisco_and_north_bay_area/lincoln_park_golf_course/',
    description: 'Stunning views of the Golden Gate Bridge and ocean on nearly every hole. Severe undulations make it a great test for your short game. The bohemian conditions add to its unique character.'
  },
  {
    id: 313, // Sharp Park
    name: 'Sharp Park Golf Course',
    par: 72,
    yardage: 6481,
    slope_rating: 121,
    course_rating: 71.5,
    phone_number: '(650) 359-3380',
    website_url: 'https://www.sfpublicgolf.org/index.php/courses/sharp-park',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Alister MacKenzie',
    year_built: 1931,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_francisco_and_north_bay_area/Sharp_Park_Golf_Course/',
    description: 'The only Alister MacKenzie-designed course that is both public and by the sea. Located right on the Pacific coast with huge old trees lining beautiful fairways. A world-class design with excellent greens.'
  },
  {
    id: 314, // Presidio
    name: 'Presidio Golf Course',
    par: 72,
    yardage: 6481,
    slope_rating: 135,
    course_rating: 72.6,
    phone_number: '(415) 561-4661',
    website_url: 'https://www.presidiogolf.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Robert Wood Johnstone',
    year_built: 1895,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_francisco_and_north_bay_area/Presidio_Golf_Course/',
    description: 'Historic course dating back to 1895. Hilly layout with lots of trees, fescue-lined bunkers, and no water hazards. Tons of elevation changes, doglegs, and gorgeous views. Free Loyalty Club with breakfast benefits.'
  },
  {
    id: 315, // Golden Gate Park
    name: 'Golden Gate Park Golf Course',
    par: 27,
    yardage: 1357,
    slope_rating: null,
    course_rating: null,
    phone_number: '(415) 751-8987',
    website_url: 'https://www.goldengateparkgolf.com/',
    has_driving_range: 0,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Jack Fleming',
    year_built: 1951,
    greenskeeper_url: null,
    description: '9-hole par-3 course on rolling sand dunes near the Pacific Ocean. Perfect for beginners, seniors, and anyone looking for a quick round. Holes range from under 100 yards to 200 yards.'
  },
  {
    id: 316, // San Jose Muni
    name: 'San Jose Municipal Golf Course',
    par: 72,
    yardage: 6700,
    slope_rating: 123,
    course_rating: 71.8,
    phone_number: '(408) 441-4653',
    website_url: 'https://www.playsanjosemuni.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Robert Muir Graves',
    year_built: 1968,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_jose_south_bay_area/San_Jose_Municipal_Golf_Course/',
    description: 'Championship municipal course in the heart of San Jose. Well-maintained fairways and greens with a variety of challenging holes.'
  },
  {
    id: 317, // Cinnabar Hills
    name: 'Cinnabar Hills Golf Club',
    par: 72,
    yardage: 6861,
    slope_rating: 137,
    course_rating: 73.5,
    phone_number: '(408) 323-5200',
    website_url: 'https://www.cinnabar.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'John Harbottle III',
    year_built: 1998,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_jose_south_bay_area/Cinnabar_Hills_Golf_Club/',
    description: 'Award-winning 27-hole facility with three distinct nines: Canyon, Mountain, and Lake. Dramatic elevation changes and stunning views of the Santa Clara Valley.'
  },
  {
    id: 318, // Santa Teresa
    name: 'Santa Teresa Golf Club',
    par: 71,
    yardage: 6573,
    slope_rating: 127,
    course_rating: 71.4,
    phone_number: '(408) 225-2650',
    website_url: 'https://www.playstgc.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'George Santana',
    year_built: 1963,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_jose_south_bay_area/Santa_Teresa_Golf_Club/',
    description: 'Located in the foothills south of San Jose with panoramic views. Challenging layout with well-bunkered greens and tree-lined fairways.'
  },
  {
    id: 319, // Palo Alto
    name: 'Palo Alto Golf Course',
    par: 72,
    yardage: 6503,
    slope_rating: 120,
    course_rating: 70.8,
    phone_number: '(650) 856-0881',
    website_url: 'https://cityofpaloalto.org/golf',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'William Bell',
    year_built: 1956,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_jose_south_bay_area/Palo_Alto_Municipal_Golf_Course/',
    description: 'Popular municipal course in the heart of Silicon Valley. Mature trees, well-maintained conditions, and a friendly atmosphere.'
  },
  {
    id: 320, // Deep Cliff
    name: 'Deep Cliff Golf Course',
    par: 60,
    yardage: 3006,
    slope_rating: 89,
    course_rating: 56.7,
    phone_number: '(408) 253-5357',
    website_url: 'https://www.playdeepcliff.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Clark Glasson',
    year_built: 1961,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_jose_south_bay_area/Deep_Cliff_Golf_Course/',
    description: '18-hole executive course perfect for a quick round. Great for beginners and those looking to sharpen their short game.'
  },
  {
    id: 321, // Corica Park South
    name: 'Corica Park - South Course',
    par: 71,
    yardage: 6500,
    slope_rating: 123,
    course_rating: 70.9,
    phone_number: '(510) 747-7800',
    website_url: 'https://www.coricapark.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Rees Jones',
    year_built: 2018,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/oakland_east_bay_area/Corica_Park_South_Course/',
    description: 'Completely redesigned by Rees Jones in 2018. Modern links-style layout with fescue, large bunkers, and excellent conditions. Located on Alameda Island.'
  },
  {
    id: 322, // Corica Park North
    name: 'Corica Park - North Course',
    par: 36,
    yardage: 2796,
    slope_rating: null,
    course_rating: null,
    phone_number: '(510) 747-7800',
    website_url: 'https://www.coricapark.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Marc Logan',
    year_built: 2019,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/oakland_east_bay_area/Corica_Park_North_Course/',
    description: '9-hole par-3 course with nighttime lighting. Perfect for beginners and families, or anyone wanting a quick round after work.'
  },
  {
    id: 323, // Metropolitan
    name: 'Metropolitan Golf Links',
    par: 72,
    yardage: 6725,
    slope_rating: 125,
    course_rating: 72.2,
    phone_number: '(510) 569-5555',
    website_url: 'https://www.metropolitangolflinks.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Fred Bliss',
    year_built: 1996,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/oakland_east_bay_area/Metropolitan_Golf_Links/',
    description: 'Links-style course near Oakland Airport with views of the Bay. Challenging layout with water hazards, bunkers, and wind off the Bay.'
  },
  {
    id: 324, // Tilden Park
    name: 'Tilden Park Golf Course',
    par: 70,
    yardage: 6294,
    slope_rating: 126,
    course_rating: 70.8,
    phone_number: '(510) 848-7373',
    website_url: 'https://tildenparkgc.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'William Park Bell Jr.',
    year_built: 1937,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/oakland_east_bay_area/tilden_park_golf_course_oakland_california/',
    description: 'Championship course in the Berkeley Hills surrounded by redwoods. Rolling tree-lined fairways with a Parkland feel and NorCal flair. One of the hilliest courses you can walk.'
  },
  {
    id: 325, // Boundary Oak
    name: 'Boundary Oak Golf Course',
    par: 72,
    yardage: 7073,
    slope_rating: 131,
    course_rating: 73.8,
    phone_number: '(925) 934-4775',
    website_url: 'https://www.playboundaryoak.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Robert Muir Graves',
    year_built: 1969,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/oakland_east_bay_area/Boundary_Oak_Golf_Course/',
    description: 'A gem of a course in the East Bay with a supreme layout. Very hilly with plenty of big doglegs. Big undulated greens provide the biggest defense. Fast greens in excellent condition.'
  },
  {
    id: 326, // Poppy Ridge
    name: 'Poppy Ridge Golf Course',
    par: 72,
    yardage: 7055,
    slope_rating: 136,
    course_rating: 74.2,
    phone_number: '(925) 447-6779',
    website_url: 'https://poppyridgegolf.ncga.org/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Rees Jones',
    year_built: 1996,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/oakland_east_bay_area/Poppy_Ridge_Golf_Course/',
    description: 'NCGA-owned 27-hole facility with three distinct nines. Championship caliber course in the Livermore Valley wine country with stunning views.'
  },
  {
    id: 327, // Peacock Gap
    name: 'Peacock Gap Golf Club',
    par: 71,
    yardage: 6138,
    slope_rating: 120,
    course_rating: 69.3,
    phone_number: '(415) 453-4940',
    website_url: 'https://www.peacockgap.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'William Francis Bell',
    year_built: 1960,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_francisco_and_north_bay_area/Peacock_Gap_Golf_Course/',
    description: 'Scenic course in San Rafael with views of the Marin hills. Well-designed layout with water features and mature landscaping.'
  },
  {
    id: 328, // Indian Valley
    name: 'Indian Valley Golf Club',
    par: 72,
    yardage: 6207,
    slope_rating: 123,
    course_rating: 70.0,
    phone_number: '(415) 897-1118',
    website_url: 'https://www.indianvalleygc.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Robert Muir Graves',
    year_built: 1958,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_francisco_and_north_bay_area/Indian_Valley_Golf_Club/',
    description: 'Challenging layout in Novato with scenic views of Mount Tamalpais. Tree-lined fairways and well-bunkered greens.'
  },
  {
    id: 329, // StoneTree
    name: 'StoneTree Golf Club',
    par: 72,
    yardage: 6782,
    slope_rating: 138,
    course_rating: 73.1,
    phone_number: '(415) 209-6090',
    website_url: 'https://www.bayclubs.com/clubs/stonetree',
    has_driving_range: 0,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Johnny Miller/Sandy Tatum',
    year_built: 2000,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_francisco_and_north_bay_area/Stonetree_golf_club_Novato_California/',
    description: 'Johnny Miller design offering tremendous variety. Front nine is mostly flat, back nine is tight and hilly. A shot-makers course with perfect combination of fairness and challenge. Now operated as Bay Club at StoneTree (semi-private).'
  },
  {
    id: 330, // Mill Valley
    name: 'Mill Valley Golf Course',
    par: 33,
    yardage: 2100,
    slope_rating: null,
    course_rating: null,
    phone_number: '(415) 388-9982',
    website_url: 'https://www.millvalleygolfcourse.com/',
    has_driving_range: 0,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Unknown',
    year_built: 1920,
    greenskeeper_url: null,
    description: 'Charming 9-hole course nestled in Mill Valley. Perfect for beginners and a quick afternoon round. Beautiful natural setting.'
  },
  {
    id: 331, // TPC Fleming 9
    name: 'TPC Harding Park - Fleming 9',
    par: 32,
    yardage: 2350,
    slope_rating: null,
    course_rating: null,
    phone_number: '(415) 664-4690',
    website_url: 'https://tpc.com/hardingpark/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Jack Fleming',
    year_built: 1961,
    greenskeeper_url: null,
    description: '9-hole executive course adjacent to TPC Harding Park. Great for warm-up rounds or quick play. Same great conditions as the championship course.'
  },
  {
    id: 332, // Crystal Springs
    name: 'Crystal Springs Golf Course',
    par: 72,
    yardage: 6575,
    slope_rating: 127,
    course_rating: 71.6,
    phone_number: '(650) 342-0603',
    website_url: 'https://www.playcrystalsprings.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Herbert Fowler',
    year_built: 1924,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_jose_south_bay_area/Crystal_Springs_Golf_Course/',
    description: 'Historic course along the Crystal Springs Reservoir. Challenging layout with views of the coastal mountains. Well-maintained conditions.'
  },
  {
    id: 333, // Half Moon Bay Old
    name: 'Half Moon Bay - Old Course',
    par: 72,
    yardage: 7100,
    slope_rating: 134,
    course_rating: 74.8,
    phone_number: '(650) 726-1800',
    website_url: 'https://www.halfmoonbaygolf.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Arnold Palmer',
    year_built: 1973,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_jose_south_bay_area/Half_Moon_Bay_Golf_Links_Old_Course/',
    description: 'Arnold Palmer design along the stunning Pacific coastline. Championship layout with ocean views on several holes.'
  },
  {
    id: 334, // Half Moon Bay Ocean
    name: 'Half Moon Bay - Ocean Course',
    par: 72,
    yardage: 6732,
    slope_rating: 132,
    course_rating: 73.2,
    phone_number: '(650) 726-1800',
    website_url: 'https://www.halfmoonbaygolf.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Arthur Hills',
    year_built: 1997,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_jose_south_bay_area/Half_Moon_Bay_Golf_Links_Ocean_Course/',
    description: 'Dramatic oceanfront finishing holes including the famous 18th along the cliffs. Links-style design with stunning Pacific views.'
  },
  {
    id: 335, // Bodega Harbour
    name: 'The Links at Bodega Harbour',
    par: 70,
    yardage: 6200,
    slope_rating: 129,
    course_rating: 70.5,
    phone_number: '(707) 875-3538',
    website_url: 'https://www.bodegaharbourgolf.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Robert Trent Jones Jr.',
    year_built: 1977,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_francisco_and_north_bay_area/Bodega_Harbour_Golf_Links/',
    description: 'Scottish links-style course perched on the Sonoma Coast. Dramatic ocean views and challenging wind conditions. Robert Trent Jones Jr. design.'
  },
  {
    id: 336, // Northwood
    name: 'Northwood Golf Club',
    par: 36,
    yardage: 3013,
    slope_rating: 120,
    course_rating: 34.8,
    phone_number: '(707) 865-1116',
    website_url: 'https://www.northwoodgolf.com/',
    has_driving_range: 0,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Alister MacKenzie',
    year_built: 1928,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_francisco_and_north_bay_area/Northwood_Golf_Club/',
    description: 'Hidden gem designed by Alister MacKenzie in the redwoods of Monte Rio. 9-hole course with the feel of a private club. Historic and well-maintained.'
  },
  {
    id: 337, // Pasatiempo
    name: 'Pasatiempo Golf Club',
    par: 70,
    yardage: 6494,
    slope_rating: 139,
    course_rating: 72.7,
    phone_number: '(831) 459-9155',
    website_url: 'https://www.pasatiempo.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Alister MacKenzie',
    year_built: 1929,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/san_jose_south_bay_area/Pasatiempo_Golf_Club/',
    description: 'Alister MacKenzie masterpiece and one of the best public courses in California. MacKenzie lived adjacent to the 6th fairway until his death. World-class conditions and design.'
  },
  {
    id: 338, // Diablo Creek
    name: 'Diablo Creek Golf Course',
    par: 71,
    yardage: 6755,
    slope_rating: 130,
    course_rating: 72.1,
    phone_number: '(925) 686-6262',
    website_url: 'https://www.diablocreekgc.com/',
    has_driving_range: 1,
    has_practice_green: 1,
    has_pro_shop: 1,
    architect: 'Ted Robinson',
    year_built: 1971,
    greenskeeper_url: 'https://www.greenskeeper.org/northern_california/oakland_east_bay_area/Diablo_Creek_Golf_Course/',
    description: 'Championship course in Concord with mature trees and water features. Well-maintained with challenging layout suited for all skill levels.'
  }
];

// Update query
const updateStmt = db.prepare(`
  UPDATE courses SET
    par = COALESCE(@par, par),
    yardage = COALESCE(@yardage, yardage),
    slope_rating = COALESCE(@slope_rating, slope_rating),
    course_rating = COALESCE(@course_rating, course_rating),
    phone_number = COALESCE(@phone_number, phone_number),
    website_url = COALESCE(@website_url, website_url),
    has_driving_range = COALESCE(@has_driving_range, has_driving_range),
    has_practice_green = COALESCE(@has_practice_green, has_practice_green),
    has_pro_shop = COALESCE(@has_pro_shop, has_pro_shop),
    photo_url = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);

// Run updates
console.log('Updating course data from Greenskeeper.org...\n');

const updateTransaction = db.transaction(() => {
  for (const course of courseData) {
    try {
      updateStmt.run({
        id: course.id,
        par: course.par,
        yardage: course.yardage,
        slope_rating: course.slope_rating,
        course_rating: course.course_rating,
        phone_number: course.phone_number,
        website_url: course.website_url,
        has_driving_range: course.has_driving_range,
        has_practice_green: course.has_practice_green,
        has_pro_shop: course.has_pro_shop
      });
      console.log(`✓ Updated: ${course.name}`);
    } catch (err) {
      console.error(`✗ Failed to update ${course.name}: ${err.message}`);
    }
  }
});

updateTransaction();

console.log('\n✓ Course data update complete!');

// Show summary
const summary = db.prepare('SELECT COUNT(*) as count FROM courses WHERE par IS NOT NULL').get();
console.log(`\nCourses with complete data: ${summary.count}`);

db.close();
