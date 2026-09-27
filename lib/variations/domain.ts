/**
 * Variation domain.
 *
 * A variation is a signed change against one accepted commercial snapshot.
 * It never rewrites that snapshot, the quote, the estimate, pricing, or rates.
 * Negative money is valid only for variation adjustments.
 *
 * Revised contract value is the accepted baseline plus accepted current
 * variation revisions. Draft, issued, rejected, withdrawn and superseded
 * revisions do not change it. Lifecycle events are not a money source.
 */

import { isFiniteNumber, roundMoney } from "@/lib/commercial-engine/core/money";

export const VARIATION_STATUSES = [
  "draft",
  "issued",
  "accepted",
  "rejected",
  "withdrawn",
  "superseded",
] as const;

export type VariationStatus = (typeof VARIATION_STATUSES)[number];

export const VARIATION_ITEM_TYPES = [
  "addition",
  "omission",
  "no_cost_scope_change",
] as const;

export type VariationItemType = (typeof VARIATION_ITEM_TYPES)[number];

export const VARIATION_TRANSITIONS: Record<
  VariationStatus,
  readonly VariationStatus[]
> = {
  draft: ["issued"],
  issued: ["accepted", "rejected", "withdrawn", "superseded"],
  accepted: [],
  rejected: [],
  withdrawn: [],
  superseded: [],
};

export const VARIATION_EVENT_TYPES = [
  "variation_created",
  "variation_issued",
  "variation_accepted",
  "variation_rejected",
  "variation_withdrawn",
  "variation_superseded",
] as const;

export type VariationEventType = (typeof VARIATION_EVENT_TYPES)[number];

export const VARIATION_EVENT_METADATA_KEYS = [
  "variationId",
  "variationNumber",
  "revisionId",
  "revisionNumber",
  "sellAdjustmentExGst",
  "currency",
] as const;

export type VariationFailureCode =
  | "NOT_AUTHENTICATED"
  | "NOT_FOUND"
  | "CROSS_TENANT"
  | "CROSS_PROJECT"
  | "NO_ACCEPTED_BASELINE"
  | "PROJECT_CLOSED"
  | "INVALID_TRANSITION"
  | "STALE_REVISION"
  | "IMMUTABLE"
  | "UNRESOLVED_PRICING"
  | "INVALID_ITEM"
  | "INVALID_QUANTITY"
  | "INVALID_UNIT"
  | "INVALID_SUBSTITUTION"
  | "ZERO_NET_UNDOCUMENTED"
  | "EMPTY_VARIATION"
  | "INVALID_INPUT";

export function canTransitionVariation(
  from: VariationStatus,
  to: VariationStatus
): boolean {
  return VARIATION_TRANSITIONS[from].includes(to);
}

export type VariationItemInput = {
  itemType: VariationItemType;
  clientDescription: string;
  quantity: number;
  unit: string;
  unitSell: number | null;
  unitCost: number | null;
  substitutionGroupId: string | null;
};

export type PreparedVariationItem = {
  itemType: VariationItemType;
  quantity: number;
  unit: string;
  unitSell: number | null;
  unitCost: number | null;
  lineSellAdjustmentExGst: number | null;
  lineCostAdjustment: number | null;
  substitutionGroupId: string | null;
};

function centsAligned(value: number): boolean {
  return roundMoney(value) === value;
}

