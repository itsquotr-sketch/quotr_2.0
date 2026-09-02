import { unixSecondsToIso } from "@/lib/billing/events";
import type { SubscriptionStatus } from "@/lib/billing/types";

/**
 * Durable past_due incident clock.
 *
 * non-past_due → past_due: set from this event's Stripe created time.
 * past_due → past_due: preserve existing value, including NULL.
 * past_due → other: clear.
 *
 * Do not initialise a missing clock from a later past_due event — that
 * would restart grace. NULL is a fail-closed access-policy case.
 */
export function resolvePastDueSince(input: {
  previousStatus: SubscriptionStatus | null;
  nextStatus: SubscriptionStatus;
  existingPastDueSince: string | null;
  eventCreatedUnix: number;
}): string | null {
  if (input.nextStatus !== "past_due") {
    return null;
  }
  if (input.previousStatus === "past_due") {
    return input.existingPastDueSince;
  }
  return unixSecondsToIso(input.eventCreatedUnix);
}
