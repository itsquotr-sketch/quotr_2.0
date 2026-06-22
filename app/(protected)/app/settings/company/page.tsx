import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { CompanySettingsContent } from "@/components/settings/CompanySettingsContent";
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

  const settings = await getCompanySettings();
  if (!settings) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Company settings"
        description="Organisation profile and default quote terms for new pricing and quotes."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <CompanySettingsContent
            initialSettings={settings}
            userEmail={user?.email}
            userFullName={profile?.full_name}
          />
        </div>
      </div>
    </>
  );
}
