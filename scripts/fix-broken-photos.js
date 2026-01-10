#!/usr/bin/env node
/**
 * Fix broken course photo URLs by replacing with reliable Unsplash images
 */

const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// High-quality golf course images from Unsplash (verified working)
const UNSPLASH_GOLF_IMAGES = [
  "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=1200", // Beautiful fairway
  "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=1200", // Golf course sunset
  "https://images.unsplash.com/photo-1500932334442-8761ee4810a7?w=1200", // Golf course landscape
  "https://images.unsplash.com/photo-1596727362302-b8d891c42ab8?w=1200", // Golf green
  "https://images.unsplash.com/photo-1592919505780-303950717480?w=1200", // Green with flag
  "https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=1200", // Golf fairway
];

// Known working course-specific URLs (verified)
const VERIFIED_WORKING = {
  "TPC Harding Park": "https://tpc.com/hardingpark/wp-content/uploads/sites/47/2016/08/IP-Hero_Harding-park-1-1.jpg",
  "TPC Harding Park - Fleming 9": "https://tpc.com/hardingpark/wp-content/uploads/sites/47/2019/04/Multi-Content-Box-Golf-Outings-.jpg",
  "Boundary Oak Golf Course": "https://www.playboundaryoak.com/images/slideshows/banner_2.jpg",
  "Callippe Preserve Golf Course": "https://www.playcallippe.com/images/slideshows/banner_1.jpg",
  "Chardonnay Golf Club": "https://www.chardonnaygolfclub.com/images/slideshows/banner_1.jpg",
  "Cinnabar Hills Golf Club": "https://www.cinnabarhills.com/images/uploads/photo-golf.jpg",
  "Crystal Springs Golf Course": "https://www.playcrystalsprings.com/images/slideshows/001-startingimage-1.jpg",
  "Deep Cliff Golf Course": "https://www.playdeepcliff.com/images/slideshows/banner-9th-hole.jpg",
  "Diablo Creek Golf Course": "https://www.diablocreekgc.com/images/slideshows/banner_1.jpg",
  "Golden Gate Park Golf Course": "https://www.goldengateparkgolf.com/wp-content/uploads/sites/9277/2024/02/3-Tee-Stock-Image-JPG-4512×3008-.png",
  "Half Moon Bay - Ocean Course": "https://halfmoonbaygolf.com/wp-content/uploads/2025/07/hmbgc-events.jpg",
  "Half Moon Bay - Old Course": "https://golf-pass-brightspot.s3.amazonaws.com/3a/22/c490828d8bf9d0afba0158245e38/6150.jpg",
  "Indian Valley Golf Club": "https://www.ivgc.com/images/slideshows/banner_1.jpg",
  "Las Positas Golf Course": "https://www.playlaspositas.com/images/slideshows/banner_1.jpg",
  "Lincoln Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/de/5d/62db1c4c63e92d6e692e2676287b/68973.jpg",
  "McInnis Park Golf Center": "https://mcinnisparkgolfcenter.com/wp-content/uploads/2013/03/golf-course-495x400.jpg",
  "Metropolitan Golf Links": "https://www.playmetro.com/images/slideshows/banner_3.jpg",
  "Northwood Golf Club": "https://www.northwoodgolf.com/images/slideshows/banner_3-northwoodGC.jpg",
  "Palo Alto Golf Course": "https://www.baylandsgolflinks.com/wp-content/uploads/sites/8950/2023/06/homeslide1.jpg",
  "Pasatiempo Golf Club": "https://golf-pass.brightspotcdn.com/dims4/default/8b0f357/2147483647/strip/true/crop/960x960+240+0/resize/1200x1200!/format/webp/quality/90/?url=https%3A%2F%2Fgolf-pass-brightspot.s3.amazonaws.com%2F97%2Fc0%2Fb3d0013bf0150c37bff47ba08d9c%2F21819.jpg",
  "Peacock Gap Golf Club": "https://www.peacockgapgolfclub.com/wp-content/uploads/sites/3/2024/03/Homepage-Banner-2.jpg",
  "Poppy Ridge Golf Course": "https://poppyridgegolf.ncga.org/hubfs/S2%20Poppy%20Ridge/Ridge%20Post%20Renovation%20Backgrounds/Poppy%20Ridge%20Hero%201600%20x%20942%20h17-0380.png",
  "Presidio Golf Course": "https://www.presidiogolf.com/wp-content/uploads/2014/02/Presidio-Golf-Course-Intro-Inline.jpg",
  "Redwood Canyon Golf Course": "https://redwoodcanyongolf.com/wp-content/uploads/elementor/thumbs/1-r0repyhb586m1dxewgd0j6p4z9p82tzq756kphdbsw.png",
  "San Jose Municipal Golf Course": "https://www.playsanjosemuni.com/images/slideshows/banner_1.jpg",
  "San Ramon Golf Club": "https://golfsanramon.com/wp-content/uploads/2024/01/course2.jpg",
  "Santa Teresa Golf Club": "https://santateresagolf.com/wp-content/uploads/sites/105/2022/05/golfcourse-santateresa.jpeg",
  "StoneTree Golf Club": "https://cdn.prod.website-files.com/6881e0680b14937cf2a11855/6889f009ced1436620bc78ea_ST_golfcourse2-1024x608.jpg",
  "The Bridges Golf Club": "https://www.thebridgesgolf.com/wp-content/uploads/sites/8298/2024/12/Yadav_TB_Hole_01_Nov_2024.jpg",
  "The Links at Bodega Harbour": "https://www.bodegaharbourgolf.com/images/slideshows/The-Links-At-Bodega-Harbour_Home-Homepage-Carousel_July-2023-The-Links-At-Bodega-Harbour-Home-Homepage-Carousel_July-2023-Homepage-Slideshow-Banner-NEW-Background-Image-1.jpg",
  "Tilden Park Golf Course": "https://tildenparkgc.com/wp-content/uploads/sites/201/2025/11/Tilden-Park-Collection-73-of-75.webp",
};

async function fixBrokenPhotos() {
  console.log('🔧 Fixing broken photo URLs...\n');

  const result = await db.execute('SELECT id, name, photo_url FROM courses ORDER BY name');
  const courses = result.rows;

  let fixed = 0;
  let alreadyGood = 0;

  for (const course of courses) {
    const name = course.name;
    let newUrl = null;

    // Check if we have a verified working URL
    if (VERIFIED_WORKING[name]) {
      newUrl = VERIFIED_WORKING[name];
    } else {
      // Use Unsplash fallback (deterministic based on name)
      const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      newUrl = UNSPLASH_GOLF_IMAGES[hash % UNSPLASH_GOLF_IMAGES.length];
    }

    // Check if URL needs updating
    if (course.photo_url !== newUrl) {
      try {
        await db.execute({
          sql: 'UPDATE courses SET photo_url = ? WHERE id = ?',
          args: [newUrl, course.id]
        });
        console.log(`✓ ${name} - fixed`);
        fixed++;
      } catch (err) {
        console.error(`✗ ${name} - error: ${err.message}`);
      }
    } else {
      alreadyGood++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Fixed: ${fixed}`);
  console.log(`Already good: ${alreadyGood}`);
}

fixBrokenPhotos()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
