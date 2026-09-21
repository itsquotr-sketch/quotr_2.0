import { getRefineAdapter } from "@/lib/assistant/refine/adapters/registry";
import { internalWallsRefinePanel } from "@/lib/assistant/refine/adapters/internal-walls";
import { ceilingsRefinePanel } from "@/lib/assistant/refine/adapters/ceilings";
import {
  identityFromCaptureRow,
  isNestedRefineIdentity,
  questionSemanticKey,
} from "@/lib/assistant/question-identity";
import { isDetailsOwnedWhenUnresolved } from "@/lib/assistant/question-ownership";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  getCalculatorConsumedFacts,
  isCalculatorConsumedConstraint,
  isCalculatorConsumedFact,
} from "@/lib/estimate/consumed-facts";
import { isDisclosedAssumptionSource } from "@/lib/estimate/deck-board-width";
import { deckFactIsRelevant } from "@/lib/estimate/deck-question-descriptors";
import { fenceFactQuestionClass } from "@/lib/estimate/fence-information-contract";
import { fenceFactIsRelevant } from "@/lib/estimate/fence-question-relevance";
import { retainingWallFactQuestionClass } from "@/lib/estimate/retaining-wall-information-contract";
import { retainingWallFactIsRelevant } from "@/lib/estimate/retaining-wall-question-relevance";
import { ceilingsFactIsRelevant } from "@/lib/estimate/ceilings-information-contract";
import { isUnresolvedCaptureValue } from "@/lib/estimate/disclosed-assumptions";
import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import { isInternalWallsWallTypeWriteKey } from "@/lib/estimate/internal-walls-wall-types";
import { isCeilingsPortionWriteKey } from "@/lib/estimate/ceilings-portions";
import { isDoorsPortionWriteKey } from "@/lib/estimate/doors-portions";
import { isFlooringPortionWriteKey } from "@/lib/estimate/flooring-portions";
import {
  getConsumedProjectConditionDef,
  listConsumedProjectConditionDefs,
  projectConsumesConsumedCondition,
} from "@/lib/project-conditions/consumed-authority";
import { getEstimatePriorityClass } from "@/lib/scopes/estimate-priority";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import { safeFactPresentationLabel } from "@/lib/assistant/presentation/fact-key-labels";
import type {
  ComposeRefineInput,
  RefineCandidate,
  RefineView,
} from "@/lib/assistant/refine/types";

function isResolvedValue(value: unknown): boolean {
  return hasFactValue(value) && !isNotSureValue(value);
}

function withNestedIdentityAliases(row: RefineCandidate): RefineCandidate {
  return {
    ...row,
    nestedItemId: row.nestedItemId ?? row.wallTypeId ?? null,
    componentId: row.componentId ?? row.openingId ?? null,
  };
}

function stampSemantic(row: RefineCandidate): RefineCandidate {
  const aliased = withNestedIdentityAliases(row);
  const semanticKey = questionSemanticKey(identityFromCaptureRow(aliased));
  return { ...aliased, semanticKey: semanticKey ?? row.id };
}

function refineDedupeKey(row: RefineCandidate): string {
  return questionSemanticKey(identityFromCaptureRow(row)) ?? row.id;
}

function preferResolved(a: RefineCandidate, b: RefineCandidate): RefineCandidate {
  const aResolved = isResolvedValue(a.currentValue);
  const bResolved = isResolvedValue(b.currentValue);
  if (aResolved && !bResolved) return a;
  if (bResolved && !aResolved) return b;
  if (a.assumed && !b.assumed) return a;
  return a;
}

function isEditableConsumedFact(workAreaType: string, factKey: string): boolean {
  if (!isCalculatorConsumedFact(workAreaType, factKey)) return false;
  if (workAreaType === "internal_walls" && isInternalWallsWallTypeWriteKey(factKey)) {
    return false;
  }
  if (workAreaType === "ceilings" && isCeilingsPortionWriteKey(factKey)) {
    return false;
  }
  if (workAreaType === "doors" && isDoorsPortionWriteKey(factKey)) {
    return false;
  }
  if (workAreaType === "flooring" && isFlooringPortionWriteKey(factKey)) {
    return false;
  }
  const template = getQuestionTemplateByKey(factKey);
  if (template && getEstimatePriorityClass(template) === "P3") {
    const contract =
      fenceFactQuestionClass(factKey) ??
      retainingWallFactQuestionClass(factKey);
    if (
      contract !== "HARD_MINIMUM" &&
      contract !== "ASK_NOW" &&
      contract !== "ASSUME_IF_SKIPPED"
    ) {
      return false;
    }
  }
  return true;
}

