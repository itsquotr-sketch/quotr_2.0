"use client";

import { SCOPE_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import { WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE } from "@/lib/rates/specific-material-catalogue";
import { catalogueEntriesForRatesSection } from "@/lib/rates/rate-section-contract";
import {
  labourRatesCatalogue,
  plantRatesCatalogue,
  subcontractRatesCatalogue,
} from "@/lib/rates/rates-workspace-summary";
import type { RatesPageRate, RatesPageState } from "@/lib/rates/types";
import type { RatesSectionId } from "@/lib/setup/recommendation-destinations";
import { RatesTableSection } from "./RatesTableSection";
import { ProductivityByWorkArea } from "./ProductivityByWorkArea";
import { MaterialsByProductFamily } from "./MaterialsByProductFamily";
import { BenchmarkFallbackSection } from "./BenchmarkFallbackSection";

type RatesNonDefaultSectionsProps = {
  view: RatesSectionId;
  activeSection: RatesSectionId;
  state: RatesPageState;
  onRatesChange: (rates: RatesPageRate[]) => void;
  onChanged: () => void;
  companyGrossMarginPercent: number;
};

export function RatesNonDefaultSections({
  view,
  activeSection,
  state,
  onRatesChange,
  onChanged,
  companyGrossMarginPercent,
}: RatesNonDefaultSectionsProps) {
  const preferred = state.preferredWorkAreaTypes ?? [];

  const plantEntries = plantRatesCatalogue();
  const subcontractEntries = subcontractRatesCatalogue();
  const wasteEntries = catalogueEntriesForRatesSection(
    WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE,
    "material"
  );

  if (view === "labour" || view === "core") {
    return (
      <div
        className="space-y-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
        data-rates-labour
      >
        <RatesTableSection
          title="Labour"
          description={`Hourly cost for each role. Carpenter and labourer stay separate. Recommended charge-out uses your ${companyGrossMarginPercent}% company gross margin.`}
          catalogue={labourRatesCatalogue()}
          rates={state.rates}
          onRatesChange={onRatesChange}
          companyGrossMarginPercent={companyGrossMarginPercent}
          variant="labour"
          showEngineColumn
          readOnly={!state.canManageRates}
        />
      </div>
    );
  }

  if (view === "productivity") {
    return (
      <div className="space-y-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <ProductivityByWorkArea
          rates={state.rates}
          preferredWorkAreaTypes={preferred}
          canCalibrate={state.canCalibrate}
          readOnly={!state.canManageRates}
          companyGrossMarginPercent={companyGrossMarginPercent}
          onRatesChange={onRatesChange}
          onChanged={onChanged}
        />
      </div>
    );
  }

  if (view === "materials") {
    return (
      <div
        className="space-y-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
        data-rates-materials-live
      >
        <MaterialsByProductFamily
          rates={state.rates}
          readOnly={!state.canManageRates}
          companyGrossMarginPercent={companyGrossMarginPercent}
          onRatesChange={onRatesChange}
        />
      </div>
    );
  }

  if (view === "plant") {
    return plantEntries.length === 0 ? (
      <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
        No plant rates to manage yet.
      </p>
    ) : (
      <RatesTableSection
        title="Plant"
        description="Hire and plant rates, grouped by the work that uses them."
        catalogue={plantEntries}
        rates={state.rates}
        onRatesChange={onRatesChange}
        companyGrossMarginPercent={companyGrossMarginPercent}
        variant="grouped"
        showEngineColumn
        readOnly={!state.canManageRates}
      />
    );
  }

  if (view === "subcontract") {
    return subcontractEntries.length === 0 ? (
      <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
        No subcontract rates to manage yet.
      </p>
    ) : (
      <RatesTableSection
        title="Subcontract"
        description="Specialist rates, grouped by the work they belong to."
        catalogue={subcontractEntries}
        rates={state.rates}
        onRatesChange={onRatesChange}
        companyGrossMarginPercent={companyGrossMarginPercent}
        variant="grouped"
        showEngineColumn
        showAddButton
        readOnly={!state.canManageRates}
      />
    );
  }

  if (view === "waste") {
    return wasteEntries.length === 0 ? (
      <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
        No waste rates to manage yet.
      </p>
    ) : (
      <RatesTableSection
        title="Waste"
        description="Spoil removal and disposal identities. Material wastage percentages live under Defaults."
        catalogue={wasteEntries}
        rates={state.rates}
        onRatesChange={onRatesChange}
        companyGrossMarginPercent={companyGrossMarginPercent}
        variant="grouped"
        showEngineColumn
        readOnly={!state.canManageRates}
      />
    );
  }

  if (activeSection === "legacy") {
    return (
      <div className="space-y-4">
        <RatesTableSection
          title="Legacy package rates"
          description="Older overall package rates kept for history and compatibility. Current estimates use labour, productivity, and materials above."
          catalogue={SCOPE_RATE_CATALOGUE}
          rates={state.rates}
          onRatesChange={onRatesChange}
          companyGrossMarginPercent={companyGrossMarginPercent}
          variant="grouped"
          showEngineColumn
          readOnly={!state.canManageRates}
        />
      </div>
    );
  }

  if (activeSection === "benchmarks") {
    return <BenchmarkFallbackSection settings={state.settings} />;
  }

  return null;
}
