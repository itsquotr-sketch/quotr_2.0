/**
 * DECK-1B — deterministic rectangular Deck structural physical quantities.
 *
 * Emits shadow MaterialRequirements only. No estimate money authority.
 * DECK-STRUCT-01: quantifies supplied/assumed specification; no compliance claim.
 */
import {
  getNumberFact,
  getStringFact,
  round2,
} from "@/lib/estimate/facts";
import {
  buildMaterialRequirement,
} from "@/lib/estimate/material-requirement";
import type { MaterialWastageSettings } from "@/lib/settings/material-wastage";
import type {
  MaterialRequirement,
  RequirementAssumption,
  RequirementConfidence,
} from "@/lib/estimate/requirements";
import type {
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import { resolveStructuralMaterialRequirementRate } from "@/lib/estimate/resolve-structural-material-rate";
import {
  buildConcreteMaterialIdentity,
  buildStructuralTimberIdentity,
  buildSupportMaterialIdentity,
  serializeMaterialIdentityKey,
  type MaterialIdentity,
} from "@/lib/materials/identity";

export const DECK_JOISTS_COMPONENT_KEY = "deck.joists";
export const DECK_RIM_FRAMING_COMPONENT_KEY = "deck.rim_framing";
export const DECK_BEARERS_COMPONENT_KEY = "deck.bearers";
export const DECK_SUPPORTS_COMPONENT_KEY = "deck.supports";
export const DECK_CONCRETE_COMPONENT_KEY = "deck.concrete";
export const DECK_SUBSTRUCTURE_GROUP_KEY = "deck.substructure";

export const DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS = [
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_BEARERS_COMPONENT_KEY,
  DECK_SUPPORTS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
] as const;

export const DEFAULT_JOIST_CENTRES_MM = 450;
export const DEFAULT_FRAMING_WASTE_PERCENT = 5;

export type DeckAxis = "length" | "width";

export type DeckStructureOrientation = {
  boardDirection: DeckAxis;
  joistDirection: DeckAxis;
  bearerDirection: DeckAxis;
  boardDirectionDefaulted: boolean;
  joistDirectionDefaulted: boolean;
};

export type DeckStructureQuantities = {
  orientation: DeckStructureOrientation;
  joistCentresMm: number;
  joistCentresDefaulted: boolean;
  framingWastePercent: number;
  framingWasteDefaulted: boolean;
  joistPerpendicularSpanM: number;
  joistRunLengthM: number;
  joistSpaces: number;
  joistCount: number;
  joistBaseLm: number;
  joistPurchaseLm: number;
  rimBaseLm: number;
  rimPurchaseLm: number;
  bearerRunLengthM: number;
  bearerRowCount: number;
  bearerBaseLm: number;
  bearerPurchaseLm: number;
  supportsPerBearer: number;
  supportCount: number;
  footingVolumeEachM3: number;
  concreteBaseM3: number;
  concretePurchaseM3: number;
};

export type DeckStructureFacts = {
  deckLengthM: number;
  deckWidthM: number;
  joistCentresMm: number;
  joistCentresDefaulted: boolean;
  orientation: DeckStructureOrientation;
  joistSection: string | null;
  bearerSection: string | null;
  bearerRowCount: number | null;
  framingTreatment: string | null;
  supportType: string | null;
  supportsPerBearer: number | null;
  supportSection: string | null;
  footingLengthMm: number | null;
  footingWidthMm: number | null;
  footingDepthMm: number | null;
  factKeys: string[];
};

export type DeckSubstructureGroupReconciliation = {
  groupKey: typeof DECK_SUBSTRUCTURE_GROUP_KEY;
  parityClass: "INTENTIONAL_MODEL_IMPROVEMENT";
  legacyPackageLabel: string | null;
  legacyPackageCost: number | null;
  childComponentKeys: readonly string[];
  emittedChildComponentKeys: readonly string[];
  physicalChildCount: number;
  pricedChildComponentKeys: readonly string[];
  unpricedChildComponentKeys: readonly string[];
  pricedChildCostTotal: number | null;
  pricedChildCount: number;
  unpricedChildCount: number;
  pricingCoverage: "none" | "partial" | "all_emitted_children";
  commercialNote: string;
  status: "NOT_COMPARABLE" | "COVERAGE_PARTIAL" | "AGGREGATE_READY";
  reasons: readonly string[];
};

function perpendicular(axis: DeckAxis): DeckAxis {
  return axis === "length" ? "width" : "length";
}

function parseDeckAxis(value: string | null): DeckAxis | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("length")) return "length";
  if (normalized.includes("width")) return "width";
  return null;
}

