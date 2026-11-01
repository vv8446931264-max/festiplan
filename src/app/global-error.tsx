"use client";

import "./globals.css";

/**
 * Last-resort error page, shown only if the root layout itself fails. It replaces the whole
 * document, so it brings its own `<html>`, `<body>` and stylesheet, and it is styled with
 * classes, not inline styles, so the nonce-only style policy never blocks it.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <title>Something broke · FestiPlan</title>
        <main id="main" className="shell flex min-h-svh flex-col justify-center gap-6 py-16">
          <p className="eyebrow">Something broke</p>
          <h1 className="h2 max-w-4xl">
            FestiPlan couldn&apos;t <span className="accent text-gold">load</span>.
          </h1>
          <p className="lead max-w-2xl text-muted">
            Something failed on our side. Your saved plans are safe. Try again in a moment.
          </p>
          <button type="button" className="btn btn-primary self-start" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
