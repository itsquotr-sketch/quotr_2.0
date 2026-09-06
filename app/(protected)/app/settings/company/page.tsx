import { notFound, redirect } from "next/navigation";
import { SettingsContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { CompanySettingsContent } from "@/components/settings/CompanySettingsContent";
import { measureServerLoad } from "@/lib/perf/timing";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { getCompanySettings } from "@/lib/settings/company-actions";
import {
  isMovedCompanyAdvancedSection,
  parseCompanySettingsSection,
} from "@/lib/setup/recommendation-destinations";
import { createClient } from "@/lib/supabase/server";
import { requireOrgPermission } from "@/lib/team/permission-server";

type CompanySettingsPageProps = {
  searchParams: Promise<{ section?: string }>;
};

export default async function CompanySettingsPage({
  searchParams,
}: CompanySettingsPageProps) {
  const params = await searchParams;
  if (isMovedCompanyAdvancedSection(params.section)) {
    redirect("/app/rates?section=defaults");
  }
  const initialSection =
    parseCompanySettingsSection(params.section) ?? "general";

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

  const auth = await getAuthOrgContext();
  const canEdit = auth
    ? (
        await requireOrgPermission({
          orgId: auth.orgId,
          userId: auth.user.id,
          permission: "company.edit",
        })
      ).ok
    : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Company"
        description="Company identity, contact details, tax, timezone, quotes, and branding."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <SettingsContainer>
        <CompanySettingsContent
          initialSettings={settings}
          userEmail={user?.email}
          userFullName={profile?.full_name}
          initialSection={initialSection}
          canEdit={canEdit}
        />
      </SettingsContainer>
    </div>
  );
}
