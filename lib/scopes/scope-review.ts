import type { Question } from "@/components/assistant/types";
import {
  formatFactValueForDisplay,
  getCanonicalFactKey,
  getDerivedHeightLabel,
  getFactDisplayLabel,
  isNotSureValue,
} from "@/lib/scopes/fact-labels";
import {
  buildFactLookup,
  factHasValue,
  type ProjectFactRecord,
} from "@/lib/scopes/fact-values";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "@/lib/scopes/derived-facts";
import {
  getInheritedFinishLevelForWorkArea,
  isInheritedFinishLevelKey,
} from "@/lib/scopes/finish-level";
import { getDerivedFactNote, resolveFactEditMeta } from "@/lib/scopes/fact-edit-meta";
import { getScopeQuestions } from "@/lib/scopes/registry";
import {
  getMissingLabel,
  isTemplateFactMissing,
  type ProjectInput,
  type WorkAreaInput as QuestionWorkAreaInput,
} from "@/lib/scopes/questions";

export type ScopeReviewSourceLabel =
  | "brief"
  | "answered"
  | "calculated"
  | "assumed"
  | "default"
  | "system"
  | "project spec";

export type ScopeReviewFact = {
  key: string;
  label: string;
  value: string;
  rawValue?: unknown;
  unit?: string;
  sourceLabel: ScopeReviewSourceLabel;
  sourcePriority: number;
  readOnly?: boolean;
  derivedNote?: string;
  inputType?: "number" | "select" | "boolean" | "text";
  options?: string[];
};

export type ScopeReviewWorkArea = {
  workAreaId: string;
  workAreaType: string;
  workAreaName: string;
  summary?: string;
  facts: ScopeReviewFact[];
  missingItems: string[];
  assumptions: string[];
};

export type ScopeReview = {
  workAreas: ScopeReviewWorkArea[];
  excludedWorkAreas: { workAreaId: string; workAreaName: string }[];
  generalAssumptions: string[];
  generalExclusions: string[];
};

type WorkAreaInput = {
  id: string;
  type: string;
  name: string;
  summary?: string | null;
  status: string;
  sort_order?: number;
};

type FactCandidate = {
  canonicalKey: string;
  label: string;
  value: string;
  rawValue: unknown;
  unit?: string;
  sourceLabel: ScopeReviewSourceLabel;
  sourcePriority: number;
  source: string;
  sortOrder: number;
};

const SOURCE_META: Record<
  string,
  { label: ScopeReviewSourceLabel; priority: number }
> = {
  user: { label: "answered", priority: 1 },
  derived: { label: "calculated", priority: 2 },
  project_quality: { label: "project spec", priority: 2 },
  ai_extracted: { label: "brief", priority: 3 },
  assumption: { label: "assumed", priority: 4 },
  default: { label: "default", priority: 5 },
  system: { label: "system", priority: 6 },
};

export const DEFAULT_GENERAL_ASSUMPTIONS = [
  "Standard access assumed unless otherwise stated.",
  "Pricing includes overhead and margin allowance.",
];

export const DEFAULT_GENERAL_EXCLUSIONS = [
  "Building consent / engineering",
  "Major excavation unless confirmed",
  "Final finish selections beyond allowance",
];

function getSourceMeta(source: string | null | undefined) {
  return (
    SOURCE_META[source ?? ""] ?? {
      label: "system" as const,
      priority: 6,
    }
  );
}

function getTemplateSortOrder(
  workAreaType: string,
  canonicalKey: string
): number {
  const templates = getScopeQuestions(workAreaType);
  const match = templates.find(
    (template) =>
      template.factKey === canonicalKey || template.key === canonicalKey
  );
  return match?.priority ?? 999;
}

function getUnitForKey(
  workAreaType: string,
  canonicalKey: string,
  existingUnit?: string | null
): string | undefined {
  if (existingUnit) return existingUnit;
  const templates = getScopeQuestions(workAreaType);
  const match = templates.find((template) => template.factKey === canonicalKey);
  return match?.unit;
}

function shouldSkipFact(params: {
  workAreaType: string;
  canonicalKey: string;
  source: string | null | undefined;
  lookup: Map<string, ProjectFactRecord>;
  workAreaId: string;
}): boolean {
  const { workAreaType, canonicalKey, source, lookup, workAreaId } = params;

  if (
    workAreaType === "retaining_wall" &&
    canonicalKey === "retaining_wall.height_m" &&
    source === "ai_extracted"
  ) {
    const hasHigh = factHasValue(
      lookup.get(`${workAreaId}:retaining_wall.height_high_m`)?.value
    );
    const hasLow = factHasValue(
      lookup.get(`${workAreaId}:retaining_wall.height_low_m`)?.value
    );
    if (hasHigh && hasLow) {
      return true;
    }
  }

  return false;
}

