"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/assistant/state";
import {
  hasBusinessStatusColumns,
  isMissingBusinessStatusColumnsError,
  markBusinessStatusColumnsUnavailable,
} from "@/lib/projects/query-utils";
import { isBusinessStatus } from "@/lib/projects/status";
import type {
  ProjectActionState,
  UpdateProjectBusinessStatusInput,
} from "@/lib/projects/types";

export async function updateProjectBusinessStatus(
  input: UpdateProjectBusinessStatusInput
): Promise<ProjectActionState> {
  const { projectId, businessStatus, lostReason } = input;

  if (!isBusinessStatus(businessStatus)) {
    return { error: "Invalid project status." };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return {
      error:
        "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }

  const businessStatusAvailable = await hasBusinessStatusColumns(
    context.supabase
  );
  if (!businessStatusAvailable) {
    return {
      error:
        "Project business status requires a database update. Please run migration 010_business_status.sql.",
    };
  }

  const { supabase, orgId } = context;

  const { data: project, error: loadError } = await supabase
    .from("projects")
    .select("id, business_status, deleted_at")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (loadError) {
    if (isMissingBusinessStatusColumnsError(loadError)) {
      markBusinessStatusColumnsUnavailable();
      return {
        error:
          "Project business status requires a database update. Please run migration 010_business_status.sql.",
      };
    }
    return { error: "Project not found." };
  }

  if (!project || project.deleted_at) {
    return { error: "Project not found." };
  }

  const now = new Date().toISOString();
  const update: Record<string, string | null> = {
    business_status: businessStatus,
    status_updated_at: now,
  };

  if (businessStatus === "won") {
    update.won_at = now;
    update.lost_at = null;
    update.lost_reason = null;
  } else if (businessStatus === "lost") {
    update.lost_at = now;
    update.won_at = null;
    if (lostReason?.trim()) {
      update.lost_reason = lostReason.trim();
    }
  } else {
    if (project.business_status === "won") {
      update.won_at = null;
    }
    if (project.business_status === "lost") {
      update.lost_at = null;
      update.lost_reason = null;
    }
  }

  const { error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", projectId)
    .eq("org_id", orgId)
    .is("deleted_at", null);

  if (error) {
    if (isMissingBusinessStatusColumnsError(error)) {
      markBusinessStatusColumnsUnavailable();
      return {
        error:
          "Project business status requires a database update. Please run migration 010_business_status.sql.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/app/dashboard");
  revalidatePath(`/app/projects/${projectId}`);

  return { success: true };
}
