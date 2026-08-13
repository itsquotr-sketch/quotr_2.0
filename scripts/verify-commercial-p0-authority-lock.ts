/**
 * COMMERCIAL-P0 — Cost-first commercial authority lock verification.
 *
 * Proves F-SFM single uplift, legacy paired compatibility, project margin
 * override replace semantics, CM-02 recalibration wiring, snapshot kinds.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  applyProjectGrossMarginToCost,
  classifyResolvedSell,
  commercialSnapshotKindForPricingDocument,
  commercialSnapshotKindForQuote,
  deriveSellFromGrossMargin,
  MAX_GROSS_MARGIN_PERCENT,
} from "../lib/commercial-engine/core/cost-first-authority";
import { applyMarginToAmounts } from "../lib/estimate/margin-override";
import {
  resolveLabourRate,
  resolveRate,
  getDefaultMarginPercent,
} from "../lib/estimate/rates";
import { recalculateSellFromCost } from "../lib/estimate/margin-override";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const settings: OrganisationSettings = {
  id: "org-settings",
  org_id: "org",
  default_margin_percent: 20,
  default_contingency_percent: 10,
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

// --- 1. cost → GM → sell ---
{
  const sell = deriveSellFromGrossMargin(60, 20);
  check("1 cost 60 + GM 20% → sell 75", sell === 75);
  check(
    "1b classify cost-only derives 75",
    classifyResolvedSell({
      costRate: 60,
      sellRate: null,
      applicableGrossMarginPercent: 20,
    }).sellRate === 75 &&
      classifyResolvedSell({
        costRate: 60,
        sellRate: null,
        applicableGrossMarginPercent: 20,
      }).sellAuthority === "derived_from_gross_margin"
  );
}

// --- 2. no double margin ---
{
  const legacy = classifyResolvedSell({
    costRate: 60,
    sellRate: 90,
    applicableGrossMarginPercent: 20,
  });
  const overridden = applyProjectGrossMarginToCost(60, 20);
  check("2 legacy sell stays 90 without project margin", legacy.sellRate === 90);
  check(
    "2b project GM replaces → 75 (not 90*1.2 / not 112.5)",
    overridden === 75 && overridden !== 108 && overridden !== 112.5
  );
  const amounts = applyMarginToAmounts(60, 20, settings);
  check(
    "2c applyMarginToAmounts cost 60 GM 20 → sell 75",
    amounts.recommendedSell === 75 && amounts.recommendedCost === 60
  );
  // Engine does not treat legacy sell as cost
  check(
    "2d cost path is 60 not 90 before F-SFM",
    amounts.recommendedCost === 60 && legacy.isLegacyPairedRate
  );
}

// --- 3. legacy paired compatibility ---
{
  const rates: OrganisationRate[] = [
    {
      id: "r1",
      rate_type: "labour",
      trade: null,
      work_area_type: null,
      item_key: "labour.carpenter.hour",
      label: "Carpenter",
      unit: "hour",
      cost_rate: 60,
      sell_rate: 90,
      markup_percent: null,
      active: true,
    },
  ];
  const labour = resolveLabourRate({ rates, organisationSettings: settings });
  check(
    "3 labour paired legacy preserves sell 90",
    labour.costRate === 60 &&
      labour.sellRate === 90 &&
      labour.sellAuthority === "legacy_paired_rate" &&
      labour.isLegacyPairedRate
  );

  const material = resolveRate({
    rates: [
      {
        ...rates[0],
        rate_type: "material",
        item_key: "deck.material.treated_pine.m2",
        unit: "m2",
        cost_rate: 80,
        sell_rate: 100,
      },
    ],
    rateType: "material",
    itemKey: "deck.material.treated_pine.m2",
    unit: "m2",
    fallbackCostRate: 70,
    fallbackSellRate: 95,
    organisationSettings: settings,
  });
  check(
    "3b material company paired legacy",
    material.costRate === 80 &&
      material.sellRate === 100 &&
      material.sellAuthority === "legacy_paired_rate"
  );

  const subbie = resolveRate({
    rates: [
      {
        ...rates[0],
        rate_type: "subcontractor",
        item_key: "bathroom.plumbing.allowance",
        unit: "allowance",
        cost_rate: 2000,
        sell_rate: 2500,
      },
    ],
    rateType: "subcontractor",
    itemKey: "bathroom.plumbing.allowance",
    unit: "allowance",
    fallbackCostRate: 1800,
    fallbackSellRate: 2200,
    organisationSettings: settings,
  });
  check(
    "3c subcontractor paired legacy",
    subbie.costRate === 2000 &&
      subbie.sellRate === 2500 &&
      subbie.isLegacyPairedRate
  );
}

// --- 4. project margin override ---
{
  const triad = recalculateSellFromCost(60, 20);
  check("4 project override triad sell 75", triad.recommendedSell === 75);
  check(
    "4b not stacked on 90",
    triad.recommendedSell !== 108 && triad.recommendedSell !== 112.5
  );
  const lineAmounts = applyMarginToAmounts(9526, 20, settings);
  check(
    "4c estimate-style cost rewrite uses F-SFM only",
    lineAmounts.recommendedSell === recalculateSellFromCost(9526, 20).recommendedSell
  );
}

// --- 5. zero margin ---
{
  const sell = deriveSellFromGrossMargin(60, 0);
  check("5 GM 0% → sell 60", sell === 60);
}

// --- 6. max margin ---
{
  const sell = deriveSellFromGrossMargin(60, MAX_GROSS_MARGIN_PERCENT);
  const expected = recalculateSellFromCost(60, MAX_GROSS_MARGIN_PERCENT).recommendedSell;
  check(
    `6 GM ${MAX_GROSS_MARGIN_PERCENT}% safe calculation`,
    sell === expected && Number.isFinite(sell) && sell > 60
  );
}

// --- 7. estimate totals / aggregation semantics ---
{
  const a = applyMarginToAmounts(1000, 20, settings);
  const b = applyMarginToAmounts(500, 20, settings);
  const totalSell = Math.round((a.recommendedSell + b.recommendedSell) * 100) / 100;
  check(
    "7 aggregated sells from cost lines",
    a.recommendedSell === 1250 && b.recommendedSell === 625 && totalSell === 1875
  );
}

// --- 8. CM-02 downstream recalibration ---
{
  const marginActions = read("lib/assistant/margin-actions.ts");
  check(
    "8 updateEstimateMargin calls markPricingDocumentsNeedingRecalibration",
    marginActions.includes("markPricingDocumentsNeedingRecalibration") &&
      marginActions.includes("CM-02")
  );
  const recal = read("lib/pricing/recalibration.ts");
  check(
    "8b markPricing sets needs_recalibration + estimate_changed",
    recal.includes("needs_recalibration: true") &&
      recal.includes('recalibration_status: "estimate_changed"') &&
      recal.includes('.neq("status", "archived")')
  );
  check(
    "8c does not silently mutate quotes in margin-actions",
    !marginActions.includes("from(\"quotes\")") &&
      !marginActions.includes("from('quotes')")
  );
}

// --- 9. historical quote safety ---
{
  check(
    "9 draft quote recalibratable",
    commercialSnapshotKindForQuote({ status: "draft" }) ===
      "recalibratable_snapshot"
  );
  check(
    "9b sent quote historical immutable",
    commercialSnapshotKindForQuote({ status: "sent" }) ===
      "historical_immutable_snapshot"
  );
  check(
    "9c accepted quote historical immutable",
    commercialSnapshotKindForQuote({ status: "accepted" }) ===
      "historical_immutable_snapshot"
  );
  check(
    "9d pricing non-archived recalibratable",
    commercialSnapshotKindForPricingDocument({
      needsRecalibration: true,
      status: "draft",
    }) === "recalibratable_snapshot"
  );
  check(
    "9e archived pricing historical",
    commercialSnapshotKindForPricingDocument({
      needsRecalibration: false,
      status: "archived",
    }) === "historical_immutable_snapshot"
  );
}

// --- 10. rate provenance / authority ---
{
  const costOnlyLabour = resolveLabourRate({
    rates: [
      {
        id: "r2",
        rate_type: "labour",
        trade: null,
        work_area_type: null,
        item_key: "labour.carpenter.hour",
        label: "Carpenter",
        unit: "hour",
        cost_rate: 60,
        sell_rate: null,
        markup_percent: null,
        active: true,
      },
    ],
    organisationSettings: settings,
  });
  check(
    "10 cost-only labour derives sell 75 @ org GM 20",
    costOnlyLabour.sellRate === 75 &&
      costOnlyLabour.sellAuthority === "derived_from_gross_margin" &&
      costOnlyLabour.grossMarginPercent === 20
  );

  const explicit = classifyResolvedSell({
    costRate: 60,
    sellRate: 99,
    applicableGrossMarginPercent: 20,
    explicitSellOverride: true,
  });
  check(
    "10b explicit sell override provenance",
    explicit.sellAuthority === "explicit_sell_override" &&
      explicit.sellRate === 99 &&
      explicit.isExplicitSellOverride
  );

  const defaultLabour = resolveLabourRate({
    rates: [],
    organisationSettings: settings,
  });
  check(
    "10c default labour 60/90 labelled legacy paired",
    defaultLabour.costRate === 60 &&
      defaultLabour.sellRate === 90 &&
      defaultLabour.isLegacyPairedRate
  );

  check(
    "10d org default margin helper is 20",
    getDefaultMarginPercent(settings) === 20
  );
}

// --- Docs / decisions present ---
{
  const docs = [
    "docs/decisions/COMMERCIAL_P0_OWNER_DECISIONS.md",
    "docs/implementation/COMMERCIAL_P0_AUTHORITY_LOCK_COMPLETION.md",
    "docs/architecture/COMMERCIAL_SNAPSHOT_SAFETY.md",
    "lib/commercial-engine/core/cost-first-authority.ts",
  ];
  for (const d of docs) {
    check(`DOC exists ${d}`, existsSync(join(process.cwd(), d)));
  }
}

// --- Boundaries ---
{
  check(
    "BOUNDARY no Stage 3.2.3 WA interview lib started",
    !existsSync(join(process.cwd(), "lib/builder-interview/work-area-ui.ts"))
  );
  const plan = read("docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md");
  check(
    "BOUNDARY MaterialRequirement still future in plan",
    plan.includes("MaterialRequirement") &&
      /MaterialRequirement[\s\S]{0,80}Not Started/.test(plan)
  );
  check(
    "BOUNDARY cost-first rates UI next batch is spec-only",
    existsSync(join(process.cwd(), "docs/plans/COST_FIRST_RATES_UI_NEXT_BATCH.md")) &&
      read("docs/plans/COST_FIRST_RATES_UI_NEXT_BATCH.md").includes("Not Started")
  );
}

console.log(`\n=== COMMERCIAL-P0 Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
