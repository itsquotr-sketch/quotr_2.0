/**
 * Production-only enrolment marker for the unpublished engagement sequence.
 * The marker is sent once, after explicit consent is recorded at or after
 * the activation time. This module does not set that time.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoopsContactDraft } from "@/lib/communications/contact-mapping";
import {
  loopsEngagementEligibleUpdate,
  marketingLoopsScope,
} from "@/lib/communications/loops-automation";
import { logLoopsFailure } from "@/lib/communications/loops-client";
import { noteSetupReminder } from "@/lib/communications/reminder-schedule";

export async function attachEngagementMarker(
  admin: SupabaseClient,
  draft: LoopsContactDraft
): Promise<void> {
  if (await engagementMarkerDue(admin, draft)) draft.engagementEligible = true;
}

export async function recordEngagementMarker(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { data, error } = await admin
    .from("profiles")
    .update({ marketing_engagement_eligible: true })
    .eq("id", userId)
    .eq("marketing_engagement_eligible", false)
    .select("id");
  if (error || !data?.length) {
    if (error) logLoopsFailure("engagement_marker_failed");
    return;
  }
  const marked = await admin
    .from("profiles")
    .update({ marketing_engagement_marked_at: new Date().toISOString() })
    .eq("id", userId)
    .is("marketing_engagement_marked_at", null);
  if (marked.error) {
    logLoopsFailure("engagement_marker_failed");
    return;
  }
  noteSetupReminder(userId);
}

async function engagementMarkerDue(
  admin: SupabaseClient,
  draft: LoopsContactDraft
): Promise<boolean> {
  const scope = marketingLoopsScope(process.env);
  if (scope !== "production") return false;

  const runtime = await admin
    .from("marketing_engagement_runtime")
    .select("activated_at")
    .eq("id", true)
    .maybeSingle();
  if (runtime.error || !runtime.data) return false;

  const profile = await admin
    .from("profiles")
    .select("marketing_consent_source, marketing_consent_at, marketing_engagement_eligible")
    .eq("id", draft.userId)
    .maybeSingle();
  if (profile.error || !profile.data) return false;

  return loopsEngagementEligibleUpdate({
    scope,
    activatedAt: runtime.data.activated_at,
    consent: draft.marketingConsent,
    consentSource: profile.data.marketing_consent_source,
    consentAt: profile.data.marketing_consent_at,
    alreadyEligible: profile.data.marketing_engagement_eligible === true,
  });
}
