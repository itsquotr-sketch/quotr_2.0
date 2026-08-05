import {
  buildRepairUserPrompt,
  buildScopeDiscoveryUserPrompt,
  SCOPE_DISCOVERY_SYSTEM_PROMPT,
} from "./prompt";
import type {
  ScopeDiscoveryProviderInput,
  ScopeDiscoveryTransport,
  ScopeDiscoveryTransportResponse,
} from "./types";

export async function runPrimaryTransport(params: {
  readonly transport: ScopeDiscoveryTransport;
  readonly input: ScopeDiscoveryProviderInput;
  readonly allowedEvidenceRefs: ReadonlySet<string>;
  readonly model: string;
}): Promise<ScopeDiscoveryTransportResponse> {
  const userPrompt = buildScopeDiscoveryUserPrompt(
    params.input,
    params.allowedEvidenceRefs
  );
  return params.transport({
    systemPrompt: SCOPE_DISCOVERY_SYSTEM_PROMPT,
    userPrompt,
    model: params.model,
    maxTokens: 4096,
    temperature: 0,
    isRepair: false,
  });
}

/**
 * Exactly one repair attempt for malformed / invalid structured output.
 * Does not change source input, expand the task, or switch models.
 */
export async function runRepairTransport(params: {
  readonly transport: ScopeDiscoveryTransport;
  readonly model: string;
  readonly malformedText: string;
  readonly validationErrors: readonly string[];
}): Promise<ScopeDiscoveryTransportResponse> {
  return params.transport({
    systemPrompt: SCOPE_DISCOVERY_SYSTEM_PROMPT,
    userPrompt: buildRepairUserPrompt({
      malformedText: params.malformedText,
      validationErrors: params.validationErrors,
    }),
    model: params.model,
    maxTokens: 4096,
    temperature: 0,
    isRepair: true,
  });
}
