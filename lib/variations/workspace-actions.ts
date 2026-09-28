"use server";

import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import { getCompanySettingsWithContext } from "@/lib/settings/company-settings-loader";
import { loadVariation } from "@/lib/variations/actions";
import { parseVariationDocumentIdentity, type VariationDocumentIdentity } from "@/lib/variations/document-identity";
import {
  calculateRevisedContractValue,
  type InternalVariation,
  type RevisedVariationRevision,
  type VariationAcceptedLedgerEntry,
  type VariationStatus,
} from "@/lib/variations/domain";
import {
  formatContractMoney,
  variationDeliveryListLabel,
  variationEligibility,
  variationStatusLabel,
} from "@/lib/variations/presentation";
import { variationEvidenceTypeLabel, type VariationManualEvidenceType } from "@/lib/variations/response";
import type {
  VariationAttachmentView,
  VariationBaselineView,
  VariationDeliveryAttempt,
  VariationListRow,
  VariationListSummary,
  VariationResponseView,
  VariationRevisionHistoryRow,
  VariationScopeLineOption,
  VariationWorkAreaOption,
} from "@/lib/variations/workspace-types";

type Fail = { ok: false; error: string };

function money(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeZone: "Pacific/Auckland",
  }).format(date);
}

function isStatus(value: string): value is VariationStatus {
  return (
    value === "draft" ||
    value === "issued" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "withdrawn" ||
    value === "superseded"
  );
}

async function ownedProject(projectId: string) {
  const context = await getAuthOrgContext();
  if (!context) return { ok: false as const, error: "You need to sign in." };
  const owned = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in owned) return { ok: false as const, error: "That project could not be found." };
  return { ok: true as const, context, projectId: owned.projectId };
}

export async function loadVariationEligibility(projectId: string): Promise<
  | {
      ok: true;
      eligible: boolean;
      reason: string | null;
      projectTitle: string;
      clientName: string;
      siteAddress: string | null;
    }
  | Fail
