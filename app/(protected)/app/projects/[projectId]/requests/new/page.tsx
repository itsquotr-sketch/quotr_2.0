import { RfqComposer } from "@/components/rfqs/RfqComposer";
import { WorkspaceContainer } from "@/components/layout/page-containers";
import { WorkspaceHeaderBar } from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { getProjectWorkspaceTabContextWithContext } from "@/lib/pricing/pricing-loaders";
import { getLatestQuoteSummaryWithContext } from "@/lib/quotes/quote-loaders";
import { projectSectionContext } from "@/lib/projects/project-information";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { loadRfqComposerSources } from "@/lib/rfqs/load";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function NewRfqPage({ params }: PageProps) {
  await connection();
  const { projectId } = await params;
  const auth = await requireAuthOrgContext();
  if (!auth.ok) notFound();
  const [project, tabContext, quoteSummary, sources] = await Promise.all([
    getProjectWithContext(auth, projectId),
    getProjectWorkspaceTabContextWithContext(auth, projectId),
    getLatestQuoteSummaryWithContext(auth, projectId),
    loadRfqComposerSources(auth.supabase, projectId, auth.orgId),
  ]);
  if (!project) notFound();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <header className="shrink-0 border-b bg-background">
        <WorkspaceHeaderBar actions={<UserMenu className="hidden md:inline-flex" />}>
          <ProjectWorkspaceHeader project={project} subtitle="New request" />
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
        <RfqComposer
          projectId={projectId}
          workAreas={sources.workAreas}
          subcontractors={sources.subcontractors}
          documents={sources.documents}
          siteAddress={project.site_address ?? ""}
        />
      </WorkspaceContainer>
    </div>
  );
}
