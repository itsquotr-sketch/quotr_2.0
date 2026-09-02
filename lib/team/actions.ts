"use server";

import { revalidatePath } from "next/cache";
import { getOrgBillingState } from "@/lib/billing/server";
import { processClaimedSeatMutationForOrg } from "@/lib/billing/seat-queue-process";
import { canCreatePaidSeatInvitation as canCreatePaidSeatInvitationForBilling } from "@/lib/billing/seat-mutation-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { selfServiceUserLimit } from "@/lib/team/capacity";
import { isUsableInviteEmail, normalizeInviteEmail } from "@/lib/team/email-normalize";
import {
  sendOrganisationInviteEmail,
  inviteAcceptPath,
} from "@/lib/team/invite-email";
import { validateInviteRole } from "@/lib/team/invite-policy";
import { requireEntitlementAndPermission } from "@/lib/team/permission-server";
import { getAuthSiteOrigin } from "@/lib/auth/site-url";
import { generateInviteToken, hashInviteToken, isWellFormedInviteToken } from "@/lib/team/tokens";
import {
  buildTeamPageView,
  type TeamInvitationView,
  type TeamMemberView,
  type TeamPageView,
} from "@/lib/team/team-page-view";
import {
  isMembershipRole,
  mapLegacyProfileRole,
  type MembershipRole,
} from "@/lib/team/roles";
import { SEAT_PAYMENT_FAILED_MESSAGE } from "@/lib/team/seat-operations";
import {
  ownAcceptanceIssuesStripeMutation,
  SEAT_QUEUED_MESSAGE,
} from "@/lib/team/seat-queue";

export type TeamActionResult = { error?: string; success?: boolean; warning?: string };

const TEAM_PATH = "/app/settings/team";

function mapTeamRpcError(message: string | undefined): string {
  const m = (message ?? "").toUpperCase();
  if (m.includes("INVITE_OWNER_ONLY")) {
    return "Only the Owner can invite people. Additional users are billed.";
  }
  if (m.includes("SEAT_LIMIT")) {
    return "This Business account already has 5 people including pending invitations.";
  }
  if (m.includes("INVITE_NOT_AVAILABLE")) {
    return "Team members are available on Quotr Business after you subscribe.";
  }
  if (m.includes("INVALID_EMAIL")) return "Enter a valid email address.";
  if (m.includes("INVALID_ROLE")) return "Choose Admin, Estimator, or Viewer.";
  if (m.includes("EMAIL_MISMATCH")) {
    return "Sign in with the email this invitation was sent to.";
  }
  if (m.includes("EMAIL_UNVERIFIED")) {
    return "Confirm your email before joining this company.";
  }
  if (m.includes("INVITE_EXPIRED")) return "This invitation has expired.";
  if (m.includes("INVITE_NOT_PENDING") || m.includes("INVITE_NOT_FOUND")) {
    return "This invitation is no longer valid.";
  }
  if (m.includes("ALREADY_IN_OTHER_ORG")) {
    return "This email already belongs to a different Quotr company. A person can only be in one company.";
  }
  if (m.includes("OWNER_CANNOT_BE_REMOVED") || m.includes("OWNER_ROLE_LOCKED")) {
    return "The Owner cannot be removed or changed in this version.";
  }
  if (m.includes("REMOVE_OWNER_ONLY")) {
    return "Only the Owner can remove people from this company.";
  }
  if (m.includes("PENDING_INVITATION")) {
    return "You have an invitation to join a company. Open the invite link instead of creating a new company.";
  }
  if (m.includes("SUBSCRIPTION_SCHEDULED_TO_CANCEL")) {
    return "This subscription is scheduled to end. Resume your Business subscription before adding another user.";
  }
  if (m.includes("BILLING_NOT_ACTIVE")) {
    return "Your Business subscription needs to be active before you can add another user.";
  }
  if (m.includes("SEAT_IN_FLIGHT")) {
    return "This seat is being billed. Wait until it finishes, then you can remove the person.";
  }
  return "That team action could not be completed. Try again.";
}

