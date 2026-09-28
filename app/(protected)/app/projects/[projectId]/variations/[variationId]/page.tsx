import { VariationEditor } from "@/components/variations/VariationEditor";
import { WorkspaceContainer } from "@/components/layout/page-containers";
import { WorkspaceHeaderBar } from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { getProjectWorkspaceTabContextWithContext } from "@/lib/pricing/pricing-loaders";
import { getLatestQuoteSummaryWithContext } from "@/lib/quotes/quote-loaders";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { loadVariationEditor } from "@/lib/variations/workspace-actions";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type PageProps = {
  params: Promise<{ projectId: string; variationId: string }>;
  searchParams: Promise<{ revision?: string; preview?: string; withdraw?: string }>;
};

export default async function VariationDetailPage({ params, searchParams }: PageProps) {
  await connection();
  const { projectId, variationId } = await params;
  const query = await searchParams;
  const auth = await requireAuthOrgContext();
  if (!auth.ok) notFound();
  const [project, tabContext, quoteSummary, editor] = await Promise.all([
    getProjectWithContext(auth, projectId),
    getProjectWorkspaceTabContextWithContext(auth, projectId),
    getLatestQuoteSummaryWithContext(auth, projectId),
    loadVariationEditor(projectId, variationId),
  ]);
  if (!editor.ok) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b bg-background print:hidden">
        <WorkspaceHeaderBar actions={<UserMenu />}>
          <ProjectWorkspaceHeader project={project} subtitle="Variations" />
        </WorkspaceHeaderBar>
      </header>
      <div className="print:hidden">
        <ProjectWorkspaceNav
          projectId={projectId}
          activeTab="variations"
          pricingSummary={tabContext.pricingSummary}
          quoteSummary={quoteSummary}
          hasEstimate={tabContext.hasEstimate}
          estimateIsStale={tabContext.estimateIsStale}
        />
      </div>
      <WorkspaceContainer className="min-h-0" innerClassName="py-6">
        <VariationEditor
          key={`${editor.variation.id}:${editor.variation.status}:${editor.withdrawalReason ?? ""}`}
          projectId={projectId}
          variation={editor.variation}
          baseline={editor.baseline}
          scopeLines={editor.scopeLines}
          workAreas={editor.workAreas}
          defaultMarginPercent={editor.defaultMarginPercent}
          companyName={editor.companyName}
          projectTitle={editor.projectTitle}
          clientName={editor.clientName}
          clientEmail={editor.clientEmail}
          siteAddress={editor.siteAddress}
          history={editor.history}
          deliveries={editor.deliveries}
          documentIdentities={editor.documentIdentities}
          withdrawalReason={editor.withdrawalReason}
          acceptedRevisions={editor.acceptedRevisions}
          viewRevisionId={query.revision ?? null}
          startPreview={query.preview === "1"}
          startWithdraw={query.withdraw === "1"}
          attachments={editor.attachments}
          response={editor.response}
          revisedContractInclGst={editor.revisedContractInclGst}
        />
      </WorkspaceContainer>
    </div>
  );
}