function factIsRelevant(
  workAreaType: string,
  factKey: string,
  input: ComposeRefineInput,
  workAreaId: string
): boolean {
  if (workAreaType === "deck" || factKey.startsWith("deck.")) {
    return deckFactIsRelevant(factKey, {
      facts: input.facts,
      workAreaId,
      briefText: input.briefText,
    });
  }
  if (workAreaType === "fence" || factKey.startsWith("fence.")) {
    return fenceFactIsRelevant(factKey, {
      facts: input.facts,
      workAreaId,
    });
  }
  if (workAreaType === "retaining_wall" || factKey.startsWith("retaining_wall.")) {
    return retainingWallFactIsRelevant(factKey, {
      facts: input.facts,
      workAreaId,
    });
  }
  if (
    workAreaType === "ceilings" ||
    factKey.startsWith("ceilings.portion.") ||
    factKey.startsWith("ceilings.bulkhead.")
  ) {
    return ceilingsFactIsRelevant(factKey, {
      facts: input.facts as EstimateFact[],
      workAreaId,
    });
  }
  return true;
}

function projectConditionCandidates(
  input: ComposeRefineInput
): RefineCandidate[] {
  const types = input.workAreas
    .filter((row) => row.status !== "excluded")
    .map((row) => row.type);
  return listConsumedProjectConditionDefs()
    .filter((def) => isCalculatorConsumedConstraint(def.key))
    .filter((def) => projectConsumesConsumedCondition(types, def.key))
    .flatMap((def) => {
      const row = input.constraints.find((c) => c.key === def.key);
      if (!isResolvedValue(row?.value)) return [];
      return [
        {
          id: `refine:pc:${def.key}`,
          group: "project_conditions" as const,
          tier: "high_value" as const,
          workAreaId: null,
          workAreaName: null,
          workAreaType: null,
          factKey: null,
          constraintKey: def.key,
          questionKey: def.questionKey,
          label: def.label,
          question: def.question,
          inputType:
            def.inputType === "boolean"
              ? "boolean"
              : def.inputType === "number"
                ? "number"
                : def.inputType === "multi_select"
                  ? "multi_select"
                  : def.inputType === "text"
                    ? "text"
                    : "select",
          options: def.options,
          writeTarget: "CONSTRAINT" as const,
          write: null,
          consumedByCalculator: true as const,
          currentValue: row?.value as RefineCandidate["currentValue"],
          valueSource: row?.source ?? null,
          assumed: isDisclosedAssumptionSource(row?.source),
        },
      ];
    });
}

function answeredConsumedEditCandidates(
  input: ComposeRefineInput
): RefineCandidate[] {
  const out: RefineCandidate[] = [];
  for (const wa of input.workAreas.filter((row) => row.status !== "excluded")) {
    for (const factKey of getCalculatorConsumedFacts(wa.type)) {
      const semantic = questionSemanticKey({
        workAreaId: wa.id,
        factKey,
      });
      if (!semantic) continue;
      if (!isEditableConsumedFact(wa.type, factKey)) continue;
      if (!factIsRelevant(wa.type, factKey, input, wa.id)) continue;
      const row = input.facts.find(
        (fact) => fact.key === factKey && fact.work_area_id === wa.id
      );
      if (!row || !isResolvedValue(row.value)) continue;
      const template = getQuestionTemplateByKey(factKey);
      const priority = template ? getEstimatePriorityClass(template) : null;
      out.push({
        id: `refine:${wa.id}:${factKey}`,
        group: template?.category === "measurement" ? "structure" : "specification",
        tier: priority === "P2" ? "advanced" : "high_value",
        workAreaId: wa.id,
        workAreaName: wa.name,
        workAreaType: wa.type,
        factKey,
        constraintKey: null,
        questionKey: factKey,
        label: template?.label ?? safeFactPresentationLabel(factKey),
        question: template?.questionText ?? safeFactPresentationLabel(factKey),
        inputType:
          template?.inputType === "boolean"
            ? "boolean"
            : template?.inputType === "number"
              ? "number"
              : template?.inputType === "multi_select"
                ? "multi_select"
                : template?.inputType === "text"
                  ? "text"
                  : "select",
        options: template?.options,
        unit: template?.unit,
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
        currentValue: row.value as RefineCandidate["currentValue"],
        valueSource: row.source ?? null,
        assumed: isDisclosedAssumptionSource(row.source),
      });
    }
  }
  return out;
}

