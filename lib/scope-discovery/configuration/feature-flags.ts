/**
 * Server-only feature flags for Intelligent Scope Discovery.
 * Never use NEXT_PUBLIC_ — client must not control enablement.
 */

export const SCOPE_DISCOVERY_ENABLED_ENV = "SCOPE_DISCOVERY_ENABLED" as const;

/** Explicit enable token — anything else (including absent) is disabled. */
export const SCOPE_DISCOVERY_ENABLED_VALUE = "true" as const;

/**
 * Parse SCOPE_DISCOVERY_ENABLED from an env map.
 * Absent, empty, or any value other than exact `true` → disabled.
 */
export function isScopeDiscoveryEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  const raw = env[SCOPE_DISCOVERY_ENABLED_ENV];
  if (raw === undefined || raw === null) return false;
  return raw.trim() === SCOPE_DISCOVERY_ENABLED_VALUE;
}
