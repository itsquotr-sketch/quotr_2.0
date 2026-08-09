/**
 * Resolve public site origin for auth email redirectTo URLs.
 * Prefer request origin; fall back to NEXT_PUBLIC_SITE_URL / localhost.
 */

import { headers } from "next/headers";

export async function getAuthSiteOrigin(): Promise<string> {
  try {
    const headerStore = await headers();
    const origin = headerStore.get("origin");
    if (origin?.startsWith("http")) {
      return origin.replace(/\/$/, "");
    }
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto") ?? "https";
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // fall through
  }

  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv?.startsWith("http")) {
    return fromEnv.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function buildAuthCallbackUrl(
  origin: string,
  nextPath: string
): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", nextPath);
  return url.toString();
}
