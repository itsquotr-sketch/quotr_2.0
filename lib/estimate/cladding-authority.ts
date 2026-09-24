/**
 * CLADDING-04B — Quotr material COST and productivity authority.
 *
 * Direct COST ex GST. No default sell. Physical quantities stay in
 * cladding-physical.ts. Commercial line items are not created here.
 */

import type { OrganisationRate } from "@/components/setup/types";
import {
  CLADDING_CAVITY_INSTALL_HOURS_PER_M2,
  CLADDING_CAVITY_TIMBER_BATTEN_M2,
  CLADDING_BOARD_AND_BATTEN_BATTEN_INSTALL_HOURS_PER_LM,
  CLADDING_BOARD_AND_BATTEN_REMOVE_HOURS_PER_M2,
  CLADDING_BOARD_AND_BATTEN_SHEET_INSTALL_HOURS_PER_M2,
  CLADDING_BOARD_AND_BATTEN_SHEET_M2,
  CLADDING_CARPENTER_LABOUR_RATE_KEY,
  CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
  CLADDING_CUSTOM_REMOVE_HOURS_PER_M2,
  CLADDING_FIBRE_CEMENT_WEATHERBOARD_150_LM,
  CLADDING_FIBRE_CEMENT_WEATHERBOARD_180_LM,
  CLADDING_FIBRE_CEMENT_WEATHERBOARD_INSTALL_HOURS_PER_LM,
  CLADDING_FIBRE_CEMENT_WEATHERBOARD_REMOVE_HOURS_PER_M2,
  CLADDING_TIMBER_BEVELBACK_142X18_LM,
  CLADDING_TIMBER_BEVELBACK_187X18_LM,
  CLADDING_TIMBER_BEVELBACK_215X18_LM,
  CLADDING_TIMBER_BEVELBACK_230X18_LM,
  CLADDING_TIMBER_BEVELBACK_INSTALL_HOURS_PER_LM,
  CLADDING_TIMBER_BEVELBACK_REMOVE_HOURS_PER_M2,
  CLADDING_TIMBER_RUSTICATED_135X18_LM,
  CLADDING_TIMBER_RUSTICATED_180X18_LM,
  CLADDING_TIMBER_RUSTICATED_215X18_LM,
  CLADDING_TIMBER_RUSTICATED_230X18_LM,
  CLADDING_TIMBER_RUSTICATED_INSTALL_HOURS_PER_LM,
  CLADDING_TIMBER_RUSTICATED_REMOVE_HOURS_PER_M2,
  CLADDING_TIMBER_VERTICAL_SHIPLAP_135X21_LM,
  CLADDING_TIMBER_VERTICAL_SHIPLAP_90X21_LM,
  CLADDING_TIMBER_VERTICAL_SHIPLAP_INSTALL_HOURS_PER_LM,
  CLADDING_RIGID_AIR_BARRIER_INSTALL_HOURS_PER_M2,
  CLADDING_RIGID_AIR_BARRIER_M2,
  CLADDING_TIMBER_VERTICAL_SHIPLAP_REMOVE_HOURS_PER_M2,
  CLADDING_WALL_UNDERLAY_FLEXIBLE_M2,
  CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2,
  claddingBattenMaterialKey,
} from "@/lib/estimate/cladding-identities";

export const CLADDING_MATERIAL_RATE_DESCRIPTION =
  "Direct COST ex GST for the nominated cladding component, including an ordinary fixing allowance. Excludes waste, cavity construction, wall underlay or rigid air barrier, trims, corners, flashings, scaffold, painting, labour, removal and disposal." as const;

export const CLADDING_SHEET_MATERIAL_RATE_DESCRIPTION =
  `${CLADDING_MATERIAL_RATE_DESCRIPTION} Priced on physical board square metres only. The minimum whole-sheet equivalent is informational and does not multiply this rate.` as const;

