/**
 * DECK-1B — deterministic rectangular Deck structural physical quantities.
 *
 * Emits shadow MaterialRequirements only. No estimate money authority.
 * DECK-STRUCT-01: quantifies supplied/assumed specification; no compliance claim.
 */
import {
  getBooleanFact,
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
import { calculateDeckPostLength } from "@/lib/estimate/deck-support-length";
import { procureHousePiles } from "@/lib/estimate/deck-pile-procurement";
import {
  DEFAULT_BEARER_SECTION,
  DEFAULT_FRAMING_TREATMENT,
  DEFAULT_JOIST_SECTION,
  DEFAULT_LIGHT_SUPPORT_SECTION,
  DEFAULT_SUPPORT_SECTION,
  DEFAULT_SUPPORT_TREATMENT,
  DEFAULT_SUPPORT_TYPE,
  DECK_IDENTITY_ESTIMATING_DISCLAIMER,
  resolveFramingIdentityFromFacts,
} from "@/lib/estimate/deck-default-identities";
import {
  buildConcreteMaterialIdentity,
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
/**
 * Bearer-row / support spacing along a run.
 * Provenance: LEGACY / UNSOURCED estimating default (DECK-1 architecture
 * example). Not a validated span-table or compliance rule.
 */
export const DEFAULT_BEARER_SPACING_M = 1.8;
export const DEFAULT_SUPPORT_SPACING_M = 1.8;
/** Square/near-square tie: keep historical joists-along-width default. */
export const SHORTER_AXIS_TIE_TOLERANCE_M = 0.05;

export const CONSERVATIVE_SUPPORT_LAYOUT_HINT =
  "Support layout estimated conservatively. An existing connection is not assumed to provide structural support.";

export const PLANNING_TAKEOFF_PARENT_HINT =
  "Planning quantities are included within the framing/substructure allowance and are not priced separately.";

export const DECK_STRUCTURAL_ESTIMATING_DISCLAIMER =
  "Planning quantities use the current estimating layout assumptions. Final member sizing, spans, foundations and structural requirements should be confirmed where required.";

export const DECK_PHYSICAL_TAKEOFF_UNAVAILABLE_HINT =
  "More detail needed for framing quantities.";

export type DeckGeometryReadiness =
  | "DETAILED_GEOMETRY_AVAILABLE"
  | "AREA_ONLY"
  | "IRREGULAR_UNSUPPORTED";

export type DeckAxis = "length" | "width";

export type DeckJoistOrientationSource =
  | "explicit_joist"
  | "explicit_board"
  | "derived_shorter_span"
  | "historical_default";

export type DeckStructureOrientation = {
  boardDirection: DeckAxis;
  joistDirection: DeckAxis;
  bearerDirection: DeckAxis;
  boardDirectionDefaulted: boolean;
  joistDirectionDefaulted: boolean;
  joistOrientationSource: DeckJoistOrientationSource;
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
  bearerRowCountDefaulted: boolean;
  supportsPerBearerDefaulted: boolean;
  layoutEstimated: boolean;
  postEmbedmentM: number | null;
  postLengthEachM: number | null;
  postTotalLm: number | null;
  postPurchaseLengthEachM: number | null;
  postPurchaseLm: number | null;
  postProcurementOk: boolean | null;
  joistSectionDefaulted: boolean;
  bearerSectionDefaulted: boolean;
  supportIdentityDefaulted: boolean;
};

export type DeckStructureFacts = {
  deckLengthM: number;
  deckWidthM: number;
  deckHeightM: number | null;
  joistCentresMm: number;
  joistCentresDefaulted: boolean;
  orientation: DeckStructureOrientation;
  joistSection: string | null;
  joistSectionDefaulted: boolean;
  bearerSection: string | null;
  bearerSectionDefaulted: boolean;
  bearerRowCount: number | null;
  framingTreatment: string | null;
  supportType: string | null;
  supportsPerBearer: number | null;
  supportSection: string | null;
  supportIdentityDefaulted: boolean;
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

export function classifyDeckGeometryReadiness(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): DeckGeometryReadiness {
  const facts = [...params.facts];
  const deckLengthM = getNumberFact(facts, params.workAreaId, "deck.length_m");
  const deckWidthM = getNumberFact(facts, params.workAreaId, "deck.width_m");
  const areaM2 = getNumberFact(facts, params.workAreaId, "deck.area_m2");
  if (
    deckLengthM != null &&
    deckWidthM != null &&
    deckLengthM > 0 &&
    deckWidthM > 0
  ) {
    return "DETAILED_GEOMETRY_AVAILABLE";
  }
  if (areaM2 != null && areaM2 > 0) return "AREA_ONLY";
  return "IRREGULAR_UNSUPPORTED";
}

export function deckSubstructureIncluded(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
}): boolean {
  return (
    getBooleanFact(
      [...params.facts],
      params.workAreaId,
      "deck.substructure_included"
    ) ?? true
  );
}

/** Boundary-inclusive count: ceil(span / spacing) + 1. Same convention as joists. */
export function deckLayoutCountFromSpan(spanM: number, spacingM: number): number {
  if (!(spanM > 0) || !(spacingM > 0)) return 0;
  return Math.ceil(spanM / spacingM) + 1;
}

/**
 * Planning joist axis = shorter rectangle side.
 * Geometric length/width storage is not structural orientation.
 * Near-square tie uses historical joists-along-width default.
 */
export function shorterPlanningAxis(
  deckLengthM: number,
  deckWidthM: number
): DeckAxis {
  if (Math.abs(deckLengthM - deckWidthM) <= SHORTER_AXIS_TIE_TOLERANCE_M) {
    return "width";
  }
  return deckLengthM <= deckWidthM ? "length" : "width";
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
  deckLengthM?: number | null;
  deckWidthM?: number | null;
}): DeckStructureOrientation {
  const explicitJoist = parseDeckAxis(params.joistDirectionFact);
  const explicitBoard = parseDeckAxis(params.boardDirectionFact);
  const hasGeometry =
    params.deckLengthM != null &&
    params.deckWidthM != null &&
    params.deckLengthM > 0 &&
    params.deckWidthM > 0;

  if (explicitJoist) {
    const boardDirection = explicitBoard ?? perpendicular(explicitJoist);
    return {
      boardDirection,
      joistDirection: explicitJoist,
      bearerDirection: perpendicular(explicitJoist),
      boardDirectionDefaulted: explicitBoard == null,
      joistDirectionDefaulted: false,
      joistOrientationSource: "explicit_joist",
    };
  }

  if (explicitBoard) {
    const joistDirection = perpendicular(explicitBoard);
    return {
      boardDirection: explicitBoard,
      joistDirection,
      bearerDirection: perpendicular(joistDirection),
      boardDirectionDefaulted: false,
      joistDirectionDefaulted: true,
      joistOrientationSource: "explicit_board",
    };
  }

  if (hasGeometry) {
    const joistDirection = shorterPlanningAxis(
      params.deckLengthM!,
      params.deckWidthM!
    );
    const boardDirection = perpendicular(joistDirection);
    return {
      boardDirection,
      joistDirection,
      bearerDirection: perpendicular(joistDirection),
      boardDirectionDefaulted: true,
      joistDirectionDefaulted: true,
      joistOrientationSource: "derived_shorter_span",
    };
  }

  return {
    boardDirection: "length",
    joistDirection: "width",
    bearerDirection: "length",
    boardDirectionDefaulted: true,
    joistDirectionDefaulted: true,
    joistOrientationSource: "historical_default",
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
    deckLengthM,
    deckWidthM,
  });

  const joistSectionFact = getStringFact(
    facts,
    params.workAreaId,
    "deck.joist_section"
  );
  const joistSectionDefaulted = joistSectionFact == null;
  const joistSection = joistSectionFact ?? DEFAULT_JOIST_SECTION;
  const framingTreatmentFact = getStringFact(
    facts,
    params.workAreaId,
    "deck.framing_treatment"
  );
  const framingTreatment =
    framingTreatmentFact ??
    (joistSectionDefaulted ? DEFAULT_FRAMING_TREATMENT : null);

  const bearerSectionFact = getStringFact(
    facts,
    params.workAreaId,
    "deck.bearer_section"
  );
  const bearerSectionDefaulted = bearerSectionFact == null;
  const bearerSection = bearerSectionFact ?? DEFAULT_BEARER_SECTION;

  const supportTypeFact = getStringFact(
    facts,
    params.workAreaId,
    "deck.support_type"
  );
  const supportSectionFact = getStringFact(
    facts,
    params.workAreaId,
    "deck.support_section"
  );
  const supportIdentityDefaulted =
    supportTypeFact == null && supportSectionFact == null;
  const supportSection = supportSectionFact ?? DEFAULT_SUPPORT_SECTION;
  const supportType =
    supportTypeFact ??
    (supportSection === DEFAULT_LIGHT_SUPPORT_SECTION ? "Post" : DEFAULT_SUPPORT_TYPE);


  const factKeys = [
    "deck.length_m",
    "deck.width_m",
    joistCentresDefaulted ? null : "deck.joist_centres_mm",
    orientation.boardDirectionDefaulted ? null : "deck.board_direction",
    orientation.joistDirectionDefaulted ? null : "deck.joist_direction",
    joistSectionDefaulted ? null : "deck.joist_section",
    framingTreatmentFact ? "deck.framing_treatment" : null,
    bearerSectionDefaulted ? null : "deck.bearer_section",
    getNumberFact(facts, params.workAreaId, "deck.bearer_row_count") != null
      ? "deck.bearer_row_count"
      : null,
    supportIdentityDefaulted ? null : "deck.support_type",
    getNumberFact(facts, params.workAreaId, "deck.supports_per_bearer") != null
      ? "deck.supports_per_bearer"
      : null,
    supportIdentityDefaulted ? null : "deck.support_section",
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
    deckHeightM: getNumberFact(facts, params.workAreaId, "deck.height_m"),
    joistCentresMm,
    joistCentresDefaulted,
    orientation,
    joistSection,
    joistSectionDefaulted,
    bearerSection,
    bearerSectionDefaulted,
    bearerRowCount: getNumberFact(
      facts,
      params.workAreaId,
      "deck.bearer_row_count"
    ),
    framingTreatment,
    supportType,
    supportsPerBearer: getNumberFact(
      facts,
      params.workAreaId,
      "deck.supports_per_bearer"
    ),
    supportSection,
    supportIdentityDefaulted,
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

  // Layout defaults are a package: only when neither bearer rows nor
  // supports-per-bearer were supplied. Partial spec still omits the missing child.
  const layoutEstimated =
    facts.bearerRowCount == null && facts.supportsPerBearer == null;
  const bearerRowCount = layoutEstimated
    ? deckLayoutCountFromSpan(joistRunLengthM, DEFAULT_BEARER_SPACING_M)
    : (facts.bearerRowCount ?? 0);
  const bearerBaseLm = round2(bearerRowCount * bearerRunLengthM);
  const bearerPurchaseLm = purchaseLm(bearerBaseLm, params.framingWastePercent);

  const supportsPerBearer = layoutEstimated
    ? deckLayoutCountFromSpan(bearerRunLengthM, DEFAULT_SUPPORT_SPACING_M)
    : (facts.supportsPerBearer ?? 0);
  const supportCount = Math.round(bearerRowCount * supportsPerBearer);

  let postEmbedmentM: number | null = null;
  let postLengthEachM: number | null = null;
  let postTotalLm: number | null = null;
  let postPurchaseLengthEachM: number | null = null;
  let postPurchaseLm: number | null = null;
  let postProcurementOk: boolean | null = null;
  if (facts.deckHeightM != null && facts.deckHeightM > 0 && supportCount > 0) {
    const posts = calculateDeckPostLength({
      deckHeightM: facts.deckHeightM,
      supportCount,
    });
    postEmbedmentM = posts.embedmentM;
    postLengthEachM = posts.lengthEachM;
    postTotalLm = posts.totalLm;
    const housePileProcurement =
      /pile/i.test(facts.supportType ?? "") ||
      facts.supportSection === DEFAULT_SUPPORT_SECTION;
    if (housePileProcurement) {
      const procurement = procureHousePiles({
        requiredLengthEachM: posts.embedmentM + (2 / 3) * facts.deckHeightM,
        supportCount,
      });
      postProcurementOk = procurement.ok;
      if (procurement.ok) {
        postPurchaseLengthEachM = procurement.purchaseLengthEachM;
        postPurchaseLm = procurement.purchaseLm;
      }
    }
  }

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
    bearerRowCountDefaulted: layoutEstimated,
    supportsPerBearerDefaulted: layoutEstimated,
    layoutEstimated,
    postEmbedmentM,
    postLengthEachM,
    postTotalLm,
    postPurchaseLengthEachM,
    postPurchaseLm,
    postProcurementOk,
    joistSectionDefaulted: facts.joistSectionDefaulted,
    bearerSectionDefaulted: facts.bearerSectionDefaulted,
    supportIdentityDefaulted: facts.supportIdentityDefaulted,
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
  treatmentRaw: string | null,
  sectionDefaulted = false
): MaterialIdentity | null {
  return resolveFramingIdentityFromFacts({
    section: sectionRaw,
    treatment: treatmentRaw,
    sectionDefaulted,
  });
}

function timberVariantKey(identity: MaterialIdentity): string {
  if (!identity.section) return "unspecified";
  return buildStructuralVariantKey(identity.section, identity.treatment);
}

function orientationAssumptions(
  orientation: DeckStructureOrientation,
  joistRunLengthM?: number
): RequirementAssumption[] {
  const assumptions: RequirementAssumption[] = [];
  if (
    orientation.joistDirectionDefaulted &&
    orientation.joistOrientationSource === "derived_shorter_span" &&
    joistRunLengthM != null
  ) {
    assumptions.push({
      key: "deck.joists.shorter_span_default",
      text: `Joists estimated across the shorter ${joistRunLengthM} m span.`,
      source: "calculator_default",
    });
  } else if (orientation.joistDirectionDefaulted) {
    assumptions.push({
      key: "deck.joist_direction_default",
      text: "Joists assumed perpendicular to decking boards.",
      source: "calculator_default",
    });
  }
  if (orientation.boardDirectionDefaulted) {
    assumptions.push({
      key: "deck.board_direction_default",
      text: "Deck boards assumed perpendicular to joists.",
      source: "calculator_default",
    });
  }
  assumptions.push({
    key: "deck.bearer_direction_derived",
    text: "Bearers derived perpendicular to joists.",
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

function layoutAssumptions(quantities: DeckStructureQuantities): RequirementAssumption[] {
  if (!quantities.layoutEstimated) return [];
  return [
    {
      key: "deck.layout.rectangular_estimated",
      text: "Standard rectangular layout assumed.",
      source: "calculator_default",
    },
    {
      key: "deck.bearers.spacing_default",
      text: `Bearer rows estimated at ${DEFAULT_BEARER_SPACING_M} m spacing (${quantities.bearerRowCount} runs).`,
      source: "calculator_default",
    },
    {
      key: "deck.supports.spacing_default",
      text: `Support layout estimated at ${DEFAULT_SUPPORT_SPACING_M} m along each bearer (${quantities.supportsPerBearer} per run).`,
      source: "calculator_default",
    },
    {
      key: "deck.supports.conservative_layout",
      text: CONSERVATIVE_SUPPORT_LAYOUT_HINT,
      source: "calculator_default",
    },
  ];
}

export function deckStructureAssumptionTexts(
  quantities: DeckStructureQuantities
): string[] {
  const texts: string[] = [];
  if (
    quantities.orientation.joistDirectionDefaulted &&
    quantities.orientation.joistOrientationSource === "derived_shorter_span"
  ) {
    texts.push(
      `Joists estimated across the shorter ${quantities.joistRunLengthM} m span.`
    );
  } else if (quantities.orientation.joistDirectionDefaulted) {
    texts.push("Joists assumed perpendicular to decking boards.");
  }
  if (quantities.orientation.boardDirectionDefaulted) {
    texts.push("Deck boards assumed perpendicular to joists.");
  }
  if (quantities.joistCentresDefaulted) {
    texts.push(
      `Joist centres assumed ${quantities.joistCentresMm} mm.`
    );
  }
  if (quantities.layoutEstimated) {
    texts.push("Standard rectangular layout assumed.");
    texts.push("Support layout estimated.");
    texts.push(CONSERVATIVE_SUPPORT_LAYOUT_HINT);
  }
  return texts;
}

function structuralConfidence(params: {
  joistCentresDefaulted: boolean;
  orientationDefaulted: boolean;
  hasIdentity: boolean;
}): RequirementConfidence {
  if (
    params.hasIdentity &&
    !params.joistCentresDefaulted &&
    !params.orientationDefaulted
  ) {
    return "high";
  }
  return "medium";
}

function joistPlanningSpecification(
  quantities: DeckStructureQuantities,
  section: string | null | undefined
): string {
  const span =
    quantities.orientation.joistDirectionDefaulted
      ? `estimated across ${quantities.joistRunLengthM} m span`
      : `${quantities.joistRunLengthM} m span`;
  const detail = `${quantities.joistCount} ea · ${span}`;
  return section ? `${detail} · ${section}` : detail;
}

function rimPlanningSpecification(
  quantities: DeckStructureQuantities,
  section: string | null | undefined
): string {
  return section
    ? `${quantities.rimBaseLm} lm net · ${section}`
    : `${quantities.rimBaseLm} lm net`;
}

function bearerPlanningSpecification(
  quantities: DeckStructureQuantities,
  section: string | null | undefined
): string {
  const detail = `${quantities.bearerRowCount} runs`;
  return section ? `${detail} · ${section}` : detail;
}

function sharedFramingAssumptions(params: {
  quantities: DeckStructureQuantities;
  framingWasteDefaulted: boolean;
}): RequirementAssumption[] {
  return [
    ...orientationAssumptions(
      params.quantities.orientation,
      params.quantities.joistRunLengthM
    ),
    ...framingAssumptions({
      joistCentresDefaulted: params.quantities.joistCentresDefaulted,
      joistCentresMm: params.quantities.joistCentresMm,
      framingWasteDefaulted: params.framingWasteDefaulted,
      framingWastePercent: params.quantities.framingWastePercent,
    }),
    ...layoutAssumptions(params.quantities),
    ...(params.quantities.joistSectionDefaulted ||
    params.quantities.bearerSectionDefaulted ||
    params.quantities.supportIdentityDefaulted
      ? [
          {
            key: "deck.framing.identity_default",
            text: DECK_IDENTITY_ESTIMATING_DISCLAIMER,
            source: "calculator_default" as const,
          },
        ]
      : []),
  ];
}

function unpricedPlanningFields() {
  return {
    priced: false as const,
    materialKey: null,
    rateSource: "missing" as const,
    unitCost: null,
    totalCost: null,
  };
}

function buildJoistRequirement(params: {
  workArea: EstimateWorkArea;
  facts: DeckStructureFacts;
  quantities: DeckStructureQuantities;
  framingWasteDefaulted: boolean;
  rates: readonly OrganisationRate[];
  organisationSettings?: OrganisationSettings | null;
}): MaterialRequirement | null {
  if (params.quantities.joistCount <= 0 || params.quantities.joistPurchaseLm <= 0) {
    return null;
  }
  const identity = framingTimberIdentity(
    params.facts.joistSection,
    params.facts.framingTreatment,
    params.facts.joistSectionDefaulted
  );
  const pricing = identity
    ? resolveIdentityRate({
        identity,
        unit: "lm",
        purchaseQuantity: params.quantities.joistPurchaseLm,
        rates: params.rates,
        organisationSettings: params.organisationSettings,
      })
    : unpricedPlanningFields();
  const section =
    identity?.originalDescription ?? identity?.section ?? params.facts.joistSection;
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_JOISTS_COMPONENT_KEY,
    variantKey: identity ? timberVariantKey(identity) : "layout-estimate",
    description: identity?.section
      ? `Deck joists ${identity.section}`
      : "Deck joists",
    confidence: structuralConfidence({
      joistCentresDefaulted: params.quantities.joistCentresDefaulted,
      orientationDefaulted:
        params.quantities.orientation.boardDirectionDefaulted ||
        params.quantities.orientation.joistDirectionDefaulted,
      hasIdentity: identity != null,
    }),
    assumptions: sharedFramingAssumptions({
      quantities: params.quantities,
      framingWasteDefaulted: params.framingWasteDefaulted,
    }),
    provenance: {
      calculatorSource: "deck.structure.joists",
      factKeys: params.facts.factKeys,
      constraintKeys: [],
    },
    priced: pricing.priced,
    materialKey: identity ? serializeMaterialIdentityKey(identity) : null,
    materialIdentity: identity ?? undefined,
    category: "FRAMING",
    specification: joistPlanningSpecification(params.quantities, section),
    baseQuantity: params.quantities.joistBaseLm,
    baseUnit: "lm",
    wasteFactor: params.quantities.framingWastePercent / 100,
    purchaseQuantity: params.quantities.joistPurchaseLm,
    purchaseUnit: "lm",
    rateSource: pricing.rateSource,
    rateEvidence: "rateEvidence" in pricing ? pricing.rateEvidence : undefined,
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
  if (params.quantities.rimPurchaseLm <= 0) return null;
  const identity = framingTimberIdentity(
    params.facts.joistSection,
    params.facts.framingTreatment,
    params.facts.joistSectionDefaulted
  );
  const pricing = identity
    ? resolveIdentityRate({
        identity,
        unit: "lm",
        purchaseQuantity: params.quantities.rimPurchaseLm,
        rates: params.rates,
        organisationSettings: params.organisationSettings,
      })
    : unpricedPlanningFields();
  const section =
    identity?.originalDescription ?? identity?.section ?? params.facts.joistSection;
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_RIM_FRAMING_COMPONENT_KEY,
    variantKey: identity ? timberVariantKey(identity) : "layout-estimate",
    description: identity?.section
      ? `Deck end rim framing ${identity.section}`
      : "Deck end rim framing",
    confidence: structuralConfidence({
      joistCentresDefaulted: params.quantities.joistCentresDefaulted,
      orientationDefaulted:
        params.quantities.orientation.boardDirectionDefaulted ||
        params.quantities.orientation.joistDirectionDefaulted,
      hasIdentity: identity != null,
    }),
    assumptions: [
      ...sharedFramingAssumptions({
        quantities: params.quantities,
        framingWasteDefaulted: params.framingWasteDefaulted,
      }),
      {
        key: "deck.rim.end_only",
        text: "Additional rim framing on joist ends only; outer parallel joists already counted in joist grid.",
        source: "calculator_default",
      },
    ],
    provenance: {
      calculatorSource: "deck.structure.rim",
      factKeys: params.facts.factKeys,
      constraintKeys: [],
    },
    priced: pricing.priced,
    materialKey: identity ? serializeMaterialIdentityKey(identity) : null,
    materialIdentity: identity ?? undefined,
    category: "FRAMING",
    specification: rimPlanningSpecification(params.quantities, section),
    baseQuantity: params.quantities.rimBaseLm,
    baseUnit: "lm",
    wasteFactor: params.quantities.framingWastePercent / 100,
    purchaseQuantity: params.quantities.rimPurchaseLm,
    purchaseUnit: "lm",
    rateSource: pricing.rateSource,
    rateEvidence: "rateEvidence" in pricing ? pricing.rateEvidence : undefined,
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
  if (params.quantities.bearerRowCount <= 0 || params.quantities.bearerPurchaseLm <= 0) {
    return null;
  }
  const identity = framingTimberIdentity(
    params.facts.bearerSection,
    params.facts.framingTreatment,
    params.facts.bearerSectionDefaulted
  );
  const pricing = identity
    ? resolveIdentityRate({
        identity,
        unit: "lm",
        purchaseQuantity: params.quantities.bearerPurchaseLm,
        rates: params.rates,
        organisationSettings: params.organisationSettings,
      })
    : unpricedPlanningFields();
  const section =
    identity?.originalDescription ??
    identity?.section ??
    params.facts.bearerSection;
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_BEARERS_COMPONENT_KEY,
    variantKey: identity ? timberVariantKey(identity) : "layout-estimate",
    description: identity?.section
      ? `Deck bearers ${identity.section}`
      : "Deck bearers",
    confidence: identity && !params.quantities.layoutEstimated ? "high" : "medium",
    assumptions: sharedFramingAssumptions({
      quantities: params.quantities,
      framingWasteDefaulted: params.framingWasteDefaulted,
    }),
    provenance: {
      calculatorSource: "deck.structure.bearers",
      factKeys: params.facts.factKeys,
      constraintKeys: [],
    },
    priced: pricing.priced,
    materialKey: identity ? serializeMaterialIdentityKey(identity) : null,
    materialIdentity: identity ?? undefined,
    category: "FRAMING",
    specification: bearerPlanningSpecification(params.quantities, section),
    baseQuantity: params.quantities.bearerBaseLm,
    baseUnit: "lm",
    wasteFactor: params.quantities.framingWastePercent / 100,
    purchaseQuantity: params.quantities.bearerPurchaseLm,
    purchaseUnit: "lm",
    rateSource: pricing.rateSource,
    rateEvidence: "rateEvidence" in pricing ? pricing.rateEvidence : undefined,
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
  if (params.quantities.supportCount <= 0) return null;
  const identity =
    params.facts.supportType && params.facts.supportSection
      ? buildSupportMaterialIdentity({
          supportType: params.facts.supportType,
          sectionRaw: params.facts.supportSection,
          treatmentRaw:
            params.facts.supportIdentityDefaulted ||
            params.facts.supportSection === "100x100" ||
            params.facts.supportSection === "125x125"
              ? DEFAULT_SUPPORT_TREATMENT
              : params.facts.framingTreatment,
        })
      : null;
  const procurementReady =
    params.quantities.postProcurementOk === true &&
    params.quantities.postPurchaseLm != null &&
    params.quantities.postPurchaseLm > 0;
  const lmPricing =
    identity && procurementReady
      ? resolveIdentityRate({
          identity,
          unit: "lm",
          purchaseQuantity: params.quantities.postPurchaseLm!,
          rates: params.rates,
          organisationSettings: params.organisationSettings,
        })
      : null;
  const eaPricing = identity
    ? resolveIdentityRate({
        identity,
        unit: "ea",
        purchaseQuantity: params.quantities.supportCount,
        rates: params.rates,
        organisationSettings: params.organisationSettings,
      })
    : unpricedPlanningFields();
  const canPriceLm = Boolean(lmPricing?.priced);
  const pricing = canPriceLm ? lmPricing! : identity ? eaPricing : unpricedPlanningFields();
  const section =
    identity?.originalDescription ?? params.facts.supportSection ?? null;
  const postSpec =
    params.quantities.postPurchaseLm != null &&
    params.quantities.postPurchaseLengthEachM != null
      ? `${params.quantities.supportCount} ea · ${params.quantities.postPurchaseLengthEachM} m purchase length each · ${params.quantities.postPurchaseLm} lm purchased`
      : params.quantities.postLengthEachM != null
        ? `${params.quantities.supportCount} ea · physical required ~${params.quantities.postLengthEachM} m each`
        : `${params.quantities.supportCount} ea`;
  return buildMaterialRequirement({
    workAreaId: params.workArea.id,
    workAreaType: params.workArea.type,
    componentKey: DECK_SUPPORTS_COMPONENT_KEY,
    variantKey: identity ? timberVariantKey(identity) : "layout-estimate",
    description:
      params.facts.supportType && params.facts.supportSection
        ? `${params.facts.supportType} ${params.facts.supportSection}`
        : "Deck supports / piles",
    confidence: identity && !params.quantities.layoutEstimated ? "high" : "medium",
    assumptions: [
      {
        key: "deck.supports.count_model",
        text: `Support count = bearer rows × supports per bearer (${params.quantities.bearerRowCount} × ${params.quantities.supportsPerBearer}).`,
        source: params.quantities.layoutEstimated
          ? "calculator_default"
          : "user_confirmed",
      },
      ...(params.quantities.postLengthEachM != null
        ? [
            {
              key: "deck.supports.length_heuristic",
              text: `Physical required pile length ≈ ${params.quantities.postLengthEachM} m each (embedment plus two-thirds of deck height). Estimating assumption only.`,
              source: "calculator_default" as const,
            },
          ]
        : []),
      ...(params.quantities.postPurchaseLengthEachM != null
        ? [
            {
              key: "deck.supports.procurement",
              text: `Purchased as ${params.quantities.postPurchaseLengthEachM} m stock length each (smallest supported length covering required length).`,
              source: "calculator_default" as const,
            },
          ]
        : []),
      ...(params.quantities.postProcurementOk === false
        ? [
            {
              key: "deck.supports.procurement_required",
              text: "Required pile length exceeds the largest supported stock length. Pricing required — length was not clamped.",
              source: "calculator_default" as const,
            },
          ]
        : []),
      ...layoutAssumptions(params.quantities),
    ],
    provenance: {
      calculatorSource: "deck.structure.supports",
      factKeys: params.facts.factKeys,
      constraintKeys: [],
    },
    priced: pricing.priced,
    materialKey: identity ? serializeMaterialIdentityKey(identity) : null,
    materialIdentity: identity ?? undefined,
    category: "FRAMING",
    specification: section ? `${postSpec} · ${section}` : postSpec,
    baseQuantity: canPriceLm
      ? params.quantities.postPurchaseLm!
      : params.quantities.supportCount,
    baseUnit: canPriceLm ? "lm" : "ea",
    wasteFactor: 0,
    purchaseQuantity: canPriceLm
      ? params.quantities.postPurchaseLm!
      : params.quantities.supportCount,
    purchaseUnit: canPriceLm ? "lm" : "ea",
    rateSource: pricing.rateSource,
    rateEvidence: "rateEvidence" in pricing ? pricing.rateEvidence : undefined,
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
  geometryReadiness: DeckGeometryReadiness;
} {
  const geometryReadiness = classifyDeckGeometryReadiness({
    facts: params.facts,
    workAreaId: params.workArea.id,
  });
  if (
    !deckSubstructureIncluded({
      facts: params.facts,
      workAreaId: params.workArea.id,
    })
  ) {
    return { requirements: [], quantities: null, geometryReadiness };
  }

  const structureFacts = readDeckStructureFacts({
    facts: params.facts,
    workAreaId: params.workArea.id,
  });
  if (!structureFacts) {
    return { requirements: [], quantities: null, geometryReadiness };
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

  return { requirements, quantities, geometryReadiness };
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
