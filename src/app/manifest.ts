import type { MetadataRoute } from "next";
import { SEO_COPY } from "@/lib/seo/copy";
import { BRAND, BRAND_COLORS, IMAGE_ROUTES } from "@/lib/site";

/**
 * Web app manifest so the planner can be added to a phone's home screen. The PNG icons are
 * full-bleed with the lantern inside the central safe zone, so the 512 px one doubles as the
 * `maskable` icon Android crops into circles and squircles.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${BRAND.name} — ${BRAND.category}`,
    short_name: BRAND.name,
    description: SEO_COPY.description,
    lang: SEO_COPY.language,
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND_COLORS.espresso,
    theme_color: BRAND_COLORS.espresso,
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: IMAGE_ROUTES.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: IMAGE_ROUTES.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: IMAGE_ROUTES.icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
