/**
 * Presentation mapping for the internal Variations workspace.
 * Commercial totals stay in the variation domain. This module only
 * formats, signs form magnitudes, and chooses human copy.
 */

import { deriveSellFromCost } from "@/lib/commercial-engine/core/sell-from-margin";
import { roundMoney } from "@/lib/commercial-engine/core/money";
import {
  presentVariationIssueDate,
  variationMasterQuoteClause,
  type VariationDocumentIdentity,
} from "@/lib/variations/document-identity";
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
  "You’re about to issue Variation {number}, revision {revision}. This revision includes {attachments} client attachments. Once issued, its scope, pricing and client attachments cannot be changed.";

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

export function issueConfirmationCopy(
  variationNumber: number,
  revisionNumber: number,
  clientAttachmentCount = 0
): string {
  const count = Number.isFinite(clientAttachmentCount) ? Math.max(0, Math.trunc(clientAttachmentCount)) : 0;
  const noun = count === 1 ? "client attachment" : "client attachments";
  return VARIATION_ISSUE_CONFIRM_TEMPLATE
    .replace("{number}", String(variationNumber))
    .replace("{revision}", String(revisionNumber))
    .replace("{attachments} client attachments", `${count} ${noun}`);
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
      return "Calculated from internal cost and target margin";
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

export const VARIATION_READY_HEADING = "Ready to issue";
export const VARIATION_READY_DETAIL = "This revision has the required details and pricing.";
export const VARIATION_NOT_READY_HEADING = "Not ready to issue";

export type VariationReadiness = {
  ready: boolean;
  blockerCodes: string[];
  blockers: string[];
};

/**
 * Flat manual item arithmetic. Quantity times unit cost and unit sell use
 * the shared money rounding. Later material and labour components can replace
 * the unit cost input without a second totals path.
 */
export function variationUnitLineReadout(input: {
  quantity: number;
  unit: string;
  unitCost: number | null;
  unitSell: number | null;
  sign: 1 | -1;
  currency: string;
}): {
  quantityLabel: string;
  unitCostLabel: string | null;
  lineCost: number | null;
  lineCostLabel: string | null;
  unitSellLabel: string | null;
  lineSell: number | null;
  lineSellLabel: string | null;
  grossProfit: number | null;
  grossProfitLabel: string | null;
  marginLabel: string | null;
} {
  const quantityLabel = `${input.quantity} ${input.unit}`;
  const lineCost = input.unitCost == null ? null : roundMoney(input.quantity * input.unitCost);
  const lineSell = input.unitSell == null ? null : roundMoney(input.quantity * input.unitSell);
  const signedCost = lineCost == null ? null : roundMoney(lineCost * input.sign);
  const signedSell = lineSell == null ? null : roundMoney(lineSell * input.sign);
  const grossProfit =
    signedCost == null || signedSell == null ? null : roundMoney(signedSell - signedCost);
  const margin =
    grossProfit == null || signedSell == null || signedSell <= 0
      ? null
      : roundMoney((grossProfit / signedSell) * 100);
  const times = (unitAmount: number, lineAmount: number, signed: number): string => {
    const equation = `${input.quantity} × ${formatContractMoney(unitAmount, input.currency)} = ${formatContractMoney(lineAmount, input.currency)}`;
    return input.sign < 0 ? formatSignedAdjustment(signed, input.currency) : equation;
  };
  return {
    quantityLabel,
    unitCostLabel: input.unitCost == null ? null : formatContractMoney(input.unitCost, input.currency),
    lineCost,
    lineCostLabel:
      input.unitCost == null || lineCost == null || signedCost == null
        ? null
        : times(input.unitCost, lineCost, signedCost),
    unitSellLabel: input.unitSell == null ? null : formatContractMoney(input.unitSell, input.currency),
    lineSell,
    lineSellLabel:
      input.unitSell == null || lineSell == null || signedSell == null
        ? null
        : input.sign < 0
          ? formatSignedAdjustment(signedSell, input.currency)
          : `${input.quantity} × ${formatContractMoney(input.unitSell, input.currency)} = ${formatContractMoney(lineSell, input.currency)} ex GST`,
    grossProfit,
    grossProfitLabel: grossProfit == null ? null : formatSignedAdjustment(grossProfit, input.currency),
    marginLabel: margin == null ? null : `${margin.toFixed(1)}%`,
  };
}

export function variationIssueReadiness(input: {
  title: string;
  summary: string | null;
  items: readonly VariationItemInput[];
  clientAttachments?: readonly { uploadStatus: string; objectConfirmed: boolean }[];
}): VariationReadiness {
  const blockers: string[] = [];
  const blockerCodes: string[] = [];
  function add(code: string, message: string): void {
    if (blockerCodes.includes(code) && blockers.includes(message)) return;
    blockerCodes.push(code);
    blockers.push(message);
  }
  if (!input.title.trim()) add("MISSING_TITLE", "Add a title before issuing.");
  if (!input.summary?.trim()) {
    add("MISSING_SUMMARY", "Add a client-facing summary before issuing.");
  }
  if (input.items.length === 0) add("EMPTY_VARIATION", "Add at least one Variation item.");

  const prepared: PreparedVariationItem[] = [];
  for (const item of input.items) {
    const result = prepareVariationItem(item);
    if (!result.ok) {
      if (item.unitSell == null && item.itemType !== "no_cost_scope_change") {
        add("UNRESOLVED_PRICING", `Add a price for ${item.clientDescription.trim() || "this item"}.`);
      } else if (item.itemType === "addition") {
        add("INVALID_ADDITION", `Enter a positive amount for ${item.clientDescription.trim() || "this addition"}.`);
      } else if (item.itemType === "omission") {
        add("INVALID_OMISSION", `Enter the amount to remove for ${item.clientDescription.trim() || "this omission"}.`);
      } else {
        add("INVALID_ITEM", "Check this Variation item and try again.");
      }
      continue;
    }
    prepared.push(result.item);
    if (result.item.lineSellAdjustmentExGst == null) {
      add("UNRESOLVED_PRICING", `Add a price for ${item.clientDescription.trim() || "this item"}.`);
    }
  }

  const code = prepared.length === input.items.length ? variationIssueBlocker(prepared) : null;
  if (code === "EMPTY_VARIATION" && !blockers.some((line) => line.includes("at least one"))) {
    add("EMPTY_VARIATION", "Add at least one Variation item.");
  }
  if (code === "INVALID_SUBSTITUTION") {
    add("INVALID_SUBSTITUTION", "Complete both sides of the substitution.");
  }
  if (code === "UNRESOLVED_PRICING" && !blockers.some((line) => line.startsWith("Add a price"))) {
    add("UNRESOLVED_PRICING", VARIATION_PRICING_REQUIRED_ACTION);
  }
  if (code === "ZERO_NET_UNDOCUMENTED") {
    add("ZERO_NET_UNDOCUMENTED", "Describe the no-cost change, or price the additions and omissions.");
  }
  if ((input.clientAttachments ?? []).some((file) => file.uploadStatus !== "ready" || !file.objectConfirmed)) {
    add("ATTACHMENT_INCOMPLETE", "Finish or remove the client attachments that are still uploading or failed.");
  }
  return { ready: blockers.length === 0, blockerCodes, blockers };
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
  const incomplete = input.items.some((item) => item.costIncomplete);
  const sellOnly = commercial.some((item) => item.lineCostAdjustment == null && item.lineSellAdjustmentExGst != null);
  const unresolved = commercial.some((item) => item.lineSellAdjustmentExGst == null);
  const hasOmission = commercial.some((item) => item.itemType === "omission");
  if (incomplete && !unresolved && input.totalsSell != null) {
    return {
      costLabel: input.totalsCost == null ? null : formatSignedAdjustment(input.totalsCost, input.currency),
      grossProfitLabel: null,
      marginLabel: null,
      note: "Internal cost is incomplete. Margin and profit are not available.",
    };
  }
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
  logoUrl: string | null;
  legalName: string | null;
  contractorAddress: string | null;
  contractorEmail: string | null;
  contractorPhone: string | null;
  contractorWebsite: string | null;
  registrationLines: string[];
  brandPrimary: string | null;
  quoteNumber: string | null;
  quoteRevision: number | null;
  quoteAcceptedOnLabel: string | null;
  masterQuoteClause: string | null;
  statusWording: string;
  showsOmissionNotice: boolean;
  acceptancePlaceholder: string;
  supportingFiles: VariationSupportingFile[];
};

export type VariationSupportingFile = {
  fileId: string;
  displayFilename: string;
  caption: string | null;
  mimeType: string;
  byteSize: number;
  typeLabel: string;
  sizeLabel: string;
  kind: "image" | "document";
  viewUrl: string | null;
  downloadUrl: string | null;
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
    quantity?: number;
    unit?: string;
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
  identity?: VariationDocumentIdentity | null;
  supportingFiles?: VariationSupportingFile[];
}): VariationDocumentModel {
  const identity = input.identity ?? null;
  const quoteClause =
    identity?.available && identity.quoteNumber && identity.quoteRevision != null
      ? variationMasterQuoteClause(identity.quoteNumber, identity.quoteRevision)
      : null;
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
        description: clientScopeLabel(remove),
        amountLabel: formatSignedAdjustment(remove.lineSellAdjustmentExGst, currency),
      },
      add: {
        description: clientScopeLabel(add),
        amountLabel: formatSignedAdjustment(add.lineSellAdjustmentExGst, currency),
      },
      netLabel: formatSignedAdjustment(net, currency),
    });
  }
  const additions = priced
    .filter((item) => item.itemType === "addition" && !item.substitutionGroupId)
    .map((item) => ({
      description: clientScopeLabel(item),
      amountLabel: formatSignedAdjustment(item.lineSellAdjustmentExGst ?? 0, currency),
    }));
  const omissions = priced
    .filter((item) => item.itemType === "omission" && !item.substitutionGroupId)
    .map((item) => ({
      description: clientScopeLabel(item),
      amountLabel: formatSignedAdjustment(item.lineSellAdjustmentExGst ?? 0, currency),
    }));
  function clientScopeLabel(item: { clientDescription: string; quantity?: number; unit?: string }): string {
    if (item.quantity == null || !item.unit) return item.clientDescription;
    return `${item.clientDescription} · ${item.quantity} ${item.unit}`;
  }

  const noCostChanges = input.items
    .filter((item) => item.itemType === "no_cost_scope_change")
    .map((item) => item.clientDescription);
  const dash = "—";
  return {
    companyName: identity ? identity.companyName || input.companyName : input.companyName,
    clientName: identity ? identity.clientName ?? "" : input.clientName,
    projectTitle: identity ? identity.projectTitle || input.projectTitle : input.projectTitle,
    siteAddress: identity ? identity.siteAddress : input.siteAddress,
    variationNumber: input.variationNumber,
    revisionNumber: input.revisionNumber,
    issueDateLabel: presentVariationIssueDate(input.issuedAt, identity?.timezone),
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
    logoUrl: identity?.logoUrl ?? null,
    legalName: identity?.legalName ?? null,
    contractorAddress: identity?.address ?? null,
    contractorEmail: identity?.email ?? null,
    contractorPhone: identity?.phone ?? null,
    contractorWebsite: identity?.website ?? null,
    registrationLines: identity?.registrationLines ?? [],
    brandPrimary: identity?.brandPrimary ?? null,
    quoteNumber: identity?.quoteNumber ?? null,
    quoteRevision: identity?.quoteRevision ?? null,
    quoteAcceptedOnLabel: identity?.acceptedOnLabel ?? null,
    masterQuoteClause: quoteClause,
    statusWording:
      input.status === "accepted"
        ? "Accepted Variation."
        : VARIATION_DOCUMENT_PROPOSED_STATUS,
    showsOmissionNotice: omissions.length > 0 || substitutions.length > 0,
    acceptancePlaceholder: "Client acceptance will be available when this Variation is sent.",
    supportingFiles: input.supportingFiles ?? [],
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

/** List label only. It does not replace the Variation status. */
export function variationDeliveryListLabel(input: {
  status: VariationStatus;
  latestAttempt: "sent" | "failed" | null;
}): string | null {
  if (input.status === "withdrawn") return "Withdrawn";
  if (input.status !== "issued") return null;
  if (input.latestAttempt === "sent") return "Issued · Sent";
  if (input.latestAttempt === "failed") return "Issued · Delivery failed";
  return "Issued · Not sent";
}
