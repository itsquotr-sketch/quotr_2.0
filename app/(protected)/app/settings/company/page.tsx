import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { CompanySettingsContent } from "@/components/settings/CompanySettingsContent";
import { measureServerLoad } from "@/lib/perf/timing";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { getCompanySettings } from "@/lib/settings/company-actions";
import { getSetupState } from "@/lib/setup/actions";
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
    parseCompanySettingsSection(params.section) ?? "overview";

  const [settings, canEdit, setupState] = await Promise.all([
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
    getSetupState(),
  ]);

  if (!settings) {
    notFound();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Company"
        description="Business details, tax, work types, and documents."
      />
      <PageContainer innerClassName="py-4 sm:py-6">
        <CompanySettingsContent
          initialSettings={settings}
          initialSection={initialSection}
          canEdit={canEdit}
          setupState={setupState}
        />
      </PageContainer>
    </div>
  );
}
