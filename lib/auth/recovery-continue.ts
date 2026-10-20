function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function recoveryTokenHash(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 20 || trimmed.length > 8192) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function isPrefetch(request: Request): boolean {
  const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`.toLowerCase();
  return (
    purpose.includes("prefetch") ||
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("x-middleware-prefetch") === "1"
  );
}

/** A form the browser submits. A prefetch of this page never redeems the token. */
export function recoveryContinueHtml(tokenHash: string, next: string): string {
  const token = escapeAttribute(tokenHash);
  const destination = escapeAttribute(next);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <title>Confirming reset link</title>
</head>
<body>
  <p>Confirming your reset link…</p>
  <form method="post" action="/auth/recovery-verify">
    <input type="hidden" name="token_hash" value="${token}">
    <input type="hidden" name="type" value="recovery">
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
      window.history.replaceState(null, "", "/auth/callback?next=%2Freset-password");
    }
    form.requestSubmit();
  </script>
</body>
</html>`;
}