export function prepareVariationItem(
  input: VariationItemInput
): { ok: true; item: PreparedVariationItem } | { ok: false; error: VariationFailureCode } {
  if (!VARIATION_ITEM_TYPES.includes(input.itemType)) {
    return { ok: false, error: "INVALID_ITEM" };
  }
  if (!input.clientDescription.trim()) {
    return { ok: false, error: "INVALID_ITEM" };
  }
  if (!isFiniteNumber(input.quantity) || input.quantity <= 0 || input.quantity > 1_000_000) {
    return { ok: false, error: "INVALID_QUANTITY" };
  }
  if (!input.unit.trim() || input.unit.trim().length > 40) {
    return { ok: false, error: "INVALID_UNIT" };
  }
  if (input.itemType === "no_cost_scope_change" && input.substitutionGroupId) {
    return { ok: false, error: "INVALID_SUBSTITUTION" };
  }
  if (input.unitCost != null && !isFiniteNumber(input.unitCost)) {
    return { ok: false, error: "INVALID_ITEM" };
  }
  if (input.unitSell != null && !isFiniteNumber(input.unitSell)) {
    return { ok: false, error: "INVALID_ITEM" };
  }
  if (input.unitCost != null && !centsAligned(input.unitCost)) {
    return { ok: false, error: "INVALID_ITEM" };
  }
  if (input.unitSell != null && !centsAligned(input.unitSell)) {
    return { ok: false, error: "INVALID_ITEM" };
  }

  let lineSell: number | null = null;
  let lineCost: number | null = null;
  if (input.unitSell != null) {
    lineSell = roundMoney(input.quantity * input.unitSell);
  }
  if (input.unitCost != null) {
    lineCost = roundMoney(input.quantity * input.unitCost);
  } else if (input.itemType !== "no_cost_scope_change") {
    lineCost = null;
  }

  if (input.itemType === "addition") {
    if (input.unitSell != null && (input.unitSell <= 0 || lineSell == null || lineSell <= 0)) {
      return { ok: false, error: "INVALID_ITEM" };
    }
    if (input.unitCost != null && (input.unitCost < 0 || lineCost == null || lineCost < 0)) {
      return { ok: false, error: "INVALID_ITEM" };
    }
  }
  if (input.itemType === "omission") {
    if (input.unitSell != null && (input.unitSell >= 0 || lineSell == null || lineSell >= 0)) {
      return { ok: false, error: "INVALID_ITEM" };
    }
    if (input.unitCost != null && (input.unitCost > 0 || lineCost == null || lineCost > 0)) {
      return { ok: false, error: "INVALID_ITEM" };
    }
  }
  if (input.itemType === "no_cost_scope_change") {
    if (input.unitSell !== 0 || lineSell !== 0 || input.unitCost != null) {
      return { ok: false, error: "INVALID_ITEM" };
    }
    lineCost = null;
  }

  return {
    ok: true,
    item: {
      itemType: input.itemType,
      quantity: input.quantity,
      unit: input.unit.trim(),
      unitSell: input.unitSell,
      unitCost: input.itemType === "no_cost_scope_change" ? null : input.unitCost,
      lineSellAdjustmentExGst: lineSell,
      lineCostAdjustment: input.itemType === "no_cost_scope_change" ? null : lineCost,
      substitutionGroupId: input.substitutionGroupId,
    },
  };
}

export function variationIssueBlocker(
  items: readonly PreparedVariationItem[]
): VariationFailureCode | null {
  if (items.length === 0) return "EMPTY_VARIATION";
  if (items.some((item) => item.lineSellAdjustmentExGst == null)) {
    return "UNRESOLVED_PRICING";
  }
  const groups = new Map<string, PreparedVariationItem[]>();
  for (const item of items) {
    if (!item.substitutionGroupId) continue;
    const rows = groups.get(item.substitutionGroupId) ?? [];
    rows.push(item);
    groups.set(item.substitutionGroupId, rows);
  }
  for (const rows of groups.values()) {
    const additions = rows.filter((item) => item.itemType === "addition").length;
    const omissions = rows.filter((item) => item.itemType === "omission").length;
    if (rows.length !== 2 || additions !== 1 || omissions !== 1) {
      return "INVALID_SUBSTITUTION";
    }
  }
  const sells = items.map((item) => item.lineSellAdjustmentExGst ?? 0);
  const net = roundMoney(sells.reduce((sum, value) => sum + value, 0));
  const magnitude = roundMoney(
    sells.reduce((sum, value) => sum + Math.abs(value), 0)
  );
  const documented = items.some((item) => item.itemType === "no_cost_scope_change");
  if (net === 0 && magnitude === 0 && !documented) return "ZERO_NET_UNDOCUMENTED";
  return null;
}

export type VariationRevisionTotals = {
  totalDirectCostAdjustment: number | null;
  totalSellAdjustmentExGst: number | null;
  gstAdjustment: number | null;
  totalAdjustmentInclGst: number | null;
};

