import type { ReactNode } from "react";

type Props = { id: string; number: string; kicker: string; title: ReactNode; children?: ReactNode };

/** Editorial chapter heading: mono kicker, big headline, optional lead. */
export function SectionHead({ id, number, kicker, title, children }: Props) {
  return (
    <div className="mb-8 grid gap-4 border-t border-line pt-6 lg:grid-cols-[1fr_2fr] lg:gap-10">
      <p className="eyebrow">
        Nº {number} — {kicker}
      </p>
      <div className="flex flex-col gap-4">
        <h3 id={`${id}-title`} className="h2">
          {title}
        </h3>
        {children && <div className="lead max-w-3xl text-muted">{children}</div>}
      </div>
    </div>
  );
}
