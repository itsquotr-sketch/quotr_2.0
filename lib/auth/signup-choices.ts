/**
 * Signup choices. Terms acceptance and marketing consent are separate.
 * Existing accounts are not backfilled and are not sent through signup again.
 */

export const TERMS_OF_USE_VERSION = "2026-10-15";
export const TERMS_OF_USE_URL = "https://get-quotr.com/terms";
export const PRIVACY_POLICY_URL = "https://get-quotr.com/privacy";

export const TERMS_ACCEPTANCE_REQUIRED =
  "Agree to the Terms of Use to create an account.";
export const MARKETING_CHOICE_REQUIRED =
  "Choose whether you want product updates.";

export function signupChoiceErrors(input: {
  termsAccepted: boolean;
  marketingConsent: "yes" | "no" | null;
}): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  if (!input.termsAccepted) {
    fieldErrors.terms_accepted = [TERMS_ACCEPTANCE_REQUIRED];
  }
  if (input.marketingConsent !== "yes" && input.marketingConsent !== "no") {
    fieldErrors.marketing_consent = [MARKETING_CHOICE_REQUIRED];
  }
  return fieldErrors;
}

export function marketingConsentFromSignup(value: unknown): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}
