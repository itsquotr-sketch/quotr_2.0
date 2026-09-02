import { extraSeatQuantityFromPaidSeats } from "@/lib/billing/seats";
import type { PlanCode } from "@/lib/billing/types";
import {
  reservedSeatCount,
  selfServiceUserLimit,
  type SeatReservationSnapshot,
} from "@/lib/team/capacity";

export const TEAM_RECONCILIATION_STATES = [
  "healthy",
  "reserved_capacity",
  "pending_billing_zero_access",
  "pending_activation",
  "seat_operation_queued",
  "seat_operation_inflight",
  "payment_attention",
  "billing_shortfall",
  "billing_excess",
  "builder_inconsistent",
  "trial_inconsistent",
] as const;
export type TeamReconciliationState =
  (typeof TEAM_RECONCILIATION_STATES)[number];

export type TeamReconciliationInput = {
  planCode: PlanCode | null;
  trial: boolean;
  paidSeatQuantity: number;
  extraSeatItemQuantity: number;
  snapshot: SeatReservationSnapshot;
  pendingActivationCount: number;
  inflightSeatOperationCount?: number;
  queuedSeatOperationCount?: number;
  paymentAttentionSeatOperationCount?: number;
};

export type TeamReconciliationResult = {
  state: TeamReconciliationState;
  reserved: number;
  selfServiceLimit: number | null;
  expectedExtraSeatQuantity: number;
  detail: string;
};

/**
 * Read-only classification. Never auto-fixes membership or Stripe.
 */
export function classifyTeamReconciliation(
  input: TeamReconciliationInput
): TeamReconciliationResult {
  const reserved = reservedSeatCount(input.snapshot);
  const limit = selfServiceUserLimit(input.planCode, { trial: input.trial });
  const expectedExtra = extraSeatQuantityFromPaidSeats(input.paidSeatQuantity);
  const inflight = input.inflightSeatOperationCount ?? 0;
  const queued = input.queuedSeatOperationCount ?? 0;
  const paymentAttention = input.paymentAttentionSeatOperationCount ?? 0;

  const base = {
    reserved,
    selfServiceLimit: limit,
    expectedExtraSeatQuantity: expectedExtra,
  };

  if (input.trial && input.snapshot.activeMemberCount > 1) {
    return {
      ...base,
      state: "trial_inconsistent",
      detail: "Trial accounts must have exactly one person.",
    };
  }

  if (input.planCode === "builder" && input.snapshot.activeMemberCount > 1) {
    return {
      ...base,
      state: "builder_inconsistent",
      detail: "Builder accounts must have exactly one person.",
    };
  }

  if (paymentAttention > 0) {
    return {
      ...base,
      state: "payment_attention",
      detail:
        "A seat operation needs billing attention. Later queued seats are not charged until this is resolved.",
    };
  }

  if (inflight > 0) {
    return {
      ...base,
      state: "seat_operation_inflight",
      detail: "One Stripe seat mutation is in flight for this organisation.",
    };
  }

  if (queued > 0) {
    return {
      ...base,
      state: "seat_operation_queued",
      detail: "A seat operation is queued until the preceding mutation finishes.",
    };
  }

  if (input.snapshot.pendingBillingCount > 0) {
    return {
      ...base,
      state: "pending_billing_zero_access",
      detail:
        "A joining person is waiting for payment. They have no organisation access until their paid seat is confirmed.",
    };
  }

  if (input.pendingActivationCount > 0) {
    return {
      ...base,
      state: "pending_activation",
      detail: "A person is waiting for billing to confirm their seat.",
    };
  }

  if (input.snapshot.activeMemberCount > input.paidSeatQuantity) {
    return {
      ...base,
      state: "billing_shortfall",
      detail: "Active people exceed Stripe-backed paid users.",
    };
  }

  if (input.snapshot.activeMemberCount < input.paidSeatQuantity) {
    return {
      ...base,
      state: "billing_excess",
      detail: "Stripe is billing for more paid users than active people.",
    };
  }

  if (
    input.snapshot.validPendingInviteCount > 0 ||
    input.snapshot.pendingBillingCount > 0
  ) {
    return {
      ...base,
      state: "reserved_capacity",
      detail: "Invitations or pending seats are holding user capacity.",
    };
  }

  if (input.extraSeatItemQuantity !== expectedExtra) {
    return {
      ...base,
      state: "billing_excess",
      detail: "Additional-user Stripe quantity does not match paid users.",
    };
  }

  return {
    ...base,
    state: "healthy",
    detail: "Active people match paid users. No pending invitations.",
  };
}
