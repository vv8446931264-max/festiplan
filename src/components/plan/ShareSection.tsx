"use client";

import { memo, useState } from "react";
import { useOrigin } from "@/lib/client/browser";
import { SectionHead } from "./SectionHead";

/** Share and edit URLs plus copy / native-share actions with a status message. */
function useShare(planId: string, editKey: string | null) {
  const origin = useOrigin();
  const [status, setStatus] = useState("");
  const shareUrl = `${origin}/plan/${planId}`;
  const editUrl = editKey ? `${shareUrl}#edit=${editKey}` : null;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${what} copied.`);
    } catch {
      setStatus(`Couldn't copy automatically — select the ${what.toLowerCase()} and copy it.`);
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        return await navigator.share({ title: "Our celebration plan", url: shareUrl });
      } catch {
        /* dismissed — fall back to copying */
      }
    }
    await copy(shareUrl, "Share link");
  }
  return { shareUrl, editUrl, status, copy, share };
}

/** Share chapter: read-only link, private edit link, print and calendar export. */
export const ShareSection = memo(function ShareSection({ planId, editKey }: { planId: string; editKey: string | null }) {
  const s = useShare(planId, editKey);
  return (
    <section id="share" aria-labelledby="share-title" className="scroll-mt-20">
      <SectionHead id="share" number="06" kicker="Share" title={<>Send it to <span className="accent">the family group</span>.</>}>
        The share link is read-only and server-rendered, so it opens fast on any phone.
        {s.editUrl ? " Keep the edit link for people who should be able to tick things off." : ""}
      </SectionHead>
      <div className="grid gap-5 lg:grid-cols-2">
        <LinkBox id="share-link" label="Read-only link" value={s.shareUrl} onCopy={() => void s.copy(s.shareUrl, "Share link")} />
        {s.editUrl && (
          <LinkBox id="edit-link" label="Edit link — keep it private" value={s.editUrl} private
            onCopy={() => void s.copy(s.editUrl ?? "", "Edit link")} />
        )}
      </div>
      <div className="no-print mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={() => void s.share()}>Share</button>
        <button type="button" className="btn btn-ghost" onClick={() => window.print()}>Print or save as PDF</button>
        <a className="btn btn-ghost" href={`/plan/${planId}/calendar.ics`} download>Calendar file (.ics)</a>
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-sm text-muted">{s.status}</p>
    </section>
  );
});

type LinkBoxProps = { id: string; label: string; value: string; onCopy: () => void; private?: boolean };

/** A labelled read-only URL with a copy button; the private edit link never prints. */
function LinkBox({ id, label, value, onCopy, private: secret = false }: LinkBoxProps) {
  return (
    <div className={`panel flex flex-col gap-3 p-5 ${secret ? "no-print" : ""}`}>
      <label htmlFor={id} className="eyebrow">{label}</label>
      <div className="flex gap-2">
        <input id={id} readOnly value={value} className="field flex-1 font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn btn-ghost no-print shrink-0" onClick={onCopy}>
          Copy{" "}<span className="sr-only">{label}</span>
        </button>
      </div>
    </div>
  );
}
