"use server";

import { deniedBusinessAnalytics } from "@/lib/analytics/access";
import { loadAnalyticsPage } from "@/lib/analytics/load-analytics";
import {
  ANALYTICS_LINK_LIMIT,
  type AnalyticsRecordLink,
  type BusinessAnalyticsView,
} from "@/lib/analytics/measure";
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

export type AnalyticsRecordWindowResult =
  | { ok: false; error: string }
  | {
      ok: true;
      records: AnalyticsRecordLink[];
      total: number;
      offset: number;
      limit: number;
    };

/**
 * One later page of the same sent or accepted quotes.
 * The response is the record page only. Business measures are not returned.
 */
export async function loadAnalyticsRecordWindow(
  periodRaw: string,
  kind: "sent" | "accepted",
  offset: number,
  from?: string,
  to?: string
): Promise<AnalyticsRecordWindowResult> {
  if (kind !== "sent" && kind !== "accepted") {
    return { ok: false, error: "Unknown record list." };
  }
  const loaded = await loadAnalyticsPage(periodRaw, {
    recordPage: { kind, offset },
    from,
    to,
  });
  if (loaded.kind === "unauthenticated") {
    return { ok: false, error: "Sign in required." };
  }
  if (loaded.kind === "invalid_range") {
    return { ok: false, error: loaded.error };
  }
  if (loaded.kind === "denied") {
    return { ok: false, error: loaded.message };
  }
  const records = kind === "sent" ? loaded.view.sentRecords : loaded.view.acceptedRecords;
  const total = kind === "sent" ? loaded.view.sentRecordTotal : loaded.view.acceptedRecordTotal;
  const start = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  return {
    ok: true,
    records,
    total,
    offset: start,
    limit: ANALYTICS_LINK_LIMIT,
  };
}

/** Period change without re-rendering the app shell. Entitlement is checked inside the loader. */
export async function loadAnalyticsPeriodView(periodRaw: string, from?: string, to?: string) {
  return loadAnalyticsPage(periodRaw, { from, to });
}

/** Headline measures only. Business panels are loaded separately. */
export async function loadAnalyticsHeadlineView(periodRaw: string, from?: string, to?: string) {
  return loadAnalyticsPage(periodRaw, { from, to, scope: "headline" });
}

/** Work areas, pricing, rate sources, pipeline, and variations for the same range. */
export async function loadAnalyticsBusinessView(periodRaw: string, from?: string, to?: string) {
  return loadAnalyticsPage(periodRaw, { from, to, scope: "business" });
}