function dimensionParallel(
  axis: DeckAxis,
  deckLengthM: number,
  deckWidthM: number
): number {
  return axis === "length" ? deckLengthM : deckWidthM;
}

function normalizeSectionToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "").replace("×", "x");
}

export function buildStructuralVariantKey(
  section: string,
  treatment: string | null
): string {
  const sectionToken = normalizeSectionToken(section);
  if (!treatment) return sectionToken;
  return `${sectionToken}-${treatment}`;
}

export function resolveDeckFramingWastePercent(
  settings: MaterialWastageSettings | null | undefined
): { percent: number; defaulted: boolean } {
  const value = settings?.timberFramingWastagePercent;
  if (value != null && Number.isFinite(Number(value))) {
    return { percent: Number(value), defaulted: false };
  }
  return { percent: DEFAULT_FRAMING_WASTE_PERCENT, defaulted: true };
}

export function resolveDeckStructureOrientation(params: {
  boardDirectionFact: string | null;
  joistDirectionFact: string | null;
}): DeckStructureOrientation {
  const boardDirectionDefaulted = params.boardDirectionFact == null;
  const boardDirection =
    parseDeckAxis(params.boardDirectionFact) ?? "length";

  const joistDirectionDefaulted = params.joistDirectionFact == null;
  const joistDirection =
    parseDeckAxis(params.joistDirectionFact) ??
    perpendicular(boardDirection);

  return {
    boardDirection,
    joistDirection,
    bearerDirection: perpendicular(joistDirection),
    boardDirectionDefaulted,
    joistDirectionDefaulted,
  };
}

