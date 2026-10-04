import type { Project, ProjectListFilter } from "@/lib/projects/types";
import {
  ACTIVE_PIPELINE_STATUSES,
  DEFAULT_BUSINESS_STATUS,
  isBusinessStatus,
  isLifecycleArchiveFilter,
} from "@/lib/projects/status";

export const PROJECT_SELECT_BASE =
  "id, title, brief_text, client_name, site_address, priority, due_date, notes, stage, quality_level, status, created_at";

export const PROJECT_SELECT_LIFECYCLE =
  "archived_at, deleted_at, duplicated_from_project_id";

export const PROJECT_SELECT_BUSINESS_STATUS =
  "business_status, status_updated_at, lost_reason, won_at, lost_at";

export const PROJECT_SELECT = `${PROJECT_SELECT_BASE}, ${PROJECT_SELECT_LIFECYCLE}, ${PROJECT_SELECT_BUSINESS_STATUS}`;

export const PROJECT_SELECT_WITHOUT_BUSINESS_STATUS = `${PROJECT_SELECT_BASE}, ${PROJECT_SELECT_LIFECYCLE}`;

/** Dashboard list/KPI columns — omits notes/brief unused by the list UI. */
export function getDashboardProjectSelect(
  lifecycleAvailable: boolean,
  businessStatusAvailable: boolean,
  clientEmailAvailable = false
): string {
  const cols = [
    "id",
    "title",
    "client_name",
    "site_address",
    "priority",
    "due_date",
    "stage",
    "created_at",
  ];
  if (clientEmailAvailable) {
    cols.push("client_email");
  }
  if (lifecycleAvailable) {
    cols.push("archived_at", "deleted_at");
  }
  if (businessStatusAvailable) {
    cols.push("business_status");
  }
  return cols.join(", ");
}

export function clientEmailMigrationRequiredMessage(): string {
  return "Client email requires a database update. Please run migration 043_project_client_email.sql.";
}

export function getProjectSelect(
  lifecycleAvailable: boolean,
  businessStatusAvailable: boolean,
  clientEmailAvailable = false,
  customerIdAvailable = false
): string {
  const base = clientEmailAvailable
    ? `${PROJECT_SELECT_BASE}, client_email`
    : PROJECT_SELECT_BASE;

  const withCustomer = customerIdAvailable ? `${base}, customer_id` : base;

  if (!lifecycleAvailable) {
    return withCustomer;
  }

  const lifecycleAndStatus = businessStatusAvailable
    ? `${PROJECT_SELECT_LIFECYCLE}, ${PROJECT_SELECT_BUSINESS_STATUS}`
    : PROJECT_SELECT_LIFECYCLE;

  return `${withCustomer}, ${lifecycleAndStatus}`;
}

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

export function isMissingClientEmailColumnError(error: SupabaseError): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("client_email") &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      message.includes("does not exist"))
  );
}

export function isMissingCustomerIdColumnError(error: SupabaseError): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    (message.includes("customer_id") || message.includes("creation_request_id")) &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      message.includes("does not exist") ||
      message.includes("schema cache"))
  );
}

export function isMissingBusinessStatusColumnsError(
  error: SupabaseError
): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (message.includes("business_status") && message.includes("does not exist"))
  );
}

export function lifecycleMigrationRequiredMessage(): string {
  return "Project archive and delete require a database update. Please run migration 007_project_lifecycle.sql.";
}

export function businessStatusMigrationRequiredMessage(): string {
  return "Project business status requires a database update. Please run migration 010_business_status.sql.";
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
  const businessStatusRaw = row.business_status as string | undefined;
  const businessStatus =
    businessStatusRaw && isBusinessStatus(businessStatusRaw)
      ? businessStatusRaw
      : DEFAULT_BUSINESS_STATUS;

  return {
    ...(row as Omit<
      Project,
      | "client_email"
      | "customer_id"
      | "archived_at"
      | "deleted_at"
      | "duplicated_from_project_id"
      | "business_status"
      | "status_updated_at"
      | "lost_reason"
      | "won_at"
      | "lost_at"
    >),
    client_email: (row.client_email as string | null | undefined) ?? null,
    customer_id: (row.customer_id as string | null | undefined) ?? null,
    archived_at: (row.archived_at as string | null | undefined) ?? null,
    deleted_at: (row.deleted_at as string | null | undefined) ?? null,
    duplicated_from_project_id:
      (row.duplicated_from_project_id as string | null | undefined) ?? null,
    business_status: businessStatus,
    status_updated_at:
      (row.status_updated_at as string | null | undefined) ?? null,
    lost_reason: (row.lost_reason as string | null | undefined) ?? null,
    won_at: (row.won_at as string | null | undefined) ?? null,
    lost_at: (row.lost_at as string | null | undefined) ?? null,
  };
}

