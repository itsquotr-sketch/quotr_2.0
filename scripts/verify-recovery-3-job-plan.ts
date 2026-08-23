/**
 * RECOVERY-3 — Job Plan projection + Deck Preview contract.
 * Run: npx tsx scripts/verify-recovery-3-job-plan.ts
 *
 * Presentation only. Does not change rates, goldens, or estimate money.
 */
import { existsSync, readFileSync } from "node:fs";
import { applyJobPlanScopeWrite } from "../lib/assistant/job-plan/apply-write";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { JOB_PLAN_IS_PRIMARY } from "../lib/assistant/job-plan/flags";
import { isForbiddenJobPlanScopeKey } from "../lib/assistant/job-plan/facts";
import type {
  JobPlanScopeItem,
  JobPlanWorkAreaCard,
} from "../lib/assistant/job-plan/types";
import { classifyResolvedSell } from "../lib/commercial-engine/core/cost-first-authority";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function wa(id: string, type = "deck", name = "Deck"): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function itemOn(
  card: JobPlanWorkAreaCard | undefined,
  id: string
): JobPlanScopeItem | undefined {
  if (!card) return undefined;
  return [...card.included, ...card.notIncluded, ...card.notConfirmed].find(
    (row) => row.id === id
  );
}

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const exemplar = loadCalibrationFixture("EXEMPLAR-AI-01.json");
const DECK = "wa-deck-1";
const realFacts = Object.entries(realJob.facts).map(([key, value]) =>
  fact(key, DECK, value)
);
const exemplarFacts = Object.entries(exemplar.facts).map(([key, value]) =>
  fact(key, DECK, value)
);

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
};

function realJobContext(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "real-job-01", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(DECK)],
    facts,
    constraints: [],
    organisationSettings: orgSettings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

const realPlan = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "suggested" }],
  facts: realFacts,
  qualityLevel: "standard",
  briefText: realJob.sourceBrief,
});
const realCard = realPlan.cards[0];

console.log("=== RECOVERY-3 Job Plan ===\n");

check("1 one Deck Work Area", realPlan.cards.length === 1 && realCard?.workAreaType === "deck");
check(
  "2 area 27m2",
  Boolean(realCard?.summary.includes("27") && realCard.summary.toLowerCase().includes("m"))
);
check(
  "3 compact spec uses Vitex, not Hardwood-class or quality",
  realCard?.summary === "27m² · Vitex · 140mm · Low-level" &&
    !realCard.summary.includes("Hardwood-class") &&
    !realCard.summary.includes("Standard") &&
    !realCard.summary.includes("0.14")
);
check("4 140mm shown", Boolean(realCard?.summary.includes("140")));
check(
  "5 low-level shown",
  Boolean(realCard?.summary.toLowerCase().includes("low-level"))
);
check(
  "6 new substructure included",
  itemOn(realCard, "substructure")?.presentation === "INCLUDED"
);
check(
  "7 decking included",
  itemOn(realCard, "decking")?.presentation === "INCLUDED"
);
check(
  "8 removal unstated => NOT_CONFIRMED, not NOT_INCLUDED",
  itemOn(realCard, "removal")?.presentation === "NOT_CONFIRMED"
);
check(
  "9 fascia unstated => NOT_CONFIRMED",
  itemOn(realCard, "fascia")?.presentation === "NOT_CONFIRMED"
);
check(
  "10 no invented balustrade requirement",
  itemOn(realCard, "balustrade") == null &&
    !realCard?.notConfirmed.some((i) => i.id === "balustrade") &&
    !realCard?.included.some((i) => i.id === "balustrade")
);
check(
  "11 no access/carry duplicated as Deck scope",
  [...(realCard?.included ?? []), ...(realCard?.notConfirmed ?? [])].every(
    (i) =>
      i.sourceFactKey !== "site_access" &&
      i.sourceFactKey !== "material_carry_distance" &&
      !isForbiddenJobPlanScopeKey(i.sourceFactKey ?? "")
  ) && itemOn(realCard, "steps")?.sourceFactKey === "deck.steps_included"
);

