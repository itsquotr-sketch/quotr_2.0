"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import {
  calculateRevisedContractValue,
  clientFacingVariation,
  VARIATION_ITEM_TYPES,
  VARIATION_STATUSES,
  type AcceptedBaselineMoney,
  type ClientFacingVariation,
  type InternalVariation,
  type RevisedContractValue,
  type RevisedVariationRevision,
  type VariationItemType,
  type VariationStatus,
} from "@/lib/variations/domain";
import {
  addDraftVariationItemSchema,
  createDraftVariationSchema,
  deleteDraftVariationItemSchema,
  deleteUnissuedDraftVariationSchema,
  loadProjectVariationsSchema,
  withdrawIssuedVariationSchema,
  loadVariationSchema,
  updateDraftVariationItemSchema,
  updateDraftVariationSchema,
  variationRevisionCommandSchema,
} from "@/lib/variations/schemas";

const VARIATION_ERROR_COPY: Record<string, string> = {
  NOT_AUTHENTICATED: "You need to sign in.",
  NOT_FOUND: "That variation could not be found.",
  CROSS_TENANT: "That variation could not be found.",
  CROSS_PROJECT: "That item does not belong to this project.",
  NO_ACCEPTED_BASELINE: "Variations start after the quote has been accepted.",
  PROJECT_CLOSED: "This project can no longer be varied.",
  INVALID_TRANSITION: "That variation update is not available.",
  STALE_REVISION: "This variation has changed. Reload it and try again.",
  IMMUTABLE: "This variation revision can no longer be edited.",
  ISSUED_HISTORY: "This Variation has commercial history, so it can’t be deleted.",
  REASON_REQUIRED: "Enter a withdrawal reason.",
  WITHDRAW_BLOCKED: "This Variation can’t be withdrawn.",
  UNRESOLVED_PRICING: "Enter a price for every item before issuing this variation.",
  INVALID_ITEM: "Check this variation item and try again.",
  INVALID_QUANTITY: "Enter a valid quantity.",
  INVALID_UNIT: "Enter a unit.",
  INVALID_SUBSTITUTION: "Show what is removed and what is added for a substitution.",
  ZERO_NET_UNDOCUMENTED:
    "A zero variation needs real additions and omissions, or a documented no-cost change.",
  EMPTY_VARIATION: "Add at least one item before issuing this variation.",
  INVALID_INPUT: "Check the variation details and try again.",
};

const SAFE_ERROR = "That variation update is not available.";

type ActionOk = {
  ok: true;
  idempotent?: boolean;
  variationId?: string;
  revisionId?: string;
  variationNumber?: number;
  itemId?: string;
};

type ActionFail = { ok: false; error: string };

function fail(code: string | undefined): ActionFail {
  return { ok: false, error: VARIATION_ERROR_COPY[code ?? ""] ?? SAFE_ERROR };
}

function isStatus(value: string): value is VariationStatus {
  return (VARIATION_STATUSES as readonly string[]).includes(value);
}

function isItemType(value: string): value is VariationItemType {
  return (VARIATION_ITEM_TYPES as readonly string[]).includes(value);
}

function readMoney(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRequiredMoney(value: unknown): number | null {
  const parsed = readMoney(value);
  return parsed == null ? null : parsed;
}

type RpcBody = {
  ok?: boolean;
  error?: string;
  idempotent?: boolean;
  variationId?: string;
  revisionId?: string;
  variationNumber?: number;
  itemId?: string;
  status?: string;
};

async function runVariationRpc(
  name: string,
  args: Record<string, unknown>
): Promise<ActionOk | ActionFail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const { data, error } = await context.supabase.rpc(name, args);
  if (error) {
    if (error.message.includes("VARIATION_IMMUTABLE")) return fail("IMMUTABLE");
    return fail("INVALID_INPUT");
  }
  const body = (data ?? {}) as RpcBody;
  if (body.ok !== true) return fail(body.error);
  return {
    ok: true,
    idempotent: body.idempotent === true,
    variationId: body.variationId,
    revisionId: body.revisionId,
    variationNumber: body.variationNumber,
    itemId: body.itemId,
  };
}

