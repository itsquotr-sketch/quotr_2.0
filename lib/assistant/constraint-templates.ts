import type { WorkAreaRef } from "@/lib/scopes/scope-crossover";
import {
  buildFactLookup,
  factHasValue,
  getFactValue,
} from "@/lib/scopes/fact-values";
import type { ExtractedConstraint } from "@/lib/ai/enrich-extraction";
import { STATIC_CONSTRAINT_SEEDS } from "@/lib/assistant/mock-seed";

export type ConstraintTemplateSeed = {
  key: string;
  label: string;
  question_text: string;
  input_type: "select" | "boolean";
  options: string[];
  required: boolean;
  priority: number;
};

const GLOBAL_CONSTRAINT_TEMPLATES: ConstraintTemplateSeed[] = [
  {
    key: "site_access",
    label: "Site access",
    question_text: "How difficult is site access?",
    input_type: "select",
    options: ["Easy", "Moderate", "Difficult", "Very poor"],
    required: true,
    priority: 10,
  },
  {
    key: "floor_level",
    label: "Floor level",
    question_text: "What floor level are works on?",
    input_type: "select",
    options: ["Ground", "Upper floor", "Basement", "Not sure"],
    required: false,
    priority: 15,
  },
  {
    key: "material_carry_distance",
    label: "Material carry distance",
    question_text: "Distance from material drop-off or waste carting?",
    input_type: "select",
    options: ["< 10m", "10–30m", "> 30m", "Not sure"],
    required: true,
    priority: 20,
  },
  {
    key: "waste_bin_access",
    label: "Waste/bin access",
    question_text: "Is skip or bin access straightforward?",
    input_type: "select",
    options: ["Easy", "Moderate", "Poor", "Not sure"],
    required: false,
    priority: 25,
  },
  {
    key: "services_isolated",
    label: "Services isolated",
    question_text: "Are services isolated before works?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: false,
    priority: 30,
  },
  {
    key: "occupied_site",
    label: "Occupied site",
    question_text: "Is the site occupied during works?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: false,
    priority: 35,
  },
  {
    key: "working_hours",
    label: "Working hours",
    question_text: "Are there working-hour restrictions?",
    input_type: "boolean",
    options: ["No", "Yes", "Not sure"],
    required: true,
    priority: 40,
  },
  {
    key: "hazardous_materials_risk",
    label: "Hazardous materials risk",
    question_text: "Is there asbestos or hazardous materials risk?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: false,
    priority: 45,
  },
  {
    key: "parking_loading",
    label: "Parking/loading",
    question_text: "Is parking or loading available on site?",
    input_type: "select",
    options: ["Easy", "Moderate", "Poor", "Not sure"],
    required: false,
    priority: 50,
  },
  {
    key: "protection_dust_control",
    label: "Protection/dust control",
    question_text: "Is additional protection or dust control required?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: false,
    priority: 55,
  },
  {
    key: "client_supplied_items",
    label: "Client-supplied items",
    question_text: "Are major items client supplied?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: false,
    priority: 60,
  },
  {
    key: "by_others_trades",
    label: "By-others trades",
    question_text: "Are any trades explicitly by others?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: false,
    priority: 65,
  },
  {
    key: "consent_engineering",
    label: "Consent/engineering",
    question_text: "Is consent or engineering required?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: false,
    priority: 70,
  },
  {
    key: "site_slope",
    label: "Site slope",
    question_text: "Is the site sloped?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: false,
    priority: 75,
  },
];

const SCOPE_CONSTRAINT_KEYS: Record<string, string[]> = {
  demolition: [
    "services_isolated",
    "hazardous_materials_risk",
    "material_carry_distance",
    "waste_bin_access",
    "floor_level",
    "working_hours",
    "protection_dust_control",
  ],
  kitchen: [
    "client_supplied_items",
    "by_others_trades",
    "occupied_site",
    "material_carry_distance",
    "waste_bin_access",
  ],
  bathroom: [
    "services_isolated",
    "by_others_trades",
    "hazardous_materials_risk",
    "material_carry_distance",
    "occupied_site",
  ],
  internal_walls: [
    "services_isolated",
    "protection_dust_control",
    "occupied_site",
  ],
  painting: [
    "occupied_site",
    "protection_dust_control",
    "client_supplied_items",
  ],
  doors: ["client_supplied_items", "by_others_trades"],
  flooring: ["material_carry_distance", "waste_bin_access"],
  deck: ["site_access", "material_carry_distance", "consent_engineering"],
  retaining_wall: ["site_access", "material_carry_distance", "consent_engineering"],
  fence: ["site_access", "material_carry_distance"],
};

function templateByKey(key: string): ConstraintTemplateSeed | undefined {
  const global = GLOBAL_CONSTRAINT_TEMPLATES.find((item) => item.key === key);
  if (global) return global;
  const seed = STATIC_CONSTRAINT_SEEDS.find((item) => item.key === key);
  if (!seed) return undefined;
  return { ...seed, priority: 0 };
}

