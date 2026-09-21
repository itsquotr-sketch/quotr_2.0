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
  if (
    factKey === "flooring.portion.tile_width_mm" ||
    factKey === "flooring.portion.tile_length_mm"
  ) {
    return flooringFinishUsesTileDimensions(finish);
  }
  if (factKey === "flooring.portion.hardwood_board_width_mm") {
    return flooringFinishUsesHardwoodWidth(finish);
  }

  if (specialist) return false;

  if (factKey === "flooring.portion.substrate_required") return true;
  if (
    factKey === "flooring.portion.substrate_family" ||
    factKey === "flooring.portion.substrate_item_key"
  ) {
    return portion?.substrate_required === true;
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
