/**
 * FENCE-MATURITY-1B — Timber commercial layer.
 * Consumes 1A physical takeoff. Does not recalculate geometry.
 * Modular systems remain LEGACY_PACKAGE_AUTHORITY.
 */

import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { round2 } from "@/lib/estimate/facts";
import {
  FENCE_BOARDS_COMPONENT,
  FENCE_BOARD_LABOUR_COMPONENT,
  FENCE_CAPPING_COMPONENT,
  FENCE_CAPPING_LABOUR_COMPONENT,
  FENCE_CONCRETE_COMPONENT,
  FENCE_CONCRETE_LABOUR_COMPONENT,
  FENCE_FACE_AREA_COMPONENT,
  FENCE_FIXINGS_TIMBER_COMPONENT,
  FENCE_FIXINGS_TIMBER_KEY,
  FENCE_FRAMING_LABOUR_COMPONENT,
  FENCE_GATE_FRAME_COMPONENT,
  FENCE_GATE_HARDWARE_COMPONENT,
  FENCE_GATE_POSTS_EA_COMPONENT,
  FENCE_GATE_LABOUR_COMPONENT,
  FENCE_POSTS_EA_COMPONENT,
  FENCE_POSTS_LM_COMPONENT,
  FENCE_POST_LABOUR_COMPONENT,
  FENCE_PREMIX_20KG_KEY,
  FENCE_RAILS_COMPONENT,
} from "@/lib/estimate/fence-identities";
import type { FencePhysicalModel } from "@/lib/estimate/fence-physical";
import { FENCE_PRODUCTIVITY_KEYS } from "@/lib/estimate/fence-productivity";
import { isTimberFenceSystem } from "@/lib/estimate/fence-systems";
import {
  FENCE_CAPPING_SECTION_DISCLOSURE,
  FENCE_GATE_FRAME_DISCLOSURE,
  FENCE_GATE_LABOUR_OWNERSHIP_1B,
  FENCE_POST_PROCUREMENT_NOTE,
  FENCE_TIMBER_1B_ACCESS_RULE,
  FENCE_TIMBER_1B_AUTHORITY,
  FENCE_TIMBER_1B_PACKAGE,
  FENCE_TIMBER_FIXINGS_BASE_COMPONENTS,
  FENCE_TIMBER_FIXINGS_METHOD,
  FENCE_TIMBER_FIXINGS_PERCENT,
  timber1BMaterialStarter,
  timber1BProductivityStarter,
} from "@/lib/estimate/fence-timber-1b";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { findCompanyProductivityRate } from "@/lib/estimate/productivity";
import { rateUnitsMatch } from "@/lib/estimate/rates";
import { RW_PREMIX_20KG_KEY } from "@/lib/estimate/retaining-wall-identities";
import {
  hasTrustedPhysicalQuantity,
  resolveComponentCommercialAuthority,
  type ComponentCommercialAuthority,
} from "@/lib/estimate/component-commercial-authority";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
  RequirementRateSource,
} from "@/lib/estimate/requirements";
import type { EstimateConstraint, EstimateFact } from "@/lib/estimate/types";
import { classifyResolvedSell } from "@/lib/commercial-engine/core/cost-first-authority";

export type FenceSystemAuthorityMode =
  | "DETAILED_COMPONENT_AUTHORITY"
  | "LEGACY_PACKAGE_AUTHORITY";

export type FenceCoverageState =
  | "DETAILED_PRICED"
  | "PRICING_REQUIRED"
  | "NOT_APPLICABLE"
  | "EXPLICIT_ALLOWANCE"
  | "PACKAGE";

export type FenceCoverageCategory = {
  key: string;
  kind: "material" | "labour" | "residual" | "allowance";
  required: boolean;
  state: FenceCoverageState;
};

export type FenceCommercialResult = {
  mode: FenceSystemAuthorityMode;
  commerciallyReady: boolean;
  coverage: readonly FenceCoverageCategory[];
  reason: string;
  requirements: EstimateRequirement[];
  assumptions: string[];
  missingInfo: string[];
  inherited: string[];
};

