"use client";

import { useEffect } from "react";

/** Before printing, unfold every collapsed group so the printout is the complete plan. */
export function useUnfoldForPrint(): void {
  useEffect(() => {
    const unfold = () => {
      for (const group of document.querySelectorAll("details:not([open])")) {
        group.setAttribute("open", "");
      }
    };
    window.addEventListener("beforeprint", unfold);
    return () => window.removeEventListener("beforeprint", unfold);
  }, []);
}
