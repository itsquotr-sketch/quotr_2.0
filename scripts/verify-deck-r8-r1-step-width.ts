/**
 * DECK-R8-R1 — stair width information completeness.
 * Silent 1.0 m width default is forbidden. Width is KNOWN, ASSUMED
 * (disclosed), or INFORMATION_REQUIRED. Shared Step geometry feeds
 * material, framing, and labour.
 *
 * Run: npx tsx scripts/verify-deck-r8-r1-step-width.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview, toPricedLine } from "../lib/assistant/builder-review/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { DECK_INFORMATION_CONTRACT } from "../lib/estimate/deck-information-contract";
import {
  DECK_CONCRETE_MATERIAL_LABEL,
  DECK_STEPS_INCLUDED_FACT_KEY,
  DECKING_LINE_LABEL,
} from "../lib/estimate/deck-scope-2c";
import {
  DEFAULT_STEP_GOING_M,
  DEFAULT_STEP_WIDTH_M,
  calculateDeckStepsQuantities,
  formatStepGeometryTakeoff,
  stepPhysicalGeometryReady,
} from "../lib/estimate/deck-steps-physical";
import { calculateDeckingBoardLm } from "../lib/estimate/material-buildups";
import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  detailedMoneyAllowed,
} from "../lib/estimate/physical-requirement-resolution";
import type { OrganisationRate } from "../components/setup/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { EstimateLineItem } from "../components/assistant/types";

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

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "deck", name: "Deck", sort_order: 1, status: "confirmed" };
}

function productivityOrgRate(
  itemKey: string,
  unit: string,
  hours: number
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "productivity",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: hours,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: null,
    work_area_type: "deck",
  };
}

function labourOrgRate(costRate: number): OrganisationRate {
  return {
    id: "labour.carpenter.hour",
    rate_type: "labour",
    item_key: "labour.carpenter.hour",
    label: "Carpenter",
    unit: "hour",
    cost_rate: costRate,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: "carpenter",
    work_area_type: "deck",
  };
}

function materialOrgRate(
  itemKey: string,
  costRate: number,
  unit = "lm"
): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "material",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: costRate,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: null,
    work_area_type: "deck",
  };
}

const LIVE_ID = "owner-r8-live";

function liveFacts(overrides: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("deck.length_m", LIVE_ID, 3),
    fact("deck.width_m", LIVE_ID, 9),
    fact("deck.area_m2", LIVE_ID, 27),
    fact("deck.height_m", LIVE_ID, 0.14),
    fact("deck.level", LIVE_ID, "Ground-level"),
    fact("deck.board_material", LIVE_ID, "Kwila"),
    fact("deck.board_width_mm", LIVE_ID, 140),
    fact("deck.substructure_included", LIVE_ID, true),
    fact("deck.vertical_face_boards_required", LIVE_ID, true),
    fact("deck.concrete_to_supports", LIVE_ID, true),
    fact("deck.concrete_bags_per_hole", LIVE_ID, 3),
    fact(DECK_STEPS_INCLUDED_FACT_KEY, LIVE_ID, true),
    fact("deck.step_count", LIVE_ID, 3),
    fact("deck.step_width_m", LIVE_ID, 9),
  ];
  const keys = new Set(overrides.map((row) => row.key));
  return [...base.filter((row) => !keys.has(row.key)), ...overrides];
}

function withoutKeys(facts: EstimateFact[], keys: readonly string[]): EstimateFact[] {
  const skip = new Set(keys);
  return facts.filter((row) => !skip.has(row.key));
}

function liveRates(): OrganisationRate[] {
  return [
    labourOrgRate(78),
    materialOrgRate("deck.material.kwila.lm", 18.5),
    materialOrgRate("deck.concrete.premix.20kg.bag", 9.5, "bag"),
    productivityOrgRate("deck.concrete.place.hours_per_hole", "hole", 0.4),
  ];
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p-r8-r1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(LIVE_ID)],
    facts,
    constraints: [],
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: liveRates(),
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
      premium_rate_factor: 1.15,
    },
  } as unknown as EstimateContext;
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category as EstimateLineItem["category"],
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    costRate: item.costRate,
    sellRate: item.sellRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    includedInTotal: item.includedInTotal,
    notes: item.notes,
    identitySummary: item.identitySummary,
  }));
}

function line(
  items: readonly EstimateLineItemInput[],
  label: string
): EstimateLineItemInput | undefined {
  return items.find((item) => item.label === label);
}

function reviewOf(result: ReturnType<typeof calculateDeck>) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: result.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
      recommendedSell: result.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
      marginPercent: 20,
      confidence: 0.7,
      assumptions: result.assumptions,
      missingInfo: result.missingInfo,
      lineItems: mapCalcLines(result.lineItems),
    },
    workAreas: [{ id: LIVE_ID, name: "Deck", type: "deck", status: "confirmed" }],
    requirements: result.requirements ?? [],
  });
}

function refineOf(facts: EstimateFact[]) {
  const jobPlan = composeJobPlan({
    workAreas: [wa(LIVE_ID)],
    facts,
    constraints: [],
    briefText: "Kwila deck with steps",
  });
  return composeRefineView({
    workAreas: [wa(LIVE_ID)],
    facts,
    constraints: [],
    briefText: "Kwila deck with steps",
    qualityLevel: "standard",
    jobPlan,
  });
}

function spawnVerifier(script: string): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        DECK_R7_SKIP_SPAWN: "1",
        DECK_R8_SKIP_SPAWN: "1",
        FENCE_SKIP_NESTED_SPAWN: "1",
        RW_SKIP_NESTED_SPAWN: "1",
      },
    });
    return true;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out.split(/\r?\n/).find((row) => /^FAIL /.test(row));
    if (failLine) console.log(`      spawn ${script}: ${failLine.trim()}`);
    return false;
  }
}

function spawnFence(script: string, minPassed: number): boolean {
  try {
    const out = execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, FENCE_SKIP_NESTED_SPAWN: "1" },
    }) as string;
    const match = out.match(/RESULT: (\d+) passed, (\d+) failed/);
    if (!match) {
      console.log(`      ${script}: missing RESULT line`);
      return false;
    }
    const p = Number(match[1]);
    const f = Number(match[2]);
    if (f !== 0 || p < minPassed) {
      console.log(`      ${script}: ${p} passed / ${f} failed (need >=${minPassed}/0)`);
      return false;
    }
    console.log(`      ${script}: ${p} passed / ${f} failed`);
    return true;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out.split(/\r?\n/).find((row) => /^FAIL /.test(row));
    if (failLine) console.log(`      spawn ${script}: ${failLine.trim()}`);
    return false;
  }
}

function spawnR7(): boolean {
  try {
    const out = execFileSync("npx", ["tsx", "scripts/verify-deck-r7-real-world.ts"], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
    }) as string;
    const match = out.match(/DECK-R7\s+(\d+) passed \/ (\d+) failed/);
    if (!match) {
      console.log("      R7: missing DECK-R7 result line");
      return false;
    }
    const p = Number(match[1]);
    const f = Number(match[2]);
    if (f !== 0 || p < 83) {
      console.log(`      R7: ${p} passed / ${f} failed (need >=83/0)`);
      return false;
    }
    console.log(`      R7: ${p} passed / ${f} failed`);
    return true;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out.split(/\r?\n/).find((row) => /^FAIL /.test(row));
    if (failLine) console.log(`      spawn R7: ${failLine.trim()}`);
    return false;
  }
}

console.log("=== DECK-R8-R1 stair width completeness ===\n");

const stepsSrc = read("lib/estimate/deck-steps-physical.ts");
const calcSrc = read("lib/estimate/calculators/deck.ts");
const contractWidth = DECK_INFORMATION_CONTRACT.filter(
  (row) => row.factKey === "deck.step_width_m"
);
const widthCalls = (calcSrc.match(/calculateDeckStepsQuantities\(/g) ?? []).length;

check(
  "1 canonical stair-width fact exists once",
  contractWidth.length === 1 &&
    contractWidth[0]?.questionClass === "ASSUME_IF_SKIPPED" &&
    contractWidth[0]?.commercial === true &&
    read("lib/scopes/templates/deck.ts").includes('key: "deck.step_width_m"') &&
    read("lib/scopes/templates/deck.ts").includes("How wide are the stairs?") &&
    read("components/assistant/job-plan/DeckQuickSpecEditor.tsx").includes(
      "Stair width"
    )
);

check(
  "2 missing width cannot silently raw-default",
  !/widthKnown \? widthFact : DEFAULT_STEP_WIDTH_M/.test(stepsSrc) &&
    stepsSrc.includes("resolvePhysicalRequirement") &&
    stepsSrc.includes("widthResolution") &&
    stepsSrc.includes("assumeWidthIfMissing")
);

const liveQty = calculateDeckStepsQuantities({
  facts: liveFacts(),
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
});
const liveDeck = calculateDeck(ctx(liveFacts()), wa(LIVE_ID));
const liveTread = line(liveDeck.lineItems, "Step decking");
const liveLab = line(liveDeck.lineItems, "Step installation");
const liveFraming = line(liveDeck.lineItems, "Step framing");
const liveLm = calculateDeckingBoardLm({
  areaM2: liveQty?.treadAreaM2 ?? 0,
  boardWidthMm: 140,
  wastagePercent: 10,
});

check(
  "3 known width => KNOWN",
  liveQty?.widthResolution === PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN &&
    liveQty?.widthM === 9 &&
    liveQty?.widthDefaulted === false &&
    !liveDeck.assumptions.some((row) => /assuming stair width/i.test(row))
);

const omittedFacts = withoutKeys(liveFacts(), ["deck.step_width_m"]);
const omittedQty = calculateDeckStepsQuantities({
  facts: omittedFacts,
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
});
const omittedDeck = calculateDeck(ctx(omittedFacts), wa(LIVE_ID));
const omittedReview = reviewOf(omittedDeck);
const omittedRefine = refineOf(omittedFacts);
const omittedTread = line(omittedDeck.lineItems, "Step decking");
const omittedLab = line(omittedDeck.lineItems, "Step installation");
const omittedFraming = line(omittedDeck.lineItems, "Step framing");
const omittedLm = calculateDeckingBoardLm({
  areaM2: omittedQty?.treadAreaM2 ?? 0,
  boardWidthMm: 140,
  wastagePercent: 10,
});

check(
  "4 assumed width => ASSUMED + disclosure",
  omittedQty?.widthResolution === PHYSICAL_REQUIREMENT_RESOLUTION.ASSUMED &&
    omittedQty?.widthM === DEFAULT_STEP_WIDTH_M &&
    omittedQty?.widthDefaulted === true &&
    omittedDeck.assumptions.some((row) =>
      /assuming stair width 1\.0 m \(LOW-CONFIDENCE\)/i.test(row)
    )
);

check(
  "5 Improve item appears when width assumed",
  omittedRefine.highValue.some((row) => row.factKey === "deck.step_width_m") &&
    omittedRefine.highValue.some(
      (row) =>
        row.factKey === "deck.step_width_m" &&
        row.question === "How wide are the stairs?" &&
        row.label === "Stair width"
    ) &&
    (omittedReview.improvements.some((row) => /confirm stair width/i.test(row.label)) ||
      omittedReview.assumptions.some((row) => /stair width/i.test(row.label)))
);

const knownBothFacts = liveFacts([fact("deck.step_going_m", LIVE_ID, 0.28)]);
const knownBothRefine = refineOf(knownBothFacts);
const knownBothDeck = calculateDeck(ctx(knownBothFacts), wa(LIVE_ID));
check(
  "6 known width suppresses Improve",
  !refineOf(liveFacts()).highValue.some((row) => row.factKey === "deck.step_width_m") &&
    !knownBothRefine.highValue.some((row) => row.factKey === "deck.step_width_m") &&
    !knownBothRefine.highValue.some((row) => row.factKey === "deck.step_going_m") &&
    !knownBothDeck.assumptions.some((row) => /assuming stair width/i.test(row)) &&
    !knownBothDeck.assumptions.some((row) => /assuming stair tread depth/i.test(row))
);

check(
  "7 tread depth remains independently resolved",
  liveQty?.goingResolution === PHYSICAL_REQUIREMENT_RESOLUTION.ASSUMED &&
    Math.abs((liveQty?.goingM ?? 0) - DEFAULT_STEP_GOING_M) < 0.001 &&
    omittedQty?.goingResolution === PHYSICAL_REQUIREMENT_RESOLUTION.ASSUMED &&
    omittedDeck.assumptions.some((row) => /assuming stair tread depth 280 mm/i.test(row)) &&
    omittedDeck.assumptions.some((row) => /assuming stair width 1\.0 m/i.test(row))
);

const derivedCount = calculateDeckStepsQuantities({
  facts: withoutKeys(liveFacts(), ["deck.step_count"]),
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
});
check(
  "8 tread count resolution is explicit",
  liveQty?.riseCountResolution === PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN &&
    liveQty?.riseCount === 3 &&
    derivedCount?.riseCountResolution === PHYSICAL_REQUIREMENT_RESOLUTION.DERIVED &&
    (derivedCount?.riseCount ?? 0) > 0
);

check(
  "9 material uses resolved width",
  Math.abs((liveQty?.treadAreaM2 ?? 0) - 9 * 0.28 * 3) < 0.02 &&
    Math.abs((liveLm?.baseLm ?? 0) - 54) < 0.05 &&
    Math.abs((liveLm?.totalLm ?? 0) - 59.4) < 0.05 &&
    /54(\.0)? lm required/i.test(liveTread?.identitySummary ?? "") &&
    /59\.4 lm purchased/i.test(liveTread?.identitySummary ?? "") &&
    Math.abs((omittedLm?.baseLm ?? 0) - 6) < 0.05 &&
    Math.abs((omittedLm?.totalLm ?? 0) - 6.6) < 0.05
);

check(
  "10 labour uses resolved width",
  Math.abs((liveLab?.quantity ?? 0) - (liveQty?.treadAreaM2 ?? 0)) < 0.02 &&
    Math.abs((omittedLab?.quantity ?? 0) - (omittedQty?.treadAreaM2 ?? 0)) < 0.02 &&
    (liveLab?.notes ?? "").includes("stair width") &&
    (liveLab?.notes ?? "").includes("9") &&
    (omittedLab?.notes ?? "").includes("1") &&
    (omittedLab?.notes ?? "").includes("assumed")
);

check(
  "11 framing uses resolved width",
  (liveFraming?.quantity ?? 0) !== (omittedFraming?.quantity ?? 0) &&
    (liveQty?.framingNetLm ?? 0) > (omittedQty?.framingNetLm ?? 0) &&
    widthCalls === 1 &&
    calcSrc.includes("steps.treadAreaM2") &&
    calcSrc.includes("steps.framingPurchaseLm") &&
    calcSrc.includes("steps.widthM") &&
    calcSrc.includes("stepPhysicalGeometryReady")
);

const q09 = calculateDeckStepsQuantities({
  facts: liveFacts([fact("deck.step_width_m", LIVE_ID, 0.9)]),
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
})!;
const q10 = calculateDeckStepsQuantities({
  facts: liveFacts([fact("deck.step_width_m", LIVE_ID, 1.0)]),
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
})!;
const q12 = calculateDeckStepsQuantities({
  facts: liveFacts([fact("deck.step_width_m", LIVE_ID, 1.2)]),
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
})!;
const d09 = calculateDeck(
  ctx(liveFacts([fact("deck.step_width_m", LIVE_ID, 0.9)])),
  wa(LIVE_ID)
);
const d10 = calculateDeck(
  ctx(liveFacts([fact("deck.step_width_m", LIVE_ID, 1.0)])),
  wa(LIVE_ID)
);
const d12 = calculateDeck(
  ctx(liveFacts([fact("deck.step_width_m", LIVE_ID, 1.2)])),
  wa(LIVE_ID)
);
const lm09 = calculateDeckingBoardLm({
  areaM2: q09.treadAreaM2,
  boardWidthMm: 140,
  wastagePercent: 10,
});
const lm10 = calculateDeckingBoardLm({
  areaM2: q10.treadAreaM2,
  boardWidthMm: 140,
  wastagePercent: 10,
});
const lm12 = calculateDeckingBoardLm({
  areaM2: q12.treadAreaM2,
  boardWidthMm: 140,
  wastagePercent: 10,
});
check(
  "12 width sensitivity changes Step quantities",
  Math.abs(q09.treadAreaM2 - 0.9 * 0.28 * 3) < 0.02 &&
    Math.abs(q10.treadAreaM2 - 1.0 * 0.28 * 3) < 0.02 &&
    Math.abs(q12.treadAreaM2 - 1.2 * 0.28 * 3) < 0.02 &&
    (lm09?.baseLm ?? 0) < (lm10?.baseLm ?? 0) &&
    (lm10?.baseLm ?? 0) < (lm12?.baseLm ?? 0) &&
    (lm09?.totalLm ?? 0) < (lm10?.totalLm ?? 0) &&
    (lm10?.totalLm ?? 0) < (lm12?.totalLm ?? 0) &&
    (line(d09.lineItems, "Step decking")?.recommendedCost ?? 0) <
      (line(d10.lineItems, "Step decking")?.recommendedCost ?? 0) &&
    (line(d10.lineItems, "Step decking")?.recommendedCost ?? 0) <
      (line(d12.lineItems, "Step decking")?.recommendedCost ?? 0) &&
    (line(d09.lineItems, "Step installation")?.labourHours ?? 0) <
      (line(d10.lineItems, "Step installation")?.labourHours ?? 0) &&
    (line(d10.lineItems, "Step installation")?.labourHours ?? 0) <
      (line(d12.lineItems, "Step installation")?.labourHours ?? 0) &&
    (q09.framingNetLm ?? 0) < (q10.framingNetLm ?? 0) &&
    (q10.framingNetLm ?? 0) < (q12.framingNetLm ?? 0)
);

check(
  "13 unrelated Deck quantities unchanged by stair width",
  line(d09.lineItems, DECKING_LINE_LABEL)?.quantity ===
    line(d12.lineItems, DECKING_LINE_LABEL)?.quantity &&
    line(d09.lineItems, DECK_CONCRETE_MATERIAL_LABEL)?.quantity ===
      line(d12.lineItems, DECK_CONCRETE_MATERIAL_LABEL)?.quantity &&
    line(d10.lineItems, DECKING_LINE_LABEL)?.quantity ===
      line(liveDeck.lineItems, DECKING_LINE_LABEL)?.quantity
);

const blockedWidth = calculateDeckStepsQuantities({
  facts: omittedFacts,
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
  assumeWidthIfMissing: false,
});
check(
  "14 unresolved width blocks unexplained money",
  blockedWidth != null &&
    blockedWidth.widthResolution ===
      PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED &&
    !detailedMoneyAllowed(blockedWidth.widthResolution) &&
    blockedWidth.treadAreaM2 === 0 &&
    blockedWidth.framingNetLm === 0 &&
    !stepPhysicalGeometryReady(blockedWidth) &&
    calcSrc.includes('missingInfo.push("Stair width required")') &&
    calcSrc.includes("stepPhysicalGeometryReady")
);

check(
  "15 no package restoration",
  !omittedDeck.lineItems.some((item) =>
    /step-down allowance|stair set allowance/i.test(item.label)
  ) &&
    omittedTread != null &&
    liveTread != null &&
    !liveDeck.lineItems.some((item) =>
      /step-down allowance|stair set allowance/i.test(item.label)
    )
);

check(
  "live fixture width KNOWN preserves 54.0 / 59.4 lm",
  liveQty?.widthResolution === "KNOWN" &&
    /54(\.0)? lm required/i.test(liveTread?.identitySummary ?? "") &&
    /59\.4 lm purchased/i.test(liveTread?.identitySummary ?? "")
);

const omittedPriced = toPricedLine(mapCalcLines([omittedTread!])[0]!);
const omittedLabPriced = toPricedLine(mapCalcLines([omittedLab!])[0]!);
const takeoff = formatStepGeometryTakeoff(omittedQty!);
check(
  "omitted-width fixture discloses width and going independently",
  omittedQty != null &&
    omittedTread != null &&
    omittedQty.widthM === 1 &&
    omittedQty.goingM === DEFAULT_STEP_GOING_M &&
    takeoff.includes("Width: 1.0m assumed") &&
    takeoff.includes("Tread depth: 280mm assumed") &&
    takeoff.includes("Treads: 3") &&
    (omittedPriced.detail ?? "").includes("Width: 1.0m assumed") &&
    (omittedPriced.detail ?? "").includes("Tread depth: 280mm assumed") &&
    /required/i.test(omittedPriced.supporting ?? "") &&
    /purchased/i.test(omittedPriced.supporting ?? "")
);

check(
  "Builder Review labour copy stays concise",
  (omittedLab?.identitySummary ?? "").includes("m²") &&
    (omittedLab?.identitySummary ?? "").includes("h/m²") &&
    !(omittedLab?.identitySummary ?? "").includes("Physical driver") &&
    !(omittedLabPriced.supporting ?? "").includes("Physical driver") &&
    (omittedLabPriced.detail ?? "").includes("Physical driver") &&
    (omittedLabPriced.detail ?? "").includes("stair width")
);

check(
  "helper not expanded into Fence/RW",
  !read("lib/estimate/calculators/fence.ts").includes(
    "physical-requirement-resolution"
  ) &&
    !read("lib/estimate/calculators/retaining-wall.ts").includes(
      "physical-requirement-resolution"
    )
);

check(
  "R8 locked copy unchanged",
  read("lib/scopes/templates/deck.ts").includes("Fascia / edge boards") &&
    read("lib/scopes/templates/deck.ts").includes(
      "Full-height deck skirting / screening"
    ) &&
    read("lib/estimate/deck-scope-2c.ts").includes(
      "DECK_CONCRETE_PLACE_HOURS_PER_BAG"
    )
);

console.log("\n== REGRESSION SPAWNS ==");
if (process.env.DECK_R8_R1_SKIP_SPAWN === "1") {
  console.log("skipped nested spawns (DECK_R8_R1_SKIP_SPAWN=1)");
} else {
  check("Deck R8 local", spawnVerifier("scripts/verify-deck-r8-final-closure.ts"));
  check("Deck R7 >=83/0", spawnR7());
  check("Fence 1A >=157/0", spawnFence("scripts/verify-fence-maturity-1a.ts", 157));
  check("Fence 1B >=82/0", spawnFence("scripts/verify-fence-maturity-1b.ts", 82));
  const spawns: [string, string][] = [
    ["Deck 2A", "scripts/verify-deck-maturity-2a.ts"],
    ["Deck 2B", "scripts/verify-deck-maturity-2b.ts"],
    ["Deck 2C", "scripts/verify-deck-maturity-2c.ts"],
    ["Deck 2D", "scripts/verify-deck-maturity-2d.ts"],
    ["RW R6", "scripts/verify-retaining-wall-post-concrete-r6.ts"],
    ["RW family closure", "scripts/verify-retaining-wall-family-closure-01.ts"],
    ["RW family coverage", "scripts/verify-retaining-wall-family-coverage-01.ts"],
    ["Estimator Safety", "scripts/verify-estimator-safety-0.ts"],
    ["Recovery 1", "scripts/verify-recovery-1-commercial-authority.ts"],
    ["Recovery 3", "scripts/verify-recovery-3-job-plan.ts"],
    ["Recovery 4", "scripts/verify-recovery-4-clarify.ts"],
    ["Recovery 4 R2", "scripts/verify-recovery-4-r2-estimate-readiness.ts"],
    ["Recovery 5A", "scripts/verify-recovery-5a-assistant-modes.ts"],
    ["Recovery 5B BR", "scripts/verify-recovery-5b-builder-review.ts"],
    ["Recovery 5B R3", "scripts/verify-recovery-5b-r3-estimate-experience.ts"],
    ["UX Premium", "scripts/verify-ux-premium-01.ts"],
    ["Commercial", "scripts/verify-commercial-p0-authority-lock.ts"],
    ["cost-first", "scripts/verify-cost-first-rates.ts"],
    ["Rates", "scripts/verify-material-rates.ts"],
    ["Pricing", "scripts/verify-pricing-ownership.ts"],
    ["Quote", "scripts/verify-quote-safety.ts"],
    ["Foundation", "scripts/verify-foundation-r1-project-conditions-support.ts"],
    ["REQ", "scripts/verify-req-2-1-deck-surface-material-requirement.ts"],
    ["Outdoor", "scripts/verify-outdoor-calibration.ts"],
    ["Performance", "scripts/verify-performance-smoke.ts"],
    ["fact coverage", "scripts/verify-fact-coverage.ts"],
  ];
  for (const [label, script] of spawns) {
    if (!existsSync(script)) {
      check(`spawn ${label}`, false, `missing ${script}`);
      continue;
    }
    check(`spawn ${label}`, spawnVerifier(script));
  }
}

if (failed > 0) {
  console.log(`\nDECK-R8-R1  ${passed} passed / ${failed} failed`);
  process.exit(1);
}
console.log(`\nDECK-R8-R1  ${passed} passed / 0 failed`);
