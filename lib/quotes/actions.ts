"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { logPricingAuditEvent } from "@/lib/audit/pricing-audit-log";
import { DEFAULT_GST_RATE } from "@/lib/pricing/status";
import {
  parseQuoteInput,
  validateQuoteItemTotalForPersistence,
} from "@/lib/quotes/action-guards";
import {
  createQuoteFromPricingInputSchema,
  deleteQuoteItemInputSchema,
  quoteIdInputSchema,
  reviseQuoteFromFinalPricingInputSchema,
  reviseQuoteInputSchema,
  sendQuoteToClientInputSchema,
  setQuoteItemVisibleInputSchema,
  updateQuoteInputSchema,
  updateQuoteItemInputSchema,
} from "@/lib/quotes/schemas";
import {
  isAuthOrgSuccess,
  requireAuthOrgContext,
} from "@/lib/security/auth-org-context";
import {
  assertOrgOwnsPricingDocument,
  assertOrgOwnsActiveProject,
  assertOrgOwnsQuote,
  assertOrgOwnsQuoteItem,
} from "@/lib/security/org-ownership";
import { buildQuoteSnapshotFromReviewedPricing } from "@/lib/quotes/build-from-pricing";
import { calculateQuoteBaseTotalsFromItems } from "@/lib/quotes/base-totals";
import { resolveAuthoritativeQuoteItemTotal } from "@/lib/quotes/quote-commercial-engine-adapter";
import type { QuoteItemFromPricing } from "@/lib/quotes/from-pricing";
import { appendQuoteEvent } from "@/lib/quotes/events";
import { captureQuoteIssuerSnapshot } from "@/lib/quotes/issuer-snapshot";
import { getCompanyDisplayName } from "@/lib/quotes/display";
import { mapQuote, mapQuoteItem } from "@/lib/quotes/mappers";
import { mapQuoteAcceptance } from "@/lib/quotes/acceptance-mappers";
import {
  pickLatestQuoteSummary,
  REFRESH_FROM_PRICING_STATUSES,
  REVISABLE_QUOTE_STATUSES,
} from "@/lib/quotes/revision";
import { hashQuoteSnapshotFingerprint, QUOTE_SNAPSHOT_FINGERPRINT_VERSION } from "@/lib/quotes/snapshot-fingerprint";
import {
  assertQuoteSnapshotMutable,
  assertQuoteStatusTransition,
  canIssueQuoteDelivery,
  canResendQuoteDelivery,
  quoteHasActiveSendLock,
  quoteThreadId,
} from "@/lib/quotes/transaction";
import {
  ACCEPT_QUOTE_REVISION_RPC,
  ALLOCATE_ORG_QUOTE_NUMBER_RPC,
  CREATE_QUOTE_REVISION_RPC,
  DECLINE_QUOTE_REVISION_RPC,
  EXPIRE_QUOTE_REVISION_RPC,
  FAIL_QUOTE_DELIVERY_RPC,
  FINALIZE_QUOTE_DELIVERY_RPC,
  INSERT_DRAFT_QUOTE_RPC,
  MARK_QUOTE_VIEWED_RPC,
  PREPARE_QUOTE_DELIVERY_RPC,
  RECORD_QUOTE_DELIVERY_ACCEPTED_RPC,
  SEND_QUOTE_REVISION_RPC,
  invokeQuoteDeliveryTxn,
  invokeQuoteTxn,
  mapQuoteTxnError,
} from "@/lib/quotes/quote-rpc";
import {
  fetchQuoteSummaries,
  fetchQuoteSummariesForProjects,
} from "@/lib/quotes/summary-queries";
import type {
  QuoteActionState,
  QuoteDeliveryActionState,
  QuoteInput,
  QuoteItemInput,
  QuoteSummary,
  QuoteWorkspaceData,
  QuotePrintData,
} from "@/lib/quotes/types";
import { ACTIVE_PIPELINE_STATUSES } from "@/lib/projects/status";
import { getCompanySettingsWithContext } from "@/lib/settings/company-settings-loader";
import { getLatestQuoteSummaryWithContext, getQuoteWorkspaceDataWithContext } from "@/lib/quotes/quote-loaders";
import { requireOrgEntitlement, entitlementDeniedError } from "@/lib/billing/entitlement-server";
import {
  quoteDeliveryIdempotencyKey,
  normalizeDeliveryEmail,
} from "@/lib/quotes/delivery-idempotency";
import {
  buildQuoteDeliveryEmail,
  formatQuoteDeliveryFromHeader,
  isQuoteDeliveryProviderConfigured,
  quoteDeliveryFromAddress,
  quoteDeliverySiteOrigin,
  resolveQuoteDeliveryReplyTo,
} from "@/lib/quotes/delivery-email";
import { getQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider";
import { decideQuoteSendProviderAction } from "@/lib/quotes/delivery-send-policy";
import {
  generateQuoteAccessToken,
  hashQuoteAccessToken,
  quotePublicPath,
} from "@/lib/quotes/delivery-token";
import { resolveQuoteIssuerSettings } from "@/lib/quotes/issuer-snapshot";
import { toUserError, USER_ERRORS } from "@/lib/errors/user-message";

const QUOTE_SAVE_FAILED = USER_ERRORS.quoteUpdateFailed;

function revalidateQuoteProjectPath(
  projectId: string,
  quoteId?: string,
  pricingDocumentId?: string | null
) {
  revalidatePath(`/app/projects/${projectId}`);
  if (quoteId) {
    revalidatePath(`/app/projects/${projectId}/quotes/${quoteId}`);
  }
  if (pricingDocumentId) {
    revalidatePath(
      `/app/projects/${projectId}/pricing/${pricingDocumentId}`
    );
  }
}

function revalidateQuoteDashboard(
  projectId: string,
  quoteId?: string,
  pricingDocumentId?: string | null
) {
  revalidatePath("/app/dashboard");
  revalidateQuoteProjectPath(projectId, quoteId, pricingDocumentId);
}

async function loadOwnedQuote(quoteId: string) {
  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const owned = await assertOrgOwnsQuote(auth, quoteId);
  if ("error" in owned) {
    return { error: owned.error };
  }

  const { data: quote, error } = await auth.supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("org_id", auth.orgId)
    .maybeSingle();

  if (error || !quote) {
    return { error: "Quote not found." as const };
  }

  return { ...auth, quote: mapQuote(quote) };
}

function assertQuoteEditable(quote: ReturnType<typeof mapQuote>) {
  return assertQuoteSnapshotMutable(quote);
}

type QuoteDbClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

function rpcQuoteItemPayload(item: {
  pricing_item_id?: string | null;
  work_area_id?: string | null;
  section_title?: string | null;
  section_description?: string | null;
  label: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  total?: number | null;
  visible?: boolean;
  optional?: boolean;
  sort_order?: number;
}) {
  return {
    pricing_item_id: item.pricing_item_id ?? null,
    work_area_id: item.work_area_id ?? null,
    section_title: item.section_title ?? null,
    section_description: item.section_description ?? null,
    label: item.label,
    description: item.description ?? null,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    unit_price: item.unit_price ?? null,
    total: item.total ?? 0,
    visible: item.visible ?? true,
    optional: item.optional ?? false,
    sort_order: item.sort_order ?? 0,
  };
}

function revisionQuoteFieldsFromQuote(quote: {
  pricing_document_id: string | null;
  estimate_id: string | null;
  title: string;
  client_name: string | null;
  site_address: string | null;
  issue_date: string | null;
  valid_until: string | null;
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  total_incl_gst: number;
  scope_summary: string | null;
  inclusions: string[];
  exclusions: string[];
  assumptions: string[];
  terms: string | null;
  notes_to_client: string | null;
  presentation_mode: string;
}) {
  return {
    pricing_document_id: quote.pricing_document_id,
    estimate_id: quote.estimate_id,
    title: quote.title,
    client_name: quote.client_name,
    site_address: quote.site_address,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until,
    subtotal: quote.subtotal,
    gst_rate: quote.gst_rate,
    gst_amount: quote.gst_amount,
    total_incl_gst: quote.total_incl_gst,
    scope_summary: quote.scope_summary,
    inclusions: quote.inclusions,
    exclusions: quote.exclusions,
    assumptions: quote.assumptions,
    terms: quote.terms,
    notes_to_client: quote.notes_to_client,
    presentation_mode: quote.presentation_mode,
  };
}

async function findOpenDraftInThread(
  supabase: QuoteDbClient,
  orgId: string,
  projectId: string,
  rootId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("quotes")
    .select("id")
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .eq("status", "draft")
    .is("superseded_by_quote_id", null)
    .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function recordQuoteEvent(input: {
  supabase: QuoteDbClient;
  orgId: string;
  projectId: string;
  quoteId: string;
  eventType: Parameters<typeof appendQuoteEvent>[0]["eventType"];
  userId?: string | null;
  actorType?: "user" | "client" | "system";
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  return appendQuoteEvent({
    supabase: input.supabase as never,
    orgId: input.orgId,
    projectId: input.projectId,
    quoteId: input.quoteId,
    eventType: input.eventType,
    actorType: input.actorType ?? "user",
    actorUserId: input.userId ?? null,
    metadata: input.metadata,
  });
}

async function runQuoteTxn(
  supabase: QuoteDbClient,
  fn: string,
  args: Record<string, unknown> = {}
) {
  return invokeQuoteTxn(supabase as never, fn, args);
}

async function allocateOrgQuoteNumber(
  supabase: QuoteDbClient
): Promise<{ quoteNumber: string } | { error: string }> {
  const { data, error } = await (
    supabase as never as {
      rpc: (
        fn: string
      ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    }
  ).rpc(ALLOCATE_ORG_QUOTE_NUMBER_RPC);
  if (error || typeof data !== "string" || !data.trim()) {
    return { error: mapQuoteTxnError(error) };
  }
  return { quoteNumber: data };
}

async function recalculateAndPersistQuoteTotals(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  orgId: string,
  quoteId: string,
  gstRate: number
) {
  const { data: items, error } = await supabase
    .from("quote_items")
    .select("total, visible, optional")
    .eq("quote_id", quoteId)
    .eq("org_id", orgId);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[quote-recalc-load]", error.message);
    }
    throw new Error(QUOTE_SAVE_FAILED);
  }

  const totalsResult = calculateQuoteBaseTotalsFromItems(
    items ?? [],
    gstRate,
    "quote-draft-recalc"
  );
  if (!totalsResult.ok) {
    if (process.env.NODE_ENV === "development") {
      console.error("[quote-recalc-engine]", totalsResult.error);
    }
    throw new Error(QUOTE_SAVE_FAILED);
  }
  const totals = totalsResult.totals;

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      subtotal: totals.subtotal,
      gst_amount: totals.gstAmount,
      total_incl_gst: totals.totalInclGst,
    })
    .eq("id", quoteId)
    .eq("org_id", orgId);

  if (updateError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[quote-recalc-update]", updateError.message);
    }
    throw new Error(QUOTE_SAVE_FAILED);
  }
}

