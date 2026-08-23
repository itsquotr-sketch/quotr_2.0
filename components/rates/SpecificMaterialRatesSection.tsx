"use client";

import { RatesTableSection } from "@/components/rates/RatesTableSection";
import { catalogueEntriesForRatesSection } from "@/lib/rates/rate-section-contract";
import { SPECIFIC_MATERIAL_RATE_GROUPS } from "@/lib/rates/specific-material-catalogue";
import type { RatesPageRate } from "@/lib/rates/types";

type SpecificMaterialRatesSectionProps = {
  rates: RatesPageRate[];
  onRatesChange: (rates: RatesPageRate[]) => void;
  companyGrossMarginPercent?: number;
};

export function SpecificMaterialRatesSection({
  rates,
  onRatesChange,
  companyGrossMarginPercent,
}: SpecificMaterialRatesSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Specific material rates
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter what materials cost you. Quotr recommends charge-out from your
          company gross margin. Leave blank to use Quotr benchmark cost.
        </p>
      </div>
      {SPECIFIC_MATERIAL_RATE_GROUPS.map((group) => {
        const entries = catalogueEntriesForRatesSection(group.entries, "material");
        if (entries.length === 0) return null;
        return (
        <RatesTableSection
          key={group.title}
          title={group.title}
          description={group.description}
          catalogue={entries}
          rates={rates}
          onRatesChange={onRatesChange}
          companyGrossMarginPercent={companyGrossMarginPercent}
          variant="grouped"
          showEngineColumn
        />
        );
      })}
    </div>
  );
}
