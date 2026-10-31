"use client";

import { useState } from "react";
import { findVendors } from "@/lib/client/api";
import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import type { BudgetCategory, VendorResult } from "@/lib/contracts";

type Props = { planId: string; category: BudgetCategory; city: string };
type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; result: VendorResult }
  | { kind: "error"; message: string };

/** "Find real vendors" — places come only from Grounding with Google Maps. */
export function VendorFinder({ planId, category, city }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const label = CATEGORY_LABELS[category].toLowerCase();

  async function search() {
    setState({ kind: "busy" });
    const res = await findVendors({ planId, category });
    setState(res.ok ? { kind: "done", result: res } : { kind: "error", message: res.error });
  }

  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
      {state.kind !== "done" && (
        <button
          type="button"
          onClick={() => void search()}
          disabled={state.kind === "busy"}
          className="btn btn-ghost no-print self-start text-sm"
        >
          {state.kind === "busy" ? "Searching Google Maps…" : `Find real ${label} in ${city}`}
        </button>
      )}
      <div aria-live="polite">
        {state.kind === "error" && <p className="text-sm text-ember-bright">{state.message}</p>}
        {state.kind === "done" && <Results result={state.result} label={label} city={city} />}
      </div>
    </div>
  );
}

function Results({ result, label, city }: { result: VendorResult; label: string; city: string }) {
  if (result.places.length === 0) {
    return (
      <p className="text-sm">
        No grounded matches this time.{" "}
        <a href={result.searchUrl} target="_blank" rel="noopener noreferrer">
          Search {label} in {city} on Google Maps{" "}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">From Google Maps</p>
      <ul className="flex flex-col gap-1">
        {result.places.map((p) => (
          <li key={p.uri}>
            <a
              href={p.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center font-semibold"
            >
              {p.title} <span className="sr-only">on Google Maps (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <a
        href={result.searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-8 items-center self-start text-sm"
      >
        More {label} on Google Maps <span className="sr-only">(opens in a new tab)</span>
      </a>
    </div>
  );
}
