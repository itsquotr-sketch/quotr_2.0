import { InviteAcceptContent } from "@/components/invite/InviteAcceptContent";
import { lookupPublicInvitation } from "@/lib/team/public-invite";
import { createClient } from "@/lib/supabase/server";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InviteTokenPage({ params }: InvitePageProps) {
  const { token } = await params;
  const invitation = await lookupPublicInvitation(token);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <InviteAcceptContent
      token={token}
      invitation={invitation}
      signedIn={Boolean(user)}
      signedInEmail={user?.email ?? undefined}
    />
  );
}
