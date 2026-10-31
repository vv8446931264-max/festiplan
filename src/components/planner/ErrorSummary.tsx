"use client";

import type { MouseEvent, Ref } from "react";
import { FIELD_ORDER, type FieldErrors, type FieldName } from "./form-model";

type Props = { errors: FieldErrors; serverError: string | null; ref?: Ref<HTMLDivElement> };

/** Every form control (and the event-type fieldset) has the id `field-<name>`. */
const fieldId = (field: FieldName) => `field-${field}`;

function focusField(event: MouseEvent<HTMLAnchorElement>, field: FieldName): void {
  event.preventDefault();
  document.getElementById(fieldId(field))?.focus();
}

/**
 * Error summary shown above the form after a failed submit. It receives focus so
 * screen-reader users hear what went wrong; each item links to its field.
 */
export function ErrorSummary({ errors, serverError, ref }: Props) {
  const invalidFields = FIELD_ORDER.filter((field) => errors[field]);
  if (invalidFields.length === 0 && !serverError) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-3xl border-2 border-ember-bright bg-espresso p-5"
    >
      <h3 id="error-summary-title" className="text-lg font-bold">
        {invalidFields.length > 0
          ? "There's a problem with the brief"
          : "We couldn't make the plan"}
      </h3>
      {serverError && <p className="mt-2 text-cream">{serverError}</p>}
      {invalidFields.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {invalidFields.map((field) => (
            <li key={field}>
              <a
                href={`#${fieldId(field)}`}
                className="font-semibold"
                onClick={(event) => focusField(event, field)}
              >
                {errors[field]}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
