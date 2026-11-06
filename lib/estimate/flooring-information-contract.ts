/**
 * FLOORING-02 — declarative information contract.
 *
 * Ask class vs contextual relevance. Canonical source for Details,
 * Ready, and Refine ownership. Location never blocks Ready.
 */

import type { ClarifyAskClass } from "@/lib/assistant/clarify/types";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  findFlooringPortion,
  flooringAreaMeasuresDisagree,
  flooringFinishUsesHardwoodWidth,
  flooringFinishUsesOtherDescription,
  flooringFinishUsesPreparation,
  flooringFinishUsesTileDimensions,
  flooringFinishUsesUnderlay,
  resolveFlooringPortions,
  type FlooringPortion,
} from "@/lib/estimate/flooring-portions";

export type FlooringInformationContractRow = {
  readonly factKey: string;
  readonly askClass: ClarifyAskClass;
  readonly calculatorConsumed: boolean;
  readonly reason: string;
};

export type FlooringInformationContext = {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly nestedItemId?: string | null;
  readonly portion?: FlooringPortion | null;
};

export const FLOORING_INFORMATION_CONTRACT: readonly FlooringInformationContractRow[] =
  [
    {
      factKey: "flooring.portion.finish_type",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Finish type selects the ordinary vs specialist path.",
    },
    {
      factKey: "flooring.portion.label",
      askClass: "ASSUME_IF_SKIPPED",
      calculatorConsumed: false,
      reason: "Location is optional and must not block Ready.",
    },
    {
      factKey: "flooring.portion.area_input_method",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Area method chooses direct m² or length × width.",
    },
    {
      factKey: "flooring.portion.area_m2",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Direct floor area is required when that method is used.",
    },
    {
      factKey: "flooring.portion.length_m",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Length is required when dimensions are used.",
    },
    {
      factKey: "flooring.portion.width_m",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Width is required when dimensions are used.",
    },
    {
      factKey: "flooring.portion.underlay_required",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Carpet underlay Yes/No is required.",
    },
    {
      factKey: "flooring.portion.floor_preparation_required",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Vinyl/tile floor preparation Yes/No is required.",
    },
    {
      factKey: "flooring.portion.finish_pricing",
      askClass: "ASSUME_IF_SKIPPED",
      calculatorConsumed: true,
      reason:
        "Chooses the combined supply-and-install package or separate finish supply. Unanswered uses the combined package and does not add a material rate on top. It does not mean requested waste is included.",
    },
    {
      factKey: "flooring.portion.waste_treatment",
      askClass: "ASSUME_IF_SKIPPED",
      calculatorConsumed: true,
      reason:
        "Requested waste stays unresolved on a combined package until the package is confirmed to cover it or only the extra quantity is charged at a known material rate.",
    },
    {
      factKey: "flooring.portion.tile_width_mm",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Tile width is required for tile floors.",
    },
    {
      factKey: "flooring.portion.tile_length_mm",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Tile length is required for tile floors.",
    },
    {
      factKey: "flooring.portion.hardwood_board_width_mm",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Board width is required for hardwood/timber.",
    },
    {
      factKey: "flooring.portion.other_description",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Other/custom and specialist floors keep a specification note.",
    },
    {
      factKey: "flooring.portion.laminate_method",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason:
        "Only floating click-lock laminate is priced. An unstated method is asked, not stored as an extracted fact.",
    },
    {
      factKey: "flooring.portion.laminate_substrate",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Floating laminate needs the existing substrate before a moisture line can be decided.",
    },
    {
      factKey: "flooring.portion.laminate_moisture",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason:
        "On concrete, moisture control is asked. An underlay is not assumed to include it, and it is not added twice.",
    },
    {
      factKey: "flooring.portion.laminate_package_covers_underlay",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason:
        "A combined laminate package covers the underlay only when that is confirmed. The subcontract rate itself is not that confirmation.",
    },
    {
      factKey: "flooring.portion.laminate_package_covers_moisture",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason:
        "A combined laminate package covers a separate moisture barrier only when that is confirmed. The subcontract rate itself is not that confirmation.",
    },
    {
      factKey: "flooring.portion.carpet_tile_pattern",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Only straight-lay carpet tiles are priced. An unstated pattern is asked, not stored as an extracted fact.",
    },
    {
      factKey: "flooring.portion.carpet_tile_substrate",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "This recipe prices carpet tiles on a ready substrate. Removal already completed is not that answer.",
    },
    {
      factKey: "flooring.portion.carpet_tile_waste",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "An unstated waste percentage is not applied and is not treated as zero.",
    },
    {
      factKey: "flooring.portion.carpet_tile_waste_percent",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "A custom supply allowance is a percentage on carpet tile supply only.",
    },
    {
      factKey: "flooring.portion.carpet_tile_size",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Tile dimensions are used only when known. Unknown does not invent a count.",
    },
    {
      factKey: "flooring.portion.carpet_tile_box",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Whole boxes are used only when coverage is known.",
    },
    {
      factKey: "flooring.portion.carpet_tile_box_coverage_m2",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Box coverage is not invented.",
    },
    {
      factKey: "flooring.portion.carpet_tile_fixing",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Adhesive or tackifier is asked. Carpet underlay is not added.",
    },
    {
      factKey: "flooring.portion.carpet_tile_supply",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Customer-supplied tiles stay visible at no contractor purchasing cost.",
    },
    {
      factKey: "flooring.portion.carpet_tile_package_covers_fixing",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "A combined package covers fixing only when that is confirmed.",
    },
    {
      factKey: "flooring.portion.substrate_required",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "New substrate Yes/No is required for ordinary floors.",
    },
    {
      factKey: "flooring.portion.substrate_family",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Substrate family is required when a new substrate is included.",
    },
    {
      factKey: "flooring.portion.substrate_item_key",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Exact substrate product is required when a new substrate is included.",
    },
    {
      factKey: "flooring.portion.framing_required",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "New framing Yes/No is required for ordinary floors.",
    },
    {
      factKey: "flooring.portion.framing_allowance_level",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Framing allowance level is required when framing is Yes.",
    },
    {
      factKey: "flooring.portion.finish_removal_required",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Existing finish removal Yes/No is required for ordinary floors.",
    },
    {
      factKey: "flooring.portion.existing_finish_type",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Existing finish type is required when removal is Yes.",
    },
    {
      factKey: "flooring.portion.substrate_removal_required",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Substrate removal Yes/No is required when finish removal is Yes.",
    },
  ];