async function resolveReviewedPricingDocumentId(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  orgId: string,
  projectId: string,
  sourceQuote: ReturnType<typeof mapQuote>,
  explicitPricingDocumentId?: string
): Promise<string | null> {
  if (explicitPricingDocumentId) {
    const { data } = await supabase
      .from("pricing_documents")
      .select("id, status")
      .eq("id", explicitPricingDocumentId)
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .maybeSingle();

    return data?.status === "reviewed" ? data.id : null;
  }

  if (sourceQuote.pricing_document_id) {
    const { data } = await supabase
      .from("pricing_documents")
      .select("id, status")
      .eq("id", sourceQuote.pricing_document_id)
      .eq("project_id", projectId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (data?.status === "reviewed") {
      return data.id;
    }
  }

  const { data: latest } = await supabase
    .from("pricing_documents")
    .select("id")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .eq("status", "reviewed")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latest?.id ?? null;
}

async function insertQuoteItemRows(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  orgId: string,
  projectId: string,
  quoteId: string,
  quoteItems: QuoteItemFromPricing[]
): Promise<string | null> {
  if (quoteItems.length === 0) {
    return null;
  }

  const quoteItemRows = quoteItems.map((item) => ({
    org_id: orgId,
    quote_id: quoteId,
    project_id: projectId,
    pricing_item_id: item.pricing_item_id,
    work_area_id: item.work_area_id,
    section_title: item.section_title,
    section_description: item.section_description,
    label: item.label,
    description: item.description ?? null,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total: item.total ?? 0,
    visible: item.visible ?? true,
    optional: item.optional ?? false,
    sort_order: item.sort_order,
  }));

  const { error } = await supabase.from("quote_items").insert(quoteItemRows);
  return error
    ? toUserError(error, "insertQuoteItemRows", USER_ERRORS.quoteCreateFailed)
    : null;
}

async function updateProjectBusinessStatusIfActive(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  orgId: string,
  projectId: string,
  businessStatus: string,
  extra?: Record<string, string | null>
) {
  const { data: project } = await supabase
    .from("projects")
    .select("business_status")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!project) return;

  const currentStatus = project.business_status as string;
  if (currentStatus === "won" || currentStatus === "lost") {
    return;
  }

  await supabase
    .from("projects")
    .update({
      business_status: businessStatus,
      status_updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", projectId)
    .eq("org_id", orgId);
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

export async function getQuoteSummariesForProjects(
  projectIds: string[]
): Promise<Map<string, QuoteSummary>> {
  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth) || projectIds.length === 0) {
    return new Map();
  }

  return fetchQuoteSummariesForProjects(
    auth.supabase,
    auth.orgId,
    projectIds
  );
}

export async function getQuoteSummaryForPricingDocument(
  pricingDocumentId: string
): Promise<QuoteSummary | null> {
  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return null;
  }

  const ownedDocument = await assertOrgOwnsPricingDocument(
    auth,
    pricingDocumentId
  );
  if ("error" in ownedDocument) {
    return null;
  }

  const rows = await fetchQuoteSummaries(auth.supabase, auth.orgId, {
    pricingDocumentId,
  });

  return pickLatestQuoteSummary(rows);
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

export async function getQuotePrintData(
  projectId: string,
  quoteId: string
): Promise<QuotePrintData> {
  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    notFound();
  }

  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    notFound();
  }

  const ownedQuote = await assertOrgOwnsQuote(auth, quoteId, projectId);
  if ("error" in ownedQuote) {
    notFound();
  }

  const { supabase, orgId } = auth;

  const [{ data: quote }, { data: items }, companySettings] = await Promise.all([
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

  if (!quote) {
    notFound();
  }

  const { data: acceptanceRow, error: acceptanceError } = await supabase
    .from("quote_acceptances")
    .select("*")
    .eq("org_id", orgId)
    .eq("quote_id", quoteId)
    .maybeSingle();

  return {
    quote: mapQuote(quote),
    items: (items ?? []).map((row) => mapQuoteItem(row)),
    companySettings,
    acceptance:
      !acceptanceError && acceptanceRow
        ? mapQuoteAcceptance(acceptanceRow as Record<string, unknown>)
        : null,
  };
}

export async function createQuoteFromPricing(input: {
  projectId: string;
  pricingDocumentId: string;
}): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(createQuoteFromPricingInputSchema, input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, user, orgId } = auth;
  const denied = await entitlementDeniedError(orgId, "quotes.create");
  if (denied) return denied;
  const { projectId, pricingDocumentId } = parsed.data;

  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
  }

  const ownedDocument = await assertOrgOwnsPricingDocument(
    auth,
    pricingDocumentId,
    projectId
  );
  if ("error" in ownedDocument) {
    return { error: ownedDocument.error };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title, client_name, site_address, business_status, deleted_at")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (projectError || !project || project.deleted_at) {
    return { error: "Project not found." };
  }

  const existingQuote = await fetchQuoteSummaries(supabase, orgId, {
    pricingDocumentId,
  });
  const existing = pickLatestQuoteSummary(existingQuote);
  if (existing) {
    revalidateQuoteProjectPath(projectId, existing.id, pricingDocumentId);
    redirect(`/app/projects/${projectId}/quotes/${existing.id}`);
  }

  const snapshot = await buildQuoteSnapshotFromReviewedPricing({
    supabase,
    orgId,
    projectId,
    pricingDocumentId,
    projectTitle: project.title,
    projectClientName: project.client_name,
    projectSiteAddress: project.site_address,
    reviewedErrorMessage:
      "Mark final pricing as reviewed before creating a quote.",
  });

  if ("error" in snapshot) {
    return { error: snapshot.error };
  }

  const { quoteFields, quoteItems } = snapshot;

  const created = await runQuoteTxn(supabase, INSERT_DRAFT_QUOTE_RPC, {
    p_payload: {
      projectId,
      quote: {
        pricing_document_id: pricingDocumentId,
        estimate_id: snapshot.estimateId,
        title: quoteFields.title,
        client_name: quoteFields.client_name,
        site_address: quoteFields.site_address,
        issue_date: quoteFields.issue_date,
        valid_until: quoteFields.valid_until,
        subtotal: quoteFields.subtotal,
        gst_rate: quoteFields.gst_rate,
        gst_amount: quoteFields.gst_amount,
        total_incl_gst: quoteFields.total_incl_gst,
        scope_summary: quoteFields.scope_summary,
        inclusions: quoteFields.inclusions,
        exclusions: quoteFields.exclusions,
        assumptions: quoteFields.assumptions,
        terms: quoteFields.terms,
        presentation_mode: quoteFields.presentation_mode,
      },
      items: quoteItems.map(rpcQuoteItemPayload),
    },
  });

  if ("error" in created) {
    return { error: created.error };
  }

  const quoteId = created.result.quoteId;
  if (!quoteId) {
    return { error: USER_ERRORS.quoteCreateFailed };
  }

  const currentStatus = project.business_status as string;
  if (
    ACTIVE_PIPELINE_STATUSES.includes(
      currentStatus as (typeof ACTIVE_PIPELINE_STATUSES)[number]
    ) &&
    currentStatus !== "won" &&
    currentStatus !== "lost"
  ) {
    await updateProjectBusinessStatusIfActive(
      supabase,
      orgId,
      projectId,
      "quote_draft"
    );
  }

  revalidateQuoteDashboard(projectId, quoteId, pricingDocumentId);

  await logPricingAuditEvent({
    supabase,
    organisationId: orgId,
    projectId,
    pricingDocumentId,
    quoteId,
    userId: user.id,
    action: "quote_create",
    newValues: { status: "draft", title: quoteFields.title },
  });

  redirect(`/app/projects/${projectId}/quotes/${quoteId}`);
}

