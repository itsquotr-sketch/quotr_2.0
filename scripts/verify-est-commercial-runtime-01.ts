/**
 * EST-COMMERCIAL-RUNTIME-01 — hosted benchmark resolution regression.
 *
 * Run: npx --yes tsx scripts/verify-est-commercial-runtime-01.ts
 *
 * Uses calculateEstimate (the live Preview estimator entry), not only
 * commercializeCeilings with synthetic catalogue context.
 *
 * Preview only. No Production. Do not change approved benchmark values.
 */
import { spawnSync } from "node:child_process";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { EstimateLineItem } from "../components/assistant/types";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import { derivedDimensionedPlasterboardCost } from "../lib/estimate/ceilings-plasterboard-derived-cost";
import {
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
  CEILINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-bulkheads";
import {
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT,
  CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT,
} from "../lib/estimate/ceilings-fixings";
import {
  CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR,
  CEILINGS_BULKHEAD_LINING_LABOUR,
  CEILINGS_INSULATION_LABOUR,
  CEILINGS_PLASTERBOARD_LABOUR,
  CEILINGS_PRODUCTIVITY_KEYS,
  CEILINGS_QUOTR_PRODUCTIVITY_HOURS,
  CEILINGS_SPECIALIST_COMPONENT,
} from "../lib/estimate/ceilings-identities";
import { CEILINGS_INSULATION_COMPONENT } from "../lib/estimate/ceilings-insulation";
import { CEILINGS_PLASTERBOARD_COMPONENT } from "../lib/estimate/ceilings-lining";
import { calculateCeilingsPhysical } from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingBulkhead,
  createEmptyCeilingPortion,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { CEILINGS_PLASTERBOARD_SHEET_SIZE_ASSUMPTION_STATEMENT } from "../lib/estimate/ceilings-information-contract";
import { CEILING_INSULATION_THERMAL_KEY, ORDINARY_THERMAL_INSULATION_COST } from "../lib/estimate/insulation-fallback";
import {
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_140_MATERIAL_COMPONENT,
  INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT,
  INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT,
  INTERNAL_WALLS_INSULATION_LABOUR_COMPONENT,
  INTERNAL_WALLS_INSULATION_MATERIAL_COMPONENT,
  INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT,
  INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT,
  INTERNAL_WALLS_STEEL_STUD_KEY,
  INTERNAL_WALLS_STEEL_TRACK_KEY,
  INTERNAL_WALLS_TIMBER_140_KEY,
  INTERNAL_WALLS_TIMBER_90_KEY,
  internalWallsLiningLabourComponent,
  internalWallsLiningMaterialComponent,
} from "../lib/estimate/internal-walls-identities";
import {
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_INSULATION_TYPE_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
} from "../lib/estimate/internal-walls-finish";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
} from "../lib/estimate/internal-walls-wall-types";
import { liveQuotrMaterialCost } from "../lib/estimate/benchmark-coverage";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import type {
  EstimateContext,
  EstimateFact,
  EstimateResult,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import { PREVIEW_AUTH_SITE_ORIGIN_STABLE } from "./lib/preview-auth-fixture";

const BENCHMARK_01B = "4d94fb53979180ea94b7ac319c6c5406bc03882a";
const STANDARD_13_3000_KEY = "sheet.plasterboard.standard.13mm.3000x1200.each";
const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const BH1 = "bbbbbbbb-bbbb-4ccc-8ddd-222222222222";

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

function near(actual: number | null | undefined, expected: number, tol = 0.05): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

function spawnVerifier(script: string): boolean {
  const result = spawnSync("npx", ["--yes", "tsx", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(result.stdout);
    console.log(result.stderr);
  }
  return result.status === 0;
}

function spawnCmd(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(result.stdout);
    console.log(result.stderr);
  }
  return result.status === 0;
}

const SETTINGS: OrganisationSettings = {
  id: "s1",
  org_id: "o1",
  default_margin_percent: 20,
  default_contingency_percent: 0,
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

const WASTAGE = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

function wa(type: string, id: string, name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1 };
}

function orgRate(
  itemKey: string,
  unit: string,
  cost: number,
  extras?: Partial<OrganisationRate>
): OrganisationRate {
  return {
    id: `rate-${itemKey}`,
    rate_type: "material",
    trade: null,
    work_area_type: null,
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...extras,
  };
}

function ordinaryLounge(params?: {
  insulation?: boolean;
  insulationType?: "thermal" | "acoustic";
  persistSheets?: boolean;
  bulkhead?: boolean;
  specialist?: boolean;
}): CeilingPortion {
  const row = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
  row.structure.family = "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = "plasterboard";
  row.lining.plasterboard_product = "standard";
  row.lining.thickness_mm = 13;
  if (params?.persistSheets) {
    row.lining.sheet_length_mm = 3000;
    row.lining.sheet_width_mm = 1200;
  }
  row.geometry.mode = "length_width";
  row.geometry.length_m = 4;
  row.geometry.width_m = 3;
  row.geometry.area_m2 = 12;
  row.height_m = 2.4;
  row.finish.insulation_included = params?.insulation === true;
  if (params?.insulation) {
    row.finish.insulation_type = params.insulationType ?? "thermal";
  }
  row.has_bulkheads = false;
  if (params?.bulkhead) {
    const bulkhead = createEmptyCeilingBulkhead({ id: BH1, label: "Downstand" });
    bulkhead.form = "conventional_two_face_downstand";
    bulkhead.topology = "conventional_two_face_downstand";
    bulkhead.length_m = 5;
    bulkhead.depth_m = 0.5;
    bulkhead.height_m = 0.5;
    bulkhead.framing_type = "timber";
    bulkhead.lining_type = "standard";
    bulkhead.thickness_mm = 13;
    row.has_bulkheads = true;
    row.bulkheads = [bulkhead];
    row.active_bulkhead_id = BH1;
  }
  if (params?.specialist) row.specialist_kind = "coffered";
  return row;
}

function writePortions(portions: CeilingPortion[]): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId: "c1",
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function hostedCtx(
  facts: EstimateFact[],
  extra?: {
    rates?: OrganisationRate[];
    constraints?: EstimateContext["constraints"];
    settings?: OrganisationSettings | null;
    workAreas?: EstimateWorkArea[];
  }
): EstimateContext {
  return {
    project: { id: "est-commercial-runtime-01", qualityLevel: "standard" },
    confirmedWorkAreas: extra?.workAreas ?? [wa("ceilings", "c1", "Ceilings")],
    facts,
    constraints: extra?.constraints ?? [],
    organisationSettings: extra?.settings === undefined ? SETTINGS : extra.settings,
    materialWastageSettings: WASTAGE,
    rates: extra?.rates ?? [],
  } as unknown as EstimateContext;
}

function hostedCeiling(
  portion: CeilingPortion,
  extra?: Parameters<typeof hostedCtx>[1]
): EstimateResult {
  return calculateEstimate(hostedCtx(writePortions([portion]), extra));
}

function material(
  requirements: readonly { kind: string; componentKey: string }[],
  componentKey: string
): MaterialRequirement | undefined {
  return requirements.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" && row.componentKey === componentKey
  );
}