export async function getTeamPageState(): Promise<TeamPageView | { error: string }> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Your organisation profile could not be loaded." };
  }
  const permitted = await requireEntitlementAndPermission({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "team.view",
  });
  if (!permitted.ok) {
    return { error: permitted.error };
  }

  const state = await getOrgBillingState(context.orgId);
  const trial =
    state.subscription?.source === "internal_trial" &&
    state.effectiveTrialState === "trialing";
  const planCode = state.activeOverride?.planCode ?? state.subscription?.planCode ?? null;

  const { data: memberRows, error: memberError } = await context.supabase.rpc(
    "list_organisation_team_v1"
  );
  const { data: inviteRows } = await context.supabase.rpc(
    "list_organisation_invitations_v1"
  );

  const members: TeamMemberView[] = [];
  if (!memberError && Array.isArray(memberRows)) {
    for (const row of memberRows) {
      const role = isMembershipRole(row.role) ? row.role : mapLegacyProfileRole(row.role);
      members.push({
        membershipId: row.membership_id,
        userId: row.user_id,
        fullName: row.full_name?.trim() || row.email_display || "Teammate",
        email: row.email_display ?? "",
        role,
        status: row.status === "pending_billing" ? "pending_billing" : "active",
        isOwner: role === "owner",
        isSelf: row.user_id === context.user.id,
      });
    }
  } else {
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("org_id", context.orgId);
    for (const profile of profiles ?? []) {
      const role = mapLegacyProfileRole(profile.role);
      members.push({
        membershipId: profile.id,
        userId: profile.id,
        fullName: profile.full_name?.trim() || "You",
        email: context.user.email ?? "",
        role,
        status: "active",
        isOwner: role === "owner",
        isSelf: profile.id === context.user.id,
      });
    }
  }

  const invitations: TeamInvitationView[] = Array.isArray(inviteRows)
    ? inviteRows.map((row) => ({
        invitationId: row.invitation_id,
        email: row.email_display,
        role: isMembershipRole(row.role) ? row.role : "estimator",
        status: row.status,
        expiresAt: row.expires_at,
      }))
    : [];

  const snapshot = {
    activeMemberCount: members.filter((m) => m.status === "active").length,
    pendingBillingCount: members.filter((m) => m.status === "pending_billing").length,
    validPendingInviteCount: invitations.filter((i) => i.status === "pending").length,
  };

  return buildTeamPageView({
    planCode,
    trial,
    actorRole: permitted.role,
    members,
    invitations,
    snapshot,
    selfServiceLimit: selfServiceUserLimit(planCode, { trial }),
  });
}

