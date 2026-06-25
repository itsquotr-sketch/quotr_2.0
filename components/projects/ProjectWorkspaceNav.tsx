"use client";

import { LAYOUT_MAX_WIDTH } from "@/components/layout/page-containers";
import type { ProjectWorkspaceTab } from "@/components/projects/ProjectWorkspaceTabs";
import { ProjectWorkspaceTabs } from "@/components/projects/ProjectWorkspaceTabs";
import type { PricingSummary } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

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
      <div className={cn("mx-auto w-full px-4 pt-2 pb-3 sm:px-6 lg:px-8", LAYOUT_MAX_WIDTH.workspace)}>
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
