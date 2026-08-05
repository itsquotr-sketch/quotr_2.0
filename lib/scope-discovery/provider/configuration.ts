/**
 * Pure Anthropic configuration checks for scope discovery.
 * No SDK import — safe for automated verification without live keys.
 */

import {
  PROVIDER_ERROR_CODES,
  ScopeDiscoveryProviderError,
} from "./errors";

/** Exact Quotr env var name — do not introduce a second key name. */
export const ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY" as const;

export function hasAnthropicApiKey(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return Boolean(env[ANTHROPIC_API_KEY_ENV]);
}

/**
 * Throws controlled PROVIDER_CONFIGURATION_MISSING when the key is absent.
 * Does not reveal key contents or log secrets.
 */
export function assertAnthropicApiKeyConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env
): void {
  if (!hasAnthropicApiKey(env)) {
    throw new ScopeDiscoveryProviderError(
      PROVIDER_ERROR_CODES.PROVIDER_CONFIGURATION_MISSING,
      "Scope discovery provider is not configured."
    );
  }
}
