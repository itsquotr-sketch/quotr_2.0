import type { VariationStatus } from "@/lib/variations/domain";

export type VariationScopeLineOption = {
  id: string;
  workAreaId: string | null;
  workAreaName: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  acceptedSellLabel: string | null;
};

export type VariationWorkAreaOption = {
  id: string;
  name: string;
};

export type VariationBaselineView = {
  currency: string;
  gstRate: number;
  taxTreatment: string;
  sellExGst: number;
  gstAmount: number;
  sellInclGst: number;
  referenceLabel: string;
};

export type VariationListRow = {
  id: string;
  variationNumber: number;
  title: string;
  status: VariationStatus;
  statusLabel: string;
  revisionNumber: number | null;
  netExGst: number | null;
  gst: number | null;
  inclGst: number | null;
  createdAt: string;
  issuedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  withdrawnAt: string | null;
  outcomeLabel: string | null;
  responseSource: "Client" | "Manual" | null;
  responderName: string | null;
  declineReason: string | null;
  revisedContractInclGst: number | null;
  currentRevisionId: string | null;
  deliveryLabel: string | null;
};

export type VariationDeliveryAttempt = {
  id: string;
  revisionId: string;
  recipientEmail: string;
  status: "pending" | "sent" | "failed";
  kind: "send" | "resend";
  attemptedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  failureMessage: string | null;
};

export type VariationListSummary = {
  originalAcceptedExGst: number;
  originalAcceptedInclGst: number;
  acceptedAdjustmentExGst: number;
  revisedAcceptedExGst: number;
  revisedAcceptedInclGst: number;
  pendingIssuedExGst: number;
  draftCount: number;
  currency: string;
};

export type VariationResponseView = {
  outcome: "accepted" | "declined";
  sourceLabel: "Client" | "Manual";
  responderName: string;
  respondedAt: string | null;
  declineReason: string | null;
  evidenceTypeLabel: string | null;
  evidenceNote: string | null;
  adjustmentInclGst: number;
};

export type VariationRevisionHistoryRow = {
  id: string;
  revisionNumber: number;
  title: string;
  status: VariationStatus;
  statusLabel: string;
  issuedAt: string | null;
  issuedAtIso: string | null;
  withdrawnAt: string | null;
  netExGst: number | null;
  label: "Current" | "Historical";
};

export type VariationAttachmentView = {
  id: string;
  revisionId: string;
  visibility: "client" | "internal";
  displayFilename: string;
  mimeType: string;
  byteSize: number;
  caption: string | null;
  internalDescription: string | null;
  linkedVariationItemId: string | null;
  sortOrder: number;
  uploadStatus: "pending" | "ready" | "failed";
  objectConfirmed: boolean;
  createdAt: string;
  frozen: boolean;
};