function labour(
  requirements: readonly { kind: string; componentKey: string }[],
  componentKey: string
): LabourRequirement | undefined {
  return requirements.find(
    (row): row is LabourRequirement =>
      row.kind === "labour" && row.componentKey === componentKey
  );
}

function costOf(result: EstimateResult, componentKey: string): number {
  return result.lineItems
    .filter((item) => item.componentKey === componentKey)
    .reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);
}

function isPricingRequiredLine(item: {
  rateSourceType?: string | null;
  notes?: string | null;
  recommendedCost?: number;
}): boolean {
  return (
    item.rateSourceType === "missing" ||
    /pricing required/i.test(item.notes ?? "")
  );
}

function writeWall(writes: Array<{ key: string; value: unknown }>): EstimateFact[] {
  let facts: EstimateFact[] = [
    { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, work_area_id: "w1", value: "new_partition" },
  ];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
    });
  }
  return facts;
}

function mapReviewLines(result: EstimateResult): EstimateLineItem[] {
  return result.lineItems.map((item, index) => ({
    id: `line-${index}`,
    ...item,
  })) as EstimateLineItem[];
}

function reviewOf(result: EstimateResult, workAreaType = "ceilings") {
  return composeBuilderReview({
    estimate: {
      recommendedCost: result.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
      recommendedSell: result.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
      marginPercent: 20,
      confidence: result.confidence,
      assumptions: result.assumptions,
      missingInfo: result.missingInfo,
      lineItems: mapReviewLines(result),
    },
    workAreas: [
      {
        id: workAreaType === "ceilings" ? "c1" : "w1",
        type: workAreaType,
        name: workAreaType === "ceilings" ? "Ceilings" : "Internal walls",
        status: "confirmed",
      },
    ],
    requirements: result.requirements,
  });
}

