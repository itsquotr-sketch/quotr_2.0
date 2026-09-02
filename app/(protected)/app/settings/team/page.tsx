import { SettingsContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { TeamPageContent } from "@/components/team/TeamPageContent";
import { getTeamPageState } from "@/lib/team/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const state = await getTeamPageState();
  if ("error" in state) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader
          title="Team"
          description="People in this Quotr account."
          actions={
            <UserMenu userEmail={user.email} fullName={profile?.full_name} />
          }
        />
        <SettingsContainer>
          <p className="text-sm text-muted-foreground">{state.error}</p>
        </SettingsContainer>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Team"
        description="People in this Quotr account."
        actions={
          <UserMenu userEmail={user.email} fullName={profile?.full_name} />
        }
      />
      <SettingsContainer>
        <TeamPageContent view={state} />
      </SettingsContainer>
    </div>
  );
}
