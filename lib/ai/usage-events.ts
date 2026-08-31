import "server-only";

import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import type { AiProviderInvocation } from "@/lib/ai/usage-types";

/**
 * Persist one logical product AI invocation.
 * Never stores request text, response text, or keys.
 * Insert failure must not fail the user-facing mutation.
 */
export async function persistAiUsageEvent(
  auth: Pick<AuthOrgContext, "supabase" | "orgId">,
  projectId: string | null,
  invocation: AiProviderInvocation
): Promise<void> {
  try {
    const { error } = await auth.supabase.from("ai_usage_events").insert({
      org_id: auth.orgId,
      project_id: projectId,
      feature: invocation.feature,
      provider: invocation.provider,
      model: invocation.model,
      input_tokens: invocation.usage.inputTokens,
      output_tokens: invocation.usage.outputTokens,
      cache_creation_input_tokens: invocation.usage.cacheCreationInputTokens,
      cache_read_input_tokens: invocation.usage.cacheReadInputTokens,
      latency_ms: invocation.latencyMs,
      attempt_count: invocation.attemptCount,
      success: invocation.success,
      error_class: invocation.errorClass,
    });
    if (error && process.env.NODE_ENV === "development") {
      console.info("[ai-usage]", { persisted: false, reason: error.code });
    }
  } catch {
    // Observability must never block Analyse Job / Notes.
  }
}
