/**
 * RETAINING-WALL-MATURITY-1B — component commercial authority.
 *
 * Physical authority and money authority are independent. A detailed
 * physical model does not promote detailed money until commercial
 * coverage is complete. Missing rates stay PRICING_REQUIRED. Package
 * remains Quick Estimate money during that migration.
 */

import type {
  OrganisationRate,
  OrganisationSettings,
} from "@/components/setup/types";
import {
  hasTrustedPhysicalQuantity,
  resolveComponentCommercialAuthority,
  type ComponentCommercialAuthority,
} from "@/lib/estimate/component-commercial-authority";
import { getBooleanFact, getStringFact, round2 as round2 } from "@/lib/estimate/facts";
import {
  resolveSpoilRemoval,
  RW_SPOIL_REMOVAL_EXCEEDS_MEASURED,
  RW_SPOIL_REMOVAL_MISSING_QUANTITY,
  RW_SPOIL_REMOVAL_MISSING_RATE,
} from "@/lib/estimate/retaining-wall-spoil-removal";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { MATERIAL_RATE_KEYS } from "@/lib/estimate/material-rate-keys";
import { findCompanyProductivityRate } from "@/lib/estimate/productivity";
import { rateUnitsMatch, resolveLabourRate } from "@/lib/estimate/rates";
import { resolveStructuralMaterialRequirementRate } from "@/lib/estimate/resolve-structural-material-rate";
import type {
  EstimateRequirement,
  LabourRequirement,
  MaterialRequirement,
  PlantRequirement,
  RequirementRateSource,
} from "@/lib/estimate/requirements";
import { buildRequirementId } from "@/lib/estimate/requirement-id";
import { normalizeRequirement } from "@/lib/estimate/requirement-normalize";
import {
  H5_SED_POLE_IDENTITY,
  HOUSE_PILE_125_RW_IDENTITY,
  h5SedStockIdentity,
  isRwTimberPileStockComponent,
  rwTimberPileStockComponentKey,
  RW_HOUSE_PILE_125_KEY,
  RW_BACKFILL_COMPONENT,
  RW_BACKFILL_LABOUR_COMPONENT,
  RW_EXCAVATION_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_EXCAVATION_SUBCONTRACT_COMPONENT,
  RW_SPOIL_DISPOSAL_COMPONENT,
  RW_SPOIL_REMOVAL_ALL_IN_M3_KEY,
  RW_SPOIL_REMOVAL_PORTION_KEY,
  RW_SPOIL_REMOVAL_VOLUME_KEY,
  RW_FACE_AREA_COMPONENT,
  RW_MASONRY_BLOCK_LABOUR_COMPONENT,
  RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT,
  RW_MASONRY_CORE_LABOUR_COMPONENT,
  RW_MASONRY_FOOTING_LABOUR_COMPONENT,
  RW_MASONRY_REBAR_LABOUR_COMPONENT,
  RW_MASONRY_SUBBASE_LABOUR_COMPONENT,
  RW_MASONRY_WATERPROOF_LABOUR_COMPONENT,
  RW_MASONRY_WATERPROOF_SUBCONTRACT_COMPONENT,
  RW_MASONRY_BLOCKS_COMPONENT,
  RW_MASONRY_CORE_COMPONENT,
  RW_MASONRY_FOOTING_COMPONENT,
  RW_MASONRY_SUBBASE_COMPONENT,
  RW_MASONRY_WATERPROOF_COMPONENT,
  RW_DRAINAGE_LABOUR_COMPONENT,
  RW_NOVACOIL_COMPONENT,
  RW_SLEEPER_COMPONENT,
  RW_SLEEPER_CONCRETE_COMPONENT,
  RW_SLEEPER_POSTS_EA_COMPONENT,
  RW_SLEEPER_POSTS_LM_COMPONENT,
  RW_SLEEPER_POSTS_PROCURE_COMPONENT,
  RW_SLEEPER_PLANT_COMPONENT,
  RW_SLEEPER_PREMIX_20KG_KEY,
  RW_PREMIX_20KG_KEY,
  RW_STEEL_POST_KEY,
  STEEL_RW_POST_IDENTITY,
  RW_SLEEPER_CONCRETE_LABOUR_COMPONENT,
  RW_SLEEPER_FACE_LABOUR_COMPONENT,
  RW_SLEEPER_POST_LABOUR_COMPONENT,
  RW_MASONRY_REBAR_COMPONENT,
  RW_TIMBER_FACE_LABOUR_COMPONENT,
  RW_TIMBER_FIXINGS_COMPONENT,
  RW_TIMBER_PILE_LABOUR_COMPONENT,
  RW_TIMBER_PILES_EA_COMPONENT,
  RW_TIMBER_PILES_LM_COMPONENT,
  RW_TIMBER_PILES_STOCK_COMPONENT,
  RW_TIMBER_PLANT_COMPONENT,
  RW_TIMBER_BOARDS_COMPONENT,
} from "@/lib/estimate/retaining-wall-identities";
import { planningMaterial as planningMaterial } from "@/lib/estimate/retaining-wall-planning";
import type { RetainingWallPhysicalModel } from "@/lib/estimate/retaining-wall-physical";
import {
  RW_H5_SED_CLASS_DISCLOSURE,
  procureTimberHousePiles,
  procureTimberPiles,
} from "@/lib/estimate/retaining-wall-pile-procurement";
import {
  isHousePileMaterial,
  retainingWallExcavationHoursStarter,
  retainingWallExcavationProductivityKey,
  RW_DRAINAGE_SOCK_COMPONENT,
  RW_DRAINAGE_SOCK_KEY,
  RW_DRAINAGE_SOCK_STARTER_COST_PER_LM,
  RW_TIMBER_CONCRETE_COMPONENT,
  RW_TIMBER_CONCRETE_LABOUR_COMPONENT,
  RW_TIMBER_CONCRETE_HOURS_STARTER,
} from "@/lib/estimate/retaining-wall-family-coverage";
import {
  RW_MINI_EXCAVATOR_DAY_BASIS,
  RW_MINI_EXCAVATOR_DAY_COST_EX_GST,
  RW_MINI_EXCAVATOR_DAY_KEY,
  RW_TIMBER_COMPACTION_METHOD,
  RW_TIMBER_EXCAVATION_SUBCONTRACT,
  RW_TIMBER_PILING_METHOD_MACHINE,
  RW_TIMBER_PILING_METHOD_MANUAL,
  resolveTimberExcavationMethod,
  resolveTimberPilingMethod,
  resolveSleeperPostMethod,
  timberMachineAccessFeasible,
  timberMiniExcavatorDays,
} from "@/lib/estimate/retaining-wall-construction-method";
import { RW_PRODUCTIVITY_KEYS } from "@/lib/estimate/retaining-wall-productivity";
import {
  RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS,
  RW_DRAINAGE_AGGREGATE_PROCUREMENT_FACTOR,
  RW_DRAINAGE_AGGREGATE_PROCUREMENT_NOTE,
  RW_EXCAVATION_UNKNOWN_ALLOWANCE_HOURS_PER_FACE_M2,
  RW_EXCAVATION_UNKNOWN_TREATMENT,
  RW_TIMBER_AUTHORITY_WITH_ALLOWANCE,
  RW_TIMBER_1D_ACCESS_RULE,
  RW_TIMBER_CONCRETE_TREATMENT,
  RW_TIMBER_CONCRETE_OWNERSHIP,
  RW_TIMBER_DRAINAGE_LABOUR_OWNERSHIP,
  RW_TIMBER_FIXINGS_KIND,
  RW_TIMBER_FIXINGS_METHOD,
  RW_TIMBER_FIXINGS_PERCENT_OF_TIMBER,
  RW_TIMBER_PACKAGE_LIFECYCLE,
  RW_TIMBER_PLANT_TREATMENT,
  drainageAggregatePurchaseM3,
  timber1DExcavationHoursM3,
  timber1DMaterialStarter,
  timber1DPileHours,
  timber1DProductivityStarter,
} from "@/lib/estimate/retaining-wall-timber-1d";
import {
  RW_SLEEPER_2A_ACCESS_RULE,
  RW_SLEEPER_AUTHORITY_WITH_ALLOWANCE,
  RW_SLEEPER_CONCRETE_OWNERSHIP,
  RW_SLEEPER_FIXINGS_TREATMENT,
  RW_SLEEPER_HOLE_EXCAVATION_OWNERSHIP,
  RW_SLEEPER_PACKAGE_LIFECYCLE,
  RW_SLEEPER_PLANT_HOURS_PER_POST_BASIS,
  RW_SLEEPER_PLANT_TREATMENT,
  sleeper2AExcavationHoursM3,
  sleeper2AMaterialStarter,
  sleeper2APostHours,
  sleeper2AProductivityStarter,
} from "@/lib/estimate/retaining-wall-sleeper-2a";
import {
  masonry2BExcavationHoursM3,
  masonry2BMaterialStarter,
  masonry2BProductivityStarter,
  RW_MASONRY_2B_ACCESS_RULE,
  RW_MASONRY_AUTHORITY_WITH_ALLOWANCE,
  RW_MASONRY_BLOCK_PROCUREMENT_DISCLOSURE,
  RW_MASONRY_BLOCK_SUBCONTRACT_KEY,
  RW_MASONRY_BLOCK_LAYING_SUBCONTRACT_LABOUR_ONLY_KEY,
  formatMasonryBlockSubcontractBuilderCopy,
  RW_MASONRY_CORE_FILL_DISCLOSURE,
  RW_MASONRY_DESIGN_CONFIRM,
  RW_MASONRY_ENGINEERING_BOUNDARY,
  RW_MASONRY_FOOTING_DISCLOSURE,
  RW_MASONRY_MORTAR_COMPONENT,
  RW_MASONRY_MORTAR_DISCLOSURE,
  RW_MASONRY_MORTAR_KEY,
  RW_MASONRY_MORTAR_KIND,
  RW_MASONRY_MORTAR_METHOD,
  RW_MASONRY_MORTAR_PERCENT_OF_BLOCKS,
  RW_MASONRY_MORTAR_SUBCONTRACT_SUPPLY_PLACEHOLDER_DISCLOSURE,
  RW_MASONRY_PACKAGE_LIFECYCLE,
  RW_MASONRY_PLANT_COMPONENT,
  RW_MASONRY_PLANT_TREATMENT,
  RW_MASONRY_REBAR_ALLOWANCE_COMPONENT,
  RW_MASONRY_REBAR_ALLOWANCE_KEY,
  RW_MASONRY_REBAR_TREATMENT,
  RW_MASONRY_REINFORCEMENT_ACTION,
  RW_MASONRY_SUBBASE_DISCLOSURE,
  RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_AND_MATERIALS,
  RW_MASONRY_SUBCONTRACT_SUPPLY_PLACEHOLDER_DISCLOSURE,
  isMasonryBlockLayingSubcontract,
  RW_MASONRY_WATERPROOF_SUBCONTRACT_KEY,
  RW_REBAR_ALLOWANCE,
} from "@/lib/estimate/retaining-wall-masonry-2b";
import type { EstimateConstraint, EstimateFact } from "@/lib/estimate/types";
import type { MaterialIdentity } from "@/lib/materials/identity";

export const RW_PACKAGE_LIFECYCLE =
  "PACKAGE_FALLBACK_FOR_INSUFFICIENT_PHYSICAL_MODEL" as const;

export const RW_NOVACOIL_LABOUR_OWNERSHIP =
  "INCLUDED_IN_BACKFILL_DRAINAGE_PRODUCTIVITY" as const;

export const RW_TIMBER_RESIDUAL_CLASS = "RESIDUAL_DEFINED_NO_RATE" as const;

export const RW_TIMBER_RESIDUAL_SCOPE = [
  "bolts",
  "screws",
  "nails",
  "washers",
  "connectors",
  "minor blocking",
  "small consumables",
] as const;

export const RW_BACKFILL_PROCUREMENT_STATUS =
  "PROCUREMENT_FACTOR_REQUIRED" as const;

