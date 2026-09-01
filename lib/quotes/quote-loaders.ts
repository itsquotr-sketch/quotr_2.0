import "server-only";

import { notFound } from "next/navigation";
import { mapQuote, mapQuoteItem } from "@/lib/quotes/mappers";
import { pickLatestQuoteSummary } from "@/lib/quotes/revision";
import {
  fetchQuoteSummaries,
} from "@/lib/quotes/summary-queries";
import type {
  QuoteEventRecord,
  QuoteEventType,
  QuoteActorType,
  QuoteSummary,
  QuoteThreadRevision,
  QuoteWorkspaceData,
} from "@/lib/quotes/types";
import { quoteThreadId } from "@/lib/quotes/transaction";
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
import { hasClientEmailColumn } from "@/lib/projects/query-utils";

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
  const clientEmailAvailable = await hasClientEmailColumn(supabase);

  const [{ data: project }, { data: quote }, { data: items }, companySettings] =
    await Promise.all([
      clientEmailAvailable
        ? supabase
            .from("projects")
            .select("id, title, client_email, deleted_at")
            .eq("id", projectId)
            .eq("org_id", orgId)
            .maybeSingle()
        : supabase
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

  const projectClientEmail =
    "client_email" in project && typeof project.client_email === "string"
      ? project.client_email
      : null;

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

  const mappedQuote = mapQuote(quote);
  const rootId = quoteThreadId(mappedQuote);

  const { data: threadRows } = await supabase
    .from("quotes")
    .select(
      "id, revision_number, status, quote_number, sent_at, viewed_at, accepted_at, declined_at, expired_at, superseded_by_quote_id, superseded_at, created_at"
    )
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
    .order("revision_number", { ascending: true });

  const threadRevisions: QuoteThreadRevision[] = (threadRows ?? []).map(
    (row) => ({
      id: row.id,
      revision_number: Number(row.revision_number ?? 1),
      status: row.status as QuoteThreadRevision["status"],
      quote_number: row.quote_number,
      sent_at: row.sent_at,
      viewed_at: row.viewed_at ?? null,
      accepted_at: row.accepted_at,
      declined_at: row.declined_at,
      expired_at: row.expired_at,
      superseded_by_quote_id: row.superseded_by_quote_id,
      superseded_at: row.superseded_at,
      created_at: row.created_at,
    })
  );

  const threadIds = threadRevisions.map((row) => row.id);
  let recentEvents: QuoteEventRecord[] = [];
  if (threadIds.length > 0) {
    const { data: eventRows } = await supabase
      .from("quote_events")
      .select(
        "id, quote_id, event_type, actor_type, actor_user_id, occurred_at, metadata"
      )
      .eq("org_id", orgId)
      .in("quote_id", threadIds)
      .order("occurred_at", { ascending: false })
      .limit(40);
    recentEvents = (eventRows ?? []).map((row) => ({
      id: row.id,
      quote_id: row.quote_id,
      event_type: row.event_type as QuoteEventType,
      actor_type: row.actor_type as QuoteActorType,
      actor_user_id: row.actor_user_id,
      occurred_at: row.occurred_at,
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
    }));
  }

  const latestSummary = pickLatestQuoteSummary(
    threadRevisions.length > 0
      ? threadRevisions.map((row) => ({
          id: row.id,
          status: row.status,
          pricing_document_id: mappedQuote.pricing_document_id,
          created_at: row.created_at,
          revision_number: row.revision_number,
        }))
      : (projectQuotes ?? []).map((row) => ({
          id: row.id,
          status: row.status as QuoteSummary["status"],
          pricing_document_id: row.pricing_document_id,
          created_at: row.created_at,
          revision_number: Number(row.revision_number ?? 1),
        }))
  );

  const { data: deliveryRows, error: deliveryError } = await supabase
    .from("quote_deliveries")
    .select(
      "id, quote_id, recipient_email, recipient_name, message, provider, kind, status, attempt_number, snapshot_fingerprint, provider_message_id, submitted_at, delivered_at, failed_at, failure_code, failure_message_safe, created_at"
    )
    .eq("org_id", orgId)
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(20);

  const deliveries = deliveryError
    ? []
    : (deliveryRows ?? []).map((row) => ({
    id: row.id as string,
    quote_id: row.quote_id as string,
    recipient_email: row.recipient_email as string,
    recipient_name: (row.recipient_name as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    provider: (row.provider as string) ?? "resend",
    kind: row.kind === "resend" ? "resend" as const : row.kind === "send" ? "send" as const : undefined,
    status: row.status as import("@/lib/quotes/delivery-types").QuoteDeliveryStatus,
    attempt_number: Number(row.attempt_number ?? 1),
    snapshot_fingerprint:
      (row.snapshot_fingerprint as string | null | undefined) ?? null,
    provider_message_id:
      (row.provider_message_id as string | null | undefined) ?? null,
    submitted_at: (row.submitted_at as string | null) ?? null,
    delivered_at: (row.delivered_at as string | null) ?? null,
    failed_at: (row.failed_at as string | null) ?? null,
    failure_code: (row.failure_code as string | null) ?? null,
    failure_message_safe:
      (row.failure_message_safe as string | null) ?? null,
    created_at: row.created_at as string,
  }));

  return {
    projectTitle: project.title,
    projectClientEmail,
    quote: mappedQuote,
    items: (items ?? []).map((row) => mapQuoteItem(row)),
    companySettings,
    pricingDocumentUpdatedAt,
    latestRevisionQuoteId: latestSummary?.id ?? null,
    threadRevisions,
    recentEvents,
    deliveries,
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
