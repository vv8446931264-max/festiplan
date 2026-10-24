import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Literata } from "next/font/google";
import { connection } from "next/server";
import { LazySceneBackdrop } from "@/components/three/lazy";
import { SITE_URL } from "@/lib/site";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FestiPlan — AI Celebration & Event Planner",
    template: "%s · FestiPlan",
  },
  description:
    "Plan weddings, birthdays and community events with Gemini: three personalised concepts, a budget split to the last rupee, a dated timeline and real vendors from Google Maps.",
  applicationName: "FestiPlan",
  openGraph: {
    type: "website",
    title: "FestiPlan — AI Celebration & Event Planner",
    description: "Made for moments. Built for budgets.",
    siteName: "FestiPlan",
  },
};

export const viewport: Viewport = {
  themeColor: "#100904",
  colorScheme: "dark",
};

/**
 * Root layout: fonts, the lazy dusk backdrop and a skip link. Rendered per request
 * (`connection()`) because every page's scripts carry the CSP nonce minted by `src/proxy.ts`;
 * a prerendered page would ship scripts without it and be blocked.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html lang="en" className={`${hanken.variable} ${literata.variable} ${jetbrains.variable}`}>
      <body>
        <a
          href="#main"
          className="btn btn-primary fixed left-4 top-4 z-50 -translate-y-24 focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        <LazySceneBackdrop />
        {children}
      </body>
    </html>
  );
}
