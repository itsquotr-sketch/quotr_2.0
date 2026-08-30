/**
 * SYSTEM-PERFORMANCE-SPEED-0 — in-process CPU + payload measurement.
 *
 * Does not change estimator economics, authority, or persistence.
 * Does not hit the database. Run: npx tsx scripts/measure-system-performance-speed-0.ts
 */
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { buildPersistEstimateGenerationV1 } from "../lib/estimate/persist-estimate-generation";
import { createGenerationId } from "../lib/estimate/requirement-snapshot-persist";
import { FULL_RATE_CATALOGUE } from "../lib/rates/catalogue";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateResult,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";

const RUNS = 50;
const WARMUP = 5;

const orgSettings: OrganisationSettings = {
  id: "org-settings",
  org_id: "org-1",
  default_margin_percent: 20,
  default_contingency_percent: 10,
  default_gst_rate: 15,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(
  id: string,
  type: string,
  name: string,
  sortOrder: number
): EstimateWorkArea {
  return { id, type, name, sort_order: sortOrder };
}

function factsFromRecord(
  record: Record<string, unknown>,
  workAreaId: string
): EstimateFact[] {
  return Object.entries(record).map(([key, value]) =>
    fact(key, workAreaId, value)
  );
}

function catalogueAsCompanyRates(): OrganisationRate[] {
  return FULL_RATE_CATALOGUE.filter(
    (entry) => entry.defaultCostRate != null
  ).map((entry, index) => ({
    id: `cat-${index}`,
    rate_type: entry.rate_type,
    trade: entry.trade ?? null,
    work_area_type: entry.work_area_type ?? null,
    item_key: entry.item_key,
    label: entry.label,
    unit: entry.unit,
    cost_rate: entry.defaultCostRate ?? null,
    sell_rate: entry.defaultSellRate ?? null,
    markup_percent: null,
    active: true,
  }));
}

function context(
  projectId: string,
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[],
  rates: OrganisationRate[]
): EstimateContext {
  return {
    project: { id: projectId, qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [
      { key: "access", label: "Access", value: "Good" },
      { key: "occupied_site", label: "Occupied site", value: false },
    ],
    organisationSettings: orgSettings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates,
  };
}

const simpleFixture = loadCalibrationFixture("SIMPLE-01.json");
const realJobFixture = loadCalibrationFixture("REAL-JOB-01.json");
const elevatedFixture = loadCalibrationFixture("ELEVATED-01.json");

const DECK_WA = "wa-deck";
const FENCE_WA = "wa-fence";
const RW_WA = "wa-rw";

const fenceFacts: EstimateFact[] = [
  fact("fence.length_m", FENCE_WA, 18),
  fact("fence.height_m", FENCE_WA, 1.8),
  fact("fence.system", FENCE_WA, "Timber paling — vertical board"),
  fact("fence.timber_species", FENCE_WA, "Radiata Pine"),
  fact("fence.board_thickness_mm", FENCE_WA, "150 × 19mm"),
  fact("fence.post_spacing_m", FENCE_WA, 1.8),
  fact("fence.gate_included", FENCE_WA, true),
  fact("fence.gate_count", FENCE_WA, 1),
  fact("fence.gate_width_m", FENCE_WA, 0.9),
  fact("fence.top_capping", FENCE_WA, "Yes"),
];

const rwFacts: EstimateFact[] = [
  fact("retaining_wall.length_m", RW_WA, 10),
  fact("retaining_wall.height_m", RW_WA, 1),
  fact("retaining_wall.material", RW_WA, "Timber"),
  fact("retaining_wall.face_board_section", RW_WA, "150×50 H4"),
  fact("retaining_wall.drainage_required", RW_WA, true),
  fact("retaining_wall.backfill_included", RW_WA, true),
];

type FixtureDef = {
  id: string;
  label: string;
  ctx: EstimateContext;
};

function fixtures(rates: OrganisationRate[]): FixtureDef[] {
  const deckWa = wa(DECK_WA, "deck", "Deck", 1);
  const fenceWa = wa(FENCE_WA, "fence", "Fence", 2);
  const rwWa = wa(RW_WA, "retaining_wall", "Retaining wall", 3);

  return [
    {
      id: "A",
      label: "simple single-WA (SIMPLE-01 deck)",
      ctx: context(
        "fix-a",
        [deckWa],
        factsFromRecord(simpleFixture.facts, DECK_WA),
        rates
      ),
    },
    {
      id: "B",
      label: "mature Deck (REAL-JOB-01)",
      ctx: context(
        "fix-b",
        [deckWa],
        factsFromRecord(realJobFixture.facts, DECK_WA),
        rates
      ),
    },
    {
      id: "B2",
      label: "mature Deck elevated (ELEVATED-01)",
      ctx: context(
        "fix-b2",
        [deckWa],
        factsFromRecord(elevatedFixture.facts, DECK_WA),
        rates
      ),
    },
    {
      id: "C",
      label: "mature Fence (timber paling 18m)",
      ctx: context("fix-c", [fenceWa], fenceFacts, rates),
    },
    {
      id: "D",
      label: "mature Retaining Wall (timber 10m x 1m)",
      ctx: context("fix-d", [rwWa], rwFacts, rates),
    },
    {
      id: "E",
      label: "multi-WA Deck + Fence + RW",
      ctx: context(
        "fix-e",
        [deckWa, fenceWa, rwWa],
        [
          ...factsFromRecord(simpleFixture.facts, DECK_WA),
          ...fenceFacts,
          ...rwFacts,
        ],
        rates
      ),
    },
  ];
}

function stats(samples: number[]): { avg: number; min: number; max: number; p95: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((sum, n) => sum + n, 0) / samples.length;
  const p95Index = Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * 0.95)
  );
  return {
    avg,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    p95: sorted[p95Index] ?? 0,
  };
}

