/**
 * Stage 3.1B.3 — Structured AI scope discovery provider.
 *
 * Provider-isolated, persistence-free, unused by production Analyse Job.
 * Anthropic live transport lives in ./anthropic-provider (server-only) and is
 * not re-exported here so automated verification stays key-free.
 */

export {
  SCOPE_DISCOVERY_PROMPT_VERSION,
  SCOPE_DISCOVERY_PROVIDER_NAME,
} from "./version";

export {
  PROVIDER_ERROR_CODES,
  ScopeDiscoveryProviderError,
  safeProviderFailureMessage,
  type ProviderErrorCode,
} from "./errors";

export {
  ANTHROPIC_API_KEY_ENV,
  assertAnthropicApiKeyConfigured,
  hasAnthropicApiKey,
} from "./configuration";

export type {
  AllowedEvidenceCatalog,
  DeterministicConflictRef,
  DeterministicSuppressionRef,
  ProviderFactRef,
  ProviderConstraintRef,
  ProviderRawCandidate,
  ProviderRawOutput,
  ProviderSiteNote,
  ProviderWorkAreaRef,
  ScopeDiscoveryProviderInput,
  ScopeDiscoveryProviderResult,
  ScopeDiscoveryTransport,
  ScopeDiscoveryTransportRequest,
  ScopeDiscoveryTransportResponse,
  TokenUsage,
} from "./types";

export { PROVIDER_INPUT_LIMITS } from "./types";

export {
  normaliseProviderInput,
  buildAllowedEvidenceRefs,
} from "./normalise-input";

export {
  SCOPE_DISCOVERY_SYSTEM_PROMPT,
  buildScopeDiscoveryUserPrompt,
  buildRepairUserPrompt,
  promptGovernanceMarkers,
} from "./prompt";

export { providerOutputSchema, providerCandidateSchema } from "./schema";

export {
  validateProviderOutputText,
  validateProviderOutputObject,
} from "./validate-output";

export { mapOutputToSuggestions } from "./map-output-to-suggestions";

export { runPrimaryTransport, runRepairTransport } from "./repair";

export { runScopeDiscoveryProvider } from "./run";
