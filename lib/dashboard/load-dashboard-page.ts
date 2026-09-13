/**
 * PERFORMANCE-01D — single Dashboard workspace loader.
 *
 * Independent reads start together. Project list, pipeline KPIs, existence,
 * and recent activity are derived from the same rows. Does not cache project
 * state across requests.
 */
import "server-only";

import {
  deriveRecentActivity,
  type RecentActivityItem,
} from "@/lib/dashboard/derive-recent-activity";
import type { PricingSummary } from "@/lib/pricing/types";
import {
  applyProjectListFilter,
  getDashboardProjectSelect,
  probeProjectSchemaColumns,
  withLifecycleDefaults,
} from "@/lib/projects/query-utils";
import { ACTIVE_PIPELINE_STATUSES } from "@/lib/projects/status";
import type {
  DashboardPipelineSummary,
  ProjectListFilter,
  ProjectListItem,
} from "@/lib/projects/types";
import { pickLatestQuoteSummary } from "@/lib/quotes/revision";
import type { QuoteStatus, QuoteSummary } from "@/lib/quotes/types";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { getCompanySetupReadiness } from "@/lib/setup/readiness-actions";
import type { CompanySetupReadiness } from "@/lib/setup/readiness";

const ACTIVITY_SOURCE_LIMIT = 40;

const EMPTY_SUMMARY: DashboardPipelineSummary = {
  activeCount: 0,
  estimatingPricingCount: 0,
  quoteDraftCount: 0,
  quotesSentCount: 0,
  wonCount: 0,
  lostCount: 0,
};

export type DashboardPageData = {
  projects: ProjectListItem[];
  summary: DashboardPipelineSummary;
  readiness: CompanySetupReadiness;
  hasProjects: boolean;
  activity: RecentActivityItem[];
};

function summarizePipeline(
  rows: Array<{ business_status?: string | null; archived_at?: string | null }>
): DashboardPipelineSummary {
  let activeCount = 0;
  let estimatingPricingCount = 0;
  let quoteDraftCount = 0;
  let quotesSentCount = 0;
  let wonCount = 0;
  let lostCount = 0;

  for (const row of rows) {
    const status = row.business_status as string;
    const isArchived = Boolean(row.archived_at);

    if (
      !isArchived &&
      ACTIVE_PIPELINE_STATUSES.includes(
        status as (typeof ACTIVE_PIPELINE_STATUSES)[number]
      )
    ) {
      activeCount += 1;
    }
    if (status === "estimating" || status === "estimate_ready") {
      estimatingPricingCount += 1;
    }
    if (status === "quote_draft") {
      quoteDraftCount += 1;
    }
    if (status === "quote_sent") {
      quotesSentCount += 1;
    }
    if (status === "won") {
      wonCount += 1;
    }
    if (status === "lost") {
      lostCount += 1;
    }
  }

  return {
    activeCount,
    estimatingPricingCount,
    quoteDraftCount,
    quotesSentCount,
    wonCount,
    lostCount,
  };
}

function mapQuoteSummary(row: {
  id: string;
  status: string;
  pricing_document_id: string | null;
  created_at: string;
  revision_number?: number | null;
}): QuoteSummary {
  return {
    id: row.id,
    status: row.status as QuoteStatus,
    pricing_document_id: row.pricing_document_id,
    created_at: row.created_at,
    revision_number: Number(row.revision_number ?? 1),
  };
}

