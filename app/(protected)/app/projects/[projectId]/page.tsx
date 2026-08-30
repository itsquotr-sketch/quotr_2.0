import { AssistantShell } from "@/components/assistant/AssistantShell";
import {
  WorkspaceHeaderBar,
  WorkspacePage,
} from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { DuplicatedProjectBanner } from "@/components/projects/DuplicatedProjectBanner";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import {
  EstimateGenerationProjectionProvider,
  ProjectWorkspaceNavProjected,
} from "@/components/projects/estimate-generation-projection";
import { SetupGuidanceServerBanner } from "@/components/setup/SetupGuidanceServerBanner";
import { getAssistantStateWithContext } from "@/lib/assistant/state";
import { measureServerLoad } from "@/lib/perf/timing";
import {
  getPendingNoteProposalWithContext,
  listProjectNotesWithContext,
} from "@/lib/project-notes/note-loaders";
import {
  getLatestPricingSummaryWithContext,
  getProjectWorkspaceTabContextWithContext,
} from "@/lib/pricing/pricing-loaders";
import { getLatestQuoteSummaryWithContext } from "@/lib/quotes/quote-loaders";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { getScopeDiscoveryResultsAction } from "@/lib/scope-discovery/actions";
import { isScopeDiscoveryEnabled } from "@/lib/scope-discovery/configuration";
import type { SafeResultsRead } from "@/lib/scope-discovery/application/types";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  await connection();
  const { projectId } = await params;

  const pageData = await measureServerLoad("project", async () => {
    const auth = await requireAuthOrgContext();
    if (!auth.ok) {
      notFound();
    }

    const [
      project,
      assistantState,
      noteList,
      pendingNoteProposal,
      pricingSummary,
      quoteSummary,
    ] = await Promise.all([
      getProjectWithContext(auth, projectId),
      getAssistantStateWithContext(auth, projectId),
      listProjectNotesWithContext(auth, projectId),
      getPendingNoteProposalWithContext(auth, projectId),
      getLatestPricingSummaryWithContext(auth, projectId),
      getLatestQuoteSummaryWithContext(auth, projectId),
    ]);

    const tabContext = await getProjectWorkspaceTabContextWithContext(
      auth,
      projectId,
      { pricingSummary }
    );

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

  const hasEstimate = Boolean(assistantState.estimate);
  const estimateIsStale =
    assistantState.estimate?.isStale ?? tabContext.estimateIsStale;
  const scopeDiscoveryEnabled = isScopeDiscoveryEnabled();

  let scopeDiscoveryInitialResults: SafeResultsRead | null = null;
  if (scopeDiscoveryEnabled) {
    const discoveryRead = await getScopeDiscoveryResultsAction({ projectId });
    if (discoveryRead.ok) {
      scopeDiscoveryInitialResults = discoveryRead;
    }
  }

  return (
    <EstimateGenerationProjectionProvider
      initialHasEstimate={hasEstimate || tabContext.hasEstimate}
      initialEstimateIsStale={estimateIsStale}
      initialPricingSummary={pricingSummary ?? tabContext.pricingSummary}
    >
    <WorkspacePage
      header={
        <WorkspaceHeaderBar
          actions={<UserMenu />}
        >
          <ProjectWorkspaceHeader project={project} subtitle="Project assistant" />
        </WorkspaceHeaderBar>
      }
      nav={
        <ProjectWorkspaceNavProjected
          projectId={projectId}
          activeTab="assistant"
          quoteSummary={quoteSummary}
        />
      }
    >
      <DuplicatedProjectBanner
        show={Boolean(project.duplicated_from_project_id)}
      />
      {!(hasEstimate || tabContext.hasEstimate) ? (
        <SetupGuidanceServerBanner dimension="estimate" />
      ) : null}
      <AssistantShell
        key={assistantState.project.stage}
        initialState={assistantState}
        initialNotes={noteList.notes}
        pendingAnalysisCount={noteList.pendingAnalysisCount}
        totalNoteCount={noteList.totalCount}
        pendingNoteProposal={pendingNoteProposal}
        pricingSummary={pricingSummary ?? tabContext.pricingSummary}
        quoteSummary={quoteSummary}
        scopeDiscoveryEnabled={scopeDiscoveryEnabled}
        scopeDiscoveryInitialResults={scopeDiscoveryInitialResults}
      />
      {hasEstimate || tabContext.hasEstimate ? (
        <div className="mt-3" data-post-estimate-guidance="true">
          <SetupGuidanceServerBanner
            dimension="estimate"
            hasEstimate
          />
        </div>
      ) : null}
    </WorkspacePage>
    </EstimateGenerationProjectionProvider>
  );
}
