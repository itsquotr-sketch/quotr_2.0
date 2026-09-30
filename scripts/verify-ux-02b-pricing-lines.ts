/**
 * UX-02B — Pricing line density, identity, editors and mobile interaction.
 *
 * Run: npx tsx scripts/verify-ux-02b-pricing-lines.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serializeLineItemMetadata } from "../lib/estimate/line-item-metadata";
import { presentPricingLine } from "../lib/pricing/line-presentation";
import type { PricingItem } from "../lib/pricing/types";

const root = join(__dirname, "..");
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}`);
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

function item(overrides: Partial<PricingItem>): PricingItem {
  return {
    id: "item",
    org_id: "org",
    pricing_document_id: "doc",
    project_id: "project",
    work_area_id: null,
    source_estimate_line_item_id: "estimate-line",
    component_key: null,
    item_type: "material",
    delivery_method: "in_house",
    internal_label: "Internal",
    client_label: "Wall lining",
    internal_description: null,
    client_description: null,
    quantity: 12,
    unit: "m2",
    unit_cost: 10,
    unit_sell: 16,
    total_cost: 120,
    total_sell: 192,
    gross_profit: 72,
    margin_percent: 37.5,
    markup_percent: 60,
    visible_on_quote: true,
    optional: false,
    sort_order: 0,
    notes_internal: null,
    notes_client: null,
    created_at: "",
    updated_at: "",
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    calculation_mode: "quantity_rate",
    productivity_rate: null,
    productivity_unit: null,
    calculated_quantity: null,
    cost_known: true,
    ...overrides,
  };
}

const row = read("components/pricing/PricingItemRow.tsx");
const section = read("components/pricing/PricingWorkAreaSection.tsx");
const form = read("components/pricing/PricingItemEditForm.tsx");
const presentation = read("lib/pricing/line-presentation.ts");
const page = read("app/(protected)/app/projects/[projectId]/pricing/[pricingId]/page.tsx");
const actions = read("lib/pricing/actions.ts");

const material = presentPricingLine(
  item({
    client_label: "Wall lining",
    internal_label: "Gib lining",
    notes_internal: serializeLineItemMetadata({
      identitySummary: "13mm Gib Standard · 1200mm",
      rateSourceType: "user_rate",
    }),
  })
);
check(
  "stored material identity stays separate from its use",
  material.title === "13mm Gib Standard" &&
    material.supporting === "Wall lining" &&
    material.specification === "1200mm" &&
    material.source === "Your company rate"
);

const allowance = presentPricingLine(
  item({
    item_type: "allowance",
    client_label: "Material allowance",
    internal_label: "Material allowance",
    notes_internal: null,
  })
);
check(
  "generic allowances stay generic",
  allowance.title === "Material allowance" &&
    allowance.supporting === "Estimated material allowance"
);

const labour = presentPricingLine(
  item({
    item_type: "labour",
    calculation_mode: "productivity_labour",
    client_label: "Fix wall lining",
    internal_label: "Fix wall lining",
    quantity: 12,
    unit: "m2",
    unit_cost: 65,
    calculated_quantity: 4,
    notes_internal: serializeLineItemMetadata({
      itemKey: "labour.carpenter.hour",
      labourHours: 4,
      productivitySourceType: "calibrated_productivity",
      rateSourceType: "user_rate",
    }),
  })
);
check(
  "carpenter rate is a pricing basis, not an inferred worker",
  labour.title === "Fix wall lining" &&
    labour.workerType == null &&
    labour.pricingBasis === "Priced using Carpenter labour cost" &&
    labour.hoursLabel === "4 h" &&
    labour.productivitySource === "Your calibrated productivity"
);

const labourer = presentPricingLine(
  item({
    item_type: "labour",
    client_label: "Site tidy",
    notes_internal: serializeLineItemMetadata({
      itemKey: "labour.labourer.hour",
    }),
  })
);
check("stored labourer rate key shows the worker type", labourer.workerType === "Labourer");

const required = presentPricingLine(
  item({
    cost_known: false,
    total_cost: 0,
    total_sell: 0,
    unit_cost: 0,
    unit_sell: 0,
  })
);
check(
  "Pricing Required is not shown as $0",
  required.pricingRequired &&
    required.sellLabel === "Pricing required" &&
    !required.sellLabel.includes("$0") &&
    required.costLabel === "—"
);

const manual = presentPricingLine(
  item({
    source_estimate_line_item_id: null,
    client_label: "Extra callout",
    internal_label: "Extra callout",
  })
);
check("manual lines are labelled Manual", manual.manual && manual.source === "Manual");

check(
  "desktop row is a compact grid with one Actions control",
  row.includes("PRICING_TABLE_GRID") &&
    row.includes("Actions") &&
    row.includes("DropdownMenu") &&
    !row.includes("<table")
);
check(
  "mobile lines start collapsed and expand one at a time",
  section.includes('useState<string | null>(null)') &&
    section.includes('"(min-width: 1024px)"') &&
    row.includes('layout === "card"') &&
    row.includes("aria-expanded")
);
check(
  "editors keep the existing fields, button types and no nested form",
  form.includes("Client label") &&
    form.includes("Internal label") &&
    form.includes("Total cost") &&
    form.includes("Total charge") &&
    form.includes("Visible on quote") &&
    form.includes('type="button"') &&
    !form.includes("<form") &&
    row.includes('role="alert"') &&
    row.includes("Dialog") &&
    row.includes("Sheet") &&
    row.includes("AlertDialog")
);
check(
  "reviewed and converted pricing explain the existing quote boundary",
  row.includes("Saving returns this reviewed pricing to draft") &&
    row.includes("Editing this pricing does not change that quote")
);
check(
  "manual deletion confirms and leaves estimate lines to the current action",
  row.includes("Estimate lines are left unchanged") &&
    actions.includes("Only manually added lines can be bulk-deleted")
);
check(
  "no new pricing query or calculation",
  !presentation.includes("supabase") &&
    !presentation.includes("* 1.15") &&
    !row.includes("recalculateSellFromCost") &&
    page.includes("getPricingWorkspaceDataWithContext") &&
    !page.includes("presentPricingLine")
);
check(
  "lines do not introduce a horizontal scroller",
  !row.includes("overflow-x-auto") &&
    !section.includes("overflow-x-auto") &&
    section.includes("overflow-hidden")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
