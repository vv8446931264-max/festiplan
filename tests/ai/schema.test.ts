// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AI_PLAN_JSON_SCHEMA } from "@/lib/ai/schema";
import { BUDGET_CATEGORIES, TASK_CATEGORIES, TIP_KINDS } from "@/lib/contracts";

type Node = {
  type?: string;
  enum?: string[];
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  required?: string[];
  properties?: Record<string, Node>;
  items?: Node;
};

const root = AI_PLAN_JSON_SCHEMA as unknown as Node;
const prop = (node: Node | undefined, key: string): Node => {
  const child = node?.properties?.[key];
  if (!child) throw new Error(`missing ${key}`);
  return child;
};

describe("AI_PLAN_JSON_SCHEMA", () => {
  it("requires every top-level AiPlan field", () => {
    expect(root.type).toBe("object");
    expect(root.required).toEqual(["summary", "ideas", "budgetWeights", "tasks", "vendors", "tips"]);
  });

  it("mirrors array bounds from AiPlanSchema", () => {
    expect(prop(root, "ideas")).toMatchObject({ minItems: 3, maxItems: 3 });
    expect(prop(root, "tasks")).toMatchObject({ minItems: 12, maxItems: 30 });
    expect(prop(root, "budgetWeights")).toMatchObject({ minItems: 4, maxItems: BUDGET_CATEGORIES.length });
    expect(prop(root, "vendors")).toMatchObject({ minItems: 3, maxItems: BUDGET_CATEGORIES.length });
    expect(prop(root, "tips")).toMatchObject({ minItems: 2, maxItems: 8 });
    expect(prop(prop(root, "ideas").items, "palette")).toMatchObject({ minItems: 3, maxItems: 5 });
    expect(prop(prop(root, "tasks").items, "dependsOn")).toMatchObject({ minItems: 0, maxItems: 5 });
  });

  it("uses the shared category and tip vocabularies as enums", () => {
    expect(prop(prop(root, "budgetWeights").items, "category").enum).toEqual([...BUDGET_CATEGORIES]);
    expect(prop(prop(root, "tasks").items, "category").enum).toEqual([...TASK_CATEGORIES]);
    expect(prop(prop(root, "vendors").items, "category").enum).toEqual([...BUDGET_CATEGORIES]);
    expect(prop(prop(root, "tips").items, "kind").enum).toEqual([...TIP_KINDS]);
  });

  it("bounds weights and lead times as integers", () => {
    expect(prop(prop(root, "budgetWeights").items, "weight")).toMatchObject({ type: "integer", minimum: 1, maximum: 100 });
    expect(prop(prop(root, "tasks").items, "leadWeeks")).toMatchObject({ minimum: 0, maximum: 156 });
    expect(prop(prop(root, "tasks").items, "durationDays")).toMatchObject({ minimum: 1, maximum: 90 });
    expect(prop(prop(root, "vendors").items, "bookByWeeks")).toMatchObject({ minimum: 0, maximum: 104 });
  });
});
