import "server-only";

import { notFound } from "next/navigation";
import { mapQuote, mapQuoteItem } from "@/lib/quotes/mappers";
import { pickLatestQuoteSummary } from "@/lib/quotes/revision";
import {
  fetchQuoteSummaries,
} from "@/lib/quotes/summary-queries";
import type {
  QuoteSummary,
  QuoteWorkspaceData,
} from "@/lib/quotes/types";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import {
  isAuthOrgSuccess,
  requireAuthOrgContext,
} from "@/lib/security/auth-org-context";
import {
  assertOrgOwnsActiveProject,
  assertOrgOwnsQuote,
} from "@/lib/security/org-ownership";
import { getCompanySettingsWithContext } from "@/lib/settings/company-settings-loader";

export async function getLatestQuoteSummaryWithContext(
  auth: AuthOrgContext,
  projectId: string
): Promise<QuoteSummary | null> {
  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    return null;
  }

  const rows = await fetchQuoteSummaries(auth.supabase, auth.orgId, {
    projectId,
  });

  return pickLatestQuoteSummary(rows);
}

export async function getQuoteWorkspaceDataWithContext(
  auth: AuthOrgContext,
  projectId: string,
  quoteId: string
): Promise<QuoteWorkspaceData> {
  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    notFound();
  }

  const ownedQuote = await assertOrgOwnsQuote(auth, quoteId, projectId);
  if ("error" in ownedQuote) {
    notFound();
  }

  const { supabase, orgId } = auth;

  const [{ data: project }, { data: quote }, { data: items }, companySettings] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, title, deleted_at")
        .eq("id", projectId)
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .eq("project_id", projectId)
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quoteId)
        .eq("org_id", orgId)
        .order("sort_order"),
      getCompanySettingsWithContext(auth),
    ]);

  if (!project || project.deleted_at || !quote) {
    notFound();
  }

  let pricingDocumentUpdatedAt: string | null = null;
  if (quote.pricing_document_id) {
    const { data: pricingDoc } = await supabase
      .from("pricing_documents")
      .select("updated_at")
      .eq("id", quote.pricing_document_id)
      .eq("org_id", orgId)
      .maybeSingle();
    pricingDocumentUpdatedAt = pricingDoc?.updated_at ?? null;
  }

  const { data: projectQuotes } = await supabase
    .from("quotes")
    .select("id, status, pricing_document_id, created_at, revision_number")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .neq("status", "archived");

  const latestSummary = pickLatestQuoteSummary(
    (projectQuotes ?? []).map((row) => ({
      id: row.id,
      status: row.status as QuoteSummary["status"],
      pricing_document_id: row.pricing_document_id,
      created_at: row.created_at,
      revision_number: Number(row.revision_number ?? 1),
    }))
  );

  return {
    projectTitle: project.title,
    quote: mapQuote(quote),
    items: (items ?? []).map((row) => mapQuoteItem(row)),
    companySettings,
    pricingDocumentUpdatedAt,
    latestRevisionQuoteId: latestSummary?.id ?? null,
  };
}

export async function getLatestQuoteSummary(
  projectId: string
): Promise<QuoteSummary | null> {
  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return null;
  }
  return getLatestQuoteSummaryWithContext(auth, projectId);
}

export async function getQuoteWorkspaceData(
  projectId: string,
  quoteId: string
): Promise<QuoteWorkspaceData> {
  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    notFound();
  }
  return getQuoteWorkspaceDataWithContext(auth, projectId, quoteId);
}
