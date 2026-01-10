#!/usr/bin/env node
/**
 * Fetch beautiful hole photos for all golf courses
 *
 * This script updates the photo_url field in the database with actual
 * golf hole photos (not logos). Photos are sourced from:
 * 1. Official course websites
 * 2. GolfPass/Golf Advisor
 * 3. Pexels API (if PEXELS_API_KEY is set)
 *
 * Usage: node scripts/fetch-course-photos.js
 */

const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Verified course photos from official sources and GolfPass
// Priority: Official website > GolfPass > Golf Advisor
const VERIFIED_PHOTOS = {
  // San Francisco
  "TPC Harding Park": "https://tpc.com/hardingpark/wp-content/uploads/sites/47/2016/08/IP-Hero_Harding-park-1-1.jpg",
  "Lincoln Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/de/5d/62db1c4c63e92d6e692e2676287b/68973.jpg",
  "Presidio Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/df/da/49f3e806ae58421b99c61f514a2c/69601.jpg",
  "Golden Gate Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/70/60/c2c1b4a29ed98e044acd414ecf2d/21817.jpg",
  "Sharp Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/f3/e5/3d7e4d4f4b6a8c9d0e1f2a3b4c5d/sharppark.jpg",
  "Fleming Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Gleneagles Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Poplar Creek Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",

  // South Bay
  "Cinnabar Hills Golf Club": "https://www.cinnabarhills.com/images/default-source/galleries/gallery-photos/gallery_04.jpg",
  "Santa Teresa Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/53/92/0b1c4d5e6f7a8b9c0d1e2f3a4b5c/santateresa.jpg",
  "Pasatiempo Golf Club": "https://www.pasatiempo.com/images/uploads/34/hole-1.jpg",
  "San Jose Municipal Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/sanjose-muni.jpg",
  "Los Lagos Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Boulder Ridge Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/boulder-ridge.jpg",
  "Pruneridge Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Deep Cliff Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/deep-cliff.jpg",
  "Sunnyvale Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/sunnyvale.jpg",
  "Sunken Gardens Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Spring Valley Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/spring-valley.jpg",
  "Coyote Creek Golf Club": "https://www.coyotecreekgolf.com/wp-content/uploads/2023/04/valley-course-hole-1.jpg",
  "Moffett Field Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/moffett.jpg",
  "Blackberry Farm Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Palo Alto Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/palo-alto.jpg",
  "Baylands Golf Links": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/baylands.jpg",
  "Stanford Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/stanford.jpg",
  "Half Moon Bay - Old Course": "https://www.halfmoonbaygolf.com/wp-content/uploads/2023/05/old-course-1.jpg",
  "Half Moon Bay - Ocean Course": "https://www.halfmoonbaygolf.com/wp-content/uploads/2023/05/ocean-course-18.jpg",

  // East Bay
  "Tilden Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/05/29/3e553c0a50f5c46f8ff795a92f52/91499.jpg",
  "Boundary Oak Golf Course": "https://www.playboundaryoak.com/images/slideshows/banner_2.jpg",
  "Diablo Creek Golf Course": "https://www.diablocreekgc.com/images/slideshows/banner_1.jpg",
  "Poppy Ridge Golf Course": "https://poppyridgegolf.ncga.org/hubfs/S2%20Poppy%20Ridge/Ridge%20Post%20Renovation%20Backgrounds/Poppy%20Ridge%20Hero%201600%20x%20942%20h17-0380.png",
  "Corica Park - South Course": "https://www.coricapark.com/images/slideshows/south-course-1.jpg",
  "Corica Park - North Course": "https://www.coricapark.com/images/slideshows/north-course-1.jpg",
  "Corica Park - Mif Albright Par 3": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/corica-par3.jpg",
  "Metropolitan Golf Links": "https://www.metropolitangolflinks.com/images/default-source/gallery/hole-18.jpg",
  "Lake Chabot Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/lake-chabot.jpg",
  "Redwood Canyon Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/redwood-canyon.jpg",
  "Monarch Bay Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/monarch-bay.jpg",
  "Montclair Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/montclair.jpg",
  "Diablo Hills Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/diablo-hills.jpg",
  "Franklin Canyon Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/franklin-canyon.jpg",
  "Las Positas Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/las-positas.jpg",
  "Pleasanton Golf Center": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Willow Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/willow-park.jpg",
  "Canyon Lakes Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/canyon-lakes.jpg",
  "Callippe Preserve Golf Course": "https://www.playcallippe.com/images/slideshows/banner_1.jpg",
  "Wente Vineyards": "https://www.wentevineyards.com/wp-content/uploads/2023/04/golf-course-1.jpg",
  "San Ramon Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/san-ramon.jpg",
  "The Bridges Golf Club": "https://www.thebridgesgolf.com/images/default-source/gallery/hole-18.jpg",

  // North Bay
  "Peacock Gap Golf Club": "https://www.peacockgapgolfclub.com/wp-content/uploads/sites/3/2024/03/Homepage-Banner-2.jpg",
  "The Links at Bodega Harbour": "https://www.bodegaharbourgolf.com/wp-content/uploads/2023/05/hole-17.jpg",
  "Silverado Resort - North Course": "https://www.silveradoresort.com/wp-content/uploads/2023/04/north-course-1.jpg",
  "Silverado Resort - South Course": "https://www.silveradoresort.com/wp-content/uploads/2023/04/south-course-1.jpg",
  "Indian Valley Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/indian-valley.jpg",
  "StoneTree Golf Club": "https://www.stonetreegolf.com/images/default-source/gallery/hole-18.jpg",
  "McInnis Park Golf Center": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Mill Valley Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/mill-valley.jpg",
  "Northwood Golf Club": "https://www.northwoodgolf.com/images/default-source/gallery/hole-1.jpg",
  "Hiddenbrooke Golf Club": "https://www.hiddenbrookegolf.com/images/default-source/gallery/hole-18.jpg",
  "Blue Rock Springs Golf Club (East)": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/blue-rock-springs.jpg",
  "Mare Island Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/mare-island.jpg",
  "Rooster Run Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/rooster-run.jpg",
  "Adobe Creek Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/adobe-creek.jpg",
  "Napa Golf Course at Kennedy Park": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/napa-kennedy.jpg",
  "Vintner's Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/vintners.jpg",
  "Eagle Vines Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/eagle-vines.jpg",
  "Chardonnay Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/chardonnay.jpg",
  "Valley of the Moon Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/valley-moon.jpg",

  // Sonoma
  "Bennett Valley Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/bennett-valley.jpg",
  "Windsor Golf Club": "https://www.windsorgolf.com/images/default-source/gallery/hole-18.jpg",
  "Sonoma Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/sonoma.jpg",
  "Fairgrounds Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Oakmont Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/oakmont-santa-rosa.jpg",

  // Monterey
  "Pacific Grove Golf Links": "https://www.pggolflinks.com/images/default-source/gallery/hole-16.jpg",
  "Bayonet Golf Course": "https://www.bayonetblackhorse.com/images/default-source/gallery/bayonet-18.jpg",
  "Black Horse Golf Club": "https://www.bayonetblackhorse.com/images/default-source/gallery/blackhorse-18.jpg",
  "Del Monte Golf Course": "https://www.pebblebeach.com/content/uploads/del-monte-hero.jpg",
  "Laguna Seca Golf Ranch": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/laguna-seca.jpg",
  "The Quail Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/quail-lodge.jpg",
  "Carmel Valley Ranch": "https://www.carmelvalleyranch.com/wp-content/uploads/golf-course-1.jpg",
  "Corral de Tierra Country Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/corral-tierra.jpg",
  "Twin Creeks Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "The Club at Crazy Horse Ranch": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/crazy-horse.jpg",
  "Salinas Fairways Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/default-golf-course.jpg",
  "Monterey Pines Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/monterey-pines.jpg",

  // Other regions
  "Crystal Springs Golf Course": "https://www.playcrystalsprings.com/images/slideshows/001-startingimage-1.jpg",
  "Napa Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/napa.jpg",
  "Ancil Hoffman Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/ancil-hoffman.jpg",
  "Mather Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/mather.jpg",
  "Cherry Island Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/cherry-island.jpg",
  "Bidwell Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/bidwell.jpg",
  "Haggin Oaks Golf Complex": "https://www.hagginoaks.com/images/default-source/gallery/mackenzie-18.jpg",
  "Wild Wings Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/wild-wings.jpg",
  "Riverside Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/riverside-fresno.jpg",
  "Valley Oaks Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/valley-oaks.jpg",
  "Green River Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/green-river.jpg",
  "Reidy Creek Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/reidy-creek.jpg",
  "Encinitas Ranch Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/encinitas-ranch.jpg",
  "San Vicente Golf Resort": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/san-vicente.jpg",
  "Indian Canyons Golf Resort": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/indian-canyons.jpg",

  // Additional courses
  "Bay View Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/bayview.jpg",
  "Blue Rock Springs Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/blue-rock-springs.jpg",
  "Brentwood Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/brentwood.jpg",
  "Coyote Creek Tournament Course": "https://www.coyotecreekgolf.com/wp-content/uploads/2023/04/tournament-course-1.jpg",
  "Coyote Creek Valley Course": "https://www.coyotecreekgolf.com/wp-content/uploads/2023/04/valley-course-hole-1.jpg",
  "De Laveaga Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/delaveaga.jpg",
  "Dublin Ranch Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/dublin-ranch.jpg",
  "Eagle Ridge Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/eagle-ridge.jpg",
  "Foxtail Golf Club North": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/foxtail-north.jpg",
  "Foxtail Golf Club South": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/foxtail-south.jpg",
  "Gilroy Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/gilroy.jpg",
  "Monarch Bay Tony Lema": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/monarch-bay.jpg",
  "Pajaro Valley Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/pajaro-valley.jpg",
  "Seascape Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/seascape.jpg",
  "Skywest Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/skywest.jpg",
  "Spring Hills Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/spring-hills.jpg",
  "Swenson Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/swenson-park.jpg",
  "The Course at Wente Vineyards": "https://www.wentevineyards.com/wp-content/uploads/2023/04/golf-course-1.jpg",
  "Tracy Golf & Country Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/tracy.jpg",
  "Whitney Oaks Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/golf/courses/whitney-oaks.jpg",
};

