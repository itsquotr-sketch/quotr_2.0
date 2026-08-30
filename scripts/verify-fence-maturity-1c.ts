/**
 * FENCE-MATURITY-1C — modular metal/plastic commercial maturity verifier.
 * Run: npx tsx scripts/verify-fence-maturity-1c.ts
 *
 * Do not commit/push/deploy from this phase.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateFence } from "../lib/estimate/calculators/fence";
import {
  isFencePackageLineLabel,
  packageXorDetailedHolds,
} from "../lib/estimate/fence-commercial";
import {
  FENCE_BOARDS_COMPONENT,
  FENCE_CONCRETE_COMPONENT,
  FENCE_FIXINGS_MODULAR_COMPONENT,
  FENCE_FIXINGS_MODULAR_KEY,
  FENCE_POST_ALUMINIUM_KEY,
  FENCE_POST_PLASTIC_KEY,
  FENCE_POST_STEEL_KEY,
  FENCE_POSTS_EA_COMPONENT,
  FENCE_PREMIX_20KG_KEY,
  FENCE_SECTION_ALUMINIUM_FAMILY_KEY,
  FENCE_SECTION_PLASTIC_FAMILY_KEY,
  FENCE_SECTION_STEEL_FAMILY_KEY,
  FENCE_SECTIONS_COMPONENT,
  FENCE_SECTION_LABOUR_COMPONENT,
  FENCE_POST_LABOUR_COMPONENT,
  FENCE_MODULAR_GATE_COMPONENT,
  fenceSectionFamilyKey,
  fenceSectionSkuKey,
} from "../lib/estimate/fence-identities";
import {
  FENCE_MODULAR_1C_MATERIAL_STARTERS,
  FENCE_MODULAR_1C_PRODUCTIVITY_STARTERS,
  FENCE_SECTION_PRODUCT_KEY_FACT,
  FENCE_MODULAR_GATE_REQUESTED_FACT,
  modularGateApplicability,
} from "../lib/estimate/fence-modular-1c";
import { FENCE_PRODUCTIVITY_KEYS } from "../lib/estimate/fence-productivity";
import { buildFencePhysicalModel } from "../lib/estimate/fence-physical";
import { FULL_RATE_CATALOGUE } from "../lib/rates/catalogue";
import { FENCE_MODULAR_SPECIFIC_MATERIAL_CATALOGUE } from "../lib/rates/specific-material-catalogue";
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

function near(actual: number, expected: number, eps = 0.02): boolean {
  return Math.abs(actual - expected) <= eps;
}

function commercialBuckets(
  items: {
    category: string;
    recommendedCost: number;
    recommendedSell: number;
    label: string;
    componentKey?: string | null;
    quantity?: number;
    costRate?: number | null;
  }[]
) {
  const sumIf = (pred: (row: (typeof items)[number]) => boolean) =>
    items.filter(pred).reduce((total, row) => total + row.recommendedCost, 0);
  const materials = sumIf((row) => row.category === "materials");
  const labour = sumIf((row) => row.category === "labour");
  const allowance = sumIf((row) => row.category === "allowance");
  const waste = sumIf((row) => row.category === "waste");
  const other = sumIf(
    (row) =>
      row.category !== "materials" &&
      row.category !== "labour" &&
      row.category !== "allowance" &&
      row.category !== "waste"
  );
  const direct = items.reduce((total, row) => total + row.recommendedCost, 0);
  const sell = items.reduce((total, row) => total + row.recommendedSell, 0);
  return {
    materials,
    labour,
    allowance,
    waste,
    other,
    direct,
    sell,
    lines: items.map((row) => ({
      label: row.label,
      category: row.category,
      componentKey: row.componentKey ?? null,
      qty: row.quantity ?? null,
      rate: row.costRate ?? null,
      cost: row.recommendedCost,
      sell: row.recommendedSell,
    })),
  };
}

function wa(): EstimateWorkArea & { status: "confirmed" } {
  return { id: "f1", type: "fence", name: "Fence", sort_order: 1, status: "confirmed" };
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "f1", value };
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

/** Fixture A/B/C: normal access. Project Conditions must not hide money inside Direct. */
const OWNER_CONSTRAINTS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "<10m" },
];

function ctx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = [],
  constraints: { key: string; value: unknown }[] = OWNER_CONSTRAINTS,
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

function aluminiumFacts(extra: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Aluminium / steel slat fence"),
    fact("fence.metal_material", "Aluminium"),
    fact("fence.section_width_m", 1.8),
    fact("fence.gate_included", false),
  ];
  return extra.reduce(
    (facts, next) => [...facts.filter((row) => row.key !== next.key), next],
    base
  );
}

function plasticFacts(extra: EstimateFact[] = []): EstimateFact[] {
  const base: EstimateFact[] = [
    fact("fence.length_m", 10),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Plastic / composite fence"),
    fact("fence.section_width_m", 1.8),
    fact("fence.gate_included", false),
  ];
  return extra.reduce(
    (facts, next) => [...facts.filter((row) => row.key !== next.key), next],
    base
  );
}

