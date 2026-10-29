import { PricingWorkspace } from "@/components/pricing/PricingWorkspace";
import { RateReconciliationNotice } from "@/components/pricing/RateReconciliationNotice";
import {
  WorkspaceHeaderBar,
  WorkspacePage,
} from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectWorkspaceNav } from "@/components/projects/ProjectWorkspaceNav";
import { SetupGuidanceServerBanner } from "@/components/setup/SetupGuidanceServerBanner";
import { measureServerLoad } from "@/lib/perf/timing";
import { formatMissingPriceLines } from "@/lib/assistant/presentation/estimate-issues";
import { pricingItemViewModel } from "@/lib/pricing/financial-view-model";
import {
  getPricingWorkspaceDataWithContext,
  getProjectWorkspaceTabContextWithContext,
} from "@/lib/pricing/pricing-loaders";
import { getQuoteSummaryForPricingDocument } from "@/lib/quotes/actions";
import { getLatestQuoteSummaryWithContext } from "@/lib/quotes/quote-loaders";
import { projectSectionContext } from "@/lib/projects/project-information";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { getOnboardingAccess } from "@/lib/setup/actions";
import { loadPendingRateReconciliations, loadSupplierPriceReview } from "@/lib/subcontractors/rate-use-actions";
import { loadScheduleScopeReview } from "@/lib/rfqs/schedule-scope-gaps";
import { memberCanEditPricing } from "@/lib/team/permissions";
import {
  MANUAL_PRICING_AFTER_QUOTE_NOTICE,
  MANUAL_PRICING_FOLD_NOTICE,
} from "@/lib/work-areas/manual-pricing-route";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type PricingPageProps = {
  params: Promise<{ projectId: string; pricingId: string }>;
  searchParams: Promise<{ handoff?: string }>;
};

export default async function PricingPage({ params, searchParams }: PricingPageProps) {
  await connection();
  const { projectId, pricingId } = await params;
  const { handoff } = await searchParams;
  const handoffNotice =
    handoff === "fold"
      ? MANUAL_PRICING_FOLD_NOTICE
      : handoff === "after-quote"
        ? MANUAL_PRICING_AFTER_QUOTE_NOTICE
        : null;

  const pageData = await measureServerLoad("pricing", async () => {
    const auth = await requireAuthOrgContext();
    if (!auth.ok) {
      notFound();
    }

    const [data, project, tabContext, quoteSummaryForDoc, quoteSummary, access, rateReconciliation, supplierReview, scopeReview] =
      await Promise.all([
        getPricingWorkspaceDataWithContext(auth, projectId, pricingId),
        getProjectWithContext(auth, projectId),
        getProjectWorkspaceTabContextWithContext(auth, projectId),
        getQuoteSummaryForPricingDocument(pricingId),
        getLatestQuoteSummaryWithContext(auth, projectId),
        getOnboardingAccess(),
        loadPendingRateReconciliations(pricingId),
        loadSupplierPriceReview(projectId, pricingId),
        loadScheduleScopeReview(auth.supabase, auth.orgId, pricingId),
      ]);

    return { data, project, tabContext, quoteSummaryForDoc, quoteSummary, access, rateReconciliation, supplierReview, scopeReview };
  });

  const { data, project, tabContext, quoteSummaryForDoc, quoteSummary, access, rateReconciliation, supplierReview, scopeReview } =
    pageData;

  const missingPriceLineCount = data.items.filter(
    (item) => pricingItemViewModel(item).pricingRequired
  ).length;

  const pricingChangedAfterQuote =
    quoteSummaryForDoc != null &&
    new Date(data.document.updated_at).getTime() >
      new Date(quoteSummaryForDoc.created_at).getTime();

  return (
    <WorkspacePage
      header={
        <WorkspaceHeaderBar
          actions={<UserMenu className="hidden md:inline-flex" />}
        >
          <ProjectWorkspaceHeader
            project={project}
            subtitle={
              missingPriceLineCount > 0
                ? formatMissingPriceLines(missingPriceLineCount)
                : "Final pricing"
            }
          />
        </WorkspaceHeaderBar>
      }
      nav={
        <ProjectWorkspaceNav
          projectId={projectId}
          activeTab="pricing"
          projectContext={projectSectionContext(project)}
          pricingSummary={{
            id: pricingId,
            status: data.document.status,
          }}
          quoteSummary={quoteSummaryForDoc ?? quoteSummary}
          hasEstimate={tabContext.hasEstimate}
          estimateIsStale={tabContext.estimateIsStale}
          quantityConflictDetail={tabContext.quantityConflictDetail}
          missingPriceLineCount={missingPriceLineCount}
          scopeCoverageGapCount={tabContext.scopeCoverageGapCount}
          pricingUnresolvedRequired={missingPriceLineCount > 0}
        />
      }
      contentClassName="bg-muted/30"
    >
      <SetupGuidanceServerBanner dimension="pricing" />
      {handoffNotice ? (
        <p
          className="mb-4 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
          data-manual-pricing-handoff={handoff}
        >
          {handoffNotice}
        </p>
      ) : null}
      <RateReconciliationNotice
        projectId={projectId}
        pricingDocumentId={pricingId}
        pending={rateReconciliation}
        canEdit={memberCanEditPricing(access.role)}
      />
      <PricingWorkspace
        initialData={data}
        quoteSummary={quoteSummaryForDoc}
        pricingChangedAfterQuote={pricingChangedAfterQuote}
        canEditPricing={memberCanEditPricing(access.role)}
        supplierReview={supplierReview}
        scopeReview={scopeReview}
        estimateUpdateRequired={tabContext.quantityConflictDetail}
        gstRegistered={access.gstRegistered}
        defaultGstRate={access.defaultGstRate}
        scopeStillOpen={
          missingPriceLineCount === 0 && (tabContext.scopeCoverageGapCount ?? 0) > 0
        }
      />
    </WorkspacePage>
  );
}
