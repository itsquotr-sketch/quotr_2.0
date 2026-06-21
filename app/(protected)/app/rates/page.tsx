import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { RatesPageContent } from "@/components/rates/RatesPageContent";
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

  const state = await getRatesPageState();

  return (
    <>
      <PageHeader
        title="Rates"
        description="Set the rates Quotr uses to prepare quick estimates."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <RatesPageContent initialState={state} />
        </div>
      </div>
    </>
  );
}
