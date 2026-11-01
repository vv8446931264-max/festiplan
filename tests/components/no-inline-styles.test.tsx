// @vitest-environment node
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RouteError from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";
import { BriefSection } from "@/components/landing/BriefSection";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { Manifesto } from "@/components/landing/Manifesto";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PlanView } from "@/components/plan/PlanView";
import { DuskSky } from "@/components/three/DuskSky";
import type * as LazyModule from "@/components/three/lazy";
import { BRAND } from "@/lib/site";
import { fixturePlan } from "../fixtures/plan";

// PlanView gets stand-ins; the real wrappers are rendered in the last test.
vi.mock("@/components/three/lazy", () => ({
  LazyBudgetFlow: () => null,
  LazySceneBackdrop: () => null,
}));

const EDIT_KEY = "k".repeat(43);

/**
 * The CSP's `style-src` has no 'unsafe-inline': the browser drops a `style` attribute (and a
 * `<style>` without the nonce) when it parses server HTML, so the page would lose that look.
 * Client-side style changes go through the CSSOM, which the policy allows.
 */
function expectNoInlineStyles(markup: string) {
  expect(markup).not.toMatch(/\sstyle\s*=/i);
  expect(markup).not.toMatch(/<style[\s>]/i);
}

/** The server HTML of an element, as the browser receives it before any script runs. */
function serverHtml(element: ReactElement): string {
  const markup = renderToStaticMarkup(element);
  expectNoInlineStyles(markup);
  return markup;
}

describe("server-rendered plan", () => {
  it("has no style attribute in any chapter, for an owner", () => {
    const plan = fixturePlan();
    const markup = serverHtml(<PlanView plan={plan} editKey={EDIT_KEY} />);
    // Every chapter is in the HTML (inactive ones are only hidden), so these prove the
    // parts that once carried style props were really rendered and checked.
    expect(markup).toContain('id="panel-ideas"');
    expect(markup).toContain('class="palette-band"');
    for (const hex of plan.ai.ideas.flatMap((idea) => idea.palette)) {
      expect(markup).toContain(`stop-color="${hex}"`);
      expect(markup).toContain(`fill="${hex}"`);
    }
    for (const line of plan.budget) {
      expect(markup).toContain(`data-category-fill="${line.category}"`);
    }
    expect(markup).toContain('type="range"');
  });

  it("has none on the read-only share page either", () => {
    const markup = serverHtml(<PlanView plan={fixturePlan()} editKey={null} titleAs="h1" />);
    expect(markup).toContain("<meter");
    expect(markup).toContain('data-category-fill="venue"');
  });
});

describe("server-rendered landing page", () => {
  it("has none in the header, hero, manifesto, brief form, FAQ or footer", () => {
    const markup = serverHtml(
      <>
        <SiteHeader />
        <main>
          <Hero />
          <Manifesto />
          <BriefSection />
          <Faq />
        </main>
        <SiteFooter />
      </>,
    );
    expect(markup).toContain('id="hero-title"');
    expect(markup).toContain("<form");
    expect(markup).toContain('id="faq"');
  });

  it("delays each wordmark letter and the pitch with classes, 55 ms apart", () => {
    const markup = serverHtml(<Hero />);
    const delays = [...markup.matchAll(/\[animation-delay:(\d+)ms\]/g)].map((m) => Number(m[1]));
    const letters = Array.from(BRAND.name, (_, index) => 120 + 55 * index);
    expect(delays).toEqual([350, ...letters]);
    expect(markup).not.toContain("undefined");
  });

  it("has none on the 404, error and global error pages", () => {
    expect(serverHtml(<NotFound />)).toContain("Error 404");
    expect(serverHtml(<RouteError error={new Error("boom")} reset={vi.fn()} />)).toContain(
      "Try again",
    );
    expect(serverHtml(<GlobalError error={new Error("boom")} reset={vi.fn()} />)).toContain(
      "couldn&#x27;t",
    );
  });
});

describe("server-rendered sky", () => {
  it("paints the dusk gradient from a class while the scene loads", () => {
    const markup = serverHtml(<DuskSky />);
    expect(markup).toContain("dusk-sky");
    expect(markup).toContain('data-tier="pending"');
    expect(markup).not.toContain("<img");
  });

  it("adds the poster, dimmed by scroll through a class, when the scene stays off", () => {
    const markup = serverHtml(<DuskSky poster tier="off" />);
    expect(markup).toContain("dusk-sky");
    expect(markup).toContain('src="/poster.webp"');
    expect(markup).toContain("dusk-poster");
  });

  it("serves the lazy wrappers' loading states, all the server renders of them, as classes", async () => {
    const lazy = await vi.importActual<typeof LazyModule>("@/components/three/lazy");
    expect(serverHtml(<lazy.LazySceneBackdrop />)).toContain("dusk-sky");
    const flow = serverHtml(<lazy.LazyBudgetFlow allocations={[]} highlight={null} />);
    expect(flow).toContain("aspect-[4/3]");
  });
});
