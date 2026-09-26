"use server";

import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import {
  LIFECYCLE_STAGES,
  type LifecycleStage,
} from "@/lib/projects/lifecycle-foundation";

const SAFE_ERROR = "That status change is not available.";

function isStage(value: string): value is LifecycleStage {
  return (LIFECYCLE_STAGES as readonly string[]).includes(value);
}

/**
 * Authenticated, organisation-scoped stage change.
 * The client supplies a project id and a target stage. Organisation, totals,
 * and the current stage are resolved on the server.
 */
export async function transitionProjectLifecycle(
  projectId: string,
  target: LifecycleStage
): Promise<
  { ok: true; idempotent: boolean } | { ok: false; error: string }
> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { ok: false, error: "You need to sign in." };
  }
  if (!projectId || !isStage(target)) {
    return { ok: false, error: SAFE_ERROR };
  }

  const owned = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in owned) {
    return { ok: false, error: "Project not found." };
  }

  const { data, error } = await context.supabase.rpc(
    "apply_project_lifecycle_transition",
    { p_project: owned.projectId, p_target: target }
  );

  if (error || !data || data.ok !== true) {
    return { ok: false, error: SAFE_ERROR };
  }

  return { ok: true, idempotent: data.idempotent === true };
}
