/**
 * Pure Loops contact mapping. No network and no secrets.
 *
 * Stage 1 leaves companySize, primaryTrade, and lastActiveAt unset.
 * subscribed is not a contact property here. The Loops client adds it only
 * for an explicit opt-in, an explicit opt-out, or the first create of a
 * contact (so Loops does not default a new contact to subscribed).
 */

import { resolveEffectiveAccessPolicy } from "@/lib/billing/access-policy";
import type { OrgBillingOverride, OrgSubscription } from "@/lib/billing/types";
import {
  firstRunIsComplete,
  resolveFirstRunStage,
} from "@/lib/setup/first-run-stage";

export type LoopsContactScalar = string | number | boolean | null;

export type LoopsContactProperties = Record<string, LoopsContactScalar>;

export type LoopsSyncMode = "routine" | "explicit_opt_in" | "explicit_opt_out";

const OMITTED_STAGE_1_KEYS = ["companySize", "primaryTrade", "lastActiveAt"] as const;

/**
 * First token is firstName. The remainder is lastName.
 * A single token returns lastName: null so the Loops update can clear a
 * previously stored surname. The official Loops SDK accepts null on
 * updateContact properties to reset a value. A blank name omits both.
 */
export function splitFullName(fullName: string | null | undefined): {
  firstName?: string;
  lastName?: string | null;
} {
  const trimmed = fullName?.trim() ?? "";
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0];
  if (!firstName) return {};
  const lastName = parts.slice(1).join(" ");
  if (!lastName) return { firstName, lastName: null };
  return { firstName, lastName };
}

/** Trading name when it has text, otherwise the organisation signup name. */
export function loopsCompanyName(
  tradingName: string | null | undefined,
  organisationName: string | null | undefined
): string | undefined {
  const trading = tradingName?.trim() ?? "";
  if (trading) return trading;
  const organisation = organisationName?.trim() ?? "";
  return organisation || undefined;
}

/**
 * Country is included only after company basics have been saved.
 * The schema default (NZ) is not treated as an explicit choice while
 * first-run is still on the company step.
 */
export function loopsCountry(input: {
  country: string | null | undefined;
  onboardingStatus: string | null | undefined;
  onboardingStep: string | null | undefined;
  hasPrimaryWorkAreas?: boolean;
}): string | undefined {
  const stage = resolveFirstRunStage({
    onboardingStatus: input.onboardingStatus,
    onboardingStep: input.onboardingStep,
    hasPrimaryWorkAreas: input.hasPrimaryWorkAreas,
  });
  if (stage === "basics") return undefined;
  const country = input.country?.trim() ?? "";
  return country || undefined;
}

export function loopsOnboardingComplete(input: {
  onboardingStatus: string | null | undefined;
  onboardingStep: string | null | undefined;
  hasPrimaryWorkAreas?: boolean;
}): boolean {
  return firstRunIsComplete(
    resolveFirstRunStage({
      onboardingStatus: input.onboardingStatus,
      onboardingStep: input.onboardingStep,
      hasPrimaryWorkAreas: input.hasPrimaryWorkAreas,
    })
  );
}

/**
 * Plan and status come from resolveEffectiveAccessPolicy.
 * An active internal trial is plan=business, subscriptionStatus=trialing.
 * An expired internal trial reports subscriptionStatus=trial_expired.
 * Uninitialized billing is omitted rather than invented.
 */
export function loopsBillingFields(input: {
  subscription: OrgSubscription | null;
  activeOverride: OrgBillingOverride | null;
  now?: Date;
}): {
  plan?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
} {
  const policy = resolveEffectiveAccessPolicy({
    subscription: input.subscription,
    activeOverride: input.activeOverride,
    now: input.now,
  });
  if (policy.source === "none" || policy.planCode == null) {
    return {};
  }
  const fields: {
    plan?: string;
    subscriptionStatus?: string;
    trialEndsAt?: string;
  } = {
    plan: policy.planCode,
    subscriptionStatus: policy.trialExpired ? "trial_expired" : policy.billingStatus,
  };
  const trialEndsAt = input.subscription?.trialEndsAt?.trim() ?? "";
  if (trialEndsAt) fields.trialEndsAt = trialEndsAt;
  return fields;
}

