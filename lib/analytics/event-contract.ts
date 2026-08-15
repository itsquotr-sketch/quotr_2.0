/**
 * FOUNDATION-R1 — Future analytics event contract (types / docs only).
 *
 * Do not emit these events in this batch unless an existing writer already
 * records an equivalent (`pricing_audit_log`, quote status timestamps).
 * Pipeline note: AN-1 should start recording these before Analytics UI.
 */

export const ANALYTICS_EVENT_CONTRACT_VERSION = "foundation-r1.0" as const;

export const PLANNED_ANALYTICS_EVENT_TYPES = [
  "estimate_generated",
  "pricing_created",
  "quote_created",
  "quote_sent",
  "quote_viewed",
  "quote_accepted",
  "quote_declined",
] as const;

export type PlannedAnalyticsEventType =
  (typeof PLANNED_ANALYTICS_EVENT_TYPES)[number];

export type PlannedAnalyticsEvent = {
  type: PlannedAnalyticsEventType;
  occurredAt: string;
  orgId: string;
  projectId: string;
  entityId?: string;
};
