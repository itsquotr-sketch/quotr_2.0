"use client";

import { useEffect } from "react";

/**
 * A signed-out Back navigation can restore a protected page from the
 * back-forward cache. Hide that snapshot and load it again so the
 * server can send the visitor to login.
 */
export function ProtectedHistoryGuard() {
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      document.documentElement.style.visibility = "hidden";
      window.location.reload();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  return null;
}
