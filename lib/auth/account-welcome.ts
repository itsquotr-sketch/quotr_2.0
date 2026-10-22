/**
 * Account welcome email — service mail after a new self-signup confirms
 * and a profile is provisioned. Not a marketing sequence.
 *
 * Automatic delivery stays off unless ACCOUNT_WELCOME_EMAIL_ENABLED=true
 * on Preview. Production also requires ACCOUNT_WELCOME_EMAIL_PRODUCTION=true.
 * Existing accounts are not scanned or backfilled.
 */

import { QUOTR_WORDMARK_NATIVE } from "@/lib/branding/assets";
import { teamInviteFromHeader } from "@/lib/email/application-email";

export const ACCOUNT_WELCOME_TEMPLATE_VERSION = "account-welcome-v1";
export const ACCOUNT_WELCOME_SUBJECT =
  "Welcome to Quotr — let’s get you set up";
export const ACCOUNT_WELCOME_CONTINUE_URL =
  "https://app.get-quotr.com/app/setup";
export const ACCOUNT_WELCOME_GETTING_STARTED_URL =
  "https://app.get-quotr.com/help/getting-started";
export const ACCOUNT_WELCOME_FIRST_JOB_URL =
  "https://app.get-quotr.com/help/your-first-job";
/** Same mailbox as HELP_SUPPORT_EMAIL. Kept local so confirmation does not load the help catalogue. */
export const ACCOUNT_WELCOME_REPLY_TO = "hello@get-quotr.com";
/** Official wordmark, black + orange, served from the public app. */
export const ACCOUNT_WELCOME_WORDMARK_URL =
  "https://app.get-quotr.com/branding/quotr-wordmark-black.png";
export const ACCOUNT_WELCOME_WORDMARK_WIDTH = 120;
export const ACCOUNT_WELCOME_WORDMARK_HEIGHT = Math.round(
  (ACCOUNT_WELCOME_WORDMARK_WIDTH * QUOTR_WORDMARK_NATIVE.height) /
    QUOTR_WORDMARK_NATIVE.width
);
/** Resend keeps an idempotency key for 24 hours. After that, do not send again. */
export const ACCOUNT_WELCOME_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ACCOUNT_WELCOME_EMAIL_ENABLED_ENV =
  "ACCOUNT_WELCOME_EMAIL_ENABLED" as const;
export const ACCOUNT_WELCOME_EMAIL_PRODUCTION_ENV =
  "ACCOUNT_WELCOME_EMAIL_PRODUCTION" as const;

export type AccountWelcomeEnvironment = "preview" | "production" | "development";
export type AccountWelcomeSource = "signup" | "preview_test";
export type AccountWelcomeStatus = "pending" | "sending" | "accepted" | "failed";

export type AccountWelcomeTrigger =
  | "signup_confirmation"
  | "signup_submission"
  | "confirmation_resend"
  | "login"
  | "password_recovery"
  | "page_refresh"
  | "invitation_acceptance"
  | "account_repair";

const ENABLED_VALUE = "true";

export function isAccountWelcomeDeliveryEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  if (env[ACCOUNT_WELCOME_EMAIL_ENABLED_ENV]?.trim() !== ENABLED_VALUE) {
    return false;
  }
  if (env.VERCEL_ENV === "preview") return true;
  if (env.VERCEL_ENV === "production") {
    return env[ACCOUNT_WELCOME_EMAIL_PRODUCTION_ENV]?.trim() === ENABLED_VALUE;
  }
  return false;
}

export function resolveAccountWelcomeEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env
): AccountWelcomeEnvironment | null {
  if (env.VERCEL_ENV === "preview") return "preview";
  if (env.VERCEL_ENV === "production") return "production";
  if (env.VERCEL_ENV === "development") return "development";
  return null;
}

/**
 * One key for the life of this user, template version, and environment.
 * Retries, including a provider acceptance whose local acknowledgement
 * failed, reuse this key. Resend then returns the original acceptance.
 */
export function accountWelcomeIdempotencyKey(input: {
  environment: AccountWelcomeEnvironment;
  userId: string;
  source: AccountWelcomeSource;
}): string {
  const base = `${ACCOUNT_WELCOME_TEMPLATE_VERSION}:${input.environment}`;
  if (input.source === "preview_test") {
    return `${base}:test:${input.userId}`;
  }
  return `${base}:${input.userId}`;
}

export function isAccountWelcomeEligible(input: {
  trigger: AccountWelcomeTrigger;
  emailConfirmed: boolean;
  newlyProvisioned: boolean;
  destination: string;
}): boolean {
  if (input.trigger !== "signup_confirmation") return false;
  if (!input.emailConfirmed) return false;
  if (!input.newlyProvisioned) return false;
  if (input.destination.startsWith("/invite/")) return false;
  if (input.destination.startsWith("/reset-password")) return false;
  if (input.destination.startsWith("/signup")) return false;
  return true;
}