export async function loadDashboardPageData(options: {
  filter: ProjectListFilter;
  search: string;
}): Promise<DashboardPageData> {
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      projects: [],
      summary: EMPTY_SUMMARY,
      readiness: await getCompanySetupReadiness(),
      hasProjects: false,
      activity: [],
    };
  }

  const { supabase, orgId } = context;
  const schemaPromise = probeProjectSchemaColumns(supabase);
  const projectsPromise = schemaPromise.then(async (schema) => {
    let query = supabase
      .from("projects")
      .select(
        getDashboardProjectSelect(
          schema.lifecycleAvailable,
          schema.businessStatusAvailable,
          schema.clientEmailAvailable
        )
      )
      .order("created_at", { ascending: false });
    if (schema.lifecycleAvailable) {
      query = query.is("deleted_at", null);
    }
    return query;
  });

  const [
    schema,
    projectsResult,
    estimatesResult,
    pricingResult,
    quotesResult,
    readiness,
  ] = await Promise.all([
    schemaPromise,
    projectsPromise,
    supabase
      .from("estimates")
      .select(
        "id, project_id, is_stale, created_at, updated_at, generated_at"
      )
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("pricing_documents")
      .select("id, status, project_id, created_at, needs_recalibration")
      .eq("org_id", orgId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select(
        "id, status, pricing_document_id, created_at, revision_number, superseded_by_quote_id, project_id, quote_number, sent_at, viewed_at, accepted_at, declined_at"
      )
      .eq("org_id", orgId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    getCompanySetupReadiness(),
  ]);

  if (projectsResult.error) {
    console.error("[loadDashboardPageData] projects", projectsResult.error.message);
  }
  if (estimatesResult.error) {
    console.error("[loadDashboardPageData] estimates", estimatesResult.error.message);
  }
  if (pricingResult.error) {
    console.error("[loadDashboardPageData] pricing", pricingResult.error.message);
  }

  let quoteRows = quotesResult.data;
  if (quotesResult.error) {
    const message = quotesResult.error.message ?? "";
    const missingOptional =
      message.includes("revision_number") ||
      message.includes("superseded_by_quote_id");
    if (missingOptional) {
      const fallback = await supabase
        .from("quotes")
        .select(
          "id, status, pricing_document_id, created_at, project_id, quote_number, sent_at, viewed_at, accepted_at, declined_at"
        )
        .eq("org_id", orgId)
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      quoteRows = (fallback.data ?? []).map((row) => ({
        ...row,
        revision_number: 1,
        superseded_by_quote_id: null,
      }));
    } else {
      console.error("[loadDashboardPageData] quotes", quotesResult.error.message);
      quoteRows = [];
    }
  }

  const allProjects = ((projectsResult.data ?? []) as unknown[]).map((row) =>
    withLifecycleDefaults(row as Record<string, unknown>)
  );
  const hasProjects = allProjects.length > 0;
  const summary = schema.businessStatusAvailable
    ? summarizePipeline(allProjects)
    : {
        ...EMPTY_SUMMARY,
        activeCount: applyProjectListFilter(
          allProjects,
          "active",
          schema.lifecycleAvailable,
          schema.businessStatusAvailable
        ).length,
      };

  const estimateByProject = new Map(
    (estimatesResult.data ?? []).map((estimate) => [
      String(estimate.project_id),
      { is_stale: Boolean(estimate.is_stale) },
    ])
  );

  const pricingByProject = new Map<string, PricingSummary>();
  for (const row of pricingResult.data ?? []) {
    if (!pricingByProject.has(row.project_id)) {
      pricingByProject.set(row.project_id, {
        id: row.id,
        status: row.status as PricingSummary["status"],
        needsRecalibration: Boolean(row.needs_recalibration),
      });
    }
  }

  const quotesByProject = new Map<string, QuoteSummary[]>();
  for (const row of quoteRows ?? []) {
    if (row.superseded_by_quote_id) continue;
    const list = quotesByProject.get(row.project_id) ?? [];
    list.push(mapQuoteSummary(row));
    quotesByProject.set(row.project_id, list);
  }
  const quoteByProject = new Map<string, QuoteSummary>();
  for (const [projectId, summaries] of quotesByProject) {
    const picked = pickLatestQuoteSummary(summaries);
    if (picked) quoteByProject.set(projectId, picked);
  }

  let listed = applyProjectListFilter(
    allProjects,
    options.filter,
    schema.lifecycleAvailable,
    schema.businessStatusAvailable
  );
  const search = options.search.trim().toLowerCase();
  if (search) {
    listed = listed.filter((project) => {
      const haystack = [project.title, project.client_name, project.site_address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const projects: ProjectListItem[] = listed.map((project) => {
    const estimate = estimateByProject.get(project.id);
    return {
      ...project,
      has_estimate: Boolean(estimate),
      estimate_is_stale: estimate?.is_stale ?? false,
      pricing_summary: pricingByProject.get(project.id) ?? null,
      quote_summary: quoteByProject.get(project.id) ?? null,
    };
  });

  const titleById = new Map(
    allProjects.map((project) => [project.id, project.title ?? "Project"])
  );
  const activity = deriveRecentActivity({
    projects: allProjects.slice(0, ACTIVITY_SOURCE_LIMIT).map((project) => ({
      id: project.id,
      title: project.title,
      created_at: project.created_at,
    })),
    estimates: (estimatesResult.data ?? []).slice(0, ACTIVITY_SOURCE_LIMIT).map(
      (row) => ({
        id: String(row.id),
        project_id: String(row.project_id),
        created_at: String(row.created_at),
        updated_at: row.updated_at != null ? String(row.updated_at) : null,
        generated_at:
          row.generated_at != null ? String(row.generated_at) : null,
      })
    ),
    quotes: (quoteRows ?? []).slice(0, ACTIVITY_SOURCE_LIMIT).map((row) => ({
      id: String(row.id),
      project_id: String(row.project_id),
      quote_number: row.quote_number != null ? String(row.quote_number) : null,
      created_at: String(row.created_at),
      sent_at: row.sent_at != null ? String(row.sent_at) : null,
      viewed_at: row.viewed_at != null ? String(row.viewed_at) : null,
      accepted_at: row.accepted_at != null ? String(row.accepted_at) : null,
      declined_at: row.declined_at != null ? String(row.declined_at) : null,
      superseded_by_quote_id:
        row.superseded_by_quote_id != null
          ? String(row.superseded_by_quote_id)
          : null,
    })),
    limit: 8,
  }).map((item) => ({
    ...item,
    projectTitle: titleById.get(item.projectId) ?? item.projectTitle,
  }));

  return {
    projects,
    summary,
    readiness,
    hasProjects,
    activity,
  };
}
