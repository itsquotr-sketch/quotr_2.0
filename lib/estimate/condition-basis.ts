/**
 * Stage 3C — calculation basis for site access, carry distance and
 * hazardous-materials risk.
 *
 * Unanswered access and carry do not add a labour modifier. That is the same
 * money as Easy / under 10 m, and it is not those answers. "Not sure" stays
 * unresolved and does not become No or a carry allowance. Hazardous-materials
 * risk never creates an allowance.
 */

import { isNotSureValue } from "@/lib/estimate/facts";
import { parseCarryDistanceCategory } from "@/lib/estimate/adjustments";

/**
 * Same labour-access consumers as projectConsumesConsumedCondition.
 * Kept here so this module does not import the calculator graph.
 * Ceilings consume site access only. Carry does not.
 */
const LABOUR_ACCESS_WORK_AREA_TYPES = new Set([
  "deck",
  "fence",
  "retaining_wall",
  "bathroom",
  "internal_walls",
  "demolition",
  "kitchen",
  "flooring",
]);

function consumesSiteAccess(workAreaTypes: readonly string[]): boolean {
  return workAreaTypes.some(
    (type) => LABOUR_ACCESS_WORK_AREA_TYPES.has(type) || type === "ceilings"
  );
}

function consumesCarry(workAreaTypes: readonly string[]): boolean {
  return workAreaTypes.some((type) => LABOUR_ACCESS_WORK_AREA_TYPES.has(type));
}

export type ConditionConstraint = {
  readonly key: string;
  readonly value: unknown;
  readonly source?: string | null;
};

export type ExplicitAssumption = {
  readonly key: "site_access" | "material_carry_distance";
  readonly value: string;
  readonly statement: string;
  readonly effect: string;
  readonly question: string;
};

const EXPLICIT_ASSUMPTIONS: readonly ExplicitAssumption[] = [
  {
    key: "site_access",
    value: "Easy",
    statement: "Standard access",
    effect: "No labour adjustment.",
    question: "How difficult is site access?",
  },
  {
    key: "material_carry_distance",
    value: "< 10m",
    statement: "Standard carry",
    effect: "No carry adjustment.",
    question: "Distance from material drop-off or waste carting?",
  },
];

const HAZMAT_VISIBLE_TYPES = new Set([
  "demolition",
  "bathroom",
  "kitchen",
  "internal_walls",
  "ceilings",
  "doors",
  "flooring",
  "painting",
  "plastering",
]);

const LABOUR_STALE_KEYS = new Set([
  "site_access",
  "material_carry_distance",
  "occupied_site",
  "working_hours",
  "site_slope",
]);

export type ConditionDecision = {
  readonly key: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly state: "unanswered" | "uncertain" | "resolved";
  readonly storedValue: string | null;
  readonly blocksCommercial: boolean;
  readonly informational: boolean;
  readonly assumption: ExplicitAssumption | null;
  readonly detail: string;
};

function constraintValue(
  constraints: readonly ConditionConstraint[],
  key: string
): { value: string | null; source: string | null } {
  const row = constraints.find((item) => item.key === key);
  if (!row || row.value == null) return { value: null, source: row?.source ?? null };
  const value = String(row.value).trim();
  if (!value) return { value: null, source: row.source ?? null };
  return { value, source: row.source ?? null };
}

export function explicitAssumptionFor(key: string): ExplicitAssumption | null {
  return EXPLICIT_ASSUMPTIONS.find((item) => item.key === key) ?? null;
}

export function conditionAnswerAffectsLabour(key: string): boolean {
  return LABOUR_STALE_KEYS.has(key);
}

export function accessLabourAddend(value: string | null | undefined): number {
  const access = value?.trim().toLowerCase() ?? "";
  if (!access || isNotSureValue(access)) return 0;
  if (
    access === "difficult" ||
    access === "very poor" ||
    access === "verypoor" ||
    access === "restricted"
  ) {
    return 0.1;
  }
  if (access === "moderate") return 0.05;
  return 0;
}

