"use client";

import { PRESETS } from "@/lib/presets";

type Props = {
  disabled: boolean;
  onPick: (id: (typeof PRESETS)[number]["id"]) => void;
};

/** One-tap demo briefs: each fills the form and starts planning immediately. */
export function PresetChips({ disabled, onPick }: Props) {
  return (
    <div role="group" aria-labelledby="presets-label">
      <p id="presets-label" className="eyebrow mb-3">
        In a hurry? Try a real brief
      </p>
      <ul className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(p.id)}
              className="btn btn-ghost min-h-11 px-4 py-2 text-left text-sm font-semibold hover:bg-brown"
            >
              <span aria-hidden="true" className="text-gold">
                ✦
              </span>
              {p.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