/** GST is calculated on the signed ex-GST sell adjustment. Null sell stays null. */
export function variationRevisionTotals(
  items: readonly PreparedVariationItem[],
  gstRate: number
): VariationRevisionTotals | { ok: false; error: "INVALID_INPUT" } {
  if (!isFiniteNumber(gstRate) || gstRate < 0 || gstRate > 100) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const knownCosts = items
    .map((item) => item.lineCostAdjustment)
    .filter((value): value is number => value != null);
  const totalDirectCostAdjustment =
    knownCosts.length === 0
      ? null
      : roundMoney(knownCosts.reduce((sum, value) => sum + value, 0));
  if (items.some((item) => item.lineSellAdjustmentExGst == null)) {
    return {
      totalDirectCostAdjustment,
      totalSellAdjustmentExGst: null,
      gstAdjustment: null,
      totalAdjustmentInclGst: null,
    };
  }
  const totalSellAdjustmentExGst = roundMoney(
    items.reduce((sum, item) => sum + (item.lineSellAdjustmentExGst ?? 0), 0)
  );
  const gstAdjustment = roundMoney(totalSellAdjustmentExGst * (gstRate / 100));
  return {
    totalDirectCostAdjustment,
    totalSellAdjustmentExGst,
    gstAdjustment,
    totalAdjustmentInclGst: roundMoney(totalSellAdjustmentExGst + gstAdjustment),
  };
}

/**
 * Internal sell from a known cost and a margin rate in (0, 1).
 * Does not invent a cost when the item is sell-only.
 */
export function internalSellFromKnownCost(
  cost: number | null,
  marginRate: number
): number | null {
  if (cost == null) return null;
  if (!isFiniteNumber(cost) || !isFiniteNumber(marginRate)) return null;
  if (cost < 0 || marginRate <= 0 || marginRate >= 1) return null;
  return roundMoney(cost / (1 - marginRate));
}

export type AcceptedBaselineMoney = {
  currency: string;
  gstRate: number;
  taxTreatment: string;
  sellExGst: number;
  gstAmount: number;
  sellInclGst: number;
};

export type RevisedVariationRevision = {
  id: string;
  status: VariationStatus;
  isCurrent: boolean;
  totalSellAdjustmentExGst: number | null;
  gstAdjustment: number | null;
  totalAdjustmentInclGst: number | null;
  items: readonly Pick<
    PreparedVariationItem,
    "itemType" | "lineSellAdjustmentExGst"
  >[];
};

export type RevisedContractValue = {
  currency: string;
  gstRate: number;
  taxTreatment: string;
  originalAcceptedContractExGst: number;
  acceptedAdditionsExGst: number;
  acceptedOmissionsExGst: number;
  netAcceptedVariationAdjustmentExGst: number;
  revisedContractValueExGst: number;
  gst: number;
  revisedContractValueInclGst: number;
  pendingVariationValueExGst: number;
};

export function calculateRevisedContractValue(input: {
  baseline: AcceptedBaselineMoney;
  revisions: readonly RevisedVariationRevision[];
}): { ok: true; value: RevisedContractValue } | { ok: false; error: VariationFailureCode } {
  const { baseline } = input;
  if (
    !isFiniteNumber(baseline.sellExGst) ||
    !isFiniteNumber(baseline.gstAmount) ||
    !isFiniteNumber(baseline.sellInclGst) ||
    !isFiniteNumber(baseline.gstRate)
  ) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const accepted = input.revisions.filter(
    (revision) => revision.status === "accepted" && revision.isCurrent
  );
  const pending = input.revisions.filter(
    (revision) => revision.status === "issued" && revision.isCurrent
  );

  let additions = 0;
  let omissions = 0;
  let net = 0;
  let gst = 0;
  for (const revision of accepted) {
    if (
      revision.totalSellAdjustmentExGst == null ||
      revision.gstAdjustment == null ||
      revision.totalAdjustmentInclGst == null
    ) {
      return { ok: false, error: "UNRESOLVED_PRICING" };
    }
    net += revision.totalSellAdjustmentExGst;
    gst += revision.gstAdjustment;
    for (const item of revision.items) {
      if (item.lineSellAdjustmentExGst == null) {
        return { ok: false, error: "UNRESOLVED_PRICING" };
      }
      if (item.itemType === "addition") additions += item.lineSellAdjustmentExGst;
      if (item.itemType === "omission") omissions += item.lineSellAdjustmentExGst;
    }
  }

  let pendingValue = 0;
  for (const revision of pending) {
    if (revision.totalSellAdjustmentExGst == null) {
      return { ok: false, error: "UNRESOLVED_PRICING" };
    }
    pendingValue += revision.totalSellAdjustmentExGst;
  }

  const netAccepted = roundMoney(net);
  const revisedEx = roundMoney(baseline.sellExGst + netAccepted);
  const revisedGst = roundMoney(baseline.gstAmount + gst);
  return {
    ok: true,
    value: {
      currency: baseline.currency,
      gstRate: baseline.gstRate,
      taxTreatment: baseline.taxTreatment,
      originalAcceptedContractExGst: roundMoney(baseline.sellExGst),
      acceptedAdditionsExGst: roundMoney(additions),
      acceptedOmissionsExGst: roundMoney(omissions),
      netAcceptedVariationAdjustmentExGst: netAccepted,
      revisedContractValueExGst: revisedEx,
      gst: revisedGst,
      revisedContractValueInclGst: roundMoney(revisedEx + revisedGst),
      pendingVariationValueExGst: roundMoney(pendingValue),
    },
  };
}

