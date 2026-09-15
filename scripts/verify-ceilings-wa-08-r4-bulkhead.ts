/**
 * CEILINGS WA-08-R4 + WA-08-R5 — ordinary supported Bulkhead topology,
 * conservative free-text classification, and commercial closure.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-08-r4-bulkhead.ts
 *
 * Preview only. No rate / main-ceiling formula changes. No Production.
 */
import { spawnSync } from "node:child_process";
import type { EstimateLineItem } from "../components/assistant/types";
import type { OrganisationSettings } from "../components/setup/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { extractCeilingPortionsFromBrief } from "../lib/estimate/ceilings-brief";
import {
  calculateCeilingBulkhead,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
  CEILINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-bulkheads";
import { listCeilingsClarifyCandidates } from "../lib/estimate/ceilings-clarify";
import {
  commercializeCeilings,
} from "../lib/estimate/ceilings-commercial";
import {
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-fixings";
import {
  CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR,
  CEILINGS_BULKHEAD_LINING_LABOUR,
  CEILINGS_SPECIALIST_COMPONENT,
} from "../lib/estimate/ceilings-identities";
import { CEILINGS_PLASTERBOARD_COMPONENT } from "../lib/estimate/ceilings-lining";
import {
  calculateCeilingsPhysical,
  CEILING_PHYSICAL_COMPLETENESS,
} from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_ADD_BULKHEAD_KEY,
  CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION,
  CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED,
  CEILINGS_BULKHEAD_TOPOLOGY_V1,
  CEILINGS_DUPLICATE_BULKHEAD_KEY,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
  isUnsupportedCeilingBulkhead,
  normalizeExtractedCeilingPortions,
  parseCeilingBulkhead,
  parseCeilingsPortions,
  resolveCeilingsPortions,
  type CeilingBulkhead,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { runCountFromSpacing } from "../lib/estimate/run-count";
import type {
  EstimateConstraint,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";
import { buildWorkAreaDescriptionsMap } from "../lib/work-areas/quote-description";
import { PREVIEW_AUTH_SITE_ORIGIN_STABLE } from "./lib/preview-auth-fixture";

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

function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const BH1 = "cccccccc-dddd-4eee-8fff-333333333333";

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

const SETTINGS: OrganisationSettings = {
  id: "s1",
  org_id: "o1",
  default_margin_percent: 10,
  default_contingency_percent: 0,
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

const WA: EstimateWorkArea = {
  id: "c1",
  type: "ceilings",
  name: "Ceilings",
  sort_order: 1,
};

function write(
  facts: EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId?: string,
  componentId?: string
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts,
    workAreaId: "c1",
    key,
    value,
    nestedItemId,
    componentId,
  });
}

function writePortions(portions: CeilingPortion[]): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId: "c1",
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function ordinaryLounge(): CeilingPortion {
  const row = createEmptyCeilingPortion({ id: P1, label: "Lounge" });
  row.structure.family = "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = "plasterboard";
  row.lining.plasterboard_product = "standard";
  row.lining.thickness_mm = 13;
  row.lining.sheet_length_mm = 3000;
  row.lining.sheet_width_mm = 1200;
  row.lining.layers = 1;
  row.geometry.mode = "length_width";
  row.geometry.length_m = 5;
  row.geometry.width_m = 4;
  row.geometry.area_m2 = 20;
  row.finish.insulation_included = false;
  row.finish.painting_included = false;
  row.finish.stopping_included = false;
  row.finish.demolition_included = false;
  row.has_bulkheads = false;
  return row;
}

function fillOrdinaryBulkheadFields(facts: EstimateFact[], bulkheadId: string): EstimateFact[] {
  let next = facts;
  next = write(next, "ceilings.bulkhead.length_m", 5, P1, bulkheadId);
  next = write(next, "ceilings.bulkhead.depth_m", 0.5, P1, bulkheadId);
  next = write(next, "ceilings.bulkhead.height_m", 0.5, P1, bulkheadId);
  next = write(next, "ceilings.bulkhead.framing_type", "timber", P1, bulkheadId);
  next = write(next, "ceilings.bulkhead.lining_type", "standard", P1, bulkheadId);
  next = write(next, "ceilings.bulkhead.thickness_mm", 13, P1, bulkheadId);
  return next;
}

function snapshotBulkhead(bulkhead: CeilingBulkhead | undefined): Record<string, unknown> {
  return {
    id: bulkhead?.id ?? null,
    topology: bulkhead?.topology ?? null,
    length_m: bulkhead?.length_m ?? null,
    depth_m: bulkhead?.depth_m ?? null,
    height_m: bulkhead?.height_m ?? null,
    framing_type: bulkhead?.framing_type ?? null,
    lining_type: bulkhead?.lining_type ?? null,
    thickness_mm: bulkhead?.thickness_mm ?? null,
    form: bulkhead?.form ?? null,
    topology_source: bulkhead?.topology_source ?? null,
  };
}

function classifiedBulkhead(phrase: string): CeilingBulkhead | null {
  const portions = extractCeilingPortionsFromBrief(phrase);
  return portions.flatMap((row) => row.bulkheads)[0] ?? null;
}

function material(
  requirements: readonly { kind: string; componentKey: string }[],
  key: string
): MaterialRequirement | undefined {
  return requirements.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" && row.componentKey === key
  );
}

function labour(
  requirements: readonly { kind: string; componentKey: string }[],
  key: string
): LabourRequirement | undefined {
  return requirements.find(
    (row): row is LabourRequirement =>
      row.kind === "labour" && row.componentKey === key
  );
}

function mapReviewLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
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
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    componentId: item.componentId,
    nestedItemId: item.nestedItemId,
    contributingNestedItemIds: item.contributingNestedItemIds,
    notes: item.notes,
    includedInTotal: item.includedInTotal,
  }));
}

