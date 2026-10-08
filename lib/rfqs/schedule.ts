import { roundMoney } from "@/lib/commercial-engine/core/money";
import type { DraftSource } from "@/lib/rfqs/draft-compose";
import type { ScheduleSuggestion } from "@/lib/rfqs/scope-selection";

export const SCHEDULE_UNITS = ["m2", "m", "item", "hour", "lump_sum"] as const;
export const SCHEDULE_ROLES = ["required", "optional", "alternative"] as const;

export type ScheduleUnit = (typeof SCHEDULE_UNITS)[number];
export type ScheduleRole = (typeof SCHEDULE_ROLES)[number];

export type ScheduleDraftRow = {
  id: string;
  scope: string;
  specification: string;
  quantity: string;
  unit: ScheduleUnit;
  role: ScheduleRole;
  quantitySource: string | null;
  quantityConfirmed: boolean;
};

export type FrozenScheduleRow = {
  id: string;
  sortOrder: number;
  scope: string;
  specification: string;
  quantity: number | null;
  unit: ScheduleUnit;
  role: ScheduleRole;
};

export function scheduleUnitLabel(unit: ScheduleUnit): string {
  switch (unit) {
    case "m2":
      return "m²";
    case "m":
      return "m";
    case "item":
      return "item";
    case "hour":
      return "hour";
    case "lump_sum":
      return "lump sum";
  }
}

export function scheduleRoleLabel(role: ScheduleRole): string {
  switch (role) {
    case "required":
      return "Required";
    case "optional":
      return "Optional";
    case "alternative":
      return "Alternative";
  }
}

export function emptyScheduleRow(): ScheduleDraftRow {
  return {
    id: crypto.randomUUID(),
    scope: "",
    specification: "",
    quantity: "1",
    unit: "item",
    role: "required",
    quantitySource: null,
    quantityConfirmed: true,
  };
}

export function scheduleRowProblems(row: ScheduleDraftRow): string | null {
  if (row.scope.trim().length < 3) return "Write what this item includes.";
  if (row.quantitySource && !row.quantityConfirmed) return "Confirm the quantity from the job details.";
  if (row.unit === "lump_sum") return null;
  const quantity = Number(row.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return "Enter a quantity greater than zero.";
  return null;
}

export function scheduleProblems(rows: ScheduleDraftRow[]): string[] {
  const problems: string[] = [];
  if (!rows.some((row) => row.role === "required")) problems.push("Add at least one required item. Alternatives stay out of the base total.");
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.scope.trim().toLowerCase();
    if (key && seen.has(key)) problems.push("Two items use the same scope. Give each item its own wording.");
    if (key) seen.add(key);
    const problem = scheduleRowProblems(row);
    if (problem) problems.push(problem);
  }
  const ids = new Set(rows.map((row) => row.id));
  if (ids.size !== rows.length) problems.push("Each item needs its own identity.");
  return [...new Set(problems)];
}

/** Extended ex-GST amount. A lump sum is the entered total and does not use quantity. */
export function scheduleExtended(unit: ScheduleUnit, quantity: number | null, unitPrice: number): number {
  if (unit === "lump_sum") return roundMoney(unitPrice);
  return roundMoney((quantity ?? 0) * unitPrice);
}

export function rowFromSuggestion(suggestion: ScheduleSuggestion): ScheduleDraftRow {
  const measured = suggestion.confidence === "check" && suggestion.quantity.trim().length > 0;
  return {
    id: crypto.randomUUID(),
    scope: suggestion.title,
    specification: suggestion.specification,
    quantity: suggestion.unit === "lump_sum" ? "" : suggestion.quantity,
    unit: suggestion.unit,
    role: "required",
    quantitySource: measured
      ? `From ${suggestion.source}. Confirm this quantity before sending. It was not taken from an Estimate line.`
      : null,
    quantityConfirmed: !measured,
  };
}

export function scheduleRowsFromJobDetails(sources: DraftSource[]): ScheduleDraftRow[] {
  return sources.flatMap((source) => {
    const text = source.text.trim();
    if (!specificScheduleText(text)) return [];
    const measured = source.field === "measurements" ? parseMeasuredQuantity(text) : null;
    return [{
      id: crypto.randomUUID(),
      scope: text.slice(0, 500),
      specification: "",
      quantity: measured?.quantity ?? "",
      unit: measured?.unit ?? "item",
      role: "required" as const,
      quantitySource: `From job details (${source.source}). Confirm this quantity before sending. It was not taken from an Estimate line.`,
      quantityConfirmed: false,
    }];
  });
}

function specificScheduleText(text: string): boolean {
  if (text.length < 3 || text.length > 80) return false;
  if (/\bEXPLICIT\s*:/.test(text)) return false;
  if (/^(materials?|labour|labor)$/i.test(text)) return false;
  if (text.split(/\s+/).length > 12) return false;
  return true;
}

function parseMeasuredQuantity(text: string): { quantity: string; unit: ScheduleUnit } | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(m²|m2|sqm|metres|meters|m|items|item|hours|hour|hr)\b/i);
  if (!match) return null;
  const unitText = match[2].toLowerCase();
  const unit: ScheduleUnit = unitText === "m2" || unitText === "m²" || unitText === "sqm"
    ? "m2"
    : unitText === "m" || unitText === "metres" || unitText === "meters"
      ? "m"
      : unitText.startsWith("hour") || unitText === "hr"
        ? "hour"
        : "item";
  return { quantity: match[1], unit };
}
