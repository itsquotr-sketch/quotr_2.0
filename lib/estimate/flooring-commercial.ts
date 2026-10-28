/**
 * FLOORING-05 — cost-first nested Flooring commercialisation.
 *
 * Consumes calculateFlooringPhysical. Does not recompute quantities.
 * Hosted path: calculateFlooring → physical → this module → line items.
 * Legacy flat Flooring stays on the existing FITOUT path.
 */
import {
  getCombinedLabourAccessFactor,
  getLabourAdjustmentParts,
} from "@/lib/estimate/adjustments";
import {
  formatLabourAdjustmentPrimary,
  formatProductivity,
} from "@/lib/estimate/builder-presentation-format";
import { labourBasisNote } from "@/lib/estimate/condition-basis";
import { classifyResolvedSell } from "@/lib/commercial-engine/core/cost-first-authority";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY } from "@/lib/estimate/bathroom-identities";
import { hasTrustedPhysicalQuantity } from "@/lib/estimate/component-commercial-authority";
import {
  FLOORING_CARPET_PURCHASING_UNRESOLVED,
  FLOORING_FINISH_ANCILLARY_COMPONENT,
  FLOORING_FINISH_INSTALL_COMPONENT,
  FLOORING_FINISH_INSTALL_HOURS_PER_M2,
  FLOORING_FINISH_SUPPLY_COMPONENT,
  FLOORING_FINISH_WASTE_COMPONENT,
  FLOORING_WASTE_INCREMENT_CATEGORY,
} from "@/lib/estimate/flooring-purchasing";
import {
  FLOORING_LAMINATE_INSTALL_COMPONENT,
  FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
  FLOORING_LAMINATE_MOISTURE_COMPONENT,
  FLOORING_LAMINATE_PACKAGE_M2,
  FLOORING_LAMINATE_SUPPLY_COMPONENT,
  FLOORING_LAMINATE_UNDERLAY_COMPONENT,
} from "@/lib/estimate/flooring-laminate";
import {
  FLOORING_CARPET_TILE_FIXING_COMPONENT,
  FLOORING_CARPET_TILE_INSTALL_COMPONENT,
  FLOORING_CARPET_TILE_INSTALL_HOURS_PER_M2,
  FLOORING_CARPET_TILE_PACKAGE_M2,
  FLOORING_CARPET_TILE_SUPPLY_COMPONENT,
} from "@/lib/estimate/flooring-carpet-tile";
import {
  findFinishMaterialRate,
  finishMaterialUnitProblem,
  flooringAncillaryLabel,
  flooringAncillaryMaterialKey,
  flooringCostOwnerMode,
  flooringFinishSupplyKey,
  flooringPackageOwnershipNote,
  flooringWasteResolution,
} from "@/lib/estimate/flooring-cost-ownership";
import {
  findCompanyProductivityRate,
  isTrustedProductivityHours,
  productivityUnitsCompatible,
} from "@/lib/estimate/productivity";
import {
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_CARPET_REMOVE_HOURS_LABEL,
  FLOORING_CARPET_REMOVE_LABOUR,
  FLOORING_CARPET_SUPPLY_INSTALL_LABEL,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_LABEL,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_FINISH_COMPONENT,
  FLOORING_CUSTOM_REMOVAL_COMPONENT,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_LABEL,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_REMOVE_HOURS_LABEL,
  FLOORING_HARDWOOD_REMOVE_LABOUR,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_LABEL,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBCONTRACT_RATE_KEYS,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_LABEL,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_LABEL,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_LABEL,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_INSTALL_HOURS_LABEL,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
  FLOORING_SUBSTRATE_REMOVE_HOURS_LABEL,
  FLOORING_SUBSTRATE_REMOVE_LABOUR,
  FLOORING_TILE_REMOVE_HOURS_LABEL,
  FLOORING_TILE_REMOVE_LABOUR,
  FLOORING_TILE_SUPPLY_INSTALL_LABEL,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_LABEL,
  FLOORING_VINYL_PLANK_REMOVE_LABOUR,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_LABEL,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
  isOrdinaryFlooringFinishPackageKey,
} from "@/lib/estimate/flooring-identities";
import {
  flooringFramingAuthorityCost,
  isFlooringFramingAllowanceKey,
  resolveFlooringFramingAllowance,
} from "@/lib/estimate/flooring-framing-authority";
import { FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY } from "@/lib/estimate/flooring-question-copy";
import {
  FLOORING_NESTED_NOT_YET_PRICED_STATEMENT,
  FLOORING_PHYSICAL_COMPLETENESS,
  type FlooringPhysicalResult,
  type FlooringPortionPhysical,
  presentFlooringAreaM2,
} from "@/lib/estimate/flooring-physical";
import {
  FLOORING_NESTED_NOT_CALCULATED_MESSAGE,
  FLOORING_SPECIALIST_PRICING_REQUIRED_MESSAGE,
  FLOORING_SPECIALIST_RECIPE_MESSAGE,
} from "@/lib/estimate/flooring-portions";
import {
  isFlooringProductivityKey,
  resolveFlooringProductivityHours,
} from "@/lib/estimate/flooring-productivity-authority";
import {
  resolveFlooringSubcontractRate,
  isFlooringSubcontractRateKey,
} from "@/lib/estimate/flooring-subcontract-authority";
import { round2 } from "@/lib/estimate/facts";
import {
  labourRequirementTotalCost,
  mapLabourRateSourceToRequirement,
} from "@/lib/estimate/labour-requirement";
import {
  createLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { resolveLabourRate } from "@/lib/estimate/rates";
import { resolveMaterialRate } from "@/lib/estimate/resolve-material-rate";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
  RequirementRateSource,
  SubcontractRequirement,
} from "@/lib/estimate/requirements";
import type {
  EstimateConstraint,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import { getCatalogueEntry } from "@/lib/rates/catalogue";

export const FLOORING_COMMERCIAL_COMPLETENESS = {
  COMPLETE_COMMERCIAL: "COMPLETE_COMMERCIAL",
  PRICING_REQUIRED: "PRICING_REQUIRED",
  INFORMATION_REQUIRED: "INFORMATION_REQUIRED",
  UNSUPPORTED_SPECIALIST: "UNSUPPORTED_SPECIALIST",
} as const;

export type FlooringCommercialCompleteness =
  (typeof FLOORING_COMMERCIAL_COMPLETENESS)[keyof typeof FLOORING_COMMERCIAL_COMPLETENESS];

export type FlooringCommercialResult = {
  readonly completeness: FlooringCommercialCompleteness | "empty";
  readonly requirements: readonly EstimateRequirement[];
  readonly lineItems: readonly EstimateLineItemInput[];
  readonly assumptions: readonly string[];
  readonly missingInfo: readonly string[];
};

const SUBCONTRACT_LABELS: Record<string, string> = {
  [FLOORING_CARPET_SUPPLY_INSTALL_M2]: FLOORING_CARPET_SUPPLY_INSTALL_LABEL,
  [FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2]:
    FLOORING_VINYL_PLANK_SUPPLY_INSTALL_LABEL,
  [FLOORING_TILE_SUPPLY_INSTALL_M2]: FLOORING_TILE_SUPPLY_INSTALL_LABEL,
  [FLOORING_HARDWOOD_SUPPLY_INSTALL_M2]: FLOORING_HARDWOOD_SUPPLY_INSTALL_LABEL,
  [FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2]:
    FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_LABEL,
  [FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2]:
    FLOORING_FLOOR_PREPARATION_ALLOWANCE_LABEL,
};

const FRAMING_LABELS: Record<string, string> = {
  [FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_LABEL,
  [FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_LABEL,
  [FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_LABEL,
};

const LABOUR_LABELS: Record<string, string> = {
  [FLOORING_SUBSTRATE_INSTALL_LABOUR]: FLOORING_SUBSTRATE_INSTALL_HOURS_LABEL,
  [FLOORING_SUBSTRATE_REMOVE_LABOUR]: FLOORING_SUBSTRATE_REMOVE_HOURS_LABEL,
  [FLOORING_CARPET_REMOVE_LABOUR]: FLOORING_CARPET_REMOVE_HOURS_LABEL,
  [FLOORING_VINYL_PLANK_REMOVE_LABOUR]: FLOORING_VINYL_PLANK_REMOVE_HOURS_LABEL,
  [FLOORING_TILE_REMOVE_LABOUR]: FLOORING_TILE_REMOVE_HOURS_LABEL,
  [FLOORING_HARDWOOD_REMOVE_LABOUR]: FLOORING_HARDWOOD_REMOVE_HOURS_LABEL,
  [FLOORING_FINISH_INSTALL_COMPONENT]: "Finish installation",
};

function applicableGrossMarginPercent(
  organisationSettings: OrganisationSettings | null
): number {
  return organisationSettings?.default_margin_percent ?? 20;
}

export function flooringRequirementNestedItemId(
  requirement: Pick<EstimateRequirement, "variantKey">
): string {
  return requirement.variantKey ?? "";
}

export function flooringLineScopeKey(params: {
  workAreaId: string;
  nestedItemId: string;
  componentKey: string;
}): string {
  return `flooring:${params.workAreaId}:${params.nestedItemId}:${params.componentKey}`;
}

export function formatFlooringReviewTitle(
  portion: FlooringPortionPhysical
): string {
  const label = portion.label?.trim() || "Flooring Area";
  const area =
    portion.physicalNetAreaM2 != null
      ? presentFlooringAreaM2(portion.physicalNetAreaM2).replace(/\.0 m²$/, " m²")
      : "area unanswered";
  if (portion.specialist_kind != null) {
    const kind =
      portion.specialist_kind === "laminate"
        ? "laminate flooring"
        : portion.specialist_kind === "engineered_timber"
          ? "engineered timber flooring"
          : portion.specialist_kind === "sheet_vinyl"
            ? "sheet vinyl flooring"
            : "specialist flooring";
    return `${label} — ${area} ${kind}`;
  }
  if (portion.finish_type === "other") {
    const desc = portion.other_description?.trim() || "custom flooring";
    return `${label} — ${area} ${desc}`;
  }
  if (portion.finish_type === "carpet") {
    return `${label} — ${area} carpet`;
  }
  if (portion.finish_type === "vinyl_plank") {
    return `${label} — ${area} vinyl plank/LVT`;
  }
  if (portion.finish_type === "tile") {
    const dims =
      portion.tile?.tileWidthMm != null && portion.tile.tileLengthMm != null
        ? `, ${portion.tile.tileWidthMm} × ${portion.tile.tileLengthMm} mm`
        : "";
    return `${label} — ${area} tile${dims}`;
  }
  if (portion.finish_type === "hardwood") {
    const width =
      portion.hardwood?.boardWidthMm != null
        ? `, ${portion.hardwood.boardWidthMm} mm boards`
        : "";
    return `${label} — ${area} hardwood${width}`;
  }
  return `${label} — ${area} flooring`;
}

function portionAllowsOrdinaryPricing(
  portion: FlooringPortionPhysical | undefined
): boolean {
  if (!portion) return false;
  return portion.completeness === FLOORING_PHYSICAL_COMPLETENESS.COMPLETE_PHYSICAL;
}

function isFinishPackageMirror(requirement: MaterialRequirement): boolean {
  return (
    requirement.category === "FLOORING_PACKAGE" &&
    isFlooringSubcontractRateKey(requirement.componentKey)
  );
}

function mapMoneySource(source: "company" | "quotr" | "missing" | RequirementRateSource): {
  rateSource: string;
  rateSourceType: "user_rate" | "benchmark" | "missing";
} {
  if (source === "company" || source === "project_override") {
    return {
      rateSource: getRateSourceLabel("user_rate"),
      rateSourceType: "user_rate",
    };
  }
  if (source === "missing") {
    return {
      rateSource: getRateSourceLabel("missing"),
      rateSourceType: "missing",
    };
  }
  return {
    rateSource: getRateSourceLabel("benchmark"),
    rateSourceType: "benchmark",
  };
}

function packageQuantity(
  requirement: SubcontractRequirement,
  physical: readonly EstimateRequirement[]
): number | null {
  const mirror = physical.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" &&
      row.componentKey === requirement.componentKey &&
      row.variantKey === requirement.variantKey
  );
  if (!mirror) return null;
  return hasTrustedPhysicalQuantity(mirror.purchaseQuantity)
    ? mirror.purchaseQuantity
    : null;
}

function finishTakeoffNotes(portion: FlooringPortionPhysical | undefined): string | undefined {
  if (!portion) return undefined;
  const supply = portionNote(portion);
  if (portion.tile) {
    const net = `Package basis ${presentFlooringAreaM2(portion.physicalNetAreaM2 ?? 0)}. Informational ${portion.tile.wholeTileCount} whole tiles (${portion.tile.tileWidthMm} × ${portion.tile.tileLengthMm} mm). Tile count does not multiply the subcontract COST.`;
    return supply ? `${net} ${supply}` : net;
  }
  if (portion.hardwood) {
    const net = `Package basis ${presentFlooringAreaM2(portion.physicalNetAreaM2 ?? 0)}. Informational ${round2(portion.hardwood.linealM)} lm at ${portion.hardwood.boardWidthMm} mm board width. The lineal-metre takeoff does not multiply the subcontract COST.`;
    return supply ? `${net} ${supply}` : net;
  }
  return supply;
}

function portionNote(portion: FlooringPortionPhysical | undefined): string | undefined {
  const purchasing = portion?.purchasing;
  if (!purchasing || purchasing.kind === "none") return undefined;
  if (purchasing.kind === "carpet_unresolved") return purchasing.limitation;
  return purchasing.formula;
}

export function priceFlooringSubcontract(params: {
  requirement: SubcontractRequirement;
  quantity: number | null;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  allowPricing: boolean;
}): SubcontractRequirement {
  const { requirement } = params;
  if (
    !params.allowPricing ||
    !(
      isFlooringSubcontractRateKey(requirement.componentKey) ||
      requirement.componentKey === FLOORING_LAMINATE_PACKAGE_M2 ||
      requirement.componentKey === FLOORING_CARPET_TILE_PACKAGE_M2
    ) ||
    !hasTrustedPhysicalQuantity(params.quantity)
  ) {
    return {
      ...requirement,
      priced: false,
      allowanceCost: null,
      quotedCost: null,
      totalCost: null,
    };
  }
  const resolved = resolveFlooringSubcontractRate({
    itemKey: requirement.componentKey,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  if (resolved.costRate == null || resolved.costRate <= 0) {
    return {
      ...requirement,
      priced: false,
      allowanceCost: null,
      quotedCost: null,
      totalCost: null,
    };
  }
  return {
    ...requirement,
    priced: true,
    allowanceCost: resolved.costRate,
    quotedCost: null,
    totalCost: round2(params.quantity! * resolved.costRate),
  };
}

export function priceFlooringMaterial(params: {
  requirement: MaterialRequirement;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  allowPricing: boolean;
}): MaterialRequirement {
  const { requirement } = params;
  if (isFinishPackageMirror(requirement)) {
    return requirement;
  }
  if (
    requirement.componentKey === FLOORING_LAMINATE_SUPPLY_COMPONENT ||
    requirement.componentKey === FLOORING_LAMINATE_UNDERLAY_COMPONENT ||
    requirement.componentKey === FLOORING_LAMINATE_MOISTURE_COMPONENT ||
    requirement.componentKey === FLOORING_CARPET_TILE_SUPPLY_COMPONENT ||
    requirement.componentKey === FLOORING_CARPET_TILE_FIXING_COMPONENT
  ) {
    if (requirement.category === "CLIENT_SUPPLIED") {
      return {
        ...requirement,
        priced: true,
        unitCost: 0,
        totalCost: 0,
        rateSource: "company",
      };
    }
    const named = requirement.materialKey
      ? findFinishMaterialRate(params.rates, requirement.materialKey)
      : undefined;
    if (
      !params.allowPricing ||
      !named ||
      named.cost_rate == null ||
      !hasTrustedPhysicalQuantity(requirement.purchaseQuantity)
    ) {
      return unpricedFinishMaterial(requirement, params.rates);
    }
    return {
      ...requirement,
      priced: true,
      unitCost: named.cost_rate,
      totalCost: round2(requirement.purchaseQuantity * named.cost_rate),
      rateSource: named.rate_type === "project_material" ? "project_override" : "company",
    };
  }
  if (requirement.componentKey === FLOORING_FINISH_SUPPLY_COMPONENT) {
    if (requirement.category === "CLIENT_SUPPLIED") {
      return {
        ...requirement,
        priced: true,
        unitCost: 0,
        totalCost: 0,
        rateSource: "company",
      };
    }
    if (
      !params.allowPricing ||
      requirement.materialKey === FLOORING_CARPET_PURCHASING_UNRESOLVED ||
      !hasTrustedPhysicalQuantity(requirement.purchaseQuantity)
    ) {
      return {
        ...requirement,
        priced: false,
        unitCost: null,
        totalCost: null,
        rateSource: "missing",
      };
    }
    const named =
      requirement.materialKey == null
        ? undefined
        : findFinishMaterialRate(params.rates, requirement.materialKey);
    if (!named || named.cost_rate == null) {
      return unpricedFinishMaterial(requirement, params.rates);
    }
    return {
      ...requirement,
      priced: true,
      unitCost: named.cost_rate,
      totalCost: round2(requirement.purchaseQuantity * named.cost_rate),
      rateSource: named.rate_type === "project_material" ? "project_override" : "company",
    };
  }
  if (
    requirement.componentKey === FLOORING_FINISH_WASTE_COMPONENT ||
    requirement.componentKey === FLOORING_FINISH_ANCILLARY_COMPONENT
  ) {
    const chargeWaste =
      requirement.componentKey === FLOORING_FINISH_WASTE_COMPONENT &&
      requirement.category === FLOORING_WASTE_INCREMENT_CATEGORY;
    const chargeAncillary =
      requirement.componentKey === FLOORING_FINISH_ANCILLARY_COMPONENT;
    const named =
      (chargeWaste || chargeAncillary) && requirement.materialKey
        ? findFinishMaterialRate(params.rates, requirement.materialKey)
        : undefined;
    if (
      !params.allowPricing ||
      !named ||
      named.cost_rate == null ||
      !hasTrustedPhysicalQuantity(requirement.purchaseQuantity)
    ) {
      return unpricedFinishMaterial(requirement, params.rates);
    }
    return {
      ...requirement,
      priced: true,
      unitCost: named.cost_rate,
      totalCost: round2(requirement.purchaseQuantity * named.cost_rate),
      rateSource: named.rate_type === "project_material" ? "project_override" : "company",
    };
  }
  if (
    !params.allowPricing ||
    !hasTrustedPhysicalQuantity(requirement.purchaseQuantity)
  ) {
    return {
      ...requirement,
      priced: false,
      unitCost: null,
      totalCost: null,
      rateSource: "missing",
    };
  }
  if (isFlooringFramingAllowanceKey(requirement.componentKey)) {
    const resolved = resolveFlooringFramingAllowance({
      itemKey: requirement.componentKey,
      rates: params.rates,
      organisationSettings: params.organisationSettings,
    });
    if (resolved.costRate == null || resolved.costRate <= 0) {
      return {
        ...requirement,
        priced: false,
        unitCost: null,
        totalCost: null,
        rateSource: "missing",
      };
    }
    return {
      ...requirement,
      priced: true,
      unitCost: resolved.costRate,
      totalCost: round2(requirement.purchaseQuantity * resolved.costRate),
      rateSource: resolved.source === "company" ? "company" : "benchmark",
    };
  }
  const key = requirement.materialKey;
  if (key !== BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) {
    return {
      ...requirement,
      priced: false,
      unitCost: null,
      totalCost: null,
      rateSource: "missing",
    };
  }
  const catalogue = getCatalogueEntry(key);
  const unit = catalogue?.unit ?? requirement.purchaseUnit;
  const benchmark = catalogue?.defaultCostRate ?? 0;
  const resolved = resolveMaterialRate({
    orgRates: [...params.rates],
    materialKey: key,
    workAreaType: "flooring",
    unit,
    benchmarkCostRate: benchmark,
    organisationSettings: params.organisationSettings,
  });
  if (
    resolved.materialRateSource === "missing" ||
    !Number.isFinite(resolved.costRate) ||
    resolved.costRate <= 0
  ) {
    return {
      ...requirement,
      priced: false,
      unitCost: null,
      totalCost: null,
      rateSource: "missing",
    };
  }
  return {
    ...requirement,
    priced: true,
    unitCost: resolved.costRate,
    totalCost: round2(requirement.purchaseQuantity * resolved.costRate),
    rateSource:
      resolved.materialRateSource === "company_specific" ||
      resolved.materialRateSource === "company_scope"
        ? "company"
        : "benchmark",
  };
}

export function priceFlooringLabour(params: {
  requirement: LabourRequirement;
  rates: readonly OrganisationRate[];
  allowPricing: boolean;
  accessFactor: number;
  hourlyCost: number;
  labourSource: RequirementRateSource;
}): LabourRequirement {
  const { requirement } = params;
  const quantity = requirement.productivityBasis.quantity;
  const unit = requirement.productivityBasis.unit;
  const resolved = resolveFlooringProductivityHours({
    productivityKey: requirement.productivityBasis.key ?? "",
    quantity,
    unit,
    rates: params.rates,
  });
  const installOnly =
    requirement.productivityBasis.key === FLOORING_FINISH_INSTALL_HOURS_PER_M2 ||
    requirement.productivityBasis.key === FLOORING_LAMINATE_INSTALL_HOURS_PER_M2 ||
    requirement.productivityBasis.key === FLOORING_CARPET_TILE_INSTALL_HOURS_PER_M2;
  const laminateInstall =
    requirement.componentKey === FLOORING_LAMINATE_INSTALL_COMPONENT ||
    requirement.componentKey === FLOORING_CARPET_TILE_INSTALL_COMPONENT;
  const installKey = requirement.productivityBasis.key ?? "";
  const companyInstall = installOnly
    ? findCompanyProductivityRate(params.rates, installKey, "m2")
    : undefined;
  const installHours =
    companyInstall?.cost_rate != null &&
    isTrustedProductivityHours(Number(companyInstall.cost_rate))
      ? Number(companyInstall.cost_rate)
      : null;
  const hoursPerUnit = installOnly ? installHours : resolved.hoursPerUnit;
  const hoursTrusted = hoursPerUnit != null && hoursPerUnit > 0;
  let unresolvedReason: string | null = null;
  if (installOnly && !hoursTrusted) {
    const saved = params.rates.find(
      (rate) =>
        rate.active &&
        rate.item_key === installKey &&
        rate.rate_type === "productivity" &&
        rate.cost_rate != null &&
        rate.cost_rate > 0
    );
    if (saved && !productivityUnitsCompatible(saved.unit, "m2")) {
      unresolvedReason = `A productivity rate is saved per ${saved.unit || "an unstated unit"}. Installation uses hours per m2. Those units are not converted, so the hours stay unresolved.`;
    }
  } else if (installOnly && hoursTrusted && !(params.hourlyCost > 0)) {
    unresolvedReason = `Installation productivity is saved. The carpenter hourly cost ${FLOORING_CARPENTER_LABOUR_RATE_KEY} is missing, so the labour cost is not calculated.`;
  } else if (
    laminateInstall &&
    hoursTrusted &&
    params.labourSource !== "company" &&
    params.labourSource !== "project_override"
  ) {
    unresolvedReason = `Installation productivity is saved. The carpenter hourly cost is missing. This installation does not use the $60 carpenter benchmark. Save a company ${FLOORING_CARPENTER_LABOUR_RATE_KEY} cost.`;
  }
  const carpenterKnown =
    !laminateInstall ||
    params.labourSource === "company" ||
    params.labourSource === "project_override";
  const priced =
    params.allowPricing &&
    hoursTrusted &&
    params.hourlyCost > 0 &&
    carpenterKnown &&
    hasTrustedPhysicalQuantity(quantity) &&
    (installOnly || isFlooringProductivityKey(requirement.productivityBasis.key));
  const baseHours = priced ? round2(quantity * (hoursPerUnit ?? 0)) : 0;
  const adjustedHours = priced ? round2(baseHours * params.accessFactor) : 0;
  const totalCost = priced
    ? labourRequirementTotalCost({
        adjustedHours,
        hourlyCost: params.hourlyCost,
        hourlySell: params.hourlyCost,
      })
    : null;
  return {
    ...requirement,
    priced,
    baseHours,
    adjustedHours,
    hourlyCost: priced ? params.hourlyCost : null,
    totalCost,
    rateKey: FLOORING_CARPENTER_LABOUR_RATE_KEY,
    trade: "carpenter",
    rateProvenance: priced ? params.labourSource : "missing",
    unresolvedReason,
    productivityBasis: {
      ...requirement.productivityBasis,
      hoursPerUnit: hoursPerUnit ?? 0,
    },
  };
}

function unpricedFinishMaterial(
  requirement: MaterialRequirement,
  rates: readonly OrganisationRate[]
): MaterialRequirement {
  const problem = requirement.materialKey
    ? finishMaterialUnitProblem(rates, requirement.materialKey)
    : null;
  const currentSpecification = requirement.specification ?? "";
  const specification =
    problem && !currentSpecification.includes(problem)
      ? `${currentSpecification} ${problem}`.trim()
      : currentSpecification;
  return {
    ...requirement,
    specification,
    priced: false,
    unitCost: null,
    totalCost: null,
    rateSource: "missing",
  };
}

function missingMoneyLine(params: {
  requirement: EstimateRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  label: string;
  quantity: number;
  unit: string;
  category: EstimateLineItemInput["category"];
  itemKey?: string;
  pricingOwner: "subcontractor_allowance" | "contractor_material" | "in_house_labour";
  notes: string;
  identitySummary?: string;
}): EstimateLineItemInput {
  const nestedItemId = flooringRequirementNestedItemId(params.requirement);
  const scopeKey = flooringLineScopeKey({
    workAreaId: params.requirement.workAreaId,
    nestedItemId,
    componentKey: params.requirement.componentKey,
  });
  const line = createRateLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label: params.label,
    category: params.category,
    quantity: params.quantity,
    unit: params.unit,
    costRate: 0,
    sellRate: 0,
    rateSource: getRateSourceLabel("missing"),
    rateSourceType: "missing",
    itemKey: params.itemKey,
    componentKey: params.requirement.componentKey,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes: params.notes,
  });
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
      identitySummary: params.identitySummary,
      sellDerivedFromMargin: false,
      sellAuthority: undefined,
      costRate: undefined,
      sellRate: undefined,
    },
    {
      pricingOwner: params.pricingOwner,
      scopeKey,
      overlapGroup: `flooring.area:${nestedItemId}`,
      includedInTotal: false,
    }
  );
}

function subcontractLine(params: {
  requirement: SubcontractRequirement;
  quantity: number;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  rates: readonly OrganisationRate[];
  portion: FlooringPortionPhysical | undefined;
}): EstimateLineItemInput {
  const nestedItemId = flooringRequirementNestedItemId(params.requirement);
  const scopeKey = flooringLineScopeKey({
    workAreaId: params.requirement.workAreaId,
    nestedItemId,
    componentKey: params.requirement.componentKey,
  });
  const label =
    SUBCONTRACT_LABELS[params.requirement.componentKey] ??
    params.requirement.description;
  const resolved = resolveFlooringSubcontractRate({
    itemKey: params.requirement.componentKey,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  const marginPercent = applicableGrossMarginPercent(params.organisationSettings);
  const namedForSell = params.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key === params.requirement.componentKey &&
      rate.rate_type === "subcontractor" &&
      rate.cost_rate != null
  );
  const classifiedPreview =
    params.requirement.allowanceCost != null
      ? classifyResolvedSell({
          costRate: params.requirement.allowanceCost,
          sellRate: namedForSell?.sell_rate,
          applicableGrossMarginPercent: marginPercent,
        })
      : null;
  const mode = params.portion
    ? flooringCostOwnerMode({
        finish: params.portion.finish_type,
        finishPricing: params.portion.finish_pricing ?? null,
        customerSupplied: params.portion.finish_supplied_by === "customer",
        rates: params.rates,
      })
    : "combined";
  const supplyKey = params.portion
    ? flooringFinishSupplyKey(params.portion.finish_type)
    : null;
  const materialRate = supplyKey
    ? findFinishMaterialRate(params.rates, supplyKey)
    : undefined;
  const ownership = classifiedPreview
    ? flooringPackageOwnershipNote({
        itemKey: params.requirement.componentKey,
        netQuantity: params.quantity,
        unit: "m²",
        unitCost: params.requirement.allowanceCost ?? classifiedPreview.sellRate,
        directCost: round2(params.quantity * (params.requirement.allowanceCost ?? 0)),
        clientSell: round2(params.quantity * classifiedPreview.sellRate),
        marginPercent: classifiedPreview.grossMarginPercent,
        sellAuthority: classifiedPreview.sellAuthority,
        purchasing: params.portion?.purchasing ?? null,
        wasteCoverage:
          !params.portion ||
          params.portion.finish_supplied_by === "customer" ||
          params.portion.finish_pricing === "separate_supply" ||
          params.portion.purchasing == null ||
          params.portion.purchasing.kind === "none"
            ? "absent"
            : params.portion.waste_treatment === "package_covers_requested_waste"
              ? "confirmed"
              : "open",
        unusedMaterialRate:
          mode === "combined" || mode === "decision_required"
            ? materialRate?.cost_rate ?? null
            : null,
        decisionRequired: mode === "decision_required",
      })
    : null;
  const notes = ownership ?? finishTakeoffNotes(params.portion);
  if (
    !params.requirement.priced ||
    params.requirement.allowanceCost == null ||
    params.requirement.totalCost == null
  ) {
    return missingMoneyLine({
      requirement: params.requirement,
      workAreaName: params.workAreaName,
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      label,
      quantity: params.quantity,
      unit: "m2",
      category: "subcontractor",
      itemKey: params.requirement.componentKey,
      pricingOwner: "subcontractor_allowance",
      notes: `Pricing Required. Quantity ${params.quantity} m² remains visible.`,
      identitySummary: notes,
    });
  }
  const named = params.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key === params.requirement.componentKey &&
      rate.rate_type === "subcontractor" &&
      rate.cost_rate != null
  );
  const classified = classifyResolvedSell({
    costRate: params.requirement.allowanceCost,
    sellRate: named?.sell_rate,
    applicableGrossMarginPercent: applicableGrossMarginPercent(
      params.organisationSettings
    ),
  });
  const source = mapMoneySource(resolved.source);
  const line = createRateLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label,
    category: "subcontractor",
    quantity: params.quantity,
    unit: "m2",
    costRate: params.requirement.allowanceCost,
    sellRate: classified.sellRate,
    rateSource: source.rateSource,
    rateSourceType: source.rateSourceType,
    itemKey: params.requirement.componentKey,
    componentKey: params.requirement.componentKey,
    sellDerivedFromMargin: classified.sellDerivedFromMargin,
    sellAuthority: classified.sellAuthority,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes:
      notes ??
      `${params.quantity} m² × $${params.requirement.allowanceCost}/m²`,
  });
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
      identitySummary: notes,
    },
    {
      pricingOwner: "subcontractor_allowance",
      scopeKey,
      overlapGroup: `flooring.area:${nestedItemId}`,
    }
  );
}

