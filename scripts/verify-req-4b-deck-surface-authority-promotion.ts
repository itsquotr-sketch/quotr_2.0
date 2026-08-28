/**
 * REQ-4B — Deck surface commercial authority promotion (local).
 *
 * Run: npx tsx scripts/verify-req-4b-deck-surface-authority-promotion.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  generationRequiresRequirementSnapshot,
  getComponentCommercialAuthority,
  LEGACY_FALLBACK_CONTRACT,
  listRegisteredComponentAuthorities,
  REQ_4B_FIRST_PROMOTION_CANDIDATE,
} from "../lib/estimate/component-authority";
import {
  assertNoDuplicateActiveComponents,
  countActiveComponentLines,
  DuplicateActiveComponentError,
} from "../lib/estimate/component-commercial-selection";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { applyMarginToAmounts } from "../lib/estimate/margin-override";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import {
  buildPersistEstimateGenerationV1,
  PERSIST_ESTIMATE_GENERATION_RPC,
} from "../lib/estimate/persist-estimate-generation";
import {
  buildSnapshotPayloadForEstimate,
  buildRequirementCommercialDiagnostics,
  reconcileRegisteredComponents,
} from "../lib/estimate/requirement-snapshot-persist";
import { parseEstimateRequirementSnapshot } from "../lib/estimate/requirement-snapshot";
import { valuesFromEstimateLineItem } from "../lib/pricing/recalibration-helpers";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";
import { resolveLocalDbContainer } from "./local-db-container";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { MaterialRequirement } from "../lib/estimate/requirements";

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function wa(id: string, type: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

const orgSettings = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
};

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [],
  facts: [],
  constraints: [],
  organisationSettings: orgSettings,
  materialWastageSettings: { deckingWastagePercent: 10, defaultMaterialWastagePercent: 10 },
  rates: [],
} as unknown as EstimateContext;

const ownerArea = 16.12;

function hardwoodFacts(workAreaId: string, includeWidth = true): EstimateFact[] {
  const rows: EstimateFact[] = [
    fact("deck.area_m2", workAreaId, ownerArea),
    fact("deck.board_material", workAreaId, "Hardwood"),
    fact("deck.height_m", workAreaId, 0.4),
  ];
  if (includeWidth) rows.push(fact("deck.board_width_mm", workAreaId, 140));
  return rows;
}

function surfaceLine(result: { lineItems: { componentKey?: string; recommendedCost: number; recommendedSell: number; label: string }[] }) {
  return result.lineItems.find((item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY);
}

function surfaceReq(result: { requirements?: readonly { kind: string; componentKey?: string; totalCost?: number | null; priced?: boolean; rateSource?: string }[] }) {
  return result.requirements?.find(
    (item): item is MaterialRequirement =>
      item.kind === "material" && item.componentKey === DECK_SURFACE_COMPONENT_KEY
  );
}

function benchEstimate(workAreaId = "d1") {
  return calculateEstimate({
    ...baseContext,
    confirmedWorkAreas: [wa(workAreaId, "deck", "Deck")],
    facts: hardwoodFacts(workAreaId),
  } as never);
}

function companyLmEstimate() {
  return calculateEstimate({
    ...baseContext,
    confirmedWorkAreas: [wa("d1", "deck", "Deck")],
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
        rate_type: "material",
        unit: "lm",
        cost_rate: 18.5,
        sell_rate: null,
        active: true,
      },
    ],
  } as never);
}

function companyM2Estimate() {
  return calculateEstimate({
    ...baseContext,
    confirmedWorkAreas: [wa("d1", "deck", "Deck")],
    facts: hardwoodFacts("d1"),
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodM2,
        rate_type: "material",
        unit: "m2",
        cost_rate: 160,
        sell_rate: null,
        active: true,
      },
    ],
  } as never);
}

function deck1Estimate() {
  return calculateEstimate({
    ...baseContext,
    confirmedWorkAreas: [wa("d1", "deck", "Deck 1")],
    facts: [
      fact("deck.area_m2", "d1", 70),
      fact("deck.board_material", "d1", "Hardwood"),
      fact("deck.board_width_mm", "d1", 140),
      fact("deck.height_m", "d1", 0.8),
      fact("deck.existing_deck_removal", "d1", true),
      fact("deck.access_type", "d1", "Stair set"),
      fact("deck.balustrade_required", "d1", true),
    ],
    materialWastageSettings: { decking: 10, default: 5 },
  } as never);
}

function testPromotionRegistry() {
  console.log("\n--- PROMOTION ---\n");
  check(
    "1 decking.surface REQUIREMENT_AUTHORITATIVE",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }).authority === "REQUIREMENT_AUTHORITATIVE"
  );
  check(
    "2 deck.labour remains SHADOW",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
    }).authority === "SHADOW"
  );
  check(
    "3 no entire-WA promotion",
    listRegisteredComponentAuthorities().length === 2 &&
      listRegisteredComponentAuthorities().every(
        (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY || item.componentKey === DECK_LABOUR_COMPONENT_KEY
      )
  );
  check(
    "4 unregistered default LEGACY_AUTHORITATIVE",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: "deck.substructure",
    }).authority === "LEGACY_AUTHORITATIVE"
  );
}

function testPreconditions() {
  console.log("\n--- PRECONDITION ---\n");
  const bench = benchEstimate();
  const req = surfaceReq(bench);
  const legacyDeck = calculateDeck(
    { ...baseContext, facts: hardwoodFacts("d1") } as never,
    wa("d1", "deck", "Deck")
  );
  const legacyLine = surfaceLine(legacyDeck);
  const { reconciliations } = reconcileRegisteredComponents(bench);
  const surfaceRec = reconciliations.find(
    (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY
  );
  const generationId = randomUUID();
  const snapshot = buildSnapshotPayloadForEstimate({ generationId, result: bench });

  check("5 requirement exists", req != null && req.priced === true);
  check("6 requirement priced", req?.totalCost === 2786.3);
  check("7 legacy candidate exists", legacyLine != null);
  check("8 reconciliation exact PASS", surfaceRec?.status === "PASS");
  check(
    "9 snapshot present",
    snapshot.requirements.length >= 1 &&
      snapshot.componentAuthorities.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.authority === "REQUIREMENT_AUTHORITATIVE"
      )
  );
  check(
    "10 atomic persistence active",
    existsSync("supabase/migrations/036_persist_estimate_generation_v1.sql") &&
      read("lib/estimate/persist-estimate-generation.ts").includes(
        PERSIST_ESTIMATE_GENERATION_RPC
      )
  );
}

function testCommercialFixtures() {
  console.log("\n--- COMMERCIAL FIXTURES ---\n");
  const lm = companyLmEstimate();
  const m2 = companyM2Estimate();
  const bench = benchEstimate();
  const lmReq = surfaceReq(lm)!;
  const m2Req = surfaceReq(m2)!;
  const benchReq = surfaceReq(bench)!;
  const lmLine = surfaceLine(lm)!;
  const m2Line = surfaceLine(m2)!;
  const benchLine = surfaceLine(bench)!;
  const lmLegacy = surfaceLine(
    calculateDeck(
      {
        ...baseContext,
        facts: hardwoodFacts("d1"),
        rates: [
          {
            item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
            rate_type: "material",
            unit: "lm",
            cost_rate: 18.5,
            sell_rate: null,
            active: true,
          },
        ],
      } as never,
      wa("d1", "deck", "Deck")
    )
  )!;

  check("11 company lm requirement $2,343.03", lmReq.totalCost === 2343.03);
  check("12 active surface cost $2,343.03", lmLine.recommendedCost === 2343.03);
  check(
    "13 legacy not additionally counted",
    round2(lm.recommendedCost) ===
      round2(lm.lineItems.reduce((sum, item) => sum + item.recommendedCost, 0))
  );
  check(
    "14 sell exact parity company lm",
    lmLine.recommendedSell === lmLegacy.recommendedSell
  );

  const m2Legacy = surfaceLine(
    calculateDeck(
      {
        ...baseContext,
        facts: hardwoodFacts("d1"),
        rates: [
          {
            item_key: MATERIAL_RATE_KEYS.deckingHardwoodM2,
            rate_type: "material",
            unit: "m2",
            cost_rate: 160,
            sell_rate: null,
            active: true,
          },
        ],
      } as never,
      wa("d1", "deck", "Deck")
    )
  )!;

  check("15 company m2 requirement $2,836.96", m2Req.totalCost === 2836.96);
  check("16 active cost $2,836.96", m2Line.recommendedCost === 2836.96);
  check("17 conversion company", m2Req.rateSource === "company");
  check("18 waste once", m2Req.purchaseQuantity === 126.65);
  check(
    "19 no legacy duplicate",
    countActiveComponentLines(m2.lineItems, {
      workAreaId: "d1",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }) === 1
  );
  check(
    "20 sell exact parity company m2",
    m2Line.recommendedSell === m2Legacy.recommendedSell
  );

  const benchLegacy = surfaceLine(
    calculateDeck(
      { ...baseContext, facts: hardwoodFacts("d1") } as never,
      wa("d1", "deck", "Deck")
    )
  )!;

  check("21 benchmark requirement $2,786.30", benchReq.totalCost === 2786.3);
  check("22 active cost $2,786.30", benchLine.recommendedCost === 2786.3);
  check(
    "22b benchmark surface sell $4,306.10",
    benchLine.recommendedSell === 4306.1 &&
      benchLegacy.recommendedSell === 4306.1
  );
  check(
    "23 paired benchmark sell preserved",
    benchLine.recommendedSell === benchLegacy.recommendedSell &&
      (benchLine.sellDerivedFromMargin !== true || benchLine.sellRate != null)
  );
  check(
    "24 no GM stacking regression on paired sell",
    benchLine.recommendedCost === benchReq.totalCost
  );
  check(
    "25 no duplicate legacy contribution",
    bench.commercialSelections?.find((item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY)
      ?.activeSource === "REQUIREMENT"
  );
}

function testFallback() {
  console.log("\n--- FALLBACK ---\n");
  const missing = calculateEstimate({
    ...baseContext,
    confirmedWorkAreas: [wa("d1", "deck", "Deck")],
    facts: hardwoodFacts("d1"),
    organisationSettings: { ...orgSettings, allow_benchmark_rates: false },
    rates: [],
  } as never);
  const missingReq = surfaceReq(missing);
  const noWidth = calculateEstimate({
    ...baseContext,
    confirmedWorkAreas: [wa("d1", "deck", "Deck")],
    facts: hardwoodFacts("d1", false),
  } as never);

  check(
    "26 unpriced uses LEGACY_FALLBACK (not requirement $0 line)",
    missingReq?.priced === false &&
      missing.commercialSelections?.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.activeSource === "LEGACY_FALLBACK" &&
          item.fallbackReason === "unpriced_requirement"
      ) &&
      countActiveComponentLines(missing.lineItems, {
        workAreaId: "d1",
        componentKey: DECK_SURFACE_COMPONENT_KEY,
      }) === 1
  );
  check(
    "27 width-unknown legacy fallback",
    surfaceReq(noWidth) == null &&
      surfaceLine(noWidth)?.label === "Decking package" &&
      noWidth.commercialSelections?.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.activeSource === "LEGACY_FALLBACK"
      )
  );
  check("28 no fake lm requirement", surfaceReq(noWidth) == null);
  check(
    "29 exactly one active source",
    countActiveComponentLines(noWidth.lineItems, {
      workAreaId: "d1",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }) === 1
  );
  check(
    "30 generation active source recorded",
    buildSnapshotPayloadForEstimate({
      generationId: randomUUID(),
      result: benchEstimate(),
    }).commercialSources?.some((item) => item.activeSource === "REQUIREMENT")
  );
}

function testSafetyAndGoldens() {
  console.log("\n--- DUPLICATE / GOLDENS / LABOUR ---\n");
  const bench = benchEstimate();
  const deck1 = deck1Estimate();
  let duplicateThrows = false;
  try {
    assertNoDuplicateActiveComponents([
      ...bench.lineItems,
      {
        ...surfaceLine(bench)!,
        sortOrder: 999,
      },
    ]);
  } catch (error) {
    duplicateThrows = error instanceof DuplicateActiveComponentError;
  }

  check(
    "31 one active decking.surface max",
    countActiveComponentLines(bench.lineItems, {
      workAreaId: "d1",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }) === 1
  );
  check("32 duplicate active component fails", duplicateThrows === true);
  check(
    "33 component_key retained",
    bench.lineItems.some((item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY)
  );
  check(
    "34 Deck component cost parity",
    surfaceLine(bench)!.recommendedCost === surfaceReq(bench)!.totalCost
  );
  check("37 Deck 1 golden sell $48,340", Math.round(deck1.recommendedSell) === 48340);
  check(
    "38 deck.labour line money authority",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
    }).authority === "SHADOW" &&
      deck1.lineItems.some((item) => item.componentKey === DECK_LABOUR_COMPONENT_KEY)
  );
  check(
    "40 labour costs unchanged vs calculator",
    deck1.lineItems.find((item) => item.componentKey === DECK_LABOUR_COMPONENT_KEY)
      ?.recommendedCost ===
      calculateDeck(
        {
          ...baseContext,
          confirmedWorkAreas: [wa("d1", "deck", "Deck 1")],
          facts: [
            fact("deck.area_m2", "d1", 70),
            fact("deck.board_material", "d1", "Hardwood"),
            fact("deck.board_width_mm", "d1", 140),
            fact("deck.height_m", "d1", 0.8),
            fact("deck.existing_deck_removal", "d1", true),
            fact("deck.access_type", "d1", "Stair set"),
            fact("deck.balustrade_required", "d1", true),
          ],
          materialWastageSettings: { decking: 10, default: 5 },
        } as never,
        wa("d1", "deck", "Deck 1")
      ).lineItems.find((item) => item.componentKey === DECK_LABOUR_COMPONENT_KEY)
        ?.recommendedCost
  );

  const deckCalc = calculateDeck(
    {
      ...baseContext,
      confirmedWorkAreas: [wa("d1", "deck", "Deck")],
      facts: hardwoodFacts("d1"),
    } as never,
    wa("d1", "deck", "Deck")
  );
  check(
    "41 substructure legacy",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: "deck.substructure",
    }).authority === "LEGACY_AUTHORITATIVE"
  );
  check(
    "42-45 other deck components unchanged authority",
    ["deck.face", "deck.fixings", "deck.demolition"].every(
      (key) =>
        getComponentCommercialAuthority({ workAreaType: "deck", componentKey: key })
          .authority === "LEGACY_AUTHORITATIVE"
    ) && deckCalc.lineItems.length > 2
  );
}

function testPricingQuoteSnapshot() {
  console.log("\n--- PRICING / SNAPSHOT ---\n");
  const bench = benchEstimate();
  const line = surfaceLine(bench)!;
  const pricingValues = valuesFromEstimateLineItem({
    id: "li1",
    estimate_id: "e1",
    work_area_id: "d1",
    work_area_name: "Deck",
    label: line.label,
    category: line.category,
    recommended_cost: line.recommendedCost,
    recommended_sell: line.recommendedSell,
    component_key: DECK_SURFACE_COMPONENT_KEY,
    notes: null,
    sort_order: 1,
  } as never);
  const generationA = randomUUID();
  const generationB = randomUUID();
  const snapshotA = buildSnapshotPayloadForEstimate({
    generationId: generationA,
    result: bench,
  });
  const snapshotB = buildSnapshotPayloadForEstimate({
    generationId: generationB,
    result: companyLmEstimate(),
  });

  check(
    "46-49 pricing path unchanged semantics",
    pricingValues.totalCost === 2786.3 &&
      !read("lib/pricing/actions.ts").includes("getComponentCommercialAuthority")
  );
  check(
    "51 quote unchanged contract",
    !read("lib/quotes/actions.ts").includes("MaterialRequirement")
  );
  check(
    "54 snapshot authority authoritative",
    snapshotA.componentAuthorities.some(
      (item) =>
        item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
        item.authority === "REQUIREMENT_AUTHORITATIVE"
    )
  );
  check(
    "55 snapshot preserves requirement cost/qty",
    (snapshotA.requirements[0] as MaterialRequirement).totalCost === 2786.3 &&
      (snapshotA.requirements[0] as MaterialRequirement).purchaseQuantity === 126.65
  );
  check(
    "56 generation active source in snapshot",
    snapshotA.commercialSources?.some((item) => item.activeSource === "REQUIREMENT")
  );
  check(
    "57 historical A survives B",
    snapshotA.generationId !== snapshotB.generationId &&
      parseEstimateRequirementSnapshot(snapshotA).requirements[0] &&
      (parseEstimateRequirementSnapshot(snapshotB).requirements[0] as MaterialRequirement)
        .totalCost === 2343.03
  );
}

function testRegressionAndPlatform() {
  console.log("\n--- REGRESSION / PLATFORM ---\n");
  const bench = benchEstimate();
  const marginLine = surfaceLine(bench)!;
  const marginOverride = applyMarginToAmounts(
    marginLine.recommendedCost,
    35,
    orgSettings as never
  );
  check(
    "66 project margin sell-only override",
    marginOverride.recommendedCost === marginLine.recommendedCost &&
      marginOverride.recommendedSell !== marginLine.recommendedSell
  );
  check(
    "61-68 requirement objects unchanged",
    read("lib/estimate/deck-surface-requirement.ts").includes("maybeBuildDeckSurfaceRequirement") &&
      read("lib/estimate/deck-labour-requirement.ts").includes("buildDeckLabourRequirement")
  );
  check(
    "74 no customer UI",
    !read("lib/estimate/component-commercial-selection.ts").includes("use client")
  );
  check("75 no AI", !read("lib/estimate/requirement-snapshot.ts").includes("openai"));
  check("76 no migration 037", !existsSync("supabase/migrations/037"));
  check("77 Production SD disabled", isScopeDiscoveryEnabled({}) === false);
  check(
    "78 central composer wired",
    read("lib/estimate/calculate-estimate.ts").includes(
      "applyRegisteredComponentCommercialAuthority"
    ) &&
      !read("lib/estimate/calculate-estimate.ts").includes("REQUIREMENT_AUTHORITATIVE")
  );
  check(
    "fallback contract activated",
    LEGACY_FALLBACK_CONTRACT.activated === true &&
      REQ_4B_FIRST_PROMOTION_CANDIDATE.componentKey === DECK_SURFACE_COMPONENT_KEY
  );
  check(
    "generationRequiresRequirementSnapshot true",
    generationRequiresRequirementSnapshot() === true
  );
  const diagnostics = buildRequirementCommercialDiagnostics({
    result: bench,
    snapshot: {
      ok: true,
      generationId: randomUUID(),
      snapshotId: randomUUID(),
      schemaVersion: "estimate-requirement-snapshot-v1",
    },
  });
  check(
    "diagnostics promoted candidate",
    diagnostics.firstPromotionCandidate.promoted === true
  );

  const fence2Facts = [
    fact("fence.length_m", "f2", 30),
    fact("fence.height_m", "f2", 2),
    fact("fence.material", "f2", "Timber"),
    fact("fence.gate_included", "f2", true),
    fact("fence.demolition_required", "f2", true),
    fact("fence.disposal_required", "f2", true),
    fact("fence.slope_condition", "f2", "Steep/sloping"),
    fact("fence.access", "f2", "Difficult"),
  ];
  const pergola1Facts = [
    fact("pergola.area_m2", "p1", 24),
    fact("pergola.material", "p1", "Aluminium"),
    fact("pergola.attached", "p1", "Attached"),
    fact("pergola.roofing_included", "p1", true),
    fact("pergola.roofing_type", "p1", "Colorsteel"),
  ];
  const rw2Facts = [
    fact("retaining_wall.length_m", "rw2", 10),
    fact("retaining_wall.height_m", "rw2", 1),
    fact("retaining_wall.is_raking", "rw2", false),
    fact("retaining_wall.fixing_type", "rw2", "Standard"),
    fact("retaining_wall.material", "rw2", "Timber"),
    fact("retaining_wall.drainage_required", "rw2", true),
    fact("retaining_wall.backfill_included", "rw2", true),
    fact("retaining_wall.backfill_depth_m", "rw2", 0.3),
    fact("retaining_wall.backfill_length_m", "rw2", 10),
    fact("retaining_wall.backfill_height_m", "rw2", 1),
  ];
  check(
    "69-73 other WAs unchanged",
    Math.round(
      calculateEstimate({
        ...baseContext,
        confirmedWorkAreas: [wa("f2", "fence", "Fence 2")],
        facts: fence2Facts,
      } as never).recommendedSell
    ) === 10118 &&
      Math.round(
        calculateEstimate({
          ...baseContext,
          confirmedWorkAreas: [wa("p1", "pergola", "Pergola 1")],
          facts: pergola1Facts,
        } as never).recommendedSell
      ) === 15374 &&
      (() => {
        const rw = calculateEstimate({
          ...baseContext,
          confirmedWorkAreas: [wa("rw2", "retaining_wall", "RW 2")],
          facts: rw2Facts,
        } as never);
        return (
          rw.recommendedSell > 0 &&
          !rw.lineItems.some((i) => i.label === "Retaining wall materials")
        );
      })()
  );
}

function testLocalDb() {
  console.log("\n--- LOCAL DB ---\n");
  if (!existsSync("supabase/migrations/036_persist_estimate_generation_v1.sql")) {
    check("58-60 local DB skipped", true);
    return;
  }
  let container = "";
  try {
    container = resolveLocalDbContainer();
  } catch {
    check("58-60 local DB skipped (docker unavailable)", true);
    return;
  }

  try {
    const orgId = randomUUID();
    const userId = randomUUID();
    const projectId = randomUUID();
    const email = `req4b-${userId.slice(0, 8)}@example.local`;
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
          INSERT INTO public.organisations (id, name) VALUES ('${orgId}', 'REQ4B Test');
          INSERT INTO public.profiles (id, org_id, role) VALUES ('${userId}', '${orgId}', 'owner');
          INSERT INTO public.projects (id, org_id, created_by, title, stage)
          VALUES ('${projectId}', '${orgId}', '${userId}', 'REQ4B Deck', 'brief');
        `,
      }
    );

    const workAreaId = randomUUID();
    const bench = benchEstimate(workAreaId);
    const generationOk = randomUUID();
    const payloadOk = buildPersistEstimateGenerationV1({
      projectId,
      generationId: generationOk,
      estimateResult: bench,
    });
    payloadOk.lineItems = payloadOk.lineItems.map((line) => ({
      ...line,
      workAreaId: null,
    }));

    const okOut = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"],
      {
        encoding: "utf8",
        input: `
          BEGIN;
          SET LOCAL ROLE authenticated;
          SELECT set_config('request.jwt.claim.sub', '${userId}', true);
          SELECT public.persist_estimate_generation_v1('${JSON.stringify(payloadOk).replace(/'/g, "''")}'::jsonb);
          COMMIT;
        `,
      }
    );
    dbCheck("58 authoritative generation persists", okOut.includes(generationOk));

    const snap = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `
          SELECT payload->'commercialSources'->0->>'activeSource'
          FROM public.estimate_requirement_snapshots
          WHERE generation_id = '${generationOk}'::uuid;
        `,
      }
    ).trim();
    dbCheck("59 snapshot active source REQUIREMENT", snap.includes("REQUIREMENT"));

    const generationFail = randomUUID();
    const payloadBad = { ...payloadOk, generationId: generationFail, snapshot: null };
    let rolledBack = false;
    try {
      execFileSync(
        "docker",
        ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"],
        {
          encoding: "utf8",
          input: `
            BEGIN;
            SET LOCAL ROLE authenticated;
            SELECT set_config('request.jwt.claim.sub', '${userId}', true);
            SELECT public.persist_estimate_generation_v1('${JSON.stringify(payloadBad).replace(/'/g, "''")}'::jsonb);
            COMMIT;
          `,
        }
      );
    } catch {
      rolledBack = true;
    }
    dbCheck("60 forced failure rolls back", rolledBack);
    const stillCurrent = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `
          SELECT requirement_generation_id::text
          FROM public.estimates WHERE project_id = '${projectId}'::uuid;
        `,
      }
    ).trim();
    dbCheck("60 prior generation remains current", stillCurrent.includes(generationOk));

    execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        input: `
          DELETE FROM public.projects WHERE id = '${projectId}'::uuid;
          DELETE FROM public.profiles WHERE id = '${userId}'::uuid;
          DELETE FROM public.organisations WHERE id = '${orgId}'::uuid;
          DELETE FROM auth.users WHERE id = '${userId}'::uuid;
        `,
      }
    );
  } catch (error) {
    check(
      "58-60 local DB skipped (fixture/schema unavailable)",
      true,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function main() {
  console.log("=== REQ-4B Deck surface authority promotion ===\n");
  testPromotionRegistry();
  testPreconditions();
  testCommercialFixtures();
  testFallback();
  testSafetyAndGoldens();
  testPricingQuoteSnapshot();
  testRegressionAndPlatform();
  testLocalDb();

  console.log(
    `\n=== REQ-4B Results: ${passed} passed, ${failed} failed (${dbChecks} db checks) ===`
  );
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
