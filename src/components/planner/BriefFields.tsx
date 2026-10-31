"use client";

import { LANGS, LANG_LABELS, LIMITS } from "@/lib/contracts/constants";
import type { Lang } from "@/lib/contracts";
import { formatINR, formatINRCompact } from "@/lib/engine";
import { CONSTRAINT_OPTIONS } from "@/lib/presets";
import { Field, TextField } from "./Field";
import { parseWhole, toggleConstraint, type FieldErrors, type FormValues } from "./form-model";

/** Props shared by every group of brief fields. */
export type FieldsProps = {
  values: FormValues;
  errors: FieldErrors;
  onChange: (patch: Partial<FormValues>) => void;
};

type BasicsProps = FieldsProps & { minDate?: string; maxDate?: string };

const CONSTRAINT_CHIP_CLASS =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm transition-colors hover:border-cream has-[:checked]:border-gold has-[:checked]:bg-brown";

/** Echoes a valid budget back in full and compact form, else explains the contingency. */
function budgetHint(rawBudget: string): string {
  const budget = parseWhole(rawBudget);
  return Number.isFinite(budget) && budget > 0
    ? `${formatINR(budget)} · ${formatINRCompact(budget)}`
    : "Whole rupees — 10% is held back as contingency.";
}

/** Date, city, guests and budget — the four numbers everything else hangs on. */
export function BasicsFields(props: BasicsProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <WhenAndWhereFields {...props} />
      <GuestsAndBudgetFields {...props} />
    </div>
  );
}

function WhenAndWhereFields({ values, errors, onChange, minDate, maxDate }: BasicsProps) {
  return (
    <>
      <TextField
        id="field-eventDate"
        label="Date"
        type="date"
        min={minDate}
        max={maxDate}
        required
        value={values.eventDate}
        error={errors.eventDate}
        onValue={(eventDate) => onChange({ eventDate })}
      />
      <TextField
        id="field-city"
        label="City"
        autoComplete="address-level2"
        maxLength={LIMITS.cityMax}
        required
        placeholder="Jaipur"
        value={values.city}
        error={errors.city}
        onValue={(city) => onChange({ city })}
      />
    </>
  );
}

function GuestsAndBudgetFields({ values, errors, onChange }: FieldsProps) {
  return (
    <>
      <TextField
        id="field-guests"
        label="Guests"
        numeric
        inputMode="numeric"
        required
        placeholder="180"
        value={values.guests}
        error={errors.guests}
        onValue={(guests) => onChange({ guests })}
      />
      <TextField
        id="field-budget"
        label="Budget (₹)"
        hint={budgetHint(values.budget)}
        numeric
        inputMode="numeric"
        required
        placeholder="12,00,000"
        value={values.budget}
        error={errors.budget}
        onValue={(budget) => onChange({ budget })}
      />
    </>
  );
}

/** Optional name plus the free-text vibe. */
export function StoryFields({ values, errors, onChange }: FieldsProps) {
  const vibeHint = `Themes, traditions, must-haves. ${values.vibe.length}/${LIMITS.vibeMax} characters.`;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <TextField
        id="field-title"
        label="Name it (optional)"
        maxLength={LIMITS.titleMax}
        placeholder="Riya's sangeet"
        value={values.title}
        error={errors.title}
        onValue={(title) => onChange({ title })}
      />
      <Field id="field-vibe" label="The vibe" error={errors.vibe} hint={vibeHint}>
        {(describedBy) => (
          <textarea
            id="field-vibe"
            className="field min-h-28 resize-y"
            maxLength={LIMITS.vibeMax}
            value={values.vibe}
            aria-invalid={Boolean(errors.vibe)}
            aria-describedby={describedBy}
            placeholder="Rajasthani folk meets Bollywood, marigolds, a family dance-off…"
            onChange={(event) => onChange({ vibe: event.target.value })}
          />
        )}
      </Field>
    </div>
  );
}

/** Constraint toggles and the output language. */
export function PreferenceFields({ values, onChange }: FieldsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <ConstraintToggles
        selected={values.constraints}
        onChange={(constraints) => onChange({ constraints })}
      />
      <LanguageSelect value={values.language} onChange={(language) => onChange({ language })} />
    </div>
  );
}

type ConstraintTogglesProps = {
  selected: readonly string[];
  onChange: (constraints: string[]) => void;
};

function ConstraintToggles({ selected, onChange }: ConstraintTogglesProps) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 font-semibold">Constraints</legend>
      <div className="flex flex-wrap gap-2">
        {CONSTRAINT_OPTIONS.map((tag) => (
          <label key={tag} className={CONSTRAINT_CHIP_CLASS}>
            <input
              type="checkbox"
              className="size-6 shrink-0"
              checked={selected.includes(tag)}
              onChange={() => onChange(toggleConstraint(selected, tag))}
            />
            {tag}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function LanguageSelect({ value, onChange }: { value: Lang; onChange: (language: Lang) => void }) {
  const select = (choice: string) => {
    const language = LANGS.find((lang) => lang === choice);
    if (language) onChange(language);
  };
  return (
    <Field id="field-language" label="Plan language">
      {() => (
        <select
          id="field-language"
          className="field"
          value={value}
          onChange={(event) => select(event.target.value)}
        >
          {LANGS.map((lang) => (
            <option key={lang} value={lang}>
              {LANG_LABELS[lang]}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
