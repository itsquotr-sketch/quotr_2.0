import { Suspense } from "react";
import { DashboardAttention } from "@/components/dashboard/DashboardAttention";
import { DashboardOrgLine } from "@/components/dashboard/DashboardOrgLine";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardProjectList } from "@/components/projects/DashboardProjectList";
import { DashboardSummaryCards } from "@/components/projects/DashboardSummaryCards";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { OptionalPersonalisationPrompt } from "@/components/setup/OptionalPersonalisationPrompt";
import { loadDashboardPageData } from "@/lib/dashboard/load-dashboard-page";
import { measureServerLoad } from "@/lib/perf/timing";
import { getProjectNextAction } from "@/lib/projects/next-action";
import { parseProjectListFilter } from "@/lib/projects/status";
import { resolveOptionalPersonalisationTarget } from "@/lib/setup/optional-personalisation";
import Link from "next/link";

type DashboardPageProps = {
  searchParams: Promise<{ filter?: string; q?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const filter = parseProjectListFilter(params.filter);
  const search = params.q?.trim() ?? "";

  const { projects, summary, readiness, hasProjects, activity, attention } =
    await measureServerLoad("dashboard", () =>
      loadDashboardPageData({ filter, search })
    );

  const isEmpty = !hasProjects;
  const personalisation = isEmpty
    ? null
    : resolveOptionalPersonalisationTarget({
        dismissed: readiness.personalisationPromptDismissed,
        preferredWorkAreaTypes: readiness.preferredWorkAreaTypes,
        progress: [
          {
            workAreaType: "deck",
            calibrated: readiness.deckKeyTasksCalibrated,
            total: readiness.deckKeyTasksTotal,
            complete:
              readiness.deckKeyTasksTotal > 0 &&
              readiness.deckKeyTasksCalibrated >= readiness.deckKeyTasksTotal,
          },
          {
            workAreaType: "fence",
            calibrated: readiness.fenceKeyTasksCalibrated,
            total: readiness.fenceKeyTasksTotal,
            complete:
              readiness.fenceKeyTasksTotal > 0 &&
              readiness.fenceKeyTasksCalibrated >= readiness.fenceKeyTasksTotal,
          },
          {
            workAreaType: "retaining_wall",
            calibrated: readiness.rwKeyTasksCalibrated,
            total: readiness.rwKeyTasksTotal,
            complete: readiness.rwWorkAreaCalibrated,
          },
          {
            workAreaType: "bathroom",
            calibrated: readiness.bathroomKeyTasksCalibrated,
            total: readiness.bathroomKeyTasksTotal,
            complete:
              readiness.bathroomKeyTasksTotal > 0 &&
              readiness.bathroomKeyTasksCalibrated >= readiness.bathroomKeyTasksTotal,
          },
        ],
      });

  const listed = projects.map((project) => ({
    ...project,
    nextAction: getProjectNextAction(project),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Dashboard"
        description={
          isEmpty
            ? "Start with what you know. Plans aren't required."
            : "What needs attention, what is moving, and where to continue."
        }
        wrapDescription
        actions={
          <NewProjectDialog intent={isEmpty ? "first-job" : "default"} />
        }
      />
      <PageContainer innerClassName="max-md:py-3 max-md:pb-4">
        <div
          className="space-y-4 md:space-y-6"
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
              {personalisation ? (
                <OptionalPersonalisationPrompt
                  href={personalisation.href}
                  title={personalisation.title}
                  reason={personalisation.reason}
                />
              ) : null}
              <div data-dashboard-attention>
                <DashboardAttention items={attention} />
              </div>
              <section
                data-dashboard-workspace
                className="space-y-3"
                aria-labelledby="dashboard-active-work-heading"
              >
                <div className="flex items-end justify-between gap-3">
                  <h2
                    id="dashboard-active-work-heading"
                    className="text-sm font-semibold tracking-tight"
                  >
                    Active work
                  </h2>
                  <Link
                    href="/app/projects"
                    className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--brand-orange)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                  >
                    All projects
                  </Link>
                </div>
                <div data-dashboard-projects className="min-w-0">
                  <Suspense fallback={null}>
                    <DashboardProjectList
                      projects={listed}
                      initialFilter={filter}
                      initialSearch={search}
                    />
                  </Suspense>
                </div>
              </section>
              <section aria-labelledby="dashboard-summary-heading" data-dashboard-kpis>
                <h2
                  id="dashboard-summary-heading"
                  className="text-sm font-semibold tracking-tight"
                >
                  Workflow
                </h2>
                <div className="mt-2">
                  <DashboardSummaryCards summary={summary} activeFilter={filter} />
                </div>
              </section>
              {activity.length > 0 ? (
                <div data-dashboard-activity>
                  <RecentActivityCard items={activity} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
