import { redirect } from "next/navigation";
import { SetupRequiredForm } from "@/components/auth/SetupRequiredForm";
import {
  explicitFullNameFromUserMetadata,
  organisationNameFromUserMetadata,
  repairFieldValue,
  shouldProvisionSignupOrganisation,
  type PendingInviteKind,
} from "@/lib/auth/email-confirm-destination";
import { createAuthCorrelationId } from "@/lib/auth/logging";
import { POST_SIGNUP_DESTINATION } from "@/lib/auth/post-auth-navigation";
import { provisionOrganisationForCurrentUser } from "@/lib/auth/provisioning";
import { createClient } from "@/lib/supabase/server";

/**
 * Repair screen for a signed-in user with no organisation.
 * Ordinary signup metadata is applied once here, then onboarding continues.
 */
export default async function SetupRequiredPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.org_id) {
    redirect(POST_SIGNUP_DESTINATION);
  }

  let pendingInvite: PendingInviteKind = "none";
  const { data: pending } = await supabase.rpc(
    "lookup_pending_invitation_for_current_user"
  );
  const row = Array.isArray(pending) ? pending[0] : pending;
  const count = Number(row?.invite_count ?? 0);
  if (count > 1) pendingInvite = "multiple";
  else if (count === 1) pendingInvite = "one";

  if (pendingInvite !== "none") {
    redirect("/invite/continue");
  }

  const metadata = user.user_metadata as Record<string, unknown>;
  const organisationName = organisationNameFromUserMetadata(metadata);
  const fullName = explicitFullNameFromUserMetadata(metadata);

  if (
    shouldProvisionSignupOrganisation({
      hasOrg: false,
      pendingInvite,
      organisationName,
      fullName,
    }) &&
    organisationName &&
    fullName
  ) {
    const provisioned = await provisionOrganisationForCurrentUser(supabase, {
      organisationName,
      fullName,
      correlationId: createAuthCorrelationId(),
      userId: user.id,
      context: "signup",
    });
    if (provisioned.ok) {
      redirect(POST_SIGNUP_DESTINATION);
    }
    if (provisioned.category === "INVITE_PENDING") {
      redirect("/invite/continue");
    }
  }

  return (
    <SetupRequiredForm
      defaultFullName={repairFieldValue(fullName)}
      defaultOrganisationName={repairFieldValue(organisationName)}
    />
  );
}
