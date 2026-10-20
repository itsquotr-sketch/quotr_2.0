/**
 * Browser handoff for a recovery link whose session arrives in the URL
 * fragment. The fragment is never sent to the server, so a redirect would
 * drop it and the reset page would only see an invalid link.
 *
 * The document is static. Tokens stay in the browser until the same-origin
 * session request, then the address bar is cleared.
 */
export function recoveryHashHandoffHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <meta name="robots" content="noindex">
  <title>Confirming reset link</title>
</head>
<body>
  <p>Confirming your reset link…</p>
  <script>
    (async function () {
      var params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      var accessToken = params.get("access_token");
      var refreshToken = params.get("refresh_token");
      var tokenType = params.get("type");
      history.replaceState(null, "", window.location.pathname + window.location.search);
      if (!accessToken || !refreshToken || (tokenType && tokenType !== "recovery")) {
        window.location.replace("/reset-password?error=invalid");
        return;
      }
      try {
        var response = await fetch("/auth/recovery-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken
          })
        });
        window.location.replace(response.ok ? "/reset-password" : "/reset-password?error=invalid");
      } catch (error) {
        window.location.replace("/reset-password?error=invalid");
      }
    })();
  </script>
</body>
</html>`;
}
