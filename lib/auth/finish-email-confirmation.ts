import { createServerClient } from "@supabase/ssr";
import {
  explicitFullNameFromUserMetadata,
  organisationNameFromUserMetadata,
  resolveEmailConfirmDestination,
  shouldProvisionSignupOrganisation,
  type PendingInviteKind,
} from "@/lib/auth/email-confirm-destination";
import { isAccountWelcomeEligible } from "@/lib/auth/account-welcome";
import { scheduleAccountWelcomeEmail } from "@/lib/auth/account-welcome-delivery";
import { confirmedSignupLoopsEligible } from "@/lib/communications/loops-automation";
import { scheduleConfirmedSignupLoopsSync } from "@/lib/communications/signup-sync";
import { provisionOrganisationForCurrentUser } from "@/lib/auth/provisioning";
import { recordSignupPreferences } from "@/lib/auth/signup-preferences";

type ConfirmationClient = ReturnType<typeof createServerClient>;
type ConfirmationUser = NonNullable<
  Awaited<ReturnType<ConfirmationClient["auth"]["getUser"]>>["data"]["user"]
>;

/**
 * Where a verified signup session goes. An unconfirmed user is signed out
 * and returned to the check-email screen. This does not treat some other
 * browser session as confirmation.
 */
export async function destinationAfterEmailConfirmation(
  supabase: ConfirmationClient,
  user: ConfirmationUser,
  next: string,
  correlationId: string
): Promise<string> {
  if (!user.email_confirmed_at && !next.startsWith("/reset-password")) {
    await supabase.auth.signOut();
    return "/signup?confirm=required";
  }

  if (next.startsWith("/reset-password")) return "/reset-password";
  if (next.startsWith("/invite/")) {
    await recordSignupPreferences(
      supabase,
      user.user_metadata as Record<string, unknown>
    );
    return next;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  let hasOrg = Boolean(profile?.org_id);
  if (hasOrg && profile?.org_id) {
    const { data: organisation } = await supabase
      .from("organisations")
      .select("id")
      .eq("id", profile.org_id)
      .maybeSingle();
    hasOrg = Boolean(organisation);
  }

  let pendingInvite: PendingInviteKind = "none";
  if (!hasOrg) {
    const { data: pending } = await supabase.rpc(
      "lookup_pending_invitation_for_current_user"
    );
    const row = Array.isArray(pending) ? pending[0] : pending;
    const count = Number(row?.invite_count ?? 0);
    if (count > 1) pendingInvite = "multiple";
    else if (count === 1) pendingInvite = "one";
  }

  let provisioned = false;
  let welcomeUserId: string | null = null;
  let welcomeOrgId: string | null = null;
  const metadata = user.user_metadata as Record<string, unknown>;
  const orgName = organisationNameFromUserMetadata(metadata);
  const fullName = explicitFullNameFromUserMetadata(metadata);
  if (
    shouldProvisionSignupOrganisation({
      hasOrg,
      pendingInvite,
      organisationName: orgName,
      fullName,
    }) &&
    orgName &&
    fullName
  ) {
    const result = await provisionOrganisationForCurrentUser(
      supabase as never,
      {
        organisationName: orgName,
        fullName,
        correlationId,
        userId: user.id,
        context: "signup",
      }
    );
    provisioned = result.ok;
    if (result.ok && result.alreadyProvisioned === false) {
      welcomeUserId = result.profileId;
      welcomeOrgId = result.orgId;
    }
    if (result.ok === false && result.category === "INVITE_PENDING") {
      pendingInvite = "one";
    }
  }

  if (hasOrg || provisioned) {
    await recordSignupPreferences(supabase, metadata);
  }

  const destination = resolveEmailConfirmDestination({
    next,
    hasOrg,
    pendingInvite,
    provisioned,
  });

  if (
    welcomeUserId &&
    welcomeOrgId &&
    isAccountWelcomeEligible({
      trigger: "signup_confirmation",
      emailConfirmed: Boolean(user.email_confirmed_at),
      newlyProvisioned: true,
      destination,
    })
  ) {
    try {
      await scheduleAccountWelcomeEmail({
        userId: welcomeUserId,
        orgId: welcomeOrgId,
      });
    } catch {
      // The welcome row stays available for its own retry.
    }
  }

  if (
    welcomeUserId &&
    confirmedSignupLoopsEligible({
      emailConfirmed: Boolean(user.email_confirmed_at),
      newlyProvisioned: true,
      destination,
    })
  ) {
    try {
      await scheduleConfirmedSignupLoopsSync({
        userId: welcomeUserId,
        email: user.email ?? "",
      });
    } catch {
      // Consent stays pending. The welcome email is unaffected.
    }
  }

  return destination;
}
