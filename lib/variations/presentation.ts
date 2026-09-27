/**
 * Presentation mapping for the internal Variations workspace.
 * Commercial totals stay in the variation domain. This module only
 * formats, signs form magnitudes, and chooses human copy.
 */

import { deriveSellFromCost } from "@/lib/commercial-engine/core/sell-from-margin";
import { roundMoney } from "@/lib/commercial-engine/core/money";
import {
  calculateRevisedContractValue,
  prepareVariationItem,
  variationIssueBlocker,
  variationRevisionTotals,
  type AcceptedBaselineMoney,
  type PreparedVariationItem,
  type RevisedContractValue,
  type RevisedVariationRevision,
  type VariationItemInput,
  type VariationItemType,
  type VariationStatus,
} from "@/lib/variations/domain";

export const VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE =
  "Variations become available after the client accepts the quote.";

export const VARIATION_UNAVAILABLE_CLOSED =
  "Variations are not available on this project.";

export const VARIATION_EMPTY_LIST =
  "No Variations yet. Create a Variation when the agreed project scope or price changes.";

export const VARIATION_OMISSION_HELP =
  "This amount will reduce the contract value.";

export const VARIATION_DOCUMENT_ACCEPTANCE_COPY =
  "This Variation changes the agreed scope and contract value only if accepted.";

export const VARIATION_DOCUMENT_PROPOSED_STATUS =
  "Proposed Variation — not yet accepted.";

export const VARIATION_DOCUMENT_OMISSION_COPY =
  "This amount reduces the contract value.";

export const VARIATION_ISSUE_CONFIRM_TEMPLATE =
  "You’re about to issue Variation {number}, revision {revision}. Once issued, this revision can’t be edited. You can create a new revision if changes are needed.";

export const VARIATION_PRICING_REQUIRED_LABEL = "Pricing required";

export const VARIATION_PRICING_REQUIRED_ACTION =
  "Add a price before issuing this Variation.";

const CLOSED_STAGES = new Set(["cancelled", "completed"]);

export function variationEligibility(input: {
  hasAcceptedSnapshot: boolean;
  archived: boolean;
  deleted: boolean;
  stage: string | null;
}): { eligible: boolean; reason: string | null } {
  if (input.deleted || input.archived || (input.stage != null && CLOSED_STAGES.has(input.stage))) {
    return { eligible: false, reason: VARIATION_UNAVAILABLE_CLOSED };
  }
  if (!input.hasAcceptedSnapshot) {
    return { eligible: false, reason: VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE };
  }
  return { eligible: true, reason: null };
}

export function variationStatusLabel(status: VariationStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "issued":
      return "Issued";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "withdrawn":
      return "Withdrawn";
    case "superseded":
      return "Superseded";
    default:
      return "Draft";
  }
}

