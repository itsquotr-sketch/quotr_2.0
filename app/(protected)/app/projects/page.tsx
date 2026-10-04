import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardProjectList } from "@/components/projects/DashboardProjectList";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { loadDashboardPageData } from "@/lib/dashboard/load-dashboard-page";
import { measureServerLoad } from "@/lib/perf/timing";
import { getOnboardingAccess } from "@/lib/setup/actions";
import { memberCanCreateProjects } from "@/lib/team/permissions";
import { getProjectNextAction } from "@/lib/projects/next-action";
import { parseProjectListFilter } from "@/lib/projects/status";

type ProjectsPageProps = {
  searchParams: Promise<{ filter?: string; q?: string }>;
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const filter = params.filter ? parseProjectListFilter(params.filter) : "active";
  const search = params.q?.trim() ?? "";
  const [{ projects }, onboardingAccess] = await Promise.all([
    measureServerLoad("projects", () =>
      loadDashboardPageData({ filter, search })
    ),
    getOnboardingAccess(),
  ]);
  const canCreateProject = memberCanCreateProjects(onboardingAccess.role);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <PageHeader
        title="Projects"
        description="Every job, with its current stage and the next step."
        wrapDescription
        hideActionsOnMobile
        actions={canCreateProject ? <NewProjectDialog /> : null}
      />
      <PageContainer innerClassName="max-md:py-3 max-md:pb-4">
        <Suspense fallback={null}>
          <DashboardProjectList
            key={`${filter}:${search}`}
            projects={projects.map((project) => ({
              ...project,
              nextAction: getProjectNextAction(project),
            }))}
            initialFilter={filter}
            initialSearch={search}
            canCreateProject={canCreateProject}
          />
        </Suspense>
      </PageContainer>
    </div>
  );
}
