/**
 * RATES-MATERIALS-UI-01 — Searchable collapsible material families.
 *
 * Run: npx --yes tsx scripts/verify-rates-materials-ui-01.ts
 */
import { existsSync, readFileSync } from "node:fs";
import type { OrganisationRate } from "../components/setup/types";
import { resolveRate } from "../lib/estimate/rates";
import { roleAllowsPermission } from "../lib/team/permissions";
import {
  buildMaterialRegistry,
  editableMaterialCatalogueKeys,
  filterMaterialCategories,
  listMaterialsPageCatalogueEntries,
  materialSearchMatches,
  materialStatusMatches,
} from "../lib/rates/material-registry";
import type { RatesPageRate } from "../lib/rates/types";

function derivedDimensionedPlasterboardCost(itemKey: string) {
  // Lazy load after catalogue graph has finished initializing.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../lib/estimate/ceilings-plasterboard-derived-cost") as {
    derivedDimensionedPlasterboardCost: (
      key: string | null | undefined
    ) => { derivedCost: number; baseKey: string } | null;
  };
  return mod.derivedDimensionedPlasterboardCost(itemKey);
}

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

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function rate(
  partial: Partial<RatesPageRate> & Pick<RatesPageRate, "item_key">
): RatesPageRate {
  return {
    id: partial.id ?? `rate-${partial.item_key}`,
    item_key: partial.item_key,
    rate_type: partial.rate_type ?? "material",
    label: partial.label ?? partial.item_key,
    unit: partial.unit ?? "each",
    cost_rate: partial.cost_rate ?? null,
    sell_rate: partial.sell_rate ?? null,
    markup_percent: partial.markup_percent ?? null,
    active: partial.active ?? true,
    trade: partial.trade ?? null,
    work_area_type: partial.work_area_type ?? null,
    source: partial.source ?? null,
    source_calibration_id: partial.source_calibration_id ?? null,
    updated_at: partial.updated_at ?? null,
  };
}

console.log("=== RATES-MATERIALS-UI-01 ===\n");

const registrySrc = read("lib/rates/material-registry.ts");
const mapSrc = read("lib/rates/material-presentation-map.ts");
const uiSrc = read("components/rates/MaterialsByProductFamily.tsx");
const ratesNonDefault = read("components/rates/RatesNonDefaultSections.tsx");
const ratesPage = read("components/rates/RatesPageContent.tsx");
const productivityUi = read("components/rates/ProductivityByWorkArea.tsx");
const productivityRegistry = read("lib/rates/productivity-registry.ts");

check(
  "canonical materials registry module present",
  existsSync("lib/rates/material-registry.ts") &&
    registrySrc.includes("buildMaterialRegistry")
);
check(
  "reviewed presentation mapping present",
  existsSync("lib/rates/material-presentation-map.ts") &&
    mapSrc.includes("classifyMaterialPresentation") &&
    mapSrc.includes("gib-braceline") &&
    mapSrc.includes("gib-standard")
);
check(
  "Rates materials uses MaterialsByProductFamily",
  ratesNonDefault.includes("MaterialsByProductFamily") &&
    ratesNonDefault.includes('view === "materials"')
);
check(
  "search and filters present",
  uiSrc.includes("Search materials") &&
    uiSrc.includes("Filter by category") &&
    uiSrc.includes("Filter by work area") &&
    uiSrc.includes("Customised") &&
    uiSrc.includes("Expand all") &&
    uiSrc.includes("Collapse all")
);
check(
  "accordion semantics",
  uiSrc.includes("aria-expanded") &&
    uiSrc.includes('role="region"') &&
    uiSrc.includes("data-materials-category") &&
    uiSrc.includes("data-materials-family")
);
check(
  "legacy / advanced collapsed section",
  uiSrc.includes("Legacy / Advanced") && uiSrc.includes("data-materials-legacy")
);
check(
  "mobile compact list without HTML table",
  uiSrc.includes("data-rates-compact-list") &&
    !uiSrc.includes("<table") &&
    uiSrc.includes("min-h-11")
);
check(
  "derived benchmark copy",
  registrySrc.includes("Derived Quotr benchmark") &&
    registrySrc.includes(
      "Derived from the approved same-family sheet rate by area."
    ) &&
    uiSrc.includes("derivedHint")
);

console.log("\n--- Catalogue completeness ---\n");

const catalogueEntries = listMaterialsPageCatalogueEntries();
const catalogueKeys = catalogueEntries.map((entry) => entry.item_key).sort();
const { items, categories } = buildMaterialRegistry({ rates: [], editable: true });
const ordinaryItems = items.filter((item) => item.ordinary);
const registryCanonical = items
  .filter((item) => !item.alias)
  .map((item) => item.canonicalKey)
  .sort();

