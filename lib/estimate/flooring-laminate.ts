/**
 * Stage 3B — floating click-lock laminate on a ready substrate.
 *
 * This is the only priced laminate assembly. Glued and fastened laminate
 * stay visible and unpriced. An unstated method is not stored as an
 * extracted fact.
 *
 * Quantities, reviewed before any rate is applied:
 * - Net installation area is the agreed room area. Labour uses that area.
 * - Laminate supply is net × (1 + stated waste). 30 m² at 10% is 33 m².
 * - Whole packs are used only when pack coverage is known:
 *   ceil(supply m² / m² per pack). No second waste is added.
 * - Unknown pack coverage stays an area allowance. No pack count is invented.
 * - Underlay and a separate moisture barrier use the net area, not the
 *   laminate waste allowance. Whole rolls are used only when that product's
 *   coverage is known. Laminate waste is not copied onto them.
 * - A moisture barrier is added on concrete only when the underlay is not
 *   confirmed to include that function. It is never added twice.
 * - Timber substrates do not get a moisture-barrier line in this recipe.
 * - Excluded preparation, removal, disposal and skirting are not lines.
 * - There is no laminate benchmark and the vinyl package is not reused.
 */

import { round2 } from "@/lib/estimate/facts";
import type { FlooringPortion } from "@/lib/estimate/flooring-portions";

export const FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2 =
  "flooring.laminate.click_lock.supply.m2" as const;
export const FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_PACK =
  "flooring.laminate.click_lock.supply.pack" as const;
export const FLOORING_LAMINATE_UNDERLAY_M2 =
  "flooring.laminate.underlay.m2" as const;
export const FLOORING_LAMINATE_UNDERLAY_ROLL =
  "flooring.laminate.underlay.roll" as const;
export const FLOORING_LAMINATE_MOISTURE_M2 =
  "flooring.laminate.moisture_barrier.m2" as const;
export const FLOORING_LAMINATE_MOISTURE_ROLL =
  "flooring.laminate.moisture_barrier.roll" as const;
export const FLOORING_LAMINATE_INSTALL_HOURS_PER_M2 =
  "flooring.laminate.click_lock.install.hours_per_m2" as const;
export const FLOORING_LAMINATE_PACKAGE_M2 =
  "flooring.laminate.click_lock.supply_install.m2" as const;

export const FLOORING_LAMINATE_SUPPLY_COMPONENT =
  "flooring.laminate.click_lock.supply" as const;
export const FLOORING_LAMINATE_UNDERLAY_COMPONENT =
  "flooring.laminate.underlay" as const;
export const FLOORING_LAMINATE_MOISTURE_COMPONENT =
  "flooring.laminate.moisture_barrier" as const;
export const FLOORING_LAMINATE_INSTALL_COMPONENT =
  "flooring.laminate.click_lock.install" as const;

export const LAMINATE_METHOD_VALUES = [
  "floating_click_lock",
  "glued",
  "fastened",
] as const;
export type LaminateMethod = (typeof LAMINATE_METHOD_VALUES)[number];

export const LAMINATE_MOISTURE_VALUES = [
  "integrated",
  "separate",
  "excluded",
] as const;
export type LaminateMoisture = (typeof LAMINATE_MOISTURE_VALUES)[number];

export const LAMINATE_SUBSTRATE_VALUES = ["concrete", "timber", "other"] as const;
export type LaminateSubstrate = (typeof LAMINATE_SUBSTRATE_VALUES)[number];

const COUNT_EPSILON = 1e-12;

export const LAMINATE_METHOD_PROPOSAL =
  "The brief does not state the installation method. Proposed assumption: floating click-lock on the ready substrate. Confirm that assumption or choose another method. This is not stored as something the brief said." as const;

export const LAMINATE_MOISTURE_QUESTION =
  "The underlay is not assumed to include moisture control. On concrete, confirm whether that function is inside the underlay, a separate barrier, or excluded. It is not added twice." as const;

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

