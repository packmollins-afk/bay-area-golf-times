export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/update-password"],
      },
    ],
    sitemap: "https://www.bayareagolf.now/sitemap.xml",
  }
}
