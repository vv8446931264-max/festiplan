import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/site";

/** Web app manifest so the planner can be added to a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.category}`,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#100904",
    theme_color: "#100904",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
