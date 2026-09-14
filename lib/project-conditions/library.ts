/**
 * EST-BENCHMARK-01A — canonical Project Condition library.
 *
 * Persistence remains the `constraints` table. This is the product library
 * for relevance, Details grouping, and Ready. Do not create per-WA stores.
 */

import type { CanonicalProjectConditionKey } from "@/lib/project-conditions/canonical";

export const PROJECT_CONDITION_LIBRARY_VERSION = "est-benchmark-01a.0" as const;

export const HIGH_LEVEL_ACCESS_KEY = "high_level_access" as const;
export const HIGH_LEVEL_ACCESS_THRESHOLD_M = 3 as const;

export type ProjectConditionLibraryGroup =
  | "access"
  | "occupancy"
  | "working_restrictions"
  | "handling"
  | "disposal"
  | "other";

export type ProjectConditionAskPolicy = "ASK_NOW" | "ASSUME_IF_SKIPPED" | "OPTIONAL";

export type ProjectConditionLibraryDef = {
  readonly key: CanonicalProjectConditionKey;
  readonly group: ProjectConditionLibraryGroup;
  readonly groupLabel: string;
  readonly label: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly assumptionStatement: string | null;
  readonly disclosedValue: string | null;
  readonly defaultAsk: ProjectConditionAskPolicy;
  readonly consumedByEstimator: boolean;
  readonly notes: string;
};

export const PROJECT_CONDITION_GROUP_LABEL: Record<
  ProjectConditionLibraryGroup,
  string
> = {
  access: "Access",
  occupancy: "Site occupancy",
  working_restrictions: "Working restrictions",
  handling: "Material handling",
  disposal: "Demolition / disposal",
  other: "Other",
};

