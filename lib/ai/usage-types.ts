export type AiUsageFeature =
  | "analyse_job"
  | "analyse_notes"
  | "scope_discovery";

export type AiUsageTokenFields = {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
};

export type AiProviderInvocation = {
  feature: AiUsageFeature;
  provider: "anthropic";
  model: string;
  latencyMs: number;
  attemptCount: number;
  success: boolean;
  errorClass: string | null;
  usage: AiUsageTokenFields;
};

export function emptyTokenFields(): AiUsageTokenFields {
  return {
    inputTokens: null,
    outputTokens: null,
    cacheCreationInputTokens: null,
    cacheReadInputTokens: null,
  };
}

export function tokensFromAnthropicUsage(usage: unknown): AiUsageTokenFields {
  if (usage == null || typeof usage !== "object") {
    return emptyTokenFields();
  }
  const record = usage as Record<string, unknown>;
  const num = (key: string): number | null => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  return {
    inputTokens: num("input_tokens"),
    outputTokens: num("output_tokens"),
    cacheCreationInputTokens: num("cache_creation_input_tokens"),
    cacheReadInputTokens: num("cache_read_input_tokens"),
  };
}

export function mergeInvocations(
  feature: AiUsageFeature,
  first: AiProviderInvocation,
  second: AiProviderInvocation | null
): AiProviderInvocation {
  if (!second) return { ...first, feature };
  return {
    feature,
    provider: "anthropic",
    model: second.model || first.model,
    latencyMs: first.latencyMs + second.latencyMs,
    attemptCount: first.attemptCount + second.attemptCount,
    success: second.success,
    errorClass: second.success ? null : second.errorClass ?? first.errorClass,
    usage: sumTokenFields(first.usage, second.usage),
  };
}

export function sumTokenFields(
  a: AiUsageTokenFields,
  b: AiUsageTokenFields
): AiUsageTokenFields {
  const add = (x: number | null, y: number | null): number | null => {
    if (x == null && y == null) return null;
    return (x ?? 0) + (y ?? 0);
  };
  return {
    inputTokens: add(a.inputTokens, b.inputTokens),
    outputTokens: add(a.outputTokens, b.outputTokens),
    cacheCreationInputTokens: add(
      a.cacheCreationInputTokens,
      b.cacheCreationInputTokens
    ),
    cacheReadInputTokens: add(a.cacheReadInputTokens, b.cacheReadInputTokens),
  };
}

/** Fields persisted for billing observability. Never include prompt/brief/completion. */
export const AI_USAGE_PERSISTED_COLUMNS = [
  "org_id",
  "project_id",
  "feature",
  "provider",
  "model",
  "input_tokens",
  "output_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
  "latency_ms",
  "attempt_count",
  "success",
  "error_class",
  "created_at",
] as const;

export function getAttachedInvocation(
  error: unknown
): AiProviderInvocation | null {
  if (error != null && typeof error === "object" && "invocation" in error) {
    const invocation = (error as { invocation?: AiProviderInvocation }).invocation;
    return invocation ?? null;
  }
  return null;
}

export const AI_USAGE_FORBIDDEN_COLUMNS = [
  "prompt",
  "brief",
  "completion",
  "response_text",
  "api_key",
  "notes",
] as const;
