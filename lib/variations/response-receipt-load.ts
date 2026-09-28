import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { hashVariationAccessToken, isVariationAccessTokenFormat } from "@/lib/variations/delivery-token";
import {
  buildVariationResponseReceipt,
  type VariationReceiptMoney,
  type VariationResponseReceipt,
} from "@/lib/variations/response-receipt";
import { variationEvidenceTypeLabel, type VariationManualEvidenceType } from "@/lib/variations/response";
import { groupVariationScope } from "@/lib/variations/work-areas";

export type VariationManualEvidenceView = {
  evidenceTypeLabel: string;
  evidenceNote: string;
  recordedByName: string;
  recordedAtLabel: string;
};

type ResponseRow = {
  id: string;
  org_id: string;
  project_id: string;
  variation_id: string;
  variation_revision_id: string;
  outcome: string;
  source: string;
  responded_at: string;
  responder_name: string;
  responder_email: string | null;
  builder_actor_id: string | null;
  manual_evidence_type: string | null;
  manual_evidence_note: string | null;
  client_decline_reason: string | null;
  issued_total_ex_gst: unknown;
  issued_gst: unknown;
  issued_total_incl_gst: unknown;
  currency: string;
  accepted_snapshot_id: string;
  document_identity: unknown;
  client_attachment_manifest: unknown;
  confirmation_versions: unknown;
};

