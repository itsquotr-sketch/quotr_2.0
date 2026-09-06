/**
 * Preview Auth fixture policy (AUTH STABILITY).
 *
 * Cursor hosted-proof / smoke scripts have historically called
 * `auth.admin.updateUserById({ password })` on the first organisation
 * owner whose email contained `erccontracting`. That rotated the real
 * Preview owner (jeanluc@) and invalidated both the session and the
 * previously known password after every prompt.
 *
 * Rules:
 * 1. Never mutate passwords for protected human inboxes.
 * 2. Automation may only rotate isolated plus-address fixtures.
 * 3. Preview deploy itself must not mutate Auth users.
 * 4. Production Auth is never in scope.
 */

export const PREVIEW_AUTH_SITE_ORIGIN_STABLE =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";

export const PREVIEW_SUPABASE_PROJECT_REF = "shhpjsoldmqtkdbgrbtm";
export const PRODUCTION_SUPABASE_PROJECT_REF = "lxvnylhsbvudzzupxeqr";

/** Human / shared inboxes. Never rotate these via Admin API automation. */
export const PREVIEW_PASSWORD_PROTECTED_EMAILS = [
  "jeanluc@erccontracting.co.nz",
  "hello@erccontracting.co.nz",
] as const;

export function normalizePreviewEmail(
  email: string | null | undefined
): string {
  return String(email || "").trim().toLowerCase();
}

export function isPlusAddressFixture(
  email: string | null | undefined
): boolean {
  const value = normalizePreviewEmail(email);
  const at = value.indexOf("@");
  if (at <= 0) return false;
  return value.slice(0, at).includes("+");
}

export function isPasswordProtectedPreviewAccount(
  email: string | null | undefined
): boolean {
  const value = normalizePreviewEmail(email);
  return (PREVIEW_PASSWORD_PROTECTED_EMAILS as readonly string[]).includes(
    value
  );
}

export function assertSafePreviewPasswordMutation(
  email: string | null | undefined
): void {
  const value = normalizePreviewEmail(email);
  if (!value) {
    throw new Error("Preview password mutation refused: missing email.");
  }
  if (isPasswordProtectedPreviewAccount(value)) {
    throw new Error(
      "Preview password mutation refused: protected human inbox."
    );
  }
  if (!isPlusAddressFixture(value)) {
    throw new Error(
      "Preview password mutation refused: not an isolated plus-address fixture."
    );
  }
}
