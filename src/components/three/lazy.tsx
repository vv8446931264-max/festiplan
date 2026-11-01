"use client";

/*
 * How three.js reaches the page (CLAUDE.md: "three only via next/dynamic({ ssr: false })"):
 *
 * 1. Server components import these Lazy* wrappers. `ssr: false` is only legal
 *    inside a client module, hence this "use client" file rather than index.ts.
 * 2. next/dynamic splits SceneBackdrop / BudgetFlow (small React islands with no
 *    three import) into their own chunks and keeps them off the server.
 * 3. Those islands import the scene modules (src/three/*-scene.ts — the only
 *    files that import "three", with named imports so it tree-shakes) via
 *    `import()` inside an effect: after first paint for the backdrop, on approach
 *    to the viewport for Budget Flow, and never on tier "off". So three lives in a
 *    lazy chunk that some visitors never download.
 *
 * The `loading` states are real first paint, not spinners: the server renders the
 * dusk sky (identical markup to the client backdrop) and a 4:3 box for the flow
 * (BudgetSection passes `aspect-[4/3] w-full`), so nothing flashes or shifts.
 */
import dynamic from "next/dynamic";
import { DuskSky } from "./DuskSky";

function FlowPlaceholder() {
  return <div aria-hidden="true" className="aspect-[4/3] w-full" />;
}

/** Fixed dusk backdrop with the lantern scene; place once, first in <body>. No props. */
export const LazySceneBackdrop = dynamic(
  () => import("./SceneBackdrop").then((m) => m.SceneBackdrop),
  {
    ssr: false,
    loading: () => <DuskSky />,
  },
);

/** Budget Flow simulation; see {@link BudgetFlowProps}. */
export const LazyBudgetFlow = dynamic(() => import("./BudgetFlow").then((m) => m.BudgetFlow), {
  ssr: false,
  loading: FlowPlaceholder,
});
