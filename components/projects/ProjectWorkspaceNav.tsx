"use client";

import type { ProjectWorkspaceTab } from "@/components/projects/ProjectWorkspaceTabs";
import { ProjectWorkspaceTabs } from "@/components/projects/ProjectWorkspaceTabs";
import type { PricingSummary } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";

type ProjectWorkspaceNavProps = {
  projectId: string;
  activeTab: ProjectWorkspaceTab;
  pricingSummary: PricingSummary | null;
  quoteSummary?: QuoteSummary | null;
  hasEstimate?: boolean;
  estimateIsStale?: boolean;
};

export function ProjectWorkspaceNav({
  projectId,
  activeTab,
  pricingSummary,
  quoteSummary = null,
  hasEstimate,
  estimateIsStale,
}: ProjectWorkspaceNavProps) {
  return (
    <div className="border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-2 pb-3 sm:px-6 lg:px-8">
        <ProjectWorkspaceTabs
          projectId={projectId}
          activeTab={activeTab}
          pricingSummary={pricingSummary}
          quoteSummary={quoteSummary}
          hasEstimate={hasEstimate}
          estimateIsStale={estimateIsStale}
        />
      </div>
    </div>
  );
}
