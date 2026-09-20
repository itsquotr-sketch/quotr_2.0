/**
 * DOORS-02 — contract-driven Details / Ready candidates for Door Sets.
 */

import type { ClarifyAskClass, ClarifyCandidate } from "@/lib/assistant/clarify/types";
import type { NestedItemPanel } from "@/lib/assistant/clarify/types";
import {
  questionPresentationId,
  doorPortionQuestionIdentity,
} from "@/lib/assistant/question-identity";
import { safeFactPresentationLabel } from "@/lib/assistant/presentation/fact-key-labels";
import {
  DOORS_HEIGHT_DISCLOSED_DEFAULT_MM,
  DOORS_HEIGHT_DISCLOSED_DEFAULT_STATEMENT,
  doorPortionIsUnsupported,
  findDoorPortion,
  isDoorsNestedFactKey,
  resolveDoorsPortions,
  DOORS_ADD_PORTION_KEY,
  DOORS_DELETE_PORTION_KEY,
  DOORS_DUPLICATE_PORTION_KEY,
  type DoorPortion,
} from "@/lib/estimate/doors-portions";
import {
  DOORS_INFORMATION_CONTRACT,
  doorsFactIsRelevant,
  type DoorsInformationContext,
} from "@/lib/estimate/doors-information-contract";
import {
  DOORS_REPLACEMENT_FRAME_DISCLOSURE,
  doorQuestionCopy,
  doorQuestionInputType,
  doorQuestionLabel,
  doorQuestionOptions,
  doorQuestionUnit,
} from "@/lib/estimate/doors-question-copy";
import type { EstimateFact } from "@/lib/estimate/types";

export type DoorsClarifyInput = {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly workAreaName: string;
  readonly briefText?: string | null;
};

function isResolved(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return false;
}

export function doorPortionFieldCurrentValue(
  portion: DoorPortion | null,
  factKey: string
): string | number | boolean | null {
  if (!portion) return null;
  const field = factKey.slice("doors.portion.".length);
  if (field === "installation_type") {
    if (portion.installation_type === "prehung_internal") {
      return "Prehung door set";
    }
    if (portion.installation_type === "replacement_leaf") {
      return "Replacement door leaf";
    }
    if (portion.installation_type === "other_unsupported") {
      return "Other door system";
    }
    return null;
  }
  if (field === "leaf_construction") {
    if (portion.leaf_construction === "hollow_core") return "Hollow core";
    if (portion.leaf_construction === "solid_core") return "Solid core";
    if (portion.leaf_construction === "other") return "Other";
    return null;
  }
  if (field === "height_mm") {
    if (portion.height_mm == null) return null;
    if (
      portion.height_mm === DOORS_HEIGHT_DISCLOSED_DEFAULT_MM &&
      portion.height_authority === "assumed_disclosed"
    ) {
      return "1980 mm (assumed default)";
    }
    return `${portion.height_mm} mm`;
  }
  if (field === "width_mm") {
    return portion.width_mm != null ? `${portion.width_mm} mm` : null;
  }
  if (field === "quantity") return portion.quantity;
  if (field === "hardware_included") {
    if (portion.hardware_included === true) return "Included";
    if (portion.hardware_included === false) return "Excluded / reuse existing";
    return null;
  }
  if (field === "label") return portion.label;
  if (field === "other_description") return portion.other_description;
  return null;
}

function portionDisplayName(portion: DoorPortion, index: number): string {
  if (portion.label?.trim()) return portion.label.trim();
  return `Door set ${index + 1}`;
}

function heightIsDisclosedDefault(portion: DoorPortion | null): boolean {
  return (
    portion?.height_mm === DOORS_HEIGHT_DISCLOSED_DEFAULT_MM &&
    portion.height_authority === "assumed_disclosed"
  );
}

function shouldEmitHeight(portion: DoorPortion | null): boolean {
  if (!portion) return true;
  if (heightIsDisclosedDefault(portion)) return true;
  return !isResolved(doorPortionFieldCurrentValue(portion, "doors.portion.height_mm"));
}

export function doorPortionIsInformationComplete(portion: DoorPortion): boolean {
  if (doorPortionIsUnsupported(portion)) {
    return (
      Boolean(portion.other_description?.trim()) &&
      portion.quantity != null &&
      portion.quantity >= 1
    );
  }
  if (
    portion.installation_type !== "prehung_internal" &&
    portion.installation_type !== "replacement_leaf"
  ) {
    return false;
  }
  if (portion.leaf_construction == null) return false;
  if (portion.leaf_construction === "other" && !portion.other_description?.trim()) {
    return false;
  }
  if (portion.height_mm == null) return false;
  if (portion.width_mm == null) return false;
  if (portion.quantity == null || portion.quantity < 1) return false;
  if (portion.hardware_included == null) return false;
  return true;
}

