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
  type AnalyticsAreaLine,
  type AnalyticsEstimate,
  type AnalyticsEstimateLine,
  type AnalyticsPricingItem,
  type AnalyticsProject,
  type AnalyticsQuoteEvent,
  type AnalyticsQuoteTotal,
  type AnalyticsSnapshot,
  type AnalyticsVariation,
  type AnalyticsView,
} from "@/lib/analytics/measure";
import {
  resolveAnalyticsRequest,
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
import { markAnalytics, startAnalyticsClock, analyticsClock } from "@/lib/analytics/server-timing";
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
      kind: "invalid_range";
      error: string;
      timeZone: string;
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
  periodRaw: string | undefined,
  options?: {
    from?: string;
    to?: string;
    recordPage?: { kind: "sent" | "accepted"; offset: number };
  }
): Promise<AnalyticsPageData> {
  startAnalyticsClock();
  const auth = await requireAuthOrgContext();
  markAnalytics("pageAuth");
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
  markAnalytics("entitlement");
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

  const view = await queryAndPresent(
    auth.supabase,
    orgId,
    periodRaw,
    options?.from,
    options?.to,
    tier,
    options?.recordPage
  );
  if ("kind" in view) return view;
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
  from: string | undefined,
  to: string | undefined,
  tier: AnalyticsTier,
  recordPage?: { kind: "sent" | "accepted"; offset: number }
): Promise<AnalyticsView | { kind: "invalid_range"; error: string; timeZone: string }> {
  const tables = analyticsTablesForTier(tier);
  const [schema, timezone] = await Promise.all([
    probeProjectSchemaColumns(supabase),
    readTimezone(supabase, orgId),
  ]);
  const resolved = resolveAnalyticsRequest({
    period: periodRaw,
    from,
    to,
    timeZone: timezone,
    now: new Date(),
  });
  if (!resolved.ok) {
    return { kind: "invalid_range", error: resolved.error, timeZone: timezone };
  }
  const window = resolved.window;
  const started = Date.now();
  markAnalytics("schema");

  const canReadPipeline =
    schema.lifecycleAvailable && schema.businessStatusAvailable;
  const businessRead = tier === "business" && tables.includes("variation_accepted_adjustments");

  const headlinePromise = Promise.all([
    canReadPipeline
      ? countActiveProjects(supabase, orgId)
      : Promise.resolve({ count: null as number | null, failed: false }),
    readSends(supabase, orgId, window),
    readSnapshotsInPeriod(supabase, orgId, window),
    readEstimates(supabase, orgId, window),
  ]);
  const independentPromise = Promise.all([
    businessRead && canReadPipeline
      ? readPipelineProjects(supabase, orgId)
      : Promise.resolve({ rows: [] as AnalyticsProject[], truncated: false }),
    businessRead
      ? readVariationAdjustments(supabase, orgId, window)
      : Promise.resolve({ rows: [] as AnalyticsVariation[], truncated: false }),
    tier === "business" && tables.includes("pricing_items")
      ? readPricingItems(supabase, orgId)
      : Promise.resolve({ rows: [] as AnalyticsPricingItem[], truncated: false }),
  ]);
  const [[activeCount, sends, acceptedSnapshots, estimates], [pipeline, variationRows, pricing]] =
    await Promise.all([headlinePromise, independentPromise]);
  const wave1Ms = Date.now() - started;
  markAnalytics("headline");
  const names = new Map<string, string>();

  let projects: AnalyticsProject[] = [];
  let projectsTruncated = false;
  let cohortSnapshots: AnalyticsSnapshot[] = [];
  let timingSends: AnalyticsQuoteEvent[] = [];
  let variations: AnalyticsVariation[] = [];
  let variationsTruncated = false;

  const sentIds = new Set(sends.rows.map((row) => row.quoteId));
  const acceptedIds = new Set(acceptedSnapshots.rows.map((row) => row.quoteId));
  const cohortIds = sends.rows.map((row) => row.quoteId).filter((id) => !acceptedIds.has(id));
  const timingIds = acceptedSnapshots.rows
    .map((row) => row.quoteId)
    .filter((id) => !sentIds.has(id));
  const dependentStarted = Date.now();

  const [cohort, timing, quoteTotals, lines, quotedAreas, acceptedAreas] = await Promise.all([
    businessRead
      ? readSnapshotsForQuotes(supabase, orgId, cohortIds)
      : Promise.resolve([] as AnalyticsSnapshot[]),
    businessRead
      ? readSendsForQuotes(supabase, orgId, timingIds)
      : Promise.resolve([] as AnalyticsQuoteEvent[]),
    readQuoteTotals(
      supabase,
      orgId,
      sends.rows.map((row) => row.quoteId)
    ),
    tier === "business" && tables.includes("estimate_line_items")
      ? readEstimateLines(
          supabase,
          orgId,
          estimates.rows.map((row) => row.estimateId)
        )
      : Promise.resolve({ rows: [] as AnalyticsEstimateLine[], truncated: false }),
    tier === "business"
      ? readQuotedAreaLines(supabase, orgId, sends.rows.map((row) => row.quoteId))
      : Promise.resolve({ rows: [] as AnalyticsAreaLine[], truncated: false }),
    tier === "business"
      ? readAcceptedAreaLines(supabase, orgId, window)
      : Promise.resolve({ rows: [] as AnalyticsAreaLine[], truncated: false }),
  ]);
  const wave2Ms = Date.now() - dependentStarted;
  markAnalytics("detail");
  projects = pipeline.rows;
  projectsTruncated = pipeline.truncated;
  cohortSnapshots = cohort;
  timingSends = timing;
  variations = variationRows.rows;
  variationsTruncated = variationRows.truncated;

  for (const [id, title] of estimates.titles) names.set(id, title);

  const titleIds = [
    ...estimates.rows.map((row) => row.projectId),
    ...pricing.rows.map((row) => row.projectId),
    ...sends.rows.slice(0, 16).map((row) => row.projectId),
    ...acceptedSnapshots.rows.slice(0, 16).map((row) => row.projectId),
  ].filter((id) => !names.has(id) && !projects.some((project) => project.id === id));
  const titleMap = titleIds.length
    ? await readProjectTitles(supabase, orgId, titleIds)
    : new Map<string, string>();
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
    estimates: estimates.rows,
    quoteTotals: quoteTotals.rows,
    estimateLines: lines.rows,
    areaLines: [...quotedAreas.rows, ...acceptedAreas.rows],
    pricingItems: pricing.rows,
    activeProjectCount: activeCount.failed ? null : activeCount.count,
    limits: {
      sentTruncated: sends.truncated,
      snapshotsTruncated: acceptedSnapshots.truncated,
      projectsTruncated: tier === "business" ? projectsTruncated : false,
      variationsTruncated: tier === "business" ? variationsTruncated : false,
      estimatesTruncated: estimates.truncated,
      quoteTotalsTruncated: quoteTotals.truncated,
      linesTruncated: tier === "business" ? lines.truncated : false,
      areaMoneyTruncated:
        tier === "business" ? quotedAreas.truncated || acceptedAreas.truncated : false,
      pricingTruncated: tier === "business" ? pricing.truncated : false,
    },
  });

  markAnalytics("aggregate");
  const finished = Date.now();
  markAnalytics("response");
  return presentAnalytics(measured, tier, window, recordPage, finished - started, {
    wave1Ms,
    wave2Ms,
    serverTiming: { ...analyticsClock().marks },
  });
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

