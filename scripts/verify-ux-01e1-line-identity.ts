/**
 * UX-01E.1 — Estimate line identity presentation.
 *
 * Run: npx tsx scripts/verify-ux-01e1-line-identity.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BuilderReviewCategoryGroup,
  BuilderReviewPricedLine,
  BuilderReviewView,
} from "../lib/assistant/builder-review";
import {
  CARPENTER_LABOUR_RATE_KEY,
  LABOURER_LABOUR_RATE_KEY,
} from "../lib/estimate/labour-trade-mapping";
import {
  projectAssumptionsReview,
  projectLabourTakeoff,
  projectMaterialsTakeoff,
} from "../lib/assistant/presentation/estimate-takeoffs";

const root = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8").replace(/\r/g, "");
}

let failed = 0;

function check(label: string, ok: boolean): void {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) failed += 1;
}

function line(partial: {
  id: string;
  label: string;
  category: BuilderReviewPricedLine["category"];
  recommendedCost?: number;
  recommendedSell?: number;
  quantity?: number | null;
  unit?: string | null;
  labourHours?: number | null;
  costRate?: number | null;
  rateLabel?: string;
  productivityLabel?: string | null;
  identitySummary?: string | null;
  itemKey?: string | null;
  productivityRate?: number | null;
  productivityUnit?: string | null;
  sourceCategory?: string;
}): BuilderReviewPricedLine {
  return {
    id: partial.id,
    label: partial.label,
    category: partial.category,
    recommendedCost: partial.recommendedCost ?? 0,
    recommendedSell: partial.recommendedSell ?? 0,
    quantity: partial.quantity ?? null,
    unit: partial.unit ?? null,
    labourHours: partial.labourHours ?? null,
    costRate: partial.costRate ?? null,
    rateLabel: partial.rateLabel ?? "Company rate",
    labourRateLabel: null,
    productivityLabel: partial.productivityLabel ?? null,
    itemKey: partial.itemKey ?? null,
    componentKey: null,
    isAllowance: false,
    specification: partial.identitySummary ?? null,
    supporting: partial.identitySummary ?? null,
    detail: null,
    pricingHelper: null,
    rateContext: null,
    quantityFallback: null,
    sourceLine: {
      category: partial.sourceCategory ?? "materials",
      label: partial.label,
      identitySummary: partial.identitySummary ?? undefined,
      itemKey: partial.itemKey ?? undefined,
      productivityRate: partial.productivityRate ?? undefined,
      productivityUnit: partial.productivityUnit ?? undefined,
    } as never,
  };
}

function category(
  id: BuilderReviewCategoryGroup["id"],
  label: string,
  lines: BuilderReviewPricedLine[]
): BuilderReviewCategoryGroup {
  return {
    id,
    label,
    cost: 0,
    lines,
    takeoff: [],
    takeoffDisclaimer: null,
    takeoffUnavailableHint: null,
    takeoffCollapsedByDefault: true,
    takeoffTitle: "Planning takeoff",
    groupNotes: [],
    lineGroups: [],
  };
}

function view(partial: {
  areas: BuilderReviewView["workAreas"];
  assumptions?: BuilderReviewView["assumptions"];
  checks?: BuilderReviewView["checks"];
}): BuilderReviewView {
  return {
    overview: {
      recommendedSell: 1000,
      recommendedCost: 800,
      marginPercent: 20,
      confidenceBand: null,
      confidenceExplanation: null,
      marginSourceLabel: null,
      workAreaCount: partial.areas.length,
      workAreaNames: partial.areas.map((area) => area.workAreaName),
      categorySummary: [],
      isStale: false,
    },
    workAreas: partial.areas,
    assumptions: partial.assumptions ?? [],
    checks: partial.checks ?? [],
    improvements: [],
    costReconciles: true,
    projectedCost: 800,
    estimateCost: 800,
    takeoffAffectsMoney: false,
    requirements: [],
  };
}

const decking = line({
  id: "boards",
  label: "Decking",
  category: "MATERIALS",
  recommendedCost: 400,
  quantity: 18,
  unit: "lm",
  costRate: 28,
  rateLabel: "Company rate",
  identitySummary: "Kwila decking · 140 mm",
  itemKey: "deck.surface",
});
const framing = line({
  id: "framing",
  label: "Framing/substructure",
  category: "MATERIALS",
  recommendedCost: 200,
  quantity: 20,
  unit: "m²",
  costRate: 10,
  rateLabel: "Quotr benchmark",
});
const materials = projectMaterialsTakeoff(
  view({
    areas: [
      {
        workAreaId: "deck",
        workAreaName: "Deck",
        workAreaType: "deck",
        cost: 600,
        sell: 800,
        categories: [category("MATERIALS", "Materials", [decking, framing])],
      },
    ],
  })
);
const deckingRow = materials.groups[0]?.rows.find((row) => row.id === "boards");
const framingRow = materials.groups[0]?.rows.find((row) => row.id === "framing");

check(
  "1 specific material identity is shown when stored",
  deckingRow?.product === "Kwila decking" &&
    deckingRow.materialUse === "Decking" &&
    deckingRow.specification === "140 mm" &&
    deckingRow.genericCaption == null &&
    deckingRow.description === "Decking"
);

check(
  "2 generic material identity stays generic",
  framingRow?.product == null &&
    framingRow?.description === "Framing/substructure" &&
    framingRow.genericCaption === "Material category" &&
    !JSON.stringify(framingRow).includes("Kwila") &&
    !JSON.stringify(framingRow).includes("140")
);

check(
  "3 material use and product identity stay separate",
  deckingRow?.product !== deckingRow?.materialUse &&
    deckingRow?.product === "Kwila decking" &&
    deckingRow?.materialUse === "Decking"
);

const install = line({
  id: "install",
  label: "Decking installation",
  category: "LABOUR",
  recommendedCost: 400,
  recommendedSell: 500,
  quantity: 10,
  unit: "lm",
  labourHours: 6,
  costRate: 50,
  rateLabel: "Company rate",
  productivityLabel: "Quotr benchmark",
  identitySummary: "18 lm × 0.16 h/lm",
  itemKey: CARPENTER_LABOUR_RATE_KEY,
  productivityRate: 0.16,
  productivityUnit: "lm",
  sourceCategory: "labour",
});
const guessed = line({
  id: "guess",
  label: "Labourer strip-out",
  category: "LABOUR",
  recommendedCost: 80,
  quantity: 2,
  unit: "m²",
  labourHours: 2,
  costRate: 40,
  rateLabel: "Company rate",
  sourceCategory: "labour",
});
const labourer = line({
  id: "labourer",
  label: "Finish removal",
  category: "LABOUR",
  recommendedCost: 80,
  quantity: 2,
  unit: "m²",
  labourHours: 2,
  costRate: 40,
  rateLabel: "Quotr benchmark",
  productivityLabel: "Your calibrated productivity",
  itemKey: LABOURER_LABOUR_RATE_KEY,
  sourceCategory: "labour",
});
const labour = projectLabourTakeoff(
  view({
    areas: [
      {
        workAreaId: "deck",
        workAreaName: "Deck",
        workAreaType: "deck",
        cost: 560,
        sell: 700,
        categories: [category("LABOUR", "Labour", [install, guessed, labourer])],
      },
    ],
  })
);
const installRow = labour.groups[0]?.rows.find((row) => row.id === "install");
const guessedRow = labour.groups[0]?.rows.find((row) => row.id === "guess");
const labourerRow = labour.groups[0]?.rows.find((row) => row.id === "labourer");

check(
  "4 worker type comes from the stored labour key",
  labourerRow?.workerType === "Labourer" &&
    labourerRow.activity === "Finish removal" &&
    labourerRow.pricedUsing == null
);

check(
  "5 worker type is not guessed from activity wording",
  guessedRow?.workerType == null &&
    guessedRow?.pricedUsing == null &&
    guessedRow?.activity === "Labourer strip-out" &&
    installRow?.workerType == null &&
    installRow?.activity === "Decking installation"
);

check(
  "6 carpenter fallback is a pricing note",
  installRow?.pricedUsing === "Priced using Carpenter labour cost" &&
    installRow.workerType !== "Carpenter"
);

check(
  "7 productivity source and hourly-rate source stay distinct",
  installRow?.productivityBasis === "18 lm × 0.16 h/lm" &&
    installRow.productivitySource === "Quotr benchmark" &&
    installRow.hourlyRateSource === "Company rate" &&
    installRow.productivitySource !== installRow.hourlyRateSource
);

check(
  "8 stored labour hours and costs are not recalculated",
  installRow?.hours === "6.00 hrs" &&
    installRow.total === "$400" &&
    installRow.hourlyCost === "$50" &&
    installRow.hourlyCost !== "$67" &&
    installRow.total !== "$500"
);

const required = line({
  id: "posts",
  label: "Piles / posts",
  category: "PRICING_REQUIRED",
  recommendedCost: 0,
  quantity: 8,
  unit: "ea",
  costRate: 0,
  rateLabel: "Rate required",
  sourceCategory: "materials",
});
const requiredModel = projectMaterialsTakeoff(
  view({
    areas: [
      {
        workAreaId: "deck",
        workAreaName: "Deck",
        workAreaType: "deck",
        cost: 0,
        sell: 0,
        categories: [category("PRICING_REQUIRED", "Pricing Required", [required])],
      },
    ],
  })
);
check(
  "9 Pricing Required never becomes $0",
  requiredModel.groups[0]?.rows[0]?.source === "Pricing Required" &&
    requiredModel.groups[0]?.rows[0]?.total == null &&
    !JSON.stringify(requiredModel).includes("$0")
);

const sharedLine = line({
  id: "bolts",
  label: "Fixings",
  category: "MATERIALS",
  recommendedCost: 80,
  identitySummary: "Galvanised bolts",
});
const nested = projectMaterialsTakeoff(
  view({
    areas: [
      {
        workAreaId: "house",
        workAreaName: "House",
        workAreaType: "house",
        cost: 80,
        sell: 100,
        categories: [category("MATERIALS", "Materials", [])],
        sharedLineGroups: [
          {
            id: "shared",
            label: "Shared fixings",
            recommendedCost: 80,
            supporting: null,
            secondary: null,
            itemKey: null,
            showChangeMaterial: false,
            rateContext: null,
            children: [sharedLine],
          },
        ],
        portionGroups: [
          {
            id: "ceiling",
            label: "Bedroom ceiling",
            summary: null,
            areaLabel: null,
            assumptions: [],
            lineGroups: [
              {
                id: "again",
                label: "Bedroom ceiling",
                recommendedCost: 0,
                supporting: null,
                secondary: null,
                itemKey: null,
                showChangeMaterial: false,
                rateContext: null,
                children: [
                  sharedLine,
                  line({
                    id: "sheets",
                    label: "Wall lining — Bedroom",
                    category: "MATERIALS",
                    identitySummary: "13 mm · 3000 × 1200",
                  }),
                ],
              },
            ],
          },
        ],
      },
    ],
  })
);
const nestedRows = nested.groups.flatMap((group) => group.rows);
check(
  "10 shared and nested lines keep their ownership",
  nestedRows.filter((row) => row.id === "bolts").length === 1 &&
    nestedRows.find((row) => row.id === "bolts")?.shared === true &&
    nestedRows.find((row) => row.id === "bolts")?.portion === "Shared fixings" &&
    nestedRows.some(
      (row) => row.id === "sheets" && row.product === "Wall lining" && row.portion === "Bedroom ceiling"
    )
);

const notices = projectAssumptionsReview(
  view({
    areas: [
      {
        workAreaId: "deck",
        workAreaName: "Deck",
        workAreaType: "deck",
        cost: 1,
        sell: 1,
        categories: [
          category("MATERIALS", "Materials", [
            line({
              id: "a",
              label: "Joists",
              category: "MATERIALS",
              rateLabel: "Quotr benchmark",
              identitySummary: "90x45 SG8 H3.2",
            }),
            line({
              id: "b",
              label: "Joists",
              category: "MATERIALS",
              rateLabel: "Quotr benchmark",
              identitySummary: "90x45 SG8 H3.2",
            }),
            line({
              id: "c",
              label: "Bearers",
              category: "MATERIALS",
              rateLabel: "Derived Quotr benchmark",
            }),
          ]),
        ],
      },
    ],
  })
);
const deckNotices = notices.groups.find((group) => group.name === "Deck")?.benchmarks ?? [];
check(
  "11 identical rate notices group without merging different products",
  deckNotices.some((row) => row.label === "Joists" && row.detail === "Quotr benchmark" && row.count === 2) &&
    deckNotices.some((row) => row.label === "Bearers" && row.detail === "Derived Quotr benchmark" && row.count === 1) &&
    deckNotices.length === 2
);

const takeoff = read("components/assistant/mode/EstimateTakeoffViews.tsx");
const projector = read("lib/assistant/presentation/estimate-takeoffs.ts");
const shell = read("components/assistant/AssistantShell.tsx");
const breakdown = read("components/assistant/mode/WorkAreaBreakdown.tsx");

check(
  "12 mobile presentation does not require a wide page table",
  !takeoff.includes("<table") &&
    takeoff.includes("overflow-x-hidden") &&
    takeoff.includes("lg:grid") &&
    takeoff.includes("lg:sr-only") &&
    takeoff.includes("Worker type not specified") &&
    takeoff.includes("min-h-11") &&
    breakdown.includes("View breakdown") &&
    breakdown.includes("aria-expanded={open}") &&
    breakdown.includes("grid-cols-2")
);

check(
  "13 no new query or server action",
  !/fetch\(|router\.refresh|revalidatePath|supabase|\.from\(|useEffect|resolveLabourRate\(/.test(
    takeoff + projector
  ) && !shell.includes("projectMaterialsTakeoff")
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nUX-01E.1 line identity passed");
