"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { projectDetailsSchema } from "@/lib/projects/schema";
import {
  applyProjectListFilter,
  hasBusinessStatusColumns,
  hasLifecycleColumns,
  isMissingBusinessStatusColumnsError,
  isMissingLifecycleColumnsError,
  markBusinessStatusColumnsUnavailable,
  markLifecycleColumnsUnavailable,
  PROJECT_SELECT,
  PROJECT_SELECT_BASE,
  PROJECT_SELECT_WITHOUT_BUSINESS_STATUS,
  withLifecycleDefaults,
} from "@/lib/projects/query-utils";
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

function getProjectSelect(
  lifecycleAvailable: boolean,
  businessStatusAvailable: boolean
): string {
  if (!lifecycleAvailable) {
    return PROJECT_SELECT_BASE;
  }

  return businessStatusAvailable
    ? PROJECT_SELECT
    : PROJECT_SELECT_WITHOUT_BUSINESS_STATUS;
}

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

  let query = context.supabase
    .from("projects")
    .select(
      getProjectSelect(lifecycleAvailable, businessStatusAvailable)
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

export async function getProject(
  projectId: string,
  retried = false
): Promise<Project> {
  const context = await getAuthOrgContext();
  if (!context) {
    notFound();
  }

  const lifecycleAvailable = await hasLifecycleColumns(context.supabase);
  const businessStatusAvailable = lifecycleAvailable
    ? await hasBusinessStatusColumns(context.supabase)
    : false;

  let query = context.supabase
    .from("projects")
    .select(
      getProjectSelect(lifecycleAvailable, businessStatusAvailable)
    )
    .eq("id", projectId);

  if (lifecycleAvailable) {
    query = query.is("deleted_at", null);
  }

  const { data: project, error } = await query.maybeSingle();

  if (error) {
    if (isMissingLifecycleColumnsError(error) && !retried) {
      markLifecycleColumnsUnavailable();
      return getProject(projectId, true);
    }

    if (isMissingBusinessStatusColumnsError(error) && !retried) {
      markBusinessStatusColumnsUnavailable();
      return getProject(projectId, true);
    }

    console.error("[getProject] query failed:", error.message);
    notFound();
  }

  if (!project) {
    notFound();
  }

  const mapped = withLifecycleDefaults(project as unknown as Record<string, unknown>);

  if (lifecycleAvailable && mapped.deleted_at) {
    notFound();
  }

  return mapped;
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
        "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }

  const { supabase, user, orgId } = context;
  const {
    title,
    client_name,
    site_address,
    brief_text,
    priority,
    due_date,
    notes,
  } = parsed.data;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: orgId,
      created_by: user.id,
      title,
      client_name: client_name || null,
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
        return { error: fallbackError?.message ?? "Failed to create project." };
      }

      revalidatePath("/app/dashboard");
      redirect(`/app/projects/${fallbackProject.id}`);
    }

    console.error("[createProject] insert failed:", error?.message);
    return { error: error?.message ?? "Failed to create project." };
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

  const { supabase, orgId } = context;
  const lifecycleAvailable = await hasLifecycleColumns(supabase);
  const {
    title,
    client_name,
    site_address,
    brief_text,
    priority,
    due_date,
    notes,
  } = parsed.data;

  let query = supabase
    .from("projects")
    .update({
      title,
      client_name: client_name || null,
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
    return { error: error.message };
  }

  revalidatePath("/app/dashboard");
  revalidatePath(`/app/projects/${projectId}`);

  return { success: true };
}