console.log("=== EST-COMMERCIAL-RUNTIME-01 ===\n");

console.log("--- A ancestry / catalogue still in HEAD ---\n");
const ancestor = spawnSync(
  "git",
  ["merge-base", "--is-ancestor", BENCHMARK_01B, "HEAD"],
  { cwd: process.cwd() }
);
check("A EST-BENCHMARK-01B is ancestor of HEAD", ancestor.status === 0);
const derived3000 = derivedDimensionedPlasterboardCost(STANDARD_13_3000_KEY);
check(
  "HEAD catalogue still has 13mm Standard 3000 derived $22.50",
  derived3000?.derivedCost === 22.5 &&
    liveQuotrMaterialCost("sheet.plasterboard.standard.each") === 18 &&
    liveQuotrMaterialCost(CEILING_INSULATION_THERMAL_KEY) === 12 &&
    CEILINGS_QUOTR_PRODUCTIVITY_HOURS[CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet] === 0.5 &&
    CEILINGS_QUOTR_PRODUCTIVITY_HOURS[CEILINGS_PRODUCTIVITY_KEYS.insulationM2] === 0.05
);
check(
  "stable Preview URL is hardening/stage-2a-security",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);

console.log("\n--- Hosted ordinary 4×3 thermal lounge (disclosed 3000×1200) ---\n");
const lounge = ordinaryLounge({ insulation: true });
const physical = calculateCeilingsPhysical({
  facts: writePortions([lounge]),
  workArea: wa("ceilings", "c1", "Ceilings"),
  materialWastageSettings: WASTAGE,
});
const pbPhysical = physical.requirements.find(
  (row) => row.kind === "material" && row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
) as MaterialRequirement | undefined;
const insPhysical = physical.requirements.find(
  (row) => row.kind === "material" && row.componentKey === CEILINGS_INSULATION_COMPONENT
) as MaterialRequirement | undefined;
const fixPhysical = physical.requirements.find(
  (row) => row.kind === "material" && row.componentKey === CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT
) as MaterialRequirement | undefined;

console.log(
  JSON.stringify(
    {
      physicalCompleteness: physical.completeness,
      plasterboard: {
        materialKey: pbPhysical?.materialKey ?? null,
        purchaseQuantity: pbPhysical?.purchaseQuantity ?? null,
        baseQuantity: pbPhysical?.baseQuantity ?? null,
        pricedBeforeCommercial: pbPhysical?.priced ?? null,
      },
      insulation: {
        materialKey: insPhysical?.materialKey ?? null,
        purchaseQuantity: insPhysical?.purchaseQuantity ?? null,
      },
      fixings: {
        materialKey: fixPhysical?.materialKey ?? null,
        purchaseQuantity: fixPhysical?.purchaseQuantity ?? null,
      },
    },
    null,
    2
  )
);

const hosted = hostedCeiling(lounge);
const pb = material(hosted.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
const pbLab = labour(hosted.requirements, CEILINGS_PLASTERBOARD_LABOUR)!;
const fixings = material(hosted.requirements, CEILINGS_FIXINGS_PLASTERBOARD_COMPONENT)!;
const ins = material(hosted.requirements, CEILINGS_INSULATION_COMPONENT)!;
const insLab = labour(hosted.requirements, CEILINGS_INSULATION_LABOUR)!;
const ordinaryCost = hosted.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);

