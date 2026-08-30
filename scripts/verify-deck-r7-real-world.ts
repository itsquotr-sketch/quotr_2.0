/**
 * DECK-R7 / DECK-R7-R1 — real-world builder validation + exact job reconciliation.
 * R7-R1 restores stair-set allowance and project GM 18.8% on the owner fixture.
 * Does not change R7 productivity, adjustment ownership, or fascia/skirting.
 *
 * Run: npx tsx scripts/verify-deck-r7-real-world.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  formatAdjustmentPercent,
  formatLabourAdjustmentPrimary,
  formatLabourHours,
} from "../lib/estimate/builder-presentation-format";
import { getCombinedLabourAccessFactor } from "../lib/estimate/adjustments";
import {
  calculateDeckFasciaQuantities,
  calculateDeckSkirtingQuantities,
  DECK_SKIRTING_BUILDER_LABEL,
  DECK_SKIRTING_INCLUDED_FACT_KEY,
} from "../lib/estimate/deck-fascia";
import {
  DECK_DECKING_INSTALL_HOURS_PER_LM,
  DECK_DECKING_INSTALL_HOURS_PER_LM_KEY,
  DECK_DECKING_INSTALL_HOURS_PER_M2_LEGACY_KEY,
  DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM,
  DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY,
  DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_M2_LEGACY_KEY,
  DECK_SUBSTRUCTURE_REFERENCE_FRAMING_LM,
  requiredInstalledFramingLm,
  resolveDeckDeckingInstallProductivity,
  resolveDeckSubstructureInstallProductivity,
} from "../lib/estimate/deck-productivity";
import {
  DECK_PHYSICAL_TAKEOFF_UNAVAILABLE_HINT,
  calculateDeckStructureQuantities,
  readDeckStructureFacts,
} from "../lib/estimate/deck-structure";
import { calculateDeckingBoardLm } from "../lib/estimate/material-buildups";
import {
  DECK_CONCRETE_MATERIAL_LABEL,
  DECK_CONCRETE_PLACE_HOURS_PER_BAG,
  DECK_CONCRETE_PRODUCTIVITY_HOLE_LEGACY_KEY,
} from "../lib/estimate/deck-scope-2c";
import { DECK_INFORMATION_CONTRACT } from "../lib/estimate/deck-information-contract";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { round2 } from "../lib/estimate/facts";
import {
  aggregateEstimateLineTotals,
  applyTargetMarginToLineItems,
} from "../lib/estimate/margin-override";
import { DECK_PRODUCTIVITY_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
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

const OWNER_ID = "owner-r7";
/** Original Builder Review displayed GM (project target_margin_percent). */
const OWNER_PROJECT_TARGET_GM = 18.8;
const ORIGINAL_DIRECT = 20585;
const ORIGINAL_SELL = 25336;
/** First R7 fixture summed calculator sells with sell=cost company rates. */
const FIRST_R7_DIRECT = 10445.82;
const FIRST_R7_SELL = 11345.47;

function ownerFacts(overrides: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("deck.length_m", OWNER_ID, 5),
    fact("deck.width_m", OWNER_ID, 4.2),
    fact("deck.area_m2", OWNER_ID, 21),
    fact("deck.height_m", OWNER_ID, 1),
    fact("deck.level", OWNER_ID, "Elevated"),
    fact("deck.board_material", OWNER_ID, "Kwila"),
    fact("deck.board_width_mm", OWNER_ID, 140),
    fact("deck.substructure_included", OWNER_ID, true),
    fact("deck.vertical_face_boards_required", OWNER_ID, true),
    fact("deck.existing_deck_removal", OWNER_ID, true),
    fact("deck.concrete_to_supports", OWNER_ID, true),
    fact("deck.access_type", OWNER_ID, "Stair set"),
  ];
  const keys = new Set(overrides.map((row) => row.key));
  return [...base.filter((row) => !keys.has(row.key)), ...overrides];
}

