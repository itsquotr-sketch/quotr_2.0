import "server-only";

import {
  FREE_SIGNUP_PREVIEW_BRANCH,
  freeSignupPreviewWebsiteOrigin,
} from "@/lib/billing/checkout-return";
import { quoteDeliverySiteOrigin } from "@/lib/quotes/delivery-email";

/**
 * Stable public origin for Checkout / Portal return URLs.
 * Preview generally uses the shared site URL. The free-signup candidate
 * returns to its own deployment website instead of the hardening alias.
 */
export function billingSiteOrigin(
  env: Readonly<Record<string, string | undefined>> = process.env
): string {
  if (
    env.VERCEL_ENV === "preview" &&
    (env.VERCEL_GIT_COMMIT_REF ?? "").trim() === FREE_SIGNUP_PREVIEW_BRANCH
  ) {
    const website = freeSignupPreviewWebsiteOrigin(env);
    if (!website) {
      throw new Error("Checkout return host is not the free-signup preview website.");
    }
    return website;
  }
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
