import type { Project, ProjectListFilter } from "@/lib/projects/types";

export const PROJECT_SELECT_BASE =
  "id, title, brief_text, client_name, site_address, priority, due_date, notes, stage, quality_level, status, created_at";

export const PROJECT_SELECT_LIFECYCLE =
  "archived_at, deleted_at, duplicated_from_project_id";

export const PROJECT_SELECT = `${PROJECT_SELECT_BASE}, ${PROJECT_SELECT_LIFECYCLE}`;

type SupabaseError = { message?: string; code?: string } | null;

export function isMissingLifecycleColumnsError(error: SupabaseError): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (message.includes("archived_at") && message.includes("does not exist")) ||
    (message.includes("deleted_at") && message.includes("does not exist")) ||
    (message.includes("duplicated_from_project_id") &&
      message.includes("does not exist"))
  );
}

export function lifecycleMigrationRequiredMessage(): string {
  return "Project archive and delete require a database update. Please run migration 007_project_lifecycle.sql.";
}

export function mapLifecycleActionError(error: SupabaseError): string {
  if (isMissingLifecycleColumnsError(error)) {
    return lifecycleMigrationRequiredMessage();
  }

  console.error("[project lifecycle]", error?.message ?? "Unknown error");
  return "Could not update this project. Please try again.";
}

export function withLifecycleDefaults(
  row: Record<string, unknown>
): Project {
  return {
    ...(row as Omit<
      Project,
      "archived_at" | "deleted_at" | "duplicated_from_project_id"
    >),
    archived_at: (row.archived_at as string | null | undefined) ?? null,
    deleted_at: (row.deleted_at as string | null | undefined) ?? null,
    duplicated_from_project_id:
      (row.duplicated_from_project_id as string | null | undefined) ?? null,
  };
}

export function applyProjectListFilter(
  projects: Project[],
  filter: ProjectListFilter,
  lifecycleAvailable: boolean
): Project[] {
  return projects.filter((project) => {
    const isDeleted = Boolean(project.deleted_at);
    const isArchived = lifecycleAvailable
      ? Boolean(project.archived_at)
      : project.status === "archived";

    if (isDeleted) {
      return false;
    }

    if (filter === "active") {
      return !isArchived;
    }

    if (filter === "archived") {
      return isArchived;
    }

    return true;
  });
}

/** Only cache a positive result — never cache false (avoids stale false after migration). */
let lifecycleColumnsConfirmed = false;

export function markLifecycleColumnsUnavailable() {
  lifecycleColumnsConfirmed = false;
}

export async function hasLifecycleColumns(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >
): Promise<boolean> {
  if (lifecycleColumnsConfirmed) {
    return true;
  }

  const { error } = await supabase
    .from("projects")
    .select("archived_at")
    .limit(1);

  if (!error) {
    lifecycleColumnsConfirmed = true;
    return true;
  }

  if (isMissingLifecycleColumnsError(error)) {
    return false;
  }

  // Transient or unrelated error — assume columns exist and let queries surface errors.
  console.error("[hasLifecycleColumns] probe failed:", error.message);
  return true;
}

export function resetLifecycleColumnsCacheForTests() {
  lifecycleColumnsConfirmed = false;
}