function shouldOmitUnresolvedRefineRow(
  row: RefineCandidate,
  input: ComposeRefineInput
): boolean {
  if (isNestedRefineIdentity(row)) {
    if (
      isUnresolvedCaptureValue(row.currentValue) &&
      isDetailsOwnedWhenUnresolved(row.workAreaType, row.factKey)
    ) {
      return true;
    }
    return false;
  }
  if (row.constraintKey) {
    const def = getConsumedProjectConditionDef(row.constraintKey);
    if (!def) return !isCalculatorConsumedConstraint(row.constraintKey);
    if (isUnresolvedCaptureValue(row.currentValue)) return true;
    return false;
  }
  if (!row.factKey) return true;
  if (
    row.workAreaType &&
    !factIsRelevant(row.workAreaType, row.factKey, input, row.workAreaId ?? "")
  ) {
    return true;
  }
  if (isUnresolvedCaptureValue(row.currentValue)) {
    return isDetailsOwnedWhenUnresolved(row.workAreaType, row.factKey);
  }
  return false;
}

function attachCurrent(
  row: RefineCandidate,
  input: ComposeRefineInput
): RefineCandidate {
  const stamped = stampSemantic(row);
  if (isNestedRefineIdentity(row)) {
    return {
      ...stamped,
      assumed:
        stamped.assumed ?? isDisclosedAssumptionSource(stamped.valueSource),
    };
  }
  if (row.constraintKey) {
    const found = input.constraints.find((c) => c.key === row.constraintKey);
    if (!found || !isResolvedValue(found.value)) {
      return {
        ...stamped,
        assumed: isDisclosedAssumptionSource(stamped.valueSource),
      };
    }
    return {
      ...stamped,
      currentValue: found.value as RefineCandidate["currentValue"],
      valueSource: found.source ?? stamped.valueSource ?? null,
      assumed: isDisclosedAssumptionSource(found.source),
    };
  }
  if (!row.factKey) return stamped;
  const found = input.facts.find(
    (f) =>
      f.key === row.factKey &&
      (row.workAreaId == null || f.work_area_id === row.workAreaId)
  );
  if (!found || !isResolvedValue(found.value)) {
    return {
      ...stamped,
      assumed: isDisclosedAssumptionSource(stamped.valueSource),
    };
  }
  return {
    ...stamped,
    currentValue: found.value as RefineCandidate["currentValue"],
    valueSource: found.source ?? stamped.valueSource ?? null,
    assumed: isDisclosedAssumptionSource(found.source),
  };
}

export function composeRefineView(input: ComposeRefineInput): RefineView {
  const collected: RefineCandidate[] = [];
  for (const wa of input.workAreas.filter((row) => row.status !== "excluded")) {
    const adapter = getRefineAdapter(wa.type);
    if (!adapter) continue;
    const card = input.jobPlan.cards.find((c) => c.workAreaId === wa.id);
    collected.push(
      ...adapter.candidates({
        workAreaId: wa.id,
        workAreaName: wa.name,
        facts: input.facts,
        briefText: input.briefText,
        notConfirmed: card?.notConfirmed ?? [],
      })
    );
  }
  collected.push(...projectConditionCandidates(input));
  collected.push(...answeredConsumedEditCandidates(input));

  const uniqueBySemantic = new Map<string, RefineCandidate>();
  for (const raw of collected) {
    const withValue = attachCurrent(raw, input);
    if (shouldOmitUnresolvedRefineRow(withValue, input)) continue;
    if (withValue.constraintKey) {
      if (!isCalculatorConsumedConstraint(withValue.constraintKey)) continue;
    } else if (
      !withValue.factKey ||
      !isCalculatorConsumedFact(withValue.workAreaType, withValue.factKey)
    ) {
      continue;
    }
    const key = refineDedupeKey(withValue);
    const existing = uniqueBySemantic.get(key);
    uniqueBySemantic.set(
      key,
      existing ? preferResolved(existing, withValue) : withValue
    );
  }

  const unique = [...uniqueBySemantic.values()];
  const highValue = unique.filter((row) => row.tier === "high_value");
  const advanced = unique.filter((row) => row.tier === "advanced");
  return {
    highValue,
    advanced,
    hasCandidates: unique.length > 0,
    wallTypePanels: input.workAreas
      .filter((row) => row.status !== "excluded" && row.type === "internal_walls")
      .map((wa) =>
        internalWallsRefinePanel({
          workAreaId: wa.id,
          workAreaName: wa.name,
          facts: input.facts as EstimateFact[],
        })
      ),
    ceilingPortionPanels: input.workAreas
      .filter((row) => row.status !== "excluded" && row.type === "ceilings")
      .map((wa) =>
        ceilingsRefinePanel({
          workAreaId: wa.id,
          workAreaName: wa.name,
          facts: input.facts as EstimateFact[],
        })
      ),
  };
}

/**
 * Physically consumed for planning takeoff, but not Refine-interviewed.
 * Quotr derives/assumes joist layout; do not ask the builder to take off.
 * Name retained for RECOVERY-4-R2 compatibility.
 */
export const DECK_NOT_CONSUMED_REFINE_KEYS = [
  "deck.joist_section",
  "deck.joist_centres_mm",
] as const;
