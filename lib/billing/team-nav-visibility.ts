/**
 * Primary-nav Team visibility (BETA-1.5).
 *
 * Business / custom: Team is a primary destination.
 * Builder: not primary — upgrade via Billing.
 * Trial: team capability is disabled; do not show a primary Team item
 * that only leads to upgrade copy.
 */

export type TeamNavVisibilityInput = {
  source: string | null | undefined;
  planCode: string | null | undefined;
};

export function shouldShowTeamPrimaryNav(
  input: TeamNavVisibilityInput
): boolean {
  if (input.source === "internal_trial") return false;
  if (input.planCode === "business" || input.planCode === "custom") return true;
  return false;
}