const exemplarPlan = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "confirmed" }],
  facts: exemplarFacts,
  constraints: [
    { key: "site_access", value: "Restricted" },
    { key: "material_carry_distance", value: "25-30m" },
  ],
  qualityLevel: "standard",
  briefText: exemplar.sourceBrief,
});
const exemplarCard = exemplarPlan.cards[0];

check(
  "12 demolition included",
  itemOn(exemplarCard, "removal")?.presentation === "INCLUDED"
);
check(
  "13 decking included",
  itemOn(exemplarCard, "decking")?.presentation === "INCLUDED"
);
check(
  "14 substructure included",
  itemOn(exemplarCard, "substructure")?.presentation === "INCLUDED"
);
check(
  "15 fascia included",
  itemOn(exemplarCard, "fascia")?.presentation === "INCLUDED"
);
check(
  "16 steps included",
  itemOn(exemplarCard, "steps")?.presentation === "INCLUDED"
);
check(
  "17 explicit no-balustrade is not included",
  itemOn(exemplarCard, "balustrade")?.presentation === "NOT_INCLUDED"
);
check(
  "18 restricted access remains Project Condition, not scope",
  ![...(exemplarCard?.included ?? []), ...(exemplarCard?.notIncluded ?? []), ...(exemplarCard?.notConfirmed ?? [])].some(
    (i) =>
      i.sourceFactKey === "site_access" ||
      i.sourceFactKey === "material_carry_distance" ||
      /carry|site access/i.test(i.label)
  )
);

const fasciaWrite = itemOn(realCard, "fascia")?.write;
const includedFacts = fasciaWrite
  ? applyJobPlanScopeWrite({
      facts: realFacts,
      workAreaId: DECK,
      write: fasciaWrite,
      presentation: "INCLUDED",
    })
  : realFacts;
const includedPlan = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "suggested" }],
  facts: includedFacts,
  briefText: realJob.sourceBrief,
});
check(
  "19 explicit include persists",
  itemOn(includedPlan.cards[0], "fascia")?.presentation === "INCLUDED"
);

const excludedFacts = fasciaWrite
  ? applyJobPlanScopeWrite({
      facts: realFacts,
      workAreaId: DECK,
      write: fasciaWrite,
      presentation: "NOT_INCLUDED",
    })
  : realFacts;
const excludedPlan = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "suggested" }],
  facts: excludedFacts,
  briefText: realJob.sourceBrief,
});
check(
  "20 explicit exclude persists",
  itemOn(excludedPlan.cards[0], "fascia")?.presentation === "NOT_INCLUDED"
);

const untouched = fasciaWrite
  ? applyJobPlanScopeWrite({
      facts: realFacts,
      workAreaId: DECK,
      write: fasciaWrite,
      presentation: "NOT_CONFIRMED",
    })
  : realFacts;
const untouchedPlan = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "suggested" }],
  facts: untouched,
  briefText: realJob.sourceBrief,
});
check(
  "21 unconfirmed remains unconfirmed",
  itemOn(untouchedPlan.cards[0], "fascia")?.presentation === "NOT_CONFIRMED" &&
    !untouched.some((f) => f.key === "deck.vertical_face_boards_required")
);

const reloaded = composeJobPlan({
  workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "suggested" }],
  facts: excludedFacts,
  briefText: realJob.sourceBrief,
});
check(
  "22 reload reconstructs same state",
  itemOn(reloaded.cards[0], "fascia")?.presentation === "NOT_INCLUDED" &&
    itemOn(reloaded.cards[0], "removal")?.presentation === "NOT_CONFIRMED"
);

const actionsSrc = read("lib/assistant/job-plan/actions.ts");
check(
  "23 scope change uses canonical action",
  actionsSrc.includes("updateProjectFact") &&
    !actionsSrc.includes("from(\"job_plan") &&
    existsSync("lib/assistant/fact-actions.ts")
);