function itemPayload(input: {
  itemType: string;
  clientDescription: string;
  workAreaId: string | null;
  snapshotLineId: string | null;
  stableComponentKey: string | null;
  quantity: number;
  unit: string;
  unitCost: number | null;
  unitSell: number | null;
  sortOrder: number;
  clientInclusion: string | null;
  clientExclusion: string | null;
  substitutionGroupId: string | null;
  internalMetadata: Record<string, string | number | boolean | null> | null;
}): Record<string, unknown> {
  return {
    itemType: input.itemType,
    clientDescription: input.clientDescription,
    workAreaId: input.workAreaId,
    snapshotLineId: input.snapshotLineId,
    stableComponentKey: input.stableComponentKey,
    quantity: input.quantity,
    unit: input.unit,
    unitCost: input.unitCost,
    unitSell: input.unitSell,
    sortOrder: input.sortOrder,
    clientInclusion: input.clientInclusion,
    clientExclusion: input.clientExclusion,
    substitutionGroupId: input.substitutionGroupId,
    internalMetadata: input.internalMetadata ?? {},
  };
}

export async function createDraftVariation(input: unknown): Promise<ActionOk | ActionFail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const parsed = createDraftVariationSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const owned = await assertOrgOwnsActiveProject(context, parsed.data.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  return runVariationRpc("create_draft_variation_v1", {
    p_project: owned.projectId,
    p_title: parsed.data.title,
    p_summary: parsed.data.summary,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
}

export async function updateDraftVariation(input: unknown): Promise<ActionOk | ActionFail> {
  const parsed = updateDraftVariationSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  return runVariationRpc("update_draft_variation_v1", {
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
    p_title: parsed.data.title,
    p_summary: parsed.data.summary,
    p_client_notes: parsed.data.clientNotes,
    p_internal_notes: parsed.data.internalNotes,
    p_time_effect_days: parsed.data.proposedTimeEffectDays,
  });
}

export async function addDraftVariationItem(input: unknown): Promise<ActionOk | ActionFail> {
  const parsed = addDraftVariationItemSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const { variationId, revisionId, ...item } = parsed.data;
  return runVariationRpc("add_draft_variation_item_v1", {
    p_variation: variationId,
    p_revision: revisionId,
    p_item: itemPayload(item),
  });
}

export async function updateDraftVariationItem(input: unknown): Promise<ActionOk | ActionFail> {
  const parsed = updateDraftVariationItemSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const { variationId, revisionId, itemId, ...item } = parsed.data;
  return runVariationRpc("update_draft_variation_item_v1", {
    p_variation: variationId,
    p_revision: revisionId,
    p_item_id: itemId,
    p_item: itemPayload(item),
  });
}

export async function deleteDraftVariationItem(input: unknown): Promise<ActionOk | ActionFail> {
  const parsed = deleteDraftVariationItemSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  return runVariationRpc("delete_draft_variation_item_v1", {
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
    p_item_id: parsed.data.itemId,
  });
}

export async function deleteUnissuedDraftVariation(input: unknown): Promise<ActionOk | ActionFail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const parsed = deleteUnissuedDraftVariationSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const owned = await assertOrgOwnsActiveProject(context, parsed.data.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const result = await runVariationRpc("delete_unissued_draft_variation_v1", {
    p_project: owned.projectId,
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
  });
  if (result.ok) revalidatePath(`/app/projects/${owned.projectId}/variations`);
  return result;
}

export async function withdrawIssuedVariation(input: unknown): Promise<ActionOk | ActionFail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const parsed = withdrawIssuedVariationSchema.safeParse(input);
  if (!parsed.success) {
    const reasonIssue = parsed.error.issues.some((issue) => issue.path.includes("reason"));
    return fail(reasonIssue ? "REASON_REQUIRED" : "INVALID_INPUT");
  }
  const owned = await assertOrgOwnsActiveProject(context, parsed.data.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const result = await runVariationRpc("withdraw_issued_variation_v1", {
    p_project: owned.projectId,
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
    p_reason: parsed.data.reason,
  });
  if (result.ok) {
    revalidatePath(`/app/projects/${owned.projectId}/variations`);
    revalidatePath(`/app/projects/${owned.projectId}/variations/${parsed.data.variationId}`);
  }
  return result;
}

export async function createVariationRevision(input: unknown): Promise<ActionOk | ActionFail> {
  const parsed = variationRevisionCommandSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  return runVariationRpc("create_variation_revision_v1", {
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
  });
}

export async function issueVariationRevision(input: unknown): Promise<ActionOk | ActionFail> {
  const parsed = variationRevisionCommandSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  return runVariationRpc("issue_variation_revision_v1", {
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
  });
}

/**
 * Internal authenticated acceptance. This is not public client consent.
 */
export async function acceptVariationRevision(input: unknown): Promise<ActionOk | ActionFail> {
  const parsed = variationRevisionCommandSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  return runVariationRpc("accept_variation_revision_v1", {
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
  });
}

export async function rejectVariationRevision(input: unknown): Promise<ActionOk | ActionFail> {
  const parsed = variationRevisionCommandSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  return runVariationRpc("reject_variation_revision_v1", {
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
  });
}

export async function withdrawVariationRevision(input: unknown): Promise<ActionOk | ActionFail> {
  const parsed = variationRevisionCommandSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  return runVariationRpc("withdraw_variation_revision_v1", {
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
  });
}

type VariationRow = {
  id: string;
  project_id: string;
  variation_number: number;
  title: string;
  summary: string | null;
  status: string;
  current_revision_id: string | null;
  accepted_snapshot_id: string;
};

type RevisionRow = {
  id: string;
  variation_id: string;
  revision_number: number;
  status: string;
  currency: string;
  gst_rate: number | string;
  tax_treatment: string;
  total_direct_cost_adjustment: number | string | null;
  total_sell_adjustment_ex_gst: number | string | null;
  gst_adjustment: number | string | null;
  total_adjustment_incl_gst: number | string | null;
  proposed_time_effect_days: number | null;
  title: string;
  summary: string | null;
  client_notes: string | null;
  internal_notes: string | null;
};

type ItemRow = {
  id: string;
  revision_id: string;
  item_type: string;
  client_description: string;
  quantity: number | string;
  unit: string;
  unit_sell: number | string | null;
  unit_cost: number | string | null;
  line_sell_adjustment_ex_gst: number | string | null;
  line_cost_adjustment: number | string | null;
  sort_order: number;
  client_inclusion: string | null;
  client_exclusion: string | null;
  substitution_group_id: string | null;
  work_area_id: string | null;
  snapshot_line_id: string | null;
  internal_metadata: Record<string, unknown> | null;
};

async function loadInternalVariation(
  variationId: string
): Promise<InternalVariation | ActionFail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const [variation, revisions, items] = await Promise.all([
    context.supabase
      .from("variations")
      .select("id, project_id, variation_number, title, summary, status, current_revision_id, accepted_snapshot_id")
      .eq("id", variationId)
      .maybeSingle(),
    context.supabase
      .from("variation_revisions")
      .select("id, variation_id, revision_number, status, title, summary, currency, gst_rate, tax_treatment, total_direct_cost_adjustment, total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst, proposed_time_effect_days, client_notes, internal_notes")
      .eq("variation_id", variationId)
      .order("revision_number", { ascending: true }),
    context.supabase
      .from("variation_items")
      .select("id, revision_id, item_type, client_description, quantity, unit, unit_sell, unit_cost, line_sell_adjustment_ex_gst, line_cost_adjustment, sort_order, client_inclusion, client_exclusion, substitution_group_id, work_area_id, snapshot_line_id, internal_metadata")
      .eq("variation_id", variationId)
      .order("sort_order", { ascending: true }),
  ]);
  if (variation.error || !variation.data) return fail("NOT_FOUND");
  const header = variation.data as VariationRow;
  if (!isStatus(header.status)) return fail("INVALID_INPUT");
  if (revisions.error || items.error) return fail("INVALID_INPUT");

  const itemRows = (items.data ?? []) as ItemRow[];
  const mappedRevisions = ((revisions.data ?? []) as RevisionRow[]).flatMap((revision) => {
      if (!isStatus(revision.status)) return [];
      const gstRate = readRequiredMoney(revision.gst_rate);
      if (gstRate == null || !revision.title?.trim()) return [];
      return [{
        id: revision.id,
        revisionNumber: revision.revision_number,
        status: revision.status,
        title: revision.title,
        summary: revision.summary,
        currency: revision.currency,
        gstRate,
        taxTreatment: revision.tax_treatment,
        totalDirectCostAdjustment: readMoney(revision.total_direct_cost_adjustment),
        totalSellAdjustmentExGst: readMoney(revision.total_sell_adjustment_ex_gst),
        gstAdjustment: readMoney(revision.gst_adjustment),
        totalAdjustmentInclGst: readMoney(revision.total_adjustment_incl_gst),
        proposedTimeEffectDays: revision.proposed_time_effect_days,
        clientNotes: revision.client_notes,
        internalNotes: revision.internal_notes,
        items: itemRows.flatMap((item) => {
          if (item.revision_id !== revision.id || !isItemType(item.item_type)) return [];
          const quantity = readRequiredMoney(item.quantity);
          if (quantity == null) return [];
          return [{
            id: item.id,
            itemType: item.item_type,
            clientDescription: item.client_description,
            quantity,
            unit: item.unit,
            unitSell: readMoney(item.unit_sell),
            unitCost: readMoney(item.unit_cost),
            lineSellAdjustmentExGst: readMoney(item.line_sell_adjustment_ex_gst),
            lineCostAdjustment: readMoney(item.line_cost_adjustment),
            sortOrder: item.sort_order,
            clientInclusion: item.client_inclusion,
            clientExclusion: item.client_exclusion,
            substitutionGroupId: item.substitution_group_id,
            workAreaId: item.work_area_id,
            snapshotLineId: item.snapshot_line_id,
            internalMetadata: item.internal_metadata ?? {},
          }];
        }),
      }];
    });
  const currentRevision = mappedRevisions.find((revision) => revision.status !== "superseded");
  return {
    id: header.id,
    projectId: header.project_id,
    variationNumber: header.variation_number,
    title: currentRevision?.title ?? header.title,
    summary: currentRevision?.summary ?? header.summary,
    status: header.status,
    revisions: mappedRevisions,
  };
}

export async function loadVariation(
  input: unknown
): Promise<{ ok: true; variation: InternalVariation } | ActionFail> {
  const parsed = loadVariationSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const variation = await loadInternalVariation(parsed.data.variationId);
  if ("error" in variation) return variation;
  return { ok: true, variation };
}

export async function loadClientFacingVariation(
  input: unknown
): Promise<{ ok: true; variation: ClientFacingVariation } | ActionFail> {
  const loaded = await loadVariation(input);
  if (!loaded.ok) return loaded;
  return { ok: true, variation: clientFacingVariation(loaded.variation) };
}

export async function loadProjectVariations(
  input: unknown
): Promise<{ ok: true; variations: Array<{ id: string; variationNumber: number; title: string; status: VariationStatus; currentRevisionId: string | null }> } | ActionFail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const parsed = loadProjectVariationsSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const owned = await assertOrgOwnsActiveProject(context, parsed.data.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const rows = await context.supabase
    .from("variations")
    .select("id, variation_number, title, status, current_revision_id")
    .eq("project_id", owned.projectId)
    .order("variation_number", { ascending: true });
  if (rows.error) return fail("INVALID_INPUT");
  const variations = ((rows.data ?? []) as Array<{
    id: string;
    variation_number: number;
    title: string;
    status: string;
    current_revision_id: string | null;
  }>).flatMap((row) => {
    if (!isStatus(row.status)) return [];
    return [{
      id: row.id,
      variationNumber: row.variation_number,
      title: row.title,
      status: row.status,
      currentRevisionId: row.current_revision_id,
    }];
  });
  return { ok: true, variations };
}

export async function loadRevisedContractValue(
  input: unknown
): Promise<{ ok: true; value: RevisedContractValue } | ActionFail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const parsed = loadProjectVariationsSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const owned = await assertOrgOwnsActiveProject(context, parsed.data.projectId);
  if ("error" in owned) return fail("NOT_FOUND");

  const snapshot = await context.supabase
    .from("accepted_commercial_snapshots")
    .select("id, currency, gst_rate, tax_treatment, sell_ex_gst, gst_amount, sell_incl_gst")
    .eq("project_id", owned.projectId)
    .maybeSingle();
  if (snapshot.error || !snapshot.data) return fail("NO_ACCEPTED_BASELINE");

  const baselineSell = readRequiredMoney(snapshot.data.sell_ex_gst);
  const baselineGst = readRequiredMoney(snapshot.data.gst_amount);
  const baselineIncl = readRequiredMoney(snapshot.data.sell_incl_gst);
  const gstRate = readRequiredMoney(snapshot.data.gst_rate);
  if (baselineSell == null || baselineGst == null || baselineIncl == null || gstRate == null) {
    return fail("INVALID_INPUT");
  }
  const baseline: AcceptedBaselineMoney = {
    currency: snapshot.data.currency,
    gstRate,
    taxTreatment: snapshot.data.tax_treatment,
    sellExGst: baselineSell,
    gstAmount: baselineGst,
    sellInclGst: baselineIncl,
  };

  const variations = await context.supabase
    .from("variations")
    .select("id, current_revision_id")
    .eq("project_id", owned.projectId);
  if (variations.error) return fail("INVALID_INPUT");
  const headers = (variations.data ?? []) as Array<{ id: string; current_revision_id: string | null }>;
  const ids = headers.map((row) => row.id);
  if (ids.length === 0) {
    const empty = calculateRevisedContractValue({ baseline, revisions: [] });
    return empty.ok ? { ok: true, value: empty.value } : fail(empty.error);
  }

  const revisions = await context.supabase
    .from("variation_revisions")
    .select("id, variation_id, status, total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst")
    .in("variation_id", ids);
  if (revisions.error) return fail("INVALID_INPUT");
  const items = await context.supabase
    .from("variation_items")
    .select("revision_id, item_type, line_sell_adjustment_ex_gst")
    .in("variation_id", ids);
  if (items.error) return fail("INVALID_INPUT");

  const current = new Map(headers.map((row) => [row.current_revision_id, row.id]));
  const itemRows = (items.data ?? []) as Array<{
    revision_id: string;
    item_type: string;
    line_sell_adjustment_ex_gst: number | string | null;
  }>;
  const revisionRows: RevisedVariationRevision[] = [];
  for (const revision of (revisions.data ?? []) as Array<{
    id: string;
    variation_id: string;
    status: string;
    total_sell_adjustment_ex_gst: number | string | null;
    gst_adjustment: number | string | null;
    total_adjustment_incl_gst: number | string | null;
  }>) {
    if (!isStatus(revision.status)) return fail("INVALID_INPUT");
    revisionRows.push({
      id: revision.id,
      status: revision.status,
      isCurrent: current.has(revision.id),
      totalSellAdjustmentExGst: readMoney(revision.total_sell_adjustment_ex_gst),
      gstAdjustment: readMoney(revision.gst_adjustment),
      totalAdjustmentInclGst: readMoney(revision.total_adjustment_incl_gst),
      items: itemRows.flatMap((item) => {
        if (item.revision_id !== revision.id || !isItemType(item.item_type)) return [];
        return [{
          itemType: item.item_type,
          lineSellAdjustmentExGst: readMoney(item.line_sell_adjustment_ex_gst),
        }];
      }),
    });
  }

  const value = calculateRevisedContractValue({ baseline, revisions: revisionRows });
  if (!value.ok) return fail(value.error);
  return { ok: true, value: value.value };
}