const SKIP_MONEY = new Set([
  FENCE_FACE_AREA_COMPONENT,
  FENCE_POSTS_EA_COMPONENT,
  FENCE_GATE_POSTS_EA_COMPONENT,
]);

const PACKAGE_NOTE =
  "Physical model is detailed. Package remains money until Timber commercial coverage is complete.";

function quotrStartersAllowed(
  organisationSettings: OrganisationSettings | null
): boolean {
  return organisationSettings?.allow_benchmark_rates !== false;
}

function findExactNamedMaterialRate(
  rates: readonly OrganisationRate[],
  itemKey: string,
  unit: string
): OrganisationRate | undefined {
  const matches = rates.filter(
    (rate) =>
      rate.active &&
      (rate.rate_type === "material" || rate.rate_type === "project_material") &&
      rate.item_key === itemKey &&
      rate.cost_rate != null &&
      rateUnitsMatch(rate.unit, unit)
  );
  return (
    matches.find((rate) => rate.rate_type === "project_material") ?? matches[0]
  );
}

function priceMaterial(
  requirement: MaterialRequirement,
  rates: readonly OrganisationRate[],
  organisationSettings: OrganisationSettings | null,
  inherited: string[]
): MaterialRequirement {
  if (!hasTrustedPhysicalQuantity(requirement.purchaseQuantity)) {
    return requirement;
  }
  const unit = requirement.purchaseUnit;
  const namedKeys = [requirement.materialKey].filter(
    (key): key is string => Boolean(key)
  );
  if (requirement.componentKey === FENCE_CONCRETE_COMPONENT) {
    namedKeys.push(FENCE_PREMIX_20KG_KEY, RW_PREMIX_20KG_KEY);
  }
  for (const key of namedKeys) {
    const named = findExactNamedMaterialRate(rates, key, unit);
    if (named?.cost_rate != null) {
      const unitCost = Number(named.cost_rate);
      return {
        ...requirement,
        priced: true,
        unitCost,
        totalCost: round2(requirement.purchaseQuantity * unitCost),
        rateSource:
          named.rate_type === "project_material" ? "project_override" : "company",
      };
    }
  }

  if (quotrStartersAllowed(organisationSettings)) {
    for (const key of namedKeys) {
      const starter = timber1BMaterialStarter(key);
      if (starter && rateUnitsMatch(starter.unit, unit) && starter.costPerUnit > 0) {
        inherited.push(
          `${requirement.componentKey} used Quotr starter ${starter.costPerUnit}/${starter.unit}`
        );
        return {
          ...requirement,
          priced: true,
          unitCost: starter.costPerUnit,
          totalCost: round2(requirement.purchaseQuantity * starter.costPerUnit),
          rateSource: "benchmark",
        };
      }
    }
  }

  return {
    ...requirement,
    priced: false,
    unitCost: null,
    totalCost: null,
    rateSource: "missing",
  };
}

function labourSlot(params: {
  workAreaId: string;
  componentKey: string;
  description: string;
  productivityKey: string;
  unit: string;
  quantity: number;
  rates: readonly OrganisationRate[];
  hourlyCost: number;
  organisationSettings: OrganisationSettings | null;
  accessSensitive: boolean;
}): LabourRequirement {
  const company = findCompanyProductivityRate(
    params.rates,
    params.productivityKey,
    params.unit
  );
  const starter = timber1BProductivityStarter(params.productivityKey);
  const hoursPerUnit =
    company?.cost_rate != null
      ? Number(company.cost_rate)
      : quotrStartersAllowed(params.organisationSettings)
        ? starter?.hoursPerUnit ?? null
        : null;
  const hoursSource: RequirementRateSource =
    company?.cost_rate != null
      ? "company"
      : hoursPerUnit != null
        ? "benchmark"
        : "missing";
  const priced =
    hoursPerUnit != null &&
    hoursPerUnit > 0 &&
    params.hourlyCost > 0 &&
    hasTrustedPhysicalQuantity(params.quantity);
  const baseHours =
    priced && hoursPerUnit != null
      ? round2(params.quantity * hoursPerUnit)
      : 0;
  return buildLabourRequirement({
    workAreaId: params.workAreaId,
    workAreaType: "fence",
    componentKey: params.componentKey,
    description: params.description,
    confidence: priced ? "medium" : "low",
    assumptions: priced
      ? []
      : [
          {
            key: "productivity_required",
            text: `Needs productivity for ${params.description} (${params.quantity} ${params.unit}). Not zero hours.`,
            source: "calculator_default",
          },
        ],
    provenance: {
      calculatorSource: "fence.labour",
      factKeys: [],
      constraintKeys: params.accessSensitive
        ? ["site_access", "material_carry_distance"]
        : ["site_access"],
    },
    priced,
    trade: "carpenter",
    baseHours,
    productivityBasis: {
      key: params.productivityKey,
      hoursPerUnit: hoursPerUnit ?? 0,
      unit: params.unit,
      quantity: params.quantity,
    },
    adjustmentRef: { factors: [] },
    adjustedHours: baseHours,
    rateKey: params.productivityKey,
    hourlyCost: priced ? params.hourlyCost : null,
    totalCost: priced ? round2(baseHours * params.hourlyCost) : null,
    rateProvenance: priced ? hoursSource : "missing",
  });
}