export const RW_REBAR_GAP = "REINFORCEMENT_DESIGN_QUANTITY_REQUIRED" as const;

export const RW_1B_TEST_ONLY = "TEST_ONLY_NOT_A_QUOTR_BENCHMARK" as const;

export const RW_QUICK_ESTIMATE_PACKAGE_NOTE =
  "Quick Estimate uses the standard retaining-wall package while detailed component prices are still being completed.";

export type RetainingWallPhysicalMode =
  | "DETAILED_PHYSICAL_MODEL"
  | "INSUFFICIENT_PHYSICAL_MODEL";

export type RetainingWallCommercialMode =
  | "DETAILED_COMPONENT_AUTHORITY"
  | "LEGACY_PACKAGE_AUTHORITY"
  | "PACKAGE_FALLBACK_FOR_INSUFFICIENT_PHYSICAL_MODEL";

export type RetainingWallPackageLifecycle =
  | "LEGACY_AUTHORITATIVE"
  | "DETAILED_PHYSICAL_SHADOW"
  | "DETAILED_COMMERCIAL_READY"
  | "DETAILED_COMPONENT_AUTHORITATIVE"
  | "PACKAGE_FALLBACK"
  | "LEGACY_RETIRED";

export type RetainingWallCoverageState =
  | "DETAILED_PRICED"
  | "EXPLICIT_ALLOWANCE"
  | "APPROVED_RESIDUAL"
  | "NOT_APPLICABLE"
  | "PRICING_REQUIRED";

export type RetainingWallCoverageCategory = {
  key: string;
  label: string;
  state: RetainingWallCoverageState;
  required: boolean;
  kind: "material" | "labour" | "residual" | "design";
};

export type RetainingWallSystemAuthorityMode = RetainingWallCommercialMode;

export type RetainingWallCommercialResult = {
  mode: RetainingWallSystemAuthorityMode;
  physicalMode: RetainingWallPhysicalMode;
  lifecycle: RetainingWallPackageLifecycle;
  commerciallyReady: boolean;
  coverage: RetainingWallCoverageCategory[];
  reason: string;
  requirements: EstimateRequirement[];
  residualClass:
    | typeof RW_TIMBER_RESIDUAL_CLASS
    | typeof RW_TIMBER_FIXINGS_METHOD
    | typeof RW_SLEEPER_FIXINGS_TREATMENT
    | typeof RW_MASONRY_REBAR_TREATMENT
    | "NOT_APPLICABLE"
    | "LEGACY_PACKAGE_SCOPE_UNKNOWN";
  backfillProcurement:
    | typeof RW_BACKFILL_PROCUREMENT_STATUS
    | typeof RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS
    | "NOT_APPLICABLE";
  novacoilLabourOwnership:
    | typeof RW_NOVACOIL_LABOUR_OWNERSHIP
    | typeof RW_TIMBER_DRAINAGE_LABOUR_OWNERSHIP;
  gaps: string[];
  inheritedBenchmarks: string[];
  assumptions: string[];
  missingInfo: string[];
};

const SKIP_MONEY = new Set([
  RW_FACE_AREA_COMPONENT,
  RW_TIMBER_PILES_EA_COMPONENT,
  RW_TIMBER_PILES_LM_COMPONENT,
  RW_SLEEPER_POSTS_EA_COMPONENT,
  RW_SLEEPER_POSTS_LM_COMPONENT,
  RW_EXCAVATION_COMPONENT,
]);

function asMaterial(
  row: EstimateRequirement | undefined
): MaterialRequirement | undefined {
  return row?.kind === "material" ? row : undefined;
}

function materialOf(
  requirements: readonly EstimateRequirement[],
  key: string
): MaterialRequirement | undefined {
  return asMaterial(requirements.find((row) => row.componentKey === key));
}

function qtyOf(
  requirements: readonly EstimateRequirement[],
  key: string
): number {
  return materialOf(requirements, key)?.purchaseQuantity ?? 0;
}

function isSubcontractMethod(raw: string | null): boolean {
  const t = (raw ?? "").toLowerCase();
  return t.includes("subcontract") || t.includes("subbie") || t === "subcontract";
}

export function timberPhysicalReady(
  physical: RetainingWallPhysicalModel
): boolean {
  if (physical.system !== "TIMBER_RETAINING_WALL" || !physical.geometry) {
    return false;
  }
  const boards = materialOf(physical.requirements, RW_TIMBER_BOARDS_COMPONENT);
  const pilesEa = materialOf(physical.requirements, RW_TIMBER_PILES_EA_COMPONENT);
  const pilesLm = materialOf(physical.requirements, RW_TIMBER_PILES_LM_COMPONENT);
  return (
    hasTrustedPhysicalQuantity(boards?.purchaseQuantity) &&
    Boolean(boards?.materialIdentity) &&
    hasTrustedPhysicalQuantity(pilesEa?.purchaseQuantity) &&
    hasTrustedPhysicalQuantity(pilesLm?.purchaseQuantity) &&
    Boolean(pilesLm?.materialIdentity)
  );
}

export function sleeperPhysicalReady(
  physical: RetainingWallPhysicalModel
): boolean {
  if (physical.system !== "CONCRETE_SLEEPER_WALL" || !physical.geometry) {
    return false;
  }
  const takeoff = physical.sleeperTakeoff;
  if (!takeoff || takeoff.dimensionsMissing) return false;
  return (
    hasTrustedPhysicalQuantity(takeoff.sleeperCount) &&
    hasTrustedPhysicalQuantity(takeoff.postCount) &&
    hasTrustedPhysicalQuantity(takeoff.holeVolumeM3)
  );
}

export function masonryPhysicalReady(
  physical: RetainingWallPhysicalModel
): boolean {
  if (physical.system !== "CONCRETE_MASONRY_WALL" || !physical.geometry) {
    return false;
  }
  const takeoff = physical.masonryTakeoff;
  if (!takeoff?.series) return false;
  return (
    hasTrustedPhysicalQuantity(takeoff.netBlocks) &&
    hasTrustedPhysicalQuantity(takeoff.footingM3) &&
    hasTrustedPhysicalQuantity(takeoff.subbaseM3) &&
    hasTrustedPhysicalQuantity(takeoff.coreFillM3)
  );
}

/** Detailed masonry Builder Review even when package money is still authoritative. */
export function retainingWallMasonryDetailedDisplay(params: {
  physical: RetainingWallPhysicalModel;
  mode: RetainingWallSystemAuthorityMode;
  physicalMode: RetainingWallPhysicalMode;
  lifecycle: RetainingWallPackageLifecycle;
  blockLayingMethod: string | null;
}): boolean {
  if (params.mode === "DETAILED_COMPONENT_AUTHORITY") return true;
  if (params.physical.system !== "CONCRETE_MASONRY_WALL") return false;
  if (params.physicalMode !== "DETAILED_PHYSICAL_MODEL") return false;
  if (!masonryPhysicalReady(params.physical)) return false;
  if (!isMasonryBlockLayingSubcontract(params.blockLayingMethod)) return false;
  return (
    params.lifecycle === "DETAILED_PHYSICAL_SHADOW" ||
    params.lifecycle === "DETAILED_COMPONENT_AUTHORITATIVE"
  );
}

function tagMasonrySubcontractSupplyPlaceholders(
  pricedMaterials: MaterialRequirement[],
  masonry: NonNullable<RetainingWallPhysicalModel["masonryTakeoff"]>
): void {
  if (
    !masonry.subcontractBlocks ||
    masonry.subcontractScope !== RW_MASONRY_SUBCONTRACT_SCOPE_LABOUR_AND_MATERIALS
  ) {
    return;
  }
  const placeholderTag = "Subcontract supply placeholder";
  for (let i = 0; i < pricedMaterials.length; i += 1) {
    const row = pricedMaterials[i]!;
    if (
      row.componentKey !== RW_MASONRY_BLOCKS_COMPONENT &&
      row.componentKey !== RW_MASONRY_MORTAR_COMPONENT
    ) {
      continue;
    }
    const disclosure =
      row.componentKey === RW_MASONRY_BLOCKS_COMPONENT
        ? RW_MASONRY_SUBCONTRACT_SUPPLY_PLACEHOLDER_DISCLOSURE
        : RW_MASONRY_MORTAR_SUBCONTRACT_SUPPLY_PLACEHOLDER_DISCLOSURE;
    pricedMaterials[i] = {
      ...row,
      specification: [row.specification, placeholderTag, disclosure]
        .filter(Boolean)
        .join(" · "),
    };
  }
}

export function decideRetainingWallPhysicalMode(
  physical: RetainingWallPhysicalModel
): RetainingWallPhysicalMode {
  const { system, geometry } = physical;
  if (
    system === "missing" ||
    system === "unsupported" ||
    system === "CONCRETE_UNSPECIFIED" ||
    !geometry
  ) {
    return "INSUFFICIENT_PHYSICAL_MODEL";
  }
  if (system === "TIMBER_RETAINING_WALL") {
    return timberPhysicalReady(physical)
      ? "DETAILED_PHYSICAL_MODEL"
      : "INSUFFICIENT_PHYSICAL_MODEL";
  }
  if (system === "CONCRETE_SLEEPER_WALL") {
    return sleeperPhysicalReady(physical)
      ? "DETAILED_PHYSICAL_MODEL"
      : "INSUFFICIENT_PHYSICAL_MODEL";
  }
  if (system === "CONCRETE_MASONRY_WALL") {
    return masonryPhysicalReady(physical)
      ? "DETAILED_PHYSICAL_MODEL"
      : "INSUFFICIENT_PHYSICAL_MODEL";
  }
  return "INSUFFICIENT_PHYSICAL_MODEL";
}

function coverageStateFromRequirement(
  row: MaterialRequirement | LabourRequirement | undefined,
  kind: RetainingWallCoverageCategory["kind"]
): RetainingWallCoverageState {
  if (!row) return "NOT_APPLICABLE";
  const qty =
    row.kind === "material"
      ? row.purchaseQuantity
      : row.productivityBasis.quantity;
  if (!hasTrustedPhysicalQuantity(qty)) return "NOT_APPLICABLE";
  if (row.priced === true) {
    return kind === "residual" ? "APPROVED_RESIDUAL" : "DETAILED_PRICED";
  }
  return "PRICING_REQUIRED";
}

function isCommerciallyCovered(state: RetainingWallCoverageState): boolean {
  return (
    state === "DETAILED_PRICED" ||
    state === "EXPLICIT_ALLOWANCE" ||
    state === "APPROVED_RESIDUAL" ||
    state === "NOT_APPLICABLE"
  );
}

function cat(
  key: string,
  label: string,
  state: RetainingWallCoverageState,
  required: boolean,
  kind: RetainingWallCoverageCategory["kind"]
): RetainingWallCoverageCategory {
  return { key, label, state, required: required && state !== "NOT_APPLICABLE", kind };
}

