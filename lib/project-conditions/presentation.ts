import {
  PROJECT_CONDITION_GROUP_LABEL,
  PROJECT_CONDITION_LIBRARY,
  type ProjectConditionLibraryGroup,
} from "@/lib/project-conditions/library";

export type ConditionCandidateRef = {
  readonly questionKey: string;
  readonly targetKey: string;
};

const GROUP_ORDER: readonly ProjectConditionLibraryGroup[] = [
  "access",
  "handling",
  "occupancy",
  "working_restrictions",
  "disposal",
  "other",
];

export function visibleConditionCandidates<T extends ConditionCandidateRef>(
  candidates: readonly T[],
  draftedQuestionKeys: readonly string[]
): T[] {
  const drafted = new Set(draftedQuestionKeys);
  const occupied = candidates.find((candidate) => candidate.targetKey === "occupied_site");
  const occupiedAnswered = occupied ? drafted.has(occupied.questionKey) : true;
  return candidates.filter((candidate) => {
    if (candidate.targetKey !== "protection_dust_control") return true;
    if (!occupied) return true;
    return occupiedAnswered;
  });
}

export function groupConditionCandidates<T extends ConditionCandidateRef>(
  candidates: readonly T[]
): { group: ProjectConditionLibraryGroup; label: string; items: T[] }[] {
  const groups = new Map<ProjectConditionLibraryGroup, T[]>();
  for (const candidate of candidates) {
    const definition = PROJECT_CONDITION_LIBRARY.find(
      (row) => row.key === candidate.targetKey
    );
    const group = definition?.group ?? "other";
    const items = groups.get(group) ?? [];
    items.push(candidate);
    groups.set(group, items);
  }
  return GROUP_ORDER.flatMap((group) => {
    const items = groups.get(group);
    if (!items || items.length === 0) return [];
    return [{ group, label: PROJECT_CONDITION_GROUP_LABEL[group], items }];
  });
}
