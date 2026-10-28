/**
 * Stage 3D — ordinary modular carpet tiles, straight lay, on a ready substrate.
 *
 * Reviewed quantities, before any rate is applied:
 * - Net installed area is the agreed area. Installation labour uses that area.
 *   Supply waste never increases the labour quantity.
 * - The original office brief is 120 m² and states no waste percentage.
 *   That stays 120 m². It is not converted to 132 m².
 * - Unresolved waste is not treated as zero. Explicit zero stays the net area.
 *   A stated percentage applies only to finish supply. The proposed 5% allowance
 *   is an assumption and is not applied until it is confirmed.
 * - Tile count exists only when tile width and length are known. A straight-lay
 *   grid uses room length and width when those are known, and that grid is not
 *   stacked with a second waste percentage. Otherwise the count is the confirmed
 *   supply area divided by the tile area, rounded up. Unknown size invents neither
 *   a count nor a dimension.
 * - Whole boxes exist only when box coverage, or a tile count and tiles per box,
 *   is known. No box size is invented.
 * - Adhesive or tackifier uses the net area, or whole units only when that
 *   product's coverage is known. Carpet underlay is not added.
 * - Preparation stays a separate unpriced requirement. A missing preparation
 *   recipe does not remove carpet-tile supply, fixing, or installation that
 *   can already be calculated, and it does not invent a preparation rate.
 * - There is no carpet-tile benchmark. The broadloom carpet package is not used.
 */

import { round2 } from "@/lib/estimate/facts";
import type { FlooringPortion } from "@/lib/estimate/flooring-portions";

export const CARPET_TILE_PROPOSED_WASTE_PERCENT = 5;

export const FLOORING_CARPET_TILE_SUPPLY_M2 =
  "flooring.carpet_tile.straight.supply.m2" as const;
export const FLOORING_CARPET_TILE_SUPPLY_BOX =
  "flooring.carpet_tile.straight.supply.box" as const;
export const FLOORING_CARPET_TILE_SUPPLY_TILE =
  "flooring.carpet_tile.straight.supply.tile" as const;
export const FLOORING_CARPET_TILE_ADHESIVE_M2 =
  "flooring.carpet_tile.adhesive.m2" as const;
export const FLOORING_CARPET_TILE_ADHESIVE_UNIT =
  "flooring.carpet_tile.adhesive.unit" as const;
export const FLOORING_CARPET_TILE_TACKIFIER_M2 =
  "flooring.carpet_tile.tackifier.m2" as const;
export const FLOORING_CARPET_TILE_TACKIFIER_UNIT =
  "flooring.carpet_tile.tackifier.unit" as const;
export const FLOORING_CARPET_TILE_INSTALL_HOURS_PER_M2 =
  "flooring.carpet_tile.straight.install.hours_per_m2" as const;
export const FLOORING_CARPET_TILE_PACKAGE_M2 =
  "flooring.carpet_tile.straight.supply_install.m2" as const;

export const FLOORING_CARPET_TILE_SUPPLY_COMPONENT =
  "flooring.carpet_tile.straight.supply" as const;
export const FLOORING_CARPET_TILE_FIXING_COMPONENT =
  "flooring.carpet_tile.fixing" as const;
export const FLOORING_CARPET_TILE_INSTALL_COMPONENT =
  "flooring.carpet_tile.straight.install" as const;
export const FLOORING_CARPET_TILE_GAP_COMPONENT =
  "flooring.carpet_tile.unresolved" as const;
export const FLOORING_CARPET_TILE_PREPARATION_GAP_COMPONENT =
  "flooring.carpet_tile.preparation_unresolved" as const;

export const CARPET_TILE_PREPARATION_GAP =
  "Floor preparation is requested and is not priced. This recipe does not turn removal of the existing floor into substrate readiness, and it does not invent a preparation rate." as const;

export const CARPET_TILE_PATTERN_PROPOSAL =
  "The brief does not state the laying pattern. Proposed assumption: straight lay of ordinary modular carpet tiles. Confirm that assumption or record another pattern. This is not stored as something the brief said." as const;

export const CARPET_TILE_WASTE_PROPOSAL =
  "The brief does not state a flooring waste percentage. Proposed assumption: a 5% supply allowance on the net area. Confirm it, enter another percentage, or record no waste. 120 m² is not converted to 132 m², and an unanswered allowance is not treated as zero." as const;

const COUNT_EPSILON = 1e-12;

