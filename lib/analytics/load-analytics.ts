import "server-only";

import {
  analyticsTablesForTier,
  analyticsTierFromDecisions,
  businessAnalyticsUpgradeCopy,
  type AnalyticsTier,
} from "@/lib/analytics/access";
import {
  measureAnalytics,
  presentAnalytics,
  type AnalyticsProject,
  type AnalyticsQuoteEvent,
  type AnalyticsSnapshot,
  type AnalyticsVariation,
  type AnalyticsView,
} from "@/lib/analytics/measure";
import {
  parseAnalyticsPeriod,
  resolveAnalyticsPeriod,
  type PeriodWindow,
} from "@/lib/analytics/periods";
import { requireOrgEntitlement } from "@/lib/billing/entitlement-server";
import type {
  EntitlementReasonCode,
  UpgradeTarget,
} from "@/lib/billing/entitlement-reasons";
import { resolveDisplayTimezone } from "@/lib/org/timezone";
import { ACTIVE_PIPELINE_STATUSES } from "@/lib/projects/status";
import { probeProjectSchemaColumns } from "@/lib/projects/query-utils";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { createClient } from "@/lib/supabase/server";

const QUERY_LIMIT = 2000;

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AnalyticsPageData =
  | { kind: "unauthenticated" }
  | {
      kind: "denied";
      message: string;
      reasonCode: EntitlementReasonCode | null;
      upgradeTarget: UpgradeTarget;
    }
  | {
      kind: "ready";
      view: AnalyticsView;
      upgrade: { message: string; href: string } | null;
    };

/**
 * Organisation comes from the signed-in profile. Entitlement is checked
 * before any aggregate query. Business tables are not read for Builder.
 */
export async function loadAnalyticsPage(
  periodRaw: string | undefined
): Promise<AnalyticsPageData> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return { kind: "unauthenticated" };
  }

  const orgId = auth.orgId;
  const personal = await requireOrgEntitlement(orgId, "analytics.personal");
  if (!personal.ok) {
    return {
      kind: "denied",
      message: personal.message ?? "This is not included on the current plan.",
      reasonCode: personal.reasonCode,
      upgradeTarget: personal.upgradeTarget,
    };
  }

  const business = await requireOrgEntitlement(orgId, "analytics.business");
  const tier = analyticsTierFromDecisions({
    personalOk: true,
    businessOk: business.ok,
  });
  if (tier === "denied") {
    return {
      kind: "denied",
      message: personal.message ?? "This is not included on the current plan.",
      reasonCode: personal.reasonCode,
      upgradeTarget: personal.upgradeTarget,
    };
  }

  const view = await queryAndPresent(auth.supabase, orgId, periodRaw, tier);
  return {
    kind: "ready",
    view,
    upgrade:
      tier === "business"
        ? null
        : {
            message: businessAnalyticsUpgradeCopy(business.reasonCode),
            href: "/app/settings/billing",
          },
  };
}

