import { PricingWorkspace } from "@/components/pricing/PricingWorkspace";
import {
  WorkspaceHeaderBar,
  WorkspacePage,
} from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { measureServerLoad } from "@/lib/perf/timing";
import {
  getPricingWorkspaceData,
  getProjectWorkspaceTabContext,
} from "@/lib/pricing/actions";
import {
  getLatestQuoteSummary,
  getQuoteSummaryForPricingDocument,
} from "@/lib/quotes/actions";
import { getProject } from "@/lib/projects/actions";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";

type PricingPageProps = {
  params: Promise<{ projectId: string; pricingId: string }>;
};

export default async function PricingPage({ params }: PricingPageProps) {
  await connection();
  const { projectId, pricingId } = await params;

  const pageData = await measureServerLoad("pricing", async () => {
    const [
      data,
      project,
      tabContext,
      quoteSummaryForDoc,
      quoteSummary,
    ] = await Promise.all([
      getPricingWorkspaceData(projectId, pricingId),
      getProject(projectId),
      getProjectWorkspaceTabContext(projectId),
      getQuoteSummaryForPricingDocument(pricingId),
      getLatestQuoteSummary(projectId),
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <WorkspacePage
      header={
        <WorkspaceHeaderBar
          actions={
            <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
          }
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
      <PricingWorkspace
        initialData={data}
        quoteSummary={effectiveQuoteSummary}
        pricingChangedAfterQuote={pricingChangedAfterQuote}
      />
    </WorkspacePage>
  );
}
