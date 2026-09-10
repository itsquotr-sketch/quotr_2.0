/**
 * EF02-C2 — Details grouped complete-capture composition.
 *
 * Groups unresolved Details-owned questions by Work Area instance, then by
 * canonical Deck descriptor section (mapped to product labels). Project
 * Conditions are asked once at project level.
 *
 * Does not invent questions. Section ids come from C1 descriptors where
 * they exist; other Work Areas fall back to Details.
 */

import type { ClarifyAskClass, ClarifyCandidate } from "@/lib/assistant/clarify/types";
import { getDeckQuestionDescriptor } from "@/lib/estimate/deck-question-descriptors";
import type { DeckQuestionSection } from "@/lib/estimate/deck-question-descriptors";
import { listDeckQuestionDescriptors } from "@/lib/estimate/deck-question-descriptors";
import {
  CONSUMED_PROJECT_CONDITION_KEYS,
  listConsumedProjectConditionDefs,
} from "@/lib/project-conditions/consumed-authority";
import { distinguishWorkAreaInstanceLabels } from "@/lib/work-areas/instances";

export type DetailsSectionId =
  | "dimensions"
  | "materials"
  | "structure"
  | "scope"
  | "details"
  | "project_conditions";

export type DetailsSection = {
  readonly id: DetailsSectionId;
  readonly label: string;
  readonly wallTypeId: string | null;
  readonly wallTypeLabel: string | null;
  readonly candidates: readonly ClarifyCandidate[];
};

export type DetailsWorkAreaGroup = {
  readonly workAreaId: string | null;
  readonly workAreaName: string;
  readonly workAreaType: string | null;
  readonly sections: readonly DetailsSection[];
};

const SECTION_ORDER: readonly DetailsSectionId[] = [
  "dimensions",
  "materials",
  "structure",
  "scope",
  "details",
  "project_conditions",
];

