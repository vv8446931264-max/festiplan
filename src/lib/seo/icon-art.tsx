import { ImageResponse } from "next/og";
import { BRAND_COLORS } from "@/lib/site";

/**
 * The lantern from `src/app/icon.svg`, redrawn full-bleed for raster icons: an opaque square
 * (iOS rounds it, Android masks it) with the lantern scaled to 82 % around the centre. Its
 * bounding box then stays within 37 % of the side from the centre, inside the 40 % radius
 * maskable safe zone, so one image serves `any` and `maskable`.
 */
export const BRAND_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
<radialGradient id="g" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#FFE7A3"/><stop offset=".45" stop-color="${BRAND_COLORS.gold}"/><stop offset="1" stop-color="${BRAND_COLORS.ember}"/></radialGradient>
<radialGradient id="glow" cx="50%" cy="48%" r="50%"><stop offset="0" stop-color="${BRAND_COLORS.ember}" stop-opacity=".45"/><stop offset="1" stop-color="${BRAND_COLORS.espresso}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="64" height="64" fill="${BRAND_COLORS.espresso}"/>
<rect width="64" height="64" fill="url(#glow)"/>
<g transform="translate(32 32) scale(0.82) translate(-32 -28.5)">
<path d="M32 10c9 0 15 8 15 18 0 11-7 20-15 20s-15-9-15-20c0-10 6-18 15-18z" fill="url(#g)"/>
<rect x="26" y="48" width="12" height="5" rx="2" fill="${BRAND_COLORS.emberDeep}"/>
<path d="M32 4v6" stroke="${BRAND_COLORS.gold}" stroke-width="2.5" stroke-linecap="round"/>
</g>
</svg>`;

/**
 * A square PNG of the brand icon for app-icon routes (`icon.tsx`, `apple-icon.tsx`).
 * @param px edge length in pixels
 */
export function brandIconResponse(px: number): ImageResponse {
  const src = `data:image/svg+xml;base64,${Buffer.from(BRAND_ICON_SVG).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: BRAND_COLORS.espresso }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
        <img src={src} width={px} height={px} alt="" />
      </div>
    ),
    { width: px, height: px },
  );
}
