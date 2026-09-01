/**
 * paid_seat_quantity = TOTAL allowed paid full users.
 * Business base includes the first user.
 * Stripe additional-seat item quantity = max(0, paid_seat_quantity - 1).
 */

export function extraSeatQuantityFromPaidSeats(
  paidSeatQuantity: number
): number {
  return Math.max(0, paidSeatQuantity - 1);
}

export function paidSeatQuantityFromExtraSeats(
  extraSeatQuantity: number
): number {
  return 1 + Math.max(0, extraSeatQuantity);
}

export function builderPaidSeatQuantity(): number {
  return 1;
}
