/**
 * Who automatic Loops sync may touch.
 * Production never uses the Preview database.
 * Preview automation may touch one test address.
 * The scheduled retry does not include existing pending rows unless
 * MARKETING_LOOPS_RETRY_EXISTING=true. That flag stays unset.
 */

import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
  supabaseProjectRefFromUrl,
} from "@/lib/deployment/environment";

export const PREVIEW_LOOPS_TEST_EMAIL = "hello+test@erccontracting.co.nz";
export const MARKETING_LOOPS_RETRY_EXISTING_ENV = "MARKETING_LOOPS_RETRY_EXISTING";
/** Hobby cron runs at most once per day. 16:00 UTC is 05:00 New Zealand daylight time. */
export const MARKETING_LOOPS_RETRY_SCHEDULE = "0 16 * * *";
export const MARKETING_LOOPS_RETRY_LIMIT = 2;
export const MARKETING_LOOPS_RETRY_DELAY_HOURS = 24;

export type MarketingLoopsScope = "off" | "preview" | "production";

export function confirmedSignupLoopsEligible(input: {
  emailConfirmed: boolean;
  newlyProvisioned: boolean;
  destination: string;
}): boolean {
  if (!input.emailConfirmed) return false;
  if (!input.newlyProvisioned) return false;
  if (input.destination.startsWith("/invite/")) return false;
  if (input.destination.startsWith("/reset-password")) return false;
  if (input.destination.startsWith("/signup")) return false;
  return true;
}

export function marketingLoopsScope(
  env: Readonly<Record<string, string | undefined>>
): MarketingLoopsScope {
  const ref = supabaseProjectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (env.VERCEL_ENV === "production" && ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    return "production";
  }
  if (env.VERCEL_ENV === "preview" && ref === PREVIEW_SUPABASE_PROJECT_REF) {
    return "preview";
  }
  return "off";
}

export function marketingLoopsAllowsEmail(scope: MarketingLoopsScope, email: string): boolean {
  const normalised = email.trim().toLowerCase();
  if (!normalised || scope === "off") return false;
  if (scope === "preview") return normalised === PREVIEW_LOOPS_TEST_EMAIL;
  return true;
}

export function marketingLoopsRetriesExistingPending(
  env: Readonly<Record<string, string | undefined>>
): boolean {
  return env[MARKETING_LOOPS_RETRY_EXISTING_ENV]?.trim() === "true";
}
