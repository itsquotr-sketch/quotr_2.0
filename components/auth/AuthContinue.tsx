"use client";

import { useEffect } from "react";
import { isPostAuthContinuePath } from "@/lib/auth/post-auth-navigation";

type AuthContinueProps = {
  /** Safe internal path returned from a successful auth Server Action. */
  continueTo?: string;
  /** Shown while the document navigation runs. */
  label?: string;
};

/**
 * Completes auth with a hard document navigation so session cookies are
 * visible to the next full RSC request. Not a reload, timeout, or poll.
 */
export function AuthContinue({
  continueTo,
  label = "Opening Quotr…",
}: AuthContinueProps) {
  useEffect(() => {
    if (!continueTo || !isPostAuthContinuePath(continueTo)) return;
    window.location.assign(continueTo);
  }, [continueTo]);

  if (!continueTo || !isPostAuthContinuePath(continueTo)) {
    return null;
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
    >
      {label}
    </p>
  );
}
