import {
  getCombinedLabourAccessFactor,
  getConstraintNotes,
  getLabourAdjustmentParts,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
import {
  formatLabourAdjustmentDetail,
  formatLabourAdjustmentPrimary,
  formatLm,
  formatQuantity,
  formatRequiredPurchased,
} from "@/lib/estimate/builder-presentation-format";
import { NO_FINISH_QUALITY_FACTOR } from "@/lib/estimate/constants";
import { DECK_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getBooleanFact,
  getBooleanFactAny,
  getNumberFact,
  getStringFact,
  getStringFactAny,
  round2,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import {
  benchmarkRateFields,
  rateFieldsFromResolved,
} from "@/lib/estimate/line-item-helpers";
import {
  DECK_HOLE_ASSUMED_DEPTH_MM,
  DECK_HOLE_ASSUMED_DIAMETER_MM,
  planDeckHoleExcavation,
  planDeckPostConcrete,
  resolveDeckHoleCount,
} from "@/lib/estimate/deck-hole-excavation";
import { resolveProductivity, isTrustedProductivityHours } from "@/lib/estimate/productivity";
import {
  DECK_CONCRETE_PLACE_BENCHMARK_HOURS,
  DECK_CONCRETE_PLACE_CONFIRM_FACT,
  DECK_CONCRETE_PLACE_JOB_HOURS_FACT,
  DECK_POST_SET_DECISION,
  DECK_POST_SET_SCOPE,
  DECK_POSTS_INSTALL_CONFIRM_FACT,
  DECK_POSTS_INSTALL_JOB_HOURS_FACT,
  decideLegacyProductivityScope,
  productivitySourceNote,
  resolveDeckPostInstallation,
  scopeReviewNotes,
} from "@/lib/estimate/deck-productivity-scope";
import { resolveLabourRate, resolveRate, deriveSellFromCost } from "@/lib/estimate/rates";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import { calculateDeckingBoardLm } from "@/lib/estimate/material-buildups";
import {
  createDeckingBoardBuildUp,
  withMaterialBuildUp,
} from "@/lib/estimate/material-buildup-meta";
import { withMaterialRateResolution } from "@/lib/estimate/material-rate-pricing";
import { getCatalogueEntry } from "@/lib/rates/catalogue";
import { resolveDeckingBoardPricing } from "@/lib/estimate/deck-material-pricing";
import {
  DECK_LABOUR_COMPONENT_KEY,
  buildDeckLabourRequirement,
  labourConstraintKeysFrom,
} from "@/lib/estimate/deck-labour-requirement";
import {
  DECK_SURFACE_COMPONENT_KEY,
  maybeBuildDeckSurfaceRequirement,
} from "@/lib/estimate/deck-surface-requirement";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_SUPPORTS_COMPONENT_KEY,
  buildDeckStructuralMaterialRequirements,
  buildDeckSubstructureGroupReconciliation,
  deckStructureAssumptionTexts,
} from "@/lib/estimate/deck-structure";
import {
  DECK_FASCIA_BUILDER_LABEL,
  DECK_FASCIA_COMPONENT_KEY,
  DECK_FASCIA_INSTALL_COMPONENT_KEY,
  DECK_FASCIA_LABOUR_FALLBACK_COST_PER_LM,
  DECK_FASCIA_MATERIAL_ITEM_KEY,
  DECK_SKIRTING_BUILDER_LABEL,
  DECK_SKIRTING_COMPONENT_KEY,
  DECK_SKIRTING_INSTALL_COMPONENT_KEY,
  DECK_SKIRTING_INSTALL_LABEL,
  DECK_SKIRTING_MATERIAL_ITEM_KEY,
  calculateDeckFasciaQuantities,
  calculateDeckSkirtingQuantities,
  deckSkirtingIncluded,
  resolveDeckFasciaEdgeLength,
} from "@/lib/estimate/deck-fascia";
import {
  DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY,
  DECK_SUBSTRUCTURE_STARTER_CONFIDENCE,
  requiredInstalledFramingLm,
  concreteCompanyComparison,
  resolveDeckConcretePlaceProductivity,
  resolveDeckDeckingInstallProductivity,
  resolveDeckSkirtingInstallProductivity,
  resolveDeckSubstructureInstallProductivity,
} from "@/lib/estimate/deck-productivity";
import {
  calculateDeckStepsQuantities,
  DEFAULT_STEP_WIDTH_M,
  formatStepGeometryTakeoff,
  STEP_ARRANGEMENT_FROM_HEIGHT_STATEMENT,
  STEP_WIDTH_ASSUMPTION_STATEMENT,
  stepPhysicalGeometryReady,
} from "@/lib/estimate/deck-steps-physical";
import { defaultStepFramingIdentity } from "@/lib/estimate/deck-default-identities";
import {
  DECK_CONCRETE_BAGS_COMPONENT_KEY,
  DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY,
  DECK_CONCRETE_MATERIAL_ITEM_KEY,
  DECK_CONCRETE_MATERIAL_LABEL,
  DECK_CONCRETE_PLACE_COMPONENT_KEY,
  DECK_CONCRETE_PRODUCTIVITY_KEY,
  DECK_CONCRETE_PLACE_LABEL,
  DECK_CONCRETE_TO_SUPPORTS_FACT_KEY,
  DECK_STEPS_FRAMING_COMPONENT_KEY,
  DECK_STEPS_INCLUDED_FACT_KEY,
  DECK_STEPS_INSTALL_COMPONENT_KEY,
  DECK_STEPS_TREADS_COMPONENT_KEY,
  DECKING_LINE_LABEL,
  DECKING_PACKAGE_LINE_LABEL,
  concreteToSupportsIncluded,
  deckStepsCommerciallyIncluded,
  deckSupportsActive,
  formatDeckIdentityLine,
  formatMaterialIdentityDisplay,
  formatPilePurchaseIdentity,
  pileReplacementApplicable,
  pileRetentionPending,
} from "@/lib/estimate/deck-scope-2c";
import {
  DECK_FIXINGS_RESIDUAL_ITEM_KEY,
  DECK_FIXINGS_RESIDUAL_LABEL,
  decideDeckLabourSplit,
  decideDeckSubstructureAuthority,
  deckDetailedPhysicalModelAvailable,
} from "@/lib/estimate/deck-commercial-2b";
import {
  adaptPricedMaterialRequirementWithoutLegacy,
  adaptUnpricedMaterialRequirementToEstimateLine,
} from "@/lib/estimate/requirement-commercial-line";
import { resolveComponentCommercialAuthority } from "@/lib/estimate/component-commercial-authority";
import { shapeLabourHours } from "@/lib/estimate/labour-hours";
import { getDeckMaterialLabel } from "@/lib/estimate/material-rate-keys";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { buildConcreteMaterialIdentity } from "@/lib/materials/identity";
import { resolveStructuralMaterialRequirementRate } from "@/lib/estimate/resolve-structural-material-rate";
import {
  quantityBasisFrom,
  withCommercialMetadata,
} from "@/lib/estimate/commercial-realism";
import { resolveMaterialWastage } from "@/lib/settings/material-wastage";
import { baseConfidence } from "@/lib/estimate/summary";
import {
  createAssumptionMetadata,
  recordDefaultedNumber,
} from "@/lib/estimate/assumption-metadata";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import {
  detailedMoneyAllowed,
  PHYSICAL_REQUIREMENT_RESOLUTION,
} from "@/lib/estimate/physical-requirement-resolution";
import {
  DECK_BOARD_WIDTH_ASSUMPTION_STATEMENT,
  resolveDeckBoardWidthMm,
} from "@/lib/estimate/deck-board-width";
import { resolveLegacyWorkAreaAccess } from "@/lib/project-conditions/legacy-adapter";
import type { OrganisationSettings } from "@/components/setup/types";

function quotrFallbackSellFromCost(
  cost: number,
  organisationSettings: OrganisationSettings | null
): number {
  return deriveSellFromCost(
    cost,
    organisationSettings?.default_margin_percent ?? DEFAULT_MARGIN_PERCENT
  );
}

/** Facts this calculator reads for scope, quantity, material, labour, allowance, or takeoff. */
export const DECK_CALCULATOR_CONSUMED_FACTS = [
  "deck.area_m2",
  "deck.length_m",
  "deck.width_m",
  "deck.height_m",
  "deck.level",
  "deck.board_material",
  "deck.material",
  "deck.board_width_mm",
  "deck.board_direction",
  "deck.substructure_included",
  "deck.existing_deck_removal",
  "deck.demolition_required",
  "deck.access_type",
  "deck.has_stairs",
  DECK_STEPS_INCLUDED_FACT_KEY,
  "deck.balustrade_required",
  "deck.has_balustrade",
  "deck.handrail_required",
  "deck.engineering_or_consent_status",
  "deck.pile_or_post_replacement_required",
  "deck.pile_or_post_count",
  "deck.substructure_condition",
  "deck.vertical_face_boards_required",
  "deck.vertical_face_board_length_lm",
  "deck.skirting_included",
  "deck.fascia_courses",
  "deck.ground_clearance_m",
  "deck.fascia_material",
  "deck.step_count",
  "deck.step_width_m",
  "deck.step_going_m",
  DECK_CONCRETE_TO_SUPPORTS_FACT_KEY,
  DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY,
  "deck.joist_section",
  "deck.joist_centres_mm",
  "deck.joist_direction",
  "deck.framing_treatment",
  "deck.bearer_section",
  "deck.bearer_row_count",
  "deck.support_type",
  "deck.supports_per_bearer",
  "deck.support_section",
  "deck.footing_length_mm",
  "deck.footing_width_mm",
  "deck.footing_depth_mm",
  "deck.hole_diameter_mm",
  "deck.hole_depth_mm",
  "deck.hole_length_mm",
  "deck.hole_width_mm",
  "deck.hole_shape",
  "deck.hole_ground",
  "deck.hole_method",
  "deck.hole_count",
  "deck.hole_count_reason",
  "deck.hole_job_hours_per_hole",
  "deck.hole_hours_status",
  "deck.spoil_leaves_site",
  "deck.spoil_destination",
  "deck.spoil_haulage_choice",
  "deck.spoil_haulage_job_cost",
  "deck.spoil_tip_choice",
  "deck.spoil_tip_job_cost",
  "deck.spoil_load_fit",
  "deck.posts_install_hours_per_ea",
  "deck.posts_install_scope_confirmation",
  "deck.concrete_place_hours_per_bag",
  "deck.concrete_place_scope_confirmation",
  "deck.concrete_fill",
  "deck.concrete_fill_depth_mm",
  "deck.post_embedment_mm",
  "deck.concrete_bag_yield_m3",
] as const;

function labourExpandedNotes(params: {
  physicalDriver: string;
  extra?: string;
  adjustmentDetail: string;
  productivity: string;
}): string {
  const adj =
    params.adjustmentDetail.trim() || "No Project Condition adjustment.";
  return [params.physicalDriver, params.extra, adj, params.productivity]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");
}

export function calculateDeck(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions: string[] = [];
  const assumptionMetadata = createAssumptionMetadata();
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const areaFact = getNumberFact(facts, workArea.id, "deck.area_m2");
  let area = areaFact;
  const length = getNumberFact(facts, workArea.id, "deck.length_m");
  const width = getNumberFact(facts, workArea.id, "deck.width_m");

  if (!area && length && width) {
    area = round2(length * width);
    assumptions.push("Deck area calculated from length × width.");
  }

  if (!area) missingInfo.push(formatMissing("Deck area or dimensions"));

  const material = getStringFactAny(facts, workArea.id, [
    "deck.board_material",
    "deck.material",
  ]);
  if (!material) missingInfo.push(formatMissing("Decking material"));

  const deckHeight = getNumberFact(facts, workArea.id, "deck.height_m");
  const level =
    getStringFact(facts, workArea.id, "deck.level") ??
    (deckHeight !== null
      ? deckHeight > 0.3
        ? "Elevated"
        : "Ground-level"
      : null);
  if (!level && deckHeight === null) {
    missingInfo.push(formatMissing("Deck height or level"));
  }

  let effectiveArea = area;
  if (!effectiveArea) {
    effectiveArea = recordDefaultedNumber(assumptionMetadata, {
      key: "deck.area_m2",
      label: "Deck area",
      workAreaId: workArea.id,
      assumedValue: 20,
      unit: "m²",
      reason: "No area or length/width provided",
    });
    assumptions.push("Using assumed deck area of 20 m² for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourAdjustment = getCombinedLabourAccessFactor({
    constraints: context.constraints,
    workAreaAccess: resolveLegacyWorkAreaAccess({
      constraints: context.constraints,
      facts,
      workAreaId: workArea.id,
      workAreaType: "deck",
    }),
  });
  const labourAdjustmentParts = getLabourAdjustmentParts(context.constraints);
  const labourAdjustmentSummary = formatLabourAdjustmentPrimary(
    labourAdjustment,
    labourAdjustmentParts
  );
  const labourAdjustmentDetail = formatLabourAdjustmentDetail(
    labourAdjustmentParts
  );
  const constraintNotes = getConstraintNotes(context.constraints);
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const baseProductivity = resolveProductivity({
    productivityKey: "deck.base_labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 1.2,
    rates: context.rates,
  });

  let hoursPerM2 = baseProductivity.hoursPerUnit;
  const elevated =
    level?.toLowerCase().includes("elevated") ||
    (deckHeight !== null && deckHeight > 0.3);
  if (elevated) {
    const elevatedProductivity = resolveProductivity({
      productivityKey: "deck.elevated_extra_hours_per_m2",
      unit: "m²",
      fallbackHoursPerUnit: 0.25,
      rates: context.rates,
    });
    hoursPerM2 += elevatedProductivity.hoursPerUnit;
    assumptions.push("Elevated deck adds extra labour productivity allowance.");
  }

  if (deckHeight !== null && deckHeight > 1) {
    assumptions.push(
      "Deck height above 1 m may require stairs, balustrade or consent confirmation."
    );
  }

  const assumedArea = area == null;

  const materialLabel = getDeckMaterialLabel(material);
  const boardWidthResolved = resolveDeckBoardWidthMm({
    facts,
    workAreaId: workArea.id,
  });
  const boardWidthFact = boardWidthResolved.mm;
  const boardWidthAssumed =
    boardWidthResolved.resolution === PHYSICAL_REQUIREMENT_RESOLUTION.ASSUMED;
  if (boardWidthAssumed) {
    recordDefaultedNumber(assumptionMetadata, {
      key: "deck.board_width_mm",
      label: "Decking board width",
      workAreaId: workArea.id,
      assumedValue: boardWidthFact,
      unit: " mm",
      reason: "Board width not confirmed",
      severity: "warning",
    });
    assumptions.push(DECK_BOARD_WIDTH_ASSUMPTION_STATEMENT);
  }

  const wastagePercent = resolveMaterialWastage(
    context.materialWastageSettings,
    "decking"
  );

  const deckingBoardResult =
    area != null && boardWidthFact != null
      ? calculateDeckingBoardLm({
          areaM2: area,
          boardWidthMm: boardWidthFact,
          wastagePercent,
        })
      : null;

  const deckingPricing = resolveDeckingBoardPricing({
    context,
    material,
    label: materialLabel,
    purchaseLm: deckingBoardResult?.totalLm ?? null,
    boardWidthMm: boardWidthFact,
    areaM2: effectiveArea,
  });

  const usedLmPricing = deckingPricing.usedBuildUpQuantity === true;
  const deckingBuildUp =
    area != null && boardWidthFact != null && deckingBoardResult
      ? createDeckingBoardBuildUp({
          result: deckingBoardResult,
          areaM2: area,
          boardWidthMm: boardWidthFact,
          wastagePercent,
          materialLabel,
          priced: usedLmPricing,
        })
      : null;

  const pricedQuantity = deckingPricing.quantity;
  const pricedUnit = deckingPricing.unit === "m2" ? "m²" : deckingPricing.unit;
  const deckingLabel = usedLmPricing
    ? DECKING_LINE_LABEL
    : DECKING_PACKAGE_LINE_LABEL;
  const conversionNote = deckingPricing.resolution.conversionNote;
  const deckingIdentity = formatDeckIdentityLine([
    materialLabel,
    boardWidthFact != null ? `${boardWidthFact} mm` : null,
    deckingBoardResult
      ? formatRequiredPurchased({
          required: deckingBoardResult.baseLm,
          purchased: deckingBoardResult.totalLm,
          unit: "lm",
          wastePercent: wastagePercent,
        })
      : null,
  ]);
  const deckingNotes = usedLmPricing
    ? `${deckingIdentity}${conversionNote ? ` · ${conversionNote}` : ""}`
    : deckingBoardResult
      ? `Package allowance (${materialLabel}). Physical takeoff ${formatLm(deckingBoardResult.totalLm)} lm is not the priced quantity.`
      : `Package allowance (${materialLabel}) · board width not confirmed for lm pricing`;

  let deckingItem = withMaterialBuildUp(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: deckingLabel,
      category: "materials",
      quantity: pricedQuantity,
      unit: pricedUnit,
      notes: deckingNotes,
      sortOrder: sortOrder++,
      componentKey: DECK_SURFACE_COMPONENT_KEY,
      organisationSettings: context.organisationSettings,
      ...deckingPricing.rateFields,
    }),
    deckingBuildUp
  );
  deckingItem = { ...deckingItem, identitySummary: deckingIdentity };

  if (usedLmPricing && deckingBoardResult && area != null && boardWidthFact != null) {
    deckingItem = withCommercialMetadata(deckingItem, {
      quantityBasis: quantityBasisFrom({
        sourceFact: "deck.board_width_mm",
        sourceLabel: "Board width and deck area",
        quantity: deckingBoardResult.totalLm,
        unit: "lm",
        formula: `${area} m² / ${boardWidthFact / 1000} m × (1 + ${wastagePercent}% waste)`,
        confidence: boardWidthAssumed ? "assumed" : "derived",
      }),
    });
  }

  lineItems.push(
    withMaterialRateResolution(deckingItem, deckingPricing.resolution)
  );

  const substructureIncluded =
    getBooleanFact(facts, workArea.id, "deck.substructure_included") ?? true;

  const structural = buildDeckStructuralMaterialRequirements({
    workArea,
    facts,
    rates: context.rates,
    materialWastageSettings: context.materialWastageSettings,
    organisationSettings: context.organisationSettings,
  });
  if (structural.quantities) {
    assumptions.push(...deckStructureAssumptionTexts(structural.quantities));
  }

  const joistReq = structural.requirements.find(
    (item) => item.componentKey === DECK_JOISTS_COMPONENT_KEY
  );
  const bearerReq = structural.requirements.find(
    (item) => item.componentKey === DECK_BEARERS_COMPONENT_KEY
  );
  const rimReq = structural.requirements.find(
    (item) => item.componentKey === DECK_RIM_FRAMING_COMPONENT_KEY
  );
  const supportReq = structural.requirements.find(
    (item) => item.componentKey === DECK_SUPPORTS_COMPONENT_KEY
  );
  const detailedPhysicalModelAvailable = deckDetailedPhysicalModelAvailable({
    geometryReadiness: structural.geometryReadiness,
    joistQuantity: joistReq?.purchaseQuantity ?? 0,
    bearerQuantity: bearerReq?.purchaseQuantity ?? 0,
    rimQuantity: rimReq?.purchaseQuantity ?? 0,
    supportQuantity: supportReq?.purchaseQuantity ?? 0,
    supportPurchaseUnit: supportReq?.purchaseUnit ?? null,
    postProcurementOk: structural.quantities?.postProcurementOk ?? null,
  });
  const substructureAuthority = decideDeckSubstructureAuthority({
    substructureIncluded,
    detailedPhysicalModelAvailable,
  });

  const deckingInstallProductivity = resolveDeckDeckingInstallProductivity(
    context.rates,
    boardWidthFact
  );
  const substructureInstallProductivity =
    resolveDeckSubstructureInstallProductivity(context.rates);
  const postsScope = resolveDeckPostInstallation({
    rates: context.rates,
    confirmation: getStringFact(facts, workArea.id, DECK_POSTS_INSTALL_CONFIRM_FACT),
    jobHours: getNumberFact(facts, workArea.id, DECK_POSTS_INSTALL_JOB_HOURS_FACT),
  });
  const postsInstallProductivity = {
    hoursPerUnit:
      postsScope.action === "apply" || postsScope.action === "review"
        ? postsScope.hoursPerUnit
        : 0,
  };
  const supportCount = structural.quantities?.supportCount ?? 0;
  const requiredDeckingLm = deckingBoardResult?.baseLm ?? 0;
  const requiredFramingLm = structural.quantities
    ? requiredInstalledFramingLm({
        joistRequiredLm: structural.quantities.joistBaseLm,
        bearerRequiredLm: structural.quantities.bearerBaseLm,
        rimRequiredLm: structural.quantities.rimBaseLm,
      })
    : 0;
  const labourAuthority = decideDeckLabourSplit({
    hasTrustedDeckingProductivity: isTrustedProductivityHours(
      deckingInstallProductivity.hoursPerUnit
    ),
    hasTrustedSubstructureProductivity: isTrustedProductivityHours(
      substructureInstallProductivity.hoursPerUnit
    ),
    hasTrustedPostProductivity:
      isTrustedProductivityHours(postsInstallProductivity.hoursPerUnit) &&
      (!substructureIncluded || supportCount > 0),
    substructureIncluded,
  });
  assumptions.push(
    `Deck commercial authority: structural ${substructureAuthority.mode} (${substructureAuthority.reason}) Labour ${labourAuthority.mode} (${labourAuthority.reason})`
  );

  const labourRateFields = rateFieldsFromResolved(labourRate);
  let deckLabourHours = shapeLabourHours({
    quantity: effectiveArea,
    productivityHoursPerUnit: hoursPerM2,
    adjustmentFactor: labourAdjustment,
  });

  if (labourAuthority.mode === "DETAILED_AUTHORITATIVE") {
    const deckingHours = shapeLabourHours({
      quantity: requiredDeckingLm,
      productivityHoursPerUnit: deckingInstallProductivity.hoursPerUnit,
      adjustmentFactor: labourAdjustment,
    });
    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Decking installation",
        quantity: requiredDeckingLm,
        unit: "lm",
        productivityHoursPerUnit: deckingInstallProductivity.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        adjustmentLabel: labourAdjustmentSummary,
          notes: labourExpandedNotes({
            physicalDriver: `Physical driver: required installed decking lm (${formatLm(requiredDeckingLm)} lm). Waste is procurement, not labour.`,
            adjustmentDetail: labourAdjustmentDetail,
            productivity: `Productivity: ${deckingInstallProductivity.hoursPerUnit} h/lm · ${deckingInstallProductivity.sourceLabel}${constraintNotes ? ` · ${constraintNotes}` : ""}`,
          }),
        sortOrder: sortOrder++,
        componentKey: "deck.decking.install",
        organisationSettings: context.organisationSettings,
        ...labourRateFields,
      })
    );
    let framingHours = shapeLabourHours({
      quantity: 0,
      productivityHoursPerUnit: 0,
    });
    let postHours = shapeLabourHours({
      quantity: 0,
      productivityHoursPerUnit: 0,
    });
    if (substructureIncluded) {
      framingHours = shapeLabourHours({
        quantity: requiredFramingLm,
        productivityHoursPerUnit: substructureInstallProductivity.hoursPerUnit,
        adjustmentFactor: labourAdjustment,
      });
      const framingTakeoff = structural.quantities
        ? `Joists ${formatLm(structural.quantities.joistBaseLm)} lm · Bearers ${formatLm(structural.quantities.bearerBaseLm)} lm · Rim ${formatLm(structural.quantities.rimBaseLm)} lm`
        : null;
      lineItems.push(
        createLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Substructure framing",
          quantity: requiredFramingLm,
          unit: "lm",
          productivityHoursPerUnit: substructureInstallProductivity.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          adjustmentFactor: labourAdjustment,
          adjustmentLabel: labourAdjustmentSummary,
          notes: labourExpandedNotes({
            physicalDriver: `Physical driver: required installed framing lm (${DECK_SUBSTRUCTURE_STARTER_CONFIDENCE} starter). ${framingTakeoff ?? ""}. Excludes pile/post install. Waste is not labour.`,
            adjustmentDetail: labourAdjustmentDetail,
            productivity: `Productivity: ${substructureInstallProductivity.hoursPerUnit} h/lm · ${substructureInstallProductivity.sourceLabel}`,
          }),
          sortOrder: sortOrder++,
          componentKey: "deck.substructure.install",
          organisationSettings: context.organisationSettings,
          ...labourRateFields,
        })
      );
      if (postsScope.action === "apply" && supportCount > 0) {
        postHours = shapeLabourHours({
          quantity: supportCount,
          productivityHoursPerUnit: postsScope.hoursPerUnit,
          adjustmentFactor: labourAdjustment,
        });
        const postScopeNote =
          postsScope.sourceLabel === "Quotr provisional benchmark"
            ? `${DECK_POST_SET_SCOPE} ${DECK_POST_SET_DECISION}`
            : "Installation only. Hole excavation and concrete placement are separate lines, and this time is not inside substructure framing.";
        assumptions.push(
          "Post setting is installation only and is not included in substructure framing."
        );
        lineItems.push(
          createLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Pile/post installation",
            quantity: supportCount,
            unit: "post",
            productivityHoursPerUnit: postsScope.hoursPerUnit,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            adjustmentFactor: labourAdjustment,
            adjustmentLabel: labourAdjustmentSummary,
            notes: labourExpandedNotes({
              physicalDriver: `Physical driver: ${supportCount} posts. ${postScopeNote}`,
              adjustmentDetail: labourAdjustmentDetail,
              productivity: `Productivity: ${postsScope.hoursPerUnit} h/post · ${postsScope.sourceLabel}. ${productivitySourceNote(postsScope.sourceType, postsScope.sourceLabel)}`,
            }),
            sortOrder: sortOrder++,
            componentKey: "deck.posts.install",
            organisationSettings: context.organisationSettings,
            ...labourRateFields,
            itemKey: postsScope.itemKey,
            productivitySourceType: postsScope.sourceType,
          })
        );
      } else if (postsScope.action === "review" && supportCount > 0) {
        const beforeAccess = round2(supportCount * postsScope.hoursPerUnit);
        const heldHours = shapeLabourHours({
          quantity: supportCount,
          productivityHoursPerUnit: postsScope.hoursPerUnit,
          adjustmentFactor: labourAdjustment,
        }).adjustedHours;
        missingInfo.push("Pile/post installation scope");
        lineItems.push({
          ...createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Pile/post installation",
            category: "labour",
            quantity: supportCount,
            unit: "ea",
            costRate: 0,
            sellRate: 0,
            rateSource: getRateSourceLabel("missing"),
            rateSourceType: "missing",
            itemKey: "deck.posts.install.hours_per_ea",
            componentKey: "deck.posts.install",
            notes: scopeReviewNotes({
              summary: `Stored calibrated rate ${postsScope.hoursPerUnit} h/post · Your calibrated productivity. The saved task does not record that excavation was excluded, so this rate is not priced beside the separate hole excavation. ${supportCount} posts × ${postsScope.hoursPerUnit} h/post = ${beforeAccess} h before access if you confirm it is installation only. Hole excavation stays its own line.`,
              factKey: postsScope.factKey,
              token: postsScope.token,
              jobFactKey: postsScope.jobFactKey,
            }),
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          includedInTotal: false,
          labourHours: heldHours,
          productivityRate: postsScope.hoursPerUnit,
        });
      } else if (supportCount > 0) {
        missingInfo.push("Pile/post installation hours");
        lineItems.push({
          ...createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Pile/post installation",
            category: "labour",
            quantity: supportCount,
            unit: "ea",
            costRate: 0,
            sellRate: 0,
            rateSource: getRateSourceLabel("missing"),
            rateSourceType: "missing",
            itemKey: "deck.posts.install.hours_per_ea",
            componentKey: "deck.posts.install",
            notes:
              "The imported 1 person-hour per post includes excavation in the source task. Hole excavation labour is separate, and there is no approved installation-only hour. A company or calibrated hours-per-post still prices this line. Otherwise it stays Pricing Required. Concrete placement is separate.",
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          includedInTotal: false,
        });
      }
      const holePlan = planDeckHoleExcavation({
        facts,
        workAreaId: workArea.id,
        holeCount: supportCount,
        rates: context.rates,
        constraints: context.constraints,
      });
      assumptions.push(...holePlan.assumptions);
      missingInfo.push(...holePlan.missingInfo);
      if (holePlan.geometry?.diameterAssumed) {
        recordDefaultedNumber(assumptionMetadata, {
          key: "deck.hole_diameter_mm",
          label: "Hole diameter",
          workAreaId: workArea.id,
          assumedValue: holePlan.geometry.diameterMm ?? DECK_HOLE_ASSUMED_DIAMETER_MM,
          unit: " mm",
          reason: "Circular hole diameter was not measured",
          severity: "warning",
        });
      }
      if (holePlan.geometry?.depthAssumed) {
        recordDefaultedNumber(assumptionMetadata, {
          key: "deck.hole_depth_mm",
          label: "Hole depth",
          workAreaId: workArea.id,
          assumedValue: holePlan.geometry.depthMm ?? DECK_HOLE_ASSUMED_DEPTH_MM,
          unit: " mm",
          reason: "Hole depth was not measured",
          severity: "warning",
        });
      }
      let excavationHours = shapeLabourHours({
        quantity: 0,
        productivityHoursPerUnit: 0,
      });
      if (holePlan.productivity?.applies && holePlan.holeCount > 0) {
        excavationHours = shapeLabourHours({
          quantity: holePlan.holeCount,
          productivityHoursPerUnit: holePlan.productivity.hoursPerHole,
          adjustmentFactor: labourAdjustment,
        });
        const geometryNote = holePlan.geometry
          ? `${holePlan.geometry.formula} = ${holePlan.geometry.bankVolumeM3} m³ bank.`
          : "";
        lineItems.push({
          ...createLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Hole excavation",
            quantity: holePlan.holeCount,
            unit: "hole",
            productivityHoursPerUnit: holePlan.productivity.hoursPerHole,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            adjustmentFactor: labourAdjustment,
            adjustmentLabel: labourAdjustmentSummary,
            notes: labourExpandedNotes({
              physicalDriver: `Physical driver: ${holePlan.holeCount} holes. ${geometryNote} ${holePlan.productivity.reason}`,
              adjustmentDetail: labourAdjustmentDetail,
              productivity: `Productivity: ${holePlan.productivity.hoursPerHole} h/hole · ${holePlan.productivity.sourceLabel}. ${productivitySourceNote(holePlan.productivity.sourceType, holePlan.productivity.sourceLabel)}`,
            }),
            sortOrder: sortOrder++,
            componentKey: "deck.hole.excavate",
            organisationSettings: context.organisationSettings,
            ...labourRateFields,
            productivitySourceType: holePlan.productivity.sourceType,
          }),
          holeDraft: holePlan.draftStamp ?? undefined,
        });
      } else if (holePlan.holeCount > 0) {
        lineItems.push({
          ...createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Hole excavation",
            category: "labour",
            quantity: holePlan.holeCount,
            unit: "hole",
            costRate: 0,
            sellRate: 0,
            rateSource: getRateSourceLabel("missing"),
            rateSourceType: "missing",
            itemKey: "deck.hole.excavate.hours_per_hole",
            componentKey: "deck.hole.excavate",
            notes: holePlan.productivity?.reason ?? "Hole excavation productivity required.",
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          includedInTotal: false,
          holeDraft: holePlan.draftStamp ?? undefined,
        });
      }
      for (const spoil of holePlan.spoilLines) {
        if (spoil.kind === "priced" && spoil.unitCost != null) {
          const unitSell =
            spoil.unitSell ??
            quotrFallbackSellFromCost(spoil.unitCost, context.organisationSettings);
          lineItems.push(
            createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: spoil.label,
              category: "materials",
              quantity: spoil.chargeQuantity,
              unit: spoil.chargeUnit,
              costRate: spoil.unitCost,
              sellRate: unitSell,
              rateSource: spoil.rateSourceLabel ?? getRateSourceLabel(spoil.rateSourceType),
              rateSourceType: spoil.rateSourceType,
              itemKey: spoil.itemKey,
              componentKey: spoil.componentKey,
              notes: spoil.notes,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
            })
          );
        } else {
          lineItems.push({
            ...createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: spoil.label,
              category: "materials",
              quantity: spoil.chargeQuantity,
              unit: spoil.chargeUnit,
              costRate: 0,
              sellRate: 0,
              rateSource: getRateSourceLabel("missing"),
              rateSourceType: "missing",
              itemKey: spoil.itemKey,
              componentKey: spoil.componentKey,
              notes: spoil.notes,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
            }),
            includedInTotal: false,
          });
        }
      }
      postHours = {
        ...postHours,
        baseHours: round2(postHours.baseHours + excavationHours.baseHours),
        adjustedHours: round2(postHours.adjustedHours + excavationHours.adjustedHours),
      };
    }
    let elevatedHours = shapeLabourHours({
      quantity: 0,
      productivityHoursPerUnit: 0,
    });
    if (elevated) {
      const elevatedProductivity = resolveProductivity({
        productivityKey: "deck.elevated_extra_hours_per_m2",
        unit: "m²",
        fallbackHoursPerUnit: 0.25,
        rates: context.rates,
      });
      elevatedHours = shapeLabourHours({
        quantity: effectiveArea,
        productivityHoursPerUnit: elevatedProductivity.hoursPerUnit,
        adjustmentFactor: labourAdjustment,
      });
      lineItems.push(
        createLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Elevated extra labour",
          quantity: effectiveArea,
          unit: "m²",
          productivityHoursPerUnit: elevatedProductivity.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          adjustmentFactor: labourAdjustment,
          adjustmentLabel: labourAdjustmentSummary,
          notes: labourExpandedNotes({
            physicalDriver: "Workface/elevation complexity allowance on deck area.",
            adjustmentDetail: labourAdjustmentDetail,
            productivity: `Productivity: ${elevatedProductivity.hoursPerUnit} h/m² · ${elevatedProductivity.sourceLabel}`,
          }),
          sortOrder: sortOrder++,
          componentKey: "deck.elevated_extra",
          organisationSettings: context.organisationSettings,
          ...labourRateFields,
        })
      );
    }
    const totalAdjusted =
      deckingHours.adjustedHours +
      framingHours.adjustedHours +
      postHours.adjustedHours +
      elevatedHours.adjustedHours;
    const totalBase =
      deckingHours.baseHours +
      framingHours.baseHours +
      postHours.baseHours +
      elevatedHours.baseHours;
    deckLabourHours = {
      quantity: effectiveArea,
      productivityHoursPerUnit:
        effectiveArea > 0 ? round2(totalBase / effectiveArea) : 0,
      adjustmentFactor: labourAdjustment,
      qualityFactor: 1,
      baseHours: round2(totalBase),
      adjustedHours: round2(totalAdjusted),
    };
  } else {
    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Deck labour",
        quantity: effectiveArea,
        unit: "m²",
        productivityHoursPerUnit: hoursPerM2,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        adjustmentLabel: labourAdjustmentSummary,
        notes: constraintNotes || undefined,
        sortOrder: sortOrder++,
        componentKey: DECK_LABOUR_COMPONENT_KEY,
        organisationSettings: context.organisationSettings,
        ...labourRateFields,
      })
    );
  }

  if (substructureIncluded) {
    if (substructureAuthority.mode === "DETAILED_AUTHORITATIVE") {
      const structuralLines: { req: typeof joistReq; label: string }[] = [
        { req: joistReq, label: "Joists" },
        { req: bearerReq, label: "Bearers" },
        { req: rimReq, label: "Rim framing" },
        { req: supportReq, label: "Piles / posts" },
      ];
      for (const row of structuralLines) {
        const authority = resolveComponentCommercialAuthority({
          applicable: true,
          hasTrustedPhysicalQuantity: (row.req?.purchaseQuantity ?? 0) > 0,
          hasTrustedRate: row.req?.priced === true,
        });
        if (authority === "NOT_APPLICABLE" || !row.req) continue;
        const identitySummary =
          row.req.componentKey === DECK_SUPPORTS_COMPONENT_KEY
            ? formatPilePurchaseIdentity({
                identityDisplay: formatMaterialIdentityDisplay(
                  row.req.materialIdentity
                ),
                supportCount: structural.quantities?.supportCount ?? 0,
                purchaseLengthEachM:
                  structural.quantities?.postPurchaseLengthEachM ?? null,
                purchaseLm: structural.quantities?.postPurchaseLm ?? null,
              })
            : formatDeckIdentityLine([
                formatMaterialIdentityDisplay(row.req.materialIdentity),
                formatRequiredPurchased({
                  required: row.req.baseQuantity,
                  purchased: row.req.purchaseQuantity,
                  unit: row.req.purchaseUnit,
                  wastePercent: structural.quantities?.framingWastePercent,
                }),
              ]);
        if (authority === "DETAILED_PRICED") {
          const adapted = adaptPricedMaterialRequirementWithoutLegacy({
            requirement: row.req,
            workAreaName: workArea.name,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            label: row.label,
          });
          lineItems.push({
            ...adapted,
            identitySummary,
            notes: identitySummary,
          });
          continue;
        }
        lineItems.push({
          ...adaptUnpricedMaterialRequirementToEstimateLine({
            requirement: row.req,
            workAreaName: workArea.name,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            label: row.label,
          }),
          identitySummary,
          notes: identitySummary,
        });
        missingInfo.push(`${row.label} material rate required`);
      }
    } else {
      const framingRates = resolveRate({
        rates: context.rates,
        rateType: "material",
        itemKey: "deck.substructure.m2",
        workAreaType: "deck",
        unit: "m2",
        fallbackCostRate: DECK_BENCHMARKS.framing.cost,
        organisationSettings: context.organisationSettings,
      });

      lineItems.push(
        createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Framing/substructure",
          category: "materials",
          quantity: effectiveArea,
          unit: "m²",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          ...rateFieldsFromResolved(framingRates),
        })
      );
    }
  } else {
    assumptions.push("Framing/substructure excluded from scope.");
  }

  const fixingsRates = resolveRate({
    rates: context.rates,
    rateType: "material",
    itemKey: DECK_FIXINGS_RESIDUAL_ITEM_KEY,
    workAreaType: "deck",
    unit: "m2",
    fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
    organisationSettings: context.organisationSettings,
  });

  lineItems.push({
    ...createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: DECK_FIXINGS_RESIDUAL_LABEL,
      category: "materials",
      quantity: effectiveArea,
      unit: "m²",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      notes: `${effectiveArea} m² · residual starter allowance`,
      ...rateFieldsFromResolved(fixingsRates),
    }),
    identitySummary: `${effectiveArea} m²`,
  });

  const existingDeckRemoval = getBooleanFactAny(facts, workArea.id, [
    "deck.existing_deck_removal",
    "deck.demolition_required",
  ]);
  if (existingDeckRemoval === false) {
    exclusions.push("Demolition");
  } else if (existingDeckRemoval == null) {
    assumptions.push("No demolition assumed.");
  }
  if (
    getBooleanFact(facts, workArea.id, "deck.steps_included") === false
  ) {
    exclusions.push("Stairs");
  }
  if (
    getBooleanFact(facts, workArea.id, "deck.balustrade_required") === false
  ) {
    exclusions.push("Balustrade");
  }
  if (getBooleanFact(facts, workArea.id, "deck.painting_included") === false) {
    exclusions.push("Painting");
  }

  if (existingDeckRemoval) {
    const demoProductivity = resolveProductivity({
      productivityKey: "deck.demolition_hours_per_m2",
      unit: "m²",
      fallbackHoursPerUnit: 0.35,
      rates: context.rates,
    });
    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Existing deck removal",
        quantity: effectiveArea,
        unit: "m²",
        productivityHoursPerUnit: demoProductivity.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        adjustmentLabel: labourAdjustmentSummary,
        qualityFactor: NO_FINISH_QUALITY_FACTOR,
        notes: labourExpandedNotes({
          physicalDriver: "Physical driver: deck area. This is deck demolition, not post-hole soil.",
          adjustmentDetail: labourAdjustmentDetail,
          productivity: `Productivity: ${demoProductivity.hoursPerUnit} h/m² · ${demoProductivity.sourceLabel}`,
        }),
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        ...rateFieldsFromResolved(labourRate),
        productivitySourceType: demoProductivity.sourceType,
      })
    );
  }

  const hasExternalStairs = context.confirmedWorkAreas.some(
    (areaItem) => areaItem.type === "external_stairs"
  );

  const accessType = getStringFact(facts, workArea.id, "deck.access_type");
  const legacyStairs = getBooleanFact(facts, workArea.id, "deck.has_stairs");
  const stepsIncluded = deckStepsCommerciallyIncluded({
    facts,
    workAreaId: workArea.id,
  });

  if (
    getBooleanFactAny(facts, workArea.id, [
      "deck.balustrade_required",
      "deck.has_balustrade",
    ]) === true
  ) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Balustrade allowance",
        recommendedCost: DECK_BENCHMARKS.balustradeAllowance.cost,
        recommendedSell: quotrFallbackSellFromCost(
          DECK_BENCHMARKS.balustradeAllowance.cost,
          context.organisationSettings
        ),
        ...benchmarkRateFields(),
        sellDerivedFromMargin: true,
        sellAuthority: "derived_from_gross_margin",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
    assumptions.push(
      "Final balustrade design and compliance are subject to confirmation."
    );
  } else if (
    getBooleanFact(facts, workArea.id, "deck.handrail_required") === true
  ) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Handrail allowance",
        recommendedCost: DECK_BENCHMARKS.handrailAllowance.cost,
        recommendedSell: quotrFallbackSellFromCost(
          DECK_BENCHMARKS.handrailAllowance.cost,
          context.organisationSettings
        ),
        ...benchmarkRateFields(),
        sellDerivedFromMargin: true,
        sellAuthority: "derived_from_gross_margin",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
    assumptions.push(
      "Final handrail design and compliance are subject to confirmation."
    );
  }

  const consentStatus = getStringFact(
    facts,
    workArea.id,
    "deck.engineering_or_consent_status"
  );
  if (consentStatus?.toLowerCase().includes("required")) {
    exclusions.push("Engineering and consent costs excluded unless confirmed.");
  } else if (consentStatus?.toLowerCase().includes("not sure")) {
    assumptions.push("Engineering/consent requirements are subject to confirmation.");
  }

  const pileReplacementFact = getBooleanFact(
    facts,
    workArea.id,
    "deck.pile_or_post_replacement_required"
  );
  const replacementApplicable = pileReplacementApplicable({
    facts,
    workAreaId: workArea.id,
  });
  const pilePending = pileRetentionPending({ facts, workAreaId: workArea.id });
  if (pilePending && pileReplacementFact == null) {
    missingInfo.push(
      "Existing piles may be retained if sound after inspection. This price does not assume they are replaced or kept."
    );
  }
  if (
    pilePending &&
    pileReplacementFact === true &&
    getNumberFact(facts, workArea.id, "deck.pile_or_post_count") == null
  ) {
    missingInfo.push(
      "Pile replacement is an assumption. No pile count was stated, so this is not a complete pile price."
    );
  }
  const pileReplacement = pilePending
    ? pileReplacementFact
    : replacementApplicable
      ? pileReplacementFact
      : false;
  const substructureCondition = getStringFact(
    facts,
    workArea.id,
    "deck.substructure_condition"
  )?.toLowerCase();

  if (pileReplacement === true) {
    const pileCount = getNumberFact(facts, workArea.id, "deck.pile_or_post_count");
    const postRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "deck.post_replacement.each",
      workAreaType: "deck",
      unit: "each",
      fallbackCostRate: DECK_BENCHMARKS.postReplacementEach.cost,
      organisationSettings: context.organisationSettings,
    });

    if (pileCount != null && pileCount > 0) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Pile/post replacement allowance",
          category: "allowance",
          recommendedCost: round2(postRates.costRate * pileCount),
          recommendedSell: round2(postRates.sellRate * pileCount),
          rateSource: postRates.sourceLabel,
          sellDerivedFromMargin: postRates.sellDerivedFromMargin,
          sellAuthority: postRates.sellAuthority,
          notes: `${pileCount} piles/posts`,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    } else {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Pile/post replacement allowance",
          category: "allowance",
          recommendedCost: DECK_BENCHMARKS.substructureReplacementAllowance.cost,
          recommendedSell: quotrFallbackSellFromCost(
            DECK_BENCHMARKS.substructureReplacementAllowance.cost,
            context.organisationSettings
          ),
          ...benchmarkRateFields(),
          sellDerivedFromMargin: true,
          sellAuthority: "derived_from_gross_margin",
          notes: "Count subject to confirmation",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
      assumptions.push(
        "Pile/post replacement count is subject to confirmation."
      );
    }
  } else if (pileReplacement === null && replacementApplicable) {
    assumptions.push(
      "Existing substructure condition is subject to confirmation."
    );
  }

  if (
    replacementApplicable &&
    (substructureCondition?.includes("partial") ||
      substructureCondition?.includes("full"))
  ) {
    const hasPileLine = lineItems.some((item) =>
      item.label.includes("Pile/post replacement")
    );
    if (!hasPileLine) {
      const allowance =
        substructureCondition.includes("full")
          ? DECK_BENCHMARKS.substructureReplacementAllowance
          : DECK_BENCHMARKS.substructurePartialAllowance;
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Substructure replacement allowance",
          category: "allowance",
          recommendedCost: allowance.cost,
          recommendedSell: quotrFallbackSellFromCost(
            allowance.cost,
            context.organisationSettings
          ),
          ...benchmarkRateFields(),
          sellDerivedFromMargin: true,
          sellAuthority: "derived_from_gross_margin",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
  } else if (substructureCondition === "unknown") {
    assumptions.push(
      "Existing substructure condition is subject to confirmation."
    );
  } else if (substructureCondition === "none") {
    assumptions.push("No existing substructure — new construction assumed.");
  }

  const fasciaFact = getBooleanFact(
    facts,
    workArea.id,
    "deck.vertical_face_boards_required"
  );
  if (fasciaFact == null) {
    assumptions.push("No fascia included unless confirmed.");
  }

  if (fasciaFact === true) {
    const fasciaEdge = resolveDeckFasciaEdgeLength({
      facts,
      workAreaId: workArea.id,
      lengthM: length,
      widthM: width,
    });
    if (fasciaEdge.status === "needs_length") {
      missingInfo.push(
        "Fascia is included. No exposed length was stated, and the full rectangular perimeter was not chosen, so fascia materials and labour are not priced."
      );
    } else {
    const fasciaQty = calculateDeckFasciaQuantities({
      facts,
      workAreaId: workArea.id,
      lengthM: length,
      widthM: width,
      areaM2: effectiveArea,
      deckHeightM: deckHeight,
      boardWidthMm: boardWidthFact,
      wastePercent: wastagePercent,
    });
    assumptions.push(
      fasciaEdge.status === "stated"
        ? `Fascia length is the stated ${formatLm(fasciaEdge.lengthM)} m, including when that is only part of the edge. It is not assumed to be the full perimeter.`
        : `Fascia length is the explicit rectangular perimeter ${formatLm(fasciaEdge.lengthM)} m. Inclusion alone did not choose the full perimeter.`
    );
    assumptions.push(
      `Fascia / edge boards use that length × ${fasciaQty.courses} course${fasciaQty.courses === 1 ? "" : "s"} (${formatLm(fasciaQty.fasciaNetLm)} lm required). Not height-driven.`
    );
    const fasciaProductivity = resolveProductivity({
      productivityKey: DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY,
      unit: "lm",
      fallbackHoursPerUnit: 0.45,
      rates: context.rates,
    });
    const fasciaIdentity = formatDeckIdentityLine([
      getStringFact(facts, workArea.id, "deck.fascia_material")?.trim() ||
        DECK_FASCIA_BUILDER_LABEL,
      formatRequiredPurchased({
        required: fasciaQty.fasciaNetLm,
        purchased: fasciaQty.fasciaPurchaseLm,
        unit: "lm",
        wastePercent: wastagePercent,
      }),
    ]);
    const fasciaRates = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: DECK_FASCIA_MATERIAL_ITEM_KEY,
      workAreaType: "deck",
      unit: "lm",
      fallbackCostRate: DECK_BENCHMARKS.faceBoardLm.cost,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push({
      ...createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: DECK_FASCIA_BUILDER_LABEL,
        category: "materials",
        quantity: fasciaQty.fasciaPurchaseLm,
        unit: "lm",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        componentKey: DECK_FASCIA_COMPONENT_KEY,
        notes: fasciaIdentity,
        ...rateFieldsFromResolved(fasciaRates, DECK_FASCIA_MATERIAL_ITEM_KEY),
      }),
      identitySummary: fasciaIdentity,
    });
    if (isTrustedProductivityHours(fasciaProductivity.hoursPerUnit)) {
      lineItems.push(
        createLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Fascia installation",
          quantity: fasciaQty.fasciaNetLm,
          unit: "lm",
          productivityHoursPerUnit: fasciaProductivity.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          adjustmentFactor: labourAdjustment,
          adjustmentLabel: labourAdjustmentSummary,
          notes: labourExpandedNotes({
            physicalDriver: "Physical driver: required fascia lm.",
            adjustmentDetail: labourAdjustmentDetail,
            productivity: `Productivity: ${fasciaProductivity.hoursPerUnit} h/lm · ${fasciaProductivity.sourceLabel}`,
          }),
          sortOrder: sortOrder++,
          componentKey: DECK_FASCIA_INSTALL_COMPONENT_KEY,
          organisationSettings: context.organisationSettings,
          ...rateFieldsFromResolved(labourRate),
        })
      );
    } else {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Fascia labour allowance",
          recommendedCost: round2(
            fasciaQty.fasciaNetLm * DECK_FASCIA_LABOUR_FALLBACK_COST_PER_LM
          ),
          recommendedSell: quotrFallbackSellFromCost(
            round2(
              fasciaQty.fasciaNetLm * DECK_FASCIA_LABOUR_FALLBACK_COST_PER_LM
            ),
            context.organisationSettings
          ),
          rateSource: getRateSourceLabel("benchmark"),
          rateSourceType: "benchmark",
          sellDerivedFromMargin: true,
          sellAuthority: "derived_from_gross_margin",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
    }
  }

  const skirtingRequired = deckSkirtingIncluded({
    facts,
    workAreaId: workArea.id,
  });
  if (skirtingRequired) {
    const skirtingQty = calculateDeckSkirtingQuantities({
      facts,
      workAreaId: workArea.id,
      lengthM: length,
      widthM: width,
      areaM2: effectiveArea,
      deckHeightM: deckHeight,
      boardWidthMm: boardWidthFact,
      wastePercent: wastagePercent,
    });
    assumptions.push(
      skirtingQty.heightModelApplied
        ? `${DECK_SKIRTING_BUILDER_LABEL} uses exposed perimeter × height minus ${skirtingQty.groundGapM * 1000} mm ground gap (${round2(skirtingQty.boardHeightEquivalents)} board-height equivalents). Explicit skirting scope — not inferred from elevation.`
        : `${DECK_SKIRTING_BUILDER_LABEL} uses edge length only because deck height is not confirmed.`
    );
    const skirtingProductivity = resolveDeckSkirtingInstallProductivity(
      context.rates
    );
    const skirtingIdentity = formatDeckIdentityLine([
      DECK_SKIRTING_BUILDER_LABEL,
      formatRequiredPurchased({
        required: skirtingQty.skirtingNetLm,
        purchased: skirtingQty.skirtingPurchaseLm,
        unit: "lm",
        wastePercent: wastagePercent,
      }),
    ]);
    const skirtingRates = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: DECK_SKIRTING_MATERIAL_ITEM_KEY,
      workAreaType: "deck",
      unit: "lm",
      fallbackCostRate: DECK_BENCHMARKS.faceBoardLm.cost,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push({
      ...createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: DECK_SKIRTING_BUILDER_LABEL,
        category: "materials",
        quantity: skirtingQty.skirtingPurchaseLm,
        unit: "lm",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        componentKey: DECK_SKIRTING_COMPONENT_KEY,
        notes: skirtingIdentity,
        ...rateFieldsFromResolved(skirtingRates, DECK_SKIRTING_MATERIAL_ITEM_KEY),
      }),
      identitySummary: skirtingIdentity,
    });
    if (isTrustedProductivityHours(skirtingProductivity.hoursPerUnit)) {
      lineItems.push(
        createLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: DECK_SKIRTING_INSTALL_LABEL,
          quantity: skirtingQty.skirtingNetLm,
          unit: "lm",
          productivityHoursPerUnit: skirtingProductivity.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          adjustmentFactor: labourAdjustment,
          adjustmentLabel: labourAdjustmentSummary,
          notes: labourExpandedNotes({
            physicalDriver:
              "Physical driver: required skirting lm. Height-sensitive full-height screening.",
            adjustmentDetail: labourAdjustmentDetail,
            productivity: `Productivity: ${skirtingProductivity.hoursPerUnit} h/lm · ${skirtingProductivity.sourceLabel}`,
          }),
          sortOrder: sortOrder++,
          componentKey: DECK_SKIRTING_INSTALL_COMPONENT_KEY,
          organisationSettings: context.organisationSettings,
          ...rateFieldsFromResolved(labourRate),
        })
      );
    }
  }

  const supportsActive = deckSupportsActive({
    substructureIncluded,
    supportCount: structural.quantities?.supportCount,
  });
  const concreteIncluded = concreteToSupportsIncluded({
    facts,
    workAreaId: workArea.id,
    supportsActive,
  });
  if (concreteIncluded) {
    const postCount = structural.quantities?.supportCount ?? 0;
    const concrete = planDeckPostConcrete({
      facts,
      workAreaId: workArea.id,
      holeCount: postCount,
    });
    const holeCount = resolveDeckHoleCount({
      facts,
      workAreaId: workArea.id,
      postCount,
    }).holeCount;
    const bags = concrete.bags;
    const concreteIdentity = buildConcreteMaterialIdentity({
      originalDescription: "20 kg premix concrete",
    });
    const identitySummary = formatDeckIdentityLine([
      concreteIdentity.originalDescription,
      bags > 0 ? `${bags} bags` : null,
      concrete.authority === "measured" ? "Confirmed" : null,
      concrete.authority === "provisional" ? "Provisional" : null,
      concrete.authority === "company" ? "Company quantity" : null,
      concrete.authority === "measured" && concrete.netM3 != null
        ? `${concrete.netM3.toFixed(3)} m³ net`
        : null,
    ]);
    const companyConcrete = context.rates.find(
      (rate) =>
        rate.active &&
        rate.item_key === DECK_CONCRETE_MATERIAL_ITEM_KEY &&
        rate.cost_rate != null
    );
    const bagQuantityBasis = quantityBasisFrom({
      sourceFact:
        concrete.authority === "company"
          ? DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY
          : "deck.concrete_fill",
      sourceLabel:
        concrete.authority === "company"
          ? "Company bags per hole"
          : "Post-hole fill and 20 kg yield",
      quantity: bags,
      unit: "bag",
      formula: concrete.formula,
      confidence:
        concrete.authority === "measured"
          ? "derived"
          : concrete.authority === "company"
            ? "confirmed"
            : "assumed",
    });
    if (bags > 0 && companyConcrete?.cost_rate != null) {
      const unitCost = Number(companyConcrete.cost_rate);
      const unitSell =
        companyConcrete.sell_rate != null
          ? Number(companyConcrete.sell_rate)
          : unitCost / (1 - (context.organisationSettings?.default_margin_percent ?? 20) / 100);
      lineItems.push(
        withCommercialMetadata(
          {
            ...createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: DECK_CONCRETE_MATERIAL_LABEL,
              category: "materials",
              quantity: bags,
              unit: "bag",
              costRate: unitCost,
              sellRate: unitSell,
              rateSource: getRateSourceLabel("user_rate"),
              rateSourceType: "user_rate",
              itemKey: DECK_CONCRETE_MATERIAL_ITEM_KEY,
              componentKey: DECK_CONCRETE_BAGS_COMPONENT_KEY,
              notes: concrete.disclosure,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
            }),
            identitySummary,
          },
          { quantityBasis: bagQuantityBasis }
        )
      );
    } else if (bags > 0) {
      const benchmarkCost = getCatalogueEntry(DECK_CONCRETE_MATERIAL_ITEM_KEY)
        ?.defaultCostRate;
      const allowBenchmark =
        context.organisationSettings?.allow_benchmark_rates !== false;
      if (benchmarkCost != null && allowBenchmark) {
        const unitSell =
          benchmarkCost /
          (1 -
            (context.organisationSettings?.default_margin_percent ?? 20) / 100);
        lineItems.push(
          withCommercialMetadata(
            {
              ...createRateLineItem({
                workAreaId: workArea.id,
                workAreaName: workArea.name,
                label: DECK_CONCRETE_MATERIAL_LABEL,
                category: "materials",
                quantity: bags,
                unit: "bag",
                costRate: benchmarkCost,
                sellRate: unitSell,
                rateSource: getRateSourceLabel("benchmark"),
                rateSourceType: "benchmark",
                itemKey: DECK_CONCRETE_MATERIAL_ITEM_KEY,
                componentKey: DECK_CONCRETE_BAGS_COMPONENT_KEY,
                notes: concrete.disclosure,
                sortOrder: sortOrder++,
                organisationSettings: context.organisationSettings,
              }),
              identitySummary,
            },
            { quantityBasis: bagQuantityBasis }
          )
        );
      } else {
        lineItems.push({
          ...createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: DECK_CONCRETE_MATERIAL_LABEL,
            category: "materials",
            quantity: bags,
            unit: "bag",
            costRate: 0,
            sellRate: 0,
            rateSource: getRateSourceLabel("missing"),
            rateSourceType: "missing",
            itemKey: DECK_CONCRETE_MATERIAL_ITEM_KEY,
            componentKey: DECK_CONCRETE_BAGS_COMPONENT_KEY,
            notes: concrete.disclosure,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          identitySummary,
        });
        missingInfo.push("Concrete 20kg premix bag rate required");
      }
    }

    const placeResolved = resolveDeckConcretePlaceProductivity(context.rates);
    const placeScope = decideLegacyProductivityScope({
      resolved: placeResolved,
      confirmation: getStringFact(facts, workArea.id, DECK_CONCRETE_PLACE_CONFIRM_FACT),
      jobHours: getNumberFact(facts, workArea.id, DECK_CONCRETE_PLACE_JOB_HOURS_FACT),
      factKey: DECK_CONCRETE_PLACE_CONFIRM_FACT,
      jobFactKey: DECK_CONCRETE_PLACE_JOB_HOURS_FACT,
      quotrBenchmarkHours: DECK_CONCRETE_PLACE_BENCHMARK_HOURS,
    });
    const placeProductivity =
      placeScope.action === "apply"
        ? {
            ...placeResolved,
            hoursPerUnit: placeScope.hoursPerUnit,
            sourceLabel: placeScope.sourceLabel,
            sourceType: placeScope.sourceType,
          }
        : placeScope.action === "benchmark"
          ? placeResolved
          : null;
    if (placeScope.action === "review" && bags > 0) {
      const beforeAccess = round2(bags * placeScope.hoursPerUnit);
      const heldHours = shapeLabourHours({
        quantity: bags,
        productivityHoursPerUnit: placeScope.hoursPerUnit,
        adjustmentFactor: labourAdjustment,
      }).adjustedHours;
      missingInfo.push("Concrete placement scope");
      lineItems.push({
        ...createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: DECK_CONCRETE_PLACE_LABEL,
          category: "labour",
          quantity: bags,
          unit: "bag",
          costRate: 0,
          sellRate: 0,
          rateSource: getRateSourceLabel("missing"),
          rateSourceType: "missing",
          itemKey: DECK_CONCRETE_PRODUCTIVITY_KEY,
          componentKey: DECK_CONCRETE_PLACE_COMPONENT_KEY,
          notes: scopeReviewNotes({
            summary: `Stored calibrated rate ${placeScope.hoursPerUnit} h/bag · Your calibrated productivity. It was saved against a fixed bag scenario, not this estimate's purchased bags, so it is not priced yet. ${bags} bags × ${placeScope.hoursPerUnit} h/bag = ${beforeAccess} h before access if you confirm it applies to these purchased bags. Hole excavation is separate.`,
            factKey: placeScope.factKey,
            token: placeScope.token,
            jobFactKey: placeScope.jobFactKey,
          }),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
        includedInTotal: false,
        labourHours: heldHours,
        productivityRate: placeScope.hoursPerUnit,
      });
    } else if (bags > 0 && placeProductivity && isTrustedProductivityHours(placeProductivity.hoursPerUnit)) {
      lineItems.push(
        createLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: DECK_CONCRETE_PLACE_LABEL,
          quantity: bags,
          unit: "bag",
          productivityHoursPerUnit: placeProductivity.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          adjustmentFactor: labourAdjustment,
          adjustmentLabel: labourAdjustmentSummary,
          notes: labourExpandedNotes({
            physicalDriver: `Physical driver: ${bags} bags purchased. Mixing, placing, and basic finishing. Excludes hole excavation. Hole excavation is a separate operation. ${holeCount} holes. ${concrete.disclosure}`,
            adjustmentDetail: labourAdjustmentDetail,
            productivity: `Productivity: ${placeProductivity.hoursPerUnit} h/bag · ${placeProductivity.sourceLabel ?? ""}. ${productivitySourceNote(placeProductivity.sourceType ?? "benchmark", placeProductivity.sourceLabel ?? "")}${concreteCompanyComparison(placeProductivity)}`,
          }),
          sortOrder: sortOrder++,
          componentKey: DECK_CONCRETE_PLACE_COMPONENT_KEY,
          organisationSettings: context.organisationSettings,
          ...rateFieldsFromResolved(labourRate),
          productivitySourceType: placeProductivity.sourceType,
        })
      );
    } else if (bags > 0) {
      lineItems.push({
        ...createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: DECK_CONCRETE_PLACE_LABEL,
          category: "labour",
          quantity: bags,
          unit: "bag",
          costRate: 0,
          sellRate: 0,
          rateSource: getRateSourceLabel("missing"),
          rateSourceType: "missing",
          componentKey: DECK_CONCRETE_PLACE_COMPONENT_KEY,
          notes: "Concrete placement productivity required (hours/bag). Hole excavation is a separate operation. Legacy hours/hole is leftover and is not consumed.",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
      });
      missingInfo.push("Concrete placement hours/bag required");
    }
    assumptions.push(concrete.disclosure);
  }

  const surfaceFactKeys = [
    areaFact != null ? "deck.area_m2" : null,
    areaFact == null && length != null && width != null ? "deck.length_m" : null,
    areaFact == null && length != null && width != null ? "deck.width_m" : null,
    boardWidthFact != null ? "deck.board_width_mm" : null,
    getStringFact(facts, workArea.id, "deck.board_material")
      ? "deck.board_material"
      : getStringFact(facts, workArea.id, "deck.material")
        ? "deck.material"
        : null,
  ].filter((key): key is string => key != null);

  const surfaceRequirement = maybeBuildDeckSurfaceRequirement({
    workArea,
    material,
    materialLabel,
    wastagePercent,
    boardWidthMm: boardWidthFact,
    deckingBoardResult,
    deckingPricing,
    usedLmPricing,
    materialWastageSettings: context.materialWastageSettings,
    factKeys: surfaceFactKeys,
  });

  const labourFactKeys = [
    areaFact != null ? "deck.area_m2" : null,
    areaFact == null && length != null && width != null ? "deck.length_m" : null,
    areaFact == null && length != null && width != null ? "deck.width_m" : null,
    deckHeight != null ? "deck.height_m" : null,
    getStringFact(facts, workArea.id, "deck.level") ? "deck.level" : null,
  ].filter((key): key is string => key != null);

  const labourRequirement = buildDeckLabourRequirement({
    workArea,
    hours: deckLabourHours,
    labourRate,
    elevated: Boolean(elevated),
    assumedArea,
    factKeys: labourFactKeys,
    constraintKeys: labourConstraintKeysFrom(context.constraints),
  });

  if (stepsIncluded && !hasExternalStairs) {
    // Vertical faces stay in Fascia — step decking is treads only.
    const steps = calculateDeckStepsQuantities({
      facts,
      workAreaId: workArea.id,
      deckHeightM: deckHeight,
      wastePercent: wastagePercent,
    });
    const explicitStepsIncluded =
      getBooleanFact(facts, workArea.id, DECK_STEPS_INCLUDED_FACT_KEY) ===
      true;
    if (!steps || steps.riseCount <= 0) {
      if (explicitStepsIncluded || stepsIncluded) {
        missingInfo.push("Step arrangement required");
      }
    } else {
      const goingMm = Math.round(steps.goingM * 1000);
      const stepGeometryReady = stepPhysicalGeometryReady(steps);
      if (steps.widthDefaulted && stepGeometryReady) {
        recordDefaultedNumber(assumptionMetadata, {
          key: "deck.step_width_m",
          label: "Step width",
          assumedValue: DEFAULT_STEP_WIDTH_M,
          unit: " m",
          reason: STEP_WIDTH_ASSUMPTION_STATEMENT,
          severity: "warning",
          workAreaId: workArea.id,
        });
        assumptions.push(STEP_WIDTH_ASSUMPTION_STATEMENT);
      }
      if (steps.goingDefaulted && stepGeometryReady) {
        recordDefaultedNumber(assumptionMetadata, {
          key: "deck.step_going_m",
          label: "Tread depth",
          assumedValue: goingMm,
          unit: " mm",
          reason: "LOW-CONFIDENCE estimating assumption for stair tread depth.",
          severity: "warning",
          workAreaId: workArea.id,
        });
        assumptions.push(
          `Assuming stair tread depth ${goingMm} mm (LOW-CONFIDENCE).`
        );
      }
      if (steps.riseCountDefaulted) {
        assumptions.push(STEP_ARRANGEMENT_FROM_HEIGHT_STATEMENT);
      } else {
        assumptions.push(
          `Steps estimated as ${steps.riseCount} rises (${steps.estimatedRiserM} m). Estimating layout only — not stair compliance.`
        );
      }
      if (!stepGeometryReady) {
        if (explicitStepsIncluded) {
          if (!detailedMoneyAllowed(steps.widthResolution)) {
            missingInfo.push("Step width required");
          }
          if (!detailedMoneyAllowed(steps.goingResolution)) {
            missingInfo.push("Tread depth required");
          }
        }
      } else {
      const stepFramingIdentity = defaultStepFramingIdentity();
      const treadLm = calculateDeckingBoardLm({
        areaM2: steps.treadAreaM2,
        boardWidthMm: boardWidthFact,
        wastagePercent,
      });
      // inherits deck board material
      const treadPricing = resolveDeckingBoardPricing({
        context,
        material,
        label: materialLabel,
        purchaseLm: treadLm?.totalLm ?? null,
        boardWidthMm: boardWidthFact,
        areaM2: steps.treadAreaM2,
      });
      const framingPricing = stepFramingIdentity
        ? resolveStructuralMaterialRequirementRate({
            identity: stepFramingIdentity,
            unit: "lm",
            purchaseQuantity: steps.framingPurchaseLm,
            rates: context.rates,
            organisationSettings: context.organisationSettings,
          })
        : { priced: false as const, unitCost: null, totalCost: null, rateSource: "missing" as const };
      const stepsProductivity = resolveProductivity({
        productivityKey: "deck.steps.install.hours_per_m2",
        unit: "m2",
        fallbackHoursPerUnit: 4.0,
        rates: context.rates,
      });
      const treadsPriced =
        treadPricing.rateFields.costRate > 0 &&
        treadPricing.resolution.source !== "missing";
      const framingPriced =
        framingPricing.priced === true && framingPricing.unitCost != null;
      const labourTrusted = isTrustedProductivityHours(
        stepsProductivity.hoursPerUnit
      );
      const detailedComplete =
        explicitStepsIncluded && treadsPriced && framingPriced && labourTrusted;

      if (detailedComplete && framingPricing.priced && framingPricing.unitCost != null) {
        const treadQtyCopy =
          treadLm != null
            ? formatRequiredPurchased({
                required: treadLm.baseLm,
                purchased: treadLm.totalLm,
                unit: "lm",
                wastePercent: wastagePercent,
              })
            : `${formatQuantity(steps.treadAreaM2)} m² tread area`;
        const treadIdentity = formatDeckIdentityLine([
          materialLabel,
          boardWidthFact != null ? `${boardWidthFact} mm` : null,
          treadQtyCopy,
        ]);
        const framingIdentityText = formatMaterialIdentityDisplay(stepFramingIdentity);
        const framingIdentity = formatDeckIdentityLine([
          framingIdentityText,
          formatRequiredPurchased({
            required: steps.framingNetLm,
            purchased: steps.framingPurchaseLm,
            unit: "lm",
            wastePercent: wastagePercent,
          }),
        ]);
        const treadTakeoff = formatStepGeometryTakeoff(steps);
        let treadLine = createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Step decking",
          category: "materials",
          quantity: treadPricing.quantity,
          unit: treadPricing.unit === "m2" ? "m²" : treadPricing.unit,
          notes: treadTakeoff,
          sortOrder: sortOrder++,
          componentKey: DECK_STEPS_TREADS_COMPONENT_KEY,
          organisationSettings: context.organisationSettings,
          ...treadPricing.rateFields,
        });
        treadLine = {
          ...withMaterialRateResolution(treadLine, treadPricing.resolution),
          identitySummary: treadIdentity,
        };
        lineItems.push(treadLine);

        const framingUnitSell =
          framingPricing.unitCost /
          (1 - (context.organisationSettings?.default_margin_percent ?? 20) / 100);
        lineItems.push({
          ...createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Step framing",
            category: "materials",
            quantity: steps.framingPurchaseLm,
            unit: "lm",
            costRate: framingPricing.unitCost,
            sellRate: framingUnitSell,
            rateSource: framingPricing.rateSource,
            componentKey: DECK_STEPS_FRAMING_COMPONENT_KEY,
            notes: framingIdentity,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            sellDerivedFromMargin: true,
            sellAuthority: "derived_from_gross_margin",
          }),
          identitySummary: framingIdentity,
        });

        lineItems.push(
          createLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Step installation",
            quantity: steps.treadAreaM2,
            unit: "m²",
            productivityHoursPerUnit: stepsProductivity.hoursPerUnit,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            adjustmentFactor: labourAdjustment,
            adjustmentLabel: labourAdjustmentSummary,
            notes: labourExpandedNotes({
              physicalDriver: `Physical driver: tread area ${formatQuantity(steps.treadAreaM2)} m² from stair width ${formatQuantity(steps.widthM)} m (${steps.widthDefaulted ? "assumed" : "known"}) × tread depth × ${steps.treadCount} treads (${goingMm} mm ${steps.goingDefaulted ? "assumed" : "known"}).`,
              adjustmentDetail: labourAdjustmentDetail,
              productivity: `Productivity: ${stepsProductivity.hoursPerUnit} h/m² · ${stepsProductivity.sourceLabel}`,
            }),
            sortOrder: sortOrder++,
            componentKey: DECK_STEPS_INSTALL_COMPONENT_KEY,
            organisationSettings: context.organisationSettings,
            ...rateFieldsFromResolved(labourRate),
          })
        );
      } else {
        const accessLower = accessType?.toLowerCase() ?? "";
        const stairSet =
          accessLower.includes("stair set") ||
          (legacyStairs === true && !accessType);
        const multi = accessLower.includes("multiple");
        const allowance = stairSet
          ? {
              label: "Stair set allowance",
              cost: DECK_BENCHMARKS.stairsAllowance.cost,
              notes: "External stair set allowance included with deck.",
            }
          : multi
            ? {
                label: "Multi-side step-down allowance",
                cost: DECK_BENCHMARKS.multiSideStairsAllowance.cost,
                notes: "Steps included — detailed chain incomplete; allowance is commercial authority.",
              }
            : {
                label: "Step-down allowance",
                cost: DECK_BENCHMARKS.stepAllowance.cost,
                notes: "Steps included — detailed chain incomplete; allowance is commercial authority.",
              };
        lineItems.push(
          createAllowanceLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: allowance.label,
            recommendedCost: allowance.cost,
            recommendedSell: quotrFallbackSellFromCost(
              allowance.cost,
              context.organisationSettings
            ),
            ...benchmarkRateFields(),
            sellDerivedFromMargin: true,
            sellAuthority: "derived_from_gross_margin",
            notes: allowance.notes,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            qualityFactor,
          })
        );
      }
      }
    }
  }

  const requirements = [
    surfaceRequirement,
    labourRequirement,
    ...structural.requirements,
  ].filter((item): item is NonNullable<typeof item> => item != null);

  const deckSubstructureReconciliation =
    structural.requirements.length > 0
      ? buildDeckSubstructureGroupReconciliation({
          legacyLineItems: lineItems,
          structuralRequirements: structural.requirements,
        })
      : undefined;

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence: baseConfidence(missingInfo.length),
    assumptionMetadata,
    ...(requirements.length > 0 ? { requirements: requirements } : {}),
    ...(deckSubstructureReconciliation
      ? { deckSubstructureReconciliation }
      : {}),
  };
}
