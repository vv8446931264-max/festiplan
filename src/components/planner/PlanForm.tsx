"use client";

import { EventTypePicker } from "./EventTypePicker";
import { BasicsFields, PreferenceFields, StoryFields, type FieldsProps } from "./BriefFields";

type Props = FieldsProps & {
  busy: boolean;
  minDate: string;
  maxDate: string;
  onSubmit: () => void;
};

/** The brief: event type, date, city, guests, budget, vibe, constraints, language. */
export function PlanForm({ busy, minDate, maxDate, onSubmit, ...fields }: Props) {
  return (
    <form
      noValidate
      aria-labelledby="brief-title"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-10"
    >
      <EventTypePicker
        value={fields.values.eventType}
        error={fields.errors.eventType}
        onChange={(eventType) => fields.onChange({ eventType })}
      />
      <BasicsFields {...fields} minDate={minDate} maxDate={maxDate} />
      <StoryFields {...fields} />
      <PreferenceFields {...fields} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary px-8 text-lg" disabled={busy}>
          {busy ? "Planning…" : "Plan my celebration"}
          <span aria-hidden="true">→</span>
        </button>
        <p className="text-sm text-muted">Gemini drafts the ideas. Arithmetic does the money.</p>
      </div>
    </form>
  );
}
