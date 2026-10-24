import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Faq } from "@/components/landing/Faq";
import { CONTINGENCY_PERCENT, LANGS, LIMITS, PLAN_TTL_DAYS } from "@/lib/contracts/constants";
import { PLAN_LANGUAGES } from "@/lib/seo/copy";
import { FAQ } from "@/lib/seo/faq";
import { landingJsonLd } from "@/lib/seo/metadata";
import { axeViolations } from "../components/axe";

const normalise = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

describe("FAQ data", () => {
  it("has 5–6 unique questions", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(5);
    expect(FAQ.length).toBeLessThanOrEqual(6);
    expect(new Set(FAQ.map((f) => f.id)).size).toBe(FAQ.length);
    for (const f of FAQ) expect(f.question.endsWith("?")).toBe(true);
  });

  it("states the numbers the code enforces", () => {
    const text = FAQ.map((f) => f.answer).join(" ");
    expect(text).toContain(`${CONTINGENCY_PERCENT}% as contingency`);
    expect(text).toContain(`${PLAN_TTL_DAYS} days`);
    expect(text).toContain(new Intl.NumberFormat("en-IN").format(LIMITS.guestsMax));
    expect(text).toContain("₹50,00,00,000");
  });

  it("names every plan language by its English name", () => {
    expect(PLAN_LANGUAGES).toHaveLength(LANGS.length);
    expect(PLAN_LANGUAGES).toContain("Hindi");
    for (const name of PLAN_LANGUAGES) expect(FAQ.find((f) => f.id === "languages")?.answer).toContain(name);
  });
});

describe("<Faq />", () => {
  it("renders every question as a native disclosure with its answer", () => {
    const { container } = render(<Faq />);
    const section = screen.getByRole("region", { name: /fair questions/i });
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(FAQ.length);
    FAQ.forEach((item, i) => {
      expect(normalise(details[i].querySelector("summary > span")?.textContent ?? null)).toBe(item.question);
      expect(within(section).getByText(item.answer)).toBeInTheDocument();
    });
  });

  it("hides the decorative +/× marker from assistive technology and starts closed", () => {
    const { container } = render(<Faq />);
    for (const d of container.querySelectorAll("details")) {
      expect(d.open).toBe(false);
      expect(d.querySelector("summary [aria-hidden='true']")?.textContent).toBe("+");
    }
  });

  it("shows exactly the text the FAQPage JSON-LD carries", () => {
    const { container } = render(<Faq />);
    const visible = [...container.querySelectorAll("details")].map((d) => ({
      q: normalise(d.querySelector("summary span")?.textContent ?? null),
      a: normalise(d.querySelector("p")?.textContent ?? null),
    }));
    const faqNode = landingJsonLd()["@graph"].find((n) => n["@type"] === "FAQPage");
    const ld = (faqNode?.mainEntity as { name: string; acceptedAnswer: { text: string } }[]).map((e) => ({
      q: e.name,
      a: e.acceptedAnswer.text,
    }));
    expect(visible).toEqual(ld);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <main>
        <Faq />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
