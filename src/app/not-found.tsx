import Link from "next/link";
import { SiteHeader } from "@/components/landing/SiteHeader";

/** 404 — also shown for expired plans (they are deleted 180 days after creation). */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="shell flex min-h-[70svh] flex-col justify-center gap-6 py-16">
        <p className="eyebrow">Error 404</p>
        <h1 className="h2 max-w-4xl">
          This page has left <span className="accent text-gold">the party</span>.
        </h1>
        <p className="lead max-w-2xl text-muted">
          The link may be mistyped, or the plan expired — shared plans are kept for 180 days.
        </p>
        <Link href="/#plan" className="btn btn-primary self-start">
          Plan something new <span aria-hidden="true">→</span>
        </Link>
      </main>
    </>
  );
}
