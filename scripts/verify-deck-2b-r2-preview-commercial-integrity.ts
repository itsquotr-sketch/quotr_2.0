/**
 * DECK-2B-R2 / RECOVERY-0-R1 — Preview commercial integrity.
 * Run: npx tsx scripts/verify-deck-2b-r2-preview-commercial-integrity.ts
 *
 * Named component lookups reject blank item_key company rates.
 * Generic work-area lookup (empty itemKey) may still use blank-key packages.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  resolveRate,
  isEligibleWorkAreaFallbackRate,
  isNamedComponentLookup,
  BLANK_ITEM_KEY_NAMED_COMPONENT_COMPATIBILITY,
} from "../lib/estimate/rates";
import { DECK_BENCHMARKS, FENCE_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import {
  buildPersistEstimateGenerationV1,
  PERSIST_ESTIMATE_GENERATION_RPC,
} from "../lib/estimate/persist-estimate-generation";
import {
  loadCalibrationFixture,
  runDeckCalibration,
} from "./deck-calibration/run-deck-calibration";
import { resolveLocalDbContainer } from "./local-db-container";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { OrganisationRate } from "../components/setup/types";

let passed = 0;
let failed = 0;
let dbChecks = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function dbCheck(name: string, ok: boolean, detail = ""): void {
  dbChecks += 1;
  check(name, ok, detail);
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function wa(id: string): EstimateWorkArea {
  return { id, type: "deck", name: "Deck", sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function rate(
  partial: Partial<OrganisationRate> & { item_key?: string }
): OrganisationRate {
  return {
    id: partial.id ?? "r1",
    rate_type: partial.rate_type ?? "material",
    trade: partial.trade ?? null,
    work_area_type: partial.work_area_type ?? "deck",
    item_key: partial.item_key ?? "",
    label: partial.label ?? partial.item_key,
    unit: partial.unit ?? "lm",
    cost_rate: partial.cost_rate ?? 22.5,
    sell_rate: partial.sell_rate ?? null,
    markup_percent: null,
    active: partial.active ?? true,
  };
}

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
};

const collidingHardwoodLm = rate({
  item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
  work_area_type: "deck",
  unit: "lm",
  cost_rate: 22.5,
  sell_rate: null,
});

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const WA = "wa-deck-1";
const realFacts = Object.entries(realJob.facts).map(([key, value]) =>
  fact(key, WA, value)
);

function realJobContext(rates: OrganisationRate[]): EstimateContext {
  return {
    project: { id: "real-job-01", qualityLevel: "standard" },
    confirmedWorkAreas: [wa(WA)],
    facts: realFacts,
    constraints: [],
    organisationSettings: orgSettings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates,
  } as unknown as EstimateContext;
}

console.log("=== DECK-2B-R2 Preview commercial integrity ===\n");

const ratesSrc = read("lib/estimate/rates.ts");
check(
  "1 work-area fallback requires identity eligibility",
  ratesSrc.includes("isEligibleWorkAreaFallbackRate")
);
check(
  "2 work-area fallback no longer matches any deck material",
  !ratesSrc.includes("rate.work_area_type === params.workAreaType &&") ||
    ratesSrc.includes("isEligibleWorkAreaFallbackRate")
);

check(
  "3 hardwood lm is not an eligible framing fallback",
  isEligibleWorkAreaFallbackRate({
    rate: collidingHardwoodLm,
    rateType: "material",
    itemKey: "deck.substructure.m2",
    workAreaType: "deck",
    unit: "m2",
  }) === false
);

check(
  "4 hardwood lm is not an eligible fixings fallback",
  isEligibleWorkAreaFallbackRate({
    rate: collidingHardwoodLm,
    rateType: "material",
    itemKey: "deck.fixings.m2",
    workAreaType: "deck",
    unit: "m2",
  }) === false
);

const stolenFraming = resolveRate({
  rates: [collidingHardwoodLm],
  rateType: "material",
  itemKey: "deck.substructure.m2",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: DECK_BENCHMARKS.framing.cost,
  fallbackSellRate: DECK_BENCHMARKS.framing.sell,
  organisationSettings: orgSettings,
});
check(
  "5 framing keeps $120 fallback when generic deck lm exists",
  stolenFraming.costRate === DECK_BENCHMARKS.framing.cost &&
    stolenFraming.sellRate === DECK_BENCHMARKS.framing.sell &&
    stolenFraming.sourceType === "benchmark",
  `cost=${stolenFraming.costRate} source=${stolenFraming.sourceType}`
);

const stolenFixings = resolveRate({
  rates: [collidingHardwoodLm],
  rateType: "material",
  itemKey: "deck.fixings.m2",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
  fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
  organisationSettings: orgSettings,
});
check(
  "6 fixings keeps $25 fallback when generic deck lm exists",
  stolenFixings.costRate === DECK_BENCHMARKS.fixings.cost &&
    stolenFixings.sellRate === DECK_BENCHMARKS.fixings.sell,
  `cost=${stolenFixings.costRate}`
);

const emptyRatesEstimate = calculateEstimate(realJobContext([]));
const collidingRatesEstimate = calculateEstimate(
  realJobContext([collidingHardwoodLm])
);
check(
  "7 fixture empty-rates sell is $16,069.10",
  emptyRatesEstimate.recommendedSell === 16069.1,
  `sell=${emptyRatesEstimate.recommendedSell}`
);

const framingLine = collidingRatesEstimate.lineItems.find(
  (item) => item.label === "Framing/substructure"
);
const fixingsLine = collidingRatesEstimate.lineItems.find(
  (item) => item.label === "Fixings and consumables"
);
const labourLine = collidingRatesEstimate.lineItems.find(
  (item) => item.label === "Deck labour"
);
const deckingLine = collidingRatesEstimate.lineItems.find(
  (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY
);

check(
  "8 colliding hardwood lm does not steal framing/fixings to Preview-defect band",
  framingLine?.costRate === 120 &&
    fixingsLine?.costRate === 25 &&
    collidingRatesEstimate.recommendedSell > 10000,
  `sell=${collidingRatesEstimate.recommendedSell}`
);

check("9 persisted-path framing line exists", Boolean(framingLine));
check("10 persisted-path decking line exists", Boolean(deckingLine));
check("11 persisted-path labour line exists", Boolean(labourLine));
check("12 persisted-path fixings line exists", Boolean(fixingsLine));

check(
  "13 framing cost rate is $120 not $22.50",
  framingLine?.costRate === 120,
  `costRate=${framingLine?.costRate}`
);
check(
  "14 fixings cost rate is $25 not $22.50",
  fixingsLine?.costRate === 25,
  `costRate=${fixingsLine?.costRate}`
);
check(
  "15 framing item key remains deck.substructure.m2",
  framingLine?.itemKey === "deck.substructure.m2"
);
check(
  "16 fixings item key remains deck.fixings.m2",
  fixingsLine?.itemKey === "deck.fixings.m2"
);
check(
  "17 framing source is not work_area_rate",
  framingLine?.rateSourceType !== "work_area_rate"
);
check(
  "18 fixings source is not work_area_rate",
  fixingsLine?.rateSourceType !== "work_area_rate"
);

const companyFraming = resolveRate({
  rates: [
    rate({
      item_key: "deck.substructure.m2",
      unit: "m2",
      cost_rate: 95,
      sell_rate: 140,
    }),
  ],
  rateType: "material",
  itemKey: "deck.substructure.m2",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: DECK_BENCHMARKS.framing.cost,
  fallbackSellRate: DECK_BENCHMARKS.framing.sell,
  organisationSettings: orgSettings,
});
check(
  "19 exact company framing still outranks fallback",
  companyFraming.costRate === 95 && companyFraming.sourceType === "user_rate"
);

const companySurface = calculateEstimate(
  realJobContext([
    rate({
      item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
      unit: "lm",
      work_area_type: "deck",
      cost_rate: 18.5,
      sell_rate: null,
    }),
  ])
);
const surfaceAfterCompany = companySurface.lineItems.find(
  (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY
);
const framingAfterCompany = companySurface.lineItems.find(
  (item) => item.label === "Framing/substructure"
);
check(
  "20 company hardwood lm still prices decking surface",
  surfaceAfterCompany?.costRate === 18.5
);
check(
  "21 company hardwood lm does not steal framing",
  framingAfterCompany?.costRate === 120
);

check(
  "22 surface remains REQUIREMENT_AUTHORITATIVE",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_SURFACE_COMPONENT_KEY,
  }).authority === "REQUIREMENT_AUTHORITATIVE"
);
check(
  "23 labour remains SHADOW",
  getComponentCommercialAuthority({
    workAreaType: "deck",
    componentKey: DECK_LABOUR_COMPONENT_KEY,
  }).authority === "SHADOW"
);
check(
  "24 framing line has no promoted structural child key",
  framingLine?.componentKey == null ||
    framingLine.componentKey === "deck.substructure.m2"
);

const labourCount = collidingRatesEstimate.lineItems.filter(
  (item) => item.label === "Deck labour"
).length;
const framingCount = collidingRatesEstimate.lineItems.filter(
  (item) => item.label === "Framing/substructure"
).length;
const fixingsCount = collidingRatesEstimate.lineItems.filter(
  (item) => item.label === "Fixings and consumables"
).length;
check("25 labour active exactly once", labourCount === 1);
check("26 framing active exactly once", framingCount === 1);
check("27 fixings active exactly once", fixingsCount === 1);

const lineSell = collidingRatesEstimate.lineItems.reduce(
  (sum, item) => sum + item.recommendedSell,
  0
);
check(
  "28 active line sell equals estimate sell",
  Math.abs(lineSell - collidingRatesEstimate.recommendedSell) < 0.05,
  `lines=${lineSell} total=${collidingRatesEstimate.recommendedSell}`
);

check(
  "29 $13,000 is never a rate",
  collidingRatesEstimate.lineItems.every(
    (item) => item.costRate !== 13000 && item.sellRate !== 13000
  )
);
check(
  "30 fixture calibration sell unchanged",
  runDeckCalibration(realJob).commercialSafety.estimateSell === 16069.1
);

check(
  "31 no demolition assumed when fact missing",
  collidingRatesEstimate.assumptions.some((row) =>
    /no demolition assumed/i.test(row)
  )
);
check(
  "32 no fascia included unless confirmed",
  collidingRatesEstimate.assumptions.some((row) =>
    /no fascia included unless confirmed/i.test(row)
  )
);
check(
  "33 fascia money not silently added",
  !collidingRatesEstimate.lineItems.some((item) =>
    /fascia|face board/i.test(item.label)
  )
);

check(
  "34 DECK-1D collision documented in resolver",
  ratesSrc.includes("never steal") ||
    ratesSrc.includes("different specific item_key")
);

console.log("\n--- RECOVERY-0-R1 named component lock ---\n");

check(
  "43 no blank→named compatibility contracts exist",
  Object.keys(BLANK_ITEM_KEY_NAMED_COMPONENT_COMPATIBILITY).length === 0
);
check(
  "44 deck.substructure.m2 is a named component lookup",
  isNamedComponentLookup("deck.substructure.m2") &&
    isNamedComponentLookup("deck.fixings.m2")
);

const blankDeckM2 = rate({
  item_key: "",
  work_area_type: "deck",
  unit: "m2",
  cost_rate: 22.5,
  sell_rate: null,
});
const whitespaceDeckM2 = rate({
  item_key: "   ",
  work_area_type: "deck",
  unit: "m2",
  cost_rate: 22.5,
});
const blankDeckLm = rate({
  item_key: "",
  work_area_type: "deck",
  unit: "lm",
  cost_rate: 22.5,
});

check(
  "45 blank Deck m2 cannot price deck.substructure.m2",
  isEligibleWorkAreaFallbackRate({
    rate: blankDeckM2,
    rateType: "material",
    itemKey: "deck.substructure.m2",
    workAreaType: "deck",
    unit: "m2",
  }) === false &&
    resolveRate({
      rates: [blankDeckM2, whitespaceDeckM2],
      rateType: "material",
      itemKey: "deck.substructure.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.framing.cost,
      fallbackSellRate: DECK_BENCHMARKS.framing.sell,
      organisationSettings: orgSettings,
    }).sourceType === "benchmark" &&
    resolveRate({
      rates: [blankDeckM2],
      rateType: "material",
      itemKey: "deck.substructure.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.framing.cost,
      fallbackSellRate: DECK_BENCHMARKS.framing.sell,
      organisationSettings: orgSettings,
    }).costRate === DECK_BENCHMARKS.framing.cost
);
check(
  "46 blank Deck m2 cannot price deck.fixings.m2",
  isEligibleWorkAreaFallbackRate({
    rate: blankDeckM2,
    rateType: "material",
    itemKey: "deck.fixings.m2",
    workAreaType: "deck",
    unit: "m2",
  }) === false &&
    resolveRate({
      rates: [blankDeckM2],
      rateType: "material",
      itemKey: "deck.fixings.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
      fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
      organisationSettings: orgSettings,
    }).costRate === DECK_BENCHMARKS.fixings.cost
);
check(
  "47 blank Deck lm cannot price framing or fixings",
  isEligibleWorkAreaFallbackRate({
    rate: blankDeckLm,
    rateType: "material",
    itemKey: "deck.substructure.m2",
    workAreaType: "deck",
    unit: "m2",
  }) === false &&
    isEligibleWorkAreaFallbackRate({
      rate: blankDeckLm,
      rateType: "material",
      itemKey: "deck.fixings.m2",
      workAreaType: "deck",
      unit: "m2",
    }) === false
);
check(
  "48 unrelated hardwood lm cannot price framing or fixings",
  isEligibleWorkAreaFallbackRate({
    rate: collidingHardwoodLm,
    rateType: "material",
    itemKey: "deck.substructure.m2",
    workAreaType: "deck",
    unit: "m2",
  }) === false &&
    isEligibleWorkAreaFallbackRate({
      rate: collidingHardwoodLm,
      rateType: "material",
      itemKey: "deck.fixings.m2",
      workAreaType: "deck",
      unit: "m2",
    }) === false
);

const exactFramingCompany = resolveRate({
  rates: [
    rate({
      item_key: "deck.substructure.m2",
      unit: "m2",
      cost_rate: 95,
      sell_rate: 140,
    }),
  ],
  rateType: "material",
  itemKey: "deck.substructure.m2",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: DECK_BENCHMARKS.framing.cost,
  fallbackSellRate: DECK_BENCHMARKS.framing.sell,
  organisationSettings: orgSettings,
});
check(
  "49 exact deck.substructure.m2 company rate resolves",
  exactFramingCompany.costRate === 95 &&
    exactFramingCompany.sellRate === 140 &&
    exactFramingCompany.sourceType === "user_rate"
);

const exactFixingsCompany = resolveRate({
  rates: [
    rate({
      item_key: "deck.fixings.m2",
      unit: "m2",
      cost_rate: 31,
      sell_rate: 48,
    }),
  ],
  rateType: "material",
  itemKey: "deck.fixings.m2",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
  fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
  organisationSettings: orgSettings,
});
check(
  "50 exact deck.fixings.m2 company rate resolves",
  exactFixingsCompany.costRate === 31 &&
    exactFixingsCompany.sourceType === "user_rate"
);

const aliasWaterproofing = resolveRate({
  rates: [
    rate({
      item_key: "bathroom_waterproofing_m2",
      work_area_type: "bathroom",
      unit: "m2",
      cost_rate: 88,
      sell_rate: 130,
    }),
  ],
  rateType: "material",
  itemKey: "bathroom.waterproofing.m2",
  workAreaType: "bathroom",
  unit: "m2",
  fallbackCostRate: 90,
  fallbackSellRate: 140,
  organisationSettings: orgSettings,
});
check(
  "51 approved alias still resolves",
  aliasWaterproofing.costRate === 88 &&
    aliasWaterproofing.sourceType === "user_rate"
);

check(
  "52 no exact company substructure → canonical framing benchmark",
  resolveRate({
    rates: [blankDeckM2, collidingHardwoodLm],
    rateType: "material",
    itemKey: "deck.substructure.m2",
    workAreaType: "deck",
    unit: "m2",
    fallbackCostRate: DECK_BENCHMARKS.framing.cost,
    fallbackSellRate: DECK_BENCHMARKS.framing.sell,
    organisationSettings: orgSettings,
  }).costRate === 120 &&
    resolveRate({
      rates: [blankDeckM2, collidingHardwoodLm],
      rateType: "material",
      itemKey: "deck.substructure.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.framing.cost,
      fallbackSellRate: DECK_BENCHMARKS.framing.sell,
      organisationSettings: orgSettings,
    }).sellRate === 180
);
check(
  "53 no exact company fixings → canonical fixings benchmark",
  resolveRate({
    rates: [blankDeckM2, collidingHardwoodLm],
    rateType: "material",
    itemKey: "deck.fixings.m2",
    workAreaType: "deck",
    unit: "m2",
    fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
    fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
    organisationSettings: orgSettings,
  }).costRate === 25 &&
    resolveRate({
      rates: [blankDeckM2, collidingHardwoodLm],
      rateType: "material",
      itemKey: "deck.fixings.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
      fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
      organisationSettings: orgSettings,
    }).sellRate === 40
);

const blankM2Estimate = calculateEstimate(
  realJobContext([blankDeckM2, collidingHardwoodLm])
);
const blankM2Decking = blankM2Estimate.lineItems.find(
  (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY
);
const blankM2Framing = blankM2Estimate.lineItems.find(
  (item) => item.label === "Framing/substructure"
);
const blankM2Fixings = blankM2Estimate.lineItems.find(
  (item) => item.label === "Fixings and consumables"
);
check(
  "54 decking surface company rate remains valid beside blank m2",
  blankM2Decking?.costRate === 22.5 &&
    blankM2Decking.rateSourceType === "user_rate"
);
check(
  "55 REAL-JOB blank m2 does not steal framing/fixings",
  blankM2Framing?.costRate === 120 &&
    blankM2Framing.rateSourceType === "benchmark" &&
    blankM2Fixings?.costRate === 25 &&
    blankM2Fixings.rateSourceType === "benchmark"
);

const genericLookup = resolveRate({
  rates: [blankDeckM2],
  rateType: "material",
  itemKey: "",
  workAreaType: "deck",
  unit: "m2",
  fallbackCostRate: 999,
  fallbackSellRate: 1499,
  organisationSettings: orgSettings,
});
check(
  "56 generic lookup without named component still uses blank work-area rate",
  genericLookup.costRate === 22.5 &&
    (genericLookup.sourceType === "work_area_rate" ||
      genericLookup.sourceType === "user_rate") &&
    resolveRate({
      rates: [whitespaceDeckM2],
      rateType: "material",
      itemKey: "",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: 999,
      fallbackSellRate: 1499,
      organisationSettings: orgSettings,
    }).sourceType === "work_area_rate"
);
check(
  "56b generic lookup does not use a named hardwood lm as a package",
  resolveRate({
    rates: [collidingHardwoodLm],
    rateType: "material",
    itemKey: "",
    workAreaType: "deck",
    unit: "lm",
    fallbackCostRate: 999,
    fallbackSellRate: 1499,
    organisationSettings: orgSettings,
  }).costRate === 999
);

const fenceWithBlankDeck = resolveRate({
  rates: [blankDeckM2, collidingHardwoodLm],
  rateType: "material",
  itemKey: "fence.material.timber.lm",
  workAreaType: "fence",
  unit: "lm",
  fallbackCostRate: FENCE_BENCHMARKS.timberPerLm.cost,
  fallbackSellRate: FENCE_BENCHMARKS.timberPerLm.sell,
  organisationSettings: orgSettings,
});
check(
  "57 unrelated Work Area (fence) is not stolen by blank Deck rate",
  fenceWithBlankDeck.costRate === FENCE_BENCHMARKS.timberPerLm.cost &&
    fenceWithBlankDeck.sourceType === "benchmark"
);

function testLocalDb(): void {
  console.log("\n--- LOCAL DB (real generation persist) ---\n");
  if (!existsSync("supabase/migrations/036_persist_estimate_generation_v1.sql")) {
    dbCheck("35-40 local DB skipped", true);
    return;
  }
  let container = "";
  try {
    container = resolveLocalDbContainer();
  } catch {
    dbCheck("35-40 local DB skipped (docker unavailable)", true);
    return;
  }

  const orgId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const email = `deck2br2-${userId.slice(0, 8)}@example.local`;
  try {
    execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"],
      {
        encoding: "utf8",
        input: `
          INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
          ) VALUES (
            '${userId}',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            '${email}',
            crypt('password', gen_salt('bf')),
            now(), now(), now(),
            '{}'::jsonb, '{}'::jsonb, false, false, false
          );
          INSERT INTO public.organisations (id, name) VALUES ('${orgId}', 'DECK-2B-R2');
          INSERT INTO public.profiles (id, org_id, role) VALUES ('${userId}', '${orgId}', 'owner');
          INSERT INTO public.projects (id, org_id, created_by, title, stage)
          VALUES ('${projectId}', '${orgId}', '${userId}', 'REAL-JOB-01', 'estimate_ready');
          INSERT INTO public.rates (
            org_id, rate_type, work_area_type, item_key, label, unit, cost_rate, sell_rate, active
          ) VALUES (
            '${orgId}', 'material', 'deck', '${MATERIAL_RATE_KEYS.deckingHardwoodLm}',
            'Hardwood lm', 'lm', 22.5, NULL, true
          );
        `,
      }
    );

    const generationId = randomUUID();
    const payload = buildPersistEstimateGenerationV1({
      projectId,
      generationId,
      estimateResult: collidingRatesEstimate,
    });
    payload.lineItems = payload.lineItems.map((line) => ({
      ...line,
      workAreaId: null,
    }));

    const persistOut = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"],
      {
        encoding: "utf8",
        input: `
          BEGIN;
          SET LOCAL ROLE authenticated;
          SELECT set_config('request.jwt.claim.sub', '${userId}', true);
          SELECT public.${PERSIST_ESTIMATE_GENERATION_RPC}('${JSON.stringify(payload).replace(/'/g, "''")}'::jsonb);
          COMMIT;
        `,
      }
    );
    dbCheck("35 persisted estimate generation exists", persistOut.includes(generationId));

    const sell = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `SELECT recommended_sell::text FROM public.estimates WHERE project_id = '${projectId}'::uuid;`,
      }
    ).trim();
    dbCheck(
      "36 persisted sell matches in-memory real-app estimate",
      Number(sell) === collidingRatesEstimate.recommendedSell,
      `sell=${sell}`
    );

    const framingPersisted = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `
            SELECT recommended_cost::text
          FROM public.estimate_line_items
          WHERE estimate_id = (SELECT id FROM public.estimates WHERE project_id = '${projectId}'::uuid)
            AND label = 'Framing/substructure';
        `,
      }
    ).trim();
    dbCheck(
      "37 persisted framing cost is 27×120",
      Number(framingPersisted) === 3240,
      `recommended_cost=${framingPersisted}`
    );

    const fixingsPersisted = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `
            SELECT recommended_cost::text
          FROM public.estimate_line_items
          WHERE estimate_id = (SELECT id FROM public.estimates WHERE project_id = '${projectId}'::uuid)
            AND label = 'Fixings and consumables';
        `,
      }
    ).trim();
    dbCheck(
      "38 persisted fixings cost is 27×25",
      Number(fixingsPersisted) === 675,
      `recommended_cost=${fixingsPersisted}`
    );

    const genPointer = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `SELECT requirement_generation_id::text FROM public.estimates WHERE project_id = '${projectId}'::uuid;`,
      }
    ).trim();
    dbCheck("39 snapshot/generation pointer linked", genPointer.includes(generationId));

    const lineCount = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `
          SELECT count(*)::text
          FROM public.estimate_line_items
          WHERE estimate_id = (SELECT id FROM public.estimates WHERE project_id = '${projectId}'::uuid);
        `,
      }
    ).trim();
    dbCheck("40 persisted line list recorded", Number(lineCount) >= 4, `count=${lineCount}`);

    const dbOrgRate = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `
          SELECT cost_rate::text || '|' || unit || '|' || item_key
          FROM public.rates
          WHERE org_id = '${orgId}'::uuid
          LIMIT 1;
        `,
      }
    ).trim();
    const [dbCost, dbUnit, dbItemKey] = dbOrgRate.split("|");
    const dbLoadedRates = [
      rate({
        item_key: dbItemKey,
        unit: dbUnit,
        cost_rate: Number(dbCost),
        work_area_type: "deck",
      }),
    ];
    const dbFraming = resolveRate({
      rates: dbLoadedRates,
      rateType: "material",
      itemKey: "deck.substructure.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.framing.cost,
      fallbackSellRate: DECK_BENCHMARKS.framing.sell,
      organisationSettings: orgSettings,
    });
    const dbFixings = resolveRate({
      rates: dbLoadedRates,
      rateType: "material",
      itemKey: "deck.fixings.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
      fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
      organisationSettings: orgSettings,
    });
    dbCheck(
      "41 DB org hardwood lm does not steal framing",
      dbFraming.costRate === 120 && dbFraming.sourceType === "benchmark",
      `cost=${dbFraming.costRate} source=${dbFraming.sourceType}`
    );
    dbCheck(
      "42 DB org hardwood lm does not steal fixings",
      dbFixings.costRate === 25 && dbFixings.sourceType === "benchmark",
      `cost=${dbFixings.costRate} source=${dbFixings.sourceType}`
    );
  } catch (error) {
    dbCheck(
      "35-40 local DB skipped (fixture/schema unavailable)",
      true,
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    try {
      execFileSync(
        "docker",
        ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
        {
          encoding: "utf8",
          input: `
            DELETE FROM public.rates WHERE org_id = '${orgId}'::uuid;
            DELETE FROM public.projects WHERE id = '${projectId}'::uuid;
            DELETE FROM public.profiles WHERE id = '${userId}'::uuid;
            DELETE FROM public.organisations WHERE id = '${orgId}'::uuid;
            DELETE FROM auth.users WHERE id = '${userId}'::uuid;
          `,
        }
      );
    } catch {
      /* best-effort cleanup */
    }
  }
}

testLocalDb();

console.log(`\n=== Results: ${passed} passed, ${failed} failed (${dbChecks} db checks) ===\n`);
process.exit(failed > 0 ? 1 : 0);
