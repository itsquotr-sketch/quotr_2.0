/**
 * Stage 2F — who owns a flooring finish cost.
 *
 * The ordinary finish packages are one subcontract rate per net m².
 * Catalogue text includes a finish supply allowance and installation.
 * It does not publish a material/labour split or a waste percentage.
 * A separate finish-material rate is therefore not added on top.
 */

import type { OrganisationRate } from "@/components/setup/types";
import { roundMoney } from "@/lib/commercial-engine/core/money";
import type { SellAuthority } from "@/lib/commercial-engine/core/cost-first-authority";
import {
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
} from "@/lib/estimate/flooring-identities";
import {
  FLOORING_CARPET_ACCESSORIES_M2,
  FLOORING_HARDWOOD_ADHESIVE_FIXINGS_M2,
  FLOORING_HARDWOOD_SUPPLY_LM,
  FLOORING_TILE_ADHESIVE_GROUT_M2,
  FLOORING_TILE_SUPPLY_EACH,
  FLOORING_VINYL_ADHESIVE_ACCESSORIES_M2,
  FLOORING_VINYL_SUPPLY_M2,
  flooringWasteExtra,
  type FlooringSupplyMeasure,
} from "@/lib/estimate/flooring-purchasing";
import type { FlooringPortion } from "@/lib/estimate/flooring-portions";

export type FlooringFinishPricing = "combined_package" | "separate_supply";
export type FlooringWasteTreatment =
  | "package_covers_requested_waste"
  | "incremental_material";

export type FlooringCostOwnerMode =
  | "customer"
  | "separate"
  | "combined"
  | "decision_required";

type PackageCoverage = {
  readonly includes: string;
  readonly excludes: string;
};

const FINISH_COVERAGE: Record<string, PackageCoverage> = {
  [FLOORING_CARPET_SUPPLY_INSTALL_M2]: {
    includes:
      "ordinary carpet supply allowance, ordinary straight-lay installation, and standard installation accessories",
    excludes:
      "underlay, preparation, removal, substrate, framing, disposal, and a stated waste percentage",
  },
  [FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2]: {
    includes:
      "ordinary vinyl plank/LVT supply allowance, ordinary straight-lay installation, and standard adhesive/accessories",
    excludes:
      "sheet vinyl, preparation, removal, substrate, framing, disposal, and a stated waste percentage",
  },
  [FLOORING_TILE_SUPPLY_INSTALL_M2]: {
    includes:
      "ordinary floor-tile supply allowance, standard straight-lay installation, and ordinary adhesive and grout",
    excludes:
      "waterproofing, preparation, removal, substrate, disposal, and a stated waste percentage",
  },
  [FLOORING_HARDWOOD_SUPPLY_INSTALL_M2]: {
    includes:
      "ordinary prefinished timber-flooring supply allowance, ordinary straight-lay installation, and standard adhesive/fixings",
    excludes:
      "preparation, substrate, framing, removal, disposal, sanding or coating, and a stated waste percentage",
  },
};

const ADDON_COVERAGE: Record<string, PackageCoverage> = {
  [FLOORING_CARPET_UNDERLAY_SUPPLY_INSTALL_M2]: {
    includes: "ordinary standard underlay supply and ordinary installation",
    excludes: "the carpet finish, preparation, removal, and finish waste",
  },
  [FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2]: {
    includes: "ordinary minor floor preparation or self-levelling",
    excludes: "finish supply, finish installation, and finish waste",
  },
};

export function flooringFinishSupplyKey(
  finish: FlooringPortion["finish_type"]
): string | null {
  if (finish === "vinyl_plank") return FLOORING_VINYL_SUPPLY_M2;
  if (finish === "tile") return FLOORING_TILE_SUPPLY_EACH;
  if (finish === "hardwood") return FLOORING_HARDWOOD_SUPPLY_LM;
  return null;
}

export function flooringAncillaryMaterialKey(
  finish: FlooringPortion["finish_type"]
): string | null {
  if (finish === "vinyl_plank") return FLOORING_VINYL_ADHESIVE_ACCESSORIES_M2;
  if (finish === "tile") return FLOORING_TILE_ADHESIVE_GROUT_M2;
  if (finish === "hardwood") return FLOORING_HARDWOOD_ADHESIVE_FIXINGS_M2;
  if (finish === "carpet") return FLOORING_CARPET_ACCESSORIES_M2;
  return null;
}

export function flooringAncillaryLabel(
  finish: FlooringPortion["finish_type"]
): string | null {
  if (finish === "vinyl_plank") return "Vinyl adhesive and accessories";
  if (finish === "tile") return "Tile adhesive and grout";
  if (finish === "hardwood") return "Hardwood adhesive and fixings";
  if (finish === "carpet") return "Carpet installation accessories";
  return null;
}

