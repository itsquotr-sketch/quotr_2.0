import { deepFreeze } from "../immutability";
import { validateScopeDiscoverySuggestion } from "../validation";
import {
  PROVIDER_ERROR_CODES,
  ScopeDiscoveryProviderError,
  safeProviderFailureMessage,
} from "./errors";
import { mapOutputToSuggestions } from "./map-output-to-suggestions";
import {
  buildAllowedEvidenceRefs,
  normaliseProviderInput,
} from "./normalise-input";
import { runPrimaryTransport, runRepairTransport } from "./repair";
import type {
  ScopeDiscoveryProviderResult,
  ScopeDiscoveryTransport,
  TokenUsage,
} from "./types";
import { validateProviderOutputText } from "./validate-output";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "./version";
import type { ScopeDiscoverySuggestion } from "../types";

function sumUsage(a: TokenUsage | null, b: TokenUsage): TokenUsage {
  if (!a) return b;
  return {
    inputTokens:
      a.inputTokens == null && b.inputTokens == null
        ? null
        : (a.inputTokens ?? 0) + (b.inputTokens ?? 0),
    outputTokens:
      a.outputTokens == null && b.outputTokens == null
        ? null
        : (a.outputTokens ?? 0) + (b.outputTokens ?? 0),
  };
}

function failureResult(params: {
  readonly analysisRunId: string;
  readonly catalogueVersion: string;
  readonly contractVersion: string;
  readonly model: string;
  readonly repairAttempted: boolean;
  readonly latencyMs: number;
  readonly tokenUsage: TokenUsage | null;
  readonly code: (typeof PROVIDER_ERROR_CODES)[keyof typeof PROVIDER_ERROR_CODES];
  readonly validationErrors: readonly string[];
  readonly warnings?: readonly string[];
}): ScopeDiscoveryProviderResult {
  return deepFreeze({
    success: false,
    provider: "anthropic",
    model: params.model,
    promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
    contractVersion: params.contractVersion,
    catalogueVersion: params.catalogueVersion,
    analysisRunId: params.analysisRunId,
    contextualSuggestions: [],
    warnings: params.warnings ?? [],
    validationErrors: params.validationErrors,
    repairAttempted: params.repairAttempted,
    latencyMs: params.latencyMs,
    tokenUsage: params.tokenUsage,
    failureCode: params.code,
    failureMessage: safeProviderFailureMessage(params.code),
  });
}

/**
 * Run contextual AI scope discovery through an injected transport.
 * Never mutates application data. Never merges with deterministic suggestions.
 * Exactly one repair attempt for malformed/invalid structured output (OCD-ISD-15).
 */
