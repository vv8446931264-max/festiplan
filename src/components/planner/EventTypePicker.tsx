"use client";

import type { EventType } from "@/lib/contracts";

const OPTIONS: { value: EventType; label: string; note: string }[] = [
  {
    value: "wedding",
    label: "Wedding",
    note: "Haldi to reception — every function, every family.",
  },
  { value: "birthday", label: "Birthday", note: "Age-aware themes, cake, games and return gifts." },
  {
    value: "community",
    label: "Community",
    note: "Festivals, society melas, fundraisers, volunteers.",
  },
  { value: "other", label: "Something else", note: "Anniversaries, naming ceremonies, reunions." },
];

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
        {OPTIONS.map((o, i) => (
          <TypeCard
            key={o.value}
            option={o}
            index={i}
            checked={value === o.value}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  );
}

type CardProps = {
  option: (typeof OPTIONS)[number];
  index: number;
  checked: boolean;
  onChange: Props["onChange"];
};

function TypeCard({ option: o, index, checked, onChange }: CardProps) {
  return (
    <label className="group relative flex min-h-36 cursor-pointer flex-col justify-between rounded-3xl border border-line bg-espresso/70 p-4 transition-colors duration-200 hover:border-cream has-[:checked]:border-gold has-[:checked]:bg-brown has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-ember-bright sm:p-5">
      <input
        type="radio"
        name="eventType"
        value={o.value}
        checked={checked}
        onChange={() => onChange(o.value)}
        className="sr-only"
      />
      <span className="accent text-sm text-muted group-has-[:checked]:text-gold">
        Nº 0{index + 1}
      </span>
      <span>
        <span className="block text-xl font-bold tracking-tight sm:text-2xl">{o.label}</span>
        <span className="mt-1 block text-sm leading-snug text-muted">{o.note}</span>
      </span>
      <span
        aria-hidden="true"
        className="absolute top-4 right-4 size-4 rounded-full border border-line group-has-[:checked]:border-gold group-has-[:checked]:bg-gold"
      />
    </label>
  );
}
