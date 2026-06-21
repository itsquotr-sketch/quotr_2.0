import { PricingWorkspace } from "@/components/pricing/PricingWorkspace";
import { UserMenu } from "@/components/layout/user-menu";
import { getPricingWorkspaceData } from "@/lib/pricing/actions";
import { createClient } from "@/lib/supabase/server";

type PricingPageProps = {
  params: Promise<{ projectId: string; pricingId: string }>;
};

export default async function PricingPage({ params }: PricingPageProps) {
  const { projectId, pricingId } = await params;
  const data = await getPricingWorkspaceData(projectId, pricingId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-end px-4 py-4 sm:px-6 lg:px-8">
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        </div>
      </header>

      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PricingWorkspace initialData={data} />
        </div>
      </div>
    </div>
  );
}
