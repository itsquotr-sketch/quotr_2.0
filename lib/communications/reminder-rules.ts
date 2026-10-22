/**
 * Pure rules for the four optional engagement reminders.
 * Loops has no cross-workflow sending cap and no "three days before a
 * date" trigger. The 48-hour limit applies to reminder sends this app
 * has recorded. Assumed times for the live "First job and rates"
 * workflow are not used: that workflow is still Sending and is not
 * edited here, so those times are not a guarantee.
 */

export const REMINDER_KINDS = ["setup", "estimate", "quote", "trial"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const ENGAGEMENT_QUIET_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const REMINDER_DELAY_MS: Record<Exclude<ReminderKind, "trial">, number> = {
  setup: DAY_MS,
  estimate: DAY_MS,
  quote: 2 * DAY_MS,
};

export const TRIAL_REMINDER_LEAD_MS = 3 * DAY_MS;

const EXPLICIT_CONSENT_SOURCES = new Set(["signup", "settings", "onboarding"]);

/**
 * Earliest time that is at least 48 hours away from every reserved send.
 * Reserved times are other reminders this app has scheduled or released.
 */
export function coordinatedSendAt(idealAtMs: number, reservedSendTimes: number[]): number {
  let candidate = idealAtMs;
  const reserved = reservedSendTimes.filter((time) => Number.isFinite(time));
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = candidate;
    for (const send of reserved) {
      if (Math.abs(moved - send) < ENGAGEMENT_QUIET_MS) {
        moved = Math.max(moved, send + ENGAGEMENT_QUIET_MS);
      }
    }
    if (moved === candidate) return candidate;
    candidate = moved;
  }
  return candidate;
}

export function explicitConsentAllowsReminder(input: {
  consent: boolean;
  consentSource: string | null | undefined;
  consentAtMs: number | null;
  engagementActivatedAtMs: number;
}): boolean {
  if (input.consent !== true) return false;
  if (!input.consentSource || !EXPLICIT_CONSENT_SOURCES.has(input.consentSource)) return false;
  if (input.consentAtMs == null || !Number.isFinite(input.consentAtMs)) return false;
  return input.consentAtMs >= input.engagementActivatedAtMs;
}

export function setupReminderDueAt(input: {
  markedAtMs: number;
  reservedSendTimes: number[];
}): number {
  return coordinatedSendAt(input.markedAtMs + REMINDER_DELAY_MS.setup, input.reservedSendTimes);
}

export function milestoneReminderDueAt(input: {
  kind: "estimate" | "quote";
  milestoneAtMs: number;
  reservedSendTimes: number[];
}): number {
  return coordinatedSendAt(
    input.milestoneAtMs + REMINDER_DELAY_MS[input.kind],
    input.reservedSendTimes
  );
}

export function setupReminderStillDue(input: {
  role: string | null;
  onboardingComplete: boolean;
  markedAtMs: number | null;
  engagementActivatedAtMs: number;
  reminderActivatedAtMs: number;
  consent: boolean;
  consentSource: string | null | undefined;
  consentAtMs: number | null;
}): boolean {
  if (input.role !== "owner") return false;
  if (input.onboardingComplete) return false;
  if (input.markedAtMs == null || input.markedAtMs < input.engagementActivatedAtMs) return false;
  if (input.markedAtMs < input.reminderActivatedAtMs) return false;
  return explicitConsentAllowsReminder(input);
}

export function estimateReminderStillDue(input: {
  isFirstProject: boolean;
  projectDeleted: boolean;
  projectCreatedAtMs: number | null;
  hasEstimate: boolean;
  engagementActivatedAtMs: number;
  reminderActivatedAtMs: number;
}): boolean {
  if (!input.isFirstProject || input.projectDeleted) return false;
  if (input.hasEstimate) return false;
  if (input.projectCreatedAtMs == null) return false;
  if (input.projectCreatedAtMs < input.engagementActivatedAtMs) return false;
  return input.projectCreatedAtMs >= input.reminderActivatedAtMs;
}

export function quoteReminderStillDue(input: {
  isFirstProject: boolean;
  projectDeleted: boolean;
  firstEstimateAtMs: number | null;
  quoteSent: boolean;
  engagementActivatedAtMs: number;
  reminderActivatedAtMs: number;
}): boolean {
  if (!input.isFirstProject || input.projectDeleted || input.quoteSent) return false;
  if (input.firstEstimateAtMs == null) return false;
  if (input.firstEstimateAtMs < input.engagementActivatedAtMs) return false;
  return input.firstEstimateAtMs >= input.reminderActivatedAtMs;
}

type TrialReminderInput = {
  source: string | null;
  status: string | null;
  trialEndsAt: string | null;
  trialStartedAtMs: number | null;
  hasActiveOverride: boolean;
  nowMs: number;
  engagementActivatedAtMs: number;
  reminderActivatedAtMs: number;
};

function trialReminderFacts(
  input: TrialReminderInput
): { ok: true; dueAtMs: number; trialEndsAtMs: number } | { ok: false; reason: string } {
  if (input.hasActiveOverride) return { ok: false, reason: "complimentary" };
  if (input.source !== "internal_trial") return { ok: false, reason: "not_internal_trial" };
  if (input.status !== "trialing") return { ok: false, reason: "not_trialing" };
  const trialEndsAtMs = Date.parse(input.trialEndsAt ?? "");
  if (!Number.isFinite(trialEndsAtMs)) return { ok: false, reason: "no_trial_end" };
  if (input.trialStartedAtMs == null) return { ok: false, reason: "no_start" };
  if (input.trialStartedAtMs < input.engagementActivatedAtMs) {
    return { ok: false, reason: "before_engagement_activation" };
  }
  if (input.trialStartedAtMs < input.reminderActivatedAtMs) {
    return { ok: false, reason: "historical" };
  }
  return { ok: true, dueAtMs: trialEndsAtMs - TRIAL_REMINDER_LEAD_MS, trialEndsAtMs };
}

/** Queue only while the three-day point is still ahead. */
export function trialReminderPlan(
  input: TrialReminderInput
): { ok: true; dueAtMs: number; trialEndsAtMs: number } | { ok: false; reason: string } {
  const facts = trialReminderFacts(input);
  if (!facts.ok) return facts;
  if (facts.dueAtMs <= input.nowMs) return { ok: false, reason: "window_passed" };
  return facts;
}

/** A queued trial reminder may still send until the trial ends. */
export function trialReminderOpen(
  input: TrialReminderInput
): { ok: true; dueAtMs: number; trialEndsAtMs: number } | { ok: false; reason: string } {
  const facts = trialReminderFacts(input);
  if (!facts.ok) return facts;
  if (input.nowMs >= facts.trialEndsAtMs) return { ok: false, reason: "trial_ended" };
  return facts;
}

/**
 * Keep the ideal time unless another recorded reminder is inside 48 hours.
 * A trial slot that would fall on or after the trial end is skipped.
 */
export function boundedReminderAt(input: {
  idealAtMs: number;
  reservedSendTimes: number[];
  expiresAtMs?: number | null;
}): { action: "schedule"; atMs: number } | { action: "skip"; reason: "expired" | "frequency" } {
  if (input.expiresAtMs != null && input.idealAtMs >= input.expiresAtMs) {
    return { action: "skip", reason: "expired" };
  }
  const atMs = coordinatedSendAt(input.idealAtMs, input.reservedSendTimes);
  if (input.expiresAtMs != null && atMs >= input.expiresAtMs) {
    return { action: "skip", reason: "frequency" };
  }
  return { action: "schedule", atMs };
}
