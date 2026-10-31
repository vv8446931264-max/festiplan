"use client";

import { memo } from "react";
import { SectionHead } from "./SectionHead";
import { useShare } from "./useShare";

type Props = { planId: string; editKey: string | null };

/** Share chapter: read-only link, private edit link, print and calendar export. */
export const ShareSection = memo(function ShareSection({ planId, editKey }: Props) {
  const sharing = useShare(planId, editKey);
  const { shareUrl, editUrl } = sharing;
  return (
    <section id="share" aria-labelledby="share-title" className="scroll-mt-20">
      <ShareHead hasEditLink={editUrl !== null} />
      <div className="grid gap-5 lg:grid-cols-2">
        <LinkBox
          id="share-link"
          label="Read-only link"
          value={shareUrl}
          onCopy={() => void sharing.copy(shareUrl, "Share link")}
        />
        {editUrl && (
          <LinkBox
            id="edit-link"
            label="Edit link — keep it private"
            value={editUrl}
            private
            onCopy={() => void sharing.copy(editUrl, "Edit link")}
          />
        )}
      </div>
      <ShareActions planId={planId} onShare={() => void sharing.share()} />
      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-sm text-muted">
        {sharing.status}
      </p>
    </section>
  );
});

function ShareHead({ hasEditLink }: { hasEditLink: boolean }) {
  return (
    <SectionHead
      id="share"
      number="06"
      kicker="Share"
      title={
        <>
          Send it to <span className="accent">the family group</span>.
        </>
      }
    >
      The share link is read-only and server-rendered, so it opens fast on any phone.
      {hasEditLink ? " Keep the edit link for people who should be able to tick things off." : ""}
    </SectionHead>
  );
}

/** Native share (falling back to copy), print to PDF, and the calendar file. */
function ShareActions({ planId, onShare }: { planId: string; onShare: () => void }) {
  return (
    <div className="no-print mt-5 flex flex-wrap gap-3">
      <button type="button" className="btn btn-primary" onClick={onShare}>
        Share
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
        Print or save as PDF
      </button>
      <a className="btn btn-ghost" href={`/plan/${planId}/calendar.ics`} download>
        Calendar file (.ics)
      </a>
    </div>
  );
}

type LinkBoxProps = {
  id: string;
  label: string;
  value: string;
  onCopy: () => void;
  private?: boolean;
};

/** A labelled read-only URL with a copy button; the private edit link never prints. */
function LinkBox({ id, label, value, onCopy, private: secret = false }: LinkBoxProps) {
  return (
    <div className={`panel flex flex-col gap-3 p-5 ${secret ? "no-print" : ""}`}>
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={value}
          className="field flex-1 font-mono text-sm"
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" className="btn btn-ghost no-print shrink-0" onClick={onCopy}>
          Copy <span className="sr-only">{label}</span>
        </button>
      </div>
    </div>
  );
}
