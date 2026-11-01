import type { ReactNode } from "react";
import { Heading } from "./Heading";

type Props = { id: string; number: string; kicker: string; title: ReactNode; children?: ReactNode };

/**
 * Editorial chapter heading: mono kicker, big headline, optional lead. The headline is one
 * level below the plan title (h2 on the share page, h3 inside the landing page).
 */
export function SectionHead({ id, number, kicker, title, children }: Props) {
  return (
    <div className="legible mb-8 grid gap-4 border-t border-line pt-6 lg:grid-cols-[1fr_2fr] lg:gap-10">
      <p className="eyebrow">
        Nº {number} — {kicker}
      </p>
      <div className="flex flex-col gap-4">
        <Heading depth={1} id={`${id}-title`} className="h2">
          {title}
        </Heading>
        {children && <div className="lead max-w-3xl text-muted">{children}</div>}
      </div>
    </div>
  );
}

/**
 * The `lang` for AI-written text: the plan language for Gemini plans, undefined for
 * English. Template plans are always English whatever language was requested.
 */
export function aiLang(plan: {
  source: "gemini" | "template";
  input: { language: string };
}): string | undefined {
  return plan.source === "template" || plan.input.language === "en"
    ? undefined
    : plan.input.language;
}