export const CLADDING_INSTALL_PRODUCTIVITY_DESCRIPTION =
  "Person-hours to install this cladding component on the physical quantity. Includes ordinary setting out, cutting and fixing. Excludes cavity, underlay or rigid air barrier, trims, painting, scaffold, removal and disposal. Labour COST uses labour.carpenter.hour." as const;

export const CLADDING_REMOVAL_PRODUCTIVITY_DESCRIPTION =
  "Person-hours to remove this existing cladding on the net area. Excludes disposal, cartage, new material and installation. Labour COST uses labour.carpenter.hour." as const;

export type CladdingMaterialFamilyId =
  | "cladding-bevelback"
  | "cladding-rusticated"
  | "cladding-vertical-shiplap"
  | "cladding-fibre-cement"
  | "cladding-sheet-boards"
  | "cladding-battens"
  | "cladding-accessories";

export type CladdingMaterialBenchmark = {
  readonly key: string;
  readonly label: string;
  readonly unit: "lm" | "m2";
  readonly costExGst: number;
  readonly familyId: CladdingMaterialFamilyId;
  readonly description: string;
};

export type CladdingProductivityGroup = "install" | "removal" | "accessory";

export type CladdingProductivityBenchmark = {
  readonly key: string;
  readonly label: string;
  readonly unit: "lm" | "m2";
  readonly hoursPerUnit: number;
  readonly group: CladdingProductivityGroup;
  readonly description: string;
};

export const CLADDING_MATERIAL_BENCHMARKS: readonly CladdingMaterialBenchmark[] = [
  bench("cladding-bevelback", CLADDING_TIMBER_BEVELBACK_142X18_LM, "142 × 18 mm bevelback weatherboard", "lm", 12),
  bench("cladding-bevelback", CLADDING_TIMBER_BEVELBACK_187X18_LM, "187 × 18 mm bevelback weatherboard", "lm", 15),
  bench("cladding-bevelback", CLADDING_TIMBER_BEVELBACK_215X18_LM, "215 × 18 mm bevelback weatherboard", "lm", 18),
  bench("cladding-bevelback", CLADDING_TIMBER_BEVELBACK_230X18_LM, "230 × 18 mm bevelback weatherboard", "lm", 19),
  bench("cladding-rusticated", CLADDING_TIMBER_RUSTICATED_135X18_LM, "135 × 18 mm rusticated weatherboard", "lm", 13),
  bench("cladding-rusticated", CLADDING_TIMBER_RUSTICATED_180X18_LM, "180 × 18 mm rusticated weatherboard", "lm", 16),
  bench("cladding-rusticated", CLADDING_TIMBER_RUSTICATED_215X18_LM, "215 × 18 mm rusticated weatherboard", "lm", 19),
  bench("cladding-rusticated", CLADDING_TIMBER_RUSTICATED_230X18_LM, "230 × 18 mm rusticated weatherboard", "lm", 20),
  bench("cladding-vertical-shiplap", CLADDING_TIMBER_VERTICAL_SHIPLAP_90X21_LM, "90 × 21 mm vertical shiplap", "lm", 10),
  bench("cladding-vertical-shiplap", CLADDING_TIMBER_VERTICAL_SHIPLAP_135X21_LM, "135 × 21 mm vertical shiplap", "lm", 14),
  bench("cladding-fibre-cement", CLADDING_FIBRE_CEMENT_WEATHERBOARD_150_LM, "150 mm fibre-cement weatherboard", "lm", 12),
  bench("cladding-fibre-cement", CLADDING_FIBRE_CEMENT_WEATHERBOARD_180_LM, "180 mm fibre-cement weatherboard", "lm", 18.5),
  {
    key: CLADDING_BOARD_AND_BATTEN_SHEET_M2,
    label: "Board-and-batten sheet board",
    unit: "m2",
    costExGst: 65,
    familyId: "cladding-sheet-boards",
    description: CLADDING_SHEET_MATERIAL_RATE_DESCRIPTION,
  },
  batten(45, 19, 3.5),
  batten(45, 20, 3.6),
  batten(65, 19, 4.75),
  batten(65, 20, 4.9),
  batten(90, 19, 6.5),
  batten(90, 20, 6.7),
  {
    key: CLADDING_CAVITY_TIMBER_BATTEN_M2,
    label: "Drained timber cavity",
    unit: "m2",
    costExGst: 9,
    familyId: "cladding-accessories",
    description:
      "Direct COST ex GST for ordinary cavity battens and ordinary fixings. Quantity is the net cladding area. Excludes structural framing, proprietary engineered systems, flashings, wrap or rigid air barrier, remediation and scaffold.",
  },
  {
    key: CLADDING_WALL_UNDERLAY_FLEXIBLE_M2,
    label: "Flexible wall underlay",
    unit: "m2",
    costExGst: 5,
    familyId: "cladding-accessories",
    description:
      "Direct COST ex GST for flexible wall underlay. Quantity is the gross wall area. Separate from rigid air barrier.",
  },
  {
    key: CLADDING_RIGID_AIR_BARRIER_M2,
    label: "Rigid air barrier",
    unit: "m2",
    costExGst: 28,
    familyId: "cladding-accessories",
    description:
      "Direct COST ex GST for a rigid air barrier. Quantity is the gross wall area. Separate from flexible wall underlay.",
  },
];

