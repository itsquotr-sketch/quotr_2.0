/**
 * Cost-first Rates verification.
 *
 * Covers creation semantics, legacy retention, recommended transition,
 * margin formula, calculator resolve compatibility, and UX contracts.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  applyProjectGrossMarginToCost,
  MAX_GROSS_MARGIN_PERCENT,
} from "../lib/commercial-engine/core/cost-first-authority";
import { applyMarginToAmounts } from "../lib/estimate/margin-override";
import {
  resolveLabourRate,
  resolveRate,
} from "../lib/estimate/rates";
import {
  displayChargeOut,
  presentCompanyRate,
  recommendedChargeOutFromCost,
  resolveUnitSellForVerify,
  sellRateForPersistence,
} from "../lib/rates/cost-first-presentation";
import type {
  OrganisationRate,
  OrganisationSettings,
} from "../components/setup/types";

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
  id: "s",
  org_id: "o",
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

function labourRate(
  cost: number | null,
  sell: number | null
): OrganisationRate {
  return {
    id: "r1",
    rate_type: "labour",
    trade: null,
    work_area_type: null,
    item_key: "labour.carpenter.hour",
    label: "Carpenter",
    unit: "hour",
    cost_rate: cost,
    sell_rate: sell,
    markup_percent: null,
    active: true,
  };
}

// 1–5 formula + new cost-only
{
  check("1 recommended 60 @20% → 75", recommendedChargeOutFromCost(60, 20) === 75);
  const costOnly = resolveLabourRate({
    rates: [labourRate(60, null)],
    organisationSettings: settings,
  });
  check(
    "2 cost-only labour resolves sell 75 derived",
    costOnly.sellRate === 75 &&
      costOnly.sellAuthority === "derived_from_gross_margin"
  );
  check("3 GM formula sell = cost/(1-m)", recommendedChargeOutFromCost(1000, 20) === 1250);
  check("4 zero margin → sell = cost", recommendedChargeOutFromCost(60, 0) === 60);
  check(
    "5 max margin finite",
    Number.isFinite(recommendedChargeOutFromCost(60, MAX_GROSS_MARGIN_PERCENT))
  );
}

// 6–7 legacy + transition
{
  const legacy = presentCompanyRate({
    costRate: 60,
    sellRate: 90,
    companyGrossMarginPercent: 20,
  });
  check(
    "6 legacy paired retained",
    legacy.hasRetainedChargeOut &&
      legacy.persistedSellRate === 90 &&
      legacy.recommendedChargeOut === 75 &&
      legacy.recommendedDiffersFromRetained
  );
  check(
    "6b resolve preserves legacy 90",
    resolveLabourRate({
      rates: [labourRate(60, 90)],
      organisationSettings: settings,
    }).sellRate === 90
  );
  check(
    "7 use recommended → persist null sell",
    sellRateForPersistence({ mode: "derived", customSellString: "90" }) === null
  );
  const afterTransition = resolveUnitSellForVerify({
    costRate: 60,
    sellRate: null,
    companyGrossMarginPercent: 20,
  });
  check(
    "7b after transition derived 75",
    afterTransition.sellRate === 75 &&
      afterTransition.sellAuthority === "derived_from_gross_margin"
  );
}

// 8 explicit override
{
  const explicit = resolveUnitSellForVerify({
    costRate: 60,
    sellRate: 99,
    companyGrossMarginPercent: 20,
    explicitSellOverride: true,
  });
  check(
    "8 explicit override 99",
    explicit.sellRate === 99 &&
      explicit.sellAuthority === "explicit_sell_override"
  );
}

// 9 company margin change — derived updates, legacy retained
{
  const derivedAt25 = recommendedChargeOutFromCost(60, 25);
  check("9 derived updates with company GM 25%", derivedAt25 === 80);
  const legacyStill = presentCompanyRate({
    costRate: 60,
    sellRate: 90,
    companyGrossMarginPercent: 25,
  });
  check(
    "9b legacy sell stays 90 when company GM changes",
    legacyStill.persistedSellRate === 90
  );
}

// 10 project margin override
{
  check(
    "10 project GM 20% from cost 60 → 75 not stacked",
    applyProjectGrossMarginToCost(60, 20) === 75
  );
  const line = applyMarginToAmounts(1200, 20, settings);
  check(
    "10b 20h×60=1200 @20% → sell 1500",
    line.recommendedCost === 1200 && line.recommendedSell === 1500
  );
}

// 11 material cost-first
{
  const material = resolveRate({
    rates: [
      {
        ...labourRate(8.5, null),
        rate_type: "material",
        item_key: "deck.material.hardwood.lm",
        unit: "lm",
        cost_rate: 8.5,
        sell_rate: null,
      },
    ],
    rateType: "material",
    itemKey: "deck.material.hardwood.lm",
    unit: "lm",
    fallbackCostRate: 8,
    fallbackSellRate: 10,
    organisationSettings: settings,
  });
  check(
    "11 material cost-only derives sell",
    Math.abs(material.sellRate - recommendedChargeOutFromCost(8.5, 20)) < 0.01 &&
      material.sellAuthority === "derived_from_gross_margin"
  );
}

// 12 subcontractor
{
  const subbie = resolveRate({
    rates: [
      {
        ...labourRate(2000, null),
        rate_type: "subcontractor",
        item_key: "bathroom.plumbing.allowance",
        unit: "allowance",
        cost_rate: 2000,
        sell_rate: null,
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
    "12 subcontractor cost-first derive",
    subbie.sellRate === 2500 && subbie.isLegacyPairedRate === false
  );
}

// 13 benchmark compatibility — paired fallback still legacy when both provided
{
  const bench = resolveRate({
    rates: [],
    rateType: "material",
    itemKey: "deck.material.treated_pine.m2",
    unit: "m2",
    fallbackCostRate: 70,
    fallbackSellRate: 95,
    organisationSettings: settings,
  });
  check(
    "13 paired benchmark fallback legacy",
    bench.costRate === 70 &&
      bench.sellRate === 95 &&
      bench.isLegacyPairedRate
  );
}

// 14–16 calculator resolve still wired
{
  const deckSrc = read("lib/estimate/calculators/deck.ts");
  const bathSrc = read("lib/estimate/calculators/bathroom.ts");
  const fitSrc = read("lib/estimate/calculators/fitout.ts");
  check("14 deck uses resolveRate/resolveLabourRate", /resolveRate|resolveLabourRate/.test(deckSrc));
  check("15 bathroom uses resolveRate/resolveLabourRate", /resolveRate|resolveLabourRate/.test(bathSrc));
  check("16 fitout uses resolveRate/resolveLabourRate", /resolveRate|resolveLabourRate/.test(fitSrc));
}

// 17–20 estimate / pricing / quote / no double
{
  const totals = applyMarginToAmounts(1200, 20, settings);
  check(
    "17 estimate totals from cost 1200 @20%",
    totals.recommendedCost === 1200 && totals.recommendedSell === 1500
  );
  check(
    "20 no double margin (not 2250)",
    totals.recommendedSell === 1500 && totals.recommendedSell !== 2250
  );
  const pricing = read("lib/pricing/estimate-to-pricing-adapter.ts");
  const quote = read("lib/quotes/from-pricing.ts");
  check(
    "18 pricing adapter present",
    pricing.length > 100 && /estimate|authoritative|sell/i.test(pricing)
  );
  check(
    "19 quote consumes pricing sell",
    quote.length > 50 && /total_sell|totalSell/i.test(quote)
  );
}

// 21 provenance
{
  const d = displayChargeOut({
    costRate: 60,
    sellRate: null,
    companyGrossMarginPercent: 20,
  });
  check("21 display recommended when sell null", d.isRecommended && d.value === 75);
  const c = displayChargeOut({
    costRate: 60,
    sellRate: 90,
    companyGrossMarginPercent: 20,
  });
  check("21b display custom when sell set", c.isCustom && c.value === 90);
}

// 22 UX contract
{
  const dialog = read("components/rates/RateEditDialog.tsx");
  const table = read("components/rates/RatesTableSection.tsx");
  const row = read("components/setup/RateInputRow.tsx");
  check("22 Your cost primary in dialog", dialog.includes("Your cost"));
  check("22b Recommended charge-out", dialog.includes("Recommended charge-out"));
  check("22c Use recommended rate", dialog.includes("Use recommended rate"));
  check("22d Custom charge-out secondary", dialog.includes("Custom charge-out"));
  check("22e no customer jargon sellAuthority", !dialog.includes("sellAuthority"));
  check("22f table Your cost / Charge-out", table.includes("Your cost") && table.includes("Charge-out"));
  check("22g adopt benchmark cost-only", table.includes("sell_rate: null"));
  check("22h setup RateInputRow cost-first", row.includes("Your cost") && row.includes("Recommended charge-out"));
  check(
    "22i mobile card charge-out",
    table.includes("RateMobileCard") && table.includes("Charge-out")
  );
}

// 23–24 auth / docs
{
  const actions = read("lib/rates/actions.ts");
  check(
    "23 rates actions use auth context",
    actions.includes("getAuthOrgContext") || actions.includes("requireAuth")
  );
  check(
    "24 DOC completion",
    existsSync(join(process.cwd(), "docs/implementation/COST_FIRST_RATES_COMPLETION.md"))
  );
  check(
    "24b DOC owner preview runbook",
    existsSync(join(process.cwd(), "docs/runbooks/COST_FIRST_RATES_OWNER_PREVIEW.md"))
  );
  check(
    "BOUNDARY Catalogue V2 not started",
    !existsSync(join(process.cwd(), "lib/materials/catalogue-v2.ts"))
  );
  check(
    "BOUNDARY no new migration in this batch",
    !existsSync(join(process.cwd(), "supabase/migrations/034_cost_first_rates.sql"))
  );
}

console.log(`\n=== Cost-first Rates Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
