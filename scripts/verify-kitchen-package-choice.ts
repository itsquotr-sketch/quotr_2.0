/**
 * Kitchen package choice is a visible interview control, not only a calculator fact.
 * Run: npx tsx scripts/verify-kitchen-package-choice.ts
 *
 * "Replace the kitchen. The room is 12 m²." keeps the package out until the
 * builder selects Full kitchen renovation. The control saves through the
 * existing clarify select path and the choice survives a reload.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { persistClarifyValueType } from "../lib/assistant/clarify/interaction";
import { isInitialCaptureQuestion } from "../lib/assistant/clarify/question-contract";
import { explicitKitchenRenovationChoice } from "../lib/assistant/clarify/kitchen-package-choice";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { ClarifyAnswerControl } from "../components/assistant/clarify/ClarifyAnswerControl";
import { calculateKitchen } from "../lib/estimate/calculators/kitchen";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

const workArea = {
  id: "k1",
  type: "kitchen",
  name: "Kitchen renovation",
  status: "confirmed",
  sort_order: 1,
} as EstimateWorkArea;

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "k1", value, source: "ai" };
}

function context(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
    },
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function interview(facts: EstimateFact[]) {
  const areas = [
    {
      id: "k1",
      type: "kitchen",
      name: "Kitchen renovation",
      status: "confirmed" as const,
    },
  ];
  const plan = composeJobPlan({
    workAreas: areas,
    facts,
    briefText: "Replace the kitchen. The room is 12 m².",
    qualityLevel: "standard",
  });
  return composeClarifyView({
    stage: "quality",
    briefText: "Replace the kitchen. The room is 12 m².",
    qualityLevel: "standard",
    workAreas: areas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function choice(facts: EstimateFact[]) {
  return interview(facts).candidates.find(
    (candidate) => candidate.factKey === "kitchen.renovation_type"
  );
}

function money(facts: EstimateFact[]) {
  const result = calculateKitchen(context(facts), workArea);
  const included = result.lineItems.filter((item) => item.includedInTotal !== false);
  const cost = included.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);
  const sell = included.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0);
  return { result, included, cost, sell };
}

function optionButton(html: string, label: string): string | null {
  const buttons = html.match(/<button[\s\S]*?<\/button>/g) ?? [];
  return buttons.find((button) => button.includes(label)) ?? null;
}

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed += 1;
}

const extracted = [
  fact("kitchen.area_m2", 12),
  fact("kitchen.renovation_type", "Replace"),
];
const before = choice(extracted);
const beforeMoney = money(extracted);
const shell = readFileSync("components/assistant/AssistantShell.tsx", "utf8");
const clarifyActions = readFileSync("lib/assistant/clarify/actions.ts", "utf8");
const factActions = readFileSync("lib/assistant/fact-actions.ts", "utf8");

check("extracted Replace is not an explicit package choice", explicitKitchenRenovationChoice("Replace") == null);
check(
  "the interview shows the kitchen scope question",
  before?.question === "What type of kitchen scope is this?" &&
    before.options?.includes("Full kitchen renovation") === true &&
    before.currentValue == null &&
    before.writeTarget === "FACT" &&
    before.blocksEstimate === false &&
    isInitialCaptureQuestion(before) === false
);
check(
  "the estimate page mounts that control on the existing save path",
  shell.includes("data-kitchen-package-choice") &&
    shell.includes("data-kitchen-scope-gap") &&
    shell.includes("Kitchen scope not confirmed") &&
    shell.includes("onAnswerValue={handleClarifyValue}") &&
    shell.includes("answerClarifySelectFact") &&
    clarifyActions.includes("return updateProjectFact") &&
    factActions.includes("markEstimateStaleWithContext")
);

const beforeHtml = renderToStaticMarkup(
  createElement(ClarifyAnswerControl, {
    candidate: before!,
    value: before?.currentValue,
    onAnswerValue: () => undefined,
  })
);
const fullButton = optionButton(beforeHtml, "Full Kitchen Renovation");
const replaceLikeButton = optionButton(beforeHtml, "Replace Like For Like");
check(
  "Full kitchen renovation is visible and not selected",
  fullButton?.includes('data-option-selected="false"') === true
);
check(
  "Replace does not preselect Replace like-for-like",
  replaceLikeButton?.includes('data-option-selected="false"') === true
);
check(
  "before confirmation the package contributes $0 and the scope gap remains",
  beforeMoney.cost === 0 &&
    beforeMoney.sell === 0 &&
    beforeMoney.result.missingInfo.includes("Kitchen scope not confirmed")
);
check(
  "choosing the option saves as a select fact",
  before != null &&
    persistClarifyValueType(before, "Full kitchen renovation") === "select"
);

const confirmed = [
  fact("kitchen.area_m2", 12),
  fact("kitchen.renovation_type", "Full kitchen renovation"),
];
const after = choice(confirmed);
const afterMoney = money(confirmed);
const afterHtml = renderToStaticMarkup(
  createElement(ClarifyAnswerControl, {
    candidate: after!,
    value: after?.currentValue,
    onAnswerValue: () => undefined,
  })
);
const confirmedButton = optionButton(afterHtml, "Full Kitchen Renovation");
const labels = afterMoney.included.map((item) => item.label);
check(
  "reload keeps Full kitchen renovation selected",
  after?.currentValue === "Full kitchen renovation" &&
    confirmedButton?.includes('data-option-selected="true"') === true
);
check(
  "the package is $31,520 cost and $44,400 sell with no duplicate lines",
  afterMoney.cost === 31520 &&
    afterMoney.sell === 44400 &&
    labels.length === 2 &&
    new Set(labels).size === 2 &&
    labels.includes("Kitchen labour") &&
    labels.includes("Kitchen materials/finishes allowance") &&
    !afterMoney.result.missingInfo.includes("Kitchen scope not confirmed")
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("kitchen package choice workflow passed");