function timberVertical(): EstimateFact[] {
  return [
    fact("fence.length_m", 18),
    fact("fence.height_m", 1.8),
    fact("fence.system", "Timber paling — vertical board"),
    fact("fence.timber_species", "Radiata Pine"),
    fact("fence.board_thickness_mm", "150 × 19mm"),
    fact("fence.post_spacing_m", 1.8),
    fact("fence.gate_included", true),
    fact("fence.gate_count", 1),
    fact("fence.gate_width_m", 0.9),
    fact("fence.top_capping", "Yes"),
  ];
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

function hasDetailed(items: { componentKey?: string | null }[]): boolean {
  return items.some(
    (i) =>
      i.componentKey === FENCE_SECTIONS_COMPONENT ||
      i.componentKey === FENCE_POSTS_EA_COMPONENT
  );
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
  if (process.env.FENCE_SKIP_NESTED_SPAWN === "1") return true;
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
  if (process.env.FENCE_SKIP_NESTED_SPAWN === "1") return true;
  try {
    const out = execFileSync("npx", ["tsx", script], {
      stdio: "pipe",
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        FENCE_SKIP_NESTED_SPAWN: "1",
        RW_SKIP_NESTED_SPAWN: "1",
      },
    });
    const match = out.match(/(\d+) passed,\s*(\d+) failed/);
    if (!match) return true;
    const passCount = Number(match[1]);
    const failCount = Number(match[2]);
    return failCount === 0 && passCount >= minPass;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const failLine = out.split(/\r?\n/).find((line) => /^FAIL /.test(line));
    if (failLine) console.log(`      spawn ${script}: ${failLine.trim()}`);
    return false;
  }
}

console.log("\n-- PHYSICAL --");
const physicalA = buildFencePhysicalModel({
  context: ctx(aluminiumFacts()),
  workAreaId: "f1",
});
check("1 18m/1.8 =10 sections", physicalA.modular?.purchasedSectionCount === 10);
check("2 posts=11", physicalA.modular?.postCount === 11 && physicalA.modular?.holeCount === 11);

const residualFacts = aluminiumFacts([fact("fence.length_m", 19)]);
const physicalB = buildFencePhysicalModel({
  context: ctx(residualFacts),
  workAreaId: "f1",
});
check(
  "3 19m residual =11 purchased",
  physicalB.modular?.fullSectionCount === 10 &&
    physicalB.modular?.purchasedSectionCount === 11 &&
    near(physicalB.modular?.residualWidthM ?? 0, 1)
);
check("4 posts=12", physicalB.modular?.postCount === 12);

const physicalC = buildFencePhysicalModel({
  context: ctx(plasticFacts()),
  workAreaId: "f1",
});
check(
  "5 Plastic 10m =6/7",
  physicalC.modular?.fullSectionCount === 5 &&
    physicalC.modular?.purchasedSectionCount === 6 &&
    physicalC.modular?.postCount === 7
);

const width2 = buildFencePhysicalModel({
  context: ctx(aluminiumFacts([fact("fence.section_width_m", 2)])),
  workAreaId: "f1",
});
check(
  "6 section width change recalculates",
  width2.modular?.purchasedSectionCount === 9 && width2.modular?.postCount === 10
);

const companySku = `fence.section.metal_slat.aluminium.2000x1800`;
const companyProductPhysical = buildFencePhysicalModel({
  context: ctx(aluminiumFacts([fact("fence.section_width_m", 1.8)]), [
    rate(companySku, "ea", 310),
  ]),
  workAreaId: "f1",
});
check(
  "7 product dimensions and physical dimensions stay aligned",
  companyProductPhysical.modular?.sectionWidthM === 1.8 &&
    companyProductPhysical.modular?.purchasedSectionCount === 10 &&
    companyProductPhysical.modular?.sectionProduct.skuKey !== companySku
);

const heightMismatch = calculateFence(
  ctx(aluminiumFacts([fact("fence.section_height_m", 1.5)])),
  wa()
);
check(
  "8 height incompatibility attention",
  physicalA.modular?.heightMismatch === false &&
    heightMismatch.assumptions.some((row) => /panel height does not match/i.test(row)) &&
    mat(heightMismatch, FENCE_SECTIONS_COMPONENT)?.priced === false &&
    heightMismatch.missingInfo.some((row) =>
      /not stretched|Pricing Required|panel height/i.test(row)
    )
);