async function readEstimates(
  supabase: Supabase,
  orgId: string,
  window: PeriodWindow
): Promise<{ rows: AnalyticsEstimate[]; titles: Map<string, string>; truncated: boolean }> {
  const { data, error } = await supabase
    .from("estimates")
    .select("id, project_id, created_at, projects!inner(title, deleted_at)")
    .eq("org_id", orgId)
    .gte("created_at", window.start)
    .lt("created_at", window.end)
    .order("created_at", { ascending: false })
    .limit(QUERY_LIMIT + 1);
  if (error || !data) return { rows: [], titles: new Map(), truncated: true };
  const truncated = data.length > QUERY_LIMIT;
  const titles = new Map<string, string>();
  return {
    truncated,
    titles,
    rows: data.slice(0, QUERY_LIMIT).map((row) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      const projectId = String(row.project_id);
      if (project && "title" in project && project.title) titles.set(projectId, String(project.title));
      return {
        orgId,
        estimateId: String(row.id),
        projectId: String(row.project_id),
        createdAt: String(row.created_at),
        projectDeleted: Boolean(project && "deleted_at" in project && project.deleted_at),
      };
    }),
  };
}

async function readQuoteTotals(
  supabase: Supabase,
  orgId: string,
  quoteIds: string[]
): Promise<{ rows: AnalyticsQuoteTotal[]; truncated: boolean }> {
  const unique = [...new Set(quoteIds)];
  if (unique.length === 0) return { rows: [], truncated: false };
  const rows: AnalyticsQuoteTotal[] = [];
  for (let index = 0; index < unique.length; index += 150) {
    const slice = unique.slice(index, index + 150);
    const { data, error } = await supabase
      .from("quotes")
      .select("id, subtotal")
      .eq("org_id", orgId)
      .in("id", slice);
    if (error || !data) return { rows: [], truncated: true };
    for (const row of data) {
      const subtotal = Number(row.subtotal);
      if (!Number.isFinite(subtotal)) return { rows: [], truncated: true };
      rows.push({ orgId, quoteId: String(row.id), subtotalExGst: subtotal });
    }
  }
  return { rows, truncated: false };
}

