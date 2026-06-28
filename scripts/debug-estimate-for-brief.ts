/**
 * Forensic estimate debug — line-item audit for briefs.
 *
 * Run: npx tsx scripts/debug-estimate-for-brief.ts
 * Run: npx tsx scripts/debug-estimate-for-brief.ts --brief "your brief"
 * Run: npx tsx scripts/debug-estimate-for-brief.ts --case messy-renovation
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import {
  enrichExtractionFromBrief,
  extractConstraintsFromBrief,
} from "../lib/ai/enrich-extraction";
import { coerceExtractionPayload } from "../lib/ai/schema";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { assertNoDuplicateEstimateLineItems } from "../lib/estimate/commercial-realism";
import { parseLineItemNotes } from "../lib/estimate/line-item-metadata";
import { PRICING_OWNER_LABELS } from "../lib/estimate/pricing-ownership";
import type { EstimateLineItemInput } from "../lib/estimate/types";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "../lib/scopes/derived-facts";
import { normaliseAIExtraction } from "../lib/scopes/normalise-extracted-facts";
import { applyScopeCrossoverResolution } from "../lib/scopes/scope-crossover";
import type { ProjectFactRecord } from "../lib/scopes/fact-values";

const ALLOWED_TYPES = SCOPE_CATALOGUE.map((item) => item.type);

const BUILT_IN_CASES: Record<string, string> = {
  "messy-renovation":
    "Client wants a small renovation. Remove existing kitchen, remove 20m² vinyl flooring, build 6m of new internal wall at 2.4m high lined both sides with GIB, install 2 internal doors, repaint walls and trims, and allow for minor electrical changes. Client supplying kitchen cabinets and doors. Waste to be carted 30m to skip.",
  "kitchen-install-only":
    "Remove existing kitchen and install client-supplied flatpack cabinetry. New benchtop and tiled splashback included. Rangehood included. Plumbing and electrical by others.",
  "flooring-removal-only":
    "Remove 60m² carpet and vinyl flooring and dispose to skip. No new flooring. Access is moderate and waste must be carried 25m.",
};

type AuditRow = {
  work_area_id: string;
  work_area_type: string;
  work_area_label: string;
  line_item_id: string;
  line_item_label: string;
  pricingOwner: string;
  category: string;
  quantity: string;
  unit: string;
  cost_rate: string;
  cost_total: string;
  charge_rate: string;
  charge_total: string;
  rate_source: string;
  overlapGroup: string;
  includedInTotal: string;
  visibleOnQuote: string;
  flags: string;
  notes: string;
};

function formatMoney(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return value.toFixed(2);
}

function auditLineItem(
  item: EstimateLineItemInput,
  workAreaTypeById: Map<string, string>,
  index: number
): AuditRow {
  const metadata = parseLineItemNotes(
    item.notes ? JSON.stringify({ meta: {} }) : null
  ).metadata;

  const flags: string[] = [];
  if (!item.quantity || !item.unit) flags.push("MISSING_QTY_UNIT");
  if (item.pricingOwner === "client_supplied" && item.recommendedCost > 0) {
    flags.push("CLIENT_SUPPLIED_HAS_COST");
  }
  if (item.includedInTotal === false && item.recommendedCost > 0) {
    flags.push("EXCLUDED_HAS_COST");
  }
  if (
    item.category === "labour" &&
    !item.costComponents &&
    /allowance/i.test(item.label) &&
    !/labour/i.test(item.label)
  ) {
    flags.push("ALLOWANCE_AS_LABOUR_CATEGORY");
  }

  return {
    work_area_id: item.workAreaId,
    work_area_type: workAreaTypeById.get(item.workAreaId) ?? "?",
    work_area_label: item.workAreaName,
    line_item_id: `${item.workAreaId}-${index + 1}`,
    line_item_label: item.label,
    pricingOwner:
      PRICING_OWNER_LABELS[item.pricingOwner ?? "in_house_labour"] ??
      item.pricingOwner ??
      "",
    category: item.category,
    quantity: item.quantity != null ? String(item.quantity) : "",
    unit: item.unit ?? "",
    cost_rate: formatMoney(item.costRate),
    cost_total: formatMoney(item.recommendedCost),
    charge_rate: formatMoney(item.sellRate),
    charge_total: formatMoney(item.recommendedSell),
    rate_source: item.rateSource ?? "",
    overlapGroup: item.overlapGroup ?? metadata.overlapGroup ?? "",
    includedInTotal: String(item.includedInTotal !== false),
    visibleOnQuote: String(item.clientVisible !== false),
    flags: flags.join("; "),
    notes: item.notes?.slice(0, 80) ?? "",
  };
}

function printTable(rows: AuditRow[]) {
  const columns: (keyof AuditRow)[] = [
    "work_area_label",
    "line_item_label",
    "pricingOwner",
    "category",
    "quantity",
    "unit",
    "cost_total",
    "charge_total",
    "overlapGroup",
    "includedInTotal",
    "flags",
  ];

  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((row) => String(row[col]).length))
  );

  console.log(columns.map((col, i) => col.padEnd(widths[i]!)).join("  "));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));

  for (const row of rows) {
    console.log(
      columns
        .map((col, i) => String(row[col]).padEnd(widths[i]!))
        .join("  ")
    );
  }
}

function summariseTotals(
  label: string,
  items: EstimateLineItemInput[],
  keyFn: (item: EstimateLineItemInput) => string
) {
  const totals = new Map<string, { cost: number; sell: number; count: number }>();
  for (const item of items) {
    if (item.includedInTotal === false) continue;
    const key = keyFn(item);
    const existing = totals.get(key) ?? { cost: 0, sell: 0, count: 0 };
    existing.cost += item.recommendedCost;
    existing.sell += item.recommendedSell;
    existing.count += 1;
    totals.set(key, existing);
  }

  console.log(`\n--- ${label} ---`);
  for (const [key, value] of [...totals.entries()].sort(
    (a, b) => b[1].sell - a[1].sell
  )) {
    console.log(
      `${key.padEnd(28)} cost $${value.cost.toFixed(0).padStart(7)}  sell $${value.sell.toFixed(0).padStart(7)}  (${value.count} items)`
    );
  }
}

function runBrief(briefText: string, caseName: string) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`CASE: ${caseName}`);
  console.log(`BRIEF: ${briefText.slice(0, 120)}${briefText.length > 120 ? "…" : ""}`);
  console.log("=".repeat(72));

  const enriched = enrichExtractionFromBrief({
    briefText,
    extraction: coerceExtractionPayload({
      workAreas: [],
      facts: [],
      assumptions: [],
      possibleConstraints: [],
      confidence: 0.5,
      warnings: [],
    }),
    allowedTypes: ALLOWED_TYPES,
  });

  const normalised = normaliseAIExtraction(enriched.extraction);
  const workAreas = normalised.workAreas.map((wa, index) => ({
    id: `wa-${caseName}-${wa.type}`,
    type: wa.type,
    name: wa.type.replace(/_/g, " "),
    sort_order: index + 1,
    status: "confirmed" as const,
  }));

  const factRows: ProjectFactRecord[] = normalised.facts.map((fact) => ({
    key: fact.key,
    work_area_id:
      workAreas.find((wa) => wa.type === fact.work_area_type)?.id ?? null,
    value: fact.value,
    source: "ai_extracted" as const,
  }));

  const derived = deriveFactsForProject({
    workAreas: workAreas.map((wa) => ({ id: wa.id, type: wa.type })),
    projectFacts: factRows,
  });

  const mergedFacts = applyScopeCrossoverResolution({
    workAreas: workAreas.map((wa) => ({ id: wa.id, type: wa.type })),
    projectFacts: mergeDerivedFactsIntoRecords(factRows, derived),
  });

  const constraints = extractConstraintsFromBrief(briefText);

  console.log("\nWork areas:", workAreas.map((wa) => wa.type).join(", "));
  console.log("Constraints:", constraints.map((c) => c.key).join(", ") || "none");

  const estimate = calculateEstimate({
    project: { id: "debug", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts: mergedFacts,
    constraints: constraints.map((c) => ({
      key: c.key,
      label: c.label,
      value: c.value,
    })),
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates: [],
  } as Parameters<typeof calculateEstimate>[0]);

  const included = estimate.lineItems.filter(
    (item) => item.includedInTotal !== false
  );
  const dupes = assertNoDuplicateEstimateLineItems(estimate.lineItems);

  console.log(
    `\nEstimate total: cost $${estimate.recommendedCost.toFixed(0)}  sell $${estimate.recommendedSell.toFixed(0)}  margin ${estimate.marginPercent.toFixed(1)}%`
  );
  console.log(
    `Line items: ${estimate.lineItems.length} raw / ${included.length} included`
  );

  const workAreaTypeById = new Map(workAreas.map((wa) => [wa.id, wa.type]));
  const auditRows = estimate.lineItems.map((item, index) =>
    auditLineItem(item, workAreaTypeById, index)
  );

  console.log("\n--- Line item audit ---");
  printTable(auditRows);

  summariseTotals("By work area", included, (item) => item.workAreaName);
  summariseTotals("By pricing owner", included, (item) =>
    PRICING_OWNER_LABELS[item.pricingOwner ?? "in_house_labour"] ?? "Unknown"
  );
  summariseTotals("By category", included, (item) => item.category);
  summariseTotals("By overlap group", included, (item) =>
    item.overlapGroup ?? "(none)"
  );

  const suspicious = auditRows.filter((row) => row.flags.length > 0);
  if (suspicious.length > 0) {
    console.log("\n--- Suspicious items ---");
    for (const row of suspicious) {
      console.log(`  ${row.work_area_label} · ${row.line_item_label}: ${row.flags}`);
    }
  }

  if (dupes.duplicateLabels.length > 0) {
    console.log("\n--- Duplicate labels (included) ---");
    console.log(dupes.duplicateLabels.join(", "));
  }
  if (dupes.duplicateOverlapGroups.length > 0) {
    console.log("\n--- Duplicate overlap groups (included) ---");
    console.log(dupes.duplicateOverlapGroups.join(", "));
  }

  const kitchenCabinetryInstall = included.filter(
    (item) =>
      item.workAreaName.toLowerCase().includes("kitchen") &&
      /cabinetry/i.test(item.label) &&
      item.recommendedSell > 0
  );
  if (kitchenCabinetryInstall.length > 0) {
    console.log("\n--- Kitchen cabinetry install lines ---");
    for (const item of kitchenCabinetryInstall) {
      console.log(
        `  ${item.label}: sell $${item.recommendedSell.toFixed(0)} (${item.category}, ${item.overlapGroup ?? "no group"})`
      );
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let brief: string | null = null;
  let caseName = "custom";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--brief" && args[i + 1]) {
      brief = args[++i]!;
      caseName = "custom";
    } else if (args[i] === "--case" && args[i + 1]) {
      caseName = args[++i]!;
      brief = BUILT_IN_CASES[caseName] ?? null;
    }
  }

  return { brief, caseName };
}

const { brief, caseName } = parseArgs();

if (brief) {
  runBrief(brief, caseName);
} else {
  for (const [name, text] of Object.entries(BUILT_IN_CASES)) {
    runBrief(text, name);
  }
}