function inferConstraintsFromFacts(
  workAreas: WorkAreaRef[],
  lookup: ReturnType<typeof buildFactLookup>
): ExtractedConstraint[] {
  const inferred: ExtractedConstraint[] = [];

  const hasClientSupplied = workAreas.some((wa) => {
    const keys = [
      `${wa.type}.cabinetry_client_supplied`,
      `${wa.type}.client_supplied`,
      `${wa.type}.fixtures_client_supplied`,
      `${wa.type}.appliances_client_supplied`,
      `${wa.type}.paint_client_supplied`,
      `${wa.type}.hardware_client_supplied`,
    ];
    return keys.some((key) => {
      const value = getFactValue(lookup, wa.id, key);
      return value === true || value === "true" || value === "Yes";
    });
  });

  if (hasClientSupplied) {
    inferred.push({
      key: "client_supplied_items",
      label: "Client-supplied items",
      value: "Yes",
    });
  }

  const hasByOthers = workAreas.some((wa) => {
    const plumbing = getFactValue(lookup, wa.id, `${wa.type}.plumbing_changes`);
    const electrical = getFactValue(
      lookup,
      wa.id,
      `${wa.type}.electrical_changes`
    );
    return (
      (typeof plumbing === "string" &&
        plumbing.toLowerCase().includes("by others")) ||
      (typeof electrical === "string" &&
        electrical.toLowerCase().includes("by others")) ||
      (typeof plumbing === "string" && plumbing.toLowerCase() === "none") ||
      (typeof electrical === "string" && electrical.toLowerCase() === "none")
    );
  });

  if (hasByOthers) {
    inferred.push({
      key: "by_others_trades",
      label: "By-others trades",
      value: "Yes",
    });
  }

  const cartingM = workAreas
    .map((wa) =>
      getFactValue(lookup, wa.id, `${wa.type}.carting_distance_m`)
    )
    .find((value) => value != null);

  if (cartingM != null) {
    const distance = Number(cartingM);
    inferred.push({
      key: "material_carry_distance",
      label: "Material carry distance",
      value:
        distance <= 10 ? "< 10m" : distance <= 30 ? "10–30m" : "> 30m",
    });
    inferred.push({
      key: "waste_bin_access",
      label: "Waste/bin access",
      value: distance > 30 ? "Poor" : distance > 10 ? "Moderate" : "Easy",
    });
  }

  return inferred;
}

export function buildScopeDrivenConstraints(params: {
  workAreas: WorkAreaRef[];
  projectFacts: Array<{ key: string; work_area_id: string | null; value: unknown }>;
  extractedFromBrief?: ExtractedConstraint[];
}): ExtractedConstraint[] {
  const lookup = buildFactLookup(params.projectFacts);
  const confirmedTypes = new Set(params.workAreas.map((wa) => wa.type));
  const keySet = new Set<string>();
  const results: ExtractedConstraint[] = [];

  const add = (constraint: ExtractedConstraint) => {
    if (keySet.has(constraint.key)) return;
    if (!templateByKey(constraint.key)) return;
    keySet.add(constraint.key);
    results.push(constraint);
  };

  for (const constraint of params.extractedFromBrief ?? []) {
    add(constraint);
  }

  for (const constraint of inferConstraintsFromFacts(params.workAreas, lookup)) {
    add(constraint);
  }

  const relevantKeys = new Set<string>([
    "site_access",
    "material_carry_distance",
    "working_hours",
  ]);

  for (const type of confirmedTypes) {
    for (const key of SCOPE_CONSTRAINT_KEYS[type] ?? []) {
      relevantKeys.add(key);
    }
  }

  const sortedKeys = [...relevantKeys].sort((a, b) => {
    const priorityA = templateByKey(a)?.priority ?? 99;
    const priorityB = templateByKey(b)?.priority ?? 99;
    return priorityA - priorityB;
  });

  for (const key of sortedKeys) {
    if (keySet.has(key)) continue;
    const template = templateByKey(key);
    if (!template) continue;
    add({
      key,
      label: template.label,
      value: template.input_type === "boolean" ? "Not sure" : "Not sure",
    });
  }

  return results.slice(0, 12);
}

export function getConstraintTemplateSeeds(): ConstraintTemplateSeed[] {
  const byKey = new Map<string, ConstraintTemplateSeed>();
  for (const seed of STATIC_CONSTRAINT_SEEDS) {
    byKey.set(seed.key, { ...seed, priority: 0 });
  }
  for (const seed of GLOBAL_CONSTRAINT_TEMPLATES) {
    byKey.set(seed.key, seed);
  }
  return [...byKey.values()].sort((a, b) => a.priority - b.priority);
}

export function isConstraintAnswered(value: unknown): boolean {
  return factHasValue(value);
}
