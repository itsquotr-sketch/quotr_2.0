import {
  ENTITLEMENT_CAPABILITIES,
  TEAM_CAPABILITIES,
  type EntitlementCapability,
} from "@/lib/billing/capabilities";
import type { PlanCode } from "@/lib/billing/types";

const ALL = ENTITLEMENT_CAPABILITIES;

const BUILDER_ALLOW: ReadonlySet<EntitlementCapability> = new Set([
  "projects.create",
  "estimates.create",
  "pricing.access",
  "quotes.create",
  "quotes.send",
  "quotes.acceptance",
  "company_rates.basic",
  "calibration.basic",
  "analytics.personal",
  "voice_capture",
  "concept_visuals",
]);

const BUSINESS_EXTRA: ReadonlySet<EntitlementCapability> = new Set([
  "team.invite",
  "team.manage",
  "team.assign_projects",
  "team.roles",
  "company_rates.governed",
  "calibration.comprehensive",
  "analytics.business",
  "quotes.approval",
  "quotes.templates.multiple",
  "margin.guardrails",
  "audit.team",
]);

export const PLAN_CAPABILITY_MATRIX_VERSION = 1;

export function builderCapabilities(): readonly EntitlementCapability[] {
  return ALL.filter((key) => BUILDER_ALLOW.has(key));
}

export function businessCapabilities(): readonly EntitlementCapability[] {
  return ALL.filter(
    (key) => BUILDER_ALLOW.has(key) || BUSINESS_EXTRA.has(key)
  );
}

/**
 * Custom is resolver-controlled. Default catalogue is Business capabilities
 * with no self-service seat cap. Do not hard-code Business max 5 here.
 */
export function customDefaultCapabilities(): readonly EntitlementCapability[] {
  return businessCapabilities();
}

/**
 * No-card trial uses Business capability basis minus team invite/manage/roles.
 * Not a separate plan code.
 */
export function trialCapabilities(): readonly EntitlementCapability[] {
  const team = new Set<string>(TEAM_CAPABILITIES);
  return businessCapabilities().filter((key) => !team.has(key));
}

export function capabilitiesForPlan(
  plan: PlanCode
): readonly EntitlementCapability[] {
  if (plan === "builder") return builderCapabilities();
  if (plan === "custom") return customDefaultCapabilities();
  return businessCapabilities();
}

export function planAllowsCapability(
  plan: PlanCode,
  capability: EntitlementCapability
): boolean {
  return capabilitiesForPlan(plan).includes(capability);
}

export function trialAllowsCapability(
  capability: EntitlementCapability
): boolean {
  return trialCapabilities().includes(capability);
}