check(
  "registry includes every materials-page catalogue key",
  catalogueKeys.length === registryCanonical.length &&
    catalogueKeys.every((key, index) => key === registryCanonical[index]),
  `catalogue=${catalogueKeys.length} registry=${registryCanonical.length}`
);

const keyCounts = new Map<string, number>();
for (const item of items) {
  keyCounts.set(item.canonicalKey, (keyCounts.get(item.canonicalKey) ?? 0) + 1);
}
check(
  "every key appears exactly once in registry",
  [...keyCounts.values()].every((count) => count === 1)
);

const ordinaryRenderKeys: string[] = [];
for (const category of categories) {
  for (const family of category.families) {
    for (const item of family.ordinaryItems) {
      ordinaryRenderKeys.push(item.canonicalKey);
    }
  }
}
const ordinaryDupes = ordinaryRenderKeys.filter(
  (key, index) => ordinaryRenderKeys.indexOf(key) !== index
);
check(
  "no duplication across ordinary family sections",
  ordinaryDupes.length === 0,
  ordinaryDupes.join(", ")
);
check(
  "every catalogue identity accessible exactly once (ordinary or legacy)",
  catalogueKeys.every((key) => {
    const matches = items.filter(
      (item) => item.canonicalKey === key && !item.alias
    );
    return matches.length === 1;
  })
);
check(
  "ordinary rows never include aliases",
  ordinaryItems.every((item) => !item.alias)
);

console.log("\n--- Grouping inventory ---\n");
for (const category of categories) {
  console.log(
    `  ${category.categoryName}: ${category.familyCount} families, ${category.variantCount} ordinary variants`
  );
}

console.log("\n--- Plasterboard grouping ---\n");
const pb = categories.find((row) => row.categoryId === "plasterboard");
const familyNames = pb?.families.map((family) => family.familyName) ?? [];
check(
  "Standard / Aqualine / Braceline / Fyreline are separate families",
  familyNames.includes("GIB Standard") &&
    familyNames.includes("GIB Aqualine") &&
    familyNames.includes("GIB Braceline") &&
    familyNames.includes("GIB Fyreline")
);
const braceline = pb?.families.find((family) => family.familyId === "gib-braceline");
check(
  "Braceline has thickness and sheet-size variants",
  (braceline?.ordinaryItems.length ?? 0) >= 2 &&
    braceline!.ordinaryItems.every(
      (item) => item.thickness != null && item.sheetSize != null
    )
);
const derivedSample = items.find(
  (item) =>
    item.canonicalKey ===
    "sheet.plasterboard.standard.10mm.2700x1200.each"
);
const derivedCost = derivedDimensionedPlasterboardCost(
  "sheet.plasterboard.standard.10mm.2700x1200.each"
);
check(
  "derived plasterboard labelled as derived",
  derivedSample?.benchmarkKind === "derived" &&
    derivedSample.effectiveSource === "derived_benchmark" &&
    derivedCost != null &&
    derivedSample.quotrBenchmarkCost === derivedCost.derivedCost
);
const direct10 = items.find(
  (item) =>
    item.canonicalKey ===
    "sheet.plasterboard.standard.10mm.2400x1200.each"
);
check(
  "approved 10mm 2400 Standard is direct benchmark",
  direct10?.benchmarkKind === "direct" &&
    direct10.quotrBenchmarkCost === 18
);

console.log("\n--- Shared materials ---\n");
const aqualineShared = items.filter(
  (item) => item.canonicalKey.includes("aqualine") && item.ordinary
);
check(
  "Aqualine ordinary rows are not duplicated",
  aqualineShared.every(
    (item) =>
      aqualineShared.filter((row) => row.canonicalKey === item.canonicalKey)
        .length === 1
  )
);
const framing90 = items.find(
  (item) => item.canonicalKey === "timber.framing.90x45.h1.2.lm"
);
check(
  "shared framing has Used-in work areas",
  (framing90?.workAreaTypes.length ?? 0) >= 2 &&
    framing90!.workAreaTypes.includes("bathroom") &&
    framing90!.workAreaTypes.includes("internal_walls")
);

console.log("\n--- Missing rates ---\n");
const pricingRequired = items.filter(
  (item) => item.ordinary && item.effectiveSource === "pricing_required"
);
check(
  "pricing required variants remain visible",
  pricingRequired.length > 0 &&
    pricingRequired.every((item) =>
      categories.some((category) =>
        category.families.some((family) =>
          family.ordinaryItems.some(
            (row) => row.canonicalKey === item.canonicalKey
          )
        )
      )
    )
);