const bath = "wa-bath";
const paint = "wa-paint";
const multi = composeJobPlan({
  workAreas: [
    { id: bath, type: "bathroom", name: "Bathroom", status: "confirmed", sortOrder: 1 },
    { id: DECK, type: "deck", name: "Deck", status: "confirmed", sortOrder: 2 },
    { id: paint, type: "painting", name: "Painting", status: "confirmed", sortOrder: 3 },
    { id: "wa-fitout", type: "commercial_fitout", name: "Commercial fitout", status: "confirmed", sortOrder: 4 },
  ],
  facts: [
    fact("bathroom.area_m2", bath, 6),
    fact("bathroom.renovation_type", bath, "Full renovation"),
    fact("bathroom.demolition_required", bath, true),
    ...realFacts,
    fact("painting.location", paint, "Internal"),
    fact("painting.surfaces", paint, ["Walls", "Ceilings"]),
  ],
  briefText: realJob.sourceBrief,
});
check(
  "24 Bathroom + Deck + Painting renders three parent cards",
  multi.cards.length === 3 &&
    multi.cards.map((c) => c.workAreaType).join(",") === "bathroom,deck,painting"
);
check(
  "25 scope stays isolated by Work Area",
  itemOn(multi.cards[0], "demolition")?.workAreaId === bath &&
    itemOn(multi.cards[1], "removal")?.workAreaId === DECK &&
    multi.cards[0].included.every((i) => i.workAreaId === bath) &&
    multi.cards[2].included.every((i) => i.workAreaId === paint)
);
check(
  "26 no commercial_fitout calculator card",
  multi.cards.every((c) => c.workAreaType !== "commercial_fitout")
);

const baseline = calculateEstimate(realJobContext(realFacts));
const afterPlan = calculateEstimate(realJobContext(untouched as EstimateFact[]));
check(
  "27 unchanged scope => unchanged estimate cost",
  baseline.recommendedCost === afterPlan.recommendedCost
);
check(
  "28 unchanged scope => unchanged sell",
  baseline.recommendedSell === afterPlan.recommendedSell
);

const classify = classifyResolvedSell({
  costRate: 22.5,
  sellRate: null,
  applicableGrossMarginPercent: 23.5,
});
check(
  "29 RECOVERY-1 sell parity remains",
  baseline.recommendedCost === 8620.53 &&
    baseline.recommendedSell === 12878.01 &&
    classify.sellAuthority === "derived_from_gross_margin" &&
    classify.sellRate === deriveSellFromCost(22.5, 23.5)
);

check(
  "30 structural money is detailed XOR package; labour requirement stays SHADOW",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW" &&
    baseline.lineItems.some((l) => l.label === "Joists") &&
    !baseline.lineItems.some((l) => l.label === "Framing/substructure")
);
check(
  "30b never package + detailed structure",
  baseline.lineItems.filter((l) => l.label === "Framing/substructure").length ===
    0 &&
    baseline.lineItems.some((l) => l.label === "Joists")
);
check(
  "31 Job Plan does not duplicate commercial lines",
  afterPlan.lineItems.length === baseline.lineItems.length &&
    !afterPlan.lineItems.some((l) => l.label === "Framing/substructure")
);

const shell = read("components/assistant/AssistantShell.tsx");
const panel = read("components/assistant/job-plan/JobPlanPanel.tsx");
const card = read("components/assistant/job-plan/JobPlanWorkAreaCard.tsx");
check(
  "32 Job Plan primary",
  JOB_PLAN_IS_PRIMARY &&
    shell.includes("JobPlanPanel") &&
    shell.includes("JOB_PLAN_IS_PRIMARY") &&
    panel.includes("data-job-plan-primary")
);
check(
  "33 no simultaneous duplicate old scope surface",
  !shell.includes("<WorkAreaConfirmationBlock") &&
    !shell.includes("<ScopeDiscoveryReviewBlock") &&
    existsSync("components/assistant/WorkAreaConfirmationBlock.tsx") &&
    existsSync("components/assistant/ScopeDiscoveryReviewBlock.tsx")
);
check(
  "34 mobile compact",
  panel.includes("flex flex-col gap-3") &&
    !panel.includes("<table") &&
    card.includes("rounded-xl")
);
check(
  "35 user can continue without expanding every Work Area",
  panel.includes("looksRight") &&
    panel.includes("data-job-plan-primary-cta") &&
    !card.includes("looksRight") &&
    card.includes("useState(false)")
);
check(
  "36 advanced spec not mandatory",
  card.includes("Edit specification") &&
    card.includes("data-job-plan-edit") &&
    !realCard?.specChips.some((c) => c.advanced) &&
    !realCard?.summary.toLowerCase().includes("standard")
);

