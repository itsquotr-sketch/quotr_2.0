/**
 * Read-only Variation response receipt.
 * Built from the immutable response row, the original accepted Quote snapshot,
 * and ledger rows accepted at or before that response. It does not recalculate
 * the Variation or rewrite the snapshot.
 */

import {
  VARIATION_QUOTE_REFERENCE_UNAVAILABLE,
  parseVariationDocumentIdentity,
  variationMasterQuoteClause,
} from "@/lib/variations/document-identity";
import { formatInOrgTimezone } from "@/lib/org/timezone";
import { formatContractMoney, formatSignedAdjustment } from "@/lib/variations/presentation";
import {
  VARIATION_ACCEPT_ATTACHMENTS_VERSION,
  VARIATION_ACCEPT_AUTHORITY_VERSION,
  VARIATION_ACCEPT_FINAL_VERSION,
  VARIATION_ACCEPT_MASTER_TERMS_VERSION,
  VARIATION_ACCEPT_SCOPE_VERSION,
  VARIATION_DECLINE_FINAL_VERSION,
  VARIATION_MANUAL_RECEIVED_VERSION,
  variationAcceptFinalConfirmation,
  variationAttachmentConfirmation,
  variationAuthorityConfirmation,
  variationDeclineFinalConfirmation,
  variationManualReceivedConfirmation,
  variationMasterTermsConfirmation,
  variationScopeConfirmation,
  type VariationResponseOutcome,
  type VariationResponseSource,
} from "@/lib/variations/response";

export type VariationResponseReceiptFile = {
  displayFilename: string;
  caption: string | null;
  mimeType: string;
  byteSize: number;
};

export type VariationResponseReceipt = {
  reference: string;
  outcome: VariationResponseOutcome;
  outcomeLabel: "Accepted" | "Declined";
  sourceLabel: "Client response" | "Recorded manually";
  companyName: string;
  legalName: string | null;
  logoUrl: string | null;
  contractorEmail: string | null;
  contractorPhone: string | null;
  contractorWebsite: string | null;
  contractorAddress: string | null;
  registrationLines: string[];
  brandPrimary: string | null;
  clientName: string | null;
  projectTitle: string;
  siteAddress: string | null;
  variationNumber: number;
  revisionNumber: number;
  quoteNumber: string | null;
  quoteRevision: number | null;
  masterQuoteStatement: string;
  respondedAtLabel: string;
  responderName: string;
  responderEmail: string | null;
  currency: string;
  adjustmentExGst: number;
  adjustmentGst: number;
  adjustmentInclGst: number;
  adjustmentExLabel: string;
  adjustmentGstLabel: string;
  adjustmentInclLabel: string;
  previousContractExGst: number;
  previousContractInclGst: number;
  previousContractExLabel: string;
  previousContractInclLabel: string;
  revisedContractExGst: number | null;
  revisedContractInclGst: number | null;
  revisedContractExLabel: string | null;
  revisedContractInclLabel: string | null;
  contractUnchanged: boolean;
  attachmentCount: number;
  attachments: VariationResponseReceiptFile[];
  confirmations: string[];
  declineReason: string | null;
};

export type VariationReceiptMoney = {
  exGst: number;
  gst: number;
  inclGst: number;
};

const CONFIRMATION_ORDER = [
  "authority",
  "scopeAndPrice",
  "attachments",
  "masterQuoteTerms",
  "final",
  "received",
] as const;

