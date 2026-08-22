import {
  getCombinedLabourAccessFactor,
  getConstraintNotes,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
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
import { calculateDeckFasciaQuantities } from "@/lib/estimate/deck-fascia";
import {
  calculateDeckStepsQuantities,
  deckStepsIncluded,
} from "@/lib/estimate/deck-steps-physical";
import { defaultStepFramingIdentity } from "@/lib/estimate/deck-default-identities";
import {
  DECK_FIXINGS_RESIDUAL_ITEM_KEY,
  DECK_FIXINGS_RESIDUAL_LABEL,
  decideDeckLabourSplit,
  decideDeckSubstructureAuthority,
} from "@/lib/estimate/deck-commercial-2b";
import { adaptPricedMaterialRequirementWithoutLegacy } from "@/lib/estimate/requirement-commercial-line";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { shapeLabourHours } from "@/lib/estimate/labour-hours";
import { getDeckMaterialLabel } from "@/lib/estimate/material-rate-keys";
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
  "deck.balustrade_required",
  "deck.has_balustrade",
  "deck.handrail_required",
  "deck.engineering_or_consent_status",
  "deck.pile_or_post_replacement_required",
  "deck.pile_or_post_count",
  "deck.substructure_condition",
  "deck.vertical_face_boards_required",
  "deck.vertical_face_board_length_lm",
  "deck.ground_clearance_m",
  "deck.fascia_material",
  "deck.step_count",
  "deck.step_width_m",
  "deck.step_going_m",
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
  const boardWidthMm = boardWidthFact ?? 140;
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
    ? "Decking materials"
    : "Decking materials package";
  const conversionNote = deckingPricing.resolution.conversionNote;
  const deckingNotes = usedLmPricing
    ? `${materialLabel} · ${boardWidthMm} mm boards · ${wastagePercent}% wastage${
        conversionNote ? ` · ${conversionNote}` : ""
      }`
    : deckingBoardResult
      ? `Package allowance (${materialLabel}). Physical takeoff ${deckingBoardResult.totalLm} lm is not the priced quantity.`
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
      qualityFactor,
      ...deckingPricing.rateFields,
    }),
    deckingBuildUp
  );

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
  const pilesCommerciallyReady =
    supportReq?.priced === true &&
    supportReq.purchaseQuantity > 0 &&
    (supportReq.purchaseUnit === "lm"
      ? structural.quantities?.postProcurementOk === true
      : true);
  const substructureAuthority = decideDeckSubstructureAuthority({
    substructureIncluded,
    joistsPriced: joistReq?.priced === true,
    bearersPriced: bearerReq?.priced === true,
    rimPriced: rimReq?.priced === true,
    postsPriced: pilesCommerciallyReady,
  });

  const deckingInstallProductivity = resolveProductivity({
    productivityKey: "deck.decking.install.hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 0.55,
    rates: context.rates,
  });
  const substructureInstallProductivity = resolveProductivity({
    productivityKey: "deck.substructure.install.hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 0.52,
    rates: context.rates,
  });
  const postsInstallProductivity = resolveProductivity({
    productivityKey: "deck.posts.install.hours_per_ea",
    unit: "ea",
    fallbackHoursPerUnit: 0.2,
    rates: context.rates,
  });
  const supportCount = structural.quantities?.supportCount ?? 0;
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
    qualityFactor,
  });

  if (labourAuthority.mode === "DETAILED_AUTHORITATIVE") {
    const deckingHours = shapeLabourHours({
      quantity: effectiveArea,
      productivityHoursPerUnit: deckingInstallProductivity.hoursPerUnit,
      adjustmentFactor: labourAdjustment,
      qualityFactor,
    });
    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Decking installation",
        quantity: effectiveArea,
        unit: "m²",
        productivityHoursPerUnit: deckingInstallProductivity.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        qualityFactor,
        notes: `Physical driver: deck area. Productivity: ${deckingInstallProductivity.hoursPerUnit} h/m² · ${deckingInstallProductivity.sourceLabel}${constraintNotes ? ` · ${constraintNotes}` : ""}`,
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
        quantity: effectiveArea,
        productivityHoursPerUnit: substructureInstallProductivity.hoursPerUnit,
        adjustmentFactor: labourAdjustment,
        qualityFactor,
      });
      lineItems.push(
        createLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Substructure framing",
          quantity: effectiveArea,
          unit: "m²",
          productivityHoursPerUnit: substructureInstallProductivity.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          adjustmentFactor: labourAdjustment,
          qualityFactor,
          notes: `Physical driver: deck area. Excludes pile/post install. Productivity: ${substructureInstallProductivity.hoursPerUnit} h/m² · ${substructureInstallProductivity.sourceLabel}`,
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
        qualityFactor,
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
          qualityFactor,
          notes: `Physical driver: ${supportCount} supports. Productivity: ${postsInstallProductivity.hoursPerUnit} h/ea · ${postsInstallProductivity.sourceLabel}`,
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
        qualityFactor,
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
          qualityFactor,
          notes: `Separate extra on top of the base split. Productivity: ${elevatedProductivity.hoursPerUnit} h/m² · ${elevatedProductivity.sourceLabel}`,
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
      qualityFactor,
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
        qualityFactor,
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
        if (!row.req || !row.req.priced) continue;
        const adapted = adaptPricedMaterialRequirementWithoutLegacy({
          requirement: row.req,
          workAreaName: workArea.name,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          label: row.label,
        });
        lineItems.push({
          ...adapted,
          notes: [
            row.req.specification,
            `Identity: ${row.req.materialKey ?? row.req.description}`,
            `Purchase ${row.req.purchaseQuantity} ${row.req.purchaseUnit}`,
            `Rate: ${row.req.rateSource}${row.req.rateEvidence?.sourceName ? ` · ${row.req.rateEvidence.sourceName}` : ""}`,
          ]
            .filter(Boolean)
            .join(" · "),
        });
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
          qualityFactor,
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

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: DECK_FIXINGS_RESIDUAL_LABEL,
      category: "materials",
      quantity: effectiveArea,
      unit: "m²",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
      ...rateFieldsFromResolved(fixingsRates),
    })
  );

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
        qualityFactor: NO_FINISH_QUALITY_FACTOR,
        notes: `Productivity: ${demoProductivity.hoursPerUnit} hrs/m²`,
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

  if (!hasExternalStairs) {
    const accessLower = accessType?.toLowerCase() ?? "";
    if (
      accessLower.includes("stair set") ||
      (legacyStairs === true && !accessType)
    ) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Stair set allowance",
          recommendedCost: DECK_BENCHMARKS.stairsAllowance.cost,
          recommendedSell: DECK_BENCHMARKS.stairsAllowance.sell,
          ...benchmarkRateFields(),
          notes: "External stair set allowance included with deck.",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
      if (deckHeight !== null && deckHeight > 1) {
        assumptions.push(
          "Final stair design, handrail and consent requirements are subject to confirmation."
        );
      }
    } else if (accessLower.includes("multiple")) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Multi-side step-down allowance",
          recommendedCost: DECK_BENCHMARKS.multiSideStairsAllowance.cost,
          recommendedSell: DECK_BENCHMARKS.multiSideStairsAllowance.sell,
          ...benchmarkRateFields(),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    } else if (accessLower.includes("single step")) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Step-down allowance",
          recommendedCost: DECK_BENCHMARKS.stepAllowance.cost,
          recommendedSell: DECK_BENCHMARKS.stepAllowance.sell,
          ...benchmarkRateFields(),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
  }

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

  const pileReplacement = getBooleanFact(
    facts,
    workArea.id,
    "deck.pile_or_post_replacement_required"
  );
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
  } else if (pileReplacement === null) {
    assumptions.push(
      "Existing substructure condition is subject to confirmation."
    );
  }

  if (
    substructureCondition?.includes("partial") ||
    substructureCondition?.includes("full")
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

  const fasciaRequired = getBooleanFact(
    facts,
    workArea.id,
    "deck.vertical_face_boards_required"
  );
  if (fasciaRequired == null) {
    assumptions.push("No fascia included unless confirmed.");
  }

  if (fasciaRequired === true) {
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
    const faceLm = fasciaQty.fasciaPurchaseLm;
    assumptions.push(
      fasciaQty.heightModelApplied
        ? `Fascia coverage uses deck height minus ${fasciaQty.groundGapM * 1000} mm ground gap and ${fasciaQty.boardFaceM * 1000} mm board face (${round2(fasciaQty.boardHeightEquivalents)} board-height equivalents). Estimating quantity only.`
        : "Fascia uses edge length only because deck height is not confirmed."
    );
    const fasciaProductivity = resolveProductivity({
      productivityKey: "deck.fascia.install.hours_per_lm",
      unit: "lm",
      fallbackHoursPerUnit: 0.45,
      rates: context.rates,
    });
    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Vertical face/fascia boards",
        category: "materials",
        quantity: faceLm,
        unit: "lm",
        costRate: DECK_BENCHMARKS.faceBoardLm.cost,
        sellRate: DECK_BENCHMARKS.faceBoardLm.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
        componentKey: "deck.fascia",
      })
    );
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
          qualityFactor,
          notes: `Physical driver: installed fascia lm. Productivity: ${fasciaProductivity.hoursPerUnit} h/lm · ${fasciaProductivity.sourceLabel}`,
          sortOrder: sortOrder++,
          componentKey: "deck.fascia.install",
          organisationSettings: context.organisationSettings,
          ...rateFieldsFromResolved(labourRate),
        })
      );
    } else {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Face board labour allowance",
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

  const stepReqs = [];
  if (deckStepsIncluded({ accessType, hasStairs: legacyStairs })) {
    const steps = calculateDeckStepsQuantities({
      facts,
      workAreaId: workArea.id,
      deckHeightM: deckHeight,
      wastePercent: wastagePercent,
    });
    if (steps) {
      assumptions.push(
        `Steps estimated as ${steps.riseCount} rises (${steps.estimatedRiserM} m). Estimating layout only — not stair compliance.`
      );
      const stepFramingIdentity = defaultStepFramingIdentity();
      stepReqs.push(
        buildMaterialRequirement({
          workAreaId: workArea.id,
          workAreaType: workArea.type,
          componentKey: "deck.steps.treads",
          description: "Step tread decking (inherits deck board material)",
          confidence: "medium",
          assumptions: [
            {
              key: "deck.steps.treads",
              text: "Tread surfaces follow estimated rise count. Vertical faces stay in Fascia.",
              source: "calculator_default",
            },
          ],
          provenance: {
            calculatorSource: "deck.steps.treads",
            factKeys: ["deck.height_m", "deck.access_type"],
            constraintKeys: [],
          },
          priced: false,
          materialKey: null,
          category: "FINISH",
          baseQuantity: steps.treadAreaM2,
          baseUnit: "m2",
          wasteFactor: wastagePercent / 100,
          purchaseQuantity: round2(
            steps.treadAreaM2 * (1 + wastagePercent / 100)
          ),
          purchaseUnit: "m2",
          rateSource: "missing",
          unitCost: null,
          totalCost: null,
        }),
        buildMaterialRequirement({
          workAreaId: workArea.id,
          workAreaType: workArea.type,
          componentKey: "deck.steps.framing",
          description: "Step box framing 190x45 H3.2 (estimating assumption)",
          confidence: "medium",
          assumptions: [
            {
              key: "deck.steps.framing",
              text: "Each rise modelled as a framed box with internals at 450 mm centres. Not stringer engineering.",
              source: "calculator_default",
            },
          ],
          provenance: {
            calculatorSource: "deck.steps.framing",
            factKeys: ["deck.height_m", "deck.access_type"],
            constraintKeys: [],
          },
          priced: false,
          materialKey: stepFramingIdentity
            ? `${stepFramingIdentity.family}.${stepFramingIdentity.productFamily}.${stepFramingIdentity.section}`
            : null,
          materialIdentity: stepFramingIdentity ?? undefined,
          category: "FRAMING",
          specification: "190x45 H3.2",
          baseQuantity: steps.framingNetLm,
          baseUnit: "lm",
          wasteFactor: wastagePercent / 100,
          purchaseQuantity: steps.framingPurchaseLm,
          purchaseUnit: "lm",
          rateSource: "missing",
          unitCost: null,
          totalCost: null,
        })
      );
    }
  }

  const requirements = [
    surfaceRequirement,
    labourRequirement,
    ...structural.requirements,
    ...stepReqs,
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
