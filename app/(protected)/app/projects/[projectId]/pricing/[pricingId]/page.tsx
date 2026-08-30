import { PricingWorkspace } from "@/components/pricing/PricingWorkspace";
import {
  WorkspaceHeaderBar,
  WorkspacePage,
} from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { SetupGuidanceServerBanner } from "@/components/setup/SetupGuidanceServerBanner";
import { measureServerLoad } from "@/lib/perf/timing";
import {
  getPricingWorkspaceDataWithContext,
  getProjectWorkspaceTabContextWithContext,
} from "@/lib/pricing/pricing-loaders";
import { getQuoteSummaryForPricingDocument } from "@/lib/quotes/actions";
import { getLatestQuoteSummaryWithContext } from "@/lib/quotes/quote-loaders";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type PricingPageProps = {
  params: Promise<{ projectId: string; pricingId: string }>;
};

export default async function PricingPage({ params }: PricingPageProps) {
  await connection();
  const { projectId, pricingId } = await params;

  const pageData = await measureServerLoad("pricing", async () => {
    const auth = await requireAuthOrgContext();
    if (!auth.ok) {
      notFound();
    }

    const [data, project, tabContext, quoteSummaryForDoc, quoteSummary] =
      await Promise.all([
        getPricingWorkspaceDataWithContext(auth, projectId, pricingId),
        getProjectWithContext(auth, projectId),
        getProjectWorkspaceTabContextWithContext(auth, projectId),
        getQuoteSummaryForPricingDocument(pricingId),
        getLatestQuoteSummaryWithContext(auth, projectId),
      ]);

    return { data, project, tabContext, quoteSummaryForDoc, quoteSummary };
  });

  const { data, project, tabContext, quoteSummaryForDoc, quoteSummary } =
    pageData;

  const effectiveQuoteSummary = quoteSummaryForDoc ?? quoteSummary;
  const pricingChangedAfterQuote =
    effectiveQuoteSummary != null &&
    new Date(data.document.updated_at).getTime() >
      new Date(effectiveQuoteSummary.created_at).getTime();

  return (
    <WorkspacePage
      header={
        <WorkspaceHeaderBar
          actions={<UserMenu />}
        >
          <ProjectWorkspaceHeader project={project} subtitle="Final pricing" />
        </WorkspaceHeaderBar>
      }
      nav={
        <ProjectWorkspaceNav
          projectId={projectId}
          activeTab="pricing"
          pricingSummary={{
            id: pricingId,
            status: data.document.status,
          }}
          quoteSummary={effectiveQuoteSummary}
          hasEstimate={tabContext.hasEstimate}
          estimateIsStale={tabContext.estimateIsStale}
        />
      }
      contentClassName="py-6"
    >
      <SetupGuidanceServerBanner dimension="pricing" />
      <PricingWorkspace
        initialData={data}
        quoteSummary={effectiveQuoteSummary}
        pricingChangedAfterQuote={pricingChangedAfterQuote}
      />
    </WorkspacePage>
  );
}
