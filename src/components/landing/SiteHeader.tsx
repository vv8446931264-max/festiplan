import Link from "next/link";

/** Top bar: wordmark home link, section links and the primary call to action. */
export function SiteHeader() {
  return (
    <header className="shell relative z-10 flex items-center justify-between gap-4 py-5">
      <Link href="/" className="text-xl font-extrabold tracking-tight text-cream no-underline">
        FestiPlan<span className="text-gold" aria-hidden="true">.</span>
      </Link>
      <nav aria-label="Main">
        <ul className="flex items-center gap-1 sm:gap-3">
          <li className="hidden sm:block">
            <Link href="/#manifesto" className="eyebrow inline-flex min-h-11 items-center px-3 text-cream no-underline hover:text-gold">
              How it works
            </Link>
          </li>
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