export function laminateAreaAllowance(
  netM2: number,
  wastePercent: number | null | undefined
): number {
  const waste =
    wastePercent != null && Number.isFinite(wastePercent) && wastePercent > 0
      ? wastePercent
      : 0;
  return round2(netM2 * (1 + waste / 100));
}

export type LaminatePurchase = {
  readonly quantity: number;
  readonly unit: "m2" | "pack" | "roll";
  readonly itemKey: string;
  readonly formula: string;
};

export function laminateFinishPurchase(params: {
  netM2: number;
  wastePercent: number | null | undefined;
  packCoverageM2: number | null | undefined;
}): LaminatePurchase {
  const allowance = laminateAreaAllowance(params.netM2, params.wastePercent);
  const waste =
    params.wastePercent != null && params.wastePercent > 0
      ? params.wastePercent
      : 0;
  const coverage = params.packCoverageM2;
  if (coverage != null && coverage > 0) {
    const packs = wholePurchaseCount(allowance, coverage);
    return {
      quantity: packs,
      unit: "pack",
      itemKey: FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_PACK,
      formula: `Net ${presentM2(params.netM2)} m² × (1 + ${waste}% waste) = ${presentM2(allowance)} m². Pack coverage ${presentM2(coverage)} m² gives ${packs} whole packs. No second waste is added.`,
    };
  }
  return {
    quantity: allowance,
    unit: "m2",
    itemKey: FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
    formula:
      waste > 0
        ? `Net ${presentM2(params.netM2)} m² × (1 + ${waste}% waste) = supply ${presentM2(allowance)} m². Pack coverage is unknown, so this is an area allowance and no pack count is invented.`
        : `No waste is stated. Supply stays the net ${presentM2(params.netM2)} m². Pack coverage is unknown, so no pack count is invented.`,
  };
}

export function laminateAncillaryPurchase(params: {
  netM2: number;
  coverageM2: number | null | undefined;
  kind: "underlay" | "moisture";
}): LaminatePurchase {
  const itemKey =
    params.kind === "underlay"
      ? params.coverageM2 != null && params.coverageM2 > 0
        ? FLOORING_LAMINATE_UNDERLAY_ROLL
        : FLOORING_LAMINATE_UNDERLAY_M2
      : params.coverageM2 != null && params.coverageM2 > 0
        ? FLOORING_LAMINATE_MOISTURE_ROLL
        : FLOORING_LAMINATE_MOISTURE_M2;
  const name = params.kind === "underlay" ? "Underlay" : "Moisture barrier";
  if (params.coverageM2 != null && params.coverageM2 > 0) {
    const rolls = wholePurchaseCount(params.netM2, params.coverageM2);
    return {
      quantity: rolls,
      unit: "roll",
      itemKey,
      formula: `${name} uses the net ${presentM2(params.netM2)} m². Laminate waste is not applied. Coverage ${presentM2(params.coverageM2)} m² gives ${rolls} whole rolls.`,
    };
  }
  return {
    quantity: round2(params.netM2),
    unit: "m2",
    itemKey,
    formula: `${name} uses the net ${presentM2(params.netM2)} m². Laminate waste is not applied. Roll coverage is unknown, so no roll count is invented.`,
  };
}

export function parseLaminateMethod(value: unknown): LaminateMethod | null {
  if (value === "floating_click_lock" || value === "glued" || value === "fastened") {
    return value;
  }
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (text.includes("floating") || text.includes("click")) return "floating_click_lock";
  if (text.includes("glue") || text.includes("glued")) return "glued";
  if (text.includes("nail") || text.includes("staple") || text.includes("fasten")) {
    return "fastened";
  }
  return null;
}

