import { POST_SIGNUP_DESTINATION } from "@/lib/auth/post-auth-navigation";
import { getSafeInternalPath } from "@/lib/auth/safe-redirect";

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Signup confirmation next path. Recovery stays on /reset-password. */
export function signupConfirmationNext(value: string | null): string {
  const safe = getSafeInternalPath(value, POST_SIGNUP_DESTINATION);
  if (safe.startsWith("/reset-password")) return POST_SIGNUP_DESTINATION;
  return safe;
}

/**
 * A form the browser submits. A prefetch of this page never redeems the hash.
 */
export function signupConfirmContinueHtml(tokenHash: string, next: string): string {
  const token = escapeAttribute(tokenHash);
  const destination = escapeAttribute(next);
  const stripped = `/auth/callback?next=${encodeURIComponent(next)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <title>Confirming your email</title>
</head>
<body>
  <p>Confirming your email…</p>
  <form method="post" action="/auth/signup-verify">
    <input type="hidden" name="token_hash" value="${token}">
    <input type="hidden" name="type" value="email">
    <input type="hidden" name="next" value="${destination}">
    <button type="submit">Continue</button>
  </form>
  <script>
    var submitted = false;
    var form = document.forms[0];
    form.addEventListener("submit", function (event) {
      if (submitted) event.preventDefault();
      submitted = true;
    });
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", ${JSON.stringify(stripped)});
    }
    form.requestSubmit();
  </script>
</body>
</html>`;
}