export function applyProjectListFilter(
  projects: Project[],
  filter: ProjectListFilter,
  lifecycleAvailable: boolean,
  businessStatusAvailable: boolean
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
      if (isArchived) {
        return false;
      }

      if (businessStatusAvailable) {
        return ACTIVE_PIPELINE_STATUSES.includes(project.business_status);
      }

      return true;
    }

    if (isLifecycleArchiveFilter(filter)) {
      return isArchived;
    }

    if (filter === "all") {
      return true;
    }

    if (isBusinessStatus(filter)) {
      // Quote sent is current work. Archived quote-sent projects stay on
      // the Archived filter. Won, Lost, and the other status filters still
      // include archived rows.
      if (filter === "quote_sent" && isArchived) {
        return false;
      }
      return project.business_status === filter;
    }

    return true;
  });
}

/** Only cache a positive result — never cache false (avoids stale false after migration). */
let lifecycleColumnsConfirmed = false;
let businessStatusColumnsConfirmed = false;
let clientEmailColumnConfirmed = false;
let customerIdColumnConfirmed = false;

export function markLifecycleColumnsUnavailable() {
  lifecycleColumnsConfirmed = false;
}

export function markBusinessStatusColumnsUnavailable() {
  businessStatusColumnsConfirmed = false;
}

export function markClientEmailColumnUnavailable() {
  clientEmailColumnConfirmed = false;
}

export function markCustomerIdColumnUnavailable() {
  customerIdColumnConfirmed = false;
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

  console.error("[hasLifecycleColumns] probe failed:", error.message);
  return true;
}

export async function hasBusinessStatusColumns(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >
): Promise<boolean> {
  if (businessStatusColumnsConfirmed) {
    return true;
  }

  const { error } = await supabase
    .from("projects")
    .select("business_status")
    .limit(1);

  if (!error) {
    businessStatusColumnsConfirmed = true;
    return true;
  }

  if (isMissingBusinessStatusColumnsError(error)) {
    return false;
  }

  console.error("[hasBusinessStatusColumns] probe failed:", error.message);
  return true;
}

export async function hasClientEmailColumn(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >
): Promise<boolean> {
  if (clientEmailColumnConfirmed) {
    return true;
  }

  const { error } = await supabase
    .from("projects")
    .select("client_email")
    .limit(1);

  if (!error) {
    clientEmailColumnConfirmed = true;
    return true;
  }

  if (isMissingClientEmailColumnError(error)) {
    return false;
  }

  console.error("[hasClientEmailColumn] probe failed:", error.message);
  return true;
}

export async function hasCustomerIdColumn(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >
): Promise<boolean> {
  if (customerIdColumnConfirmed) return true;
  const { error } = await supabase.from("projects").select("customer_id").limit(1);
  if (!error) {
    customerIdColumnConfirmed = true;
    return true;
  }
  if (isMissingCustomerIdColumnError(error)) return false;
  console.error("[hasCustomerIdColumn] probe failed:", error.message);
  return true;
}

export function resetLifecycleColumnsCacheForTests() {
  lifecycleColumnsConfirmed = false;
  businessStatusColumnsConfirmed = false;
  clientEmailColumnConfirmed = false;
  customerIdColumnConfirmed = false;
}

export type ProjectSchemaProbe = {
  lifecycleAvailable: boolean;
  businessStatusAvailable: boolean;
  clientEmailAvailable: boolean;
  customerIdAvailable: boolean;
};

/**
 * PERFORMANCE-01A — three column-existence probes are independent.
 * businessStatus is only consumed when lifecycle columns exist; the probe
 * itself does not need that result to run.
 */
export async function probeProjectSchemaColumns(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >
): Promise<ProjectSchemaProbe> {
  const [
    lifecycleAvailable,
    businessStatusAvailable,
    clientEmailAvailable,
    customerIdAvailable,
  ] = await Promise.all([
    hasLifecycleColumns(supabase),
    hasBusinessStatusColumns(supabase),
    hasClientEmailColumn(supabase),
    hasCustomerIdColumn(supabase),
  ]);

  return {
    lifecycleAvailable,
    businessStatusAvailable: lifecycleAvailable && businessStatusAvailable,
    clientEmailAvailable,
    customerIdAvailable,
  };
}