export function readDeckStructureFacts(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): DeckStructureFacts | null {
  const facts = [...params.facts];
  const deckLengthM = getNumberFact(facts, params.workAreaId, "deck.length_m");
  const deckWidthM = getNumberFact(facts, params.workAreaId, "deck.width_m");
  if (
    deckLengthM == null ||
    deckWidthM == null ||
    deckLengthM <= 0 ||
    deckWidthM <= 0
  ) {
    return null;
  }

  const joistCentresFact = getNumberFact(
    facts,
    params.workAreaId,
    "deck.joist_centres_mm"
  );
  const joistCentresDefaulted = joistCentresFact == null;
  const joistCentresMm = joistCentresFact ?? DEFAULT_JOIST_CENTRES_MM;

  const orientation = resolveDeckStructureOrientation({
    boardDirectionFact: getStringFact(
      facts,
      params.workAreaId,
      "deck.board_direction"
    ),
    joistDirectionFact: getStringFact(
      facts,
      params.workAreaId,
      "deck.joist_direction"
    ),
  });

  const joistSection = getStringFact(
    facts,
    params.workAreaId,
    "deck.joist_section"
  );
  const framingTreatment = getStringFact(
    facts,
    params.workAreaId,
    "deck.framing_treatment"
  );

  const factKeys = [
    "deck.length_m",
    "deck.width_m",
    joistCentresDefaulted ? null : "deck.joist_centres_mm",
    orientation.boardDirectionDefaulted ? null : "deck.board_direction",
    orientation.joistDirectionDefaulted ? null : "deck.joist_direction",
    joistSection ? "deck.joist_section" : null,
    framingTreatment ? "deck.framing_treatment" : null,
    getStringFact(facts, params.workAreaId, "deck.bearer_section")
      ? "deck.bearer_section"
      : null,
    getNumberFact(facts, params.workAreaId, "deck.bearer_row_count") != null
      ? "deck.bearer_row_count"
      : null,
    getStringFact(facts, params.workAreaId, "deck.support_type")
      ? "deck.support_type"
      : null,
    getNumberFact(facts, params.workAreaId, "deck.supports_per_bearer") != null
      ? "deck.supports_per_bearer"
      : null,
    getStringFact(facts, params.workAreaId, "deck.support_section")
      ? "deck.support_section"
      : null,
    getNumberFact(facts, params.workAreaId, "deck.footing_length_mm") != null
      ? "deck.footing_length_mm"
      : null,
    getNumberFact(facts, params.workAreaId, "deck.footing_width_mm") != null
      ? "deck.footing_width_mm"
      : null,
    getNumberFact(facts, params.workAreaId, "deck.footing_depth_mm") != null
      ? "deck.footing_depth_mm"
      : null,
  ].filter((key): key is string => key != null);

  return {
    deckLengthM,
    deckWidthM,
    joistCentresMm,
    joistCentresDefaulted,
    orientation,
    joistSection,
    bearerSection: getStringFact(
      facts,
      params.workAreaId,
      "deck.bearer_section"
    ),
    bearerRowCount: getNumberFact(
      facts,
      params.workAreaId,
      "deck.bearer_row_count"
    ),
    framingTreatment,
    supportType: getStringFact(facts, params.workAreaId, "deck.support_type"),
    supportsPerBearer: getNumberFact(
      facts,
      params.workAreaId,
      "deck.supports_per_bearer"
    ),
    supportSection: getStringFact(
      facts,
      params.workAreaId,
      "deck.support_section"
    ),
    footingLengthMm: getNumberFact(
      facts,
      params.workAreaId,
      "deck.footing_length_mm"
    ),
    footingWidthMm: getNumberFact(
      facts,
      params.workAreaId,
      "deck.footing_width_mm"
    ),
    footingDepthMm: getNumberFact(
      facts,
      params.workAreaId,
      "deck.footing_depth_mm"
    ),
    factKeys,
  };
}

function purchaseLm(baseLm: number, wastePercent: number): number {
  return round2(baseLm * (1 + wastePercent / 100));
}