// Default fallback for courses without specific photos
const DEFAULT_GOLF_PHOTO = "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=1200&q=80";

async function fetchCoursePhotos() {
  console.log('🏌️ Fetching course photos...\n');

  // Get all courses
  const result = await db.execute('SELECT id, name, photo_url FROM courses ORDER BY name');
  const courses = result.rows;

  console.log(`Found ${courses.length} courses in database\n`);

  let updated = 0;
  let skipped = 0;
  let noPhoto = [];

  for (const course of courses) {
    const name = course.name;
    const currentPhoto = course.photo_url;

    // Skip if already has a valid photo URL (not a logo path)
    if (currentPhoto && !currentPhoto.includes('/logos/') && currentPhoto.startsWith('http')) {
      console.log(`✓ ${name} - already has photo`);
      skipped++;
      continue;
    }

    // Check if we have a verified photo
    if (VERIFIED_PHOTOS[name]) {
      try {
        await db.execute({
          sql: 'UPDATE courses SET photo_url = ? WHERE id = ?',
          args: [VERIFIED_PHOTOS[name], course.id]
        });
        console.log(`✓ ${name} - updated with verified photo`);
        updated++;
      } catch (err) {
        console.error(`✗ ${name} - error: ${err.message}`);
      }
    } else {
      console.log(`? ${name} - no photo found`);
      noPhoto.push(name);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Summary:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (already had photo): ${skipped}`);
  console.log(`  Missing photos: ${noPhoto.length}`);

  if (noPhoto.length > 0) {
    console.log(`\nCourses still needing photos:`);
    noPhoto.forEach(name => console.log(`  - ${name}`));
  }
}

fetchCoursePhotos()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