export const CLADDING_PRODUCTIVITY_BENCHMARKS: readonly CladdingProductivityBenchmark[] = [
  hours("install", CLADDING_TIMBER_BEVELBACK_INSTALL_HOURS_PER_LM, "Bevelback weatherboard install", "lm", 0.12),
  hours("install", CLADDING_TIMBER_RUSTICATED_INSTALL_HOURS_PER_LM, "Rusticated weatherboard install", "lm", 0.12),
  hours("install", CLADDING_TIMBER_VERTICAL_SHIPLAP_INSTALL_HOURS_PER_LM, "Vertical shiplap install", "lm", 0.11),
  hours("install", CLADDING_FIBRE_CEMENT_WEATHERBOARD_INSTALL_HOURS_PER_LM, "Fibre-cement weatherboard install", "lm", 0.13),
  hours("install", CLADDING_BOARD_AND_BATTEN_SHEET_INSTALL_HOURS_PER_M2, "Board-and-batten sheet install", "m2", 0.65),
  hours("install", CLADDING_BOARD_AND_BATTEN_BATTEN_INSTALL_HOURS_PER_LM, "Board-and-batten batten install", "lm", 0.08),
  hours("removal", CLADDING_TIMBER_BEVELBACK_REMOVE_HOURS_PER_M2, "Bevelback weatherboard removal", "m2", 0.3),
  hours("removal", CLADDING_TIMBER_RUSTICATED_REMOVE_HOURS_PER_M2, "Rusticated weatherboard removal", "m2", 0.3),
  hours("removal", CLADDING_TIMBER_VERTICAL_SHIPLAP_REMOVE_HOURS_PER_M2, "Vertical shiplap removal", "m2", 0.35),
  hours("removal", CLADDING_BOARD_AND_BATTEN_REMOVE_HOURS_PER_M2, "Board-and-batten removal", "m2", 0.4),
  hours("removal", CLADDING_FIBRE_CEMENT_WEATHERBOARD_REMOVE_HOURS_PER_M2, "Fibre-cement weatherboard removal", "m2", 0.4),
  {
    key: CLADDING_CAVITY_INSTALL_HOURS_PER_M2,
    label: "Drained timber cavity install",
    unit: "m2",
    hoursPerUnit: 0.15,
    group: "accessory",
    description:
      "Person-hours to install ordinary cavity battens on the net cladding area. Labour COST uses labour.carpenter.hour. Excludes structural framing, proprietary systems, flashings, wrap and scaffold.",
  },
  {
    key: CLADDING_WALL_UNDERLAY_INSTALL_HOURS_PER_M2,
    label: "Flexible wall underlay install",
    unit: "m2",
    hoursPerUnit: 0.08,
    group: "accessory",
    description:
      "Person-hours to install flexible wall underlay on the gross wall area. Labour COST uses labour.carpenter.hour. Separate from rigid air barrier.",
  },
  {
    key: CLADDING_RIGID_AIR_BARRIER_INSTALL_HOURS_PER_M2,
    label: "Rigid air barrier install",
    unit: "m2",
    hoursPerUnit: 0.18,
    group: "accessory",
    description:
      "Person-hours to install a rigid air barrier on the gross wall area. Labour COST uses labour.carpenter.hour. Separate from flexible wall underlay.",
  },
];

