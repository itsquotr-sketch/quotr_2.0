/**
 * Post-auth navigation after cookie mutation (Stage 3.1C.3-R2E-R1).
 *
 * Soft Server Action redirects after Set-Cookie can leave the App Router URL
 * updated while the protected RSC tree fails to paint until a hard refresh.
 * Prefer a document-level navigation once the action returns successfully.
 */

/** First-run Company Basics — skip soft hop through Dashboard. */
export const POST_SIGNUP_DESTINATION = "/app/setup?mode=basics";

/**
 * True when a destination is a safe internal app path suitable for
 * window.location.assign after auth.
 */
export function isPostAuthContinuePath(path: string | null | undefined): boolean {
  if (typeof path !== "string") return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  return trimmed.startsWith("/app/") || trimmed === "/app";
}