async function queryAndPresent(
  supabase: Supabase,
  orgId: string,
  periodRaw: string | undefined,
  tier: AnalyticsTier
): Promise<AnalyticsView> {
  const tables = analyticsTablesForTier(tier);
  const [schema, timezone] = await Promise.all([
    probeProjectSchemaColumns(supabase),
    readTimezone(supabase, orgId),
  ]);
  const window = resolveAnalyticsPeriod({
    period: parseAnalyticsPeriod(periodRaw),
    timeZone: timezone,
    now: new Date(),
  });

  const canReadPipeline =
    schema.lifecycleAvailable && schema.businessStatusAvailable;

  const [activeCount, sends, acceptedSnapshots] = await Promise.all([
    canReadPipeline
      ? countActiveProjects(supabase, orgId)
      : Promise.resolve({ count: null as number | null, failed: false }),
    readSends(supabase, orgId, window),
    readSnapshotsInPeriod(supabase, orgId, window),
  ]);
  const names = new Map<string, string>();

  let projects: AnalyticsProject[] = [];
  let projectsTruncated = false;
  let cohortSnapshots: AnalyticsSnapshot[] = [];
  let timingSends: AnalyticsQuoteEvent[] = [];
  let variations: AnalyticsVariation[] = [];
  let variationsTruncated = false;

  if (tier === "business" && tables.includes("variation_accepted_adjustments")) {
    const sentIds = new Set(sends.rows.map((row) => row.quoteId));
    const acceptedIds = new Set(acceptedSnapshots.rows.map((row) => row.quoteId));
    const cohortIds = sends.rows
      .map((row) => row.quoteId)
      .filter((id) => !acceptedIds.has(id));
    const timingIds = acceptedSnapshots.rows
      .map((row) => row.quoteId)
      .filter((id) => !sentIds.has(id));

    const [pipeline, cohort, timing, variationRows] = await Promise.all([
      canReadPipeline
        ? readPipelineProjects(supabase, orgId)
        : Promise.resolve({ rows: [] as AnalyticsProject[], truncated: false }),
      readSnapshotsForQuotes(supabase, orgId, cohortIds),
      readSendsForQuotes(supabase, orgId, timingIds),
      readVariationAdjustments(supabase, orgId, window),
    ]);
    projects = pipeline.rows;
    projectsTruncated = pipeline.truncated;
    cohortSnapshots = cohort;
    timingSends = timing;
    variations = variationRows.rows;
    variationsTruncated = variationRows.truncated;
  }

  const titleIds = [
    ...sends.rows.slice(0, 16).map((row) => row.projectId),
    ...acceptedSnapshots.rows.slice(0, 16).map((row) => row.projectId),
  ];
  const titleMap = await readProjectTitles(supabase, orgId, titleIds);
  for (const [id, title] of titleMap) names.set(id, title);
  for (const project of projects) {
    if (!names.has(project.id)) names.set(project.id, project.title);
  }
  for (const [id, title] of names) {
    if (!projects.some((project) => project.id === id)) {
      projects.push({
        id,
        orgId,
        title,
        businessStatus: "won",
        archivedAt: null,
        deletedAt: null,
      });
    }
  }
  if (tier === "business" && !canReadPipeline) {
    projectsTruncated = true;
  }

  const measured = measureAnalytics({
    orgId,
    window,
    projects: projects.map((project) => ({
      ...project,
      title: names.get(project.id) || project.title,
    })),
    quoteEvents: [...sends.rows, ...timingSends],
    snapshots: [...acceptedSnapshots.rows, ...cohortSnapshots],
    variations,
    activeProjectCount: activeCount.failed ? null : activeCount.count,
    limits: {
      sentTruncated: sends.truncated,
      snapshotsTruncated: acceptedSnapshots.truncated,
      projectsTruncated: tier === "business" ? projectsTruncated : false,
      variationsTruncated: tier === "business" ? variationsTruncated : false,
    },
  });

  return presentAnalytics(measured, tier, window);
}

async function readTimezone(supabase: Supabase, orgId: string): Promise<string> {
  const { data } = await supabase
    .from("organisation_settings")
    .select("timezone")
    .eq("org_id", orgId)
    .maybeSingle();
  return resolveDisplayTimezone(
    typeof data?.timezone === "string" ? data.timezone : null
  );
}

async function countActiveProjects(
  supabase: Supabase,
  orgId: string
): Promise<{ count: number | null; failed: boolean }> {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .is("archived_at", null)
    .in("business_status", [...ACTIVE_PIPELINE_STATUSES]);
  if (error) return { count: null, failed: true };
  return { count: count ?? 0, failed: false };
}

async function readSends(
  supabase: Supabase,
  orgId: string,
  window: PeriodWindow
): Promise<{ rows: AnalyticsQuoteEvent[]; truncated: boolean }> {
  const { data, error } = await supabase
    .from("quote_events")
    .select("quote_id, project_id, occurred_at")
    .eq("org_id", orgId)
    .eq("event_type", "quote_sent")
    .gte("occurred_at", window.start)
    .lt("occurred_at", window.end)
    .order("occurred_at", { ascending: false })
    .limit(QUERY_LIMIT + 1);
  if (error || !data) return { rows: [], truncated: Boolean(error) };
  const truncated = data.length > QUERY_LIMIT;
  return {
    truncated,
    rows: data.slice(0, QUERY_LIMIT).map((row) => ({
      orgId,
      quoteId: String(row.quote_id),
      projectId: String(row.project_id),
      eventType: "quote_sent",
      occurredAt: String(row.occurred_at),
    })),
  };
}

async function readSnapshotsInPeriod(
  supabase: Supabase,
  orgId: string,
  window: PeriodWindow
): Promise<{ rows: AnalyticsSnapshot[]; truncated: boolean }> {
  const { data, error } = await supabase
    .from("accepted_commercial_snapshots")
    .select("quote_id, project_id, sell_ex_gst, gst_rate, sell_incl_gst, accepted_at")
    .eq("org_id", orgId)
    .gte("accepted_at", window.start)
    .lt("accepted_at", window.end)
    .order("accepted_at", { ascending: false })
    .limit(QUERY_LIMIT + 1);
  if (error || !data) return { rows: [], truncated: Boolean(error) };
  const truncated = data.length > QUERY_LIMIT;
  return {
    truncated,
    rows: data.slice(0, QUERY_LIMIT).flatMap((row) => {
      const mapped = mapSnapshot(row, orgId);
      return mapped ? [mapped] : [];
    }),
  };
}