const MATERIAL_BY_KEY = new Map(
  CLADDING_MATERIAL_BENCHMARKS.map((row) => [row.key, row])
);
const PRODUCTIVITY_BY_KEY = new Map(
  CLADDING_PRODUCTIVITY_BENCHMARKS.map((row) => [row.key, row])
);

export const CLADDING_UNRESOLVED_AUTHORITY_KEYS = [
  CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
  CLADDING_CUSTOM_REMOVE_HOURS_PER_M2,
] as const;

export type CladdingAuthoritySource = "company" | "quotr" | "pricing_required";

export type CladdingAuthorityResolution = {
  readonly identity: string;
  readonly source: CladdingAuthoritySource;
  readonly value: number | null;
  readonly unit: string | null;
};

export function claddingMaterialBenchmark(
  key: string
): CladdingMaterialBenchmark | undefined {
  return MATERIAL_BY_KEY.get(key);
}

export function claddingProductivityBenchmark(
  key: string
): CladdingProductivityBenchmark | undefined {
  return PRODUCTIVITY_BY_KEY.get(key);
}

/**
 * Extended material COST on the physical purchase quantity.
 * Informational sheet count is not an input.
 */
export function claddingMaterialExtendedCost(
  unitCostExGst: number,
  purchaseQuantity: number
): number {
  return unitCostExGst * purchaseQuantity;
}

export function resolveCladdingMaterialAuthority(params: {
  identity: string;
  rates?: readonly OrganisationRate[];
  allowBenchmarkRates?: boolean;
}): CladdingAuthorityResolution {
  const benchmark = MATERIAL_BY_KEY.get(params.identity);
  if (!benchmark) {
    return unresolved(params.identity);
  }
  return resolveRegistered({
    identity: params.identity,
    rates: params.rates,
    rateType: "material",
    unit: benchmark.unit,
    quotrValue: benchmark.costExGst,
    allowBenchmarkRates: params.allowBenchmarkRates,
  });
}

export function resolveCladdingProductivityAuthority(params: {
  identity: string;
  rates?: readonly OrganisationRate[];
  allowBenchmarkRates?: boolean;
}): CladdingAuthorityResolution {
  const benchmark = PRODUCTIVITY_BY_KEY.get(params.identity);
  if (!benchmark) {
    return unresolved(params.identity);
  }
  return resolveRegistered({
    identity: params.identity,
    rates: params.rates,
    rateType: "productivity",
    unit: benchmark.unit,
    quotrValue: benchmark.hoursPerUnit,
    allowBenchmarkRates: params.allowBenchmarkRates,
  });
}

export function resolveCladdingCarpenterHourlyAuthority(params: {
  rates?: readonly OrganisationRate[];
  allowBenchmarkRates?: boolean;
  quotrCarpenterCost: number | null;
}): CladdingAuthorityResolution {
  const company = winningCompanyValue({
    rates: params.rates,
    identity: CLADDING_CARPENTER_LABOUR_RATE_KEY,
    rateType: "labour",
    unit: "hour",
  });
  if (company != null) {
    return {
      identity: CLADDING_CARPENTER_LABOUR_RATE_KEY,
      source: "company",
      value: company,
      unit: "hour",
    };
  }
  const allow = params.allowBenchmarkRates !== false;
  const quotr =
    allow && positive(params.quotrCarpenterCost) != null
      ? positive(params.quotrCarpenterCost)
      : null;
  if (quotr != null) {
    return {
      identity: CLADDING_CARPENTER_LABOUR_RATE_KEY,
      source: "quotr",
      value: quotr,
      unit: "hour",
    };
  }
  return unresolved(CLADDING_CARPENTER_LABOUR_RATE_KEY);
}

