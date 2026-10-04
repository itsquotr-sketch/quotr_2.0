import { isActivePipelineStatus } from "@/lib/projects/status";

/**
 * Dashboard-only presentation counts.
 *
 * summarizePipeline (lib/dashboard/load-dashboard-page.ts) and
 * getDashboardPipelineSummary (lib/projects/actions.ts) are unchanged.
 * Those shared counters include archived rows for estimating, estimate_ready,
 * quote_sent, and won. Only their activeCount already excludes archived work.
 *
 * These figures are derived from the project rows the Dashboard has already
 * loaded. They do not change lifecycle authority or the Projects filters.
 *
 * activeCount — non-archived projects in ACTIVE_PIPELINE_STATUSES
 *   (lead, site_visit, scoping, estimating, estimate_ready, quote_draft,
 *   quote_sent). Matches the shared activeCount.
 * estimatingPricingCount — non-archived estimating or estimate_ready.
 *   Differs from the shared counter, which includes archived rows.
 *   No single Projects filter covers both statuses, so the card has no link.
 * quotesSentCount — non-archived quote_sent. The Projects quote_sent filter
 *   uses the same rule. Archived quote-sent projects stay on the Archived
 *   filter. The shared pipeline counter still includes those archived rows.
 * wonCount — every won project, including archived. This is all-time accepted
 *   work, matching the shared wonCount and the Projects won filter. The card
 *   says "Accepted projects" and does not describe the archive rule.
 *
 * quote_draft and lost stay on the Projects filters. They are not Dashboard cards.
 */
export type DashboardOverviewCounts = {
  activeCount: number;
  estimatingPricingCount: number;
  quotesSentCount: number;
  wonCount: number;
};

export function presentDashboardOverview(
  projects: ReadonlyArray<{
    business_status?: string | null;
    archived_at?: string | null;
  }>
): DashboardOverviewCounts {
  const counts: DashboardOverviewCounts = {
    activeCount: 0,
    estimatingPricingCount: 0,
    quotesSentCount: 0,
    wonCount: 0,
  };

  for (const project of projects) {
    const status = project.business_status ?? "";
    const archived = Boolean(project.archived_at);

    if (!archived && isActivePipelineStatus(status)) {
      counts.activeCount += 1;
    }
    if (!archived && (status === "estimating" || status === "estimate_ready")) {
      counts.estimatingPricingCount += 1;
    }
    if (!archived && status === "quote_sent") {
      counts.quotesSentCount += 1;
    }
    if (status === "won") {
      counts.wonCount += 1;
    }
  }

  return counts;
}

export type WorkOverviewMeasure = {
  key: keyof DashboardOverviewCounts;
  label: string;
  context: string;
  href: string | null;
};

export const WORK_OVERVIEW_MEASURES: readonly WorkOverviewMeasure[] = [
  {
    key: "activeCount",
    label: "Active work",
    context: "Current pipeline",
    href: "/app/projects",
  },
  {
    key: "estimatingPricingCount",
    label: "Estimating & pricing",
    context: "Work being priced",
    href: null,
  },
  {
    key: "quotesSentCount",
    label: "Quotes out",
    context: "Awaiting client response",
    href: "/app/projects?filter=quote_sent",
  },
  {
    key: "wonCount",
    label: "Won work",
    context: "Accepted projects",
    href: "/app/projects?filter=won",
  },
];