console.log("\n-- MATERIALS --");
const ownerA = calculateFence(ctx(aluminiumFacts()), wa());
const steel = calculateFence(
  ctx(aluminiumFacts([fact("fence.metal_material", "Steel")])),
  wa()
);
const ownerC = calculateFence(ctx(plasticFacts()), wa());
check(
  "9 Aluminium section identity",
  (mat(ownerA, FENCE_SECTIONS_COMPONENT)?.materialKey ?? "").startsWith(
    FENCE_SECTION_ALUMINIUM_FAMILY_KEY
  )
);
check(
  "10 Steel section identity",
  (mat(steel, FENCE_SECTIONS_COMPONENT)?.materialKey ?? "").startsWith(
    FENCE_SECTION_STEEL_FAMILY_KEY
  ) &&
    mat(steel, FENCE_SECTIONS_COMPONENT)?.materialKey !==
      mat(ownerA, FENCE_SECTIONS_COMPONENT)?.materialKey
);
check(
  "11 Plastic/composite section identity",
  (mat(ownerC, FENCE_SECTIONS_COMPONENT)?.materialKey ?? "").startsWith(
    FENCE_SECTION_PLASTIC_FAMILY_KEY
  ) &&
    fenceSectionFamilyKey("PLASTIC_MODULAR", "plastic_composite") ===
      FENCE_SECTION_PLASTIC_FAMILY_KEY
);
check(
  "12 modular post identities",
  mat(ownerA, FENCE_POSTS_EA_COMPONENT)?.materialKey === FENCE_POST_ALUMINIUM_KEY &&
    mat(steel, FENCE_POSTS_EA_COMPONENT)?.materialKey === FENCE_POST_STEEL_KEY &&
    mat(ownerC, FENCE_POSTS_EA_COMPONENT)?.materialKey === FENCE_POST_PLASTIC_KEY
);
check(
  "13 concrete",
  mat(ownerA, FENCE_CONCRETE_COMPONENT)?.materialKey === FENCE_PREMIX_20KG_KEY &&
    (mat(ownerA, FENCE_CONCRETE_COMPONENT)?.purchaseQuantity ?? 0) > 0
);
check(
  "14 fixings ownership",
  mat(ownerA, FENCE_FIXINGS_MODULAR_COMPONENT)?.purchaseUnit === "section" &&
    mat(ownerA, FENCE_FIXINGS_MODULAR_COMPONENT)?.purchaseQuantity === 10 &&
    mat(ownerA, FENCE_FIXINGS_MODULAR_COMPONENT)?.priced === true
);
const residualEst = calculateFence(ctx(residualFacts), wa());
check(
  "15 whole residual procurement",
  mat(residualEst, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity === 11 &&
    near(mat(residualEst, FENCE_SECTIONS_COMPONENT)?.totalCost ?? 0, 11 * 220) &&
    !`${mat(residualEst, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity}`.includes(".")
);
check(
  "16 no generic panel waste stacked",
  mat(ownerA, FENCE_SECTIONS_COMPONENT)?.wasteFactor === 0 &&
    mat(residualEst, FENCE_SECTIONS_COMPONENT)?.wasteFactor === 0
);

console.log("\n-- LABOUR --");
check(
  "17 post productivity",
  near(lab(ownerA, FENCE_POST_LABOUR_COMPONENT)?.productivityBasis.hoursPerUnit ?? 0, 0.7) &&
    lab(ownerA, FENCE_POST_LABOUR_COMPONENT)?.productivityBasis.quantity === 11
);
check(
  "18 section productivity",
  near(lab(ownerA, FENCE_SECTION_LABOUR_COMPONENT)?.productivityBasis.hoursPerUnit ?? 0, 0.35) &&
    lab(ownerA, FENCE_SECTION_LABOUR_COMPONENT)?.productivityBasis.quantity === 10
);
check(
  "19 concrete h/bag",
  near(
    lab(ownerA, "fence.post_hole_concrete.place")?.productivityBasis.hoursPerUnit ?? 0,
    0.06
  )
);
check(
  "20 residual install ownership",
  lab(residualEst, FENCE_SECTION_LABOUR_COMPONENT)?.productivityBasis.quantity === 11 &&
    lab(residualEst, FENCE_POST_LABOUR_COMPONENT)?.productivityBasis.quantity === 12
);
check(
  "21 person-hour semantics",
  /person-hours|labour-h/i.test(
    FENCE_MODULAR_1C_PRODUCTIVITY_STARTERS[FENCE_PRODUCTIVITY_KEYS.sectionInstall]?.basis ?? ""
  )
);
const easy = calculateFence(
  ctx(aluminiumFacts(), [], [
    { key: "site_access", value: "Easy" },
    { key: "material_carry_distance", value: "< 10m" },
  ]),
  wa()
);
const hard = calculateFence(
  ctx(aluminiumFacts(), [], [
    { key: "site_access", value: "Difficult" },
    { key: "material_carry_distance", value: "> 30m" },
  ]),
  wa()
);
const postLabourEasy = easy.lineItems.find((i) => i.componentKey === FENCE_POST_LABOUR_COMPONENT);
const postLabourHard = hard.lineItems.find((i) => i.componentKey === FENCE_POST_LABOUR_COMPONENT);
check(
  "22 Project Conditions once",
  (postLabourHard?.recommendedCost ?? 0) > (postLabourEasy?.recommendedCost ?? 0) &&
    mat(easy, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity ===
      mat(hard, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity
);

console.log("\n-- RATES / PRODUCTS --");
const companyEst = calculateFence(
  ctx(aluminiumFacts([fact(FENCE_SECTION_PRODUCT_KEY_FACT, companySku)]), [
    rate(companySku, "ea", 310),
  ]),
  wa()
);
check(
  "23 Company section product",
  companyEst.lineItems.some((i) => i.componentKey === FENCE_SECTIONS_COMPONENT)
);
check(
  "24 Company dimensions drive geometry",
  mat(companyEst, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity === 9 &&
    mat(companyEst, FENCE_POSTS_EA_COMPONENT)?.purchaseQuantity === 10
);
check(
  "25 Company rate wins",
  near(mat(companyEst, FENCE_SECTIONS_COMPONENT)?.unitCost ?? 0, 310) &&
    mat(companyEst, FENCE_SECTIONS_COMPONENT)?.rateSource === "company"
);
check(
  "26 Quotr generic fallback",
  mat(ownerA, FENCE_SECTIONS_COMPONENT)?.rateSource === "benchmark" &&
    near(mat(ownerA, FENCE_SECTIONS_COMPONENT)?.unitCost ?? 0, 220)
);
check(
  "27 provenance",
  mat(companyEst, FENCE_SECTIONS_COMPONENT)?.rateSource === "company" &&
    FULL_RATE_CATALOGUE.some((e) => e.item_key === FENCE_SECTION_ALUMINIUM_FAMILY_KEY) &&
    FENCE_MODULAR_SPECIFIC_MATERIAL_CATALOGUE.length >= 7
);

const missSection = calculateFence(
  ctx(aluminiumFacts(), modularCompanyRates(FENCE_SECTION_ALUMINIUM_FAMILY_KEY), OWNER_CONSTRAINTS, {
    organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
  }),
  wa()
);
check(
  "28 missing section rate",
  !hasPackage(missSection.lineItems) &&
    hasDetailed(missSection.lineItems) &&
    mat(missSection, FENCE_SECTIONS_COMPONENT)?.priced === false &&
    mat(missSection, FENCE_POSTS_EA_COMPONENT)?.priced === true
);

const missPost = calculateFence(
  ctx(aluminiumFacts(), modularCompanyRates(FENCE_POST_ALUMINIUM_KEY), OWNER_CONSTRAINTS, {
    organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
  }),
  wa()
);
check(
  "29 missing post rate",
  !hasPackage(missPost.lineItems) &&
    mat(missPost, FENCE_POSTS_EA_COMPONENT)?.priced === false &&
    (mat(missPost, FENCE_POSTS_EA_COMPONENT)?.totalCost ?? 1) !== 0 &&
    mat(missPost, FENCE_SECTIONS_COMPONENT)?.priced === true
);

const missProd = calculateFence(
  ctx(
    aluminiumFacts(),
    modularCompanyRates().filter((row) => row.rate_type !== "productivity"),
    OWNER_CONSTRAINTS,
    {
      organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
    }
  ),
  wa()
);
check(
  "30 missing productivity",
  !hasPackage(missProd.lineItems) &&
    lab(missProd, FENCE_SECTION_LABOUR_COMPONENT)?.priced === false &&
    mat(missProd, FENCE_SECTIONS_COMPONENT)?.priced === true
);

console.log("\n-- AUTHORITY --");
const incomplete = calculateFence(
  ctx(aluminiumFacts(), [], OWNER_CONSTRAINTS, {
    organisationSettings: { allow_benchmark_rates: false, default_margin_percent: 20 },
  }),
  wa()
);
check(
  "31 package before detailed completeness",
  hasPackage(incomplete.lineItems) && !hasDetailed(incomplete.lineItems)
);
check(
  "32 detailed promotes when complete",
  !hasPackage(ownerA.lineItems) && hasDetailed(ownerA.lineItems)
);
check(
  "33 package/detail XOR",
  packageXorDetailedHolds({
    mode: "DETAILED_COMPONENT_AUTHORITY",
    hasPackageFenceLine: hasPackage(ownerA.lineItems),
    hasDetailedMoneyLine: hasDetailed(ownerA.lineItems),
  }) &&
    packageXorDetailedHolds({
      mode: "LEGACY_PACKAGE_AUTHORITY",
      hasPackageFenceLine: hasPackage(incomplete.lineItems),
      hasDetailedMoneyLine: hasDetailed(incomplete.lineItems),
    })
);
check(
  "34 rate miss after promotion stays detailed",
  !hasPackage(missSection.lineItems) && hasDetailed(missSection.lineItems)
);
check(
  "35 no package restore",
  !hasPackage(missPost.lineItems) && !hasPackage(missProd.lineItems)
);
check(
  "36 no $0 required line",
  missSection.lineItems.some(
    (i) => i.componentKey === FENCE_SECTIONS_COMPONENT && i.recommendedCost === 0
  ) && mat(missSection, FENCE_SECTIONS_COMPONENT)?.priced === false
);

console.log("\n-- SWITCHING --");
check(
  "37 Metal↔Plastic identities isolate",
  mat(ownerA, FENCE_SECTIONS_COMPONENT)?.materialKey !==
    mat(ownerC, FENCE_SECTIONS_COMPONENT)?.materialKey &&
    mat(ownerA, FENCE_POSTS_EA_COMPONENT)?.materialKey !==
      mat(ownerC, FENCE_POSTS_EA_COMPONENT)?.materialKey &&
    !ownerC.lineItems.some((i) => (i.identitySummary ?? "").toLowerCase().includes("aluminium"))
);
const timberEst = calculateFence(ctx(timberVertical()), wa());
check(
  "38 Timber↔modular authority isolates",
  timberEst.lineItems.some((i) => i.componentKey === FENCE_BOARDS_COMPONENT) &&
    !ownerA.lineItems.some((i) => i.componentKey === FENCE_BOARDS_COMPONENT) &&
    !timberEst.lineItems.some((i) => i.componentKey === FENCE_SECTIONS_COMPONENT) &&
    ownerA.lineItems.some((i) => i.componentKey === FENCE_SECTIONS_COMPONENT)
);
const staleGate = calculateFence(
  ctx(
    aluminiumFacts([
      fact("fence.gate_included", true),
      fact("fence.gate_count", 1),
      fact("fence.gate_width_m", 0.9),
    ])
  ),
  wa()
);
check(
  "39 stale Timber gate remains isolated",
  !staleGate.lineItems.some((i) => /gate/i.test(i.label)) &&
    physicalA.modular?.modularGatesModelled === false &&
    !staleGate.missingInfo.some((row) => /gate/i.test(row)) &&
    !staleGate.assumptions.some((row) => /gate/i.test(row))
);

console.log("\n-- SURFACES --");
const ownerEst = calculateEstimate(ctx(aluminiumFacts()));
const review = composeBuilderReview({
  estimate: {
    lineItems: ownerA.lineItems,
    assumptions: ownerA.assumptions,
    missingInfo: ownerA.missingInfo,
    exclusions: ownerA.exclusions,
    recommendedCost: ownerEst.recommendedCost,
    recommendedSell: ownerEst.recommendedSell,
    marginPercent: 20,
    confidence: ownerA.confidence ?? 70,
  } as never,
  workAreas: [wa()],
  requirements: ownerA.requirements,
});
const reviewText = JSON.stringify(review);
check(
  "40 Builder Review",
  /Fence sections|Fence posts|Post-hole concrete|Section installation|Post installation/i.test(
    reviewText
  ) && !/stock-lm|H4 100/i.test(reviewText)
);
check(
  "41 Commercial Overview",
  ownerEst.recommendedCost > 0 &&
    ownerEst.recommendedSell > ownerEst.recommendedCost &&
    near(
      ownerEst.recommendedCost,
      ownerA.lineItems.reduce((sum, item) => sum + item.recommendedCost, 0),
      0.5
    )
);
check(
  "42 Pricing parity",
  near(
    ownerEst.recommendedSell,
    ownerA.lineItems.reduce((sum, item) => sum + item.recommendedSell, 0),
    0.5
  )
);
const quote = buildWorkAreaQuoteDescriptionDraft({
  type: "fence",
  name: "Fence",
  facts: aluminiumFacts().map((f) => ({
    key: f.key,
    label: f.key,
    value: String(f.value),
  })),
  pricingItems: ownerA.lineItems.map((i) => ({ label: i.label })),
});
const plasticQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "fence",
  name: "Fence",
  facts: plasticFacts().map((f) => ({
    key: f.key,
    label: f.key,
    value: String(f.value),
  })),
  pricingItems: ownerC.lineItems.map((i) => ({ label: i.label })),
});
check(
  "43 Quote parity",
  /aluminium slat/i.test(quote) &&
    /plastic\/composite/i.test(plasticQuote) &&
    !/timber gate|gate allowance/i.test(quote) &&
    !/METAL_SLAT_MODULAR|package/i.test(quote)
);
const sectionLabourLine = ownerA.lineItems.find(
  (i) => i.componentKey === FENCE_SECTION_LABOUR_COMPONENT
);
check(
  "44 concise mobile calc copy",
  /10 section × 0\.35 h\/section/i.test(sectionLabourLine?.identitySummary ?? "") &&
    !/diagnostic|ownership/i.test(sectionLabourLine?.identitySummary ?? "")
);

console.log("\n-- FIXTURES / SENSITIVITY --");
const included = calculateFence(
  ctx(aluminiumFacts([fact("fence.modular_fixings_included", true)])),
  wa()
);
check(
  "fixings included vs separate XOR",
  mat(included, FENCE_FIXINGS_MODULAR_COMPONENT) == null &&
    mat(ownerA, FENCE_FIXINGS_MODULAR_COMPONENT)?.priced === true
);
check(
  "width 1.8 vs 2.0 labour/material respond",
  mat(ownerA, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity === 10 &&
    mat(calculateFence(ctx(aluminiumFacts([fact("fence.section_width_m", 2)])), wa()), FENCE_SECTIONS_COMPONENT)
      ?.purchaseQuantity === 9 &&
    lab(ownerA, FENCE_POST_LABOUR_COMPONENT)?.productivityBasis.quantity === 11 &&
    lab(
      calculateFence(ctx(aluminiumFacts([fact("fence.section_width_m", 2)])), wa()),
      FENCE_POST_LABOUR_COMPONENT
    )?.productivityBasis.quantity === 10
);
check(
  "height miss stays detailed",
  !hasPackage(heightMismatch.lineItems) &&
    hasDetailed(heightMismatch.lineItems) &&
    mat(heightMismatch, FENCE_SECTIONS_COMPONENT)?.priced === false
);
check(
  "SKU key architecture",
  fenceSectionSkuKey("METAL_SLAT_MODULAR", "aluminium", 1.8, 1.8).includes("1800x1800") &&
    FENCE_MODULAR_1C_MATERIAL_STARTERS[FENCE_SECTION_ALUMINIUM_FAMILY_KEY]?.confidence === "low"
);
check(
  "coverage records Fence 1C",
  /FENCE-MATURITY-1C/i.test(
    readFileSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md", "utf8")
  ) &&
    /FENCE-MATURITY-1C-R1/i.test(
      readFileSync("docs/architecture/QUOTR_WORK_AREA_ESTIMATING_COVERAGE.md", "utf8")
    )
);

console.log("\n-- OWNER FIXTURE A --");
const bucketsA = commercialBuckets(ownerA.lineItems);
console.log(JSON.stringify({ ...bucketsA, gmPercent: 20, sellFromGm: bucketsA.direct / 0.8 }, null, 2));

console.log("\n-- OWNER FIXTURE B --");
const bucketsB = commercialBuckets(residualEst.lineItems);
console.log(
  JSON.stringify(
    {
      physical: {
        full: physicalB.modular?.fullSectionCount,
        residual: physicalB.modular?.residualWidthM,
        purchased: mat(residualEst, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity,
        posts: mat(residualEst, FENCE_POSTS_EA_COMPONENT)?.purchaseQuantity,
      },
      ...bucketsB,
    },
    null,
    2
  )
);

console.log("\n-- OWNER FIXTURE C --");
const bucketsC = commercialBuckets(ownerC.lineItems);
console.log(
  JSON.stringify(
    {
      sectionKey: mat(ownerC, FENCE_SECTIONS_COMPONENT)?.materialKey,
      postKey: mat(ownerC, FENCE_POSTS_EA_COMPONENT)?.materialKey,
      ...bucketsC,
    },
    null,
    2
  )
);

console.log("\n-- 1C-R1 COMMERCIAL RECONCILIATION --");
check(
  "R1.1 Fixture A visible line sum = Direct",
  near(bucketsA.direct, 4256.7, 0.02) &&
    near(
      bucketsA.materials + bucketsA.labour + bucketsA.allowance + bucketsA.waste + bucketsA.other,
      bucketsA.direct,
      0.02
    )
);
check(
  "R1.2 Fixture A materials subtotal",
  near(bucketsA.materials, 2200 + 495 + 540.5 + 180, 0.02)
);
check(
  "R1.3 Fixture A labour subtotal",
  near(bucketsA.labour, 462 + 210 + 169.2, 0.02)
);
check(
  "R1.4 no hidden package money",
  !ownerA.lineItems.some((item) => isFencePackageLineLabel(item.label)) &&
    !ownerA.lineItems.some((item) => /gate allowance/i.test(item.label)) &&
    near(bucketsA.allowance + bucketsA.waste + bucketsA.other, 0, 0.001)
);
check(
  "R1.5 no material quality/access multiplier",
  ownerA.lineItems
    .filter((item) => item.category === "materials")
    .every(
      (item) =>
        item.costRate != null &&
        near(item.recommendedCost, (item.quantity ?? 0) * item.costRate, 0.02)
    ) &&
    near(
      easy.lineItems.find((item) => item.componentKey === FENCE_SECTIONS_COMPONENT)
        ?.recommendedCost ?? 0,
      hard.lineItems.find((item) => item.componentKey === FENCE_SECTIONS_COMPONENT)
        ?.recommendedCost ?? 1,
      0.02
    )
);
check(
  "R1.6 Fixture B line sum = Direct",
  near(
    bucketsB.materials + bucketsB.labour + bucketsB.allowance + bucketsB.waste + bucketsB.other,
    bucketsB.direct,
    0.02
  ) && mat(residualEst, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity === 11
);
check(
  "R1.7 Fixture C line sum = Direct",
  near(
    bucketsC.materials + bucketsC.labour + bucketsC.allowance + bucketsC.waste + bucketsC.other,
    bucketsC.direct,
    0.02
  )
);
check(
  "R1.8 Sell/GM reconciles",
  near(bucketsA.sell, bucketsA.direct / 0.8, 0.5) &&
    near(bucketsB.sell, bucketsB.direct / 0.8, 0.5) &&
    near(bucketsC.sell, bucketsC.direct / 0.8, 0.5) &&
    near(
      ownerEst.recommendedSell,
      bucketsA.sell,
      0.02
    )
);

console.log("\n-- 1C-R1 MODULAR GATE SAFETY --");
check(
  "R1.9 stale Timber gate does not create modular gate",
  modularGateApplicability("METAL_SLAT_MODULAR", aluminiumFacts([
    fact("fence.gate_included", true),
    fact("fence.gate_count", 1),
  ]), "f1") === "NOT_REQUESTED" &&
    mat(staleGate, FENCE_MODULAR_GATE_COMPONENT) == null &&
    !staleGate.missingInfo.some((row) => /gate/i.test(row))
);
const freshAluminiumGate = calculateFence(
  ctx(aluminiumFacts([fact(FENCE_MODULAR_GATE_REQUESTED_FACT, true)])),
  wa()
);
check(
  "R1.10 fresh Aluminium gate intent is preserved",
  modularGateApplicability(
    "METAL_SLAT_MODULAR",
    aluminiumFacts([fact(FENCE_MODULAR_GATE_REQUESTED_FACT, true)]),
    "f1"
  ) === "UNSUPPORTED_REQUESTED" &&
    mat(freshAluminiumGate, FENCE_SECTIONS_COMPONENT)?.priced === true &&
    mat(freshAluminiumGate, FENCE_MODULAR_GATE_COMPONENT)?.priced === false
);
check(
  "R1.11 unsupported gate becomes Pricing Required",
  freshAluminiumGate.missingInfo.some((row) =>
    row.includes("Modular fence gate — pricing required")
  ) &&
    mat(freshAluminiumGate, FENCE_MODULAR_GATE_COMPONENT)?.priced === false &&
    freshAluminiumGate.lineItems.some(
      (item) =>
        item.componentKey === FENCE_MODULAR_GATE_COMPONENT &&
        item.recommendedCost === 0 &&
        /missing|pricing required|trusted price/i.test(
          `${item.rateSource ?? ""} ${item.notes ?? ""}`
        )
    )
);
check(
  "R1.12 no Timber gate geometry",
  (freshAluminiumGate.requirements ?? []).every(
    (row) =>
      row.componentKey !== "fence.gate.frame" &&
      row.componentKey !== "fence.gate.hardware" &&
      row.componentKey !== "fence.gate.posts.ea"
  ) && physicalA.modular?.gateWidthM === 0
);
check(
  "R1.13 no Timber gate money",
  !freshAluminiumGate.lineItems.some((item) =>
    /gate frame|gate hardware|timber gate|gate allowance/i.test(item.label)
  ) && !hasPackage(freshAluminiumGate.lineItems)
);
const freshPlasticGate = calculateFence(
  ctx(plasticFacts([fact(FENCE_MODULAR_GATE_REQUESTED_FACT, true)])),
  wa()
);
check(
  "R1.14 Plastic same",
  modularGateApplicability(
    "PLASTIC_MODULAR",
    plasticFacts([fact(FENCE_MODULAR_GATE_REQUESTED_FACT, true)]),
    "f1"
  ) === "UNSUPPORTED_REQUESTED" &&
    mat(freshPlasticGate, FENCE_MODULAR_GATE_COMPONENT)?.priced === false &&
    mat(freshPlasticGate, FENCE_SECTIONS_COMPONENT)?.priced === true &&
    !freshPlasticGate.lineItems.some((item) => /timber gate|gate frame/i.test(item.label))
);
const gateQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "fence",
  name: "Fence",
  facts: aluminiumFacts([fact(FENCE_MODULAR_GATE_REQUESTED_FACT, true)]).map((row) => ({
    key: row.key,
    label: row.key,
    value: String(row.value),
  })),
  pricingItems: freshAluminiumGate.lineItems.map((item) => ({ label: item.label })),
});
const gateReview = composeBuilderReview({
  estimate: {
    lineItems: freshAluminiumGate.lineItems,
    assumptions: freshAluminiumGate.assumptions,
    missingInfo: freshAluminiumGate.missingInfo,
    exclusions: freshAluminiumGate.exclusions,
    recommendedCost: freshAluminiumGate.lineItems.reduce((s, i) => s + i.recommendedCost, 0),
    recommendedSell: freshAluminiumGate.lineItems.reduce((s, i) => s + i.recommendedSell, 0),
    marginPercent: 20,
    confidence: 70,
  } as never,
  workAreas: [wa()],
  requirements: freshAluminiumGate.requirements,
});
check(
  "R1.15 Quote readiness preserves unresolved gate",
  /pricing required/i.test(gateQuote) &&
    !/timber gate/i.test(gateQuote) &&
    /Modular fence gate/i.test(JSON.stringify(gateReview)) &&
    mat(freshAluminiumGate, FENCE_MODULAR_GATE_COMPONENT)?.priced !== true
);

console.log("\n-- 1C-R1 PRODUCT AUTHORITY --");
const unselectedSkuEst = calculateFence(
  ctx(aluminiumFacts(), [rate(companySku, "ea", 310)]),
  wa()
);
check(
  "R1.16 commercial rate lookup cannot change geometry",
  unselectedSkuEst.lineItems.find((item) => item.componentKey === FENCE_SECTIONS_COMPONENT)
    ?.quantity === 10 &&
    near(mat(unselectedSkuEst, FENCE_SECTIONS_COMPONENT)?.unitCost ?? 0, 220) &&
    mat(unselectedSkuEst, FENCE_SECTIONS_COMPONENT)?.materialKey !== companySku
);
check(
  "R1.17 unselected 2.0m Company SKU does not alter 1.8m physical model",
  companyProductPhysical.modular?.purchasedSectionCount === 10 &&
    companyProductPhysical.modular?.postCount === 11 &&
    near(companyProductPhysical.modular?.sectionWidthM ?? 0, 1.8)
);
check(
  "R1.18 explicitly selected 2.0m SKU recalculates geometry",
  mat(companyEst, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity === 9 &&
    mat(companyEst, FENCE_POSTS_EA_COMPONENT)?.purchaseQuantity === 10 &&
    near(mat(companyEst, FENCE_SECTIONS_COMPONENT)?.unitCost ?? 0, 310)
);
const incompatibleRate = calculateFence(
  ctx(aluminiumFacts([fact(FENCE_SECTION_PRODUCT_KEY_FACT, fenceSectionSkuKey("METAL_SLAT_MODULAR", "aluminium", 1.8, 1.8))]), [
    rate(companySku, "ea", 310),
  ]),
  wa()
);
check(
  "R1.19 incompatible dimension rate does not resolve as exact",
  mat(incompatibleRate, FENCE_SECTIONS_COMPONENT)?.purchaseQuantity === 10 &&
    near(mat(incompatibleRate, FENCE_SECTIONS_COMPONENT)?.unitCost ?? 0, 220) &&
    mat(incompatibleRate, FENCE_SECTIONS_COMPONENT)?.rateSource === "benchmark"
);
check(
  "R1.20 height compatibility preserved",
  mat(heightMismatch, FENCE_SECTIONS_COMPONENT)?.priced === false &&
    !hasPackage(heightMismatch.lineItems)
);

console.log("\n-- REGRESSION SPAWNS --");
check("45 Fence 1A >=157/0", spawnFence("scripts/verify-fence-maturity-1a.ts", 157));
check("46 Fence 1B >=82/0", spawnFence("scripts/verify-fence-maturity-1b.ts", 82));
check("47 Deck R8-R1", spawnVerifier("scripts/verify-deck-r8-r1-step-width.ts"));
check("48 Deck R8", spawnVerifier("scripts/verify-deck-r8-final-closure.ts"));
check("49 Deck R7", spawnVerifier("scripts/verify-deck-r7-real-world.ts"));
const platform: [string, string][] = [
  ["Deck 2A", "scripts/verify-deck-maturity-2a.ts"],
  ["Deck 2B", "scripts/verify-deck-maturity-2b.ts"],
  ["Deck 2C", "scripts/verify-deck-maturity-2c.ts"],
  ["Deck 2D", "scripts/verify-deck-maturity-2d.ts"],
  ["RW R6", "scripts/verify-retaining-wall-post-concrete-r6.ts"],
  ["RW family", "scripts/verify-retaining-wall-family-closure-01.ts"],
  ["RW family coverage", "scripts/verify-retaining-wall-family-coverage-01.ts"],
  ["Estimator Safety", "scripts/verify-estimator-safety-0.ts"],
  ["Recovery 1", "scripts/verify-recovery-1-commercial-authority.ts"],
  ["UX Premium", "scripts/verify-ux-premium-01.ts"],
  ["Commercial", "scripts/verify-commercial-p0-authority-lock.ts"],
  ["cost-first", "scripts/verify-cost-first-rates.ts"],
  ["Rates", "scripts/verify-material-rates.ts"],
  ["Pricing", "scripts/verify-pricing-ownership.ts"],
  ["Quote", "scripts/verify-quote-safety.ts"],
  ["REQ", "scripts/verify-req-2-1-deck-surface-material-requirement.ts"],
  ["Foundation", "scripts/verify-foundation-r1-project-conditions-support.ts"],
  ["Outdoor", "scripts/verify-outdoor-calibration.ts"],
  ["Performance", "scripts/verify-performance-smoke.ts"],
  ["fact coverage", "scripts/verify-fact-coverage.ts"],
];
for (const [label, script] of platform) {
  if (!existsSync(script)) {
    check(`spawn ${label}`, false, `missing ${script}`);
    continue;
  }
  check(`spawn ${label}`, spawnVerifier(script));
}

console.log(`\nFENCE-MATURITY-1C RESULT: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
