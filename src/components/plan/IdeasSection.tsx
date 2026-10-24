"use client";

import { useState } from "react";
import type { Idea } from "@/lib/contracts";
import { setPalette } from "@/three/bus";
import { SectionHead } from "./SectionHead";

type Props = { ideas: Idea[]; lang?: string };

/** Three concepts laid out as magazine covers, each with its palette and menu. */
export function IdeasSection({ ideas, lang }: Props) {
  const [tinted, setTinted] = useState<number | null>(0);
  const tint = (i: number) => {
    const next = tinted === i ? null : i;
    setTinted(next);
    setPalette(next === null ? null : (ideas[next]?.palette ?? null));
  };
  return (
    <section id="ideas" aria-labelledby="ideas-title" className="scroll-mt-20">
      <SectionHead id="ideas" number="01" kicker="Ideas" title={<>Three ways to <span className="accent">throw it</span>.</>}>
        Each concept is shaped by your vibe, city and constraints. Pick one, mix them, or ask for more below.
      </SectionHead>
      <ol className="grid gap-5 lg:grid-cols-3">
        {ideas.map((idea, i) => (
          <li key={idea.name} className="reveal">
            <IdeaCover idea={idea} index={i} lang={lang} tinted={tinted === i} onTint={() => tint(i)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

type CoverProps = { idea: Idea; index: number; lang?: string; tinted: boolean; onTint: () => void };

function IdeaCover({ idea, index, lang, tinted, onTint }: CoverProps) {
  const band = `linear-gradient(120deg, ${idea.palette.join(", ")})`;
  return (
    <article className="panel flex h-full flex-col overflow-hidden">
      <div aria-hidden="true" data-print-keep="" className="h-28 sm:h-36" style={{ background: band }} />
      <div className="flex flex-1 flex-col gap-5 p-6 sm:p-7">
        <p className="eyebrow">Issue Nº 0{index + 1}</p>
        <h4 lang={lang} className="h3">{idea.name}</h4>
        <p lang={lang} className="text-cream/90">{idea.concept}</p>
        <ul aria-label="Palette" className="flex flex-wrap gap-2">
          {idea.palette.map((hex) => (
            <li key={hex} className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 font-mono text-xs uppercase">
              <span aria-hidden="true" data-print-keep="" className="size-6 rounded-full border border-cream/30" style={{ background: hex }} />
              {hex}
            </li>
          ))}
        </ul>
        <List title="Décor" items={idea.decor} lang={lang} />
        <List title="On the menu" items={idea.food} lang={lang} />
        <div>
          <p className="eyebrow mb-1">Music</p>
          <p lang={lang}>{idea.music}</p>
        </div>
        <blockquote lang={lang} className="accent mt-auto border-l-2 border-gold pl-4 text-lg text-gold">
          {idea.signatureMoment}
        </blockquote>
        <button type="button" aria-pressed={tinted} onClick={onTint}
          className="btn btn-ghost no-print self-start text-sm aria-pressed:border-gold aria-pressed:text-gold">
          <span aria-hidden="true">{tinted ? "●" : "○"}</span>
          Tint the lanterns
        </button>
      </div>
    </article>
  );
}

function List({ title, items, lang }: { title: string; items: string[]; lang?: string }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul lang={lang} className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="text-gold">✦</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
