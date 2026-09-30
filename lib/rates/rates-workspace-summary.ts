/**
 * Presentation counts for the Rates landing page.
 * Reads existing catalogues and registries. Does not change rate authority.
 */
import { LABOUR_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import { buildCalibrationSummary } from "@/lib/rates/calibration";
import { buildMaterialRegistry } from "@/lib/rates/material-registry";
import { buildProductivityRegistry } from "@/lib/rates/productivity-registry";
import { catalogueEntriesForRatesSection } from "@/lib/rates/rate-section-contract";
import {
  SPECIFIC_MATERIAL_RATE_GROUPS,
  listSubcontractRatesCatalogueEntries,
} from "@/lib/rates/specific-material-catalogue";
import type {
  CalibrationStatus,
  RateCatalogueEntry,
  RatesPageRate,
  RatesPageState,
} from "@/lib/rates/types";

export type RatesCoverage = {
  company: number;
  benchmark: number;
  pricingRequired: number;
};

export type RatesWorkspaceSectionId =
  | "materials"
  | "labour"
  | "productivity"
  | "subcontract"
  | "plant"
  | "calibration";

export type RatesWorkspaceSection = RatesCoverage & {
  id: RatesWorkspaceSectionId;
  label: string;
  purpose: string;
};

export type RatesNextAction = {
  section: RatesWorkspaceSectionId;
  label: string;
  reason: string;
};

export type RatesWorkspaceSummary = {
  coverage: RatesCoverage;
  sections: RatesWorkspaceSection[];
  readinessLabel: string;
  readinessStatus: CalibrationStatus;
  nextAction: RatesNextAction;
};

const SECTION_ORDER: RatesWorkspaceSectionId[] = [
  "materials",
  "labour",
  "productivity",
  "subcontract",
  "plant",
];

const EMPTY_COVERAGE: RatesCoverage = {
  company: 0,
  benchmark: 0,
  pricingRequired: 0,
};

export function labourRatesCatalogue(): RateCatalogueEntry[] {
  return LABOUR_RATE_CATALOGUE.filter((entry) => entry.rate_type === "labour");
}

export function plantRatesCatalogue(): RateCatalogueEntry[] {
  return catalogueEntriesForRatesSection(
    SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) => [...group.entries]).filter(
      (entry) =>
        entry.item_key.startsWith("plant.") ||
        entry.workAreaLabel?.toLowerCase().includes("plant")
    ),
    "material"
  );
}

export function subcontractRatesCatalogue(): RateCatalogueEntry[] {
  return catalogueEntriesForRatesSection(
    listSubcontractRatesCatalogueEntries(),
    "material"
  );
}

function hasCompanyCost(rates: readonly RatesPageRate[], itemKey: string): boolean {
  const rate = rates.find((row) => row.item_key === itemKey);
  return Boolean(rate?.active && rate.cost_rate != null);
}

export function coverageForCatalogue(
  entries: readonly RateCatalogueEntry[],
  rates: readonly RatesPageRate[]
): RatesCoverage {
  let company = 0;
  let benchmark = 0;
  let pricingRequired = 0;
  for (const entry of entries) {
    if (hasCompanyCost(rates, entry.item_key)) {
      company += 1;
    } else if (entry.defaultCostRate != null) {
      benchmark += 1;
    } else {
      pricingRequired += 1;
    }
  }
  return { company, benchmark, pricingRequired };
}

function addCoverage(left: RatesCoverage, right: RatesCoverage): RatesCoverage {
  return {
    company: left.company + right.company,
    benchmark: left.benchmark + right.benchmark,
    pricingRequired: left.pricingRequired + right.pricingRequired,
  };
}

function chooseNextAction(input: {
  sections: RatesWorkspaceSection[];
  rates: readonly RatesPageRate[];
  readinessStatus: CalibrationStatus;
  readinessLabel: string;
}): RatesNextAction {
  const gaps = input.sections
    .filter(
      (section) =>
        section.id !== "calibration" && section.pricingRequired > 0
    )
    .sort((left, right) => {
      if (right.pricingRequired !== left.pricingRequired) {
        return right.pricingRequired - left.pricingRequired;
      }
      return SECTION_ORDER.indexOf(left.id) - SECTION_ORDER.indexOf(right.id);
    });

  const firstGap = gaps[0];
  if (firstGap) {
    const count = firstGap.pricingRequired;
    return {
      section: firstGap.id,
      label: `Review ${firstGap.label.toLowerCase()}`,
      reason: `${count} ${count === 1 ? "rate still needs" : "rates still need"} a price`,
    };
  }

  if (!hasCompanyCost(input.rates, "labour.carpenter.hour")) {
    return {
      section: "labour",
      label: "Set carpenter hourly cost",
      reason: "Carpenter and labourer stay as separate hourly costs",
    };
  }

  if (input.readinessStatus !== "good_setup") {
    return {
      section: "calibration",
      label: "Open calibration",
      reason: input.readinessLabel,
    };
  }

  return {
    section: "calibration",
    label: "Review calibration",
    reason: "Company rates are set for the catalogue Quotr can see",
  };
}

