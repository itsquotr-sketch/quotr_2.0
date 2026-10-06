/**
 * Request state and email state are separate.
 * Awaiting means nobody has answered. It is not a decline.
 * Viewed is recorded only when the recipient opens the link.
 */

export const RFQ_RESPONSE_STATES = [
  "awaiting",
  "clarification",
  "responded",
  "declined",
  "expired",
] as const;

export type RfqResponseState = (typeof RFQ_RESPONSE_STATES)[number];

export const RFQ_DELIVERY_STATES = [
  "pending",
  "sent",
  "failed",
  "delivered",
  "bounced",
  "complained",
] as const;

export type RfqDeliveryState = (typeof RFQ_DELIVERY_STATES)[number];

export function rfqResponseLabel(state: RfqResponseState): string {
  switch (state) {
    case "awaiting":
      return "No response";
    case "clarification":
      return "Question asked";
    case "responded":
      return "Responded";
    case "declined":
      return "Declined to quote";
    case "expired":
      return "Expired";
  }
}

export function rfqDeliveryLabel(state: RfqDeliveryState | null): string {
  switch (state) {
    case "pending":
      return "Sending";
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "failed":
    case "bounced":
    case "complained":
      return "Not delivered";
    default:
      return "Not sent";
  }
}

export function rfqDeliveryFailed(state: RfqDeliveryState | null): boolean {
  return state === "failed" || state === "bounced" || state === "complained";
}
