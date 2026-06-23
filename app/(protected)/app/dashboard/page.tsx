import { Suspense } from "react";
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
    <>
      <PageHeader
        title="Dashboard"
        description="Create a project to start capturing scope and preparing an estimate."
        actions={
          <div className="flex items-center gap-2">
            <NewProjectDialog />
            <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
          </div>
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {setupIncomplete ? (
            <SetupPromptCard currentStep={resumeStep} />
          ) : null}

          <div className="space-y-6">
            <DashboardSummaryCards summary={summary} />

            <Suspense fallback={null}>
              <DashboardProjectList
                projects={projects}
                initialFilter={filter}
                initialSearch={search}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
