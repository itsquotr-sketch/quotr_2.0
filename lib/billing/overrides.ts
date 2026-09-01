import type { OrgBillingOverride } from "@/lib/billing/types";

export function isBillingOverrideActive(
  override: Pick<OrgBillingOverride, "startsAt" | "expiresAt" | "status">,
  now: Date = new Date()
): boolean {
  if (override.status === "expired" || override.status === "revoked") {
    return false;
  }
  const start = new Date(override.startsAt).getTime();
  if (Number.isFinite(start) && now.getTime() < start) {
    return false;
  }
  if (override.expiresAt) {
    const end = new Date(override.expiresAt).getTime();
    if (Number.isFinite(end) && now.getTime() >= end) {
      return false;
    }
  }
  return true;
}

export function selectActiveBillingOverride(
  overrides: OrgBillingOverride[],
  now: Date = new Date()
): OrgBillingOverride | null {
  const active = overrides.filter((row) => isBillingOverrideActive(row, now));
  active.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return active[0] ?? null;
}
