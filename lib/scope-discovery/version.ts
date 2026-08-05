export const SCOPE_DISCOVERY_CONTRACT_VERSION =
  "scope-discovery-suggestion/v1" as const;

/**
 * Bump SCOPE_DISCOVERY_CONTRACT_VERSION when any of the following change:
 * - field semantics on ScopeDiscoverySuggestion / evidence / decisions
 * - lifecycle allowed transitions
 * - deterministic identity composition
 * - evidence source semantics
 * - merge / dedupe / staleness semantics
 *
 * Do not use AI model names as the contract version.
 * Provider metadata remains separate (providerMetadata).
 */
