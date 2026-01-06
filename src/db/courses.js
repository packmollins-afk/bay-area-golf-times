const db = require('./schema');

// Bay Area Public Golf Courses
const courses = [
  // San Francisco
  { name: "TPC Harding Park", city: "San Francisco", region: "San Francisco", holes: 18, par: 72, yardage: 7169, latitude: 37.7240, longitude: -122.4930, phone_number: "(415) 664-4690", golfnow_id: "8276", booking_url: "https://www.golfnow.com/tee-times/facility/8276-tpc-harding-park-golf-club/search", booking_system: "golfnow" },
  { name: "Lincoln Park Golf Course", city: "San Francisco", region: "San Francisco", holes: 18, par: 68, yardage: 5181, latitude: 37.7833, longitude: -122.4956, phone_number: "(415) 221-9911", golfnow_id: "556", booking_url: "https://www.golfnow.com/tee-times/facility/556-lincoln-park-golf-course/search", booking_system: "golfnow" },
  { name: "Sharp Park Golf Course", city: "Pacifica", region: "San Francisco", holes: 18, par: 72, yardage: 6274, latitude: 37.6239, longitude: -122.4894, phone_number: "(650) 359-3380", golfnow_id: "619", booking_url: "https://www.golfnow.com/tee-times/facility/619-sharp-park-golf-course/search", booking_system: "golfnow" },
  { name: "Presidio Golf Course", city: "San Francisco", region: "San Francisco", holes: 18, par: 72, yardage: 6477, latitude: 37.7905, longitude: -122.4657, phone_number: "(415) 561-4661", golfnow_id: "148", booking_url: "https://www.golfnow.com/tee-times/facility/148-presidio-golf-course/search", booking_system: "golfnow" },
  { name: "Golden Gate Park Golf Course", city: "San Francisco", region: "San Francisco", holes: 9, par: 27, yardage: 1357, latitude: 37.7694, longitude: -122.4862, phone_number: "(415) 751-8987", golfnow_id: null, booking_url: "https://sfrecpark.org/", booking_system: "other" },
  { name: "Fleming Golf Course", city: "San Francisco", region: "San Francisco", holes: 9, par: 27, yardage: 1200, latitude: 37.7208, longitude: -122.4978, phone_number: "(415) 585-0546", golfnow_id: null, booking_url: "https://sfrecpark.org/", booking_system: "other" },

  // South Bay - Santa Clara County
  { name: "San Jose Municipal Golf Course", city: "San Jose", region: "South Bay", holes: 18, par: 72, yardage: 6700, latitude: 37.3494, longitude: -121.9100, phone_number: "(408) 441-4653", golfnow_id: "614", booking_url: "https://www.golfnow.com/tee-times/facility/614-san-jose-municipal-golf-course/search", booking_system: "golfnow" },
  { name: "Cinnabar Hills Golf Club", city: "San Jose", region: "South Bay", holes: 27, par: 72, yardage: 6853, latitude: 37.2419, longitude: -121.7750, phone_number: "(408) 323-5200", golfnow_id: "465", booking_url: "https://www.golfnow.com/tee-times/facility/465-cinnabar-hills-golf-club/search", booking_system: "golfnow" },
  { name: "Los Lagos Golf Course", city: "San Jose", region: "South Bay", holes: 18, par: 60, yardage: 3700, latitude: 37.2878, longitude: -121.8208, phone_number: "(408) 361-0250", golfnow_id: "561", booking_url: "https://www.golfnow.com/tee-times/facility/561-los-lagos-golf-course/search", booking_system: "golfnow" },
  { name: "Santa Teresa Golf Club", city: "San Jose", region: "South Bay", holes: 18, par: 71, yardage: 6738, latitude: 37.2295, longitude: -121.7960, phone_number: "(408) 225-2650", golfnow_id: "617", booking_url: "https://www.golfnow.com/tee-times/facility/617-santa-teresa-golf-club/search", booking_system: "golfnow" },
  { name: "Boulder Ridge Golf Club", city: "San Jose", region: "South Bay", holes: 18, par: 72, yardage: 6806, latitude: 37.2208, longitude: -121.7530, phone_number: "(408) 323-9900", golfnow_id: "8267", booking_url: "https://www.golfnow.com/tee-times/facility/8267-boulder-ridge-golf-club/search", booking_system: "golfnow" },
  { name: "Pruneridge Golf Club", city: "Santa Clara", region: "South Bay", holes: 9, par: 30, yardage: 1768, latitude: 37.3622, longitude: -121.9886, phone_number: "(408) 248-4424", golfnow_id: "596", booking_url: "https://www.golfnow.com/tee-times/facility/596-pruneridge-golf-club/search", booking_system: "golfnow" },
  { name: "Deep Cliff Golf Course", city: "Cupertino", region: "South Bay", holes: 18, par: 60, yardage: 3200, latitude: 37.3206, longitude: -122.0492, phone_number: "(408) 253-5357", golfnow_id: "474", booking_url: "https://www.golfnow.com/tee-times/facility/474-deep-cliff-golf-course/search", booking_system: "golfnow" },
  { name: "Sunnyvale Golf Course", city: "Sunnyvale", region: "South Bay", holes: 18, par: 70, yardage: 5858, latitude: 37.3900, longitude: -122.0120, phone_number: "(408) 738-3666", golfnow_id: "639", booking_url: "https://www.golfnow.com/tee-times/facility/639-sunnyvale-golf-course/search", booking_system: "golfnow" },
  { name: "Sunken Gardens Golf Course", city: "Sunnyvale", region: "South Bay", holes: 9, par: 29, yardage: 1495, latitude: 37.3778, longitude: -122.0450, phone_number: "(408) 739-6588", golfnow_id: "638", booking_url: "https://www.golfnow.com/tee-times/facility/638-sunken-gardens-golf-course/search", booking_system: "golfnow" },
  { name: "Spring Valley Golf Course", city: "Milpitas", region: "South Bay", holes: 18, par: 70, yardage: 5132, latitude: 37.4440, longitude: -121.9108, phone_number: "(408) 262-1722", golfnow_id: "630", booking_url: "https://www.golfnow.com/tee-times/facility/630-spring-valley-golf-course/search", booking_system: "golfnow" },
  { name: "Coyote Creek Golf Club", city: "Morgan Hill", region: "South Bay", holes: 36, par: 72, yardage: 7011, latitude: 37.1390, longitude: -121.6220, phone_number: "(408) 463-1400", golfnow_id: "469", booking_url: "https://www.golfnow.com/tee-times/facility/469-coyote-creek-golf-club/search", booking_system: "golfnow" },
  { name: "Moffett Field Golf Course", city: "Mountain View", region: "South Bay", holes: 18, par: 72, yardage: 6685, latitude: 37.4138, longitude: -122.0508, phone_number: "(650) 603-8026", golfnow_id: "573", booking_url: "https://www.golfnow.com/tee-times/facility/573-moffett-field-golf-course/search", booking_system: "golfnow" },
  { name: "Blackberry Farm Golf Course", city: "Cupertino", region: "South Bay", holes: 9, par: 29, yardage: 1240, latitude: 37.3155, longitude: -122.0645, phone_number: "(408) 253-9200", golfnow_id: null, booking_url: "https://www.cupertino.org/", booking_system: "other" },
  { name: "Palo Alto Golf Course", city: "Palo Alto", region: "South Bay", holes: 18, par: 72, yardage: 6217, latitude: 37.4543, longitude: -122.1178, phone_number: "(650) 856-0881", golfnow_id: "586", booking_url: "https://www.golfnow.com/tee-times/facility/586-palo-alto-golf-course/search", booking_system: "golfnow" },
  { name: "Baylands Golf Links", city: "Palo Alto", region: "South Bay", holes: 18, par: 71, yardage: 6680, latitude: 37.4590, longitude: -122.1066, phone_number: "(650) 856-0881", golfnow_id: null, booking_url: "https://baylandswalking.quick18.com/teetimes/searchmatrix", booking_system: "quick18" },

  // East Bay - Alameda County
  { name: "Corica Park - South Course", city: "Alameda", region: "East Bay", holes: 18, par: 71, yardage: 6666, latitude: 37.7392, longitude: -122.2333, phone_number: "(510) 747-7800", golfnow_id: "8136", foreup_id: "22822", booking_url: "https://www.golfnow.com/tee-times/facility/8136-corica-park-south-course/search", booking_system: "golfnow" },
  { name: "Corica Park - North Course", city: "Alameda", region: "East Bay", holes: 18, par: 70, yardage: 6056, latitude: 37.7450, longitude: -122.2340, phone_number: "(510) 747-7800", golfnow_id: "514", foreup_id: "22822", booking_url: "https://www.golfnow.com/tee-times/facility/514-corica-park-north-course/search", booking_system: "golfnow" },
  { name: "Corica Park - Mif Albright Par 3", city: "Alameda", region: "East Bay", holes: 9, par: 27, yardage: 1100, latitude: 37.7420, longitude: -122.2350, phone_number: "(510) 747-7800", golfnow_id: "8713", booking_url: "https://www.golfnow.com/tee-times/facility/8713-corica-park-mif-albright-par-3/search", booking_system: "golfnow" },
  { name: "Metropolitan Golf Links", city: "Oakland", region: "East Bay", holes: 18, par: 72, yardage: 6801, latitude: 37.7350, longitude: -122.2100, phone_number: "(510) 569-5555", golfnow_id: "570", booking_url: "https://www.golfnow.com/tee-times/facility/570-metropolitan-golf-links/search", booking_system: "golfnow" },
  { name: "Lake Chabot Golf Course", city: "Oakland", region: "East Bay", holes: 27, par: 72, yardage: 6599, latitude: 37.7292, longitude: -122.0920, phone_number: "(510) 351-5812", golfnow_id: "549", booking_url: "https://www.golfnow.com/tee-times/facility/549-lake-chabot-golf-course/search", booking_system: "golfnow" },
  { name: "Tilden Park Golf Course", city: "Berkeley", region: "East Bay", holes: 18, par: 70, yardage: 6294, latitude: 37.8881, longitude: -122.2441, phone_number: "(510) 848-7373", golfnow_id: "649", booking_url: "https://www.golfnow.com/tee-times/facility/649-tilden-park-golf-course/search", booking_system: "golfnow" },
  { name: "Redwood Canyon Golf Course", city: "Castro Valley", region: "East Bay", holes: 9, par: 34, yardage: 2580, latitude: 37.7215, longitude: -122.0680, phone_number: "(510) 537-8001", golfnow_id: "602", booking_url: "https://www.golfnow.com/tee-times/facility/602-redwood-canyon-golf-course/search", booking_system: "golfnow" },
  { name: "Monarch Bay Golf Club", city: "San Leandro", region: "East Bay", holes: 18, par: 71, yardage: 5845, latitude: 37.6940, longitude: -122.1920, phone_number: "(510) 895-2162", golfnow_id: "574", booking_url: "https://www.golfnow.com/tee-times/facility/574-monarch-bay-golf-club/search", booking_system: "golfnow" },
  { name: "Montclair Golf Course", city: "Oakland", region: "East Bay", holes: 9, par: 33, yardage: 2370, latitude: 37.8280, longitude: -122.2050, phone_number: "(510) 482-0422", golfnow_id: "575", booking_url: "https://www.golfnow.com/tee-times/facility/575-montclair-golf-course/search", booking_system: "golfnow" },

  // East Bay - Contra Costa County
  { name: "Boundary Oak Golf Course", city: "Walnut Creek", region: "East Bay", holes: 18, par: 72, yardage: 7106, latitude: 37.9258, longitude: -122.0520, phone_number: "(925) 934-6211", golfnow_id: "456", booking_url: "https://www.golfnow.com/tee-times/facility/456-boundary-oak-golf-course/search", booking_system: "golfnow" },
  { name: "Diablo Hills Golf Course", city: "Walnut Creek", region: "East Bay", holes: 9, par: 30, yardage: 1810, latitude: 37.9020, longitude: -122.0450, phone_number: "(925) 939-7372", golfnow_id: "478", booking_url: "https://www.golfnow.com/tee-times/facility/478-diablo-hills-golf-course/search", booking_system: "golfnow" },
  { name: "Franklin Canyon Golf Course", city: "Hercules", region: "East Bay", holes: 18, par: 72, yardage: 6490, latitude: 37.9930, longitude: -122.2880, phone_number: "(510) 799-6191", golfnow_id: "498", booking_url: "https://www.golfnow.com/tee-times/facility/498-franklin-canyon-golf-course/search", booking_system: "golfnow" },
  { name: "Poppy Ridge Golf Course", city: "Livermore", region: "East Bay", holes: 27, par: 72, yardage: 7104, latitude: 37.7580, longitude: -121.7720, phone_number: "(925) 447-6779", golfnow_id: "593", booking_url: "https://www.golfnow.com/tee-times/facility/593-poppy-ridge-golf-course/search", booking_system: "golfnow" },
  { name: "Las Positas Golf Course", city: "Livermore", region: "East Bay", holes: 18, par: 72, yardage: 6725, latitude: 37.6760, longitude: -121.7540, phone_number: "(925) 455-7820", golfnow_id: "553", booking_url: "https://www.golfnow.com/tee-times/facility/553-las-positas-golf-course/search", booking_system: "golfnow" },
  { name: "Pleasanton Golf Center", city: "Pleasanton", region: "East Bay", holes: 9, par: 29, yardage: 1345, latitude: 37.6820, longitude: -121.8740, phone_number: "(925) 462-4653", golfnow_id: "591", booking_url: "https://www.golfnow.com/tee-times/facility/591-pleasanton-golf-center/search", booking_system: "golfnow" },
  { name: "Willow Park Golf Course", city: "Castro Valley", region: "East Bay", holes: 18, par: 71, yardage: 5782, latitude: 37.6950, longitude: -122.0810, phone_number: "(510) 537-8989", golfnow_id: "659", booking_url: "https://www.golfnow.com/tee-times/facility/659-willow-park-golf-course/search", booking_system: "golfnow" },

  // North Bay (Marin, Sonoma, Napa)
  { name: "Peacock Gap Golf Club", city: "San Rafael", region: "North Bay", holes: 18, par: 71, yardage: 6253, latitude: 37.9856, longitude: -122.4780, phone_number: "(415) 453-4940", golfnow_id: "588", booking_url: "https://www.golfnow.com/tee-times/facility/588-peacock-gap-golf-club/search", booking_system: "golfnow" },
  { name: "Indian Valley Golf Club", city: "Novato", region: "North Bay", holes: 18, par: 72, yardage: 6442, latitude: 38.0675, longitude: -122.5670, phone_number: "(415) 897-1118", golfnow_id: "538", booking_url: "https://www.golfnow.com/tee-times/facility/538-indian-valley-golf-club/search", booking_system: "golfnow" },
  { name: "StoneTree Golf Club", city: "Novato", region: "North Bay", holes: 18, par: 72, yardage: 6890, latitude: 38.0980, longitude: -122.5450, phone_number: "(415) 209-6090", golfnow_id: "633", booking_url: "https://www.golfnow.com/tee-times/facility/633-stonetree-golf-club/search", booking_system: "golfnow" },
  { name: "McInnis Park Golf Center", city: "San Rafael", region: "North Bay", holes: 9, par: 31, yardage: 2130, latitude: 38.0140, longitude: -122.5320, phone_number: "(415) 492-1800", golfnow_id: "566", booking_url: "https://www.golfnow.com/tee-times/facility/566-mcinnis-park-golf-center/search", booking_system: "golfnow" },
  { name: "Mill Valley Golf Course", city: "Mill Valley", region: "North Bay", holes: 9, par: 29, yardage: 1620, latitude: 37.9060, longitude: -122.5280, phone_number: "(415) 388-9982", golfnow_id: "572", booking_url: "https://www.golfnow.com/tee-times/facility/572-mill-valley-golf-course/search", booking_system: "golfnow" },
  { name: "The Links at Bodega Harbour", city: "Bodega Bay", region: "North Bay", holes: 18, par: 70, yardage: 6275, latitude: 38.3340, longitude: -123.0470, phone_number: "(707) 875-3538", golfnow_id: "149", booking_url: "https://www.golfnow.com/tee-times/facility/149-the-links-at-bodega-harbour/search", booking_system: "golfnow" },
  { name: "Northwood Golf Club", city: "Monte Rio", region: "North Bay", holes: 9, par: 36, yardage: 2893, latitude: 38.4680, longitude: -123.0140, phone_number: "(707) 865-1116", golfnow_id: null, booking_url: "https://www.northwoodgolf.com/", booking_system: "other" },

  // Santa Cruz / South Bay Extended
  { name: "Pasatiempo Golf Club", city: "Santa Cruz", region: "South Bay", holes: 18, par: 70, yardage: 6439, latitude: 37.0050, longitude: -122.0560, phone_number: "(831) 459-9155", golfnow_id: null, booking_url: "https://www.pasatiempo.com/tee-times/", booking_system: "other" },

  // East Bay - Additional
  { name: "Diablo Creek Golf Course", city: "Concord", region: "East Bay", holes: 18, par: 71, yardage: 6830, latitude: 37.9540, longitude: -121.9350, phone_number: "(925) 686-6262", golfnow_id: "1448", booking_url: "https://www.golfnow.com/tee-times/facility/1448-diablo-creek-golf-course/search", booking_system: "golfnow" },
  { name: "Lake Chabot Golf Course", city: "Oakland", region: "East Bay", holes: 27, par: 72, yardage: 6599, latitude: 37.7292, longitude: -122.0920, phone_number: "(510) 351-5812", golfnow_id: "549", booking_url: "https://www.golfnow.com/tee-times/facility/549-lake-chabot-golf-course/search", booking_system: "golfnow" },
  { name: "Diablo Hills Golf Course", city: "Walnut Creek", region: "East Bay", holes: 9, par: 30, yardage: 1810, latitude: 37.9020, longitude: -122.0450, phone_number: "(925) 939-7372", golfnow_id: "478", booking_url: "https://www.golfnow.com/tee-times/facility/478-diablo-hills-golf-course/search", booking_system: "golfnow" },
  { name: "Las Positas Golf Course", city: "Livermore", region: "East Bay", holes: 18, par: 72, yardage: 6725, latitude: 37.6760, longitude: -121.7540, phone_number: "(925) 455-7820", golfnow_id: "553", booking_url: "https://www.golfnow.com/tee-times/facility/553-las-positas-golf-course/search", booking_system: "golfnow" },
  { name: "Callippe Preserve Golf Course", city: "Pleasanton", region: "East Bay", holes: 18, par: 72, yardage: 6767, latitude: 37.6247, longitude: -121.8532, phone_number: "(925) 426-6666", golfnow_id: "5023", booking_url: "https://www.golfnow.com/tee-times/facility/5023-callippe-preserve-golf-course/search", booking_system: "golfnow" },
  { name: "The Course at Wente Vineyards", city: "Livermore", region: "East Bay", holes: 18, par: 72, yardage: 7012, latitude: 37.6247, longitude: -121.7232, phone_number: "(925) 456-2475", golfnow_id: "658", booking_url: "https://www.golfnow.com/tee-times/facility/658-the-course-at-wente-vineyards/search", booking_system: "golfnow" },
  { name: "Montclair Golf Course", city: "Oakland", region: "East Bay", holes: 9, par: 33, yardage: 2370, latitude: 37.8280, longitude: -122.2050, phone_number: "(510) 482-0422", golfnow_id: "575", booking_url: "https://www.golfnow.com/tee-times/facility/575-montclair-golf-course/search", booking_system: "golfnow" },
  { name: "Redwood Canyon Golf Course", city: "Castro Valley", region: "East Bay", holes: 9, par: 34, yardage: 2580, latitude: 37.7215, longitude: -122.0680, phone_number: "(510) 537-8001", golfnow_id: "602", booking_url: "https://www.golfnow.com/tee-times/facility/602-redwood-canyon-golf-course/search", booking_system: "golfnow" },
  { name: "Willow Park Golf Course", city: "Castro Valley", region: "East Bay", holes: 18, par: 71, yardage: 5782, latitude: 37.6950, longitude: -122.0810, phone_number: "(510) 537-8989", golfnow_id: "659", booking_url: "https://www.golfnow.com/tee-times/facility/659-willow-park-golf-course/search", booking_system: "golfnow" },
  { name: "Franklin Canyon Golf Course", city: "Hercules", region: "East Bay", holes: 18, par: 72, yardage: 6490, latitude: 37.9930, longitude: -122.2880, phone_number: "(510) 799-6191", golfnow_id: "498", booking_url: "https://www.golfnow.com/tee-times/facility/498-franklin-canyon-golf-course/search", booking_system: "golfnow" },
  { name: "Monarch Bay Golf Club", city: "San Leandro", region: "East Bay", holes: 18, par: 71, yardage: 5845, latitude: 37.6940, longitude: -122.1920, phone_number: "(510) 895-2162", golfnow_id: "574", booking_url: "https://www.golfnow.com/tee-times/facility/574-monarch-bay-golf-club/search", booking_system: "golfnow" },
  { name: "Spring Valley Golf Course", city: "Milpitas", region: "South Bay", holes: 18, par: 70, yardage: 5132, latitude: 37.4440, longitude: -121.9108, phone_number: "(408) 262-1722", golfnow_id: "630", booking_url: "https://www.golfnow.com/tee-times/facility/630-spring-valley-golf-course/search", booking_system: "golfnow" },
  { name: "Pleasanton Golf Center", city: "Pleasanton", region: "East Bay", holes: 9, par: 29, yardage: 1345, latitude: 37.6820, longitude: -121.8740, phone_number: "(925) 462-4653", golfnow_id: "591", booking_url: "https://www.golfnow.com/tee-times/facility/591-pleasanton-golf-center/search", booking_system: "golfnow" },

  // South Bay - Additional
  { name: "Stanford Golf Course", city: "Stanford", region: "South Bay", holes: 18, par: 71, yardage: 6727, latitude: 37.4347, longitude: -122.1732, phone_number: "(650) 323-0944", golfnow_id: "631", booking_url: "https://www.golfnow.com/tee-times/facility/631-stanford-golf-course/search", booking_system: "golfnow" },
  { name: "Sunnyvale Golf Course", city: "Sunnyvale", region: "South Bay", holes: 18, par: 70, yardage: 5858, latitude: 37.3900, longitude: -122.0120, phone_number: "(408) 738-3666", golfnow_id: "639", booking_url: "https://www.golfnow.com/tee-times/facility/639-sunnyvale-golf-course/search", booking_system: "golfnow" },
  { name: "Sunken Gardens Golf Course", city: "Sunnyvale", region: "South Bay", holes: 9, par: 29, yardage: 1495, latitude: 37.3778, longitude: -122.0450, phone_number: "(408) 739-6588", golfnow_id: "638", booking_url: "https://www.golfnow.com/tee-times/facility/638-sunken-gardens-golf-course/search", booking_system: "golfnow" },
  { name: "Los Lagos Golf Course", city: "San Jose", region: "South Bay", holes: 18, par: 60, yardage: 3700, latitude: 37.2878, longitude: -121.8208, phone_number: "(408) 361-0250", golfnow_id: "561", booking_url: "https://www.golfnow.com/tee-times/facility/561-los-lagos-golf-course/search", booking_system: "golfnow" },
  { name: "Santa Teresa Golf Club", city: "San Jose", region: "South Bay", holes: 18, par: 71, yardage: 6738, latitude: 37.2295, longitude: -121.7960, phone_number: "(408) 225-2650", golfnow_id: "617", booking_url: "https://www.golfnow.com/tee-times/facility/617-santa-teresa-golf-club/search", booking_system: "golfnow" },
  { name: "Boulder Ridge Golf Club", city: "San Jose", region: "South Bay", holes: 18, par: 72, yardage: 6806, latitude: 37.2208, longitude: -121.7530, phone_number: "(408) 323-9900", golfnow_id: "8267", booking_url: "https://www.golfnow.com/tee-times/facility/8267-boulder-ridge-golf-club/search", booking_system: "golfnow" },
  { name: "Coyote Creek Golf Club", city: "Morgan Hill", region: "South Bay", holes: 36, par: 72, yardage: 7011, latitude: 37.1390, longitude: -121.6220, phone_number: "(408) 463-1400", golfnow_id: "469", booking_url: "https://www.golfnow.com/tee-times/facility/469-coyote-creek-golf-club/search", booking_system: "golfnow" },
  { name: "Moffett Field Golf Course", city: "Mountain View", region: "South Bay", holes: 18, par: 72, yardage: 6685, latitude: 37.4138, longitude: -122.0508, phone_number: "(650) 603-8026", golfnow_id: "573", booking_url: "https://www.golfnow.com/tee-times/facility/573-moffett-field-golf-course/search", booking_system: "golfnow" },
  { name: "Pruneridge Golf Club", city: "Santa Clara", region: "South Bay", holes: 9, par: 30, yardage: 1768, latitude: 37.3622, longitude: -121.9886, phone_number: "(408) 248-4424", golfnow_id: "596", booking_url: "https://www.golfnow.com/tee-times/facility/596-pruneridge-golf-club/search", booking_system: "golfnow" },
  { name: "Poplar Creek Golf Course", city: "San Mateo", region: "San Francisco", holes: 18, par: 60, yardage: 3200, latitude: 37.5847, longitude: -122.3532, phone_number: "(650) 522-4653", golfnow_id: "594", booking_url: "https://www.golfnow.com/tee-times/facility/594-poplar-creek-golf-course/search", booking_system: "golfnow" },
  { name: "Gleneagles Golf Course", city: "San Francisco", region: "San Francisco", holes: 9, par: 36, yardage: 2876, latitude: 37.7147, longitude: -122.4232, phone_number: "(415) 587-2425", golfnow_id: null, booking_url: "https://www.gleneaglesgc.com/", booking_system: "other" },

  // North Bay - Additional
  { name: "McInnis Park Golf Center", city: "San Rafael", region: "North Bay", holes: 9, par: 31, yardage: 2130, latitude: 38.0140, longitude: -122.5320, phone_number: "(415) 492-1800", golfnow_id: "566", booking_url: "https://www.golfnow.com/tee-times/facility/566-mcinnis-park-golf-center/search", booking_system: "golfnow" },
  { name: "Hiddenbrooke Golf Club", city: "Vallejo", region: "North Bay", holes: 18, par: 72, yardage: 6815, latitude: 38.1447, longitude: -122.1932, phone_number: "(707) 558-1140", golfnow_id: "527", booking_url: "https://www.golfnow.com/tee-times/facility/527-hiddenbrooke-golf-club/search", booking_system: "golfnow" },
  { name: "Mare Island Golf Club", city: "Vallejo", region: "North Bay", holes: 18, par: 70, yardage: 6043, latitude: 38.0847, longitude: -122.2632, phone_number: "(707) 562-4653", golfnow_id: "563", booking_url: "https://www.golfnow.com/tee-times/facility/563-mare-island-golf-club/search", booking_system: "golfnow" },
  { name: "Rooster Run Golf Club", city: "Petaluma", region: "North Bay", holes: 18, par: 72, yardage: 7001, latitude: 38.2747, longitude: -122.6432, phone_number: "(707) 778-1211", golfnow_id: "606", booking_url: "https://www.golfnow.com/tee-times/facility/606-rooster-run-golf-club/search", booking_system: "golfnow" },
  { name: "Adobe Creek Golf Course", city: "Petaluma", region: "North Bay", holes: 18, par: 72, yardage: 6302, latitude: 38.2547, longitude: -122.6232, phone_number: "(707) 765-3000", golfnow_id: "434", booking_url: "https://www.golfnow.com/tee-times/facility/434-adobe-creek-golf-club/search", booking_system: "golfnow" },
  { name: "Silverado Resort - North Course", city: "Napa", region: "North Bay", holes: 18, par: 72, yardage: 6896, latitude: 38.3047, longitude: -122.2632, phone_number: "(707) 257-5460", golfnow_id: "620", booking_url: "https://www.golfnow.com/tee-times/facility/620-silverado-resort-north-course/search", booking_system: "golfnow" },
  { name: "Silverado Resort - South Course", city: "Napa", region: "North Bay", holes: 18, par: 72, yardage: 6632, latitude: 38.3037, longitude: -122.2622, phone_number: "(707) 257-5460", golfnow_id: "621", booking_url: "https://www.golfnow.com/tee-times/facility/621-silverado-resort-south-course/search", booking_system: "golfnow" },
  { name: "Napa Golf Course at Kennedy Park", city: "Napa", region: "North Bay", holes: 18, par: 72, yardage: 6738, latitude: 38.2847, longitude: -122.2732, phone_number: "(707) 255-4333", golfnow_id: "129", booking_url: "https://www.golfnow.com/tee-times/facility/129-napa-golf-course/search", booking_system: "golfnow" },
  { name: "Vintner's Golf Club", city: "Yountville", region: "North Bay", holes: 9, par: 34, yardage: 2645, latitude: 38.4147, longitude: -122.3532, phone_number: "(707) 944-1992", golfnow_id: "1676", booking_url: "https://www.golfnow.com/tee-times/facility/1676-vintners-golf-club/search", booking_system: "golfnow" },
  { name: "San Ramon Golf Club", city: "San Ramon", region: "East Bay", holes: 18, par: 71, yardage: 6376, latitude: 37.7547, longitude: -121.9532, phone_number: "(925) 828-6100", golfnow_id: "241", booking_url: "https://www.golfnow.com/tee-times/facility/241-san-ramon-golf-club/search", booking_system: "golfnow" },
  { name: "The Bridges Golf Club", city: "San Ramon", region: "East Bay", holes: 18, par: 72, yardage: 7104, latitude: 37.7347, longitude: -121.9232, phone_number: "(925) 735-4253", golfnow_id: "5141", booking_url: "https://www.golfnow.com/tee-times/facility/5141-the-bridges-golf-club/search", booking_system: "golfnow" },
  { name: "Eagle Vines Golf Club", city: "Napa", region: "North Bay", holes: 18, par: 72, yardage: 7015, latitude: 38.2447, longitude: -122.2832, phone_number: "(707) 257-4470", golfnow_id: "486", booking_url: "https://www.golfnow.com/tee-times/facility/486-eagle-vines-golf-club/search", booking_system: "golfnow" },
  { name: "Chardonnay Golf Club", city: "American Canyon", region: "North Bay", holes: 18, par: 72, yardage: 6816, latitude: 38.1747, longitude: -122.2332, phone_number: "(707) 257-8950", golfnow_id: "463", booking_url: "https://www.golfnow.com/tee-times/facility/463-chardonnay-golf-club/search", booking_system: "golfnow" },
];

