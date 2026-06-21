import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { DashboardProjectList } from "@/components/projects/DashboardProjectList";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { SetupPromptCard } from "@/components/setup/SetupPromptCard";
import type { SetupStep } from "@/components/setup/types";
import { listProjects } from "@/lib/projects/actions";
import type { ProjectListFilter } from "@/lib/projects/types";
import { getSetupState, isSetupIncomplete } from "@/lib/setup/actions";
import { createClient } from "@/lib/supabase/server";

function getResumeStep(step: SetupStep | undefined): SetupStep {
  if (!step || step === "completed") return "company";
  return step;
}

function parseFilter(value?: string): ProjectListFilter {
  if (value === "archived" || value === "all") {
    return value;
  }
  return "active";
}

type DashboardPageProps = {
  searchParams: Promise<{ filter?: string; q?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const filter = parseFilter(params.filter);
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
  const [projects, setupState] = await Promise.all([
    listProjects({ filter, search }),
    setupIncomplete ? getSetupState() : Promise.resolve(null),
  ]);

  const resumeStep = getResumeStep(setupState?.settings?.onboarding_step);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your projects and estimates"
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

          <Suspense fallback={null}>
            <DashboardProjectList
              projects={projects}
              initialFilter={filter}
              initialSearch={search}
            />
          </Suspense>
        </div>
      </div>
    </>
  );
}
