import { SettingsContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { BillingPageContent } from "@/components/billing/BillingPageContent";
import { buildBillingPageView } from "@/lib/billing/billing-page-view";
import { getOrgBillingState } from "@/lib/billing/server";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type BillingPageProps = {
  searchParams: Promise<{ checkout?: string; upgrade?: string }>;
};

export default async function BillingSettingsPage({
  searchParams,
}: BillingPageProps) {
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    redirect("/login");
  }

  const params = await searchParams;
  const checkout =
    params.checkout === "success" || params.checkout === "cancelled"
      ? params.checkout
      : null;
  const upgrade =
    params.upgrade === "pending" || params.upgrade === "payment"
      ? params.upgrade
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const state = await getOrgBillingState(auth.orgId);
  const view = buildBillingPageView(state);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Billing"
        description="Trial, plan, and subscription for this organisation."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <SettingsContainer>
        <BillingPageContent
          initialView={view}
          checkout={checkout}
          upgrade={upgrade}
        />
      </SettingsContainer>
    </div>
  );
}
