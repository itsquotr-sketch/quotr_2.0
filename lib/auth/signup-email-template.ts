/**
 * Preview signup confirmation mail.
 *
 * The link carries the signup token hash to this app's RedirectTo callback.
 * Site URL stays the shared hardening alias, so the href uses RedirectTo
 * rather than the Site URL variable or ConfirmationURL. ConfirmationURL verifies on
 * GoTrue's GET and then returns a PKCE code that only the signup browser
 * can exchange.
 *
 * Official token-hash verification uses type=email. GET on this app does
 * not redeem the hash; the user POST does, and the session cookie is set
 * on that redirect. Password recovery keeps its own template.
 */
export const SIGNUP_EMAIL_TEMPLATE = `<h2>Confirm your email address</h2>
<p>Follow the link below to confirm this email address and finish signing up.</p>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email">Confirm email address</a></p>
<p>If you didn't create a Quotr account, you can safely ignore this email.</p>`;
