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
    .replace(/\bXOR\b[^.·]*[.]?/gi, "")
    .replace(/\(\s*\)/g, "")
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
  const driver = `${formatLabourDriverQuantity(params.quantity, params.unit)} × ${formatLabourProductivityRate(params.hoursPerUnit, params.unit)} labour-h/${formatLabourRateUnit(params.unit)} = ${round2(params.baseHours)} base hrs`;
  if (reasons.length === 0 || params.baseHours === params.adjustedHours) {
    return driver;
  }
  return `${driver} · ${reasons.join(" · ")} · Adjusted ${params.adjustedHours}h`;
}

export function formatTimberLabourCompactCopy(params: {
  constraints: readonly EstimateConstraint[];
  includeMaterialCarry: boolean;
  quantity: number;
  unit: string;
  hoursPerUnit: number;
  label: string;
}): { supporting: string; modifiers: string | null } {
  const unitDriver =
    params.unit === "ea" && /pile/i.test(params.label)
      ? "piles"
      : params.unit === "ea" && /post/i.test(params.label)
        ? "posts"
        : params.unit === "ea" && /sleeper/i.test(params.label)
          ? "sleepers"
          : params.unit === "hole"
            ? "holes"
            : params.unit === "bag"
              ? "bags"
              : params.unit === "m3"
                ? "m³"
                : params.unit === "m2"
                  ? "m²"
                  : params.unit;
  const qtyText = formatLabourDriverQuantity(params.quantity, params.unit);
  const rateText = formatLabourProductivityRate(params.hoursPerUnit, params.unit);
  const rateUnit = formatLabourRateUnit(params.unit);
  const hoursText = round2(params.quantity * params.hoursPerUnit).toFixed(2);
  const driverCore =
    unitDriver === "piles"
      ? `${qtyText} piles × ${rateText} labour-h/${rateUnit}`
      : `${qtyText} ${unitDriver} × ${rateText} labour-h/${rateUnit}`;
  const driver = `${driverCore} = ${hoursText} hrs`;
  const parts = getLabourAdjustmentParts(params.constraints);
  const reasons: string[] = [];
  if (parts.accessAddend > 0) {
    const access = params.constraints.find((row) => row.key === "site_access");
    const label = String(access?.value ?? "site").replace(/site access/i, "").trim();
    reasons.push(`${label} access ${formatPercentAddend(parts.accessAddend)}`);
  }
  if (params.includeMaterialCarry && parts.carryAddend > 0) {
    reasons.push(`Material carry ${formatPercentAddend(parts.carryAddend)}`);
  }
  if (parts.slopeAddend > 0) {
    reasons.push(`Site slope ${formatPercentAddend(parts.slopeAddend)}`);
  }
  if (parts.occupiedAddend > 0) {
    reasons.push(`Occupied site ${formatPercentAddend(parts.occupiedAddend)}`);
  }
  if (parts.hoursAddend > 0) {
    reasons.push(`Restricted hours ${formatPercentAddend(parts.hoursAddend)}`);
  }
  return {
    supporting: driver,
    modifiers: reasons.length > 0 ? `${reasons.join(" · ")}.` : null,
  };
}

function formatLabourDriverQuantity(quantity: number, unit: string): string {
  if (unit === "bag" || unit === "ea" || unit === "hole") {
    return String(Math.round(quantity));
  }
  return round2(quantity).toFixed(2);
}

function formatLabourRateUnit(unit: string): string {
  if (unit === "m3") return "m³";
  if (unit === "m2") return "m²";
  return unit;
}

/** h/bag keeps up to 3 dp so 0.035 does not display as 0.04 and break arithmetic. */
function formatLabourProductivityRate(hoursPerUnit: number, unit: string): string {
  if (unit === "bag") {
    const trimmed = Number(hoursPerUnit.toFixed(3));
    return String(trimmed);
  }
  return round2(hoursPerUnit).toFixed(2);
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
  return `${round2(params.inPlaceM3)} m³ in-place · ${round2(params.purchaseM3)} m³ purchased`;
}

export function formatAggregateProcurementDetail(): string {
  return "Includes 25% procurement allowance";
}