export function evaluateRetainingWallCommercialCoverage(params: {
  physical: RetainingWallPhysicalModel;
  requirements: readonly EstimateRequirement[];
  gaps: readonly string[];
}): RetainingWallCoverageCategory[] {
  const { physical, requirements, gaps } = params;
  const rows = requirements;
  const out: RetainingWallCoverageCategory[] = [];
  const push = (
    key: string,
    label: string,
    componentKey: string,
    kind: RetainingWallCoverageCategory["kind"],
    requiredWhenPresent: boolean
  ) => {
    const material = materialOf(rows, componentKey);
    const labour = rows.find(
      (row): row is LabourRequirement =>
        row.kind === "labour" && row.componentKey === componentKey
    );
    const row = material ?? labour;
    out.push(
      cat(
        key,
        label,
        coverageStateFromRequirement(row, kind),
        requiredWhenPresent,
        kind
      )
    );
  };

  if (physical.system === "TIMBER_RETAINING_WALL") {
    push("face_boards", "Face boards", RW_TIMBER_BOARDS_COMPONENT, "material", true);
    const stockRows = rows.filter(
      (row): row is MaterialRequirement =>
        row.kind === "material" && isRwTimberPileStockComponent(row.componentKey)
    );
    out.push(
      cat(
        "sed_piles",
        "SED piles",
        stockRows.length > 0 && stockRows.every((row) => row.priced === true)
          ? "DETAILED_PRICED"
          : "PRICING_REQUIRED",
        true,
        "material"
      )
    );
    push("pile_labour", "Pile installation labour", RW_TIMBER_PILE_LABOUR_COMPONENT, "labour", true);
    push("hole_concrete", "Post-hole concrete", RW_TIMBER_CONCRETE_COMPONENT, "material", true);
    push(
      "concrete_labour",
      "Concrete placement",
      RW_TIMBER_CONCRETE_LABOUR_COMPONENT,
      "labour",
      true
    );
    push("face_labour", "Face-board labour", RW_TIMBER_FACE_LABOUR_COMPONENT, "labour", true);
    push("novacoil", "Punched drainage coil", RW_NOVACOIL_COMPONENT, "material", true);
    push("drainage_sock", "Drainage coil sock", RW_DRAINAGE_SOCK_COMPONENT, "material", false);
    push("drainage_labour", "Drainage installation labour", RW_DRAINAGE_LABOUR_COMPONENT, "labour", true);
    push("backfill_material", "Drainage aggregate", RW_BACKFILL_COMPONENT, "material", true);
    push("backfill_labour", "Drainage backfill labour", RW_BACKFILL_LABOUR_COMPONENT, "labour", true);
    push("residual", "Fixings / connectors residual", RW_TIMBER_FIXINGS_COMPONENT, "residual", true);
    out.push(cat("excavation", "Excavation", "NOT_APPLICABLE", false, "material"));
    const excavationSubcontract = materialOf(
      rows,
      RW_EXCAVATION_SUBCONTRACT_COMPONENT
    );
    if (excavationSubcontract) {
      out.push(
        cat(
          "excavation_subcontract",
          "Excavation subcontract",
          coverageStateFromRequirement(excavationSubcontract, "material"),
          true,
          "material"
        )
      );
      out.push(
        cat("excavation_labour", "Excavation labour", "NOT_APPLICABLE", false, "labour")
      );
    } else {
      push(
        "excavation_labour",
        "Excavation labour",
        RW_EXCAVATION_LABOUR_COMPONENT,
        "labour",
        true
      );
    }
    const plant = rows.find(
      (row): row is PlantRequirement =>
        row.kind === "plant" && row.componentKey === RW_TIMBER_PLANT_COMPONENT
    );
    const plantQty = plant?.quantity ?? 0;
    out.push(
      cat(
        "plant",
        "Plant",
        plantQty > 0 && plant?.priced === true
          ? "DETAILED_PRICED"
          : plantQty === 0
            ? "NOT_APPLICABLE"
            : "PRICING_REQUIRED",
        plantQty > 0,
        "material"
      )
    );
  } else if (physical.system === "CONCRETE_SLEEPER_WALL") {
    push("sleepers", "Sleepers", RW_SLEEPER_COMPONENT, "material", true);
    const postRow =
      materialOf(rows, RW_SLEEPER_POSTS_PROCURE_COMPONENT) ??
      materialOf(rows, RW_SLEEPER_POSTS_EA_COMPONENT) ??
      materialOf(rows, RW_SLEEPER_POSTS_LM_COMPONENT);
    out.push(
      cat(
        "steel_posts",
        "Steel posts",
        coverageStateFromRequirement(postRow, "material"),
        true,
        "material"
      )
    );
    push("post_labour", "Post labour", RW_SLEEPER_POST_LABOUR_COMPONENT, "labour", true);
    push("hole_concrete", "Hole concrete", RW_SLEEPER_CONCRETE_COMPONENT, "material", true);
    push("concrete_labour", "Concrete placement", RW_SLEEPER_CONCRETE_LABOUR_COMPONENT, "labour", true);
    push("sleeper_labour", "Sleeper installation", RW_SLEEPER_FACE_LABOUR_COMPONENT, "labour", true);
    push("novacoil", "Punched drainage coil", RW_NOVACOIL_COMPONENT, "material", true);
    push("drainage_sock", "Drainage coil sock", RW_DRAINAGE_SOCK_COMPONENT, "material", false);
    push("drainage_labour", "Drainage installation labour", RW_DRAINAGE_LABOUR_COMPONENT, "labour", true);
    push("backfill_material", "Drainage aggregate", RW_BACKFILL_COMPONENT, "material", true);
    push("backfill_labour", "Drainage backfill labour", RW_BACKFILL_LABOUR_COMPONENT, "labour", true);
    out.push(cat("residual", "Sleeper connectors", "NOT_APPLICABLE", false, "residual"));
    out.push(cat("excavation", "Excavation", "NOT_APPLICABLE", false, "material"));
    const excavationSubcontract = materialOf(
      rows,
      RW_EXCAVATION_SUBCONTRACT_COMPONENT
    );
    if (excavationSubcontract) {
      out.push(
        cat(
          "excavation_subcontract",
          "Excavation subcontract",
          coverageStateFromRequirement(excavationSubcontract, "material"),
          true,
          "material"
        )
      );
      out.push(
        cat("excavation_labour", "Excavation labour", "NOT_APPLICABLE", false, "labour")
      );
    } else {
      push(
        "excavation_labour",
        "Excavation labour",
        RW_EXCAVATION_LABOUR_COMPONENT,
        "labour",
        true
      );
    }
    const plant = rows.find(
      (row): row is PlantRequirement =>
        row.kind === "plant" &&
        (row.componentKey === RW_SLEEPER_PLANT_COMPONENT ||
          row.componentKey === RW_TIMBER_PLANT_COMPONENT)
    );
    const plantQty = plant?.quantity ?? 0;
    out.push(
      cat(
        "plant",
        "Plant",
        plantQty > 0 && plant?.priced === true
          ? "DETAILED_PRICED"
          : plantQty === 0
            ? "NOT_APPLICABLE"
            : "PRICING_REQUIRED",
        plantQty > 0,
        "material"
      )
    );
  } else if (physical.system === "CONCRETE_MASONRY_WALL") {
    push("blocks", "Blocks", RW_MASONRY_BLOCKS_COMPONENT, "material", true);
    push("footing", "Footing", RW_MASONRY_FOOTING_COMPONENT, "material", true);
    push("subbase", "Sub-base", RW_MASONRY_SUBBASE_COMPONENT, "material", true);
    const mortar = materialOf(rows, RW_MASONRY_MORTAR_COMPONENT);
    out.push(
      cat(
        "mortar",
        "Masonry mortar / laying consumables",
        coverageStateFromRequirement(mortar, "residual"),
        true,
        "residual"
      )
    );
    const rebar = materialOf(rows, RW_MASONRY_REBAR_COMPONENT);
    const rebarAllowance = materialOf(rows, RW_MASONRY_REBAR_ALLOWANCE_COMPONENT);
    const allowanceMoney =
      rebarAllowance != null &&
      rebarAllowance.priced === true &&
      (rebarAllowance.totalCost ?? 0) > 0;
    out.push(
      cat(
        "reinforcement",
        "Reinforcement",
        allowanceMoney
          ? "EXPLICIT_ALLOWANCE"
          : gaps.includes(RW_REBAR_GAP) ||
              gaps.includes(RW_REBAR_ALLOWANCE) ||
              (rebarAllowance != null && !allowanceMoney)
            ? "PRICING_REQUIRED"
            : coverageStateFromRequirement(rebar, "design"),
        true,
        "design"
      )
    );
    push("core_fill", "Core fill", RW_MASONRY_CORE_COMPONENT, "material", true);
    const waterproofMaterial = materialOf(rows, RW_MASONRY_WATERPROOF_COMPONENT);
    const waterproofSub = materialOf(rows, RW_MASONRY_WATERPROOF_SUBCONTRACT_COMPONENT);
    const waterproofLabour = rows.find(
      (row): row is LabourRequirement =>
        row.kind === "labour" &&
        row.componentKey === RW_MASONRY_WATERPROOF_LABOUR_COMPONENT
    );
    if (waterproofSub) {
      out.push(
        cat(
          "waterproofing",
          "Retaining-side waterproofing",
          coverageStateFromRequirement(waterproofSub, "material"),
          true,
          "material"
        )
      );
      out.push(
        cat(
          "waterproofing_labour",
          "Waterproofing labour",
          "NOT_APPLICABLE",
          false,
          "labour"
        )
      );
    } else if (waterproofMaterial || waterproofLabour) {
      push(
        "waterproofing",
        "Retaining-side waterproofing",
        RW_MASONRY_WATERPROOF_COMPONENT,
        "material",
        true
      );
      if (waterproofLabour) {
        push(
          "waterproofing_labour",
          "Waterproofing labour",
          RW_MASONRY_WATERPROOF_LABOUR_COMPONENT,
          "labour",
          true
        );
      }
    } else {
      out.push(
        cat("waterproofing", "Retaining-side waterproofing", "NOT_APPLICABLE", false, "material")
      );
    }
    push("novacoil", "Punched drainage coil", RW_NOVACOIL_COMPONENT, "material", true);
    push("drainage_sock", "Drainage coil sock", RW_DRAINAGE_SOCK_COMPONENT, "material", false);
    push("drainage_labour", "Drainage installation labour", RW_DRAINAGE_LABOUR_COMPONENT, "labour", true);
    push("backfill_material", "Drainage aggregate", RW_BACKFILL_COMPONENT, "material", true);
    push("backfill_labour", "Drainage backfill labour", RW_BACKFILL_LABOUR_COMPONENT, "labour", true);
    push("core_labour", "Core fill labour", RW_MASONRY_CORE_LABOUR_COMPONENT, "labour", true);
    push("footing_labour", "Footing labour", RW_MASONRY_FOOTING_LABOUR_COMPONENT, "labour", true);
    push("subbase_labour", "Sub-base labour", RW_MASONRY_SUBBASE_LABOUR_COMPONENT, "labour", true);
    const blockSub = materialOf(rows, RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT);
    const blockLabourRow = rows.find(
      (row): row is LabourRequirement =>
        row.kind === "labour" &&
        row.componentKey === RW_MASONRY_BLOCK_LABOUR_COMPONENT
    );
    if (blockSub) {
      out.push(
        cat(
          "block_authority",
          "Masonry block laying — subcontract labour",
          coverageStateFromRequirement(blockSub, "material"),
          true,
          "material"
        )
      );
    } else if (blockLabourRow) {
      out.push(
        cat(
          "block_authority",
          "Block laying labour",
          coverageStateFromRequirement(blockLabourRow, "labour"),
          true,
          "labour"
        )
      );
    } else {
      out.push(
        cat("block_authority", "Block laying", "NOT_APPLICABLE", false, "labour")
      );
    }
    out.push(cat("excavation", "Excavation", "NOT_APPLICABLE", false, "material"));
    const excavationSubcontract = materialOf(
      rows,
      RW_EXCAVATION_SUBCONTRACT_COMPONENT
    );
    if (excavationSubcontract) {
      out.push(
        cat(
          "excavation_subcontract",
          "Excavation subcontract",
          coverageStateFromRequirement(excavationSubcontract, "material"),
          true,
          "material"
        )
      );
      out.push(
        cat("excavation_labour", "Excavation labour", "NOT_APPLICABLE", false, "labour")
      );
    } else {
      push(
        "excavation_labour",
        "Excavation labour",
        RW_EXCAVATION_LABOUR_COMPONENT,
        "labour",
        true
      );
    }
    const plant = rows.find(
      (row): row is PlantRequirement =>
        row.kind === "plant" && row.componentKey === RW_MASONRY_PLANT_COMPONENT
    );
    const plantQty = plant?.quantity ?? 0;
    out.push(
      cat(
        "plant",
        "Plant",
        plantQty > 0 && plant?.priced === true
          ? "DETAILED_PRICED"
          : plantQty === 0
            ? "NOT_APPLICABLE"
            : "PRICING_REQUIRED",
        plantQty > 0,
        "material"
      )
    );
  }
  return out;
}

