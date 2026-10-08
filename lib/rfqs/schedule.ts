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

export function parseScheduleMeasure(text: string): { value: string; unit: ScheduleUnit; label: string } | null {
  const lump = /\blump\s*sum\b/i.test(text);
  const area = text.match(/(\d+(?:\.\d+)?)\s*(m²|m2|sqm)(?!\w)/i);
  if (area) return { value: area[1], unit: "m2", label: `${area[1]} m²` };
  const each = text.match(/(\d+(?:\.\d+)?)\s*(?:each|items?|nr)\b/i);
  if (each) return { value: each[1], unit: "item", label: `${each[1]} item` };
  const hour = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  if (hour) return { value: hour[1], unit: "hour", label: `${hour[1]} hour` };
  const length = text.match(/(\d+(?:\.\d+)?)\s*(?:linear\s+)?m(?!m|²|2)\b/i);
  if (length) return { value: length[1], unit: "m", label: `${length[1]} m` };
  if (lump) return { value: "", unit: "lump_sum", label: "lump sum" };
  return null;
}

/** A number recorded in one unit must not be sent under a different unit. */
export function mismatchedScheduleQuantity(quantity: string, unit: ScheduleUnit, measurementText: string): string | null {
  const value = quantity.trim();
  if (!value || unit === "lump_sum") return null;
  const recorded = measurementText.match(/(\d+(?:\.\d+)?)\s*(m²|m2|sqm|linear\s+m|m|each|items?|nr|hours?|hrs?)(?!\w)/gi) ?? [];
  for (const token of recorded) {
    const measured = parseScheduleMeasure(token);
    if (!measured || measured.unit === "lump_sum" || measured.value !== value || measured.unit === unit) continue;
    return `${measured.label} is recorded for this Work Area. It cannot be sent as ${value} ${scheduleUnitLabel(unit)}. Enter the quantity for this unit, or change the unit.`;
  }
  return null;
}

function isScheduleUnit(value: string): value is ScheduleUnit {
  return (SCHEDULE_UNITS as readonly string[]).includes(value);
}

/** Server-side send gate. Confirmation is a composer control; the stored notes still reject a unit that does not match the recorded measure. */
export function scheduleSendProblems(
  rows: Array<{ id: string; scope: string; specification: string; quantity: string; unit: string; role: string }>,
  measurementNotes: string,
): string[] {
  const drafts: ScheduleDraftRow[] = [];
  for (const row of rows) {
    if (!isScheduleUnit(row.unit)) return ["Choose a unit for each item."];
    drafts.push({
      id: row.id,
      scope: row.scope,
      specification: row.specification,
      quantity: row.quantity,
      unit: row.unit,
      role: row.role === "optional" || row.role === "alternative" ? row.role : "required",
      quantitySource: null,
      quantityConfirmed: true,
    });
  }
  return scheduleProblems(drafts, measurementNotes);
}

export function scheduleProblems(rows: ScheduleDraftRow[], measurementNotes = ""): string[] {
  const problems: string[] = [];
  if (!rows.some((row) => row.role === "required")) problems.push("Add at least one required item. Alternatives stay out of the base total.");
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.scope.trim().toLowerCase();
    if (key && seen.has(key)) problems.push("Two items use the same scope. Give each item its own wording.");
    if (key) seen.add(key);
    const mismatch = mismatchedScheduleQuantity(row.quantity, row.unit, measurementNotes);
    if (mismatch) problems.push(mismatch);
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
  const needsEntry = !measured && suggestion.unit !== "lump_sum" && !suggestion.quantity.trim();
  return {
    id: crypto.randomUUID(),
    scope: suggestion.title,
    specification: suggestion.specification,
    quantity: suggestion.unit === "lump_sum" ? "" : suggestion.quantity,
    unit: suggestion.unit,
    role: "required",
    quantitySource: measured
      ? `From ${suggestion.source}. Confirm this quantity before sending. It was not taken from an Estimate line.`
      : needsEntry
        ? "No quantity was recorded for this item. Enter the quantity for this unit. An area or length from the Work Area is not copied onto a count."
        : null,
    quantityConfirmed: !(measured || needsEntry),
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
