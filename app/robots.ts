export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/update-password"],
      },
    ],
    sitemap: "https://golfthebay.com/sitemap.xml",
  }
}