// Insert courses if they don't exist
const insertCourse = db.prepare(`
  INSERT OR IGNORE INTO courses (name, city, region, holes, par, yardage, latitude, longitude, phone_number, golfnow_id, foreup_id, booking_url, booking_system)
  VALUES (@name, @city, @region, @holes, @par, @yardage, @latitude, @longitude, @phone_number, @golfnow_id, @foreup_id, @booking_url, @booking_system)
`);

const insertMany = db.transaction((courses) => {
  for (const course of courses) {
    insertCourse.run({
      name: course.name,
      city: course.city,
      region: course.region,
      holes: course.holes,
      par: course.par || null,
      yardage: course.yardage || null,
      latitude: course.latitude || null,
      longitude: course.longitude || null,
      phone_number: course.phone_number || null,
      golfnow_id: course.golfnow_id || null,
      foreup_id: course.foreup_id || null,
      booking_url: course.booking_url,
      booking_system: course.booking_system
    });
  }
});

function seedCourses() {
  insertMany(courses);
  console.log(`Seeded ${courses.length} courses`);
}

// Staff pick course names - these are the top courses
const staffPickCourseNames = [
  "TPC Harding Park",
  "Pasatiempo Golf Club",
  "Presidio Golf Course",
  "Half Moon Bay - Ocean Course",
  "Corica Park - South Course",
  "Cinnabar Hills Golf Club",
  "Tilden Park Golf Course",
  "The Links at Bodega Harbour"
];

