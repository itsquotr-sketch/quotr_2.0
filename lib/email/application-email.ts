/**
 * Application Resend sender configuration (not Supabase Auth SMTP).
 *
 * Channels:
 *   TEAM  → RESEND_TEAM_FROM_EMAIL || RESEND_FROM_EMAIL  → Quotr <no-reply@…>
 *   QUOTE → RESEND_QUOTE_FROM_EMAIL || RESEND_FROM_EMAIL → {Company} via Quotr <quotes@…>
 *   OTHER → RESEND_FROM_EMAIL
 *
 * Auth confirmation / reset remain Supabase Auth SMTP (no-reply@get-quotr.com).
 * Do not route Team invites through the Quote sender.
 */

import { PREVIEW_AUTH_SITE_ORIGIN_STABLE } from "@/lib/auth/site-url";
import { isWellFormedInviteToken } from "@/lib/team/tokens";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TEAM_FROM_DISPLAY_NAME = "Quotr";
export const QUOTE_FROM_DISPLAY_FALLBACK = "Quotr";
export const NESTED_QUOTES_MAILBOX_SUFFIX = "@quotes.get-quotr.com";

export type ApplicationEmailChannel = "team" | "quote" | "other";

export function isSafeMailboxAddress(
  value: string | null | undefined
): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  if (/[\r\n,<>]/.test(trimmed)) return false;
  return EMAIL_PATTERN.test(trimmed);
}

export function extractEmailAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const angled = trimmed.match(/<([^>]+)>/);
  const candidate = (angled?.[1] ?? trimmed).trim();
  return isSafeMailboxAddress(candidate) ? candidate : null;
}

export function isNestedQuotesSender(value: string): boolean {
  const address = extractEmailAddress(value) ?? value.trim().toLowerCase();
  return address.toLowerCase().endsWith(NESTED_QUOTES_MAILBOX_SUFFIX);
}

/** Quote delivery mailbox — never use this as the Team invite From. */
export const QUOTE_CHANNEL_MAILBOX = "quotes@get-quotr.com";

export function isQuoteChannelMailbox(value: string): boolean {
  const address = (extractEmailAddress(value) ?? value.trim()).toLowerCase();
  return address === QUOTE_CHANNEL_MAILBOX || isNestedQuotesSender(value);
}

function envMailbox(name: string): string | null {
  const raw = process.env[name]?.trim() ?? "";
  if (!raw) return null;
  const address = extractEmailAddress(raw) ?? raw;
  return isSafeMailboxAddress(address) ? address : null;
}

function firstUsableMailbox(names: string[]): string | null {
  for (const name of names) {
    const address = envMailbox(name);
    if (!address) continue;
    if (isNestedQuotesSender(address)) continue;
    return address;
  }
  return null;
}

export function fallbackApplicationFromAddress(): string | null {
  return firstUsableMailbox(["RESEND_FROM_EMAIL"]);
}

export function teamInviteFromAddress(): string | null {
  for (const name of ["RESEND_TEAM_FROM_EMAIL", "RESEND_FROM_EMAIL"]) {
    const address = envMailbox(name);
    if (!address) continue;
    if (isQuoteChannelMailbox(address)) continue;
    return address;
  }
  return null;
}

export function quoteChannelFromAddress(): string | null {
  return firstUsableMailbox(["RESEND_QUOTE_FROM_EMAIL", "RESEND_FROM_EMAIL"]);
}

export function applicationFromAddressForChannel(
  channel: ApplicationEmailChannel
): string | null {
  if (channel === "team") return teamInviteFromAddress();
  if (channel === "quote") return quoteChannelFromAddress();
  return fallbackApplicationFromAddress();
}

export function formatNamedFromHeader(
  displayName: string,
  fromAddressRaw: string
): string {
  const address = extractEmailAddress(fromAddressRaw) ?? fromAddressRaw.trim();
  const display = displayName.trim() || QUOTE_FROM_DISPLAY_FALLBACK;
  const quoted = /[,<>@"]/.test(display)
    ? `"${display.replaceAll('"', '\\"')}"`
    : display;
  return `${quoted} <${address}>`;
}

export function teamInviteFromHeader(): string | null {
  const address = teamInviteFromAddress();
  if (!address) return null;
  return formatNamedFromHeader(TEAM_FROM_DISPLAY_NAME, address);
}

export function formatQuoteDeliveryFromHeader(
  companyName: string | null | undefined,
  fromAddressRaw: string
): string {
  const company = companyName?.trim() ?? "";
  const display = company
    ? `${company} via Quotr`
    : QUOTE_FROM_DISPLAY_FALLBACK;
  return formatNamedFromHeader(display, fromAddressRaw);
}

export function quoteDeliveryFromHeader(
  companyName: string | null | undefined
): string | null {
  const address = quoteChannelFromAddress();
  if (!address) return null;
  return formatQuoteDeliveryFromHeader(companyName, address);
}

export function inviteAcceptPath(rawToken: string): string {
  return `/invite/${rawToken}`;
}

export function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

export function isEphemeralVercelOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    if (parsed.origin === PREVIEW_AUTH_SITE_ORIGIN_STABLE) return false;
    return /\.vercel\.app$/i.test(parsed.host);
  } catch {
    return false;
  }
}

export function isUsableInviteAcceptUrl(
  url: string,
  vercelEnv: string | undefined = process.env.VERCEL_ENV
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (!parsed.pathname.startsWith("/invite/")) return false;
  const token = parsed.pathname.slice("/invite/".length);
  if (token.includes("/") || !isWellFormedInviteToken(token)) return false;
  if (parsed.search || parsed.hash) return false;
  const hosted = vercelEnv === "preview" || vercelEnv === "production";
  if (hosted) {
    if (parsed.protocol !== "https:") return false;
    if (isLocalhostOrigin(parsed.origin)) return false;
    if (isEphemeralVercelOrigin(parsed.origin)) return false;
  }
  return true;
}

export function buildInviteAcceptUrl(
  origin: string,
  rawToken: string,
  vercelEnv: string | undefined = process.env.VERCEL_ENV
): string | null {
  if (!isWellFormedInviteToken(rawToken)) return null;
  const trimmed = origin.replace(/\/+$/, "");
  const url = `${trimmed}${inviteAcceptPath(rawToken)}`;
  return isUsableInviteAcceptUrl(url, vercelEnv) ? url : null;
}
