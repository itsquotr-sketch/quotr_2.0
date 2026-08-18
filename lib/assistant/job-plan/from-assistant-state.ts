import type { AssistantState } from "@/lib/assistant/types";
import type { EstimateFact } from "@/lib/estimate/types";
import { overlayFact } from "@/lib/assistant/job-plan/facts";
import type { JobPlanWorkAreaInput } from "@/lib/assistant/job-plan/types";
import type { WorkArea } from "@/components/assistant/types";

export function jobPlanFactsFromAssistantState(
  state: AssistantState
): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const wa of state.scopeReview.workAreas) {
    for (const fact of wa.facts) {
      facts = overlayFact(facts, {
        key: fact.key,
        work_area_id: wa.workAreaId,
        value: fact.rawValue ?? fact.value,
      });
    }
  }
  for (const fact of state.interviewFacts) {
    facts = overlayFact(facts, {
      key: fact.key,
      work_area_id: fact.workAreaId,
      value: fact.value,
      source: fact.source,
    });
  }
  return facts;
}

export function jobPlanWorkAreasFromUi(
  workAreas: readonly WorkArea[]
): JobPlanWorkAreaInput[] {
  return workAreas.map((wa, index) => ({
    id: wa.id,
    type: wa.type,
    name: wa.name,
    status: wa.status,
    sortOrder: index,
  }));
}