export async function inviteTeamMember(input: {
  email: string;
  role: string;
}): Promise<TeamActionResult> {
  const context = await getAuthOrgContext();
  if (!context) return { error: "Your organisation profile could not be loaded." };

  const composed = await requireEntitlementAndPermission({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "team.invite",
    entitlement: "team.invite",
  });
  if (!composed.ok) return { error: composed.error };
  if (composed.role !== "owner") {
    return { error: "Only the Owner can invite people. Additional users are billed." };
  }

  const roleCheck = validateInviteRole(input.role);
  if (!roleCheck.ok) return { error: roleCheck.errorSafe };
  if (!isUsableInviteEmail(input.email)) {
    return { error: "Enter a valid email address." };
  }

  const billingGate = canCreatePaidSeatInvitationForBilling(
    await getOrgBillingState(context.orgId)
  );
  if (!billingGate.ok) {
    return { error: billingGate.errorSafe };
  }

  const rawToken = generateInviteToken();
  const { data, error } = await context.supabase.rpc("create_organisation_invitation_v1", {
    p_email: input.email.trim(),
    p_role: input.role,
    p_token_hash: hashInviteToken(rawToken),
  });
  if (error) {
    return { error: mapTeamRpcError(error.message) };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const origin = await getAuthSiteOrigin();
  const acceptUrl = `${origin}${inviteAcceptPath(rawToken)}`;
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", context.user.id)
    .maybeSingle();
  const { data: organisation } = await context.supabase
    .from("organisations")
    .select("name")
    .eq("id", context.orgId)
    .maybeSingle();

  const emailed = await sendOrganisationInviteEmail({
    to: normalizeInviteEmail(input.email),
    organisationName: organisation?.name ?? "Quotr",
    inviterName: profile?.full_name?.trim() || "A teammate",
    role: input.role as MembershipRole,
    acceptUrl,
    expiresAt: row?.expires_at ? new Date(row.expires_at) : new Date(),
    idempotencyKey: `invite:${context.orgId}:${row?.invitation_id ?? "unknown"}`,
  });

  revalidatePath(TEAM_PATH);
  if (!emailed.ok) {
    return {
      success: true,
      warning: `Invitation saved, but the email could not be sent. ${emailed.errorSafe}`,
    };
  }
  return { success: true };
}

export async function cancelTeamInvitation(
  invitationId: string
): Promise<TeamActionResult> {
  const context = await getAuthOrgContext();
  if (!context) return { error: "Your organisation profile could not be loaded." };
  const composed = await requireEntitlementAndPermission({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "team.invite",
    entitlement: "team.invite",
  });
  if (!composed.ok) return { error: composed.error };
  const { error } = await context.supabase.rpc("cancel_organisation_invitation_v1", {
    p_invitation_id: invitationId,
  });
  if (error) return { error: mapTeamRpcError(error.message) };
  revalidatePath(TEAM_PATH);
  return { success: true };
}

export async function changeTeamMemberRole(input: {
  membershipId: string;
  role: string;
}): Promise<TeamActionResult> {
  const context = await getAuthOrgContext();
  if (!context) return { error: "Your organisation profile could not be loaded." };
  const composed = await requireEntitlementAndPermission({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "team.change_role",
    entitlement: "team.roles",
  });
  if (!composed.ok) return { error: composed.error };
  const { error } = await context.supabase.rpc("change_organisation_member_role_v1", {
    p_membership_id: input.membershipId,
    p_next_role: input.role,
  });
  if (error) return { error: mapTeamRpcError(error.message) };
  revalidatePath(TEAM_PATH);
  return { success: true };
}

export async function removeTeamMember(membershipId: string): Promise<TeamActionResult> {
  const context = await getAuthOrgContext();
  if (!context) return { error: "Your organisation profile could not be loaded." };
  const composed = await requireEntitlementAndPermission({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "team.remove",
    entitlement: "team.manage",
  });
  if (!composed.ok) return { error: composed.error };

  const { data, error } = await context.supabase.rpc("remove_organisation_member_v1", {
    p_membership_id: membershipId,
  });
  if (error) return { error: mapTeamRpcError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.operation_id && row.operation_status === "pending") {
    try {
      await processClaimedSeatMutationForOrg(context.orgId, {
        onlyMembershipId: membershipId,
      });
    } catch {
      // Access is already revoked. Stripe decrement stays queued.
    }
  }
  revalidatePath(TEAM_PATH);
  return { success: true };
}

type BeginAcceptanceRow = {
  membership_id: string;
  invitation_id: string;
  org_id: string;
  desired_paid_seat_quantity: number;
  already_member: boolean;
  operation_id: string | null;
  operation_status: string | null;
};

export async function acceptInvitation(rawToken: string): Promise<TeamActionResult> {
  if (!isWellFormedInviteToken(rawToken)) {
    return { error: "This invitation link is invalid." };
  }
  const contextClient = await import("@/lib/supabase/server").then((m) => m.createClient());
  const supabase = await contextClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in to accept this invitation." };
  }

  const { data, error } = await supabase.rpc("begin_invitation_acceptance_v1", {
    p_token_hash: hashInviteToken(rawToken),
  });
  if (error) return { error: mapTeamRpcError(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as BeginAcceptanceRow | undefined;
  if (!row) return { error: "This invitation could not be accepted." };
  if (row.already_member) {
    return { success: true };
  }
  return finalizeSeatActivation(row);
}

export async function acceptPendingInvitationForCurrentUser(): Promise<TeamActionResult> {
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to accept this invitation." };
  const { data, error } = await supabase.rpc(
    "begin_invitation_acceptance_for_current_user"
  );
  if (error) return { error: mapTeamRpcError(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as BeginAcceptanceRow | undefined;
  if (!row) return { error: "No invitation is waiting for this email." };
  if (row.already_member) return { success: true };
  return finalizeSeatActivation(row);
}

async function finalizeSeatActivation(
  row: BeginAcceptanceRow
): Promise<TeamActionResult> {
  if (!row.operation_id) {
    return { error: SEAT_PAYMENT_FAILED_MESSAGE };
  }

  const status = row.operation_status ?? "queued";
  if (status === "failed" || status === "awaiting_payment") {
    return { error: SEAT_PAYMENT_FAILED_MESSAGE };
  }
  if (!ownAcceptanceIssuesStripeMutation(status)) {
    return { success: true, warning: SEAT_QUEUED_MESSAGE };
  }

  const processed = await processClaimedSeatMutationForOrg(row.org_id, {
    onlyMembershipId: row.membership_id,
  });
  if (processed.outcome === "skipped_other" || processed.outcome === "deferred") {
    return { success: true, warning: SEAT_QUEUED_MESSAGE };
  }
  if (processed.outcome === "failed") {
    return { error: SEAT_PAYMENT_FAILED_MESSAGE };
  }

  const admin = createAdminClient();
  const activated = await admin.rpc("activate_membership_if_seats_paid_v1", {
    p_membership_id: row.membership_id,
  });
  if (activated.data === true) {
    return { success: true };
  }

  const { data: completed } = await (
    await import("@/lib/supabase/server")
  )
    .createClient()
    .then((client) => client.rpc("complete_own_pending_membership_v1"));
  if (completed === true) {
    return { success: true };
  }
  return { success: true, warning: SEAT_QUEUED_MESSAGE };
}

export async function retryOwnSeatActivation(): Promise<TeamActionResult> {
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data, error } = await supabase.rpc("complete_own_pending_membership_v1");
  if (error) return { error: mapTeamRpcError(error.message) };
  if (data === true) return { success: true };

  const { data: beginData, error: beginError } = await supabase.rpc(
    "begin_invitation_acceptance_for_current_user"
  );
  if (beginError) return { error: mapTeamRpcError(beginError.message) };
  const row = (Array.isArray(beginData) ? beginData[0] : beginData) as
    | BeginAcceptanceRow
    | undefined;
  if (!row) return { error: SEAT_PAYMENT_FAILED_MESSAGE };
  if (row.already_member) return { success: true };
  return finalizeSeatActivation(row);
}
