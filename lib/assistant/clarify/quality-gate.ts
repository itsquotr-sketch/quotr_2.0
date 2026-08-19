/**
 * RECOVERY-4-R2 — Quality / Estimate now must not require the retired
 * Specification → Scope Details → Project Conditions sequence.
 *
 * Job Plan + Clarify are the primary planning surfaces. Legacy Scope Discovery
 * review completion is not a quality or Estimate now prerequisite.
 */

import { CLARIFY_IS_PRIMARY } from "@/lib/assistant/clarify/flags";
import { JOB_PLAN_IS_PRIMARY } from "@/lib/assistant/job-plan/flags";
import { isScopeDiscoveryEnabled } from "@/lib/scope-discovery/configuration";

export const LEGACY_SCOPE_BEFORE_SPEC_ERROR =
  "Confirm the scope items above before selecting the specification level.";

/** Safe finish default when the builder has not chosen a specification. */
export const DEFAULT_ESTIMATE_QUALITY = "standard" as const;

/**
 * True only for the retired primary flow where Scope Review unlocked
 * Specification. False when Job Plan / Clarify owns planning.
 */
export function legacyQualityRequiresScopeReview(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  if (JOB_PLAN_IS_PRIMARY || CLARIFY_IS_PRIMARY) return false;
  return isScopeDiscoveryEnabled(env);
}