async function readEstimateLines(
  supabase: Supabase,
  orgId: string,
  estimateIds: string[]
): Promise<{ rows: AnalyticsEstimateLine[]; truncated: boolean }> {
  const unique = [...new Set(estimateIds)];
  if (unique.length === 0) return { rows: [], truncated: false };
  const rows: AnalyticsEstimateLine[] = [];
  for (let index = 0; index < unique.length; index += 150) {
    const slice = unique.slice(index, index + 150);
    const { data, error } = await supabase
      .from("estimate_line_items")
      .select("estimate_id, work_area_name, rate_source, recommended_cost")
      .eq("org_id", orgId)
      .in("estimate_id", slice)
      .limit(QUERY_LIMIT + 1);
    if (error || !data) return { rows: [], truncated: true };
    if (rows.length + data.length > QUERY_LIMIT) {
      return { rows: rows.slice(0, QUERY_LIMIT), truncated: true };
    }
    for (const row of data) {
      rows.push({
        orgId,
        estimateId: String(row.estimate_id),
        workAreaName: String(row.work_area_name ?? ""),
        rateSource: row.rate_source == null ? null : String(row.rate_source),
        costStored: row.recommended_cost != null && Number.isFinite(Number(row.recommended_cost)),
      });
    }
  }
  return { rows, truncated: false };
}

async function readPricingItems(
  supabase: Supabase,
  orgId: string
): Promise<{ rows: AnalyticsPricingItem[]; truncated: boolean }> {
  const { data, error } = await supabase
    .from("pricing_items")
    .select(
      "project_id, pricing_document_id, client_label, notes_internal, total_cost, total_sell, pricing_documents!inner(status), projects!inner(deleted_at)"
    )
    .eq("org_id", orgId)
    .limit(QUERY_LIMIT + 1);
  if (error || !data) return { rows: [], truncated: true };
  const truncated = data.length > QUERY_LIMIT;
  return {
    truncated,
    rows: data.slice(0, QUERY_LIMIT).map((row) => {
      const document = Array.isArray(row.pricing_documents)
        ? row.pricing_documents[0]
        : row.pricing_documents;
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      return {
        orgId,
        projectId: String(row.project_id),
        label: String(row.client_label ?? "Pricing item"),
        notes: row.notes_internal == null ? null : String(row.notes_internal),
        totalCost: Number(row.total_cost ?? 0),
        totalSell: Number(row.total_sell ?? 0),
        documentArchived: Boolean(document && "status" in document && document.status === "archived"),
        projectDeleted: Boolean(project && "deleted_at" in project && project.deleted_at),
        pricingDocumentId: String(row.pricing_document_id),
      };
    }),
  };
}

function areaName(value: unknown, fallback: string): string {
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && "name" in row && typeof row.name === "string" && row.name.trim()) {
    return row.name.trim();
  }
  return fallback.trim() || "Unallocated";
}

async function readQuotedAreaLines(
  supabase: Supabase,
  orgId: string,
  quoteIds: string[]
): Promise<{ rows: AnalyticsAreaLine[]; truncated: boolean }> {
  const rows: AnalyticsAreaLine[] = [];
  for (let index = 0; index < quoteIds.length; index += 150) {
    const { data, error } = await supabase
      .from("quote_items")
      .select("quote_id, section_title, total, optional, visible, work_areas(name)")
      .eq("org_id", orgId)
      .in("quote_id", quoteIds.slice(index, index + 150))
      .limit(QUERY_LIMIT + 1);
    if (error || !data) return { rows: [], truncated: true };
    if (data.length > QUERY_LIMIT) return { rows: [], truncated: true };
    for (const row of data) {
      const total = row.total == null ? null : Number(row.total);
      rows.push({
        orgId,
        quoteId: String(row.quote_id),
        name: areaName(row.work_areas, String(row.section_title ?? "")),
        lineExGst: total != null && Number.isFinite(total) ? total : null,
        included: row.visible !== false && row.optional !== true,
        kind: "quoted",
      });
    }
  }
  return { rows, truncated: false };
}

async function readAcceptedAreaLines(
  supabase: Supabase,
  orgId: string,
  window: PeriodWindow
): Promise<{ rows: AnalyticsAreaLine[]; truncated: boolean }> {
  const { data, error } = await supabase
    .from("accepted_commercial_snapshot_lines")
    .select("line_sell_ex_gst, work_areas(name), accepted_commercial_snapshots!inner(accepted_at, quote_id)")
    .eq("org_id", orgId)
    .gte("accepted_commercial_snapshots.accepted_at", window.start)
    .lt("accepted_commercial_snapshots.accepted_at", window.end)
    .limit(QUERY_LIMIT + 1);
  if (error || !data) return { rows: [], truncated: true };
  if (data.length > QUERY_LIMIT) return { rows: [], truncated: true };
  return {
    truncated: false,
    rows: data.map((row) => {
      const snapshot = Array.isArray(row.accepted_commercial_snapshots)
        ? row.accepted_commercial_snapshots[0]
        : row.accepted_commercial_snapshots;
      const sell = row.line_sell_ex_gst == null ? null : Number(row.line_sell_ex_gst);
      return {
        orgId,
        quoteId:
          snapshot && typeof snapshot === "object" && "quote_id" in snapshot
            ? String(snapshot.quote_id)
            : "",
        name: areaName(row.work_areas, ""),
        lineExGst: sell != null && Number.isFinite(sell) ? sell : null,
        kind: "accepted" as const,
      };
    }),
  };
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
