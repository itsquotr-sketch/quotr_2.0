import { redirect } from "next/navigation";
import { DashboardActiveProjects } from "@/components/dashboard/DashboardActiveProjects";
import { DashboardHeaderSubtitle } from "@/components/dashboard/DashboardOrgLine";
import { DashboardWorkPanel } from "@/components/dashboard/DashboardWorkPanel";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardSummaryCards } from "@/components/projects/DashboardSummaryCards";
import { DashboardOnboardingHandoff } from "@/components/projects/DashboardOnboardingHandoff";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { loadDashboardPageData } from "@/lib/dashboard/load-dashboard-page";
import { getOnboardingAccess } from "@/lib/setup/actions";
import { memberCanCreateProjects } from "@/lib/team/permissions";
import { selectDashboardActiveProjects } from "@/lib/dashboard/select-active-projects";
import { presentDashboardOverview } from "@/lib/dashboard/work-overview";
import { measureServerLoad } from "@/lib/perf/timing";

type DashboardPageProps = {
  searchParams: Promise<{ filter?: string; q?: string; newProject?: string; consent?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const legacyQuery = new URLSearchParams();
  if (params.filter) legacyQuery.set("filter", params.filter);
  if (params.q?.trim()) legacyQuery.set("q", params.q.trim());
  if (legacyQuery.size > 0) {
    redirect(`/app/projects?${legacyQuery.toString()}`);
  }

  const [{ projects, hasProjects, activity, attention }, onboardingAccess] =
    await Promise.all([
      measureServerLoad("dashboard", () =>
        loadDashboardPageData({ filter: "all", search: "" })
      ),
      getOnboardingAccess(),
    ]);
  const canCreateProject = memberCanCreateProjects(onboardingAccess.role);

  const isEmpty = !hasProjects;
  const active = selectDashboardActiveProjects(projects);
  const overview = presentDashboardOverview(projects);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <PageHeader
        title="Dashboard"
        description={
          isEmpty ? (
            "Start with what you know. Plans aren't required."
          ) : (
            <DashboardHeaderSubtitle />
          )
        }
        wrapDescription
        hideActionsOnMobile
        actions={
          canCreateProject ? (
            <NewProjectDialog intent={isEmpty ? "first-job" : "default"} />
          ) : null
        }
      />
      <PageContainer innerClassName="py-4 max-md:py-3 max-md:pb-4">
        <DashboardOnboardingHandoff
          openNewProject={canCreateProject && params.newProject === "1"}
          consentUnsaved={params.consent === "unsaved"}
        />
        <div
          className="space-y-3 lg:space-y-4"
          data-has-projects={hasProjects ? "true" : "false"}
        >
          {isEmpty ? (
            <div
              className="rounded-xl border border-border/70 bg-card px-4 py-8 text-center sm:px-6"
              data-first-job-empty="true"
            >
              <h2 className="text-lg font-semibold tracking-tight">
                Start your first job
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Name the job now. You can add the work details on the next
                screen.
              </p>
              {canCreateProject ? (
                <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <NewProjectDialog intent="first-job" />
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <section aria-labelledby="dashboard-summary-heading" data-dashboard-kpis>
                <h2 id="dashboard-summary-heading" className="sr-only">
                  Work overview
                </h2>
                <DashboardSummaryCards summary={overview} />
              </section>
              <div
                data-dashboard-grid
                data-dashboard-workspace
                className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-4"
              >
                <div
                  className="order-1 min-w-0 lg:col-start-2 lg:row-start-1"
                  data-dashboard-activity
                >
                  <DashboardWorkPanel attention={attention} activity={activity} />
                </div>
                <div className="order-2 min-w-0 lg:col-start-1 lg:row-start-1">
                  <DashboardActiveProjects
                    projects={active.projects}
                    total={active.total}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
