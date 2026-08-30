import "server-only";

import { cache } from "react";
import type { AssistantStage } from "@/components/assistant/types";
import {
  requireAuthOrgContext,
  type AuthOrgSuccess,
} from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";

export type LoadedProjectStage = {
  auth: AuthOrgSuccess;
  projectId: string;
  stage: AssistantStage;
};

async function loadProjectStageUncached(
  projectId: string
): Promise<LoadedProjectStage | { error: string }> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    return {
      error:
        auth.code === "organisation_required"
          ? auth.error
          : ("Not authenticated." as const),
    };
  }

  const owned = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in owned) {
    return { error: "Project not found." as const };
  }

  const { supabase, orgId } = auth;

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, stage")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !project) {
    return { error: "Project not found." as const };
  }

  return {
    auth,
    projectId: project.id,
    stage: project.stage as AssistantStage,
  };
}

/**
 * Request-scoped project stage + trusted auth.
 * Generate then Update-via-Generate in the same action share one stage read
 * when both occur before any stage-changing write.
 */
export const loadProjectStage = cache(loadProjectStageUncached);
