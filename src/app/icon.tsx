import { brandIconResponse } from "@/lib/seo/icon-art";

const SIZES = [192, 512] as const;

/**
 * PNG app icons at `/icon/192` and `/icon/512`: the manifest's raster and maskable icons, and
 * a favicon for browsers without SVG favicon support. `icon.svg` stays the primary favicon.
 */
export function generateImageMetadata() {
  return SIZES.map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: "image/png",
  }));
}

/** Renders the icon at the size its id names (192 or 512). */
export default async function Icon({ id }: { id: Promise<string | number> }) {
  const px = Number(await id) === 512 ? 512 : 192;
  return brandIconResponse(px);
}