function reviewOf(
  commercial: {
    lineItems: readonly EstimateLineItemInput[];
    assumptions: readonly string[];
    missingInfo: readonly string[];
    requirements: readonly import("../lib/estimate/requirements").EstimateRequirement[];
  },
  facts: EstimateFact[]
) {
  const cost = commercial.lineItems.reduce(
    (sum, row) => sum + (row.recommendedCost ?? 0),
    0
  );
  const sell = commercial.lineItems.reduce(
    (sum, row) => sum + (row.recommendedSell ?? 0),
    0
  );
  return composeBuilderReview({
    estimate: {
      recommendedCost: cost,
      recommendedSell: sell,
      marginPercent: 10,
      confidence: 0.8,
      assumptions: commercial.assumptions,
      missingInfo: commercial.missingInfo,
      lineItems: mapReviewLines(commercial.lineItems),
    },
    workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
    requirements: commercial.requirements,
    facts,
  });
}

function quoteDraft(portions: CeilingPortion[]): string {
  const facts = writePortions(portions);
  const raw = facts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value;
  const value = typeof raw === "string" ? raw : JSON.stringify(raw);
  return (
    buildWorkAreaDescriptionsMap(
      [{ id: "c1", type: "ceilings", name: "Ceilings" }],
      new Map([
        ["c1", [{ key: CEILINGS_PORTIONS_FACT_KEY, label: "Portions", value }]],
      ])
    ).get("c1") ?? ""
  );
}

function runCommercial(
  facts: EstimateFact[],
  constraints: EstimateConstraint[] = []
) {
  const physical = calculateCeilingsPhysical({
    facts,
    workArea: WA,
    materialWastageSettings: WASTAGE,
  });
  const commercial = commercializeCeilings({
    physical,
    workArea: WA,
    rates: [],
    organisationSettings: SETTINGS,
    constraints,
  });
  return { physical, commercial };
}

