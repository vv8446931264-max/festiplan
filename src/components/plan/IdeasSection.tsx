"use client";

import { memo, useState } from "react";
import type { Idea } from "@/lib/contracts";
import { setPalette } from "@/three/bus";
import { SectionHead } from "./SectionHead";

type Props = { ideas: Idea[]; lang?: string };

/** Three concepts laid out as magazine covers, each with its palette and menu. */
export const IdeasSection = memo(function IdeasSection({ ideas, lang }: Props) {
  const [tinted, setTinted] = useState<number | null>(0);
  const toggleTint = (index: number) => {
    const next = tinted === index ? null : index;
    setTinted(next);
    setPalette(next === null ? null : (ideas[next]?.palette ?? null));
  };
  return (
    <section id="ideas" aria-labelledby="ideas-title" className="scroll-mt-20">
      <SectionHead
        id="ideas"
        number="01"
        kicker="Ideas"
        title={
          <>
            Three ways to <span className="accent">throw it</span>.
          </>
        }
      >
        Each concept is shaped by your vibe, city and constraints. Pick one, mix them, or ask for
        more below.
      </SectionHead>
      <ol className="grid gap-5 lg:grid-cols-3">
        {ideas.map((idea, index) => (
          <li key={index} className="reveal">
            <IdeaCover
              idea={idea}
              issue={index + 1}
              lang={lang}
              tinted={tinted === index}
              onTint={() => toggleTint(index)}
            />
          </li>
        ))}
      </ol>
    </section>
  );
});

type CoverProps = { idea: Idea; issue: number; lang?: string; tinted: boolean; onTint: () => void };

function IdeaCover({ idea, issue, lang, tinted, onTint }: CoverProps) {
  const band = `linear-gradient(120deg, ${idea.palette.join(", ")})`;
  return (
    <article className="panel flex h-full flex-col overflow-hidden">
      <div
        aria-hidden="true"
        data-print-keep=""
        className="h-28 sm:h-36"
        style={{ background: band }}
      />
      <div className="flex flex-1 flex-col gap-5 p-6 sm:p-7">
        <p className="eyebrow">Issue Nº 0{issue}</p>
        <h4 lang={lang} className="h3">
          {idea.name}
        </h4>
        <p lang={lang} className="text-cream/90">
          {idea.concept}
        </p>
        <PaletteSwatches palette={idea.palette} />
        <BulletList title="Décor" items={idea.decor} lang={lang} />
        <BulletList title="On the menu" items={idea.food} lang={lang} />
        <div>
          <p className="eyebrow mb-1">Music</p>
          <p lang={lang}>{idea.music}</p>
        </div>
        <blockquote
          lang={lang}
          className="accent mt-auto border-l-2 border-gold pl-4 text-lg text-gold"
        >
          {idea.signatureMoment}
        </blockquote>
        <TintButton pressed={tinted} onToggle={onTint} />
      </div>
    </article>
  );
}

/** Each palette colour as a swatch beside its hex code, so it reads without colour vision. */
function PaletteSwatches({ palette }: { palette: string[] }) {
  return (
    <ul aria-label="Palette" className="flex flex-wrap gap-2">
      {palette.map((hex, index) => (
        <li
          key={index}
          className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 font-mono text-xs uppercase"
        >
          <span
            aria-hidden="true"
            data-print-keep=""
            className="size-6 rounded-full border border-cream/30"
            style={{ background: hex }}
          />
          {hex}
        </li>
      ))}
    </ul>
  );
}

/** Toggles this concept's palette onto the lantern sky behind the page. */
function TintButton({ pressed, onToggle }: { pressed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className="btn btn-ghost no-print self-start text-sm aria-pressed:border-gold aria-pressed:text-gold"
    >
      <span aria-hidden="true">{pressed ? "●" : "○"}</span>
      Tint the lanterns
    </button>
  );
}

function BulletList({ title, items, lang }: { title: string; items: string[]; lang?: string }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul lang={lang} className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span aria-hidden="true" className="text-gold">
              ✦
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
