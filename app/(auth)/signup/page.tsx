import { lookupPublicInvitation } from "@/lib/team/public-invite";
import { isWellFormedInviteToken } from "@/lib/team/tokens";
import { SignupForm } from "@/components/auth/SignupForm";

type SignupPageProps = {
  searchParams: Promise<{ invite?: string }>;
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

  return (
    <SignupForm inviteToken={inviteToken} invitedEmail={invitedEmail} />
  );
}
