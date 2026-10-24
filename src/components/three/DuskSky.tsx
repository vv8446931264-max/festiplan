import type { CSSProperties, Ref } from "react";
import { DUSK_BACKGROUND, ESPRESSO } from "@/three/dusk";

/*
 * The fixed sky layer: rendered on the server (as next/dynamic's loading state)
 * and again by SceneBackdrop on the client with identical markup, so the dusk is
 * in the first paint and never flashes. z-index -1 puts it under all content; the
 * hoisted rule makes <body> a stacking context, otherwise body's own espresso
 * background (globals.css) would paint over a negative z-index layer.
 */

const ROOT_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  height: "100lvh",
  zIndex: -1,
  pointerEvents: "none",
  overflow: "hidden",
  background: ESPRESSO,
};

const SKY_STYLE: CSSProperties = { position: "absolute", inset: 0, background: DUSK_BACKGROUND };

// The poster dims with scroll exactly like the live lanterns (--lantern-dim, set by the scroll hook).
const POSTER_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
  opacity: "var(--lantern-dim, 1)",
  transition: "opacity 1.2s cubic-bezier(.2,.7,.2,1)",
};

/** Props for {@link DuskSky}; all optional so it can serve as a loading placeholder. */
export type DuskSkyProps = {
  rootRef?: Ref<HTMLDivElement>;
  skyRef?: Ref<HTMLDivElement>;
  /** Show the static poster captured from the live scene (reduced motion, Save-Data, no WebGL). */
  poster?: boolean;
  /** Exposed as data-tier for debugging and e2e checks. */
  tier?: string;
};

/** Fixed, aria-hidden dusk backdrop: CSS gradient, optional poster, slot for the canvas. */
export function DuskSky({ rootRef, skyRef, poster = false, tier = "pending" }: DuskSkyProps) {
  return (
    <div ref={rootRef} aria-hidden="true" data-scene-backdrop="" data-tier={tier} style={ROOT_STYLE}>
      <style href="festiplan-backdrop" precedence="default">
        {"body{isolation:isolate}"}
      </style>
      <div ref={skyRef} data-sky="" style={SKY_STYLE}>
        {poster ? (
          // A plain <img>: decorative, fixed 1600×1000 WebP already sized for the
          // job, and next/image's optimiser would only re-encode it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/poster.webp" alt="" width={1600} height={1000} decoding="async" style={POSTER_STYLE} />
        ) : null}
      </div>
    </div>
  );
}
