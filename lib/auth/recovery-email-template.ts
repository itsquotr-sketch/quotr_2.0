/**
 * Production and Preview recovery mail both use this body.
 * The link carries the recovery token_hash to this app. The callback page
 * does not redeem it; the user POST redeems it and receives the session cookie
 * on a document redirect.
 */
export const RECOVERY_EMAIL_TEMPLATE = `<h2>Reset your password</h2>
<p>We received a request to reset your password. Follow the link below to choose a new one.</p>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`;
