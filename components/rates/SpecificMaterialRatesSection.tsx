"use client";

import { MaterialsByProductFamily } from "@/components/rates/MaterialsByProductFamily";
import { catalogueEntriesForRatesSection } from "@/lib/rates/rate-section-contract";
import { SPECIFIC_MATERIAL_RATE_GROUPS } from "@/lib/rates/specific-material-catalogue";
import type { RatesPageRate } from "@/lib/rates/types";

type SpecificMaterialRatesSectionProps = {
  rates: RatesPageRate[];
  onRatesChange: (rates: RatesPageRate[]) => void;
  companyGrossMarginPercent?: number;
  readOnly?: boolean;
};

/** Kept for semantic section membership verifies; Materials tab uses MaterialsByProductFamily. */
export function SpecificMaterialRatesSection({
  rates,
  onRatesChange,
  companyGrossMarginPercent,
  readOnly = false,
}: SpecificMaterialRatesSectionProps) {
  void SPECIFIC_MATERIAL_RATE_GROUPS;
  void catalogueEntriesForRatesSection;
  return (
    <MaterialsByProductFamily
      rates={rates}
      onRatesChange={onRatesChange}
      companyGrossMarginPercent={companyGrossMarginPercent}
      readOnly={readOnly}
    />
  );
}
