/**
 * Shared client-minted identity for nested collections (Wall Types, Ceiling
 * Portions, Bulkheads, Openings). Prefer crypto.randomUUID. Fallback prefixes
 * stay caller-specific so Internal Walls `wt-` / `op-` IDs remain valid.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createStableClientId(fallbackPrefix?: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const fallback = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  return fallbackPrefix ? `${fallbackPrefix}-${fallback}` : fallback;
}

export function isStableClientId(
  value: unknown,
  fallbackPrefix?: string
): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (UUID_RE.test(trimmed)) return true;
  if (!fallbackPrefix) return false;
  const escaped = fallbackPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}-[0-9a-f]+-[0-9a-f]+$`, "i").test(trimmed);
}
