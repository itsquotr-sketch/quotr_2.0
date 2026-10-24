"use server";

import { z } from "zod";
import {
  deletionRequestResolution,
  normalizeDeletionEmail,
  publicDeletionAcknowledgement,
  type DeletionRequestRecord,
} from "@/lib/account-deletion/request";
import { presentAuthError } from "@/lib/auth/errors";
import { getOrgBillingState } from "@/lib/billing/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeletionActionState = {
  error?: string;
  acknowledgement?: string;
  record?: DeletionRequestRecord;
};

type StoredRequest = DeletionRequestRecord & {
  emailNormalized: string;
};

const publicSchema = z.object({
  email: z.email("Enter the account email."),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, "Current password is required."),
});

function storedFromRow(row: {
  identity_confirmed: boolean;
  resolution: string;
  other_active_member_count: number;
  issued_quote_count: number;
  subscription_status: string | null;
  email_normalized: string;
}): StoredRequest | null {
  if (row.resolution !== "recorded" && row.resolution !== "needs_support") return null;
  return {
    identityConfirmed: row.identity_confirmed,
    resolution: row.resolution,
    otherActiveMemberCount: row.other_active_member_count,
    issuedQuoteCount: row.issued_quote_count,
    subscriptionStatus: row.subscription_status,
    emailNormalized: row.email_normalized,
  };
}

async function readOpenRequest(emailNormalized: string): Promise<StoredRequest | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_deletion_requests")
    .select(
      "identity_confirmed, resolution, other_active_member_count, issued_quote_count, subscription_status, email_normalized"
    )
    .eq("email_normalized", emailNormalized)
    .eq("status", "open")
    .maybeSingle();
  if (error || !data) return null;
  return storedFromRow(data);
}

async function requestContext(userId: string): Promise<{
  otherActiveMemberCount: number;
  issuedQuoteCount: number;
  subscriptionStatus: string | null;
}> {
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("organisation_memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const orgId = membership?.org_id;
  if (!orgId) {
    return {
      otherActiveMemberCount: 0,
      issuedQuoteCount: 0,
      subscriptionStatus: null,
    };
  }

  const { count: otherCount } = await admin
    .from("organisation_memberships")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active")
    .neq("user_id", userId);
  const { count: issuedCount } = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("sent_at", "is", null);

  let subscriptionStatus: string | null = null;
  try {
    const billing = await getOrgBillingState(orgId);
    subscriptionStatus =
      billing.subscription?.status ?? billing.effectiveTrialState ?? null;
  } catch {
    subscriptionStatus = null;
  }

  return {
    otherActiveMemberCount: otherCount ?? 0,
    issuedQuoteCount: issuedCount ?? 0,
    subscriptionStatus,
  };
}

export async function loadSignedInDeletionRequest(): Promise<DeletionRequestRecord | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ? normalizeDeletionEmail(user.email) : null;
  if (!email) return null;
  try {
    const existing = await readOpenRequest(email);
    if (!existing) return null;
    return existing;
  } catch {
    return null;
  }
}

export async function submitSignedInDeletionRequest(
  _prev: DeletionActionState,
  formData: FormData
): Promise<DeletionActionState> {
  const parsed = passwordSchema.safeParse({
    current_password: formData.get("current_password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Current password is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ? normalizeDeletionEmail(user.email) : null;
  if (!user || !email) {
    return { error: presentAuthError("INVALID_CREDENTIALS") };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email ?? email,
    password: parsed.data.current_password,
  });
  if (reauthError) {
    return { error: "The current password was not accepted." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "The request could not be recorded. Email hello@get-quotr.com." };
  }

  const existing = await readOpenRequest(email);
  if (existing?.identityConfirmed && existing.emailNormalized === email) {
    return { record: existing };
  }

  const context = await requestContext(user.id);
  const resolution = deletionRequestResolution(context);
  const record: DeletionRequestRecord = {
    identityConfirmed: true,
    resolution,
    otherActiveMemberCount: context.otherActiveMemberCount,
    issuedQuoteCount: context.issuedQuoteCount,
    subscriptionStatus: context.subscriptionStatus,
  };

  const payload = {
    user_id: user.id,
    email_normalized: email,
    source: "signed_in" as const,
    identity_confirmed: true,
    resolution,
    status: "open" as const,
    other_active_member_count: context.otherActiveMemberCount,
    issued_quote_count: context.issuedQuoteCount,
    subscription_status: context.subscriptionStatus,
    updated_at: new Date().toISOString(),
  };

  const write = existing
    ? await admin
        .from("account_deletion_requests")
        .update(payload)
        .eq("email_normalized", email)
        .eq("status", "open")
    : await admin.from("account_deletion_requests").insert(payload);

  if (write.error) {
    const again = await readOpenRequest(email);
    if (again) return { record: again };
    return { error: "The request could not be recorded. Email hello@get-quotr.com." };
  }
  return { record };
}

export async function submitPublicDeletionRequest(
  _prev: DeletionActionState,
  formData: FormData
): Promise<DeletionActionState> {
  const parsed = publicSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter the account email." };
  }
  const email = normalizeDeletionEmail(parsed.data.email);
  if (!email) {
    return { error: "Enter the account email." };
  }

  const acknowledgement = publicDeletionAcknowledgement();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "The request could not be recorded. Email hello@get-quotr.com." };
  }

  const existing = await readOpenRequest(email);
  if (existing) {
    return { acknowledgement };
  }

  const { error } = await admin.from("account_deletion_requests").insert({
    email_normalized: email,
    source: "public",
    identity_confirmed: false,
    resolution: "recorded",
    status: "open",
    other_active_member_count: 0,
    issued_quote_count: 0,
    subscription_status: null,
  });
  if (error && error.code !== "23505") {
    return { error: "The request could not be recorded. Email hello@get-quotr.com." };
  }
  return { acknowledgement };
}
