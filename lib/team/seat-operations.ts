/**
 * Seat-operation state machine. Durable recovery for payment-safe add
 * and post-removal Stripe decrement. Browser memory is not authority.
 */

export const SEAT_OPERATION_KINDS = ["add", "remove"] as const;
export type SeatOperationKind = (typeof SEAT_OPERATION_KINDS)[number];

export const SEAT_OPERATION_STATUSES = [
  "queued",
  "pending",
  "awaiting_payment",
  "awaiting_mirror",
  "completed",
  "failed",
  "cancelled",
] as const;
export type SeatOperationStatus = (typeof SEAT_OPERATION_STATUSES)[number];

export type SeatOperation = {
  id: string;
  orgId: string;
  kind: SeatOperationKind;
  invitationId: string | null;
  membershipId: string | null;
  desiredPaidSeatQuantity: number;
  status: SeatOperationStatus;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  errorCode: string | null;
  errorSafe: string | null;
};

export type SeatAddActivationDecision =
  | { action: "activate" }
  | { action: "wait_mirror" }
  | { action: "payment_failed"; errorSafe: string }
  | { action: "already_complete" };

/**
 * Activate the pending membership only when the webhook-backed mirror
 * proves paid_seat_quantity covers the resulting active count.
 */
export function decideSeatAddActivation(input: {
  operationStatus: SeatOperationStatus;
  paidSeatQuantity: number;
  desiredPaidSeatQuantity: number;
  stripeCurrentPaidSeats: number | null;
  pendingUpdateEquivalent: boolean;
}): SeatAddActivationDecision {
  if (input.operationStatus === "completed") {
    return { action: "already_complete" };
  }
  if (input.operationStatus === "queued" || input.operationStatus === "pending") {
    return { action: "wait_mirror" };
  }
  if (input.operationStatus === "failed" || input.operationStatus === "cancelled") {
    return {
      action: "payment_failed",
      errorSafe:
        "Your seat couldn't be activated because the account payment needs attention.",
    };
  }
  if (input.paidSeatQuantity >= input.desiredPaidSeatQuantity) {
    return { action: "activate" };
  }
  if (
    input.stripeCurrentPaidSeats != null &&
    input.stripeCurrentPaidSeats >= input.desiredPaidSeatQuantity &&
    input.paidSeatQuantity < input.desiredPaidSeatQuantity
  ) {
    return { action: "wait_mirror" };
  }
  if (input.pendingUpdateEquivalent) {
    return {
      action: "payment_failed",
      errorSafe:
        "Your seat couldn't be activated because the account payment needs attention.",
    };
  }
  return { action: "wait_mirror" };
}

export const SEAT_PAYMENT_FAILED_MESSAGE =
  "Your seat couldn't be activated because the account payment needs attention.";
