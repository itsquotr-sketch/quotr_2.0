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
import { projectSectionContext } from "@/lib/projects/project-information";
import { readProjectDocumentsForJobDetails } from "@/lib/projects/document-centre";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { getOnboardingAccess } from "@/lib/setup/actions";
import { memberCanEditProjects, memberCanRunEstimates } from "@/lib/team/permissions";
import { parseEstimateSection } from "@/lib/assistant/presentation/estimate-section";
import { getScopeDiscoveryResultsAction } from "@/lib/scope-discovery/actions";
import { isScopeDiscoveryEnabled } from "@/lib/scope-discovery/configuration";
import type { SafeResultsRead } from "@/lib/scope-discovery/application/types";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { notFound } from "next/navigation";
import { connection } from "next/server";

/** Hosts Analyse Job / Notes server actions. Must exceed provider (75s) + DB. */
export const maxDuration = 120;
export const runtime = "nodejs";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ estimate?: string }>;
};

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  await connection();
  const { projectId } = await params;
  const query = await searchParams;

  const pageData = await measureServerLoad("project", async () => {
    const auth = await requireAuthOrgContext();
    if (!auth.ok) {
      notFound();
    }

    const pricingSummaryPromise = getLatestPricingSummaryWithContext(auth, projectId);

    const [
      project,
      assistantState,
      noteList,
      pendingNoteProposal,
      pricingSummary,
      quoteSummary,
      tabContext,
      documents,
      onboardingAccess,
    ] = await Promise.all([
      getProjectWithContext(auth, projectId),
      getAssistantStateWithContext(auth, projectId),
      listProjectNotesWithContext(auth, projectId),
      getPendingNoteProposalWithContext(auth, projectId),
      pricingSummaryPromise,
      getLatestQuoteSummaryWithContext(auth, projectId),
      getProjectWorkspaceTabContextWithContext(auth, projectId, {
        pricingSummaryPromise,
      }),
      readProjectDocumentsForJobDetails(auth.supabase, projectId, auth.orgId),
      getOnboardingAccess(),
    ]);

    return {
      project,
      assistantState,
      noteList,
      pendingNoteProposal,
      pricingSummary,
      tabContext,
      quoteSummary,
      documents,
      canUploadFiles: memberCanEditProjects(onboardingAccess.role),
      canRunEstimates: memberCanRunEstimates(onboardingAccess.role),
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
    documents,
    canUploadFiles,
    canRunEstimates,
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
          <ProjectWorkspaceHeader project={project} />
        </WorkspaceHeaderBar>
      }
      nav={
        <ProjectWorkspaceNavProjected
          projectId={projectId}
          activeTab="assistant"
          projectContext={projectSectionContext(project)}
          quoteSummary={quoteSummary}
        />
      }
    >
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
        scopeDiscoveryEnabled={scopeDiscoveryEnabled}
        scopeDiscoveryInitialResults={scopeDiscoveryInitialResults}
        documents={documents}
        canUploadFiles={canUploadFiles}
        canRunEstimates={canRunEstimates}
        initialEstimateSection={parseEstimateSection(query.estimate)}
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
