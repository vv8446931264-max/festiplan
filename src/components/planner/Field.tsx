import type { ReactNode } from "react";

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
