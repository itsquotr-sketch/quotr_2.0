import { AssistantShell } from "@/components/assistant/AssistantShell";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { getAssistantState } from "@/lib/assistant/state";
import { getProject } from "@/lib/projects/actions";
import { createClient } from "@/lib/supabase/server";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const [project, assistantState] = await Promise.all([
    getProject(id),
    getAssistantState(id),
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
          <ProjectHeader project={project} />
          <div className="shrink-0 pt-1">
            <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="mx-auto mt-6 max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <AssistantShell
            key={assistantState.project.stage}
            initialState={assistantState}
          />
        </div>
      </div>
    </div>
  );
}
