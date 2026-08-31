import type { Quote, QuoteStatus } from "@/lib/quotes/types";

// Future entitlements (do not hard-code plan names):
// Builder + Business: quotes.send, quotes.acceptance
// Business additionally: quote.approval, margin.guardrails, team roles/audit.

export const QUOTE_SNAPSHOT_IMMUTABLE_STATUSES: QuoteStatus[] = [
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "superseded",
  "archived",
];

const TERMINAL_STATUSES: QuoteStatus[] = [
  "accepted",
  "declined",
  "expired",
  "superseded",
  "archived",
];

const VALID_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ["sent", "archived"],
  sent: ["viewed", "accepted", "declined", "expired", "superseded"],
  viewed: ["accepted", "declined", "expired", "superseded"],
  accepted: [],
  declined: [],
  expired: [],
  superseded: [],
  archived: [],
};

export type QuoteTransitionResult =
  | { ok: true; idempotent: boolean }
  | { ok: false; error: string };

export function quoteThreadId(quote: Pick<Quote, "id" | "parent_quote_id">): string {
  return quote.parent_quote_id ?? quote.id;
}

export function quoteHasActiveSendLock(
  quote: Pick<Quote, "send_lock_delivery_id">
): boolean {
  return Boolean(quote.send_lock_delivery_id);
}

export function canMutateQuoteSnapshot(
  quote: Pick<Quote, "status" | "superseded_by_quote_id" | "send_lock_delivery_id">
): boolean {
  return (
    quote.status === "draft" &&
    quote.superseded_by_quote_id == null &&
    !quoteHasActiveSendLock(quote)
  );
}

export function assertQuoteSnapshotMutable(
  quote: Pick<Quote, "status" | "superseded_by_quote_id" | "send_lock_delivery_id">
): string | null {
  if (quote.superseded_by_quote_id) {
    return "This quote has been superseded. Open the latest revision to edit.";
  }
  if (quoteHasActiveSendLock(quote)) {
    return "This quote cannot be edited while it is being sent.";
  }
  if (!canMutateQuoteSnapshot(quote)) {
    return "Only draft quotes can be edited. Create a revision instead.";
  }
  return null;
}

export function isQuoteStatusTransitionAllowed(
  from: QuoteStatus,
  to: QuoteStatus
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertQuoteStatusTransition(
  from: QuoteStatus,
  to: QuoteStatus
): QuoteTransitionResult {
  if (from === to) {
    return { ok: true, idempotent: true };
  }
  if (!isQuoteStatusTransitionAllowed(from, to)) {
    return {
      ok: false,
      error: `Cannot change a ${from} quote to ${to}.`,
    };
  }
  return { ok: true, idempotent: false };
}

export function canMarkQuoteSent(status: QuoteStatus): boolean {
  return status === "draft" || status === "sent";
}

export function canMarkQuoteViewed(status: QuoteStatus): boolean {
  return status === "sent" || status === "viewed";
}

export function canMarkQuoteAccepted(status: QuoteStatus): boolean {
  return status === "sent" || status === "viewed" || status === "accepted";
}

export function canMarkQuoteDeclined(status: QuoteStatus): boolean {
  return status === "sent" || status === "viewed" || status === "declined";
}

export function canMarkQuoteExpired(status: QuoteStatus): boolean {
  return status === "sent" || status === "viewed" || status === "expired";
}

export function canIssueQuoteDelivery(status: QuoteStatus): boolean {
  return status === "draft";
}

export function canResendQuoteDelivery(status: QuoteStatus): boolean {
  return (
    status === "sent" ||
    status === "viewed" ||
    status === "accepted" ||
    status === "declined" ||
    status === "expired"
  );
}

export function isQuoteLifecycleTerminal(status: QuoteStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * valid_until is a calendar date. Inclusive on that Auckland day.
 * Expired when Auckland today is after valid_until.
 */
export function isQuoteExpired(
  quote: Pick<Quote, "status" | "valid_until" | "expired_at">,
  now: Date = new Date()
): boolean {
  if (quote.status === "expired" || quote.expired_at) return true;
  if (!quote.valid_until) return false;
  const today = now.toLocaleDateString("en-CA", {
    timeZone: "Pacific/Auckland",
  });
  return quote.valid_until < today;
}

export function shouldSupersedeQuoteOnSend(quote: Pick<Quote, "status">): boolean {
  return quote.status === "sent" || quote.status === "viewed";
}

export const QUOTE_STATUS_TRANSITION_MATRIX = VALID_TRANSITIONS;