export function formatContractMoney(amount: number, currency: string): string {
  const code = currency === "AUD" || currency === "NZD" || currency === "USD" ? currency : "NZD";
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Unicode minus, so an omission never looks like a positive amount. */
export function formatSignedAdjustment(amount: number, currency: string): string {
  const absolute = formatContractMoney(Math.abs(amount), currency);
  if (amount < 0) return `−${absolute}`;
  if (amount > 0) return `+${absolute}`;
  return formatContractMoney(0, currency);
}

export function issueConfirmationCopy(variationNumber: number, revisionNumber: number): string {
  return VARIATION_ISSUE_CONFIRM_TEMPLATE.replace("{number}", String(variationNumber)).replace(
    "{revision}",
    String(revisionNumber)
  );
}

/**
 * The form collects a positive magnitude. The domain stores a signed adjustment.
 * Additions stay positive. Omissions become negative. No-cost stays exactly zero.
 */
export function signedUnitFromMagnitude(
  itemType: VariationItemType,
  magnitude: number | null
): number | null {
  if (itemType === "no_cost_scope_change") return 0;
  if (magnitude == null) return null;
  if (!Number.isFinite(magnitude) || magnitude <= 0) return null;
  const rounded = roundMoney(magnitude);
  if (rounded <= 0) return null;
  if (itemType === "omission") return roundMoney(-rounded);
  if (itemType === "addition") return rounded;
  return null;
}

export function magnitudeFromSignedUnit(unitSell: number | null): number | null {
  if (unitSell == null) return null;
  return roundMoney(Math.abs(unitSell));
}

export function sellFromKnownCost(costMagnitude: number, marginPercent: number): number | null {
  try {
    return deriveSellFromCost(Math.abs(costMagnitude), marginPercent);
  } catch {
    return null;
  }
}

export type CommercialProvenance =
  | "calculated"
  | "manual"
  | "no_cost"
  | "pricing_required";

export function provenanceLabel(provenance: CommercialProvenance): string {
  switch (provenance) {
    case "calculated":
      return "Calculated from COST and margin";
    case "manual":
      return "Manually entered";
    case "no_cost":
      return "No-cost change";
    case "pricing_required":
      return VARIATION_PRICING_REQUIRED_LABEL;
    default:
      return VARIATION_PRICING_REQUIRED_LABEL;
  }
}

export function variationIssueReadiness(input: {
  title: string;
  summary: string | null;
  items: readonly VariationItemInput[];
}): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!input.title.trim()) blockers.push("Add a title before issuing.");
  if (!input.summary?.trim()) {
    blockers.push("Add a client-facing summary before issuing.");
  }
  if (input.items.length === 0) blockers.push("Add at least one Variation item.");

  const prepared: PreparedVariationItem[] = [];
  for (const item of input.items) {
    const result = prepareVariationItem(item);
    if (!result.ok) {
      if (item.unitSell == null && item.itemType !== "no_cost_scope_change") {
        blockers.push(`Add a price for ${item.clientDescription.trim() || "this item"}.`);
      } else if (item.itemType === "addition") {
        blockers.push(`Enter a positive amount for ${item.clientDescription.trim() || "this addition"}.`);
      } else if (item.itemType === "omission") {
        blockers.push(`Enter the amount to remove for ${item.clientDescription.trim() || "this omission"}.`);
      } else {
        blockers.push("Check this Variation item and try again.");
      }
      continue;
    }
    prepared.push(result.item);
    if (result.item.lineSellAdjustmentExGst == null) {
      blockers.push(`Add a price for ${item.clientDescription.trim() || "this item"}.`);
    }
  }

  const code = prepared.length === input.items.length ? variationIssueBlocker(prepared) : null;
  if (code === "EMPTY_VARIATION" && !blockers.some((line) => line.includes("at least one"))) {
    blockers.push("Add at least one Variation item.");
  }
  if (code === "INVALID_SUBSTITUTION") {
    blockers.push("Complete both sides of the substitution.");
  }
  if (code === "UNRESOLVED_PRICING" && !blockers.some((line) => line.startsWith("Add a price"))) {
    blockers.push(VARIATION_PRICING_REQUIRED_ACTION);
  }
  if (code === "ZERO_NET_UNDOCUMENTED") {
    blockers.push("Describe the no-cost change, or price the additions and omissions.");
  }
  return { ready: blockers.length === 0, blockers };
}

export function proposedRevisedContract(input: {
  baseline: AcceptedBaselineMoney;
  accepted: readonly RevisedVariationRevision[];
  candidate: RevisedVariationRevision;
}): RevisedContractValue | null {
  const revisions = [
    ...input.accepted.filter((revision) => revision.id !== input.candidate.id),
    { ...input.candidate, status: "accepted" as const, isCurrent: true },
  ];
  const result = calculateRevisedContractValue({
    baseline: input.baseline,
    revisions,
  });
  return result.ok ? result.value : null;
}

export type MarginReadout = {
  costLabel: string | null;
  grossProfitLabel: string | null;
  marginLabel: string | null;
  note: string | null;
};