export type CarpetTilePattern = "straight" | "other";
export type CarpetTileSubstrate = "ready" | "preparation" | "other";
export type CarpetTileFixing = "adhesive" | "tackifier" | "none" | "other";
export type CarpetTileWasteDecision = "stated" | "zero" | "proposed" | "custom";
export type CarpetTileKnown = "known" | "unknown";
export type CarpetTileCoverage = "included" | "separate";

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function presentM2(value: number): string {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? rounded.toFixed(2) : String(rounded);
}

export function wholePurchaseCount(area: number, coverage: number): number {
  return Math.ceil(area / coverage - COUNT_EPSILON);
}

export function carpetTileSupplyArea(
  netM2: number,
  wastePercent: number | null
): number | null {
  if (wastePercent == null) return null;
  if (!(wastePercent > 0)) return round2(netM2);
  return round2(netM2 * (1 + wastePercent / 100));
}

export function carpetTileWastePercent(portion: FlooringPortion): number | null {
  if (portion.carpet_tile_waste === "zero") return 0;
  if (
    portion.carpet_tile_waste === "stated" ||
    portion.carpet_tile_waste === "proposed" ||
    portion.carpet_tile_waste === "custom"
  ) {
    return portion.waste_percent != null && portion.waste_percent > 0
      ? portion.waste_percent
      : null;
  }
  return null;
}

export function parseCarpetTilePattern(value: unknown): CarpetTilePattern | null {
  if (value === "straight" || value === "other") return value;
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (
    text.includes("herringbone") ||
    text.includes("ashlar") ||
    text.includes("brick") ||
    text.includes("quarter") ||
    text.includes("chevron") ||
    text.includes("another")
  ) {
    return "other";
  }
  if (text.includes("straight")) return "straight";
  return null;
}

export function parseCarpetTileSubstrate(value: unknown): CarpetTileSubstrate | null {
  if (value === "ready" || value === "preparation" || value === "other") return value;
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (text.includes("prepar")) return "preparation";
  if (text.includes("other")) return "other";
  if (text.includes("ready")) return "ready";
  return null;
}

export function parseCarpetTileFixing(value: unknown): CarpetTileFixing | null {
  if (
    value === "adhesive" ||
    value === "tackifier" ||
    value === "none" ||
    value === "other"
  ) {
    return value;
  }
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (text.includes("another") || text.includes("specialist")) return "other";
  if (text.includes("tackifier")) return "tackifier";
  if (text.includes("no fixing") || text.includes("without adhesive") || text === "none") {
    return "none";
  }
  if (text.includes("adhesive") || text.includes("pressure")) return "adhesive";
  return null;
}

export function parseCarpetTileWasteDecision(
  value: unknown
): CarpetTileWasteDecision | null {
  if (
    value === "stated" ||
    value === "zero" ||
    value === "proposed" ||
    value === "custom"
  ) {
    return value;
  }
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (text.includes("no waste") || text.includes("zero")) return "zero";
  if (text.includes("proposed") || text.includes("5%")) return "proposed";
  if (text.includes("enter") || text.includes("percentage") || text.includes("custom")) {
    return "custom";
  }
  if (text.includes("already stated") || text.includes("stated")) return "stated";
  return null;
}

export function parseCarpetTileKnown(value: unknown): CarpetTileKnown | null {
  if (value === "known" || value === "unknown") return value;
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (text.includes("unknown") || text.includes("not stated")) return "unknown";
  if (text.includes("known")) return "known";
  return null;
}

export function parseCarpetTileCoverage(value: unknown): CarpetTileCoverage | null {
  if (value === "included" || value === "separate") return value;
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (text.includes("separate") || text.includes("charge")) return "separate";
  if (text.includes("cover") || text.includes("included")) return "included";
  return null;
}