export function buildRatesWorkspaceSummary(
  state: Pick<RatesPageState, "rates" | "settings" | "preferredWorkAreaTypes">
): RatesWorkspaceSummary {
  const rates = state.rates ?? [];
  const subcontractEntries = subcontractRatesCatalogue();
  const plantEntries = plantRatesCatalogue();
  const excludedFromMaterials = new Set([
    ...subcontractEntries.map((entry) => entry.item_key),
    ...plantEntries.map((entry) => entry.item_key),
  ]);
  const materials = buildMaterialRegistry({ rates, editable: false });
  const materialCoverage = materials.items
    .filter(
      (item) => item.ordinary && !excludedFromMaterials.has(item.canonicalKey)
    )
    .reduce<RatesCoverage>((total, item) => {
      if (item.effectiveSource === "company") {
        return addCoverage(total, { company: 1, benchmark: 0, pricingRequired: 0 });
      }
      if (
        item.effectiveSource === "direct_benchmark" ||
        item.effectiveSource === "derived_benchmark"
      ) {
        return addCoverage(total, { company: 0, benchmark: 1, pricingRequired: 0 });
      }
      if (item.effectiveSource === "pricing_required") {
        return addCoverage(total, { company: 0, benchmark: 0, pricingRequired: 1 });
      }
      return total;
    }, EMPTY_COVERAGE);

  const productivity = buildProductivityRegistry({
    rates,
    editable: false,
    preferredWorkAreaTypes: state.preferredWorkAreaTypes,
  });
  const productivityCoverage = productivity.groups.reduce<RatesCoverage>(
    (total, group) =>
      addCoverage(total, {
        company: group.customisedCount,
        benchmark: group.benchmarkCount,
        pricingRequired: group.pricingRequiredCount,
      }),
    EMPTY_COVERAGE
  );

  const labourCoverage = coverageForCatalogue(labourRatesCatalogue(), rates);
  const subcontractCoverage = coverageForCatalogue(subcontractEntries, rates);
  const plantCoverage = coverageForCatalogue(plantEntries, rates);

  const sections: RatesWorkspaceSection[] = [
    {
      id: "materials",
      label: "Materials",
      purpose:
        "Exact products, from family down to the variant an estimate uses.",
      ...materialCoverage,
    },
    {
      id: "labour",
      label: "Labour",
      purpose: "Hourly cost for each role. Carpenter and labourer stay separate.",
      ...labourCoverage,
    },
    {
      id: "productivity",
      label: "Productivity",
      purpose:
        "Person-hours by work area. These hours set labour time on future estimates.",
      ...productivityCoverage,
    },
    {
      id: "subcontract",
      label: "Subcontract",
      purpose: "Specialist rates, grouped by the work they belong to.",
      ...subcontractCoverage,
    },
    {
      id: "plant",
      label: "Plant",
      purpose: "Hire and plant rates, grouped by the work that uses them.",
      ...plantCoverage,
    },
    {
      id: "calibration",
      label: "Calibration",
      purpose:
        "Uses your costs and productivity so later estimates are closer to how you price work.",
      company: 0,
      benchmark: 0,
      pricingRequired: 0,
    },
  ];

  const coverage = [
    materialCoverage,
    labourCoverage,
    productivityCoverage,
    subcontractCoverage,
    plantCoverage,
  ].reduce(addCoverage, EMPTY_COVERAGE);

  const calibration = buildCalibrationSummary({
    settings: state.settings,
    rates: [...rates],
    preferredWorkAreaTypes: state.preferredWorkAreaTypes ?? [],
    canManageRates: false,
    canCalibrate: false,
  });

  return {
    coverage,
    sections,
    readinessLabel: calibration.statusLabel,
    readinessStatus: calibration.status,
    nextAction: chooseNextAction({
      sections,
      rates,
      readinessStatus: calibration.status,
      readinessLabel: calibration.statusLabel,
    }),
  };
}
