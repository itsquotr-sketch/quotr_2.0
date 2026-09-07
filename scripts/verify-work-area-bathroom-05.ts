/**
 * WA-BATHROOM-05 — fixtures, PC sums, plumbing/electrical hybrid.
 *
 * Run: npx --yes tsx scripts/verify-work-area-bathroom-05.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import {
  BATHROOM_AQUALINE_SHEET_KEY,
  BATHROOM_ELECTRICAL_COMPONENT,
  BATHROOM_FIXTURE_INSTALL_COMPONENTS,
  BATHROOM_FIXTURE_PC_KEYS,
  BATHROOM_FIXTURE_SUPPLY_COMPONENTS,
  BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT,
  BATHROOM_FRAMING_TIMBER_KEY,
  BATHROOM_FRAMING_TIMBER_LEGACY_KEY,
  BATHROOM_PLUMBING_COMPONENT,
  BATHROOM_WALL_LINING_COMPONENT,
  BATHROOM_WATERPROOFING_COMPONENT,
} from "../lib/estimate/bathroom-identities";
import {
  BATHROOM_FIXTURE_CATALOGUE,
  parseBathroomFixtureId,
  parseBathroomSelectedFixtures,
} from "../lib/estimate/bathroom-scope";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { SPECIFIC_MATERIAL_RATE_GROUPS } from "../lib/rates/specific-material-catalogue";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type {
  LabourRequirement,
  MaterialRequirement,
  SubcontractRequirement,
} from "../lib/estimate/requirements";

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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(
  id: string,
  type: string,
  name: string
): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function orgRate(itemKey: string, cost: number, rateType = "material"): OrganisationRate {
  return {
    id: `rate-${itemKey}`,
    rate_type: rateType,
    trade: null,
    work_area_type: null,
    item_key: itemKey,
    label: itemKey,
    unit: "each",
    cost_rate: cost,
    sell_rate: cost * 1.5,
    markup_percent: null,
    active: true,
  };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[],
  qualityLevel: "standard" | "premium" = "standard",
  rates: OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates,
  } as unknown as EstimateContext;
}

function composeBathroomClarify(facts: EstimateFact[], workAreaId = "b1") {
  const workAreas = [wa(workAreaId, "bathroom", "Bathroom")];
  const plan = composeJobPlan({
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
    })),
    facts,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
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
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    rateSourceType: item.rateSourceType,
  }));
}

function bathroom(
  facts: EstimateFact[],
  options?: { qualityLevel?: "standard" | "premium"; rates?: OrganisationRate[]; id?: string }
): ReturnType<typeof calculateBathroom> {
  const id = options?.id ?? "b1";
  return calculateBathroom(
    ctx(
      [wa(id, "bathroom", "Bathroom")],
      facts,
      options?.qualityLevel ?? "standard",
      options?.rates ?? []
    ),
    wa(id, "bathroom", "Bathroom")
  );
}

function materials(result: ReturnType<typeof calculateBathroom>): MaterialRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
}

function labour(result: ReturnType<typeof calculateBathroom>): LabourRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is LabourRequirement => row.kind === "labour"
  );
}

function subcontracts(
  result: ReturnType<typeof calculateBathroom>
): SubcontractRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is SubcontractRequirement => row.kind === "subcontract"
  );
}

const full = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
];

console.log("\n--- Catalogue / identities ---\n");
check(
  "fixture catalogue includes enclosure, heated rail, extract fan",
  BATHROOM_FIXTURE_CATALOGUE.includes("Shower enclosure") &&
    BATHROOM_FIXTURE_CATALOGUE.includes("Heated towel rail") &&
    BATHROOM_FIXTURE_CATALOGUE.includes("Extract fan")
);
check("legacy Towel rail still parses", parseBathroomFixtureId("Towel rail") === "heated_towel_rail");
check("legacy Mirror/cabinet still parses", parseBathroomFixtureId("Mirror/cabinet") === "mirror");
check("vanity PC $1200", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.vanity)?.defaultCostRate === 1200);
check("toilet PC $650", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.toilet)?.defaultCostRate === 650);
check("mirror PC $350", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.mirror)?.defaultCostRate === 350);
check(
  "plumbing Standard $3500",
  getCatalogueEntry("bathroom.plumbing.standard.allowance")?.defaultCostRate === 3500
);
check(
  "electrical Standard $1750",
  getCatalogueEntry("bathroom.electrical.standard.allowance")?.defaultCostRate === 1750
);
check(
  "H1.2 canonical timber key",
  BATHROOM_FRAMING_TIMBER_KEY === "timber.framing.90x45.h1.2.lm" &&
    getCatalogueEntry(BATHROOM_FRAMING_TIMBER_KEY)?.defaultCostRate === 6.2
);
check(
  "H1.2 legacy alias resolves the same row",
  getCatalogueEntry(BATHROOM_FRAMING_TIMBER_LEGACY_KEY)?.item_key ===
    BATHROOM_FRAMING_TIMBER_KEY
);
check(
  "no duplicate H1.2 catalogue row",
  getCatalogueEntry(BATHROOM_FRAMING_TIMBER_LEGACY_KEY)?.item_key !==
    BATHROOM_FRAMING_TIMBER_LEGACY_KEY
);
check(
  "Aqualine remains one shared sheet identity",
  BATHROOM_AQUALINE_SHEET_KEY === "sheet.plasterboard.aqualine.each" &&
    getCatalogueEntry(BATHROOM_AQUALINE_SHEET_KEY) != null
);
const materialGroupKeys = SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) =>
  group.entries.map((entry) => entry.item_key)
);
check(
  "fixture PCs are not Materials-page physical rows",
  !materialGroupKeys.includes(BATHROOM_FIXTURE_PC_KEYS.vanity) &&
    !materialGroupKeys.includes(BATHROOM_FIXTURE_PC_KEYS.toilet)
);
check(
  "H1.2 is one physical Materials-page row",
  materialGroupKeys.filter((key) => key.includes("90x45.h1.2")).length === 1
);

console.log("\n--- Fixture A full renovation ---\n");
const fixtureA = bathroom([
  ...full,
  fact("bathroom.fixtures_included", "b1", ["Vanity", "Toilet", "Mirror/cabinet"]),
  fact("bathroom.fixture.vanity.ownership", "b1", "Supply and install"),
  fact("bathroom.fixture.toilet.ownership", "b1", "Supply and install"),
  fact("bathroom.fixture.mirror.ownership", "b1", "Supply and install"),
  fact("bathroom.plumbing.level", "b1", "standard"),
  fact("bathroom.electrical.level", "b1", "none"),
]);
const vanityPc = materials(fixtureA).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity
);
const toiletPc = materials(fixtureA).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.toilet
);
const mirrorPc = materials(fixtureA).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.mirror
);
const vanityHours = labour(fixtureA).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_INSTALL_COMPONENTS.vanity
);
const mirrorHours = labour(fixtureA).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_INSTALL_COMPONENTS.mirror
);
const plumbingA = subcontracts(fixtureA).find(
  (row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT
);
check("A vanity PC $1200", near(vanityPc?.totalCost, 1200));
check("A toilet PC $650", near(toiletPc?.totalCost, 650));
check("A mirror PC $350", near(mirrorPc?.totalCost, 350));
check("A vanity 2.5 h", near(vanityHours?.adjustedHours, 2.5));
check("A mirror 0.75 h", near(mirrorHours?.adjustedHours, 0.75));
check(
  "A no builder toilet labour",
  !labour(fixtureA).some((row) => /toilet/i.test(row.description))
);
check("A plumbing $4400", near(plumbingA?.allowanceCost, 4400) && near(plumbingA?.totalCost, 4400));
check("A plumbing trade plumbing", plumbingA?.trade === "plumbing");
check("A quotedCost empty for RFQ later", plumbingA?.quotedCost == null);
check(
  "A no bundled fixture lump",
  !fixtureA.lineItems.some((item) => /fixtures allowance/i.test(item.label))
);
check(
  "A no 8h client lump",
  !fixtureA.lineItems.some((item) => /fixture installation labour/i.test(item.label))
);

const fixtureAPremium = bathroom(
  [
    ...full,
    fact("bathroom.fixtures_included", "b1", ["Vanity", "Toilet", "Mirror/cabinet"]),
    fact("bathroom.plumbing.level", "b1", "standard"),
  ],
  { qualityLevel: "premium" }
);
check(
  "premium does not scale vanity PC",
  near(
    materials(fixtureAPremium).find(
      (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity
    )?.totalCost,
    1200
  )
);
check(
  "premium does not scale vanity hours",
  near(
    labour(fixtureAPremium).find(
      (row) => row.componentKey === BATHROOM_FIXTURE_INSTALL_COMPONENTS.vanity
    )?.adjustedHours,
    2.5
  )
);

console.log("\n--- Fixture B electrical ---\n");
const fixtureB = bathroom([
  ...full,
  fact("bathroom.electrical.level", "b1", "standard"),
  fact("bathroom.electrical.light_count", "b1", 4),
  fact("bathroom.fixtures_included", "b1", ["Extract fan", "Heated towel rail"]),
  fact("bathroom.plumbing.level", "b1", "none"),
]);
const electricalB = subcontracts(fixtureB).find(
  (row) => row.componentKey === BATHROOM_ELECTRICAL_COMPONENT
);
check("B electrical $3170", near(electricalB?.allowanceCost, 3170));
check(
  "B no old extractor lump",
  !fixtureB.lineItems.some((item) => /extractor fan\/ventilation/i.test(item.label))
);
check(
  "B no old UFH lump",
  !fixtureB.lineItems.some((item) => /underfloor heating allowance/i.test(item.label))
);
const fixtureBUfh = bathroom([
  ...full,
  fact("bathroom.electrical.level", "b1", "standard"),
  fact("bathroom.underfloor_heating_included", "b1", true),
  fact("bathroom.plumbing.level", "b1", "none"),
]);
check(
  "UFH is an electrical modifier not a second lump",
  near(
    subcontracts(fixtureBUfh).find((row) => row.componentKey === BATHROOM_ELECTRICAL_COMPONENT)
      ?.allowanceCost,
    1750 + 450
  ) &&
    !fixtureBUfh.lineItems.some((item) => /underfloor heating allowance/i.test(item.label))
);

console.log("\n--- Fixture C vanity-only ---\n");
const fixtureC = bathroom([
  fact("bathroom.job_scope", "b1", "vanity_only"),
  fact("bathroom.fixture.vanity.ownership", "b1", "Supply and install"),
  fact("bathroom.plumbing.level", "b1", "minor"),
]);
check(
  "C infers vanity from job scope",
  parseBathroomSelectedFixtures({
    facts: [
      fact("bathroom.job_scope", "b1", "vanity_only"),
    ],
    workAreaId: "b1",
  }).includes("vanity")
);
check(
  "C vanity PC",
  near(
    materials(fixtureC).find(
      (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity
    )?.totalCost,
    1200
  )
);
check(
  "C vanity hours",
  near(
    labour(fixtureC).find(
      (row) => row.componentKey === BATHROOM_FIXTURE_INSTALL_COMPONENTS.vanity
    )?.adjustedHours,
    2.5
  )
);
check(
  "C plumbing minor + vanity modifier $1950",
  near(
    subcontracts(fixtureC).find((row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT)
      ?.allowanceCost,
    1950
  )
);
check(
  "C no tile / WP / linings",
  !materials(fixtureC).some(
    (row) =>
      row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT ||
      row.componentKey === BATHROOM_WATERPROOFING_COMPONENT ||
      row.componentKey === BATHROOM_WALL_LINING_COMPONENT
  )
);
check(
  "C no toilet/mirror",
  !materials(fixtureC).some(
    (row) =>
      row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.toilet ||
      row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.mirror
  )
);

console.log("\n--- Fixture D client-supplied vanity ---\n");
const fixtureD = bathroom([
  fact("bathroom.job_scope", "b1", "vanity_only"),
  fact("bathroom.fixture.vanity.ownership", "b1", "Install only"),
  fact("bathroom.plumbing.level", "b1", "none"),
]);
check(
  "D no vanity PC",
  !materials(fixtureD).some(
    (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity
  )
);
check(
  "D builder 2.5 h",
  near(
    labour(fixtureD).find(
      (row) => row.componentKey === BATHROOM_FIXTURE_INSTALL_COMPONENTS.vanity
    )?.adjustedHours,
    2.5
  )
);
check(
  "D no plumbing unless selected",
  !subcontracts(fixtureD).some((row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT)
);

console.log("\n--- Fixture E supply-only mirror ---\n");
const fixtureE = bathroom([
  fact("bathroom.job_scope", "b1", "fixture_replacement"),
  fact("bathroom.fixtures_included", "b1", ["Mirror/cabinet"]),
  fact("bathroom.fixture.mirror.ownership", "b1", "Supply only"),
  fact("bathroom.plumbing.level", "b1", "none"),
]);
check(
  "E mirror PC $350",
  near(
    materials(fixtureE).find(
      (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.mirror
    )?.totalCost,
    350
  )
);
check(
  "E no mirror labour",
  !labour(fixtureE).some(
    (row) => row.componentKey === BATHROOM_FIXTURE_INSTALL_COMPONENTS.mirror
  )
);

console.log("\n--- Area independence ---\n");
const plumbingFacts = (id: string, length: number, width: number): EstimateFact[] => [
  fact("bathroom.job_scope", id, "full_renovation"),
  fact("bathroom.length_m", id, length),
  fact("bathroom.width_m", id, width),
  fact("bathroom.wall_height_m", id, 2.4),
  fact("bathroom.fixtures_included", id, ["Toilet", "Vanity"]),
  fact("bathroom.plumbing.level", id, "standard"),
  fact("bathroom.electrical.level", id, "none"),
];
const small = bathroom(plumbingFacts("b1", 2, 2));
const large = bathroom(plumbingFacts("b1", 4, 2.5));
const smallPlumb = subcontracts(small).find((row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT);
const largePlumb = subcontracts(large).find((row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT);
check(
  "4 m² and 10 m² same plumbing allowance",
  near(smallPlumb?.allowanceCost ?? 0, largePlumb?.allowanceCost ?? -1) &&
    near(smallPlumb?.allowanceCost, 4400)
);

console.log("\n--- Shared Aqualine + company rate ---\n");
const liningFacts = [
  ...full,
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.ceiling_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "aqualine"),
  fact("bathroom.plumbing.level", "b1", "none"),
  fact("bathroom.electrical.level", "b1", "none"),
];
const lining = bathroom(liningFacts);
const wallAqualine = lining.lineItems.filter(
  (item) => item.itemKey === BATHROOM_AQUALINE_SHEET_KEY
);
check(
  "wall and ceiling consume the same Aqualine identity",
  wallAqualine.length >= 2 &&
    wallAqualine.every((item) => item.itemKey === BATHROOM_AQUALINE_SHEET_KEY)
);
const companyAqualine = bathroom(liningFacts, {
  rates: [orgRate(BATHROOM_AQUALINE_SHEET_KEY, 99)],
});
const companyAqualineLines = companyAqualine.lineItems.filter(
  (item) => item.itemKey === BATHROOM_AQUALINE_SHEET_KEY
);
check(
  "company Aqualine rate wins on every Bathroom consumer",
  companyAqualineLines.length >= 2 &&
    companyAqualineLines.every((item) => item.costRate === 99)
);

console.log("\n--- 03/04 coexistence ---\n");
const coexist = bathroom([
  ...full,
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "aqualine"),
  fact("bathroom.fixtures_included", "b1", ["Vanity"]),
  fact("bathroom.plumbing.level", "b1", "minor"),
  fact("bathroom.electrical.level", "b1", "none"),
]);
check(
  "04 tile still present with 05 fixtures",
  materials(coexist).some((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT)
);
check(
  "03 lining still present with 05 fixtures",
  materials(coexist).some((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT)
);
check(
  "05 vanity still present with 03/04",
  materials(coexist).some((row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity)
);
check(
  "legacy no-job_scope still emits fixture lump",
  calculateBathroom(
    ctx(
      [wa("b1", "bathroom", "Bathroom")],
      [fact("bathroom.area_m2", "b1", 6), fact("bathroom.includes_vanity", "b1", true)]
    ),
    wa("b1", "bathroom", "Bathroom")
  ).lineItems.some((item) => /fixtures allowance/i.test(item.label))
);

console.log("\n--- Bathroom + Deck ---\n");
const deckWa = wa("d1", "deck", "Deck");
const mixedCtx = ctx(
  [wa("b1", "bathroom", "Bathroom"), deckWa],
  [
    ...full,
    fact("bathroom.fixtures_included", "b1", ["Vanity"]),
    fact("bathroom.plumbing.level", "b1", "standard"),
    fact("deck.area_m2", "d1", 12),
    fact("deck.board_material", "d1", "Hardwood"),
  ]
);
const deckOnly = calculateDeck(
  ctx(
    [deckWa],
    [fact("deck.area_m2", "d1", 12), fact("deck.board_material", "d1", "Hardwood")]
  ),
  deckWa
);
const deckMixed = calculateDeck(mixedCtx, deckWa);
check(
  "Deck line-item snapshot unchanged beside Bathroom",
  JSON.stringify(deckOnly.lineItems.map((item) => [item.label, item.quantity, item.itemKey])) ===
    JSON.stringify(deckMixed.lineItems.map((item) => [item.label, item.quantity, item.itemKey]))
);

console.log("\n--- Questions / Review / scope text ---\n");
const clarifyFull = composeBathroomClarify(full);
const clarifyKeys = [
  ...clarifyFull.candidates.map((c) => c.factKey),
  ...clarifyFull.deferred.map((c) => c.factKey),
];
check(
  "fixtures asked on full renovation",
  clarifyKeys.includes("bathroom.fixtures_included"),
  `keys=${clarifyKeys.filter(Boolean).join(",")}`
);
check(
  "ownership not front-loaded",
  !clarifyFull.candidates.some((c) => c.factKey?.endsWith(".ownership"))
);
check(
  "scope text not front-loaded",
  !clarifyFull.candidates.some(
    (c) =>
      c.factKey === "bathroom.plumbing.scope_text" ||
      c.factKey === "bathroom.electrical.scope_text"
  )
);
const vanityClarify = composeBathroomClarify([
  fact("bathroom.job_scope", "b1", "vanity_only"),
]);
check(
  "vanity-only does not ask floor finish",
  !vanityClarify.candidates.some((c) => c.factKey === "bathroom.floor_finish_system")
);
const refine = composeRefineView({
  briefText: null,
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  facts: [
    ...full,
    fact("bathroom.fixtures_included", "b1", ["Vanity"]),
    fact("bathroom.plumbing.level", "b1", "standard"),
  ],
  constraints: [],
  jobPlan: composeJobPlan({
    workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
    facts: [
      ...full,
      fact("bathroom.fixtures_included", "b1", ["Vanity"]),
      fact("bathroom.plumbing.level", "b1", "standard"),
    ],
  }),
});
check(
  "Refine can edit plumbing scope text",
  [...refine.highValue, ...refine.advanced].some(
    (row) => row.factKey === "bathroom.plumbing.scope_text" && row.inputType === "text"
  )
);

const scoped = bathroom([
  ...full,
  fact("bathroom.fixtures_included", "b1", ["Vanity", "Toilet", "Mirror/cabinet"]),
  fact("bathroom.plumbing.level", "b1", "standard"),
  fact("bathroom.plumbing.scope_text", "b1", "Relocate WC approximately 600 mm."),
  fact("bathroom.electrical.level", "b1", "standard"),
  fact("bathroom.electrical.scope_text", "b1", "Install four downlights and extract fan."),
]);
const review = composeBuilderReview({
  estimate: {
    recommendedCost: scoped.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
    recommendedSell: scoped.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
    marginPercent: 20,
    confidence: scoped.confidence,
    assumptions: scoped.assumptions,
    missingInfo: scoped.missingInfo,
    lineItems: mapCalcLines(scoped.lineItems),
  },
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  requirements: scoped.requirements ?? [],
});
const reviewText = JSON.stringify(review);
check("Review shows Fixtures group", /"label":"Fixtures"/.test(reviewText));
check("Review shows vanity PC", /1,200|1200/.test(reviewText));
check("Review shows plumber-owned toilet install copy", /included in plumbing/i.test(reviewText) || /Plumbing/i.test(reviewText));
check("Review shows plumbing scope text", /Relocate WC approximately 600 mm/.test(reviewText));
check("Review shows electrical scope text", /Install four downlights/.test(reviewText));
check(
  "tile PC line does not also chip Quotr benchmark",
  !review.workAreas.some((area) =>
    area.categories.some((cat) =>
      [...cat.lines, ...cat.lineGroups.flatMap((group) => group.children)].some(
        (line) =>
          line.rateLabel === "PC allowance" &&
          /quotr benchmark/i.test(`${line.supporting ?? ""} ${line.specification ?? ""}`)
      )
    )
  )
);

console.log("\n--- RFQ readiness / migrations ---\n");
check(
  "SubcontractRequirement already has allowanceCost and quotedCost",
  plumbingA != null && "allowanceCost" in plumbingA && "quotedCost" in plumbingA
);
check(
  "no RFQ sending",
  !read("lib/estimate/bathroom-trades.ts").includes("sendRfq") &&
    !read("lib/estimate/bathroom-fixtures.ts").includes("Request subcontractor")
);
const migrations = numberedMigrations();
check(
  "no migration 055",
  !migrations.some((name) => name.startsWith("055_"))
);
check("fixture module exists", existsSync(join(process.cwd(), "lib/estimate/bathroom-fixtures.ts")));
check("trade module exists", existsSync(join(process.cwd(), "lib/estimate/bathroom-trades.ts")));
check(
  "05 files do not mention production supabase",
  !read("lib/estimate/bathroom-fixtures.ts").includes("kxz") &&
    !read("lib/estimate/bathroom-trades.ts").includes("kxz")
);

if (failed > 0) {
  console.log(`\nWA-BATHROOM-05 verifier: ${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`\nWA-BATHROOM-05 verifier: ${passed} passed`);
