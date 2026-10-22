/**
 * Who automatic Loops sync may touch.
 * Production never uses the Preview database.
 * Preview automation may touch one test address.
 * The scheduled retry does not include existing pending rows unless
 * MARKETING_LOOPS_RETRY_EXISTING=true. That flag stays unset.
 */

import { timingSafeEqual } from "node:crypto";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
  supabaseProjectRefFromUrl,
} from "@/lib/deployment/environment";

export const PREVIEW_LOOPS_TEST_EMAIL = "hello+test@erccontracting.co.nz";
export const MARKETING_LOOPS_RETRY_EXISTING_ENV = "MARKETING_LOOPS_RETRY_EXISTING";
/** Supabase pg_cron. Vercel Hobby cannot run every five minutes, so it is not a second scheduler. */
export const MARKETING_LOOPS_RETRY_SCHEDULE = "*/5 * * * *";
export const MARKETING_LOOPS_RETRY_INTERVAL_MINUTES = 5;
/** Hard cap for one invocation. The time budget may send fewer. */
export const MARKETING_LOOPS_RETRY_BATCH = 8;
export const MARKETING_LOOPS_RETRY_CONCURRENCY = 2;
/** Leave room inside the 10 second Hobby function limit. */
export const MARKETING_LOOPS_FUNCTION_BUDGET_MS = 8_000;
/** One pending contact can use two finds and one update, each allowed 2.5 seconds. */
export const MARKETING_LOOPS_ATTEMPT_BUDGET_MS = 7_500;
export const MARKETING_LOOPS_RETRY_ATTEMPT_CAP = 8;

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

export function cronAuthorizationMatches(
  expected: string | undefined,
  authorization: string | null
): boolean {
  const secret = expected?.trim() ?? "";
  const header = authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (secret.length < 16 || secret.length !== provided.length) return false;
  const left = Buffer.from(secret);
  const right = Buffer.from(provided);
  return timingSafeEqual(left, right);
}

/** 4xx contact errors stop. Rate limits, outages, and auth-key failures wait. */
export function loopsRetryDisposition(code: string): "transient" | "permanent" {
  if (
    code === "network" ||
    code === "find_network" ||
    code === "lease_unavailable" ||
    code === "pending_unavailable"
  ) {
    return "transient";
  }
  const status = Number(code.split("_").pop());
  if (!Number.isInteger(status)) {
    return code === "update_rejected" ? "permanent" : "transient";
  }
  if (status === 401 || status === 403 || status === 408 || status === 429) return "transient";
  if (status >= 500) return "transient";
  if (status >= 400) return "permanent";
  return "transient";
}

/** Five minutes, then 10, 20, and so on, capped at six hours. */
export function loopsRetryBackoffMs(attemptsAfterFailure: number): number {
  const steps = Math.max(0, attemptsAfterFailure - 1);
  const minutes = Math.min(360, 5 * 2 ** steps);
  return minutes * 60 * 1000;
}

export function compareLoopsRetryPriority(
  left: { marketingConsent: boolean; attempts: number },
  right: { marketingConsent: boolean; attempts: number }
): number {
  if (left.marketingConsent !== right.marketingConsent) {
    return left.marketingConsent ? 1 : -1;
  }
  return left.attempts - right.attempts;
}

const EXPLICIT_CONSENT_SOURCES = new Set(["signup", "settings", "onboarding"]);

/**
 * Whether this sync may send engagementEligible: true.
 * The property is omitted in every other case, including Preview,
 * an unset activation time, consent recorded before activation,
 * and a contact that was already marked.
 */
export function loopsEngagementEligibleUpdate(input: {
  scope: MarketingLoopsScope;
  activatedAt: string | null | undefined;
  consent: boolean;
  consentSource: string | null | undefined;
  consentAt: string | null | undefined;
  alreadyEligible: boolean;
}): boolean {
  if (input.scope !== "production") return false;
  if (input.alreadyEligible) return false;
  if (input.consent !== true) return false;
  if (!input.consentSource || !EXPLICIT_CONSENT_SOURCES.has(input.consentSource)) return false;
  const activatedAt = Date.parse(input.activatedAt ?? "");
  const consentAt = Date.parse(input.consentAt ?? "");
  if (!Number.isFinite(activatedAt) || !Number.isFinite(consentAt)) return false;
  return consentAt >= activatedAt;
}

/** How many contacts the next wave may start. Zero means leave the rest pending. */
export function planLoopsRetryWave(input: {
  elapsedMs: number;
  remaining: number;
  concurrency?: number;
  budgetMs?: number;
  attemptBudgetMs?: number;
}): number {
  if (input.remaining <= 0) return 0;
  const budget = input.budgetMs ?? MARKETING_LOOPS_FUNCTION_BUDGET_MS;
  const attempt = input.attemptBudgetMs ?? MARKETING_LOOPS_ATTEMPT_BUDGET_MS;
  if (budget - input.elapsedMs < attempt) return 0;
  return Math.min(input.concurrency ?? MARKETING_LOOPS_RETRY_CONCURRENCY, input.remaining);
}