export async function updateQuote(
  quoteId: string,
  input: QuoteInput
): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(updateQuoteInputSchema, {
    quoteId,
    quote: input,
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedQuote(parsed.data.quoteId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, quote } = loaded;
  const editableError = assertQuoteEditable(quote);
  if (editableError) {
    return { error: editableError };
  }

  const quoteInput = parsed.data.quote;
  const update: Record<string, unknown> = {};

  if (quoteInput.title !== undefined) update.title = quoteInput.title;
  if (quoteInput.issue_date !== undefined) {
    update.issue_date = quoteInput.issue_date;
  }
  if (quoteInput.valid_until !== undefined) {
    update.valid_until = quoteInput.valid_until;
  }
  if (quoteInput.scope_summary !== undefined) {
    update.scope_summary = quoteInput.scope_summary;
  }
  if (quoteInput.notes_to_client !== undefined) {
    update.notes_to_client = quoteInput.notes_to_client;
  }
  if (quoteInput.assumptions !== undefined) {
    update.assumptions = quoteInput.assumptions;
  }
  if (quoteInput.exclusions !== undefined) {
    update.exclusions = quoteInput.exclusions;
  }
  if (quoteInput.terms !== undefined) update.terms = quoteInput.terms;
  if (quoteInput.presentation_mode !== undefined) {
    update.presentation_mode = quoteInput.presentation_mode;
  }

  const { error } = await supabase
    .from("quotes")
    .update(update)
    .eq("id", parsed.data.quoteId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "quote-update", USER_ERRORS.quoteUpdateFailed),
    };
  }

  await recordQuoteEvent({
    supabase,
    orgId,
    projectId: quote.project_id,
    quoteId: parsed.data.quoteId,
    eventType: "quote_updated",
    userId: loaded.user.id,
    metadata: { fields: Object.keys(update) },
  });

  revalidateQuoteProjectPath(
    quote.project_id,
    parsed.data.quoteId,
    quote.pricing_document_id
  );
  return { success: true };
}

