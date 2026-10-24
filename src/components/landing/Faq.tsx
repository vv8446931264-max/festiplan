import { FAQ, type FaqItem } from "@/lib/seo/faq";

/**
 * Chapter 3: the questions people ask before planning, as native disclosures (keyboard and
 * screen-reader support for free). The same items feed the `FAQPage` JSON-LD word for word.
 */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="shell scroll-mt-8 py-24 sm:py-36">
      <div className="legible grid gap-10 lg:grid-cols-[1fr_2fr]">
        <p className="eyebrow">Nº 03 — Questions</p>
        <div className="reveal flex flex-col gap-8">
          <h2 id="faq-title" className="h2">
            Fair questions, <span className="accent text-gold">straight answers</span>.
          </h2>
          <p className="lead max-w-2xl text-muted">
            The short version: Gemini has the ideas, code does the maths, and Google Maps names the vendors.
          </p>
        </div>
      </div>
      <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div aria-hidden="true" className="hidden lg:block" />
        <div className="rounded-[28px] border border-line bg-espresso/95">
          {FAQ.map((item) => (
            <FaqEntry key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqEntry({ item }: { item: FaqItem }) {
  return (
    <details id={`faq-${item.id}`} className="group border-b border-line px-6 last:border-b-0 sm:px-8">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-6 text-xl font-bold tracking-tight sm:text-2xl [&::-webkit-details-marker]:hidden">
        <span>{item.question}</span>
        <span aria-hidden="true" className="accent shrink-0 text-3xl leading-none text-gold transition-transform duration-200 group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="max-w-3xl pb-8 text-muted">{item.answer}</p>
    </details>
  );
}
