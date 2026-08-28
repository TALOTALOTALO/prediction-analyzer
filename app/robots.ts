import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/studio/",
          "/api/",
          "/sign-in",
          "/sign-up",
          "/coach",
          "/history",
          "/portfolio",
        ],
      },
    ],
    sitemap: "https://www.fademe.ai/sitemap.xml",
    host: "https://www.fademe.ai",
  };
}