export function applyCarpetTileBriefFacts(
  portion: FlooringPortion,
  briefText: string
): void {
  if (portion.specialist_kind !== "carpet_tile") return;
  const raw = normalise(briefText);
  if (portion.carpet_tile_pattern == null) {
    const pattern = parseCarpetTilePattern(raw);
    if (pattern) {
      portion.carpet_tile_pattern = pattern;
      portion.carpet_tile_pattern_authority = "extracted";
    }
  }
  if (portion.carpet_tile_substrate == null) {
    if (
      /ready for installation|ready substrate|clean, dry and ready|clean and dry, ready/.test(
        raw
      )
    ) {
      portion.carpet_tile_substrate = "ready";
      portion.carpet_tile_substrate_authority = "extracted";
    } else if (/needs preparation|floor preparation required|not ready/.test(raw)) {
      portion.carpet_tile_substrate = "preparation";
      portion.carpet_tile_substrate_authority = "extracted";
    }
  }
  if (portion.carpet_tile_fixing == null) {
    if (/\btackifier\b/.test(raw)) {
      portion.carpet_tile_fixing = "tackifier";
      portion.carpet_tile_fixing_authority = "extracted";
    } else if (/\b(?:pressure[-\s]?sensitive|psa|adhesive)\b/.test(raw)) {
      portion.carpet_tile_fixing = "adhesive";
      portion.carpet_tile_fixing_authority = "extracted";
    } else if (/\b(?:no adhesive|without adhesive|no fixing)\b/.test(raw)) {
      portion.carpet_tile_fixing = "none";
      portion.carpet_tile_fixing_authority = "extracted";
    }
  }
  if (
    portion.waste_percent != null &&
    portion.waste_percent > 0 &&
    portion.carpet_tile_waste == null
  ) {
    portion.carpet_tile_waste = "stated";
    portion.carpet_tile_waste_authority = "extracted";
  }
  if (
    /\b(?:customer|client)[-\s]supplied\b/.test(raw) &&
    portion.finish_supplied_by == null
  ) {
    portion.finish_supplied_by = "customer";
  }
  if (portion.tile_width_mm != null && portion.tile_length_mm != null) {
    portion.carpet_tile_size = portion.carpet_tile_size ?? "known";
  }
  const boxArea = raw.match(
    /(\d+(?:\.\d+)?)\s*m(?:2|²)\s*(?:per|\/)\s*box|box(?:es)?\s+(?:of|cover(?:ing)?)\s+(\d+(?:\.\d+)?)\s*m/
  );
  const boxValue = boxArea ? Number(boxArea[1] ?? boxArea[2]) : null;
  if (boxValue != null && boxValue > 0 && portion.carpet_tile_box_coverage_m2 == null) {
    portion.carpet_tile_box = "known";
    portion.carpet_tile_box_coverage_m2 = boxValue;
  }
  const perBox = raw.match(/(\d+)\s+tiles?\s+per\s+box/);
  if (perBox && portion.carpet_tile_tiles_per_box == null) {
    portion.carpet_tile_box = "known";
    portion.carpet_tile_tiles_per_box = Number(perBox[1]);
  }
  if (/\bdispos/.test(raw)) portion.carpet_tile_disposal_requested = true;
}

export type CarpetTilePurchase = {
  readonly quantity: number;
  readonly unit: "m2" | "box" | "tile";
  readonly itemKey: string;
  readonly formula: string;
  readonly tileCount: number | null;
  readonly boxCount: number | null;
};

