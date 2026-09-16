/**
 * RATES-PRODUCTIVITY-UI-01 — Canonical work-area productivity interface.
 *
 * Run: npx --yes tsx scripts/verify-rates-productivity-ui-01.ts
 */
import { existsSync, readFileSync } from "node:fs";
import type { OrganisationRate } from "../components/setup/types";
import {
  CEILINGS_PRODUCTIVITY_KEYS,
  PAINTING_LABOUR_HOURS_PER_M2,
  PAINTING_LABOUR_HOURS_PER_M2_KEY,
} from "../lib/estimate/ceilings-identities";
import {
  INTERNAL_WALLS_INSULATION_INSTALL_HOURS_PER_M2_KEY,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS,
  INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
} from "../lib/estimate/internal-walls-identities";
import { resolveProductivity } from "../lib/estimate/productivity";
import { roleAllowsPermission } from "../lib/team/permissions";
import {
  buildProductivityRegistry,
  editableProductivityCatalogueKeys,
  filterProductivityGroups,
  listRegisteredProductivityCatalogueEntries,
  productivitySearchMatches,
  productivityStatusMatches,
} from "../lib/rates/productivity-registry";
import type { RatesPageRate } from "../lib/rates/types";

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

function rate(partial: Partial<RatesPageRate> & Pick<RatesPageRate, "item_key">): RatesPageRate {
  return {
    id: partial.id ?? `rate-${partial.item_key}`,
    item_key: partial.item_key,
    rate_type: partial.rate_type ?? "productivity",
    label: partial.label ?? partial.item_key,
    unit: partial.unit ?? "m2",
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

console.log("=== RATES-PRODUCTIVITY-UI-01 ===\n");

const registrySrc = read("lib/rates/productivity-registry.ts");
const uiSrc = read("components/rates/ProductivityByWorkArea.tsx");
const ratesNonDefault = read("components/rates/RatesNonDefaultSections.tsx");
const ratesPage = read("components/rates/RatesPageContent.tsx");

check(
  "canonical registry module present",
  existsSync("lib/rates/productivity-registry.ts") &&
    registrySrc.includes("buildProductivityRegistry")
);
check(
  "Rates core uses ProductivityByWorkArea",
  ratesNonDefault.includes("ProductivityByWorkArea") &&
    ratesNonDefault.includes("canCalibrate={state.canCalibrate}") &&
    !ratesNonDefault.includes("All productivity keys") &&
    !ratesNonDefault.includes("DECK_PRODUCTIVITY_RATE_CATALOGUE")
);
check(
  "Labour COST section retained",
  ratesNonDefault.includes('title="Labour"') &&
    ratesNonDefault.includes("LABOUR_RATE_CATALOGUE")
);
check(
  "productivity helper copy",
  uiSrc.includes("Hours required per unit. Lower values mean less labour time.")
);
check(
  "search and status filters present",
  uiSrc.includes("Search labour productivity") &&
    uiSrc.includes("Customised") &&
    uiSrc.includes("Expand all") &&
    uiSrc.includes("Collapse all")
);
check(
  "accordion semantics",
  uiSrc.includes("aria-expanded") &&
    uiSrc.includes('role="region"') &&
    uiSrc.includes("data-productivity-work-area")
);
check(
  "legacy rates collapsed section",
  uiSrc.includes("Legacy rates") &&
    uiSrc.includes("data-productivity-legacy")
);
check(
  "calibration only for supported work areas",
  uiSrc.includes("calibrationSupported") &&
    registrySrc.includes("isProductivityCalibrationSupported")
);
check(
  "mobile compact list without HTML table",
  uiSrc.includes("data-rates-compact-list") &&
    !uiSrc.includes("<table") &&
    uiSrc.includes("min-h-11")
);

console.log("\n--- Canonical registry completeness ---\n");

const catalogueEntries = listRegisteredProductivityCatalogueEntries();
const catalogueKeys = catalogueEntries.map((entry) => entry.item_key).sort();
const { items, groups } = buildProductivityRegistry({ rates: [], editable: true });
const registryKeys = items.map((item) => item.productivityKey).sort();

check(
  "registry keys equal catalogue productivity keys",
  catalogueKeys.length === registryKeys.length &&
    catalogueKeys.every((key, index) => key === registryKeys[index]),
  `catalogue=${catalogueKeys.length} registry=${registryKeys.length}`
);

const keyCounts = new Map<string, number>();
for (const item of items) {
  keyCounts.set(item.productivityKey, (keyCounts.get(item.productivityKey) ?? 0) + 1);
}
check(
  "every key appears exactly once in registry",
  [...keyCounts.values()].every((count) => count === 1)
);

const ordinaryRenderKeys: string[] = [];
for (const group of groups) {
  for (const item of group.ordinaryItems) {
    ordinaryRenderKeys.push(item.productivityKey);
  }
}
const ordinaryDupes = ordinaryRenderKeys.filter(
  (key, index) => ordinaryRenderKeys.indexOf(key) !== index
);
check(
  "no duplication across ordinary work-area sections",
  ordinaryDupes.length === 0,
  ordinaryDupes.join(", ")
);

console.log("\n--- Work-area coverage ---\n");

const requiredAreas = [
  "deck",
  "retaining_wall",
  "bathroom",
  "fence",
  "ceilings",
  "internal_walls",
  "painting",
] as const;
for (const area of requiredAreas) {
  const group = groups.find((row) => row.workAreaType === area);
  check(`work area present: ${area}`, Boolean(group), group?.workAreaLabel ?? "missing");
}

for (const group of groups) {
  console.log(
    `  ${group.workAreaLabel}: ${group.items.length} keys (${group.ordinaryItems.length} ordinary, ${group.legacyItems.length} legacy)`
  );
}

console.log("\n--- Ceiling / IW / Painting coverage ---\n");

const ceilingKeys = Object.values(CEILINGS_PRODUCTIVITY_KEYS);
const ceilingGroup = groups.find((row) => row.workAreaType === "ceilings");
check("Ceilings has 15 catalogue keys", ceilingKeys.length === 15);
check(
  "all Ceiling keys visible in registry",
  ceilingKeys.every((key) =>
    ceilingGroup?.items.some((item) => item.productivityKey === key)
  ),
  `visible=${ceilingGroup?.items.length ?? 0}`
);
check(
  "Ceiling keys are ordinary (not legacy clutter)",
  ceilingGroup?.ordinaryItems.length === 15 &&
    (ceilingGroup?.legacyItems.length ?? 0) === 0
);
check(
  "Ceilings calibration not required",
  ceilingGroup?.calibrationSupported === false
);

const iwKeys = [
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.standard_gib,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.aqualine,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.fyreline,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.braceline,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.noiseline,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.weatherline,
  INTERNAL_WALLS_LINING_PRODUCTIVITY_KEYS.barrierline,
  INTERNAL_WALLS_INSULATION_INSTALL_HOURS_PER_M2_KEY,
  INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
];
const iwGroup = groups.find((row) => row.workAreaType === "internal_walls");
check("Internal Walls has 9 catalogue keys", iwKeys.length === 9);
check(
  "all Internal Walls keys visible",
  iwKeys.every((key) =>
    iwGroup?.items.some((item) => item.productivityKey === key)
  ),
  `visible=${iwGroup?.items.length ?? 0}`
);
check(
  "Internal Walls calibration not required",
  iwGroup?.calibrationSupported === false
);

const paintingGroup = groups.find((row) => row.workAreaType === "painting");
const paintingItem = paintingGroup?.items.find(
  (item) => item.productivityKey === PAINTING_LABOUR_HOURS_PER_M2_KEY
);
check(
  "painting.labour_hours_per_m2 visible",
  Boolean(paintingItem)
);
check(
  "painting Quotr benchmark 0.12 h/m²",
  paintingItem?.benchmarkHours === PAINTING_LABOUR_HOURS_PER_M2 &&
    PAINTING_LABOUR_HOURS_PER_M2 === 0.12
);
check(
  "Painting calibration not required",
  paintingGroup?.calibrationSupported === false
);

console.log("\n--- Overrides / effective source ---\n");

const seededRates: RatesPageRate[] = [
  rate({
    item_key: "deck.decking.install.hours_per_lm",
    work_area_type: "deck",
    cost_rate: 0.09,
    unit: "lm",
    source: "explicit_company",
  }),
  rate({
    item_key: CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet,
    work_area_type: "ceilings",
    cost_rate: 0.62,
    unit: "sheet",
    source: "explicit_company",
  }),
  rate({
    item_key: INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
    work_area_type: "internal_walls",
    cost_rate: 0.14,
    unit: "lm",
    source: "explicit_company",
  }),
  rate({
    item_key: PAINTING_LABOUR_HOURS_PER_M2_KEY,
    work_area_type: "painting",
    cost_rate: 0.15,
    unit: "m2",
    source: "explicit_company",
  }),
  rate({
    item_key: "bathroom.lining.wall.install.hours_per_m2",
    work_area_type: "bathroom",
    cost_rate: 0.33,
    unit: "m2",
    source: "calibrated_productivity",
  }),
];

const seeded = buildProductivityRegistry({ rates: seededRates, editable: true });
const deckOverride = seeded.items.find(
  (item) => item.productivityKey === "deck.decking.install.hours_per_lm"
);
const ceilingOverride = seeded.items.find(
  (item) => item.productivityKey === CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet
);
const paintingOverride = seeded.items.find(
  (item) => item.productivityKey === PAINTING_LABOUR_HOURS_PER_M2_KEY
);
const bathroomOverride = seeded.items.find(
  (item) => item.productivityKey === "bathroom.lining.wall.install.hours_per_m2"
);

check(
  "deck override grouped under Deck",
  deckOverride?.workAreaType === "deck" &&
    deckOverride.companyOverrideHours === 0.09 &&
    deckOverride.effectiveSource === "company" &&
    deckOverride.effectiveValue === 0.09
);
check(
  "ceiling override grouped under Ceilings",
  ceilingOverride?.workAreaType === "ceilings" &&
    ceilingOverride.companyOverrideHours === 0.62 &&
    ceilingOverride.effectiveSource === "company"
);
check(
  "painting override supported",
  paintingOverride?.companyOverrideHours === 0.15 &&
    paintingOverride.effectiveSource === "company" &&
    paintingOverride.benchmarkHours === 0.12
);
check(
  "bathroom calibrated source preserved",
  bathroomOverride?.effectiveSource === "calibrated" &&
    bathroomOverride.companyOverrideHours === 0.33
);
check(
  "override values unchanged vs seed",
  seededRates.every((seed) => {
    const item = seeded.items.find((row) => row.productivityKey === seed.item_key);
    return item?.companyOverrideHours === Number(seed.cost_rate);
  })
);

console.log("\n--- Legacy handling ---\n");

const deckGroup = groups.find((row) => row.workAreaType === "deck");
check(
  "Deck has legacy leftovers collapsed separately",
  (deckGroup?.legacyItems.length ?? 0) > 0 &&
    deckGroup!.legacyItems.every((item) => item.legacy)
);
check(
  "legacy keys remain in registry (not deleted)",
  deckGroup!.legacyItems.every((item) =>
    catalogueKeys.includes(item.productivityKey)
  )
);
check(
  "ordinary Deck list excludes leftover keys",
  deckGroup!.ordinaryItems.every((item) => !item.legacy)
);

console.log("\n--- Filters / search ---\n");

const searchCeilings = filterProductivityGroups({
  groups,
  query: "Ceilings",
  status: "all",
});
check(
  "search matches work-area name",
  searchCeilings.some((group) => group.workAreaType === "ceilings")
);

const searchTask = filterProductivityGroups({
  groups,
  query: "Painting application",
  status: "all",
});
check(
  "search matches task label",
  searchTask.some((group) =>
    group.items.some((item) => item.productivityKey === PAINTING_LABOUR_HOURS_PER_M2_KEY)
  )
);

const searchKey = filterProductivityGroups({
  groups,
  query: PAINTING_LABOUR_HOURS_PER_M2_KEY,
  status: "all",
});
check(
  "search matches productivity key",
  searchKey.some((group) =>
    group.items.some((item) => item.productivityKey === PAINTING_LABOUR_HOURS_PER_M2_KEY)
  )
);

const customisedOnly = filterProductivityGroups({
  groups: seeded.groups,
  query: "",
  status: "customised",
});
check(
  "status filter Customised",
  customisedOnly.every((group) =>
    group.ordinaryItems.every(
      (item) =>
        item.effectiveSource === "company" ||
        item.effectiveSource === "calibrated"
    )
  ) && customisedOnly.some((group) => group.ordinaryItems.length > 0)
);

const empty = filterProductivityGroups({
  groups,
  query: "zzzz-no-match-productivity",
  status: "all",
});
check("empty-state filter yields no groups", empty.length === 0);

const sample = items[0];
check(
  "search helper matches unit",
  sample
    ? productivitySearchMatches(sample, sample.unit) &&
        !productivitySearchMatches(sample, "zzzz-no-match")
    : false
);
check(
  "status helper pricing_required",
  productivityStatusMatches(
    {
      ...items.find((item) => item.effectiveSource === "benchmark")!,
      effectiveSource: "pricing_required",
      benchmarkHours: null,
      effectiveValue: null,
    },
    "pricing_required"
  )
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
check(
  "calibration permission still wired",
  ratesNonDefault.includes("canCalibrate={state.canCalibrate}")
);

console.log("\n--- Estimator non-regression (resolveProductivity) ---\n");

function orgRates(
  hoursByKey: Record<string, number>,
  unitByKey: Record<string, string>
): OrganisationRate[] {
  return Object.entries(hoursByKey).map(([item_key, cost_rate]) =>
    rate({
      item_key,
      cost_rate,
      unit: unitByKey[item_key] ?? "m2",
      source: "explicit_company",
    })
  );
}

const beforeAfterCases: {
  name: string;
  key: string;
  companyHours: number;
  unit: string;
}[] = [
  {
    name: "Ceiling plasterboard",
    key: CEILINGS_PRODUCTIVITY_KEYS.plasterboardSheet,
    companyHours: 0.62,
    unit: "sheet",
  },
  {
    name: "Internal Walls skirting",
    key: INTERNAL_WALLS_SKIRTING_INSTALL_HOURS_PER_LM_KEY,
    companyHours: 0.14,
    unit: "lm",
  },
  {
    name: "Painting",
    key: PAINTING_LABOUR_HOURS_PER_M2_KEY,
    companyHours: 0.15,
    unit: "m2",
  },
  {
    name: "Deck decking",
    key: "deck.decking.install.hours_per_lm",
    companyHours: 0.09,
    unit: "lm",
  },
];

for (const testCase of beforeAfterCases) {
  const rates = orgRates(
    { [testCase.key]: testCase.companyHours },
    { [testCase.key]: testCase.unit }
  );
  const resolved = resolveProductivity({
    productivityKey: testCase.key,
    unit: testCase.unit,
    rates,
    fallbackHoursPerUnit: 9.99,
  });
  const uiItem = seeded.items.find(
    (item) => item.productivityKey === testCase.key
  );
  check(
    `${testCase.name}: UI effective equals resolveProductivity`,
    resolved.hoursPerUnit === testCase.companyHours &&
      uiItem?.effectiveValue === testCase.companyHours &&
      uiItem.companyOverrideHours === resolved.hoursPerUnit,
    `resolved=${resolved.hoursPerUnit} ui=${uiItem?.effectiveValue}`
  );
}

const paintingBenchmark = resolveProductivity({
  productivityKey: PAINTING_LABOUR_HOURS_PER_M2_KEY,
  unit: "m2",
  rates: [],
  fallbackHoursPerUnit: 9.99,
});
check(
  "Painting without override uses 0.12 benchmark",
  paintingBenchmark.hoursPerUnit === 0.12
);

check(
  "editable key list equals registry",
  editableProductivityCatalogueKeys().sort().join("|") ===
    registryKeys.join("|")
);

console.log("\n--- Responsive / layout markers ---\n");
check(
  "stacked mobile rows (no forced table)",
  uiSrc.includes("sm:grid") && uiSrc.includes("Your productivity")
);
check(
  "touch targets >= 44px class",
  uiSrc.includes("min-h-11") && uiSrc.includes("h-11")
);
check(
  "overflow hidden on operation lists",
  uiSrc.includes("overflow-hidden")
);

console.log(
  `\n=== Result: ${passed} passed, ${failed} failed ===`
);
if (failed > 0) {
  process.exit(1);
}
