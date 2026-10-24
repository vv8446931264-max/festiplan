"use client";

/** Route error boundary with a plain-language message and a retry. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="shell flex min-h-[70svh] flex-col justify-center gap-6 py-16">
      <p className="eyebrow">Something broke</p>
      <h1 className="h2 max-w-4xl">
        That didn&apos;t go to <span className="accent text-gold">plan</span>.
      </h1>
      <p className="lead max-w-2xl text-muted">
        Something failed on our side while loading this page. Your saved plans are safe. Try again in a moment.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <a href="/" className="btn btn-ghost">
          Back to the start
        </a>
      </div>
    </main>
  );
}
