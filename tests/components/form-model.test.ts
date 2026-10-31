// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EMPTY_FORM,
  fromPlanInput,
  issuesToErrors,
  parseWhole,
  toPlanInput,
  toggleConstraint,
  validateForm,
  type FormValues,
} from "@/components/planner/form-model";
import { PlanInputSchema } from "@/lib/contracts";
import { PRESETS, presetInput } from "@/lib/presets";

const TODAY = "2026-10-24";
const valid: FormValues = {
  ...EMPTY_FORM,
  eventType: "wedding",
  eventDate: "2027-02-14",
  city: "Jaipur",
  guests: "180",
  budget: "12,00,000",
  vibe: "Marigolds",
};

describe("parseWhole", () => {
  it("accepts Indian grouping, rupee sign and spaces", () => {
    expect(parseWhole("₹12,00,000")).toBe(1_200_000);
    expect(parseWhole(" 40 000 ")).toBe(40_000);
  });
  it("rejects decimals, negatives and words", () => {
    expect(parseWhole("12.5")).toBeNaN();
    expect(parseWhole("-5")).toBeNaN();
    expect(parseWhole("lots")).toBeNaN();
    expect(parseWhole("")).toBeNaN();
  });
});

describe("validateForm", () => {
  it("passes a complete brief", () => {
    expect(validateForm(valid, TODAY)).toEqual({});
  });
  it("explains every missing required field in plain language", () => {
    const errors = validateForm(EMPTY_FORM, TODAY);
    expect(Object.keys(errors).sort()).toEqual([
      "budget",
      "city",
      "eventDate",
      "eventType",
      "guests",
    ]);
    expect(errors.eventType).toMatch(/celebrating/);
  });
  it("rejects past dates and dates beyond three years", () => {
    expect(validateForm({ ...valid, eventDate: TODAY }, TODAY).eventDate).toMatch(/tomorrow/);
    expect(validateForm({ ...valid, eventDate: "2030-01-01" }, TODAY).eventDate).toMatch(/3 years/);
  });
  it("enforces guest and budget ranges", () => {
    expect(validateForm({ ...valid, guests: "0" }, TODAY).guests).toMatch(/between 1 and 5,000/);
    expect(validateForm({ ...valid, budget: "999" }, TODAY).budget).toMatch(/1,000/);
  });
  it("limits title and vibe length", () => {
    expect(validateForm({ ...valid, title: "x".repeat(81) }, TODAY).title).toBeDefined();
    expect(validateForm({ ...valid, vibe: "x".repeat(601) }, TODAY).vibe).toBeDefined();
  });
});

describe("toPlanInput / fromPlanInput", () => {
  it("produces a body the server schema accepts", () => {
    expect(PlanInputSchema.safeParse(toPlanInput(valid)).success).toBe(true);
  });
  it("omits an empty title", () => {
    expect(toPlanInput(valid)).not.toHaveProperty("title");
  });
  it("round-trips every preset", () => {
    for (const preset of PRESETS) {
      const input = presetInput(preset, TODAY);
      expect(PlanInputSchema.safeParse(input).success).toBe(true);
      expect(toPlanInput(fromPlanInput(input))).toEqual(input);
      expect(validateForm(fromPlanInput(input), TODAY)).toEqual({});
    }
  });
});

describe("toggleConstraint", () => {
  it("adds an unselected tag at the end and removes a selected one", () => {
    expect(toggleConstraint(["Vegetarian"], "No alcohol")).toEqual(["Vegetarian", "No alcohol"]);
    expect(toggleConstraint(["Vegetarian", "No alcohol"], "Vegetarian")).toEqual(["No alcohol"]);
  });
});

describe("issuesToErrors", () => {
  it("maps server issue paths onto form fields, first message wins", () => {
    const errors = issuesToErrors([
      { path: "budgetINR", message: "too big" },
      { path: "city", message: "short" },
      { path: "city", message: "second" },
      { path: "unknown", message: "ignored" },
    ]);
    expect(errors).toEqual({ budget: "too big", city: "short" });
  });
});