console.log("\n--- Aliases / legacy ---\n");
const aliasKeys = [
  "bathroom.framing.90x45.h1.2.lm",
  "sheet.fibre_cement.tile_underlay.6mm.each",
  "ceilings.painting.m2",
];
for (const aliasKey of aliasKeys) {
  const aliasItem = items.find((item) => item.canonicalKey === aliasKey);
  check(
    `alias ${aliasKey} is not ordinary`,
    aliasItem != null && !aliasItem.ordinary && aliasItem.legacyKind === "alias"
  );
}
const legacyPb = items.find(
  (item) => item.canonicalKey === "sheet.plasterboard.standard.each"
);
check(
  "legacy generic plasterboard is not ordinary competing row",
  legacyPb != null && !legacyPb.ordinary
);
const leftoverTile = items.find((item) => item.canonicalKey === "ceiling.tile.m2");
check(
  "legacy ceiling.tile.m2 is legacy/leftover",
  leftoverTile != null && !leftoverTile.ordinary
);

console.log("\n--- Override preservation ---\n");
const seededRates: RatesPageRate[] = [
  rate({
    item_key: "sheet.plasterboard.braceline.each",
    cost_rate: 41.25,
    unit: "each",
  }),
  rate({
    item_key: "timber.framing.90x45.h1.2.lm",
    cost_rate: 7.1,
    unit: "lm",
  }),
  rate({
    item_key: "deck.material.kwila.lm",
    cost_rate: 9.4,
    unit: "lm",
  }),
  rate({
    item_key: "painting.material.m2",
    cost_rate: 6.5,
    unit: "m2",
  }),
  rate({
    item_key: "fence.board.radiata_pine.150x19",
    cost_rate: 3.2,
    unit: "lm",
  }),
];
const seeded = buildMaterialRegistry({ rates: seededRates, editable: true });
for (const seededRate of seededRates) {
  const uiItem = seeded.items.find(
    (item) => item.canonicalKey === seededRate.item_key
  );
  const resolved = resolveRate({
    rates: seededRates as OrganisationRate[],
    rateType: "material",
    itemKey: seededRate.item_key,
    unit: seededRate.unit,
    fallbackCostRate: 999,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    } as never,
  });
  check(
    `override preserved: ${seededRate.item_key}`,
    uiItem?.companyOverride === seededRate.cost_rate &&
      uiItem.effectiveSource === "company" &&
      uiItem.effectiveRate === seededRate.cost_rate &&
      resolved.costRate === seededRate.cost_rate &&
      resolved.sourceType === "user_rate"
  );
}

console.log("\n--- Search / filters ---\n");
const bracelineHit = filterMaterialCategories({
  categories,
  query: "Braceline",
  status: "all",
  categoryId: "all",
  workArea: "all",
});
check(
  "search family name reveals Braceline",
  bracelineHit.some((category) =>
    category.families.some((family) => family.familyId === "gib-braceline")
  )
);
const sizeHit = filterMaterialCategories({
  categories,
  query: "2700",
  status: "all",
  categoryId: "all",
  workArea: "all",
});
check(
  "search sheet size reveals variants",
  sizeHit.some((category) =>
    category.families.some((family) =>
      family.ordinaryItems.some((item) => item.sheetSize?.includes("2700"))
    )
  )
);
const thicknessHit = filterMaterialCategories({
  categories,
  query: "13 mm",
  status: "all",
  categoryId: "plasterboard",
  workArea: "all",
});
check(
  "search thickness within plasterboard",
  thicknessHit.length === 1 &&
    thicknessHit[0]!.families.every((family) =>
      [...family.ordinaryItems, ...family.legacyItems].every(
        (item) =>
          item.thickness?.includes("13") ||
          materialSearchMatches(item, "13 mm")
      )
    )
);
const bathroomHit = filterMaterialCategories({
  categories,
  query: "",
  status: "all",
  categoryId: "all",
  workArea: "bathroom",
});
check(
  "work-area filter finds shared framing without duplicate forms",
  bathroomHit.some((category) =>
    category.families.some((family) =>
      family.ordinaryItems.some(
        (item) => item.canonicalKey === "timber.framing.90x45.h1.2.lm"
      )
    )
  ) &&
    bathroomHit
      .flatMap((category) => category.families)
      .flatMap((family) => family.ordinaryItems)
      .filter((item) => item.canonicalKey === "timber.framing.90x45.h1.2.lm")
      .length === 1
);
const customisedOnly = filterMaterialCategories({
  categories: seeded.categories,
  query: "",
  status: "customised",
  categoryId: "all",
  workArea: "all",
});
check(
  "status filter customised",
  customisedOnly.every((category) =>
    category.families.every((family) =>
      family.ordinaryItems.every((item) => item.effectiveSource === "company")
    )
  ) && customisedOnly.some((category) => category.variantCount > 0)
);
const empty = filterMaterialCategories({
  categories,
  query: "zzzz-no-match-materials",
  status: "all",
  categoryId: "all",
  workArea: "all",
});
check("empty-state filter yields no categories", empty.length === 0);