export function calculateDeckStructureQuantities(params: {
  facts: DeckStructureFacts;
  framingWastePercent: number;
}): DeckStructureQuantities {
  const { facts } = params;
  const centresM = facts.joistCentresMm / 1000;
  const joistPerpendicularSpanM = dimensionParallel(
    perpendicular(facts.orientation.joistDirection),
    facts.deckLengthM,
    facts.deckWidthM
  );
  const joistRunLengthM = dimensionParallel(
    facts.orientation.joistDirection,
    facts.deckLengthM,
    facts.deckWidthM
  );
  const joistSpaces = Math.ceil(joistPerpendicularSpanM / centresM);
  const joistCount = joistSpaces + 1;
  const joistBaseLm = round2(joistCount * joistRunLengthM);
  const joistPurchaseLm = purchaseLm(joistBaseLm, params.framingWastePercent);

  const rimEndSpanM = dimensionParallel(
    perpendicular(facts.orientation.joistDirection),
    facts.deckLengthM,
    facts.deckWidthM
  );
  const rimBaseLm = round2(2 * rimEndSpanM);
  const rimPurchaseLm = purchaseLm(rimBaseLm, params.framingWastePercent);

  const bearerRunLengthM = dimensionParallel(
    facts.orientation.bearerDirection,
    facts.deckLengthM,
    facts.deckWidthM
  );
  const bearerRowCount = facts.bearerRowCount ?? 0;
  const bearerBaseLm = round2(bearerRowCount * bearerRunLengthM);
  const bearerPurchaseLm = purchaseLm(bearerBaseLm, params.framingWastePercent);

  const supportsPerBearer = facts.supportsPerBearer ?? 0;
  const supportCount = Math.round(bearerRowCount * supportsPerBearer);

  let footingVolumeEachM3 = 0;
  let concreteBaseM3 = 0;
  if (
    facts.footingLengthMm != null &&
    facts.footingWidthMm != null &&
    facts.footingDepthMm != null
  ) {
    const volumeMm3 =
      facts.footingLengthMm *
      facts.footingWidthMm *
      facts.footingDepthMm;
    footingVolumeEachM3 = Math.round(volumeMm3 / 1000) / 1_000_000;
    const totalVolumeMm3 = supportCount * volumeMm3;
    concreteBaseM3 = Math.round(totalVolumeMm3 / 1000) / 1_000_000;
  }
  const concretePurchaseM3 = concreteBaseM3;

  return {
    orientation: facts.orientation,
    joistCentresMm: facts.joistCentresMm,
    joistCentresDefaulted: facts.joistCentresDefaulted,
    framingWastePercent: params.framingWastePercent,
    framingWasteDefaulted: false,
    joistPerpendicularSpanM,
    joistRunLengthM,
    joistSpaces,
    joistCount,
    joistBaseLm,
    joistPurchaseLm,
    rimBaseLm,
    rimPurchaseLm,
    bearerRunLengthM,
    bearerRowCount,
    bearerBaseLm,
    bearerPurchaseLm,
    supportsPerBearer,
    supportCount,
    footingVolumeEachM3,
    concreteBaseM3,
    concretePurchaseM3,
  };
}