export function internalMarginReadout(input: {
  currency: string;
  items: readonly PreparedVariationItem[];
  totalsCost: number | null;
  totalsSell: number | null;
}): MarginReadout {
  const commercial = input.items.filter((item) => item.itemType !== "no_cost_scope_change");
  const sellOnly = commercial.some((item) => item.unitCost == null && item.lineSellAdjustmentExGst != null);
  const unresolved = commercial.some((item) => item.lineSellAdjustmentExGst == null);
  const hasOmission = commercial.some((item) => item.itemType === "omission");
  if (unresolved || input.totalsSell == null) {
    return {
      costLabel: input.totalsCost == null ? null : formatSignedAdjustment(input.totalsCost, input.currency),
      grossProfitLabel: null,
      marginLabel: null,
      note: "Margin is not calculated while a price is still required.",
    };
  }
  if (sellOnly || input.totalsCost == null) {
    return {
      costLabel: null,
      grossProfitLabel: null,
      marginLabel: null,
      note: "COST is not known for every item, so margin is not calculated.",
    };
  }
  const profit = roundMoney(input.totalsSell - input.totalsCost);
  const costLabel = formatSignedAdjustment(input.totalsCost, input.currency);
  const grossProfitLabel = formatSignedAdjustment(profit, input.currency);
  if (hasOmission || input.totalsSell <= 0) {
    return {
      costLabel,
      grossProfitLabel,
      marginLabel: null,
      note: "Gross profit is shown in dollars. A single margin percentage is not used when the variation reduces the contract.",
    };
  }
  const margin = roundMoney((profit / input.totalsSell) * 100);
  return {
    costLabel,
    grossProfitLabel,
    marginLabel: `${margin.toFixed(2)}%`,
    note: null,
  };
}

export type DocumentLine = {
  description: string;
  amountLabel: string;
};

export type VariationDocumentModel = {
  companyName: string;
  clientName: string;
  projectTitle: string;
  siteAddress: string | null;
  variationNumber: number;
  revisionNumber: number;
  issueDateLabel: string | null;
  title: string;
  summary: string;
  additions: DocumentLine[];
  omissions: DocumentLine[];
  substitutions: Array<{ remove: DocumentLine; add: DocumentLine; netLabel: string }>;
  noCostChanges: string[];
  netExLabel: string;
  gstLabel: string;
  inclLabel: string;
  currentContractExLabel: string;
  currentContractInclLabel: string;
  proposedExLabel: string;
  proposedGstLabel: string;
  proposedInclLabel: string;
  clientNotes: string | null;
  statusWording: string;
  showsOmissionNotice: boolean;
  acceptancePlaceholder: string;
};