export async function updateQuoteItem(
  quoteItemId: string,
  input: QuoteItemInput
): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(updateQuoteItemInputSchema, {
    quoteItemId,
    item: input,
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, orgId } = auth;
  const item = parsed.data.item;

  const ownedItem = await assertOrgOwnsQuoteItem(
    auth,
    parsed.data.quoteItemId
  );
  if ("error" in ownedItem) {
    return { error: ownedItem.error };
  }

  const ownedQuote = await assertOrgOwnsQuote(
    auth,
    ownedItem.quoteId,
    ownedItem.projectId
  );
  if ("error" in ownedQuote) {
    return { error: ownedQuote.error };
  }

  const { data: quoteRow } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", ownedItem.quoteId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!quoteRow) {
    return { error: "Quote not found." };
  }

  const quote = mapQuote(quoteRow);
  const editableError = assertQuoteEditable(quote);
  if (editableError) {
    return { error: editableError };
  }

  const totalResult = resolveAuthoritativeQuoteItemTotal({
    quantity: item.quantity,
    unitPrice: item.unit_price,
    total: item.total,
  });
  if (!totalResult.ok) {
    return { error: totalResult.error };
  }
  const total = totalResult.total;
  const totalGuard = validateQuoteItemTotalForPersistence(total);
  if (!totalGuard.ok) {
    return { error: totalGuard.error };
  }

  const { error } = await supabase
    .from("quote_items")
    .update({
      label: item.label,
      description: item.description ?? null,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      unit_price: item.unit_price ?? null,
      total,
      visible: item.visible ?? true,
      optional: item.optional ?? false,
    })
    .eq("id", parsed.data.quoteItemId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "quote-update", USER_ERRORS.quoteUpdateFailed),
    };
  }

  await recalculateAndPersistQuoteTotals(
    supabase,
    orgId,
    ownedItem.quoteId,
    quote.gst_rate
  );

  revalidateQuoteProjectPath(
    ownedItem.projectId,
    ownedItem.quoteId,
    quote.pricing_document_id
  );
  return { success: true };
}

export async function setQuoteItemVisible(
  quoteItemId: string,
  visible: boolean
): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(setQuoteItemVisibleInputSchema, {
    quoteItemId,
    visible,
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, orgId } = auth;

  const ownedItem = await assertOrgOwnsQuoteItem(
    auth,
    parsed.data.quoteItemId
  );
  if ("error" in ownedItem) {
    return { error: ownedItem.error };
  }

  const ownedQuote = await assertOrgOwnsQuote(
    auth,
    ownedItem.quoteId,
    ownedItem.projectId
  );
  if ("error" in ownedQuote) {
    return { error: ownedQuote.error };
  }

  const { data: quoteRow } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", ownedItem.quoteId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!quoteRow) {
    return { error: "Quote not found." };
  }

  const editableError = assertQuoteEditable(mapQuote(quoteRow));
  if (editableError) {
    return { error: editableError };
  }

  const { error } = await supabase
    .from("quote_items")
    .update({ visible: parsed.data.visible })
    .eq("id", parsed.data.quoteItemId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "quote-update", USER_ERRORS.quoteUpdateFailed),
    };
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select("gst_rate, pricing_document_id")
    .eq("id", ownedItem.quoteId)
    .eq("org_id", orgId)
    .maybeSingle();

  await recalculateAndPersistQuoteTotals(
    supabase,
    orgId,
    ownedItem.quoteId,
    Number(quote?.gst_rate ?? DEFAULT_GST_RATE)
  );

  revalidateQuoteProjectPath(
    ownedItem.projectId,
    ownedItem.quoteId,
    quote?.pricing_document_id
  );
  return { success: true };
}

export async function deleteQuoteItem(
  quoteItemId: string
): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(deleteQuoteItemInputSchema, { quoteItemId });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, orgId } = auth;

  const ownedItem = await assertOrgOwnsQuoteItem(
    auth,
    parsed.data.quoteItemId
  );
  if ("error" in ownedItem) {
    return { error: ownedItem.error };
  }

  const ownedQuote = await assertOrgOwnsQuote(
    auth,
    ownedItem.quoteId,
    ownedItem.projectId
  );
  if ("error" in ownedQuote) {
    return { error: ownedQuote.error };
  }

  const { data: quoteRow } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", ownedItem.quoteId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!quoteRow) {
    return { error: "Quote not found." };
  }

  const editableError = assertQuoteEditable(mapQuote(quoteRow));
  if (editableError) {
    return { error: editableError };
  }

  const { error } = await supabase
    .from("quote_items")
    .delete()
    .eq("id", parsed.data.quoteItemId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "quote-update", USER_ERRORS.quoteUpdateFailed),
    };
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select("gst_rate, pricing_document_id")
    .eq("id", ownedItem.quoteId)
    .eq("org_id", orgId)
    .maybeSingle();

  await recalculateAndPersistQuoteTotals(
    supabase,
    orgId,
    ownedItem.quoteId,
    Number(quote?.gst_rate ?? DEFAULT_GST_RATE)
  );

  revalidateQuoteProjectPath(
    ownedItem.projectId,
    ownedItem.quoteId,
    quote?.pricing_document_id
  );
  return { success: true };
}

async function applyQuoteIssuedSideEffects(input: {
  supabase: QuoteDbClient;
  orgId: string;
  userId: string;
  quote: ReturnType<typeof mapQuote>;
  previousStatus: string;
}) {
  const now = new Date().toISOString();
  if (input.quote.pricing_document_id) {
    await input.supabase
      .from("pricing_documents")
      .update({
        status: "converted_to_quote",
        converted_to_quote_at: now,
      })
      .eq("id", input.quote.pricing_document_id)
      .eq("org_id", input.orgId);
  }

  await updateProjectBusinessStatusIfActive(
    input.supabase,
    input.orgId,
    input.quote.project_id,
    "quote_sent"
  );

  await logPricingAuditEvent({
    supabase: input.supabase,
    organisationId: input.orgId,
    projectId: input.quote.project_id,
    pricingDocumentId: input.quote.pricing_document_id,
    quoteId: input.quote.id,
    userId: input.userId,
    action: "quote_status_change",
    oldValues: { status: input.previousStatus },
    newValues: { status: "sent" },
  });
}

export async function markQuoteSent(quoteId: string): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(quoteIdInputSchema, { quoteId });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedQuote(parsed.data.quoteId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const sendEntitlement = await requireOrgEntitlement(loaded.orgId, "quotes.send");
  if (!sendEntitlement.ok) {
    return { error: sendEntitlement.error };
  }

  const { supabase, orgId, quote, user } = loaded;
  if (quoteHasActiveSendLock(quote)) {
    return {
      error: "This quote is already being sent. Retry finalising the email, or wait.",
    };
  }
  const transition = assertQuoteStatusTransition(quote.status, "sent");
  if (!transition.ok) {
    return { error: transition.error };
  }

  if (transition.idempotent) {
    return { success: true };
  }

  // Stage 3.1C.3 — hard-block issue when company identity/contact missing.
  const { getCompanySetupReadiness } = await import(
    "@/lib/setup/readiness-actions"
  );
  const readiness = await getCompanySetupReadiness();
  if (!readiness.quoteReady) {
    const detail =
      readiness.missingQuoteSetup[0]?.reason ??
      "Complete company contact details before sending this quote.";
    return {
      error: detail,
    };
  }

  const companySettings = await getCompanySettingsWithContext({
    supabase: loaded.supabase,
    orgId: loaded.orgId,
    user: loaded.user,
  });
  const issuerSnapshot = captureQuoteIssuerSnapshot(companySettings);
  if (!issuerSnapshot) {
    return {
      error: "Complete company details before sending this quote.",
    };
  }

  let quoteNumber = quote.quote_number;
  if (!quoteNumber) {
    const allocated = await allocateOrgQuoteNumber(supabase);
    if ("error" in allocated) {
      return { error: allocated.error };
    }
    quoteNumber = allocated.quoteNumber;
    const { error: numberError } = await supabase
      .from("quotes")
      .update({ quote_number: quoteNumber })
      .eq("id", parsed.data.quoteId)
      .eq("org_id", orgId)
      .eq("status", "draft");
    if (numberError) {
      return {
        error: toUserError(
          numberError,
          "quote-update",
          USER_ERRORS.quoteStatusFailed
        ),
      };
    }
  }

  const { data: itemRows } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", parsed.data.quoteId)
    .eq("org_id", orgId)
    .order("sort_order");
  const snapshotItems = (itemRows ?? []).map((row) => mapQuoteItem(row));
  const snapshotFingerprint = hashQuoteSnapshotFingerprint(
    { ...quote, quote_number: quoteNumber },
    snapshotItems,
    issuerSnapshot
  );

  const sent = await runQuoteTxn(supabase, SEND_QUOTE_REVISION_RPC, {
    p_quote_id: parsed.data.quoteId,
    p_issuer_snapshot: issuerSnapshot,
    p_snapshot_fingerprint: snapshotFingerprint,
    p_fingerprint_version: QUOTE_SNAPSHOT_FINGERPRINT_VERSION,
  });
  if ("error" in sent) {
    return { error: sent.error };
  }

  if (!sent.result.idempotent) {
    await applyQuoteIssuedSideEffects({
      supabase,
      orgId,
      userId: user.id,
      quote,
      previousStatus: quote.status,
    });
  }

  revalidateQuoteDashboard(
    quote.project_id,
    parsed.data.quoteId,
    quote.pricing_document_id
  );

  return { success: true };
}

