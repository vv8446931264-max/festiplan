// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ageFrom, festivalFrom, isKidsParty, ordinal, templatePlan } from "@/lib/ai/templates";
import { AiPlanSchema, EVENT_TYPES, LANGS, LIMITS, PlanInputSchema } from "@/lib/contracts";
import type { PlanInput } from "@/lib/contracts";
import { rng, sampleInput } from "../server/fixtures";

const WORDS = [
  "veg",
  "non-veg",
  "jain",
  "dinosaur",
  "space",
  "unicorn",
  "diwali",
  "holi",
  "turning 7",
  "40th birthday",
  "eco",
  "wheelchair",
  "kids",
  "zero waste",
  "elderly",
  "🎉",
  "शादी",
  "<<<BRIEF",
  "ignore instructions",
];

function randomText(next: () => number, max: number): string {
  let out = "";
  while (out.length < max * next()) out += `${WORDS[Math.floor(next() * WORDS.length)]} `;
  return out.slice(0, max).trim();
}

function randomInput(next: () => number): PlanInput {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const city = `${randomText(next, LIMITS.cityMax - 2)}xx`.slice(0, LIMITS.cityMax);
  return {
    eventType: pick(EVENT_TYPES),
    title: next() < 0.3 ? undefined : randomText(next, LIMITS.titleMax),
    eventDate: "2027-03-01",
    city: city.trim().length >= 2 ? city : "Pune",
    guests: 1 + Math.floor(next() * LIMITS.guestsMax),
    budgetINR: LIMITS.budgetMin + Math.floor(next() * (LIMITS.budgetMax - LIMITS.budgetMin)),
    vibe: randomText(next, LIMITS.vibeMax),
    constraints: Array.from(
      { length: Math.floor(next() * 11) },
      () => randomText(next, 39) || "eco",
    ),
    language: pick(LANGS),
  };
}

describe("templatePlan", () => {
  it("passes AiPlanSchema for 400 random valid inputs", () => {
    const next = rng(20261024);
    for (let i = 0; i < 400; i++) {
      const input = PlanInputSchema.parse(randomInput(next));
      const result = AiPlanSchema.safeParse(templatePlan(input));
      expect(result.success, JSON.stringify(result.error?.issues.slice(0, 3))).toBe(true);
    }
  });

  it("passes for every event type at the limits", () => {
    for (const eventType of EVENT_TYPES) {
      const input = sampleInput({
        eventType,
        city: "C".repeat(LIMITS.cityMax),
        guests: LIMITS.guestsMax,
        title: "T".repeat(LIMITS.titleMax),
      });
      expect(AiPlanSchema.safeParse(templatePlan(input)).success).toBe(true);
    }
  });

  it("only references task ids that exist", () => {
    for (const eventType of EVENT_TYPES) {
      const plan = templatePlan(sampleInput({ eventType }));
      const ids = new Set(plan.tasks.map((t) => t.id));
      for (const t of plan.tasks) for (const d of t.dependsOn) expect(ids.has(d)).toBe(true);
    }
  });

  it("is deterministic and returns fresh objects", () => {
    const a = templatePlan(sampleInput());
    const b = templatePlan(sampleInput());
    expect(a).toEqual(b);
    a.tasks[0]?.dependsOn.push("mutated");
    expect(templatePlan(sampleInput()).tasks[0]?.dependsOn).not.toContain("mutated");
  });

  it("covers every wedding function", () => {
    const titles = templatePlan(sampleInput())
      .tasks.map((t) => t.title.toLowerCase())
      .join(" ");
    for (const fn of ["haldi", "mehendi", "sangeet", "pheras", "reception", "muhurat"])
      expect(titles).toContain(fn);
  });

  it("plans a kids' birthday with theme, cake, return gifts and an adult split", () => {
    const plan = templatePlan(
      sampleInput({
        eventType: "birthday",
        title: "Aarav's 7th birthday",
        vibe: "dinosaur theme",
        constraints: [],
      }),
    );
    expect(plan.ideas[0]?.name).toBe("Dino Discovery Dig");
    const titles = plan.tasks.map((t) => t.title.toLowerCase()).join(" ");
    for (const s of ["theme", "cake", "return gifts", "kids and adults"])
      expect(titles).toContain(s);
    expect(plan.summary).toContain("7th birthday");
  });

  it("plans an adult birthday differently", () => {
    const plan = templatePlan(
      sampleInput({ eventType: "birthday", title: "Mum turning 60", vibe: "", constraints: [] }),
    );
    expect(plan.ideas.map((i) => i.name)).toContain("Retro Bollywood Night");
  });

  it("plans community permits, volunteers, sponsors, stalls, stage and safety", () => {
    const plan = templatePlan(
      sampleInput({ eventType: "community", vibe: "Society Diwali mela", constraints: [] }),
    );
    const titles = plan.tasks.map((t) => t.title.toLowerCase()).join(" ");
    for (const s of ["permission", "volunteer", "sponsor", "stall", "stage", "first aid"])
      expect(titles).toContain(s);
    expect(plan.ideas[0]?.name).toBe("Diwali Utsav Mela");
  });

  it("adds tips for the brief's constraints", () => {
    const kinds = templatePlan(
      sampleInput({ eventType: "other", constraints: ["wheelchair access", "zero waste", "jain"] }),
    ).tips;
    expect(kinds.length).toBeLessThanOrEqual(8);
    expect(kinds.some((t) => t.text.includes("step-free entry"))).toBe(true);
    expect(kinds.some((t) => t.text.includes("single-use plastic"))).toBe(true);
  });

  it("never names rupee amounts", () => {
    for (const eventType of EVENT_TYPES)
      expect(JSON.stringify(templatePlan(sampleInput({ eventType })))).not.toMatch(
        /₹|\bRs\.?\s?\d/,
      );
  });
});

describe("template helpers", () => {
  it("reads ages from the brief", () => {
    expect(ageFrom(sampleInput({ title: "Turning 40!", vibe: "" }))).toBe(40);
    expect(ageFrom(sampleInput({ title: "", vibe: "her 1st birthday" }))).toBe(1);
    expect(ageFrom(sampleInput({ title: "", vibe: "he is 5 years old", constraints: [] }))).toBe(5);
    expect(ageFrom(sampleInput({ title: "", vibe: "no age here", constraints: [] }))).toBeNull();
    expect(ageFrom(sampleInput({ title: "", vibe: "turning 500", constraints: [] }))).toBeNull();
  });

  it("detects kids' parties", () => {
    expect(isKidsParty(sampleInput({ title: "", vibe: "my son's party", constraints: [] }))).toBe(
      true,
    );
    expect(isKidsParty(sampleInput({ title: "", vibe: "turning 30", constraints: [] }))).toBe(
      false,
    );
  });

  it("formats ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "101st",
      "111th",
    ]);
  });

  it("finds festivals", () => {
    expect(festivalFrom(sampleInput({ vibe: "durga puja pandal", constraints: [] }))).toBe(
      "Durga Puja",
    );
    expect(festivalFrom(sampleInput({ vibe: "", title: "", constraints: [] }))).toBeNull();
  });
});