const ANCILLARY_SPECIFICATION =
  "Included in the combined supply-and-install package. Installation hours do not include these consumables. No separate rate is invented.";

export function flooringAncillarySpecification(): string {
  return ANCILLARY_SPECIFICATION;
}

function supportedFinish(finish: FlooringPortion["finish_type"]): boolean {
  return (
    finish === "carpet" ||
    finish === "vinyl_plank" ||
    finish === "tile" ||
    finish === "hardwood"
  );
}

export type FlooringWasteResolution =
  | { readonly kind: "none" }
  | { readonly kind: "confirmed" }
  | {
      readonly kind: "incremental";
      readonly quantity: number;
      readonly unit: string;
      readonly materialKey: string;
    }
  | {
      readonly kind: "open";
      readonly quantity: number;
      readonly unit: string;
      readonly message: string;
    };

export function flooringWasteResolution(params: {
  portion: Pick<
    FlooringPortion,
    | "finish_type"
    | "finish_pricing"
    | "finish_supplied_by"
    | "waste_percent"
    | "waste_treatment"
    | "label"
  >;
  purchasing: FlooringSupplyMeasure | null;
  rates: readonly OrganisationRate[];
}): FlooringWasteResolution {
  const { portion } = params;
  const purchasingWaste =
    params.purchasing && params.purchasing.kind !== "none"
      ? params.purchasing.wastePercent
      : null;
  const waste = portion.waste_percent ?? purchasingWaste;
  if (
    portion.finish_supplied_by === "customer" ||
    portion.finish_pricing === "separate_supply" ||
    !supportedFinish(portion.finish_type) ||
    waste == null ||
    waste <= 0
  ) {
    return { kind: "none" };
  }
  if (portion.waste_treatment === "package_covers_requested_waste") {
    return { kind: "confirmed" };
  }
  const where = portion.label?.trim() || "This flooring area";
  const extra = params.purchasing ? flooringWasteExtra(params.purchasing) : null;
  const materialKey = flooringFinishSupplyKey(portion.finish_type);
  if (portion.waste_treatment === "incremental_material") {
    if (!extra || !materialKey) {
      return {
        kind: "open",
        quantity: 1,
        unit: "item",
        message: `${where} asks for ${waste}% waste. Only the extra quantity can be charged, and no extra purchase quantity is known. The combined package is not increased by ${waste}%.`,
      };
    }
    const named = findFinishMaterialRate(params.rates, materialKey);
    if (!named) {
      return {
        kind: "open",
        quantity: extra.quantity,
        unit: extra.unit,
        message: `${where} asks to charge only the extra ${extra.quantity} ${extra.unit} of finish waste. No finish material rate is saved, so that extra is not priced and no rate is invented.`,
      };
    }
    return {
      kind: "incremental",
      quantity: extra.quantity,
      unit: extra.unit,
      materialKey,
    };
  }
  const extraText = extra
    ? ` The extra quantity is ${extra.quantity} ${extra.unit} and is not priced.`
    : " No extra purchase quantity is known, so none is priced.";
  return {
    kind: "open",
    quantity: extra?.quantity ?? 1,
    unit: extra?.unit ?? "item",
    message: `${where} requests ${waste}% waste. The combined package excludes that waste.${extraText} Choosing the combined package does not include it. Confirm that this package rate covers the requested waste, charge only the extra quantity at a known finish material rate, or price supply and installation separately.`,
  };
}

export function findFinishMaterialRate(
  rates: readonly OrganisationRate[],
  itemKey: string
): OrganisationRate | undefined {
  const matches = rates.filter(
    (rate) =>
      rate.active &&
      rate.item_key === itemKey &&
      (rate.rate_type === "project_material" || rate.rate_type === "material") &&
      rate.cost_rate != null &&
      rate.cost_rate > 0
  );
  return (
    matches.find((rate) => rate.rate_type === "project_material") ??
    matches.find((rate) => rate.rate_type === "material")
  );
}

export function flooringCostOwnerMode(params: {
  finish: FlooringPortion["finish_type"];
  finishPricing: FlooringFinishPricing | null;
  customerSupplied: boolean;
  rates: readonly OrganisationRate[];
}): FlooringCostOwnerMode {
  if (params.customerSupplied) return "customer";
  if (params.finishPricing === "separate_supply") return "separate";
  if (params.finishPricing === "combined_package") return "combined";
  const key = flooringFinishSupplyKey(params.finish);
  if (key && findFinishMaterialRate(params.rates, key)) return "decision_required";
  return "combined";
}

