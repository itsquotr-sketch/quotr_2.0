/**
 * Canonical site origin for auth email redirectTo URLs and application
 * invite/quote links (Stage 3.1C.2B-R1).
 *
 * Contract:
 * 1. Prefer NEXT_PUBLIC_SITE_URL when set and valid, except hosted Preview
 *    ignores localhost / commit-specific *.vercel.app and uses the stable
 *    branch alias instead (invite CTAs must not be stripped by email clients).
 * 2. Hosted Production requires NEXT_PUBLIC_SITE_URL; this module does not
 *    invent a live domain.
 * 3. Local falls back to http://localhost:3000.
 *
 * Origin only — never include /auth/callback. Callbacks are appended by
 * {@link buildAuthCallbackUrl}.
 */

import { headers } from "next/headers";
import { getSafeInternalPath } from "@/lib/auth/safe-redirect";

export const LOCAL_AUTH_SITE_ORIGIN = "http://localhost:3000";

/**
 * Stable Preview branch alias for `hardening/stage-2a-security`
 * (not a commit-specific Vercel deployment URL).
 *
 * Source: existing Preview docs (e.g. STAGE_3_1B7E register).
 * Owner should verify this still matches Vercel → Project → Domains.
 */
export const PREVIEW_AUTH_SITE_ORIGIN_STABLE =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";

/**
 * Production origin is not invented here. Set NEXT_PUBLIC_SITE_URL on the
 * Production Vercel environment once the live domain is approved.
 */
export const PRODUCTION_AUTH_SITE_ORIGIN_PLACEHOLDER =
  "https://<production-domain-when-approved>";

/**
 * Validate and normalise a configured site origin.
 * Returns null when the value must not be used as an auth email origin.
 */
export function normalizeAuthSiteOrigin(
  candidate: string | null | undefined
): string | null {
  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("//")
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  // Reject embedded credentials (https://user:pass@host)
  if (parsed.username || parsed.password) {
    return null;
  }

  // Origin-only: no path/query/hash beyond optional trailing slash
  if (parsed.search || parsed.hash) {
    return null;
  }
  if (parsed.pathname && parsed.pathname !== "/" && parsed.pathname !== "") {
    return null;
  }

  if (!parsed.hostname) {
    return null;
  }

  return parsed.origin;
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

function isEphemeralVercelOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    if (parsed.origin === PREVIEW_AUTH_SITE_ORIGIN_STABLE) return false;
    return /\.vercel\.app$/i.test(parsed.host);
  } catch {
    return false;
  }
}

/**
 * Canonical public app origin. Hosted Preview never uses localhost or a
 * commit-specific Vercel URL — those produced invite CTAs that looked like
 * buttons after email clients stripped the href.
 *
 * Production still requires NEXT_PUBLIC_SITE_URL; this does not invent a
 * live domain.
 */
export function resolveConfiguredSiteOrigin(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const vercelEnv = env.VERCEL_ENV;
  const fromEnv = normalizeAuthSiteOrigin(env.NEXT_PUBLIC_SITE_URL);

  if (vercelEnv === "preview") {
    if (
      fromEnv &&
      !isLocalhostOrigin(fromEnv) &&
      !isEphemeralVercelOrigin(fromEnv)
    ) {
      return fromEnv;
    }
    return PREVIEW_AUTH_SITE_ORIGIN_STABLE;
  }

  if (vercelEnv === "production") {
    if (
      fromEnv &&
      !isLocalhostOrigin(fromEnv) &&
      !isEphemeralVercelOrigin(fromEnv)
    ) {
      return fromEnv;
    }
    return null;
  }

  return fromEnv;
}

/**
 * Resolve the origin used when building signup/reset email redirectTo URLs
 * and application invite/quote links.
 */
export async function getAuthSiteOrigin(): Promise<string> {
  const configured = resolveConfiguredSiteOrigin();
  if (configured) {
    return configured;
  }

  if (process.env.VERCEL_ENV === "preview") {
    return PREVIEW_AUTH_SITE_ORIGIN_STABLE;
  }

  try {
    const headerStore = await headers();
    const headerOrigin = normalizeAuthSiteOrigin(headerStore.get("origin"));
    if (
      headerOrigin &&
      !isLocalhostOrigin(headerOrigin) &&
      !isEphemeralVercelOrigin(headerOrigin)
    ) {
      return headerOrigin;
    }
  } catch {
    // fall through
  }

  return LOCAL_AUTH_SITE_ORIGIN;
}

/**
 * Build `/auth/callback?next=…` against a validated origin.
 * `nextPath` is forced through {@link getSafeInternalPath}.
 */
export function buildAuthCallbackUrl(
  origin: string,
  nextPath: string
): string {
  const safeOrigin =
    normalizeAuthSiteOrigin(origin) ?? LOCAL_AUTH_SITE_ORIGIN;
  const safeNext = getSafeInternalPath(nextPath);
  const url = new URL("/auth/callback", safeOrigin);
  url.searchParams.set("next", safeNext);
  return url.toString();
}