export async function sendQuoteToClient(input: {
  quoteId: string;
  recipientName: string;
  recipientEmail: string;
  message: string;
}): Promise<QuoteDeliveryActionState> {
  const parsed = parseQuoteInput(sendQuoteToClientInputSchema, input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedQuote(parsed.data.quoteId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const entitlement = await requireOrgEntitlement(loaded.orgId, "quotes.send");
  if (!entitlement.ok) {
    return { error: entitlement.error };
  }

  const origin = quoteDeliverySiteOrigin();
  const fromAddress = quoteDeliveryFromAddress();
  if (
    !isQuoteDeliveryProviderConfigured() ||
    !origin ||
    !fromAddress
  ) {
    return {
      error:
        "Email delivery is not configured yet. Ask an admin to set the sending domain before sending quotes.",
    };
  }

  const { supabase, quote, orgId, user } = loaded;
  const isFirstSend = canIssueQuoteDelivery(quote.status);
  if (!isFirstSend && !canResendQuoteDelivery(quote.status)) {
    return { error: "This quote cannot be emailed in its current status." };
  }

  const companySettings = await getCompanySettingsWithContext(loaded);
  const issuerSnapshot = captureQuoteIssuerSnapshot(companySettings);
  if (!issuerSnapshot) {
    return {
      error: "Complete company details before sending this quote.",
    };
  }

  let quoteNumber = quote.quote_number;
  let working = quote;
  if (isFirstSend) {
    const { getCompanySetupReadiness } = await import(
      "@/lib/setup/readiness-actions"
    );
    const readiness = await getCompanySetupReadiness();
    if (!readiness.quoteReady) {
      return {
        error:
          readiness.missingQuoteSetup[0]?.reason ??
          "Complete company contact details before sending this quote.",
      };
    }
    if (!quoteNumber) {
      const allocated = await allocateOrgQuoteNumber(supabase);
      if ("error" in allocated) {
        return { error: allocated.error };
      }
      quoteNumber = allocated.quoteNumber;
      const { error: numberError } = await supabase
        .from("quotes")
        .update({ quote_number: quoteNumber })
        .eq("id", parsed.data.quoteId)
        .eq("org_id", orgId)
        .eq("status", "draft");
      if (numberError) {
        return {
          error: toUserError(
            numberError,
            "quote-update",
            USER_ERRORS.quoteStatusFailed
          ),
        };
      }
    }
    working = { ...quote, quote_number: quoteNumber };
  }

  const { data: itemRows } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", parsed.data.quoteId)
    .eq("org_id", orgId)
    .order("sort_order");
  const snapshotItems = (itemRows ?? []).map((row) => mapQuoteItem(row));
  const snapshotFingerprint = isFirstSend
    ? hashQuoteSnapshotFingerprint(working, snapshotItems, issuerSnapshot)
    : working.snapshot_fingerprint;
  if (!snapshotFingerprint) {
    return { error: USER_ERRORS.quoteStatusFailed };
  }

  const recipientEmail = normalizeDeliveryEmail(parsed.data.recipientEmail);
  const { data: latestDelivery } = await supabase
    .from("quote_deliveries")
    .select("id, status, idempotency_key, submitted_at, created_at")
    .eq("org_id", orgId)
    .eq("quote_id", working.id)
    .eq("recipient_email", recipientEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: priorAttempts } = await supabase
    .from("quote_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("quote_id", working.id);

  const kind = isFirstSend ? "send" : "resend";
  const reusableStatus =
    latestDelivery?.status === "preparing" ||
    latestDelivery?.status === "accepted";
  const idempotencyKey =
    latestDelivery?.idempotency_key && reusableStatus
      ? latestDelivery.idempotency_key
      : quoteDeliveryIdempotencyKey({
          quoteId: working.id,
          revisionNumber: working.revision_number,
          fingerprint: snapshotFingerprint,
          recipientEmail,
          kind,
          resendAttempt: kind === "resend" ? (priorAttempts ?? 0) + 1 : undefined,
        });

  const rawToken = generateQuoteAccessToken();
  const prepared = await invokeQuoteDeliveryTxn(
    supabase as never,
    PREPARE_QUOTE_DELIVERY_RPC,
    {
      p_quote_id: working.id,
      p_recipient_email: recipientEmail,
      p_recipient_name: parsed.data.recipientName,
      p_message: parsed.data.message,
      p_token_hash: hashQuoteAccessToken(rawToken),
      p_idempotency_key: idempotencyKey,
      p_snapshot_fingerprint: snapshotFingerprint,
      p_kind: kind,
    }
  );
  if ("error" in prepared) {
    return { error: prepared.error, quoteIssued: !isFirstSend };
  }

  const publicPath = quotePublicPath(rawToken);
  const decision = decideQuoteSendProviderAction(prepared.result);
  const deliveryId = prepared.result.deliveryId;
  const providerKey =
    prepared.result.idempotencyKey ?? idempotencyKey;

  if (decision === "wait") {
    revalidateQuoteDashboard(
      working.project_id,
      working.id,
      working.pricing_document_id
    );
    return {
      success: true,
      quoteIssued: !isFirstSend,
      emailInProgress: true,
      deliveryId,
      recipientEmail,
    };
  }

  if (decision === "already_submitted") {
    revalidateQuoteDashboard(
      working.project_id,
      working.id,
      working.pricing_document_id
    );
    return {
      success: true,
      quoteIssued: true,
      emailSubmitted: true,
      deliveryId,
      recipientEmail,
    };
  }

  if (!deliveryId) {
    return {
      error: USER_ERRORS.quoteDeliveryFailed,
      quoteIssued: !isFirstSend,
    };
  }

  if (decision === "submit") {
    const issuer = resolveQuoteIssuerSettings(working, companySettings);
    const { data: projectRow } = await supabase
      .from("projects")
      .select("title")
      .eq("id", working.project_id)
      .eq("org_id", loaded.orgId)
      .maybeSingle();
    const email = buildQuoteDeliveryEmail({
      quote: {
        ...working,
        snapshot_fingerprint: snapshotFingerprint,
      },
      issuer,
      recipientName: parsed.data.recipientName,
      message: parsed.data.message,
      publicUrl: `${origin}${publicPath}`,
      projectTitle:
        projectRow && typeof projectRow.title === "string"
          ? projectRow.title
          : null,
    });
    const fromHeader = formatQuoteDeliveryFromHeader(
      getCompanyDisplayName(issuer),
      fromAddress
    );
    const replyTo = resolveQuoteDeliveryReplyTo(issuer?.contactEmail);

    const provider = getQuoteDeliveryProvider();
    const submitted = await provider.send({
      to: recipientEmail,
      from: fromHeader,
      replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: providerKey,
    });

    if (!submitted.ok) {
      await invokeQuoteDeliveryTxn(supabase as never, FAIL_QUOTE_DELIVERY_RPC, {
        p_delivery_id: deliveryId,
        p_failure_code: submitted.code,
        p_failure_message_safe: USER_ERRORS.quoteDeliveryFailed,
      });
      revalidateQuoteDashboard(
        working.project_id,
        working.id,
        working.pricing_document_id
      );
      return {
        error: USER_ERRORS.quoteDeliveryFailed,
        quoteIssued: !isFirstSend,
        emailSubmitted: false,
        recipientEmail,
        publicPath,
      };
    }

    const accepted = await invokeQuoteDeliveryTxn(
      supabase as never,
      RECORD_QUOTE_DELIVERY_ACCEPTED_RPC,
      {
        p_delivery_id: deliveryId,
        p_provider_message_id: submitted.providerMessageId,
      }
    );
    if ("error" in accepted) {
      revalidateQuoteDashboard(
        working.project_id,
        working.id,
        working.pricing_document_id
      );
      return {
        error: "Email submitted — finalising Quote status.",
        quoteIssued: false,
        emailSubmitted: true,
        needsFinalize: true,
        deliveryId,
        recipientEmail,
        publicPath,
      };
    }
  }

  const finalized = await invokeQuoteDeliveryTxn(
    supabase as never,
    FINALIZE_QUOTE_DELIVERY_RPC,
    {
      p_delivery_id: deliveryId,
      p_issuer_snapshot: issuerSnapshot,
      p_snapshot_fingerprint: snapshotFingerprint,
      p_fingerprint_version: QUOTE_SNAPSHOT_FINGERPRINT_VERSION,
    }
  );
  if ("error" in finalized) {
    revalidateQuoteDashboard(
      working.project_id,
      working.id,
      working.pricing_document_id
    );
    return {
      error: "Email submitted — finalising Quote status.",
      quoteIssued: false,
      emailSubmitted: true,
      needsFinalize: true,
      deliveryId,
      recipientEmail,
      publicPath,
    };
  }

  if (isFirstSend && finalized.result.quoteStatus === "sent") {
    await applyQuoteIssuedSideEffects({
      supabase,
      orgId,
      userId: user.id,
      quote: working,
      previousStatus: "draft",
    });
  }

  revalidateQuoteDashboard(
    working.project_id,
    working.id,
    working.pricing_document_id
  );

  return {
    success: true,
    quoteIssued: true,
    emailSubmitted: true,
    recipientEmail,
    publicPath,
    deliveryId,
  };
}

export async function finalizeQuoteDelivery(
  deliveryId: string
): Promise<QuoteDeliveryActionState> {
  if (!deliveryId) {
    return { error: USER_ERRORS.quoteDeliveryFailed };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { data: delivery, error: deliveryError } = await auth.supabase
    .from("quote_deliveries")
    .select(
      "id, quote_id, snapshot_fingerprint, provider_message_id, status, kind"
    )
    .eq("id", deliveryId)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (deliveryError || !delivery) {
    return { error: "Delivery not found." };
  }
  if (!delivery.provider_message_id) {
    return { error: USER_ERRORS.quoteDeliveryFailed };
  }

  const loaded = await loadOwnedQuote(delivery.quote_id as string);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const companySettings = await getCompanySettingsWithContext(loaded);
  const issuerSnapshot = captureQuoteIssuerSnapshot(companySettings);
  if (!issuerSnapshot) {
    return {
      error: "Complete company details before sending this quote.",
    };
  }

  const fingerprint =
    (delivery.snapshot_fingerprint as string | null) ??
    loaded.quote.send_lock_fingerprint ??
    loaded.quote.snapshot_fingerprint;
  if (!fingerprint) {
    return { error: USER_ERRORS.quoteStatusFailed };
  }

  const wasDraft = loaded.quote.status === "draft";
  const finalized = await invokeQuoteDeliveryTxn(
    loaded.supabase as never,
    FINALIZE_QUOTE_DELIVERY_RPC,
    {
      p_delivery_id: delivery.id,
      p_issuer_snapshot: issuerSnapshot,
      p_snapshot_fingerprint: fingerprint,
      p_fingerprint_version: QUOTE_SNAPSHOT_FINGERPRINT_VERSION,
    }
  );
  if ("error" in finalized) {
    return {
      error: "Email submitted — finalising Quote status.",
      emailSubmitted: true,
      needsFinalize: true,
      deliveryId: delivery.id as string,
    };
  }

  if (wasDraft && finalized.result.quoteStatus === "sent") {
    await applyQuoteIssuedSideEffects({
      supabase: loaded.supabase,
      orgId: loaded.orgId,
      userId: loaded.user.id,
      quote: loaded.quote,
      previousStatus: "draft",
    });
  }

  revalidateQuoteDashboard(
    loaded.quote.project_id,
    loaded.quote.id,
    loaded.quote.pricing_document_id
  );

  return {
    success: true,
    quoteIssued: true,
    emailSubmitted: true,
    deliveryId: delivery.id as string,
  };
}

export async function markQuoteViewed(
  quoteId: string
): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(quoteIdInputSchema, { quoteId });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedQuote(parsed.data.quoteId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, quote } = loaded;
  const transition = assertQuoteStatusTransition(quote.status, "viewed");
  if (!transition.ok) {
    return { error: transition.error };
  }

  if (transition.idempotent || quote.viewed_at) {
    return { success: true };
  }

  const viewed = await runQuoteTxn(supabase, MARK_QUOTE_VIEWED_RPC, {
    p_quote_id: parsed.data.quoteId,
    p_actor_type: "user",
  });
  if ("error" in viewed) {
    return { error: viewed.error };
  }

  revalidateQuoteDashboard(
    quote.project_id,
    parsed.data.quoteId,
    quote.pricing_document_id
  );
  return { success: true };
}

export async function markQuoteAccepted(
  quoteId: string
): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(quoteIdInputSchema, { quoteId });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedQuote(parsed.data.quoteId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, quote } = loaded;
  const transition = assertQuoteStatusTransition(quote.status, "accepted");
  if (!transition.ok) {
    return { error: transition.error };
  }
  if (transition.idempotent) {
    return { success: true };
  }

  const accepted = await runQuoteTxn(supabase, ACCEPT_QUOTE_REVISION_RPC, {
    p_quote_id: parsed.data.quoteId,
  });
  if ("error" in accepted) {
    return { error: accepted.error };
  }

  if (!accepted.result.idempotent) {
    await updateProjectBusinessStatusIfActive(
      supabase,
      orgId,
      quote.project_id,
      "won",
      { won_at: new Date().toISOString() }
    );
  }

  revalidateQuoteDashboard(
    quote.project_id,
    parsed.data.quoteId,
    quote.pricing_document_id
  );
  return { success: true };
}

export async function markQuoteDeclined(
  quoteId: string
): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(quoteIdInputSchema, { quoteId });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedQuote(parsed.data.quoteId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, quote } = loaded;
  const transition = assertQuoteStatusTransition(quote.status, "declined");
  if (!transition.ok) {
    return { error: transition.error };
  }
  if (transition.idempotent) {
    return { success: true };
  }

  const declined = await runQuoteTxn(supabase, DECLINE_QUOTE_REVISION_RPC, {
    p_quote_id: parsed.data.quoteId,
  });
  if ("error" in declined) {
    return { error: declined.error };
  }

  if (!declined.result.idempotent) {
    await updateProjectBusinessStatusIfActive(
      supabase,
      orgId,
      quote.project_id,
      "lost",
      { lost_at: new Date().toISOString() }
    );
  }

  revalidateQuoteDashboard(
    quote.project_id,
    parsed.data.quoteId,
    quote.pricing_document_id
  );
  return { success: true };
}

export async function markQuoteExpired(
  quoteId: string
): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(quoteIdInputSchema, { quoteId });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedQuote(parsed.data.quoteId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, quote } = loaded;
  const transition = assertQuoteStatusTransition(quote.status, "expired");
  if (!transition.ok) {
    return { error: transition.error };
  }
  if (transition.idempotent) {
    return { success: true };
  }

  const expired = await runQuoteTxn(supabase, EXPIRE_QUOTE_REVISION_RPC, {
    p_quote_id: parsed.data.quoteId,
  });
  if ("error" in expired) {
    return { error: expired.error };
  }

  revalidateQuoteDashboard(
    quote.project_id,
    parsed.data.quoteId,
    quote.pricing_document_id
  );
  return { success: true };
}

