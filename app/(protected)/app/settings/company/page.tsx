import { notFound } from "next/navigation";
import { SettingsContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { CompanySettingsContent } from "@/components/settings/CompanySettingsContent";
import { measureServerLoad } from "@/lib/perf/timing";
import { getCompanySettings } from "@/lib/settings/company-actions";
import { createClient } from "@/lib/supabase/server";

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const settings = await measureServerLoad("company-settings", () =>
    getCompanySettings()
  );
  if (!settings) {
    notFound();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Company"
        description="Business profile, quote defaults, and branding for new pricing and quotes."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <SettingsContainer>
        <CompanySettingsContent
          initialSettings={settings}
          userEmail={user?.email}
          userFullName={profile?.full_name}
        />
      </SettingsContainer>
    </div>
  );
}