export function parseLaminateMoisture(value: unknown): LaminateMoisture | null {
  if (value === "integrated" || value === "separate" || value === "excluded") return value;
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (text.includes("separate")) return "separate";
  if (text.includes("exclud") || text.includes("no moisture")) return "excluded";
  if (text.includes("underlay includes") || text.includes("integrated")) return "integrated";
  return null;
}

export type LaminatePackageCoverage = "included" | "separate";

/** A saved subcontract rate is not evidence. Only an explicit answer counts. */
export function parseLaminatePackageCoverage(
  value: unknown
): LaminatePackageCoverage | null {
  if (value === "included" || value === "separate") return value;
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (
    text.includes("does not") ||
    text.includes("charge") ||
    text.includes("separately")
  ) {
    return "separate";
  }
  if (text.includes("covers") || text.includes("included")) return "included";
  return null;
}

export function parseLaminateSubstrate(value: unknown): LaminateSubstrate | null {
  if (value === "concrete" || value === "timber" || value === "other") return value;
  if (typeof value !== "string") return null;
  const text = normalise(value);
  if (text.includes("concrete")) return "concrete";
  if (text.includes("timber") || text.includes("wood") || text.includes("particle")) {
    return "timber";
  }
  if (text.includes("other")) return "other";
  return null;
}

export function laminateMethodFromText(text: string): LaminateMethod | null {
  const raw = normalise(text);
  const floating =
    /\bfloating\b/.test(raw) ||
    /\bclick[-\s]?lock\b/.test(raw) ||
    /\bclick[-\s]?together\b/.test(raw);
  const glued = /\bglue[d]?\s+down\b/.test(raw) || /\bglued\b/.test(raw) || /\badhesive[-\s]?fixed\b/.test(raw);
  const fastened = /\bsecret[-\s]?nail/.test(raw) || /\bnailed\b/.test(raw) || /\bstapled\b/.test(raw);
  const hits = [floating, glued, fastened].filter(Boolean).length;
  if (hits !== 1) return null;
  if (floating) return "floating_click_lock";
  if (glued) return "glued";
  return "fastened";
}

export function laminateSubstrateFromText(text: string): LaminateSubstrate | null {
  const raw = normalise(text);
  const concrete = /\bconcrete\b/.test(raw);
  const timber = /\bparticle\s*board\b/.test(raw) || /\btimber substrate\b/.test(raw) || /\bwooden floor\b/.test(raw);
  if (concrete && timber) return null;
  if (concrete) return "concrete";
  if (timber) return "timber";
  return null;
}

export function laminateMoistureFromText(text: string): LaminateMoisture | null {
  const raw = normalise(text);
  if (/\bno moisture\b|\bwithout a moisture\b|\bmoisture barrier excluded\b/.test(raw)) {
    return "excluded";
  }
  if (
    /\bunderlay (?:with|includes|including) (?:a )?(?:moisture|vapou?r)\b/.test(raw) ||
    /\bcombination underlay\b/.test(raw) ||
    /\bintegrated moisture\b/.test(raw)
  ) {
    return "integrated";
  }
  if (/\bseparate moisture\b|\bpolythene\b|\bvapou?r barrier\b|\bmoisture barrier\b/.test(raw)) {
    return "separate";
  }
  return null;
}

