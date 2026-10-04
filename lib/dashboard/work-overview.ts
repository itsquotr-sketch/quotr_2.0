import type { DashboardPipelineSummary } from "@/lib/projects/types";

/**
 * Four Dashboard measures. Counts are the existing summarizePipeline fields.
 * Definitions (do not reinterpret):
 *
 * activeCount — non-archived projects whose business_status is in
 *   ACTIVE_PIPELINE_STATUSES: lead, site_visit, scoping, estimating,
 *   estimate_ready, quote_draft, quote_sent.
 * estimatingPricingCount — business_status estimating or estimate_ready.
 *   Archived rows are included. There is no single projects-register filter
 *   for both statuses, so this card has no destination.
 * quotesSentCount — business_status quote_sent ("Quote sent" /
 *   "Quote has been sent to the client"). This is not a separate
 *   "awaiting response" status. Archived rows are included.
 * wonCount — business_status won ("Client accepted the work").
 *   Archived rows are included.
 *
 * quote_draft and lost stay in the summary type and on the Projects filters.
 * They are not top-level Dashboard cards.
 */
export type WorkOverviewMeasure = {
  key: keyof Pick<
    DashboardPipelineSummary,
    "activeCount" | "estimatingPricingCount" | "quotesSentCount" | "wonCount"
  >;
  label: string;
  context: string;
  href: string | null;
};

export const WORK_OVERVIEW_MEASURES: readonly WorkOverviewMeasure[] = [
  {
    key: "activeCount",
    label: "Active work",
    context: "Lead through quote sent",
    href: "/app/projects",
  },
  {
    key: "estimatingPricingCount",
    label: "Estimating & pricing",
    context: "Estimating and estimate ready",
    href: null,
  },
  {
    key: "quotesSentCount",
    label: "Quote sent",
    context: "Sent to the client",
    href: "/app/projects?filter=quote_sent",
  },
  {
    key: "wonCount",
    label: "Won work",
    context: "Client accepted the work",
    href: "/app/projects?filter=won",
  },
];