export function carryLabourAddend(value: string | null | undefined): number {
  if (!value || isNotSureValue(value)) return 0;
  const category = parseCarryDistanceCategory(value);
  if (category === "long") return 0.1;
  if (category === "moderate") return 0.05;
  return 0;
}

function percent(addend: number): string {
  return `+${Math.round(addend * 100)}%`;
}

function accessSentence(
  value: string | null,
  source: string | null
): { state: ConditionDecision["state"]; sentence: string; blocks: boolean } {
  if (!value) {
    return {
      state: "unanswered",
      blocks: true,
      sentence:
        "Site access is unanswered, so no access adjustment is applied. That is not a confirmed Easy answer.",
    };
  }
  if (isNotSureValue(value)) {
    return {
      state: "uncertain",
      blocks: true,
      sentence:
        "Site access is Not sure, so no access adjustment is applied. Not sure stays unresolved and is not treated as Easy.",
    };
  }
  const addend = accessLabourAddend(value);
  const assumed =
    source === "assumption" ? " The standard-access assumption is accepted." : "";
  if (addend === 0) {
    return {
      state: "resolved",
      blocks: false,
      sentence: `Site access is ${value}, so no access adjustment is applied.${assumed}`,
    };
  }
  return {
    state: "resolved",
    blocks: false,
    sentence: `Site access is ${value}, so labour hours include ${percent(addend)}.${assumed}`,
  };
}

function carrySentence(
  value: string | null,
  source: string | null
): { state: ConditionDecision["state"]; sentence: string; blocks: boolean } {
  if (!value) {
    return {
      state: "unanswered",
      blocks: true,
      sentence:
        "Carry distance is unanswered, so no carry adjustment is applied. That is not a confirmed distance under 10 m.",
    };
  }
  if (isNotSureValue(value)) {
    return {
      state: "uncertain",
      blocks: true,
      sentence:
        "Carry distance is Not sure, so no carry adjustment is applied. Not sure stays unresolved and is not treated as a short carry.",
    };
  }
  const addend = carryLabourAddend(value);
  const assumed =
    source === "assumption" ? " The standard-carry assumption is accepted." : "";
  if (addend === 0) {
    return {
      state: "resolved",
      blocks: false,
      sentence: `Carry distance is ${value}, so no carry adjustment is applied.${assumed}`,
    };
  }
  return {
    state: "resolved",
    blocks: false,
    sentence: `Carry distance is ${value}, so labour hours include ${percent(addend)}.${assumed}`,
  };
}

function hazmatSentence(value: string | null, demolition: boolean): {
  state: ConditionDecision["state"];
  sentence: string;
  blocks: boolean;
  informational: boolean;
} {
  if (!value) {
    return {
      state: "unanswered",
      blocks: demolition,
      informational: !demolition,
      sentence: demolition
        ? "Hazardous-materials risk still needs an answer. No allowance has been added."
        : "No hazardous-materials cost is included. An unanswered risk is not zero.",
    };
  }
  if (isNotSureValue(value)) {
    return {
      state: "uncertain",
      blocks: true,
      informational: false,
      sentence:
        "Hazardous-materials risk is Not sure. It is not treated as No, and no allowance has been added.",
    };
  }
  if (value.toLowerCase() === "yes" || value.toLowerCase() === "true") {
    return {
      state: "resolved",
      blocks: true,
      informational: false,
      sentence:
        "Hazardous-materials risk is Yes. That work is not priced, and no allowance has been added.",
    };
  }
  return {
    state: "resolved",
    blocks: false,
    informational: false,
    sentence: "Hazardous-materials risk is No. No allowance is included.",
  };
}