function resolveIdentityRate(params: {
  identity: MaterialIdentity;
  unit: "lm" | "ea" | "m3";
  purchaseQuantity: number;
  rates: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): Pick<
  MaterialRequirement,
  "priced" | "rateSource" | "unitCost" | "totalCost" | "rateEvidence"
> {
  return resolveStructuralMaterialRequirementRate(params);
}

function framingTimberIdentity(
  sectionRaw: string | null,
  treatmentRaw: string | null
): MaterialIdentity | null {
  return buildStructuralTimberIdentity({
    sectionRaw,
    treatmentRaw,
  });
}

function timberVariantKey(identity: MaterialIdentity): string {
  if (!identity.section) return "unspecified";
  return buildStructuralVariantKey(identity.section, identity.treatment);
}

function orientationAssumptions(
  orientation: DeckStructureOrientation
): RequirementAssumption[] {
  const assumptions: RequirementAssumption[] = [];
  if (orientation.boardDirectionDefaulted) {
    assumptions.push({
      key: "deck.board_direction_default",
      text: "Deck boards assumed parallel to deck length.",
      source: "calculator_default",
    });
  }
  if (orientation.joistDirectionDefaulted) {
    assumptions.push({
      key: "deck.joist_direction_default",
      text: "Joists assumed perpendicular to decking boards (parallel to deck width).",
      source: "calculator_default",
    });
  }
  assumptions.push({
    key: "deck.bearer_direction_derived",
    text: "Bearers derived perpendicular to joists (parallel to deck length when joists run across width).",
    source: "calculator_default",
  });
  return assumptions;
}

function framingAssumptions(params: {
  joistCentresDefaulted: boolean;
  joistCentresMm: number;
  framingWasteDefaulted: boolean;
  framingWastePercent: number;
}): RequirementAssumption[] {
  const assumptions: RequirementAssumption[] = [];
  if (params.joistCentresDefaulted) {
    assumptions.push({
      key: "deck.joists.spacing_default",
      text: `Joist centres assumed ${params.joistCentresMm} mm for estimating.`,
      source: "calculator_default",
    });
  }
  if (params.framingWasteDefaulted) {
    assumptions.push({
      key: "deck.framing.waste_default",
      text: `Framing waste assumed ${params.framingWastePercent}%.`,
      source: "calculator_default",
    });
  }
  return assumptions;
}

function structuralConfidence(params: {
  joistCentresDefaulted: boolean;
  orientationDefaulted: boolean;
}): RequirementConfidence {
  if (!params.joistCentresDefaulted && !params.orientationDefaulted) {
    return "high";
  }
  return "medium";
}

function buildJoistRequirement(params: {
  workArea: EstimateWorkArea;
  facts: DeckStructureFacts;
  quantities: DeckStructureQuantities;
  framingWasteDefaulted: boolean;
  rates: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): MaterialRequirement | null {
  const identity = framingTimberIdentity(
    params.facts.joistSection,
    params.facts.framingTreatment
  );
  if (!identity) return null;
  const pricing = resolveIdentityRate({
    identity,
    unit: "lm",
    purchaseQuantity: params.quantities.joistPurchaseLm,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_JOISTS_COMPONENT_KEY,
    variantKey: timberVariantKey(identity),
    description: `Deck joists ${identity.section}`,
    confidence: structuralConfidence({
      joistCentresDefaulted: params.quantities.joistCentresDefaulted,
      orientationDefaulted:
        params.quantities.orientation.boardDirectionDefaulted ||
        params.quantities.orientation.joistDirectionDefaulted,
    }),
    assumptions: [
      ...orientationAssumptions(params.quantities.orientation),
      ...framingAssumptions({
        joistCentresDefaulted: params.quantities.joistCentresDefaulted,
        joistCentresMm: params.quantities.joistCentresMm,
        framingWasteDefaulted: params.framingWasteDefaulted,
        framingWastePercent: params.quantities.framingWastePercent,
      }),
    ],
    provenance: {
      calculatorSource: "deck.structure.joists",
      factKeys: params.facts.factKeys,
      constraintKeys: [],
    },
    priced: pricing.priced,
    materialKey: serializeMaterialIdentityKey(identity),
    materialIdentity: identity,
    category: "FRAMING",
    specification: identity.originalDescription ?? identity.section ?? undefined,
    baseQuantity: params.quantities.joistBaseLm,
    baseUnit: "lm",
    wasteFactor: params.quantities.framingWastePercent / 100,
    purchaseQuantity: params.quantities.joistPurchaseLm,
    purchaseUnit: "lm",
    rateSource: pricing.rateSource,
    rateEvidence: pricing.rateEvidence,
    unitCost: pricing.unitCost,
    totalCost: pricing.totalCost,
  });
}

function buildRimRequirement(params: {
  workArea: EstimateWorkArea;
  facts: DeckStructureFacts;
  quantities: DeckStructureQuantities;
  framingWasteDefaulted: boolean;
  rates: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): MaterialRequirement | null {
  const identity = framingTimberIdentity(
    params.facts.joistSection,
    params.facts.framingTreatment
  );
  if (!identity) return null;
  const pricing = resolveIdentityRate({
    identity,
    unit: "lm",
    purchaseQuantity: params.quantities.rimPurchaseLm,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_RIM_FRAMING_COMPONENT_KEY,
    variantKey: timberVariantKey(identity),
    description: `Deck end rim framing ${identity.section}`,
    confidence: structuralConfidence({
      joistCentresDefaulted: params.quantities.joistCentresDefaulted,
      orientationDefaulted:
        params.quantities.orientation.boardDirectionDefaulted ||
        params.quantities.orientation.joistDirectionDefaulted,
    }),
    assumptions: [
      ...orientationAssumptions(params.quantities.orientation),
      {
        key: "deck.rim.end_only",
        text: "Additional rim framing on joist ends only; outer parallel joists already counted in joist grid.",
        source: "calculator_default",
      },
      ...framingAssumptions({
        joistCentresDefaulted: params.quantities.joistCentresDefaulted,
        joistCentresMm: params.quantities.joistCentresMm,
        framingWasteDefaulted: params.framingWasteDefaulted,
        framingWastePercent: params.quantities.framingWastePercent,
      }),
    ],
    provenance: {
      calculatorSource: "deck.structure.rim",
      factKeys: params.facts.factKeys,
      constraintKeys: [],
    },
    priced: pricing.priced,
    materialKey: serializeMaterialIdentityKey(identity),
    materialIdentity: identity,
    category: "FRAMING",
    specification: identity.originalDescription ?? identity.section ?? undefined,
    baseQuantity: params.quantities.rimBaseLm,
    baseUnit: "lm",
    wasteFactor: params.quantities.framingWastePercent / 100,
    purchaseQuantity: params.quantities.rimPurchaseLm,
    purchaseUnit: "lm",
    rateSource: pricing.rateSource,
    rateEvidence: pricing.rateEvidence,
    unitCost: pricing.unitCost,
    totalCost: pricing.totalCost,
  });
}

function buildBearerRequirement(params: {
  workArea: EstimateWorkArea;
  facts: DeckStructureFacts;
  quantities: DeckStructureQuantities;
  framingWasteDefaulted: boolean;
  rates: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): MaterialRequirement | null {
  if (!params.facts.bearerSection || params.facts.bearerRowCount == null) {
    return null;
  }
  const identity = framingTimberIdentity(
    params.facts.bearerSection,
    params.facts.framingTreatment
  );
  if (!identity) return null;
  const pricing = resolveIdentityRate({
    identity,
    unit: "lm",
    purchaseQuantity: params.quantities.bearerPurchaseLm,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_BEARERS_COMPONENT_KEY,
    variantKey: timberVariantKey(identity),
    description: `Deck bearers ${identity.section}`,
    confidence: "high",
    assumptions: [
      ...orientationAssumptions(params.quantities.orientation),
      ...framingAssumptions({
        joistCentresDefaulted: params.quantities.joistCentresDefaulted,
        joistCentresMm: params.quantities.joistCentresMm,
        framingWasteDefaulted: params.framingWasteDefaulted,
        framingWastePercent: params.quantities.framingWastePercent,
      }),
    ],
    provenance: {
      calculatorSource: "deck.structure.bearers",
      factKeys: params.facts.factKeys,
      constraintKeys: [],
    },
    priced: pricing.priced,
    materialKey: serializeMaterialIdentityKey(identity),
    materialIdentity: identity,
    category: "FRAMING",
    specification: identity.originalDescription ?? identity.section ?? undefined,
    baseQuantity: params.quantities.bearerBaseLm,
    baseUnit: "lm",
    wasteFactor: params.quantities.framingWastePercent / 100,
    purchaseQuantity: params.quantities.bearerPurchaseLm,
    purchaseUnit: "lm",
    rateSource: pricing.rateSource,
    rateEvidence: pricing.rateEvidence,
    unitCost: pricing.unitCost,
    totalCost: pricing.totalCost,
  });
}

function buildSupportRequirement(params: {
  workArea: EstimateWorkArea;
  facts: DeckStructureFacts;
  quantities: DeckStructureQuantities;
  rates: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): MaterialRequirement | null {
  if (
    !params.facts.supportType ||
    !params.facts.supportSection ||
    params.facts.supportsPerBearer == null ||
    params.facts.bearerRowCount == null
  ) {
    return null;
  }
  const identity = buildSupportMaterialIdentity({
    supportType: params.facts.supportType,
    sectionRaw: params.facts.supportSection,
    treatmentRaw: params.facts.framingTreatment,
  });
  if (!identity) return null;
  const pricing = resolveIdentityRate({
    identity,
    unit: "ea",
    purchaseQuantity: params.quantities.supportCount,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_SUPPORTS_COMPONENT_KEY,
    variantKey: timberVariantKey(identity),
    description: `${params.facts.supportType} ${params.facts.supportSection}`,
    confidence: "high",
    assumptions: [
      {
        key: "deck.supports.count_model",
        text: `Support count = bearer rows × supports per bearer (${params.quantities.bearerRowCount} × ${params.quantities.supportsPerBearer}).`,
        source: "user_confirmed",
      },
    ],
    provenance: {
      calculatorSource: "deck.structure.supports",
      factKeys: params.facts.factKeys,
      constraintKeys: [],
    },
    priced: pricing.priced,
    materialKey: serializeMaterialIdentityKey(identity),
    materialIdentity: identity,
    category: "FRAMING",
    specification: identity.originalDescription ?? params.facts.supportSection ?? undefined,
    baseQuantity: params.quantities.supportCount,
    baseUnit: "ea",
    wasteFactor: 0,
    purchaseQuantity: params.quantities.supportCount,
    purchaseUnit: "ea",
    rateSource: pricing.rateSource,
    rateEvidence: pricing.rateEvidence,
    unitCost: pricing.unitCost,
    totalCost: pricing.totalCost,
  });
}

function buildConcreteRequirement(params: {
  workArea: EstimateWorkArea;
  facts: DeckStructureFacts;
  quantities: DeckStructureQuantities;
  rates: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): MaterialRequirement | null {
  if (
    params.facts.footingLengthMm == null ||
    params.facts.footingWidthMm == null ||
    params.facts.footingDepthMm == null ||
    params.quantities.supportCount <= 0 ||
    params.quantities.footingVolumeEachM3 <= 0
  ) {
    return null;
  }
  const identity = buildConcreteMaterialIdentity({});
  const pricing = resolveIdentityRate({
    identity,
    unit: "m3",
    purchaseQuantity: params.quantities.concretePurchaseM3,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_CONCRETE_COMPONENT_KEY,
    variantKey: "standard-footing",
    description: "Deck footing concrete",
    confidence: "high",
    assumptions: [
      {
        key: "deck.concrete.one_per_support",
        text: "One footing volume per support; 0% additional concrete waste.",
        source: "calculator_default",
      },
    ],
    provenance: {
      calculatorSource: "deck.structure.concrete",
      factKeys: params.facts.factKeys,
      constraintKeys: [],
    },
    priced: pricing.priced,
    materialKey: serializeMaterialIdentityKey(identity),
    materialIdentity: identity,
    category: "CONCRETE",
    specification: identity.originalDescription ?? "concrete",
    baseQuantity: params.quantities.concreteBaseM3,
    baseUnit: "m3",
    wasteFactor: 0,
    purchaseQuantity: params.quantities.concretePurchaseM3,
    purchaseUnit: "m3",
    rateSource: pricing.rateSource,
    rateEvidence: pricing.rateEvidence,
    unitCost: pricing.unitCost,
    totalCost: pricing.totalCost,
  });
}

export function buildDeckStructuralMaterialRequirements(params: {
  workArea: EstimateWorkArea;
  facts: readonly EstimateFact[];
  rates: readonly OrganisationRate[];
  materialWastageSettings: MaterialWastageSettings | null | undefined;
  organisationSettings?: OrganisationSettings | null;
}): {
  requirements: MaterialRequirement[];
  quantities: DeckStructureQuantities | null;
} {
  const structureFacts = readDeckStructureFacts({
    facts: params.facts,
    workAreaId: params.workArea.id,
  });
  if (!structureFacts) {
    return { requirements: [], quantities: null };
  }

  const waste = resolveDeckFramingWastePercent(params.materialWastageSettings);
  const quantities = calculateDeckStructureQuantities({
    facts: structureFacts,
    framingWastePercent: waste.percent,
  });
  quantities.framingWasteDefaulted = waste.defaulted;

  const requirements: MaterialRequirement[] = [];
  const joists = buildJoistRequirement({
    workArea: params.workArea,
    facts: structureFacts,
    quantities,
    framingWasteDefaulted: waste.defaulted,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  if (joists) requirements.push(joists);
  const rim = buildRimRequirement({
    workArea: params.workArea,
    facts: structureFacts,
    quantities,
    framingWasteDefaulted: waste.defaulted,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  if (rim) requirements.push(rim);

  const bearer = buildBearerRequirement({
    workArea: params.workArea,
    facts: structureFacts,
    quantities,
    framingWasteDefaulted: waste.defaulted,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  if (bearer) requirements.push(bearer);

  const supports = buildSupportRequirement({
    workArea: params.workArea,
    facts: structureFacts,
    quantities,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  if (supports) requirements.push(supports);

  const concrete = buildConcreteRequirement({
    workArea: params.workArea,
    facts: structureFacts,
    quantities,
    rates: params.rates,
    organisationSettings: params.organisationSettings,
  });
  if (concrete) requirements.push(concrete);

  return { requirements, quantities };
}

export function buildDeckSubstructureGroupReconciliation(params: {
  legacyLineItems: readonly EstimateLineItemInput[];
  structuralRequirements: readonly MaterialRequirement[];
}): DeckSubstructureGroupReconciliation {
  const legacyLine = params.legacyLineItems.find(
    (item) => item.label === "Framing/substructure"
  );
  const childComponentKeys = [...DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS];
  const emitted = params.structuralRequirements.map((item) => item.componentKey);
  const pricedChildren = params.structuralRequirements.filter(
    (item) => item.priced && item.totalCost != null
  );
  const unpricedChildren = params.structuralRequirements.filter(
    (item) => !item.priced
  );
  const pricedChildCostTotal =
    pricedChildren.length > 0
      ? round2(
          pricedChildren.reduce((sum, item) => sum + (item.totalCost ?? 0), 0)
        )
      : null;

  const reasons: string[] = ["intentional_model_improvement"];
  let status: DeckSubstructureGroupReconciliation["status"] = "NOT_COMPARABLE";
  let pricingCoverage: DeckSubstructureGroupReconciliation["pricingCoverage"] =
    "none";
  if (pricedChildren.length > 0 && unpricedChildren.length > 0) {
    pricingCoverage = "partial";
  } else if (pricedChildren.length > 0 && unpricedChildren.length === 0) {
    pricingCoverage = "all_emitted_children";
  }
  if (legacyLine == null) {
    reasons.push("missing_legacy_substructure_line");
  } else if (unpricedChildren.length > 0) {
    status = "COVERAGE_PARTIAL";
    reasons.push("unpriced_structural_children");
    reasons.push("priced_child_aggregate_is_not_complete_substructure_cost");
  } else if (pricedChildCostTotal != null) {
    status = "AGGREGATE_READY";
    reasons.push("priced_children_available_for_aggregate_review");
    reasons.push("shadow_only_not_commercial_substructure_authority");
  }

  return {
    groupKey: DECK_SUBSTRUCTURE_GROUP_KEY,
    parityClass: "INTENTIONAL_MODEL_IMPROVEMENT",
    legacyPackageLabel: legacyLine?.label ?? null,
    legacyPackageCost: legacyLine?.recommendedCost ?? null,
    childComponentKeys,
    emittedChildComponentKeys: emitted,
    physicalChildCount: params.structuralRequirements.length,
    pricedChildComponentKeys: pricedChildren.map((item) => item.componentKey),
    unpricedChildComponentKeys: unpricedChildren.map((item) => item.componentKey),
    pricedChildCostTotal,
    pricedChildCount: pricedChildren.length,
    unpricedChildCount: unpricedChildren.length,
    pricingCoverage,
    commercialNote:
      "PARTIAL PRICED STRUCTURAL CHILD COST — SHADOW diagnostic aggregate only. Not substructure cost, not total structural cost, and not complete detailed cost. Does not enter estimate money.",
    status,
    reasons,
  };
}