function coverageAfter(text: string, label: RegExp): number | null {
  const match = normalise(text).match(label);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function laminatePackCoverageFromText(text: string): number | null {
  return coverageAfter(
    text,
    /(?:each )?packs? covers?\s+(\d+(?:\.\d+)?)\s*m/
  );
}

export function laminateUnderlayCoverageFromText(text: string): number | null {
  return coverageAfter(text, /underlay rolls? covers?\s+(\d+(?:\.\d+)?)\s*m/);
}

export function laminateMoistureCoverageFromText(text: string): number | null {
  return coverageAfter(
    text,
    /(?:moisture|vapou?r|polythene) rolls? covers?\s+(\d+(?:\.\d+)?)\s*m/
  );
}

export function laminateNegatedScope(text: string): {
  preparation: boolean;
  removal: boolean;
  skirting: boolean;
} {
  const raw = normalise(text);
  const match = raw.match(/\b(?:no|without|exclud\w*)\s+([^.]{0,160})/);
  const list = match?.[1] ?? "";
  return {
    preparation: /floor preparation|levelling|leveling/.test(list),
    removal: /demolition|disposal|removal/.test(list),
    skirting: /skirting/.test(list),
  };
}

export function applyLaminateBriefFacts(
  portion: FlooringPortion,
  text: string,
  options?: { readonly skipUnderlay?: boolean }
): void {
  if (portion.specialist_kind !== "laminate") return;
  const method = laminateMethodFromText(text);
  if (method && portion.laminate_method == null) {
    portion.laminate_method = method;
    portion.laminate_method_authority = "extracted";
  }
  const substrate = laminateSubstrateFromText(text);
  if (substrate && portion.laminate_substrate == null) {
    portion.laminate_substrate = substrate;
    portion.laminate_substrate_authority = "extracted";
  }
  const moisture = laminateMoistureFromText(text);
  if (moisture && portion.laminate_moisture == null) {
    portion.laminate_moisture = moisture;
    portion.laminate_moisture_authority = "extracted";
  }
  const pack = laminatePackCoverageFromText(text);
  if (pack != null && portion.laminate_pack_coverage_m2 == null) {
    portion.laminate_pack_coverage_m2 = pack;
  }
  const underlayCoverage = laminateUnderlayCoverageFromText(text);
  if (underlayCoverage != null && portion.laminate_underlay_coverage_m2 == null) {
    portion.laminate_underlay_coverage_m2 = underlayCoverage;
  }
  const moistureCoverage = laminateMoistureCoverageFromText(text);
  if (moistureCoverage != null && portion.laminate_moisture_coverage_m2 == null) {
    portion.laminate_moisture_coverage_m2 = moistureCoverage;
  }
  const raw = normalise(text);
  if (
    !options?.skipUnderlay &&
    portion.underlay_required == null &&
    /\b(?:include|including|with) underlay\b/.test(raw)
  ) {
    portion.underlay_required = true;
    portion.underlay_authority = "extracted";
  }
  if (/\b(?:customer|client)[-\s]supplied\b/.test(raw)) {
    portion.finish_supplied_by = portion.finish_supplied_by ?? "customer";
  }
  const negated = laminateNegatedScope(text);
  if (negated.preparation) {
    portion.floor_preparation_required = false;
    portion.preparation_authority = "extracted";
  }
  if (negated.removal) {
    portion.finish_removal_required = false;
    portion.finish_removal_authority = "extracted";
  }
  if (negated.skirting) {
    portion.skirting_replacement_excluded = true;
  }
  if (
    /ready for installation/.test(normalise(text)) &&
    portion.substrate_required == null
  ) {
    portion.substrate_required = false;
    portion.substrate_required_authority = "extracted";
  }
}

export type LaminateLineRole =
  | "package"
  | "supply"
  | "underlay"
  | "moisture"
  | "install"
  | "waste"
  | "unsupported";

export type LaminateLinePlan = {
  readonly role: LaminateLineRole;
  readonly componentKey: string;
  readonly materialKey: string | null;
  readonly quantity: number;
  readonly unit: string;
  readonly description: string;
  readonly specification: string;
  readonly customerSupplied: boolean;
  readonly wasteUnresolved: boolean;
};

export type LaminateAssemblyPlan =
  | { readonly status: "needs_method" }
  | { readonly status: "needs_substrate" }
  | { readonly status: "needs_moisture" }
  | { readonly status: "needs_ownership" }
  | { readonly status: "needs_package_coverage" }
  | { readonly status: "unsupported"; readonly lines: readonly LaminateLinePlan[] }
  | { readonly status: "ready"; readonly lines: readonly LaminateLinePlan[] };

export function planLaminateAssembly(params: {
  portion: FlooringPortion;
  netM2: number;
  owner: string;
}): LaminateAssemblyPlan {
  const { portion, netM2, owner } = params;
  if (portion.specialist_kind !== "laminate") {
    return { status: "needs_method" };
  }
  if (portion.laminate_method == null) return { status: "needs_method" };
  if (portion.laminate_method !== "floating_click_lock") {
    const label =
      portion.laminate_method === "glued"
        ? "Glued laminate"
        : "Nailed or stapled laminate";
    return {
      status: "unsupported",
      lines: [
        {
          role: "unsupported",
          componentKey: "flooring.specialist.unsupported",
          materialKey: null,
          quantity: netM2,
          unit: "m2",
          description: `${owner} · ${label}`,
          specification: `${label} is recognised and is not priced by the floating click-lock recipe. No vinyl package and no laminate benchmark are applied.`,
          customerSupplied: false,
          wasteUnresolved: false,
        },
      ],
    };
  }
  if (portion.laminate_substrate == null) return { status: "needs_substrate" };
  const moistureApplies = portion.laminate_substrate === "concrete";
  if (moistureApplies && portion.laminate_moisture == null) {
    return { status: "needs_moisture" };
  }
  if (portion.finish_pricing == null) return { status: "needs_ownership" };

  const lines: LaminateLinePlan[] = [];
  const customer = portion.finish_supplied_by === "customer";
  const packageActive = portion.finish_pricing === "combined_package" && !customer;
  const packageCoversUnderlay =
    packageActive && portion.laminate_package_covers_underlay === "included";
  const packageCoversMoisture =
    packageActive && portion.laminate_package_covers_moisture === "included";
  if (
    packageActive &&
    ((portion.underlay_required === true &&
      portion.laminate_package_covers_underlay == null) ||
      (moistureApplies &&
        portion.laminate_moisture === "separate" &&
        portion.laminate_package_covers_moisture == null))
  ) {
    return { status: "needs_package_coverage" };
  }
  const supply = laminateFinishPurchase({
    netM2,
    wastePercent: portion.waste_percent,
    packCoverageM2: portion.laminate_pack_coverage_m2,
  });
  const packageCoverage =
    portion.underlay_required === true
      ? packageCoversUnderlay
        ? "The confirmed package rate covers the underlay, so it is not charged again."
        : "The underlay is charged once beside the package. The saved rate was not treated as covering it."
      : "Underlay is not part of this job.";
  const moistureCoverage = !moistureApplies
    ? "This substrate does not add a moisture line."
    : portion.laminate_moisture === "integrated"
      ? "Moisture control is inside the underlay, so no separate barrier is added."
      : portion.laminate_moisture === "excluded"
        ? "Moisture control is excluded."
        : packageCoversMoisture
          ? "The confirmed package rate covers the separate moisture barrier, so it is not charged again."
          : "The moisture barrier is charged once beside the package. The saved rate was not treated as covering it.";
  if (packageActive) {
    lines.push({
      role: "package",
      componentKey: FLOORING_LAMINATE_PACKAGE_M2,
      materialKey: null,
      quantity: netM2,
      unit: "m2",
      description: `${owner} · floating click-lock laminate supply and installation`,
      specification: `Combined package on the net ${presentM2(netM2)} m² for this floating click-lock job only. ${packageCoverage} ${moistureCoverage} Requested waste is included only when that treatment is confirmed. A saved subcontract rate does not decide coverage. No Quotr laminate benchmark. The vinyl package is not used. ${supply.formula}`,
      customerSupplied: false,
      wasteUnresolved: false,
    });
    const waste = portion.waste_percent;
    if (
      !customer &&
      waste != null &&
      waste > 0 &&
      portion.waste_treatment !== "package_covers_requested_waste"
    ) {
      const netPurchase = laminateFinishPurchase({
        netM2,
        wastePercent: 0,
        packCoverageM2: portion.laminate_pack_coverage_m2,
      });
      const extra = round2(supply.quantity - netPurchase.quantity);
      const incremental = portion.waste_treatment === "incremental_material" && extra > 0;
      lines.push({
        role: "waste",
        componentKey: "flooring.finish.waste_increment",
        materialKey: incremental ? supply.itemKey : null,
        quantity: incremental ? extra : 1,
        unit: incremental ? supply.unit : "item",
        description: `${owner} · requested laminate waste`,
        specification: incremental
          ? `Extra laminate only: ${extra} ${supply.unit}. The package quantity stays the net area.`
          : `Requested ${waste}% waste is not inside the package. Confirm the package covers it, or charge only the extra quantity.`,
        customerSupplied: false,
        wasteUnresolved: !incremental,
      });
    }
  } else if (!customer) {
    lines.push({
      role: "supply",
      componentKey: FLOORING_LAMINATE_SUPPLY_COMPONENT,
      materialKey: supply.itemKey,
      quantity: supply.quantity,
      unit: supply.unit,
      description: `${owner} · click-lock laminate supply`,
      specification: supply.formula,
      customerSupplied: false,
      wasteUnresolved: false,
    });
  } else {
    lines.push({
      role: "supply",
      componentKey: FLOORING_LAMINATE_SUPPLY_COMPONENT,
      materialKey: supply.itemKey,
      quantity: supply.quantity,
      unit: supply.unit,
      description: `${owner} · customer-supplied click-lock laminate`,
      specification: `Customer supplied the laminate. Contractor purchasing cost is 0. ${supply.formula}`,
      customerSupplied: true,
      wasteUnresolved: false,
    });
  }

  if (portion.underlay_required === true && !packageCoversUnderlay) {
    const underlay = laminateAncillaryPurchase({
      netM2,
      coverageM2: portion.laminate_underlay_coverage_m2,
      kind: "underlay",
    });
    const integrated = portion.laminate_moisture === "integrated";
    lines.push({
      role: "underlay",
      componentKey: FLOORING_LAMINATE_UNDERLAY_COMPONENT,
      materialKey: underlay.itemKey,
      quantity: underlay.quantity,
      unit: underlay.unit,
      description: `${owner} · laminate underlay`,
      specification: integrated
        ? `${underlay.formula} This underlay includes moisture control, so no separate barrier is added.`
        : underlay.formula,
      customerSupplied: false,
      wasteUnresolved: false,
    });
  }

  if (
    moistureApplies &&
    portion.laminate_moisture === "separate" &&
    !packageCoversMoisture
  ) {
    const barrier = laminateAncillaryPurchase({
      netM2,
      coverageM2: portion.laminate_moisture_coverage_m2,
      kind: "moisture",
    });
    lines.push({
      role: "moisture",
      componentKey: FLOORING_LAMINATE_MOISTURE_COMPONENT,
      materialKey: barrier.itemKey,
      quantity: barrier.quantity,
      unit: barrier.unit,
      description: `${owner} · laminate moisture barrier`,
      specification: barrier.formula,
      customerSupplied: false,
      wasteUnresolved: false,
    });
  }

  if (portion.finish_pricing === "separate_supply" || customer) {
    lines.push({
      role: "install",
      componentKey: FLOORING_LAMINATE_INSTALL_COMPONENT,
      materialKey: FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
      quantity: netM2,
      unit: "m2",
      description: `${owner} · floating click-lock installation`,
      specification: `Installation uses the net ${presentM2(netM2)} m² and company productivity ${FLOORING_LAMINATE_INSTALL_HOURS_PER_M2}. No Quotr hours default is applied. Labour cost uses a company carpenter hourly rate, not the $60 benchmark.`,
      customerSupplied: false,
      wasteUnresolved: false,
    });
  }

  return { status: "ready", lines };
}
