import Link from "next/link";
import { lookupPublicInvitation } from "@/lib/team/public-invite";
import { isWellFormedInviteToken } from "@/lib/team/tokens";
import { SignupForm } from "@/components/auth/SignupForm";
import { readPendingSignupEmail } from "@/lib/auth/pending-signup-email";
import { PLAY_SURFACE_BILLING_NOTE } from "@/lib/android/play-surface";
import { isPlaySurfaceRequest } from "@/lib/android/play-surface.server";
import { LegalDocumentLinks } from "@/components/legal/LegalDocumentLinks";
import {
  AuthCard,
  AuthCardContent,
  AuthCardFooter,
  AuthCardHeader,
  authTextLinkClass,
} from "@/components/auth/AuthCard";

type SignupPageProps = {
  searchParams: Promise<{ invite?: string; confirm?: string; reason?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  if (await isPlaySurfaceRequest()) {
    return (
      <AuthCard>
        <AuthCardHeader
          title="Use an existing Quotr account"
          description={PLAY_SURFACE_BILLING_NOTE}
        />
        <AuthCardContent>
          <p className="text-sm text-muted-foreground">
            Sign in with the email and password for an account that already exists.
          </p>
        </AuthCardContent>
        <AuthCardFooter>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className={authTextLinkClass}>
              Sign in
            </Link>
          </p>
          <LegalDocumentLinks className="text-center" />
        </AuthCardFooter>
      </AuthCard>
    );
  }

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