export function lookupFlooringInformationContract(
  factKey: string
): FlooringInformationContractRow | null {
  return (
    FLOORING_INFORMATION_CONTRACT.find((row) => row.factKey === factKey) ?? null
  );
}

export function flooringFactQuestionClass(
  factKey: string
): ClarifyAskClass | null {
  return lookupFlooringInformationContract(factKey)?.askClass ?? null;
}

export function flooringPortionIsSpecialist(
  portion: FlooringPortion | null | undefined
): boolean {
  return portion?.specialist_kind != null;
}

function areaMethodOf(portion: FlooringPortion | null | undefined): string | null {
  if (!portion) return null;
  if (flooringAreaMeasuresDisagree(portion)) return null;
  if (portion.area_input_method) return portion.area_input_method;
  if (portion.area_m2 != null) return "direct_m2";
  if (portion.length_m != null && portion.width_m != null) return "length_width";
  return null;
}

export function flooringFactIsRelevant(
  factKey: string,
  ctx: FlooringInformationContext
): boolean {
  const portion =
    ctx.portion ??
    findFlooringPortion(
      resolveFlooringPortions({
        facts: ctx.facts,
        workAreaId: ctx.workAreaId,
      }).portions,
      ctx.nestedItemId
    );
  const specialist = flooringPortionIsSpecialist(portion);
  const finish = portion?.finish_type ?? null;
  const method = areaMethodOf(portion);

  if (factKey === "flooring.portion.finish_type") return true;
  if (factKey === "flooring.portion.label") return true;

  if (factKey === "flooring.portion.area_input_method") {
    return method == null;
  }
  if (factKey === "flooring.portion.area_m2") {
    return method === "direct_m2";
  }
  if (factKey === "flooring.portion.length_m" || factKey === "flooring.portion.width_m") {
    return method === "length_width";
  }

  if (factKey === "flooring.portion.other_description") {
    return flooringFinishUsesOtherDescription(finish) || specialist;
  }
  if (factKey === "flooring.portion.underlay_required") {
    return flooringFinishUsesUnderlay(finish);
  }
  if (factKey === "flooring.portion.floor_preparation_required") {
    return flooringFinishUsesPreparation(finish);
  }
  if (factKey === "flooring.portion.laminate_method") {
    return portion?.specialist_kind === "laminate";
  }
  if (factKey === "flooring.portion.laminate_substrate") {
    return (
      portion?.specialist_kind === "laminate" &&
      portion.laminate_method === "floating_click_lock"
    );
  }
  if (factKey === "flooring.portion.laminate_moisture") {
    return (
      portion?.specialist_kind === "laminate" &&
      portion.laminate_method === "floating_click_lock" &&
      portion.laminate_substrate === "concrete"
    );
  }
  if (factKey === "flooring.portion.laminate_package_covers_underlay") {
    return (
      portion?.specialist_kind === "laminate" &&
      portion.laminate_method === "floating_click_lock" &&
      portion.finish_pricing === "combined_package" &&
      portion.finish_supplied_by !== "customer" &&
      portion.underlay_required === true
    );
  }
  if (factKey === "flooring.portion.laminate_package_covers_moisture") {
    return (
      portion?.specialist_kind === "laminate" &&
      portion.laminate_method === "floating_click_lock" &&
      portion.finish_pricing === "combined_package" &&
      portion.finish_supplied_by !== "customer" &&
      portion.laminate_substrate === "concrete" &&
      portion.laminate_moisture === "separate"
    );
  }
  const carpet = portion?.specialist_kind === "carpet_tile";
  const straight = carpet && portion?.carpet_tile_pattern === "straight";
  // Preparation stays its own unresolved task. It does not hide the finish questions.
  const finishSubstrate =
    straight &&
    (portion?.carpet_tile_substrate === "ready" ||
      portion?.carpet_tile_substrate === "preparation");
  const wasteDecided =
    finishSubstrate &&
    portion?.carpet_tile_waste != null &&
    (portion.carpet_tile_waste !== "custom" ||
      (portion.waste_percent != null && portion.waste_percent > 0));
  const sizeAnswered = wasteDecided && portion?.carpet_tile_size != null;
  const boxAnswered = sizeAnswered && portion?.carpet_tile_box != null;
  const fixingAnswered =
    boxAnswered &&
    (portion?.carpet_tile_fixing === "adhesive" ||
      portion?.carpet_tile_fixing === "tackifier" ||
      portion?.carpet_tile_fixing === "none");
  if (factKey === "flooring.portion.carpet_tile_pattern") return Boolean(carpet);
  if (factKey === "flooring.portion.carpet_tile_substrate") return Boolean(straight);
  if (factKey === "flooring.portion.carpet_tile_waste") return Boolean(finishSubstrate);
  if (factKey === "flooring.portion.carpet_tile_waste_percent") {
    return Boolean(finishSubstrate && portion?.carpet_tile_waste === "custom");
  }
  if (factKey === "flooring.portion.carpet_tile_size") return Boolean(wasteDecided);
  if (factKey === "flooring.portion.carpet_tile_box") return Boolean(sizeAnswered);
  if (factKey === "flooring.portion.carpet_tile_box_coverage_m2") {
    return Boolean(sizeAnswered && portion?.carpet_tile_box === "known");
  }
  if (factKey === "flooring.portion.carpet_tile_fixing") return Boolean(boxAnswered);
  if (factKey === "flooring.portion.carpet_tile_supply") return Boolean(fixingAnswered);
  if (factKey === "flooring.portion.carpet_tile_package_covers_fixing") {
    return Boolean(
      fixingAnswered &&
        portion?.finish_supplied_by === "contractor" &&
        portion.finish_pricing === "combined_package" &&
        (portion.carpet_tile_fixing === "adhesive" || portion.carpet_tile_fixing === "tackifier")
    );
  }
  if (factKey === "flooring.portion.finish_pricing") {
    return (
      finish === "carpet" ||
      finish === "vinyl_plank" ||
      finish === "tile" ||
      finish === "hardwood" ||
      (portion?.specialist_kind === "laminate" &&
        portion.laminate_method === "floating_click_lock" &&
        portion.laminate_substrate != null &&
        (portion.laminate_substrate !== "concrete" ||
          portion.laminate_moisture != null)) ||
      (portion?.specialist_kind === "carpet_tile" &&
        portion.finish_supplied_by === "contractor")
    );
  }
  if (factKey === "flooring.portion.waste_treatment") {
    const ordinary =
      finish === "carpet" ||
      finish === "vinyl_plank" ||
      finish === "tile" ||
      finish === "hardwood";
    const laminateCombined =
      portion?.specialist_kind === "laminate" &&
      portion.finish_pricing === "combined_package";
    const carpetCombined =
      portion?.specialist_kind === "carpet_tile" &&
      portion.finish_pricing === "combined_package" &&
      portion.finish_supplied_by !== "customer";
    return (
      (ordinary || laminateCombined || carpetCombined) &&
      portion?.waste_percent != null &&
      portion.waste_percent > 0 &&
      portion.finish_supplied_by !== "customer" &&
      portion.finish_pricing !== "separate_supply"
    );
  }
  if (
    factKey === "flooring.portion.tile_width_mm" ||
    factKey === "flooring.portion.tile_length_mm"
  ) {
    return (
      flooringFinishUsesTileDimensions(finish) ||
      (portion?.specialist_kind === "carpet_tile" && portion.carpet_tile_size === "known")
    );
  }
  if (factKey === "flooring.portion.hardwood_board_width_mm") {
    return flooringFinishUsesHardwoodWidth(finish);
  }

  if (specialist) return false;

  if (factKey === "flooring.portion.substrate_required") return true;
  if (factKey === "flooring.portion.substrate_family") {
    return portion?.substrate_required === true;
  }
  if (factKey === "flooring.portion.substrate_item_key") {
    return (
      portion?.substrate_required === true && portion.substrate_family != null
    );
  }
  if (factKey === "flooring.portion.framing_required") return true;
  if (factKey === "flooring.portion.framing_allowance_level") {
    return portion?.framing_required === true;
  }
  if (factKey === "flooring.portion.finish_removal_required") return true;
  if (
    factKey === "flooring.portion.existing_finish_type" ||
    factKey === "flooring.portion.substrate_removal_required"
  ) {
    return portion?.finish_removal_required === true;
  }
  return lookupFlooringInformationContract(factKey) != null;
}

export function flooringDetailsSectionId(factKey: string): "details" {
  void factKey;
  return "details";
}

export const FLOORING_CONTRACT_FACT_ORDER = new Map(
  FLOORING_INFORMATION_CONTRACT.map((row, index) => [row.factKey, index])
);
