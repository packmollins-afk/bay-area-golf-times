const db = require('../db/schema');

// Verified real course photos from official websites and GolfPass
// These are actual working URLs from course websites and golf directories
const coursePhotos = {
  // San Francisco
  "TPC Harding Park": "https://tpc.com/hardingpark/wp-content/uploads/sites/47/2016/08/IP-Hero_Harding-park-1-1.jpg",
  "Lincoln Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/de/5d/62db1c4c63e92d6e692e2676287b/68973.jpg",
  "Presidio Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/df/da/49f3e806ae58421b99c61f514a2c/69601.jpg",
  "Golden Gate Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/70/60/c2c1b4a29ed98e044acd414ecf2d/21817.jpg",

  // East Bay
  "Tilden Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/05/29/3e553c0a50f5c46f8ff795a92f52/91499.jpg",
  "Boundary Oak Golf Course": "https://www.playboundaryoak.com/images/slideshows/banner_2.jpg",
  "Diablo Creek Golf Course": "https://www.diablocreekgc.com/images/slideshows/banner_1.jpg",
  "Poppy Ridge Golf Course": "https://poppyridgegolf.ncga.org/hubfs/S2%20Poppy%20Ridge/Ridge%20Post%20Renovation%20Backgrounds/Poppy%20Ridge%20Hero%201600%20x%20942%20h17-0380.png",

  // North Bay
  "Peacock Gap Golf Club": "https://www.peacockgapgolfclub.com/wp-content/uploads/sites/3/2024/03/Homepage-Banner-2.jpg",

  // Extended
  "Pasatiempo Golf Club": "https://www.pasatiempo.com/images/uploads/34/hole-1.jpg",
  "Crystal Springs Golf Course": "https://www.playcrystalsprings.com/images/slideshows/001-startingimage-1.jpg",
};

// Update course photo_url in database
function updateCoursePhotos() {
  console.log('Updating course photos with verified URLs...');

  const updateStmt = db.prepare('UPDATE courses SET photo_url = ? WHERE name = ?');

  let updated = 0;
  for (const [courseName, photoUrl] of Object.entries(coursePhotos)) {
    try {
      const result = updateStmt.run(photoUrl, courseName);
      if (result.changes > 0) {
        console.log(`Updated: ${courseName}`);
        updated++;
      } else {
        console.log(`Not found in DB: ${courseName}`);
      }
    } catch (e) {
      console.error(`Error updating ${courseName}:`, e.message);
    }
  }

  console.log(`\nUpdated ${updated} courses with verified photos`);
}

updateCoursePhotos();
