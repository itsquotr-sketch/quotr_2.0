/**
 * Optional engagement reminder rules.
 * Run: npx tsx scripts/verify-engagement-reminders.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  coordinatedSendAt,
  ENGAGEMENT_QUIET_MS,
  estimateReminderStillDue,
  explicitConsentAllowsReminder,
  liveSequenceSendTimes,
  quoteReminderStillDue,
  REMINDER_DELAY_MS,
  setupReminderDueAt,
  setupReminderStillDue,
  trialReminderPlan,
  TRIAL_REMINDER_LEAD_MS,
} from "../lib/communications/reminder-rules";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
let failed = 0;

function assert(label: string, ok: boolean) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${label}`);
    return;
  }
  console.log(`ok ${label}`);
}

const engagementAt = Date.parse("2026-10-22T07:19:35.375Z");
const reminderAt = Date.parse("2026-11-01T00:00:00.000Z");
const markedAt = Date.parse("2026-11-02T00:00:00.000Z");
const day = 24 * 60 * 60 * 1000;

const consent = {
  consent: true,
  consentSource: "signup" as const,
  consentAtMs: markedAt,
  engagementActivatedAtMs: engagementAt,
};

assert(
  "setup waits until 48 hours after the live sequence",
  setupReminderDueAt({
    markedAtMs: markedAt,
    reservedSendTimes: liveSequenceSendTimes(markedAt),
  }) === markedAt + 7 * day
);

assert(
  "a contact outside the live sequence keeps the 24 hour setup delay",
  setupReminderDueAt({ markedAtMs: markedAt, reservedSendTimes: [] }) ===
    markedAt + REMINDER_DELAY_MS.setup
);

const firstSend = markedAt + 2 * day;
assert(
  "a second reminder inside 48 hours moves to 48 hours after the earlier send",
  coordinatedSendAt(firstSend + 12 * 60 * 60 * 1000, [firstSend]) ===
    firstSend + ENGAGEMENT_QUIET_MS
);

assert(
  "eligible incomplete setup is due and a completed setup is not",
  setupReminderStillDue({
    role: "owner",
    onboardingComplete: false,
    markedAtMs: markedAt,
    engagementActivatedAtMs: engagementAt,
    reminderActivatedAtMs: reminderAt,
    ...consent,
  }) &&
    !setupReminderStillDue({
      role: "owner",
      onboardingComplete: true,
      markedAtMs: markedAt,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
      ...consent,
    })
);

assert(
  "withdrawn consent, a team role, and a historical marker are excluded",
  !explicitConsentAllowsReminder({ ...consent, consent: false }) &&
    !setupReminderStillDue({
      role: "admin",
      onboardingComplete: false,
      markedAtMs: markedAt,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
      ...consent,
    }) &&
    !setupReminderStillDue({
      role: "owner",
      onboardingComplete: false,
      markedAtMs: engagementAt - day,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
      ...consent,
      consentAtMs: engagementAt - day,
    })
);

const projectAt = reminderAt + day;
assert(
  "the first job without an estimate is due and a generated estimate is not",
  estimateReminderStillDue({
    isFirstProject: true,
    projectDeleted: false,
    projectCreatedAtMs: projectAt,
    hasEstimate: false,
    engagementActivatedAtMs: engagementAt,
    reminderActivatedAtMs: reminderAt,
  }) &&
    !estimateReminderStillDue({
      isFirstProject: true,
      projectDeleted: false,
      projectCreatedAtMs: projectAt,
      hasEstimate: true,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
    }) &&
    !estimateReminderStillDue({
      isFirstProject: false,
      projectDeleted: false,
      projectCreatedAtMs: projectAt,
      hasEstimate: false,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
    }) &&
    !estimateReminderStillDue({
      isFirstProject: true,
      projectDeleted: false,
      projectCreatedAtMs: reminderAt - day,
      hasEstimate: false,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
    })
);

const estimateAt = projectAt + day;
assert(
  "the first estimate without a sent Quote is due and a sent Quote is not",
  quoteReminderStillDue({
    isFirstProject: true,
    projectDeleted: false,
    firstEstimateAtMs: estimateAt,
    quoteSent: false,
    engagementActivatedAtMs: engagementAt,
    reminderActivatedAtMs: reminderAt,
  }) &&
    !quoteReminderStillDue({
      isFirstProject: true,
      projectDeleted: false,
      firstEstimateAtMs: estimateAt,
      quoteSent: true,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
    })
);

const trialEnds = Date.parse("2026-11-20T00:00:00.000Z");
const trialStart = reminderAt + day;
assert(
  "trial timing uses the real end, and paid or complimentary access is excluded",
  trialReminderPlan({
    source: "internal_trial",
    status: "trialing",
    trialEndsAt: new Date(trialEnds).toISOString(),
    trialStartedAtMs: trialStart,
    hasActiveOverride: false,
    nowMs: trialStart,
    engagementActivatedAtMs: engagementAt,
    reminderActivatedAtMs: reminderAt,
  }).ok === true &&
    (trialReminderPlan({
      source: "internal_trial",
      status: "trialing",
      trialEndsAt: new Date(trialEnds).toISOString(),
      trialStartedAtMs: trialStart,
      hasActiveOverride: false,
      nowMs: trialStart,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
    }) as { dueAtMs: number }).dueAtMs === trialEnds - TRIAL_REMINDER_LEAD_MS &&
    trialReminderPlan({
      source: "stripe",
      status: "active",
      trialEndsAt: new Date(trialEnds).toISOString(),
      trialStartedAtMs: trialStart,
      hasActiveOverride: false,
      nowMs: trialStart,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
    }).ok === false &&
    trialReminderPlan({
      source: "internal_trial",
      status: "trialing",
      trialEndsAt: new Date(trialEnds).toISOString(),
      trialStartedAtMs: trialStart,
      hasActiveOverride: true,
      nowMs: trialStart,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
    }).ok === false &&
    trialReminderPlan({
      source: "internal_trial",
      status: "cancelled",
      trialEndsAt: new Date(trialEnds).toISOString(),
      trialStartedAtMs: trialStart,
      hasActiveOverride: false,
      nowMs: trialStart,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
    }).ok === false &&
    trialReminderPlan({
      source: "internal_trial",
      status: "trialing",
      trialEndsAt: new Date(trialEnds).toISOString(),
      trialStartedAtMs: engagementAt - day,
      hasActiveOverride: false,
      nowMs: engagementAt,
      engagementActivatedAtMs: engagementAt,
      reminderActivatedAtMs: reminderAt,
    }).ok === false
);

const schedule = read("lib/communications/reminder-schedule.ts");
const migration = read("supabase/migrations/119_marketing_engagement_reminders.sql");
const engagement = read("lib/communications/engagement.ts");
const mapping = read("lib/communications/contact-mapping.ts");
const help = read("lib/help/content.ts");
const privacy = read("app/(legal)/privacy/page.tsx");

assert(
  "enrolment stays closed until the reminder runtime is set, and only in production",
  schedule.includes('marketingLoopsScope(process.env) !== "production"') &&
    schedule.includes("marketing_reminder_runtime") &&
    migration.includes("values (true, null)") &&
    !migration.includes("clock_timestamp()") &&
    !migration.includes("update public.marketing_engagement_runtime")
);

assert(
  "completion of setup, the estimate, the Quote, or payment suppresses the matching reminder",
  read("lib/setup/actions.ts").includes("noteSetupCompleted") &&
    read("lib/estimate/persist-estimate.ts").includes("noteEstimateGenerated") &&
    read("lib/quotes/actions.ts").includes("noteQuoteSent") &&
    read("lib/billing/webhook.ts").includes("notePaidOrClosed") &&
    !read("lib/billing/webhook.ts").includes("upsertLoopsContact")
);

assert(
  "routine contact mapping does not send the reminder or the trial date",
  !mapping.includes("engagementReminder") &&
    !mapping.includes("trialEndsOn") &&
    !engagement.includes("projectsCreated") &&
    help.includes("Campaign sending has not started.") &&
    help.includes("optional reminders") &&
    privacy.includes("Campaign sending has not started.") &&
    privacy.includes("optional reminders")
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("engagement reminder checks passed");
