import type { ProcessedEventStatus } from "@/lib/billing/types";

export type EventClaimDecision =
  | { action: "process"; reason: "claimed" | "retry_failed" }
  | {
      action: "skip";
      reason: "already_processed" | "already_ignored" | "in_flight";
    };

export function decideProcessedEventClaim(
  existing: { status: ProcessedEventStatus } | null
): EventClaimDecision {
  if (!existing) {
    return { action: "process", reason: "claimed" };
  }
  if (existing.status === "processed") {
    return { action: "skip", reason: "already_processed" };
  }
  if (existing.status === "ignored") {
    return { action: "skip", reason: "already_ignored" };
  }
  if (existing.status === "failed") {
    return { action: "process", reason: "retry_failed" };
  }
  return { action: "skip", reason: "in_flight" };
}

/**
 * Ignore Stripe updates whose event.created is older than the last applied
 * event on the org_subscriptions row. Equal timestamps are applied (idempotency
 * already prevents the same event id). This is the primary out-of-order guard.
 */
export function shouldApplyStripeEvent(input: {
  eventCreatedUnix: number;
  lastAppliedEventCreatedAt: string | null;
}): boolean {
  if (!input.lastAppliedEventCreatedAt) {
    return true;
  }
  const lastUnix = Math.floor(
    new Date(input.lastAppliedEventCreatedAt).getTime() / 1000
  );
  if (!Number.isFinite(lastUnix)) {
    return true;
  }
  return input.eventCreatedUnix >= lastUnix;
}

export function unixSecondsToIso(unix: number | null | undefined): string | null {
  if (unix == null || !Number.isFinite(unix)) {
    return null;
  }
  return new Date(unix * 1000).toISOString();
}