export async function runScopeDiscoveryProvider(params: {
  readonly input: unknown;
  readonly transport: ScopeDiscoveryTransport;
  readonly model?: string;
}): Promise<ScopeDiscoveryProviderResult> {
  const started = Date.now();
  let repairAttempted = false;
  let tokenUsage: TokenUsage | null = null;
  let model = params.model ?? "unspecified";

  let normalised;
  try {
    normalised = normaliseProviderInput(params.input);
  } catch (error) {
    const code =
      error instanceof ScopeDiscoveryProviderError
        ? error.code
        : PROVIDER_ERROR_CODES.INPUT_VALIDATION_FAILED;
    const details =
      error instanceof ScopeDiscoveryProviderError ? error.details : [];
    return failureResult({
      analysisRunId:
        params.input &&
        typeof params.input === "object" &&
        "analysisRunId" in params.input &&
        typeof (params.input as { analysisRunId?: unknown }).analysisRunId ===
          "string"
          ? ((params.input as { analysisRunId: string }).analysisRunId)
          : "00000000-0000-4000-8000-000000000099",
      catalogueVersion:
        params.input &&
        typeof params.input === "object" &&
        "catalogueVersion" in params.input &&
        typeof (params.input as { catalogueVersion?: unknown })
          .catalogueVersion === "string"
          ? (params.input as { catalogueVersion: string }).catalogueVersion
          : "unknown",
      contractVersion:
        params.input &&
        typeof params.input === "object" &&
        "contractVersion" in params.input &&
        typeof (params.input as { contractVersion?: unknown })
          .contractVersion === "string"
          ? (params.input as { contractVersion: string }).contractVersion
          : "unknown",
      model,
      repairAttempted: false,
      latencyMs: Date.now() - started,
      tokenUsage: null,
      code,
      validationErrors: details,
    });
  }

  const allowedEvidenceRefs = buildAllowedEvidenceRefs(normalised);

  let primaryText: string;
  try {
    const primary = await runPrimaryTransport({
      transport: params.transport,
      input: normalised,
      allowedEvidenceRefs,
      model,
    });
    model = primary.model || model;
    tokenUsage = sumUsage(tokenUsage, primary.tokenUsage);
    primaryText = primary.text;
  } catch (error) {
    const code =
      error instanceof ScopeDiscoveryProviderError
        ? error.code
        : PROVIDER_ERROR_CODES.TRANSPORT_FAILED;
    return failureResult({
      analysisRunId: normalised.analysisRunId,
      catalogueVersion: normalised.catalogueVersion,
      contractVersion: normalised.contractVersion,
      model,
      repairAttempted: false,
      latencyMs: Date.now() - started,
      tokenUsage,
      code,
      validationErrors:
        error instanceof ScopeDiscoveryProviderError ? error.details : [],
    });
  }

  let validated = validateProviderOutputText({
    text: primaryText,
    input: normalised,
    allowedEvidenceRefs,
  });

  if (!validated.ok) {
    repairAttempted = true;
    let repairText: string;
    try {
      const repair = await runRepairTransport({
        transport: params.transport,
        model,
        malformedText: primaryText,
        validationErrors: validated.errors,
      });
      model = repair.model || model;
      tokenUsage = sumUsage(tokenUsage, repair.tokenUsage);
      repairText = repair.text;
    } catch {
      return failureResult({
        analysisRunId: normalised.analysisRunId,
        catalogueVersion: normalised.catalogueVersion,
        contractVersion: normalised.contractVersion,
        model,
        repairAttempted: true,
        latencyMs: Date.now() - started,
        tokenUsage,
        code: PROVIDER_ERROR_CODES.REPAIR_FAILED,
        validationErrors: validated.errors,
      });
    }

    validated = validateProviderOutputText({
      text: repairText,
      input: normalised,
      allowedEvidenceRefs,
    });

    if (!validated.ok) {
      return failureResult({
        analysisRunId: normalised.analysisRunId,
        catalogueVersion: normalised.catalogueVersion,
        contractVersion: normalised.contractVersion,
        model,
        repairAttempted: true,
        latencyMs: Date.now() - started,
        tokenUsage,
        code: PROVIDER_ERROR_CODES.REPAIR_FAILED,
        validationErrors: validated.errors,
      });
    }
  }

  const mapped = mapOutputToSuggestions({
    output: validated.output,
    input: normalised,
    model,
  });

  const contractErrors: string[] = [];
  const accepted: ScopeDiscoverySuggestion[] = [];
  for (const suggestion of mapped) {
    const check = validateScopeDiscoverySuggestion(suggestion);
    if (!check.ok || !check.suggestion) {
      contractErrors.push(
        ...check.issues.map(
          (i) => `${suggestion.rationaleKey}: ${i.path} ${i.message}`
        )
      );
      continue;
    }
    accepted.push(check.suggestion);
  }

  if (accepted.length === 0 && mapped.length > 0) {
    return failureResult({
      analysisRunId: normalised.analysisRunId,
      catalogueVersion: normalised.catalogueVersion,
      contractVersion: normalised.contractVersion,
      model,
      repairAttempted,
      latencyMs: Date.now() - started,
      tokenUsage,
      code: PROVIDER_ERROR_CODES.OUTPUT_VALIDATION_FAILED,
      validationErrors: contractErrors,
      warnings: validated.warnings,
    });
  }

  return deepFreeze({
    success: true,
    provider: "anthropic",
    model,
    promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
    contractVersion: normalised.contractVersion,
    catalogueVersion: normalised.catalogueVersion,
    analysisRunId: normalised.analysisRunId,
    contextualSuggestions: accepted,
    warnings: [...validated.warnings, ...validated.output.warnings, ...contractErrors],
    validationErrors: [],
    repairAttempted,
    latencyMs: Date.now() - started,
    tokenUsage,
    failureCode: null,
    failureMessage: null,
  });
}