function timeFn(fn: () => void, runs: number, warmup: number): ReturnType<typeof stats> & { firstMs: number } {
  const firstStart = performance.now();
  fn();
  const firstMs = performance.now() - firstStart;
  for (let i = 0; i < warmup; i += 1) fn();
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return { ...stats(samples), firstMs };
}

function bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function fmt(ms: number): string {
  return ms < 1 ? `${ms.toFixed(3)}ms` : `${ms.toFixed(2)}ms`;
}

function kb(n: number): string {
  return `${(n / 1024).toFixed(1)} KB`;
}

function summariseEstimate(result: EstimateResult) {
  const included = result.lineItems.filter((item) => item.includedInTotal !== false);
  return {
    lineItems: result.lineItems.length,
    includedLineItems: included.length,
    requirements: result.requirements?.length ?? 0,
    assumptions: result.assumptions.length,
    missingInfo: result.missingInfo.length,
    recommendedCost: result.recommendedCost,
    recommendedSell: result.recommendedSell,
  };
}

function jobPlanInput(fix: FixtureDef) {
  return {
    workAreas: fix.ctx.confirmedWorkAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
      sortOrder: row.sort_order,
    })),
    facts: fix.ctx.facts,
    constraints: fix.ctx.constraints.map((row) => ({
      key: row.key,
      value: row.value,
    })),
    qualityLevel: "standard",
    briefText: "Builder-sized outdoor job for performance baseline.",
  };
}

