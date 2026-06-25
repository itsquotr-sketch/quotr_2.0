import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { DashboardProjectList } from "@/components/projects/DashboardProjectList";
import { DashboardSummaryCards } from "@/components/projects/DashboardSummaryCards";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { SetupPromptCard } from "@/components/setup/SetupPromptCard";
import type { SetupStep } from "@/components/setup/types";
import {
  getDashboardPipelineSummary,
  listProjects,
} from "@/lib/projects/actions";
import { measureServerLoad } from "@/lib/perf/timing";
import { getProjectNextAction } from "@/lib/projects/next-action";
import { parseProjectListFilter } from "@/lib/projects/status";
import { getSetupState, isSetupIncomplete } from "@/lib/setup/actions";
import { createClient } from "@/lib/supabase/server";

function getResumeStep(step: SetupStep | undefined): SetupStep {
  if (!step || step === "completed") return "company";
  return step;
}

type DashboardPageProps = {
  searchParams: Promise<{ filter?: string; q?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const filter = parseProjectListFilter(params.filter);
  const search = params.q?.trim() ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const setupIncomplete = await isSetupIncomplete();
  const { projects, summary, setupState } = await measureServerLoad(
    "dashboard",
    async () => {
      const [projectsResult, summaryResult, setupStateResult] =
        await Promise.all([
          listProjects({ filter, search }),
          getDashboardPipelineSummary(),
          setupIncomplete ? getSetupState() : Promise.resolve(null),
        ]);

      return {
        projects: projectsResult,
        summary: summaryResult,
        setupState: setupStateResult,
      };
    }
  );

  const resumeStep = getResumeStep(setupState?.settings?.onboarding_step);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Dashboard"
        description="Quote faster. Miss less. Track projects from brief to quote."
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <NewProjectDialog />
            </div>
            <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
          </div>
        }
      />
      <PageContainer>
        <div className="space-y-6">
          {setupIncomplete ? (
            <SetupPromptCard currentStep={resumeStep} />
          ) : null}

          <DashboardSummaryCards summary={summary} activeFilter={filter} />

          <Suspense fallback={null}>
            <DashboardProjectList
              projects={projects.map((project) => ({
                ...project,
                nextAction: getProjectNextAction(project),
              }))}
              initialFilter={filter}
              initialSearch={search}
            />
          </Suspense>
        </div>
      </PageContainer>
    </div>
  );
}
