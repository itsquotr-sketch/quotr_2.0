"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { EmptyState } from "@/components/layout/empty-state";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectListFilter, ProjectListItem } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type DashboardProjectListProps = {
  projects: ProjectListItem[];
  initialFilter: ProjectListFilter;
  initialSearch: string;
};

const FILTER_OPTIONS: { value: ProjectListFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

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
      : initialFilter === "archived"
        ? "No archived projects."
        : "No active projects yet.";

  const emptyDescription =
    initialSearch.trim().length > 0
      ? "Try a different search term or clear the filter."
      : initialFilter === "archived"
        ? "Archived projects will appear here."
        : "Create your first project to start building a quick estimate.";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={isPending}
              onClick={() => updateParams({ filter: option.value })}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                initialFilter === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
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
        </>
      )}
    </div>
  );
}
