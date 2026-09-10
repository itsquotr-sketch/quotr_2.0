/**
 * EF02-D2 — Refine presentation grouping and compact-value formatting.
 *
 * Reads existing D1 candidate fields and C1 Deck descriptor sections.
 * Does not change composeRefineView or question ownership.
 */

import {
  booleanChoiceOptions,
  booleanPresentationToChoice,
} from "@/lib/assistant/clarify/question-contract";
import type { RefineCandidate, RefineGroupId } from "@/lib/assistant/refine/types";
import { getDeckQuestionDescriptor } from "@/lib/estimate/deck-question-descriptors";
import type { DeckQuestionSection } from "@/lib/estimate/deck-question-descriptors";
import { formatFactValueForDisplay } from "@/lib/scopes/fact-labels";
import { factHasValue } from "@/lib/scopes/fact-values";

export type RefineUiSectionId =
  | "dimensions"
  | "materials"
  | "structure"
  | "scope"
  | "details"
  | "project_conditions"
  | "advanced";

export type RefineUiSection = {
  readonly id: RefineUiSectionId;
  readonly label: string;
  readonly wallTypeId: string | null;
  readonly wallTypeLabel: string | null;
  readonly candidates: readonly RefineCandidate[];
};

export type RefineUiGroup = {
  readonly workAreaId: string | null;
  readonly workAreaName: string;
  readonly workAreaType: string | null;
  readonly kind: "work_area" | "project_conditions";
  readonly sections: readonly RefineUiSection[];
};

const SECTION_ORDER: readonly RefineUiSectionId[] = [
  "dimensions",
  "materials",
  "structure",
  "scope",
  "details",
  "advanced",
  "project_conditions",
];

const DECK_SECTION_TO_UI: Record<DeckQuestionSection, RefineUiSectionId> = {
  geometry: "dimensions",
  boarding: "materials",
  structure: "structure",
  balustrade: "structure",
  demolition: "scope",
  edges: "scope",
  access: "scope",
  project_conditions: "project_conditions",
  unused: "details",
};

const FALLBACK_GROUP: Record<RefineGroupId, RefineUiSectionId> = {
  scope: "scope",
  specification: "details",
  structure: "structure",
  project_conditions: "project_conditions",
  advanced: "advanced",
};

export function isProjectConditionRefineRow(row: RefineCandidate): boolean {
  if (row.group === "project_conditions") return true;
  if (row.writeTarget === "CONSTRAINT") return true;
  return Boolean(row.constraintKey);
}

export function isUnsetRefineValue(
  value: string | number | boolean | string[] | null | undefined
): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return !factHasValue(value);
}

export function formatRefineCurrentValue(
  row: RefineCandidate,
  value: string | number | boolean | string[] | null | undefined = row.currentValue
): string | null {
  if (isUnsetRefineValue(value)) return null;
  if (row.inputType === "boolean") {
    const options = booleanChoiceOptions({
      question: row.question,
      options: row.options,
    });
    const choice = booleanPresentationToChoice(value, options);
    if (choice === "Include") return "Included";
    if (choice === "Not included") return "Not included";
    if (choice) return choice;
  }
  return formatFactValueForDisplay(value, row.unit, row.options ? [...row.options] : undefined);
}

export function refineSectionForCandidate(row: RefineCandidate): RefineUiSectionId {
  if (isProjectConditionRefineRow(row)) return "project_conditions";
  if (row.factKey) {
    const descriptor = getDeckQuestionDescriptor(row.factKey);
    if (descriptor) return DECK_SECTION_TO_UI[descriptor.section];
  }
  return FALLBACK_GROUP[row.group];
}

export function refineSectionLabel(
  sectionId: RefineUiSectionId,
  workAreaType: string | null
): string {
  if (sectionId === "dimensions") return "Dimensions";
  if (sectionId === "materials") return "Materials";
  if (sectionId === "structure") return "Structure";
  if (sectionId === "project_conditions") return "Project Conditions";
  if (sectionId === "advanced") return "Advanced";
  if (sectionId === "scope") {
    return workAreaType === "deck" ? "Included Scope" : "Scope";
  }
  return "Details";
}

export function wallTypeLabelLookup(
  panels:
    | readonly {
        readonly types: readonly { readonly id: string; readonly displayName: string }[];
      }[]
    | undefined
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const panel of panels ?? []) {
    for (const type of panel.types) {
      map.set(type.id, type.displayName);
    }
  }
  return map;
}