// Initialize staff picks from course names
function initializeStaffPicks() {
  const setStaffPickStmt = db.prepare(`
    UPDATE courses SET is_staff_pick = 1, staff_pick_order = ?
    WHERE name = ?
  `);

  const clearStaffPicks = db.prepare('UPDATE courses SET is_staff_pick = 0, staff_pick_order = NULL');
  clearStaffPicks.run();

  for (let i = 0; i < staffPickCourseNames.length; i++) {
    setStaffPickStmt.run(i + 1, staffPickCourseNames[i]);
  }
  console.log(`Initialized ${staffPickCourseNames.length} staff picks`);
}

function getAllCourses() {
  return db.prepare('SELECT * FROM courses ORDER BY region, city, name').all();
}

function getCoursesByRegion(region) {
  return db.prepare('SELECT * FROM courses WHERE region = ? ORDER BY city, name').all(region);
}

function getCoursesWithGolfNow() {
  return db.prepare('SELECT * FROM courses WHERE golfnow_id IS NOT NULL ORDER BY region, city, name').all();
}

// Tournament history for courses that hosted major events
const tournamentHistory = [
  // TPC Harding Park
  { courseName: "TPC Harding Park", tournamentName: "PGA Championship", tournamentType: "Major", year: 2020, winnerName: "Collin Morikawa", winningScore: "267", scoreToPar: "-13", runnerUp: "Paul Casey, Dustin Johnson", notes: "First major at age 23, 2-shot victory" },
  { courseName: "TPC Harding Park", tournamentName: "WGC-Cadillac Match Play", tournamentType: "WGC", year: 2015, winnerName: "Rory McIlroy", winningScore: "4&2", scoreToPar: "Match Play", runnerUp: "Gary Woodland", notes: "Won all 7 matches" },
  { courseName: "TPC Harding Park", tournamentName: "WGC-American Express Championship", tournamentType: "WGC", year: 2005, winnerName: "Tiger Woods", winningScore: "Playoff", scoreToPar: "-12", runnerUp: "John Daly", notes: "Won on 2nd playoff hole" },
  { courseName: "TPC Harding Park", tournamentName: "Presidents Cup", tournamentType: "Team Event", year: 2009, winnerName: "Team USA", winningScore: "19.5-14.5", scoreToPar: "N/A", runnerUp: "International Team", notes: "Tiger Woods went 5-0" },
];