function resolveDisplayLabel(params: {
  canonicalKey: string;
  workAreaType: string;
  source: string | null | undefined;
  lookup: Map<string, ProjectFactRecord>;
  workAreaId: string;
  fallbackLabel?: string | null;
}): string {
  const derivedLabel = getDerivedHeightLabel(params.canonicalKey);
  if (
    derivedLabel &&
    params.canonicalKey === "retaining_wall.height_m" &&
    params.source === "derived"
  ) {
    const hasHigh = factHasValue(
      params.lookup.get(`${params.workAreaId}:retaining_wall.height_high_m`)
        ?.value
    );
    const hasLow = factHasValue(
      params.lookup.get(`${params.workAreaId}:retaining_wall.height_low_m`)
        ?.value
    );
    if (hasHigh && hasLow) {
      return derivedLabel;
    }
  }

  return getFactDisplayLabel(params.canonicalKey, params.fallbackLabel);
}

function buildMissingItems(params: {
  workArea: WorkAreaInput;
  lookup: Map<string, ProjectFactRecord>;
  qualityLevel?: string | null;
  confirmedTypes: Set<string>;
  project: ProjectInput;
}): string[] {
  const templates = getScopeQuestions(params.workArea.type);
  const missing: string[] = [];
  const workAreaInput: QuestionWorkAreaInput = {
    id: params.workArea.id,
    type: params.workArea.type,
    name: params.workArea.name,
    sort_order: params.workArea.sort_order ?? 0,
    status: params.workArea.status,
  };

  for (const template of templates) {
    if (
      !isTemplateFactMissing({
        template,
        workArea: workAreaInput,
        lookup: params.lookup,
        qualityLevel: params.qualityLevel,
        confirmedTypes: params.confirmedTypes,
        project: params.project,
      })
    ) {
      continue;
    }

    missing.push(getMissingLabel(template));
  }

  return [...new Set(missing)];
}

function factsFromQuestions(
  questions: Question[],
  workAreaId: string
): ProjectFactRecord[] {
  return questions
    .filter(
      (question) =>
        question.workAreaId === workAreaId &&
        factHasValue(question.value) &&
        !isNotSureValue(question.value)
    )
    .map((question) => ({
      key: question.key,
      work_area_id: workAreaId,
      value: question.value as string | number | boolean,
      source: "user",
    }));
}

function mergeFactsForWorkArea(params: {
  workArea: WorkAreaInput;
  mergedFacts: ProjectFactRecord[];
  questions: Question[];
}): Map<string, ProjectFactRecord> {
  const workAreaFacts = params.mergedFacts.filter(
    (fact) => fact.work_area_id === params.workArea.id
  );
  const questionFacts = factsFromQuestions(params.questions, params.workArea.id);
  const byKey = new Map<string, ProjectFactRecord>();

  // Question answers are the baseline; persisted project_facts win when both exist
  // (e.g. after note proposal apply updates project_facts but not stale question rows).
  for (const fact of questionFacts) {
    const canonicalKey = getCanonicalFactKey(fact.key, params.workArea.type);
    byKey.set(canonicalKey, { ...fact, key: canonicalKey });
  }

  for (const fact of workAreaFacts) {
    const canonicalKey = getCanonicalFactKey(fact.key, params.workArea.type);
    byKey.set(canonicalKey, { ...fact, key: canonicalKey });
  }

  return buildFactLookup(
    [...byKey.values()].map((fact) => ({
      ...fact,
      work_area_id: params.workArea.id,
    }))
  );
}

function injectInheritedFinishLevelFacts(params: {
  workArea: WorkAreaInput;
  candidates: Map<string, FactCandidate>;
  qualityLevel?: string | null;
}) {
  const inherited = getInheritedFinishLevelForWorkArea(
    params.workArea.type,
    params.qualityLevel
  );
  if (!inherited) return;

  const canonicalKey = getCanonicalFactKey(
    inherited.factKey,
    params.workArea.type
  );

  if (params.candidates.has(canonicalKey)) {
    return;
  }

  params.candidates.set(canonicalKey, {
    canonicalKey,
    label: getFactDisplayLabel(canonicalKey),
    value: inherited.value,
    rawValue: inherited.value,
    sourceLabel: "project spec",
    sourcePriority: SOURCE_META.project_quality.priority,
    source: "project_quality",
    sortOrder: getTemplateSortOrder(params.workArea.type, canonicalKey),
  });
}

