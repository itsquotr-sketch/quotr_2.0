import { PricingWorkspace } from "@/components/pricing/PricingWorkspace";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <ProjectHeader project={project} subtitle="Final pricing" />
          <div className="shrink-0 pt-1">
            <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
          </div>
        </div>
      </header>

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

      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PricingWorkspace
            initialData={data}
            quoteSummary={effectiveQuoteSummary}
            pricingChangedAfterQuote={pricingChangedAfterQuote}
          />
        </div>
      </div>
    </div>
  );
}
