/**
 * Canonical organisation capability keys (BILLING-2).
 * Product features may not exist yet; the registry is the authority.
 * Do not add keys for estimating accuracy.
 */

export const ENTITLEMENT_CAPABILITIES = [
  "projects.create",
  "estimates.create",
  "pricing.access",
  "quotes.create",
  "quotes.send",
  "quotes.acceptance",
  "company_rates.basic",
  "company_rates.governed",
  "calibration.basic",
  "calibration.comprehensive",
  "analytics.personal",
  "analytics.business",
  "team.invite",
  "team.manage",
  "team.assign_projects",
  "team.roles",
  "quotes.approval",
  "quotes.templates.multiple",
  "margin.guardrails",
  "audit.team",
  "voice_capture",
  "concept_visuals",
] as const;

export type EntitlementCapability = (typeof ENTITLEMENT_CAPABILITIES)[number];

/** Legacy BILLING-1 key. Canonicalize to quotes.approval. */
export const LEGACY_QUOTE_APPROVAL_ALIAS = "quote.approval" as const;

export const TEAM_CAPABILITIES = [
  "team.invite",
  "team.manage",
  "team.assign_projects",
  "team.roles",
] as const satisfies readonly EntitlementCapability[];

export const VALUE_PRODUCING_CAPABILITIES = [
  "projects.create",
  "estimates.create",
  "quotes.create",
  "quotes.send",
  "company_rates.governed",
  "calibration.comprehensive",
  "analytics.business",
  "team.invite",
  "team.manage",
  "team.assign_projects",
  "team.roles",
  "quotes.approval",
  "quotes.templates.multiple",
  "margin.guardrails",
  "audit.team",
  "voice_capture",
  "concept_visuals",
] as const satisfies readonly EntitlementCapability[];

/**
 * Completing an already-issued Quote (public client or contractor mark).
 * Not a new commercial origination. Not blocked by expired/cancelled access.
 */
export const TRANSACTION_COMPLETION_CAPABILITIES = [
  "quotes.acceptance",
] as const satisfies readonly EntitlementCapability[];

export function isEntitlementCapability(
  value: string
): value is EntitlementCapability {
  return (ENTITLEMENT_CAPABILITIES as readonly string[]).includes(value);
}

export function canonicalizeEntitlementCapability(
  value: string
): EntitlementCapability | null {
  if (value === LEGACY_QUOTE_APPROVAL_ALIAS) {
    return "quotes.approval";
  }
  return isEntitlementCapability(value) ? value : null;
}

export function isValueProducingCapability(
  capability: EntitlementCapability
): boolean {
  return (VALUE_PRODUCING_CAPABILITIES as readonly string[]).includes(
    capability
  );
}

export function isTransactionCompletionCapability(
  capability: EntitlementCapability
): boolean {
  return (TRANSACTION_COMPLETION_CAPABILITIES as readonly string[]).includes(
    capability
  );
}

export function isTeamCapability(capability: EntitlementCapability): boolean {
  return (TEAM_CAPABILITIES as readonly string[]).includes(capability);
}