export function labourBasisNote(
  constraints: readonly ConditionConstraint[]
): string {
  const access = constraintValue(constraints, "site_access");
  const carry = constraintValue(constraints, "material_carry_distance");
  const hazmat = constraintValue(constraints, "hazardous_materials_risk");
  const accessText = accessSentence(access.value, access.source).sentence;
  const carryText = carrySentence(carry.value, carry.source).sentence;
  const hazmatText = hazmatSentence(hazmat.value, false).sentence;
  const factor =
    1 + accessLabourAddend(access.value) + carryLabourAddend(carry.value);
  return `${accessText} ${carryText} ${hazmatText} Access and carry adjustment on this line is ${factor.toFixed(2)}.`;
}

export function commercialConditionMessages(input: {
  readonly constraints: readonly ConditionConstraint[];
  readonly workAreaTypes: readonly string[];
}): string[] {
  const types = input.workAreaTypes;
  const messages: string[] = [];
  if (consumesSiteAccess(types)) {
    const access = constraintValue(input.constraints, "site_access");
    const described = accessSentence(access.value, access.source);
    if (described.blocks) {
      messages.push(
        "Site access still needs an answer or the accepted standard-access assumption. Reviewing the price does not decide it."
      );
    }
  }
  if (consumesCarry(types)) {
    const carry = constraintValue(input.constraints, "material_carry_distance");
    const described = carrySentence(carry.value, carry.source);
    if (described.blocks) {
      messages.push(
        "Carry distance still needs an answer or the accepted standard-carry assumption. Reviewing the price does not decide it."
      );
    }
  }
  const demolition = types.includes("demolition");
  const hazmatVisible = types.some((type) => HAZMAT_VISIBLE_TYPES.has(type));
  if (hazmatVisible || demolition) {
    const hazmat = constraintValue(input.constraints, "hazardous_materials_risk");
    const described = hazmatSentence(hazmat.value, demolition);
    if (described.blocks) messages.push(described.sentence);
  }
  return messages;
}

export function commercialConditionBlock(input: {
  readonly constraints: readonly ConditionConstraint[];
  readonly workAreaTypes: readonly string[];
}): string | null {
  const messages = commercialConditionMessages(input);
  return messages.length > 0 ? messages.join(" ") : null;
}

export function listConditionDecisions(input: {
  readonly constraints: readonly ConditionConstraint[];
  readonly workAreaTypes: readonly string[];
}): ConditionDecision[] {
  const decisions: ConditionDecision[] = [];
  const types = input.workAreaTypes;
  if (consumesSiteAccess(types)) {
    const access = constraintValue(input.constraints, "site_access");
    const described = accessSentence(access.value, access.source);
    const assumption = explicitAssumptionFor("site_access");
    decisions.push({
      key: "site_access",
      question: assumption?.question ?? "How difficult is site access?",
      options: ["Easy", "Moderate", "Difficult", "Very poor", "Not sure"],
      state: described.state,
      storedValue: access.value,
      blocksCommercial: described.blocks,
      informational: false,
      assumption,
      detail: described.sentence,
    });
  }
  if (consumesCarry(types)) {
    const carry = constraintValue(input.constraints, "material_carry_distance");
    const described = carrySentence(carry.value, carry.source);
    const assumption = explicitAssumptionFor("material_carry_distance");
    decisions.push({
      key: "material_carry_distance",
      question: assumption?.question ?? "Distance from material drop-off or waste carting?",
      options: ["< 10m", "10–30m", "> 30m", "Not sure"],
      state: described.state,
      storedValue: carry.value,
      blocksCommercial: described.blocks,
      informational: false,
      assumption,
      detail: described.sentence,
    });
  }
  const demolition = types.includes("demolition");
  if (demolition || types.some((type) => HAZMAT_VISIBLE_TYPES.has(type))) {
    const hazmat = constraintValue(input.constraints, "hazardous_materials_risk");
    const described = hazmatSentence(hazmat.value, demolition);
    decisions.push({
      key: "hazardous_materials_risk",
      question: "Is there asbestos or hazardous materials risk?",
      options: ["Yes", "No", "Not sure"],
      state: described.state,
      storedValue: hazmat.value,
      blocksCommercial: described.blocks,
      informational: described.informational,
      assumption: null,
      detail: described.sentence,
    });
  }
  return decisions;
}
