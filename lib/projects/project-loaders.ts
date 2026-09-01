import "server-only";

import { notFound } from "next/navigation";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import {
  getAuthOrgContext,
  requireAuthOrgContext,
} from "@/lib/security/auth-org-context";
import {
  getProjectSelect,
  hasBusinessStatusColumns,
  hasClientEmailColumn,
  hasLifecycleColumns,
  isMissingBusinessStatusColumnsError,
  isMissingClientEmailColumnError,
  isMissingLifecycleColumnsError,
  markBusinessStatusColumnsUnavailable,
  markClientEmailColumnUnavailable,
  markLifecycleColumnsUnavailable,
  withLifecycleDefaults,
} from "@/lib/projects/query-utils";
import type { Project } from "@/lib/projects/types";

export async function getProjectWithContext(
  context: AuthOrgContext,
  projectId: string,
  retried = false
): Promise<Project> {
  const lifecycleAvailable = await hasLifecycleColumns(context.supabase);
  const businessStatusAvailable = lifecycleAvailable
    ? await hasBusinessStatusColumns(context.supabase)
    : false;
  const clientEmailAvailable = await hasClientEmailColumn(context.supabase);

  let query = context.supabase
    .from("projects")
    .select(
      getProjectSelect(
        lifecycleAvailable,
        businessStatusAvailable,
        clientEmailAvailable
      )
    )
    .eq("id", projectId)
    .eq("org_id", context.orgId);

  if (lifecycleAvailable) {
    query = query.is("deleted_at", null);
  }

  const { data: project, error } = await query.maybeSingle();

  if (error) {
    if (isMissingLifecycleColumnsError(error) && !retried) {
      markLifecycleColumnsUnavailable();
      return getProjectWithContext(context, projectId, true);
    }

    if (isMissingBusinessStatusColumnsError(error) && !retried) {
      markBusinessStatusColumnsUnavailable();
      return getProjectWithContext(context, projectId, true);
    }

    if (isMissingClientEmailColumnError(error) && !retried) {
      markClientEmailColumnUnavailable();
      return getProjectWithContext(context, projectId, true);
    }

    console.error("[getProject] query failed:", error.message);
    notFound();
  }

  if (!project) {
    notFound();
  }

  const mapped = withLifecycleDefaults(
    project as unknown as Record<string, unknown>
  );

  if (lifecycleAvailable && mapped.deleted_at) {
    notFound();
  }

  return mapped;
}

export async function getProjectForRequest(projectId: string): Promise<Project> {
  const context = await getAuthOrgContext();
  if (!context) {
    notFound();
  }
  return getProjectWithContext(context, projectId);
}

export async function requireProjectPageAuth() {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    notFound();
  }
  return auth;
}
