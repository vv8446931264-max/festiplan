import { memo } from "react";
import type { Tip, TipKind } from "@/lib/contracts";
import { Heading } from "./Heading";

const KIND_LABELS: Record<TipKind, string> = {
  sustainability: "Lighter on the planet",
  accessibility: "Everyone gets in",
  culture: "Tradition, done right",
  savings: "Money stays put",
};

/** Practical tips grouped by kind. */
export const TipsSection = memo(function TipsSection({
  tips,
  lang,
}: {
  tips: Tip[];
  lang?: string;
}) {
  return (
    <section aria-labelledby="tips-title" className="reveal">
      <Heading depth={2} id="tips-title" className="eyebrow mb-6 border-t border-line pt-6">
        Small things that matter
      </Heading>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tips.map((tip, i) => (
          <li key={i} className="panel flex flex-col gap-2 p-5">
            <span className="eyebrow text-gold">{KIND_LABELS[tip.kind]}</span>
            <span lang={lang}>{tip.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
});
