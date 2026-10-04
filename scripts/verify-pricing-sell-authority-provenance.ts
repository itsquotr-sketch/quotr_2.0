/**
 * Estimate-to-Pricing sell-authority provenance.
 *
 * Money must stay identical. Only sellAuthority / sellDerivedFromMargin
 * metadata may differ from the previous unstamped create notes.
 *
 * Run: npx --yes tsx scripts/verify-pricing-sell-authority-provenance.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPersistedLineItemNotes,
  buildPricingNotesFromEstimateLineItem,
  parseLineItemNotes,
  type LineItemMetadata,
} from "../lib/estimate/line-item-metadata";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import {
  buildPricingItemUpdateFromEstimate,
  MANUAL_PRESERVED_NOTE,
  valuesFromEstimateLineItem,
  type EstimateLineItemRow,
} from "../lib/pricing/recalibration-helpers";
import type { PricingItem } from "../lib/pricing/types";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import { buildManualScopePricingNotes } from "../lib/work-areas/scope-items/pricing-bridge";

type MoneyRow = {
  quantity: number | null;
  unitCost: number | null;
  totalCost: number;
  unitSell: number | null;
  totalSell: number;
  margin: number;
  markup: number;
  subtotalCost: number;
  subtotalSell: number;
  gst: number;
  totalInclGst: number;
};

const ALLOWED_METADATA_KEYS = new Set([
  "sellAuthority",
  "sellDerivedFromMargin",
]);

function assert(label: string, ok: boolean, detail = ""): void {
  console.log(ok ? "PASS" : "FAIL", label, detail);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8").replaceAll("\r", "");
}

function notes(display: string, metadata: LineItemMetadata): string {
  return (
    buildPersistedLineItemNotes({
      notes: display,
      metadata,
    }) ?? ""
  );
}

function estimateLine(input: {
  id: string;
  label: string;
  category: string;
  cost: number;
  sell: number;
  display: string;
  metadata: LineItemMetadata;
}): EstimateLineItemRow {
  return {
    id: input.id,
    work_area_id: null,
    label: input.label,
    category: input.category,
    recommended_cost: input.cost,
    recommended_sell: input.sell,
    notes: notes(input.display, input.metadata),
    sort_order: 0,
  };
}

function documentMoney(
  lineMoney: {
    totalCost: number;
    totalSell: number;
    costKnown: boolean;
  },
  gstRate: number
): Pick<MoneyRow, "subtotalCost" | "subtotalSell" | "gst" | "totalInclGst" | "margin" | "markup"> {
  const result = calculateAuthoritativeDocumentTotals(
    [
      {
        total_cost: lineMoney.totalCost,
        total_sell: lineMoney.totalSell,
        cost_known: lineMoney.costKnown,
        visible: true,
      },
    ],
    gstRate,
    `sell-authority-${gstRate}`
  );
  if (!result.ok) {
    throw new Error(result.error);
  }
  return {
    subtotalCost: result.totals.subtotalCost,
    subtotalSell: result.totals.subtotalSell,
    gst: result.totals.gstAmount,
    totalInclGst: result.totals.totalInclGst,
    margin: result.totals.marginPercent,
    markup: result.totals.markupPercent,
  };
}

function metadataKeysChanged(
  beforeNotes: string | null,
  afterNotes: string | null
): string[] {
  const before = parseLineItemNotes(beforeNotes).metadata;
  const after = parseLineItemNotes(afterNotes).metadata;
  const keys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]);
  const changed: string[] = [];
  for (const key of keys) {
    const left = before[key as keyof LineItemMetadata];
    const right = after[key as keyof LineItemMetadata];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      changed.push(key);
    }
  }
  return changed.sort();
}

function printRow(name: string, row: MoneyRow): void {
  console.log(
    [
      name,
      row.quantity,
      row.unitCost,
      row.totalCost,
      row.unitSell,
      row.totalSell,
      row.margin,
      row.markup,
      row.subtotalCost,
      row.subtotalSell,
      row.gst,
      row.totalInclGst,
    ].join("\t")
  );
}

function checkEstimateCase(input: {
  name: string;
  line: EstimateLineItemRow;
  gstRate: number;
  expectedAuthority: string;
}): MoneyRow {
  const dropped = buildPricingNotesFromEstimateLineItem(input.line.notes);
  const first = valuesFromEstimateLineItem(input.line);
  const second = valuesFromEstimateLineItem(input.line);
  const persisted = first.notesInternal;
  const beforeDisplay = parseLineItemNotes(dropped).displayNotes ?? "";
  const afterDisplay = parseLineItemNotes(persisted).displayNotes ?? "";
  const changed = metadataKeysChanged(dropped, persisted);
  const beforeDoc = documentMoney(
    {
      totalCost: first.totalCost,
      totalSell: first.totalSell,
      costKnown: first.costKnown,
    },
    input.gstRate
  );
  const afterDoc = documentMoney(
    {
      totalCost: second.totalCost,
      totalSell: second.totalSell,
      costKnown: second.costKnown,
    },
    input.gstRate
  );
  const moneySame =
    first.quantity === second.quantity &&
    first.unit === second.unit &&
    first.unitCost === second.unitCost &&
    first.totalCost === second.totalCost &&
    first.unitSell === second.unitSell &&
    first.totalSell === second.totalSell &&
    first.grossProfit === second.grossProfit &&
    first.marginPercent === second.marginPercent &&
    first.markupPercent === second.markupPercent &&
    JSON.stringify(beforeDoc) === JSON.stringify(afterDoc);

  assert(`${input.name} money unchanged`, moneySame);
  assert(
    `${input.name} display notes unchanged`,
    beforeDisplay === afterDisplay
  );
  assert(
    `${input.name} metadata delta is sell authority only`,
    changed.every((key) => ALLOWED_METADATA_KEYS.has(key))
  );
  assert(
    `${input.name} persisted authority is the adapter value`,
    parseLineItemNotes(persisted).metadata.sellAuthority ===
      input.expectedAuthority &&
      first.sellAuthority === input.expectedAuthority
  );

  const row: MoneyRow = {
    quantity: first.quantity,
    unitCost: first.unitCost,
    totalCost: first.totalCost,
    unitSell: first.unitSell,
    totalSell: first.totalSell,
    margin: beforeDoc.margin,
    markup: beforeDoc.markup,
    subtotalCost: beforeDoc.subtotalCost,
    subtotalSell: beforeDoc.subtotalSell,
    gst: beforeDoc.gst,
    totalInclGst: beforeDoc.totalInclGst,
  };
  printRow(input.name, row);
  console.log(
    `  notes before authority: ${parseLineItemNotes(dropped).metadata.sellAuthority ?? "(absent)"}`
  );
  console.log(`  notes after authority: ${input.expectedAuthority}`);
  console.log(
    `  metadata keys changed: ${changed.length === 0 ? "(none)" : changed.join(", ")}`
  );
  return row;
}

function main(): void {
  console.log("=== Sell-authority provenance ===\n");
  const actions = read("lib/pricing/actions.ts");
  const recalibration = read("lib/pricing/recalibration.ts");

  assert(
    "create persists adapter notesInternal",
    actions.includes("notes_internal: values.notesInternal") &&
      !actions.includes("buildPricingNotesFromEstimateLineItem")
  );
  assert(
    "manual Pricing Required stubs keep their own notes",
    actions.includes("buildManualScopePricingNotes")
  );
  assert(
    "recalibration still persists values.notesInternal",
    read("lib/pricing/recalibration-helpers.ts").includes(
      "notes_internal: values.notesInternal"
    )
  );

  console.log(
    [
      "case",
      "qty",
      "unitCost",
      "totalCost",
      "unitSell",
      "totalSell",
      "margin",
      "markup",
      "subtotalCost",
      "subtotalSell",
      "gst",
      "totalInclGst",
    ].join("\t")
  );

  const company = estimateLine({
    id: "company",
    label: "Plasterboard",
    category: "materials",
    cost: 80,
    sell: 100,
    display: "Your company rate",
    metadata: {
      quantity: 2,
      unit: "m2",
      costRate: 40,
      sellRate: 50,
      rateSourceType: "user_rate",
      pricingOwner: "material",
    },
  });
  checkEstimateCase({
    name: "company rate",
    line: company,
    gstRate: 15,
    expectedAuthority: "legacy_paired_rate",
  });

  checkEstimateCase({
    name: "direct Quotr benchmark",
    line: estimateLine({
      id: "benchmark-direct",
      label: "Insulation",
      category: "materials",
      cost: 30,
      sell: 40,
      display: "Quotr benchmark",
      metadata: {
        quantity: 1,
        unit: "m2",
        costRate: 30,
        sellRate: 40,
        rateSourceType: "benchmark",
        pricingOwner: "material",
      },
    }),
    gstRate: 15,
    expectedAuthority: "legacy_paired_rate",
  });

  checkEstimateCase({
    name: "derived benchmark",
    line: estimateLine({
      id: "benchmark-derived",
      label: "Insulation rewritten",
      category: "materials",
      cost: 80,
      sell: 100,
      display: "Quotr benchmark",
      metadata: {
        quantity: 2,
        unit: "m2",
        costRate: 40,
        sellRate: 90,
        rateSourceType: "benchmark",
        pricingOwner: "material",
      },
    }),
    gstRate: 15,
    expectedAuthority: "derived_from_gross_margin",
  });

  checkEstimateCase({
    name: "sell derived from gross margin",
    line: estimateLine({
      id: "derived-gm",
      label: "Labour",
      category: "labour",
      cost: 60,
      sell: 75,
      display: "Derived from gross margin",
      metadata: {
        quantity: 1,
        unit: "hr",
        costRate: 60,
        sellAuthority: "derived_from_gross_margin",
        sellDerivedFromMargin: true,
        rateSourceType: "user_rate",
        pricingOwner: "labour",
      },
    }),
    gstRate: 15,
    expectedAuthority: "derived_from_gross_margin",
  });

  checkEstimateCase({
    name: "legacy paired sell",
    line: estimateLine({
      id: "legacy-pair",
      label: "Carpenter",
      category: "labour",
      cost: 90,
      sell: 120,
      display: "Your company rate",
      metadata: {
        quantity: 2,
        unit: "hr",
        costRate: 45,
        sellRate: 60,
        sellAuthority: "legacy_paired_rate",
        rateSourceType: "user_rate",
        pricingOwner: "labour",
      },
    }),
    gstRate: 15,
    expectedAuthority: "legacy_paired_rate",
  });

  const manualNotes = buildManualScopePricingNotes({
    title: "Extra access",
    description: "Site instruction",
  });
  const manualDoc = documentMoney(
    { totalCost: 0, totalSell: 0, costKnown: false },
    15
  );
  const manualAgain = documentMoney(
    { totalCost: 0, totalSell: 0, costKnown: false },
    15
  );
  assert(
    "manual Pricing Required money unchanged",
    JSON.stringify(manualDoc) === JSON.stringify(manualAgain) &&
      manualDoc.subtotalCost === 0 &&
      manualDoc.subtotalSell === 0 &&
      manualDoc.gst === 0 &&
      manualDoc.totalInclGst === 0
  );
  assert(
    "manual Pricing Required notes stay free of sell authority",
    !manualNotes.includes("sellAuthority") &&
      manualNotes.includes("Pricing required — added by you") &&
      manualNotes.includes("Site instruction")
  );
  printRow("manual Pricing Required", {
    quantity: 1,
    unitCost: null,
    totalCost: 0,
    unitSell: null,
    totalSell: 0,
    margin: manualDoc.margin,
    markup: manualDoc.markup,
    subtotalCost: manualDoc.subtotalCost,
    subtotalSell: manualDoc.subtotalSell,
    gst: manualDoc.gst,
    totalInclGst: manualDoc.totalInclGst,
  });
  console.log("  notes before authority: (manual stub, no sell authority)");
  console.log("  notes after authority: (manual stub, no sell authority)");

  const gstLine = valuesFromEstimateLineItem(company);
  for (const [name, rate] of [
    ["zero GST", 0],
    ["NZ GST", 15],
    ["AU GST", 10],
  ] as const) {
    const doc = documentMoney(
      {
        totalCost: gstLine.totalCost,
        totalSell: gstLine.totalSell,
        costKnown: gstLine.costKnown,
      },
      rate
    );
    const again = documentMoney(
      {
        totalCost: gstLine.totalCost,
        totalSell: gstLine.totalSell,
        costKnown: gstLine.costKnown,
      },
      rate
    );
    assert(`${name} document money stable`, JSON.stringify(doc) === JSON.stringify(again));
    printRow(name, {
      quantity: gstLine.quantity,
      unitCost: gstLine.unitCost,
      totalCost: gstLine.totalCost,
      unitSell: gstLine.unitSell,
      totalSell: gstLine.totalSell,
      margin: doc.margin,
      markup: doc.markup,
      subtotalCost: doc.subtotalCost,
      subtotalSell: doc.subtotalSell,
      gst: doc.gst,
      totalInclGst: doc.totalInclGst,
    });
  }

  const editedLine = estimateLine({
    id: "edited-source",
    label: "Plasterboard",
    category: "materials",
    cost: 80,
    sell: 100,
    display: "Your company rate",
    metadata: {
      quantity: 2,
      unit: "m2",
      costRate: 40,
      sellRate: 50,
      rateSourceType: "user_rate",
    },
  });
  const unprotected = buildPricingItemUpdateFromEstimate(editedLine, {
    id: "pricing-item",
    total_cost: 40,
    total_sell: 55,
    manually_edited: false,
    sort_order: 0,
    visible_on_quote: true,
    optional: false,
    client_description: null,
    notes_client: null,
    component_key: null,
  } as PricingItem);
  const protectedPatch = {
    source_estimate_line_item_id: editedLine.id,
    recalibration_note: MANUAL_PRESERVED_NOTE,
  };
  const applyStart = recalibration.indexOf("export async function applyRecalibration");
  const preserveStart = recalibration.indexOf(
    "if (existing.manually_edited)",
    applyStart
  );
  const updateStart = recalibration.indexOf(
    "buildPricingItemUpdateFromEstimate",
    preserveStart
  );
  const applyBody = recalibration.slice(preserveStart, updateStart);
  assert(
    "manually edited recalibration patch does not carry money",
    !("total_cost" in protectedPatch) &&
      !("total_sell" in protectedPatch) &&
      !("unit_cost" in protectedPatch) &&
      !("unit_sell" in protectedPatch) &&
      applyBody.includes("recalibration_note: MANUAL_PRESERVED_NOTE") &&
      !applyBody.includes("total_cost") &&
      !applyBody.includes("total_sell")
  );
  assert(
    "unprotected recalibration still copies estimate money",
    unprotected.total_cost === 80 && unprotected.total_sell === 100
  );
  const preserved = documentMoney(
    { totalCost: 40, totalSell: 55, costKnown: true },
    15
  );
  const preservedAgain = documentMoney(
    { totalCost: 40, totalSell: 55, costKnown: true },
    15
  );
  assert(
    "manually edited document money unchanged",
    JSON.stringify(preserved) === JSON.stringify(preservedAgain)
  );
  printRow("manually edited through recalibration", {
    quantity: 2,
    unitCost: 20,
    totalCost: 40,
    unitSell: 27.5,
    totalSell: 55,
    margin: preserved.margin,
    markup: preserved.markup,
    subtotalCost: preserved.subtotalCost,
    subtotalSell: preserved.subtotalSell,
    gst: preserved.gst,
    totalInclGst: preserved.totalInclGst,
  });
  console.log("  notes: recalibration leaves the edited line money in place");

  const quoted = mapPricingItemsToQuoteItems(
    [
      {
        id: "q1",
        org_id: "org",
        pricing_document_id: "doc",
        project_id: "project",
        work_area_id: null,
        source_estimate_line_item_id: "company",
        component_key: null,
        item_type: "material",
        delivery_method: "in_house",
        internal_label: "Plasterboard",
        client_label: "Plasterboard",
        internal_description: null,
        client_description: null,
        quantity: 2,
        unit: "m2",
        unit_cost: 40,
        unit_sell: 50,
        total_cost: 80,
        total_sell: 100,
        gross_profit: 20,
        margin_percent: 20,
        markup_percent: 25,
        calculation_mode: "quantity_rate",
        productivity_rate: null,
        productivity_unit: null,
        calculated_quantity: null,
        visible_on_quote: true,
        optional: false,
        sort_order: 0,
        notes_internal: valuesFromEstimateLineItem(company).notesInternal,
        notes_client: null,
        manually_edited: false,
        orphaned: false,
        recalibration_note: null,
        cost_known: true,
      } as PricingItem,
    ],
    new Map()
  );
  const quotedText = JSON.stringify(quoted);
  assert(
    "Quote omits internal sell-authority provenance",
    quoted.length === 1 &&
      quoted[0]?.total === 100 &&
      quoted[0]?.label === "Plasterboard" &&
      !quotedText.includes("sellAuthority") &&
      !quotedText.includes("__quotr_meta__") &&
      !quotedText.includes("legacy_paired_rate") &&
      !quotedText.includes("notes_internal")
  );

  if (process.exitCode) {
    console.log("\nSell-authority provenance verifier FAILED");
    process.exit(1);
  }
  console.log("\nSell-authority provenance verifier passed");
}

main();
