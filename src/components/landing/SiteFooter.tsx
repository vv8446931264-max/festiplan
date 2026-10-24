/** Closing chapter: oversized wordmark, honest disclaimer, the Google stack. */
export function SiteFooter() {
  return (
    <footer className="shell relative overflow-hidden pb-10 pt-24">
      <div className="grid gap-8 border-t border-line pt-8 md:grid-cols-3">
        <p className="text-muted">
          Plans are suggestions. Confirm prices, permits and muhurat timings with the people who know them.
        </p>
        <p className="text-muted">
          Built with Gemini on Vertex AI, Grounding with Google Maps, Cloud Firestore and Cloud Run.
        </p>
        <p className="text-muted md:text-right">
          <a href="https://github.com/vv8446931264-max/festiplan">Source on GitHub</a>
        </p>
      </div>
      <p aria-hidden="true" className="masthead mt-12 select-none text-transparent [-webkit-text-stroke:1px_var(--color-line)]">
        FestiPlan
      </p>
    </footer>
  );
}