export function retainingWallCoverageIsReady(
  coverage: readonly RetainingWallCoverageCategory[]
): boolean {
  return coverage.filter((row) => row.required).every((row) => isCommerciallyCovered(row.state));
}

export function retainingWallPostPromotionHold(
  coverage: readonly RetainingWallCoverageCategory[]
): boolean {
  const required = coverage.filter((row) => row.required);
  const uncovered = required.filter((row) => !isCommerciallyCovered(row.state));
  if (uncovered.length === 0) return true;
  const labourOk = required
    .filter((row) => row.kind === "labour")
    .every((row) => isCommerciallyCovered(row.state));
  const residualOk = required
    .filter((row) => row.kind === "residual")
    .every((row) => isCommerciallyCovered(row.state));
  const designOk = required
    .filter((row) => row.kind === "design")
    .every((row) => isCommerciallyCovered(row.state));
  const backfillOk = required
    .filter((row) => row.key === "backfill_material")
    .every((row) => isCommerciallyCovered(row.state));
  const materialMissOnly = uncovered.every((row) => row.kind === "material");
  const someMaterialPriced = required.some(
    (row) => row.kind === "material" && row.state === "DETAILED_PRICED"
  );
  return labourOk && residualOk && designOk && backfillOk && materialMissOnly && someMaterialPriced;
}

export function decideRetainingWallSystemAuthority(
  physical: RetainingWallPhysicalModel
): { mode: RetainingWallSystemAuthorityMode; reason: string } {
  const physicalMode = decideRetainingWallPhysicalMode(physical);
  if (physicalMode !== "DETAILED_PHYSICAL_MODEL") {
    return {
      mode: "PACKAGE_FALLBACK_FOR_INSUFFICIENT_PHYSICAL_MODEL",
      reason: RW_PACKAGE_LIFECYCLE,
    };
  }
  return {
    mode: "LEGACY_PACKAGE_AUTHORITY",
    reason:
      "Physical model is detailed. Package remains money until commercial coverage is complete.",
  };
}

function findExactNamedMaterialRate(
  rates: readonly OrganisationRate[],
  itemKey: string,
  unit: string
): OrganisationRate | undefined {
  const matches = rates.filter(
    (rate) =>
      rate.active &&
      (rate.rate_type === "material" || rate.rate_type === "project_material") &&
      rate.item_key === itemKey &&
      rate.cost_rate != null &&
      rateUnitsMatch(rate.unit, unit)
  );
  return (
    matches.find((rate) => rate.rate_type === "project_material") ?? matches[0]
  );
}

function priceMaterial(
  requirement: MaterialRequirement,
  rates: readonly OrganisationRate[],
  organisationSettings: OrganisationSettings | null,
  inherited: string[]
): MaterialRequirement {
  if (!hasTrustedPhysicalQuantity(requirement.purchaseQuantity)) {
    return requirement;
  }
  const unit = requirement.purchaseUnit;
  const namedKeys = [requirement.materialKey].filter(
    (key): key is string => Boolean(key)
  );
  if (requirement.componentKey === RW_NOVACOIL_COMPONENT) {
    namedKeys.push(MATERIAL_RATE_KEYS.drainageNovacoilLm);
  }
  if (requirement.componentKey === RW_SLEEPER_CONCRETE_COMPONENT) {
    namedKeys.push(RW_PREMIX_20KG_KEY);
    namedKeys.push(RW_SLEEPER_PREMIX_20KG_KEY);
  }
  if (requirement.componentKey === RW_TIMBER_CONCRETE_COMPONENT) {
    namedKeys.push(RW_PREMIX_20KG_KEY);
    namedKeys.push(RW_SLEEPER_PREMIX_20KG_KEY);
  }
  if (requirement.componentKey === RW_DRAINAGE_SOCK_COMPONENT) {
    namedKeys.push(RW_DRAINAGE_SOCK_KEY);
  }
  if (requirement.componentKey === RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT) {
    namedKeys.push(RW_MASONRY_BLOCK_LAYING_SUBCONTRACT_LABOUR_ONLY_KEY);
  }
  // Spoil removal prices only retaining_wall.spoil.removal.all_in.m3.
  // Tip-only leftover retaining_wall.spoil.disposal.m3 must not resolve it.
  for (const key of namedKeys) {
    const named = findExactNamedMaterialRate(rates, key, unit);
    if (named?.cost_rate != null) {
      const unitCost = Number(named.cost_rate);
      return {
        ...requirement,
        priced: true,
        unitCost,
        totalCost: round2(requirement.purchaseQuantity * unitCost),
        rateSource:
          named.rate_type === "project_material" ? "project_override" : "company",
      };
    }
  }

  const timberStarter = timber1DMaterialStarter(
    requirement.materialKey ?? namedKeys[0] ?? null
  );
  const sleeperStarter = sleeper2AMaterialStarter(
    requirement.materialKey ?? namedKeys[0] ?? null,
    unit
  );
  const masonryStarter = masonry2BMaterialStarter(
    requirement.materialKey ?? namedKeys[0] ?? null,
    unit
  );
  const mappedStarter =
    timberStarter && rateUnitsMatch(timberStarter.unit, unit)
      ? timberStarter
      : sleeperStarter && rateUnitsMatch(sleeperStarter.unit, unit)
        ? sleeperStarter
        : masonryStarter;
  if (
    mappedStarter &&
    rateUnitsMatch(mappedStarter.unit, unit) &&
    mappedStarter.costPerUnit > 0
  ) {
    inherited.push(
      `${requirement.componentKey} used Quotr starter ${mappedStarter.costPerUnit}/${mappedStarter.unit}`
    );
    return {
      ...requirement,
      priced: true,
      unitCost: mappedStarter.costPerUnit,
      totalCost: round2(requirement.purchaseQuantity * mappedStarter.costPerUnit),
      rateSource: "benchmark",
    };
  }

  const identity = requirement.materialIdentity as MaterialIdentity | undefined;
  const sedPole =
    requirement.componentKey === RW_TIMBER_PILES_EA_COMPONENT ||
    requirement.componentKey === RW_TIMBER_PILES_LM_COMPONENT ||
    identity?.productFamily === "sed_pole";
  if (
    identity &&
    !sedPole &&
    (unit === "lm" || unit === "ea" || unit === "m3")
  ) {
    const resolved = resolveStructuralMaterialRequirementRate({
      identity,
      unit,
      purchaseQuantity: requirement.purchaseQuantity,
      rates,
      organisationSettings,
    });
    if (resolved.priced && resolved.unitCost != null && resolved.totalCost != null) {
      if (resolved.rateSource === "benchmark") {
        inherited.push(
          `${requirement.componentKey} inherited exact identity+${unit} structural benchmark`
        );
      }
      return {
        ...requirement,
        priced: true,
        unitCost: resolved.unitCost,
        totalCost: resolved.totalCost,
        rateSource: resolved.rateSource as RequirementRateSource,
        rateEvidence: resolved.rateEvidence,
      };
    }
  }

  return {
    ...requirement,
    priced: false,
    unitCost: null,
    totalCost: null,
    rateSource: "missing",
  };
}

function labourSlot(params: {
  workAreaId: string;
  componentKey: string;
  description: string;
  productivityKey: string;
  unit: string;
  quantity: number;
  rates: readonly OrganisationRate[];
  hourlyCost: number;
  rateProvenance: RequirementRateSource;
  fallbackHoursPerUnit?: number;
}): LabourRequirement {
  const company = findCompanyProductivityRate(
    params.rates,
    params.productivityKey,
    params.unit
  );
  const starter =
    timber1DProductivityStarter(params.productivityKey) ??
    sleeper2AProductivityStarter(params.productivityKey) ??
    masonry2BProductivityStarter(params.productivityKey);
  const hoursPerUnit =
    company?.cost_rate != null
      ? Number(company.cost_rate)
      : params.fallbackHoursPerUnit != null
        ? params.fallbackHoursPerUnit
        : starter?.hoursPerUnit ?? null;
  const hoursSource: RequirementRateSource =
    company?.cost_rate != null
      ? params.rateProvenance
      : hoursPerUnit != null
        ? "benchmark"
        : "missing";
  const priced =
    hoursPerUnit != null &&
    hoursPerUnit > 0 &&
    params.hourlyCost > 0 &&
    hasTrustedPhysicalQuantity(params.quantity);
  const baseHours =
    priced && hoursPerUnit != null
      ? round2(params.quantity * hoursPerUnit)
      : 0;
  return buildLabourRequirement({
    workAreaId: params.workAreaId,
    workAreaType: "retaining_wall",
    componentKey: params.componentKey,
    description: params.description,
    confidence: priced ? "medium" : "low",
    assumptions: priced
      ? []
      : [
          {
            key: "productivity_required",
            text: `Needs productivity for ${params.description} (${params.quantity} ${params.unit}). Not zero hours.`,
            source: "calculator_default",
          },
        ],
    provenance: {
      calculatorSource: "retaining_wall.labour",
      factKeys: [],
      constraintKeys: [],
    },
    priced,
    trade: "carpenter",
    baseHours,
    productivityBasis: {
      key: params.productivityKey,
      hoursPerUnit: hoursPerUnit ?? 0,
      unit: params.unit,
      quantity: params.quantity,
    },
    adjustmentRef: { factors: [] },
    adjustedHours: baseHours,
    rateKey: params.productivityKey,
    hourlyCost: priced ? params.hourlyCost : null,
    totalCost: priced ? round2(baseHours * params.hourlyCost) : null,
    rateProvenance: priced
      ? hoursSource === "benchmark"
        ? "benchmark"
        : params.rateProvenance
      : "missing",
  });
}

export function componentAuthorityOf(
  requirement: MaterialRequirement | LabourRequirement
): ComponentCommercialAuthority {
  if (requirement.kind === "material") {
    return resolveComponentCommercialAuthority({
      applicable: !SKIP_MONEY.has(requirement.componentKey),
      hasTrustedPhysicalQuantity: hasTrustedPhysicalQuantity(
        requirement.purchaseQuantity
      ),
      hasTrustedRate: requirement.priced === true,
    });
  }
  return resolveComponentCommercialAuthority({
    applicable: true,
    hasTrustedPhysicalQuantity: hasTrustedPhysicalQuantity(
      requirement.productivityBasis.quantity
    ),
    hasTrustedRate: requirement.priced === true,
  });
}

