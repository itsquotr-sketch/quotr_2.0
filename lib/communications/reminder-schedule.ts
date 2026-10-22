/**
 * Schedules and releases one optional reminder per organisation.
 * Enrolment stays closed unless the scope is production and
 * marketing_reminder_runtime.activated_at is set. Preview stays closed.
 * Work runs after the response. A failure never changes the user action.
 */

import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBillingEnvironment } from "@/lib/billing/environment";
import { isBillingOverrideActive } from "@/lib/billing/overrides";
import { formatTrialEndDate } from "@/lib/billing/trial-countdown";
import { loopsOnboardingComplete } from "@/lib/communications/contact-mapping";
import type { LoopsContactProperties } from "@/lib/communications/contact-mapping";
import {
  logLoopsFailure,
  readLoopsContactSubscription,
  upsertLoopsContact,
} from "@/lib/communications/loops-client";
import {
  marketingLoopsAllowsEmail,
  marketingLoopsScope,
} from "@/lib/communications/loops-automation";
import {
  coordinatedSendAt,
  estimateReminderStillDue,
  explicitConsentAllowsReminder,
  liveSequenceSendTimes,
  milestoneReminderDueAt,
  quoteReminderStillDue,
  setupReminderDueAt,
  setupReminderStillDue,
  trialReminderPlan,
  type ReminderKind,
} from "@/lib/communications/reminder-rules";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = SupabaseClient;

type RuntimeGate = {
  open: false;
} | {
  open: true;
  engagementActivatedAtMs: number;
  reminderActivatedAtMs: number;
};

export function noteSetupReminder(userId: string): void {
  scheduleAfter(() => considerSetupReminder(userId));
}

export function noteSetupCompleted(orgId: string): void {
  scheduleAfter(() => suppressReminder(orgId, "setup"));
}

export function noteFirstProject(orgId: string, projectId: string): void {
  scheduleAfter(() => considerEstimateReminder(orgId, projectId));
}

export function noteEstimateGenerated(orgId: string, projectId: string): void {
  scheduleAfter(async () => {
    await suppressReminder(orgId, "estimate");
    await considerQuoteReminder(orgId, projectId);
  });
}

export function noteQuoteSent(orgId: string, projectId: string): void {
  scheduleAfter(() => suppressQuoteIfFirstProject(orgId, projectId));
}

export function noteTrialFromUser(userId: string): void {
  scheduleAfter(() => considerTrialReminderForUser(userId));
}

export function notePaidOrClosed(orgId: string): void {
  scheduleAfter(() => suppressReminder(orgId, "trial"));
}

function scheduleAfter(task: () => Promise<void>): void {
  try {
    after(async () => {
      try {
        await task();
      } catch {
        logLoopsFailure("reminder_schedule_failed");
      }
    });
  } catch {
    logLoopsFailure("reminder_schedule_unavailable");
  }
}

async function openAdmin(): Promise<Admin | null> {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

async function enrolmentGate(admin: Admin): Promise<RuntimeGate> {
  if (marketingLoopsScope(process.env) !== "production") return { open: false };
  const [engagement, reminder] = await Promise.all([
    admin.from("marketing_engagement_runtime").select("activated_at").eq("id", true).maybeSingle(),
    admin.from("marketing_reminder_runtime").select("activated_at").eq("id", true).maybeSingle(),
  ]);
  if (engagement.error || reminder.error) return { open: false };
  const engagementActivatedAtMs = Date.parse(engagement.data?.activated_at ?? "");
  const reminderActivatedAtMs = Date.parse(reminder.data?.activated_at ?? "");
  if (!Number.isFinite(engagementActivatedAtMs) || !Number.isFinite(reminderActivatedAtMs)) {
    return { open: false };
  }
  return { open: true, engagementActivatedAtMs, reminderActivatedAtMs };
}

type OwnerRow = {
  id: string;
  role: string | null;
  marketing_consent: boolean | null;
  marketing_consent_at: string | null;
  marketing_consent_source: string | null;
  marketing_engagement_marked_at: string | null;
};

async function loadOwner(admin: Admin, orgId: string): Promise<OwnerRow | null> {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, role, marketing_consent, marketing_consent_at, marketing_consent_source, marketing_engagement_marked_at, created_at"
    )
    .eq("org_id", orgId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.length) return null;
  return data[0] as OwnerRow;
}

