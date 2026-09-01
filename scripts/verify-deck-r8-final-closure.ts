/**
 * DECK-R8 — final Deck closure:
 * fascia/skirting language, bag-driven concrete labour, step tread-depth
 * information quality, concise Builder Review labour copy.
 *
 * Run: npx tsx scripts/verify-deck-r8-final-closure.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview, toPricedLine } from "../lib/assistant/builder-review/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { buildMinimalExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  DECK_FASCIA_BUILDER_LABEL,
  DECK_SKIRTING_BUILDER_LABEL,
  DECK_SKIRTING_INCLUDED_FACT_KEY,
  calculateDeckFasciaQuantities,
  calculateDeckSkirtingQuantities,
  deckSkirtingIncluded,
} from "../lib/estimate/deck-fascia";
import {
  DECK_CONCRETE_MATERIAL_LABEL,
  DECK_CONCRETE_PLACE_HOURS_PER_BAG,
  DECK_CONCRETE_PLACE_LABEL,
  DECK_CONCRETE_PRODUCTIVITY_HOLE_LEGACY_KEY,
  DECK_CONCRETE_PRODUCTIVITY_KEY,
  DECK_STEPS_INCLUDED_FACT_KEY,
  purchasedConcreteBags,
} from "../lib/estimate/deck-scope-2c";
import {
  DEFAULT_STEP_GOING_M,
  calculateDeckStepsQuantities,
} from "../lib/estimate/deck-steps-physical";
import {
  hasIncompatibleLegacyConcreteHoleRate,
  resolveDeckConcretePlaceProductivity,
} from "../lib/estimate/deck-productivity";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import { parseLineItemNotes } from "../lib/estimate/line-item-metadata";
import {
  PHYSICAL_REQUIREMENT_RESOLUTION,
  detailedMoneyAllowed,
  resolvePhysicalRequirement,
} from "../lib/estimate/physical-requirement-resolution";
import { round2 } from "../lib/estimate/facts";
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

function liveRates(extra: OrganisationRate[] = []): OrganisationRate[] {
  return [
    labourOrgRate(78),
    materialOrgRate("deck.material.kwila.lm", 18.5),
    materialOrgRate("deck.concrete.premix.20kg.bag", 9.5, "bag"),
    productivityOrgRate(DECK_CONCRETE_PRODUCTIVITY_HOLE_LEGACY_KEY, "hole", 0.4),
    ...extra,
  ];
}

function ctx(
  facts: EstimateFact[],
  opts?: { rates?: OrganisationRate[] }
): EstimateContext {
  return {
    project: { id: "p-r8", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(LIVE_ID)],
    facts,
    constraints: [],
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: opts?.rates ?? liveRates(),
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
    else {
      const snippet = out.trim().split(/\r?\n/).slice(-8).join(" | ");
      console.log(`      spawn R7: ${snippet.slice(0, 400)}`);
    }
    return false;
  }
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

console.log("=== DECK-R8 final Deck closure ===\n");

const live = calculateDeck(ctx(liveFacts()), wa(LIVE_ID));
const fasciaLines = live.lineItems.filter((item) => item.label === DECK_FASCIA_BUILDER_LABEL);
const skirtLines = live.lineItems.filter((item) => item.label === DECK_SKIRTING_BUILDER_LABEL);
const concMat = line(live.lineItems, DECK_CONCRETE_MATERIAL_LABEL);
const concLab = line(live.lineItems, DECK_CONCRETE_PLACE_LABEL);
const stepDeck = line(live.lineItems, "Step decking");
const stepLab = line(live.lineItems, "Step installation");
const stepFraming = line(live.lineItems, "Step framing");

console.log("== FASCIA / SKIRTING ==");
check(
  "1 fascia and full-height skirting remain physically distinct",
  DECK_FASCIA_BUILDER_LABEL !== DECK_SKIRTING_BUILDER_LABEL &&
    !deckSkirtingIncluded({ facts: liveFacts(), workAreaId: LIVE_ID })
);
const fasciaQty = calculateDeckFasciaQuantities({
  facts: liveFacts(),
  workAreaId: LIVE_ID,
  lengthM: 3,
  widthM: 9,
  areaM2: 27,
  deckHeightM: 1.2,
  boardWidthMm: 140,
  wastePercent: 10,
});
const skirtQty = calculateDeckSkirtingQuantities({
  facts: liveFacts(),
  workAreaId: LIVE_ID,
  lengthM: 3,
  widthM: 9,
  areaM2: 27,
  deckHeightM: 1.2,
  boardWidthMm: 140,
  wastePercent: 10,
});
check(
  "2 ordinary fascia does not create skirting",
  skirtLines.length === 0 &&
    Math.abs(fasciaQty.fasciaNetLm - 24) < 0.05 &&
    skirtQty.skirtingNetLm > fasciaQty.fasciaNetLm
);
const withSkirt = calculateDeck(
  ctx([...liveFacts(), fact(DECK_SKIRTING_INCLUDED_FACT_KEY, LIVE_ID, true)]),
  wa(LIVE_ID)
);
check(
  "3 skirting explicit only",
  line(withSkirt.lineItems, DECK_SKIRTING_BUILDER_LABEL) != null &&
    skirtLines.length === 0
);
check(
  "4 builder copy is unambiguous",
  read("lib/scopes/templates/deck.ts").includes("Fascia / edge boards") &&
    read("lib/scopes/templates/deck.ts").includes(
      "Is full-height deck skirting / screening included?"
    ) &&
    !read("lib/scopes/templates/deck.ts").includes(
      "Deck skirting / vertical face cladding included?"
    ) &&
    read("lib/scopes/templates/deck.ts").includes("Fascia / edge-board length")
);
check(
  "5 no duplicate fascia money",
  fasciaLines.length === 1 &&
    fasciaLines.filter((item) => item.category === "materials").length === 1
);

console.log("\n== CONCRETE ==");
check(
  "6 detailed Deck concrete labour uses bags",
  concLab?.unit === "bag" &&
    concLab?.quantity === 54 &&
    purchasedConcreteBags(18, 3) === 54
);
check(
  "7 hole h/productivity no longer owns detailed money",
  concLab?.unit !== "hole" &&
    DECK_CONCRETE_PRODUCTIVITY_KEY.includes("hours_per_bag") &&
    hasIncompatibleLegacyConcreteHoleRate(liveRates()) &&
    resolveDeckConcretePlaceProductivity(liveRates()).hoursPerUnit ===
      DECK_CONCRETE_PLACE_HOURS_PER_BAG
);
const moreBags = calculateDeck(
  ctx(liveFacts([fact("deck.concrete_bags_per_hole", LIVE_ID, 4)])),
  wa(LIVE_ID)
);
const moreBagsLab = line(moreBags.lineItems, DECK_CONCRETE_PLACE_LABEL);
const moreBagsMat = line(moreBags.lineItems, DECK_CONCRETE_MATERIAL_LABEL);
check(
  "8 changing bags changes labour",
  (moreBagsLab?.quantity ?? 0) > (concLab?.quantity ?? 0) &&
    (moreBagsLab?.labourHours ?? 0) > (concLab?.labourHours ?? 0) &&
    (moreBagsMat?.quantity ?? 0) > (concMat?.quantity ?? 0)
);
check(
  "9 same bag qty preserves labour independent of hole grouping",
  purchasedConcreteBags(18, 3) === 54 &&
    purchasedConcreteBags(27, 2) === 54 &&
    concLab?.quantity === 54 &&
    concLab?.unit === "bag" &&
    Math.abs((concLab?.labourHours ?? 0) - round2(54 * DECK_CONCRETE_PLACE_HOURS_PER_BAG)) <
      0.03
);
const companyBag = calculateDeck(
  ctx(liveFacts(), {
    rates: liveRates([
      productivityOrgRate(DECK_CONCRETE_PRODUCTIVITY_KEY, "bag", 0.2),
    ]),
  }),
  wa(LIVE_ID)
);
const companyBagLab = line(companyBag.lineItems, DECK_CONCRETE_PLACE_LABEL);
check(
  "10 company h/bag override wins",
  Math.abs((companyBagLab?.labourHours ?? 0) - round2(54 * 0.2)) < 0.03 &&
    (companyBagLab?.labourHours ?? 0) !== (concLab?.labourHours ?? 0)
);
check(
  "11 legacy h/hole not reinterpreted",
  resolveDeckConcretePlaceProductivity([
    productivityOrgRate(DECK_CONCRETE_PRODUCTIVITY_HOLE_LEGACY_KEY, "hole", 0.4),
  ]).hoursPerUnit === DECK_CONCRETE_PLACE_HOURS_PER_BAG &&
    resolveDeckConcretePlaceProductivity([
      productivityOrgRate(DECK_CONCRETE_PRODUCTIVITY_KEY, "hole", 0.4),
    ]).hoursPerUnit === DECK_CONCRETE_PLACE_HOURS_PER_BAG
);
check(
  "12 material bags unchanged by productivity",
  concMat?.quantity === 54 &&
    line(companyBag.lineItems, DECK_CONCRETE_MATERIAL_LABEL)?.quantity === 54 &&
    Math.abs((concMat?.recommendedCost ?? 0) - 54 * 9.5) < 0.05
);

console.log("\n== STEP INFORMATION ==");
const stepsAssumed = calculateDeckStepsQuantities({
  facts: liveFacts(),
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
});
const stepsKnown = calculateDeckStepsQuantities({
  facts: liveFacts([fact("deck.step_going_m", LIVE_ID, 0.3)]),
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
});
const stepsBlocked = calculateDeckStepsQuantities({
  facts: liveFacts(),
  workAreaId: LIVE_ID,
  deckHeightM: 0.14,
  wastePercent: 10,
  assumeGoingIfMissing: false,
});
check(
  "13 tread depth resolution is explicit",
  stepsAssumed?.goingResolution === "ASSUMED" &&
    stepsKnown?.goingResolution === "KNOWN" &&
    stepsBlocked?.goingResolution === "INFORMATION_REQUIRED"
);
const knownGoingDeck = calculateDeck(
  ctx(liveFacts([fact("deck.step_going_m", LIVE_ID, 0.28)])),
  wa(LIVE_ID)
);
check(
  "14 known tread depth resolves quantity",
  (line(knownGoingDeck.lineItems, "Step decking")?.identitySummary ?? "")
    .toLowerCase()
    .includes("required")
);
check(
  "15 disclosed assumption resolves quantity if allowed",
  stepsAssumed?.goingDefaulted === true &&
    Math.abs((stepsAssumed?.goingM ?? 0) - DEFAULT_STEP_GOING_M) < 0.001 &&
    (stepDeck?.identitySummary ?? "").toLowerCase().includes("required") &&
    live.assumptions.some((row) => /stair tread depth 280 mm/i.test(row))
);
check(
  "16 unresolved required geometry cannot silently emit unexplained money",
  stepsBlocked?.goingResolution === "INFORMATION_REQUIRED" &&
    !detailedMoneyAllowed(stepsBlocked.goingResolution) &&
    (stepDeck == null ||
      ((stepDeck.recommendedCost ?? 0) > 0 &&
        /required/i.test(stepDeck.identitySummary ?? "") &&
        /lm/i.test(stepDeck.identitySummary ?? "")))
);
check(
  "17 step decking required qty visible",
  /required/i.test(stepDeck?.identitySummary ?? "") &&
    /6(\.0)? lm required/i.test(stepDeck?.identitySummary ?? "")
);
check(
  "18 step purchased qty visible",
  /purchased/i.test(stepDeck?.identitySummary ?? "") &&
    /6\.6 lm purchased/i.test(stepDeck?.identitySummary ?? "")
);
check(
  "19 waste material only",
  /10% waste/i.test(stepDeck?.identitySummary ?? "") &&
    !(stepLab?.identitySummary ?? "").toLowerCase().includes("waste")
);
check(
  "20 step labour consumes resolved geometry",
  stepLab != null &&
    Math.abs((stepLab.quantity ?? 0) - (stepsAssumed?.treadAreaM2 ?? 0)) < 0.02 &&
    (stepLab.notes ?? "").includes("280 mm assumed")
);
const deeper = calculateDeck(
  ctx(liveFacts([fact("deck.step_going_m", LIVE_ID, 0.35)])),
  wa(LIVE_ID)
);
check(
  "21 changing tread depth updates dependent requirements",
  (line(deeper.lineItems, "Step decking")?.quantity ?? 0) >
    (stepDeck?.quantity ?? 0) &&
    (line(deeper.lineItems, "Step installation")?.labourHours ?? 0) >
      (stepLab?.labourHours ?? 0) &&
    (line(deeper.lineItems, "Step framing")?.quantity ?? 0) >
      (stepFraming?.quantity ?? 0)
);
const liveReview = composeBuilderReview({
  estimate: {
    recommendedCost: live.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
    recommendedSell: live.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    marginPercent: 20,
    confidence: 0.7,
    assumptions: live.assumptions,
    missingInfo: live.missingInfo,
    lineItems: mapCalcLines(live.lineItems),
  },
  workAreas: [{ id: LIVE_ID, name: "Deck", type: "deck", status: "confirmed" }],
  requirements: live.requirements ?? [],
});
const jobPlan = composeJobPlan({
  workAreas: [wa(LIVE_ID)],
  facts: liveFacts(),
  constraints: [],
  briefText: "3m x 9m Kwila deck with steps",
});
const refine = composeRefineView({
  workAreas: [wa(LIVE_ID)],
  facts: liveFacts(),
  constraints: [],
  briefText: "3m x 9m Kwila deck with steps",
  qualityLevel: "standard",
  jobPlan,
});
check(
  "22 Improve/check appears when appropriate",
  live.assumptions.some((row) => /assuming stair tread depth 280 mm/i.test(row)) &&
    refine.highValue.some((row) => row.factKey === "deck.step_going_m") &&
    (liveReview.improvements.some((row) =>
      /confirm stair tread depth/i.test(row.label)
    ) ||
      liveReview.assumptions.some((row) => /tread depth/i.test(row.label)))
);
check(
  "live stair width is not the unstated 9 m deck edge",
  stepsAssumed?.widthResolution === "ASSUMED" &&
    stepsAssumed?.widthM === 1 &&
    live.assumptions.some((row) =>
      /assuming 1\.0 m step width/i.test(row)
    )
);

console.log("\n== GLOBAL QUALITY ==");
const known = resolvePhysicalRequirement({
  knownValue: 0.3,
  assumptionAllowed: true,
  assumptionValue: 0.28,
});
const assumed = resolvePhysicalRequirement({
  knownValue: null,
  assumptionAllowed: true,
  assumptionValue: 0.28,
});
const required = resolvePhysicalRequirement({
  knownValue: null,
  assumptionAllowed: false,
  assumptionValue: 0.28,
});
check(
  "23 required detailed physical driver has resolution status",
  known.resolution === PHYSICAL_REQUIREMENT_RESOLUTION.KNOWN &&
    assumed.resolution === PHYSICAL_REQUIREMENT_RESOLUTION.ASSUMED &&
    required.resolution === PHYSICAL_REQUIREMENT_RESOLUTION.INFORMATION_REQUIRED
);
check(
  "24 silent unknown + money invariant blocked",
  !detailedMoneyAllowed(required.resolution) &&
    detailedMoneyAllowed(assumed.resolution) &&
    detailedMoneyAllowed(known.resolution)
);
const noStepsRefine = composeRefineView({
  workAreas: [wa(LIVE_ID)],
  facts: liveFacts().filter((row) => row.key !== DECK_STEPS_INCLUDED_FACT_KEY),
  constraints: [],
  briefText: "3m x 9m Kwila deck",
  qualityLevel: "standard",
  jobPlan: composeJobPlan({
    workAreas: [wa(LIVE_ID)],
    facts: liveFacts().filter((row) => row.key !== DECK_STEPS_INCLUDED_FACT_KEY),
    constraints: [],
    briefText: "3m x 9m Kwila deck",
  }),
});
check(
  "25 no mass Clarify regression",
  !noStepsRefine.highValue.some((row) => row.factKey === "deck.step_going_m") &&
    !noStepsRefine.highValue.some((row) => row.factKey === "deck.step_width_m")
);

console.log("\n== PRESENTATION ==");
const deckingLab = line(live.lineItems, "Decking installation");
const persisted = parseLineItemNotes(buildLineItemNotes(concLab!));
const labourPriced = toPricedLine(mapCalcLines([concLab!])[0]!);
check(
  "26 primary labour row concise",
  (concLab?.identitySummary ?? "").includes("54 bag") &&
    (concLab?.identitySummary ?? "").includes("h/bag") &&
    !(concLab?.identitySummary ?? "").includes("Physical driver") &&
    (persisted.metadata.identitySummary ?? "").includes("h/bag") &&
    (labourPriced.supporting ?? "").includes("h/bag")
);
check(
  "27 Physical driver prose moved to details",
  (concLab?.notes ?? "").includes("Physical driver") &&
    (labourPriced.detail ?? "").includes("Physical driver") &&
    !(labourPriced.supporting ?? "").includes("Physical driver")
);
check(
  "28 no No access/carry adjustment primary noise",
  !(concLab?.identitySummary ?? "").includes("No access/carry adjustment") &&
    !(deckingLab?.identitySummary ?? "").includes("No access/carry adjustment") &&
    (concLab?.notes ?? "").includes("No Project Condition adjustment")
);
check(
  "29 no raw floats",
  !(JSON.stringify(live.lineItems).includes("1.1500000000000001")) &&
    !(concLab?.identitySummary ?? "").includes("0.160000")
);
check(
  "30 expanded details retain provenance",
  (concLab?.notes ?? "").includes("Excludes hole excavation") &&
    (concLab?.notes ?? "").includes("h/bag") &&
    (deckingLab?.notes ?? "").includes("Waste is procurement")
);

console.log("\n== BRIEF / COPY ==");
const fasciaBrief = buildMinimalExtractionFromBrief(
  "Build a kwila deck with vertical boards down the side.",
  ["deck"]
);
const skirtBrief = buildMinimalExtractionFromBrief(
  "Build a kwila deck and close in underneath the deck.",
  ["deck"]
);
check(
  "brief ambiguous vertical boards maps to fascia not skirting",
  fasciaBrief.facts.some(
    (row) => row.key === "deck.vertical_face_boards_required" && row.value === true
  ) &&
    !fasciaBrief.facts.some((row) => row.key === "deck.skirting_included")
);
check(
  "brief full-height language maps to skirting",
  skirtBrief.facts.some(
    (row) => row.key === "deck.skirting_included" && row.value === true
  )
);
check(
  "live material presentation still shows required/purchased",
  (line(live.lineItems, "Decking")?.identitySummary ?? "")
    .toLowerCase()
    .includes("required") &&
    (line(live.lineItems, DECK_FASCIA_BUILDER_LABEL)?.identitySummary ?? "")
      .includes("24.0 lm required")
);
check(
  "live concrete 54 bags × 0.16 h/bag",
  concLab?.quantity === 54 &&
    Math.abs((concLab?.labourHours ?? 0) - round2(54 * 0.16)) < 0.03
);

console.log("\n== REGRESSION SPAWNS ==");
if (process.env.DECK_R8_SKIP_SPAWN === "1") {
  console.log("skipped nested spawns (DECK_R8_SKIP_SPAWN=1)");
} else {
  check("31 Deck R7 >=83/0", spawnR7());
  check("33 Fence 1A >=157/0", spawnFence("scripts/verify-fence-maturity-1a.ts", 157));
  check("34 Fence 1B >=82/0", spawnFence("scripts/verify-fence-maturity-1b.ts", 82));
  const spawns: [string, string][] = [
    ["32 Deck 2A", "scripts/verify-deck-maturity-2a.ts"],
    ["32 Deck 2B", "scripts/verify-deck-maturity-2b.ts"],
    ["32 Deck 2C", "scripts/verify-deck-maturity-2c.ts"],
    ["32 Deck 2D", "scripts/verify-deck-maturity-2d.ts"],
    ["35 RW R6", "scripts/verify-retaining-wall-post-concrete-r6.ts"],
    ["36 RW family closure", "scripts/verify-retaining-wall-family-closure-01.ts"],
    ["36 RW family coverage", "scripts/verify-retaining-wall-family-coverage-01.ts"],
    ["37 Estimator Safety", "scripts/verify-estimator-safety-0.ts"],
    ["38 Recovery 1", "scripts/verify-recovery-1-commercial-authority.ts"],
    ["Recovery 3", "scripts/verify-recovery-3-job-plan.ts"],
    ["Recovery 4", "scripts/verify-recovery-4-clarify.ts"],
    ["Recovery 4 R2", "scripts/verify-recovery-4-r2-estimate-readiness.ts"],
    ["Recovery 5A", "scripts/verify-recovery-5a-assistant-modes.ts"],
    ["Recovery 5B BR", "scripts/verify-recovery-5b-builder-review.ts"],
    ["Recovery 5B R3", "scripts/verify-recovery-5b-r3-estimate-experience.ts"],
    ["UX Premium", "scripts/verify-ux-premium-01.ts"],
    ["38 Commercial", "scripts/verify-commercial-p0-authority-lock.ts"],
    ["cost-first", "scripts/verify-cost-first-rates.ts"],
    ["Rates", "scripts/verify-material-rates.ts"],
    ["39 Pricing", "scripts/verify-pricing-ownership.ts"],
    ["40 Quote", "scripts/verify-quote-safety.ts"],
    ["41 Foundation", "scripts/verify-foundation-r1-project-conditions-support.ts"],
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
  console.log(`\nDECK-R8  ${passed} passed / ${failed} failed`);
  process.exit(1);
}
console.log(`\nDECK-R8  ${passed} passed / 0 failed`);
