import { SetupShell } from "@/components/setup/SetupShell";
import { getSetupState } from "@/lib/setup/actions";
import { createClient } from "@/lib/supabase/server";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const state = await getSetupState();

  return (
    <SetupShell
      initialState={state}
      userEmail={user?.email}
      fullName={profile?.full_name}
    />
  );
}