async function ownerEmail(admin: Admin, userId: string): Promise<string | null> {
  const user = await admin.auth.admin.getUserById(userId);
  const email = user.data.user?.email?.trim().toLowerCase() ?? "";
  return email || null;
}

async function reservedSends(
  admin: Admin,
  orgId: string,
  markedAtMs: number | null,
  options?: { includeUnreleased?: boolean; excludeReminderId?: string }
): Promise<number[]> {
  const reserved = markedAtMs == null ? [] : liveSequenceSendTimes(markedAtMs);
  const { data } = await admin
    .from("marketing_engagement_reminders")
    .select("id, due_at, released_at")
    .eq("org_id", orgId);
  for (const row of data ?? []) {
    if (options?.excludeReminderId && row.id === options.excludeReminderId) continue;
    const released = Date.parse((row.released_at as string | null) ?? "");
    const due = Date.parse((row.due_at as string | null) ?? "");
    if (Number.isFinite(released)) reserved.push(released);
    else if (options?.includeUnreleased && Number.isFinite(due)) reserved.push(due);
  }
  return reserved;
}

async function insertReminder(
  admin: Admin,
  input: {
    orgId: string;
    kind: ReminderKind;
    recipientUserId: string;
    dueAtMs: number;
    milestoneAtMs: number;
  }
): Promise<void> {
  const { error } = await admin.from("marketing_engagement_reminders").insert({
    org_id: input.orgId,
    kind: input.kind,
    recipient_user_id: input.recipientUserId,
    due_at: new Date(input.dueAtMs).toISOString(),
    milestone_at: new Date(input.milestoneAtMs).toISOString(),
  });
  if (error && error.code !== "23505") logLoopsFailure("reminder_insert_failed");
}

