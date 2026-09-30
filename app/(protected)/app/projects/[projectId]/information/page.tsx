import { ProjectInformationWorkspace } from "@/components/projects/information/ProjectInformationWorkspace";
import {
  WorkspaceHeaderBar,
  WorkspacePage,
} from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { getAssistantStateWithContext } from "@/lib/assistant/state";
import { getProjectWorkspaceTabContextWithContext } from "@/lib/pricing/pricing-loaders";
import { readProjectDocumentCentre } from "@/lib/projects/document-centre";
import {
  projectInformationFromLoaded,
  projectSectionContext,
} from "@/lib/projects/project-information";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { getLatestQuoteSummaryWithContext } from "@/lib/quotes/quote-loaders";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type ProjectInformationPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectInformationPage({
  params,
}: ProjectInformationPageProps) {
  await connection();
  const { projectId } = await params;
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    notFound();
  }

  const [project, assistant, tabContext, quoteSummary, documents] = await Promise.all([
    getProjectWithContext(auth, projectId),
    getAssistantStateWithContext(auth, projectId),
    getProjectWorkspaceTabContextWithContext(auth, projectId),
    getLatestQuoteSummaryWithContext(auth, projectId),
    readProjectDocumentCentre(auth.supabase, projectId, auth.orgId),
  ]);

  const model = projectInformationFromLoaded(project, assistant, projectId);

  return (
    <WorkspacePage
      contentClassName="bg-muted/30"
      header={
        <WorkspaceHeaderBar actions={<UserMenu />}>
          <ProjectWorkspaceHeader project={project} />
        </WorkspaceHeaderBar>
      }
      nav={
        <ProjectWorkspaceNav
          projectId={projectId}
          activeTab="information"
          projectContext={projectSectionContext(project)}
          pricingSummary={tabContext.pricingSummary}
          quoteSummary={quoteSummary}
          hasEstimate={Boolean(assistant.estimate) || tabContext.hasEstimate}
          estimateIsStale={assistant.estimate?.isStale ?? tabContext.estimateIsStale}
        />
      }
    >
      <ProjectInformationWorkspace
        model={model}
        project={project}
        projectId={projectId}
        documents={documents}
      />
    </WorkspacePage>
  );
}
