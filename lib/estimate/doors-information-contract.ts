/**
 * DOORS-02 — declarative information contract.
 *
 * Ask class vs contextual relevance. Canonical source for Details,
 * Ready, and Refine ownership.
 */

import type { ClarifyAskClass } from "@/lib/assistant/clarify/types";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  doorPortionIsUnsupported,
  findDoorPortion,
  resolveDoorsPortions,
  type DoorPortion,
} from "@/lib/estimate/doors-portions";

export type DoorsInformationContractRow = {
  readonly factKey: string;
  readonly askClass: ClarifyAskClass;
  readonly calculatorConsumed: boolean;
  readonly reason: string;
};

export type DoorsInformationContext = {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly nestedItemId?: string | null;
  readonly portion?: DoorPortion | null;
};

export const DOORS_INFORMATION_CONTRACT: readonly DoorsInformationContractRow[] =
  [
    {
      factKey: "doors.portion.installation_type",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Installation type selects the ordinary vs specialist path.",
    },
    {
      factKey: "doors.portion.leaf_construction",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Ordinary Door Sets need a leaf construction.",
    },
    {
      factKey: "doors.portion.other_description",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Other leaf or unsupported systems keep a specification note.",
    },
    {
      factKey: "doors.portion.height_mm",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Height is required; 1980 mm is a disclosed default.",
    },
    {
      factKey: "doors.portion.width_mm",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Width has no default and is required for ordinary Door Sets.",
    },
    {
      factKey: "doors.portion.quantity",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Quantity has no default and is required.",
    },
    {
      factKey: "doors.portion.hardware_included",
      askClass: "HARD_MINIMUM",
      calculatorConsumed: true,
      reason: "Hardware inclusion is required for ordinary Door Sets.",
    },
    {
      factKey: "doors.portion.label",
      askClass: "ASSUME_IF_SKIPPED",
      calculatorConsumed: false,
      reason: "Location is optional and must not block Ready.",
    },
  ];

export function lookupDoorsInformationContract(
  factKey: string
): DoorsInformationContractRow | null {
  return DOORS_INFORMATION_CONTRACT.find((row) => row.factKey === factKey) ?? null;
}

export function doorsFactQuestionClass(
  factKey: string
): ClarifyAskClass | null {
  return lookupDoorsInformationContract(factKey)?.askClass ?? null;
}

function isOrdinaryInstall(portion: DoorPortion | null | undefined): boolean {
  return (
    portion?.installation_type === "prehung_internal" ||
    portion?.installation_type === "replacement_leaf"
  );
}

export function doorsFactIsRelevant(
  factKey: string,
  ctx: DoorsInformationContext
): boolean {
  const portion =
    ctx.portion ??
    findDoorPortion(
      resolveDoorsPortions({
        facts: ctx.facts,
        workAreaId: ctx.workAreaId,
      }).portions,
      ctx.nestedItemId
    );
  const unsupported = doorPortionIsUnsupported(portion ?? createUnknown());
  const ordinary = isOrdinaryInstall(portion);
  const installUnknown = portion?.installation_type == null;

  if (factKey === "doors.portion.installation_type") return true;
  if (factKey === "doors.portion.label") return true;

  if (factKey === "doors.portion.leaf_construction") {
    return ordinary;
  }
  if (factKey === "doors.portion.hardware_included") {
    return ordinary;
  }
  if (factKey === "doors.portion.width_mm") {
    return ordinary;
  }
  if (factKey === "doors.portion.height_mm") {
    return ordinary || installUnknown;
  }
  if (factKey === "doors.portion.quantity") {
    return ordinary || unsupported;
  }
  if (factKey === "doors.portion.other_description") {
    if (unsupported) return true;
    if (ordinary && portion?.leaf_construction === "other") return true;
    return false;
  }
  return lookupDoorsInformationContract(factKey) != null;
}

function createUnknown(): DoorPortion {
  return {
    id: "",
    label: null,
    installation_type: null,
    leaf_construction: null,
    height_mm: null,
    width_mm: null,
    quantity: null,
    hardware_included: null,
    other_description: null,
    specialist_kind: null,
  };
}

export function doorsDetailsSectionId(factKey: string): "details" {
  void factKey;
  return "details";
}

export const DOORS_CONTRACT_FACT_ORDER = new Map(
  DOORS_INFORMATION_CONTRACT.map((row, index) => [row.factKey, index])
);
