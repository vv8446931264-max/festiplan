import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Index the landing page only; plans and APIs stay out of search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/plan/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