console.log(
  JSON.stringify(
    {
      afterCommercial: {
        plasterboard: {
          materialKey: pb.materialKey,
          purchaseQuantity: pb.purchaseQuantity,
          unitCost: pb.unitCost,
          rateSource: pb.rateSource,
          priced: pb.priced,
        },
        plasterboardLabour: {
          operation: pbLab.productivityBasis.key,
          hoursPerUnit: pbLab.productivityBasis.hoursPerUnit,
          quantity: pbLab.productivityBasis.quantity,
          baseHours: pbLab.baseHours,
          priced: pbLab.priced,
        },
        fixings: {
          materialKey: fixings.materialKey,
          purchaseQuantity: fixings.purchaseQuantity,
          unitCost: fixings.unitCost,
          rateSource: fixings.rateSource,
        },
        insulation: {
          materialKey: ins.materialKey,
          purchaseQuantity: ins.purchaseQuantity,
          unitCost: ins.unitCost,
          rateSource: ins.rateSource,
        },
        insulationLabour: {
          operation: insLab.productivityBasis.key,
          hoursPerUnit: insLab.productivityBasis.hoursPerUnit,
          baseHours: insLab.baseHours,
          priced: insLab.priced,
        },
        ordinaryCost,
      },
    },
    null,
    2
  )
);

check("B hosted Standard GIB resolves $22.50", pb.priced && near(pb.unitCost, 22.5) && pb.materialKey === STANDARD_13_3000_KEY);
check(
  "C hosted PB productivity resolves 0.50",
  pbLab.priced &&
    pbLab.productivityBasis.key === CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet &&
    near(pbLab.productivityBasis.hoursPerUnit, 0.5)
);
check(
  "D hosted PB labour = 2h",
  near(pb.baseQuantity, 4) &&
    near(pb.purchaseQuantity, 5) &&
    near(pbLab.productivityBasis.quantity, 4) &&
    near(pbLab.baseHours, 2)
);
check(
  "E hosted fixings resolve $2.50/m²",
  fixings.priced &&
    near(fixings.purchaseQuantity, 12) &&
    near(fixings.unitCost, 2.5) &&
    near(fixings.totalCost, 30)
);
check(
  "F hosted insulation resolves $12/m²",
  ins.priced &&
    ins.materialKey === CEILING_INSULATION_THERMAL_KEY &&
    near(ins.purchaseQuantity, 12) &&
    near(ins.unitCost, 12) &&
    near(ins.totalCost, 144)
);
check(
  "G hosted insulation productivity resolves 0.05",
  insLab.priced &&
    insLab.productivityBasis.key === CEILINGS_PRODUCTIVITY_KEYS.insulationM2 &&
    near(insLab.productivityBasis.hoursPerUnit, 0.05)
);
check("H hosted insulation labour = 0.6h", near(insLab.baseHours, 0.6));
check(
  "I ordinary fixture has no PR",
  hosted.lineItems.every((item) => !isPricingRequiredLine(item)) &&
    hosted.requirements.filter((row) => row.kind === "material" || row.kind === "labour").every((row) => row.priced)
);
check("J ordinary raw cost = $442.50 before conditions", near(ordinaryCost, 442.5));

