import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/** Index the landing page only; private plan links and the JSON API stay out of search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/plan/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
