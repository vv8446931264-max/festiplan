import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only the landing page is public content; shared plans are private links. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: "weekly", priority: 1 }];
}
