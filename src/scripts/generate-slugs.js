#!/usr/bin/env node
const { generateAllSlugs, getAllCourses } = require('../db/courses');

console.log('Generating slugs for all courses...');
generateAllSlugs();

// Show results
const courses = getAllCourses();
console.log('\nGenerated slugs:');
courses.forEach(c => {
  console.log(`  ${c.name} → ${c.slug}`);
});
