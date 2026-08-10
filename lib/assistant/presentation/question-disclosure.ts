/**
 * Stage 3.1B.7F-R6-R3 — Scope Details category disclosure (presentation only).
 *
 * Automatic preference opens incomplete groups on first sight.
 * Once open (auto or Review), stays open until the user manually collapses.
 * Manual expand/collapse always wins. Completeness updates badges, not accordion.
 */

import type { QuestionPresentationCategory } from "@/lib/assistant/presentation/question-categories";

export function questionDisclosureKey(
  workAreaKey: string,
  category: QuestionPresentationCategory
): string {
  return `${workAreaKey}::${category}`;
}

/**
 * Merge newly preferred-open categories into sticky-open set.
 * Never removes keys — completion must not auto-collapse.
 */
export function mergeStickyOpenCategories(
  previousSticky: ReadonlySet<string>,
  preferredKeys: ReadonlySet<string>
): Set<string> {
  const next = new Set(previousSticky);
  for (const key of preferredKeys) {
    next.add(key);
  }
  return next;
}

export function resolveQuestionCategoryExpanded(params: {
  disclosureKey: string;
  preferredOpen: boolean;
  stickyOpen: ReadonlySet<string>;
  manualExpanded: Readonly<Partial<Record<string, boolean>>>;
  /** Review/attention pin outranks a prior manual collapse for the target. */
  reviewPinnedKeys?: ReadonlySet<string>;
}): boolean {
  if (params.reviewPinnedKeys?.has(params.disclosureKey)) {
    return true;
  }
  if (params.disclosureKey in params.manualExpanded) {
    return Boolean(params.manualExpanded[params.disclosureKey]);
  }
  if (params.stickyOpen.has(params.disclosureKey)) {
    return true;
  }
  // First paint before sticky merge: honour preferred incomplete default.
  return params.preferredOpen;
}
