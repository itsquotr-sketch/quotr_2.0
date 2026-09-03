"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { toUserError, USER_ERRORS } from "@/lib/errors/user-message";
import { permissionDeniedError } from "@/lib/team/permission-server";
import { projectDetailsSchema } from "@/lib/projects/schema";
import {
  applyProjectListFilter,
  clientEmailMigrationRequiredMessage,
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
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import {
  ACTIVE_PIPELINE_STATUSES,
  isBusinessStatus,
  isLifecycleArchiveFilter,
} from "@/lib/projects/status";
import { getPricingSummariesForProjects } from "@/lib/pricing/actions";
import { getQuoteSummariesForProjects } from "@/lib/quotes/actions";
import type {
  DashboardPipelineSummary,
  Project,
  ProjectActionState,
  ProjectListFilter,
  ProjectListItem,
} from "@/lib/projects/types";

export async function listProjects(
  options?: {
    filter?: ProjectListFilter;
    search?: string;
  },
  retried = false
): Promise<ProjectListItem[]> {
  const context = await getAuthOrgContext();
  if (!context) {
    return [];
  }

  const filter = options?.filter ?? "active";
  const search = options?.search?.trim().toLowerCase() ?? "";
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
    .order("created_at", { ascending: false });

  if (lifecycleAvailable) {
    query = query.is("deleted_at", null);

    if (filter === "active") {
      query = query.is("archived_at", null);
      if (businessStatusAvailable) {
        query = query.in("business_status", ACTIVE_PIPELINE_STATUSES);
      }
    } else if (isLifecycleArchiveFilter(filter)) {
      query = query.not("archived_at", "is", null);
    } else if (
      businessStatusAvailable &&
      filter !== "all" &&
      isBusinessStatus(filter)
    ) {
      query = query.eq("business_status", filter);
    }
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingLifecycleColumnsError(error) && !retried) {
      markLifecycleColumnsUnavailable();
      return listProjects(options, true);
    }

    if (isMissingBusinessStatusColumnsError(error) && !retried) {
      markBusinessStatusColumnsUnavailable();
      return listProjects(options, true);
    }

    if (isMissingClientEmailColumnError(error) && !retried) {
      markClientEmailColumnUnavailable();
      return listProjects(options, true);
    }

    console.error("[listProjects] query failed:", error.message);
    return [];
  }

  let projects = ((data ?? []) as unknown[]).map((row) =>
    withLifecycleDefaults(row as Record<string, unknown>)
  );

  if (!lifecycleAvailable || !businessStatusAvailable) {
    projects = applyProjectListFilter(
      projects,
      filter,
      lifecycleAvailable,
      businessStatusAvailable
    );
  }

  if (search) {
    projects = projects.filter((project) => {
      const haystack = [
        project.title,
        project.client_name,
        project.site_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }

  if (projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((project) => project.id);
  const { data: estimates, error: estimatesError } = await context.supabase
    .from("estimates")
    .select("project_id, is_stale")
    .in("project_id", projectIds);

  if (estimatesError) {
    console.error("[listProjects] estimates query failed:", estimatesError.message);
  }

  const estimateByProject = new Map(
    (estimates ?? []).map((estimate) => [
      estimate.project_id,
      { is_stale: estimate.is_stale ?? false },
    ])
  );

  const pricingByProject = await getPricingSummariesForProjects(projectIds);
  const quoteByProject = await getQuoteSummariesForProjects(projectIds);

  return projects.map((project) => {
    const estimate = estimateByProject.get(project.id);
    return {
      ...project,
      has_estimate: Boolean(estimate),
      estimate_is_stale: estimate?.is_stale ?? false,
      pricing_summary: pricingByProject.get(project.id) ?? null,
      quote_summary: quoteByProject.get(project.id) ?? null,
    };
  });
}

export async function getDashboardPipelineSummary(): Promise<DashboardPipelineSummary> {
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      activeCount: 0,
      estimatingPricingCount: 0,
      quoteDraftCount: 0,
      quotesSentCount: 0,
      wonCount: 0,
      lostCount: 0,
    };
  }

  const lifecycleAvailable = await hasLifecycleColumns(context.supabase);
  const businessStatusAvailable = lifecycleAvailable
    ? await hasBusinessStatusColumns(context.supabase)
    : false;

  if (!lifecycleAvailable || !businessStatusAvailable) {
    const projects = await listProjects({ filter: "active" });
    return {
      activeCount: projects.length,
      estimatingPricingCount: projects.filter(
        (project) =>
          project.business_status === "estimating" ||
          project.business_status === "estimate_ready"
      ).length,
      quoteDraftCount: projects.filter(
        (project) => project.business_status === "quote_draft"
      ).length,
      quotesSentCount: projects.filter(
        (project) => project.business_status === "quote_sent"
      ).length,
      wonCount: 0,
      lostCount: 0,
    };
  }

  const query = context.supabase
    .from("projects")
    .select("business_status, archived_at")
    .is("deleted_at", null);

  const { data, error } = await query;

  if (error) {
    console.error("[getDashboardPipelineSummary] query failed:", error.message);
    return {
      activeCount: 0,
      estimatingPricingCount: 0,
      quoteDraftCount: 0,
      quotesSentCount: 0,
      wonCount: 0,
      lostCount: 0,
    };
  }

  const rows = data ?? [];
  let activeCount = 0;
  let estimatingPricingCount = 0;
  let quoteDraftCount = 0;
  let quotesSentCount = 0;
  let wonCount = 0;
  let lostCount = 0;

  for (const row of rows) {
    const status = row.business_status as string;
    const isArchived = Boolean(row.archived_at);

    if (
      !isArchived &&
      ACTIVE_PIPELINE_STATUSES.includes(
        status as (typeof ACTIVE_PIPELINE_STATUSES)[number]
      )
    ) {
      activeCount += 1;
    }
    if (status === "estimating" || status === "estimate_ready") {
      estimatingPricingCount += 1;
    }
    if (status === "quote_draft") {
      quoteDraftCount += 1;
    }
    if (status === "quote_sent") {
      quotesSentCount += 1;
    }
    if (status === "won") {
      wonCount += 1;
    }
    if (status === "lost") {
      lostCount += 1;
    }
  }

  return {
    activeCount,
    estimatingPricingCount,
    quoteDraftCount,
    quotesSentCount,
    wonCount,
    lostCount,
  };
}

export async function getProject(projectId: string): Promise<Project> {
  const context = await getAuthOrgContext();
  if (!context) {
    notFound();
  }

  return getProjectWithContext(context, projectId);
}

export async function createProject(
  input: Parameters<typeof projectDetailsSchema.parse>[0]
): Promise<ProjectActionState> {
  const parsed = projectDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return {
      error:
        "Your company profile could not be loaded. Try signing out and back in.",
    };
  }

  const { supabase, user, orgId } = context;
  const denied = await permissionDeniedError({
    orgId,
    userId: user.id,
    permission: "projects.create",
    entitlement: "projects.create",
  });
  if (denied) return denied;
  const {
    title,
    client_name,
    client_email,
    site_address,
    brief_text,
    priority,
    due_date,
    notes,
  } = parsed.data;
  const clientEmailValue = client_email || null;
  const clientEmailAvailable = await hasClientEmailColumn(supabase);

  if (clientEmailValue && !clientEmailAvailable) {
    return { error: clientEmailMigrationRequiredMessage() };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: orgId,
      created_by: user.id,
      title,
      client_name: client_name || null,
      ...(clientEmailAvailable ? { client_email: clientEmailValue } : {}),
      site_address: site_address || null,
      brief_text: brief_text || null,
      priority,
      due_date: due_date || null,
      notes: notes || null,
      stage: "brief",
      quality_level: "unknown",
      status: "draft",
      business_status: "lead",
    })
    .select("id")
    .single();

  if (error || !project) {
    if (isMissingBusinessStatusColumnsError(error)) {
      const { data: fallbackProject, error: fallbackError } = await supabase
        .from("projects")
        .insert({
          org_id: orgId,
          created_by: user.id,
          title,
          client_name: client_name || null,
          ...(clientEmailAvailable ? { client_email: clientEmailValue } : {}),
          site_address: site_address || null,
          brief_text: brief_text || null,
          priority,
          due_date: due_date || null,
          notes: notes || null,
          stage: "brief",
          quality_level: "unknown",
          status: "draft",
        })
        .select("id")
        .single();

      if (fallbackError || !fallbackProject) {
        console.error("[createProject] insert failed:", fallbackError?.message);
        return {
          error: toUserError(
            fallbackError,
            "createProject",
            USER_ERRORS.projectSaveFailed
          ),
        };
      }

      revalidatePath("/app/dashboard");
      redirect(`/app/projects/${fallbackProject.id}`);
    }

    console.error("[createProject] insert failed:", error?.message);
    return {
      error: toUserError(error, "createProject", USER_ERRORS.projectSaveFailed),
    };
  }

  revalidatePath("/app/dashboard");
  redirect(`/app/projects/${project.id}`);
}