function isCommerciallyCovered(state: FenceCoverageState): boolean {
  return state === "DETAILED_PRICED" || state === "EXPLICIT_ALLOWANCE";
}

function coverageRow(
  key: string,
  kind: FenceCoverageCategory["kind"],
  required: boolean,
  requirement: MaterialRequirement | LabourRequirement | undefined
): FenceCoverageCategory {
  if (!required) {
    return { key, kind, required: false, state: "NOT_APPLICABLE" };
  }
  if (!requirement || !hasTrustedPhysicalQuantity(
    requirement.kind === "material"
      ? requirement.purchaseQuantity
      : requirement.productivityBasis.quantity
  )) {
    return { key, kind, required: true, state: "PRICING_REQUIRED" };
  }
  return {
    key,
    kind,
    required: true,
    state: requirement.priced ? "DETAILED_PRICED" : "PRICING_REQUIRED",
  };
}

export function fenceCoverageIsReady(
  coverage: readonly FenceCoverageCategory[]
): boolean {
  return coverage.filter((row) => row.required).every((row) => isCommerciallyCovered(row.state));
}

export function fencePostPromotionHold(
  coverage: readonly FenceCoverageCategory[]
): boolean {
  const required = coverage.filter((row) => row.required);
  if (required.length === 0) return false;
  const uncovered = required.filter((row) => !isCommerciallyCovered(row.state));
  if (uncovered.length === 0) return true;
  const somePriced = required.some((row) => row.state === "DETAILED_PRICED");
  return somePriced && uncovered.every((row) => row.state === "PRICING_REQUIRED");
}

export function detailedFenceMoneyMaterials(
  requirements: readonly EstimateRequirement[]
): MaterialRequirement[] {
  return requirements.filter(
    (row): row is MaterialRequirement =>
      row.kind === "material" &&
      !SKIP_MONEY.has(row.componentKey) &&
      hasTrustedPhysicalQuantity(row.purchaseQuantity)
  );
}

export function detailedFenceLabour(
  requirements: readonly EstimateRequirement[]
): LabourRequirement[] {
  return requirements.filter(
    (row): row is LabourRequirement => row.kind === "labour"
  );
}

export function packageXorDetailedHolds(params: {
  mode: FenceSystemAuthorityMode;
  hasPackageFenceLine: boolean;
  hasDetailedMoneyLine: boolean;
}): boolean {
  if (params.mode === "DETAILED_COMPONENT_AUTHORITY") {
    return !params.hasPackageFenceLine;
  }
  return !params.hasDetailedMoneyLine;
}

export function isFencePackageLineLabel(label: string): boolean {
  return label === "Fence labour" || label === "Fence materials";
}