export function planCarpetTilePurchase(params: {
  netM2: number;
  wastePercent: number | null;
  tileWidthMm: number | null;
  tileLengthMm: number | null;
  roomLengthM: number | null;
  roomWidthM: number | null;
  boxCoverageM2: number | null;
  tilesPerBox: number | null;
}): CarpetTilePurchase | null {
  const supply = carpetTileSupplyArea(params.netM2, params.wastePercent);
  if (supply == null || params.wastePercent == null) return null;
  const wasteText =
    params.wastePercent > 0
      ? `${params.wastePercent}% supply allowance gives ${presentM2(supply)} m²`
      : `explicit zero waste keeps supply at the net ${presentM2(params.netM2)} m²`;
  const width = params.tileWidthMm;
  const length = params.tileLengthMm;
  const tileM2 =
    width != null && length != null && width > 0 && length > 0
      ? (width / 1000) * (length / 1000)
      : null;
  let tileCount: number | null = null;
  let tileFormula = "Tile size is unknown, so no tile count is invented.";
  if (tileM2 != null && tileM2 > 0) {
    if (
      params.roomLengthM != null &&
      params.roomWidthM != null &&
      params.roomLengthM > 0 &&
      params.roomWidthM > 0
    ) {
      const along = wholePurchaseCount(params.roomLengthM, length! / 1000);
      const across = wholePurchaseCount(params.roomWidthM, width! / 1000);
      tileCount = along * across;
      tileFormula = `Straight lay uses ${along} × ${across} = ${tileCount} tiles from the room and tile size. A waste percentage is not stacked on that grid.`;
    } else {
      tileCount = wholePurchaseCount(supply, tileM2);
      tileFormula = `${wasteText}. Tile ${width} × ${length} mm gives ${tileCount} tiles.`;
    }
  }
  const gridSupply =
    tileCount != null &&
    tileM2 != null &&
    params.roomLengthM != null &&
    params.roomWidthM != null
      ? round2(tileCount * tileM2)
      : supply;
  if (params.boxCoverageM2 != null && params.boxCoverageM2 > 0) {
    const boxes = wholePurchaseCount(gridSupply, params.boxCoverageM2);
    return {
      quantity: boxes,
      unit: "box",
      itemKey: FLOORING_CARPET_TILE_SUPPLY_BOX,
      tileCount,
      boxCount: boxes,
      formula: `Net ${presentM2(params.netM2)} m². ${wasteText}. ${tileFormula} Box coverage ${presentM2(params.boxCoverageM2)} m² gives ${boxes} whole boxes.`,
    };
  }
  if (
    params.tilesPerBox != null &&
    params.tilesPerBox > 0 &&
    tileCount != null
  ) {
    const boxes = wholePurchaseCount(tileCount, params.tilesPerBox);
    return {
      quantity: boxes,
      unit: "box",
      itemKey: FLOORING_CARPET_TILE_SUPPLY_BOX,
      tileCount,
      boxCount: boxes,
      formula: `Net ${presentM2(params.netM2)} m². ${tileFormula} ${params.tilesPerBox} tiles per box gives ${boxes} whole boxes.`,
    };
  }
  if (tileCount != null && tileM2 != null && params.roomLengthM != null) {
    return {
      quantity: tileCount,
      unit: "tile",
      itemKey: FLOORING_CARPET_TILE_SUPPLY_TILE,
      tileCount,
      boxCount: null,
      formula: `Net ${presentM2(params.netM2)} m². ${tileFormula} Box coverage is unknown, so no box count is invented.`,
    };
  }
  if (tileCount != null) {
    return {
      quantity: tileCount,
      unit: "tile",
      itemKey: FLOORING_CARPET_TILE_SUPPLY_TILE,
      tileCount,
      boxCount: null,
      formula: `Net ${presentM2(params.netM2)} m². ${tileFormula} Box coverage is unknown, so no box count is invented.`,
    };
  }
  return {
    quantity: supply,
    unit: "m2",
    itemKey: FLOORING_CARPET_TILE_SUPPLY_M2,
    tileCount: null,
    boxCount: null,
    formula: `Net ${presentM2(params.netM2)} m². ${wasteText}. ${tileFormula}`,
  };
}

export type CarpetTileLineRole =
  | "supply"
  | "fixing"
  | "install"
  | "package"
  | "waste"
  | "gap";

export type CarpetTileLinePlan = {
  readonly role: CarpetTileLineRole;
  readonly componentKey: string;
  readonly materialKey: string | null;
  readonly quantity: number;
  readonly unit: string;
  readonly description: string;
  readonly specification: string;
  readonly customerSupplied: boolean;
  readonly wasteUnresolved: boolean;
};

export type CarpetTileAssemblyPlan =
  | { readonly status: "needs_answers"; readonly missing: readonly string[] }
  | { readonly status: "unsupported"; readonly lines: readonly CarpetTileLinePlan[] }
  | { readonly status: "ready"; readonly lines: readonly CarpetTileLinePlan[] };

function gapLine(
  owner: string,
  netM2: number,
  specification: string,
  description = `${owner} · carpet tiles`,
  componentKey: string = FLOORING_CARPET_TILE_GAP_COMPONENT
): CarpetTileLinePlan {
  return {
    role: "gap",
    componentKey,
    materialKey: null,
    quantity: netM2,
    unit: "m2",
    description,
    specification,
    customerSupplied: false,
    wasteUnresolved: true,
  };
}