export const PROJECT_CONDITION_LIBRARY: readonly ProjectConditionLibraryDef[] = [
  {
    key: "site_access",
    group: "access",
    groupLabel: "Access",
    label: "Site access",
    question: "How difficult is site access?",
    options: ["Easy", "Moderate", "Difficult", "Very poor"],
    assumptionStatement: "Standard access",
    disclosedValue: null,
    defaultAsk: "ASK_NOW",
    consumedByEstimator: true,
    notes: "Labour productivity / getting to the work area. Asked once per Project.",
  },
  {
    key: "high_level_access",
    group: "access",
    groupLabel: "Access",
    label: "High-level access",
    question: "How will you reach the work at height?",
    options: [
      "Mobile scaffold",
      "Scaffold",
      "MEWP",
      "Not sure",
    ],
    assumptionStatement: "Mobile scaffold for work above 3.0 m",
    disclosedValue: "Mobile scaffold",
    defaultAsk: "ASK_NOW",
    consumedByEstimator: true,
    notes:
      "Relevant only when interior working height exceeds 3.0 m. Ceiling portion height_m is the height authority — this is the equipment/method question.",
  },
  {
    key: "material_carry_distance",
    group: "handling",
    groupLabel: "Material handling",
    label: "Carry distance",
    question: "Distance from material drop-off?",
    options: ["< 10m", "10–30m", "> 30m", "Not sure"],
    assumptionStatement: "Standard carry",
    disclosedValue: null,
    defaultAsk: "ASK_NOW",
    consumedByEstimator: true,
    notes: "Incoming material carry. Spoil/export is a different waste path.",
  },
  {
    key: "floor_level",
    group: "access",
    groupLabel: "Access",
    label: "Floor level",
    question: "What floor are the works on?",
    options: ["Ground", "Upper floor", "Basement", "Not sure"],
    assumptionStatement: "Ground floor",
    disclosedValue: "Ground",
    defaultAsk: "ASSUME_IF_SKIPPED",
    consumedByEstimator: false,
    notes: "Vertical logistics. Assumable for ordinary interior work.",
  },
  {
    key: "occupied_site",
    group: "occupancy",
    groupLabel: "Site occupancy",
    label: "Occupied site",
    question: "Is the site occupied during works?",
    options: ["Yes", "No", "Not sure"],
    assumptionStatement: "Unoccupied site",
    disclosedValue: "No",
    defaultAsk: "ASSUME_IF_SKIPPED",
    consumedByEstimator: true,
    notes: "Occupied-site productivity. Assumed vacant unless stated.",
  },
  {
    key: "protection_dust_control",
    group: "occupancy",
    groupLabel: "Site occupancy",
    label: "Protection / dust control",
    question: "Is extra protection or dust control required?",
    options: ["Yes", "No", "Not sure"],
    assumptionStatement: "Standard protection",
    disclosedValue: "No",
    defaultAsk: "ASSUME_IF_SKIPPED",
    consumedByEstimator: false,
    notes: "Relevant when occupied or demolition. Do not ask if unused.",
  },
  {
    key: "working_hours",
    group: "working_restrictions",
    groupLabel: "Working restrictions",
    label: "Working hours",
    question: "Are there working-hour restrictions?",
    options: ["No", "Yes", "Not sure"],
    assumptionStatement: "Normal working hours",
    disclosedValue: "No",
    defaultAsk: "ASSUME_IF_SKIPPED",
    consumedByEstimator: true,
    notes: "Restricted/out-of-hours productivity.",
  },
  {
    key: "waste_bin_access",
    group: "disposal",
    groupLabel: "Demolition / disposal",
    label: "Waste access",
    question: "Is skip or bin access straightforward?",
    options: ["Easy", "Moderate", "Poor", "Not sure"],
    assumptionStatement: "Standard waste handling",
    disclosedValue: null,
    defaultAsk: "ASK_NOW",
    consumedByEstimator: false,
    notes: "Only when demolition / disposal is in scope.",
  },
  {
    key: "parking_loading",
    group: "handling",
    groupLabel: "Material handling",
    label: "Parking / loading",
    question: "Is parking or loading available on site?",
    options: ["Easy", "Moderate", "Poor", "Not sure"],
    assumptionStatement: null,
    disclosedValue: null,
    defaultAsk: "OPTIONAL",
    consumedByEstimator: false,
    notes: "Optional convenience. Do not ask unless it changes handling.",
  },
  {
    key: "hazardous_materials_risk",
    group: "disposal",
    groupLabel: "Demolition / disposal",
    label: "Hazardous materials",
    question: "Is there asbestos or hazardous materials risk?",
    options: ["Yes", "No", "Not sure"],
    assumptionStatement: null,
    disclosedValue: null,
    defaultAsk: "ASSUME_IF_SKIPPED",
    consumedByEstimator: false,
    notes: "Required for demolition; assumable on reno.",
  },
  {
    key: "services_isolated",
    group: "disposal",
    groupLabel: "Demolition / disposal",
    label: "Services isolated",
    question: "Are services isolated before strip-out?",
    options: ["Yes", "No", "Not sure"],
    assumptionStatement: null,
    disclosedValue: null,
    defaultAsk: "ASSUME_IF_SKIPPED",
    consumedByEstimator: false,
    notes: "Required for demolition.",
  },
  {
    key: "site_slope",
    group: "other",
    groupLabel: "Other",
    label: "Site slope",
    question: "Is the site sloped?",
    options: ["Yes", "No", "Not sure"],
    assumptionStatement: null,
    disclosedValue: null,
    defaultAsk: "ASSUME_IF_SKIPPED",
    consumedByEstimator: true,
    notes: "Outdoor labour only.",
  },
  {
    key: "client_supplied_items",
    group: "other",
    groupLabel: "Other",
    label: "Client supplied items",
    question: "Are any items client-supplied?",
    options: ["Yes", "No", "Not sure"],
    assumptionStatement: null,
    disclosedValue: null,
    defaultAsk: "OPTIONAL",
    consumedByEstimator: false,
    notes: "Do not ask unless the estimator consumes the split.",
  },
  {
    key: "by_others_trades",
    group: "other",
    groupLabel: "Other",
    label: "Works by others",
    question: "Are other trades completing related work?",
    options: ["Yes", "No", "Not sure"],
    assumptionStatement: null,
    disclosedValue: null,
    defaultAsk: "OPTIONAL",
    consumedByEstimator: false,
    notes: "Trade split. Optional.",
  },
  {
    key: "consent_engineering",
    group: "other",
    groupLabel: "Other",
    label: "Consent / engineering",
    question: "Is consent or engineering required?",
    options: ["Yes", "No", "Not sure"],
    assumptionStatement: null,
    disclosedValue: null,
    defaultAsk: "ASSUME_IF_SKIPPED",
    consumedByEstimator: false,
    notes: "Outdoor / consent-sensitive WAs.",
  },
];

export function getProjectConditionLibraryDef(
  key: string
): ProjectConditionLibraryDef | null {
  return PROJECT_CONDITION_LIBRARY.find((row) => row.key === key) ?? null;
}

export function projectConditionDetailsGroupLabel(key: string): string {
  return getProjectConditionLibraryDef(key)?.groupLabel ?? "Project Conditions";
}
