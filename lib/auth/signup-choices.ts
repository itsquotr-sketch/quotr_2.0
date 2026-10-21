/**
 * Signup choices. Terms acceptance and marketing consent are separate.
 * Existing accounts are not backfilled and are not sent through signup again.
 */

/**
 * Application Terms version. This is the document at /terms.
 * 2026-10-15 remains the website-only Terms and is not reused or backfilled.
 */
export const TERMS_OF_USE_VERSION = "2026-10-22";
export const TERMS_OF_USE_URL = "/terms";
export const PRIVACY_POLICY_URL = "/privacy";

export const TERMS_ACCEPTANCE_REQUIRED =
  "Agree to the Application Terms to create an account.";
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
