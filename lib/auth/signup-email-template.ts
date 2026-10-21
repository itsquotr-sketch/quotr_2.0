import { POST_SIGNUP_DESTINATION } from "@/lib/auth/post-auth-navigation";
import { ONBOARDING_PREVIEW_AUTH_ORIGIN } from "@/lib/auth/site-url";

/**
 * Preview signup confirmation mail.
 *
 * The app supplies RedirectTo as `/auth/callback?next=…` on an allow-listed
 * host. The template appends token_hash with `&` on that URL.
 *
 * If the redirect is not allow-listed, Supabase replaces RedirectTo with the
 * Site URL. That value is only an origin, so it has no question mark. The
 * Site URL branch builds the onboarding callback itself and starts the query
 * with `?`. It does not append parameters to the bare origin.
 *
 * ConfirmationURL is not used: it verifies on GoTrue's GET and returns a
 * PKCE code. This link uses type=email. GET on this app does not redeem the
 * hash. Password recovery keeps its own template.
 */
const SITE_URL_FALLBACK = `${ONBOARDING_PREVIEW_AUTH_ORIGIN}/auth/callback?next=${encodeURIComponent(POST_SIGNUP_DESTINATION)}`;

export const SIGNUP_EMAIL_TEMPLATE = `<h2>Confirm your email address</h2>
<p>Follow the link below to confirm this email address and finish signing up.</p>
<p><a href="{{ if eq .RedirectTo .SiteURL }}${SITE_URL_FALLBACK}&amp;token_hash={{ .TokenHash }}&amp;type=email{{ else }}{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email{{ end }}">Confirm email address</a></p>
<p>If you didn't create a Quotr account, you can safely ignore this email.</p>`;

/** Same URL contract as {@link SIGNUP_EMAIL_TEMPLATE}. tokenHash is not a live token. */
export function signupConfirmationHref(input: {
  redirectTo: string;
  siteUrl: string;
  tokenHash: string;
}): string {
  const base =
    input.redirectTo === input.siteUrl ? SITE_URL_FALLBACK : input.redirectTo;
  return `${base}&token_hash=${input.tokenHash}&type=email`;
}