export function formatFixingsAllowanceCopy(timberMaterialCost: number): string {
  void timberMaterialCost;
  const pct = Math.round(RW_TIMBER_FIXINGS_PERCENT_OF_TIMBER * 100);
  return `${pct}% of timber materials`;
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

export function formatPileGroupSupporting(params: {
  pileCount: number;
  theoreticalLm: number;
  purchaseLm: number;
}): { supporting: string; secondary: string } {
  const offcut = round2(params.purchaseLm - params.theoreticalLm);
  return {
    supporting: `${params.pileCount} poles · ${round2(params.theoreticalLm)}lm required · ${round2(params.purchaseLm)}lm purchased`,
    secondary: `${offcut}lm procurement/offcut difference`,
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
  if (componentKey.endsWith("posts.install")) return "Post installation";
  if (componentKey.endsWith("sleepers.install")) return "Sleeper installation";
  if (componentKey.endsWith("concrete.place")) return "Post-hole concrete placement";
  if (componentKey.includes("masonry.subbase.compact")) return "Sub-base compaction";
  if (componentKey.includes("masonry.footing.place")) return "Footing concrete placement";
  if (componentKey.includes("masonry.block_lay")) return "Block laying";
  if (componentKey.includes("masonry.core_fill.place")) return "Core filling";
  if (componentKey.includes("masonry.waterproofing.install")) {
    return "Retaining-side waterproofing";
  }
  if (componentKey.includes("masonry.rebar.install")) return "Reinforcement installation";
  return "Labour";
}

export function formatSleeperGroupSupporting(params: {
  postCount: number;
  theoreticalLm: number;
}): { supporting: string; secondary: string } {
  return {
    supporting: `${params.postCount} posts · ${round2(params.theoreticalLm)}lm theoretical`,
    secondary: "Estimating lengths from local wall height + embedment. Not stock rounding.",
  };
}

export function formatSleeperCompactCopy(params: {
  sleeperCount: number;
  bayCount: number | null;
  courses: number[];
  unitCost: number | null;
  standardSleeperEa?: number;
  cutSleeperEa?: number;
}): { supporting: string; secondary: string | null } {
  const courseHint =
    params.courses.length === 0
      ? null
      : params.courses.every((n) => n === params.courses[0])
        ? `${params.courses[0]} courses`
        : `courses ${params.courses[0]}–${params.courses.at(-1)}`;
  const rate =
    params.unitCost != null ? `$${params.unitCost}/EA` : null;
  const cut =
    (params.cutSleeperEa ?? 0) > 0
      ? `${params.standardSleeperEa} standard · ${params.cutSleeperEa} cut/end`
      : null;
  return {
    supporting: [`${params.sleeperCount} EA`, courseHint, rate]
      .filter(Boolean)
      .join(" · "),
    secondary: [cut, params.bayCount != null ? `${params.bayCount} bays` : null]
      .filter(Boolean)
      .join(" · ") || null,
  };
}

export function formatPostHoleBaggedConcreteCopy(params: {
  bagCount: number;
  holeCount: number;
  unitCost: number | null;
  sloping: boolean;
  holeDiameterM: number;
  grossHoleVolumeM3: number;
  postDisplacementM3: number;
  netConcreteM3: number;
  bagYieldM3: number;
}): { supporting: string; secondary: string | null } {
  const bagsPerHole =
    params.holeCount > 0 ? params.bagCount / params.holeCount : 0;
  const bagsPerHoleText =
    Math.abs(bagsPerHole - Math.round(bagsPerHole)) < 1e-9
      ? `${Math.round(bagsPerHole)}.0`
      : (Math.round(bagsPerHole * 10) / 10).toFixed(1);
  const perHoleLabel = params.sloping ? "bags/hole avg" : "bags/hole";
  const rate =
    params.unitCost != null ? ` · $${params.unitCost}/bag` : "";
  return {
    supporting: `${params.bagCount} bags required · ${bagsPerHoleText} ${perHoleLabel}${rate}`,
    secondary: [
      `${params.holeCount} post holes`,
      `${round2(params.holeDiameterM * 1000)} mm hole diameter`,
      `Gross hole volume: ${round2(params.grossHoleVolumeM3)} m³`,
      `Less post displacement: ${round2(params.postDisplacementM3)} m³`,
      `Net concrete: ${round2(params.netConcreteM3)} m³`,
      `Bag yield: ${params.bagYieldM3} m³/bag`,
      `Total: ${params.bagCount} bags`,
    ].join(" · "),
  };
}

/** @deprecated Prefer formatPostHoleBaggedConcreteCopy — kept for call-site migration. */
export function formatSleeperConcreteCopy(params: {
  volumeM3: number;
  bagCount: number | null;
  unitCost: number | null;
  grossHoleVolumeM3?: number | null;
  postDisplacementM3?: number | null;
  holeCount?: number | null;
  holeDiameterM?: number | null;
  bagYieldM3?: number | null;
  sloping?: boolean;
}): { supporting: string; secondary: string | null } {
  if (params.bagCount != null && params.holeCount != null && params.holeCount > 0) {
    return formatPostHoleBaggedConcreteCopy({
      bagCount: params.bagCount,
      holeCount: params.holeCount,
      unitCost: params.unitCost,
      sloping: params.sloping === true,
      holeDiameterM: params.holeDiameterM ?? 0.3,
      grossHoleVolumeM3: params.grossHoleVolumeM3 ?? params.volumeM3,
      postDisplacementM3: params.postDisplacementM3 ?? 0,
      netConcreteM3: params.volumeM3,
      bagYieldM3: params.bagYieldM3 ?? 0.01,
    });
  }
  const bags =
    params.bagCount != null
      ? `${params.bagCount} bags${params.unitCost != null ? ` · $${params.unitCost}/bag` : ""}`
      : null;
  return {
    supporting: `${params.bagCount ?? round2(params.volumeM3)} ${params.bagCount != null ? "bags required" : "m³ required"}${bags && params.bagCount == null ? ` · ${bags}` : ""}`,
    secondary:
      params.grossHoleVolumeM3 != null && params.postDisplacementM3 != null
        ? `Gross holes ${round2(params.grossHoleVolumeM3)} m³ · less post displacement ${round2(params.postDisplacementM3)} m³ · net placed ${round2(params.volumeM3)} m³`
        : null,
  };
}

export function formatMasonryBlockCompactCopy(params: {
  series: string | null;
  netEa: number;
  purchaseEa: number;
  wasteFactor: number;
  faceAreaM2: number;
  unitsPerM2: number;
  unitCost: number | null;
  rateLabel?: string | null;
}): { supporting: string; secondary: string | null } {
  const seriesLabel =
    params.series === "150"
      ? "150-series"
      : params.series === "200"
        ? "200-series"
        : params.series ?? "concrete masonry";
  const wastePct = Math.round(params.wasteFactor * 100);
  const rate =
    params.unitCost != null
      ? `$${params.unitCost}/EA${params.rateLabel ? ` · ${params.rateLabel}` : ""}`
      : null;
  const purchaseNote =
    wastePct > 0 && params.purchaseEa !== Math.ceil(params.netEa - 1e-9)
      ? `${round2(params.netEa)} EA required · ${params.purchaseEa} EA purchased · ${wastePct}% procurement allowance`
      : `${params.purchaseEa} EA purchased`;
  return {
    supporting: [`${seriesLabel}`, `${params.purchaseEa} EA`, rate]
      .filter(Boolean)
      .join(" · "),
    secondary: purchaseNote,
  };
}

export function formatMasonryMortarCompactCopy(params: {
  totalCost: number | null;
  basis: string;
}): { supporting: string; secondary: string | null } {
  const money =
    params.totalCost != null ? `$${round2(params.totalCost)}` : "Price required";
  return {
    supporting: money,
    secondary: params.basis,
  };
}

export function formatMasonryVolumeCompactCopy(params: {
  volumeM3: number;
  unitCost: number | null;
  label: string;
}): { supporting: string; secondary: string | null } {
  const rate = params.unitCost != null ? `$${params.unitCost}/m³` : null;
  return {
    supporting: [`${round2(params.volumeM3)} m³`, rate].filter(Boolean).join(" · "),
    secondary: params.label,
  };
}

export function formatMasonryWaterproofCompactCopy(params: {
  areaM2: number;
  unitCost: number | null;
  productLabel?: string | null;
}): { supporting: string; secondary: string | null } {
  const rate = params.unitCost != null ? `$${params.unitCost}/m²` : null;
  return {
    supporting: [`${round2(params.areaM2)} m²`, rate].filter(Boolean).join(" · "),
    secondary: params.productLabel ?? "Retaining-side waterproofing",
  };
}
