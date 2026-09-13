import "server-only";

import type { AssistantMutationResultReuse } from "@/lib/assistant/assistant-mutation-result-reload";
import { loadAssistantMutationResult } from "@/lib/assistant/load-assistant-mutation-result";
import type { AssistantActionState } from "@/lib/assistant/types";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";

/**
 * After all canonical mutation writes have finished, re-read persisted
 * Assistant fact state. Load failure after successful writes is recovery,
 * not a fabricated client projection.
 *
 * PERFORMANCE-01C-4 — optional reuse is scalar Details only. Other callers
 * omit it so work_areas stay a fresh post-write select.
 */
export async function completeAssistantMutation(
  auth: AuthOrgContext,
  projectId: string,
  reuse?: AssistantMutationResultReuse | null
): Promise<AssistantActionState> {
  const loaded = await loadAssistantMutationResult(auth, projectId, reuse);
  if ("error" in loaded) {
    return { success: true, recoveryRefresh: true };
  }
  return { success: true, assistantMutation: loaded };
}
