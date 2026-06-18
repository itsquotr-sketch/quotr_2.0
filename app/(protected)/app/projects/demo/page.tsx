import { AssistantShell } from "@/components/assistant/AssistantShell";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { buildDemoAssistantState } from "@/lib/assistant/mock-seed";
import { createClient } from "@/lib/supabase/server";

export default async function DemoProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const demoState = buildDemoAssistantState();

  return (
    <>
      <PageHeader
        title="Deck & pergola estimate"
        description="Project assistant (demo)"
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <div className="flex-1 overflow-auto overflow-x-hidden">
        <AssistantShell initialState={demoState} />
      </div>
    </>
  );
}
