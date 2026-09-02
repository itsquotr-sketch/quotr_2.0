import type { PlanCode } from "@/lib/billing/types";

export const BUSINESS_SELF_SERVICE_USER_MAX = 5;
export const BUILDER_USER_MAX = 1;
export const TRIAL_USER_MAX = 1;
export const INVITE_EXPIRY_DAYS = 7;

/**
 * Self-service user cap. Custom is not capped here — ops/contract later.
 * Do not use paid_seat_quantity as the invite cap: that is Stripe-backed
 * paid users, which increases only after payment-safe acceptance.
 */
export function selfServiceUserLimit(
  plan: PlanCode | null,
  options?: { trial?: boolean }
): number | null {
  if (options?.trial) return TRIAL_USER_MAX;
  if (plan === "builder") return BUILDER_USER_MAX;
  if (plan === "business") return BUSINESS_SELF_SERVICE_USER_MAX;
  if (plan === "custom") return null;
  return BUILDER_USER_MAX;
}

export type SeatReservationSnapshot = {
  activeMemberCount: number;
  pendingBillingCount: number;
  validPendingInviteCount: number;
};

/**
 * Capacity used for invite/accept gates.
 * pending_billing memberships already reserve a unit.
 * accepting invitations do not — the reservation moved to pending_billing.
 */
export function reservedSeatCount(snapshot: SeatReservationSnapshot): number {
  return (
    snapshot.activeMemberCount +
    snapshot.pendingBillingCount +
    snapshot.validPendingInviteCount
  );
}

/**
 * Invitation pending → accepting + pending_billing transfers one capacity
 * unit. Must not drop to zero or double-count the same person.
 */
export function reservationSnapshotAfterInviteAcceptanceTransfer(input: {
  activeMemberCount: number;
  pendingBillingCountBefore: number;
  otherPendingInviteCount: number;
}): SeatReservationSnapshot {
  return {
    activeMemberCount: input.activeMemberCount,
    pendingBillingCount: input.pendingBillingCountBefore + 1,
    validPendingInviteCount: input.otherPendingInviteCount,
  };
}

export function reservationSnapshotBeforeInviteAcceptance(input: {
  activeMemberCount: number;
  pendingBillingCount: number;
  otherPendingInviteCount: number;
  thisInviteIsPending: boolean;
}): SeatReservationSnapshot {
  return {
    activeMemberCount: input.activeMemberCount,
    pendingBillingCount: input.pendingBillingCount,
    validPendingInviteCount:
      input.otherPendingInviteCount + (input.thisInviteIsPending ? 1 : 0),
  };
}

export function hasInviteCapacity(
  snapshot: SeatReservationSnapshot,
  limit: number | null
): boolean {
  if (limit == null) return true;
  return reservedSeatCount(snapshot) < limit;
}

export function extraSeatQuantityFromActiveMembers(
  activeMemberCount: number
): number {
  return Math.max(0, activeMemberCount - 1);
}

export function desiredPaidSeatQuantityFromActiveMembers(
  activeMemberCount: number
): number {
  return Math.max(1, activeMemberCount);
}

export function inviteExpiryAt(
  now: Date = new Date(),
  days: number = INVITE_EXPIRY_DAYS
): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isInviteExpired(
  expiresAtIso: string,
  now: Date = new Date()
): boolean {
  const expires = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expires)) return true;
  return now.getTime() >= expires;
}