export function buildVariationDocument(input: {
  companyName: string;
  clientName: string;
  projectTitle: string;
  siteAddress: string | null;
  variationNumber: number;
  revisionNumber: number;
  issuedAt: string | null;
  status: VariationStatus;
  title: string;
  summary: string | null;
  clientNotes: string | null;
  currency: string;
  items: readonly {
    itemType: VariationItemType;
    clientDescription: string;
    lineSellAdjustmentExGst: number | null;
    substitutionGroupId: string | null;
    sortOrder: number;
  }[];
  totals: {
    totalSellAdjustmentExGst: number | null;
    gstAdjustment: number | null;
    totalAdjustmentInclGst: number | null;
  };
  baseline: Pick<AcceptedBaselineMoney, "sellExGst" | "sellInclGst">;
  currentContract?: { exGst: number; inclGst: number } | null;
  proposed: Pick<
    RevisedContractValue,
    "revisedContractValueExGst" | "gst" | "revisedContractValueInclGst"
  > | null;
}): VariationDocumentModel {
  const currency = input.currency;
  const priced = input.items.filter((item) => item.lineSellAdjustmentExGst != null);
  const grouped = new Set<string>();
  const substitutions: VariationDocumentModel["substitutions"] = [];
  for (const item of priced) {
    if (!item.substitutionGroupId || grouped.has(item.substitutionGroupId)) continue;
    const pair = priced.filter((row) => row.substitutionGroupId === item.substitutionGroupId);
    const remove = pair.find((row) => row.itemType === "omission");
    const add = pair.find((row) => row.itemType === "addition");
    if (!remove || !add || remove.lineSellAdjustmentExGst == null || add.lineSellAdjustmentExGst == null) {
      continue;
    }
    grouped.add(item.substitutionGroupId);
    const net = roundMoney(remove.lineSellAdjustmentExGst + add.lineSellAdjustmentExGst);
    substitutions.push({
      remove: {
        description: remove.clientDescription,
        amountLabel: formatSignedAdjustment(remove.lineSellAdjustmentExGst, currency),
      },
      add: {
        description: add.clientDescription,
        amountLabel: formatSignedAdjustment(add.lineSellAdjustmentExGst, currency),
      },
      netLabel: formatSignedAdjustment(net, currency),
    });
  }
  const additions = priced
    .filter((item) => item.itemType === "addition" && !item.substitutionGroupId)
    .map((item) => ({
      description: item.clientDescription,
      amountLabel: formatSignedAdjustment(item.lineSellAdjustmentExGst ?? 0, currency),
    }));
  const omissions = priced
    .filter((item) => item.itemType === "omission" && !item.substitutionGroupId)
    .map((item) => ({
      description: item.clientDescription,
      amountLabel: formatSignedAdjustment(item.lineSellAdjustmentExGst ?? 0, currency),
    }));
  const noCostChanges = input.items
    .filter((item) => item.itemType === "no_cost_scope_change")
    .map((item) => item.clientDescription);
  const dash = "—";
  return {
    companyName: input.companyName,
    clientName: input.clientName,
    projectTitle: input.projectTitle,
    siteAddress: input.siteAddress,
    variationNumber: input.variationNumber,
    revisionNumber: input.revisionNumber,
    issueDateLabel: input.issuedAt,
    title: input.title,
    summary: input.summary?.trim() || "",
    additions,
    omissions,
    substitutions,
    noCostChanges,
    netExLabel:
      input.totals.totalSellAdjustmentExGst == null
        ? dash
        : formatSignedAdjustment(input.totals.totalSellAdjustmentExGst, currency),
    gstLabel:
      input.totals.gstAdjustment == null
        ? dash
        : formatSignedAdjustment(input.totals.gstAdjustment, currency),
    inclLabel:
      input.totals.totalAdjustmentInclGst == null
        ? dash
        : formatSignedAdjustment(input.totals.totalAdjustmentInclGst, currency),
    currentContractExLabel: formatContractMoney(
      input.currentContract?.exGst ?? input.baseline.sellExGst,
      currency
    ),
    currentContractInclLabel: formatContractMoney(
      input.currentContract?.inclGst ?? input.baseline.sellInclGst,
      currency
    ),
    proposedExLabel:
      input.proposed == null
        ? dash
        : formatContractMoney(input.proposed.revisedContractValueExGst, currency),
    proposedGstLabel: input.proposed == null ? dash : formatContractMoney(input.proposed.gst, currency),
    proposedInclLabel:
      input.proposed == null
        ? dash
        : formatContractMoney(input.proposed.revisedContractValueInclGst, currency),
    clientNotes: input.clientNotes,
    statusWording:
      input.status === "accepted"
        ? "Accepted Variation."
        : VARIATION_DOCUMENT_PROPOSED_STATUS,
    showsOmissionNotice: omissions.length > 0 || substitutions.length > 0,
    acceptancePlaceholder: "Client acceptance will be available when this Variation is sent.",
  };
}

export function prepareItemsForReadout(
  items: readonly VariationItemInput[]
): PreparedVariationItem[] {
  const prepared: PreparedVariationItem[] = [];
  for (const item of items) {
    const result = prepareVariationItem(item);
    if (result.ok) prepared.push(result.item);
  }
  return prepared;
}

export function revisionTotalsFromItems(
  items: readonly VariationItemInput[],
  gstRate: number
): ReturnType<typeof variationRevisionTotals> | null {
  const prepared: PreparedVariationItem[] = [];
  for (const item of items) {
    const result = prepareVariationItem(item);
    if (!result.ok) return null;
    prepared.push(result.item);
  }
  return variationRevisionTotals(prepared, gstRate);
}
