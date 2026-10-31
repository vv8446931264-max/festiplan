"use client";

import { LANGS, LANG_LABELS, LIMITS } from "@/lib/contracts/constants";
import type { Lang } from "@/lib/contracts";
import { formatINR, formatINRCompact } from "@/lib/engine";
import { CONSTRAINT_OPTIONS } from "@/lib/presets";
import { Field } from "./Field";
import { parseWhole, type FieldErrors, type FormValues } from "./form-model";

export type FieldsProps = {
  values: FormValues;
  errors: FieldErrors;
  onChange: (patch: Partial<FormValues>) => void;
};

/** Date, city, guests and budget — the four numbers everything else hangs on. */
export function BasicsFields({
  values,
  errors,
  onChange,
  minDate,
  maxDate,
}: FieldsProps & { minDate?: string; maxDate?: string }) {
  const budget = parseWhole(values.budget);
  const budgetHint =
    Number.isFinite(budget) && budget > 0
      ? `${formatINR(budget)} · ${formatINRCompact(budget)}`
      : "Whole rupees — 10% is held back as contingency.";
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <Field id="field-eventDate" label="Date" error={errors.eventDate}>
        {(d) => (
          <input
            id="field-eventDate"
            type="date"
            className="field"
            min={minDate}
            max={maxDate}
            required
            value={values.eventDate}
            aria-invalid={!!errors.eventDate}
            aria-describedby={d}
            onChange={(e) => onChange({ eventDate: e.target.value })}
          />
        )}
      </Field>
      <Field id="field-city" label="City" error={errors.city}>
        {(d) => (
          <input
            id="field-city"
            className="field"
            autoComplete="address-level2"
            maxLength={LIMITS.cityMax}
            required
            value={values.city}
            aria-invalid={!!errors.city}
            aria-describedby={d}
            placeholder="Jaipur"
            onChange={(e) => onChange({ city: e.target.value })}
          />
        )}
      </Field>
      <Field id="field-guests" label="Guests" error={errors.guests}>
        {(d) => (
          <input
            id="field-guests"
            className="field tabular"
            inputMode="numeric"
            required
            placeholder="180"
            value={values.guests}
            aria-invalid={!!errors.guests}
            aria-describedby={d}
            onChange={(e) => onChange({ guests: e.target.value })}
          />
        )}
      </Field>
      <Field id="field-budget" label="Budget (₹)" hint={budgetHint} error={errors.budget}>
        {(d) => (
          <input
            id="field-budget"
            className="field tabular"
            inputMode="numeric"
            required
            placeholder="12,00,000"
            value={values.budget}
            aria-invalid={!!errors.budget}
            aria-describedby={d}
            onChange={(e) => onChange({ budget: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}

/** Optional name plus the free-text vibe. */
export function StoryFields({ values, errors, onChange }: FieldsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <Field id="field-title" label="Name it (optional)" error={errors.title}>
        {(d) => (
          <input
            id="field-title"
            className="field"
            maxLength={LIMITS.titleMax}
            placeholder="Riya's sangeet"
            value={values.title}
            aria-invalid={!!errors.title}
            aria-describedby={d}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        )}
      </Field>
      <Field
        id="field-vibe"
        label="The vibe"
        error={errors.vibe}
        hint={`Themes, traditions, must-haves. ${values.vibe.length}/${LIMITS.vibeMax} characters.`}
      >
        {(d) => (
          <textarea
            id="field-vibe"
            className="field min-h-28 resize-y"
            maxLength={LIMITS.vibeMax}
            value={values.vibe}
            aria-invalid={!!errors.vibe}
            aria-describedby={d}
            placeholder="Rajasthani folk meets Bollywood, marigolds, a family dance-off…"
            onChange={(e) => onChange({ vibe: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}

/** Constraint toggles and the output language. */
export function PreferenceFields({ values, onChange }: FieldsProps) {
  const toggle = (tag: string) =>
    onChange({
      constraints: values.constraints.includes(tag)
        ? values.constraints.filter((t) => t !== tag)
        : [...values.constraints, tag],
    });
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <fieldset className="min-w-0">
        <legend className="mb-3 font-semibold">Constraints</legend>
        <div className="flex flex-wrap gap-2">
          {CONSTRAINT_OPTIONS.map((tag) => (
            <label
              key={tag}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm transition-colors hover:border-cream has-[:checked]:border-gold has-[:checked]:bg-brown"
            >
              <input
                type="checkbox"
                className="size-6 shrink-0"
                checked={values.constraints.includes(tag)}
                onChange={() => toggle(tag)}
              />
              {tag}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="field-language" label="Plan language">
        {() => (
          <select
            id="field-language"
            className="field"
            value={values.language}
            onChange={(e) => onChange({ language: e.target.value as Lang })}
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_LABELS[l]}
              </option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
}
