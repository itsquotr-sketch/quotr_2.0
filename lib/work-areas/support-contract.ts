/**
 * FOUNDATION-R1 — Supported Work Area capability contract.
 *
 * Independent of Setup preferences (`organisation_work_areas.enabled`).
 * Product creatable types remain `SCOPE_CATALOGUE`. This module grades
 * commercial maturity so UI does not claim every recognised type equally.
 */

import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";

export const SUPPORTED_WORK_AREA_CONTRACT_VERSION = "foundation-r1.0" as const;

/** Customer-facing bands — never A/B/C/D/E in UI. */
export type WorkAreaCapabilityBand =
  | "trial_supported"
  | "developing"
  | "component"
  | "unsupported";

export type WorkAreaSupportRole =
  | "tier1_trial"
  | "tier2_developing"
  | "component_utility"
  | "commercial_parent"
  | "unsupported";

export type WorkAreaSupportEntry = {
  type: string;
  role: WorkAreaSupportRole;
  band: WorkAreaCapabilityBand;
  /** Customer-facing short label. */
  label: string;
  inProductCatalogue: boolean;
  estimatableAsWorkArea: boolean;
  notes: string;
};

const TRIAL_SUPPORTED_TYPES = ["deck", "bathroom"] as const;

const TIER2_DEVELOPING_TYPES = [
  "retaining_wall",
  "fence",
  "pergola",
  "kitchen",
] as const;

/** Commercial interior is composed of these product WAs — not a parent calculator. */
export const COMMERCIAL_INTERIOR_COMPONENT_TYPES = [
  "demolition",
  "internal_walls",
  "ceilings",
  "doors",
  "flooring",
  "painting",
  "plastering",
] as const;

const COMPONENT_UTILITY_TYPES = [
  "external_stairs",
  ...COMMERCIAL_INTERIOR_COMPONENT_TYPES,
] as const;

export const COMMERCIAL_INTERIOR_PARENT_TYPE = "commercial_fitout" as const;

export const UNSUPPORTED_WORK_AREA_TYPES = [
  "cladding",
  "roofing",
  "windows",
  "landscaping",
  "earthworks",
  "drainage",
  "plumbing",
  "electrical",
  "carpentry",
  "renovation",
  "extension",
  "other",
  "custom",
  COMMERCIAL_INTERIOR_PARENT_TYPE,
] as const;

const PRODUCT_TYPE_SET = new Set(SCOPE_CATALOGUE.map((item) => item.type));

function entry(
  type: string,
  role: WorkAreaSupportRole,
  band: WorkAreaCapabilityBand,
  label: string,
  notes: string
): WorkAreaSupportEntry {
  const inProduct = PRODUCT_TYPE_SET.has(type);
  return {
    type,
    role,
    band,
    label,
    inProductCatalogue: inProduct,
    estimatableAsWorkArea: inProduct && band !== "unsupported",
    notes,
  };
}

export const WORK_AREA_SUPPORT_ENTRIES: readonly WorkAreaSupportEntry[] = [
  entry(
    "deck",
    "tier1_trial",
    "trial_supported",
    "Trial-supported",
    "Trial Quick Estimate. Takeoff / labour breakdown not yet claimed."
  ),
  entry(
    "bathroom",
    "tier1_trial",
    "trial_supported",
    "Trial-supported",
    "Trial Quick Estimate. Trade packages / allowances."
  ),
  ...TIER2_DEVELOPING_TYPES.map((type) =>
    entry(
      type,
      "tier2_developing",
      "developing",
      "Developing",
      "Recognised calculator; not a Tier-1 commercial claim."
    )
  ),
  ...COMPONENT_UTILITY_TYPES.map((type) =>
    entry(
      type,
      "component_utility",
      "component",
      "Component",
      type === "external_stairs"
        ? "Often nested under Deck. Not a standalone Tier-1 claim."
        : "Commercial interior component. Price as this WA, not commercial_fitout."
    )
  ),
  entry(
    COMMERCIAL_INTERIOR_PARENT_TYPE,
    "commercial_parent",
    "unsupported",
    "Not supported as a work area",
    "ISD parent / job class only. Do not create a monolithic calculator."
  ),
  ...UNSUPPORTED_WORK_AREA_TYPES.filter(
    (type) => type !== COMMERCIAL_INTERIOR_PARENT_TYPE
  ).map((type) =>
    entry(
      type,
      "unsupported",
      "unsupported",
      "Not supported yet",
      "Not a product Work Area. Do not present as estimate-ready."
    )
  ),
];

const BY_TYPE = new Map(WORK_AREA_SUPPORT_ENTRIES.map((e) => [e.type, e]));

export function getWorkAreaSupportEntry(
  type: string
): WorkAreaSupportEntry | undefined {
  return BY_TYPE.get(type);
}

export function getWorkAreaCapabilityBand(
  type: string
): WorkAreaCapabilityBand {
  return BY_TYPE.get(type)?.band ?? "unsupported";
}

/** Customer-facing capability copy. Never "Estimate-ready". */
export function getWorkAreaCapabilityLabel(type: string): string {
  return BY_TYPE.get(type)?.label ?? "Not supported yet";
}

export function isTrialSupportedWorkAreaType(type: string): boolean {
  return (TRIAL_SUPPORTED_TYPES as readonly string[]).includes(type);
}

export function isCommercialInteriorComponentType(type: string): boolean {
  return (COMMERCIAL_INTERIOR_COMPONENT_TYPES as readonly string[]).includes(
    type
  );
}

export function isUnsupportedWorkAreaType(type: string): boolean {
  return getWorkAreaCapabilityBand(type) === "unsupported";
}

export function isMonolithicCommercialFitoutType(type: string): boolean {
  return type === COMMERCIAL_INTERIOR_PARENT_TYPE;
}

/** Product WAs that may be created on a project (catalogue ∩ not unsupported). */
export function getClaimableProductWorkAreaTypes(): string[] {
  return SCOPE_CATALOGUE.map((item) => item.type);
}