export async function reviseQuote(input: {
  projectId: string;
  quoteId: string;
  revisionNote?: string;
}): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(reviseQuoteInputSchema, input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, orgId } = auth;
  const { projectId, quoteId, revisionNote } = parsed.data;

  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
  }

  const ownedQuote = await assertOrgOwnsQuote(auth, quoteId, projectId);
  if ("error" in ownedQuote) {
    return { error: ownedQuote.error };
  }

  const { data: sourceQuote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (quoteError || !sourceQuote) {
    return { error: "Quote not found." };
  }

  const quote = mapQuote(sourceQuote);

  if (quote.status === "draft") {
    return { error: "Draft quotes can be edited directly." };
  }

  if (quote.superseded_by_quote_id) {
    return {
      error: "This quote has been superseded. Open the latest revision instead.",
    };
  }

  if (!REVISABLE_QUOTE_STATUSES.includes(quote.status)) {
    return { error: "This quote cannot be revised." };
  }

  const rootId = quoteThreadId(quote);
  const existingDraftId = await findOpenDraftInThread(
    supabase,
    orgId,
    projectId,
    rootId
  );
  if (existingDraftId) {
    revalidateQuoteProjectPath(projectId, existingDraftId, quote.pricing_document_id);
    redirect(`/app/projects/${projectId}/quotes/${existingDraftId}`);
  }

  const { data: sourceItems, error: itemsError } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", quoteId)
    .eq("org_id", orgId)
    .order("sort_order");

  if (itemsError) {
    return {
      error: toUserError(
        itemsError,
        "reviseQuote-load-items",
        USER_ERRORS.quoteCreateFailed
      ),
    };
  }

  const created = await runQuoteTxn(supabase, CREATE_QUOTE_REVISION_RPC, {
    p_source_quote_id: quoteId,
    p_payload: {
      revisionNote: revisionNote ?? null,
      quote: revisionQuoteFieldsFromQuote(quote),
      items: (sourceItems ?? []).map((item) =>
        rpcQuoteItemPayload({
          pricing_item_id: item.pricing_item_id as string | null,
          work_area_id: item.work_area_id as string | null,
          section_title: item.section_title as string | null,
          section_description: item.section_description as string | null,
          label: item.label as string,
          description: item.description as string | null,
          quantity: item.quantity != null ? Number(item.quantity) : null,
          unit: item.unit as string | null,
          unit_price: item.unit_price != null ? Number(item.unit_price) : null,
          total: Number(item.total ?? 0),
          visible: Boolean(item.visible ?? true),
          optional: Boolean(item.optional ?? false),
          sort_order: Number(item.sort_order ?? 0),
        })
      ),
    },
  });

  if ("error" in created) {
    return { error: created.error };
  }

  const newQuoteId = created.result.quoteId;
  if (!newQuoteId) {
    return { error: USER_ERRORS.quoteRevisionFailed };
  }

  if (created.result.idempotent) {
    revalidateQuoteProjectPath(projectId, newQuoteId, quote.pricing_document_id);
    redirect(`/app/projects/${projectId}/quotes/${newQuoteId}`);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("business_status")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  const businessStatus = project?.business_status as string | undefined;
  if (
    businessStatus &&
    ACTIVE_PIPELINE_STATUSES.includes(
      businessStatus as (typeof ACTIVE_PIPELINE_STATUSES)[number]
    ) &&
    businessStatus !== "won" &&
    businessStatus !== "lost"
  ) {
    await updateProjectBusinessStatusIfActive(
      supabase,
      orgId,
      projectId,
      "quote_draft"
    );
  }

  revalidateQuoteProjectPath(projectId, newQuoteId, quote.pricing_document_id);
  redirect(`/app/projects/${projectId}/quotes/${newQuoteId}`);
}

export async function reviseQuoteFromFinalPricing(input: {
  projectId: string;
  quoteId: string;
  pricingDocumentId?: string;
  revisionNote?: string;
}): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(reviseQuoteFromFinalPricingInputSchema, input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const auth = await requireAuthOrgContext();
  if (!isAuthOrgSuccess(auth)) {
    return { error: auth.error };
  }

  const { supabase, user, orgId } = auth;
  const { projectId, quoteId, pricingDocumentId, revisionNote } = parsed.data;

  const ownedProject = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in ownedProject) {
    return { error: ownedProject.error };
  }

  const ownedQuote = await assertOrgOwnsQuote(auth, quoteId, projectId);
  if ("error" in ownedQuote) {
    return { error: ownedQuote.error };
  }

  if (pricingDocumentId) {
    const ownedDocument = await assertOrgOwnsPricingDocument(
      auth,
      pricingDocumentId,
      projectId
    );
    if ("error" in ownedDocument) {
      return { error: ownedDocument.error };
    }
  }

  const { data: sourceQuoteRow, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (quoteError || !sourceQuoteRow) {
    return { error: "Quote not found." };
  }

  const quote = mapQuote(sourceQuoteRow);

  if (quote.superseded_by_quote_id) {
    return {
      error: "This quote has been superseded. Open the latest revision instead.",
    };
  }

  if (!REFRESH_FROM_PRICING_STATUSES.includes(quote.status)) {
    return { error: "This quote cannot be revised." };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title, client_name, site_address, business_status, deleted_at")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (projectError || !project || project.deleted_at) {
    return { error: "Project not found." };
  }

  const resolvedPricingDocumentId = await resolveReviewedPricingDocumentId(
    supabase,
    orgId,
    projectId,
    quote,
    pricingDocumentId
  );

  if (!resolvedPricingDocumentId) {
    return {
      error: "Mark final pricing as reviewed before refreshing the quote.",
    };
  }

  const ownedResolvedDocument = await assertOrgOwnsPricingDocument(
    auth,
    resolvedPricingDocumentId,
    projectId
  );
  if ("error" in ownedResolvedDocument) {
    return { error: ownedResolvedDocument.error };
  }

  const snapshot = await buildQuoteSnapshotFromReviewedPricing({
    supabase,
    orgId,
    projectId,
    pricingDocumentId: resolvedPricingDocumentId,
    projectTitle: project.title,
    projectClientName: project.client_name,
    projectSiteAddress: project.site_address,
  });

  if ("error" in snapshot) {
    return { error: snapshot.error };
  }

  const { quoteFields, quoteItems } = snapshot;
  const rootId = quoteThreadId(quote);

  const applyPricingSnapshotToDraft = async (targetQuoteId: string) => {
    const { error: deleteItemsError } = await supabase
      .from("quote_items")
      .delete()
      .eq("quote_id", targetQuoteId)
      .eq("org_id", orgId);
    if (deleteItemsError) {
      return toUserError(
        deleteItemsError,
        "reviseQuote-replace-items",
        USER_ERRORS.quoteRevisionFailed
      );
    }

    const itemsError = await insertQuoteItemRows(
      supabase,
      orgId,
      projectId,
      targetQuoteId,
      quoteItems
    );
    if (itemsError) return itemsError;

    const { error: updateError } = await supabase
      .from("quotes")
      .update({
        pricing_document_id: resolvedPricingDocumentId,
        estimate_id: snapshot.estimateId,
        title: quoteFields.title,
        client_name: quoteFields.client_name,
        site_address: quoteFields.site_address,
        issue_date: quoteFields.issue_date,
        valid_until: quoteFields.valid_until,
        subtotal: quoteFields.subtotal,
        gst_rate: quoteFields.gst_rate,
        gst_amount: quoteFields.gst_amount,
        total_incl_gst: quoteFields.total_incl_gst,
        scope_summary: quoteFields.scope_summary,
        inclusions: quoteFields.inclusions,
        exclusions: quoteFields.exclusions,
        assumptions: quoteFields.assumptions,
        terms: quoteFields.terms,
        notes_to_client: quote.notes_to_client,
        presentation_mode: quote.presentation_mode,
      })
      .eq("id", targetQuoteId)
      .eq("org_id", orgId)
      .eq("status", "draft");

    if (updateError) {
      return toUserError(
        updateError,
        "reviseQuote-replace-quote",
        USER_ERRORS.quoteRevisionFailed
      );
    }
    return null;
  };

  if (quote.status === "draft") {
    const replaceError = await applyPricingSnapshotToDraft(quoteId);
    if (replaceError) return { error: replaceError };

    await recordQuoteEvent({
      supabase,
      orgId,
      projectId,
      quoteId,
      eventType: "quote_updated",
      userId: user.id,
      metadata: { source: "pricing_refresh" },
    });

    revalidateQuoteDashboard(projectId, quoteId, resolvedPricingDocumentId);
    redirect(`/app/projects/${projectId}/quotes/${quoteId}`);
  }

  const existingDraftId = await findOpenDraftInThread(
    supabase,
    orgId,
    projectId,
    rootId
  );
  if (existingDraftId) {
    const replaceError = await applyPricingSnapshotToDraft(existingDraftId);
    if (replaceError) return { error: replaceError };
    await recordQuoteEvent({
      supabase,
      orgId,
      projectId,
      quoteId: existingDraftId,
      eventType: "quote_updated",
      userId: user.id,
      metadata: { source: "pricing_refresh" },
    });
    revalidateQuoteDashboard(
      projectId,
      existingDraftId,
      resolvedPricingDocumentId
    );
    redirect(`/app/projects/${projectId}/quotes/${existingDraftId}`);
  }

  const created = await runQuoteTxn(supabase, CREATE_QUOTE_REVISION_RPC, {
    p_source_quote_id: quoteId,
    p_payload: {
      revisionNote: revisionNote ?? null,
      quote: {
        ...revisionQuoteFieldsFromQuote(quote),
        pricing_document_id: resolvedPricingDocumentId,
        estimate_id: snapshot.estimateId,
        title: quoteFields.title,
        client_name: quoteFields.client_name,
        site_address: quoteFields.site_address,
        issue_date: quoteFields.issue_date,
        valid_until: quoteFields.valid_until,
        subtotal: quoteFields.subtotal,
        gst_rate: quoteFields.gst_rate,
        gst_amount: quoteFields.gst_amount,
        total_incl_gst: quoteFields.total_incl_gst,
        scope_summary: quoteFields.scope_summary,
        inclusions: quoteFields.inclusions,
        exclusions: quoteFields.exclusions,
        assumptions: quoteFields.assumptions,
        terms: quoteFields.terms,
        notes_to_client: quote.notes_to_client,
        presentation_mode: quote.presentation_mode,
      },
      items: quoteItems.map(rpcQuoteItemPayload),
    },
  });

  if ("error" in created) {
    return { error: created.error };
  }

  const newQuoteId = created.result.quoteId;
  if (!newQuoteId) {
    return { error: USER_ERRORS.quoteRevisionFailed };
  }

  if (created.result.idempotent) {
    const replaceError = await applyPricingSnapshotToDraft(newQuoteId);
    if (replaceError) return { error: replaceError };
    await recordQuoteEvent({
      supabase,
      orgId,
      projectId,
      quoteId: newQuoteId,
      eventType: "quote_updated",
      userId: user.id,
      metadata: { source: "pricing_refresh" },
    });
    revalidateQuoteDashboard(
      projectId,
      newQuoteId,
      resolvedPricingDocumentId
    );
    redirect(`/app/projects/${projectId}/quotes/${newQuoteId}`);
  }

  const currentStatus = project.business_status as string;
  if (
    ACTIVE_PIPELINE_STATUSES.includes(
      currentStatus as (typeof ACTIVE_PIPELINE_STATUSES)[number]
    ) &&
    currentStatus !== "won" &&
    currentStatus !== "lost"
  ) {
    await updateProjectBusinessStatusIfActive(
      supabase,
      orgId,
      projectId,
      "quote_draft"
    );
  }

  revalidateQuoteDashboard(
    projectId,
    newQuoteId,
    resolvedPricingDocumentId
  );
  redirect(`/app/projects/${projectId}/quotes/${newQuoteId}`);
}
