"use client";

import { LAYOUT_MAX_WIDTH } from "@/components/layout/page-containers";
import type { ProjectWorkspaceTab } from "@/components/projects/ProjectWorkspaceTabs";
import { ProjectWorkspaceTabs } from "@/components/projects/ProjectWorkspaceTabs";
import { ProjectWorkflowStrip } from "@/components/projects/ProjectWorkflowStrip";
import type { PricingSummary } from "@/lib/pricing/types";
import type { ProjectWorkflowInput } from "@/lib/projects/workflow-orientation";
import type { QuoteSummary } from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

type ProjectWorkspaceNavProps = {
  projectId: string;
  activeTab: ProjectWorkspaceTab;
  pricingSummary: PricingSummary | null;
  quoteSummary?: QuoteSummary | null;
  hasEstimate?: boolean;
  estimateIsStale?: boolean;
  pricingUnresolvedRequired?: boolean | null;
  variations?: ProjectWorkflowInput["variations"];
};

export function ProjectWorkspaceNav({
  projectId,
  activeTab,
  pricingSummary,
  quoteSummary = null,
  hasEstimate,
  estimateIsStale,
  pricingUnresolvedRequired = null,
  variations = null,
}: ProjectWorkspaceNavProps) {
  return (
    <div className="border-b bg-background">
      <div className={cn("mx-auto w-full px-4 pt-3 pb-2.5 sm:px-6 lg:px-8", LAYOUT_MAX_WIDTH.workspace)}>
        <ProjectWorkflowStrip
          projectId={projectId}
          activeTab={activeTab}
          hasEstimate={hasEstimate ?? false}
          estimateIsStale={estimateIsStale ?? false}
          pricingSummary={pricingSummary}
          pricingUnresolvedRequired={pricingUnresolvedRequired}
          quoteSummary={quoteSummary ?? null}
          variations={variations}
        />
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