export async function updateProject(
  projectId: string,
  input: Parameters<typeof projectDetailsSchema.parse>[0]
): Promise<ProjectActionState> {
  const parsed = projectDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return {
      error:
        "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }

  const { supabase, orgId, user } = context;
  const editDenied = await permissionDeniedError({
    orgId,
    userId: user.id,
    permission: "projects.edit",
    entitlement: "projects.create",
  });
  if (editDenied) return editDenied;
  const lifecycleAvailable = await hasLifecycleColumns(supabase);
  const clientEmailAvailable = await hasClientEmailColumn(supabase);
  const {
    title,
    client_name,
    client_email,
    site_address,
    brief_text,
    priority,
    due_date,
    notes,
  } = parsed.data;
  const clientEmailValue = client_email || null;

  if (clientEmailValue && !clientEmailAvailable) {
    return { error: clientEmailMigrationRequiredMessage() };
  }

  let query = supabase
    .from("projects")
    .update({
      title,
      client_name: client_name || null,
      ...(clientEmailAvailable ? { client_email: clientEmailValue } : {}),
      site_address: site_address || null,
      brief_text: brief_text || null,
      priority,
      due_date: due_date || null,
      notes: notes || null,
    })
    .eq("id", projectId)
    .eq("org_id", orgId);

  if (lifecycleAvailable) {
    query = query.is("deleted_at", null);
  }

  const { error } = await query;

  if (error) {
    console.error("[updateProject] update failed:", error.message);
    return { error: toUserError(error, "updateProject", USER_ERRORS.projectSaveFailed) };
  }

  // Stage 3.1A-R1: Project client/site are authoritative before quote.
  // Keep draft/reviewed pricing snapshots aligned so Pricing UI does not stay stale.
  const nextClientName = client_name || null;
  const nextSiteAddress = site_address || null;
  await supabase
    .from("pricing_documents")
    .update({
      client_name: nextClientName,
      site_address: nextSiteAddress,
    })
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .in("status", ["draft", "reviewed"]);

  revalidatePath("/app/dashboard");
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}`, "layout");

  return { success: true };
}
