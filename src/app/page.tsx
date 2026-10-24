import type { Metadata } from "next";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { LandingJsonLd } from "@/components/landing/JsonLd";
import { Manifesto } from "@/components/landing/Manifesto";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PlannerApp } from "@/components/planner/PlannerApp";
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
        <section id="plan" aria-labelledby="brief-title" className="shell scroll-mt-4 py-16 sm:py-24">
          <div className="legible mb-10 grid gap-6 lg:grid-cols-[1fr_2fr]">
            <p className="eyebrow">Nº 02 — The brief</p>
            <div className="flex flex-col gap-4">
              <h2 id="brief-title" tabIndex={-1} className="h2 outline-none">
                Tell us about <span className="accent text-gold">the day</span>.
              </h2>
              <p className="lead max-w-2xl text-muted">
                Four numbers and a feeling. That&apos;s all it takes to get concepts, a budget, a timeline and a
                vendor checklist.
              </p>
            </div>
          </div>
          <PlannerApp />
        </section>
        <Faq />
      </main>
      <SiteFooter />
      <LandingJsonLd />
    </>
  );
}