/** First word of a stored name. Missing, email-like, or unsafe values greet as "there". */
export function accountWelcomeGreetingName(
  fullName: string | null | undefined
): string | null {
  const trimmed = fullName?.trim() ?? "";
  if (!trimmed || trimmed.includes("@")) return null;
  const first = trimmed.split(/\s+/)[0] ?? "";
  if (!first || first.length > 40) return null;
  if (!/^[\p{L}][\p{L}\p{M}'’.-]*$/u.test(first)) return null;
  return first;
}

export function accountWelcomeGreetingLine(
  fullName: string | null | undefined
): string {
  const name = accountWelcomeGreetingName(fullName);
  return name ? `Hi ${name},` : "Hi there,";
}

export function accountWelcomeFromHeader(): string | null {
  return teamInviteFromHeader();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildAccountWelcomeEmail(input: {
  fullName: string | null | undefined;
  previewTest?: boolean;
  environment?: AccountWelcomeEnvironment | null;
}): { subject: string; html: string; text: string } {
  const greeting = accountWelcomeGreetingLine(input.fullName);
  const continueUrl = ACCOUNT_WELCOME_CONTINUE_URL;
  const gettingStartedUrl = ACCOUNT_WELCOME_GETTING_STARTED_URL;
  const firstJobUrl = ACCOUNT_WELCOME_FIRST_JOB_URL;
  const identification =
    input.previewTest === true && input.environment !== "production"
      ? "Preview test of the account welcome email."
      : null;
  const text = [
    identification,
    identification ? "" : null,
    greeting,
    "",
    "Your email is confirmed and your Quotr account is ready.",
    "",
    "Finish your company setup, then start your first job. Add a clear description of the work, review the details, and Quotr will help you build your estimate.",
    "",
    "Continue to Quotr:",
    continueUrl,
    "",
    "Getting started:",
    gettingStartedUrl,
    "",
    "Your first job:",
    firstJobUrl,
    "",
    `Need a hand? Reply to this email or contact ${ACCOUNT_WELCOME_REPLY_TO}.`,
    "",
    "The Quotr team",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const identificationHtml = identification
    ? `<p style="padding:0 0 12px 0;margin:0;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#71717a">${escapeHtml(identification)}</p>`
    : "";
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(ACCOUNT_WELCOME_SUBJECT)}</title>
</head>
<body style="padding:0;margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:12px;table-layout:fixed;">
          <tr>
            <td style="padding:28px 24px;word-wrap:break-word;">
              ${identificationHtml}
              <p style="padding:0 0 20px 0;margin:0;">
                <img src="${escapeHtml(ACCOUNT_WELCOME_WORDMARK_URL)}" alt="Quotr" width="${ACCOUNT_WELCOME_WORDMARK_WIDTH}" height="${ACCOUNT_WELCOME_WORDMARK_HEIGHT}" style="display:block;width:${ACCOUNT_WELCOME_WORDMARK_WIDTH}px;height:${ACCOUNT_WELCOME_WORDMARK_HEIGHT}px;border:0;outline:none;text-decoration:none;" />
              </p>
              <p style="padding:0 0 16px 0;margin:0;font-size:16px;line-height:24px">${escapeHtml(greeting)}</p>
              <p style="padding:0 0 16px 0;margin:0;font-size:16px;line-height:24px">Your email is confirmed and your Quotr account is ready.</p>
              <p style="padding:0 0 16px 0;margin:0;font-size:16px;line-height:24px">Finish your company setup, then start your first job. Add a clear description of the work, review the details, and Quotr will help you build your estimate.</p>
              <p style="padding:8px 0 0 0;margin:0">
                <a href="${escapeHtml(continueUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;line-height:20px;padding:12px 20px;border-radius:8px">Continue to Quotr</a>
              </p>
              <p style="padding:24px 0 0 0;margin:0;font-size:15px;line-height:22px;color:#52525b"><a href="${escapeHtml(gettingStartedUrl)}" style="color:#111111">Getting started</a></p>
              <p style="padding:8px 0 0 0;margin:0;font-size:15px;line-height:22px;color:#52525b"><a href="${escapeHtml(firstJobUrl)}" style="color:#111111">Your first job</a></p>
              <p style="padding:24px 0 0 0;margin:0;font-size:15px;line-height:22px;color:#52525b">Need a hand? Reply to this email or contact <a href="mailto:${escapeHtml(ACCOUNT_WELCOME_REPLY_TO)}" style="color:#111111">${escapeHtml(ACCOUNT_WELCOME_REPLY_TO)}</a>.</p>
              <p style="padding:16px 0 0 0;margin:0;font-size:15px;line-height:22px;color:#111">The Quotr team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: ACCOUNT_WELCOME_SUBJECT, html, text };
}

export function decideAccountWelcomeSend(input: {
  status: AccountWelcomeStatus;
  leaseUntil: string | null;
  now: string;
  idempotencyKey: string;
  idempotencyStartedAt?: string | null;
  providerMessageId?: string | null;
}): {
  action: "skip_accepted" | "skip_in_flight" | "reconcile" | "send";
  idempotencyKey: string;
} {
  if (input.status === "accepted" || input.providerMessageId) {
    return { action: "skip_accepted", idempotencyKey: input.idempotencyKey };
  }
  if (
    input.status === "sending" &&
    input.leaseUntil &&
    Date.parse(input.leaseUntil) > Date.parse(input.now)
  ) {
    return { action: "skip_in_flight", idempotencyKey: input.idempotencyKey };
  }
  if (input.idempotencyStartedAt) {
    const started = Date.parse(input.idempotencyStartedAt);
    const now = Date.parse(input.now);
    if (
      Number.isFinite(started) &&
      Number.isFinite(now) &&
      now - started >= ACCOUNT_WELCOME_IDEMPOTENCY_WINDOW_MS
    ) {
      return { action: "reconcile", idempotencyKey: input.idempotencyKey };
    }
  }
  return { action: "send", idempotencyKey: input.idempotencyKey };
}