const DECK_SECTION_TO_GROUP: Record<DeckQuestionSection, DetailsSectionId> = {
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

const SECTION_LABEL: Record<DetailsSectionId, string> = {
  dimensions: "Dimensions",
  materials: "Materials",
  structure: "Structure",
  scope: "Scope",
  details: "Details",
  project_conditions: "Project Conditions",
};

const ASK_ORDER: Record<ClarifyAskClass, number> = {
  HARD_MINIMUM: 0,
  ASK_NOW: 1,
  ASSUME_IF_SKIPPED: 2,
  REFINEMENT: 3,
  ADVANCED: 4,
  DERIVED_NEVER_ASK: 5,
};

const DECK_FACT_ORDER = new Map(
  listDeckQuestionDescriptors().map((row, index) => [row.factKey, index])
);
const PC_KEY_ORDER = new Map<string, number>(
  listConsumedProjectConditionDefs().map((row, index) => [row.key, index])
);

function isProjectConditionCandidate(candidate: ClarifyCandidate): boolean {
  if (candidate.writeTarget === "CONSTRAINT" || candidate.source === "project_condition") {
    return true;
  }
  if (!candidate.constraintKey) return false;
  return (CONSUMED_PROJECT_CONDITION_KEYS as readonly string[]).includes(
    candidate.constraintKey
  );
}

export function detailsSectionForCandidate(
  candidate: ClarifyCandidate
): DetailsSectionId {
  if (isProjectConditionCandidate(candidate)) return "project_conditions";
  if (candidate.factKey) {
    const descriptor = getDeckQuestionDescriptor(candidate.factKey);
    if (descriptor) return DECK_SECTION_TO_GROUP[descriptor.section];
  }
  return "details";
}

function wallTypeLabel(candidate: ClarifyCandidate): string | null {
  if (!candidate.wallTypeId) return null;
  const fromLabel = candidate.label.split(" · ")[0]?.trim();
  if (fromLabel && fromLabel !== candidate.factKey) return fromLabel;
  const fromQuestion = candidate.question.split(":")[0]?.trim();
  if (fromQuestion && fromQuestion.length < 40) return fromQuestion;
  return "Wall type";
}

function compareCandidates(a: ClarifyCandidate, b: ClarifyCandidate): number {
  const ask = ASK_ORDER[a.askClass] - ASK_ORDER[b.askClass];
  if (ask !== 0) return ask;
  const aDeck = a.factKey ? DECK_FACT_ORDER.get(a.factKey) : undefined;
  const bDeck = b.factKey ? DECK_FACT_ORDER.get(b.factKey) : undefined;
  if (aDeck != null && bDeck != null && aDeck !== bDeck) return aDeck - bDeck;
  const aPc = a.constraintKey ? PC_KEY_ORDER.get(a.constraintKey) : undefined;
  const bPc = b.constraintKey ? PC_KEY_ORDER.get(b.constraintKey) : undefined;
  if (aPc != null && bPc != null && aPc !== bPc) return aPc - bPc;
  return a.questionKey.localeCompare(b.questionKey);
}

function buildSections(
  candidates: readonly ClarifyCandidate[]
): DetailsSection[] {
  const byKey = new Map<
    string,
    {
      id: DetailsSectionId;
      wallTypeId: string | null;
      wallTypeLabel: string | null;
      rows: ClarifyCandidate[];
    }
  >();
  const order: string[] = [];
  for (const candidate of [...candidates].sort(compareCandidates)) {
    const sectionId = detailsSectionForCandidate(candidate);
    const wallTypeId = candidate.wallTypeId ?? null;
    const key = `${sectionId}::${wallTypeId ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.rows.push(candidate);
      continue;
    }
    order.push(key);
    byKey.set(key, {
      id: sectionId,
      wallTypeId,
      wallTypeLabel: wallTypeLabel(candidate),
      rows: [candidate],
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
      label: SECTION_LABEL[row.id],
      wallTypeId: row.wallTypeId,
      wallTypeLabel: row.wallTypeLabel,
      candidates: row.rows,
    }));
}

export function groupDetailsCandidates(params: {
  readonly candidates: readonly ClarifyCandidate[];
  readonly workAreas: readonly {
    readonly id: string;
    readonly type: string;
    readonly name: string;
    readonly status: string;
  }[];
}): DetailsWorkAreaGroup[] {
  const activeAreas = params.workAreas.filter((row) => row.status !== "excluded");
  const labels = distinguishWorkAreaInstanceLabels(activeAreas);
  const pcs: ClarifyCandidate[] = [];
  const byWa = new Map<string, ClarifyCandidate[]>();
  for (const candidate of params.candidates) {
    if (isProjectConditionCandidate(candidate)) {
      pcs.push(candidate);
      continue;
    }
    const waId = candidate.workAreaId ?? "";
    const list = byWa.get(waId) ?? [];
    list.push(candidate);
    byWa.set(waId, list);
  }

  const groups: DetailsWorkAreaGroup[] = [];
  const seen = new Set<string>();
  for (const wa of activeAreas) {
    const rows = byWa.get(wa.id);
    if (!rows?.length) continue;
    seen.add(wa.id);
    groups.push({
      workAreaId: wa.id,
      workAreaName: labels.get(wa.id) ?? wa.name,
      workAreaType: wa.type,
      sections: buildSections(rows),
    });
  }
  for (const [waId, rows] of byWa) {
    if (!waId || seen.has(waId) || rows.length === 0) continue;
    groups.push({
      workAreaId: waId,
      workAreaName: rows[0]?.workAreaName ?? "Work area",
      workAreaType: rows[0]?.workAreaType ?? null,
      sections: buildSections(rows),
    });
  }
  if (pcs.length > 0) {
    groups.push({
      workAreaId: null,
      workAreaName: "Project Conditions",
      workAreaType: null,
      sections: [
        {
          id: "project_conditions",
          label: "Project Conditions",
          wallTypeId: null,
          wallTypeLabel: null,
          candidates: [...pcs].sort(compareCandidates),
        },
      ],
    });
  }
  return groups;
}