const constrained = hostedCeiling(lounge, {
  constraints: [{ key: "site_access", label: "Site access", value: "Difficult" }],
});
const constrainedPbLab = labour(constrained.requirements, CEILINGS_PLASTERBOARD_LABOUR)!;
const constrainedInsLab = labour(constrained.requirements, CEILINGS_INSULATION_LABOUR)!;
const constrainedPb = material(constrained.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
const constrainedIns = material(constrained.requirements, CEILINGS_INSULATION_COMPONENT)!;
check(
  "K condition factor changes hours only",
  near(constrainedPbLab.baseHours, 2) &&
    near(constrainedPbLab.adjustedHours, 2.2) &&
    near(constrainedInsLab.adjustedHours, 0.66) &&
    near(constrainedPb.purchaseQuantity, 5) &&
    near(constrainedIns.purchaseQuantity, 12) &&
    constrained.lineItems.every((item) => !isPricingRequiredLine(item))
);

const companyHosted = hostedCeiling(lounge, {
  rates: [
    orgRate(STANDARD_13_3000_KEY, "each", 40),
    orgRate(CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet, "sheet", 0.8, {
      rate_type: "productivity",
    }),
  ],
});
const companyPb = material(companyHosted.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
const companyPbLab = labour(companyHosted.requirements, CEILINGS_PLASTERBOARD_LABOUR)!;
check(
  "L company material overrides Quotr",
  companyPb.priced && companyPb.rateSource === "company" && near(companyPb.unitCost, 40)
);
check(
  "M company productivity overrides Quotr",
  companyPbLab.priced &&
    companyPbLab.rateProvenance === "company" &&
    near(companyPbLab.productivityBasis.hoursPerUnit, 0.8) &&
    near(companyPbLab.baseHours, 3.2)
);
check(
  "N no ordinary benchmark line is $0 from a failed lookup",
  hosted.lineItems.every((item) => (item.recommendedCost ?? 0) > 0) &&
    !hosted.lineItems.some((item) => item.rateSourceType === "missing")
);

const specialist = hostedCeiling(ordinaryLounge({ specialist: true }));
check(
  "O true specialist still PR",
  specialist.requirements.some(
    (row) => row.componentKey === CEILINGS_SPECIALIST_COMPONENT && row.priced === false
  ) &&
    specialist.lineItems.some(
      (item) => item.componentKey === CEILINGS_SPECIALIST_COMPONENT && item.rateSourceType === "missing"
    )
);
const acoustic = hostedCeiling(ordinaryLounge({ insulation: true, insulationType: "acoustic" }));
const acousticIns = material(acoustic.requirements, CEILINGS_INSULATION_COMPONENT)!;
const acousticPb = material(acoustic.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
check(
  "U Pricing Required semantics unchanged (acoustic insulation PR, lining still priced)",
  acousticIns.priced === false &&
    acousticIns.rateSource === "missing" &&
    acousticIns.unitCost == null &&
    acousticPb.priced === true &&
    near(acousticPb.unitCost, 22.5)
);

const nullSettings = hostedCeiling(lounge, { settings: null });
check(
  "null organisationSettings still allows Quotr starters",
  material(nullSettings.requirements, CEILINGS_PLASTERBOARD_COMPONENT)?.priced === true &&
    near(material(nullSettings.requirements, CEILINGS_PLASTERBOARD_COMPONENT)?.unitCost, 22.5)
);

console.log("\n--- P–R ordinary Bulkhead consumes 3000×1200 ---\n");
const bulkheadPortion = ordinaryLounge({ bulkhead: true });
const bhPhysical = calculateCeilingsPhysical({
  facts: writePortions([bulkheadPortion]),
  workArea: wa("ceilings", "c1", "Ceilings"),
  materialWastageSettings: WASTAGE,
});
const bhTakeoff = bhPhysical.portions[0]?.bulkheads[0];
check(
  "P standard Bulkhead consumes 3000×1200 assumption",
  bhTakeoff?.status === "ok" &&
    bhTakeoff.sheetSizeSource === "assumed_disclosed" &&
    bhTakeoff.sheetSizeAssumption === CEILINGS_PLASTERBOARD_SHEET_SIZE_ASSUMPTION_STATEMENT &&
    bhTakeoff.liningMaterialKey === STANDARD_13_3000_KEY &&
    bhTakeoff.layerCount === 1 &&
    bhTakeoff.layerCountSource === "assumed_disclosed"
);
check(
  "Q standard Bulkhead calculates 28lm / 5m² / 2 installed / 3 purchase",
  near(bhTakeoff?.framingLm, 28) &&
    near(bhTakeoff?.liningAreaM2, 5) &&
    near(bhTakeoff?.installedSheets, 2) &&
    near(bhTakeoff?.purchaseSheets, 3)
);

const hostedBh = hostedCeiling(bulkheadPortion);
const bhFraming = costOf(hostedBh, CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT);
const bhFramingFix = costOf(hostedBh, CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT);
const bhFramingLab = costOf(hostedBh, CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR);
const bhLining = costOf(hostedBh, CEILINGS_BULKHEAD_LINING_COMPONENT);
const bhLiningFix = costOf(hostedBh, CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT);
const bhLiningLab = costOf(hostedBh, CEILINGS_BULKHEAD_LINING_LABOUR);
const bhRaw = bhFraming + bhFramingFix + bhFramingLab + bhLining + bhLiningFix + bhLiningLab;
check(
  "R standard Bulkhead raw cost $637 pre-conditions",
  near(bhFraming, 173.6) &&
    near(bhFramingFix, 21) &&
    near(bhFramingLab, 302.4) &&
    near(bhLining, 67.5) &&
    near(bhLiningFix, 12.5) &&
    near(bhLiningLab, 60) &&
    near(bhRaw, 637)
);
const loungeWithBh = material(hostedBh.requirements, CEILINGS_PLASTERBOARD_COMPONENT)!;
check(
  "sibling ordinary bulkhead does not zero lounge lining",
  loungeWithBh.priced === true &&
    near(loungeWithBh.unitCost, 22.5) &&
    !isPricingRequiredLine(
      hostedBh.lineItems.find((item) => item.componentKey === CEILINGS_PLASTERBOARD_COMPONENT)!
    )
);

console.log("\n--- S Internal Walls hosted ordinary path ---\n");
const iwTimber90 = writeWall([
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.label", value: "Type A" },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "Yes" },
  { key: INTERNAL_WALLS_INSULATION_TYPE_KEY, value: "Thermal" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "Both sides" },
]);
const iw140 = writeWall([
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.label", value: "Type B" },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "140 mm timber framing — 140×45" },
  { key: "internal_walls.wall_type.length_lm", value: 8 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
]);
const iwSteel = writeWall([
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.label", value: "Steel partition" },
  { key: "internal_walls.wall_type.frame_system", value: "Steel framing" },
  { key: "internal_walls.wall_type.length_lm", value: 10 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
]);

function iwHosted(facts: EstimateFact[]): EstimateResult {
  return calculateEstimate(
    hostedCtx(facts, { workAreas: [wa("internal_walls", "w1", "Internal walls")] })
  );
}

function iwPriced(result: EstimateResult, componentKey: string, itemKey?: string): boolean {
  const req = result.requirements.find(
    (row) =>
      (row.kind === "material" || row.kind === "labour") &&
      row.componentKey === componentKey
  );
  if (req && "priced" in req && req.priced === true && (req.totalCost ?? 0) > 0) {
    if (itemKey && "materialKey" in req && req.kind === "material") {
      return req.materialKey === itemKey;
    }
    return true;
  }
  const line = result.lineItems.find((item) => item.componentKey === componentKey);
  return Boolean(
    line &&
      line.rateSourceType !== "missing" &&
      (line.recommendedCost ?? 0) > 0
  );
}

const timber90Est = iwHosted(iwTimber90);
const liningMatKey = internalWallsLiningMaterialComponent("standard_gib");
const liningLabKey = internalWallsLiningLabourComponent("standard_gib");
check(
  "S ordinary IW 13mm Standard plasterboard resolves",
  iwPriced(timber90Est, liningMatKey) && iwPriced(timber90Est, liningLabKey)
);
check(
  "S ordinary IW 90×45 timber resolves",
  iwPriced(timber90Est, INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT, INTERNAL_WALLS_TIMBER_90_KEY)
);
check(
  "S ordinary IW thermal insulation resolves",
  iwPriced(timber90Est, INTERNAL_WALLS_INSULATION_MATERIAL_COMPONENT) &&
    iwPriced(timber90Est, INTERNAL_WALLS_INSULATION_LABOUR_COMPONENT)
);
check(
  "S ordinary IW fixings resolve",
  iwPriced(timber90Est, INTERNAL_WALLS_FRAMING_FIXINGS_COMPONENT)
);
check(
  "S ordinary IW skirting material/productivity resolve",
  iwPriced(timber90Est, INTERNAL_WALLS_SKIRTING_MATERIAL_COMPONENT) &&
    iwPriced(timber90Est, INTERNAL_WALLS_SKIRTING_LABOUR_COMPONENT)
);
const timber140Est = iwHosted(iw140);
check(
  "S ordinary IW 140×45 timber resolves",
  iwPriced(timber140Est, INTERNAL_WALLS_FRAMING_140_MATERIAL_COMPONENT, INTERNAL_WALLS_TIMBER_140_KEY)
);
const steelEst = iwHosted(iwSteel);
check(
  "S ordinary IW 92mm steel track/stud resolves",
  iwPriced(steelEst, INTERNAL_WALLS_FRAMING_STEEL_TRACK_COMPONENT, INTERNAL_WALLS_STEEL_TRACK_KEY) &&
    iwPriced(steelEst, INTERNAL_WALLS_FRAMING_STEEL_STUD_COMPONENT, INTERNAL_WALLS_STEEL_STUD_KEY)
);

console.log("\n--- T company authority + Builder Review ---\n");
check(
  "T company authority remains above Quotr on hosted path",
  companyPb.rateSource === "company" &&
    near(companyPb.unitCost, 40) &&
    companyPbLab.rateProvenance === "company" &&
    getCatalogueEntry(STANDARD_13_3000_KEY)?.defaultCostRate == null
);
const review = reviewOf(hosted);
const reviewText = JSON.stringify(review);
check(
  "Builder Review shows Quotr benchmark, not Rate required, for ordinary GIB",
  /Quotr benchmark/i.test(reviewText) &&
    /22\.5/.test(reviewText) &&
    !/Rate required/i.test(reviewText)
);

const companyReview = reviewOf(companyHosted);
check(
  "Builder Review company rate label remains for company override",
  /Company rate|Your company rate/i.test(JSON.stringify(companyReview))
);

console.log("\n--- Catalogue identity proof (no new numbers) ---\n");
check(
  "approved numbers unchanged",
  liveQuotrMaterialCost("sheet.plasterboard.standard.each") === 18 &&
    derivedDimensionedPlasterboardCost(STANDARD_13_3000_KEY)?.derivedCost === 22.5 &&
    liveQuotrMaterialCost(CEILING_INSULATION_THERMAL_KEY) === ORDINARY_THERMAL_INSULATION_COST &&
    ORDINARY_THERMAL_INSULATION_COST === 12 &&
    CEILINGS_QUOTR_PRODUCTIVITY_HOURS[CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet] === 0.5 &&
    CEILINGS_QUOTR_PRODUCTIVITY_HOURS[CEILINGS_PRODUCTIVITY_KEYS.insulationM2] === 0.05 &&
    liveQuotrMaterialCost(INTERNAL_WALLS_TIMBER_90_KEY) === 6.2
);

if (!process.env.EST_RUNTIME_01_CORE_ONLY) {
  console.log("\n--- Prior verifiers ---\n");
  const prior = [
    "scripts/verify-est-benchmark-01a.ts",
    "scripts/verify-est-benchmark-01b.ts",
  ];
  for (const script of prior) {
    check(script.replace("scripts/", ""), spawnVerifier(script));
  }

  console.log("\n--- TypeScript / eslint / build:safe ---\n");
  check("TypeScript", spawnCmd("npx", ["tsc", "--noEmit"]));
  check(
    "targeted eslint",
    spawnCmd("npx", [
      "eslint",
      "lib/estimate/ceilings-commercial.ts",
      "lib/estimate/ceilings-bulkheads.ts",
      "lib/estimate/ceilings-lining.ts",
      "lib/estimate/ceilings-physical.ts",
      "scripts/verify-est-commercial-runtime-01.ts",
      "scripts/verify-est-benchmark-01b.ts",
    ])
  );
  check("build:safe", spawnCmd("npm", ["run", "build:safe"]));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