export function doorPortionMaterialPricingRequired(
  portion: DoorPortion
): boolean {
  if (doorPortionIsUnsupported(portion)) return true;
  return portion.leaf_construction === "other";
}

function leafLine(portion: DoorPortion): string {
  if (portion.leaf_construction === "hollow_core") return "hollow-core";
  if (portion.leaf_construction === "solid_core") return "solid-core";
  if (portion.leaf_construction === "other") return "other";
  return "";
}

function installLine(portion: DoorPortion): string {
  if (portion.installation_type === "prehung_internal") {
    return "prehung internal doors";
  }
  if (portion.installation_type === "replacement_leaf") {
    return "replacement leaf";
  }
  return "door system";
}

export function summariseDoorPortion(
  portion: DoorPortion,
  index: number
): {
  readonly id: string;
  readonly displayName: string;
  readonly summary: string;
  readonly complete: boolean;
  readonly specialistRequired: boolean;
} {
  const qty = portion.quantity ?? "?";
  const height = portion.height_mm ?? "?";
  const width = portion.width_mm ?? "?";
  if (doorPortionIsUnsupported(portion)) {
    const desc = portion.other_description?.trim() || "Specialist door system";
    return {
      id: portion.id,
      displayName: portionDisplayName(portion, index),
      summary: `${qty} × specialist / unsupported · ${desc}`,
      complete: doorPortionIsInformationComplete(portion),
      specialistRequired: true,
    };
  }
  const leaf = leafLine(portion);
  const install = installLine(portion);
  const size = `${qty} × ${height} × ${width} mm`;
  const core = [size, leaf, install].filter(Boolean).join(" ");
  const hardware =
    portion.hardware_included === true
      ? "Standard latch/lever hardware included"
      : portion.hardware_included === false
        ? portion.installation_type === "replacement_leaf"
          ? "Existing frame retained · existing hardware reused"
          : "No new hardware allowance"
        : null;
  const frame =
    portion.installation_type === "replacement_leaf" &&
    portion.hardware_included !== false
      ? "Existing frame retained"
      : null;
  return {
    id: portion.id,
    displayName: portionDisplayName(portion, index),
    summary: [core, hardware, frame].filter(Boolean).join(" · "),
    complete: doorPortionIsInformationComplete(portion),
    specialistRequired: doorPortionMaterialPricingRequired(portion),
  };
}

function buildCandidate(params: {
  input: DoorsClarifyInput;
  portion: DoorPortion | null;
  portionIndex: number;
  factKey: string;
  askClass: ClarifyAskClass;
}): ClarifyCandidate {
  const displayName = params.portion
    ? portionDisplayName(params.portion, params.portionIndex)
    : params.input.workAreaName;
  const unsupported = params.portion
    ? doorPortionIsUnsupported(params.portion)
    : false;
  const currentValue = doorPortionFieldCurrentValue(
    params.portion,
    params.factKey
  );
  const disclosedHeight = heightIsDisclosedDefault(params.portion);
  const askClass =
    params.factKey === "doors.portion.height_mm" && disclosedHeight
      ? "ASSUME_IF_SKIPPED"
      : params.askClass;
  const rankBase =
    askClass === "HARD_MINIMUM" ? 1000 : askClass === "ASK_NOW" ? 80 : 40;
  const contractIndex = DOORS_INFORMATION_CONTRACT.findIndex(
    (row) => row.factKey === params.factKey
  );
  let assumptionStatement: string | null = null;
  if (params.factKey === "doors.portion.height_mm" && disclosedHeight) {
    assumptionStatement = DOORS_HEIGHT_DISCLOSED_DEFAULT_STATEMENT;
  }
  if (
    params.portion?.installation_type === "replacement_leaf" &&
    (params.factKey === "doors.portion.installation_type" ||
      params.factKey === "doors.portion.leaf_construction" ||
      params.factKey === "doors.portion.height_mm" ||
      params.factKey === "doors.portion.width_mm" ||
      params.factKey === "doors.portion.quantity" ||
      params.factKey === "doors.portion.hardware_included")
  ) {
    assumptionStatement =
      assumptionStatement ?? DOORS_REPLACEMENT_FRAME_DISCLOSURE;
  }
  return {
    id:
      questionPresentationId(
        askClass === "HARD_MINIMUM" ? "hard" : "fact",
        doorPortionQuestionIdentity({
          workAreaId: params.input.workAreaId,
          factKey: params.factKey,
          nestedItemId: params.portion?.id,
        })
      ) ??
      `${askClass === "HARD_MINIMUM" ? "hard" : "fact"}:${params.input.workAreaId}:${params.factKey}`,
    source: "scope_fact",
    workAreaId: params.input.workAreaId,
    workAreaName: params.input.workAreaName,
    workAreaType: "doors",
    factKey: params.factKey,
    constraintKey: null,
    questionKey: params.factKey,
    label: params.portion
      ? `${displayName} · ${doorQuestionLabel(params.factKey) ?? safeFactPresentationLabel(params.factKey)}`
      : doorQuestionLabel(params.factKey) ??
        safeFactPresentationLabel(params.factKey),
    question: doorQuestionCopy(params.factKey, {
      unsupported,
      otherLeaf: params.portion?.leaf_construction === "other",
    }),
    askClass,
    inputType: doorQuestionInputType(params.factKey),
    unit: doorQuestionUnit(params.factKey),
    options: doorQuestionOptions(params.factKey),
    currentValue,
    writeTarget: "FACT",
    write: null,
    blocksEstimate: askClass === "HARD_MINIMUM",
    assumable: askClass === "ASSUME_IF_SKIPPED",
    rankScore: rankBase - contractIndex,
    rankReason: `${askClass} · doors contract`,
    assumptionStatement,
    nestedItemId: params.portion?.id ?? null,
  };
}