export function fenceCommercialLineLabel(
  requirement: Pick<EstimateRequirement, "componentKey" | "description">
): string {
  switch (requirement.componentKey) {
    case FENCE_POSTS_LM_COMPONENT:
      return "Fence posts";
    case FENCE_BOARDS_COMPONENT:
      return /slat/i.test(requirement.description)
        ? "Horizontal slats"
        : "Fence palings";
    case FENCE_RAILS_COMPONENT:
      return "Fence rails";
    case FENCE_CAPPING_COMPONENT:
      return "Top capping";
    case FENCE_GATE_FRAME_COMPONENT:
      return "Gate frame";
    case FENCE_GATE_HARDWARE_COMPONENT:
      return "Gate hardware";
    case FENCE_CONCRETE_COMPONENT:
      return "Post-hole concrete";
    case FENCE_FIXINGS_TIMBER_COMPONENT:
      return "Fence fixings";
    case FENCE_POST_LABOUR_COMPONENT:
      return "Post installation";
    case FENCE_FRAMING_LABOUR_COMPONENT:
      return "Rail/framing installation";
    case FENCE_BOARD_LABOUR_COMPONENT:
      return /slat/i.test(requirement.description)
        ? "Horizontal slat installation"
        : "Vertical paling installation";
    case FENCE_CAPPING_LABOUR_COMPONENT:
      return "Top-cap installation";
    case FENCE_GATE_LABOUR_COMPONENT:
      return "Timber gate fabrication & installation";
    case FENCE_CONCRETE_LABOUR_COMPONENT:
      return "Post-hole concrete placement";
    default:
      return requirement.description;
  }
}

export function isFenceDetailedMoneyComponent(componentKey: string | undefined): boolean {
  if (!componentKey) return false;
  if (SKIP_MONEY.has(componentKey)) return false;
  return (
    componentKey.startsWith("fence.") &&
    componentKey !== "fence.face"
  );
}

export function fenceLabourIncludesCarry(componentKey: string): boolean {
  if (componentKey === FENCE_CONCRETE_LABOUR_COMPONENT) {
    return FENCE_TIMBER_1B_ACCESS_RULE.concretePlacementIncludesCarry;
  }
  return FENCE_TIMBER_1B_ACCESS_RULE.inwardMaterialIncludesCarry;
}

export function detailedFenceLabourFromCost(
  costPerHour: number,
  organisationSettings: OrganisationSettings | null
): {
  costPerHour: number;
  sellPerHour: number;
  sellAuthority: "derived_from_gross_margin";
} {
  const gm =
    organisationSettings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT;
  const classified = classifyResolvedSell({
    costRate: costPerHour,
    sellRate: null,
    applicableGrossMarginPercent: gm,
  });
  return {
    costPerHour,
    sellPerHour: classified.sellRate,
    sellAuthority: "derived_from_gross_margin",
  };
}