const sample = items[0];
check(
  "search helper matches technical key",
  sample
    ? materialSearchMatches(sample, sample.canonicalKey) &&
        !materialSearchMatches(sample, "zzzz-no-match")
    : false
);
check(
  "status helper pricing_required",
  materialStatusMatches(
    {
      ...items.find((item) => item.effectiveSource === "direct_benchmark")!,
      effectiveSource: "pricing_required",
      quotrBenchmarkCost: null,
      effectiveRate: null,
      benchmarkKind: "none",
    },
    "pricing_required"
  )
);

console.log("\n--- Interaction markers ---\n");
check(
  "default collapsed categories (open only when searching/state)",
  uiSrc.includes("searching || Boolean(openCategories") &&
    uiSrc.includes("setAllExpanded")
);
check(
  "post-edit reopens exact family",
  uiSrc.includes("editingItem.familyId") &&
    uiSrc.includes("setOpenFamilies") &&
    uiSrc.includes("setOpenCategories")
);

console.log("\n--- Permissions ---\n");
check(
  "owner/admin manage rates",
  roleAllowsPermission("owner", "company.rates.manage") &&
    roleAllowsPermission("admin", "company.rates.manage")
);
check(
  "estimator/viewer cannot manage rates",
  !roleAllowsPermission("estimator", "company.rates.manage") &&
    !roleAllowsPermission("viewer", "company.rates.manage")
);
check(
  "UI respects readOnly / canManageRates",
  ratesNonDefault.includes("readOnly={!state.canManageRates}") &&
    ratesPage.includes("readOnly={!state.canManageRates}")
);

console.log("\n--- Estimator non-regression snapshots ---\n");
const estimatorCases = [
  {
    name: "Ceiling plasterboard derived",
    key: "sheet.plasterboard.standard.10mm.2700x1200.each",
    unit: "each",
  },
  {
    name: "Internal Walls framing",
    key: "timber.framing.90x45.h1.2.lm",
    unit: "lm",
  },
  {
    name: "Bathroom Aqualine legacy",
    key: "sheet.plasterboard.aqualine.each",
    unit: "each",
  },
  {
    name: "Painting materials",
    key: "painting.material.m2",
    unit: "m2",
  },
  {
    name: "Deck kwila",
    key: "deck.material.kwila.lm",
    unit: "lm",
  },
  {
    name: "Fence radiata paling",
    key: "fence.board.radiata_pine.150x19",
    unit: "lm",
  },
  {
    name: "Retaining face board",
    key: "retaining_wall.timber.face_board.150x50.h4",
    unit: "lm",
  },
];

for (const testCase of estimatorCases) {
  const company = seededRates.find((row) => row.item_key === testCase.key);
  const ratesForCase = company ? [company] : [];
  const uiItem = buildMaterialRegistry({
    rates: ratesForCase,
    editable: true,
  }).items.find((item) => item.canonicalKey === testCase.key);
  const catalogue = catalogueEntries.find(
    (entry) => entry.item_key === testCase.key
  );
  const fallback =
    catalogue?.defaultCostRate ??
    derivedDimensionedPlasterboardCost(testCase.key)?.derivedCost ??
    0;
  const resolved = resolveRate({
    rates: ratesForCase as OrganisationRate[],
    rateType: catalogue?.rate_type ?? "material",
    itemKey: testCase.key,
    unit: testCase.unit,
    fallbackCostRate: fallback,
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    } as never,
  });
  check(
    `${testCase.name}: UI effective aligns with resolveRate`,
    uiItem != null &&
      uiItem.effectiveRate === resolved.costRate &&
      (company
        ? uiItem.effectiveSource === "company" &&
          resolved.sourceType === "user_rate"
        : true),
    `ui=${uiItem?.effectiveRate} resolved=${resolved.costRate}`
  );
}

console.log("\n--- Productivity non-regression ---\n");
check(
  "productivity registry unchanged module markers",
  productivityRegistry.includes("buildProductivityRegistry") &&
    productivityUi.includes("data-productivity-by-work-area") &&
    ratesNonDefault.includes("ProductivityByWorkArea")
);

check(
  "editable key list equals non-alias registry keys",
  editableMaterialCatalogueKeys().sort().join("|") === catalogueKeys.join("|")
);

console.log("\n--- Responsive / layout markers ---\n");
check(
  "stacked mobile rows (no forced table)",
  uiSrc.includes("sm:grid") && uiSrc.includes("Your rate")
);
check(
  "touch targets >= 44px class",
  uiSrc.includes("min-h-11") && uiSrc.includes("h-11")
);
check("overflow hidden on variant lists", uiSrc.includes("overflow-hidden"));

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
