import type { SupabaseClient } from "@supabase/supabase-js";
import {
  pickLatestQuoteSummary,
  type QuoteSummaryRow,
} from "@/lib/quotes/revision";
import type { QuoteStatus, QuoteSummary } from "@/lib/quotes/types";

type QuoteSummaryFilter = {
  projectId?: string;
  pricingDocumentId?: string;
};

function isMissingOptionalQuoteColumnError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }
  return (
    message.includes("revision_number") ||
    message.includes("superseded_by_quote_id")
  );
}

function mapRowToSummary(row: {
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

export async function fetchQuoteSummaries(
  supabase: SupabaseClient,
  orgId: string,
  filter: QuoteSummaryFilter
): Promise<QuoteSummaryRow[]> {
  let query = supabase
    .from("quotes")
    .select(
      "id, status, pricing_document_id, created_at, revision_number, superseded_by_quote_id"
    )
    .eq("org_id", orgId)
    .neq("status", "archived");

  if (filter.projectId) {
    query = query.eq("project_id", filter.projectId);
  }
  if (filter.pricingDocumentId) {
    query = query.eq("pricing_document_id", filter.pricingDocumentId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (!error && data) {
    return data
      .filter((row) => !row.superseded_by_quote_id)
      .map((row) => mapRowToSummary(row));
  }

  if (!isMissingOptionalQuoteColumnError(error?.message)) {
    console.error("[fetchQuoteSummaries]", error?.message);
    return [];
  }

  let fallbackQuery = supabase
    .from("quotes")
    .select("id, status, pricing_document_id, created_at")
    .eq("org_id", orgId)
    .neq("status", "archived");

  if (filter.projectId) {
    fallbackQuery = fallbackQuery.eq("project_id", filter.projectId);
  }
  if (filter.pricingDocumentId) {
    fallbackQuery = fallbackQuery.eq(
      "pricing_document_id",
      filter.pricingDocumentId
    );
  }

  const { data: fallbackData, error: fallbackError } =
    await fallbackQuery.order("created_at", { ascending: false });

  if (fallbackError || !fallbackData) {
    console.error("[fetchQuoteSummaries] fallback", fallbackError?.message);
    return [];
  }

  return fallbackData.map((row) => mapRowToSummary(row));
}

export async function fetchQuoteSummariesForProjects(
  supabase: SupabaseClient,
  orgId: string,
  projectIds: string[]
): Promise<Map<string, QuoteSummary>> {
  const result = new Map<string, QuoteSummary>();
  if (projectIds.length === 0) {
    return result;
  }

  const query = supabase
    .from("quotes")
    .select(
      "id, status, pricing_document_id, created_at, revision_number, superseded_by_quote_id, project_id"
    )
    .eq("org_id", orgId)
    .in("project_id", projectIds)
    .neq("status", "archived");

  const { data, error } = await query.order("created_at", { ascending: false });

  let rows:
    | Array<{
        id: string;
        status: string;
        pricing_document_id: string | null;
        created_at: string;
        revision_number?: number | null;
        superseded_by_quote_id?: string | null;
        project_id: string;
      }>
    | null = data;

  if (error && isMissingOptionalQuoteColumnError(error.message)) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("quotes")
      .select("id, status, pricing_document_id, created_at, project_id")
      .eq("org_id", orgId)
      .in("project_id", projectIds)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (fallbackError || !fallbackData) {
      console.error(
        "[fetchQuoteSummariesForProjects] fallback",
        fallbackError?.message
      );
      return result;
    }
    rows = fallbackData.map((row) => ({
      ...row,
      superseded_by_quote_id: null,
      revision_number: 1,
    }));
  } else if (error || !rows) {
    console.error("[fetchQuoteSummariesForProjects]", error?.message);
    return result;
  }

  const byProject = new Map<string, QuoteSummaryRow[]>();
  for (const row of rows) {
    if (row.superseded_by_quote_id) {
      continue;
    }
    const mapped = mapRowToSummary(row);
    const list = byProject.get(row.project_id) ?? [];
    list.push(mapped);
    byProject.set(row.project_id, list);
  }

  for (const [projectId, summaries] of byProject) {
    const picked = pickLatestQuoteSummary(summaries);
    if (picked) {
      result.set(projectId, picked);
    }
  }

  return result;
}