export function commercializeFence(params: {
  physical: FencePhysicalModel;
  facts: readonly EstimateFact[];
  workAreaId: string;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  constraints?: readonly EstimateConstraint[];
}): FenceCommercialResult {
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  const inherited: string[] = [];
  const { physical, workAreaId, rates, organisationSettings } = params;

  if (!isTimberFenceSystem(physical.system) || !physical.timber) {
    return {
      mode: FENCE_TIMBER_1B_PACKAGE,
      commerciallyReady: false,
      coverage: [],
      reason:
        physical.system === "missing" || physical.system === "unsupported"
          ? "Fence type is not a commercially mature Timber system."
          : "Modular Fence remains LEGACY_PACKAGE_AUTHORITY in 1B.",
      requirements: physical.requirements,
      assumptions,
      missingInfo,
      inherited,
    };
  }

  const timber = physical.timber;
  void params.facts;
  void params.constraints;

  const fromPhysical = physical.requirements.filter(
    (row): row is MaterialRequirement =>
      row.kind === "material"
  );

  const pricedMaterials: MaterialRequirement[] = [];
  for (const row of fromPhysical) {
    if (row.componentKey === FENCE_FIXINGS_TIMBER_COMPONENT) continue;
    if (SKIP_MONEY.has(row.componentKey)) {
      pricedMaterials.push(row);
      continue;
    }
    if (
      row.componentKey === FENCE_POSTS_LM_COMPONENT &&
      timber.postProcurement.ok === false
    ) {
      pricedMaterials.push({
        ...row,
        priced: false,
        unitCost: null,
        totalCost: null,
        rateSource: "missing",
      });
      missingInfo.push("Fence post stock length longer than available stock");
      continue;
    }
    pricedMaterials.push(priceMaterial(row, rates, organisationSettings, inherited));
  }

  assumptions.push(FENCE_POST_PROCUREMENT_NOTE);
  assumptions.push(FENCE_CAPPING_SECTION_DISCLOSURE);
  if (timber.gateIncluded) {
    assumptions.push(FENCE_GATE_FRAME_DISCLOSURE);
    assumptions.push(FENCE_GATE_LABOUR_OWNERSHIP_1B);
  }

  const timberBaseCost = pricedMaterials
    .filter(
      (row) =>
        (FENCE_TIMBER_FIXINGS_BASE_COMPONENTS as readonly string[]).includes(
          row.componentKey
        ) && row.priced === true && row.totalCost != null
    )
    .reduce((sum, row) => sum + (row.totalCost ?? 0), 0);

  const fixingsNamed = findExactNamedMaterialRate(
    rates,
    FENCE_FIXINGS_TIMBER_KEY,
    "allowance"
  );
  let fixings: MaterialRequirement;
  if (fixingsNamed?.cost_rate != null) {
    const unitCost = Number(fixingsNamed.cost_rate);
    fixings = buildMaterialRequirement({
      workAreaId,
      workAreaType: "fence",
      componentKey: FENCE_FIXINGS_TIMBER_COMPONENT,
      description: "Fence fixings",
      confidence: "medium",
      assumptions: [],
      provenance: {
        calculatorSource: "fence.fixings",
        factKeys: [],
        constraintKeys: [],
      },
      priced: true,
      materialKey: FENCE_FIXINGS_TIMBER_KEY,
      category: "FIXINGS",
      specification: "Company fence fixings allowance. Not an exact fastener count.",
      baseQuantity: 1,
      baseUnit: "allowance",
      wasteFactor: 0,
      purchaseQuantity: 1,
      purchaseUnit: "allowance",
      rateSource:
        fixingsNamed.rate_type === "project_material" ? "project_override" : "company",
      unitCost,
      totalCost: round2(unitCost),
    });
  } else if (timberBaseCost > 0) {
    const totalCost = round2(timberBaseCost * FENCE_TIMBER_FIXINGS_PERCENT);
    fixings = buildMaterialRequirement({
      workAreaId,
      workAreaType: "fence",
      componentKey: FENCE_FIXINGS_TIMBER_COMPONENT,
      description: "Fence fixings",
      confidence: "low",
      assumptions: [],
      provenance: {
        calculatorSource: "fence.fixings",
        factKeys: [],
        constraintKeys: [],
      },
      priced: true,
      materialKey: FENCE_FIXINGS_TIMBER_KEY,
      category: "FIXINGS",
      specification: `${Math.round(FENCE_TIMBER_FIXINGS_PERCENT * 100)}% of board/slat, rail and capping material cost. Excludes posts, concrete, gate frame and gate hardware. Calculated allowance, not an exact fastener count. ${FENCE_TIMBER_FIXINGS_METHOD}`,
      baseQuantity: 1,
      baseUnit: "allowance",
      wasteFactor: 0,
      purchaseQuantity: 1,
      purchaseUnit: "allowance",
      rateSource: "benchmark",
      unitCost: totalCost,
      totalCost,
    });
  } else {
    fixings = buildMaterialRequirement({
      workAreaId,
      workAreaType: "fence",
      componentKey: FENCE_FIXINGS_TIMBER_COMPONENT,
      description: "Fence fixings",
      confidence: "low",
      assumptions: [],
      provenance: {
        calculatorSource: "fence.fixings",
        factKeys: [],
        constraintKeys: [],
      },
      priced: false,
      materialKey: FENCE_FIXINGS_TIMBER_KEY,
      category: "FIXINGS",
      specification: "Fence fixings need a timber material cost base. Not an exact fastener count.",
      baseQuantity: 1,
      baseUnit: "allowance",
      wasteFactor: 0,
      purchaseQuantity: 1,
      purchaseUnit: "allowance",
      rateSource: "missing",
      unitCost: null,
      totalCost: null,
    });
  }
  pricedMaterials.push(fixings);

  return {
    mode: FENCE_TIMBER_1B_PACKAGE,
    commerciallyReady: false,
    coverage: [],
    reason: PACKAGE_NOTE,
    requirements: [...pricedMaterials],
    assumptions,
    missingInfo,
    inherited,
  };
}

