"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { EmptyState } from "@/components/layout/empty-state";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DASHBOARD_FILTER_OPTIONS,
  isLifecycleArchiveFilter,
} from "@/lib/projects/status";
import type { ProjectListFilter, ProjectListItem } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type DashboardProjectListProps = {
  projects: ProjectListItem[];
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <form
          className="relative min-w-0 flex-1 sm:max-w-sm"
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
            className="pl-9"
            aria-label="Search projects"
          />
        </form>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max min-w-full gap-1 rounded-lg border border-border/60 bg-muted/20 p-1 sm:flex-wrap sm:w-auto">
            {DASHBOARD_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={isPending}
                onClick={() => updateParams({ filter: option.value })}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  initialFilter === option.value
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border shadow-[inset_0_-2px_0_0_var(--brand-orange)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
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
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                prefetch={index < 20}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
