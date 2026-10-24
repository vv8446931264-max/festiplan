import { BRAND } from "@/lib/site";

const LETTERS = BRAND.name.split("");

/** Chapter 0: the masthead over the lantern sky. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="shell relative flex min-h-[calc(100svh-88px)] flex-col justify-between gap-10 pb-6 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="eyebrow rise legible text-cream">{BRAND.category}</p>
        <p className="eyebrow rise legible hidden text-right sm:block">Weddings · Birthdays · Community events</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,620px)] lg:items-end">
        <div className="hidden lg:block" />
        <HeroPitch />
      </div>
      <Masthead />
    </section>
  );
}

function HeroPitch() {
  return (
    <div className="rise legible flex flex-col gap-6" style={{ animationDelay: "350ms" }}>
      <p className="h3">
        Made for <span className="accent text-gold">moments</span>.
        <br />
        Built for <span className="accent text-gold">budgets</span>.
      </p>
      <p className="lead text-cream/85">
        Tell us the date, the city, the guests and the vibe. Gemini drafts three concepts;
        FestiPlan splits every rupee, counts back from the date and finds real vendors on Google Maps.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href="#plan" className="btn btn-primary px-7 text-lg">
          Start planning <span aria-hidden="true">→</span>
        </a>
        <a href="#manifesto" className="btn btn-ghost px-6">
          How it works
        </a>
      </div>
    </div>
  );
}

/** The giant wordmark; letters rise in sequence, screen readers get the full name once. */
function Masthead() {
  return (
    <div className="flex flex-col gap-3">
      <h1 id="hero-title" className="masthead legible text-cream">
        <span className="sr-only">{BRAND.name} — {BRAND.category}</span>
        <span aria-hidden="true" className="flex">
          {LETTERS.map((ch, i) => (
            <span key={i} className="rise inline-block" style={{ animationDelay: `${120 + i * 55}ms` }}>
              {ch}
            </span>
          ))}
        </span>
      </h1>
      <div className="flex items-center justify-between">
        <p className="eyebrow legible">Scroll</p>
        <span aria-hidden="true" className="mx-4 h-px flex-1 bg-line" />
        <p className="eyebrow legible">For every celebration</p>
      </div>
    </div>
  );
}
