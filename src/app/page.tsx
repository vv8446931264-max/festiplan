import type { Metadata } from "next";
import { BriefSection } from "@/components/landing/BriefSection";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { LandingJsonLd } from "@/components/landing/JsonLd";
import { Manifesto } from "@/components/landing/Manifesto";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { homeMetadata } from "@/lib/seo/metadata";

/** The only indexable page: canonical URL and Open Graph `url` live here, not in the layout. */
export const metadata: Metadata = homeMetadata();

/** The single entry point: landing chapters, the brief that unfolds into a plan, then the FAQ. */
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Manifesto />
        <BriefSection />
        <Faq />
      </main>
      <SiteFooter />
      <LandingJsonLd />
    </>
  );
}