async function readPipelineProjects(
  supabase: Supabase,
  orgId: string
): Promise<{ rows: AnalyticsProject[]; truncated: boolean }> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, business_status, archived_at, deleted_at")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .is("archived_at", null)
    .in("business_status", [...ACTIVE_PIPELINE_STATUSES])
    .limit(QUERY_LIMIT + 1);
  if (error || !data) return { rows: [], truncated: Boolean(error) };
  return {
    truncated: data.length > QUERY_LIMIT,
    rows: data.slice(0, QUERY_LIMIT).map((row) => ({
      id: String(row.id),
      orgId,
      title: typeof row.title === "string" ? row.title : "Project",
      businessStatus: String(row.business_status ?? ""),
      archivedAt: row.archived_at ? String(row.archived_at) : null,
      deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    })),
  };
}

async function readSnapshotsForQuotes(
  supabase: Supabase,
  orgId: string,
  quoteIds: string[]
): Promise<AnalyticsSnapshot[]> {
  const rows: AnalyticsSnapshot[] = [];
  for (const chunk of chunks(unique(quoteIds), 100)) {
    const { data, error } = await supabase
      .from("accepted_commercial_snapshots")
      .select("quote_id, project_id, sell_ex_gst, gst_rate, sell_incl_gst, accepted_at")
      .eq("org_id", orgId)
      .in("quote_id", chunk);
    if (error || !data) continue;
    for (const row of data) {
      const mapped = mapSnapshot(row, orgId);
      if (mapped) rows.push(mapped);
    }
  }
  return rows;
}

async function readSendsForQuotes(
  supabase: Supabase,
  orgId: string,
  quoteIds: string[]
): Promise<AnalyticsQuoteEvent[]> {
  const rows: AnalyticsQuoteEvent[] = [];
  for (const chunk of chunks(unique(quoteIds), 100)) {
    const { data, error } = await supabase
      .from("quote_events")
      .select("quote_id, project_id, occurred_at")
      .eq("org_id", orgId)
      .eq("event_type", "quote_sent")
      .in("quote_id", chunk);
    if (error || !data) continue;
    for (const row of data) {
      rows.push({
        orgId,
        quoteId: String(row.quote_id),
        projectId: String(row.project_id),
        eventType: "quote_sent",
        occurredAt: String(row.occurred_at),
      });
    }
  }
  return rows;
}

async function readVariationAdjustments(
  supabase: Supabase,
  orgId: string,
  window: PeriodWindow
): Promise<{ rows: AnalyticsVariation[]; truncated: boolean }> {
  const { data, error } = await supabase
    .from("variation_accepted_adjustments")
    .select(
      "variation_id, project_id, net_adjustment_ex_gst, gst_rate, adjustment_incl_gst, accepted_at"
    )
    .eq("org_id", orgId)
    .gte("accepted_at", window.start)
    .lt("accepted_at", window.end)
    .limit(QUERY_LIMIT + 1);
  if (error || !data) return { rows: [], truncated: Boolean(error) };
  return {
    truncated: data.length > QUERY_LIMIT,
    rows: data.slice(0, QUERY_LIMIT).flatMap((row) => {
      const net = asNumber(row.net_adjustment_ex_gst);
      const incl = asNumber(row.adjustment_incl_gst);
      const rate = asNumber(row.gst_rate);
      if (net == null || incl == null || rate == null || !row.accepted_at) return [];
      return [
        {
          orgId,
          variationId: String(row.variation_id),
          projectId: String(row.project_id),
          status: "accepted" as const,
          netAdjustmentExGst: net,
          gstRate: rate,
          adjustmentInclGst: incl,
          acceptedAt: String(row.accepted_at),
        },
      ];
    }),
  };
}

async function readProjectTitles(
  supabase: Supabase,
  orgId: string,
  projectIds: string[]
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  for (const chunk of chunks(unique(projectIds), 40)) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, title")
      .eq("org_id", orgId)
      .in("id", chunk);
    if (error || !data) continue;
    for (const row of data) {
      titles.set(String(row.id), typeof row.title === "string" ? row.title : "Project");
    }
  }
  return titles;
}

function mapSnapshot(
  row: {
    quote_id: unknown;
    project_id: unknown;
    sell_ex_gst: unknown;
    gst_rate: unknown;
    sell_incl_gst: unknown;
    accepted_at: unknown;
  },
  orgId: string
): AnalyticsSnapshot | null {
  const sellExGst = asNumber(row.sell_ex_gst);
  const sellInclGst = asNumber(row.sell_incl_gst);
  const gstRate = asNumber(row.gst_rate);
  if (sellExGst == null || sellInclGst == null || gstRate == null || !row.accepted_at) {
    return null;
  }
  return {
    orgId,
    quoteId: String(row.quote_id),
    projectId: String(row.project_id),
    sellExGst,
    gstRate,
    sellInclGst,
    acceptedAt: String(row.accepted_at),
  };
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function chunks(values: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
}
