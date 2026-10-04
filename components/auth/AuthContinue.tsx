"use client";

import { useEffect } from "react";
import { QuotrLoader } from "@/components/brand/QuotrLoader";
import { isPostAuthContinuePath } from "@/lib/auth/post-auth-navigation";

type AuthContinueProps = {
  /** Safe internal path returned from a successful auth Server Action. */
  continueTo?: string;
  /** Shown while the document navigation runs. */
  label?: string;
  /** Optional second line. Omit when it repeats the label. */
  supporting?: string;
};

/**
 * Completes auth with a hard document navigation so session cookies are
 * visible to the next full RSC request. Not a reload, timeout, or poll.
 * The loader does not delay the redirect.
 */
export function AuthContinue({
  continueTo,
  label = "Opening your workspace…",
  supporting,
}: AuthContinueProps) {
  useEffect(() => {
    if (!continueTo || !isPostAuthContinuePath(continueTo)) return;
    window.location.assign(continueTo);
  }, [continueTo]);

  if (!continueTo || !isPostAuthContinuePath(continueTo)) {
    return null;
  }

  return (
    <QuotrLoader
      variant="fullscreen"
      status={label}
      supporting={supporting}
    />
  );
}
