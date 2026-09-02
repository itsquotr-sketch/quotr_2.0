import type { SeatOperationKind, SeatOperationStatus } from "@/lib/team/seat-operations";

/** Durable Stripe mutation in progress. Advisory locks do not cover this window. */
export const SEAT_IN_FLIGHT_STATUSES: readonly SeatOperationStatus[] = [
  "pending",
  "awaiting_payment",
  "awaiting_mirror",
];

export const SEAT_CLAIMABLE_STATUSES: readonly SeatOperationStatus[] = [
  "queued",
  "failed",
];

export const SEAT_TERMINAL_STATUSES: readonly SeatOperationStatus[] = [
  "completed",
  "cancelled",
];

export function isSeatOperationInFlight(status: SeatOperationStatus): boolean {
  return (SEAT_IN_FLIGHT_STATUSES as readonly string[]).includes(status);
}

export function isSeatOperationClaimable(status: SeatOperationStatus): boolean {
  return (SEAT_CLAIMABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Insert always as queued, then claim. The claim step is the single-flight
 * authority so two concurrent accepts cannot both become pending.
 */
export function initialSeatOperationStatus(): "queued" {
  return "queued";
}

export type SeatQueueOp = {
  id: string;
  kind: SeatOperationKind;
  status: SeatOperationStatus;
  createdAt: string;
  membershipId?: string;
};

/**
 * Oldest claimable operation. Failed ops stay ahead of later queued ops so
 * we never skip a payment-attention seat to charge the next person.
 */
export function nextClaimableSeatOperation(
  operations: readonly SeatQueueOp[]
): SeatQueueOp | null {
  const inflight = operations.some((op) => isSeatOperationInFlight(op.status));
  if (inflight) return null;
  const claimable = operations
    .filter((op) => isSeatOperationClaimable(op.status))
    .slice()
    .sort((a, b) => {
      const byTime = a.createdAt.localeCompare(b.createdAt);
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });
  return claimable[0] ?? null;
}

/**
 * HTTP callers may claim only when the oldest claimable op is theirs.
 * Webhook/admin pass callerMembershipId null and may claim the oldest row.
 */
export function claimNextRespectingCaller(input: {
  operations: readonly SeatQueueOp[];
  callerMembershipId: string | null;
}): SeatQueueOp | null {
  const next = nextClaimableSeatOperation(input.operations);
  if (!next) return null;
  if (input.callerMembershipId == null) return next;
  if (next.membershipId !== input.callerMembershipId) return null;
  return next;
}

/** Add: current active members + the one membership being processed. */
export function desiredPaidSeatsForAdd(activeMemberCount: number): number {
  return activeMemberCount + 1;
}

/**
 * Invitee's HTTP request may call Stripe only when *their* operation holds
 * the claimed `pending` mutation. queued/failed never issues a second update.
 */
export function ownAcceptanceIssuesStripeMutation(ownStatus: string): boolean {
  return ownStatus === "pending";
}

/** Remove: membership already revoked; target is remaining active count. */
export function desiredPaidSeatsForRemove(activeMemberCountAfterRemove: number): number {
  return Math.max(1, activeMemberCountAfterRemove);
}

export const SEAT_QUEUED_MESSAGE = "Your Quotr seat is being activated.";

export const SEAT_IN_FLIGHT_CANCEL_MESSAGE =
  "This seat is being billed. Wait until it finishes, then you can remove the person.";

export function messageForSeatOperationStatus(
  status: SeatOperationStatus
): string | null {
  if (status === "queued" || status === "pending" || status === "awaiting_mirror") {
    return SEAT_QUEUED_MESSAGE;
  }
  if (status === "awaiting_payment" || status === "failed") {
    return "Your seat couldn't be activated because the account payment needs attention.";
  }
  return null;
}

export function canCancelSeatOperationWithoutStripe(
  status: SeatOperationStatus
): boolean {
  return status === "queued" || status === "failed";
}
