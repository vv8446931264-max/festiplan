// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS } from "@/lib/category-style";
import { DUSK_BACKGROUND, ESPRESSO } from "@/three/dusk";

/*
 * The CSP allows no inline styles, so colours the DOM used to take from `style` props now live
 * in src/app/globals.css, next to the TypeScript constants the SVG fallback and the WebGL scene
 * read. Nothing else ties the two copies together, so these tests do.
 */
const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A declaration value: anything up to `;`, treating a quoted string (a data URI) as one unit. */
const VALUE = `((?:[^;"']|"[^"]*"|'[^']*')+);`;

/** The value of `property` in the rule for `selector`, as written in the stylesheet. */
function declared(selector: string, property: string): string {
  const rule = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`).exec(css);
  const value = new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*${VALUE}`).exec(rule?.[1] ?? "");
  return value?.[1]?.trim() ?? "";
}

/** Whitespace and case differences are formatting, not drift. */
const squash = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .toLowerCase();

const fill = (category: string) => `[data-category-fill="${category}"]`;
const categories = Object.keys(CATEGORY_COLORS);

describe("budget category fills", () => {
  it.each(Object.entries(CATEGORY_COLORS))("%s is %s in the stylesheet too", (category, colour) => {
    expect(declared(fill(category), "background-color").toLowerCase()).toBe(colour.toLowerCase());
  });

  it("styles exactly the categories that have a colour", () => {
    const styled = [...css.matchAll(/\[data-category-fill="([^"]+)"\]\s*\{/g)].map(
      (match) => match[1],
    );
    expect(styled.sort()).toEqual([...categories].sort());
  });

  it("gives every category but the plain venue its own pattern, so colour is never the only cue", () => {
    const patterns = categories
      .filter((category) => category !== "venue")
      .map((category) =>
        [declared(fill(category), "background-image"), declared(fill(category), "background-size")]
          .join(" ")
          .trim(),
      );
    for (const pattern of patterns) expect(pattern).toMatch(/gradient\(/);
    expect(new Set(patterns).size).toBe(patterns.length);
    expect(declared(fill("venue"), "background-image")).toBe("");
  });
});

describe("dusk sky", () => {
  it("paints .dusk-sky exactly as DUSK_BACKGROUND does for the lantern scene and poster", () => {
    expect(squash(declared(".dusk-sky", "background"))).toBe(squash(DUSK_BACKGROUND));
  });

  it("sits on the espresso token the sky dissolves into", () => {
    const token = /--color-espresso:\s*(#[0-9a-f]{6})\s*;/i.exec(css)?.[1] ?? "";
    expect(token.toLowerCase()).toBe(ESPRESSO.toLowerCase());
  });
});
