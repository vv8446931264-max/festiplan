import Link from "next/link";

/** In-page chapters linked from the top bar (hidden on small screens, where the CTA wins). */
const SECTION_LINKS = [
  { href: "/#manifesto", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
] as const;

const SECTION_LINK_CLASS =
  "eyebrow inline-flex min-h-11 items-center px-3 text-cream no-underline hover:text-gold";

/** Top bar: wordmark home link, section links (how it works, FAQ) and the primary call to action. */
export function SiteHeader() {
  return (
    <header className="shell relative z-10 flex items-center justify-between gap-4 py-5">
      <Link href="/" className="text-xl font-extrabold tracking-tight text-cream no-underline">
        FestiPlan
        <span className="text-gold" aria-hidden="true">
          .
        </span>
      </Link>
      <nav aria-label="Main">
        <ul className="flex items-center gap-1 sm:gap-3">
          {SECTION_LINKS.map(({ href, label }) => (
            <li key={href} className="hidden sm:block">
              <Link href={href} className={SECTION_LINK_CLASS}>
                {label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/#plan" className="btn btn-primary min-h-11 px-5 py-2 text-sm">
              Start planning
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
