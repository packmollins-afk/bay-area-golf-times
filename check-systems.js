const { createClient } = require("@libsql/client");
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function check() {
  const result = await db.execute("SELECT name, booking_url FROM courses ORDER BY name");

  const systems = {};
  result.rows.forEach(r => {
    const url = r.booking_url || "NONE";
    let system = "other";
    if (url.includes("golfnow")) system = "golfnow";
    else if (url.includes("foreup")) system = "foreup";
    else if (url.includes("totaleintegrated")) system = "totaleintegrated";
    else if (url.includes("cps.golf")) system = "cps.golf";
    else if (url.includes("ezlinksgolf") || url.includes("ezlinks")) system = "ezlinks";
    else if (url.includes("chronogolf")) system = "chronogolf";
    else if (url.includes("teesnap")) system = "teesnap";
    else if (url.includes("tpc.com")) system = "tpc.com";
    else if (url.includes("sfrecpark")) system = "sfrecpark";
    else if (url.includes("presidiogolf")) system = "presidiogolf";
    else if (url === "NONE") system = "none";

    if (systems[system] === undefined) systems[system] = [];
    systems[system].push({ name: r.name, url: r.booking_url });
  });

  console.log("Courses by booking system:\n");
  Object.entries(systems).sort((a,b) => b[1].length - a[1].length).forEach(([sys, courses]) => {
    console.log(sys.toUpperCase() + " (" + courses.length + " courses):");
    courses.forEach(c => console.log("  - " + c.name));
    console.log("");
  });
}
check();
