"use client";

import { useState, type RefObject } from "react";
import { useToday } from "@/lib/client/browser";
import { createPlan } from "@/lib/client/api";
import { saveEditKey } from "@/lib/client/edit-keys";
import type { CreatedPlan } from "@/lib/contracts";
import { PRESETS, presetInput } from "@/lib/presets";
import { todayIST } from "@/lib/time";
import { celebrate, setMood, setPalette } from "@/three/bus";
import {
  EMPTY_FORM,
  fromPlanInput,
  issuesToErrors,
  toPlanInput,
  validateForm,
  type FieldErrors,
  type FormValues,
} from "./form-model";

/** Id of one of the one-tap demo briefs. */
export type PresetId = (typeof PRESETS)[number]["id"];

/** Form values, field errors and focus on the error summary. */
function useBrief(summaryRef: RefObject<HTMLDivElement | null>) {
  const today = useToday();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const report = (fieldErrors: FieldErrors, message: string | null) => {
    setErrors(fieldErrors);
    setServerError(message);
    const hasProblems = Object.keys(fieldErrors).length > 0 || message !== null;
    if (hasProblems) requestAnimationFrame(() => summaryRef.current?.focus());
  };
  const update = (patch: Partial<FormValues>) => setValues((current) => ({ ...current, ...patch }));
  return { today, values, setValues, errors, serverError, report, update };
}

/** Returns the backdrop to its resting state. */
function resetScene() {
  setMood("hero");
  setPalette(null);
}

/**
 * Side effects of a new plan: remember the edit key in this browser, give the plan its
 * own URL (so a refresh keeps it), tint the sky with the first palette and celebrate.
 */
function unfold({ plan, editKey }: CreatedPlan) {
  saveEditKey(plan.id, editKey);
  window.history.replaceState(null, "", `/plan/${plan.id}`);
  setPalette(plan.ai.ideas[0]?.palette ?? null);
  setMood("plan");
  celebrate();
}

/** Back to the brief: reset the scene and URL and move focus to the brief heading. */
function backToBrief() {
  resetScene();
  window.history.replaceState(null, "", "/#plan");
  requestAnimationFrame(() => document.getElementById("brief-title")?.focus());
}

/** State machine for the planner: idle → busy → result, with validation and errors. */
export function usePlanner(summaryRef: RefObject<HTMLDivElement | null>) {
  const brief = useBrief(summaryRef);
  // Before hydration has read the browser's date, fall back to today in India.
  const currentDay = () => brief.today || todayIST();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreatedPlan | null>(null);

  async function submit(values: FormValues) {
    const fieldErrors = validateForm(values, currentDay());
    brief.report(fieldErrors, null);
    if (Object.keys(fieldErrors).length > 0) return;
    setBusy(true);
    setMood("focus");
    const response = await createPlan(toPlanInput(values));
    setBusy(false);
    if (!response.ok) {
      resetScene();
      brief.report(response.issues ? issuesToErrors(response.issues) : {}, response.error);
      return;
    }
    const created = { plan: response.plan, editKey: response.editKey };
    unfold(created);
    setResult(created);
  }

  function pickPreset(id: PresetId) {
    const preset = PRESETS.find((candidate) => candidate.id === id);
    if (!preset) return;
    const values = fromPlanInput(presetInput(preset, currentDay()));
    brief.setValues(values);
    void submit(values);
  }

  const reset = () => {
    setResult(null);
    backToBrief();
  };

  return { ...brief, busy, result, submit, pickPreset, reset };
}