> {
  const owned = await ownedProject(projectId);
  if (!owned.ok) return owned;
  const [project, snapshot, lifecycle] = await Promise.all([
    owned.context.supabase
      .from("projects")
      .select("title, client_name, site_address, archived_at, business_status")
      .eq("id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("accepted_commercial_snapshots")
      .select("id")
      .eq("project_id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("project_lifecycle_positions")
      .select("stage")
      .eq("project_id", owned.projectId)
      .maybeSingle(),
  ]);
  if (project.error || !project.data) return { ok: false, error: "That project could not be found." };
  const row = project.data as {
    title: string;
    client_name: string | null;
    site_address: string | null;
    archived_at: string | null;
    business_status: string | null;
  };
  const stage = (lifecycle.data as { stage?: string } | null)?.stage ?? null;
  const eligibility = variationEligibility({
    hasAcceptedSnapshot: Boolean(snapshot.data),
    archived: row.archived_at != null || row.business_status === "archived",
    deleted: false,
    stage,
  });
  return {
    ok: true,
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    projectTitle: row.title,
    clientName: row.client_name?.trim() || "Client",
    siteAddress: row.site_address,
  };
}

export async function loadVariationWorkspace(projectId: string): Promise<
  | {
      ok: true;
      eligible: boolean;
      reason: string | null;
      rows: VariationListRow[];
      summary: VariationListSummary | null;
      projectTitle: string;
      clientName: string;
    }
  | Fail
> {
  const owned = await ownedProject(projectId);
  if (!owned.ok) return owned;
  const [project, snapshot, lifecycle, variations, revisions, items, ledgerRows, responseRows] = await Promise.all([
    owned.context.supabase
      .from("projects")
      .select("title, client_name, archived_at, business_status")
      .eq("id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("accepted_commercial_snapshots")
      .select("currency, gst_rate, tax_treatment, sell_ex_gst, gst_amount, sell_incl_gst")
      .eq("project_id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("project_lifecycle_positions")
      .select("stage")
      .eq("project_id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("variations")
      .select("id, variation_number, title, status, created_at, current_revision_id")
      .eq("project_id", owned.projectId)
      .order("variation_number", { ascending: true }),
    owned.context.supabase
      .from("variation_revisions")
      .select(
        "id, variation_id, revision_number, status, title, total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst, issued_at, accepted_at, rejected_at, withdrawn_at"
      )
      .eq("project_id", owned.projectId),
    owned.context.supabase
      .from("variation_items")
      .select("revision_id, item_type, line_sell_adjustment_ex_gst")
      .eq("project_id", owned.projectId),
    owned.context.supabase
      .from("variation_accepted_adjustments")
      .select("variation_id, variation_revision_id, net_adjustment_ex_gst, gst_adjustment, adjustment_incl_gst")
      .eq("project_id", owned.projectId)
      .eq("org_id", owned.context.orgId),
    owned.context.supabase
      .from("variation_responses")
      .select("variation_id, outcome, source, responder_name, client_decline_reason, responded_at")
      .eq("project_id", owned.projectId)
      .eq("org_id", owned.context.orgId),
  ]);
  if (project.error || !project.data || variations.error || revisions.error || items.error || ledgerRows.error || responseRows.error) {
    return { ok: false, error: "Variations could not be loaded." };
  }
  const projectRow = project.data as {
    title: string;
    client_name: string | null;
    archived_at: string | null;
    business_status: string | null;
  };
  const stage = (lifecycle.data as { stage?: string } | null)?.stage ?? null;
  const eligibility = variationEligibility({
    hasAcceptedSnapshot: Boolean(snapshot.data),
    archived: projectRow.archived_at != null || projectRow.business_status === "archived",
    deleted: false,
    stage,
  });
  if (!eligibility.eligible) {
    return {
      ok: true,
      eligible: false,
      reason: eligibility.reason,
      rows: [],
      summary: null,
      projectTitle: projectRow.title,
      clientName: projectRow.client_name?.trim() || "Client",
    };
  }
  const snap = snapshot.data as {
    currency: string;
    gst_rate: unknown;
    tax_treatment: string;
    sell_ex_gst: unknown;
    gst_amount: unknown;
    sell_incl_gst: unknown;
  };
  const sellEx = money(snap.sell_ex_gst);
  const gstAmount = money(snap.gst_amount);
  const sellIncl = money(snap.sell_incl_gst);
  const gstRate = money(snap.gst_rate);
  if (sellEx == null || gstAmount == null || sellIncl == null || gstRate == null) {
    return { ok: false, error: "Variations could not be loaded." };
  }
  const revisionRows = (revisions.data ?? []) as Array<{
    id: string;
    variation_id: string;
    revision_number: number;
    status: string;
    title: string | null;
    total_sell_adjustment_ex_gst: unknown;
    gst_adjustment: unknown;
    total_adjustment_incl_gst: unknown;
    issued_at: string | null;
    accepted_at: string | null;
    rejected_at: string | null;
    withdrawn_at: string | null;
  }>;
  const rows: VariationListRow[] = [];
  for (const variation of (variations.data ?? []) as Array<{
    id: string;
    variation_number: number;
    title: string;
    status: string;
    created_at: string;
    current_revision_id: string | null;
  }>) {
    if (!isStatus(variation.status)) continue;
    const current = revisionRows.find((row) => row.id === variation.current_revision_id);
    const outcome =
      variation.status === "accepted"
        ? "Accepted"
        : variation.status === "rejected"
          ? "Declined"
          : variation.status === "withdrawn"
            ? "Withdrawn"
            : null;
    const response = ((responseRows.data ?? []) as Array<{
      variation_id: string;
      outcome: string;
      source: string;
      responder_name: string;
      client_decline_reason: string | null;
    }>).find((row) => row.variation_id === variation.id);
    rows.push({
      id: variation.id,
      variationNumber: variation.variation_number,
      // Current revision title. variations.title is only the denormalised list copy.
      title: current?.title?.trim() || variation.title,
      status: variation.status,
      statusLabel: variationStatusLabel(variation.status),
      revisionNumber: current?.revision_number ?? null,
      netExGst: money(current?.total_sell_adjustment_ex_gst),
      gst: money(current?.gst_adjustment),
      inclGst: money(current?.total_adjustment_incl_gst),
      createdAt: formatDate(variation.created_at) ?? "",
      issuedAt: formatDate(current?.issued_at ?? null),
      acceptedAt: formatDate(current?.accepted_at ?? null),
      declinedAt: formatDate(current?.rejected_at ?? null),
      withdrawnAt: formatDate(current?.withdrawn_at ?? null),
      outcomeLabel: outcome,
      responseSource: response?.source === "client" ? "Client" : response?.source === "manual" ? "Manual" : null,
      responderName: response?.responder_name ?? null,
      declineReason: response?.source === "client" ? response.client_decline_reason : null,
      revisedContractInclGst: null,
      currentRevisionId: current?.id ?? null,
      deliveryLabel: null,
    });
  }
  const revisionIds = rows.flatMap((row) => (row.currentRevisionId ? [row.currentRevisionId] : []));
  if (revisionIds.length > 0) {
    const deliveryRows = await owned.context.supabase
      .from("variation_deliveries")
      .select("revision_id, status, created_at")
      .in("revision_id", revisionIds)
      .order("created_at", { ascending: true });
    if (deliveryRows.error) return { ok: false, error: "Variations could not be loaded." };
    const latest = new Map<string, "sent" | "failed">();
    for (const delivery of (deliveryRows.data ?? []) as Array<{ revision_id: string; status: string }>) {
      if (delivery.status === "sent" || delivery.status === "failed") {
        latest.set(delivery.revision_id, delivery.status);
      }
    }
    for (const row of rows) {
      row.deliveryLabel = variationDeliveryListLabel({
        status: row.status,
        latestAttempt: row.currentRevisionId ? latest.get(row.currentRevisionId) ?? null : null,
      });
    }
  } else {
    for (const row of rows) {
      row.deliveryLabel = variationDeliveryListLabel({ status: row.status, latestAttempt: null });
    }
  }
  const itemRows = (items.data ?? []) as Array<{
    revision_id: string;
    item_type: string;
    line_sell_adjustment_ex_gst: unknown;
  }>;
  const contractRevisions: RevisedVariationRevision[] = revisionRows.flatMap((revision) => {
    if (!isStatus(revision.status)) return [];
    const header = ((variations.data ?? []) as Array<{ id: string; current_revision_id: string | null }>).find(
      (row) => row.id === revision.variation_id
    );
    return [{
      id: revision.id,
      status: revision.status,
      isCurrent: header?.current_revision_id === revision.id,
      totalSellAdjustmentExGst: money(revision.total_sell_adjustment_ex_gst),
      gstAdjustment: money(revision.gst_adjustment),
      totalAdjustmentInclGst: money(revision.total_adjustment_incl_gst),
      items: itemRows.flatMap((item) => {
        if (item.revision_id !== revision.id) return [];
        if (item.item_type !== "addition" && item.item_type !== "omission" && item.item_type !== "no_cost_scope_change") {
          return [];
        }
        return [{
          itemType: item.item_type,
          lineSellAdjustmentExGst: money(item.line_sell_adjustment_ex_gst),
        }];
      }),
    }];
  });
  const ledger: VariationAcceptedLedgerEntry[] = ((ledgerRows.data ?? []) as Array<{
    variation_id: string;
    variation_revision_id: string;
    net_adjustment_ex_gst: unknown;
    gst_adjustment: unknown;
    adjustment_incl_gst: unknown;
  }>).map((row) => ({
    variationId: row.variation_id,
    revisionId: row.variation_revision_id,
    netAdjustmentExGst: money(row.net_adjustment_ex_gst),
    gstAdjustment: money(row.gst_adjustment),
    adjustmentInclGst: money(row.adjustment_incl_gst),
  }));
  const contract = calculateRevisedContractValue({
    baseline: {
      currency: snap.currency,
      gstRate,
      taxTreatment: snap.tax_treatment,
      sellExGst: sellEx,
      gstAmount,
      sellInclGst: sellIncl,
    },
    revisions: contractRevisions,
    ledger,
  });
  if (!contract.ok) return { ok: false, error: "Variations could not be loaded." };
  for (const row of rows) {
    if (row.status === "accepted") row.revisedContractInclGst = contract.value.revisedContractValueInclGst;
  }
  const summary: VariationListSummary = {
    originalAcceptedExGst: contract.value.originalAcceptedContractExGst,
    originalAcceptedInclGst: sellIncl,
    acceptedAdjustmentExGst: contract.value.netAcceptedVariationAdjustmentExGst,
    revisedAcceptedExGst: contract.value.revisedContractValueExGst,
    revisedAcceptedInclGst: contract.value.revisedContractValueInclGst,
    pendingIssuedExGst: contract.value.pendingVariationValueExGst,
    draftCount: rows.filter((row) => row.status === "draft").length,
    currency: contract.value.currency,
  };
  return {
    ok: true,
    eligible: true,
    reason: null,
    rows,
    summary,
    projectTitle: projectRow.title,
    clientName: projectRow.client_name?.trim() || "Client",
  };
}

export async function loadVariationEditor(projectId: string, variationId: string): Promise<
  | {
      ok: true;
      variation: InternalVariation;
      baseline: VariationBaselineView;
      scopeLines: VariationScopeLineOption[];
      workAreas: VariationWorkAreaOption[];
      defaultMarginPercent: number;
      companyName: string;
      projectTitle: string;
      clientName: string;
      clientEmail: string | null;
      siteAddress: string | null;
      history: VariationRevisionHistoryRow[];
      deliveries: VariationDeliveryAttempt[];
      documentIdentities: Record<string, VariationDocumentIdentity | null>;
      withdrawalReason: string | null;
      eligible: boolean;
      reason: string | null;
      acceptedRevisions: Array<{
        id: string;
        totalSellAdjustmentExGst: number;
        gstAdjustment: number;
        totalAdjustmentInclGst: number;
      }>;
      attachments: VariationAttachmentView[];
      response: VariationResponseView | null;
      revisedContractInclGst: number | null;
    }
  | Fail
> {
  const owned = await ownedProject(projectId);
  if (!owned.ok) return owned;
  const [loaded, project, lifecycle, snapshot, lines, areas, marginRow, company, revisionDates, acceptedRows, withdrawalEvents, responseRow] =
    await Promise.all([
    loadVariation({ variationId }),
    owned.context.supabase
      .from("projects")
      .select("title, client_name, client_email, site_address, archived_at, business_status")
      .eq("id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("project_lifecycle_positions")
      .select("stage")
      .eq("project_id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("accepted_commercial_snapshots")
      .select("id, currency, gst_rate, tax_treatment, sell_ex_gst, gst_amount, sell_incl_gst, revision_number")
      .eq("project_id", owned.projectId)
      .maybeSingle(),
    owned.context.supabase
      .from("accepted_commercial_snapshot_lines")
      .select("id, client_description, quantity, unit, line_sell_ex_gst, work_area_id, sort_order, snapshot_id")
      .eq("project_id", owned.projectId)
      .order("sort_order", { ascending: true }),
    owned.context.supabase.from("work_areas").select("id, name").eq("project_id", owned.projectId),
    owned.context.supabase
      .from("organisation_settings")
      .select("default_margin_percent")
      .eq("org_id", owned.context.orgId)
      .maybeSingle(),
    getCompanySettingsWithContext(owned.context),
    owned.context.supabase
      .from("variation_revisions")
      .select("id, issued_at, withdrawn_at, document_identity")
      .eq("variation_id", variationId),
    owned.context.supabase
      .from("variation_accepted_adjustments")
      .select("variation_revision_id, net_adjustment_ex_gst, gst_adjustment, adjustment_incl_gst")
      .eq("project_id", owned.projectId)
      .eq("org_id", owned.context.orgId),
    owned.context.supabase
      .from("project_lifecycle_events")
      .select("metadata")
      .eq("project_id", owned.projectId)
      .eq("source_entity_id", variationId)
      .eq("event_type", "variation_withdrawn")
      .limit(1),
    owned.context.supabase
      .from("variation_responses")
      .select("outcome, source, responder_name, responded_at, client_decline_reason, manual_evidence_type, manual_evidence_note, issued_total_incl_gst")
      .eq("project_id", owned.projectId)
      .eq("org_id", owned.context.orgId)
      .eq("variation_id", variationId)
      .maybeSingle(),
  ]);
  if (!loaded.ok) return loaded;
  if (loaded.variation.projectId !== projectId) {
    return { ok: false, error: "That variation could not be found." };
  }
  if (project.error || !project.data || acceptedRows.error || responseRow.error) {
    return { ok: false, error: "That project could not be found." };
  }
  const projectRow = project.data as {
    title: string;
    client_name: string | null;
    client_email: string | null;
    site_address: string | null;
    archived_at: string | null;
    business_status: string | null;
  };
  const stage = (lifecycle.data as { stage?: string } | null)?.stage ?? null;
  const eligibility = variationEligibility({
    hasAcceptedSnapshot: Boolean(snapshot.data),
    archived: projectRow.archived_at != null || projectRow.business_status === "archived",
    deleted: false,
    stage,
  });
  const snap = snapshot.data as {
    id: string;
    currency: string;
    gst_rate: unknown;
    tax_treatment: string;
    sell_ex_gst: unknown;
    gst_amount: unknown;
    sell_incl_gst: unknown;
    revision_number: number;
  } | null;
  if (!snap) return { ok: false, error: "Variations become available after the client accepts the quote." };
  const sellEx = money(snap.sell_ex_gst);
  const gstAmount = money(snap.gst_amount);
  const sellIncl = money(snap.sell_incl_gst);
  const gstRate = money(snap.gst_rate);
  if (sellEx == null || gstAmount == null || sellIncl == null || gstRate == null) {
    return { ok: false, error: "Variations could not be loaded." };
  }
  const areaName = new Map(
    ((areas.data ?? []) as Array<{ id: string; name: string }>).map((area) => [area.id, area.name])
  );
  const scopeLines: VariationScopeLineOption[] = (
    (lines.data ?? []) as Array<{
      id: string;
      client_description: string;
      quantity: unknown;
      unit: string | null;
      line_sell_ex_gst: unknown;
      work_area_id: string | null;
      snapshot_id: string;
    }>
  )
    .filter((line) => line.snapshot_id === snap.id)
    .map((line) => {
      const accepted = money(line.line_sell_ex_gst);
      return {
        id: line.id,
        workAreaId: line.work_area_id,
        workAreaName: line.work_area_id ? areaName.get(line.work_area_id) ?? null : null,
        description: line.client_description,
        quantity: money(line.quantity),
        unit: line.unit,
        acceptedSellLabel:
          accepted == null ? null : formatContractMoney(accepted, snap.currency),
      };
    });
  const marginRaw = money(
    (marginRow.data as { default_margin_percent?: unknown } | null)?.default_margin_percent
  );
  const currentRevision = loaded.variation.revisions.find((revision) => revision.status !== "superseded");
  const revisionDateRows = (revisionDates.data ?? []) as Array<{
    id: string;
    issued_at: string | null;
    withdrawn_at: string | null;
    document_identity: unknown;
  }>;
  const issuedById = new Map(revisionDateRows.map((row) => [row.id, formatDate(row.issued_at)]));
  const issuedIsoById = new Map(revisionDateRows.map((row) => [row.id, row.issued_at]));
  const documentIdentities = Object.fromEntries(
    revisionDateRows.map((row) => [row.id, parseVariationDocumentIdentity(row.document_identity)])
  );
  const withdrawnById = new Map(revisionDateRows.map((row) => [row.id, formatDate(row.withdrawn_at)]));
  const withdrawalMetadata = ((withdrawalEvents.data ?? []) as Array<{ metadata?: { withdrawalReason?: unknown } }>)[0]?.metadata;
  const withdrawalReason = typeof withdrawalMetadata?.withdrawalReason === "string" ? withdrawalMetadata.withdrawalReason : null;
  const deliveryQuery = await owned.context.supabase
    .from("variation_deliveries")
    .select("id, revision_id, recipient_email, status, kind, attempted_at, sent_at, failed_at, failure_message_safe")
    .eq("variation_id", variationId)
    .order("created_at", { ascending: true });
  if (deliveryQuery.error) return { ok: false, error: "That variation could not be found." };
  const deliveries: VariationDeliveryAttempt[] = ((deliveryQuery.data ?? []) as Array<{
    id: string;
    revision_id: string;
    recipient_email: string;
    status: string;
    kind: string;
    attempted_at: string | null;
    sent_at: string | null;
    failed_at: string | null;
    failure_message_safe: string | null;
  }>).flatMap((row) => {
    if (row.status !== "pending" && row.status !== "sent" && row.status !== "failed") return [];
    return [{
      id: row.id,
      revisionId: row.revision_id,
      recipientEmail: row.recipient_email,
      status: row.status,
      kind: row.kind === "resend" ? "resend" as const : "send" as const,
      attemptedAt: row.attempted_at,
      sentAt: row.sent_at,
      failedAt: row.failed_at,
      failureMessage: row.failure_message_safe,
    }];
  });
  const attachmentQuery = await owned.context.supabase
    .from("variation_attachments")
    .select("id, variation_revision_id, visibility, display_filename, mime_type, byte_size, caption, internal_description, linked_variation_item_id, sort_order, upload_status, object_confirmed, created_at, frozen_at")
    .eq("variation_id", variationId)
    .order("sort_order", { ascending: true });
  if (attachmentQuery.error) return { ok: false, error: "That variation could not be found." };
  const attachments: VariationAttachmentView[] = ((attachmentQuery.data ?? []) as Array<{
    id: string;
    variation_revision_id: string;
    visibility: string;
    display_filename: string;
    mime_type: string;
    byte_size: number | string;
    caption: string | null;
    internal_description: string | null;
    linked_variation_item_id: string | null;
    sort_order: number;
    upload_status: string;
    object_confirmed: boolean;
    created_at: string;
    frozen_at: string | null;
  }>).flatMap((row) => {
    if (row.visibility !== "client" && row.visibility !== "internal") return [];
    if (row.upload_status !== "pending" && row.upload_status !== "ready" && row.upload_status !== "failed") return [];
    const byteSize = typeof row.byte_size === "number" ? row.byte_size : Number(row.byte_size);
    if (!Number.isFinite(byteSize)) return [];
    return [{
      id: row.id,
      revisionId: row.variation_revision_id,
      visibility: row.visibility,
      displayFilename: row.display_filename,
      mimeType: row.mime_type,
      byteSize,
      caption: row.caption,
      internalDescription: row.internal_description,
      linkedVariationItemId: row.linked_variation_item_id,
      sortOrder: row.sort_order,
      uploadStatus: row.upload_status,
      objectConfirmed: row.object_confirmed,
      createdAt: row.created_at,
      frozen: row.frozen_at != null,
    }];
  });
  const history: VariationRevisionHistoryRow[] = [...loaded.variation.revisions]
    .sort((a, b) => a.revisionNumber - b.revisionNumber)
    .map((revision) => ({
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      title: revision.title,
      status: revision.status,
      statusLabel: variationStatusLabel(revision.status),
      issuedAt: issuedById.get(revision.id) ?? null,
      issuedAtIso: issuedIsoById.get(revision.id) ?? null,
      withdrawnAt: withdrawnById.get(revision.id) ?? null,
      netExGst: revision.totalSellAdjustmentExGst,
      label: revision.id === currentRevision?.id ? "Current" : "Historical",
    }));
  return {
    ok: true,
    variation: loaded.variation,
    baseline: {
      currency: snap.currency,
      gstRate,
      taxTreatment: snap.tax_treatment,
      sellExGst: sellEx,
      gstAmount,
      sellInclGst: sellIncl,
      referenceLabel: `Accepted quote · ${formatContractMoney(sellIncl, snap.currency)} incl GST`,
    },
    scopeLines,
    workAreas: ((areas.data ?? []) as Array<{ id: string; name: string }>).map((area) => ({
      id: area.id,
      name: area.name,
    })),
    defaultMarginPercent: marginRaw ?? DEFAULT_MARGIN_PERCENT,
    companyName: company?.tradingName?.trim() || company?.organisationName || "Your company",
    projectTitle: projectRow.title,
    clientName: projectRow.client_name?.trim() || "Client",
    clientEmail: projectRow.client_email?.trim() || null,
    siteAddress: projectRow.site_address,
    history,
    deliveries,
    documentIdentities,
    withdrawalReason,
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    acceptedRevisions: ((acceptedRows.data ?? []) as Array<{
      variation_revision_id: string;
      net_adjustment_ex_gst: unknown;
      gst_adjustment: unknown;
      adjustment_incl_gst: unknown;
    }>).flatMap((row) => {
      const sell = money(row.net_adjustment_ex_gst);
      const gst = money(row.gst_adjustment);
      const incl = money(row.adjustment_incl_gst);
      if (sell == null || gst == null || incl == null) return [];
      return [{
        id: row.variation_revision_id,
        totalSellAdjustmentExGst: sell,
        gstAdjustment: gst,
        totalAdjustmentInclGst: incl,
      }];
    }),
    attachments,
    response: mapVariationResponse(responseRow.data),
    revisedContractInclGst: revisedInclFromLedger(sellIncl, acceptedRows.data),
  };
}

function mapVariationResponse(data: unknown): VariationResponseView | null {
  if (!data || typeof data !== "object") return null;
  const row = data as {
    outcome?: string;
    source?: string;
    responder_name?: string;
    responded_at?: string | null;
    client_decline_reason?: string | null;
    manual_evidence_type?: string | null;
    manual_evidence_note?: string | null;
    issued_total_incl_gst?: unknown;
  };
  if (row.outcome !== "accepted" && row.outcome !== "declined") return null;
  if (row.source !== "client" && row.source !== "manual") return null;
  const adjustment = money(row.issued_total_incl_gst);
  if (adjustment == null || !row.responder_name) return null;
  const evidenceType = row.manual_evidence_type;
  const known = evidenceType === "email_confirmation" || evidenceType === "signed_document" || evidenceType === "verbal_approval" || evidenceType === "other";
  return {
    outcome: row.outcome,
    sourceLabel: row.source === "client" ? "Client" : "Manual",
    responderName: row.responder_name,
    respondedAt: formatDate(row.responded_at ?? null),
    declineReason: row.source === "client" ? row.client_decline_reason ?? null : null,
    evidenceTypeLabel: known ? variationEvidenceTypeLabel(evidenceType as VariationManualEvidenceType) : null,
    evidenceNote: row.source === "manual" ? row.manual_evidence_note ?? null : null,
    adjustmentInclGst: adjustment,
  };
}

function revisedInclFromLedger(baselineIncl: number, rows: unknown): number | null {
  const ledger = Array.isArray(rows) ? rows : [];
  let sum = 0;
  for (const row of ledger) {
    const incl = money((row as { adjustment_incl_gst?: unknown }).adjustment_incl_gst);
    if (incl == null) return null;
    sum += incl;
  }
  return Math.round((baselineIncl + sum) * 100) / 100;
}