export function commercializeRetainingWall(params: {
  physical: RetainingWallPhysicalModel;
  facts: readonly EstimateFact[];
  workAreaId: string;
  rates: readonly OrganisationRate[];
  organisationSettings: OrganisationSettings | null;
  constraints?: readonly EstimateConstraint[];
}): RetainingWallCommercialResult {
  const { physical, facts, workAreaId, rates, organisationSettings, constraints } =
    params;
  const physicalMode = decideRetainingWallPhysicalMode(physical);
  const inheritedBenchmarks: string[] = [];
  const gaps: string[] = [];
  const assumptions =
    physical.system === "CONCRETE_SLEEPER_WALL"
      ? []
      : [
          `Novacoil laying labour ownership: ${RW_NOVACOIL_LABOUR_OWNERSHIP}. No separate novacoil labour.`,
        ];
  const missingInfo: string[] = [];

  if (physicalMode !== "DETAILED_PHYSICAL_MODEL") {
    return {
      mode: "PACKAGE_FALLBACK_FOR_INSUFFICIENT_PHYSICAL_MODEL",
      physicalMode,
      commerciallyReady: false,
      coverage: [],
      reason: RW_PACKAGE_LIFECYCLE,
      requirements: physical.requirements,
      residualClass:
        physical.system === "TIMBER_RETAINING_WALL"
          ? "LEGACY_PACKAGE_SCOPE_UNKNOWN"
          : "NOT_APPLICABLE",
      lifecycle:
        physical.system === "CONCRETE_UNSPECIFIED"
          ? "LEGACY_AUTHORITATIVE"
          : "PACKAGE_FALLBACK",
      backfillProcurement: "NOT_APPLICABLE",
      novacoilLabourOwnership: RW_NOVACOIL_LABOUR_OWNERSHIP,
      gaps,
      inheritedBenchmarks,
      assumptions,
      missingInfo,
    };
  }

  const labourRate = resolveLabourRate({
    rates: [...rates],
    organisationSettings,
  });
  const labourSource: RequirementRateSource =
    labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy";
  const timberLabourSource: RequirementRateSource =
    labourRate.sourceType === "user_rate" ? "company" : "benchmark";
  const sleeperSystem = physical.system === "CONCRETE_SLEEPER_WALL";
  const timberSystem = physical.system === "TIMBER_RETAINING_WALL";
  const masonrySystem = physical.system === "CONCRETE_MASONRY_WALL";
  const detailedSystem = timberSystem || sleeperSystem || masonrySystem;
  const pilingMethod = timberSystem
    ? resolveTimberPilingMethod(constraints, facts, workAreaId)
    : sleeperSystem
      ? resolveSleeperPostMethod(constraints, facts, workAreaId)
      : {
          method: timberMachineAccessFeasible(constraints, facts, workAreaId)
            ? RW_TIMBER_PILING_METHOD_MACHINE
            : RW_TIMBER_PILING_METHOD_MANUAL,
          machineAccess: timberMachineAccessFeasible(constraints, facts, workAreaId),
          disclosure: timberMachineAccessFeasible(constraints, facts, workAreaId)
            ? "Accessible-site starter: mini-excavator for masonry excavation when measured or derived volume exists. No invented plate-compactor day."
            : "Site access cannot take a mini-excavator. Masonry excavation labour is manual. Plant is not priced.",
        };
  const excavationMethod = resolveTimberExcavationMethod(facts, workAreaId);
  const excavationSubcontracted =
    detailedSystem && excavationMethod === RW_TIMBER_EXCAVATION_SUBCONTRACT;
  const detailedLabourSource = detailedSystem ? timberLabourSource : labourSource;

  const pricedMaterials: MaterialRequirement[] = [];
  const waterproofMethodEarly = getStringFact(
    facts as EstimateFact[],
    workAreaId,
    "retaining_wall.waterproofing_method"
  );
  const waterproofSubcontracted =
    masonrySystem && isSubcontractMethod(waterproofMethodEarly);
  for (const row of physical.requirements) {
    if (row.kind !== "material") continue;
    if (row.componentKey === RW_FACE_AREA_COMPONENT) {
      pricedMaterials.push(row);
      continue;
    }
    if (
      waterproofSubcontracted &&
      row.componentKey === RW_MASONRY_WATERPROOF_COMPONENT
    ) {
      continue;
    }
    if (
      row.componentKey === RW_TIMBER_PILES_EA_COMPONENT ||
      row.componentKey === RW_TIMBER_PILES_LM_COMPONENT ||
      row.componentKey === RW_SLEEPER_POSTS_EA_COMPONENT ||
      row.componentKey === RW_SLEEPER_POSTS_LM_COMPONENT ||
      row.componentKey === RW_EXCAVATION_COMPONENT
    ) {
      pricedMaterials.push(row);
      continue;
    }
    if (row.componentKey === RW_BACKFILL_COMPONENT) {
      const inPlace = row.baseQuantity;
      const detailedProcurement =
        detailedSystem && hasTrustedPhysicalQuantity(inPlace);
      const purchaseQuantity = detailedProcurement
        ? drainageAggregatePurchaseM3(inPlace)
        : row.purchaseQuantity;
      const priced = priceMaterial(
        {
          ...row,
          purchaseQuantity,
          description: detailedProcurement
            ? "Drainage aggregate / drainage backfill"
            : row.description,
          specification: detailedProcurement
            ? `${row.specification ?? ""} In-place ${inPlace} m³ × ${RW_DRAINAGE_AGGREGATE_PROCUREMENT_FACTOR} procurement factor = ${purchaseQuantity} m³ purchased. ${RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS}. ${RW_DRAINAGE_AGGREGATE_PROCUREMENT_NOTE}`
            : `${row.specification ?? ""} In-place volume. ${RW_BACKFILL_PROCUREMENT_STATUS}.`,
        },
        rates,
        organisationSettings,
        inheritedBenchmarks
      );
      pricedMaterials.push(priced);
      if (priced.priced !== true) {
        missingInfo.push("Backfill purchase conversion / procurement factor");
      }
      continue;
    }
    pricedMaterials.push(
      priceMaterial(row, rates, organisationSettings, inheritedBenchmarks)
    );
  }

  if (physical.system === "TIMBER_RETAINING_WALL") {
    const piles = physical.timberPiles;
    if (piles) {
      assumptions.push(
        pilingMethod.disclosure,
        `Drainage-metal consolidation: ${RW_TIMBER_COMPACTION_METHOD}.`
      );
      if (isHousePileMaterial(piles.pileMaterial)) {
        const procurement = procureTimberHousePiles(piles);
        assumptions.push(
          `House pile selected — theoretical ${procurement.theoreticalTotalLm} lm required. Purchase ${procurement.purchaseTotalLm} lm stock length.`,
          `Theoretical pile length ${procurement.theoreticalTotalLm} lm. Purchase ${procurement.purchaseEa} stock lengths / ${procurement.purchaseTotalLm} lm. Required length is not purchase quantity.`
        );
        const housePileReq = planningMaterial({
          workAreaId,
          componentKey: `${RW_TIMBER_PILES_STOCK_COMPONENT}.house_pile_lm`,
          variantKey: "house_pile_lm",
          description: "125×125 H5 house pile — stock-length purchase",
          materialKey: RW_HOUSE_PILE_125_KEY,
          identity: HOUSE_PILE_125_RW_IDENTITY,
          category: "TIMBER",
          specification: `${procurement.purchaseTotalLm} lm purchased for ${piles.count} piles. Required ${procurement.theoreticalTotalLm} lm — stock rounding applies.`,
          baseQuantity: procurement.purchaseTotalLm,
          baseUnit: "lm",
          wasteFactor: 0,
          purchaseQuantity: procurement.purchaseTotalLm,
          purchaseUnit: "lm",
          factKeys: ["retaining_wall.pile_material"],
          source: "retaining_wall.timber.house_pile_stock",
        });
        pricedMaterials.push(
          priceMaterial(
            housePileReq,
            rates,
            organisationSettings,
            inheritedBenchmarks
          )
        );
        if (procurement.oversizeCount > 0) {
          const oversize = planningMaterial({
            workAreaId,
            componentKey: rwTimberPileStockComponentKey("oversize"),
            variantKey: "oversize",
            description: "House pile exceeds maximum catalogue stock length",
            materialKey: null,
            identity: HOUSE_PILE_125_RW_IDENTITY,
            category: "TIMBER",
            specification: `${procurement.oversizeCount} pile(s) longer than maximum stock. Pricing Required — do not clamp.`,
            baseQuantity: procurement.oversizeCount,
            baseUnit: "ea",
            wasteFactor: 0,
            purchaseQuantity: procurement.oversizeCount,
            purchaseUnit: "ea",
            factKeys: ["retaining_wall.pile_material"],
            source: "retaining_wall.timber.house_pile_stock",
          });
          pricedMaterials.push(oversize);
          missingInfo.push("House pile stock length above catalogue maximum");
        }
      } else {
        const procurement = procureTimberPiles(piles);
        assumptions.push(
          RW_H5_SED_CLASS_DISCLOSURE,
          `Theoretical pile length ${procurement.theoreticalTotalLm} lm. Purchase ${procurement.purchaseEa} ea / ${procurement.purchaseTotalLm} lm stock. Required length is not purchase quantity.`
        );
        for (const group of procurement.byStock) {
          const stockReq = planningMaterial({
            workAreaId,
            componentKey: rwTimberPileStockComponentKey(group.stockLengthM),
            variantKey: `${group.stockLengthM}m`,
            description: `H5 SED 150–175 mm × ${group.stockLengthM} m stock pole`,
            materialKey: group.itemKey,
            identity: h5SedStockIdentity(group.stockLengthM),
            category: "TIMBER",
            specification: `${group.ea} ea of ${group.stockLengthM} m stock. ${RW_H5_SED_CLASS_DISCLOSURE}`,
            baseQuantity: group.ea,
            baseUnit: "ea",
            wasteFactor: 0,
            purchaseQuantity: group.ea,
            purchaseUnit: "ea",
            factKeys: ["retaining_wall.material"],
            source: "retaining_wall.timber.pile_stock",
          });
          pricedMaterials.push(
            priceMaterial(stockReq, rates, organisationSettings, inheritedBenchmarks)
          );
        }
        if (procurement.oversizeCount > 0) {
          const oversize = planningMaterial({
            workAreaId,
            componentKey: rwTimberPileStockComponentKey("oversize"),
            variantKey: "oversize",
            description: "H5 SED pile exceeds maximum catalogue stock length",
            materialKey: null,
            identity: H5_SED_POLE_IDENTITY,
            category: "TIMBER",
            specification: `${procurement.oversizeCount} pile(s) longer than ${3.6} m stock. Pricing Required — do not clamp.`,
            baseQuantity: procurement.oversizeCount,
            baseUnit: "ea",
            wasteFactor: 0,
            purchaseQuantity: procurement.oversizeCount,
            purchaseUnit: "ea",
            factKeys: ["retaining_wall.material"],
            source: "retaining_wall.timber.pile_stock",
          });
          pricedMaterials.push(oversize);
          missingInfo.push("H5 SED pile stock length above catalogue maximum");
        }
      }
    }
    const boardCost =
      materialOf(pricedMaterials, RW_TIMBER_BOARDS_COMPONENT)?.totalCost ?? 0;
    const pileStockCost = pricedMaterials
      .filter(
        (row) =>
          isRwTimberPileStockComponent(row.componentKey) &&
          row.priced === true
      )
      .reduce((sum, row) => sum + (row.totalCost ?? 0), 0);
    const timberMaterialCost = round2(boardCost + pileStockCost);
    const residualNamed = findExactNamedMaterialRate(
      rates,
      RW_TIMBER_FIXINGS_COMPONENT,
      "item"
    );
    const residualCost =
      residualNamed?.cost_rate != null
        ? Number(residualNamed.cost_rate)
        : round2(timberMaterialCost * RW_TIMBER_FIXINGS_PERCENT_OF_TIMBER);
    const residualPriced =
      residualCost > 0 &&
      (residualNamed?.cost_rate != null || timberMaterialCost > 0);
    const residual = planningMaterial({
      workAreaId,
      componentKey: RW_TIMBER_FIXINGS_COMPONENT,
      description: "Fixings, connectors and sundries",
      materialKey: RW_TIMBER_FIXINGS_COMPONENT,
      category: "RESIDUAL",
      specification: residualNamed?.cost_rate != null
        ? `Company residual allowance. ${RW_TIMBER_FIXINGS_METHOD}.`
        : `${Math.round(RW_TIMBER_FIXINGS_PERCENT_OF_TIMBER * 100)}% of face-board + purchased pile stock cost ($${timberMaterialCost}). ${RW_TIMBER_FIXINGS_KIND}. ${RW_TIMBER_FIXINGS_METHOD}. Scope: ${RW_TIMBER_RESIDUAL_SCOPE.join(", ")}.`,
      baseQuantity: 1,
      baseUnit: "item",
      wasteFactor: 0,
      purchaseQuantity: 1,
      purchaseUnit: "item",
      factKeys: ["retaining_wall.material"],
      source: "retaining_wall.residual",
    });
    pricedMaterials.push({
      ...residual,
      priced: residualPriced,
      unitCost: residualPriced ? residualCost : null,
      totalCost: residualPriced ? residualCost : null,
      rateSource: residualPriced
        ? residualNamed?.cost_rate != null
          ? "company"
          : "benchmark"
        : "missing",
    });
    assumptions.push(
      `Timber residual method: ${RW_TIMBER_FIXINGS_METHOD}.`,
      `Timber plant: ${RW_TIMBER_PLANT_TREATMENT}.`,
      `Timber pile concrete: ${RW_TIMBER_CONCRETE_OWNERSHIP}.`,
      `Timber access: ${RW_TIMBER_1D_ACCESS_RULE.note}`,
      `Package lifecycle for detailed-ready timber: ${RW_TIMBER_PACKAGE_LIFECYCLE}.`
    );
  }

  if (physical.system === "CONCRETE_SLEEPER_WALL" && physical.sleeperTakeoff) {
    const takeoff = physical.sleeperTakeoff;
    const eaRate = findExactNamedMaterialRate(rates, RW_STEEL_POST_KEY, "ea");
    const useEa = Boolean(eaRate?.cost_rate != null);
    const postQty = useEa
      ? (takeoff.postCount ?? 0)
      : takeoff.totalPostLengthM;
    const postUnit = useEa ? "ea" : "lm";
    const postSpec = useEa
      ? `${takeoff.postCount} posts. Theoretical length ${takeoff.totalPostLengthM} lm. Company EA rate. Stock-length SKUs are not invented.`
      : `${takeoff.postCount} posts · ${takeoff.totalPostLengthM} lm theoretical. H-section estimating class — not stock rounding.`;
    const postReq = planningMaterial({
      workAreaId,
      componentKey: RW_SLEEPER_POSTS_PROCURE_COMPONENT,
      description: "Steel retaining posts",
      materialKey: RW_STEEL_POST_KEY,
      identity: STEEL_RW_POST_IDENTITY,
      category: "SLEEPER",
      specification: postSpec,
      baseQuantity: postQty,
      baseUnit: postUnit,
      wasteFactor: 0,
      purchaseQuantity: postQty,
      purchaseUnit: postUnit,
      factKeys: ["retaining_wall.material"],
      source: "retaining_wall.sleeper.posts.procure",
    });
    pricedMaterials.push(
      priceMaterial(postReq, rates, organisationSettings, inheritedBenchmarks)
    );
    assumptions.push(
      pilingMethod.disclosure,
      `Sleeper connectors: ${RW_SLEEPER_FIXINGS_TREATMENT}. H-section posts typically slot sleepers — no invented clip allowance.`,
      `Concrete placement ownership: ${RW_SLEEPER_CONCRETE_OWNERSHIP}.`,
      `Post-hole excavation ownership: ${RW_SLEEPER_HOLE_EXCAVATION_OWNERSHIP}. Not added to bulk excavation labour.`,
      `Sleeper plant: ${RW_SLEEPER_PLANT_TREATMENT}. ${RW_SLEEPER_PLANT_HOURS_PER_POST_BASIS}.`,
      `Sleeper access: ${RW_SLEEPER_2A_ACCESS_RULE.note}`,
      `Package lifecycle for detailed-ready sleeper: ${RW_SLEEPER_PACKAGE_LIFECYCLE}.`,
      `Drainage-metal consolidation: ${RW_TIMBER_COMPACTION_METHOD}.`
    );
  }

  const masonry = physical.masonryTakeoff;
  if (physical.system === "CONCRETE_MASONRY_WALL" && masonry) {
    assumptions.push(
      RW_MASONRY_FOOTING_DISCLOSURE,
      RW_MASONRY_SUBBASE_DISCLOSURE,
      RW_MASONRY_CORE_FILL_DISCLOSURE,
      RW_MASONRY_BLOCK_PROCUREMENT_DISCLOSURE,
      RW_MASONRY_MORTAR_DISCLOSURE,
      RW_MASONRY_ENGINEERING_BOUNDARY,
      `Masonry plant: ${RW_MASONRY_PLANT_TREATMENT}.`,
      `Masonry access: ${RW_MASONRY_2B_ACCESS_RULE.note}`,
      `Package lifecycle for detailed-ready masonry: ${RW_MASONRY_PACKAGE_LIFECYCLE}.`,
      `Drainage-metal consolidation: ${RW_TIMBER_COMPACTION_METHOD}.`,
      `Reinforcement treatment: ${RW_MASONRY_REBAR_TREATMENT}.`,
      "Block laying subcontract applies to block-laying labour only; builder retains other wall scope unless labour + blocks & laying materials is selected."
    );
    if (
      masonry.horizontalRebarLm == null &&
      masonry.verticalStarters == null
    ) {
      const allowanceNamed = findExactNamedMaterialRate(
        rates,
        RW_MASONRY_REBAR_ALLOWANCE_KEY,
        "item"
      );
      const allowanceCost =
        allowanceNamed?.cost_rate != null ? Number(allowanceNamed.cost_rate) : null;
      const hasMonetaryAllowance =
        allowanceCost != null && Number.isFinite(allowanceCost) && allowanceCost > 0;

      if (hasMonetaryAllowance) {
        gaps.push(RW_REBAR_ALLOWANCE);
        assumptions.push(
          `Reinforcement is design-dependent. Approved company/project allowance $${allowanceCost} — not a fabricated bar schedule.`
        );
        const allowance = planningMaterial({
          workAreaId,
          componentKey: RW_MASONRY_REBAR_ALLOWANCE_COMPONENT,
          description: "Reinforcement allowance / design to be confirmed",
          materialKey: RW_MASONRY_REBAR_ALLOWANCE_KEY,
          category: "ALLOWANCE",
          specification: `Allowance $${allowanceCost}. Design-dependent — not an engineered bar schedule. ${RW_MASONRY_DESIGN_CONFIRM}`,
          baseQuantity: 1,
          baseUnit: "item",
          wasteFactor: 0,
          purchaseQuantity: 1,
          purchaseUnit: "item",
          factKeys: ["retaining_wall.material"],
          source: "retaining_wall.masonry.rebar.allowance",
        });
        pricedMaterials.push({
          ...allowance,
          priced: true,
          unitCost: allowanceCost,
          totalCost: allowanceCost,
          rateSource:
            allowanceNamed?.rate_type === "project_material"
              ? "project_override"
              : "company",
        });
      } else {
        // Applicable design-dependent category with no approved monetary allowance.
        // PRICING_REQUIRED — never EXPLICIT_ALLOWANCE at $0, never silent omit.
        gaps.push(RW_REBAR_GAP);
        assumptions.push(
          "Reinforcement is design-dependent. No approved allowance or engineered quantity — Pricing Required. Not a fabricated bar schedule and not a silent $0 line."
        );
        const placeholder = planningMaterial({
          workAreaId,
          componentKey: RW_MASONRY_REBAR_ALLOWANCE_COMPONENT,
          description: "Reinforcement — design to be confirmed",
          materialKey: RW_MASONRY_REBAR_ALLOWANCE_KEY,
          category: "ALLOWANCE",
          specification: `Design to be confirmed. Price required. ${RW_MASONRY_REINFORCEMENT_ACTION}`,
          baseQuantity: 1,
          baseUnit: "item",
          wasteFactor: 0,
          purchaseQuantity: 1,
          purchaseUnit: "item",
          factKeys: ["retaining_wall.material"],
          source: "retaining_wall.masonry.rebar.allowance",
        });
        pricedMaterials.push({
          ...placeholder,
          priced: false,
          unitCost: null,
          totalCost: null,
          rateSource: "missing",
        });
        missingInfo.push(RW_MASONRY_REINFORCEMENT_ACTION);
      }
      if (!missingInfo.includes(RW_MASONRY_DESIGN_CONFIRM)) {
        missingInfo.push(RW_MASONRY_DESIGN_CONFIRM);
      }
    }

    // Mortar / laying consumables — builder-owned under labour-only subcontract.
    // Not hidden in labour. Not core fill. Company item OR % of purchased blocks.
    const pricedBlocks = materialOf(pricedMaterials, RW_MASONRY_BLOCKS_COMPONENT);
    if (pricedBlocks != null && hasTrustedPhysicalQuantity(pricedBlocks.purchaseQuantity)) {
      const blockMaterialCost =
        pricedBlocks.priced === true ? pricedBlocks.totalCost ?? 0 : 0;
      const mortarNamed = findExactNamedMaterialRate(
        rates,
        RW_MASONRY_MORTAR_KEY,
        "item"
      );
      const mortarCost =
        mortarNamed?.cost_rate != null
          ? Number(mortarNamed.cost_rate)
          : round2(blockMaterialCost * RW_MASONRY_MORTAR_PERCENT_OF_BLOCKS);
      const mortarPriced =
        mortarCost > 0 &&
        (mortarNamed?.cost_rate != null ||
          (pricedBlocks.priced === true && blockMaterialCost > 0));
      const mortar = planningMaterial({
        workAreaId,
        componentKey: RW_MASONRY_MORTAR_COMPONENT,
        description: "Masonry mortar / laying consumables",
        materialKey: RW_MASONRY_MORTAR_KEY,
        category: "RESIDUAL",
        specification: mortarNamed?.cost_rate != null
          ? `Company mortar / laying-consumables allowance. ${RW_MASONRY_MORTAR_METHOD}. Not core fill.`
          : `${Math.round(RW_MASONRY_MORTAR_PERCENT_OF_BLOCKS * 100)}% of purchased block material ($${blockMaterialCost}). ${RW_MASONRY_MORTAR_KIND}. ${RW_MASONRY_MORTAR_METHOD}. Not core fill. Not included in block unit rate or labour.`,
        baseQuantity: 1,
        baseUnit: "item",
        wasteFactor: 0,
        purchaseQuantity: 1,
        purchaseUnit: "item",
        factKeys: ["retaining_wall.material"],
        source: "retaining_wall.masonry.mortar",
      });
      pricedMaterials.push({
        ...mortar,
        priced: mortarPriced,
        unitCost: mortarPriced ? mortarCost : null,
        totalCost: mortarPriced ? mortarCost : null,
        rateSource: mortarPriced
          ? mortarNamed?.cost_rate != null
            ? "company"
            : "benchmark"
          : "missing",
      });
      if (!mortarPriced && pricedBlocks.priced === true) {
        missingInfo.push("Masonry mortar / laying consumables");
      }
    }
    tagMasonrySubcontractSupplyPlaceholders(pricedMaterials, masonry);
  }

  const labour: LabourRequirement[] = [];
  const face = physical.geometry!.faceAreaM2;

  if (physical.system === "TIMBER_RETAINING_WALL") {
    labour.push(
      labourSlot({
        workAreaId,
        componentKey: RW_TIMBER_PILE_LABOUR_COMPONENT,
        description: "Pile installation labour",
        productivityKey: RW_PRODUCTIVITY_KEYS.timberPilesEa,
        unit: "ea",
        quantity: qtyOf(pricedMaterials, RW_TIMBER_PILES_EA_COMPONENT),
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: timberLabourSource,
        fallbackHoursPerUnit: timber1DPileHours(pilingMethod.method),
      }),
      labourSlot({
        workAreaId,
        componentKey: RW_TIMBER_FACE_LABOUR_COMPONENT,
        description: "Face-board installation",
        productivityKey: RW_PRODUCTIVITY_KEYS.timberFaceM2,
        unit: "m2",
        quantity: face,
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: timberLabourSource,
      })
    );
    const novacoilQty = qtyOf(pricedMaterials, RW_NOVACOIL_COMPONENT);
    if (hasTrustedPhysicalQuantity(novacoilQty)) {
      labour.push(
        labourSlot({
          workAreaId,
          componentKey: RW_DRAINAGE_LABOUR_COMPONENT,
          description: "Drainage installation labour",
          productivityKey: RW_PRODUCTIVITY_KEYS.drainageLm,
          unit: "lm",
          quantity: novacoilQty,
          rates,
          hourlyCost: labourRate.costRate,
          rateProvenance: timberLabourSource,
        })
      );
      assumptions.push(
        `Timber drainage labour ownership: ${RW_TIMBER_DRAINAGE_LABOUR_OWNERSHIP}.`
      );
    }
    const timberHoles = physical.timberPiles?.holeCount ?? 0;
    if (timberHoles > 0) {
      labour.push(
        labourSlot({
          workAreaId,
          componentKey: RW_TIMBER_CONCRETE_LABOUR_COMPONENT,
          description: "Post-hole concrete placement",
          productivityKey: RW_PRODUCTIVITY_KEYS.timberConcreteHole,
          unit: "hole",
          quantity: timberHoles,
          rates,
          hourlyCost: labourRate.costRate,
          rateProvenance: timberLabourSource,
          fallbackHoursPerUnit: RW_TIMBER_CONCRETE_HOURS_STARTER,
        })
      );
    }
  }

  if (physical.system === "CONCRETE_SLEEPER_WALL" && physical.sleeperTakeoff) {
    const posts = physical.sleeperTakeoff.postCount ?? 0;
    const sleepers = physical.sleeperTakeoff.sleeperCount ?? 0;
    labour.push(
      labourSlot({
        workAreaId,
        componentKey: RW_SLEEPER_POST_LABOUR_COMPONENT,
        description: "Steel post installation",
        productivityKey: RW_PRODUCTIVITY_KEYS.sleeperPostsEa,
        unit: "ea",
        quantity: posts,
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: detailedLabourSource,
        fallbackHoursPerUnit: sleeper2APostHours(pilingMethod.method),
      }),
      labourSlot({
        workAreaId,
        componentKey: RW_SLEEPER_CONCRETE_LABOUR_COMPONENT,
        description: "Post-hole concrete placement",
        productivityKey: RW_PRODUCTIVITY_KEYS.sleeperConcreteHole,
        unit: "hole",
        quantity: posts,
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: detailedLabourSource,
      }),
      labourSlot({
        workAreaId,
        componentKey: RW_SLEEPER_FACE_LABOUR_COMPONENT,
        description: "Concrete sleeper installation",
        productivityKey: RW_PRODUCTIVITY_KEYS.sleeperSleepersEa,
        unit: "ea",
        quantity: sleepers,
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: detailedLabourSource,
      })
    );
    const novacoilQty = qtyOf(pricedMaterials, RW_NOVACOIL_COMPONENT);
    if (hasTrustedPhysicalQuantity(novacoilQty)) {
      labour.push(
        labourSlot({
          workAreaId,
          componentKey: RW_DRAINAGE_LABOUR_COMPONENT,
          description: "Drainage installation labour",
          productivityKey: RW_PRODUCTIVITY_KEYS.drainageLm,
          unit: "lm",
          quantity: novacoilQty,
          rates,
          hourlyCost: labourRate.costRate,
          rateProvenance: detailedLabourSource,
        })
      );
      assumptions.push(
        `Sleeper drainage labour ownership: ${RW_TIMBER_DRAINAGE_LABOUR_OWNERSHIP}.`
      );
    }
  }

  if (physical.system === "CONCRETE_MASONRY_WALL" && masonry) {
    labour.push(
      labourSlot({
        workAreaId,
        componentKey: RW_MASONRY_SUBBASE_LABOUR_COMPONENT,
        description: "Sub-base compaction",
        productivityKey: RW_PRODUCTIVITY_KEYS.masonrySubbaseM2,
        unit: "m2",
        quantity: masonry.subbaseM2,
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: detailedLabourSource,
      }),
      labourSlot({
        workAreaId,
        componentKey: RW_MASONRY_FOOTING_LABOUR_COMPONENT,
        description: "Footing concrete placement",
        productivityKey: RW_PRODUCTIVITY_KEYS.masonryFootingM3,
        unit: "m3",
        quantity: masonry.footingM3,
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: detailedLabourSource,
      })
    );
    if (hasTrustedPhysicalQuantity(masonry.horizontalRebarLm)) {
      labour.push(
        labourSlot({
          workAreaId,
          componentKey: RW_MASONRY_REBAR_LABOUR_COMPONENT,
          description: "Rebar installation",
          productivityKey: RW_PRODUCTIVITY_KEYS.masonryRebarLm,
          unit: "lm",
          quantity: masonry.horizontalRebarLm!,
          rates,
          hourlyCost: labourRate.costRate,
          rateProvenance: detailedLabourSource,
        })
      );
    }
    const blockMethod = getStringFact(
      facts as EstimateFact[],
      workAreaId,
      "retaining_wall.block_laying_method"
    );
    if (masonry.subcontractBlocks || isSubcontractMethod(blockMethod)) {
      const scope = masonry.subcontractScope;
      const blockSub = planningMaterial({
        workAreaId,
        componentKey: RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT,
        description: "Masonry block laying — subcontract labour",
        materialKey: RW_MASONRY_BLOCK_SUBCONTRACT_KEY,
        category: "SUBCONTRACT",
        specification: formatMasonryBlockSubcontractBuilderCopy(scope),
        baseQuantity: face,
        baseUnit: "m2",
        wasteFactor: 0,
        purchaseQuantity: face,
        purchaseUnit: "m2",
        factKeys: [
          "retaining_wall.block_laying_method",
          "retaining_wall.masonry.subcontract_scope",
        ],
        source: "retaining_wall.masonry.subcontract",
      });
      pricedMaterials.push(
        priceMaterial(blockSub, rates, organisationSettings, inheritedBenchmarks)
      );
      if (
        pricedMaterials.find(
          (row) => row.componentKey === RW_MASONRY_BLOCK_SUBCONTRACT_COMPONENT
        )?.priced !== true
      ) {
        missingInfo.push("Masonry block laying subcontract rate");
      }
    } else {
      labour.push(
        labourSlot({
          workAreaId,
          componentKey: RW_MASONRY_BLOCK_LABOUR_COMPONENT,
          description: "Block laying",
          productivityKey: RW_PRODUCTIVITY_KEYS.masonryBlockM2,
          unit: "m2",
          quantity: face,
          rates,
          hourlyCost: labourRate.costRate,
          rateProvenance: detailedLabourSource,
        })
      );
    }
    if (hasTrustedPhysicalQuantity(masonry.coreFillM3)) {
      labour.push(
        labourSlot({
          workAreaId,
          componentKey: RW_MASONRY_CORE_LABOUR_COMPONENT,
          description: "Core filling",
          productivityKey: RW_PRODUCTIVITY_KEYS.masonryCoreFillM3,
          unit: "m3",
          quantity: masonry.coreFillM3!,
          rates,
          hourlyCost: labourRate.costRate,
          rateProvenance: detailedLabourSource,
        })
      );
    }
    if (hasTrustedPhysicalQuantity(masonry.waterproofingM2)) {
      const wpMethod = getStringFact(
        facts as EstimateFact[],
        workAreaId,
        "retaining_wall.waterproofing_method"
      );
      if (isSubcontractMethod(wpMethod)) {
        const wpSub = planningMaterial({
          workAreaId,
          componentKey: RW_MASONRY_WATERPROOF_SUBCONTRACT_COMPONENT,
          description: "Retaining-side waterproofing subcontract",
          materialKey: RW_MASONRY_WATERPROOF_SUBCONTRACT_KEY,
          category: "SUBCONTRACT",
          specification:
            "Subcontract XOR self-perform. No duplicate waterproofing labour. Retaining-side only.",
          baseQuantity: masonry.waterproofingM2!,
          baseUnit: "m2",
          wasteFactor: 0,
          purchaseQuantity: masonry.waterproofingM2!,
          purchaseUnit: "m2",
          factKeys: ["retaining_wall.waterproofing_method"],
          source: "retaining_wall.masonry.waterproof.subcontract",
        });
        pricedMaterials.push(
          priceMaterial(wpSub, rates, organisationSettings, inheritedBenchmarks)
        );
        if (
          pricedMaterials.find(
            (row) =>
              row.componentKey === RW_MASONRY_WATERPROOF_SUBCONTRACT_COMPONENT
          )?.priced !== true
        ) {
          missingInfo.push("Waterproofing subcontract rate");
        }
      } else {
        labour.push(
          labourSlot({
            workAreaId,
            componentKey: RW_MASONRY_WATERPROOF_LABOUR_COMPONENT,
            description: "Retaining-side waterproofing",
            productivityKey: RW_PRODUCTIVITY_KEYS.masonryWaterproofM2,
            unit: "m2",
            quantity: masonry.waterproofingM2!,
            rates,
            hourlyCost: labourRate.costRate,
            rateProvenance: detailedLabourSource,
          })
        );
      }
    }
    const novacoilQty = qtyOf(pricedMaterials, RW_NOVACOIL_COMPONENT);
    if (hasTrustedPhysicalQuantity(novacoilQty)) {
      labour.push(
        labourSlot({
          workAreaId,
          componentKey: RW_DRAINAGE_LABOUR_COMPONENT,
          description: "Drainage installation labour",
          productivityKey: RW_PRODUCTIVITY_KEYS.drainageLm,
          unit: "lm",
          quantity: novacoilQty,
          rates,
          hourlyCost: labourRate.costRate,
          rateProvenance: detailedLabourSource,
        })
      );
      assumptions.push(
        `Masonry drainage labour ownership: ${RW_TIMBER_DRAINAGE_LABOUR_OWNERSHIP}.`
      );
    }
  }

  const backfillRow = materialOf(pricedMaterials, RW_BACKFILL_COMPONENT);
  const backfillLabourQty = detailedSystem
    ? (backfillRow?.baseQuantity ?? 0)
    : qtyOf(pricedMaterials, RW_BACKFILL_COMPONENT);
  if (hasTrustedPhysicalQuantity(backfillLabourQty)) {
    labour.push(
      labourSlot({
        workAreaId,
        componentKey: RW_BACKFILL_LABOUR_COMPONENT,
        description: detailedSystem
          ? "Drainage backfill labour"
          : "Retaining wall backfill",
        productivityKey: RW_PRODUCTIVITY_KEYS.backfillM3,
        unit: "m3",
        quantity: backfillLabourQty,
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: detailedSystem ? timberLabourSource : labourSource,
      })
    );
  }

  const excavationQty = qtyOf(pricedMaterials, RW_EXCAVATION_COMPONENT);
  if (excavationSubcontracted) {
    const subcontractQty = hasTrustedPhysicalQuantity(excavationQty)
      ? excavationQty
      : physical.geometry?.faceAreaM2 ?? 1;
    const subcontractUnit = hasTrustedPhysicalQuantity(excavationQty) ? "m3" : "item";
    pricedMaterials.push(
      planningMaterial({
        workAreaId,
        componentKey: RW_EXCAVATION_SUBCONTRACT_COMPONENT,
        description: "Excavation subcontract",
        materialKey: RW_EXCAVATION_SUBCONTRACT_COMPONENT,
        category: "EXCAVATION",
        specification:
          "Self-perform excavation labour and plant are not priced. Needs an excavation subcontract rate.",
        baseQuantity: subcontractQty,
        baseUnit: subcontractUnit,
        wasteFactor: 0,
        purchaseQuantity: subcontractQty,
        purchaseUnit: subcontractUnit,
        factKeys: ["retaining_wall.excavation_method"],
        source: "retaining_wall.excavation.subcontract",
      })
    );
    missingInfo.push("Excavation subcontract rate");
  } else if (
    (physical.excavationMode === "EXPLICIT_VOLUME" ||
      physical.excavationMode === "DERIVED") &&
    hasTrustedPhysicalQuantity(excavationQty)
  ) {
    labour.push(
      labourSlot({
        workAreaId,
        componentKey: RW_EXCAVATION_LABOUR_COMPONENT,
        description:
          physical.excavationMode === "DERIVED"
            ? "Excavation labour (derived footing trench)"
            : "Excavation labour",
        productivityKey: retainingWallExcavationProductivityKey(pilingMethod.method),
        unit: "m3",
        quantity: excavationQty,
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: detailedSystem ? timberLabourSource : labourSource,
        fallbackHoursPerUnit: retainingWallExcavationHoursStarter(pilingMethod.method),
      })
    );
  } else if (
    detailedSystem &&
    !masonrySystem &&
    getBooleanFact([...facts], workAreaId, "retaining_wall.excavation_required") === true
  ) {
    labour.push(
      labourSlot({
        workAreaId,
        componentKey: RW_EXCAVATION_LABOUR_COMPONENT,
        description:
          "Excavation labour (EXCAVATION ALLOWANCE — bulk volume not measured, not m³ productivity)",
        productivityKey: RW_PRODUCTIVITY_KEYS.excavationM3,
        unit: "m2",
        quantity: face,
        rates,
        hourlyCost: labourRate.costRate,
        rateProvenance: timberLabourSource,
        fallbackHoursPerUnit: RW_EXCAVATION_UNKNOWN_ALLOWANCE_HOURS_PER_FACE_M2,
      })
    );
    assumptions.push(
      `Excavation required without measured m³. ${RW_EXCAVATION_UNKNOWN_TREATMENT} at ${RW_EXCAVATION_UNKNOWN_ALLOWANCE_HOURS_PER_FACE_M2} h/face-m². ${sleeperSystem ? "Post-hole work stays in post installation labour." : "Pile-hole work stays in piling labour."} No invented bulk m³.`
    );
  }

  const spoil = resolveSpoilRemoval({
    facts,
    workAreaId,
    excavationVolumeM3: hasTrustedPhysicalQuantity(excavationQty)
      ? excavationQty
      : null,
  });
  assumptions.push(...spoil.assumptions);
  missingInfo.push(...spoil.missingInfo);
  if (
    detailedSystem &&
    spoil.removalRequired === true &&
    spoil.quantityKnown &&
    spoil.removalVolumeM3 != null
  ) {
    const spoilQty = spoil.removalVolumeM3;
    const spoilSpec = spoil.exceedsMeasured
      ? `${round2(spoilQty)} m³ measured-equivalent spoil leaving site. ${RW_SPOIL_REMOVAL_EXCEEDS_MEASURED} All-in cartage + tip on measured m³. No bulking. Not drainage aggregate. Not excavation labour.`
      : `${round2(spoilQty)} m³ measured in-situ excavation leaving site. All-in cartage + tip on the same measured m³. No bulking. Not drainage aggregate. Not excavation labour.`;
    const spoilRow = planningMaterial({
      workAreaId,
      componentKey: RW_SPOIL_DISPOSAL_COMPONENT,
      description: "Spoil removal",
      materialKey: RW_SPOIL_REMOVAL_ALL_IN_M3_KEY,
      category: "WASTE",
      specification: spoilSpec,
      baseQuantity: spoilQty,
      baseUnit: "m3",
      wasteFactor: 0,
      purchaseQuantity: spoilQty,
      purchaseUnit: "m3",
      factKeys: [
        "retaining_wall.disposal_included",
        "retaining_wall.excavation_volume_m3",
        RW_SPOIL_REMOVAL_PORTION_KEY,
        RW_SPOIL_REMOVAL_VOLUME_KEY,
      ],
      source: "retaining_wall.spoil.removal",
    });
    const pricedSpoil = priceMaterial(
      spoilRow,
      rates,
      organisationSettings,
      inheritedBenchmarks
    );
    pricedMaterials.push(pricedSpoil);
    if (pricedSpoil.priced !== true) {
      missingInfo.push(RW_SPOIL_REMOVAL_MISSING_RATE);
    }
  } else if (
    detailedSystem &&
    spoil.removalRequired === true &&
    !spoil.quantityKnown &&
    !spoil.missingInfo.includes(RW_SPOIL_REMOVAL_MISSING_QUANTITY)
  ) {
    missingInfo.push(RW_SPOIL_REMOVAL_MISSING_QUANTITY);
  }

  const plant: PlantRequirement[] = [];
  if (detailedSystem) {
    const machine = pilingMethod.method === RW_TIMBER_PILING_METHOD_MACHINE;
    const measuredExcavationM3 =
      !excavationSubcontracted &&
      (physical.excavationMode === "EXPLICIT_VOLUME" ||
        physical.excavationMode === "DERIVED")
        ? qtyOf(pricedMaterials, RW_EXCAVATION_COMPONENT)
        : null;
    const holeCount = timberSystem
      ? physical.timberPiles?.count ?? 0
      : sleeperSystem
        ? physical.sleeperTakeoff?.postCount ?? 0
        : 0;
    const scaled = timberMiniExcavatorDays({
      method: pilingMethod.method,
      pileCount: holeCount,
      measuredExcavationM3,
      rates,
    });
    const quantity = machine ? scaled.days : 0;
    const namedPlant = rates.find(
      (rate) =>
        rate.active &&
        rate.item_key === RW_MINI_EXCAVATOR_DAY_KEY &&
        rate.cost_rate != null
    );
    const unitCost = machine
      ? Number(namedPlant?.cost_rate ?? RW_MINI_EXCAVATOR_DAY_COST_EX_GST)
      : 0;
    const plantComponent = timberSystem
      ? RW_TIMBER_PLANT_COMPONENT
      : sleeperSystem
        ? RW_SLEEPER_PLANT_COMPONENT
        : RW_MASONRY_PLANT_COMPONENT;
    const plantReq: PlantRequirement = {
      requirementId: buildRequirementId({
        workAreaId,
        kind: "plant",
        componentKey: plantComponent,
      }),
      kind: "plant",
      workAreaId,
      workAreaType: "retaining_wall",
      componentKey: plantComponent,
      description: machine
        ? "Mini-excavator / auger"
        : masonrySystem
          ? "Plant not applicable — manual excavation (machine cannot reach workface)"
          : sleeperSystem
            ? "Plant not applicable — manual post holes (machine cannot reach workface)"
            : "Plant not applicable — manual piling (machine cannot reach workface)",
      confidence: "medium",
      assumptions: [
        {
          key: "rw_plant_method",
          text: `${pilingMethod.disclosure} ${RW_MINI_EXCAVATOR_DAY_BASIS}. ${scaled.basis}`,
          source: "calculator_default",
        },
      ],
      provenance: {
        calculatorSource: masonrySystem
          ? "retaining_wall.masonry.plant"
          : sleeperSystem
            ? "retaining_wall.sleeper.plant"
            : "retaining_wall.timber.plant",
        factKeys: [],
        constraintKeys: ["site_access"],
      },
      priced: true,
      plantKey: RW_MINI_EXCAVATOR_DAY_KEY,
      hours: scaled.totalMachineHours,
      quantity,
      unit: "day",
      unitCost,
      totalCost: round2(quantity * unitCost),
    };
    plant.push(normalizeRequirement(plantReq) as PlantRequirement);
  }

  for (const row of pricedMaterials) {
    if (SKIP_MONEY.has(row.componentKey)) continue;
    if (row.componentKey === RW_SPOIL_DISPOSAL_COMPONENT) continue;
    if (row.componentKey === RW_MASONRY_REBAR_ALLOWANCE_COMPONENT) continue;
    if (row.componentKey === RW_MASONRY_MORTAR_COMPONENT) continue;
    if (hasTrustedPhysicalQuantity(row.purchaseQuantity) && row.priced !== true) {
      missingInfo.push(`${row.description} trusted price`);
    }
  }
  for (const row of labour) {
    if (row.priced !== true) missingInfo.push(`${row.description} productivity`);
  }

  const requirements = [...pricedMaterials, ...labour, ...plant];
  let coverage = evaluateRetainingWallCommercialCoverage({
    physical,
    requirements,
    gaps,
  });
  coverage = coverage.map((row) => {
    if (row.key !== "excavation_labour") return row;
    const excavationLabour = labour.find(
      (item) => item.componentKey === RW_EXCAVATION_LABOUR_COMPONENT
    );
    if (
      excavationLabour?.priced === true &&
      excavationLabour.description.includes("allowance")
    ) {
      return {
        ...row,
        state: "EXPLICIT_ALLOWANCE" as const,
        required: true,
      };
    }
    return row;
  });
  const commerciallyReady = retainingWallCoverageIsReady(coverage);
  const postPromotion = retainingWallPostPromotionHold(coverage);
  const detailedMoney = commerciallyReady || (postPromotion && !commerciallyReady);
  const mode: RetainingWallSystemAuthorityMode = detailedMoney
    ? "DETAILED_COMPONENT_AUTHORITY"
    : "LEGACY_PACKAGE_AUTHORITY";
  const lifecycle: RetainingWallPackageLifecycle = commerciallyReady
    ? "DETAILED_COMPONENT_AUTHORITATIVE"
    : postPromotion && detailedMoney
      ? "DETAILED_COMPONENT_AUTHORITATIVE"
      : "DETAILED_PHYSICAL_SHADOW";
  const excavationAllowance = labour.some(
    (item) =>
      item.componentKey === RW_EXCAVATION_LABOUR_COMPONENT &&
      item.description.includes("EXCAVATION ALLOWANCE")
  );
  const reason = commerciallyReady
    ? excavationAllowance
      ? `${
          timberSystem
            ? RW_TIMBER_AUTHORITY_WITH_ALLOWANCE
            : sleeperSystem
              ? RW_SLEEPER_AUTHORITY_WITH_ALLOWANCE
              : RW_MASONRY_AUTHORITY_WITH_ALLOWANCE
        }. Detailed component money is authoritative. Excavation is an explicit allowance, not measured m³.`
      : "Required commercial categories are covered. Detailed component money is authoritative."
    : detailedMoney
      ? "Detailed money remains after promotion. A missing exact material rate is Pricing Required and does not restore package."
      : RW_QUICK_ESTIMATE_PACKAGE_NOTE;
  if (mode === "LEGACY_PACKAGE_AUTHORITY") {
    assumptions.push(RW_QUICK_ESTIMATE_PACKAGE_NOTE);
  }

  return {
    mode,
    physicalMode,
    lifecycle,
    commerciallyReady,
    coverage,
    reason,
    requirements,
    residualClass:
      timberSystem
        ? RW_TIMBER_FIXINGS_METHOD
        : sleeperSystem
          ? RW_SLEEPER_FIXINGS_TREATMENT
          : masonrySystem
            ? RW_MASONRY_REBAR_TREATMENT
            : "NOT_APPLICABLE",
    backfillProcurement:
      detailedSystem && hasTrustedPhysicalQuantity(backfillLabourQty)
        ? RW_DRAINAGE_AGGREGATE_PROCUREMENT_BASIS
        : hasTrustedPhysicalQuantity(backfillLabourQty)
          ? RW_BACKFILL_PROCUREMENT_STATUS
          : "NOT_APPLICABLE",
    novacoilLabourOwnership:
      detailedSystem
        ? RW_TIMBER_DRAINAGE_LABOUR_OWNERSHIP
        : RW_NOVACOIL_LABOUR_OWNERSHIP,
    gaps,
    inheritedBenchmarks,
    assumptions,
    missingInfo,
  };
}

