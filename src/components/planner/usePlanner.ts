"use client";

import { useState, type RefObject } from "react";
import { useToday } from "@/lib/client/browser";
import { createPlan } from "@/lib/client/api";
import { saveEditKey } from "@/lib/client/edit-keys";
import type { PublicPlan } from "@/lib/contracts";
import { PRESETS, presetInput } from "@/lib/presets";
import { todayIST } from "@/lib/time";
import { celebrate, setMood, setPalette } from "@/three/bus";
import {
  EMPTY_FORM, fromPlanInput, issuesToErrors, toPlanInput, validateForm,
  type FieldErrors, type FormValues,
} from "./form-model";

export type PresetId = (typeof PRESETS)[number]["id"];
type Result = { plan: PublicPlan; editKey: string };

/** Form values, field errors and focus on the error summary. */
function useBrief(summaryRef: RefObject<HTMLDivElement | null>) {
  const today = useToday();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const report = (fieldErrors: FieldErrors, message: string | null) => {
    setErrors(fieldErrors);
    setServerError(message);
    if (Object.keys(fieldErrors).length || message) requestAnimationFrame(() => summaryRef.current?.focus());
  };
  const update = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));
  return { today, values, setValues, errors, serverError, report, update };
}

/** Returns the backdrop to its resting state. */
function resetScene() {
  setMood("hero");
  setPalette(null);
}

/** State machine for the planner: idle → busy → result, with validation and errors. */
export function usePlanner(summaryRef: RefObject<HTMLDivElement | null>) {
  const brief = useBrief(summaryRef);
  const now = () => brief.today || todayIST();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(v: FormValues) {
    const found = validateForm(v, now());
    brief.report(found, null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setMood("focus");
    const res = await createPlan(toPlanInput(v));
    setBusy(false);
    if (!res.ok) {
      resetScene();
      return brief.report(res.issues ? issuesToErrors(res.issues) : {}, res.error);
    }
    saveEditKey(res.plan.id, res.editKey);
    // The plan's own URL survives a refresh; the edit key stays in this browser only.
    window.history.replaceState(null, "", `/plan/${res.plan.id}`);
    setResult({ plan: res.plan, editKey: res.editKey });
    setPalette(res.plan.ai.ideas[0]?.palette ?? null);
    setMood("plan");
    celebrate();
  }

  function pickPreset(id: PresetId) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const v = fromPlanInput(presetInput(preset, now()));
    brief.setValues(v);
    void submit(v);
  }

  const reset = () => {
    setResult(null);
    resetScene();
    window.history.replaceState(null, "", "/#plan");
    requestAnimationFrame(() => document.getElementById("brief-title")?.focus());
  };

  return { ...brief, busy, result, submit, pickPreset, reset };
}
