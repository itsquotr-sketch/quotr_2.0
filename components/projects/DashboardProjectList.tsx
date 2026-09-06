"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { ProjectMobileCard } from "@/components/projects/ProjectMobileCard";
import { ProjectRow } from "@/components/projects/ProjectRow";
import { EmptyState } from "@/components/layout/empty-state";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import {
  DASHBOARD_FILTER_OPTIONS,
  isLifecycleArchiveFilter,
} from "@/lib/projects/status";
import type { DashboardProjectListItem, ProjectListFilter } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

const filterSelectClassName = cn(
  "h-10 w-full rounded-lg border border-border/60 bg-card px-3 text-sm outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

type DashboardProjectListProps = {
  projects: DashboardProjectListItem[];
  initialFilter: ProjectListFilter;
  initialSearch: string;
};

export function DashboardProjectList({
  projects,
  initialFilter,
  initialSearch,
}: DashboardProjectListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const isDesktop = useIsDesktop();

  const updateParams = useCallback(
    (updates: { filter?: ProjectListFilter; q?: string }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.filter !== undefined) {
        if (updates.filter === "active") {
          params.delete("filter");
        } else {
          params.set("filter", updates.filter);
        }
      }

      if (updates.q !== undefined) {
        const trimmed = updates.q.trim();
        if (trimmed) {
          params.set("q", trimmed);
        } else {
          params.delete("q");
        }
      }

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `/app/dashboard?${query}` : "/app/dashboard");
      });
    },
    [router, searchParams]
  );

  const emptyTitle =
    initialSearch.trim().length > 0
      ? "No projects match your search."
      : isLifecycleArchiveFilter(initialFilter)
        ? "No archived projects."
        : initialFilter === "all"
          ? "No projects yet."
          : initialFilter === "active"
            ? "No active projects yet."
            : `No ${DASHBOARD_FILTER_OPTIONS.find((option) => option.value === initialFilter)?.label.toLowerCase() ?? "matching"} projects.`;

  const emptyDescription =
    initialSearch.trim().length > 0
      ? "Try a different search term or clear the filter."
      : isLifecycleArchiveFilter(initialFilter)
        ? "Archived projects will appear here."
        : initialFilter === "active"
          ? "Create your first project to start estimating."
          : "Try a different status filter or create a new project.";

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3 sm:p-4 md:space-y-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <form
          className="relative min-w-0 flex-1 sm:max-w-md lg:max-w-lg"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            updateParams({ q: String(formData.get("q") ?? "") });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            placeholder="Search by title, client, or address…"
            defaultValue={initialSearch}
            className="h-10 pl-9"
            aria-label="Search projects"
          />
        </form>
        <div className="md:hidden">
          <NewProjectDialog trigger={<Button className="h-10 w-full">New project</Button>} />
        </div>
      </div>

      <div className="space-y-1 md:hidden">
        <Label htmlFor="dashboard-status-filter" className="text-xs text-muted-foreground">
          Status
        </Label>
        <select
          id="dashboard-status-filter"
          aria-label="Filter projects by status"
          disabled={isPending}
          value={initialFilter}
          onChange={(event) =>
            updateParams({
              filter: event.target.value as ProjectListFilter,
            })
          }
          className={filterSelectClassName}
        >
          {DASHBOARD_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label === "All" ? "All projects" : option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:-mx-0 md:block">
        <div className="flex flex-wrap gap-1.5">
          {DASHBOARD_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={isPending}
              onClick={() => updateParams({ filter: option.value })}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                initialFilter === option.value
                  ? "border-[var(--brand-orange-muted)] bg-[var(--brand-orange-muted)] text-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
              )}
              aria-pressed={initialFilter === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            initialFilter === "active" && !initialSearch.trim() ? (
              <NewProjectDialog trigger={<Button>New project</Button>} />
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </p>
            {isPending ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Updating…
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            {projects.map((project, index) =>
              isDesktop ? (
                <ProjectRow
                  key={project.id}
                  project={project}
                  prefetch={index < 20}
                />
              ) : (
                <ProjectMobileCard
                  key={project.id}
                  project={project}
                  prefetch={index < 20}
                />
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
