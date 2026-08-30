import "server-only";

import { loadAssistantMutationResult } from "@/lib/assistant/load-assistant-mutation-result";
import type { AssistantActionState } from "@/lib/assistant/types";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";

/**
 * After all canonical mutation writes have finished, re-read persisted
 * Assistant fact state. Load failure after successful writes is recovery,
 * not a fabricated client projection.
 */
export async function completeAssistantMutation(
  auth: AuthOrgContext,
  projectId: string
): Promise<AssistantActionState> {
  const loaded = await loadAssistantMutationResult(auth, projectId);
  if ("error" in loaded) {
    return { success: true, recoveryRefresh: true };
  }
  return { success: true, assistantMutation: loaded };
}