async function suppressReminder(orgId: string, kind: ReminderKind): Promise<void> {
  const admin = await openAdmin();
  if (!admin) return;
  const gate = await enrolmentGate(admin);
  if (!gate.open) return;
  const { error } = await admin
    .from("marketing_engagement_reminders")
    .update({ suppressed_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("kind", kind)
    .is("released_at", null)
    .is("suppressed_at", null);
  if (error) logLoopsFailure("reminder_suppress_failed");
}

async function considerSetupReminder(userId: string): Promise<void> {
  const admin = await openAdmin();
  if (!admin) return;
  const gate = await enrolmentGate(admin);
  if (!gate.open) return;
  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "id, org_id, role, marketing_consent, marketing_consent_at, marketing_consent_source, marketing_engagement_marked_at"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !profile?.org_id) return;
  const orgId = profile.org_id as string;
  const markedAtMs = Date.parse((profile.marketing_engagement_marked_at as string | null) ?? "");
  const settings = await loadOnboarding(admin, orgId);
  const due = setupReminderStillDue({
    role: (profile.role as string | null) ?? null,
    onboardingComplete: settings.complete,
    markedAtMs: Number.isFinite(markedAtMs) ? markedAtMs : null,
    engagementActivatedAtMs: gate.engagementActivatedAtMs,
    reminderActivatedAtMs: gate.reminderActivatedAtMs,
    consent: profile.marketing_consent === true,
    consentSource: (profile.marketing_consent_source as string | null) ?? null,
    consentAtMs: Date.parse((profile.marketing_consent_at as string | null) ?? "") || null,
  });
  if (!due || !Number.isFinite(markedAtMs)) return;
  const email = await ownerEmail(admin, userId);
  if (!email || !marketingLoopsAllowsEmail("production", email)) return;
  const dueAtMs = setupReminderDueAt({
    markedAtMs,
    reservedSendTimes: await reservedSends(admin, orgId, markedAtMs, {
      includeUnreleased: true,
    }),
  });
  await insertReminder(admin, {
    orgId,
    kind: "setup",
    recipientUserId: userId,
    dueAtMs,
    milestoneAtMs: markedAtMs,
  });
}

async function considerEstimateReminder(orgId: string, projectId: string): Promise<void> {
  const admin = await openAdmin();
  if (!admin) return;
  const gate = await enrolmentGate(admin);
  if (!gate.open) return;
  const first = await loadFirstProject(admin, orgId);
  if (!first || first.id !== projectId) return;
  const createdAtMs = Date.parse(first.created_at);
  if (
    !estimateReminderStillDue({
      isFirstProject: true,
      projectDeleted: false,
      projectCreatedAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
      hasEstimate: await projectHasEstimate(admin, projectId),
      engagementActivatedAtMs: gate.engagementActivatedAtMs,
      reminderActivatedAtMs: gate.reminderActivatedAtMs,
    })
  ) {
    return;
  }
  const owner = await loadOwner(admin, orgId);
  if (!owner) return;
  const consentAtMs = Date.parse(owner.marketing_consent_at ?? "");
  if (
    !explicitConsentAllowsReminder({
      consent: owner.marketing_consent === true,
      consentSource: owner.marketing_consent_source,
      consentAtMs: Number.isFinite(consentAtMs) ? consentAtMs : null,
      engagementActivatedAtMs: gate.engagementActivatedAtMs,
    })
  ) {
    return;
  }
  const email = await ownerEmail(admin, owner.id);
  if (!email || !marketingLoopsAllowsEmail("production", email)) return;
  const markedAtMs = Date.parse(owner.marketing_engagement_marked_at ?? "");
  const dueAtMs = milestoneReminderDueAt({
    kind: "estimate",
    milestoneAtMs: createdAtMs,
    reservedSendTimes: await reservedSends(
      admin,
      orgId,
      Number.isFinite(markedAtMs) ? markedAtMs : null,
      { includeUnreleased: true }
    ),
  });
  await insertReminder(admin, {
    orgId,
    kind: "estimate",
    recipientUserId: owner.id,
    dueAtMs,
    milestoneAtMs: createdAtMs,
  });
}

async function considerQuoteReminder(orgId: string, projectId: string): Promise<void> {
  const admin = await openAdmin();
  if (!admin) return;
  const gate = await enrolmentGate(admin);
  if (!gate.open) return;
  const first = await loadFirstProject(admin, orgId);
  if (!first || first.id !== projectId) return;
  const estimateAt = await firstEstimateAt(admin, projectId);
  if (
    !quoteReminderStillDue({
      isFirstProject: true,
      projectDeleted: false,
      firstEstimateAtMs: estimateAt,
      quoteSent: await projectQuoteSent(admin, projectId),
      engagementActivatedAtMs: gate.engagementActivatedAtMs,
      reminderActivatedAtMs: gate.reminderActivatedAtMs,
    }) ||
    estimateAt == null
  ) {
    return;
  }
  const owner = await loadOwner(admin, orgId);
  if (!owner) return;
  const consentAtMs = Date.parse(owner.marketing_consent_at ?? "");
  if (
    !explicitConsentAllowsReminder({
      consent: owner.marketing_consent === true,
      consentSource: owner.marketing_consent_source,
      consentAtMs: Number.isFinite(consentAtMs) ? consentAtMs : null,
      engagementActivatedAtMs: gate.engagementActivatedAtMs,
    })
  ) {
    return;
  }
  const email = await ownerEmail(admin, owner.id);
  if (!email || !marketingLoopsAllowsEmail("production", email)) return;
  const markedAtMs = Date.parse(owner.marketing_engagement_marked_at ?? "");
  const dueAtMs = milestoneReminderDueAt({
    kind: "quote",
    milestoneAtMs: estimateAt,
    reservedSendTimes: await reservedSends(
      admin,
      orgId,
      Number.isFinite(markedAtMs) ? markedAtMs : null,
      { includeUnreleased: true }
    ),
  });
  await insertReminder(admin, {
    orgId,
    kind: "quote",
    recipientUserId: owner.id,
    dueAtMs,
    milestoneAtMs: estimateAt,
  });
}

async function considerTrialReminderForUser(userId: string): Promise<void> {
  const admin = await openAdmin();
  if (!admin) return;
  const gate = await enrolmentGate(admin);
  if (!gate.open) return;
  const { data: profile } = await admin
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle();
  const orgId = (profile?.org_id as string | null) ?? null;
  if (!orgId) return;
  const owner = await loadOwner(admin, orgId);
  if (!owner || owner.id !== userId) return;
  const plan = await readTrialPlan(admin, orgId, gate);
  if (!plan) return;
  const consentAtMs = Date.parse(owner.marketing_consent_at ?? "");
  if (
    !explicitConsentAllowsReminder({
      consent: owner.marketing_consent === true,
      consentSource: owner.marketing_consent_source,
      consentAtMs: Number.isFinite(consentAtMs) ? consentAtMs : null,
      engagementActivatedAtMs: gate.engagementActivatedAtMs,
    })
  ) {
    return;
  }
  const email = await ownerEmail(admin, owner.id);
  if (!email || !marketingLoopsAllowsEmail("production", email)) return;
  const markedAtMs = Date.parse(owner.marketing_engagement_marked_at ?? "");
  const dueAtMs = coordinatedSendAt(
    plan.dueAtMs,
    await reservedSends(admin, orgId, Number.isFinite(markedAtMs) ? markedAtMs : null, {
      includeUnreleased: true,
    })
  );
  await insertReminder(admin, {
    orgId,
    kind: "trial",
    recipientUserId: owner.id,
    dueAtMs,
    milestoneAtMs: plan.startedAtMs,
  });
}

async function suppressQuoteIfFirstProject(orgId: string, projectId: string): Promise<void> {
  const admin = await openAdmin();
  if (!admin) return;
  const gate = await enrolmentGate(admin);
  if (!gate.open) return;
  const first = await loadFirstProject(admin, orgId);
  if (!first || first.id !== projectId) return;
  const { error } = await admin
    .from("marketing_engagement_reminders")
    .update({ suppressed_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("kind", "quote")
    .is("released_at", null)
    .is("suppressed_at", null);
  if (error) logLoopsFailure("reminder_suppress_failed");
}

async function loadOnboarding(
  admin: Admin,
  orgId: string
): Promise<{ complete: boolean }> {
  const [{ data: settings }, work] = await Promise.all([
    admin
      .from("organisation_settings")
      .select("onboarding_status, onboarding_step")
      .eq("org_id", orgId)
      .maybeSingle(),
    admin
      .from("organisation_work_areas")
      .select("id")
      .eq("org_id", orgId)
      .eq("enabled", true)
      .limit(1),
  ]);
  return {
    complete: loopsOnboardingComplete({
      onboardingStatus: (settings?.onboarding_status as string | null) ?? null,
      onboardingStep: (settings?.onboarding_step as string | null) ?? null,
      hasPrimaryWorkAreas: (work.data?.length ?? 0) > 0,
    }),
  };
}

async function loadFirstProject(
  admin: Admin,
  orgId: string
): Promise<{ id: string; created_at: string } | null> {
  const { data, error } = await admin
    .from("projects")
    .select("id, created_at")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.length) return null;
  return data[0] as { id: string; created_at: string };
}

async function projectHasEstimate(admin: Admin, projectId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("estimate_requirement_snapshots")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);
  if (error) return true;
  return (data?.length ?? 0) > 0;
}

async function firstEstimateAt(admin: Admin, projectId: string): Promise<number | null> {
  const { data, error } = await admin
    .from("estimate_requirement_snapshots")
    .select("created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.length) return null;
  const parsed = Date.parse((data[0].created_at as string | null) ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

async function projectQuoteSent(admin: Admin, projectId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("quote_events")
    .select("id")
    .eq("project_id", projectId)
    .eq("event_type", "quote_sent")
    .limit(1);
  if (error) return true;
  return (data?.length ?? 0) > 0;
}

async function readTrialPlan(
  admin: Admin,
  orgId: string,
  gate: Extract<RuntimeGate, { open: true }>
): Promise<{ dueAtMs: number; startedAtMs: number; trialEndsAt: string } | null> {
  let billingEnvironment: "test" | "live";
  try {
    billingEnvironment = resolveBillingEnvironment(process.env);
  } catch {
    return null;
  }
  const { data: subscription, error } = await admin
    .from("org_subscriptions")
    .select("source, status, trial_ends_at, created_at")
    .eq("org_id", orgId)
    .eq("billing_environment", billingEnvironment)
    .maybeSingle();
  if (error || !subscription) return null;
  const { data: overrides } = await admin
    .from("org_billing_overrides")
    .select("status, starts_at, expires_at")
    .eq("org_id", orgId)
    .eq("billing_environment", billingEnvironment);
  const hasActiveOverride = (overrides ?? []).some((row) =>
    isBillingOverrideActive(
      {
        status: String(row.status),
        startsAt: row.starts_at as string,
        expiresAt: (row.expires_at as string | null) ?? null,
      },
      new Date()
    )
  );
  const startedAtMs = Date.parse((subscription.created_at as string | null) ?? "");
  const plan = trialReminderPlan({
    source: (subscription.source as string | null) ?? null,
    status: (subscription.status as string | null) ?? null,
    trialEndsAt: (subscription.trial_ends_at as string | null) ?? null,
    trialStartedAtMs: Number.isFinite(startedAtMs) ? startedAtMs : null,
    hasActiveOverride,
    nowMs: Date.now(),
    engagementActivatedAtMs: gate.engagementActivatedAtMs,
    reminderActivatedAtMs: gate.reminderActivatedAtMs,
  });
  if (!plan.ok) return null;
  return {
    dueAtMs: plan.dueAtMs,
    startedAtMs,
    trialEndsAt: subscription.trial_ends_at as string,
  };
}

type DueReminder = {
  id: string;
  org_id: string;
  kind: ReminderKind;
  recipient_user_id: string;
  due_at: string;
};

export async function releaseDueEngagementReminders(input: {
  admin: Admin;
  apiKey: string;
  limit: number;
}): Promise<{ released: number; postponed: number; suppressed: number }> {
  const empty = { released: 0, postponed: 0, suppressed: 0 };
  const gate = await enrolmentGate(input.admin);
  if (!gate.open) return empty;
  const { data, error } = await input.admin
    .from("marketing_engagement_reminders")
    .select("id, org_id, kind, recipient_user_id, due_at")
    .is("released_at", null)
    .is("suppressed_at", null)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(input.limit);
  if (error || !data) return empty;
  const counts = { ...empty };
  for (const row of data as DueReminder[]) {
    const outcome = await releaseOne(input.admin, input.apiKey, row, gate);
    counts[outcome] += 1;
  }
  return counts;
}

async function releaseOne(
  admin: Admin,
  apiKey: string,
  row: DueReminder,
  gate: Extract<RuntimeGate, { open: true }>
): Promise<"released" | "postponed" | "suppressed"> {
  const owner = await loadOwner(admin, row.org_id);
  if (!owner || owner.id !== row.recipient_user_id) {
    await markSuppressed(admin, row.id);
    return "suppressed";
  }
  const consentAtMs = Date.parse(owner.marketing_consent_at ?? "");
  if (
    !explicitConsentAllowsReminder({
      consent: owner.marketing_consent === true,
      consentSource: owner.marketing_consent_source,
      consentAtMs: Number.isFinite(consentAtMs) ? consentAtMs : null,
      engagementActivatedAtMs: gate.engagementActivatedAtMs,
    })
  ) {
    await markSuppressed(admin, row.id);
    return "suppressed";
  }
  const stillDue = await reminderStillDue(admin, row, gate);
  if (!stillDue) {
    await markSuppressed(admin, row.id);
    return "suppressed";
  }
  const markedAtMs = Date.parse(owner.marketing_engagement_marked_at ?? "");
  const reserved = await reservedSends(
    admin,
    row.org_id,
    Number.isFinite(markedAtMs) ? markedAtMs : null,
    { excludeReminderId: row.id }
  );
  const sendAt = coordinatedSendAt(Date.now(), reserved);
  if (sendAt > Date.now() + 60_000) {
    const { error } = await admin
      .from("marketing_engagement_reminders")
      .update({ due_at: new Date(sendAt).toISOString() })
      .eq("id", row.id)
      .is("released_at", null);
    if (error) logLoopsFailure("reminder_postpone_failed");
    return "postponed";
  }
  const email = await ownerEmail(admin, owner.id);
  if (!email || !marketingLoopsAllowsEmail("production", email)) {
    await markSuppressed(admin, row.id);
    return "suppressed";
  }
  const subscription = await readLoopsContactSubscription({ userId: owner.id, apiKey });
  if (subscription === "error" || subscription === "missing") return "postponed";
  if (subscription !== "subscribed") {
    await markSuppressed(admin, row.id);
    return "suppressed";
  }
  const onboarding = await loadOnboarding(admin, row.org_id);
  const properties: LoopsContactProperties = {
    email,
    userId: owner.id,
    marketingConsent: true,
    engagementReminder: row.kind,
    onboardingComplete: onboarding.complete,
  };
  if (row.kind === "trial") {
    const plan = await readTrialPlan(admin, row.org_id, gate);
    if (!plan) {
      await markSuppressed(admin, row.id);
      return "suppressed";
    }
    properties.trialEndsOn = formatTrialEndDate(plan.trialEndsAt);
  }
  const upsert = await upsertLoopsContact({
    properties,
    mode: "routine",
    marketingConsent: true,
    apiKey,
  });
  if (!upsert.ok || upsert.skipped === "unconfigured") return "postponed";
  const releasedAt = new Date().toISOString();
  const { error } = await admin
    .from("marketing_engagement_reminders")
    .update({ released_at: releasedAt })
    .eq("id", row.id)
    .is("released_at", null)
    .is("suppressed_at", null);
  if (error) {
    logLoopsFailure("reminder_release_failed");
    return "postponed";
  }
  return "released";
}

async function reminderStillDue(
  admin: Admin,
  row: DueReminder,
  gate: Extract<RuntimeGate, { open: true }>
): Promise<boolean> {
  if (row.kind === "setup") {
    const owner = await loadOwner(admin, row.org_id);
    const markedAtMs = Date.parse(owner?.marketing_engagement_marked_at ?? "");
    const consentAtMs = Date.parse(owner?.marketing_consent_at ?? "");
    const onboarding = await loadOnboarding(admin, row.org_id);
    return setupReminderStillDue({
      role: owner?.role ?? null,
      onboardingComplete: onboarding.complete,
      markedAtMs: Number.isFinite(markedAtMs) ? markedAtMs : null,
      engagementActivatedAtMs: gate.engagementActivatedAtMs,
      reminderActivatedAtMs: gate.reminderActivatedAtMs,
      consent: owner?.marketing_consent === true,
      consentSource: owner?.marketing_consent_source,
      consentAtMs: Number.isFinite(consentAtMs) ? consentAtMs : null,
    });
  }
  if (row.kind === "estimate" || row.kind === "quote") {
    const first = await loadFirstProject(admin, row.org_id);
    if (!first) return false;
    const createdAtMs = Date.parse(first.created_at);
    if (row.kind === "estimate") {
      return estimateReminderStillDue({
        isFirstProject: true,
        projectDeleted: false,
        projectCreatedAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
        hasEstimate: await projectHasEstimate(admin, first.id),
        engagementActivatedAtMs: gate.engagementActivatedAtMs,
        reminderActivatedAtMs: gate.reminderActivatedAtMs,
      });
    }
    return quoteReminderStillDue({
      isFirstProject: true,
      projectDeleted: false,
      firstEstimateAtMs: await firstEstimateAt(admin, first.id),
      quoteSent: await projectQuoteSent(admin, first.id),
      engagementActivatedAtMs: gate.engagementActivatedAtMs,
      reminderActivatedAtMs: gate.reminderActivatedAtMs,
    });
  }
  const plan = await readTrialPlan(admin, row.org_id, gate);
  return plan != null;
}

async function markSuppressed(admin: Admin, id: string): Promise<void> {
  const { error } = await admin
    .from("marketing_engagement_reminders")
    .update({ suppressed_at: new Date().toISOString() })
    .eq("id", id)
    .is("released_at", null);
  if (error) logLoopsFailure("reminder_suppress_failed");
}