function materialOrAllowanceLine(params: {
  requirement: MaterialRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  rates: readonly OrganisationRate[];
}): EstimateLineItemInput {
  const nestedItemId = flooringRequirementNestedItemId(params.requirement);
  const scopeKey = flooringLineScopeKey({
    workAreaId: params.requirement.workAreaId,
    nestedItemId,
    componentKey: params.requirement.componentKey,
  });
  const framing = isFlooringFramingAllowanceKey(params.requirement.componentKey);
  const label = framing
    ? FRAMING_LABELS[params.requirement.componentKey] ??
      params.requirement.description
    : params.requirement.materialKey
      ? FLOORING_SUBSTRATE_ITEM_LABEL_BY_KEY[params.requirement.materialKey] ??
        params.requirement.description
      : params.requirement.componentKey === FLOORING_CUSTOM_FINISH_COMPONENT
        ? "Custom ordinary flooring"
        : params.requirement.componentKey === FLOORING_SPECIALIST_COMPONENT
          ? params.requirement.description
          : params.requirement.componentKey === FLOORING_CUSTOM_REMOVAL_COMPONENT
            ? "Custom existing-finish removal"
            : params.requirement.description;
  const category = framing ? "allowance" : "materials";
  const pricingOwner = framing
    ? "subcontractor_allowance"
    : "contractor_material";
  const source = mapMoneySource(
    params.requirement.rateSource === "company"
      ? "company"
      : params.requirement.rateSource === "project_override"
        ? "project_override"
        : params.requirement.rateSource === "missing"
          ? "missing"
          : "quotr"
  );
  const unit = framing
    ? "m2"
    : params.requirement.purchaseUnit;
  if (params.requirement.category === "CLIENT_SUPPLIED") {
    const line = createRateLineItem({
      workAreaId: params.requirement.workAreaId,
      workAreaName: params.workAreaName,
      label,
      category: "materials",
      quantity: params.requirement.purchaseQuantity,
      unit,
      costRate: 0,
      sellRate: 0,
      rateSource: "Client supplied",
      rateSourceType: "user_rate",
      itemKey: params.requirement.materialKey ?? undefined,
      componentKey: params.requirement.componentKey,
      sellDerivedFromMargin: false,
      sellAuthority: "explicit_sell_override",
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      notes: `Customer supplied the finish. Contractor purchasing cost is 0. ${params.requirement.specification}`,
    });
    return withPricingOwnership(
      {
        ...line,
        nestedItemId,
        identitySummary: params.requirement.specification,
        recommendedCost: 0,
        recommendedSell: 0,
        includedInTotal: false,
      },
      {
        pricingOwner: "client_supplied",
        scopeKey,
        overlapGroup: `flooring.area:${nestedItemId}`,
        includedInTotal: false,
      }
    );
  }
  if (
    !params.requirement.priced ||
    params.requirement.unitCost == null ||
    params.requirement.totalCost == null
  ) {
    return missingMoneyLine({
      requirement: params.requirement,
      workAreaName: params.workAreaName,
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      label,
      quantity: params.requirement.purchaseQuantity,
      unit,
      category,
      itemKey: framing
        ? params.requirement.componentKey
        : params.requirement.materialKey ?? undefined,
      pricingOwner,
      notes:
        params.requirement.materialKey === FLOORING_CARPET_PURCHASING_UNRESOLVED
          ? params.requirement.specification || "Carpet roll purchasing is unresolved."
          : params.requirement.componentKey === FLOORING_FINISH_SUPPLY_COMPONENT ||
              params.requirement.componentKey === FLOORING_FINISH_WASTE_COMPONENT ||
              params.requirement.componentKey === FLOORING_FINISH_ANCILLARY_COMPONENT ||
              params.requirement.componentKey === FLOORING_LAMINATE_SUPPLY_COMPONENT ||
              params.requirement.componentKey === FLOORING_LAMINATE_UNDERLAY_COMPONENT ||
              params.requirement.componentKey === FLOORING_LAMINATE_MOISTURE_COMPONENT ||
              params.requirement.componentKey === FLOORING_CARPET_TILE_SUPPLY_COMPONENT ||
              params.requirement.componentKey === FLOORING_CARPET_TILE_FIXING_COMPONENT
            ? params.requirement.specification ||
              `Pricing Required. Quantity ${params.requirement.purchaseQuantity} ${unit} remains visible.`
            : params.requirement.componentKey === FLOORING_SPECIALIST_COMPONENT
              ? params.requirement.specification?.includes("floating click-lock")
                ? params.requirement.specification
                : FLOORING_SPECIALIST_RECIPE_MESSAGE
              : `Pricing Required. Quantity ${params.requirement.purchaseQuantity} ${unit} remains visible.`,
      identitySummary: params.requirement.specification,
    });
  }
  const named = params.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key ===
        (framing
          ? params.requirement.componentKey
          : params.requirement.materialKey) &&
      rate.cost_rate != null &&
      (framing ? rate.rate_type === "allowance" : rate.rate_type === "material")
  );
  const classified = classifyResolvedSell({
    costRate: params.requirement.unitCost,
    sellRate: named?.sell_rate,
    applicableGrossMarginPercent: applicableGrossMarginPercent(
      params.organisationSettings
    ),
  });
  const projectMaterial =
    params.requirement.rateSource === "project_override" &&
    ((params.requirement.materialKey?.startsWith("flooring.laminate.") ?? false) ||
      (params.requirement.materialKey?.startsWith("flooring.carpet_tile.") ?? false));
  const line = createRateLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label,
    category,
    quantity: params.requirement.purchaseQuantity,
    unit,
    costRate: params.requirement.unitCost,
    sellRate: classified.sellRate,
    rateSource: projectMaterial
      ? getRateSourceLabel("work_area_rate")
      : source.rateSource,
    rateSourceType: projectMaterial ? "work_area_rate" : source.rateSourceType,
    itemKey: framing
      ? params.requirement.componentKey
      : params.requirement.materialKey ?? undefined,
    componentKey: params.requirement.componentKey,
    sellDerivedFromMargin: classified.sellDerivedFromMargin,
    sellAuthority: classified.sellAuthority,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    notes: framing
      ? `Combined allowance ${params.requirement.purchaseQuantity} m². Not timber materials and not labour hours.`
      : params.requirement.componentKey === FLOORING_FINISH_SUPPLY_COMPONENT ||
          params.requirement.componentKey === FLOORING_FINISH_WASTE_COMPONENT ||
          params.requirement.componentKey === FLOORING_FINISH_ANCILLARY_COMPONENT ||
          params.requirement.componentKey === FLOORING_LAMINATE_SUPPLY_COMPONENT ||
          params.requirement.componentKey === FLOORING_LAMINATE_UNDERLAY_COMPONENT ||
          params.requirement.componentKey === FLOORING_LAMINATE_MOISTURE_COMPONENT ||
          params.requirement.componentKey === FLOORING_CARPET_TILE_SUPPLY_COMPONENT ||
          params.requirement.componentKey === FLOORING_CARPET_TILE_FIXING_COMPONENT
        ? params.requirement.specification
        : `Purchase ${params.requirement.purchaseQuantity} ${unit}`,
  });
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
      identitySummary: params.requirement.specification,
    },
    {
      pricingOwner,
      scopeKey,
      overlapGroup: `flooring.area:${nestedItemId}`,
    }
  );
}

