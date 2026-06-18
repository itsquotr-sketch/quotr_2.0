import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { UserMenu } from "@/components/layout/user-menu";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { SetupPromptCard } from "@/components/setup/SetupPromptCard";
import type { SetupStep } from "@/components/setup/types";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/projects/actions";
import { getSetupState, isSetupIncomplete } from "@/lib/setup/actions";
import { createClient } from "@/lib/supabase/server";

function getResumeStep(step: SetupStep | undefined): SetupStep {
  if (!step || step === "completed") return "company";
  return step;
}

export default async function DashboardPage() {
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
    listProjects(),
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

          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Create your first project to start building a quick estimate."
              action={
                <NewProjectDialog
                  trigger={<Button>New project</Button>}
                />
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {projects.length} project{projects.length === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
