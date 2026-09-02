import { InviteContinueContent } from "@/components/invite/InviteContinueContent";
import { lookupPendingInvitationForCurrentUser } from "@/lib/team/public-invite";
import { createClient } from "@/lib/supabase/server";

export default async function InviteContinuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pending = user
    ? await lookupPendingInvitationForCurrentUser()
    : { kind: "none" as const };

  return (
    <InviteContinueContent
      kind={pending.kind}
      view={pending.kind === "one" ? pending.view : null}
      signedIn={Boolean(user)}
    />
  );
}
