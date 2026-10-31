import { ImageResponse } from "next/og";
import { SEO_COPY } from "@/lib/seo/copy";
import { BRAND, BRAND_COLORS as COLORS } from "@/lib/site";

/** Alt text for the share card (rendered into the og:image:alt tag). */
export const alt = SEO_COPY.ogImageAlt;
/** The 1.91:1 size every major social network crops to. */
export const size = { width: 1200, height: 630 };
/** Served as PNG. */
export const contentType = "image/png";

/** Glowing lanterns on the right: decorative, kept clear of the text column. */
const LANTERNS = [
  { x: 930, y: 200, diameter: 120 },
  { x: 1090, y: 360, diameter: 76 },
  { x: 1000, y: 480, diameter: 46 },
  { x: 1140, y: 165, diameter: 30 },
] as const;

function Sky() {
  return (
    // satori has no `inset`: the layer is pinned with explicit coordinates.
    <div
      style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex" }}
    >
      <div
        style={{
          position: "absolute",
          // Inside the canvas (satori clips offset backgrounds); fades out at 70 % of the
          // half-diagonal, before the square's edges, so no seam shows.
          left: 600,
          top: 15,
          width: 600,
          height: 600,
          background: `radial-gradient(circle, rgba(255,191,2,0.3) 0%, rgba(220,80,0,0.16) 35%, rgba(220,80,0,0) 70%)`,
        }}
      />
      {LANTERNS.map((lantern) => (
        <div
          key={`${lantern.x}-${lantern.y}`}
          style={{
            position: "absolute",
            left: lantern.x,
            top: lantern.y,
            width: lantern.diameter,
            height: lantern.diameter * 1.15,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 42%, #ffe7a3 0%, ${COLORS.gold} 40%, ${COLORS.ember} 100%)`,
          }}
        />
      ))}
    </div>
  );
}

function Tagline() {
  const line = (lead: string, word: string) => (
    <div style={{ display: "flex" }}>
      <span>{`${lead} `}</span>
      <span style={{ color: COLORS.gold }}>{word}</span>
      <span>.</span>
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontSize: 54,
        lineHeight: 1.1,
        letterSpacing: -1,
      }}
    >
      {line("Made for", "moments")}
      {line("Built for", "budgets")}
    </div>
  );
}

/** The 1200 × 630 share card: dusk gradient, wordmark, tagline and what the product is. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "64px 80px",
        color: COLORS.cream,
        background: `linear-gradient(135deg, ${COLORS.espresso} 0%, ${COLORS.espresso} 40%, #2b0d1d 65%, #5c0868 86%, ${COLORS.plum} 100%)`,
      }}
    >
      <Sky />
      <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: COLORS.muted }}>
        {BRAND.category.toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", fontSize: 168, lineHeight: 0.9, letterSpacing: -7 }}>
          <span>{BRAND.name}</span>
          <span style={{ color: COLORS.gold }}>.</span>
        </div>
        <Tagline />
      </div>
      <div style={{ display: "flex", fontSize: 30, color: COLORS.cream, opacity: 0.85 }}>
        {BRAND.subtitle}
      </div>
    </div>,
    size,
  );
}
