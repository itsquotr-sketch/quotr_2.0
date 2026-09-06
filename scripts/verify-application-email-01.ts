/**
 * Application email channels, invite URL, Team/Quote From.
 * Run: npx --yes tsx scripts/verify-application-email-01.ts
 *
 * Never prints raw invite tokens or API keys.
 */
import { readFileSync, readdirSync } from "node:fs";
import {
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  resolveConfiguredSiteOrigin,
} from "../lib/auth/site-url";
import {
  buildInviteAcceptUrl,
  formatQuoteDeliveryFromHeader,
  isNestedQuotesSender,
  isQuoteChannelMailbox,
  isUsableInviteAcceptUrl,
  quoteChannelFromAddress,
  teamInviteFromAddress,
  teamInviteFromHeader,
} from "../lib/email/application-email";
import { buildInviteEmail, inviteAcceptPath } from "../lib/team/invite-email";
import { generateInviteToken, hashInviteToken } from "../lib/team/tokens";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(rel, "utf8");
}

const original = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_TEAM_FROM_EMAIL: process.env.RESEND_TEAM_FROM_EMAIL,
  RESEND_QUOTE_FROM_EMAIL: process.env.RESEND_QUOTE_FROM_EMAIL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const inviteEmailSrc = read("lib/team/invite-email.ts");
const teamActionsSrc = read("lib/team/actions.ts");
const appEmailSrc = read("lib/email/application-email.ts");
const siteSrc = read("lib/auth/site-url.ts");
const quoteActionsSrc = read("lib/quotes/actions.ts");
const quoteDeliverySrc = read("lib/quotes/delivery-email.ts");
const webhookSrc = read("lib/quotes/delivery-webhooks.ts");
const authActionsSrc = read("app/(auth)/actions.ts");
const migrations = readdirSync("supabase/migrations").filter((name) =>
  name.endsWith(".sql")
);

console.log("=== APPLICATION EMAIL 01 ===\n");

process.env.RESEND_TEAM_FROM_EMAIL = "no-reply@get-quotr.com";
process.env.RESEND_QUOTE_FROM_EMAIL = "quotes@get-quotr.com";
process.env.RESEND_FROM_EMAIL = "no-reply@get-quotr.com";

assert(
  "Team From env resolves to no-reply, not quotes mailbox",
  teamInviteFromAddress() === "no-reply@get-quotr.com" &&
    teamInviteFromHeader() === "Quotr <no-reply@get-quotr.com>" &&
    teamInviteFromAddress() !== quoteChannelFromAddress()
);
assert(
  "Quote From env resolves to quotes@get-quotr.com",
  quoteChannelFromAddress() === "quotes@get-quotr.com"
);
assert(
  "Quote display name is company via Quotr; missing company is Quotr",
  formatQuoteDeliveryFromHeader("ERC Contracting", "quotes@get-quotr.com") ===
    "ERC Contracting via Quotr <quotes@get-quotr.com>" &&
    formatQuoteDeliveryFromHeader(null, "quotes@get-quotr.com") ===
      "Quotr <quotes@get-quotr.com>"
);

process.env.RESEND_QUOTE_FROM_EMAIL = "quotes@quotes.get-quotr.com";
assert(
  "nested quotes@quotes.get-quotr.com is rejected and falls back",
  isNestedQuotesSender("quotes@quotes.get-quotr.com") &&
    quoteChannelFromAddress() === "no-reply@get-quotr.com"
);
process.env.RESEND_QUOTE_FROM_EMAIL = "quotes@get-quotr.com";

delete process.env.RESEND_TEAM_FROM_EMAIL;
process.env.RESEND_FROM_EMAIL = "no-reply@get-quotr.com";
assert(
  "Team falls back to RESEND_FROM_EMAIL when TEAM unset",
  teamInviteFromAddress() === "no-reply@get-quotr.com"
);
delete process.env.RESEND_QUOTE_FROM_EMAIL;
assert(
  "Quote falls back to RESEND_FROM_EMAIL when QUOTE unset",
  quoteChannelFromAddress() === "no-reply@get-quotr.com"
);
process.env.RESEND_FROM_EMAIL = "quotes@get-quotr.com";
assert(
  "Team never uses the Quote mailbox even if FROM is quotes@",
  teamInviteFromAddress() === null &&
    isQuoteChannelMailbox("quotes@get-quotr.com")
);
process.env.RESEND_TEAM_FROM_EMAIL = "no-reply@get-quotr.com";
process.env.RESEND_QUOTE_FROM_EMAIL = "quotes@get-quotr.com";
process.env.RESEND_FROM_EMAIL = "no-reply@get-quotr.com";