function compareRefineRows(a: RefineCandidate, b: RefineCandidate): number {
  const aUnset = isUnsetRefineValue(a.currentValue) ? 1 : 0;
  const bUnset = isUnsetRefineValue(b.currentValue) ? 1 : 0;
  if (aUnset !== bUnset) return aUnset - bUnset;
  return (a.semanticKey ?? a.id).localeCompare(b.semanticKey ?? b.id);
}

function buildSections(
  rows: readonly RefineCandidate[],
  workAreaType: string | null,
  wallTypeNames: ReadonlyMap<string, string>
): RefineUiSection[] {
  const byKey = new Map<
    string,
    {
      id: RefineUiSectionId;
      wallTypeId: string | null;
      wallTypeLabel: string | null;
      rows: RefineCandidate[];
    }
  >();
  const order: string[] = [];
  for (const row of [...rows].sort(compareRefineRows)) {
    const id = refineSectionForCandidate(row);
    const wallTypeId = row.wallTypeId ?? null;
    const key = `${id}::${wallTypeId ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    order.push(key);
    byKey.set(key, {
      id,
      wallTypeId,
      wallTypeLabel: wallTypeId
        ? wallTypeNames.get(wallTypeId) ?? "Wall type"
        : null,
      rows: [row],
    });
  }
  return order
    .map((key) => byKey.get(key)!)
    .sort((a, b) => {
      const section = SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id);
      if (section !== 0) return section;
      return (a.wallTypeLabel ?? "").localeCompare(b.wallTypeLabel ?? "");
    })
    .map((row) => ({
      id: row.id,
      label: refineSectionLabel(row.id, workAreaType),
      wallTypeId: row.wallTypeId,
      wallTypeLabel: row.wallTypeLabel,
      candidates: row.rows,
    }));
}

export function groupRefineCandidatesForDisplay(params: {
  readonly candidates: readonly RefineCandidate[];
  readonly wallTypePanels?: readonly {
    readonly types: readonly { readonly id: string; readonly displayName: string }[];
  }[];
  readonly focusKey?: string | null;
}): RefineUiGroup[] {
  const wallTypeNames = wallTypeLabelLookup(params.wallTypePanels);
  const pcs: RefineCandidate[] = [];
  const byWa = new Map<string, RefineCandidate[]>();
  const waMeta = new Map<
    string,
    { name: string; type: string | null }
  >();
  const waOrder: string[] = [];

  for (const row of params.candidates) {
    if (isProjectConditionRefineRow(row)) {
      pcs.push(row);
      continue;
    }
    const waId = row.workAreaId ?? "";
    if (!byWa.has(waId)) {
      waOrder.push(waId);
      byWa.set(waId, []);
      waMeta.set(waId, {
        name: row.workAreaName ?? "Work area",
        type: row.workAreaType,
      });
    }
    byWa.get(waId)!.push(row);
  }

  const groups: RefineUiGroup[] = [];
  for (const waId of waOrder) {
    const rows = byWa.get(waId) ?? [];
    if (rows.length === 0) continue;
    const meta = waMeta.get(waId);
    groups.push({
      workAreaId: waId || null,
      workAreaName: meta?.name ?? "Work area",
      workAreaType: meta?.type ?? null,
      kind: "work_area",
      sections: buildSections(rows, meta?.type ?? null, wallTypeNames),
    });
  }

  if (params.focusKey) {
    const focusedIndex = groups.findIndex((group) =>
      group.sections.some((section) =>
        section.candidates.some(
          (row) => row.factKey === params.focusKey || row.constraintKey === params.focusKey
        )
      )
    );
    if (focusedIndex > 0) {
      const focused = groups[focusedIndex]!;
      groups.splice(focusedIndex, 1);
      groups.unshift(focused);
    }
  }

  if (pcs.length > 0) {
    groups.push({
      workAreaId: null,
      workAreaName: "Project Conditions",
      workAreaType: null,
      kind: "project_conditions",
      sections: [
        {
          id: "project_conditions",
          label: "Project Conditions",
          wallTypeId: null,
          wallTypeLabel: null,
          candidates: [...pcs].sort(compareRefineRows),
        },
      ],
    });
  }
  return groups;
}
