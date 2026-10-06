import { AnalyticsView } from "@/components/analytics/analytics-view";
import { BillingAccessDenied } from "@/components/billing/BillingAccessDenied";
import { PageContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { loadAnalyticsPage } from "@/lib/analytics/load-analytics";
import { redirect } from "next/navigation";

type AnalyticsPageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const result = await loadAnalyticsPage(params.period);

  if (result.kind === "unauthenticated") {
    redirect("/login");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <PageHeader
        title="Analytics"
        description="Quotes and accepted work for this organisation. Accepted value is the contracted price ex GST, not cash received."
        wrapDescription
        alignWithContent
      />
      <PageContainer innerClassName="py-4 sm:py-6">
        {result.kind === "denied" ? (
          <BillingAccessDenied
            error={result.message}
            reasonCode={result.reasonCode}
            upgradeTarget={result.upgradeTarget}
          />
        ) : (
          <AnalyticsView view={result.view} upgrade={result.upgrade} />
        )}
      </PageContainer>
    </div>
  );
}