export type LoopsContactDraft = {
  userId: string;
  email: string;
  fullName: string | null;
  marketingConsent: boolean;
  /** Stored preference still needs a confirmed Loops subscribed update. */
  preferencePending?: boolean;
  organisationName?: string | null;
  tradingName?: string | null;
  country?: string | null;
  countryExplicit?: boolean;
  region?: string | null;
  onboardingComplete?: boolean | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  projectsCreated?: number | null;
  estimatesGenerated?: number | null;
  quotesSent?: number | null;
  quotesAccepted?: number | null;
  ratesConfigured?: boolean | null;
};

export function buildLoopsContactProperties(
  draft: LoopsContactDraft
): LoopsContactProperties {
  const properties: LoopsContactProperties = {
    email: draft.email.trim(),
    userId: draft.userId,
    marketingConsent: draft.marketingConsent,
  };

  const name = splitFullName(draft.fullName);
  if (name.firstName) properties.firstName = name.firstName;
  if (name.lastName === null) properties.lastName = null;
  else if (name.lastName) properties.lastName = name.lastName;

  const companyName = loopsCompanyName(draft.tradingName, draft.organisationName);
  if (companyName) properties.companyName = companyName;

  if (draft.countryExplicit) {
    const country = draft.country?.trim() ?? "";
    if (country) properties.country = country;
  }

  const region = draft.region?.trim() ?? "";
  if (region) properties.region = region;

  if (typeof draft.onboardingComplete === "boolean") {
    properties.onboardingComplete = draft.onboardingComplete;
  }
  if (draft.plan) properties.plan = draft.plan;
  if (draft.subscriptionStatus) properties.subscriptionStatus = draft.subscriptionStatus;
  if (draft.trialEndsAt) properties.trialEndsAt = draft.trialEndsAt;
  if (typeof draft.projectsCreated === "number") {
    properties.projectsCreated = draft.projectsCreated;
  }
  if (typeof draft.estimatesGenerated === "number") {
    properties.estimatesGenerated = draft.estimatesGenerated;
  }
  if (typeof draft.quotesSent === "number") properties.quotesSent = draft.quotesSent;
  if (typeof draft.quotesAccepted === "number") {
    properties.quotesAccepted = draft.quotesAccepted;
  }
  if (typeof draft.ratesConfigured === "boolean") {
    properties.ratesConfigured = draft.ratesConfigured;
  }

  return properties;
}

export function contactPropertiesOmitStage1Gaps(
  properties: LoopsContactProperties
): boolean {
  return OMITTED_STAGE_1_KEYS.every((key) => !(key in properties));
}

/**
 * Loops subscription field for one contact upsert.
 *
 * Routine sync of an existing contact omits `subscribed`, so a Loops
 * unsubscribe is not overwritten and a previous opt-in is not revoked.
 * A contact that does not exist yet must set `subscribed` explicitly:
 * Loops otherwise creates new contacts as subscribed.
 * Explicit Quotr opt-in and opt-out always send the matching boolean.
 * A pending preference sends that stored boolean on an otherwise routine
 * sync, so a failed opt-in or opt-out is retried without a blind subscribe.
 */
export function loopsSubscribedField(input: {
  mode: LoopsSyncMode;
  contactExists: boolean;
  marketingConsent: boolean;
  preferencePending?: boolean;
}): boolean | undefined {
  if (input.mode === "explicit_opt_out") return false;
  if (input.mode === "explicit_opt_in") return true;
  if (input.preferencePending) return input.marketingConsent === true;
  if (input.contactExists) return undefined;
  return input.marketingConsent === true;
}

/**
 * Pending stays set until Loops accepts `subscribed` for the consent that
 * is still stored. A failed or skipped request leaves it set. A newer
 * consent value also leaves it set, so the next sync retries that value.
 */
export function preferencePendingAfterLoopsAttempt(input: {
  preferencePending: boolean;
  sentSubscribed: boolean | undefined;
  loopsAccepted: boolean;
  storedConsent: boolean;
  sentConsent: boolean;
}): boolean {
  if (!input.preferencePending && typeof input.sentSubscribed !== "boolean") {
    return false;
  }
  if (!input.loopsAccepted) return true;
  if (typeof input.sentSubscribed !== "boolean") return input.preferencePending;
  if (input.storedConsent !== input.sentConsent) return true;
  if (input.sentSubscribed !== input.sentConsent) return true;
  return false;
}