function finishFenceCommercial(params: {
  physical: FencePhysicalModel;
  workAreaId: string;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  pricedMaterials: MaterialRequirement[];
  labour: LabourRequirement[];
  assumptions: string[];
  inherited: string[];
}): FenceCommercialResult {
  const missingInfo: string[] = [];
  const timber = params.physical.timber!;
  const vertical = timber.orientation === "vertical";
  const byKey = (key: string) =>
    params.pricedMaterials.find((row) => row.componentKey === key);
  const labourBy = (key: string) =>
    params.labour.find((row) => row.componentKey === key);

  const coverage: FenceCoverageCategory[] = [
    coverageRow("posts_lm", "material", true, byKey(FENCE_POSTS_LM_COMPONENT)),
    coverageRow("boards", "material", true, byKey(FENCE_BOARDS_COMPONENT)),
    coverageRow("rails", "material", vertical && timber.railLm > 0, byKey(FENCE_RAILS_COMPONENT)),
    coverageRow(
      "capping",
      "material",
      timber.cappingIncluded,
      byKey(FENCE_CAPPING_COMPONENT)
    ),
    coverageRow(
      "gate_frame",
      "material",
      timber.gateIncluded,
      byKey(FENCE_GATE_FRAME_COMPONENT)
    ),
    coverageRow(
      "gate_hardware",
      "material",
      timber.gateIncluded,
      byKey(FENCE_GATE_HARDWARE_COMPONENT)
    ),
    coverageRow("concrete", "material", true, byKey(FENCE_CONCRETE_COMPONENT)),
    coverageRow("fixings", "residual", true, byKey(FENCE_FIXINGS_TIMBER_COMPONENT)),
    coverageRow("post_labour", "labour", true, labourBy(FENCE_POST_LABOUR_COMPONENT)),
    coverageRow(
      "rail_labour",
      "labour",
      vertical && timber.railLm > 0,
      labourBy(FENCE_FRAMING_LABOUR_COMPONENT)
    ),
    coverageRow("board_labour", "labour", true, labourBy(FENCE_BOARD_LABOUR_COMPONENT)),
    coverageRow(
      "capping_labour",
      "labour",
      timber.cappingIncluded,
      labourBy(FENCE_CAPPING_LABOUR_COMPONENT)
    ),
    coverageRow(
      "gate_labour",
      "labour",
      timber.gateIncluded,
      labourBy(FENCE_GATE_LABOUR_COMPONENT)
    ),
    coverageRow(
      "concrete_labour",
      "labour",
      true,
      labourBy(FENCE_CONCRETE_LABOUR_COMPONENT)
    ),
  ];

  for (const row of params.pricedMaterials) {
    if (SKIP_MONEY.has(row.componentKey)) continue;
    if (hasTrustedPhysicalQuantity(row.purchaseQuantity) && row.priced !== true) {
      missingInfo.push(`${row.description} trusted price`);
    }
  }
  for (const row of params.labour) {
    if (row.priced !== true) missingInfo.push(`${row.description} productivity`);
  }

  const commerciallyReady = fenceCoverageIsReady(coverage);
  const postPromotion = fencePostPromotionHold(coverage);
  const detailedMoney = commerciallyReady || (postPromotion && !commerciallyReady);
  const mode: FenceSystemAuthorityMode = detailedMoney
    ? FENCE_TIMBER_1B_AUTHORITY
    : FENCE_TIMBER_1B_PACKAGE;
  const reason = commerciallyReady
    ? "Required Timber commercial categories are covered. Detailed component money is authoritative."
    : detailedMoney
      ? "Detailed money remains after promotion. A missing exact material or productivity rate is Pricing Required and does not restore package."
      : PACKAGE_NOTE;
  if (mode === FENCE_TIMBER_1B_PACKAGE) {
    params.assumptions.push(PACKAGE_NOTE);
  }

  return {
    mode,
    commerciallyReady,
    coverage,
    reason,
    requirements: [...params.pricedMaterials, ...params.labour],
    assumptions: params.assumptions,
    missingInfo,
    inherited: params.inherited,
  };
}

