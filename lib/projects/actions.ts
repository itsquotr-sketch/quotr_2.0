"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { toUserError, USER_ERRORS } from "@/lib/errors/user-message";
import { permissionDeniedError } from "@/lib/team/permission-server";
import { createProjectInputSchema, updateProjectDetailsSchema } from "@/lib/projects/schema";
import { projectSnapshotFromCustomer } from "@/lib/customers/snapshot";
import {
  applyProjectListFilter,
  clientEmailMigrationRequiredMessage,
  getProjectSelect,
  hasClientEmailColumn,
  hasCustomerIdColumn,
  hasLifecycleColumns,
  isMissingBusinessStatusColumnsError,
  isMissingClientEmailColumnError,
  isMissingCustomerIdColumnError,
  isMissingLifecycleColumnsError,
  markBusinessStatusColumnsUnavailable,
  markClientEmailColumnUnavailable,
  markCustomerIdColumnUnavailable,
  markLifecycleColumnsUnavailable,
  probeProjectSchemaColumns,
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

  const filter = options?.filter ?? "all";
  const search = options?.search?.trim().toLowerCase() ?? "";
  const {
    lifecycleAvailable,
    businessStatusAvailable,
    clientEmailAvailable,
    customerIdAvailable,
  } = await probeProjectSchemaColumns(context.supabase);

  let query = context.supabase
    .from("projects")
    .select(
      getProjectSelect(
        lifecycleAvailable,
        businessStatusAvailable,
        clientEmailAvailable,
        customerIdAvailable
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
      if (filter === "quote_sent") {
        query = query.is("archived_at", null);
      }
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

    if (isMissingCustomerIdColumnError(error) && !retried) {
      markCustomerIdColumnUnavailable();
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
  const [estimatesResult, pricingByProject, quoteByProject] = await Promise.all([
    context.supabase
      .from("estimates")
      .select("project_id, is_stale")
      .in("project_id", projectIds),
    getPricingSummariesForProjects(projectIds),
    getQuoteSummariesForProjects(projectIds),
  ]);

  if (estimatesResult.error) {
    console.error("[listProjects] estimates query failed:", estimatesResult.error.message);
  }

  const estimateByProject = new Map(
    (estimatesResult.data ?? []).map((estimate) => [
      estimate.project_id,
      { is_stale: estimate.is_stale ?? false },
    ])
  );

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

/**
 * Existence authority for the first-job empty state.
 * Counts non-deleted projects regardless of commercial status.
 */
export async function organisationHasProjects(): Promise<boolean> {
  const context = await getAuthOrgContext();
  if (!context) {
    return false;
  }

  const lifecycleAvailable = await hasLifecycleColumns(context.supabase);
  let query = context.supabase
    .from("projects")
    .select("id", { count: "exact", head: true });

  if (lifecycleAvailable) {
    query = query.is("deleted_at", null);
  }

  const { count, error } = await query;
  if (error) {
    console.error("[organisationHasProjects] query failed:", error.message);
    return false;
  }

  return (count ?? 0) > 0;
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

  const {
    lifecycleAvailable,
    businessStatusAvailable,
  } = await probeProjectSchemaColumns(context.supabase);

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
  input: Parameters<typeof createProjectInputSchema.parse>[0]
): Promise<ProjectActionState> {
  const parsed = createProjectInputSchema.safeParse(input);

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
    site_address,
    brief_text,
    priority,
    due_date,
    notes,
    customer_mode,
    customer_id,
    customer_phone,
    creation_request_id,
  } = parsed.data;
  const clientEmailAvailable = await hasClientEmailColumn(supabase);
  const customerIdAvailable = await hasCustomerIdColumn(supabase);

  if (customer_mode === "new") {
    const customerName = parsed.data.client_name?.trim() ?? "";
    const customerEmail = parsed.data.client_email?.trim() || null;
    if (customerEmail && !clientEmailAvailable) {
      return { error: clientEmailMigrationRequiredMessage() };
    }
    if (!customerIdAvailable) {
      return { error: "Customers require a database update. Apply migration 083 first." };
    }
    const { data: projectId, error: rpcError } = await supabase.rpc(
      "create_project_with_new_customer",
      {
        p_title: title,
        p_customer_name: customerName,
        p_customer_email: customerEmail,
        p_customer_phone: customer_phone?.trim() || null,
        p_site_address: site_address?.trim() || null,
        p_creation_request_id: creation_request_id,
      }
    );
    if (rpcError || !projectId) {
      console.error("[createProject] customer transaction failed:", rpcError?.message);
      return {
        error: toUserError(rpcError, "createProject", USER_ERRORS.projectSaveFailed),
      };
    }
    revalidatePath("/app/dashboard");
    revalidatePath("/app/customers");
    revalidatePath("/app/contacts");
    return { projectId };
  }

  let snapshotName: string | null = null;
  let snapshotEmail: string | null = null;
  let snapshotCustomerId: string | null = null;

  if (customer_mode === "existing") {
    if (!customerIdAvailable) {
      return { error: "Customers require a database update. Apply migration 083 first." };
    }
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name, email, archived_at")
      .eq("id", customer_id ?? "")
      .eq("org_id", orgId)
      .maybeSingle();
    if (customerError || !customer) {
      return { error: "That customer could not be found." };
    }
    if (customer.archived_at) {
      return {
        error: "That customer is archived. Restore them before starting a job.",
      };
    }
    const snapshot = projectSnapshotFromCustomer(customer);
    snapshotName = snapshot.client_name;
    snapshotEmail = snapshot.client_email;
    snapshotCustomerId = customer.id;
  }

  if (snapshotEmail && !clientEmailAvailable) {
    return { error: clientEmailMigrationRequiredMessage() };
  }

  if (
    customerIdAvailable &&
    creation_request_id
  ) {
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("org_id", orgId)
      .eq("creation_request_id", creation_request_id)
      .maybeSingle();
    if (existing?.id) {
      revalidatePath("/app/dashboard");
      return { projectId: existing.id };
    }
  }

  const insertRow = {
    org_id: orgId,
    created_by: user.id,
    title,
    client_name: snapshotName,
    ...(clientEmailAvailable ? { client_email: snapshotEmail } : {}),
    ...(customerIdAvailable
      ? {
          customer_id: snapshotCustomerId,
          ...(creation_request_id
            ? { creation_request_id }
            : {}),
        }
      : {}),
    site_address: site_address || null,
    brief_text: brief_text || null,
    priority,
    due_date: due_date || null,
    notes: notes || null,
    stage: "brief" as const,
    quality_level: "unknown" as const,
    status: "draft" as const,
    business_status: "lead" as const,
  };

  const { data: project, error } = await supabase
    .from("projects")
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !project) {
    if (error?.code === "23505" && creation_request_id && customerIdAvailable) {
      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("org_id", orgId)
        .eq("creation_request_id", creation_request_id)
        .maybeSingle();
      if (existing?.id) {
        revalidatePath("/app/dashboard");
        return { projectId: existing.id };
      }
    }

    if (isMissingBusinessStatusColumnsError(error)) {
      const { business_status: omittedStatus, ...fallbackRow } = insertRow;
      void omittedStatus;
      const { data: fallbackProject, error: fallbackError } = await supabase
        .from("projects")
        .insert(fallbackRow)
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
      return { projectId: fallbackProject.id };
    }

    console.error("[createProject] insert failed:", error?.message);
    return {
      error: toUserError(error, "createProject", USER_ERRORS.projectSaveFailed),
    };
  }

  revalidatePath("/app/dashboard");
  return { projectId: project.id };
}

export async function updateProject(
  projectId: string,
  input: Parameters<typeof updateProjectDetailsSchema.parse>[0]
): Promise<ProjectActionState> {
  const parsed = updateProjectDetailsSchema.safeParse(input);

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
  const customerIdAvailable = await hasCustomerIdColumn(supabase);
  const {
    title,
    client_name,
    client_email,
    site_address,
    brief_text,
    priority,
    due_date,
    notes,
    customer_id,
  } = parsed.data;
  const clientEmailValue = client_email || null;

  if (clientEmailValue && !clientEmailAvailable) {
    return { error: clientEmailMigrationRequiredMessage() };
  }

  if (customer_id && customerIdAvailable) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, archived_at")
      .eq("id", customer_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (customerError || !customer) {
      return { error: "That customer could not be found." };
    }
    if (customer.archived_at) {
      const { data: current } = await supabase
        .from("projects")
        .select("customer_id")
        .eq("id", projectId)
        .eq("org_id", orgId)
        .maybeSingle();
      if (current?.customer_id !== customer_id) {
        return {
          error: "That customer is archived. Restore them before linking a project.",
        };
      }
    }
  }

  let query = supabase
    .from("projects")
    .update({
      title,
      client_name: client_name || null,
      ...(clientEmailAvailable ? { client_email: clientEmailValue } : {}),
      ...(customerIdAvailable && customer_id !== undefined
        ? { customer_id: customer_id }
        : {}),
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

/** Persist the job description only. Does not analyse or change stage. */
export async function saveJobDescription(
  projectId: string,
  briefText: string
): Promise<ProjectActionState> {
  const trimmed = briefText.trim();
  if (trimmed.length > 5000) {
    return { fieldErrors: { brief_text: ["Brief must be 5000 characters or less"] } };
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
  let query = supabase
    .from("projects")
    .update({ brief_text: trimmed || null })
    .eq("id", projectId)
    .eq("org_id", orgId);
  if (lifecycleAvailable) query = query.is("deleted_at", null);

  const { error } = await query;
  if (error) {
    return { error: toUserError(error, "saveJobDescription", USER_ERRORS.projectSaveFailed) };
  }

  revalidatePath(`/app/projects/${projectId}`);
  return { success: true };
}