export function detailedMoneyMaterials(
  requirements: readonly EstimateRequirement[]
): MaterialRequirement[] {
  return requirements.filter(
    (row): row is MaterialRequirement =>
      row.kind === "material" &&
      row.componentKey !== RW_FACE_AREA_COMPONENT &&
      row.componentKey !== RW_TIMBER_PILES_EA_COMPONENT &&
      row.componentKey !== RW_TIMBER_PILES_LM_COMPONENT &&
      row.componentKey !== RW_SLEEPER_POSTS_EA_COMPONENT &&
      row.componentKey !== RW_SLEEPER_POSTS_LM_COMPONENT &&
      row.componentKey !== RW_EXCAVATION_COMPONENT &&
      hasTrustedPhysicalQuantity(row.purchaseQuantity)
  );
}

export function detailedLabour(
  requirements: readonly EstimateRequirement[]
): LabourRequirement[] {
  return requirements.filter(
    (row): row is LabourRequirement => row.kind === "labour"
  );
}

export function detailedPlant(
  requirements: readonly EstimateRequirement[]
): PlantRequirement[] {
  return requirements.filter(
    (row): row is PlantRequirement =>
      row.kind === "plant" && (row.quantity ?? 0) > 0 && row.priced === true
  );
}

export function packageXorDetailedHolds(params: {
  mode: RetainingWallSystemAuthorityMode;
  hasPackageFaceLine: boolean;
  hasDetailedMoneyLine: boolean;
}): boolean {
  if (params.mode === "DETAILED_COMPONENT_AUTHORITY") {
    return !params.hasPackageFaceLine;
  }
  return !params.hasDetailedMoneyLine;
}
