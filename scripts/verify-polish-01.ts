/**
 * POLISH-01 — dashboard lifecycle, deck board width, transparent allowances.
 *
 * Run: npx --yes tsx scripts/verify-polish-01.ts
 *
 * Presentation / interview / dashboard existence only. Does not change
 * billing, quote acceptance, or Production.
 */
import { existsSync, readFileSync } from "node:fs";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  DECK_BOARD_WIDTH_ASSUMPTION_MM,
  DECK_BOARD_WIDTH_FACT_KEY,
  disclosedBoardWidthForNotSure,
  resolveDeckBoardWidthMm,
} from "../lib/estimate/deck-board-width";
import { deckFactQuestionClass } from "../lib/estimate/deck-information-contract";
import {
  containsInternalDiagnosticText,
  fallbackPresentationIsSafe,
  presentLineFallback,
} from "../lib/estimate/fallback-presentation";
import { calculateDeckingBoardLm } from "../lib/estimate/material-buildups";
import { DECK_JOISTS_COMPONENT_KEY } from "../lib/estimate/deck-structure";
import { DECK_SUPPORTS_COMPONENT_KEY } from "../lib/estimate/deck-structure";
import { mapRateLabel } from "../lib/assistant/builder-review/compose";
import { classifyRateSource } from "../lib/estimate/rate-source-labels";
import {
  applyProjectListFilter,
  withLifecycleDefaults,
} from "../lib/projects/query-utils";
import {
  getBusinessStatusDefinition,
  isFirstJobEmptyState,
  parseProjectListFilter,
} from "../lib/projects/status";
import type { EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { EstimateLineItem } from "../components/assistant/types";
import type { Project } from "../lib/projects/types";

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

function fact(
  key: string,
  workAreaId: string,
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

function wa(id: string): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "deck", name: "Deck", sort_order: 1, status: "confirmed" };
}

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
};

function ctx(facts: EstimateFact[]) {
  return {
    project: { id: "p1", qualityLevel: "standard" as const },
    confirmedWorkAreas: [wa("d1")],
    facts,
    constraints: [],
    organisationSettings: orgSettings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  };
}

function deckFacts(widthMm?: number, source?: string): EstimateFact[] {
  const rows: EstimateFact[] = [
    fact("deck.length_m", "d1", 5),
    fact("deck.width_m", "d1", 4),
    fact("deck.area_m2", "d1", 20),
    fact("deck.height_m", "d1", 0.4),
    fact("deck.board_material", "d1", "Hardwood"),
    fact("deck.substructure_included", "d1", true),
  ];
  if (widthMm != null) {
    rows.push(fact(DECK_BOARD_WIDTH_FACT_KEY, "d1", widthMm, source));
  }
  return rows;
}

