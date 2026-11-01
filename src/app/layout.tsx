import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Literata } from "next/font/google";
import { connection } from "next/server";
import { LazySceneBackdrop } from "@/components/three/lazy";
import { rootMetadata } from "@/lib/seo/metadata";
import { BRAND_COLORS } from "@/lib/site";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-hanken",
  display: "swap",
});
const literata = Literata({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400"],
  variable: "--font-literata",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-jetbrains",
  display: "swap",
});

/** Site-wide defaults; the landing page adds its canonical URL (see `src/lib/seo/metadata.ts`). */
export const metadata: Metadata = rootMetadata();

/** Dark UI: browser chrome takes the page's espresso background. */
export const viewport: Viewport = {
  themeColor: BRAND_COLORS.espresso,
  colorScheme: "dark",
};

/**
 * Keeps the sticky plan tab bar from covering whatever has keyboard focus (WCAG 2.4.11 Focus
 * Not Obscured): the browser scrolls a focused element or an anchor target to just below this
 * much of the viewport's top edge. 17 spacing units = 4.25rem = the bar's height in
 * PlanTabs.tsx (`py-3` twice + `min-h-11` buttons); tests/components/scroll-padding.test.tsx
 * fails if the two ever drift apart.
 */
const STICKY_BAR_SCROLL_PADDING = "scroll-pt-17";

/**
 * Root layout: fonts, the lazy dusk backdrop and a skip link. Rendered per request
 * (`connection()`) because every page's scripts carry the CSP nonce minted by `src/proxy.ts`;
 * a prerendered page would ship scripts without it and be blocked.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${literata.variable} ${jetbrains.variable} ${STICKY_BAR_SCROLL_PADDING}`}
    >
      <body>
        <a
          href="#main"
          className="btn btn-primary fixed top-4 left-4 z-50 -translate-y-24 focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        <LazySceneBackdrop />
        {children}
      </body>
    </html>
  );
}
