import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import type { ClarifyCandidate, ComposeClarifyInput } from "@/lib/assistant/clarify/types";

export const KITCHEN_RENOVATION_FACT_KEY = "kitchen.renovation_type";

const template = () => getQuestionTemplateByKey(KITCHEN_RENOVATION_FACT_KEY);

/** An extracted brief phrase is not a package confirmation. */
export function explicitKitchenRenovationChoice(value: unknown): string | null {
  const options = template()?.options;
  if (!options || typeof value !== "string") return null;
  const trimmed = value.trim();
  return options.find((option) => option === trimmed) ?? null;
}

export function kitchenPackageChoiceCandidates(
  input: ComposeClarifyInput
): ClarifyCandidate[] {
  const question = template();
  if (!question?.options?.length) return [];
  const candidates: ClarifyCandidate[] = [];
  for (const area of input.workAreas) {
    if (area.type !== "kitchen" || area.status === "excluded") continue;
    const stored = input.facts.find(
      (fact) =>
        fact.key === KITCHEN_RENOVATION_FACT_KEY && fact.work_area_id === area.id
    )?.value;
    candidates.push({
      id: `kitchen-package:${area.id}`,
      source: "scope_fact",
      workAreaId: area.id,
      workAreaName: area.name,
      workAreaType: "kitchen",
      factKey: KITCHEN_RENOVATION_FACT_KEY,
      constraintKey: null,
      questionKey: KITCHEN_RENOVATION_FACT_KEY,
      label: question.label,
      question: question.questionText,
      askClass: "ASSUME_IF_SKIPPED",
      inputType: "select",
      options: question.options,
      currentValue: explicitKitchenRenovationChoice(stored),
      writeTarget: "FACT",
      write: null,
      blocksEstimate: false,
      assumable: false,
      rankScore: 860,
      rankReason: "Kitchen package choice",
      assumptionStatement: null,
    });
  }
  return candidates;
}