export function commercializeFenceWithLabour(params: {
  physical: FencePhysicalModel;
  facts: readonly EstimateFact[];
  workAreaId: string;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  constraints?: readonly EstimateConstraint[];
  hourlyCost: number;
}): FenceCommercialResult {
  const first = commercializeFence(params);
  if (!isTimberFenceSystem(params.physical.system) || !params.physical.timber) {
    return first;
  }
  const timber = params.physical.timber;
  const labour: LabourRequirement[] = [];
  const slot = (
    componentKey: string,
    description: string,
    productivityKey: string,
    unit: string,
    quantity: number,
    accessSensitive: boolean
  ) => {
    if (!hasTrustedPhysicalQuantity(quantity)) return;
    labour.push(
      labourSlot({
        workAreaId: params.workAreaId,
        componentKey,
        description,
        productivityKey,
        unit,
        quantity,
        rates: params.rates,
        hourlyCost: params.hourlyCost,
        organisationSettings: params.organisationSettings,
        accessSensitive,
      })
    );
  };

  slot(
    FENCE_POST_LABOUR_COMPONENT,
    "Post installation",
    FENCE_PRODUCTIVITY_KEYS.postInstall,
    "post",
    timber.postCount,
    true
  );
  if (timber.orientation === "vertical" && timber.railRequiredLm > 0) {
    slot(
      FENCE_FRAMING_LABOUR_COMPONENT,
      "Rail/framing installation",
      FENCE_PRODUCTIVITY_KEYS.railLm,
      "lm",
      timber.railRequiredLm,
      true
    );
  }
  slot(
    FENCE_BOARD_LABOUR_COMPONENT,
    timber.orientation === "horizontal"
      ? "Horizontal slat installation"
      : "Vertical paling installation",
    timber.orientation === "horizontal"
      ? FENCE_PRODUCTIVITY_KEYS.horizontalSlatsLm
      : FENCE_PRODUCTIVITY_KEYS.verticalBoardsLm,
    "lm",
    timber.boardRequiredLm,
    true
  );
  if (timber.cappingIncluded && timber.cappingLm > 0) {
    slot(
      FENCE_CAPPING_LABOUR_COMPONENT,
      "Top-cap installation",
      FENCE_PRODUCTIVITY_KEYS.cappingLm,
      "lm",
      timber.cappingLm,
      true
    );
  }
  if (timber.gateIncluded && timber.gateCount > 0) {
    slot(
      FENCE_GATE_LABOUR_COMPONENT,
      "Timber gate fabrication & installation",
      FENCE_PRODUCTIVITY_KEYS.gateInstall,
      "gate",
      timber.gateCount,
      true
    );
  }
  slot(
    FENCE_CONCRETE_LABOUR_COMPONENT,
    "Post-hole concrete placement",
    FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag,
    "bag",
    timber.concrete.bagCount,
    false
  );

  const materials = first.requirements.filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
  return finishFenceCommercial({
    physical: params.physical,
    workAreaId: params.workAreaId,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
    pricedMaterials: materials,
    labour,
    assumptions: first.assumptions,
    inherited: first.inherited,
  });
}

export function componentAuthorityOfFence(
  requirement: MaterialRequirement | LabourRequirement
): ComponentCommercialAuthority {
  if (requirement.kind === "material") {
    return resolveComponentCommercialAuthority({
      applicable: !SKIP_MONEY.has(requirement.componentKey),
      hasTrustedPhysicalQuantity: hasTrustedPhysicalQuantity(
        requirement.purchaseQuantity
      ),
      hasTrustedRate: requirement.priced === true,
    });
  }
  return resolveComponentCommercialAuthority({
    applicable: true,
    hasTrustedPhysicalQuantity: hasTrustedPhysicalQuantity(
      requirement.productivityBasis.quantity
    ),
    hasTrustedRate: requirement.priced === true,
  });
}