process.env.VERCEL_ENV = "preview";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
assert(
  "Preview ignores localhost SITE_URL and uses stable host",
  resolveConfiguredSiteOrigin() === PREVIEW_AUTH_SITE_ORIGIN_STABLE
);

const token = generateInviteToken();
const inviteUrl = buildInviteAcceptUrl(PREVIEW_AUTH_SITE_ORIGIN_STABLE, token);
assert(
  "invite URL is non-empty stable /invite route with token",
  Boolean(inviteUrl) &&
    isUsableInviteAcceptUrl(inviteUrl!, "preview") &&
    inviteUrl!.startsWith(`${PREVIEW_AUTH_SITE_ORIGIN_STABLE}/invite/`) &&
    inviteUrl!.includes(inviteAcceptPath(token)) &&
    !/localhost/i.test(inviteUrl!)
);
assert(
  "hosted Preview rejects localhost invite href",
  buildInviteAcceptUrl("http://localhost:3000", token, "preview") === null
);
assert(
  "raw token is hashed, not equal to hash",
  hashInviteToken(token) !== token && hashInviteToken(token).length === 64
);

const built = buildInviteEmail({
  organisationName: "ERC Contracting",
  inviterName: "Jean-Luc",
  role: "estimator",
  acceptUrl: inviteUrl!,
  expiresAt: new Date("2026-10-01T00:00:00.000Z"),
});
assert(
  "Team subject is company-only",
  built.subject === "ERC Contracting invited you to Quotr"
);
assert(
  "Team body is concise company + role + expiry",
  built.text.includes(
    "ERC Contracting invited you to join their Quotr team as an Estimator."
  ) &&
    built.text.includes("This invitation expires on") &&
    built.text.includes("If you weren't expecting this invitation") &&
    built.text.includes("Sent via Quotr") &&
    !built.text.includes("BILLING")
);
assert(
  "HTML CTA is an href anchor, not a button or JS",
  built.html.includes(`<a href="${inviteUrl}"`) &&
    built.html.includes("Accept invitation") &&
    !/<button\b/i.test(built.html) &&
    !/onclick=/i.test(built.html) &&
    !/javascript:/i.test(built.html) &&
    !built.html.includes("next/link")
);
assert(
  "plain-text contains invite URL and no localhost",
  built.text.includes("Accept your invitation:") &&
    built.text.includes(inviteUrl!) &&
    !/localhost/i.test(built.text) &&
    !built.text.includes("quotes@quotes.get-quotr.com")
);
assert(
  "invite-email does not import quote From helper",
  !inviteEmailSrc.includes("quoteDeliveryFromAddress") &&
    inviteEmailSrc.includes("teamInviteFromHeader")
);
assert(
  "team actions persist hash only and build URL from canonical origin",
  /hashInviteToken\(rawToken\)/.test(teamActionsSrc) &&
    /buildInviteAcceptUrl\(origin, rawToken\)/.test(teamActionsSrc) &&
    !/p_token:/.test(teamActionsSrc)
);
assert(
  "Quote send uses company contact Reply-To and omits From fallback",
  quoteActionsSrc.includes("resolveQuoteDeliveryReplyTo(issuer?.contactEmail)") &&
    /export function resolveQuoteDeliveryReplyTo[\s\S]*return null/.test(
      quoteDeliverySrc
    )
);
assert(
  "Quote HTML path still View Quote, not Accept",
  quoteDeliverySrc.includes("View Quote") &&
    quoteDeliverySrc.includes("View quote:") &&
    !quoteDeliverySrc.includes("Accept invitation")
);
assert(
  "Auth actions still use getAuthSiteOrigin (SMTP path unchanged)",
  /getAuthSiteOrigin/.test(authActionsSrc) &&
    !authActionsSrc.includes("RESEND_TEAM_FROM_EMAIL") &&
    !authActionsSrc.includes("sendOrganisationInviteEmail")
);
assert(
  "webhook does not assume a single From address",
  !webhookSrc.includes("RESEND_FROM_EMAIL") &&
    !webhookSrc.includes("quotes@get-quotr.com") &&
    webhookSrc.includes("providerMessageId")
);
assert(
  "no application-email migration 054",
  !migrations.includes("054_application_email.sql")
);
assert(
  "canonical origin helper exists",
  /export function resolveConfiguredSiteOrigin/.test(siteSrc) &&
    appEmailSrc.includes("buildInviteAcceptUrl")
);

restoreEnv();

if (process.exitCode) {
  console.error("\nAPPLICATION-EMAIL-01 failed");
} else {
  console.log("\nAPPLICATION-EMAIL-01 passed");
}
