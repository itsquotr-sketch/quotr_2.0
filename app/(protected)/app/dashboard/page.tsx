import { Suspense } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { DashboardProjectList } from "@/components/projects/DashboardProjectList";
import { DashboardSummaryCards } from "@/components/projects/DashboardSummaryCards";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { ImproveSetupCard } from "@/components/setup/ImproveSetupCard";
import {
  getDashboardPipelineSummary,
  listProjects,
} from "@/lib/projects/actions";
import { measureServerLoad } from "@/lib/perf/timing";
import { getProjectNextAction } from "@/lib/projects/next-action";
import { parseProjectListFilter } from "@/lib/projects/status";
import { getCompanySetupReadiness } from "@/lib/setup/readiness-actions";

type DashboardPageProps = {
  searchParams: Promise<{ filter?: string; q?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const filter = parseProjectListFilter(params.filter);
  const search = params.q?.trim() ?? "";

  // Identity comes from AppShell / AppUserContext (layout). Do not re-fetch
  // auth+profile here — desktop UserMenu reads the shared context.
  const { projects, summary, readiness } = await measureServerLoad(
    "dashboard",
    async () => {
      const [projectsResult, summaryResult, readinessResult] =
        await Promise.all([
          listProjects({ filter, search }),
          getDashboardPipelineSummary(),
          getCompanySetupReadiness(),
        ]);

      return {
        projects: projectsResult,
        summary: summaryResult,
        readiness: readinessResult,
      };
    }
  );

  const isEmpty = projects.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        compactOnMobile
        title="Dashboard"
        description="Quote faster. Miss less. Track projects from brief to quote."
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <NewProjectDialog />
            </div>
            <UserMenu />
          </div>
        }
      />
      <PageContainer innerClassName="max-md:py-3 max-md:pb-4">
        <div className="space-y-4 md:space-y-6">
          {isEmpty ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-8 text-center sm:px-6">
              <h2 className="text-lg font-semibold tracking-tight">
                Create your first project
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Capture the job, build scope, and generate a quick estimate.
                Optional company setup can improve accuracy as you go.
              </p>
              <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <NewProjectDialog />
                <Link
                  href="/app/setup?mode=improve"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Optional company setup
                </Link>
              </div>
            </div>
          ) : null}

          <ImproveSetupCard
            readiness={readiness}
            hasProjects={!isEmpty}
          />
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
