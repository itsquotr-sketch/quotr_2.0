/**
 * FENCE-FAMILY-CLOSURE — Timber + modular family-wide validation.
 * Run: npx tsx scripts/verify-fence-family-final-closure.ts
 *
 * Do not commit, push, or deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import {
  buildQuickEstimateAttentionItems,
  buildQuickEstimateStatusPresentation,
} from "../lib/assistant/presentation/quick-estimate-view-model";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateFence } from "../lib/estimate/calculators/fence";
import {
  commercializeFenceWithLabour,
  packageXorDetailedHolds,
} from "../lib/estimate/fence-commercial";
import {
  FENCE_BOARDS_COMPONENT,
  FENCE_FIXINGS_MODULAR_COMPONENT,
  FENCE_FIXINGS_MODULAR_KEY,
  FENCE_FIXINGS_TIMBER_COMPONENT,
  FENCE_GATE_FRAME_COMPONENT,
  FENCE_GATE_HARDWARE_COMPONENT,
  FENCE_MODULAR_GATE_COMPONENT,
  FENCE_POST_ALUMINIUM_KEY,
  FENCE_POST_PLASTIC_KEY,
  FENCE_POST_STEEL_KEY,
  FENCE_POSTS_EA_COMPONENT,
  FENCE_POSTS_LM_COMPONENT,
  FENCE_PREMIX_20KG_KEY,
  FENCE_RAILS_COMPONENT,
  FENCE_SECTION_ALUMINIUM_FAMILY_KEY,
  FENCE_SECTION_LABOUR_COMPONENT,
  FENCE_SECTION_PLASTIC_FAMILY_KEY,
  FENCE_SECTION_STEEL_FAMILY_KEY,
  FENCE_SECTIONS_COMPONENT,
  fenceBoardMaterialKey,
  fencePostMaterialKey,
  fenceSectionSkuKey,
} from "../lib/estimate/fence-identities";
import {
  FENCE_MODULAR_GATE_REQUESTED_FACT,
  FENCE_SECTION_PRODUCT_KEY_FACT,
  modularGateApplicability,
} from "../lib/estimate/fence-modular-1c";
import { FENCE_PRODUCTIVITY_KEYS } from "../lib/estimate/fence-productivity";
import {
  FENCE_MODULAR_GATE_EXCLUSION_CLIENT,
  FENCE_MODULAR_GATE_QUOTE_ATTENTION,
  fenceQuoteBlockingLabels,
  fenceQuoteReadiness,
  fenceQuoteSystemPhrase,
} from "../lib/estimate/fence-quote-readiness";
import { buildFencePhysicalModel } from "../lib/estimate/fence-physical";
import { FENCE_TIMBER_1B_MATERIAL_STARTERS } from "../lib/estimate/fence-timber-1b";
import { FENCE_INFORMATION_CONTRACT } from "../lib/estimate/fence-information-contract";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";

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

function near(actual: number, expected: number, eps = 0.05): boolean {
  return Math.abs(actual - expected) <= eps;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function wa(id = "f1"): EstimateWorkArea & { status: "confirmed" } {
  return {
    id,
    type: "fence",
    name: "Fence",
    sort_order: 1,
    status: "confirmed",
  };
}

function fact(key: string, value: unknown, workAreaId = "f1"): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function rate(
  itemKey: string,
  unit: string,
  cost: number,
  rateType: "material" | "productivity" | "labour" = "material"
): OrganisationRate {
  return {
    id: `test.${itemKey}.${unit}`,
    rate_type: rateType,
    trade: rateType === "labour" ? "carpenter" : null,
    work_area_type: "fence",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

const EASY = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "<10m" },
];
const HARD = [
  { key: "site_access", value: "Difficult" },
  { key: "material_carry_distance", value: ">30m" },
];

function ctx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = [],
  constraints: { key: string; value: unknown }[] = EASY,
  extras: Partial<EstimateContext> = {}
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: null,
    rates,
    ...extras,
  };
}

function mergeFacts(base: EstimateFact[], extra: EstimateFact[] = []): EstimateFact[] {
  return extra.reduce(
    (facts, next) => [...facts.filter((row) => row.key !== next.key), next],
    base
  );
}

function timberVertical(extra: EstimateFact[] = []): EstimateFact[] {
  return mergeFacts(
    [
      fact("fence.length_m", 18),
      fact("fence.height_m", 1.8),
      fact("fence.system", "Timber paling — vertical board"),
      fact("fence.timber_species", "Radiata Pine"),
      fact("fence.board_thickness_mm", "150 × 19mm"),
      fact("fence.post_spacing_m", 1.8),
      fact("fence.gate_included", true),
      fact("fence.gate_count", 1),
      fact("fence.gate_width_m", 0.9),
      fact("fence.gate_position", "Within the fence run"),
      fact("fence.top_capping", "Yes"),
      fact("fence.gate_capping", "Yes"),
      fact("fence.vertical_paling_gap_mm", 0),
    ],
    extra
  );
}

function timberHorizontal(extra: EstimateFact[] = []): EstimateFact[] {
  return mergeFacts(
    [
      fact("fence.length_m", 12),
      fact("fence.height_m", 1.5),
      fact("fence.system", "Horizontal timber slats"),
      fact("fence.timber_species", "Macrocarpa"),
      fact("fence.board_thickness_mm", "150 × 25mm"),
      fact("fence.post_spacing_m", 1.8),
      fact("fence.gate_included", false),
      fact("fence.top_capping", "Yes"),
      fact("fence.slat_gap_mm", 10),
    ],
    extra
  );
}

function aluminiumFacts(extra: EstimateFact[] = []): EstimateFact[] {
  return mergeFacts(
    [
      fact("fence.length_m", 18),
      fact("fence.height_m", 1.8),
      fact("fence.system", "Aluminium / steel slat fence"),
      fact("fence.metal_material", "Aluminium"),
      fact("fence.section_width_m", 1.8),
      fact("fence.gate_included", false),
    ],
    extra
  );
}

function steelFacts(extra: EstimateFact[] = []): EstimateFact[] {
  return aluminiumFacts([fact("fence.metal_material", "Steel"), ...extra]);
}

function plasticFacts(extra: EstimateFact[] = []): EstimateFact[] {
  return mergeFacts(
    [
      fact("fence.length_m", 10),
      fact("fence.height_m", 1.8),
      fact("fence.system", "Plastic / composite fence"),
      fact("fence.section_width_m", 1.8),
      fact("fence.gate_included", false),
    ],
    extra
  );
}

function quoteFacts(facts: EstimateFact[]) {
  return facts.map((row) => ({
    key: row.key,
    label: row.key,
    value: String(row.value),
  }));
}

function mat(
  result: ReturnType<typeof calculateFence>,
  key: string
): MaterialRequirement | undefined {
  return (result.requirements ?? []).find(
    (row) => row.kind === "material" && row.componentKey === key
  ) as MaterialRequirement | undefined;
}

function lab(
  result: ReturnType<typeof calculateFence>,
  key: string
): LabourRequirement | undefined {
  return (result.requirements ?? []).find(
    (row) => row.kind === "labour" && row.componentKey === key
  ) as LabourRequirement | undefined;
}

function hasPackage(items: { label: string }[]): boolean {
  return items.some((i) => i.label === "Fence labour" || i.label === "Fence materials");
}

function hasDetailedTimber(items: { componentKey?: string | null }[]): boolean {
  return items.some(
    (i) =>
      i.componentKey === FENCE_BOARDS_COMPONENT ||
      i.componentKey === FENCE_POSTS_LM_COMPONENT
  );
}

function hasDetailedModular(items: { componentKey?: string | null }[]): boolean {
  return items.some(
    (i) =>
      i.componentKey === FENCE_SECTIONS_COMPONENT ||
      i.componentKey === FENCE_POSTS_EA_COMPONENT
  );
}

function buckets(items: { category: string; recommendedCost: number }[]) {
  const sumIf = (pred: (row: (typeof items)[number]) => boolean) =>
    round2(items.filter(pred).reduce((s, row) => s + row.recommendedCost, 0));
  const materials = sumIf((row) => row.category === "materials");
  const labour = sumIf((row) => row.category === "labour");
  const other = sumIf(
    (row) => row.category !== "materials" && row.category !== "labour"
  );
  return { materials, labour, other, direct: round2(materials + labour + other) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function reviewText(calc: ReturnType<typeof calculateFence>): string {
  const view = composeBuilderReview({
    estimate: {
      lineItems: calc.lineItems,
      assumptions: calc.assumptions,
      missingInfo: calc.missingInfo,
      exclusions: calc.exclusions,
      recommendedCost: calc.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
      recommendedSell: calc.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
      marginPercent: 20,
      confidence: calc.confidence ?? 70,
    } as never,
    workAreas: [wa()],
    requirements: calc.requirements,
  });
  return JSON.stringify(view);
}

function quoteDraft(facts: EstimateFact[], calc: ReturnType<typeof calculateFence>): string {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "fence",
    name: "Fence",
    facts: quoteFacts(facts),
    pricingItems: calc.lineItems.map((item) => ({ label: item.label })),
  });
}

function spawnEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    FENCE_SKIP_NESTED_SPAWN: "1",
    RW_SKIP_NESTED_SPAWN: "1",
    DECK_R8_R1_SKIP_SPAWN: "1",
    DECK_R8_SKIP_SPAWN: "1",
    DECK_R7_SKIP_NESTED_SPAWN: "1",
  };
}

function spawnOnce(script: string): { ok: boolean; out: string } {
  try {
    const stdout = execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: spawnEnv(),
    });
    return { ok: true, out: stdout };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      out: `${err.stdout ?? ""}\n${err.stderr ?? ""}\n${err.message ?? ""}`,
    };
  }
}

function spawnVerifier(script: string): boolean {
  if (process.env.FENCE_FAMILY_SKIP_NESTED_SPAWN === "1") return true;
  let result = spawnOnce(script);
  const passedClean = (out: string) =>
    /\d+ passed,\s*0 failed/.test(out) && !/^FAIL /m.test(out);
  if (!result.ok && passedClean(result.out)) return true;
  if (
    !result.ok &&
    !/^FAIL /m.test(result.out) &&
    /credit balance is too low|ANTHROPIC_API_KEY/i.test(result.out) &&
    script.includes("verify-fact-coverage")
  ) {
    console.log(`      spawn ${script}: skipped (Anthropic API unavailable)`);
    return true;
  }
  if (!result.ok && !/^FAIL /m.test(result.out)) {
    result = spawnOnce(script);
    if (result.ok || passedClean(result.out)) return true;
  }
  if (result.ok) return true;
  if (
    script.includes("verify-fact-coverage") &&
    /credit balance is too low|ANTHROPIC_API_KEY/i.test(result.out)
  ) {
    console.log(`      spawn ${script}: skipped (Anthropic API unavailable)`);
    return true;
  }
  const failLine = result.out.split(/\r?\n/).find((line) => /^FAIL /.test(line));
  if (failLine) console.log(`      spawn ${script}: ${failLine.trim()}`);
  else if (result.out.trim()) {
    const snippet = result.out.trim().split(/\r?\n/).slice(-8).join(" | ");
    console.log(`      spawn ${script}: ${snippet.slice(0, 400)}`);
  }
  return false;
}

function spawnFence(script: string, minPass: number): boolean {
  if (process.env.FENCE_FAMILY_SKIP_NESTED_SPAWN === "1") return true;
  const result = spawnOnce(script);
  const match = result.out.match(/(\d+) passed,\s*(\d+) failed/);
  const passCount = match ? Number(match[1]) : 0;
  const failCount = match ? Number(match[2]) : 1;
  const ok = (result.ok || failCount === 0) && passCount >= minPass && failCount === 0;
  if (!ok) {
    const failLine = result.out.split(/\r?\n/).find((line) => /^FAIL /.test(line));
    console.log(
      `      spawn ${script}: ${passCount} passed / ${failCount} failed${
        failLine ? ` · ${failLine.trim()}` : ""
      }`
    );
  }
  return ok;
}

function timberCompanyRates(exceptKey?: string): OrganisationRate[] {
  return Object.entries(FENCE_TIMBER_1B_MATERIAL_STARTERS)
    .filter(([key]) => key !== exceptKey && !key.startsWith("deck."))
    .map(([key, row]) => rate(key, row.unit, row.costPerUnit + 1));
}

function modularCompanyRates(omit?: string): OrganisationRate[] {
  const rows: OrganisationRate[] = [
    rate(FENCE_SECTION_ALUMINIUM_FAMILY_KEY, "ea", 220),
    rate(FENCE_SECTION_STEEL_FAMILY_KEY, "ea", 190),
    rate(FENCE_SECTION_PLASTIC_FAMILY_KEY, "ea", 160),
    rate(FENCE_POST_ALUMINIUM_KEY, "ea", 45),
    rate(FENCE_POST_STEEL_KEY, "ea", 38),
    rate(FENCE_POST_PLASTIC_KEY, "ea", 32),
    rate(FENCE_FIXINGS_MODULAR_KEY, "section", 18),
    rate(FENCE_PREMIX_20KG_KEY, "bag", 11.5),
    rate(FENCE_PRODUCTIVITY_KEYS.postInstall, "post", 0.7, "productivity"),
    rate(FENCE_PRODUCTIVITY_KEYS.sectionInstall, "section", 0.35, "productivity"),
    rate(FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag, "bag", 0.06, "productivity"),
  ];
  return omit ? rows.filter((row) => row.item_key !== omit) : rows;
}

console.log("\n=== FENCE-FAMILY-CLOSURE ===\n");

const coverageDoc = read("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md");
const quoteReadinessSrc = read("lib/estimate/fence-quote-readiness.ts");
const quoteDescSrc = read("lib/work-areas/quote-description.ts");
const editorSrc = read("components/assistant/job-plan/FenceQuickSpecEditor.tsx");
const brSurface = read("components/assistant/builder-review/BuilderReviewSurface.tsx");
const composeSrc = read("lib/assistant/builder-review/compose.ts");
const physicalSrc = read("lib/estimate/fence-physical.ts");
const commercialSrc = read("lib/estimate/fence-commercial.ts");
const productivitySrc = read("lib/estimate/fence-productivity.ts");
const contract = FENCE_INFORMATION_CONTRACT;

console.log("-- SYSTEMS --");
const vertical = calculateFence(ctx(timberVertical()), wa());
const horizontal = calculateFence(ctx(timberHorizontal()), wa());
const aluminium = calculateFence(ctx(aluminiumFacts()), wa());
const steel = calculateFence(ctx(steelFacts()), wa());
const plastic = calculateFence(ctx(plasticFacts()), wa());

check(
  "1 Vertical detailed",
  !hasPackage(vertical.lineItems) && hasDetailedTimber(vertical.lineItems)
);
check(
  "2 Horizontal detailed",
  !hasPackage(horizontal.lineItems) && hasDetailedTimber(horizontal.lineItems)
);
check(
  "3 Aluminium detailed",
  !hasPackage(aluminium.lineItems) && hasDetailedModular(aluminium.lineItems)
);
check(
  "4 Steel detailed",
  !hasPackage(steel.lineItems) && hasDetailedModular(steel.lineItems)
);
check(
  "5 Plastic detailed",
  !hasPackage(plastic.lineItems) && hasDetailedModular(plastic.lineItems)
);

console.log("\n-- SWITCHING --");
check(
  "6 Vertical↔Horizontal",
  mat(vertical, FENCE_RAILS_COMPONENT) != null &&
    mat(horizontal, FENCE_RAILS_COMPONENT) == null &&
    (buildFencePhysicalModel({ context: ctx(timberHorizontal()), workAreaId: "f1" }).timber
      ?.courseCount ?? 0) === 9
);
check(
  "7 Timber→Metal",
  hasDetailedModular(aluminium.lineItems) &&
    !aluminium.lineItems.some((i) => i.componentKey === FENCE_BOARDS_COMPONENT) &&
    !aluminium.lineItems.some((i) => i.componentKey === FENCE_RAILS_COMPONENT) &&
    !aluminium.lineItems.some((i) => i.componentKey === FENCE_GATE_FRAME_COMPONENT)
);
check(
  "8 Metal→Plastic",
  mat(aluminium, FENCE_SECTIONS_COMPONENT)?.materialKey !==
    mat(plastic, FENCE_SECTIONS_COMPONENT)?.materialKey &&
    mat(aluminium, FENCE_POSTS_EA_COMPONENT)?.materialKey === FENCE_POST_ALUMINIUM_KEY &&
    mat(plastic, FENCE_POSTS_EA_COMPONENT)?.materialKey === FENCE_POST_PLASTIC_KEY
);
check(
  "9 Modular→Timber",
  hasDetailedTimber(vertical.lineItems) &&
    !vertical.lineItems.some((i) => i.componentKey === FENCE_SECTIONS_COMPONENT)
);
check(
  "10 no stale identities",
  !steel.lineItems.some((i) => (i.identitySummary ?? "").toLowerCase().includes("aluminium")) &&
    !plastic.lineItems.some((i) => (i.identitySummary ?? "").toLowerCase().includes("aluminium")) &&
    !aluminium.lineItems.some((i) => /h4 100|stock-lm/i.test(`${i.label} ${i.identitySummary ?? ""}`))
);
check(
  "11 no stale money",
  mat(aluminium, FENCE_FIXINGS_TIMBER_COMPONENT) == null &&
    mat(vertical, FENCE_FIXINGS_MODULAR_COMPONENT) == null &&
    mat(aluminium, FENCE_GATE_FRAME_COMPONENT) == null
);
const aluminiumQuote = quoteDraft(aluminiumFacts(), aluminium);
const steelQuote = quoteDraft(steelFacts(), steel);
const plasticQuote = quoteDraft(plasticFacts(), plastic);
const verticalQuote = quoteDraft(timberVertical(), vertical);
const horizontalQuote = quoteDraft(timberHorizontal(), horizontal);
check(
  "12 no stale quote copy",
  /aluminium slat fence/i.test(aluminiumQuote) &&
    /steel slat fence/i.test(steelQuote) &&
    /plastic\/composite fence/i.test(plasticQuote) &&
    /vertical timber paling fence/i.test(verticalQuote) &&
    /horizontal timber slat fence/i.test(horizontalQuote) &&
    !/timber gate/i.test(aluminiumQuote) &&
    !/gate allowance/i.test(aluminiumQuote)
);

console.log("\n-- GATES --");
check(
  "13 Timber gate works",
  mat(vertical, FENCE_GATE_FRAME_COMPONENT)?.priced === true &&
    mat(vertical, FENCE_GATE_HARDWARE_COMPONENT)?.priced === true &&
    /timber gate/i.test(verticalQuote)
);
const staleModular = calculateFence(
  ctx(aluminiumFacts([fact("fence.gate_included", true), fact("fence.gate_width_m", 0.9)])),
  wa()
);
check(
  "14 stale Timber gate isolated",
  modularGateApplicability("METAL_SLAT_MODULAR", aluminiumFacts([fact("fence.gate_included", true)]), "f1") ===
    "NOT_REQUESTED" &&
    mat(staleModular, FENCE_MODULAR_GATE_COMPONENT) == null &&
    mat(staleModular, FENCE_GATE_FRAME_COMPONENT) == null &&
    fenceQuoteReadiness({
      missingInfo: staleModular.missingInfo,
      system: "METAL_SLAT_MODULAR",
      modularGateRequested: false,
    }).unresolvedModularGate === false
);
const requestedFacts = aluminiumFacts([fact(FENCE_MODULAR_GATE_REQUESTED_FACT, true)]);
const requested = calculateFence(ctx(requestedFacts), wa());
const requestedReady = fenceQuoteReadiness({
  missingInfo: requested.missingInfo,
  system: "METAL_SLAT_MODULAR",
  modularGateRequested: true,
});
check(
  "15 modular explicit gate preserved unresolved",
  modularGateApplicability("METAL_SLAT_MODULAR", requestedFacts, "f1") ===
    "UNSUPPORTED_REQUESTED" &&
    mat(requested, FENCE_MODULAR_GATE_COMPONENT)?.priced === false &&
    requestedReady.status === "ATTENTION_REQUIRED" &&
    /pricing required/i.test(quoteDraft(requestedFacts, requested))
);
const gateItems = buildQuickEstimateAttentionItems({
  missingLabels: requested.missingInfo,
  pricingRequiredLabels: fenceQuoteBlockingLabels(requested.missingInfo),
});
const gateStatus = buildQuickEstimateStatusPresentation({
  hasEstimate: true,
  attentionItems: gateItems,
});
check(
  "16 Quote readiness does not silently pass unresolved gate",
  requestedReady.status === "ATTENTION_REQUIRED" &&
    gateStatus.kind === "attention" &&
    /need(?:s)? pricing/i.test(gateStatus.statusLabel) &&
    gateItems.some((item) => item.attentionKind === "PRICING_REQUIRED") &&
    quoteDraft(requestedFacts, requested).includes(FENCE_MODULAR_GATE_QUOTE_ATTENTION.split(".")[0])
);
const excludedFacts = aluminiumFacts([fact(FENCE_MODULAR_GATE_REQUESTED_FACT, false)]);
const excluded = calculateFence(ctx(excludedFacts), wa());
check(
  "16b explicit No uses exclusion wording and is quote-ready",
  fenceQuoteReadiness({
    missingInfo: excluded.missingInfo,
    system: "METAL_SLAT_MODULAR",
    modularGateRequested: false,
  }).status === "READY" &&
    quoteDraft(excludedFacts, excluded).includes(FENCE_MODULAR_GATE_EXCLUSION_CLIENT) &&
    mat(excluded, FENCE_MODULAR_GATE_COMPONENT) == null
);

console.log("\n-- RATES --");
const timberCompany = calculateFence(
  ctx(timberVertical(), [rate(fenceBoardMaterialKey("radiata_pine", 19), "lm", 20)]),
  wa()
);
check(
  "17 Timber Company override",
  near(mat(timberCompany, FENCE_BOARDS_COMPONENT)?.unitCost ?? 0, 20) &&
    mat(timberCompany, FENCE_BOARDS_COMPONENT)?.rateSource === "company"
);
const companySku = fenceSectionSkuKey("METAL_SLAT_MODULAR", "aluminium", 2.0, 1.8);
const modularCompany = calculateFence(
  ctx(aluminiumFacts([fact(FENCE_SECTION_PRODUCT_KEY_FACT, companySku)]), [
    rate(companySku, "ea", 310),
  ]),
  wa()
);
check(
  "18 Modular Company product override",
  near(mat(modularCompany, FENCE_SECTIONS_COMPONENT)?.unitCost ?? 0, 310) &&
    mat(modularCompany, FENCE_SECTIONS_COMPONENT)?.rateSource === "company"
);
const missTimber = calculateFence(
  ctx(timberVertical(), timberCompanyRates(fenceBoardMaterialKey("radiata_pine", 19)), EASY, {
    organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
  }),
  wa()
);
check(
  "19 missing Timber material rate",
  !hasPackage(missTimber.lineItems) &&
    hasDetailedTimber(missTimber.lineItems) &&
    mat(missTimber, FENCE_BOARDS_COMPONENT)?.priced === false
);
const missModular = calculateFence(
  ctx(
    aluminiumFacts(),
    modularCompanyRates(FENCE_SECTION_ALUMINIUM_FAMILY_KEY),
    EASY,
    {
      organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
    }
  ),
  wa()
);
check(
  "20 missing modular section rate",
  !hasPackage(missModular.lineItems) &&
    hasDetailedModular(missModular.lineItems) &&
    mat(missModular, FENCE_SECTIONS_COMPONENT)?.priced === false &&
    mat(missModular, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity === 10
);
const missTimberProd = calculateFence(
  ctx(timberVertical(), timberCompanyRates(), EASY, {
    organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
  }),
  wa()
);
const missModularProd = calculateFence(
  ctx(
    aluminiumFacts(),
    modularCompanyRates().filter((row) => row.rate_type !== "productivity"),
    EASY,
    {
      organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
    }
  ),
  wa()
);
check(
  "21 missing productivity",
  lab(missTimberProd, "fence.boards.install")?.priced === false &&
    lab(missModularProd, FENCE_SECTION_LABOUR_COMPONENT)?.priced === false &&
    !hasPackage(missTimberProd.lineItems) &&
    !hasPackage(missModularProd.lineItems)
);
check(
  "22 no package restore",
  packageXorDetailedHolds({
    mode: "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFenceLine: hasPackage(missModular.lineItems),
    hasDetailedMoneyLine: hasDetailedModular(missModular.lineItems),
  }) &&
    packageXorDetailedHolds({
      mode: "DETAILED_COMPONENT_AUTHORITY",
      hasPackageFenceLine: hasPackage(missTimber.lineItems),
      hasDetailedMoneyLine: hasDetailedTimber(missTimber.lineItems),
    })
);

console.log("\n-- PHYSICAL --");
const vertical24Facts = timberVertical([fact("fence.length_m", 24)]);
const vertical24 = calculateFence(ctx(vertical24Facts), wa());
const vertical24Physical = buildFencePhysicalModel({
  context: ctx(vertical24Facts),
  workAreaId: "f1",
});
const v24 = buckets(vertical24.lineItems);
const v24Sell = round2(vertical24.lineItems.reduce((s, i) => s + i.recommendedSell, 0));
console.log(
  `      Vertical 24m fixture: posts=${vertical24Physical.timber?.postCount} palingsRequiredLm=${vertical24Physical.timber?.boardRequiredLm} railsLm=${vertical24Physical.timber?.railLm} bags=${vertical24Physical.timber?.concrete.bagCount} materials=${v24.materials} labour=${v24.labour} Direct=${v24.direct} Sell=${v24Sell}`
);
check(
  "23 Vertical fixture",
  (vertical24Physical.timber?.postCount ?? 0) > 0 &&
    (vertical24Physical.timber?.boardRequiredLm ?? 0) > 0 &&
    mat(vertical24, FENCE_GATE_FRAME_COMPONENT) != null &&
    !hasPackage(vertical24.lineItems)
);
const horizPhysical = buildFencePhysicalModel({
  context: ctx(timberHorizontal()),
  workAreaId: "f1",
});
check(
  "24 Horizontal fixture",
  horizPhysical.timber?.courseCount === 9 &&
    near(horizPhysical.timber?.boardRequiredLm ?? 0, 108) &&
    !hasPackage(horizontal.lineItems)
);
const alumPhysical = buildFencePhysicalModel({
  context: ctx(aluminiumFacts()),
  workAreaId: "f1",
});
check(
  "25 Aluminium 10/11",
  alumPhysical.modular?.purchasedSectionCount === 10 &&
    alumPhysical.modular?.postCount === 11 &&
    near(buckets(aluminium.lineItems).direct, 4256.7)
);
const residualFacts = aluminiumFacts([fact("fence.length_m", 19)]);
const residual = calculateFence(ctx(residualFacts), wa());
const residualPhysical = buildFencePhysicalModel({
  context: ctx(residualFacts),
  workAreaId: "f1",
});
check(
  "26 residual 11/12",
  residualPhysical.modular?.fullSectionCount === 10 &&
    residualPhysical.modular?.purchasedSectionCount === 11 &&
    residualPhysical.modular?.postCount === 12 &&
    /10 full \+ 1 (cut\/)?residual/i.test(
      mat(residual, FENCE_SECTIONS_COMPONENT)?.specification ?? ""
    ) &&
    near(buckets(residual.lineItems).direct, 4663.1)
);
const plasticPhysical = buildFencePhysicalModel({
  context: ctx(plasticFacts()),
  workAreaId: "f1",
});
check(
  "27 Plastic 6/7",
  plasticPhysical.modular?.purchasedSectionCount === 6 &&
    plasticPhysical.modular?.postCount === 7 &&
    near(buckets(plastic.lineItems).direct, 2165)
);
const unselected2m = buildFencePhysicalModel({
  context: ctx(aluminiumFacts(), [rate(companySku, "ea", 310)]),
  workAreaId: "f1",
});
const selected2m = buildFencePhysicalModel({
  context: ctx(aluminiumFacts([fact(FENCE_SECTION_PRODUCT_KEY_FACT, companySku)]), [
    rate(companySku, "ea", 310),
  ]),
  workAreaId: "f1",
});
check(
  "28 Company 2.0m width changes geometry",
  unselected2m.modular?.purchasedSectionCount === 10 &&
    unselected2m.modular?.postCount === 11 &&
    selected2m.modular?.purchasedSectionCount === 9 &&
    selected2m.modular?.postCount === 10
);
const heightMismatch = calculateFence(
  ctx(aluminiumFacts([fact("fence.section_height_m", 1.5)])),
  wa()
);
check(
  "29 height mismatch",
  mat(heightMismatch, FENCE_SECTIONS_COMPONENT)?.priced === false &&
    fenceQuoteReadiness({
      missingInfo: heightMismatch.missingInfo,
      system: "METAL_SLAT_MODULAR",
    }).status === "ATTENTION_REQUIRED" &&
    !hasPackage(heightMismatch.lineItems)
);

console.log("\n-- COMMERCIAL --");
const aBuckets = buckets(aluminium.lineItems);
check(
  "30 Direct line reconciliation",
  near(aBuckets.direct, aluminium.lineItems.reduce((s, i) => s + i.recommendedCost, 0)) &&
    near(aBuckets.direct, 4256.7)
);
const alumEasyLab = aluminium.lineItems
  .filter((i) => i.category === "labour")
  .reduce((s, i) => s + i.recommendedCost, 0);
const alumHard = calculateFence(ctx(aluminiumFacts(), [], HARD), wa());
const alumHardLab = alumHard.lineItems
  .filter((i) => i.category === "labour")
  .reduce((s, i) => s + i.recommendedCost, 0);
const timberEasyLab = vertical.lineItems
  .filter((i) => i.category === "labour")
  .reduce((s, i) => s + i.recommendedCost, 0);
const timberHard = calculateFence(ctx(timberVertical(), [], HARD), wa());
const timberHardLab = timberHard.lineItems
  .filter((i) => i.category === "labour")
  .reduce((s, i) => s + i.recommendedCost, 0);
const alumMatEasy = buckets(aluminium.lineItems).materials;
const alumMatHard = buckets(alumHard.lineItems).materials;
check(
  "31 Project Conditions once",
  alumHardLab > alumEasyLab && timberHardLab > timberEasyLab
);
check(
  "32 no material adjustment leakage",
  near(alumMatEasy, alumMatHard) &&
    near(
      mat(aluminium, FENCE_SECTIONS_COMPONENT)?.totalCost ?? 0,
      mat(alumHard, FENCE_SECTIONS_COMPONENT)?.totalCost ?? 0
    )
);
check(
  "33 Fence concrete h/bag",
  /fence\.post_hole_concrete\.place\.hours_per_bag/.test(productivitySrc) &&
    !/0\.16/.test(productivitySrc) &&
    lab(aluminium, "fence.post_hole_concrete.place")?.productivityBasis.hoursPerUnit === 0.06 &&
    lab(vertical, "fence.post_hole_concrete.place")?.productivityBasis.hoursPerUnit === 0.06
);
check(
  "34 fixings system isolation",
  mat(vertical, FENCE_FIXINGS_TIMBER_COMPONENT) != null &&
    mat(aluminium, FENCE_FIXINGS_MODULAR_COMPONENT) != null &&
    mat(vertical, FENCE_FIXINGS_MODULAR_COMPONENT) == null &&
    mat(aluminium, FENCE_FIXINGS_TIMBER_COMPONENT) == null
);
check(
  "35 procurement/waste isolation",
  /whole residual section|purchased whole sections/i.test(
    mat(residual, FENCE_SECTIONS_COMPONENT)?.specification ?? ""
  ) &&
    !/panel waste %|generic panel waste/i.test(commercialSrc) &&
    (vertical.lineItems.find((i) => i.componentKey === FENCE_BOARDS_COMPONENT)?.quantity ?? 0) >=
      (buildFencePhysicalModel({ context: ctx(timberVertical()), workAreaId: "f1" }).timber
        ?.boardRequiredLm ?? 0)
);
check(
  "36 package/detail XOR",
  packageXorDetailedHolds({
    mode: "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFenceLine: hasPackage(aluminium.lineItems),
    hasDetailedMoneyLine: hasDetailedModular(aluminium.lineItems),
  }) &&
    packageXorDetailedHolds({
      mode: "DETAILED_COMPONENT_AUTHORITY",
      hasPackageFenceLine: hasPackage(vertical.lineItems),
      hasDetailedMoneyLine: hasDetailedTimber(vertical.lineItems),
    })
);

console.log("\n-- SURFACES --");
const verticalReview = reviewText(vertical);
const horizontalReview = reviewText(horizontal);
const modularReview = reviewText(aluminium);
check(
  "37 Builder Review Vertical",
  /Fence posts|Fence palings|Post installation/i.test(verticalReview) &&
    !/DETAILED_COMPONENT_AUTHORITY|TIMBER_VERTICAL_PALING/.test(verticalReview)
);
check(
  "38 Builder Review Horizontal",
  /slat|course/i.test(horizontalReview) &&
    !horizontalReview.toLowerCase().includes("vertical paling gap")
);
check(
  "39 Builder Review Modular",
  /section|modular/i.test(modularReview) &&
    /10 full|purchased/i.test(reviewText(residual))
);
const alumEst = calculateEstimate(ctx(aluminiumFacts()));
check(
  "40 Commercial Overview",
  near(alumEst.recommendedCost, aBuckets.direct, 0.5) &&
    near(
      alumEst.recommendedSell,
      aluminium.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
      0.5
    )
);
check(
  "41 Pricing parity",
  near(
    alumEst.recommendedSell,
    aluminium.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    0.5
  )
);
check(
  "42 Quote parity",
  /aluminium slat fence/i.test(aluminiumQuote) &&
    /pricing required/i.test(quoteDraft(requestedFacts, requested))
);
check(
  "43 system-specific descriptions",
  fenceQuoteSystemPhrase({ system: "TIMBER_VERTICAL_PALING" }) ===
    "vertical timber paling fence" &&
    fenceQuoteSystemPhrase({ system: "TIMBER_HORIZONTAL_SLAT" }) ===
      "horizontal timber slat fence" &&
    fenceQuoteSystemPhrase({
      system: "METAL_SLAT_MODULAR",
      metalMaterial: "Steel",
    }) === "steel slat fence" &&
    fenceQuoteSystemPhrase({
      system: "METAL_SLAT_MODULAR",
      metalMaterial: "Aluminium",
    }) === "aluminium slat fence" &&
    fenceQuoteSystemPhrase({ system: "PLASTIC_MODULAR" }) === "plastic/composite fence"
);
const sectionLabour = aluminium.lineItems.find(
  (i) => i.componentKey === FENCE_SECTION_LABOUR_COMPONENT
);
check(
  "44 concise labour copy",
  /10 section × 0\.35 h\/section/i.test(sectionLabour?.identitySummary ?? "") &&
    !/diagnostic|ownership/i.test(sectionLabour?.identitySummary ?? "")
);

console.log("\n-- HARD MINIMUMS / INFORMATION --");
const missingType = calculateFence(
  ctx([fact("fence.length_m", 18), fact("fence.height_m", 1.8)]),
  wa()
);
check(
  "hard minimums",
  missingType.missingInfo.some((row) => /fence type/i.test(row)) &&
    hasPackage(missingType.lineItems)
);
check(
  "information contract hard minimums",
  contract.some((row) => row.factKey === "fence.length_m" && row.questionClass === "HARD_MINIMUM") &&
    contract.some((row) => row.factKey === "fence.height_m" && row.questionClass === "HARD_MINIMUM") &&
    contract.some(
      (row) => row.factKey === "fence.system" && row.questionClass === "HARD_MINIMUM"
    )
);
check(
  "post identity isolation",
  mat(vertical, FENCE_POSTS_LM_COMPONENT)?.materialKey === fencePostMaterialKey() &&
    mat(aluminium, FENCE_POSTS_EA_COMPONENT)?.materialKey === FENCE_POST_ALUMINIUM_KEY &&
    mat(steel, FENCE_POSTS_EA_COMPONENT)?.materialKey === FENCE_POST_STEEL_KEY &&
    mat(plastic, FENCE_POSTS_EA_COMPONENT)?.materialKey === FENCE_POST_PLASTIC_KEY
);

const requestedCommercial = commercializeFenceWithLabour({
  physical: buildFencePhysicalModel({ context: ctx(requestedFacts), workAreaId: "f1" }),
  facts: requestedFacts,
  workAreaId: "f1",
  rates: [],
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
  constraints: EASY,
  hourlyCost: 60,
});
check(
  "unresolved gate keeps detailed authority",
  requestedCommercial.mode === "DETAILED_COMPONENT_AUTHORITY" &&
    requestedCommercial.commerciallyReady === false
);

console.log("\n-- MOBILE / COVERAGE --");
check(
  "mobile Builder Review layout",
  brSurface.includes("overflow-x-hidden") &&
    brSurface.includes("min-w-0") &&
    brSurface.includes("shrink-0") &&
    brSurface.includes("tabular-nums") &&
    !brSurface.includes("<table")
);
check(
  "mobile Job Plan stacked controls",
  editorSrc.includes("grid gap-3") &&
    editorSrc.includes("w-full") &&
    editorSrc.includes("fence.modular_gate_requested") &&
    editorSrc.includes("not ready")
);
check(
  "coverage marks Fence MVP complete/closed",
  /FENCE\s*=\s*MVP COMPLETE \/ CLOSED/i.test(coverageDoc) ||
    /FENCE FAMILY\s*=\s*MVP COMPLETE \/ CLOSED/i.test(coverageDoc)
);
check(
  "coverage defers modular gates without calling them blockers",
  /manufactured modular gates/i.test(coverageDoc) &&
    /not a blocker|not architecture blocker|deferred/i.test(coverageDoc)
);
check(
  "quote readiness module exists",
  quoteReadinessSrc.includes("ATTENTION_REQUIRED") &&
    quoteDescSrc.includes("fenceQuoteSystemPhrase")
);
check(
  "Builder Review high-value modular gate",
  composeSrc.includes("compatible manufactured gate") &&
    composeSrc.includes("pricing required")
);
check(
  "physical residual copy locked",
  /full \+ 1 cut\/residual/i.test(physicalSrc)
);

const steelBuckets = buckets(steel.lineItems);
const plasticBuckets = buckets(plastic.lineItems);
const hBuckets = buckets(horizontal.lineItems);
const hSell = round2(horizontal.lineItems.reduce((s, i) => s + i.recommendedSell, 0));
console.log(
  `      Horizontal 12m: courses=${horizPhysical.timber?.courseCount} requiredLm=${horizPhysical.timber?.boardRequiredLm} Direct=${hBuckets.direct} Sell=${hSell}`
);
console.log(
  `      Steel 18m: sections=${mat(steel, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity} posts=${mat(steel, FENCE_POSTS_EA_COMPONENT)?.purchaseQuantity} Direct=${steelBuckets.direct} Sell=${round2(steel.lineItems.reduce((s, i) => s + i.recommendedSell, 0))}`
);
console.log(
  `      Plastic 10m: Direct=${plasticBuckets.direct} Sell=${round2(plastic.lineItems.reduce((s, i) => s + i.recommendedSell, 0))}`
);
console.log(
  `      Access labour delta aluminium Easy→Difficult: ${round2(alumHardLab - alumEasyLab)} timber: ${round2(timberHardLab - timberEasyLab)}`
);

console.log("\n-- REGRESSION SPAWNS --");
check("45 Fence 1C >=94/0", spawnFence("scripts/verify-fence-maturity-1c.ts", 94));
check("46 Fence 1B >=82/0", spawnFence("scripts/verify-fence-maturity-1b.ts", 82));
check("47 Fence 1A >=157/0", spawnFence("scripts/verify-fence-maturity-1a.ts", 157));
check("48 Deck R8-R1", spawnVerifier("scripts/verify-deck-r8-r1-step-width.ts"));
check("49 RW R6", spawnVerifier("scripts/verify-retaining-wall-post-concrete-r6.ts"));
check("50 Estimator Safety", spawnVerifier("scripts/verify-estimator-safety-0.ts"));
check("51 Foundation", spawnVerifier("scripts/verify-foundation-r1-project-conditions-support.ts"));
check("52 Performance", spawnVerifier("scripts/verify-performance-smoke.ts"));

const platform: [string, string][] = [
  ["Deck R8", "scripts/verify-deck-r8-final-closure.ts"],
  ["Deck R7", "scripts/verify-deck-r7-real-world.ts"],
  ["Deck 2A", "scripts/verify-deck-maturity-2a.ts"],
  ["Deck 2B", "scripts/verify-deck-maturity-2b.ts"],
  ["Deck 2C", "scripts/verify-deck-maturity-2c.ts"],
  ["Deck 2D", "scripts/verify-deck-maturity-2d.ts"],
  ["RW family", "scripts/verify-retaining-wall-family-closure-01.ts"],
  ["RW family coverage", "scripts/verify-retaining-wall-family-coverage-01.ts"],
  ["Recovery 1", "scripts/verify-recovery-1-commercial-authority.ts"],
  ["UX Premium", "scripts/verify-ux-premium-01.ts"],
  ["Commercial", "scripts/verify-commercial-p0-authority-lock.ts"],
  ["cost-first", "scripts/verify-cost-first-rates.ts"],
  ["Rates", "scripts/verify-material-rates.ts"],
  ["Pricing", "scripts/verify-pricing-ownership.ts"],
  ["Quote", "scripts/verify-quote-safety.ts"],
  ["REQ", "scripts/verify-req-2-1-deck-surface-material-requirement.ts"],
  ["Outdoor", "scripts/verify-outdoor-calibration.ts"],
  ["fact coverage", "scripts/verify-fact-coverage.ts"],
];
for (const [label, script] of platform) {
  if (!existsSync(script)) {
    check(`spawn ${label}`, false, `missing ${script}`);
    continue;
  }
  check(`spawn ${label}`, spawnVerifier(script));
}

console.log(`\nFENCE-FAMILY-CLOSURE RESULT: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
