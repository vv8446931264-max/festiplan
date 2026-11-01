"use client";

import { EVENT_TYPES, EVENT_TYPE_LABELS } from "@/lib/contracts/constants";
import type { EventType } from "@/lib/contracts";

type EventTypeOption = { value: EventType; label: string; note: string };

/** The line under each event type's name. */
const EVENT_TYPE_NOTES: Record<EventType, string> = {
  wedding: "Haldi to reception — every function, every family.",
  birthday: "Age-aware themes, cake, games and return gifts.",
  community: "Festivals, society melas, fundraisers, volunteers.",
  other: "Anniversaries, naming ceremonies, reunions.",
};

const EVENT_TYPE_OPTIONS: readonly EventTypeOption[] = EVENT_TYPES.map((value) => ({
  value,
  label: EVENT_TYPE_LABELS[value],
  note: EVENT_TYPE_NOTES[value],
}));

const CARD_CLASS =
  "group relative flex min-h-36 cursor-pointer flex-col justify-between rounded-3xl border border-line bg-espresso/70 p-4 transition-colors duration-200 hover:border-cream has-[:checked]:border-gold has-[:checked]:bg-brown has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-ember-bright sm:p-5";

type Props = {
  value: EventType | "";
  error?: string;
  onChange: (value: EventType) => void;
};

/** Oversized radio cards for the event type (a native radio group). */
export function EventTypePicker({ value, error, onChange }: Props) {
  return (
    <fieldset
      id="field-eventType"
      tabIndex={-1}
      aria-describedby={error ? "error-eventType" : undefined}
      className="min-w-0"
    >
      <legend className="eyebrow mb-4">What are we celebrating?</legend>
      {error && (
        <p id="error-eventType" className="mb-3 font-semibold text-ember-bright">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {EVENT_TYPE_OPTIONS.map((option, index) => (
          <TypeCard
            key={option.value}
            option={option}
            number={index + 1}
            checked={value === option.value}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  );
}

type CardProps = {
  option: EventTypeOption;
  /** 1-based position, shown as "Nº 01". */
  number: number;
  checked: boolean;
  onChange: Props["onChange"];
};

function TypeCard({ option, number, checked, onChange }: CardProps) {
  return (
    <label className={CARD_CLASS}>
      <input
        type="radio"
        name="eventType"
        value={option.value}
        checked={checked}
        onChange={() => onChange(option.value)}
        className="sr-only"
      />
      <span className="accent text-sm text-muted group-has-[:checked]:text-gold">Nº 0{number}</span>
      <span>
        <span className="block text-xl font-bold tracking-tight sm:text-2xl">{option.label}</span>
        <span className="mt-1 block text-sm leading-snug text-muted">{option.note}</span>
      </span>
      <span
        aria-hidden="true"
        className="absolute top-4 right-4 size-4 rounded-full border border-line group-has-[:checked]:border-gold group-has-[:checked]:bg-gold"
      />
    </label>
  );
}