export type ClientFacingVariationItem = {
  id: string;
  itemType: VariationItemType;
  clientDescription: string;
  quantity: number;
  unit: string;
  unitSell: number | null;
  lineSellAdjustmentExGst: number | null;
  sortOrder: number;
  clientInclusion: string | null;
  clientExclusion: string | null;
  substitutionGroupId: string | null;
  workAreaId: string | null;
  snapshotLineId: string | null;
};

export type ClientFacingVariation = {
  id: string;
  projectId: string;
  variationNumber: number;
  title: string;
  summary: string | null;
  status: VariationStatus;
  revisions: Array<{
    id: string;
    revisionNumber: number;
    status: VariationStatus;
    title: string;
    summary: string | null;
    currency: string;
    gstRate: number;
    taxTreatment: string;
    totalSellAdjustmentExGst: number | null;
    gstAdjustment: number | null;
    totalAdjustmentInclGst: number | null;
    proposedTimeEffectDays: number | null;
    clientNotes: string | null;
    items: ClientFacingVariationItem[];
  }>;
};

type InternalVariationItem = ClientFacingVariationItem & {
  unitCost: number | null;
  lineCostAdjustment: number | null;
  internalMetadata: Record<string, unknown>;
};

export type InternalVariation = {
  id: string;
  projectId: string;
  variationNumber: number;
  /** Current-list copy. Issued documents read `revisions[].title`. */
  title: string;
  /** Current-list copy. Issued documents read `revisions[].summary`. */
  summary: string | null;
  status: VariationStatus;
  revisions: Array<{
    id: string;
    revisionNumber: number;
    status: VariationStatus;
    title: string;
    summary: string | null;
    currency: string;
    gstRate: number;
    taxTreatment: string;
    totalDirectCostAdjustment: number | null;
    totalSellAdjustmentExGst: number | null;
    gstAdjustment: number | null;
    totalAdjustmentInclGst: number | null;
    proposedTimeEffectDays: number | null;
    clientNotes: string | null;
    internalNotes: string | null;
    items: InternalVariationItem[];
  }>;
};

/** Client reads omit cost, margin, internal notes and internal metadata. */
export function clientFacingVariation(
  variation: InternalVariation
): ClientFacingVariation {
  return {
    id: variation.id,
    projectId: variation.projectId,
    variationNumber: variation.variationNumber,
    title: variation.title,
    summary: variation.summary,
    status: variation.status,
    revisions: variation.revisions.map((revision) => ({
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      status: revision.status,
      title: revision.title,
      summary: revision.summary,
      currency: revision.currency,
      gstRate: revision.gstRate,
      taxTreatment: revision.taxTreatment,
      totalSellAdjustmentExGst: revision.totalSellAdjustmentExGst,
      gstAdjustment: revision.gstAdjustment,
      totalAdjustmentInclGst: revision.totalAdjustmentInclGst,
      proposedTimeEffectDays: revision.proposedTimeEffectDays,
      clientNotes: revision.clientNotes,
      items: revision.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        clientDescription: item.clientDescription,
        quantity: item.quantity,
        unit: item.unit,
        unitSell: item.unitSell,
        lineSellAdjustmentExGst: item.lineSellAdjustmentExGst,
        sortOrder: item.sortOrder,
        clientInclusion: item.clientInclusion,
        clientExclusion: item.clientExclusion,
        substitutionGroupId: item.substitutionGroupId,
        workAreaId: item.workAreaId,
        snapshotLineId: item.snapshotLineId,
      })),
    })),
  };
}
