import { getJobPlanAdapter } from "@/lib/assistant/job-plan/adapters/registry";
import { isForbiddenJobPlanScopeKey } from "@/lib/assistant/job-plan/facts";
import type {
  ComposeJobPlanInput,
  JobPlanView,
  JobPlanWorkAreaCard,
} from "@/lib/assistant/job-plan/types";
import { isMonolithicCommercialFitoutType } from "@/lib/work-areas/support-contract";

function assertNoLogisticsAsScope(card: JobPlanWorkAreaCard): JobPlanWorkAreaCard {
  const all = [
    ...card.included,
    ...card.notIncluded,
    ...card.notConfirmed,
    ...(card.editAvailable ?? []),
  ];
  const leaked = all.filter(
    (item) => item.sourceFactKey && isForbiddenJobPlanScopeKey(item.sourceFactKey)
  );
  if (leaked.length > 0) {
    throw new Error(
      `Job Plan leaked project logistics as scope: ${leaked
        .map((i) => i.sourceFactKey)
        .join(", ")}`
    );
  }
  return card;
}

export function composeJobPlan(input: ComposeJobPlanInput): JobPlanView {
  const context = {
    facts: input.facts,
    constraints: input.constraints ?? [],
    qualityLevel: input.qualityLevel ?? null,
    briefText: input.briefText ?? null,
  };

  const excludedWorkAreaIds = input.workAreas
    .filter((wa) => wa.status === "excluded")
    .map((wa) => wa.id);

  const active = input.workAreas
    .filter((wa) => wa.status !== "excluded")
    .filter((wa) => !isMonolithicCommercialFitoutType(wa.type))
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const cards = active.map((wa) => {
    const adapter = getJobPlanAdapter(wa.type);
    return assertNoLogisticsAsScope(adapter.project(wa, context));
  });

  return {
    cards,
    confirmCount: cards.reduce((sum, card) => sum + card.confirmCount, 0),
    excludedWorkAreaIds,
  };
}