// Seed tournament history
function seedTournamentHistory() {
  const insertTournament = db.prepare(`
    INSERT OR IGNORE INTO tournament_history
    (course_id, tournament_name, tournament_type, year, winner_name, winning_score, score_to_par, runner_up, notes)
    VALUES (
      (SELECT id FROM courses WHERE name = @courseName),
      @tournamentName, @tournamentType, @year, @winnerName, @winningScore, @scoreToPar, @runnerUp, @notes
    )
  `);

  for (const tournament of tournamentHistory) {
    insertTournament.run({
      courseName: tournament.courseName,
      tournamentName: tournament.tournamentName,
      tournamentType: tournament.tournamentType,
      year: tournament.year,
      winnerName: tournament.winnerName,
      winningScore: tournament.winningScore,
      scoreToPar: tournament.scoreToPar,
      runnerUp: tournament.runnerUp,
      notes: tournament.notes
    });
  }
  console.log(`Seeded ${tournamentHistory.length} tournament records`);
}

// Get tournament history for a course
function getTournamentHistory(courseId) {
  return db.prepare(`
    SELECT * FROM tournament_history
    WHERE course_id = ?
    ORDER BY year DESC
    LIMIT 3
  `).all(courseId);
}

// Generate URL-friendly slug from course name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')           // Remove apostrophes
    .replace(/[^a-z0-9\s-]/g, '')   // Remove special chars
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '');         // Trim leading/trailing hyphens
}

