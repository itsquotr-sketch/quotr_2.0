export const BILLING_ENFORCEMENT_MODES = [
  "off",
  "compatibility",
  "strict",
] as const;
export type BillingEnforcementMode = (typeof BILLING_ENFORCEMENT_MODES)[number];

export type BillingEnforcementInput = Readonly<
  Record<string, string | undefined>
>;

function isMode(value: string): value is BillingEnforcementMode {
  return (BILLING_ENFORCEMENT_MODES as readonly string[]).includes(value);
}

/**
 * BILLING-2 rollout switch.
 *
 * off: evaluate/report only; server gates never deny.
 * compatibility: enforce when billing state is initialized; orgs with no
 *   subscription and no override stay usable until BILLING-3 onboards them.
 *   Missing rows are not treated as paid forever — summaries say uninitialized.
 * strict: missing billing state is unpaid/no-access for value-producing work.
 *
 * Unset → compatibility (BILLING-2 Preview default). Unknown → fail closed.
 */
export function resolveBillingEnforcementMode(
  env: BillingEnforcementInput = process.env
): BillingEnforcementMode {
  const raw = env.BILLING_ENFORCEMENT_MODE?.trim();
  if (!raw) {
    return "compatibility";
  }
  if (!isMode(raw)) {
    throw new Error(`Unknown BILLING_ENFORCEMENT_MODE: ${raw}`);
  }
  return raw;
}
