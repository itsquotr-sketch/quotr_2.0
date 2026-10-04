/**
 * Allowed origins for profiles.marketing_consent_source.
 * Onboarding may record an optional choice. It is never required to finish setup.
 */

export const MARKETING_CONSENT_SOURCES = ["signup", "settings", "onboarding"] as const;

export type MarketingConsentSource = (typeof MARKETING_CONSENT_SOURCES)[number];

export function isMarketingConsentSource(
  value: string | null | undefined
): value is MarketingConsentSource {
  return (
    value === "signup" || value === "settings" || value === "onboarding"
  );
}

export function marketingConsentSourceError(
  value: string | null | undefined
): string | null {
  if (isMarketingConsentSource(value)) return null;
  return "Choose where this product-update preference was recorded.";
}
