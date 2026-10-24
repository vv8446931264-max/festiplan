import { ImageResponse } from "next/og";
import { SEO_COPY } from "@/lib/seo/copy";
import { BRAND, BRAND_COLORS as C } from "@/lib/site";

export const alt = SEO_COPY.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Glowing lanterns on the right: decorative, kept clear of the text column. */
const LANTERNS = [
  { x: 930, y: 200, d: 120 },
  { x: 1090, y: 360, d: 76 },
  { x: 1000, y: 480, d: 46 },
  { x: 1140, y: 165, d: 30 },
] as const;

function Sky() {
  return (
    // satori has no `inset`: the layer is pinned with explicit coordinates.
    <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex" }}>
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
      {LANTERNS.map((l) => (
        <div
          key={`${l.x}-${l.y}`}
          style={{
            position: "absolute",
            left: l.x,
            top: l.y,
            width: l.d,
            height: l.d * 1.15,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 42%, #ffe7a3 0%, ${C.gold} 40%, ${C.ember} 100%)`,
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
      <span style={{ color: C.gold }}>{word}</span>
      <span>.</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", fontSize: 54, lineHeight: 1.1, letterSpacing: -1 }}>
      {line("Made for", "moments")}
      {line("Built for", "budgets")}
    </div>
  );
}

/** The 1200 × 630 share card: dusk gradient, wordmark, tagline and what the product is. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px 80px",
          color: C.cream,
          background: `linear-gradient(135deg, ${C.espresso} 0%, ${C.espresso} 40%, #2b0d1d 65%, #5c0868 86%, ${C.plum} 100%)`,
        }}
      >
        <Sky />
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: C.muted }}>
          {BRAND.category.toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 168, lineHeight: 0.9, letterSpacing: -7 }}>
            <span>{BRAND.name}</span>
            <span style={{ color: C.gold }}>.</span>
          </div>
          <Tagline />
        </div>
        <div style={{ display: "flex", fontSize: 30, color: C.cream, opacity: 0.85 }}>{BRAND.subtitle}</div>
      </div>
    ),
    size,
  );
}
