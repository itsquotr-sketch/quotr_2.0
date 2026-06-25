"use client";

import { RatesTableSection } from "@/components/rates/RatesTableSection";
import { SPECIFIC_MATERIAL_RATE_GROUPS } from "@/lib/rates/specific-material-catalogue";
import type { RatesPageRate } from "@/lib/rates/types";

type SpecificMaterialRatesSectionProps = {
  rates: RatesPageRate[];
  onRatesChange: (rates: RatesPageRate[]) => void;
};

export function SpecificMaterialRatesSection({
  rates,
  onRatesChange,
}: SpecificMaterialRatesSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Specific material rates
        </h2>
        <p className="text-sm text-muted-foreground">
          Per-unit rates used when Quotr calculates material quantities (boards,
          sheets, litres, m³). Leave blank to use benchmark fallbacks.
        </p>
      </div>
      {SPECIFIC_MATERIAL_RATE_GROUPS.map((group) => (
        <RatesTableSection
          key={group.title}
          title={group.title}
          description={group.description}
          catalogue={group.entries}
          rates={rates}
          onRatesChange={onRatesChange}
          variant="grouped"
          showEngineColumn
        />
      ))}
    </div>
  );
}