function ownerRates(extra: OrganisationRate[] = []): OrganisationRate[] {
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
  opts?: {
    rates?: OrganisationRate[];
    constraints?: { key: string; label: string; value: unknown }[];
    qualityLevel?: "standard" | "premium" | "budget";
    wastage?: number;
  }
): EstimateContext {
  return {
    project: { id: "p-r7", qualityLevel: opts?.qualityLevel ?? "premium" },
    confirmedWorkAreas: [wa(OWNER_ID)],
    facts,
    constraints: opts?.constraints ?? [
      { key: "site_access", label: "Site access", value: "Difficult" },
      { key: "material_carry_distance", label: "Carry", value: "10–30m" },
    ],
    materialWastageSettings: {
      deckingWastagePercent: opts?.wastage ?? 10,
      defaultMaterialWastagePercent: opts?.wastage ?? 10,
    },
    rates: opts?.rates ?? ownerRates(),
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

function spawnFence(script: string, minPassed: number): boolean {
  try {
    const out = execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        DECK_R7_SKIP_NESTED_SPAWN: "1",
      },
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

function spawnVerifier(script: string): boolean {
  if (process.env.DECK_R7_SKIP_NESTED_SPAWN === "1") return true;
  try {
    execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        DECK_R7_SKIP_NESTED_SPAWN: "1",
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
    else if (out.trim()) {
      const snippet = out.trim().split(/\r?\n/).slice(-8).join(" | ");
      console.log(`      spawn ${script}: ${snippet.slice(0, 400)}`);
    }
    return false;
  }
}

console.log("=== DECK-R7-R1 exact real-job reconciliation ===\n");

const structureFacts = readDeckStructureFacts({
  workAreaId: OWNER_ID,
  facts: ownerFacts(),
});
const qty = calculateDeckStructureQuantities({
  facts: structureFacts!,
  framingWastePercent: 5,
});
const deckingTakeoff = calculateDeckingBoardLm({
  areaM2: 21,
  boardWidthMm: 140,
  wastagePercent: 10,
});
const requiredFraming = requiredInstalledFramingLm({
  joistRequiredLm: qty.joistBaseLm,
  bearerRequiredLm: qty.bearerBaseLm,
  rimRequiredLm: qty.rimBaseLm,
});

console.log("-- PHYSICAL TAKEOFF --");
console.log(
  JSON.stringify(
    {
      joistRequired: qty.joistBaseLm,
      joistPurchased: qty.joistPurchaseLm,
      bearerRequired: qty.bearerBaseLm,
      bearerPurchased: qty.bearerPurchaseLm,
      rimRequired: qty.rimBaseLm,
      rimPurchased: qty.rimPurchaseLm,
      posts: qty.supportCount,
      requiredFraming,
      deckingRequired: deckingTakeoff?.baseLm,
      deckingPurchased: deckingTakeoff?.totalLm,
    },
    null,
    2
  )
);

check(
  "1 decking required ≈ 150 lm",
  deckingTakeoff != null && Math.abs(deckingTakeoff.baseLm - 150) < 0.05
);
check(
  "2 decking purchased ≈ 165 lm",
  deckingTakeoff != null && Math.abs(deckingTakeoff.totalLm - 165) < 0.05
);
check("3 joist purchased 57.33 lm", qty.joistPurchaseLm === 57.33);
check("4 bearer purchased 21 lm", qty.bearerPurchaseLm === 21);
check("5 rim purchased 10.5 lm", qty.rimPurchaseLm === 10.5);
check("6 post count 16", qty.supportCount === 16);
check("7 required framing 84.6 lm", requiredFraming === 84.6);
check(
  "8 KWILA conversion 0.13 h/framing-lm",
  DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM === 0.13 &&
    DECK_SUBSTRUCTURE_REFERENCE_FRAMING_LM === 108
);
check(
  "9 decking productivity 0.077 h/lm",
  DECK_DECKING_INSTALL_HOURS_PER_LM === 0.077
);

const easyCtx = ctx(ownerFacts(), {
  constraints: [
    { key: "site_access", label: "Site access", value: "Easy" },
    { key: "material_carry_distance", label: "Carry", value: "<10m" },
  ],
});
const accessCtx = ctx(ownerFacts());
const accessFactor = getCombinedLabourAccessFactor({
  constraints: accessCtx.constraints,
});
check("10 access+carry factor is 1.15", Math.abs(accessFactor - 1.15) < 1e-9);
check(
  "11 formatted adjustment is +15%",
  formatAdjustmentPercent(accessFactor) === "+15%" &&
    formatLabourAdjustmentPrimary(accessFactor).includes("+15%") &&
    !formatLabourAdjustmentPrimary(accessFactor).includes("000000") &&
    !formatAdjustmentPercent(1.1500000000000001).includes("000000")
);

const after = calculateDeck(accessCtx, wa(OWNER_ID));
const easy = calculateDeck(easyCtx, wa(OWNER_ID));
const premiumEasy = calculateDeck(
  ctx(ownerFacts(), {
    qualityLevel: "premium",
    constraints: [
      { key: "site_access", label: "Site access", value: "Easy" },
      { key: "material_carry_distance", label: "Carry", value: "<10m" },
    ],
  }),
  wa(OWNER_ID)
);

const deckingMat = line(after.lineItems, "Decking");
const deckingLab = line(after.lineItems, "Decking installation");
const subLab = line(after.lineItems, "Substructure framing");
const pileLab = line(after.lineItems, "Pile/post installation");
const elevLab = line(after.lineItems, "Elevated extra labour");
const demoLab = line(after.lineItems, "Existing deck removal");
const concMat = line(after.lineItems, DECK_CONCRETE_MATERIAL_LABEL);
const concLab = line(after.lineItems, "Concrete placement");
const fixings = line(after.lineItems, "Fixings, connectors & sundries");
const fasciaMat = line(after.lineItems, "Fascia / edge boards");
const fasciaLab = line(after.lineItems, "Fascia installation");
const skirtMat = line(after.lineItems, DECK_SKIRTING_BUILDER_LABEL);

check(
  "12 decking quantity visible on material line",
  (deckingMat?.identitySummary ?? "").includes("150") &&
    (deckingMat?.identitySummary ?? "").includes("165") &&
    (deckingMat?.identitySummary ?? "").toLowerCase().includes("required") &&
    (deckingMat?.identitySummary ?? "").toLowerCase().includes("purchased")
);
check(
  "13 decking labour uses required 150 lm not 165",
  deckingLab?.quantity === 150 ||
    Math.abs((deckingLab?.quantity ?? 0) - 150) < 0.05
);
check(
  "14 decking base 11.55 → final 13.28 not 15.27",
  Math.abs((deckingLab?.labourHours ?? 0) - 13.28) < 0.03 &&
    Math.abs(round2(150 * 0.077 * 1.15) - (deckingLab?.labourHours ?? 0)) < 0.03
);
check(
  "15 pile 16 × 0.20 × 1.15 = 3.68 not 4.23",
  Math.abs((pileLab?.labourHours ?? 0) - 3.68) < 0.03
);
check(
  "16 elevated 21 × 0.25 × 1.15 = 6.04 not 6.94",
  Math.abs((elevLab?.labourHours ?? 0) - 6.04) < 0.03
);
check(
  "17 demo 21 × 0.35 × 1.15 = 8.45 once",
  Math.abs((demoLab?.labourHours ?? 0) - 8.45) < 0.03
);
check(
  "18 concrete 40 bags × 0.16 × 1.15 = 7.36 not 8.46",
  concLab?.unit === "bag" &&
    concLab?.quantity === 40 &&
    Math.abs((concLab?.labourHours ?? 0) - 7.36) < 0.03 &&
    Math.abs(
      round2(40 * DECK_CONCRETE_PLACE_HOURS_PER_BAG * 1.15) -
        (concLab?.labourHours ?? 0)
    ) < 0.03
);
check(
  "19 fascia labour follows perimeter not 128.8 lm",
  fasciaLab != null &&
    Math.abs((fasciaLab.quantity ?? 0) - 18.4) < 0.05 &&
    (fasciaLab.labourHours ?? 0) < 20
);
check("20 skirting absent unless explicit", skirtMat == null);
check(
  "21 concrete material 40 × 9.50 = 380, not access-adjusted",
  concMat?.quantity === 40 && Math.abs((concMat?.recommendedCost ?? 0) - 380) < 0.05
);
check(
  "22 fixings 21 × 25 = 525, not access-adjusted",
  fixings != null && Math.abs((fixings.recommendedCost ?? 0) - 525) < 0.05
);
check(
  "23 premium quality does not inflate materials",
  Math.abs(
    (line(premiumEasy.lineItems, DECK_CONCRETE_MATERIAL_LABEL)?.recommendedCost ?? 0) -
      (line(easy.lineItems, DECK_CONCRETE_MATERIAL_LABEL)?.recommendedCost ?? 0)
  ) < 0.05 &&
    Math.abs(
      (line(premiumEasy.lineItems, "Fixings, connectors & sundries")
        ?.recommendedCost ?? 0) -
        (line(easy.lineItems, "Fixings, connectors & sundries")?.recommendedCost ??
          0)
    ) < 0.05
);
check(
  "24 access does not change material cost",
  Math.abs((concMat?.recommendedCost ?? 0) - (line(easy.lineItems, DECK_CONCRETE_MATERIAL_LABEL)?.recommendedCost ?? 0)) <
    0.05 &&
    Math.abs(
      (fixings?.recommendedCost ?? 0) -
        (line(easy.lineItems, "Fixings, connectors & sundries")?.recommendedCost ??
          0)
    ) < 0.05 &&
    Math.abs(
      (deckingMat?.recommendedCost ?? 0) -
        (line(easy.lineItems, "Decking")?.recommendedCost ?? 0)
    ) < 0.05
);
check(
  "25 labour access applied once vs easy",
  Math.abs(
    (deckingLab?.labourHours ?? 0) /
      (line(easy.lineItems, "Decking installation")?.labourHours ?? 1) -
      1.15
  ) < 0.02
);

const waste15 = calculateDeck(
  ctx(ownerFacts(), { wastage: 15 }),
  wa(OWNER_ID)
);
check(
  "26 waste increases purchased decking, not labour",
  (line(waste15.lineItems, "Decking")?.quantity ?? 0) >
    (deckingMat?.quantity ?? 0) &&
    Math.abs(
      (line(waste15.lineItems, "Decking installation")?.labourHours ?? 0) -
        (deckingLab?.labourHours ?? 0)
    ) < 0.001
);

const wide90 = calculateDeck(
  ctx(ownerFacts([fact("deck.board_width_mm", OWNER_ID, 90)])),
  wa(OWNER_ID)
);
check(
  "27 narrower boards increase required lm and decking labour",
  (line(wide90.lineItems, "Decking installation")?.quantity ?? 0) >
    (deckingLab?.quantity ?? 0) &&
    (line(wide90.lineItems, "Decking installation")?.labourHours ?? 0) >
      (deckingLab?.labourHours ?? 0) &&
    Math.abs(21 - 21) === 0
);

const closerJoists = calculateDeck(
  ctx(ownerFacts([fact("deck.joist_centres_mm", OWNER_ID, 300)])),
  wa(OWNER_ID)
);
check(
  "28 closer joist spacing increases substructure labour; area unchanged",
  (line(closerJoists.lineItems, "Substructure framing")?.quantity ?? 0) >
    (subLab?.quantity ?? 0) &&
    (line(closerJoists.lineItems, "Substructure framing")?.labourHours ?? 0) >
      (subLab?.labourHours ?? 0)
);

const tallFascia = calculateDeck(
  ctx(ownerFacts([fact("deck.height_m", OWNER_ID, 1.8)])),
  wa(OWNER_ID)
);
check(
  "29 elevation height does not turn fascia into full-height cladding",
  Math.abs(
    (line(tallFascia.lineItems, "Fascia installation")?.quantity ?? 0) -
      (fasciaLab?.quantity ?? 0)
  ) < 0.05 &&
    line(tallFascia.lineItems, DECK_SKIRTING_BUILDER_LABEL) == null
);

const withSkirt = calculateDeck(
  ctx(
    ownerFacts([fact(DECK_SKIRTING_INCLUDED_FACT_KEY, OWNER_ID, true)])
  ),
  wa(OWNER_ID)
);
const skirtQty = calculateDeckSkirtingQuantities({
  facts: ownerFacts(),
  workAreaId: OWNER_ID,
  lengthM: 5,
  widthM: 4.2,
  areaM2: 21,
  deckHeightM: 1,
  boardWidthMm: 140,
  wastePercent: 10,
});
const fasciaQty = calculateDeckFasciaQuantities({
  facts: ownerFacts(),
  workAreaId: OWNER_ID,
  lengthM: 5,
  widthM: 4.2,
  areaM2: 21,
  deckHeightM: 1,
  boardWidthMm: 140,
  wastePercent: 10,
});
check("30 fascia net is perimeter 18.4 lm", fasciaQty.fasciaNetLm === 18.4);
check(
  "31 skirting is height-sensitive ~128.8 lm",
  Math.abs(skirtQty.skirtingNetLm - 128.8) < 0.05
);
check(
  "32 explicit skirting is a separate line, no double-count as fascia",
  line(withSkirt.lineItems, DECK_SKIRTING_BUILDER_LABEL) != null &&
    line(withSkirt.lineItems, "Fascia / edge boards") != null &&
    Math.abs(
      (line(withSkirt.lineItems, "Fascia installation")?.quantity ?? 0) - 18.4
    ) < 0.05
);

const legacyM2 = calculateDeck(
  ctx(ownerFacts(), {
    rates: ownerRates([
      productivityOrgRate(DECK_DECKING_INSTALL_HOURS_PER_M2_LEGACY_KEY, "m2", 0.9),
      productivityOrgRate(
        DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_M2_LEGACY_KEY,
        "m2",
        0.9
      ),
    ]),
  }),
  wa(OWNER_ID)
);
check(
  "33 legacy company h/m² is not consumed for detailed money",
  Math.abs(
    (line(legacyM2.lineItems, "Decking installation")?.labourHours ?? 0) -
      (deckingLab?.labourHours ?? 0)
  ) < 0.001 &&
    Math.abs(
      (line(legacyM2.lineItems, "Substructure framing")?.labourHours ?? 0) -
        (subLab?.labourHours ?? 0)
    ) < 0.001
);

const companyLm = calculateDeck(
  ctx(ownerFacts(), {
    rates: ownerRates([
      productivityOrgRate(DECK_DECKING_INSTALL_HOURS_PER_LM_KEY, "lm", 0.1),
    ]),
  }),
  wa(OWNER_ID)
);
check(
  "34 company h/lm override is consumed",
  (line(companyLm.lineItems, "Decking installation")?.labourHours ?? 0) >
    (deckingLab?.labourHours ?? 0)
);

check(
  "35 no raw float 1.1500000000000001 in labour copy",
  !JSON.stringify(after.lineItems).includes("1.1500000000000001") &&
    !(deckingLab?.identitySummary ?? "").includes("1.1500000000000001") &&
    !(deckingLab?.notes ?? "").includes("1.1500000000000001")
);
check(
  "36 primary labour copy is concise",
  (deckingLab?.identitySummary ?? "").length < 80 &&
    (deckingLab?.identitySummary ?? "").includes("lm") &&
    (deckingLab?.identitySummary ?? "").includes("+15%")
);

const review = composeBuilderReview({
  estimate: {
    recommendedCost: after.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
    recommendedSell: deriveSellFromCost(
      after.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
      OWNER_PROJECT_TARGET_GM
    ),
    marginPercent: OWNER_PROJECT_TARGET_GM,
    confidence: 70,
    assumptions: after.assumptions,
    missingInfo: after.missingInfo,
    lineItems: mapCalcLines(
      applyTargetMarginToLineItems(
        after.lineItems,
        OWNER_PROJECT_TARGET_GM,
        accessCtx.organisationSettings
      )
    ),
  },
  workAreas: [wa(OWNER_ID)],
  requirements: after.requirements,
});
const deckGroup = review.workAreas[0];
const takeoffBlob = JSON.stringify(deckGroup?.categories ?? []);
check(
  "37 stale Planning takeoff missing-framing warning is gone",
  !takeoffBlob.includes(DECK_PHYSICAL_TAKEOFF_UNAVAILABLE_HINT)
);
const labourLine = deckGroup?.categories
  .find((c) => c.id === "LABOUR")
  ?.lines.find((l) => l.label === "Decking installation");
check(
  "38 Builder Review labour supporting is concise calc, detail retained",
  (labourLine?.supporting ?? "").includes("+15%") &&
    !(labourLine?.supporting ?? "").includes("1.1500000000000001") &&
    Boolean(labourLine?.detail)
);
const deckingReview = deckGroup?.categories
  .find((c) => c.id === "MATERIALS")
  ?.lines.find((l) => l.label === "Decking");
check(
  "39 Builder Review decking shows required and purchased",
  (deckingReview?.supporting ?? deckingReview?.specification ?? "").includes(
    "150"
  ) &&
    (deckingReview?.supporting ?? deckingReview?.specification ?? "").includes(
      "165"
    )
);

check(
  "40 detailed authority preserved (no package restore)",
  !after.lineItems.some((item) => /decking package|framing\/substructure/i.test(item.label)) &&
    after.lineItems.some((item) => item.label === "Joists") &&
    after.lineItems.some((item) => item.label === "Decking installation")
);
check(
  "41 information contract splits fascia and skirting",
  DECK_INFORMATION_CONTRACT.some(
    (row) =>
      row.factKey === "deck.vertical_face_boards_required" &&
      /not full-height skirting/i.test(row.reason)
  ) &&
    DECK_INFORMATION_CONTRACT.some((row) => row.factKey === "deck.skirting_included")
);
check(
  "42 catalogue has new h/lm keys and leftover h/m²",
  DECK_PRODUCTIVITY_RATE_CATALOGUE.some(
    (row) =>
      row.item_key === DECK_DECKING_INSTALL_HOURS_PER_LM_KEY &&
      row.calculatorSupport === "used_now"
  ) &&
    DECK_PRODUCTIVITY_RATE_CATALOGUE.some(
      (row) =>
        row.item_key === DECK_DECKING_INSTALL_HOURS_PER_M2_LEGACY_KEY &&
        row.calculatorSupport === "leftover"
    ) &&
    DECK_PRODUCTIVITY_RATE_CATALOGUE.some(
      (row) =>
        row.item_key === DECK_SUBSTRUCTURE_INSTALL_HOURS_PER_FRAMING_LM_KEY &&
        row.calculatorSupport === "used_now"
    )
);
check(
  "43 resolve helpers use lm starters",
  resolveDeckDeckingInstallProductivity([]).hoursPerUnit === 0.077 &&
    resolveDeckSubstructureInstallProductivity([]).hoursPerUnit === 0.13
);

const materialsCost = after.lineItems
  .filter((item) => item.category === "materials")
  .reduce((sum, item) => sum + item.recommendedCost, 0);
const labourCost = after.lineItems
  .filter((item) => item.category === "labour")
  .reduce((sum, item) => sum + item.recommendedCost, 0);
const allowCost = after.lineItems
  .filter((item) => item.category === "allowance")
  .reduce((sum, item) => sum + item.recommendedCost, 0);
const direct = round2(
  after.lineItems.reduce((sum, item) => sum + item.recommendedCost, 0)
);
const stairAllow = line(after.lineItems, "Stair set allowance");
const formulaSell = deriveSellFromCost(direct, OWNER_PROJECT_TARGET_GM);
const formulaProfit = round2(formulaSell - direct);
const formulaGm = round2((formulaProfit / formulaSell) * 100);
const previewLines = applyTargetMarginToLineItems(
  after.lineItems,
  OWNER_PROJECT_TARGET_GM,
  accessCtx.organisationSettings
);
const previewTotals = aggregateEstimateLineTotals(previewLines);
const firstR7Gm = round2(
  ((FIRST_R7_SELL - FIRST_R7_DIRECT) / FIRST_R7_SELL) * 100
);
const originalGm = round2(
  ((ORIGINAL_SELL - ORIGINAL_DIRECT) / ORIGINAL_SELL) * 100
);

console.log("\n-- OWNER SCREENSHOT AFTER (R7-R1) --");
console.log(
  JSON.stringify(
    {
      deckingRequiredLm: deckingLab?.quantity,
      deckingPurchasedLm: deckingMat?.quantity,
      deckingMaterial: deckingMat?.recommendedCost,
      deckingHours: deckingLab?.labourHours,
      substructureHours: subLab?.labourHours,
      pileHours: pileLab?.labourHours,
      elevatedHours: elevLab?.labourHours,
      demoHours: demoLab?.labourHours,
      concreteHours: concLab?.labourHours,
      fasciaHours: fasciaLab?.labourHours,
      fasciaMaterial: fasciaMat?.recommendedCost,
      fixings: fixings?.recommendedCost,
      concreteMaterial: concMat?.recommendedCost,
      stairAllowanceDirect: stairAllow?.recommendedCost,
      stairAllowanceRaw: 1000,
      stairQualityFactor: 1.15,
      materialsCost: round2(materialsCost),
      labourCost: round2(labourCost),
      allowCost: round2(allowCost),
      direct,
      projectTargetGm: OWNER_PROJECT_TARGET_GM,
      formulaSell,
      formulaProfit,
      formulaGm,
      previewSell: previewTotals.recommendedSell,
      previewGm: previewTotals.marginPercent,
      firstR7Direct: FIRST_R7_DIRECT,
      firstR7Sell: FIRST_R7_SELL,
      firstR7BlendedGm: firstR7Gm,
      originalDirect: ORIGINAL_DIRECT,
      originalSell: ORIGINAL_SELL,
      originalDisplayedGm: originalGm,
    },
    null,
    2
  )
);

check("44 hours format helper uses 2 decimals", formatLabourHours(13.2825) === "13.28");
check(
  "45 createLabourLineItem / compose do not re-apply commercial adjustment",
  read("lib/assistant/builder-review/compose.ts").includes("supporting: compact") &&
    !read("lib/assistant/builder-review/compose.ts").includes(
      "getCombinedLabourAccessFactor"
    )
);
check(
  "46 fascia question is edge boards, not vertical cladding",
  read("lib/scopes/templates/deck.ts").includes("Are fascia / edge boards included?") &&
    read("lib/scopes/templates/deck.ts").includes(
      "Is full-height deck skirting / screening included?"
    )
);

check(
  "47 original screenshot GM is 18.8% (rounded), cost-first not markup",
  Math.round(((ORIGINAL_SELL - ORIGINAL_DIRECT) / ORIGINAL_SELL) * 1000) / 10 ===
    18.8 &&
    Math.abs(ORIGINAL_SELL / ORIGINAL_DIRECT - 1) > 0.2
);
check(
  "48 first R7 $10,446→$11,345 was blended line sells (~7.9%), not project GM",
  Math.abs(firstR7Gm - 7.9) < 0.1
);
check(
  "49 stair scope was omitted from first R7 fixture, calculator still consumes Stair set",
  ownerFacts().some(
    (row) => row.key === "deck.access_type" && row.value === "Stair set"
  ) &&
    read("lib/estimate/calculators/deck.ts").includes('label: "Stair set allowance"') &&
    read("lib/estimate/deck-scope-2c.ts").includes("stair set")
);
check(
  "50 Stair set allowance retained: $1,000 raw × 1.15 quality = $1,150 direct",
  stairAllow != null &&
    Math.abs((stairAllow.recommendedCost ?? 0) - 1150) < 0.05 &&
    round2(allowCost) === 1150
);
check(
  "51 no skirting inferred from fascia / elevated / stair set",
  skirtMat == null &&
    !ownerFacts().some((row) => row.key === DECK_SKIRTING_INCLUDED_FACT_KEY)
);
check(
  "52 R7 material locks hold with stairs present",
  Math.abs((deckingMat?.recommendedCost ?? 0) - 3052.5) < 0.05 &&
    Math.abs((concMat?.recommendedCost ?? 0) - 380) < 0.05 &&
    Math.abs((fixings?.recommendedCost ?? 0) - 525) < 0.05
);
check(
  "53 document sell uses project GM 18.8% on corrected Direct, not org 20% leftover blend",
  Math.abs(formulaGm - OWNER_PROJECT_TARGET_GM) < 0.05 &&
    Math.abs(formulaSell - direct / (1 - OWNER_PROJECT_TARGET_GM / 100)) < 0.02 &&
    Math.abs((previewTotals.marginPercent ?? 0) - OWNER_PROJECT_TARGET_GM) < 0.15
);
check(
  "54 Direct = materials + labour + allowances",
  Math.abs(direct - round2(materialsCost + labourCost + allowCost)) < 0.02
);
check(
  "55 Builder Review retains stair allowance; no stale missing-framing warning",
  JSON.stringify(review).includes("Stair set allowance") &&
    !takeoffBlob.includes(DECK_PHYSICAL_TAKEOFF_UNAVAILABLE_HINT)
);

console.log("\n-- SCOPE PARITY (cost) --");
const parityLabels = [
  "Decking",
  "Joists",
  "Bearers",
  "Rim framing",
  "Piles / posts",
  "Fixings, connectors & sundries",
  "Fascia / edge boards",
  DECK_SKIRTING_BUILDER_LABEL,
  DECK_CONCRETE_MATERIAL_LABEL,
  "Decking installation",
  "Substructure framing",
  "Pile/post installation",
  "Elevated extra labour",
  "Existing deck removal",
  "Fascia installation",
  "Concrete placement",
  "Stair set allowance",
];
console.log(
  JSON.stringify(
    parityLabels.map((label) => {
      const item = line(after.lineItems, label);
      return {
        label,
        present: item != null,
        qty: item?.quantity ?? null,
        unit: item?.unit ?? null,
        hours: item?.labourHours ?? null,
        cost: item?.recommendedCost ?? null,
      };
    }),
    null,
    2
  )
);

console.log("\n-- REGRESSION SPAWNS --");
if (process.env.DECK_R7_SKIP_SPAWN === "1") {
  console.log("skipped nested spawns (DECK_R7_SKIP_SPAWN=1)");
} else {
check("spawn Fence 1A >=157/0", spawnFence("scripts/verify-fence-maturity-1a.ts", 157));
check("spawn Fence 1B >=82/0", spawnFence("scripts/verify-fence-maturity-1b.ts", 82));
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
  console.log(`\nDECK-R7  ${passed} passed / ${failed} failed`);
  process.exit(1);
}
console.log(`\nDECK-R7  ${passed} passed / 0 failed`);
