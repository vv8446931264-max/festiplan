import type { InputHTMLAttributes, ReactNode } from "react";

type Props = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (describedBy: string | undefined) => ReactNode;
};

/** Label + hint + inline error wrapper; passes the right aria-describedby to its control. */
export function Field({ id, label, hint, error, className = "", children }: Props) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-ember-bright">
          {error}
        </p>
      )}
      {children(describedBy)}
    </div>
  );
}

/** Native input attributes a {@link TextField} passes through (type, limits, hints). */
type InputAttributes = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange" | "className" | "aria-invalid" | "aria-describedby"
>;

type TextFieldProps = InputAttributes & {
  id: string;
  label: string;
  value: string;
  onValue: (value: string) => void;
  hint?: ReactNode;
  error?: string;
  /** Use tabular figures (numeric fields). */
  numeric?: boolean;
};

/** A labelled single-line input wired to its hint and error; `onValue` gets the raw text. */
export function TextField({
  id,
  label,
  value,
  onValue,
  hint,
  error,
  numeric = false,
  ...inputAttributes
}: TextFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <input
          {...inputAttributes}
          id={id}
          className={numeric ? "field tabular" : "field"}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onValue(event.target.value)}
        />
      )}
    </Field>
  );
}
