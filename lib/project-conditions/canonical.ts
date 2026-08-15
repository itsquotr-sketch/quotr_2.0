/**
 * FOUNDATION-R1 — Canonical Project Conditions namespace.
 *
 * Persistence authority remains the `constraints` table and
 * `RESERVED_CONSTRAINT_KEYS`. This module does not create a second store.
 *
 * Keys are not renamed (historical data). Aliases map legacy spellings onto
 * the canonical key.
 */

import {
  RESERVED_CONSTRAINT_KEYS,
  type ReservedConstraintKey,
} from "@/lib/scopes/domain-ownership";

export const PROJECT_CONDITIONS_CONTRACT_VERSION = "foundation-r1.0" as const;

/** Canonical constraint keys that Project Conditions owns. */
export const CANONICAL_PROJECT_CONDITION_KEYS = RESERVED_CONSTRAINT_KEYS;

export type CanonicalProjectConditionKey = ReservedConstraintKey;

/**
 * Legacy / AI spellings → canonical constraint key.
 * Do not write alias keys; resolve then persist canonical.
 */
export const PROJECT_CONDITION_KEY_ALIASES: Readonly<Record<string, CanonicalProjectConditionKey>> =
  Object.freeze({
    site_occupied: "occupied_site",
    occupied: "occupied_site",
    access: "site_access",
    siteaccess: "site_access",
    carry_distance: "material_carry_distance",
    material_carry: "material_carry_distance",
    carting_distance: "material_carry_distance",
    floor: "floor_level",
    working_hour_restrictions: "working_hours",
    hours_restriction: "working_hours",
    noise_hours: "working_hours",
    parking: "parking_loading",
    loading: "parking_loading",
    hazmat: "hazardous_materials_risk",
    asbestos: "hazardous_materials_risk",
    services: "services_isolated",
    live_services: "services_isolated",
  });

export function resolveCanonicalProjectConditionKey(
  key: string
): CanonicalProjectConditionKey | null {
  const normalized = key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((RESERVED_CONSTRAINT_KEYS as readonly string[]).includes(normalized)) {
    return normalized as CanonicalProjectConditionKey;
  }
  return PROJECT_CONDITION_KEY_ALIASES[normalized] ?? null;
}

/**
 * Work-Area Fact keys that duplicate a project-wide condition.
 * These must not be generated as Scope Details questions.
 * Historical rows remain readable via the legacy adapter.
 */
export const PROJECT_CONDITION_DUPLICATE_FACT_KEYS: readonly string[] = [
  "deck.access",
  "fence.access",
  "pergola.access",
  "bathroom.access",
  "kitchen.access",
  "internal_walls.access",
  "flooring.access",
  "external_stairs.access",
  "demolition.access",
  "retaining_wall.access",
  "painting.access",
  "doors.access",
  "plastering.access",
  "demolition.floor_level",
  "demolition.carting_distance_m",
  "demolition.noise_hours_restriction",
  "demolition.services_isolated",
  "demolition.hazardous_materials_risk",
  "retaining_wall.carting_distance_m",
];

const DUPLICATE_FACT_KEY_SET = new Set(PROJECT_CONDITION_DUPLICATE_FACT_KEYS);

/**
 * Local Facts that contain "access" (or similar) but are NOT project logistics.
 * Keep asking / consuming these as Work-Area Facts.
 */
export const LOCAL_WORK_AREA_ACCESS_FACT_KEYS: readonly string[] = [
  "deck.access_type",
  "ceilings.access",
];

const LOCAL_ACCESS_FACT_KEY_SET = new Set(LOCAL_WORK_AREA_ACCESS_FACT_KEYS);

export function isLocalWorkAreaAccessFactKey(factKey: string): boolean {
  return LOCAL_ACCESS_FACT_KEY_SET.has(factKey);
}

export function isProjectConditionDuplicateFactKey(factKey: string): boolean {
  if (isLocalWorkAreaAccessFactKey(factKey)) return false;
  if (DUPLICATE_FACT_KEY_SET.has(factKey)) return true;
  // Occupied / hours clones if any future WA keys appear.
  if (/\.occupied(_site)?$/.test(factKey)) return true;
  if (/\.(working_hours|noise_hours_restriction)$/.test(factKey)) return true;
  return false;
}

/**
 * New AI/enrich ingest must not persist a second copy of a project condition.
 * Carting metres stay readable as haulage quantity (not an access multiplier).
 */
export function shouldDropDuplicateFactOnIngest(factKey: string): boolean {
  if (!isProjectConditionDuplicateFactKey(factKey)) return false;
  if (factKey.endsWith(".carting_distance_m")) return false;
  return true;
}

/** Maps a duplicate WA fact key to the canonical constraint it shadows. */
export const DUPLICATE_FACT_TO_CONSTRAINT: Readonly<
  Record<string, CanonicalProjectConditionKey>
> = Object.freeze({
  "deck.access": "site_access",
  "fence.access": "site_access",
  "pergola.access": "site_access",
  "bathroom.access": "site_access",
  "kitchen.access": "site_access",
  "internal_walls.access": "site_access",
  "flooring.access": "site_access",
  "external_stairs.access": "site_access",
  "demolition.access": "site_access",
  "retaining_wall.access": "site_access",
  "painting.access": "site_access",
  "doors.access": "site_access",
  "plastering.access": "site_access",
  "demolition.floor_level": "floor_level",
  "demolition.carting_distance_m": "material_carry_distance",
  "retaining_wall.carting_distance_m": "material_carry_distance",
  "demolition.noise_hours_restriction": "working_hours",
  "demolition.services_isolated": "services_isolated",
  "demolition.hazardous_materials_risk": "hazardous_materials_risk",
});

export type ProjectConditionSemanticTopic =
  | "site.access"
  | "site.carry"
  | "site.floor_level"
  | "site.occupied"
  | "site.working_hours"
  | "site.parking_loading"
  | "site.waste_bin"
  | "risk.hazmat"
  | "risk.services"
  | "risk.protection"
  | "site.slope"
  | "commercial.client_supplied"
  | "commercial.by_others"
  | "compliance.consent";

export const CONSTRAINT_KEY_TO_TOPIC: Readonly<
  Record<CanonicalProjectConditionKey, ProjectConditionSemanticTopic>
> = Object.freeze({
  site_access: "site.access",
  material_carry_distance: "site.carry",
  floor_level: "site.floor_level",
  occupied_site: "site.occupied",
  working_hours: "site.working_hours",
  parking_loading: "site.parking_loading",
  waste_bin_access: "site.waste_bin",
  hazardous_materials_risk: "risk.hazmat",
  services_isolated: "risk.services",
  protection_dust_control: "risk.protection",
  site_slope: "site.slope",
  client_supplied_items: "commercial.client_supplied",
  by_others_trades: "commercial.by_others",
  consent_engineering: "compliance.consent",
});
