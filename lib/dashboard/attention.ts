import type { ProjectListItem } from "@/lib/projects/types";
import type { CompanySetupReadiness } from "@/lib/setup/readiness";

export type DashboardAttentionItem = {
  id: string;
  state: string;
  context: string;
  action: string;
  href: string;
};

function projectContext(project: ProjectListItem): string {
  const title = project.title?.trim() || "Project";
  const place = project.client_name?.trim() || project.site_address?.trim();
  return place ? `${title} · ${place}` : title;
}

/**
 * Actionable dashboard rows from projects and readiness already loaded
 * for the page. Does not query estimates, quotes, or variations again.
 *
 * Order: required setup, sent or viewed quotes, draft quotes,
 * declined or expired quotes, stale estimates, then open pricing.
 * The command centre caps what it shows; this list is the full order.
 */
export function deriveDashboardAttention(input: {
  projects: ProjectListItem[];
  readiness: CompanySetupReadiness;
}): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = [];
  const seenProjects = new Set<string>();

  const requiredSetup = [
    ...input.readiness.missingQuoteSetup,
    ...input.readiness.missingPricingSetup,
    ...input.readiness.missingEstimateSetup,
  ].filter((item) => item.severity === "required");

  for (const suggestion of requiredSetup) {
    items.push({
      id: `setup-${suggestion.id}`,
      state: suggestion.title,
      context: suggestion.reason,
      action: "Review setup",
      href: suggestion.href,
    });
  }

  const openProjects = input.projects.filter((project) => !project.archived_at);

  function pushProject(
    project: ProjectListItem,
    state: string,
    action: string,
    href: string
  ) {
    if (seenProjects.has(project.id)) return;
    seenProjects.add(project.id);
    items.push({
      id: `project-${project.id}`,
      state,
      context: projectContext(project),
      action,
      href,
    });
  }

  for (const project of openProjects) {
    const quote = project.quote_summary;
    if (!quote) continue;
    if (quote.status === "sent" || quote.status === "viewed") {
      pushProject(
        project,
        quote.status === "viewed"
          ? "Client has opened the quote"
          : "Awaiting a client response",
        "Open quote",
        `/app/projects/${project.id}/quotes/${quote.id}`
      );
    }
  }

  for (const project of openProjects) {
    const quote = project.quote_summary;
    if (quote?.status === "draft") {
      pushProject(
        project,
        "Quote is not sent yet",
        "Open quote",
        `/app/projects/${project.id}/quotes/${quote.id}`
      );
    }
  }

  for (const project of openProjects) {
    const quote = project.quote_summary;
    if (quote?.status === "declined" || quote?.status === "expired") {
      pushProject(
        project,
        quote.status === "expired" ? "Quote has expired" : "Quote was declined",
        "Open quote",
        `/app/projects/${project.id}/quotes/${quote.id}`
      );
    }
  }

  for (const project of openProjects) {
    if (project.has_estimate && project.estimate_is_stale) {
      pushProject(
        project,
        "Estimate is out of date",
        "Open project",
        `/app/projects/${project.id}`
      );
    }
  }

  for (const project of openProjects) {
    const pricing = project.pricing_summary;
    if (!pricing || pricing.status === "reviewed" || pricing.status === "converted_to_quote") {
      continue;
    }
    pushProject(
      project,
      pricing.needsRecalibration
        ? "Pricing needs another look"
        : "Pricing is still a draft",
      "Review pricing",
      `/app/projects/${project.id}/pricing/${pricing.id}`
    );
  }

  return items;
}
