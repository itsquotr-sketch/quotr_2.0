/**
 * Personal product-update choice shown on Profile.
 * Null source is an unset choice, not an opt-out.
 */

export const EMAIL_PREFERENCE_LABEL =
  "Send me occasional product updates and practical Quotr tips.";

export const EMAIL_PREFERENCE_HELPER =
  "You can unsubscribe anytime. Account, security, and service emails are separate.";

export type EmailPreferenceChoice = "yes" | "no" | "unset";

export function emailPreferenceChoice(input: {
  marketingConsent: boolean;
  marketingConsentSource: string | null | undefined;
}): EmailPreferenceChoice {
  if (
    input.marketingConsentSource !== "signup" &&
    input.marketingConsentSource !== "settings" &&
    input.marketingConsentSource !== "onboarding"
  ) {
    return "unset";
  }
  return input.marketingConsent ? "yes" : "no";
}