export function planCarpetTileAssembly(params: {
  portion: FlooringPortion;
  netM2: number;
  owner: string;
}): CarpetTileAssemblyPlan {
  const { portion, netM2, owner } = params;
  if (portion.carpet_tile_pattern === "other") {
    return {
      status: "unsupported",
      lines: [
        gapLine(
          owner,
          netM2,
          "This pattern is not straight lay. It stays visible and is not priced by the ordinary carpet-tile recipe. No broadloom carpet package is applied."
        ),
      ],
    };
  }
  if (portion.carpet_tile_substrate === "other") {
    return {
      status: "unsupported",
      lines: [
        gapLine(
          owner,
          netM2,
          "The substrate is outside a ready substrate or a requested preparation. Carpet tiles are not priced as if the substrate were ready."
        ),
      ],
    };
  }
  if (portion.carpet_tile_fixing === "other") {
    return {
      status: "unsupported",
      lines: [
        gapLine(
          owner,
          netM2,
          "The fixing system is outside adhesive, tackifier, or no fixing material. It stays visible and unpriced."
        ),
      ],
    };
  }

  const missing: string[] = [];
  if (portion.carpet_tile_pattern == null) {
    missing.push("flooring.portion.carpet_tile_pattern");
  }
  if (portion.carpet_tile_substrate == null) {
    missing.push("flooring.portion.carpet_tile_substrate");
  }
  if (portion.carpet_tile_waste == null) {
    missing.push("flooring.portion.carpet_tile_waste");
  } else if (
    portion.carpet_tile_waste === "custom" &&
    !(portion.waste_percent != null && portion.waste_percent > 0)
  ) {
    missing.push("flooring.portion.carpet_tile_waste_percent");
  }
  if (portion.carpet_tile_size == null) missing.push("flooring.portion.carpet_tile_size");
  if (
    portion.carpet_tile_size === "known" &&
    (portion.tile_width_mm == null || portion.tile_length_mm == null)
  ) {
    if (portion.tile_width_mm == null) missing.push("flooring.portion.tile_width_mm");
    if (portion.tile_length_mm == null) missing.push("flooring.portion.tile_length_mm");
  }
  if (portion.carpet_tile_box == null) missing.push("flooring.portion.carpet_tile_box");
  if (
    portion.carpet_tile_box === "known" &&
    portion.carpet_tile_box_coverage_m2 == null &&
    portion.carpet_tile_tiles_per_box == null
  ) {
    missing.push("flooring.portion.carpet_tile_box_coverage_m2");
  }
  if (portion.carpet_tile_fixing == null) {
    missing.push("flooring.portion.carpet_tile_fixing");
  }
  const customer = portion.finish_supplied_by === "customer";
  if (!customer && portion.finish_pricing == null) {
    missing.push("flooring.portion.finish_pricing");
  }
  const waste = carpetTileWastePercent(portion);
  const packageActive = portion.finish_pricing === "combined_package" && !customer;
  if (
    packageActive &&
    waste != null &&
    waste > 0 &&
    portion.waste_treatment == null
  ) {
    missing.push("flooring.portion.waste_treatment");
  }
  const fixingSelected =
    portion.carpet_tile_fixing === "adhesive" ||
    portion.carpet_tile_fixing === "tackifier";
  if (packageActive && fixingSelected && portion.carpet_tile_package_covers_fixing == null) {
    missing.push("flooring.portion.carpet_tile_package_covers_fixing");
  }
  if (missing.length > 0) return { status: "needs_answers", missing };

  const purchase = planCarpetTilePurchase({
    netM2,
    wastePercent: waste,
    tileWidthMm: portion.carpet_tile_size === "known" ? portion.tile_width_mm : null,
    tileLengthMm: portion.carpet_tile_size === "known" ? portion.tile_length_mm : null,
    roomLengthM: portion.length_m,
    roomWidthM: portion.width_m,
    boxCoverageM2:
      portion.carpet_tile_box === "known" ? portion.carpet_tile_box_coverage_m2 ?? null : null,
    tilesPerBox:
      portion.carpet_tile_box === "known" ? portion.carpet_tile_tiles_per_box ?? null : null,
  });
  if (!purchase || waste == null) {
    return { status: "needs_answers", missing: ["flooring.portion.carpet_tile_waste"] };
  }

  const lines: CarpetTileLinePlan[] = [];
  const packageCoversFixing =
    packageActive && portion.carpet_tile_package_covers_fixing === "included";
  if (packageActive) {
    lines.push({
      role: "package",
      componentKey: FLOORING_CARPET_TILE_PACKAGE_M2,
      materialKey: null,
      quantity: netM2,
      unit: "m2",
      description: `${owner} · straight-lay carpet tile supply and installation`,
      specification: `Combined package on the net ${presentM2(netM2)} m². Coverage of waste and fixing is only what was confirmed. A saved subcontract rate does not decide coverage. No broadloom carpet package and no carpet-tile benchmark. ${purchase.formula}`,
      customerSupplied: false,
      wasteUnresolved: false,
    });
    if (waste > 0 && portion.waste_treatment !== "package_covers_requested_waste") {
      const extra = round2(purchase.quantity - (purchase.unit === "m2" ? netM2 : 0));
      const incremental =
        portion.waste_treatment === "incremental_material" && purchase.unit === "m2" && extra > 0;
      lines.push({
        role: "waste",
        componentKey: "flooring.finish.waste_increment",
        materialKey: incremental ? purchase.itemKey : null,
        quantity: incremental ? extra : 1,
        unit: incremental ? "m2" : "item",
        description: `${owner} · carpet tile supply allowance`,
        specification: incremental
          ? `Extra carpet tiles only: ${presentM2(extra)} m². Installation stays on the net area.`
          : `The ${waste}% supply allowance is not inside the package. Confirm the package covers it, or charge only the extra quantity.`,
        customerSupplied: false,
        wasteUnresolved: !incremental,
      });
    }
  } else {
    lines.push({
      role: "supply",
      componentKey: FLOORING_CARPET_TILE_SUPPLY_COMPONENT,
      materialKey: purchase.itemKey,
      quantity: purchase.quantity,
      unit: purchase.unit,
      description: customer
        ? `${owner} · customer-supplied carpet tiles`
        : `${owner} · carpet tile supply`,
      specification: customer
        ? `Customer supplied the carpet tiles. Contractor purchasing cost is 0. ${purchase.formula}`
        : purchase.formula,
      customerSupplied: customer,
      wasteUnresolved: false,
    });
    lines.push({
      role: "install",
      componentKey: FLOORING_CARPET_TILE_INSTALL_COMPONENT,
      materialKey: FLOORING_CARPET_TILE_INSTALL_HOURS_PER_M2,
      quantity: netM2,
      unit: "m2",
      description: `${owner} · straight-lay carpet tile installation`,
      specification: `Installation uses the net ${presentM2(netM2)} m². Supply waste is not added to the hours. No Quotr hours default. Labour cost uses a company carpenter hourly rate, not the $60 benchmark.`,
      customerSupplied: false,
      wasteUnresolved: false,
    });
  }

  if (fixingSelected && !packageCoversFixing) {
    const coverage = portion.carpet_tile_fixing_coverage_m2;
    const whole =
      coverage != null && coverage > 0 ? wholePurchaseCount(netM2, coverage) : null;
    const adhesive = portion.carpet_tile_fixing === "adhesive";
    lines.push({
      role: "fixing",
      componentKey: FLOORING_CARPET_TILE_FIXING_COMPONENT,
      materialKey:
        whole != null
          ? adhesive
            ? FLOORING_CARPET_TILE_ADHESIVE_UNIT
            : FLOORING_CARPET_TILE_TACKIFIER_UNIT
          : adhesive
            ? FLOORING_CARPET_TILE_ADHESIVE_M2
            : FLOORING_CARPET_TILE_TACKIFIER_M2,
      quantity: whole ?? netM2,
      unit: whole != null ? "unit" : "m2",
      description: `${owner} · ${adhesive ? "carpet tile adhesive" : "carpet tile tackifier"}`,
      specification:
        whole != null
          ? `Fixing uses the net ${presentM2(netM2)} m². Coverage ${presentM2(coverage!)} m² gives ${whole} whole units. Tile waste is not applied. Carpet underlay is not added.`
          : `Fixing uses the net ${presentM2(netM2)} m². Product coverage is unknown, so no unit count is invented. Tile waste is not applied. Carpet underlay is not added.`,
      customerSupplied: false,
      wasteUnresolved: false,
    });
  }

  if (portion.underlay_required === true) {
    lines.push(
      gapLine(
        owner,
        netM2,
        "Carpet underlay was requested. This recipe does not add it, and the broadloom underlay package is not used."
      )
    );
  }
  if (portion.carpet_tile_disposal_requested === true) {
    lines.push(
      gapLine(
        owner,
        netM2,
        "Disposal was requested separately and is not priced by the carpet-tile recipe."
      )
    );
  }
  if (portion.carpet_tile_substrate === "preparation") {
    lines.push({
      role: "gap",
      componentKey: FLOORING_CARPET_TILE_PREPARATION_GAP_COMPONENT,
      materialKey: null,
      quantity: netM2,
      unit: "m2",
      description: `${owner} · floor preparation`,
      specification: CARPET_TILE_PREPARATION_GAP,
      customerSupplied: false,
      wasteUnresolved: false,
    });
  }
  return { status: "ready", lines };
}