export function doorNestedFactCurrentValue(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly factKey: string;
  readonly nestedItemId?: string | null;
}): string | number | boolean | null {
  if (!isDoorsNestedFactKey(params.factKey)) return null;
  const resolved = resolveDoorsPortions({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  const portion =
    findDoorPortion(resolved.portions, params.nestedItemId) ??
    resolved.portions[0] ??
    null;
  return doorPortionFieldCurrentValue(portion, params.factKey);
}

export function listDoorsClarifyCandidates(
  input: DoorsClarifyInput
): ClarifyCandidate[] {
  const resolved = resolveDoorsPortions({
    facts: input.facts,
    workAreaId: input.workAreaId,
  });
  const ctx: Omit<DoorsInformationContext, "portion" | "nestedItemId"> = {
    facts: input.facts,
    workAreaId: input.workAreaId,
  };
  const portions =
    resolved.portions.length > 0 ? resolved.portions : [null];
  const out: ClarifyCandidate[] = [];
  portions.forEach((portion, index) => {
    for (const row of DOORS_INFORMATION_CONTRACT) {
      if (row.askClass === "DERIVED_NEVER_ASK") continue;
      if (row.askClass === "REFINEMENT" || row.askClass === "ADVANCED") {
        continue;
      }
      if (
        !doorsFactIsRelevant(row.factKey, {
          ...ctx,
          portion,
          nestedItemId: portion?.id ?? null,
        })
      ) {
        continue;
      }
      if (row.factKey === "doors.portion.height_mm") {
        if (!shouldEmitHeight(portion)) continue;
      } else if (
        isResolved(doorPortionFieldCurrentValue(portion, row.factKey))
      ) {
        continue;
      }
      out.push(
        buildCandidate({
          input,
          portion,
          portionIndex: index,
          factKey: row.factKey,
          askClass: row.askClass,
        })
      );
    }
  });
  return out;
}

export function doorsWorkAreaIsReady(input: DoorsClarifyInput): boolean {
  const resolved = resolveDoorsPortions({
    facts: input.facts,
    workAreaId: input.workAreaId,
  });
  if (resolved.portions.length === 0) return false;
  return resolved.portions.every(doorPortionIsInformationComplete);
}

export function doorsNestedItemPanel(params: {
  readonly facts: readonly EstimateFact[];
  readonly workAreaId: string;
  readonly workAreaName: string;
}): NestedItemPanel | null {
  const resolved = resolveDoorsPortions({
    facts: params.facts,
    workAreaId: params.workAreaId,
  });
  return {
    workAreaId: params.workAreaId,
    workAreaType: "doors",
    workAreaName: params.workAreaName,
    itemKindLabel: "Door set",
    items: resolved.portions.map((portion, index) => {
      const summary = summariseDoorPortion(portion, index);
      return {
        id: portion.id,
        label: summary.displayName,
        complete: summary.complete,
        summary: summary.summary,
        specialistRequired: summary.specialistRequired,
      };
    }),
    addKey: DOORS_ADD_PORTION_KEY,
    duplicateKey: DOORS_DUPLICATE_PORTION_KEY,
    deleteKey: DOORS_DELETE_PORTION_KEY,
  };
}
