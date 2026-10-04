import { redirect } from "next/navigation";
import { DashboardActiveProjects } from "@/components/dashboard/DashboardActiveProjects";
import { DashboardAttention } from "@/components/dashboard/DashboardAttention";
import { DashboardOrgLine } from "@/components/dashboard/DashboardOrgLine";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardSummaryCards } from "@/components/projects/DashboardSummaryCards";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { loadDashboardPageData } from "@/lib/dashboard/load-dashboard-page";
import { selectDashboardActiveProjects } from "@/lib/dashboard/select-active-projects";
import { measureServerLoad } from "@/lib/perf/timing";

type DashboardPageProps = {
  searchParams: Promise<{ filter?: string; q?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const legacyQuery = new URLSearchParams();
  if (params.filter) legacyQuery.set("filter", params.filter);
  if (params.q?.trim()) legacyQuery.set("q", params.q.trim());
  if (legacyQuery.size > 0) {
    redirect(`/app/projects?${legacyQuery.toString()}`);
  }

  const { projects, summary, hasProjects, activity, attention } =
    await measureServerLoad("dashboard", () =>
      loadDashboardPageData({ filter: "all", search: "" })
    );

  const isEmpty = !hasProjects;
  const active = selectDashboardActiveProjects(projects);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <PageHeader
        title="Dashboard"
        description={
          isEmpty
            ? "Start with what you know. Plans aren't required."
            : "What needs attention, what is moving, and where to continue."
        }
        wrapDescription
        actions={<NewProjectDialog intent={isEmpty ? "first-job" : "default"} />}
      />
      <PageContainer innerClassName="max-md:py-3 max-md:pb-4">
        <div
          className="space-y-4"
          data-has-projects={hasProjects ? "true" : "false"}
        >
          <DashboardOrgLine />
          {isEmpty ? (
            <div
              className="rounded-xl border border-border/70 bg-card px-4 py-8 text-center sm:px-6"
              data-first-job-empty="true"
            >
              <h2 className="text-lg font-semibold tracking-tight">
                Start your first job
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Add the job name and what you know. You can price it once the
                project exists.
              </p>
              <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <NewProjectDialog intent="first-job" />
              </div>
            </div>
          ) : (
            <>
              <section aria-labelledby="dashboard-summary-heading" data-dashboard-kpis>
                <h2 id="dashboard-summary-heading" className="sr-only">
                  Work overview
                </h2>
                <DashboardSummaryCards summary={summary} />
              </section>
              <div
                data-dashboard-grid
                data-dashboard-workspace
                className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
              >
                <div className="order-1 min-w-0 lg:col-start-2 lg:row-start-1">
                  <DashboardAttention items={attention} />
                </div>
                <div className="order-2 min-w-0 lg:col-start-1 lg:row-start-1">
                  <DashboardActiveProjects
                    projects={active.projects}
                    total={active.total}
                  />
                </div>
                {activity.length > 0 ? (
                  <div
                    className="order-3 min-w-0 lg:col-start-2 lg:row-start-2"
                    data-dashboard-activity
                  >
                    <RecentActivityCard items={activity} />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