function bench(
  familyId: CladdingMaterialFamilyId,
  key: string,
  label: string,
  unit: "lm" | "m2",
  costExGst: number
): CladdingMaterialBenchmark {
  return {
    key,
    label,
    unit,
    costExGst,
    familyId,
    description: CLADDING_MATERIAL_RATE_DESCRIPTION,
  };
}

function batten(
  widthMm: number,
  thicknessMm: number,
  costExGst: number
): CladdingMaterialBenchmark {
  const key = claddingBattenMaterialKey(widthMm, thicknessMm);
  if (!key) {
    throw new Error(`Cladding batten identity missing for ${widthMm}x${thicknessMm}`);
  }
  return bench(
    "cladding-battens",
    key,
    `${widthMm} × ${thicknessMm} mm cladding batten`,
    "lm",
    costExGst
  );
}

function hours(
  group: CladdingProductivityGroup,
  key: string,
  label: string,
  unit: "lm" | "m2",
  hoursPerUnit: number
): CladdingProductivityBenchmark {
  return {
    key,
    label,
    unit,
    hoursPerUnit,
    group,
    description:
      group === "install"
        ? CLADDING_INSTALL_PRODUCTIVITY_DESCRIPTION
        : CLADDING_REMOVAL_PRODUCTIVITY_DESCRIPTION,
  };
}

function unresolved(identity: string): CladdingAuthorityResolution {
  return {
    identity,
    source: "pricing_required",
    value: null,
    unit: null,
  };
}

function resolveRegistered(params: {
  identity: string;
  rates?: readonly OrganisationRate[];
  rateType: string;
  unit: string;
  quotrValue: number;
  allowBenchmarkRates?: boolean;
}): CladdingAuthorityResolution {
  const company = winningCompanyValue(params);
  if (company != null) {
    return {
      identity: params.identity,
      source: "company",
      value: company,
      unit: params.unit,
    };
  }
  if (params.allowBenchmarkRates === false) {
    return unresolved(params.identity);
  }
  return {
    identity: params.identity,
    source: "quotr",
    value: params.quotrValue,
    unit: params.unit,
  };
}

/** Positive exact company COST/hours for a Cladding row. Zero and a mismatched unit do not win. */
export function claddingDisplayedCompanyValue(params: {
  identity: string;
  rate: OrganisationRate | null;
  rateType: string;
  unit: string;
}): number | null {
  if (!params.rate) return null;
  return winningCompanyValue({
    rates: [params.rate],
    identity: params.identity,
    rateType: params.rateType,
    unit: params.unit,
  });
}

function winningCompanyValue(params: {
  rates?: readonly OrganisationRate[];
  identity: string;
  rateType: string;
  unit: string;
}): number | null {
  const row = (params.rates ?? []).find(
    (rate) =>
      rate.item_key === params.identity &&
      rate.rate_type === params.rateType &&
      rate.active &&
      unitsMatch(rate.unit, params.unit) &&
      positive(rate.cost_rate) != null
  );
  return row ? positive(row.cost_rate) : null;
}

function positive(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function unitsMatch(actual: string, expected: string): boolean {
  return normalizeUnit(actual) === normalizeUnit(expected);
}

function normalizeUnit(unit: string): string {
  const value = unit.toLowerCase().replace("m²", "m2").replace(/\s+/g, "");
  if (value === "hr" || value === "hours" || value === "h") return "hour";
  if (value === "linearmetre" || value === "linearmeter" || value === "linm") {
    return "lm";
  }
  return value;
}
