import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PeriodFilters } from "@/components/analytics/period-filters";
import { AnalyticsScrollFrame } from "@/components/analytics/scroll-frame";
import { BillingAccessDenied } from "@/components/billing/BillingAccessDenied";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { loadAnalyticsPage } from "@/lib/analytics/load-analytics";
import { redirect } from "next/navigation";

type AnalyticsPageProps = {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const result = await loadAnalyticsPage(params.period, {
    from: params.from,
    to: params.to,
  });

  if (result.kind === "unauthenticated") {
    redirect("/login");
  }

  return (
    <AnalyticsScrollFrame>
      <PageHeader
        title="Analytics"
        description="Estimates, quotes, and accepted work for this organisation. Accepted value is the contracted price ex GST, not cash received."
        wrapDescription
        alignWithContent
      />
      <PageContainer innerClassName="py-3 sm:py-6">
        {result.kind === "denied" ? (
          <BillingAccessDenied
            error={result.message}
            reasonCode={result.reasonCode}
            upgradeTarget={result.upgradeTarget}
          />
        ) : result.kind === "invalid_range" ? (
          <PeriodFilters
            periodId="custom"
            periodLabel="Custom range"
            periodRange="Choose a valid range"
            from={params.from ?? null}
            to={params.to ?? null}
            timeZone={result.timeZone}
            rangeError={result.error}
          />
        ) : (
          <AnalyticsView view={result.view} upgrade={result.upgrade} />
        )}
      </PageContainer>
    </AnalyticsScrollFrame>
  );
}
