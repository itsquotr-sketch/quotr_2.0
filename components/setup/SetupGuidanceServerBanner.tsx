import { SetupGuidanceBanner } from "@/components/setup/SetupGuidanceBanner";
import { getCompanySetupReadiness } from "@/lib/setup/readiness-actions";

type SetupGuidanceServerBannerProps = {
  dimension: "estimate" | "pricing" | "quote";
  /** When true, render compact post-estimate guidance (3.2.2-R3). */
  hasEstimate?: boolean;
};

export async function SetupGuidanceServerBanner({
  dimension,
  hasEstimate = false,
}: SetupGuidanceServerBannerProps) {
  const readiness = await getCompanySetupReadiness();

  const suggestions =
    dimension === "estimate"
      ? readiness.missingEstimateSetup
      : dimension === "pricing"
        ? readiness.missingPricingSetup
        : readiness.missingQuoteSetup;

  if (!suggestions.length) {
    return null;
  }

  return (
    <SetupGuidanceBanner
      suggestions={suggestions}
      tone={
        dimension === "quote" && !readiness.quoteReady ? "warning" : "info"
      }
      compact={hasEstimate && dimension === "estimate"}
      className={hasEstimate && dimension === "estimate" ? "mb-3" : "mb-4"}
    />
  );
}
