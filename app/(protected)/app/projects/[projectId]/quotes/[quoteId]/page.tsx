import { QuoteWorkspace } from "@/components/quotes/QuoteWorkspace";
import { QuoteTemplate } from "@/components/quotes/QuoteTemplate";
import { WorkspaceContainer } from "@/components/layout/page-containers";
import {
  WorkspaceHeaderBar,
} from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { getProjectWorkspaceTabContext } from "@/lib/pricing/actions";
import { measureServerLoad } from "@/lib/perf/timing";
import {
  getLatestQuoteSummary,
  getQuoteWorkspaceData,
} from "@/lib/quotes/actions";
import { getProject } from "@/lib/projects/actions";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";

type QuotePageProps = {
  params: Promise<{ projectId: string; quoteId: string }>;
};

export default async function QuotePage({ params }: QuotePageProps) {
  await connection();
  const { projectId, quoteId } = await params;

  const pageData = await measureServerLoad("quote", async () => {
    const [data, project, tabContext, quoteSummary] = await Promise.all([
      getQuoteWorkspaceData(projectId, quoteId),
      getProject(projectId),
      getProjectWorkspaceTabContext(projectId),
      getLatestQuoteSummary(projectId),
    ]);

    return { data, project, tabContext, quoteSummary };
  });

  const { data, project, tabContext, quoteSummary } = pageData;

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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden print:bg-white">
      <header className="shrink-0 border-b bg-background print:hidden">
        <WorkspaceHeaderBar
          actions={
            <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
          }
        >
          <ProjectWorkspaceHeader project={project} subtitle="Client quote" />
        </WorkspaceHeaderBar>
      </header>

      <div className="print:hidden">
        <ProjectWorkspaceNav
          projectId={projectId}
          activeTab="quote"
          pricingSummary={tabContext.pricingSummary}
          quoteSummary={quoteSummary}
          hasEstimate={tabContext.hasEstimate}
          estimateIsStale={tabContext.estimateIsStale}
        />
      </div>

      <WorkspaceContainer innerClassName="py-6 print:max-w-none print:p-0">
        <QuoteWorkspace
          initialData={data}
          template={
            <QuoteTemplate
              quote={data.quote}
              quoteItems={data.items}
              companySettings={data.companySettings}
            />
          }
        />
      </WorkspaceContainer>
    </div>
  );
}
