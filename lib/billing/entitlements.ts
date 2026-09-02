import {
  canonicalizeEntitlementCapability,
  isTeamCapability,
  isTransactionCompletionCapability,
  isValueProducingCapability,
  type EntitlementCapability,
} from "@/lib/billing/capabilities";
import {
  resolveEffectiveAccessPolicy,
  type AccessClass,
  type EffectiveAccessPolicy,
} from "@/lib/billing/access-policy";
import type { BillingEnforcementMode } from "@/lib/billing/enforcement-mode";
import {
  planAllowsCapability,
  trialAllowsCapability,
} from "@/lib/billing/entitlement-matrix";
import {
  denialReasonForAccessClass,
  entitlementDenialMessage,
  upgradeTargetForDenial,
  type EntitlementReasonCode,
  type UpgradeTarget,
} from "@/lib/billing/entitlement-reasons";
import type { OrgBillingOverride, OrgBillingState, PlanCode } from "@/lib/billing/types";

export type EntitlementDecision = {
  ok: boolean;
  capability: EntitlementCapability;
  effectivePlan: PlanCode | null;
  billingStatus: string;
  accessClass: AccessClass;
  source: EffectiveAccessPolicy["source"];
  reasonCode: EntitlementReasonCode | null;
  upgradeTarget: UpgradeTarget;
  message: string | null;
  /** Alias of message for existing Quote action call sites. */
  error?: string;
};

function overlayLists(override: OrgBillingOverride | null): {
  allow: Set<string>;
  deny: Set<string>;
} {
  return {
    allow: new Set(override?.capabilityAllow ?? []),
    deny: new Set(override?.capabilityDeny ?? []),
  };
}

function deny(
  decision: Omit<EntitlementDecision, "ok" | "error" | "upgradeTarget" | "message"> & {
    reasonCode: EntitlementReasonCode;
  }
): EntitlementDecision {
  const message = entitlementDenialMessage({
    capability: decision.capability,
    reasonCode: decision.reasonCode,
    trialTeamDenied:
      decision.reasonCode === "upgrade_required" &&
      isTeamCapability(decision.capability) &&
      decision.source === "internal_trial",
  });
  return {
    ...decision,
    ok: false,
    upgradeTarget: upgradeTargetForDenial({
      reasonCode: decision.reasonCode,
      capability: decision.capability,
    }),
    message,
    error: message,
  };
}

function allow(
  decision: Omit<EntitlementDecision, "ok" | "error" | "reasonCode" | "upgradeTarget" | "message">
): EntitlementDecision {
  return {
    ...decision,
    ok: true,
    reasonCode: null,
    upgradeTarget: null,
    message: null,
  };
}

function catalogueAllows(input: {
  policy: EffectiveAccessPolicy;
  capability: EntitlementCapability;
}): boolean {
  if (input.policy.source === "internal_trial" && !input.policy.trialExpired) {
    return trialAllowsCapability(input.capability);
  }
  if (!input.policy.planCode) {
    return false;
  }
  return planAllowsCapability(input.policy.planCode, input.capability);
}

/**
 * Pure entitlement evaluation. No I/O. No Stripe. Safe for tests.
 */
export function evaluateOrgEntitlement(input: {
  state: OrgBillingState;
  capability: string;
  mode: BillingEnforcementMode;
  now?: Date;
  memberCount?: number;
}): EntitlementDecision {
  const capability = canonicalizeEntitlementCapability(input.capability);
  if (!capability) {
    return deny({
      capability: "quotes.send",
      effectivePlan: null,
      billingStatus: "uninitialized",
      accessClass: "none",
      source: "none",
      reasonCode: "custom_restriction",
    });
  }

  const policy = resolveEffectiveAccessPolicy({
    subscription: input.state.subscription,
    activeOverride: input.state.activeOverride,
    now: input.now ?? new Date(),
  });
  const overlays = overlayLists(input.state.activeOverride);
  const base = {
    capability,
    effectivePlan: policy.planCode,
    billingStatus: policy.billingStatus,
    accessClass: policy.accessClass,
    source: policy.source,
  };

  if (input.mode === "off") {
    return allow(base);
  }

  const initialized = Boolean(
    input.state.subscription || input.state.activeOverride
  );

  if (!initialized) {
    if (input.mode === "compatibility") {
      return allow({
        ...base,
        billingStatus: "uninitialized",
        accessClass: "none",
        source: "none",
      });
    }
    if (isTransactionCompletionCapability(capability)) {
      return allow(base);
    }
    if (isValueProducingCapability(capability) || capability === "pricing.access") {
      return deny({
        ...base,
        reasonCode: "billing_uninitialized",
      });
    }
    return allow(base);
  }

  if (overlays.deny.has(capability)) {
    return deny({ ...base, reasonCode: "custom_restriction" });
  }

  if (isTransactionCompletionCapability(capability)) {
    return allow(base);
  }

  const producing = isValueProducingCapability(capability);
  const pricingCreateLike = capability === "pricing.access";
  const blockedByAccessClass =
    (producing || pricingCreateLike) &&
    policy.accessClass !== "full" &&
    policy.accessClass !== "full_with_billing_warning";

  if (blockedByAccessClass) {
    const reasonCode =
      denialReasonForAccessClass({
        trialExpired: policy.trialExpired,
        billingStatus: policy.billingStatus,
        withinPastDueGrace: policy.withinPastDueGrace,
      }) ?? "upgrade_required";
    return deny({ ...base, reasonCode });
  }

  if (overlays.allow.has(capability)) {
    return allow(base);
  }

  if (!catalogueAllows({ policy, capability })) {
    return deny({ ...base, reasonCode: "upgrade_required" });
  }

  if (capability === "team.invite" && input.memberCount != null) {
    const seats =
      input.state.activeOverride?.paidSeatQuantity ??
      input.state.subscription?.paidSeatQuantity ??
      null;
    if (
      seats != null &&
      input.memberCount >= seats &&
      policy.planCode !== "custom"
    ) {
      return deny({ ...base, reasonCode: "seat_limit" });
    }
  }

  return allow(base);
}

export function hasOrgEntitlementFromState(
  input: Parameters<typeof evaluateOrgEntitlement>[0]
): boolean {
  return evaluateOrgEntitlement(input).ok;
}
