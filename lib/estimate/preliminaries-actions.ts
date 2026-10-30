"use server";

import { revalidatePath } from "next/cache";
import { upsertScopedFact } from "@/lib/assistant/scope-persistence";
import { getAuthOrgContext } from "@/lib/assistant/state";
import {
  parsePreliminariesPlan,
  PRELIMINARIES_FACT_KEY,
} from "@/lib/estimate/preliminaries";
import { markEstimateStaleWithContext } from "@/lib/estimate/stale";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";

export async function savePreliminariesPlan(
  projectId: string,
  value: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getAuthOrgContext();
  if (!auth) return { ok: false, error: "Sign in required." };
  const owned = await assertOrgOwnsActiveProject(auth, projectId);
  if ("error" in owned) return { ok: false, error: owned.error };

  const plan = parsePreliminariesPlan(value);
  if (!plan) return { ok: false, error: "Preliminaries could not be saved." };

  const saved = await upsertScopedFact(auth.supabase, {
    orgId: auth.orgId,
    projectId,
    workAreaId: null,
    key: PRELIMINARIES_FACT_KEY,
    label: "Preliminaries",
    value: plan,
    source: "user",
  });
  if (!saved.ok) return { ok: false, error: saved.error };

  await markEstimateStaleWithContext(auth, projectId);
  revalidatePath(`/app/projects/${projectId}`);
  return { ok: true };
}
