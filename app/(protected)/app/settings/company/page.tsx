import { notFound, redirect } from "next/navigation";
import { FormContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { CompanySettingsContent } from "@/components/settings/CompanySettingsContent";
import { measureServerLoad } from "@/lib/perf/timing";
import { getAuthDisplayProfile } from "@/lib/security/auth-display";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { getCompanySettings } from "@/lib/settings/company-actions";
import {
  isMovedCompanyAdvancedSection,
  parseCompanySettingsSection,
} from "@/lib/setup/recommendation-destinations";
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

  const [settings, canEdit, display] = await Promise.all([
    measureServerLoad("company-settings", () => getCompanySettings()),
    (async () => {
      const auth = await getAuthOrgContext();
      if (!auth) return false;
      return (
        await requireOrgPermission({
          orgId: auth.orgId,
          userId: auth.user.id,
          permission: "company.edit",
        })
      ).ok;
    })(),
    getAuthDisplayProfile(),
  ]);

  if (!settings) {
    notFound();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Company"
        description="Company identity, contact details, tax, timezone, quotes, and branding."
        actions={<UserMenu />}
      />
      <FormContainer>
        <CompanySettingsContent
          initialSettings={settings}
          userEmail={display?.userEmail}
          userFullName={display?.fullName}
          initialSection={initialSection}
          canEdit={canEdit}
        />
      </FormContainer>
    </div>
  );
}
