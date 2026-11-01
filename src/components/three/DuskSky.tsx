import type { Ref } from "react";

/*
 * The fixed sky layer: rendered on the server (as next/dynamic's loading state)
 * and again by SceneBackdrop on the client with identical markup, so the dusk is
 * in the first paint and never flashes. z-index -1 puts it under all content; <body>
 * is its own stacking context (`isolation: isolate` in globals.css), otherwise body's
 * espresso background would paint over a negative z-index layer. Every style comes
 * from classes (the sky and poster rules live in globals.css), so the markup carries
 * no style attribute for the CSP to block; only runtime changes (scroll dimming, the
 * canvas) are written, through the CSSOM.
 */

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
    <div
      ref={rootRef}
      aria-hidden="true"
      data-scene-backdrop=""
      data-tier={tier}
      className="pointer-events-none fixed inset-0 -z-1 h-lvh overflow-hidden bg-espresso"
    >
      <div ref={skyRef} data-sky="" className="dusk-sky absolute inset-0">
        {poster ? (
          // A plain <img>: decorative, fixed 1600×1000 WebP already sized for the
          // job, and next/image's optimiser would only re-encode it. It dims with
          // scroll like the live lanterns (.dusk-poster reads --lantern-dim).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/poster.webp"
            alt=""
            width={1600}
            height={1000}
            decoding="async"
            className="dusk-poster block size-full object-cover"
          />
        ) : null}
      </div>
    </div>
  );
}
