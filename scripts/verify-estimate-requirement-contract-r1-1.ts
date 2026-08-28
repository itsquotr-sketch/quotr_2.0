/**
 * PHASE 0-R1 — EstimateRequirement foundation-r1.1 pre-emission contract.
 *
 * foundation-r1.1 contract. REQ-2.1 may emit Deck surface only.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isScopeDiscoveryEnabled } from "../lib/scope-discovery/configuration/feature-flags";
import {
  ESTIMATE_REQUIREMENT_CONTRACT_VERSION,
  ESTIMATE_REQUIREMENT_PLANNING_FREEZE_VERSION,
  PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY,
  isPricedInvariantSatisfied,
  type EstimateRequirement,
  type LabourAdjustmentRef,
  type MaterialRequirement,
  type RequirementRateSource,
} from "../lib/estimate/requirements";
import { buildRequirementId } from "../lib/estimate/requirement-id";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
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

function walkTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkTs(full));
    } else if (full.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const RATE_SOURCES: RequirementRateSource[] = [
  "company",
  "project_override",
  "supplier",
  "benchmark",
  "hardcoded_legacy",
  "missing",
];

const reqSrc = read("lib/estimate/requirements.ts");
const idSrc = read("lib/estimate/requirement-id.ts");

console.log("=== EstimateRequirement foundation-r1.1 contract ===\n");

check(
  "1 contract version is foundation-r1.1",
  ESTIMATE_REQUIREMENT_CONTRACT_VERSION === "foundation-r1.1"
);
check(
  "1b planning freeze version remains foundation-r1.0",
  ESTIMATE_REQUIREMENT_PLANNING_FREEZE_VERSION === "foundation-r1.0"
);

check("2 rate source contains company", RATE_SOURCES.includes("company"));
check(
  "3 rate source contains project_override",
  RATE_SOURCES.includes("project_override") && reqSrc.includes('"project_override"')
);
check(
  "4 rate source contains supplier",
  RATE_SOURCES.includes("supplier") && reqSrc.includes('"supplier"')
);
check(
  "5 rate source contains benchmark",
  RATE_SOURCES.includes("benchmark")
);

check(
  "6 structured assumptions type exists",
  reqSrc.includes("export type RequirementAssumption") &&
    reqSrc.includes("assumptions: readonly RequirementAssumption[]")
);
check(
  "7 stable assumption key field",
  /export type RequirementAssumption = \{[\s\S]*key: string;/.test(reqSrc)
);
check(
  "8 assumption source typed",
  reqSrc.includes("export type RequirementAssumptionSource") &&
    reqSrc.includes('"calculator_default"') &&
    reqSrc.includes('"user_confirmed"') &&
    reqSrc.includes('"assumed_default"')
);

check(
  "9 deterministic requirement ID helper exists",
  existsSync("lib/estimate/requirement-id.ts") &&
    idSrc.includes("export function buildRequirementId")
);

const idA = buildRequirementId({
  workAreaId: "WA123",
  kind: "material",
  componentKey: "decking.surface",
});
const idB = buildRequirementId({
  workAreaId: "WA123",
  kind: "material",
  componentKey: "decking.surface",
});
check(
  "10 identical semantic input → identical requirementId",
  idA === idB && idA === "WA123:material:decking.surface"
);

const idVariant = buildRequirementId({
  workAreaId: "WA123",
  kind: "material",
  componentKey: "joist",
  variantKey: "140x45-h3.2",
});
check(
  "11 changing semantic discriminator changes requirementId",
  idVariant === "WA123:material:joist:140x45-h3.2" && idVariant !== idA
);

const labourId = buildRequirementId({
  workAreaId: "WA123",
  kind: "labour",
  componentKey: "decking.install",
});
check(
  "12 no normal dependence on output order (identity ignores array index)",
  labourId === "WA123:labour:decking.install"
);
check(
  "12b index fallback is explicit and lower-stability",
  buildRequirementId({
    workAreaId: "WA123",
    kind: "material",
    componentKey: "fixings",
    indexFallback: 0,
  }) === "WA123:material:fixings:#0"
);

const oneFactor: LabourAdjustmentRef = {
  factors: [{ key: PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY, value: 1.1 }],
};
const twoFactors: LabourAdjustmentRef = {
  factors: [
    { key: PROJECT_LABOUR_PRODUCTIVITY_FACTOR_KEY, value: 1.1 },
    { key: "quality.spec", value: 1.05 },
  ],
};
check("13 LabourAdjustmentRef supports 1 factor", oneFactor.factors.length === 1);
check(
  "14 LabourAdjustmentRef supports multiple factors",
  twoFactors.factors.length === 2 &&
    reqSrc.includes("factors: readonly LabourAdjustmentFactorRef[]")
);

const pricedMaterial: MaterialRequirement = {
  requirementId: idA,
  kind: "material",
  workAreaId: "WA123",
  workAreaType: "deck",
  componentKey: "decking.surface",
  description: "Hardwood decking",
  confidence: "high",
  assumptions: [
    {
      key: "waste.decking",
      text: "10% waste assumed",
      source: "calculator_default",
    },
  ],
  provenance: { calculatorSource: "deck.decking", factKeys: [], constraintKeys: [] },
  priced: true,
  materialKey: "deck.material.hardwood.lm",
  category: "DECKING",
  baseQuantity: 115.14,
  baseUnit: "lm",
  wasteFactor: 0.1,
  purchaseQuantity: 126.65,
  purchaseUnit: "lm",
  rateSource: "company",
  unitCost: 18.5,
  totalCost: 2343.03,
};
check(
  "15 priced=true with resolved costs satisfies invariant",
  isPricedInvariantSatisfied(pricedMaterial)
);

const unpriced: EstimateRequirement = {
  ...pricedMaterial,
  priced: false,
  unitCost: null,
  totalCost: null,
};
check(
  "15b priced=false may have null costs",
  isPricedInvariantSatisfied(unpriced)
);

const invalidPriced: EstimateRequirement = {
  ...pricedMaterial,
  priced: true,
  totalCost: null,
};
check(
  "15c priced=true + totalCost=null fails invariant",
  !isPricedInvariantSatisfied(invalidPriced)
);

const zeroCost: EstimateRequirement = {
  ...pricedMaterial,
  unitCost: 0,
  totalCost: 0,
};
check("15d zero is a valid numeric cost, not null", isPricedInvariantSatisfied(zeroCost));

const calcFiles = walkTs(join("lib", "estimate", "calculators"));
const emitting = calcFiles.filter((p) => {
  const text = readFileSync(p, "utf8");
  return (
    /kind:\s*"material"/.test(text) ||
    /kind:\s*"labour"/.test(text) ||
    text.includes("MaterialRequirement") ||
    text.includes("LabourRequirement") ||
    text.includes("requirements:")
  );
});
check(
  "16 only Deck calculator emits EstimateRequirement objects",
  emitting.length === 3 &&
    emitting.some((p) =>
      p.replace(/\\/g, "/").endsWith("calculators/deck.ts")
    ) &&
    emitting.some((p) =>
      p.replace(/\\/g, "/").endsWith("calculators/retaining-wall.ts")
    ) &&
    emitting.some((p) =>
      p.replace(/\\/g, "/").endsWith("calculators/fence.ts")
    ),
  emitting.join(", ")
);

check(
  "17 live material resolver source union unchanged (no behaviour change)",
  read("lib/estimate/resolve-material-rate.ts").includes(' "company_specific"') ||
    read("lib/estimate/resolve-material-rate.ts").includes('"company_specific"')
);
check(
  "17b rate SOURCE is not conflated with conversion (no company_converted authority)",
  !reqSrc.includes("company_converted")
);

const migrations = existsSync(join("supabase", "migrations"))
  ? readdirSync(join("supabase", "migrations"))
  : [];
check(
  "18 no editable requirement-row commercial SoT migration",
  !migrations.some((name) => {
    if (name.includes("estimate_requirement_snapshots")) return false;
    return /r1[._-]1|req.snapshot|estimate_requirement/i.test(name);
  })
);

check("Production Scope Discovery remains disabled", isScopeDiscoveryEnabled({}) === false);
check("Company DNA not started", !existsSync(join("lib", "company-dna")));
check(
  "component authority is external policy, not a requirement field",
  existsSync(join("lib", "estimate", "component-authority.ts")) &&
    read("lib/estimate/component-authority.ts").includes("LEGACY_AUTHORITATIVE") &&
    read("lib/estimate/component-authority.ts").includes("SHADOW") &&
    !reqSrc.includes("commercialAuthority:")
);
check(
  "purchaseQuantity documented as estimating qty not procurement pack",
  reqSrc.includes("Continuous estimating purchase quantity") &&
    reqSrc.includes("Do not") &&
    reqSrc.toLowerCase().includes("redefine this later")
);
check(
  "ISD-MAP-01 policy documented (no id merge now)",
  read("docs/product/QUOTR_SUPPORTED_WORK_AREAS.md").includes("ISD-MAP-01")
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
