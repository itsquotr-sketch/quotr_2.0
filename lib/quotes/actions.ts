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
import {
  calculateAuthoritativeQuoteTotals,
  resolveAuthoritativeQuoteItemTotal,
} from "@/lib/quotes/quote-commercial-engine-adapter";
import type { QuoteItemFromPricing } from "@/lib/quotes/from-pricing";
import { mapQuote, mapQuoteItem } from "@/lib/quotes/mappers";
import {
  pickLatestQuoteSummary,
  REFRESH_FROM_PRICING_STATUSES,
  REVISABLE_QUOTE_STATUSES,
} from "@/lib/quotes/revision";
import {
  fetchQuoteSummaries,
  fetchQuoteSummariesForProjects,
} from "@/lib/quotes/summary-queries";
import type {
  QuoteActionState,
  QuoteInput,
  QuoteItemInput,
  QuoteSummary,
  QuoteWorkspaceData,
  QuotePrintData,
} from "@/lib/quotes/types";
import { ACTIVE_PIPELINE_STATUSES } from "@/lib/projects/status";
import { getCompanySettingsWithContext } from "@/lib/settings/company-settings-loader";
import { getLatestQuoteSummaryWithContext, getQuoteWorkspaceDataWithContext } from "@/lib/quotes/quote-loaders";
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
  if (quote.status !== "draft") {
    return "Only draft quotes can be edited. Create a revision instead." as const;
  }
  if (quote.superseded_by_quote_id) {
    return "This quote has been superseded. Open the latest revision to edit." as const;
  }
  return null;
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
    .select("total, visible")
    .eq("quote_id", quoteId)
    .eq("org_id", orgId);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[quote-recalc-load]", error.message);
    }
    throw new Error(QUOTE_SAVE_FAILED);
  }

  const totalsResult = calculateAuthoritativeQuoteTotals(
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

  return {
    quote: mapQuote(quote),
    items: (items ?? []).map((row) => mapQuoteItem(row)),
    companySettings,
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

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      org_id: orgId,
      project_id: projectId,
      pricing_document_id: pricingDocumentId,
      estimate_id: snapshot.estimateId,
      title: quoteFields.title,
      status: "draft",
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
      created_by: user.id,
    })
    .select("id")
    .single();

  if (quoteError || !quote) {
    return {
      error: toUserError(
        quoteError,
        "createQuoteFromPricing",
        USER_ERRORS.quoteCreateFailed
      ),
    };
  }

  const quoteId = quote.id;
  const itemsError = await insertQuoteItemRows(
    supabase,
    orgId,
    projectId,
    quoteId,
    quoteItems
  );

  if (itemsError) {
    await supabase
      .from("quotes")
      .delete()
      .eq("id", quoteId)
      .eq("org_id", orgId);
    return { error: itemsError };
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

export async function markQuoteSent(quoteId: string): Promise<QuoteActionState> {
  const parsed = parseQuoteInput(quoteIdInputSchema, { quoteId });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const loaded = await loadOwnedQuote(parsed.data.quoteId);
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  const { supabase, orgId, quote, user } = loaded;

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

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("quotes")
    .update({
      status: "sent",
      sent_at: now,
    })
    .eq("id", parsed.data.quoteId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "quote-update", USER_ERRORS.quoteUpdateFailed),
    };
  }

  if (quote.pricing_document_id) {
    await supabase
      .from("pricing_documents")
      .update({
        status: "converted_to_quote",
        converted_to_quote_at: now,
      })
      .eq("id", quote.pricing_document_id)
      .eq("org_id", orgId);
  }

  await updateProjectBusinessStatusIfActive(
    supabase,
    orgId,
    quote.project_id,
    "quote_sent"
  );

  revalidateQuoteDashboard(
    quote.project_id,
    parsed.data.quoteId,
    quote.pricing_document_id
  );

  await logPricingAuditEvent({
    supabase,
    organisationId: orgId,
    projectId: quote.project_id,
    pricingDocumentId: quote.pricing_document_id,
    quoteId: parsed.data.quoteId,
    userId: user.id,
    action: "quote_status_change",
    oldValues: { status: quote.status },
    newValues: { status: "sent" },
  });

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
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("quotes")
    .update({
      status: "accepted",
      accepted_at: now,
    })
    .eq("id", parsed.data.quoteId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "quote-update", USER_ERRORS.quoteUpdateFailed),
    };
  }

  await updateProjectBusinessStatusIfActive(
    supabase,
    orgId,
    quote.project_id,
    "won",
    { won_at: now }
  );

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
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("quotes")
    .update({
      status: "declined",
      declined_at: now,
    })
    .eq("id", parsed.data.quoteId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "quote-update", USER_ERRORS.quoteUpdateFailed),
    };
  }

  await updateProjectBusinessStatusIfActive(
    supabase,
    orgId,
    quote.project_id,
    "lost",
    { lost_at: now }
  );

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

  const { supabase, orgId, quote } = loaded;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("quotes")
    .update({
      status: "expired",
      expired_at: now,
    })
    .eq("id", parsed.data.quoteId)
    .eq("org_id", orgId);

  if (error) {
    return {
      error: toUserError(error, "quote-update", USER_ERRORS.quoteUpdateFailed),
    };
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

  const { supabase, user, orgId } = auth;
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

  if (!REVISABLE_QUOTE_STATUSES.includes(quote.status)) {
    return { error: "This quote cannot be revised." };
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

  const rootId = quote.parent_quote_id ?? quote.id;

  const { data: chainQuotes, error: chainError } = await supabase
    .from("quotes")
    .select("revision_number")
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
    .order("revision_number", { ascending: false })
    .limit(1);

  if (chainError) {
    return {
      error: toUserError(
        chainError,
        "reviseQuote-chain",
        USER_ERRORS.quoteRevisionFailed
      ),
    };
  }

  const nextRevision =
    Number(chainQuotes?.[0]?.revision_number ?? quote.revision_number) + 1;
  const now = new Date().toISOString();

  const { data: newQuote, error: insertError } = await supabase
    .from("quotes")
    .insert({
      org_id: orgId,
      project_id: projectId,
      pricing_document_id: quote.pricing_document_id,
      estimate_id: quote.estimate_id,
      quote_number: quote.quote_number,
      title: quote.title,
      status: "draft",
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
      created_by: user.id,
      revision_number: nextRevision,
      parent_quote_id: rootId,
      revised_from_quote_id: quote.id,
      revision_note: revisionNote ?? null,
    })
    .select("id")
    .single();

  if (insertError || !newQuote) {
    return {
      error: toUserError(
        insertError,
        "reviseQuote-insert",
        USER_ERRORS.quoteRevisionFailed
      ),
    };
  }

  const newQuoteId = newQuote.id;

  if (sourceItems && sourceItems.length > 0) {
    const copiedItems = sourceItems.map((item) => ({
      org_id: orgId,
      quote_id: newQuoteId,
      project_id: projectId,
      pricing_item_id: item.pricing_item_id,
      work_area_id: item.work_area_id,
      section_title: item.section_title,
      section_description: item.section_description,
      label: item.label,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total: item.total,
      visible: item.visible,
      optional: item.optional,
      sort_order: item.sort_order,
    }));

    const { error: copyItemsError } = await supabase
      .from("quote_items")
      .insert(copiedItems);

    if (copyItemsError) {
      await supabase
        .from("quotes")
        .delete()
        .eq("id", newQuoteId)
        .eq("org_id", orgId);
      return {
        error: toUserError(
          copyItemsError,
          "reviseQuote-copy-items",
          USER_ERRORS.quoteRevisionFailed
        ),
      };
    }
  }

  const { error: supersedeError } = await supabase
    .from("quotes")
    .update({
      superseded_by_quote_id: newQuoteId,
      superseded_at: now,
    })
    .eq("id", quoteId)
    .eq("org_id", orgId);

  if (supersedeError) {
    await supabase
      .from("quote_items")
      .delete()
      .eq("quote_id", newQuoteId)
      .eq("org_id", orgId);
    await supabase
      .from("quotes")
      .delete()
      .eq("id", newQuoteId)
      .eq("org_id", orgId);
    return {
      error: toUserError(
        supersedeError,
        "reviseQuote-supersede",
        USER_ERRORS.quoteRevisionFailed
      ),
    };
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

  const rootId = quote.parent_quote_id ?? quote.id;

  const { data: chainQuotes, error: chainError } = await supabase
    .from("quotes")
    .select("revision_number")
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
    .order("revision_number", { ascending: false })
    .limit(1);

  if (chainError) {
    return {
      error: toUserError(
        chainError,
        "reviseQuote-chain",
        USER_ERRORS.quoteRevisionFailed
      ),
    };
  }

  const nextRevision =
    Number(chainQuotes?.[0]?.revision_number ?? quote.revision_number) + 1;
  const now = new Date().toISOString();
  const { quoteFields, quoteItems } = snapshot;

  const { data: newQuote, error: insertError } = await supabase
    .from("quotes")
    .insert({
      org_id: orgId,
      project_id: projectId,
      pricing_document_id: resolvedPricingDocumentId,
      estimate_id: snapshot.estimateId,
      quote_number: quote.quote_number,
      title: quoteFields.title,
      status: "draft",
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
      created_by: user.id,
      revision_number: nextRevision,
      parent_quote_id: rootId,
      revised_from_quote_id: quote.id,
      revision_note: revisionNote ?? null,
    })
    .select("id")
    .single();

  if (insertError || !newQuote) {
    return {
      error: toUserError(
        insertError,
        "reviseQuote-insert",
        USER_ERRORS.quoteRevisionFailed
      ),
    };
  }

  const newQuoteId = newQuote.id;
  const itemsError = await insertQuoteItemRows(
    supabase,
    orgId,
    projectId,
    newQuoteId,
    quoteItems
  );

  if (itemsError) {
    await supabase
      .from("quotes")
      .delete()
      .eq("id", newQuoteId)
      .eq("org_id", orgId);
    return { error: itemsError };
  }

  const { error: supersedeError } = await supabase
    .from("quotes")
    .update({
      superseded_by_quote_id: newQuoteId,
      superseded_at: now,
    })
    .eq("id", quoteId)
    .eq("org_id", orgId);

  if (supersedeError) {
    await supabase
      .from("quote_items")
      .delete()
      .eq("quote_id", newQuoteId)
      .eq("org_id", orgId);
    await supabase
      .from("quotes")
      .delete()
      .eq("id", newQuoteId)
      .eq("org_id", orgId);
    return {
      error: toUserError(
        supersedeError,
        "reviseQuote-supersede",
        USER_ERRORS.quoteRevisionFailed
      ),
    };
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