function clarify(facts: EstimateFact[]) {
  const workAreas = [
    { id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" as const },
    { id: "p1", type: "painting", name: "Painting", status: "confirmed" as const },
    { id: "pl1", type: "plastering", name: "Plastering", status: "confirmed" as const },
  ];
  const plan = composeJobPlan({
    workAreas,
    facts,
    qualityLevel: "standard",
    briefText: "Lounge ceiling with a bulkhead.",
  });
  return composeClarifyView({
    stage: "quality",
    briefText: "Lounge ceiling with a bulkhead.",
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

console.log("=== CEILINGS WA-08-R4 bulkhead end-to-end ===\n");

let addFacts = writePortions([ordinaryLounge()]);
addFacts = write(addFacts, CEILINGS_ADD_BULKHEAD_KEY, BH1, P1, BH1);
const beforePersist = resolveCeilingsPortions({
  facts: addFacts,
  workAreaId: "c1",
}).portions[0]!.bulkheads[0]!;
console.log("A before persistence (Add Bulkhead)", snapshotBulkhead(beforePersist));
addFacts = fillOrdinaryBulkheadFields(addFacts, BH1);
const persisted = parseCeilingsPortions(
  addFacts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value
)[0]!.bulkheads[0]!;
console.log("A persisted / before calculateCeilingsPhysical", snapshotBulkhead(persisted));

const physicalFixture = calculateCeilingsPhysical({
  facts: addFacts,
  workArea: WA,
  materialWastageSettings: WASTAGE,
});
const physicalBh = physicalFixture.portions[0]!.bulkheads[0]!;
console.log("B/C calculateCeilingsPhysical / calculateCeilingBulkhead", {
  id: physicalBh.componentId,
  status: physicalBh.status,
  topologyAssumption: physicalBh.topologyAssumption,
  lengthM: physicalBh.lengthM,
  depthM: physicalBh.depthM,
  heightM: physicalBh.heightM,
  framingLm: physicalBh.framingLm,
  liningAreaM2: physicalBh.liningAreaM2,
  installedSheets: physicalBh.installedSheets,
  purchaseSheets: physicalBh.purchaseSheets,
});
console.log("D specialist classification", {
  unsupported: isUnsupportedCeilingBulkhead(persisted),
  topology: persisted.topology,
  form: persisted.form,
  source: persisted.topology_source,
});

check(
  "A ordinary Add Bulkhead gets conventional topology",
  beforePersist.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    persisted.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    persisted.form === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    !isUnsupportedCeilingBulkhead(persisted)
);
check(
  "B topology source is assumed/disclosed when not explicit",
  persisted.topology_source === "assumed_disclosed" &&
    CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION.includes("wall-adjacent downstand")
);

const islandText = extractCeilingPortionsFromBrief(
  "Lounge ceiling 4m x 3m with an island bulkhead."
);
const boxedText = extractCeilingPortionsFromBrief(
  "Lounge ceiling 4m x 3m with a boxed bulkhead."
);
check(
  "C explicit island stays unsupported",
  islandText.some((row) =>
    row.bulkheads.some(
      (bh) =>
        bh.form === "island" &&
        bh.topology === CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED &&
        isUnsupportedCeilingBulkhead(bh)
    )
  )
);
check(
  "D explicit boxed stays unsupported",
  boxedText.some((row) =>
    row.bulkheads.some(
      (bh) =>
        bh.form === "boxed" &&
        bh.topology === CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED &&
        isUnsupportedCeilingBulkhead(bh)
    )
  )
);

const lounge = resolveCeilingsPortions({
  facts: addFacts,
  workAreaId: "c1",
}).portions[0]!;
const takeoff = calculateCeilingBulkhead({
  portion: lounge,
  bulkhead: lounge.bulkheads[0]!,
  materialWastageSettings: WASTAGE,
});
check("E 5×0.5×0.5 → 15lm longitudinal", near(takeoff.longitudinalLm, 15));
check(
  "F nog stations = 13",
  takeoff.nogStations === 13 &&
    takeoff.nogStations === runCountFromSpacing(5, 0.45)
);
check("G nog LM = 13", near(takeoff.nogLm, 13));
check("H total framing = 28lm", near(takeoff.framingLm, 28));
check(
  "I lining area = 5m²",
  near(takeoff.liningAreaM2, 5) &&
    takeoff.exposedVerticalFaces === 1
);
check("J lining installed sheets = 2", takeoff.installedSheets === 2);
check("K lining purchase sheets = 3", takeoff.purchaseSheets === 3);

const fixtureRun = runCommercial(addFacts);
const bhFrame = material(
  fixtureRun.commercial.requirements,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT
);
const bhFix = material(
  fixtureRun.commercial.requirements,
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT
);
const bhFrameLab = labour(
  fixtureRun.commercial.requirements,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR
);
const bhLining = material(
  fixtureRun.commercial.requirements,
  CEILINGS_BULKHEAD_LINING_COMPONENT
);
const bhLiningFix = material(
  fixtureRun.commercial.requirements,
  CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT
);
const bhLiningLab = labour(
  fixtureRun.commercial.requirements,
  CEILINGS_BULKHEAD_LINING_LABOUR
);

check("L framing material COST = $173.60", near(bhFrame?.totalCost, 173.6));
check("M framing fixings COST = $21", near(bhFix?.totalCost, 21));
check(
  "N raw framing labour = 5.04h / $302.40",
  near(bhFrameLab?.baseHours, 5.04) && near(bhFrameLab?.totalCost, 302.4)
);
check("O lining material COST = $67.50", near(bhLining?.totalCost, 67.5));
check("P lining consumables COST = $12.50", near(bhLiningFix?.totalCost, 12.5));
check(
  "Q raw lining labour = 1h / $60",
  near(bhLiningLab?.baseHours, 1) && near(bhLiningLab?.totalCost, 60)
);

const bulkheadRaw =
  (bhFrame?.totalCost ?? 0) +
  (bhFix?.totalCost ?? 0) +
  (bhFrameLab?.totalCost ?? 0) +
  (bhLining?.totalCost ?? 0) +
  (bhLiningFix?.totalCost ?? 0) +
  (bhLiningLab?.totalCost ?? 0);
check("R raw fixture COST = $637", near(bulkheadRaw, 637));
check(
  "S standard Bulkhead has no PR",
  fixtureRun.commercial.requirements
    .filter((row) =>
      (row.componentKey ?? "").includes("bulkhead")
    )
    .every((row) => row.priced === true) &&
    !fixtureRun.commercial.missingInfo.some((row) =>
      /unsupported specialist bulkhead/i.test(row)
    )
);
check(
  "T standard Bulkhead commercial status complete",
  fixtureRun.commercial.completeness === "COMPLETE_COMMERCIAL" &&
    physicalFixture.completeness === "COMPLETE_PHYSICAL"
);

const review = reviewOf(fixtureRun.commercial, addFacts);
const reviewText = JSON.stringify(review);
check(
  "U Builder Review shows framing quantity",
  /28/.test(reviewText)
);
check(
  "V Builder Review shows lining quantity",
  /5(\.0)?m² lining/i.test(reviewText) || /5\.0m²/.test(reviewText)
);
check(
  "W Builder Review shows labour",
  /5\.04/.test(reviewText) || /Bulkhead timber framing install/i.test(reviewText)
);
check(
  "X Builder Review does not say unsupported",
  !/unsupported specialist bulkhead/i.test(reviewText) &&
    !/unsupported bulkhead form/i.test(reviewText)
);

const quote = quoteDraft(resolveCeilingsPortions({
  facts: addFacts,
  workAreaId: "c1",
}).portions);
check(
  "Y Quote wording includes wall-adjacent downstand + lining",
  /wall-adjacent downstand/i.test(quote) &&
    /13mm Standard plasterboard/i.test(quote)
);

const aiNormal = extractCeilingPortionsFromBrief(
  "Lounge ceiling 5m x 4m existing framing 13mm Standard GIB with a bulkhead."
);
const detailsFacts = writePortions([ordinaryLounge()]);
const afterYes = write(
  detailsFacts,
  "ceilings.portion.bulkheads_present",
  "Yes",
  P1
);
const detailsBhId = resolveCeilingsPortions({
  facts: afterYes,
  workAreaId: "c1",
}).portions[0]!.bulkheads[0]!.id;
const detailsFilled = fillOrdinaryBulkheadFields(afterYes, detailsBhId);
const detailsBh = resolveCeilingsPortions({
  facts: detailsFilled,
  workAreaId: "c1",
}).portions[0]!.bulkheads[0]!;
const detailsQs = listCeilingsClarifyCandidates({
  facts: detailsFilled,
  workAreaId: "c1",
  workAreaName: "Ceilings",
  briefText: "Lounge ceiling with a bulkhead.",
});
const refine = composeRefineView({
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
  facts: detailsFilled,
  constraints: [],
  briefText: "Lounge ceiling with a bulkhead.",
  qualityLevel: "standard",
  jobPlan: { cards: [{ workAreaId: "c1", workAreaType: "ceilings", name: "Ceilings", notConfirmed: false }] },
});
const refineRows = [...refine.highValue, ...refine.advanced];
const aiExtracted = normalizeExtractedCeilingPortions([
  {
    id: P1,
    label: "Lounge",
    bulkheads: [
      {
        length_m: 5,
        depth_m: 0.5,
        height_m: 0.5,
        framing_type: "timber",
        lining_type: "standard",
        thickness_mm: 13,
      },
    ],
  },
]);
const aiBh = aiExtracted[0]?.bulkheads[0];
check(
  "Z Add/Details/Refine/AI creation paths normalize consistently",
  aiNormal.some((row) =>
    row.bulkheads.some(
      (bh) =>
        bh.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
        bh.topology_source === "assumed_disclosed"
    )
  ) &&
    detailsBh.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    detailsBh.topology_source === "assumed_disclosed" &&
    !detailsQs.some((row) => row.factKey === "ceilings.bulkhead.form") &&
    refineRows.some(
      (row) =>
        row.factKey === "ceilings.bulkhead.form" &&
        row.assumed === true &&
        String(row.currentValue).toLowerCase().includes("wall-adjacent")
    ) &&
    aiBh?.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    aiBh.topology_source === "assumed_disclosed" &&
    Boolean(aiBh?.id)
);

const dupFacts = write(
  addFacts,
  CEILINGS_DUPLICATE_BULKHEAD_KEY,
  BH1,
  P1,
  BH1
);
const dupPortion = resolveCeilingsPortions({
  facts: dupFacts,
  workAreaId: "c1",
}).portions[0]!;
check(
  "AA duplicate Bulkhead gets new componentId",
  dupPortion.bulkheads.length === 2 &&
    dupPortion.bulkheads[0]!.id === BH1 &&
    dupPortion.bulkheads[1]!.id !== BH1 &&
    dupPortion.bulkheads[1]!.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    dupPortion.bulkheads[1]!.length_m === 5
);

const accessRun = runCommercial(addFacts, [
  { key: "site_access", label: "Site access", value: "Difficult" },
]);
const accessFrame = labour(
  accessRun.commercial.requirements,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR
);
const accessLining = labour(
  accessRun.commercial.requirements,
  CEILINGS_BULKHEAD_LINING_LABOUR
);
const accessBh = resolveCeilingsPortions({
  facts: addFacts,
  workAreaId: "c1",
}).portions[0]!.bulkheads[0]!;
const accessTakeoff = calculateCeilingBulkhead({
  portion: resolveCeilingsPortions({ facts: addFacts, workAreaId: "c1" })
    .portions[0]!,
  bulkhead: accessBh,
  materialWastageSettings: WASTAGE,
});
check(
  "AB Project Conditions adjust labour only, not quantities",
  near(accessTakeoff.framingLm, 28) &&
    near(accessTakeoff.liningAreaM2, 5) &&
    near(accessFrame?.baseHours, 5.04) &&
    (accessFrame?.adjustedHours ?? 0) > 5.04 &&
    near(accessLining?.baseHours, 1) &&
    (accessLining?.adjustedHours ?? 0) > 1
);

const islandRunPortion = ordinaryLounge();
const islandBh = parseCeilingBulkhead({
  id: BH1,
  form: "island",
  length_m: 5,
  depth_m: 0.5,
  height_m: 0.5,
  framing_type: "timber",
  lining_type: "standard",
  thickness_mm: 13,
})!;
islandRunPortion.has_bulkheads = true;
islandRunPortion.bulkheads = [islandBh];
const islandFacts = writePortions([islandRunPortion]);
const islandCommercial = runCommercial(islandFacts);
check(
  "AC existing specialist Bulkhead PR behavior remains",
  islandBh.topology === CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED &&
    islandCommercial.physical.portions[0]?.bulkheads[0]?.status ===
      "unsupported_specialist" &&
    islandCommercial.commercial.completeness !== "COMPLETE_COMMERCIAL" &&
    /unsupported specialist bulkhead/i.test(
      JSON.stringify(reviewOf(islandCommercial.commercial, islandFacts))
    )
);

const sticky = parseCeilingBulkhead({
  id: BH1,
  topology: CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED,
  form: null,
  length_m: 5,
  depth_m: 0.5,
  height_m: 0.5,
  framing_type: "timber",
  lining_type: "standard",
  thickness_mm: 13,
});
check(
  "sticky unsupported topology with null form is repaired to conventional",
  sticky?.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    sticky.form === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    sticky.topology_source === "assumed_disclosed"
);

const detailsView = clarify(detailsFilled);
check(
  "Details does not ask the technical topology enum",
  !detailsView.candidates.some((row) => row.factKey === "ceilings.bulkhead.form") &&
    !detailsView.candidates.some((row) => row.factKey === "ceilings.bulkhead.topology")
);

check(
  "Preview only — hardening branch URL",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security")
);

console.log("\n=== CEILINGS WA-08-R5 conservative bulkhead classification ===\n");

type ClassifiedForm = CeilingBulkhead["form"] | "unresolved";

function formOf(phrase: string): ClassifiedForm {
  return classifiedBulkhead(phrase)?.form ?? "unresolved";
}

const r5Matrix: readonly {
  phrase: string;
  expected: ClassifiedForm;
  ordinary: boolean;
}[] = [
  { phrase: "wall-adjacent bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  {
    phrase: "standard wall adjacent downstand",
    expected: CEILINGS_BULKHEAD_TOPOLOGY_V1,
    ordinary: true,
  },
  { phrase: "bulkhead against the wall", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "island bulkhead", expected: "island", ordinary: false },
  { phrase: "boxed bulkhead", expected: "boxed", ordinary: false },
  { phrase: "curved feature bulkhead", expected: "complex", ordinary: false },
  { phrase: "complex bulkhead", expected: "complex", ordinary: false },
  { phrase: "floating bulkhead", expected: "complex", ordinary: false },
  { phrase: "structural transfer bulkhead", expected: "complex", ordinary: false },
  { phrase: "bulkhead in the middle of the room", expected: "complex", ordinary: false },
  { phrase: "bulkhead exposed on all sides", expected: "complex", ordinary: false },
  { phrase: "services bulkhead", expected: "complex", ordinary: false },
  { phrase: "oversized bulkhead", expected: "complex", ordinary: false },
  { phrase: "bulkhead not against a wall", expected: "complex", ordinary: false },
  { phrase: "timber bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "timber-framed bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "steel bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "steel-framed bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "plasterboard bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "GIB-lined bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "13mm Standard GIB bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "insulated bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "plastered bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  { phrase: "painted bulkhead", expected: CEILINGS_BULKHEAD_TOPOLOGY_V1, ordinary: true },
  {
    phrase: "timber bulkhead 4m long, 500mm deep and 500mm high",
    expected: CEILINGS_BULKHEAD_TOPOLOGY_V1,
    ordinary: true,
  },
  { phrase: "timber floating bulkhead", expected: "complex", ordinary: false },
  { phrase: "steel island bulkhead", expected: "island", ordinary: false },
  { phrase: "plasterboard boxed bulkhead", expected: "boxed", ordinary: false },
];

console.log("WA-08-R5 classification matrix");
for (const row of r5Matrix) {
  const bh = classifiedBulkhead(row.phrase);
  const actual = bh?.form ?? "unresolved";
  console.log(`  ${JSON.stringify(row.phrase)} → ${actual}`);
  check(
    `R5 ${row.phrase}`,
    actual === row.expected &&
      (row.ordinary
        ? bh?.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
          !isUnsupportedCeilingBulkhead(bh)
        : bh != null &&
          bh.form !== CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
          bh.topology === CEILINGS_BULKHEAD_TOPOLOGY_UNSUPPORTED &&
          isUnsupportedCeilingBulkhead(bh))
  );
}

check(
  "R5 A explicit ordinary descriptions",
  formOf("wall-adjacent bulkhead") === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    formOf("standard wall adjacent downstand") === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    formOf("bulkhead against the wall") === CEILINGS_BULKHEAD_TOPOLOGY_V1
);
check(
  "R5 B bare bulkhead keeps disclosed ordinary assumption",
  classifiedBulkhead("bulkhead")?.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    classifiedBulkhead("bulkhead")?.topology_source === "assumed_disclosed" &&
    !isUnsupportedCeilingBulkhead(classifiedBulkhead("bulkhead")!)
);
check(
  "R5 C existing specialist descriptions",
  formOf("island bulkhead") === "island" &&
    formOf("boxed bulkhead") === "boxed" &&
    formOf("curved feature bulkhead") === "complex" &&
    formOf("complex bulkhead") === "complex"
);
check(
  "R5 D ambiguous/contradictory descriptions are not ordinary",
  [
    "floating bulkhead",
    "structural transfer bulkhead",
    "bulkhead in the middle of the room",
    "bulkhead exposed on all sides",
    "services bulkhead",
    "oversized bulkhead",
    "bulkhead not against a wall",
  ].every((phrase) => formOf(phrase) !== CEILINGS_BULKHEAD_TOPOLOGY_V1)
);
check(
  "R6 material/finish descriptors stay ordinary",
  [
    "timber bulkhead",
    "timber-framed bulkhead",
    "steel bulkhead",
    "steel-framed bulkhead",
    "plasterboard bulkhead",
    "GIB-lined bulkhead",
    "13mm Standard GIB bulkhead",
    "insulated bulkhead",
    "plastered bulkhead",
    "painted bulkhead",
    "timber bulkhead 4m long, 500mm deep and 500mm high",
  ].every((phrase) => formOf(phrase) === CEILINGS_BULKHEAD_TOPOLOGY_V1)
);
check(
  "R6 specialist plus material remains specialist",
  formOf("timber floating bulkhead") === "complex" &&
    formOf("steel island bulkhead") === "island" &&
    formOf("plasterboard boxed bulkhead") === "boxed" &&
    [
      "timber floating bulkhead",
      "steel island bulkhead",
      "plasterboard boxed bulkhead",
    ].every((phrase) => {
      const bh = classifiedBulkhead(phrase);
      return bh != null && isUnsupportedCeilingBulkhead(bh);
    })
);

const floatingBrief = extractCeilingPortionsFromBrief(
  "Lounge ceiling 5m x 4m existing framing 13mm Standard GIB with a floating bulkhead."
);
const floatingPortion = floatingBrief[0]!;
const floatingBhId = floatingPortion.bulkheads[0]!.id;
let floatingFacts = writePortions(floatingBrief);
floatingFacts = fillOrdinaryBulkheadFields(floatingFacts, floatingBhId);
const floatingResolved = resolveCeilingsPortions({
  facts: floatingFacts,
  workAreaId: "c1",
}).portions[0]!;
const floatingTakeoff = calculateCeilingBulkhead({
  portion: floatingResolved,
  bulkhead: floatingResolved.bulkheads[0]!,
  materialWastageSettings: WASTAGE,
});
const floatingRun = runCommercial(floatingFacts);
const floatingBhReqKeys = floatingRun.commercial.requirements.filter((row) =>
  (row.componentKey ?? "").includes("bulkhead")
);
const floatingSpecialist = floatingRun.commercial.requirements.find(
  (row) => row.componentKey === CEILINGS_SPECIALIST_COMPONENT
);
const floatingLining = material(
  floatingRun.commercial.requirements,
  CEILINGS_PLASTERBOARD_COMPONENT
);
const floatingSpecialistLine = floatingRun.commercial.lineItems.find(
  (item) => item.componentKey === CEILINGS_SPECIALIST_COMPONENT
);
check(
  "R5 E floating bulkhead is unsupported specialist, not ordinary takeoff",
  floatingResolved.bulkheads[0]!.form === "complex" &&
    isUnsupportedCeilingBulkhead(floatingResolved.bulkheads[0]!) &&
    floatingTakeoff.status === "unsupported_specialist" &&
    floatingTakeoff.framingLm == null &&
    floatingTakeoff.liningAreaM2 == null &&
    floatingRun.physical.portions[0]?.bulkheads[0]?.status ===
      "unsupported_specialist" &&
    floatingRun.physical.completeness ===
      CEILING_PHYSICAL_COMPLETENESS.UNSUPPORTED_SPECIALIST &&
    (floatingRun.commercial.completeness === "UNSUPPORTED_SPECIALIST" ||
      floatingRun.commercial.completeness === "PRICING_REQUIRED" ||
      floatingRun.commercial.completeness === "INFORMATION_REQUIRED")
);
check(
  "R5 E no ordinary bulkhead quantities or benchmark money",
  floatingBhReqKeys.every(
    (row) =>
      row.componentKey === CEILINGS_SPECIALIST_COMPONENT ||
      (row.priced !== true &&
        row.unitCost == null &&
        row.totalCost == null &&
        (row.baseQuantity == null || row.componentKey === CEILINGS_SPECIALIST_COMPONENT))
  ) &&
    !floatingBhReqKeys.some(
      (row) =>
        row.componentKey === CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT ||
        row.componentKey === CEILINGS_BULKHEAD_LINING_COMPONENT ||
        row.componentKey === CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT ||
        row.componentKey === CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT ||
        row.componentKey === CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR ||
        row.componentKey === CEILINGS_BULKHEAD_LINING_LABOUR
    ) &&
    floatingSpecialist?.priced === false &&
    floatingSpecialist?.unitCost == null &&
    floatingSpecialist?.totalCost == null &&
    floatingSpecialist?.rateSource === "missing" &&
    floatingSpecialistLine?.rateSourceType === "missing"
);
check(
  "R5 E supported main-ceiling sibling still prices",
  floatingLining?.priced === true &&
    (floatingLining.unitCost ?? 0) > 0 &&
    (floatingLining.totalCost ?? 0) > 0 &&
    floatingLining.rateSource !== "missing"
);
check(
  "R5 E missing rate is not a genuine $0 rate",
  floatingSpecialist?.priced === false &&
    floatingSpecialist?.unitCost !== 0 &&
    floatingSpecialist?.unitCost == null &&
    floatingRun.commercial.requirements
      .filter((row) => row.priced === false)
      .every((row) => row.unitCost == null && row.totalCost == null)
);
check(
  "R5 F ordinary hosted fixture COST unchanged",
  near(bhFrame?.totalCost, 173.6) &&
    near(bhFix?.totalCost, 21) &&
    near(bhFrameLab?.totalCost, 302.4) &&
    near(bhLining?.totalCost, 67.5) &&
    near(bhLiningFix?.totalCost, 12.5) &&
    near(bhLiningLab?.totalCost, 60) &&
    near(bulkheadRaw, 637) &&
    fixtureRun.commercial.completeness === "COMPLETE_COMMERCIAL"
);

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

function spawnCmd(cmd: string, args: string[]): boolean {
  const result = spawnSync(cmd, args, {
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

console.log("\n=== Prior Ceiling + commercial regressions ===\n");
const prior = [
  "scripts/verify-ceilings-wa-08-r3-details-state.ts",
  "scripts/verify-est-benchmark-01b.ts",
  "scripts/verify-foundation-r1-project-conditions-support.ts",
];
for (const script of prior) {
  check(script.replace("scripts/", ""), spawnVerifier(script));
}

console.log("\n--- TypeScript / eslint / build:safe ---\n");
check("AD TypeScript", spawnCmd("npx", ["tsc", "--noEmit"]));
check(
  "targeted eslint",
  spawnCmd("npx", [
    "eslint",
    "lib/estimate/ceilings-portions.ts",
    "lib/estimate/ceilings-brief.ts",
    "lib/estimate/ceilings-information-contract.ts",
    "lib/estimate/ceilings-clarify.ts",
    "lib/assistant/refine/adapters/ceilings.ts",
    "lib/assistant/builder-review/ceilings-review-groups.ts",
    "lib/work-areas/quote-description.ts",
    "components/assistant/refine/CeilingsPortionsPanel.tsx",
    "scripts/verify-ceilings-wa-08-r4-bulkhead.ts",
  ])
);
check("build:safe", spawnCmd("npm", ["run", "build:safe"]));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
