import { VariationList } from "@/components/variations/VariationList";
import { WorkspaceContainer } from "@/components/layout/page-containers";
import { WorkspaceHeaderBar } from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { getProjectWorkspaceTabContextWithContext } from "@/lib/pricing/pricing-loaders";
import { getLatestQuoteSummaryWithContext } from "@/lib/quotes/quote-loaders";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { loadVariationWorkspace } from "@/lib/variations/workspace-actions";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function VariationsPage({ params }: PageProps) {
  await connection();
  const { projectId } = await params;
  const auth = await requireAuthOrgContext();
  if (!auth.ok) notFound();
  const [project, tabContext, quoteSummary, workspace] = await Promise.all([
    getProjectWithContext(auth, projectId),
    getProjectWorkspaceTabContextWithContext(auth, projectId),
    getLatestQuoteSummaryWithContext(auth, projectId),
    loadVariationWorkspace(projectId),
  ]);
  if (!workspace.ok) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b bg-background">
        <WorkspaceHeaderBar actions={<UserMenu />}>
          <ProjectWorkspaceHeader project={project} subtitle="Variations" />
        </WorkspaceHeaderBar>
      </header>
      <ProjectWorkspaceNav
        projectId={projectId}
        activeTab="variations"
        pricingSummary={tabContext.pricingSummary}
        quoteSummary={quoteSummary}
        hasEstimate={tabContext.hasEstimate}
        estimateIsStale={tabContext.estimateIsStale}
      />
      <WorkspaceContainer innerClassName="py-6">
        <VariationList
          projectId={projectId}
          eligible={workspace.eligible}
          reason={workspace.reason}
          rows={workspace.rows}
          summary={workspace.summary}
        />
      </WorkspaceContainer>
    </div>
  );
}
