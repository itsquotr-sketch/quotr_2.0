import "server-only";

import { quoteDeliverySiteOrigin } from "@/lib/quotes/delivery-email";

/**
 * Stable public origin for Checkout / Portal return URLs.
 * Preview: NEXT_PUBLIC_SITE_URL must be the stable Preview origin, not Production.
 */
export function billingSiteOrigin(): string {
  const origin = quoteDeliverySiteOrigin();
  if (!origin) {
    throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
  }
  return origin;
}

export function billingCheckoutSuccessUrl(): string {
  return `${billingSiteOrigin()}/app/settings/billing?checkout=success`;
}

export function billingCheckoutCancelUrl(): string {
  return `${billingSiteOrigin()}/app/settings/billing?checkout=cancelled`;
}

export function billingPortalReturnUrl(): string {
  return `${billingSiteOrigin()}/app/settings/billing`;
}

export function readNzGstTaxRateId(
  env: Readonly<Record<string, string | undefined>> = process.env
): string | null {
  const id = env.STRIPE_TAX_RATE_NZ_GST?.trim() ?? "";
  return id || null;
}

export function readPortalConfigurationId(
  env: Readonly<Record<string, string | undefined>> = process.env
): string | null {
  const id = env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() ?? "";
  return id || null;
}
