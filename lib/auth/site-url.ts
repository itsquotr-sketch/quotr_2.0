/**
 * Canonical site origin for auth email redirectTo URLs (Stage 3.1C.2B-R1).
 *
 * Contract:
 * 1. Prefer NEXT_PUBLIC_SITE_URL when set and valid (Local / Preview / Production).
 * 2. Else fall back to the current request origin (safe for local; risky on
 *    commit-specific Vercel Preview URLs — always set env on Preview).
 * 3. Else http://localhost:3000.
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

/**
 * Resolve the origin used when building signup/reset email redirectTo URLs.
 */
export async function getAuthSiteOrigin(): Promise<string> {
  const fromEnv = normalizeAuthSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const headerStore = await headers();
    const headerOrigin = normalizeAuthSiteOrigin(headerStore.get("origin"));
    if (headerOrigin) {
      return headerOrigin;
    }

    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const protoHeader = headerStore.get("x-forwarded-proto");
    const proto =
      protoHeader === "http" || protoHeader === "https"
        ? protoHeader
        : host?.includes("localhost")
          ? "http"
          : "https";

    if (host && !host.includes("@")) {
      const built = normalizeAuthSiteOrigin(`${proto}://${host}`);
      if (built) {
        return built;
      }
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
