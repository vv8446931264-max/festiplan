"use client";

import { useEffect, useRef, useState } from "react";
import { findVendors } from "@/lib/client/api";
import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import type { BudgetCategory, VendorResult } from "@/lib/contracts";
import { Heading } from "./Heading";

type Props = { planId: string; category: BudgetCategory; city: string };
type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; result: VendorResult; takeFocus: boolean }
  | { kind: "error"; message: string };

/** True while keyboard focus is on `element` or nowhere at all, so moving it on surprises no one. */
function focusIsOn(element: HTMLElement | null): boolean {
  if (!element) return false;
  const active = element.ownerDocument.activeElement;
  return active === element || active === null || active === element.ownerDocument.body;
}

/**
 * "Find real vendors" — places come only from Grounding with Google Maps. While searching,
 * the button stays focusable (aria-disabled) and ignores presses; when the results replace
 * it, focus moves to their heading if it was still on the button.
 */
export function VendorFinder({ planId, category, city }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const button = useRef<HTMLButtonElement>(null);
  const label = CATEGORY_LABELS[category].toLowerCase();
  const busy = state.kind === "busy";

  async function search() {
    if (busy) return;
    setState({ kind: "busy" });
    const response = await findVendors({ planId, category });
    if (!response.ok) {
      setState({ kind: "error", message: response.error });
      return;
    }
    setState({ kind: "done", result: response, takeFocus: focusIsOn(button.current) });
  }

  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
      {state.kind !== "done" && (
        <button
          ref={button}
          type="button"
          onClick={() => void search()}
          aria-disabled={busy}
          className="btn btn-ghost no-print self-start text-sm aria-disabled:cursor-not-allowed aria-disabled:opacity-55"
        >
          {busy ? "Searching Google Maps…" : `Find real ${label} in ${city}`}
        </button>
      )}
      <div aria-live="polite">
        {state.kind === "error" && <p className="text-sm text-ember-bright">{state.message}</p>}
        {state.kind === "done" && (
          <Results result={state.result} label={label} city={city} takeFocus={state.takeFocus} />
        )}
      </div>
    </div>
  );
}

type ResultsProps = { result: VendorResult; label: string; city: string; takeFocus: boolean };

/** The grounded places under a heading that receives focus in place of the vanished button. */
function Results({ result, label, city, takeFocus }: ResultsProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (takeFocus) heading.current?.focus();
  }, [takeFocus]);
  return (
    <div className="flex flex-col gap-2">
      <Heading depth={3} ref={heading} tabIndex={-1} className="eyebrow">
        From Google Maps
        <span className="sr-only">
          : {label} in {city}
        </span>
      </Heading>
      {result.places.length === 0 ? (
        <p className="text-sm">
          No grounded matches this time.{" "}
          <a href={result.searchUrl} target="_blank" rel="noopener noreferrer">
            Search {label} in {city} on Google Maps{" "}
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </p>
      ) : (
        <PlaceList result={result} label={label} />
      )}
    </div>
  );
}

function PlaceList({ result, label }: { result: VendorResult; label: string }) {
  return (
    <>
      <ul className="flex flex-col gap-1">
        {result.places.map((place) => (
          <li key={place.uri}>
            <a
              href={place.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center font-semibold"
            >
              {place.title} <span className="sr-only">on Google Maps (opens in a new tab)</span>
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
    </>
  );
}