function runRateSet(label: string, rates: OrganisationRate[]): void {
  console.log(`\n======== ${label} (${rates.length} company rates) ========`);
  const set = fixtures(rates);

  for (const fix of set) {
    const estimate = calculateEstimate(fix.ctx);
    const persistPayload = buildPersistEstimateGenerationV1({
      projectId: fix.ctx.project.id,
      generationId: createGenerationId(),
      estimateResult: estimate,
    });
    const jobPlan = composeJobPlan(jobPlanInput(fix));
    const clarify = composeClarifyView({
      stage: "ready_to_estimate",
      briefText: "Builder-sized outdoor job for performance baseline.",
      qualityLevel: "standard",
      workAreas: jobPlanInput(fix).workAreas,
      facts: fix.ctx.facts,
      constraints: jobPlanInput(fix).constraints ?? [],
      jobPlan,
    });
    composeEstimateReadiness({
      clarify,
      jobPlan,
      qualityLevel: "standard",
      constraints: jobPlanInput(fix).constraints ?? [],
    });
    const builderReview = composeBuilderReview({
      estimate: {
        recommendedCost: estimate.recommendedCost,
        recommendedSell: estimate.recommendedSell,
        marginPercent: estimate.marginPercent,
        confidence: estimate.confidence,
        assumptions: estimate.assumptions,
        missingInfo: estimate.missingInfo,
        lineItems: estimate.lineItems as unknown as EstimateLineItem[],
      },
      workAreas: jobPlanInput(fix).workAreas,
      requirements: estimate.requirements,
    });

    const calc = timeFn(() => {
      calculateEstimate(fix.ctx);
    }, RUNS, WARMUP);
    const persistBuild = timeFn(() => {
      buildPersistEstimateGenerationV1({
        projectId: fix.ctx.project.id,
        generationId: "gen-perf",
        estimateResult: estimate,
      });
    }, RUNS, WARMUP);
    const jp = timeFn(() => {
      composeJobPlan(jobPlanInput(fix));
    }, RUNS, WARMUP);
    const cl = timeFn(() => {
      composeClarifyView({
        stage: "ready_to_estimate",
        briefText: "Builder-sized outdoor job for performance baseline.",
        qualityLevel: "standard",
        workAreas: jobPlanInput(fix).workAreas,
        facts: fix.ctx.facts,
        constraints: jobPlanInput(fix).constraints ?? [],
        jobPlan,
      });
    }, RUNS, WARMUP);
    const br = timeFn(() => {
      composeBuilderReview({
        estimate: {
          recommendedCost: estimate.recommendedCost,
          recommendedSell: estimate.recommendedSell,
          marginPercent: estimate.marginPercent,
          confidence: estimate.confidence,
          assumptions: estimate.assumptions,
          missingInfo: estimate.missingInfo,
          lineItems: estimate.lineItems as unknown as EstimateLineItem[],
        },
        workAreas: jobPlanInput(fix).workAreas,
        requirements: estimate.requirements,
      });
    }, RUNS, WARMUP);

    const summary = summariseEstimate(estimate);
    console.log(`\n-- Fixture ${fix.id}: ${fix.label} --`);
    console.log(
      `  lines=${summary.lineItems} included=${summary.includedLineItems} reqs=${summary.requirements} assumptions=${summary.assumptions} missing=${summary.missingInfo}`
    );
    console.log(
      `  recommendedCost=${summary.recommendedCost.toFixed(2)} recommendedSell=${summary.recommendedSell.toFixed(2)}`
    );
    console.log(
      `  calculateEstimate  first=${fmt(calc.firstMs)} avg=${fmt(calc.avg)} p95=${fmt(calc.p95)} min=${fmt(calc.min)} max=${fmt(calc.max)}`
    );
    console.log(
      `  persist payload build  avg=${fmt(persistBuild.avg)} size=${kb(bytes(persistPayload))}`
    );
    console.log(
      `  composeJobPlan avg=${fmt(jp.avg)}  composeClarify avg=${fmt(cl.avg)}  composeBuilderReview avg=${fmt(br.avg)}`
    );
    console.log(
      `  estimate JSON=${kb(bytes(estimate))} snapshot=${kb(bytes(persistPayload.snapshot))} builderReview JSON=${kb(bytes(builderReview))}`
    );
  }
}

function main(): void {
  console.log("SYSTEM-PERFORMANCE-SPEED-0 CPU measurement");
  console.log(`Node ${process.version}  runs=${RUNS} warmup=${WARMUP}`);
  console.log(`FULL_RATE_CATALOGUE entries=${FULL_RATE_CATALOGUE.length}`);
  console.log(
    "Classification: MEASURED (in-process local CPU). Not network, not DB, not RSC."
  );

  runRateSet("benchmark / empty company rates", []);
  runRateSet("full catalogue as company rates", catalogueAsCompanyRates());
}

main();
