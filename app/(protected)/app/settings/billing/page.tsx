import { SettingsContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { BillingPageContent } from "@/components/billing/BillingPageContent";
import { buildBillingPageView } from "@/lib/billing/billing-page-view";
import { getOrgBillingState } from "@/lib/billing/server";
import { measureServerLoad } from "@/lib/perf/timing";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
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

  // Identity chrome comes from AppShell. Billing state is the same
  // request-scoped helper layout already resolved — do not re-read auth.
  const [params, state] = await Promise.all([
    searchParams,
    measureServerLoad("billing", () => getOrgBillingState(auth.orgId)),
  ]);
  const checkout =
    params.checkout === "success" || params.checkout === "cancelled"
      ? params.checkout
      : null;
  const upgrade =
    params.upgrade === "pending" || params.upgrade === "payment"
      ? params.upgrade
      : null;

  const view = buildBillingPageView(state);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Billing"
        description="Trial, plan, and subscription for this organisation."
        actions={<UserMenu />}
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
