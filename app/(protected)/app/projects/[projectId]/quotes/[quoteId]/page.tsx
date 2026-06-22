import { QuoteWorkspace } from "@/components/quotes/QuoteWorkspace";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { getProjectWorkspaceTabContext } from "@/lib/pricing/actions";
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
  const [data, project, tabContext, quoteSummary] = await Promise.all([
    getQuoteWorkspaceData(projectId, quoteId),
    getProject(projectId),
    getProjectWorkspaceTabContext(projectId),
    getLatestQuoteSummary(projectId),
  ]);

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
          <ProjectHeader project={project} subtitle={null} />
          <div className="shrink-0 pt-1">
            <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
          </div>
        </div>
      </header>

      <ProjectWorkspaceNav
        projectId={projectId}
        activeTab="quote"
        pricingSummary={tabContext.pricingSummary}
        quoteSummary={quoteSummary}
        hasEstimate={tabContext.hasEstimate}
        estimateIsStale={tabContext.estimateIsStale}
      />

      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <QuoteWorkspace initialData={data} />
        </div>
      </div>
    </div>
  );
}
