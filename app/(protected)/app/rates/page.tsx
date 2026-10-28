import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { RatesPageContent } from "@/components/rates/RatesPageContent";
import { measureServerLoad } from "@/lib/perf/timing";
import { getRatesPageState } from "@/lib/rates/actions";
import { getCompanySettings } from "@/lib/settings/company-actions";
import { parseRatesSection } from "@/lib/setup/recommendation-destinations";
import { safeFlooringReturnPath } from "@/lib/estimate/flooring-pricing-recovery";

type RatesPageProps = {
  searchParams: Promise<{ section?: string; item?: string; returnTo?: string }>;
};

export default async function RatesPage({ searchParams }: RatesPageProps) {
  const params = await searchParams;
  const initialSection = parseRatesSection(params.section) ?? "overview";

  const [state, companySettings] = await Promise.all([
    measureServerLoad("rates", () => getRatesPageState()),
    getCompanySettings(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Rates"
        description="Company costs, Quotr benchmarks, and rates that still need a price."
        wrapDescription
        actions={<UserMenu className="hidden md:inline-flex" />}
      />
      <PageContainer>
        <RatesPageContent
          initialState={state}
          initialSection={initialSection}
          companySettings={companySettings}
          focusItemKey={params.item?.trim() || null}
          returnHref={safeFlooringReturnPath(params.returnTo)}
        />
      </PageContainer>
    </div>
  );
}
