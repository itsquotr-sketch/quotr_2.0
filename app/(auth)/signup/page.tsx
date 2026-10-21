import { lookupPublicInvitation } from "@/lib/team/public-invite";
import { isWellFormedInviteToken } from "@/lib/team/tokens";
import { SignupForm } from "@/components/auth/SignupForm";
import { readPendingSignupEmail } from "@/lib/auth/pending-signup-email";

type SignupPageProps = {
  searchParams: Promise<{ invite?: string; confirm?: string; reason?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const raw = params.invite ?? "";
  const inviteToken = isWellFormedInviteToken(raw) ? raw.trim() : "";
  let invitedEmail = "";
  if (inviteToken) {
    const invite = await lookupPublicInvitation(inviteToken);
    invitedEmail = invite?.emailDisplay?.trim() ?? "";
  }
  const pendingEmail = (await readPendingSignupEmail()) ?? "";

  return (
    <SignupForm
      inviteToken={inviteToken}
      invitedEmail={invitedEmail}
      confirmRequired={params.confirm === "required"}
      confirmLink={params.confirm === "link"}
      linkReason={params.reason === "session" ? "session" : "invalid"}
      pendingEmail={pendingEmail}
    />
  );
}