function money(value: number): string {
  return `$${roundMoney(value).toFixed(2)}`;
}

function quantityText(value: number, unit: string): string {
  const rounded = roundMoney(value);
  const shown = Number.isInteger(rounded) ? rounded.toFixed(2) : String(rounded);
  return `${shown} ${unit}`;
}

function wasteSentence(
  purchasing: FlooringSupplyMeasure | null,
  coverage: "open" | "confirmed" | "absent"
): string {
  if (!purchasing || purchasing.kind === "none" || coverage === "absent") {
    return "No waste percentage is stated.";
  }
  if (coverage === "confirmed") {
    if (purchasing.kind === "carpet_unresolved") {
      return `${purchasing.limitation} This package rate was explicitly confirmed to cover that requested waste. The rate was not increased and was not split.`;
    }
    const stated =
      purchasing.kind === "area"
        ? `supply quantity ${quantityText(purchasing.supplyM2, "m²")}`
        : purchasing.kind === "tiles"
          ? `${purchasing.supplyTiles} whole tiles`
          : quantityText(purchasing.supplyLinealM, "lineal m");
    return `The requested waste is ${purchasing.wastePercent}% (${stated}). This package rate was explicitly confirmed to cover that waste. The rate was not increased and was not split.`;
  }
  if (purchasing.kind === "area") {
    return `Stated waste is ${purchasing.wastePercent}% (supply quantity ${quantityText(purchasing.supplyM2, "m²")}). That quantity is not inside this rate and is not priced. Choosing this combined package does not include the requested waste.`;
  }
  if (purchasing.kind === "tiles") {
    return `Stated waste is ${purchasing.wastePercent}% (${purchasing.supplyTiles} whole tiles). That count is not inside this rate and is not priced. Choosing this combined package does not include the requested waste.`;
  }
  if (purchasing.kind === "lineal") {
    return `Stated waste is ${purchasing.wastePercent}% (${quantityText(purchasing.supplyLinealM, "lineal m")}). Box coverage is unknown, so no pack count is invented. That length is not inside this rate and is not priced.`;
  }
  return `${purchasing.limitation} Choosing this combined package does not include the requested waste, and no roll quantity is priced.`;
}

function sellSentence(params: {
  marginPercent: number | null;
  sellAuthority: SellAuthority;
}): string {
  if (
    params.sellAuthority === "derived_from_gross_margin" &&
    params.marginPercent != null
  ) {
    return ` Client sell uses ${params.marginPercent}% gross margin: sell = cost / (1 − ${params.marginPercent}/100).`;
  }
  return " Client sell uses the saved sell rate. The package cost is not reinterpreted as labour-only.";
}

export function flooringPackageOwnershipNote(params: {
  itemKey: string;
  netQuantity: number;
  unit: string;
  unitCost: number;
  directCost: number;
  clientSell: number;
  marginPercent: number | null;
  sellAuthority: SellAuthority;
  purchasing: FlooringSupplyMeasure | null;
  wasteCoverage: "open" | "confirmed" | "absent";
  unusedMaterialRate: number | null;
  decisionRequired: boolean;
}): string | null {
  const finish = FINISH_COVERAGE[params.itemKey];
  const addon = ADDON_COVERAGE[params.itemKey];
  const coverage = finish ?? addon;
  if (!coverage) return null;
  const basis = finish
    ? `Quantity basis: ${quantityText(params.netQuantity, params.unit)} net installed area.`
    : `Quantity basis: ${quantityText(params.netQuantity, params.unit)} net area.`;
  const moneySentence = `Internal unit cost ${money(params.unitCost)}/${params.unit}. Direct cost ${money(params.directCost)}. Client sell ${money(params.clientSell)}.`;
  const owner = `This combined rate includes ${coverage.includes}. It excludes ${coverage.excludes}.`;
  const waste = finish
    ? wasteSentence(params.purchasing, params.wasteCoverage)
    : "Finish waste is not applied to this line.";
  const unused =
    params.unusedMaterialRate != null && !params.decisionRequired
      ? ` The saved finish material rate of ${money(params.unusedMaterialRate)} is not applied.`
      : "";
  const decision = params.decisionRequired
    ? ` A saved finish material rate${params.unusedMaterialRate != null ? ` of ${money(params.unusedMaterialRate)}` : ""} is not applied. Choose the combined package, or price finish supply and installation separately. The package cannot be split, so both are not charged.`
    : "";
  return `${basis} ${moneySentence}${sellSentence(params)} ${owner} ${waste}${unused}${decision} The combined rate is not split into material and labour.`;
}