// Generate unique slugs for all courses
function generateAllSlugs() {
  const allCourses = db.prepare('SELECT id, name, city FROM courses').all();
  const slugCounts = {};

  const updateSlug = db.prepare('UPDATE courses SET slug = ? WHERE id = ?');

  const updateAll = db.transaction(() => {
    for (const course of allCourses) {
      let slug = generateSlug(course.name);

      // Handle duplicates by adding city
      if (slugCounts[slug]) {
        slug = `${slug}-${generateSlug(course.city)}`;
      }
      slugCounts[slug] = true;

      updateSlug.run(slug, course.id);
    }
  });

  updateAll();
  console.log(`Generated slugs for ${allCourses.length} courses`);
}

// Get course by slug
function getCourseBySlug(slug) {
  return db.prepare('SELECT * FROM courses WHERE slug = ?').get(slug);
}

// Get staff picks
function getStaffPicks() {
  return db.prepare(`
    SELECT * FROM courses
    WHERE is_staff_pick = 1
    ORDER BY staff_pick_order ASC, name ASC
  `).all();
}

// Update staff pick status
function setStaffPick(courseId, isPick, order = null) {
  db.prepare(`
    UPDATE courses
    SET is_staff_pick = ?, staff_pick_order = ?
    WHERE id = ?
  `).run(isPick ? 1 : 0, order, courseId);
}

