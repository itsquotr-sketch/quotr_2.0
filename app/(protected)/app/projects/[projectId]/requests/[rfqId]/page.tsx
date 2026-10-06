import { RfqDetailView } from "@/components/rfqs/RfqDetailView";
import { WorkspaceContainer } from "@/components/layout/page-containers";
import { WorkspaceHeaderBar } from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { getProjectWorkspaceTabContextWithContext } from "@/lib/pricing/pricing-loaders";
import { getLatestQuoteSummaryWithContext } from "@/lib/quotes/quote-loaders";
import { projectSectionContext } from "@/lib/projects/project-information";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { loadRfqDetail } from "@/lib/rfqs/load";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { getOnboardingAccess } from "@/lib/setup/actions";
import { memberCanEditProjects } from "@/lib/team/permissions";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type PageProps = { params: Promise<{ projectId: string; rfqId: string }> };

export default async function RfqDetailPage({ params }: PageProps) {
  await connection();
  const { projectId, rfqId } = await params;
  const auth = await requireAuthOrgContext();
  if (!auth.ok) notFound();
  const [project, tabContext, quoteSummary, detail, access] = await Promise.all([
    getProjectWithContext(auth, projectId),
    getProjectWorkspaceTabContextWithContext(auth, projectId),
    getLatestQuoteSummaryWithContext(auth, projectId),
    loadRfqDetail(auth.supabase, projectId, rfqId),
    getOnboardingAccess(),
  ]);
  if (!project || !detail) notFound();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <header className="shrink-0 border-b bg-background">
        <WorkspaceHeaderBar actions={<UserMenu className="hidden md:inline-flex" />}>
          <ProjectWorkspaceHeader project={project} subtitle="Request" />
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
        <RfqDetailView detail={detail} canEdit={memberCanEditProjects(access.role)} />
      </WorkspaceContainer>
    </div>
  );
}
