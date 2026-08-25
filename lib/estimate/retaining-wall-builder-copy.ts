/**
 * RETAINING-WALL-MATURITY-1E — builder-facing copy helpers.
 * Internal tokens stay on requirements; Builder Review uses this layer.
 */
import { round2 } from "@/lib/estimate/facts";
import {
  getLabourAdjustmentParts,
  parseCarryDistanceCategory,
} from "@/lib/estimate/adjustments";
import type { EstimateConstraint } from "@/lib/estimate/types";
import {
  RW_TIMBER_FIXINGS_PERCENT_OF_TIMBER,
} from "@/lib/estimate/retaining-wall-timber-1d";

const INTERNAL_TOKEN = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g;

export function stripInternalEstimateTokens(text: string): string {
  return text
    .replace(INTERNAL_TOKEN, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*·\s*·/g, " · ")
    .replace(/^[ ·]+|[ ·]+$/g, "")
    .trim();
}

export function formatPercentAddend(addend: number): string {
  return `+${Math.round(addend * 100)}%`;
}

export function formatTimberLabourModifierCopy(params: {
  constraints: readonly EstimateConstraint[];
  includeMaterialCarry: boolean;
  baseHours: number;
  adjustedHours: number;
  quantity: number;
  unit: string;
  hoursPerUnit: number;
}): string {
  const parts = getLabourAdjustmentParts(params.constraints);
  const reasons: string[] = [];
  if (parts.accessAddend > 0) {
    const access = params.constraints.find((row) => row.key === "site_access");
    const label = String(access?.value ?? "site access");
    reasons.push(
      `${label} site access ${formatPercentAddend(parts.accessAddend)}`.replace(
        /site access site access/i,
        "site access"
      )
    );
  }
  if (params.includeMaterialCarry && parts.carryAddend > 0) {
    const carry = params.constraints.find(
      (row) => row.key === "material_carry_distance"
    );
    const raw = String(carry?.value ?? "material carry");
    const category = parseCarryDistanceCategory(raw);
    const carryLabel =
      category === "moderate"
        ? "Material carry 10–30m"
        : category === "long"
          ? "Material carry over 30m"
          : `Material carry ${raw}`;
    reasons.push(`${carryLabel} ${formatPercentAddend(parts.carryAddend)}`);
  }
  if (parts.slopeAddend > 0) {
    reasons.push(`Site slope ${formatPercentAddend(parts.slopeAddend)}`);
  }
  if (parts.occupiedAddend > 0) {
    reasons.push(`Occupied site ${formatPercentAddend(parts.occupiedAddend)}`);
  }
  if (parts.hoursAddend > 0) {
    reasons.push(
      `Restricted hours ${formatPercentAddend(parts.hoursAddend)}`
    );
  }
  const driver = `${params.quantity} ${params.unit} × ${params.hoursPerUnit} h/${params.unit} = ${params.baseHours} base hrs`;
  if (reasons.length === 0 || params.baseHours === params.adjustedHours) {
    return driver;
  }
  return `${driver} · ${reasons.join(" · ")} · Adjusted ${params.adjustedHours}h`;
}

export function formatBoardProcurementCopy(params: {
  netLm: number;
  purchaseLm: number;
  wasteFactor: number;
}): string {
  const wastePct = Math.round(params.wasteFactor * 100);
  return `${round2(params.netLm)} lm required · ${round2(params.purchaseLm)} lm purchased · ${wastePct}% waste`;
}

export function formatAggregateProcurementCopy(params: {
  inPlaceM3: number;
  purchaseM3: number;
}): string {
  return `${round2(params.inPlaceM3)} m³ in-place · Includes 25% procurement allowance for loose volume, handling and waste · ${round2(params.purchaseM3)} m³ purchased`;
}

export function formatFixingsAllowanceCopy(timberMaterialCost: number): string {
  const pct = Math.round(RW_TIMBER_FIXINGS_PERCENT_OF_TIMBER * 100);
  return `Fixings and connectors allowance · ${pct}% of timber materials ($${round2(timberMaterialCost)})`;
}

export function formatPileProcurementSummary(params: {
  pileCount: number;
  theoreticalLm: number;
  purchaseEa: number;
  purchaseLm: number;
  byStock: readonly { stockLengthM: number; ea: number }[];
}): { title: string; detail: string } {
  const sku = params.byStock
    .map((row) => `${row.ea} × ${row.stockLengthM} m`)
    .join(" · ");
  const offcut = round2(params.purchaseLm - params.theoreticalLm);
  return {
    title: "Pile procurement",
    detail: `Required: ${params.pileCount} piles · ${round2(params.theoreticalLm)} lm required length. Purchased stock: ${params.purchaseEa} poles · ${round2(params.purchaseLm)} lm. Offcut / procurement difference ${offcut} lm. ${sku}.`,
  };
}

export function timberLabourLabel(componentKey: string, unknownAllowance: boolean): string {
  if (componentKey.endsWith("piles.install")) return "Pile installation";
  if (componentKey.endsWith("face_boards.install")) {
    return "Retaining-wall face installation";
  }
  if (componentKey.endsWith("novacoil.install")) return "Drainage installation";
  if (componentKey.endsWith("backfill.place")) return "Drainage backfill";
  if (componentKey.includes("excavation.bulk.labour")) {
    return unknownAllowance ? "Excavation allowance" : "Excavation";
  }
  return "Labour";
}
