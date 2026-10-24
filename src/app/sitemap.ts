import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * Only the landing page is public content; shared plans are private links. The sitemap is
 * prerendered at build time, so `lastModified` is the date of the deploy that built it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: absoluteUrl("/"), lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
