import type { QuoteActorType } from "@/lib/quotes/types";

export const INSERT_DRAFT_QUOTE_RPC = "insert_draft_quote_v1";
export const CREATE_QUOTE_REVISION_RPC = "create_quote_revision_v1";
export const SEND_QUOTE_REVISION_RPC = "send_quote_revision_v1";
export const ACCEPT_QUOTE_REVISION_RPC = "accept_quote_revision_v1";
export const DECLINE_QUOTE_REVISION_RPC = "decline_quote_revision_v1";
export const EXPIRE_QUOTE_REVISION_RPC = "expire_quote_revision_v1";
export const MARK_QUOTE_VIEWED_RPC = "mark_quote_viewed_v1";
export const ALLOCATE_ORG_QUOTE_NUMBER_RPC = "allocate_org_quote_number_v1";
export const APPEND_QUOTE_UPDATED_RPC = "append_quote_updated_v1";
export const PREPARE_QUOTE_DELIVERY_RPC = "prepare_quote_delivery_v1";
export const RECORD_QUOTE_DELIVERY_ACCEPTED_RPC =
  "record_quote_delivery_accepted_v1";
export const FINALIZE_QUOTE_DELIVERY_RPC = "finalize_quote_delivery_v1";
export const FAIL_QUOTE_DELIVERY_RPC = "fail_quote_delivery_v1";
export const ACCEPT_QUOTE_BY_ACCESS_TOKEN_RPC =
  "accept_quote_by_access_token_v1";
export const DECLINE_QUOTE_BY_ACCESS_TOKEN_RPC =
  "decline_quote_by_access_token_v1";

export type QuoteTxnResult = {
  ok: boolean;
  idempotent?: boolean;
  quoteId?: string;
  status?: string;
  quoteNumber?: string | null;
  revisionNumber?: number;
  supersededQuoteIds?: string[];
};

export type QuoteDeliveryTxnResult = {
  ok: boolean;
  reuse?: boolean;
  skipSubmit?: boolean;
  skipProvider?: boolean;
  needsFinalize?: boolean;
  inProgress?: boolean;
  idempotent?: boolean;
  deliveryId?: string;
  status?: string;
  quoteId?: string;
  quoteStatus?: string;
  attemptNumber?: number;
  idempotencyKey?: string;
  providerMessageId?: string;
};

type QuoteRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export async function invokeQuoteTxn(
  supabase: QuoteRpcClient,
  fn: string,
  args: Record<string, unknown> = {}
): Promise<{ result: QuoteTxnResult } | { error: string }> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    return { error: mapQuoteTxnError(error) };
  }
  const result = parseQuoteTxnResult(data);
  if (!result) {
    return { error: mapQuoteTxnError(null) };
  }
  return { result };
}

export function mapQuoteTxnError(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("QUOTE_TXN:NOT_AUTHENTICATED")) {
    return "Your session may have expired. Please sign in again and retry.";
  }
  if (message.includes("QUOTE_TXN:NOT_FOUND")) {
    return "Quote not found.";
  }
  if (message.includes("QUOTE_TXN:INVALID_TRANSITION")) {
    return "This quote cannot change to that status.";
  }
  if (message.includes("QUOTE_TXN:ISSUER_REQUIRED")) {
    return "Complete company details before sending this quote.";
  }
  if (message.includes("QUOTE_TXN:FINGERPRINT_REQUIRED")) {
    return "Could not freeze this quote snapshot. Please try again.";
  }
  if (message.includes("QUOTE_TXN:INVALID_PAYLOAD")) {
    return "Could not update the quote. Please try again.";
  }
  if (message.includes("QUOTE_TXN:SEND_IN_PROGRESS")) {
    return "This quote is already being sent. Please wait or retry finalising.";
  }
  return "Could not update quote status. Please try again.";
}

export function parseQuoteDeliveryTxnResult(
  data: unknown
): QuoteDeliveryTxnResult | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.ok !== true) return null;
  return {
    ok: true,
    reuse: Boolean(row.reuse),
    skipSubmit: Boolean(row.skipSubmit),
    skipProvider: Boolean(row.skipProvider),
    needsFinalize: Boolean(row.needsFinalize),
    inProgress: Boolean(row.inProgress),
    idempotent: Boolean(row.idempotent),
    deliveryId: typeof row.deliveryId === "string" ? row.deliveryId : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    quoteId: typeof row.quoteId === "string" ? row.quoteId : undefined,
    quoteStatus:
      typeof row.quoteStatus === "string" ? row.quoteStatus : undefined,
    attemptNumber:
      typeof row.attemptNumber === "number" ? row.attemptNumber : undefined,
    idempotencyKey:
      typeof row.idempotencyKey === "string" ? row.idempotencyKey : undefined,
    providerMessageId:
      typeof row.providerMessageId === "string"
        ? row.providerMessageId
        : undefined,
  };
}

export async function invokeQuoteDeliveryTxn(
  supabase: QuoteRpcClient,
  fn: string,
  args: Record<string, unknown> = {}
): Promise<{ result: QuoteDeliveryTxnResult } | { error: string }> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    return { error: mapQuoteTxnError(error) };
  }
  const result = parseQuoteDeliveryTxnResult(data);
  if (!result) {
    return { error: mapQuoteTxnError(null) };
  }
  return { result };
}

export function parseQuoteTxnResult(data: unknown): QuoteTxnResult | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.ok !== true) return null;
  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    quoteId: typeof row.quoteId === "string" ? row.quoteId : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    quoteNumber:
      typeof row.quoteNumber === "string" ? row.quoteNumber : null,
    revisionNumber:
      typeof row.revisionNumber === "number" ? row.revisionNumber : undefined,
    supersededQuoteIds: Array.isArray(row.supersededQuoteIds)
      ? row.supersededQuoteIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export type QuoteRpcActor = QuoteActorType;
