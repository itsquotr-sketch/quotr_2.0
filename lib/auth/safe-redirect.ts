/**
 * Safe internal redirect destinations for auth return paths (Stage 3.1C.2B).
 *
 * ALLOW: relative paths beginning with a single `/`
 * REJECT: absolute URLs, protocol-relative `//`, javascript:, data:, etc.
 */

export const DEFAULT_AUTH_DESTINATION = "/app/dashboard";

/**
 * Returns a safe internal path or the default dashboard destination.
 */
export function getSafeInternalPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_AUTH_DESTINATION
): string {
  if (typeof candidate !== "string") {
    return fallback;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return fallback;
  }

  // Must be a single-slash relative path (not protocol-relative //…)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("/\\") ||
    lower.includes("://") ||
    lower.startsWith("/javascript:") ||
    lower.includes("javascript:") ||
    lower.includes("data:") ||
    lower.includes("vbscript:")
  ) {
    return fallback;
  }

  // Disallow backslash tricks / encoded separators that confuse some parsers
  if (trimmed.includes("\\") || trimmed.includes("%2f%2f") || /%00/i.test(trimmed)) {
    return fallback;
  }

  // Only allow app / auth recovery destinations we control
  // Keep open to any /app/* deep link; reject other roots except known auth pages
  if (
    trimmed.startsWith("/app/") ||
    trimmed === "/app" ||
    trimmed.startsWith("/reset-password") ||
    trimmed === "/reset-password" ||
    trimmed.startsWith("/invite/")
  ) {
    return trimmed;
  }

  // Login/signup/forgot are not useful post-auth return targets
  if (
    trimmed.startsWith("/login") ||
    trimmed.startsWith("/signup") ||
    trimmed.startsWith("/forgot-password") ||
    trimmed.startsWith("/auth/")
  ) {
    return fallback;
  }

  return fallback;
}

/**
 * Read `next` from FormData or URLSearchParams safely.
 */
export function readSafeNext(
  source: FormData | URLSearchParams | { get(name: string): string | null },
  fallback: string = DEFAULT_AUTH_DESTINATION
): string {
  const raw =
    typeof source.get === "function" ? source.get("next") : null;
  return getSafeInternalPath(
    typeof raw === "string" ? raw : null,
    fallback
  );
}
