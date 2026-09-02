import "server-only";
import { getOrgBillingState } from "@/lib/billing/server";
import { resolveBillingEnforcementMode } from "@/lib/billing/enforcement-mode";
import {
  evaluateOrgEntitlement,
  type EntitlementDecision,
} from "@/lib/billing/entitlements";
import type {
  EntitlementReasonCode,
  UpgradeTarget,
} from "@/lib/billing/entitlement-reasons";
import { logBillingEvent } from "@/lib/billing/logging";
import { ENTITLEMENT_CAPABILITIES } from "@/lib/billing/capabilities";
import { resolveEffectiveAccessPolicy } from "@/lib/billing/access-policy";
import type { OrgBillingState, PlanCode } from "@/lib/billing/types";

export type { EntitlementDecision } from "@/lib/billing/entitlements";
export type { EntitlementCapability } from "@/lib/billing/capabilities";

export type OrgEntitlementSummary = {
  orgId: string;
  enforcementMode: "off" | "compatibility" | "strict";
  initialized: boolean;
  effectivePlan: PlanCode | null;
  billingStatus: string;
  accessClass: string;
  source: string;
  warning: "payment_past_due" | null;
  trialExpired: boolean;
  allowed: string[];
};

async function evaluateForOrg(
  orgId: string,
  capability: string
): Promise<EntitlementDecision> {
  const [state, mode] = await Promise.all([
    getOrgBillingState(orgId),
    Promise.resolve(resolveBillingEnforcementMode()),
  ]);
  return evaluateOrgEntitlement({ state, capability, mode });
}

/**
 * Central server enforcement. UI summaries are informational only.
 */
export async function requireOrgEntitlement(
  orgId: string,
  capability: string
): Promise<EntitlementDecision> {
  const decision = await evaluateForOrg(orgId, capability);
  if (!decision.ok) {
    logBillingEvent({
      orgId,
      result: "entitlement_denied",
      errorCode: decision.reasonCode,
    });
  }
  return decision;
}

export async function hasOrgEntitlement(
  orgId: string,
  capability: string
): Promise<boolean> {
  const decision = await evaluateForOrg(orgId, capability);
  return decision.ok;
}

export async function getOrgEntitlementSummary(
  orgId: string
): Promise<OrgEntitlementSummary> {
  const state: OrgBillingState = await getOrgBillingState(orgId);
  const mode = resolveBillingEnforcementMode();
  const policy = resolveEffectiveAccessPolicy({
    subscription: state.subscription,
    activeOverride: state.activeOverride,
  });
  const allowed = ENTITLEMENT_CAPABILITIES.filter(
    (capability) =>
      evaluateOrgEntitlement({ state, capability, mode }).ok
  );
  return {
    orgId,
    enforcementMode: mode,
    initialized: Boolean(state.subscription || state.activeOverride),
    effectivePlan: policy.planCode,
    billingStatus: policy.billingStatus,
    accessClass: policy.accessClass,
    source: policy.source,
    warning: policy.warning,
    trialExpired: policy.trialExpired,
    allowed: [...allowed],
  };
}

export type EntitlementDeniedPayload = {
  error: string;
  reasonCode: EntitlementReasonCode;
  upgradeTarget: UpgradeTarget;
};

export async function entitlementDeniedError(
  orgId: string,
  capability: string
): Promise<EntitlementDeniedPayload | null> {
  const decision = await requireOrgEntitlement(orgId, capability);
  if (decision.ok) return null;
  return {
    error: decision.message ?? "This action is not available.",
    reasonCode: decision.reasonCode ?? "upgrade_required",
    upgradeTarget: decision.upgradeTarget,
  };
}