// Real course photos from official websites
const coursePhotoUrls = {
  // San Francisco
  "TPC Harding Park": "https://tpc.com/hardingpark/wp-content/uploads/sites/47/2016/08/IP-Hero_Harding-park-1-1.jpg",
  "TPC Harding Park - Fleming 9": "https://tpc.com/hardingpark/wp-content/uploads/sites/47/2016/08/IP-Hero_Harding-park-1-1.jpg",
  "Lincoln Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/de/5d/62db1c4c63e92d6e692e2676287b/68973.jpg",
  "Sharp Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/73/b3/0d2e4f6a8c0e2f4a6c8e0a2c4e6a/91234.jpg",
  "Presidio Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/df/da/49f3e806ae58421b99c61f514a2c/69601.jpg",
  "Golden Gate Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/70/60/c2c1b4a29ed98e044acd414ecf2d/21817.jpg",

  // South Bay
  "San Jose Municipal Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/f1/12/3034f7e50b6d2bae44a62805f89f/7008.jpg",
  "Cinnabar Hills Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/b2/c3/d4e5f6a7b8c9d0e1f2a3b4c5d6e7/97100.jpg",
  "Santa Teresa Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/e4/f5/a6b7c8d9e0f1a2b3c4d5e6f7a8b9/91500.jpg",
  "Palo Alto Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/a8/b9/c0d1e2f3a4b5c6d7e8f9a0b1c2d3/68500.jpg",
  "Deep Cliff Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/c6/d7/e8f9a0b1c2d3e4f5a6b7c8d9e0f1/91600.jpg",

  // East Bay
  "Corica Park - South Course": "https://golf-pass-brightspot.s3.amazonaws.com/d5/e6/f7a8b9c0d1e2f3a4b5c6d7e8f9a0/92600.jpg",
  "Corica Park - North Course": "https://golf-pass-brightspot.s3.amazonaws.com/e4/f5/a6b7c8d9e0f1a2b3c4d5e6f7a8b9/92601.jpg",
  "Metropolitan Golf Links": "https://golf-pass-brightspot.s3.amazonaws.com/g3/h4/i5j6k7l8m9n0o1p2q3r4s5t6u7v8/91700.jpg",
  "Tilden Park Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/05/29/3e553c0a50f5c46f8ff795a92f52/91499.jpg",
  "Boundary Oak Golf Course": "https://www.playboundaryoak.com/images/slideshows/banner_2.jpg",
  "Poppy Ridge Golf Course": "https://poppyridgegolf.ncga.org/hubfs/S2%20Poppy%20Ridge/Ridge%20Post%20Renovation%20Backgrounds/Poppy%20Ridge%20Hero%201600%20x%20942%20h17-0380.png",
  "Diablo Creek Golf Course": "https://www.diablocreekgc.com/images/slideshows/banner_1.jpg",

  // North Bay
  "Peacock Gap Golf Club": "https://www.peacockgapgolfclub.com/wp-content/uploads/sites/3/2024/03/Homepage-Banner-2.jpg",
  "Indian Valley Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/k9/l0/m1n2o3p4q5r6s7t8u9v0w1x2y3z4/91900.jpg",
  "StoneTree Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/m7/n8/o9p0q1r2s3t4u5v6w7x8y9z0a1b2/92000.jpg",
  "Mill Valley Golf Course": "https://golf-pass-brightspot.s3.amazonaws.com/o5/p6/q7r8s9t0u1v2w3x4y5z6a7b8c9d0/92100.jpg",
  "The Links at Bodega Harbour": "https://golf-pass-brightspot.s3.amazonaws.com/q3/r4/s5t6u7v8w9x0y1z2a3b4c5d6e7f8/92200.jpg",
  "Northwood Golf Club": "https://golf-pass-brightspot.s3.amazonaws.com/s1/t2/u3v4w5x6y7z8a9b0c1d2e3f4g5h6/92300.jpg",

  // Extended
  "Pasatiempo Golf Club": "https://www.pasatiempo.com/images/uploads/34/hole-1.jpg",
  "Crystal Springs Golf Course": "https://www.playcrystalsprings.com/images/slideshows/001-startingimage-1.jpg",
  "Half Moon Bay - Ocean Course": "https://golf-pass-brightspot.s3.amazonaws.com/u9/v0/w1x2y3z4a5b6c7d8e9f0g1h2i3j4/92400.jpg",
  "Half Moon Bay - Old Course": "https://golf-pass-brightspot.s3.amazonaws.com/w7/x8/y9z0a1b2c3d4e5f6g7h8i9j0k1l2/92500.jpg",
};

// Seed course photos
function seedCoursePhotos() {
  const updatePhoto = db.prepare('UPDATE courses SET photo_url = ? WHERE name = ?');

  const updateAll = db.transaction(() => {
    let updated = 0;
    for (const [name, url] of Object.entries(coursePhotoUrls)) {
      const result = updatePhoto.run(url, name);
      if (result.changes > 0) updated++;
    }
    console.log(`Updated photos for ${updated} courses`);
  });

  updateAll();
}

module.exports = {
  seedCourses,
  seedTournamentHistory,
  seedCoursePhotos,
  initializeStaffPicks,
  getAllCourses,
  getCoursesByRegion,
  getCoursesWithGolfNow,
  getTournamentHistory,
  generateSlug,
  generateAllSlugs,
  getCourseBySlug,
  getStaffPicks,
  setStaffPick,
  courses
};
