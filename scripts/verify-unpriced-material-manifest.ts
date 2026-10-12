/**
 * Material keys with no approved workbook cost.
 * Does not delete rows or rewrite saved estimates.
 * Run: npx tsx scripts/verify-unpriced-material-manifest.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";
import { SPECIFIC_MATERIAL_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import { approvedMaterialCostExGst } from "../lib/rates/approved-material-costs";
import { classifyMaterialPresentation } from "../lib/rates/material-presentation-map";

type Disposition = "retain unpriced" | "owner review";

void calculateDeck;
const rows = SPECIFIC_MATERIAL_RATE_CATALOGUE.filter(
  (entry) => entry.rate_type === "material" || entry.category === "material"
)
  .map((entry) => {
    const approved = approvedMaterialCostExGst(entry.item_key, entry.unit);
    return { entry, approved };
  })
  .filter((row) => row.approved == null)
  .map((row) => {
    const entry = row.entry;
    const cataloguePrice =
      typeof entry.defaultCostRate === "number" && entry.defaultCostRate > 0;
    let disposition: Disposition = "retain unpriced";
    let reason =
      "No approved workbook cost. The product remains in the catalogue. Missing price is not treated as a missing product.";
    if (entry.calculatorSupport === "leftover") {
      disposition = "owner review";
      reason =
        "Legacy or leftover identity. Still referenced, so it is not removed. New selection should keep using the replacement key where one exists.";
    } else if (cataloguePrice) {
      disposition = "owner review";
      reason =
        "Catalogue has a default cost, but the approved workbook amount is blank.";
    }
    return {
      key: entry.item_key,
      product: entry.label,
      unit: entry.unit,
      workArea: entry.work_area_type ?? entry.workAreaLabel ?? "",
      workbookReason: entry.description ?? "",
      catalogueStatus: entry.calculatorSupport ?? "",
      recommended: entry.recommended !== false,
      disposition,
      reason,
    };
  });

const fibre = rows.find((row) => row.key === "sheet.fibre_cement.18mm.2400x1200.each");
if (!fibre || fibre.disposition !== "retain unpriced") {
  console.error("18 mm fibre-cement sheet must stay retain unpriced");
  process.exit(1);
}

console.log(
  ["key", "product", "unit", "workArea", "catalogue", "disposition"].join("\t")
);
for (const row of rows) {
  console.log(
    [row.key, row.product, row.unit, row.workArea, row.catalogueStatus, row.disposition].join(
      "\t"
    )
  );
}
console.log(`\n${rows.length} unpriced material rows`);
console.log(
  `retain ${rows.filter((row) => row.disposition === "retain unpriced").length}, owner review ${rows.filter((row) => row.disposition === "owner review").length}`
);

const materialEntries = SPECIFIC_MATERIAL_RATE_CATALOGUE.filter(
  (entry) => entry.rate_type === "material" || entry.category === "material"
);
const pricedDespiteWording = materialEntries.filter((entry) => {
  const approved = approvedMaterialCostExGst(entry.item_key, entry.unit);
  const wording = /pricing required|no quotr cost|quote required/i.test(
    entry.description ?? ""
  );
  return approved != null && wording;
});
console.log(
  `catalogue material rows ${materialEntries.length}; blank approved workbook cost ${rows.length}; descriptions that still say unpriced but now have an approved cost ${pricedDespiteWording.length}`
);
const decision = JSON.parse(
  readFileSync(join(process.cwd(), "docs/benchmark-review/decision-manifest.json"), "utf8")
) as {
  materials: { key: string; appliedResult: string; unit: string }[];
};
const retained = decision.materials.filter(
  (row) => row.appliedResult === "retained_unpriced"
);
const catalogueKeys = new Set(materialEntries.map((entry) => entry.item_key));
const blankKeys = new Set(rows.map((row) => row.key));
const retainedNowPriced = retained.filter(
  (row) => approvedMaterialCostExGst(row.key, row.unit) != null
);
const retainedStillBlank = retained.filter((row) => blankKeys.has(row.key));
const retainedOutsideCatalogue = retained.filter((row) => !catalogueKeys.has(row.key));
console.log(
  `decision manifest retained_unpriced ${retained.length}; still blank in the catalogue ${retainedStillBlank.length}; now approved ${retainedNowPriced.length}; not in the material catalogue ${retainedOutsideCatalogue.length}`
);
if (retainedNowPriced.length > 0) {
  console.log(
    `now approved: ${retainedNowPriced.map((row) => row.key).join(", ")}`
  );
}
if (retainedOutsideCatalogue.length > 0) {
  console.log(
    `outside catalogue: ${retainedOutsideCatalogue.map((row) => row.key).join(", ")}`
  );
}
const blankNotInRetained = rows.filter((row) => !retained.some((item) => item.key === row.key));
console.log(
  `catalogue blanks that were not in the 65: ${blankNotInRetained.map((row) => row.key).join(", ")}`
);

function presentation(key: string) {
  const entry = materialEntries.find((item) => item.item_key === key);
  if (!entry) return null;
  return { entry, presentation: classifyMaterialPresentation(entry) };
}

const bulkhead = presentation("ceilings.fixings.bulkhead_framing");
const spoil = presentation("retaining_wall.spoil.disposal.m3");
const precast = presentation("retaining_wall.sleeper.precast");
const fibrePresentation = presentation("sheet.fibre_cement.18mm.2400x1200.each");
if (
  !bulkhead ||
  bulkhead.presentation.ordinary ||
  bulkhead.entry.calculatorSupport !== "leftover"
) {
  console.error("bulkhead legacy key must stay out of ordinary selection");
  process.exit(1);
}
if (!spoil || spoil.presentation.ordinary || spoil.entry.calculatorSupport !== "leftover") {
  console.error("tip-only spoil key must stay out of ordinary selection");
  process.exit(1);
}
if (
  !precast ||
  !precast.presentation.ordinary ||
  precast.entry.defaultCostRate != null ||
  precast.entry.recommended !== true ||
  precast.entry.calculatorSupport !== "used_now"
) {
  console.error("precast sleeper stays selectable without the unapproved $36 starter");
  process.exit(1);
}
const precastRow = rows.find((row) => row.key === "retaining_wall.sleeper.precast");
if (!precastRow || precastRow.disposition !== "retain unpriced") {
  console.error("precast sleeper must stay unpriced rather than carry $36");
  process.exit(1);
}
if (
  !fibrePresentation ||
  !fibrePresentation.presentation.ordinary ||
  fibrePresentation.presentation.legacyKind != null ||
  fibrePresentation.entry.recommended !== true ||
  fibrePresentation.entry.defaultCostRate != null ||
  fibrePresentation.entry.calculatorSupport !== "used_now"
) {
  console.error("18 mm fibre cement must stay a selectable specification with no invented cost");
  process.exit(1);
}

function readEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    out[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return out;
}

async function joinPreviewReferences() {
  const local = readEnv(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const service = local.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF || ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const keys = rows.map((row) => row.key);
  const rates = await admin
    .from("rates")
    .select("item_key, active, source, cost_rate, rate_type")
    .in("item_key", keys);
  if (rates.error) throw new Error(rates.error.message);

  const estimateHits = new Map<string, number>();
  const pricingHits = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const page = await admin
      .from("estimate_line_items")
      .select("component_key, notes")
      .range(from, from + 999);
    if (page.error) throw new Error(page.error.message);
    const data = page.data ?? [];
    for (const line of data) {
      const blob = `${line.component_key ?? ""}\n${line.notes ?? ""}`;
      for (const key of keys) {
        if (blob.includes(key)) {
          estimateHits.set(key, (estimateHits.get(key) ?? 0) + 1);
        }
      }
    }
    if (data.length < 1000) break;
  }
  for (let from = 0; ; from += 1000) {
    const page = await admin
      .from("pricing_items")
      .select("component_key, notes_internal, client_label, internal_label")
      .range(from, from + 999);
    if (page.error) throw new Error(page.error.message);
    const data = page.data ?? [];
    for (const line of data) {
      const blob = `${line.component_key ?? ""}\n${line.notes_internal ?? ""}\n${line.client_label ?? ""}\n${line.internal_label ?? ""}`;
      for (const key of keys) {
        if (blob.includes(key)) {
          pricingHits.set(key, (pricingHits.get(key) ?? 0) + 1);
        }
      }
    }
    if (data.length < 1000) break;
  }

  const overrides = new Map<
    string,
    { active: number; inactive: number; activeCosts: number[] }
  >();
  for (const rate of rates.data ?? []) {
    if (rate.cost_rate == null || rate.rate_type !== "material") continue;
    const current = overrides.get(rate.item_key) ?? {
      active: 0,
      inactive: 0,
      activeCosts: [],
    };
    if (rate.active) {
      current.active += 1;
      current.activeCosts.push(Number(rate.cost_rate));
    } else current.inactive += 1;
    overrides.set(rate.item_key, current);
  }

  console.log("\nkey\tactiveCompanyRates\tinactiveCompanyRates\testimateLines\tpricingItems");
  for (const row of rows) {
    const rate = overrides.get(row.key) ?? {
      active: 0,
      inactive: 0,
      activeCosts: [],
    };
    if (rate.active > 0) {
      console.log(`company override ${row.key} active costs ${rate.activeCosts.join(",")}`);
    }
    console.log(
      [
        row.key,
        rate.active,
        rate.inactive,
        estimateHits.get(row.key) ?? 0,
        pricingHits.get(row.key) ?? 0,
      ].join("\t")
    );
  }
}

joinPreviewReferences().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "preview join failed");
  process.exit(1);
});
