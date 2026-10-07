import { JobRateSuggestions } from "@/components/projects/JobRateSuggestions";
import { RfqList } from "@/components/rfqs/RfqList";
import { WorkspaceContainer } from "@/components/layout/page-containers";
import { WorkspaceHeaderBar } from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { getProjectWorkspaceTabContextWithContext } from "@/lib/pricing/pricing-loaders";
import { getLatestQuoteSummaryWithContext } from "@/lib/quotes/quote-loaders";
import { projectSectionContext } from "@/lib/projects/project-information";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { loadProjectRfqs } from "@/lib/rfqs/load";
import { loadJobRateBook } from "@/lib/subcontractors/rate-actions";
import { loadJobPricingForRates } from "@/lib/subcontractors/rate-use-actions";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { getOnboardingAccess } from "@/lib/setup/actions";
import { memberCanEditPricing, memberCanEditProjects } from "@/lib/team/permissions";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function ProjectRequestsPage({ params }: PageProps) {
  await connection();
  const { projectId } = await params;
  const auth = await requireAuthOrgContext();
  if (!auth.ok) notFound();
  const [project, tabContext, quoteSummary, access] = await Promise.all([
    getProjectWithContext(auth, projectId),
    getProjectWorkspaceTabContextWithContext(auth, projectId),
    getLatestQuoteSummaryWithContext(auth, projectId),
    getOnboardingAccess(),
  ]);
  if (!project) notFound();
  const [rows, rateBook, ratePricing] = await Promise.all([
    loadProjectRfqs(auth.supabase, projectId),
    loadJobRateBook(projectId),
    loadJobPricingForRates(projectId),
  ]);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <header className="shrink-0 border-b bg-background">
        <WorkspaceHeaderBar actions={<UserMenu className="hidden md:inline-flex" />}>
          <ProjectWorkspaceHeader project={project} subtitle="Requests" />
        </WorkspaceHeaderBar>
      </header>
      <ProjectWorkspaceNav
        projectId={projectId}
        activeTab="requests"
        projectContext={projectSectionContext(project)}
        pricingSummary={tabContext.pricingSummary}
        quoteSummary={quoteSummary}
        hasEstimate={tabContext.hasEstimate}
        estimateIsStale={tabContext.estimateIsStale}
      />
      <WorkspaceContainer className="bg-muted/30" innerClassName="bg-muted/30 py-6">
        <div className="grid gap-6">
          <RfqList projectId={projectId} rows={rows} canEdit={memberCanEditProjects(access.role)} />
          <details className="rounded-xl border border-border bg-card p-4" data-job-rate-disclosure>
            <summary className="cursor-pointer text-base font-semibold">Subcontractor rates</summary>
            <div className="pt-4">
              <JobRateSuggestions
                projectId={projectId}
                areas={rateBook.areas}
                rates={rateBook.rates}
                today={rateBook.today}
                pricing={ratePricing}
                canEdit={memberCanEditPricing(access.role)}
              />
            </div>
          </details>
        </div>
      </WorkspaceContainer>
    </div>
  );
}
