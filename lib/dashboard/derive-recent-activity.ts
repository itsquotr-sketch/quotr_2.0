export type RecentActivityKind =
  | "project_created"
  | "estimate_created"
  | "estimate_updated"
  | "quote_created"
  | "quote_sent"
  | "quote_viewed"
  | "quote_accepted"
  | "quote_declined";

export type RecentActivityItem = {
  id: string;
  kind: RecentActivityKind;
  projectId: string;
  quoteId: string | null;
  projectTitle: string;
  detail: string;
  occurredAt: string;
  href: string;
};

export const RECENT_ACTIVITY_EMPTY =
  "No activity yet. Your recent estimates and quotes will appear here.";

const KIND_LABEL: Record<RecentActivityKind, string> = {
  project_created: "Project created",
  estimate_created: "Estimate created",
  estimate_updated: "Estimate updated",
  quote_created: "Quote created",
  quote_sent: "Quote sent",
  quote_viewed: "Quote viewed",
  quote_accepted: "Quote accepted",
  quote_declined: "Quote declined",
};

const UPDATE_GAP_MS = 60_000;

export type ActivityProjectRow = {
  id: string;
  title: string | null;
  created_at: string;
};

export type ActivityEstimateRow = {
  id: string;
  project_id: string;
  created_at: string;
  updated_at: string | null;
  generated_at: string | null;
};

export type ActivityQuoteRow = {
  id: string;
  project_id: string;
  quote_number?: string | null;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  superseded_by_quote_id?: string | null;
};

function projectHref(projectId: string): string {
  return `/app/projects/${projectId}`;
}

function quoteHref(projectId: string, quoteId: string): string {
  return `/app/projects/${projectId}/quotes/${quoteId}`;
}

function projectTitle(
  projects: Map<string, string>,
  projectId: string
): string {
  return projects.get(projectId)?.trim() || "Project";
}

function push(
  items: RecentActivityItem[],
  item: Omit<RecentActivityItem, "detail"> & { detail?: string }
) {
  items.push({
    ...item,
    detail: item.detail ?? KIND_LABEL[item.kind],
  });
}

/**
 * Derive a compact Recent Activity feed from existing project, estimate,
 * and quote timestamps. No new event table.
 */
export function deriveRecentActivity(input: {
  projects: ActivityProjectRow[];
  estimates: ActivityEstimateRow[];
  quotes: ActivityQuoteRow[];
  limit?: number;
}): RecentActivityItem[] {
  const limit = input.limit ?? 8;
  const titles = new Map(
    input.projects.map((project) => [
      project.id,
      project.title?.trim() || "Project",
    ])
  );
  const items: RecentActivityItem[] = [];

  for (const project of input.projects) {
    if (!project.created_at) continue;
    push(items, {
      id: `project:${project.id}:created`,
      kind: "project_created",
      projectId: project.id,
      quoteId: null,
      projectTitle: project.title?.trim() || "Project",
      occurredAt: project.created_at,
      href: projectHref(project.id),
    });
  }

  for (const estimate of input.estimates) {
    if (!estimate.created_at) continue;
    const title = projectTitle(titles, estimate.project_id);
    push(items, {
      id: `estimate:${estimate.id}:created`,
      kind: "estimate_created",
      projectId: estimate.project_id,
      quoteId: null,
      projectTitle: title,
      occurredAt: estimate.created_at,
      href: projectHref(estimate.project_id),
    });
    const updatedAt = estimate.generated_at || estimate.updated_at;
    if (
      updatedAt &&
      new Date(updatedAt).getTime() -
        new Date(estimate.created_at).getTime() >
        UPDATE_GAP_MS
    ) {
      push(items, {
        id: `estimate:${estimate.id}:updated`,
        kind: "estimate_updated",
        projectId: estimate.project_id,
        quoteId: null,
        projectTitle: title,
        occurredAt: updatedAt,
        href: projectHref(estimate.project_id),
      });
    }
  }

  for (const quote of input.quotes) {
    if (quote.superseded_by_quote_id) continue;
    const title = projectTitle(titles, quote.project_id);
    const href = quoteHref(quote.project_id, quote.id);
    if (quote.created_at) {
      push(items, {
        id: `quote:${quote.id}:created`,
        kind: "quote_created",
        projectId: quote.project_id,
        quoteId: quote.id,
        projectTitle: title,
        occurredAt: quote.created_at,
        href,
      });
    }
    if (quote.sent_at) {
      push(items, {
        id: `quote:${quote.id}:sent`,
        kind: "quote_sent",
        projectId: quote.project_id,
        quoteId: quote.id,
        projectTitle: title,
        occurredAt: quote.sent_at,
        href,
      });
    }
    if (quote.viewed_at) {
      push(items, {
        id: `quote:${quote.id}:viewed`,
        kind: "quote_viewed",
        projectId: quote.project_id,
        quoteId: quote.id,
        projectTitle: title,
        occurredAt: quote.viewed_at,
        href,
      });
    }
    if (quote.accepted_at) {
      push(items, {
        id: `quote:${quote.id}:accepted`,
        kind: "quote_accepted",
        projectId: quote.project_id,
        quoteId: quote.id,
        projectTitle: title,
        occurredAt: quote.accepted_at,
        href,
      });
    }
    if (quote.declined_at) {
      push(items, {
        id: `quote:${quote.id}:declined`,
        kind: "quote_declined",
        projectId: quote.project_id,
        quoteId: quote.id,
        projectTitle: title,
        occurredAt: quote.declined_at,
        href,
      });
    }
  }

  items.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
  return items.slice(0, limit);
}
