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
import { resolveProductivity, isTrustedProductivityHours } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { calculateDeckingBoardLm } from "@/lib/estimate/material-buildups";
import {
  createDeckingBoardBuildUp,
  withMaterialBuildUp,
} from "@/lib/estimate/material-buildup-meta";
import { withMaterialRateResolution } from "@/lib/estimate/material-rate-pricing";
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
  DECK_SKIRTING_BUILDER_LABEL,
  DECK_SKIRTING_COMPONENT_KEY,
  DECK_SKIRTING_INSTALL_COMPONENT_KEY,
  DECK_SKIRTING_INSTALL_LABEL,
  calculateDeckFasciaQuantities,
  calculateDeckSkirtingQuantities,
  deckSkirtingIncluded,
} from "@/lib/estimate/deck-fascia";
import {
  DECK_FASCIA_INSTALL_HOURS_PER_LM_KEY,
  DECK_SUBSTRUCTURE_STARTER_CONFIDENCE,
  requiredInstalledFramingLm,
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
  DECK_CONCRETE_PLACE_LABEL,
  DECK_CONCRETE_TO_SUPPORTS_FACT_KEY,
  DECK_STEPS_FRAMING_COMPONENT_KEY,
  DECK_STEPS_INCLUDED_FACT_KEY,
  DECK_STEPS_INSTALL_COMPONENT_KEY,
  DECK_STEPS_TREADS_COMPONENT_KEY,
  DECKING_LINE_LABEL,
  DECKING_PACKAGE_LINE_LABEL,
  concreteBagsPerHole,
  concreteToSupportsIncluded,
  deckStepsCommerciallyIncluded,
  deckSupportsActive,
  formatDeckIdentityLine,
  formatMaterialIdentityDisplay,
  formatPilePurchaseIdentity,
  pileReplacementApplicable,
  purchasedConcreteBags,
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
import { detailedMoneyAllowed } from "@/lib/estimate/physical-requirement-resolution";
import { resolveLegacyWorkAreaAccess } from "@/lib/project-conditions/legacy-adapter";

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
  const boardWidthFact = getNumberFact(facts, workArea.id, "deck.board_width_mm");
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
        confidence: "derived",
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
    context.rates
  );
  const substructureInstallProductivity =
    resolveDeckSubstructureInstallProductivity(context.rates);
  const postsInstallProductivity = resolveProductivity({
    productivityKey: "deck.posts.install.hours_per_ea",
    unit: "ea",
    fallbackHoursPerUnit: 0.2,
    rates: context.rates,
  });
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
      postHours = shapeLabourHours({
        quantity: supportCount,
        productivityHoursPerUnit: postsInstallProductivity.hoursPerUnit,
        adjustmentFactor: labourAdjustment,
      });
      lineItems.push(
        createLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Pile/post installation",
          quantity: supportCount,
          unit: "ea",
          productivityHoursPerUnit: postsInstallProductivity.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          adjustmentFactor: labourAdjustment,
          adjustmentLabel: labourAdjustmentSummary,
          notes: labourExpandedNotes({
            physicalDriver: `Physical driver: ${supportCount} supports. Includes set-out, hole excavation, hole preparation, positioning, cutting/setting, and normal installation. Excludes concrete placement.`,
            adjustmentDetail: labourAdjustmentDetail,
            productivity: `Productivity: ${postsInstallProductivity.hoursPerUnit} h/ea · ${postsInstallProductivity.sourceLabel}`,
          }),
          sortOrder: sortOrder++,
          componentKey: "deck.posts.install",
          organisationSettings: context.organisationSettings,
          ...labourRateFields,
        })
      );
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
        fallbackSellRate: DECK_BENCHMARKS.framing.sell,
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
    fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
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
  if (existingDeckRemoval == null) {
    assumptions.push("No demolition assumed.");
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
          physicalDriver: "Physical driver: deck area.",
          adjustmentDetail: labourAdjustmentDetail,
          productivity: `Productivity: ${demoProductivity.hoursPerUnit} h/m²`,
        }),
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        ...rateFieldsFromResolved(labourRate),
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
        recommendedSell: DECK_BENCHMARKS.balustradeAllowance.sell,
        ...benchmarkRateFields(),
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
        recommendedSell: DECK_BENCHMARKS.handrailAllowance.sell,
        ...benchmarkRateFields(),
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
  const pileReplacement = replacementApplicable ? pileReplacementFact : false;
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
      fallbackSellRate: DECK_BENCHMARKS.postReplacementEach.sell,
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
          recommendedSell: DECK_BENCHMARKS.substructureReplacementAllowance.sell,
          ...benchmarkRateFields(),
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
          recommendedSell: allowance.sell,
          ...benchmarkRateFields(),
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
      `Fascia / edge boards use exposed perimeter × ${fasciaQty.courses} course${fasciaQty.courses === 1 ? "" : "s"} (${formatLm(fasciaQty.fasciaNetLm)} lm required). Not height-driven.`
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
    lineItems.push({
      ...createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: DECK_FASCIA_BUILDER_LABEL,
        category: "materials",
        quantity: fasciaQty.fasciaPurchaseLm,
        unit: "lm",
        costRate: DECK_BENCHMARKS.faceBoardLm.cost,
        sellRate: DECK_BENCHMARKS.faceBoardLm.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        componentKey: DECK_FASCIA_COMPONENT_KEY,
        notes: fasciaIdentity,
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
          recommendedCost: round2(fasciaQty.fasciaNetLm * 35),
          recommendedSell: round2(fasciaQty.fasciaNetLm * 55),
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
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
    lineItems.push({
      ...createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: DECK_SKIRTING_BUILDER_LABEL,
        category: "materials",
        quantity: skirtingQty.skirtingPurchaseLm,
        unit: "lm",
        costRate: DECK_BENCHMARKS.faceBoardLm.cost,
        sellRate: DECK_BENCHMARKS.faceBoardLm.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        componentKey: DECK_SKIRTING_COMPONENT_KEY,
        notes: skirtingIdentity,
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
    const holeCount = structural.quantities?.supportCount ?? 0;
    const bagsEach = concreteBagsPerHole(facts, workArea.id);
    const bags = purchasedConcreteBags(holeCount, bagsEach);
    const concreteIdentity = buildConcreteMaterialIdentity({
      originalDescription: "20 kg premix concrete",
    });
    const bagsEachDisplay = (Math.round(bagsEach * 10) / 10).toFixed(1);
    const identitySummary = formatDeckIdentityLine([
      concreteIdentity.originalDescription,
      bags > 0 ? `${bags} bags required` : null,
      `${bagsEachDisplay} bags/hole avg`,
    ]);
    const companyConcrete = context.rates.find(
      (rate) =>
        rate.active &&
        rate.item_key === DECK_CONCRETE_MATERIAL_ITEM_KEY &&
        rate.cost_rate != null
    );
    if (bags > 0 && companyConcrete?.cost_rate != null) {
      const unitCost = Number(companyConcrete.cost_rate);
      const unitSell =
        companyConcrete.sell_rate != null
          ? Number(companyConcrete.sell_rate)
          : unitCost / (1 - (context.organisationSettings?.default_margin_percent ?? 20) / 100);
      lineItems.push({
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
          notes: identitySummary,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
        identitySummary,
      });
    } else if (bags > 0) {
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
          notes: identitySummary,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
        identitySummary,
      });
      missingInfo.push("Concrete 20kg premix bag rate required");
    }

    const placeProductivity = resolveDeckConcretePlaceProductivity(context.rates);
    if (bags > 0 && isTrustedProductivityHours(placeProductivity.hoursPerUnit)) {
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
            physicalDriver: `Physical driver: ${bags} bags purchased. Mixing, placing, basic finishing. Excludes hole excavation (pile/post installation). ${holeCount} holes · ${bagsEachDisplay} bags/hole avg.`,
            adjustmentDetail: labourAdjustmentDetail,
            productivity: `Productivity: ${placeProductivity.hoursPerUnit} h/bag · ${placeProductivity.sourceLabel}`,
          }),
          sortOrder: sortOrder++,
          componentKey: DECK_CONCRETE_PLACE_COMPONENT_KEY,
          organisationSettings: context.organisationSettings,
          ...rateFieldsFromResolved(labourRate),
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
          notes: "Concrete placement productivity required (hours/bag). Hole excavation is in pile/post installation. Legacy hours/hole is leftover and is not consumed.",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
      });
      missingInfo.push("Concrete placement hours/bag required");
    }
    assumptions.push(
      `Concrete to supports uses ${bagsEach} × 20kg bags per hole (${bags} bags purchased, rounded up).`
    );
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
              sell: DECK_BENCHMARKS.stairsAllowance.sell,
              notes: "External stair set allowance included with deck.",
            }
          : multi
            ? {
                label: "Multi-side step-down allowance",
                cost: DECK_BENCHMARKS.multiSideStairsAllowance.cost,
                sell: DECK_BENCHMARKS.multiSideStairsAllowance.sell,
                notes: "Steps included — detailed chain incomplete; allowance is commercial authority.",
              }
            : {
                label: "Step-down allowance",
                cost: DECK_BENCHMARKS.stepAllowance.cost,
                sell: DECK_BENCHMARKS.stepAllowance.sell,
                notes: "Steps included — detailed chain incomplete; allowance is commercial authority.",
              };
        lineItems.push(
          createAllowanceLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: allowance.label,
            recommendedCost: allowance.cost,
            recommendedSell: allowance.sell,
            ...benchmarkRateFields(),
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
