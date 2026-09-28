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
