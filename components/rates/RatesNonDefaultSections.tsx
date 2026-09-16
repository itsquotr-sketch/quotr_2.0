"use client";

import { LABOUR_RATE_CATALOGUE, SCOPE_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import {
  SPECIFIC_MATERIAL_RATE_GROUPS,
  WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE,
} from "@/lib/rates/specific-material-catalogue";
import { catalogueEntriesForRatesSection } from "@/lib/rates/rate-section-contract";
import type { RateCatalogueEntry, RatesPageRate, RatesPageState } from "@/lib/rates/types";
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

function plantCatalogue(): RateCatalogueEntry[] {
  return catalogueEntriesForRatesSection(
    SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) => [...group.entries]).filter(
      (entry) =>
        entry.item_key.startsWith("plant.") ||
        entry.workAreaLabel?.toLowerCase().includes("plant")
    ),
    "material"
  );
}

function subcontractCatalogue(): RateCatalogueEntry[] {
  return catalogueEntriesForRatesSection(
    SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) => [...group.entries]).filter(
      (entry) => entry.category === "subcontractor"
    ),
    "material"
  );
}

export function RatesNonDefaultSections({
  view,
  activeSection,
  state,
  onRatesChange,
  onChanged,
  companyGrossMarginPercent,
}: RatesNonDefaultSectionsProps) {
  const preferred = state.preferredWorkAreaTypes ?? [];

  const plantEntries = plantCatalogue();
  const subcontractEntries = subcontractCatalogue();
  const wasteEntries = catalogueEntriesForRatesSection(
    WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE,
    "material"
  );

  if (view === "core") {
    return (
      <div className="space-y-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <RatesTableSection
          title="Labour"
          description={`Enter your cost per hour. Recommended charge-out uses your ${companyGrossMarginPercent}% company gross margin.`}
          catalogue={LABOUR_RATE_CATALOGUE.filter(
            (entry) =>
              entry.item_key === "labour.carpenter.hour" ||
              entry.item_key === "labour.labourer.hour" ||
              entry.item_key === "labour.general.hour"
          )}
          rates={state.rates}
          onRatesChange={onRatesChange}
          companyGrossMarginPercent={companyGrossMarginPercent}
          variant="labour"
          showEngineColumn
          readOnly={!state.canManageRates}
        />
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
        description="Hire and plant day rates used by current estimates."
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
        description="Company subcontract rates."
        catalogue={subcontractEntries}
        rates={state.rates}
        onRatesChange={onRatesChange}
        companyGrossMarginPercent={companyGrossMarginPercent}
        variant="grouped"
        showEngineColumn
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
