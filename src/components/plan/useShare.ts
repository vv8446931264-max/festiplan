"use client";

import { useState } from "react";
import { useOrigin } from "@/lib/client/browser";

/** Share and edit URLs plus copy / native-share actions with a status message. */
export function useShare(planId: string, editKey: string | null) {
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
        await navigator.share({ title: "Our celebration plan", url: shareUrl });
        return;
      } catch {
        // The share sheet was dismissed or is unavailable: copy the link instead.
      }
    }
    await copy(shareUrl, "Share link");
  }

  return { shareUrl, editUrl, status, copy, share };
}
