const PRINCIPLES = [
  {
    title: "AI ideates.",
    body: "Gemini drafts three distinct concepts from your vibe — name, palette, décor, menu, music and one signature moment.",
  },
  {
    title: "Code calculates.",
    body: "Every rupee, date and percentage comes from tested TypeScript, never from the model. ₹12,00,000 means ₹12,00,000.",
  },
  {
    title: "Real places only.",
    body: "Vendors come from Grounding with Google Maps, with links you can check. FestiPlan never invents a business.",
  },
  {
    title: "No accounts.",
    body: "One read-only link for the family group, one private edit link for whoever is doing the work.",
  },
];

/** Chapter 1: what FestiPlan believes, in four lines. */
export function Manifesto() {
  return (
    <section
      id="manifesto"
      aria-labelledby="manifesto-title"
      className="shell scroll-mt-8 py-24 sm:py-36"
    >
      <div className="legible grid gap-10 lg:grid-cols-[1fr_2fr]">
        <p className="eyebrow">Nº 01 — Manifesto</p>
        <div className="reveal flex flex-col gap-8">
          <h2 id="manifesto-title" className="h2">
            It isn&apos;t just a checklist. It&apos;s the night your cousins will{" "}
            <span className="accent text-gold">talk about for years</span>.
          </h2>
          <p className="lead max-w-2xl text-muted">
            Your aunt will still have opinions. Your spreadsheet won&apos;t.
          </p>
        </div>
      </div>
      <ol className="mt-16 grid gap-px overflow-hidden rounded-[28px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {PRINCIPLES.map((principle, index) => (
          <li
            key={principle.title}
            className="reveal flex flex-col gap-4 bg-espresso/95 p-6 sm:p-8"
          >
            <span className="accent text-3xl text-gold">0{index + 1}</span>
            <h3 className="text-2xl font-bold tracking-tight">{principle.title}</h3>
            <p className="text-muted">{principle.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