function presentHours(hours: number): string {
  const rounded = round2(hours);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function presentHoursQuantity(quantity: number): string {
  return `${presentHours(quantity)} m²`;
}

function presentRate(value: number): string {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

function presentDollars(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: Number.isInteger(round2(value)) ? 0 : 2,
  }).format(value);
}

function labourLine(params: {
  requirement: LabourRequirement;
  workAreaName: string;
  sortOrder: number;
  organisationSettings: OrganisationSettings | null;
  labourSellRate: number;
  labourSellAuthority: ReturnType<typeof classifyResolvedSell>["sellAuthority"];
  labourSellDerived: boolean;
  accessFactor: number;
  constraints?: readonly { key: string; value: unknown; source?: string | null }[];
}): EstimateLineItemInput {
  const nestedItemId = flooringRequirementNestedItemId(params.requirement);
  const scopeKey = flooringLineScopeKey({
    workAreaId: params.requirement.workAreaId,
    nestedItemId,
    componentKey: params.requirement.componentKey,
  });
  const label =
    LABOUR_LABELS[params.requirement.componentKey] ??
    params.requirement.description;
  const qty = params.requirement.productivityBasis.quantity;
  const unit = params.requirement.productivityBasis.unit;
  if (
    !params.requirement.priced ||
    params.requirement.hourlyCost == null ||
    params.requirement.totalCost == null ||
    params.requirement.productivityBasis.hoursPerUnit <= 0
  ) {
    return missingMoneyLine({
      requirement: params.requirement,
      workAreaName: params.workAreaName,
      sortOrder: params.sortOrder,
      organisationSettings: params.organisationSettings,
      label,
      quantity: qty,
      unit,
      category: "labour",
      itemKey: params.requirement.productivityBasis.key ?? undefined,
      pricingOwner: "in_house_labour",
      notes:
        params.requirement.componentKey === FLOORING_SPECIALIST_COMPONENT
          ? FLOORING_SPECIALIST_RECIPE_MESSAGE
          : params.requirement.componentKey === FLOORING_FINISH_INSTALL_COMPONENT
            ? `${params.requirement.unresolvedReason ? `${params.requirement.unresolvedReason} ` : ""}Installation hours need the company productivity rate ${FLOORING_FINISH_INSTALL_HOURS_PER_M2}. No Quotr hours default is applied. Installed ${qty} ${unit}. These hours do not include adhesive, grout, fixings or accessories.`
            : params.requirement.componentKey === FLOORING_LAMINATE_INSTALL_COMPONENT
              ? `${params.requirement.unresolvedReason ? `${params.requirement.unresolvedReason} ` : ""}Installation hours need the company productivity rate ${FLOORING_LAMINATE_INSTALL_HOURS_PER_M2}. The vinyl installation rate is not reused. Installed ${qty} ${unit}. The $60 carpenter benchmark is not used.`
              : `Pricing Required productivity. Installed ${qty} ${unit}.`,
    });
  }
  const productivitySourceType =
    params.requirement.rateProvenance === "company" ? "user_rate" : "productivity";
  const conditionParts = getLabourAdjustmentParts(
    (params.constraints ?? []).map((row) => ({
      key: row.key,
      label: row.key,
      value: row.value,
      source: row.source,
    }))
  );
  const conditionSummary = formatLabourAdjustmentPrimary(
    params.accessFactor,
    conditionParts
  );
  const line = createLabourLineItem({
    workAreaId: params.requirement.workAreaId,
    workAreaName: params.workAreaName,
    label,
    quantity: qty,
    unit,
    productivityHoursPerUnit: params.requirement.productivityBasis.hoursPerUnit,
    labourCostRate: params.requirement.hourlyCost,
    labourSellRate: params.labourSellRate,
    adjustmentFactor: params.accessFactor,
    adjustmentLabel: conditionSummary || undefined,
    rateSource:
      params.requirement.rateProvenance === "company"
        ? getRateSourceLabel("user_rate")
        : getRateSourceLabel("productivity"),
    rateSourceType:
      params.requirement.rateProvenance === "company" ? "user_rate" : "productivity",
    itemKey: params.requirement.rateKey || FLOORING_CARPENTER_LABOUR_RATE_KEY,
    componentKey: params.requirement.componentKey,
    sellDerivedFromMargin: params.labourSellDerived,
    sellAuthority: params.labourSellAuthority,
    sortOrder: params.sortOrder,
    organisationSettings: params.organisationSettings,
    productivitySourceType,
  });
  const carpetTileInstall =
    params.requirement.componentKey === FLOORING_CARPET_TILE_INSTALL_COMPONENT;
  const baseHours = round2(qty * params.requirement.productivityBasis.hoursPerUnit);
  const carpetExplanation = carpetTileInstall
    ? [
        `${presentHoursQuantity(qty)} × ${formatProductivity(params.requirement.productivityBasis.hoursPerUnit)} person-hours/m² = ${presentHours(baseHours)} h`,
        conditionSummary,
        `${presentHours(line.labourHours ?? 0)} h × ${presentRate(params.requirement.hourlyCost)}/h = ${presentDollars(line.recommendedCost ?? 0)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  return withPricingOwnership(
    {
      ...line,
      nestedItemId,
      identitySummary: carpetExplanation ?? line.identitySummary,
      notes:
        params.requirement.componentKey === FLOORING_FINISH_INSTALL_COMPONENT
          ? `Installation hours use the saved company productivity ${params.requirement.productivityBasis.hoursPerUnit} h/${unit} from ${FLOORING_FINISH_INSTALL_HOURS_PER_M2}. No Quotr hours default is applied. These hours do not include adhesive, grout, fixings or accessories.`
          : params.requirement.componentKey === FLOORING_LAMINATE_INSTALL_COMPONENT
            ? `Installation hours use the saved company productivity ${params.requirement.productivityBasis.hoursPerUnit} h/${unit} from ${FLOORING_LAMINATE_INSTALL_HOURS_PER_M2} on the net area. Carpenter cost uses the company hourly rate. The $60 benchmark is not used. ${labourBasisNote(params.constraints ?? [])}`
            : carpetExplanation
              ? `${carpetExplanation}. ${line.notes ?? ""}`.trim()
              : line.notes,
    },
    {
      pricingOwner: "in_house_labour",
      scopeKey,
      overlapGroup: `flooring.area:${nestedItemId}`,
    }
  );
}

function rollupCompleteness(
  physical: FlooringPhysicalResult,
  requirements: readonly EstimateRequirement[],
  decisionPending: boolean
): FlooringCommercialCompleteness | "empty" {
  if (physical.completeness === "empty" || physical.portions.length === 0) {
    return "empty";
  }
  if (
    physical.portions.some(
      (row) =>
        row.completeness === FLOORING_PHYSICAL_COMPLETENESS.INFORMATION_REQUIRED
    )
  ) {
    return FLOORING_COMMERCIAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  if (
    physical.portions.every(
      (row) =>
        row.completeness === FLOORING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
    )
  ) {
    return FLOORING_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST;
  }
  if (decisionPending) {
    return FLOORING_COMMERCIAL_COMPLETENESS.INFORMATION_REQUIRED;
  }
  if (requirements.some((row) => !row.priced)) {
    return FLOORING_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED;
  }
  return FLOORING_COMMERCIAL_COMPLETENESS.COMPLETE_COMMERCIAL;
}

export function commercializeFlooring(params: {
  physical: FlooringPhysicalResult;
  workArea: Pick<EstimateWorkArea, "id" | "type" | "name">;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  constraints?: readonly EstimateConstraint[];
}): FlooringCommercialResult {
  const accessFactor = getCombinedLabourAccessFactor({
    constraints: [...(params.constraints ?? [])],
  });
  const labourRate = resolveLabourRate({
    rates: [...params.rates],
    organisationSettings: params.organisationSettings,
    trade: "carpenter",
  });
  const labourSell = classifyResolvedSell({
    costRate: labourRate.costRate,
    sellRate:
      labourRate.sellAuthority === "derived_from_gross_margin"
        ? null
        : labourRate.sellRate,
    applicableGrossMarginPercent: applicableGrossMarginPercent(
      params.organisationSettings
    ),
  });
  const labourSource = mapLabourRateSourceToRequirement(labourRate.sourceType);

  const subcontract: Array<{
    requirement: SubcontractRequirement;
    quantity: number;
  }> = [];
  const materials: MaterialRequirement[] = [];
  const labour: LabourRequirement[] = [];

  for (const requirement of params.physical.requirements) {
    const nestedId = flooringRequirementNestedItemId(requirement);
    const portion = params.physical.portions.find(
      (row) => row.nestedItemId === nestedId
    );
    const allowPricing = portionAllowsOrdinaryPricing(portion);
    if (requirement.kind === "subcontract") {
      const quantity =
        requirement.componentKey === FLOORING_LAMINATE_PACKAGE_M2 ||
          requirement.componentKey === FLOORING_CARPET_TILE_PACKAGE_M2
          ? portion?.physicalNetAreaM2 ?? null
          : packageQuantity(requirement, params.physical.requirements);
      subcontract.push({
        requirement: priceFlooringSubcontract({
          requirement,
          quantity,
          rates: params.rates,
          organisationSettings: params.organisationSettings,
          allowPricing,
        }),
        quantity: quantity ?? 0,
      });
      continue;
    }
    if (requirement.kind === "material") {
      if (isFinishPackageMirror(requirement)) continue;
      materials.push(
        priceFlooringMaterial({
          requirement,
          rates: params.rates,
          organisationSettings: params.organisationSettings,
          allowPricing,
        })
      );
      continue;
    }
    if (requirement.kind !== "labour") continue;
    labour.push(
      priceFlooringLabour({
        requirement,
        rates: params.rates,
        allowPricing,
        accessFactor,
        hourlyCost: labourRate.costRate,
        labourSource,
      })
    );
  }

  const requirements: EstimateRequirement[] = [
    ...subcontract.map((row) => row.requirement),
    ...materials,
    ...labour,
  ];
  const lineItems: EstimateLineItemInput[] = [];
  let sort = 1;
  for (const row of subcontract) {
    const nestedId = flooringRequirementNestedItemId(row.requirement);
    lineItems.push(
      subcontractLine({
        requirement: row.requirement,
        quantity: row.quantity,
        workAreaName: params.workArea.name,
        sortOrder: sort++,
        organisationSettings: params.organisationSettings,
        rates: params.rates,
        portion: params.physical.portions.find((item) => item.nestedItemId === nestedId),
      })
    );
  }
  for (const requirement of materials) {
    lineItems.push(
      materialOrAllowanceLine({
        requirement,
        workAreaName: params.workArea.name,
        sortOrder: sort++,
        organisationSettings: params.organisationSettings,
        rates: params.rates,
      })
    );
  }
  for (const requirement of labour) {
    lineItems.push(
      labourLine({
        requirement,
        workAreaName: params.workArea.name,
        sortOrder: sort++,
        organisationSettings: params.organisationSettings,
        labourSellRate: labourSell.sellRate,
        labourSellAuthority: labourSell.sellAuthority,
        labourSellDerived: labourSell.sellDerivedFromMargin,
        accessFactor,
        constraints: params.constraints,
      })
    );
  }

  const decisionMessages: string[] = [];
  for (const portion of params.physical.portions) {
    const mode = flooringCostOwnerMode({
      finish: portion.finish_type,
      finishPricing: portion.finish_pricing ?? null,
      customerSupplied: portion.finish_supplied_by === "customer",
      rates: params.rates,
    });
    const waste = flooringWasteResolution({
      portion,
      purchasing: portion.purchasing,
      rates: params.rates,
    });
    if (waste.kind === "open") decisionMessages.push(waste.message);
    if (
      (portion.finish_supplied_by === "customer" ||
        portion.finish_pricing === "separate_supply") &&
      flooringAncillaryMaterialKey(portion.finish_type) &&
      !findFinishMaterialRate(
        params.rates,
        flooringAncillaryMaterialKey(portion.finish_type) ?? ""
      )
    ) {
      const label = flooringAncillaryLabel(portion.finish_type);
      const where = portion.label?.trim() || "This flooring area";
      decisionMessages.push(
        `${where}: ${label} stays with the contractor. It is included in the combined package and has no separate rate, so it is not priced and no rate is invented. Installation hours do not include it.`
      );
    }
    if (mode !== "decision_required") continue;
    const key = flooringFinishSupplyKey(portion.finish_type);
    const saved = key ? findFinishMaterialRate(params.rates, key) : undefined;
    const where = portion.label?.trim() || "This flooring area";
    decisionMessages.push(
      `${where} has a saved finish material rate${saved?.cost_rate != null ? ` of $${saved.cost_rate}` : ""} and a combined supply-and-install package. Choose the combined package or separate finish supply. The package cannot be split, so the material rate is not added on top.`
    );
  }
  const completeness = rollupCompleteness(
    params.physical,
    requirements,
    decisionMessages.length > 0
  );
  const missingInfo = [...params.physical.missingInfo, ...decisionMessages].filter(
    (row) =>
      row !== FLOORING_NESTED_NOT_CALCULATED_MESSAGE &&
      !/canonical nested|legacy Flooring allowance path|UNSUPPORTED_SPECIALIST/i.test(
        row
      )
  );
  const pricedAny = lineItems.some(
    (item) =>
      item.rateSourceType !== "missing" && (item.recommendedCost ?? 0) > 0
  );
  if (
    !pricedAny &&
    completeness === FLOORING_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
  ) {
    missingInfo.push(FLOORING_SPECIALIST_PRICING_REQUIRED_MESSAGE);
  }
  if (
    completeness === FLOORING_COMMERCIAL_COMPLETENESS.PRICING_REQUIRED ||
    completeness === FLOORING_COMMERCIAL_COMPLETENESS.UNSUPPORTED_SPECIALIST
  ) {
    for (const requirement of requirements) {
      if (requirement.priced) continue;
      const human =
        requirement.componentKey === FLOORING_SPECIALIST_COMPONENT
          ? FLOORING_SPECIALIST_RECIPE_MESSAGE
          : `Pricing required: ${requirement.description}`;
      if (
        /canonical nested|legacy Flooring allowance path|UNSUPPORTED_SPECIALIST|unsupported specialist/i.test(
          human
        )
      ) {
        continue;
      }
      if (!missingInfo.includes(human)) missingInfo.push(human);
    }
  }

  const assumptions = [...params.physical.assumptions].filter(
    (row) => row !== FLOORING_NESTED_NOT_YET_PRICED_STATEMENT
  );

  return {
    completeness,
    requirements,
    lineItems,
    assumptions,
    missingInfo: [...new Set(missingInfo)],
  };
}

export function flooringFramingCommercialCost(
  itemKey: string,
  areaM2: number,
  rates: readonly OrganisationRate[] = []
): number | null {
  return flooringFramingAuthorityCost(itemKey, areaM2, rates);
}

export function isFlooringFinishPackageComponent(key: string): boolean {
  return isOrdinaryFlooringFinishPackageKey(key);
}

/**
 * Shared Pricing Required eligibility for Flooring components.
 * Incomplete Details (missing area/finish) never emit a quantity-bearing
 * requirement, so they cannot become a manual Pricing row.
 * Other Work Areas inherit cost_known persistence on updatePricingItem
 * but keep their own Quote/eligibility proofs.
 */
export function flooringComponentIsManualPricingEligible(
  componentKey: string | null | undefined
): boolean {
  const key = componentKey ?? "";
  return (
    key === FLOORING_SPECIALIST_COMPONENT ||
    key === FLOORING_CUSTOM_FINISH_COMPONENT ||
    key === FLOORING_CUSTOM_REMOVAL_COMPONENT ||
    key === FLOORING_SUBSTRATE_MATERIAL_COMPONENT ||
    isFlooringFramingAllowanceKey(key)
  );
}

export function flooringLineIsManualPricingEligible(item: {
  componentKey?: string | null;
  rateSourceType?: string | null;
  quantity?: number | null;
  recommendedCost?: number | null;
}): boolean {
  if (item.rateSourceType !== "missing") return false;
  if (item.quantity == null || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    return false;
  }
  if (item.recommendedCost != null && item.recommendedCost > 0) return false;
  return flooringComponentIsManualPricingEligible(item.componentKey);
}

export const FLOORING_ADDON_COMPONENT_KEYS = [
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
] as const;

void FLOORING_SUBCONTRACT_RATE_KEYS;
