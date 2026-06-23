import { AssistantShell } from "@/components/assistant/AssistantShell";
import { UserMenu } from "@/components/layout/user-menu";
import { DuplicatedProjectBanner } from "@/components/projects/DuplicatedProjectBanner";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { getAssistantState } from "@/lib/assistant/state";
import { measureServerLoad } from "@/lib/perf/timing";
import { listProjectNotes } from "@/lib/project-notes/actions";
import { getPendingNoteProposal } from "@/lib/project-notes/proposals/actions";
import {
  getLatestPricingSummary,
  getProjectWorkspaceTabContext,
} from "@/lib/pricing/actions";
import { getLatestQuoteSummary } from "@/lib/quotes/actions";
import { getProject } from "@/lib/projects/actions";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  await connection();
  const { projectId } = await params;

  const pageData = await measureServerLoad("project", async () => {
    const [
      project,
      assistantState,
      noteList,
      pendingNoteProposal,
      pricingSummary,
      tabContext,
      quoteSummary,
    ] = await Promise.all([
      getProject(projectId),
      getAssistantState(projectId),
      listProjectNotes(projectId),
      getPendingNoteProposal(projectId),
      getLatestPricingSummary(projectId),
      getProjectWorkspaceTabContext(projectId),
      getLatestQuoteSummary(projectId),
    ]);

    return {
      project,
      assistantState,
      noteList,
      pendingNoteProposal,
      pricingSummary,
      tabContext,
      quoteSummary,
    };
  });

  const {
    project,
    assistantState,
    noteList,
    pendingNoteProposal,
    pricingSummary,
    tabContext,
    quoteSummary,
  } = pageData;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const hasEstimate = Boolean(assistantState.estimate);
  const estimateIsStale =
    assistantState.estimate?.isStale ?? tabContext.estimateIsStale;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <ProjectHeader project={project} />
          <div className="shrink-0 pt-1">
            <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
          </div>
        </div>
      </header>

      <ProjectWorkspaceNav
        projectId={projectId}
        activeTab="assistant"
        pricingSummary={pricingSummary ?? tabContext.pricingSummary}
        quoteSummary={quoteSummary}
        hasEstimate={hasEstimate || tabContext.hasEstimate}
        estimateIsStale={estimateIsStale}
      />

      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="mx-auto mt-6 max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <DuplicatedProjectBanner
            show={Boolean(project.duplicated_from_project_id)}
          />
          <AssistantShell
            key={assistantState.project.stage}
            initialState={assistantState}
            initialNotes={noteList.notes}
            pendingAnalysisCount={noteList.pendingAnalysisCount}
            totalNoteCount={noteList.totalCount}
            pendingNoteProposal={pendingNoteProposal}
            pricingSummary={pricingSummary ?? tabContext.pricingSummary}
            quoteSummary={quoteSummary}
          />
        </div>
      </div>
    </div>
  );
}
