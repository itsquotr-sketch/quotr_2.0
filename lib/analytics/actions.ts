"use server";

import { deniedBusinessAnalytics } from "@/lib/analytics/access";
import { loadAnalyticsPage } from "@/lib/analytics/load-analytics";
import type { BusinessAnalyticsView } from "@/lib/analytics/measure";
import { requireOrgEntitlement } from "@/lib/billing/entitlement-server";
import type {
  EntitlementReasonCode,
  UpgradeTarget,
} from "@/lib/billing/entitlement-reasons";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";

export type BusinessAnalyticsDirectResult =
  | {
      ok: false;
      error: string;
      reasonCode: EntitlementReasonCode | null;
      upgradeTarget: UpgradeTarget;
    }
  | { ok: true; view: BusinessAnalyticsView };

/**
 * Direct Business aggregate. Builder is refused before any query.
 * The organisation is the signed-in profile, never an argument.
 */
export async function loadBusinessAnalyticsDirect(
  periodRaw: string
): Promise<BusinessAnalyticsDirectResult> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return deniedBusinessAnalytics({
      message: "Sign in required.",
      reasonCode: null,
      upgradeTarget: null,
    });
  }

  const business = await requireOrgEntitlement(auth.orgId, "analytics.business");
  if (!business.ok) {
    return deniedBusinessAnalytics({
      message: business.message,
      reasonCode: business.reasonCode,
      upgradeTarget: business.upgradeTarget,
    });
  }

  const loaded = await loadAnalyticsPage(periodRaw);
  if (loaded.kind !== "ready" || loaded.view.tier !== "business") {
    return deniedBusinessAnalytics({
      message: "This is not included on the current plan.",
      reasonCode: "upgrade_required",
      upgradeTarget: "business",
    });
  }

  return { ok: true, view: loaded.view };
}