function clarify(facts: EstimateFact[]) {
  const workAreas = [wa("d1")];
  const plan = composeJobPlan({
    workAreas,
    facts,
    constraints: [],
    qualityLevel: "standard",
    briefText: "Hardwood deck 5m x 4m",
  });
  return composeClarifyView({
    stage: "quality",
    briefText: "Hardwood deck 5m x 4m",
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function projectRow(
  status: Project["business_status"],
  extra?: Partial<Project>
): Project {
  return withLifecycleDefaults({
    id: extra?.id ?? "p1",
    title: extra?.title ?? "Job",
    brief_text: null,
    client_name: null,
    site_address: null,
    priority: "normal",
    due_date: null,
    notes: null,
    stage: "estimate_ready",
    quality_level: "standard",
    status: "draft",
    created_at: "2026-01-01T00:00:00.000Z",
    business_status: status,
    archived_at: extra?.archived_at ?? null,
    deleted_at: extra?.deleted_at ?? null,
    ...extra,
  });
}

function deckingLine(result: ReturnType<typeof calculateDeck>) {
  return result.lineItems.find((item) =>
    /decking/i.test(item.label)
  );
}

function reqQty(
  result: ReturnType<typeof calculateDeck>,
  componentKey: string
): number | null {
  const row = result.requirements?.find(
    (item) => "componentKey" in item && item.componentKey === componentKey
  );
  if (!row || !("purchaseQuantity" in row)) return null;
  return typeof row.purchaseQuantity === "number" ? row.purchaseQuantity : null;
}

console.log("=== POLISH-01 dashboard + deck width + allowances ===\n");

console.log("--- DASHBOARD ---\n");

check(
  "default filter is all projects",
  parseProjectListFilter(undefined) === "all" &&
    parseProjectListFilter("") === "all"
);
check("active filter still parses", parseProjectListFilter("active") === "active");
check("won filter parses", parseProjectListFilter("won") === "won");
check("lost filter parses", parseProjectListFilter("lost") === "lost");

const zero = isFirstJobEmptyState(0);
const oneWon = isFirstJobEmptyState(1);
check("zero projects → first-job empty state", zero === true);
check("accepted project does not produce first-job state", oneWon === false);
check(
  "declined project does not produce first-job state",
  isFirstJobEmptyState(1) === false
);

const won = projectRow("won");
const lost = projectRow("lost");
const draft = projectRow("estimating");
const quoted = projectRow("quote_sent");
check(
  "active filter hides won/lost",
  applyProjectListFilter([won, lost, draft], "active", true, true).length === 1
);
check(
  "all filter keeps won/lost/draft",
  applyProjectListFilter([won, lost, draft, quoted], "all", true, true).length === 4
);
check(
  "won filter shows accepted job",
  applyProjectListFilter([won, draft], "won", true, true)[0]?.id === won.id
);
check(
  "lost filter shows declined job",
  applyProjectListFilter([lost, draft], "lost", true, true)[0]?.id === lost.id
);
check(
  "lifecycle labels exist",
  getBusinessStatusDefinition("estimating").label === "Estimating" &&
    getBusinessStatusDefinition("quote_sent").label === "Quote sent" &&
    getBusinessStatusDefinition("won").label === "Won" &&
    getBusinessStatusDefinition("lost").label === "Lost"
);

const dash = read("app/(protected)/app/dashboard/page.tsx");
check(
  "dashboard empty state uses org existence not filtered list",
  dash.includes("organisationHasProjects") &&
    dash.includes("const isEmpty = !hasProjects") &&
    !dash.includes("const isEmpty = projects.length === 0")
);
check(
  "first-job copy still present for genuine empty orgs",
  dash.includes("Start your first job") && dash.includes('data-first-job-empty="true"')
);
check(
  "dashboard still lists projects when org has jobs",
  dash.includes("DashboardProjectList") && dash.includes("hasProjects={!isEmpty}")
);

console.log("\n--- DECK BOARD WIDTH ---\n");

check(
  "canonical fact is deck.board_width_mm",
  DECK_BOARD_WIDTH_FACT_KEY === "deck.board_width_mm" &&
    deckFactQuestionClass(DECK_BOARD_WIDTH_FACT_KEY) === "ASSUME_IF_SKIPPED"
);
check(
  "Not sure persists as assumed 140 mm",
  disclosedBoardWidthForNotSure("Not sure")?.value ===
    DECK_BOARD_WIDTH_ASSUMPTION_MM &&
    disclosedBoardWidthForNotSure("Not sure")?.source === "assumption" &&
    disclosedBoardWidthForNotSure(90) == null
);

const known = resolveDeckBoardWidthMm({
  facts: deckFacts(90, "user"),
  workAreaId: "d1",
});
const assumed = resolveDeckBoardWidthMm({
  facts: deckFacts(140, "assumption"),
  workAreaId: "d1",
});
const missing = resolveDeckBoardWidthMm({
  facts: deckFacts(),
  workAreaId: "d1",
});
check("known 90 mm stays KNOWN", known.mm === 90 && known.resolution === "KNOWN");
check(
  "assumed 140 mm stays ASSUMED",
  assumed.mm === 140 && assumed.resolution === "ASSUMED"
);
check(
  "missing width uses disclosed 140 mm",
  missing.mm === 140 && missing.resolution === "ASSUMED"
);

const missingQ = clarify(deckFacts());
const knownQ = clarify(deckFacts(140, "user"));
const assumedQ = clarify(deckFacts(140, "assumption"));
check(
  "Clarify asks board width when missing",
  [...missingQ.candidates, ...missingQ.deferred].some(
    (c) => c.factKey === DECK_BOARD_WIDTH_FACT_KEY
  )
);
check(
  "board width is high-impact / assumable",
  missingQ.candidates.some(
    (c) =>
      c.factKey === DECK_BOARD_WIDTH_FACT_KEY &&
      c.economicClass === "REQUIRED_FOR_ECONOMIC_MODEL" &&
      c.assumable === true &&
      c.inputType === "number"
  )
);
check(
  "Clarify does not re-ask known width",
  ![...knownQ.candidates, ...knownQ.deferred].some(
    (c) => c.factKey === DECK_BOARD_WIDTH_FACT_KEY
  )
);
check(
  "Clarify does not re-ask assumed width",
  ![...assumedQ.candidates, ...assumedQ.deferred].some(
    (c) => c.factKey === DECK_BOARD_WIDTH_FACT_KEY
  )
);

const lm90 = calculateDeckingBoardLm({
  areaM2: 20,
  boardWidthMm: 90,
  wastagePercent: 10,
});
const lm140 = calculateDeckingBoardLm({
  areaM2: 20,
  boardWidthMm: 140,
  wastagePercent: 10,
});
check(
  "90 vs 140 mm lineal quantity differs",
  lm90 != null &&
    lm140 != null &&
    lm90.baseLm === 222.22 &&
    lm140.baseLm === 142.86 &&
    lm90.totalLm !== lm140.totalLm
);

const calc90 = calculateDeck(ctx(deckFacts(90, "user")) as never, wa("d1"));
const calc140 = calculateDeck(ctx(deckFacts(140, "user")) as never, wa("d1"));
const line90 = deckingLine(calc90);
const line140 = deckingLine(calc140);
check(
  "calculator board width changes decking quantity",
  line90?.quantity != null &&
    line140?.quantity != null &&
    line90.quantity !== line140.quantity
);
check(
  "unrelated joist quantity unchanged",
  reqQty(calc90, DECK_JOISTS_COMPONENT_KEY) ===
    reqQty(calc140, DECK_JOISTS_COMPONENT_KEY)
);
check(
  "unrelated support quantity unchanged",
  reqQty(calc90, DECK_SUPPORTS_COMPONENT_KEY) ===
    reqQty(calc140, DECK_SUPPORTS_COMPONENT_KEY)
);

const calcAssumed = calculateDeck(
  ctx(deckFacts(140, "assumption")) as never,
  wa("d1")
);
check(
  "assumed width is disclosed on the estimate",
  calcAssumed.assumptions.some((line) => /140 mm decking/i.test(line)) &&
    calcAssumed.assumptionMetadata?.defaultedFacts.some(
      (row) => row.key === DECK_BOARD_WIDTH_FACT_KEY
    ) === true
);
check(
  "assumed quantity confidence is assumed not known",
  deckingLine(calcAssumed)?.quantityBasis?.confidence === "assumed"
);
check(
  "known width is not treated as assumed",
  line140?.quantityBasis?.confidence === "derived"
);

const emptyExtraction = {
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
};
const extracted = enrichExtractionFromBrief({
  briefText: "140mm kwila decking 5m x 4m",
  extraction: emptyExtraction,
  allowedTypes: ["deck"],
}).extraction;
check(
  "Analyse extracts 140 mm from 140mm kwila decking",
  extracted.facts.some(
    (row) => row.key === DECK_BOARD_WIDTH_FACT_KEY && Number(row.value) === 140
  )
);
const extractedSpace = enrichExtractionFromBrief({
  briefText: "140 mm kwila decking",
  extraction: emptyExtraction,
  allowedTypes: ["deck"],
}).extraction;
check(
  "Analyse extracts 140 mm with a space",
  extractedSpace.facts.some(
    (row) => row.key === DECK_BOARD_WIDTH_FACT_KEY && Number(row.value) === 140
  )
);

console.log("\n--- ALLOWANCES ---\n");

const physical = presentLineFallback({
  label: "Decking package",
  notes: "Package allowance (Hardwood) · board width not confirmed for lm pricing",
  rateSource: "Quotr benchmark",
  quantityBasis: null,
  category: "materials",
});
check(
  "missing physical input → Allowance used",
  physical?.kind === "physical_allowance" && physical.label === "Allowance used"
);
check(
  "physical reason is builder language",
  physical != null &&
    /board width hasn't been confirmed/i.test(physical.reason) &&
    fallbackPresentationIsSafe(physical)
);

const benchmarkRate = presentLineFallback({
  label: "Decking boards",
  notes: "Kwila · 140 mm",
  rateSource: "Quotr benchmark",
  quantityBasis: {
    sourceFact: "deck.board_width_mm",
    sourceLabel: "Board width and deck area",
    quantity: 142.86,
    unit: "lm",
    confidence: "derived",
  },
  category: "materials",
});
check(
  "calculated quantity + benchmark rate is not an allowance",
  benchmarkRate?.kind === "benchmark_rate" &&
    benchmarkRate.label === "Quotr benchmark" &&
    /company rate/i.test(benchmarkRate.reason)
);
check(
  "no internal diagnostic text in fallback copy",
  !containsInternalDiagnosticText("Allowance used") &&
    !physical?.reason.includes("PACKAGE_FALLBACK") &&
    containsInternalDiagnosticText("PACKAGE_FALLBACK")
);
check(
  "rate label maps fallback to Allowance used",
  mapRateLabel("Fallback allowance") === "Allowance used" &&
    classifyRateSource("Allowance used") === "fallback"
);

const review = composeBuilderReview({
  estimate: {
    recommendedCost: line140?.recommendedCost ?? 0,
    recommendedSell: line140?.recommendedSell ?? 0,
    marginPercent: 20,
    confidence: 70,
    assumptions: calcAssumed.assumptions,
    missingInfo: [],
    lineItems: (calcAssumed.lineItems as unknown as EstimateLineItem[]).map(
      (item, index) => ({
        ...item,
        id: `l${index}`,
        workAreaName: item.workAreaName ?? "Deck",
      })
    ),
  },
  workAreas: [wa("d1")],
});
check(
  "Builder Review can confirm board width",
  review.improvements.some((item) => /confirm board width/i.test(item.label)) ||
    review.assumptions.some((item) => /140 mm decking/i.test(item.label))
);
check(
  "Builder Review does not expose PACKAGE_FALLBACK",
  !JSON.stringify(review).includes("PACKAGE_FALLBACK")
);

const surface = read("components/assistant/builder-review/BuilderReviewSurface.tsx");
const estimatePanel = read("components/assistant/EstimatePanel.tsx");
const breakdown = read("components/assistant/EstimateBreakdownModal.tsx");
check(
  "Estimate and Builder Review render fallback copy",
  surface.includes("data-quantity-fallback") &&
    breakdown.includes("data-quantity-fallback") &&
    estimatePanel.includes("data-estimate-physical-allowances")
);
check(
  "no schema migration 054",
  !existsSync("supabase/migrations/054_polish_01.sql") &&
    !existsSync("supabase/migrations/054.sql")
);

if (failed > 0) {
  console.log(`\nFAILED ${failed} / ${passed + failed}`);
  process.exit(1);
}

console.log(`\nAll ${passed} POLISH-01 checks passed.`);
