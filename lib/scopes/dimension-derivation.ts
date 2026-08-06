/**
 * Deterministic dimension → quantity derivation (3.1B.6R3).
 * Improves inputs feeding estimates — does not change commercial formulas.
 *
 * Manual user override (source=user) wins until cleared.
 * Provenance uses existing project_facts.source — no migration.
 */

import {
  roundToTwoDecimals,
  toPositiveNumber,
} from "@/lib/scopes/fact-values";

export type DimensionDerivationPattern =
  | "length_x_width_area"
  | "width_x_height_area"
  | "count_x_unit_length"
  | "count_x_unit_area";

export type DimensionDerivationSpec = {
  readonly pattern: DimensionDerivationPattern;
  readonly workAreaType: string;
  readonly resultFactKey: string;
  readonly resultLabel: string;
  readonly resultUnit: string;
  readonly operandAKey: string;
  readonly operandALabel: string;
  readonly operandAUnit: string;
  readonly operandBKey: string;
  readonly operandBLabel: string;
  readonly operandBUnit: string;
};

export const DIMENSION_DERIVATION_SPECS: readonly DimensionDerivationSpec[] =
  Object.freeze([
    {
      pattern: "length_x_width_area",
      workAreaType: "deck",
      resultFactKey: "deck.area_m2",
      resultLabel: "Deck area",
      resultUnit: "m²",
      operandAKey: "deck.length_m",
      operandALabel: "Length",
      operandAUnit: "m",
      operandBKey: "deck.width_m",
      operandBLabel: "Width",
      operandBUnit: "m",
    },
    {
      pattern: "length_x_width_area",
      workAreaType: "pergola",
      resultFactKey: "pergola.area_m2",
      resultLabel: "Pergola area",
      resultUnit: "m²",
      operandAKey: "pergola.length_m",
      operandALabel: "Length",
      operandAUnit: "m",
      operandBKey: "pergola.width_m",
      operandBLabel: "Width",
      operandBUnit: "m",
    },
    {
      pattern: "width_x_height_area",
      workAreaType: "internal_walls",
      resultFactKey: "internal_walls.area_m2",
      resultLabel: "Wall lining area",
      resultUnit: "m²",
      operandAKey: "internal_walls.length_lm",
      operandALabel: "Length",
      operandAUnit: "m",
      operandBKey: "internal_walls.height_m",
      operandBLabel: "Height",
      operandBUnit: "m",
    },
  ]);

export type DerivationInput = {
  readonly a: number | null;
  readonly b: number | null;
  /** Existing result fact value when present. */
  readonly existingResult: number | null;
  readonly existingSource: string | null;
};

export type DerivationResult = {
  readonly ok: true;
  readonly value: number;
  readonly formulaText: string;
  readonly overridden: boolean;
  readonly calculatedValue: number;
  readonly displayValue: number;
  readonly canClearOverride: boolean;
} | {
  readonly ok: false;
  readonly reason: "missing" | "zero_operand" | "negative" | "invalid";
};

/**
 * Pure length×width (or width×height) derivation.
 * Missing ≠ zero. Negatives rejected. Zero operands rejected for area.
 */
export function deriveLengthTimesWidth(params: {
  readonly length: unknown;
  readonly width: unknown;
  readonly existingResult?: unknown;
  readonly existingSource?: string | null;
  readonly lengthLabel?: string;
  readonly widthLabel?: string;
  readonly resultUnit?: string;
}): DerivationResult {
  const length = toPositiveNumber(params.length);
  const width = toPositiveNumber(params.width);

  if (params.length === null || params.length === undefined || params.length === "") {
    if (params.width === null || params.width === undefined || params.width === "") {
      return { ok: false, reason: "missing" };
    }
  }
  if (length === null || width === null) {
    // Distinguish explicit zero from missing: toPositiveNumber treats 0 as null
    const rawL = Number(params.length);
    const rawW = Number(params.width);
    if (
      (params.length !== null &&
        params.length !== undefined &&
        params.length !== "" &&
        Number.isFinite(rawL) &&
        rawL < 0) ||
      (params.width !== null &&
        params.width !== undefined &&
        params.width !== "" &&
        Number.isFinite(rawW) &&
        rawW < 0)
    ) {
      return { ok: false, reason: "negative" };
    }
    if (
      (Number.isFinite(rawL) && rawL === 0) ||
      (Number.isFinite(rawW) && rawW === 0)
    ) {
      return { ok: false, reason: "zero_operand" };
    }
    return { ok: false, reason: "missing" };
  }

  const calculated = roundToTwoDecimals(length * width);
  const formulaText = `${length} ${params.lengthLabel ?? "m"} × ${width} ${params.widthLabel ?? "m"} = ${calculated} ${params.resultUnit ?? "m²"}`;
  const existing = toPositiveNumber(params.existingResult);
  const overridden = params.existingSource === "user" && existing !== null;
  const displayValue = overridden ? (existing as number) : calculated;

  return {
    ok: true,
    value: calculated,
    formulaText,
    overridden,
    calculatedValue: calculated,
    displayValue,
    canClearOverride: overridden,
  };
}

export function findDerivationSpec(
  workAreaType: string,
  resultFactKey: string
): DimensionDerivationSpec | null {
  return (
    DIMENSION_DERIVATION_SPECS.find(
      (s) =>
        s.workAreaType === workAreaType && s.resultFactKey === resultFactKey
    ) ?? null
  );
}

/** Fact keys that are derivation results (may be user-overridden). */
export const DERIVABLE_RESULT_FACT_KEYS = Object.freeze(
  new Set(DIMENSION_DERIVATION_SPECS.map((s) => s.resultFactKey))
);

/** Operand fact keys that feed derivations. */
export const DERIVATION_OPERAND_FACT_KEYS = Object.freeze(
  new Set(
    DIMENSION_DERIVATION_SPECS.flatMap((s) => [s.operandAKey, s.operandBKey])
  )
);