function money(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function addMoney(values: number[]): number {
  const cents = values.reduce((sum, value) => sum + Math.round(value * 100), 0);
  return cents / 100;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function confirmationSentence(version: string, attachmentCount: number): string | null {
  switch (version) {
    case VARIATION_ACCEPT_AUTHORITY_VERSION:
      return variationAuthorityConfirmation();
    case VARIATION_ACCEPT_SCOPE_VERSION:
      return variationScopeConfirmation();
    case VARIATION_ACCEPT_ATTACHMENTS_VERSION:
      return variationAttachmentConfirmation(attachmentCount);
    case VARIATION_ACCEPT_MASTER_TERMS_VERSION:
      return variationMasterTermsConfirmation();
    case VARIATION_ACCEPT_FINAL_VERSION:
      return variationAcceptFinalConfirmation();
    case VARIATION_DECLINE_FINAL_VERSION:
      return variationDeclineFinalConfirmation();
    case VARIATION_MANUAL_RECEIVED_VERSION:
      return variationManualReceivedConfirmation();
    default:
      return null;
  }
}

function parseManifest(value: unknown): { count: number; files: VariationResponseReceiptFile[] } | null {
  const row = asRecord(value);
  if (!row) return null;
  const count = money(row.count);
  if (count == null || !Number.isInteger(count) || count < 0) return null;
  const rawFiles = Array.isArray(row.files) ? row.files : null;
  if (!rawFiles || rawFiles.length !== count) return null;
  const files: VariationResponseReceiptFile[] = [];
  for (const file of rawFiles) {
    const record = asRecord(file);
    if (!record) return null;
    const displayFilename = typeof record.displayFilename === "string" ? record.displayFilename.trim() : "";
    const mimeType = typeof record.mimeType === "string" ? record.mimeType.trim() : "";
    const byteSize = money(record.byteSize);
    if (!displayFilename || !mimeType || byteSize == null || byteSize < 0) return null;
    const caption = typeof record.caption === "string" && record.caption.trim() ? record.caption.trim() : null;
    files.push({ displayFilename, caption, mimeType, byteSize });
  }
  return { count, files };
}

function parseConfirmations(value: unknown, attachmentCount: number): string[] | null {
  const row = asRecord(value);
  if (!row) return null;
  const lines: string[] = [];
  for (const key of CONFIRMATION_ORDER) {
    const version = row[key];
    if (version == null) continue;
    if (typeof version !== "string") return null;
    const sentence = confirmationSentence(version, attachmentCount);
    if (!sentence) return null;
    lines.push(sentence);
  }
  return lines;
}

export function buildVariationResponseReceipt(input: {
  outcome: VariationResponseOutcome;
  source: VariationResponseSource;
  respondedAt: string;
  responderName: string;
  responderEmail: string | null;
  declineReason: string | null;
  issued: VariationReceiptMoney;
  currency: string;
  documentIdentity: unknown;
  clientAttachmentManifest: unknown;
  confirmationVersions: unknown;
  variationNumber: number;
  revisionNumber: number;
  baseline: VariationReceiptMoney | null;
  earlierAdjustments: VariationReceiptMoney[];
}): VariationResponseReceipt | null {
  if (!Number.isInteger(input.variationNumber) || input.variationNumber < 1) return null;
  if (!Number.isInteger(input.revisionNumber) || input.revisionNumber < 1) return null;
  if (!input.responderName.trim() || !input.respondedAt) return null;
  if (!input.baseline) return null;
  const identity = parseVariationDocumentIdentity(input.documentIdentity);
  if (!identity) return null;
  const manifest = parseManifest(input.clientAttachmentManifest);
  if (!manifest) return null;
  const confirmations = parseConfirmations(input.confirmationVersions, manifest.count);
  if (!confirmations) return null;
  const respondedAtLabel = formatInOrgTimezone(input.respondedAt, identity.timezone ?? undefined);
  if (!respondedAtLabel) return null;

  const earlierEx = input.earlierAdjustments.map((row) => row.exGst);
  const earlierIncl = input.earlierAdjustments.map((row) => row.inclGst);
  if (earlierEx.some((value) => !Number.isFinite(value)) || earlierIncl.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const previousEx = addMoney([input.baseline.exGst, ...earlierEx]);
  const previousIncl = addMoney([input.baseline.inclGst, ...earlierIncl]);
  const accepted = input.outcome === "accepted";
  const revisedEx = accepted ? addMoney([previousEx, input.issued.exGst]) : null;
  const revisedIncl = accepted ? addMoney([previousIncl, input.issued.inclGst]) : null;
  const currency = input.currency.trim() || "NZD";
  const quoteNumber = identity.quoteNumber;
  const quoteRevision = identity.quoteRevision;
  const reference = `${quoteNumber ?? "Quote"}-V${input.variationNumber}-R${input.revisionNumber}`;

  return {
    reference,
    outcome: input.outcome,
    outcomeLabel: accepted ? "Accepted" : "Declined",
    sourceLabel: input.source === "client" ? "Client response" : "Recorded manually",
    companyName: identity.companyName,
    legalName: identity.legalName,
    logoUrl: identity.logoUrl,
    contractorEmail: identity.email,
    contractorPhone: identity.phone,
    contractorWebsite: identity.website,
    contractorAddress: identity.address,
    registrationLines: identity.registrationLines,
    brandPrimary: identity.brandPrimary,
    clientName: identity.clientName,
    projectTitle: identity.projectTitle,
    siteAddress: identity.siteAddress,
    variationNumber: input.variationNumber,
    revisionNumber: input.revisionNumber,
    quoteNumber,
    quoteRevision,
    masterQuoteStatement:
      quoteNumber && quoteRevision != null
        ? variationMasterQuoteClause(quoteNumber, quoteRevision)
        : VARIATION_QUOTE_REFERENCE_UNAVAILABLE,
    respondedAtLabel,
    responderName: input.responderName.trim(),
    responderEmail: input.responderEmail,
    currency,
    adjustmentExGst: input.issued.exGst,
    adjustmentGst: input.issued.gst,
    adjustmentInclGst: input.issued.inclGst,
    adjustmentExLabel: formatSignedAdjustment(input.issued.exGst, currency),
    adjustmentGstLabel: formatSignedAdjustment(input.issued.gst, currency),
    adjustmentInclLabel: formatSignedAdjustment(input.issued.inclGst, currency),
    previousContractExGst: previousEx,
    previousContractInclGst: previousIncl,
    previousContractExLabel: formatContractMoney(previousEx, currency),
    previousContractInclLabel: formatContractMoney(previousIncl, currency),
    revisedContractExGst: revisedEx,
    revisedContractInclGst: revisedIncl,
    revisedContractExLabel: revisedEx == null ? null : formatContractMoney(revisedEx, currency),
    revisedContractInclLabel: revisedIncl == null ? null : formatContractMoney(revisedIncl, currency),
    contractUnchanged: !accepted,
    attachmentCount: manifest.count,
    attachments: manifest.files,
    confirmations,
    declineReason: input.source === "client" && input.outcome === "declined" ? input.declineReason : null,
  };
}
