import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { RatesPageContent } from "@/components/rates/RatesPageContent";
import { measureServerLoad } from "@/lib/perf/timing";
import { getRatesPageState } from "@/lib/rates/actions";
import { createClient } from "@/lib/supabase/server";

export default async function RatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const state = await measureServerLoad("rates", () => getRatesPageState());

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Rates"
        description="Set the rates Quotr uses to prepare estimates."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <PageContainer>
        <RatesPageContent initialState={state} />
      </PageContainer>
    </div>
  );
}
