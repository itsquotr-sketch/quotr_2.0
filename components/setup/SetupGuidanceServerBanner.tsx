import { SetupGuidanceBanner } from "@/components/setup/SetupGuidanceBanner";
import { getCompanySetupReadiness } from "@/lib/setup/readiness-actions";

type SetupGuidanceServerBannerProps = {
  dimension: "estimate" | "pricing" | "quote";
};

export async function SetupGuidanceServerBanner({
  dimension,
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
      className="mb-4"
    />
  );
}