function money(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function moneyRow(ex: unknown, gst: unknown, incl: unknown): VariationReceiptMoney | null {
  const exGst = money(ex);
  const gstAmount = money(gst);
  const inclGst = money(incl);
  if (exGst == null || gstAmount == null || inclGst == null) return null;
  return { exGst, gst: gstAmount, inclGst };
}

async function receiptFromStored(input: {
  response: ResponseRow;
  variationNumber: number;
  revisionNumber: number;
  baseline: VariationReceiptMoney | null;
  earlier: VariationReceiptMoney[];
  scopeGroups?: VariationResponseReceipt["scopeGroups"];
}): Promise<VariationResponseReceipt | null> {
  if (input.response.outcome !== "accepted" && input.response.outcome !== "declined") return null;
  if (input.response.source !== "client" && input.response.source !== "manual") return null;
  const issued = moneyRow(input.response.issued_total_ex_gst, input.response.issued_gst, input.response.issued_total_incl_gst);
  if (!issued) return null;
  return buildVariationResponseReceipt({
    outcome: input.response.outcome,
    source: input.response.source,
    respondedAt: input.response.responded_at,
    responderName: input.response.responder_name,
    responderEmail: input.response.responder_email,
    declineReason: input.response.client_decline_reason,
    issued,
    currency: input.response.currency,
    documentIdentity: input.response.document_identity,
    clientAttachmentManifest: input.response.client_attachment_manifest,
    confirmationVersions: input.response.confirmation_versions,
    variationNumber: input.variationNumber,
    revisionNumber: input.revisionNumber,
    baseline: input.baseline,
    earlierAdjustments: input.earlier,
    scopeGroups: input.scopeGroups ?? [],
  });
}

async function assemble(db: SupabaseClient, response: ResponseRow): Promise<VariationResponseReceipt | null> {
  const variation = await db.from("variations").select("variation_number").eq("id", response.variation_id).eq("org_id", response.org_id).eq("project_id", response.project_id).maybeSingle();
  const revision = await db.from("variation_revisions").select("revision_number").eq("id", response.variation_revision_id).eq("org_id", response.org_id).eq("project_id", response.project_id).maybeSingle();
  const snapshot = await db.from("accepted_commercial_snapshots").select("sell_ex_gst, gst_amount, sell_incl_gst").eq("id", response.accepted_snapshot_id).eq("org_id", response.org_id).eq("project_id", response.project_id).maybeSingle();
  const ledger = await db.from("variation_accepted_adjustments").select("variation_id, net_adjustment_ex_gst, gst_adjustment, adjustment_incl_gst, accepted_at").eq("org_id", response.org_id).eq("project_id", response.project_id).lte("accepted_at", response.responded_at);
  const scope = await loadClientScope(db, response);
  if (variation.error || revision.error || snapshot.error || ledger.error) return null;
  const variationNumber = Number((variation.data as { variation_number?: unknown } | null)?.variation_number);
  const revisionNumber = Number((revision.data as { revision_number?: unknown } | null)?.revision_number);
  const snap = snapshot.data as { sell_ex_gst?: unknown; gst_amount?: unknown; sell_incl_gst?: unknown } | null;
  const baseline = snap ? moneyRow(snap.sell_ex_gst, snap.gst_amount, snap.sell_incl_gst) : null;
  const earlier: VariationReceiptMoney[] = [];
  for (const row of (ledger.data ?? []) as Array<Record<string, unknown>>) {
    if (row.variation_id === response.variation_id) continue;
    const entry = moneyRow(row.net_adjustment_ex_gst, row.gst_adjustment, row.adjustment_incl_gst);
    if (!entry) return null;
    earlier.push(entry);
  }
  return receiptFromStored({ response, variationNumber, revisionNumber, baseline, earlier, scopeGroups: scope });
}

async function loadClientScope(db: SupabaseClient, response: ResponseRow) {
  const [areas, items] = await Promise.all([
    db.from("variation_work_areas")
      .select("id, name, description, sort_order")
      .eq("org_id", response.org_id)
      .eq("project_id", response.project_id)
      .eq("variation_id", response.variation_id)
      .eq("revision_id", response.variation_revision_id)
      .order("sort_order", { ascending: true }),
    db.from("variation_items")
      .select("client_description, variation_work_area_id, sort_order")
      .eq("org_id", response.org_id)
      .eq("project_id", response.project_id)
      .eq("variation_id", response.variation_id)
      .eq("revision_id", response.variation_revision_id)
      .order("sort_order", { ascending: true }),
  ]);
  if (areas.error || items.error) return [];
  const byId = new Map(
    ((areas.data ?? []) as Array<{ id: string; name: string; description: string | null }>).map((area) => [area.id, area])
  );
  return groupVariationScope(
    ((items.data ?? []) as Array<{ client_description: string; variation_work_area_id: string | null; sort_order: number }>).map((item) => {
      const area = item.variation_work_area_id ? byId.get(item.variation_work_area_id) : null;
      return {
        workAreaName: area?.name ?? null,
        workAreaDescription: area?.description ?? null,
        clientDescription: item.client_description,
        sortOrder: item.sort_order,
      };
    })
  );
}

export async function loadVariationResponseReceiptByIds(input: {
  projectId: string;
  variationId: string;
}): Promise<VariationResponseReceipt | null> {
  const admin = createAdminClient();
  const response = await admin
    .from("variation_responses")
    .select("id, org_id, project_id, variation_id, variation_revision_id, outcome, source, responded_at, responder_name, responder_email, builder_actor_id, manual_evidence_type, manual_evidence_note, client_decline_reason, issued_total_ex_gst, issued_gst, issued_total_incl_gst, currency, accepted_snapshot_id, document_identity, client_attachment_manifest, confirmation_versions")
    .eq("project_id", input.projectId)
    .eq("variation_id", input.variationId)
    .maybeSingle();
  if (response.error || !response.data) return null;
  return assemble(admin, response.data as ResponseRow);
}

export async function loadPublicVariationResponseReceipt(rawToken: string): Promise<
  | { state: "receipt"; receipt: VariationResponseReceipt }
  | { state: "withdrawn" }
  | { state: "unavailable" }
> {
  if (!isVariationAccessTokenFormat(rawToken)) return { state: "unavailable" };
  const admin = createAdminClient();
  const token = await admin
    .from("variation_access_tokens")
    .select("org_id, project_id, variation_id, revision_id")
    .eq("token_hash", hashVariationAccessToken(rawToken))
    .maybeSingle();
  if (token.error || !token.data) return { state: "unavailable" };
  const bound = token.data as { org_id: string; project_id: string; variation_id: string; revision_id: string };
  const revision = await admin
    .from("variation_revisions")
    .select("id, status")
    .eq("id", bound.revision_id)
    .eq("variation_id", bound.variation_id)
    .eq("org_id", bound.org_id)
    .eq("project_id", bound.project_id)
    .maybeSingle();
  if (revision.error || !revision.data) return { state: "unavailable" };
  const revisionRow = revision.data as { status?: string };
  if (revisionRow.status === "withdrawn") return { state: "withdrawn" };
  const variation = await admin
    .from("variations")
    .select("current_revision_id, status")
    .eq("id", bound.variation_id)
    .eq("org_id", bound.org_id)
    .eq("project_id", bound.project_id)
    .maybeSingle();
  const current = variation.data as { current_revision_id?: string; status?: string } | null;
  if (!current || current.current_revision_id !== bound.revision_id) return { state: "unavailable" };
  if (current.status !== "accepted" && current.status !== "rejected") return { state: "unavailable" };
  const response = await admin
    .from("variation_responses")
    .select("id, org_id, project_id, variation_id, variation_revision_id, outcome, source, responded_at, responder_name, responder_email, builder_actor_id, manual_evidence_type, manual_evidence_note, client_decline_reason, issued_total_ex_gst, issued_gst, issued_total_incl_gst, currency, accepted_snapshot_id, document_identity, client_attachment_manifest, confirmation_versions")
    .eq("org_id", bound.org_id)
    .eq("project_id", bound.project_id)
    .eq("variation_id", bound.variation_id)
    .eq("variation_revision_id", bound.revision_id)
    .maybeSingle();
  if (response.error || !response.data) return { state: "unavailable" };
  const receipt = await assemble(admin, response.data as ResponseRow);
  if (!receipt) return { state: "unavailable" };
  return { state: "receipt", receipt };
}

export async function loadInternalVariationResponseRecord(projectId: string, variationId: string): Promise<
  | { ok: true; receipt: VariationResponseReceipt; manual: VariationManualEvidenceView | null; backHref: string; recordedDeclineReason: string | null }
  | { ok: false }
> {
  const context = await getAuthOrgContext();
  if (!context) return { ok: false };
  const response = await context.supabase
    .from("variation_responses")
    .select("id, org_id, project_id, variation_id, variation_revision_id, outcome, source, responded_at, responder_name, responder_email, builder_actor_id, manual_evidence_type, manual_evidence_note, client_decline_reason, issued_total_ex_gst, issued_gst, issued_total_incl_gst, currency, accepted_snapshot_id, document_identity, client_attachment_manifest, confirmation_versions")
    .eq("org_id", context.orgId)
    .eq("project_id", projectId)
    .eq("variation_id", variationId)
    .maybeSingle();
  if (response.error || !response.data) return { ok: false };
  const row = response.data as ResponseRow;
  if (row.project_id !== projectId || row.variation_id !== variationId || row.org_id !== context.orgId) return { ok: false };
  const receipt = await assemble(context.supabase, row);
  if (!receipt) return { ok: false };
  const backHref = `/app/projects/${row.project_id}/variations/${row.variation_id}?revision=${row.variation_revision_id}`;
  let manual: VariationManualEvidenceView | null = null;
  if (row.source === "manual" && row.manual_evidence_note && row.manual_evidence_type) {
    const known = row.manual_evidence_type === "email_confirmation" || row.manual_evidence_type === "signed_document" || row.manual_evidence_type === "verbal_approval" || row.manual_evidence_type === "other";
    let recordedByName = "A team member";
    if (row.builder_actor_id) {
      const profile = await context.supabase.from("profiles").select("full_name").eq("id", row.builder_actor_id).maybeSingle();
      const name = (profile.data as { full_name?: string | null } | null)?.full_name?.trim();
      if (name) recordedByName = name;
    }
    manual = {
      evidenceTypeLabel: known ? variationEvidenceTypeLabel(row.manual_evidence_type as VariationManualEvidenceType) : "Other",
      evidenceNote: row.manual_evidence_note,
      recordedByName,
      recordedAtLabel: receipt.respondedAtLabel,
    };
  }
  return {
    ok: true,
    receipt,
    manual,
    backHref,
    recordedDeclineReason: row.source === "manual" && row.outcome === "declined" ? row.client_decline_reason : null,
  };
}