function isEstimateComponentScopeLabel(label: string): boolean {
  return /joists?|bearers?|\brim framing\b|fixings/i.test(label);
}

check(
  "37 user-facing scope is not estimate components",
  !realPlan.cards.some((c) =>
    [...c.included, ...c.notConfirmed].some((i) =>
      isEstimateComponentScopeLabel(i.label)
    )
  )
);
check(
  "38 no Job Plan table",
  !read("lib/assistant/job-plan/actions.ts").includes("job_plan") ||
    read("lib/assistant/job-plan/actions.ts").includes("updateProjectFact")
);
check(
  "39 ABSENT !== NOT_REQUIRED persist",
  !realFacts.some((f) => f.key === "deck.existing_deck_removal") &&
    itemOn(realCard, "removal")?.presentation === "NOT_CONFIRMED"
);
check(
  "40 Deck adapter is first, generic registry exists",
  existsSync("lib/assistant/job-plan/adapters/deck.ts") &&
    existsSync("lib/assistant/job-plan/adapters/registry.ts") &&
    existsSync("components/assistant/job-plan/quick-spec-editors.ts") &&
    !panel.includes("workAreaType === \"deck\"")
);

const realCheckIds = (realCard?.notConfirmed ?? []).map((i) => i.id).sort();
const realIncludedIds = (realCard?.included ?? []).map((i) => i.id);
check(
  "42 known facts appear as context, not Checks",
  Boolean(realCard?.summary.includes("27m²")) &&
    Boolean(realCard?.summary.includes("Vitex")) &&
    Boolean(realCard?.summary.includes("140mm")) &&
    Boolean(realCard?.summary.includes("Low-level")) &&
    itemOn(realCard, "substructure")?.presentation === "INCLUDED" &&
    !realCheckIds.includes("decking") &&
    !realCheckIds.includes("substructure") &&
    realCheckIds.join(",") === "concrete_to_supports,fascia,removal,steps"
);
check(
  "43 included scope appears once",
  realIncludedIds.filter((id) => id === "decking").length === 1 &&
    realIncludedIds.filter((id) => id === "substructure").length === 1 &&
    card.includes("data-job-plan-included")
);
check(
  "44 explicit exclusion distinguishable from not-confirmed",
  itemOn(exemplarCard, "balustrade")?.presentation === "NOT_INCLUDED" &&
    !exemplarCard?.notConfirmed.some((i) => i.id === "balustrade") &&
    card.includes('data-job-plan-section="excluded"') &&
    card.includes('data-job-plan-section="check"') &&
    card.includes("— Not included")
);
check(
  "45 absence is not persisted as exclusion",
  itemOn(realCard, "removal")?.presentation === "NOT_CONFIRMED" &&
    !realFacts.some((f) => f.key === "deck.existing_deck_removal") &&
    applyJobPlanScopeWrite({
      facts: realFacts,
      workAreaId: DECK,
      write: itemOn(realCard, "removal")!.write!,
      presentation: "NOT_CONFIRMED",
    }).every((f) => f.key !== "deck.existing_deck_removal")
);
check(
  "46 low-relevance possible scope is suppressed",
  itemOn(realCard, "balustrade") == null &&
    ![...(realCard?.included ?? []), ...(realCard?.notConfirmed ?? [])].some((i) =>
      isEstimateComponentScopeLabel(i.label)
    ) &&
    itemOn(realCard, "concrete_to_supports")?.presentation === "NOT_CONFIRMED"
);
check(
  "47 REAL-JOB balustrade is not surfaced without evidence",
  itemOn(realCard, "balustrade") == null
);
check(
  "48 EXEMPLAR explicit no-balustrade is represented",
  itemOn(exemplarCard, "balustrade")?.presentation === "NOT_INCLUDED" &&
    Boolean(exemplarCard?.notIncluded.some((i) => i.id === "balustrade"))
);
check(
  "49 access/carry absent from WA card",
  ![
    ...(exemplarCard?.included ?? []),
    ...(exemplarCard?.notIncluded ?? []),
    ...(exemplarCard?.notConfirmed ?? []),
  ].some(
    (i) =>
      i.sourceFactKey === "site_access" ||
      i.sourceFactKey === "material_carry_distance" ||
      /carry|restricted access/i.test(i.label)
  )
);
check(
  "50 Looks right is primary action",
  panel.includes("data-job-plan-primary-cta") &&
    panel.includes("looksRight") &&
    !card.includes("looksRight") &&
    // R3: button sizing changed from w-full sm:w-auto to flex-1 sm:flex-none (consistent flex layout)
    (panel.includes("w-full sm:w-auto") || panel.includes("flex-1 sm:flex-none"))
);
check(
  "51 destructive removal not primary",
  card.includes("data-job-plan-overflow") &&
    card.includes("data-job-plan-remove") &&
    card.includes("DropdownMenu") &&
    shell.includes("excludeWorkAreaFromProject") &&
    !card.includes("data-job-plan-primary-cta")
);
check(
  "52 normal flow does not render old WA confirmation simultaneously",
  !shell.includes("<WorkAreaConfirmationBlock") &&
    shell.includes("JobPlanPanel")
);
check(
  "53 normal flow does not immediately duplicate Scope Review confirmation",
  !shell.includes("<ScopeDiscoveryReviewBlock") &&
    existsSync("components/assistant/ScopeDiscoveryReviewBlock.tsx")
);
check(
  "54 mobile layout has no table/horizontal overflow",
  panel.includes("overflow-x-hidden") &&
    panel.includes("flex flex-col gap-3") &&
    !panel.includes("<table") &&
    !card.includes("<table") &&
    panel.includes("safe-area-inset-bottom")
);
check(
  "55 multi-WA has one project-level continue/approval path",
  multi.cards.length === 3 &&
    (panel.match(/data-job-plan-primary-cta/g) ?? []).length === 1 &&
    !card.includes("looksRight")
);
check(
  "56 Job Plan reload is SoT-derived",
  existsSync("lib/assistant/job-plan/from-assistant-state.ts") &&
    actionsSrc.includes("updateProjectFact") &&
    itemOn(reloaded.cards[0], "fascia")?.presentation === "NOT_INCLUDED" &&
    itemOn(
      composeJobPlan({
        workAreas: [{ id: DECK, type: "deck", name: "Deck", status: "suggested" }],
        facts: excludedFacts,
        briefText: realJob.sourceBrief,
      }).cards[0],
      "fascia"
    )?.presentation === "NOT_INCLUDED"
);
check(
  "57 money unchanged",
  baseline.recommendedCost === afterPlan.recommendedCost &&
    baseline.recommendedSell === afterPlan.recommendedSell &&
    baseline.recommendedCost === 8620.53 &&
    baseline.recommendedSell === 12878.01
);

console.log("\n=== Multi-WA Job Plan fixture ===");
for (const c of multi.cards) {
  console.log(
    `${c.name} [${c.workAreaType}] spec="${c.summary}" included=${c.included
      .map((i) => i.label)
      .join(" | ")} check=${c.notConfirmed.map((i) => i.label).join(" | ")} excluded=${c.notIncluded
      .map((i) => i.label)
      .join(" | ")}`
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
