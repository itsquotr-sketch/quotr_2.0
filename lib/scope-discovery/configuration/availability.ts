/**
 * Controlled availability result for scope discovery.
 * Does not expose secret values or raw env contents.
 */

import { hasAnthropicApiKey } from "../provider/configuration";
import { isScopeDiscoveryEnabled } from "./feature-flags";

export type ScopeDiscoveryDisableReason =
  | "FEATURE_DISABLED"
  | "PROVIDER_NOT_CONFIGURED";

export interface ScopeDiscoveryAvailability {
  readonly featureEnabled: boolean;
  /** True when Anthropic key is present — never includes the key. */
  readonly providerConfigured: boolean;
  /**
   * Whether a contextual provider call may be attempted when the user
   * explicitly initiates discovery. False when feature off or key missing.
   */
  readonly providerMayRun: boolean;
  readonly disableReason: ScopeDiscoveryDisableReason | null;
}

export function getScopeDiscoveryAvailability(
  env: Readonly<Record<string, string | undefined>> = process.env
): ScopeDiscoveryAvailability {
  const featureEnabled = isScopeDiscoveryEnabled(env);
  const providerConfigured = hasAnthropicApiKey(env);

  if (!featureEnabled) {
    return {
      featureEnabled: false,
      providerConfigured,
      providerMayRun: false,
      disableReason: "FEATURE_DISABLED",
    };
  }

  return {
    featureEnabled: true,
    providerConfigured,
    providerMayRun: providerConfigured,
    disableReason: providerConfigured ? null : "PROVIDER_NOT_CONFIGURED",
  };
}
