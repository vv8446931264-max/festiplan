"use client";

import { forwardRef } from "react";
import { FIELD_ORDER, type FieldErrors, type FieldName } from "./form-model";

type Props = { errors: FieldErrors; serverError: string | null };

const target = (field: FieldName) => (field === "budget" ? "field-budget" : `field-${field}`);

/**
 * Error summary shown above the form after a failed submit. It receives focus so
 * screen-reader users hear what went wrong; each item links to its field.
 */
export const ErrorSummary = forwardRef<HTMLDivElement, Props>(function ErrorSummary(
  { errors, serverError },
  ref,
) {
  const fields = FIELD_ORDER.filter((f) => errors[f]);
  if (fields.length === 0 && !serverError) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-3xl border-2 border-ember-bright bg-espresso p-5"
    >
      <h3 id="error-summary-title" className="text-lg font-bold">
        {fields.length ? "There's a problem with the brief" : "We couldn't make the plan"}
      </h3>
      {serverError && <p className="mt-2 text-cream">{serverError}</p>}
      {fields.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {fields.map((f) => (
            <li key={f}>
              <a
                href={`#${target(f)}`}
                className="font-semibold"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(target(f))?.focus();
                }}
              >
                {errors[f]}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
