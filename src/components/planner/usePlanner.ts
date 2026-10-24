"use client";

import { useEffect, useRef, useState } from "react";
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

/** Form values, field errors and the focusable error summary. */
function useBrief() {
  const [today, setToday] = useState("");
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => setToday(todayIST()), []);

  const report = (fieldErrors: FieldErrors, message: string | null) => {
    setErrors(fieldErrors);
    setServerError(message);
    if (Object.keys(fieldErrors).length || message) requestAnimationFrame(() => summaryRef.current?.focus());
  };
  const update = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));
  return { today: today || todayIST(), values, setValues, errors, serverError, summaryRef, report, update };
}

/** State machine for the planner: idle → busy → result, with validation and errors. */
export function usePlanner() {
  const brief = useBrief();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(v: FormValues) {
    const found = validateForm(v, brief.today);
    brief.report(found, null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setMood("focus");
    const res = await createPlan(toPlanInput(v));
    setBusy(false);
    if (!res.ok) {
      setMood("hero");
      return brief.report(res.issues ? issuesToErrors(res.issues) : {}, res.error);
    }
    saveEditKey(res.plan.id, res.editKey);
    setResult({ plan: res.plan, editKey: res.editKey });
    setPalette(res.plan.ai.ideas[0]?.palette ?? null);
    setMood("plan");
    celebrate();
  }

  function pickPreset(id: PresetId) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const v = fromPlanInput(presetInput(preset, brief.today));
    brief.setValues(v);
    void submit(v);
  }

  function reset() {
    setResult(null);
    setMood("hero");
    setPalette(null);
  }

  return { ...brief, busy, result, submit, pickPreset, reset };
}