function buildWorkAreaFacts(params: {
  workArea: WorkAreaInput;
  lookup: Map<string, ProjectFactRecord>;
  qualityLevel?: string | null;
}): { facts: ScopeReviewFact[]; assumptions: string[] } {
  const candidates = new Map<string, FactCandidate>();
  const assumptions: string[] = [];

  for (const [lookupKey, fact] of params.lookup.entries()) {
    const [workAreaId, rawKey] = lookupKey.split(":");
    if (workAreaId !== params.workArea.id) continue;

    const source = fact.source ?? "system";
    if (source === "assumption") {
      const formatted = formatFactValueForDisplay(fact.value);
      if (formatted) {
        assumptions.push(
          `${getFactDisplayLabel(
            getCanonicalFactKey(rawKey, params.workArea.type)
          )}: ${formatted}`
        );
      }
    }

    const canonicalKey = getCanonicalFactKey(rawKey, params.workArea.type);

    if (
      shouldSkipFact({
        workAreaType: params.workArea.type,
        canonicalKey,
        source,
        lookup: params.lookup,
        workAreaId: params.workArea.id,
      })
    ) {
      continue;
    }

    const unit = getUnitForKey(params.workArea.type, canonicalKey);
    const formattedValue = formatFactValueForDisplay(fact.value, unit);
    if (!formattedValue || formattedValue === "Not sure") {
      continue;
    }

    const sourceMeta = getSourceMeta(source);
    const candidate: FactCandidate = {
      canonicalKey,
      label: resolveDisplayLabel({
        canonicalKey,
        workAreaType: params.workArea.type,
        source,
        lookup: params.lookup,
        workAreaId: params.workArea.id,
      }),
      value: formattedValue,
      rawValue: fact.value,
      unit,
      sourceLabel: sourceMeta.label,
      sourcePriority: sourceMeta.priority,
      source,
      sortOrder: getTemplateSortOrder(params.workArea.type, canonicalKey),
    };

    const existing = candidates.get(canonicalKey);
    // One fact per canonical key: lower sourcePriority wins (user > derived > brief > …).
    if (!existing || candidate.sourcePriority < existing.sourcePriority) {
      candidates.set(canonicalKey, candidate);
    }
  }

  injectInheritedFinishLevelFacts({
    workArea: params.workArea,
    candidates,
    qualityLevel: params.qualityLevel,
  });

  const facts = [...candidates.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((candidate) => {
      const editMeta = resolveFactEditMeta(
        params.workArea.type,
        candidate.canonicalKey,
        candidate.rawValue
      );
      const readOnly =
        candidate.sourceLabel === "calculated" ||
        (candidate.source === "project_quality" &&
          isInheritedFinishLevelKey(candidate.canonicalKey));

      return {
        key: candidate.canonicalKey,
        label: candidate.label,
        value: candidate.value,
        rawValue: candidate.rawValue,
        unit: candidate.unit ?? editMeta.unit,
        sourceLabel: candidate.sourceLabel,
        sourcePriority: candidate.sourcePriority,
        readOnly,
        derivedNote: readOnly
          ? getDerivedFactNote(params.workArea.type, candidate.canonicalKey)
          : undefined,
        inputType: editMeta.inputType,
        options: editMeta.options,
      };
    });

  return { facts, assumptions };
}

export function buildScopeReview(params: {
  workAreas: WorkAreaInput[];
  projectFacts: ProjectFactRecord[];
  questions?: Question[];
  qualityLevel?: string | null;
  scopeAssumptions?: string[];
  scopeExclusions?: string[];
}): ScopeReview {
  const confirmed = params.workAreas
    .filter((workArea) => workArea.status === "confirmed")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const excludedWorkAreas = params.workAreas
    .filter((workArea) => workArea.status === "excluded")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((workArea) => ({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
    }));

  const derivedFacts = deriveFactsForProject({
    workAreas: confirmed.map((workArea) => ({
      id: workArea.id,
      type: workArea.type,
    })),
    projectFacts: params.projectFacts,
  });
  const mergedFacts = mergeDerivedFactsIntoRecords(
    params.projectFacts,
    derivedFacts
  );

  const workAreaReviews: ScopeReviewWorkArea[] = confirmed.map((workArea) => {
    const lookup = mergeFactsForWorkArea({
      workArea,
      mergedFacts,
      questions: params.questions ?? [],
    });
    const { facts, assumptions } = buildWorkAreaFacts({
      workArea,
      lookup,
      qualityLevel: params.qualityLevel,
    });
    const missingItems = buildMissingItems({
      workArea,
      lookup,
      qualityLevel: params.qualityLevel,
      confirmedTypes: new Set(confirmed.map((area) => area.type)),
      project: { quality_level: params.qualityLevel ?? null },
    });

    return {
      workAreaId: workArea.id,
      workAreaType: workArea.type,
      workAreaName: workArea.name,
      summary: workArea.summary ?? undefined,
      facts,
      missingItems,
      assumptions,
    };
  });

  const generalAssumptions = [
    ...DEFAULT_GENERAL_ASSUMPTIONS,
    ...(params.scopeAssumptions ?? []),
  ].filter((item, index, array) => array.indexOf(item) === index);

  const generalExclusions = [
    ...DEFAULT_GENERAL_EXCLUSIONS,
    ...(params.scopeExclusions ?? []),
  ].filter((item, index, array) => array.indexOf(item) === index);

  return {
    workAreas: workAreaReviews,
    excludedWorkAreas,
    generalAssumptions,
    generalExclusions,
  };
}

export function buildCompactPanelSummary(
  workArea: { type: string; name: string },
  facts: ScopeReviewFact[]
): string {
  const byKey = new Map(facts.map((fact) => [fact.key, fact]));

  switch (workArea.type) {
    case "deck": {
      const area = byKey.get("deck.area_m2")?.value;
      const material = byKey.get("deck.material")?.value;
      const stairs = byKey.get("deck.has_stairs")?.value;
      const parts: string[] = [];
      if (area) {
        parts.push(`${area} ${material && material !== "Not sure" ? material.toLowerCase() : ""} deck`.trim());
      } else {
        parts.push(
          material && material !== "Not sure"
            ? `${material.toLowerCase()} deck`
            : "Deck"
        );
      }
      if (stairs === "Yes") {
        parts.push("with stairs");
      }
      return parts.join(" ");
    }
    case "pergola": {
      const roofing = byKey.get("pergola.roofing_included")?.value;
      const area = byKey.get("pergola.area_m2")?.value;
      if (roofing === "Yes") return "Roofing included";
      if (area) return `${area} pergola`;
      return "Pergola allowance";
    }
    case "retaining_wall": {
      const length = byKey.get("retaining_wall.length_m")?.value;
      const height =
        byKey.get("retaining_wall.height_m")?.value ??
        byKey.get("retaining_wall.average_height_m")?.value;
      const drainage = byKey.get("retaining_wall.drainage_required")?.value;
      const backfill = byKey.get("retaining_wall.backfill_included")?.value;
      const excavation = byKey.get("retaining_wall.excavation_required")?.value;

      const parts: string[] = [];
      if (length && height) {
        parts.push(`${length} x ${height}`);
      } else if (length) {
        parts.push(`${length} long`);
      } else if (height) {
        parts.push(`${height} high`);
      }

      const inclusions: string[] = [];
      if (drainage === "Yes") inclusions.push("drainage");
      if (backfill === "Yes") inclusions.push("backfill");
      if (excavation === "Yes") inclusions.push("excavation");

      if (inclusions.length > 0) {
        parts.push(`${inclusions.join("/")} included`);
      }

      return parts.length > 0 ? parts.join(", ") : "Retaining wall";
    }
    case "bathroom": {
      const area = byKey.get("bathroom.area_m2")?.value;
      const tiling = byKey.get("bathroom.tile_extent")?.value;
      if (area && tiling) return `${area} bathroom, ${tiling.toLowerCase()}`;
      if (area) return `${area} bathroom renovation`;
      return "Bathroom renovation";
    }
    case "kitchen": {
      const area = byKey.get("kitchen.area_m2")?.value;
      if (area) return `${area} kitchen renovation`;
      return "Kitchen renovation";
    }
    default: {
      const areaFact = facts.find((fact) => fact.key.endsWith(".area_m2"));
      if (areaFact) return `${areaFact.value} ${workArea.name.toLowerCase()}`;
      return workArea.name;
    }
  }
}

export function buildPanelScopeSummariesFromScopeReview(
  scopeReview: ScopeReview
): { workArea: string; summary: string }[] {
  return scopeReview.workAreas.map((workArea) => ({
    workArea: workArea.workAreaName,
    summary: buildCompactPanelSummary(
      { type: workArea.workAreaType, name: workArea.workAreaName },
      workArea.facts
    ),
  }));
}
