/**
 * Explicit builder approval of the legacy flat ceiling provisional package.
 * Run: npx tsx scripts/verify-ceilings-provisional-confirmation.ts
 */
import { readFileSync } from "node:fs";
import { calculateCeilings } from "../lib/estimate/calculators/fitout";
import {
  CEILING_PROVISIONAL_INSTALL_KEY,
  CEILING_PROVISIONAL_MATERIALS_KEY,
  CEILING_PROVISIONAL_MISMATCH_BLOCK,
  CEILING_PROVISIONAL_SCOPE,
  CEILING_PROVISIONAL_SOURCE,
  CEILING_PROVISIONAL_UNCONFIRMED_BLOCK,
  ceilingProvisionalDecision,
  ceilingProvisionalStateAfterLineChange,
  confirmCeilingProvisionalDraft,
  type CeilingProvisionalConfirmation,
  type CeilingProvisionalPricingLine,
} from "../lib/estimate/ceilings-provisional-package";
import { parseLineItemNotes } from "../lib/estimate/line-item-metadata";
import {
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingPortion,
} from "../lib/estimate/ceilings-portions";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value, source: "user" };
}

function ctx(facts: EstimateFact[]): EstimateContext {
  const area: EstimateWorkArea = {
    id: "c1",
    type: "ceilings",
    name: "Ceilings",
    sort_order: 1,
    status: "confirmed",
  };
  return {
    project: { id: "provisional", qualityLevel: "standard" },
    confirmedWorkAreas: [area],
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
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
      default: 5,
    },
    rates: [],
  } as unknown as EstimateContext;
}

const area: EstimateWorkArea = {
  id: "c1",
  type: "ceilings",
  name: "Ceilings",
  sort_order: 1,
  status: "confirmed",
};

function fromEstimate(item: EstimateLineItemInput): CeilingProvisionalPricingLine {
  const parsed = parseLineItemNotes(item.notes);
  return {
    id: item.componentKey ?? item.label,
    componentKey: item.componentKey ?? null,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    description: [item.label, parsed.displayNotes].filter(Boolean).join(" "),
    totalCost: item.recommendedCost,
    totalSell: item.recommendedSell,
    visible: item.includedInTotal !== false,
    source: item.rateSource,
    productivityRate: item.productivityRate ?? null,
    labourHours: item.labourHours ?? null,
  };
}

function money(lines: readonly EstimateLineItemInput[]) {
  const included = lines.filter((row) => row.includedInTotal !== false);
  const cost = included.reduce((sum, row) => sum + row.recommendedCost, 0);
  const sell = included.reduce((sum, row) => sum + row.recommendedSell, 0);
  return {
    cost: Math.round(cost * 100) / 100,
    sell: Math.round(sell * 100) / 100,
    gst: Math.round(sell * 0.15 * 100) / 100,
  };
}

const unspecified = calculateCeilings(
  ctx([
    fact("ceilings.area_m2", "c1", 30),
    fact("ceilings.structure_type", "c1", "Existing structure"),
  ]),
  area
);
const packageLines = unspecified.lineItems
  .filter((row) =>
    row.componentKey === CEILING_PROVISIONAL_MATERIALS_KEY ||
    row.componentKey === CEILING_PROVISIONAL_INSTALL_KEY
  )
  .map(fromEstimate);
const before = money(unspecified.lineItems);
const orgId = "org-builder";
const issuedQuote = { id: "q-issued", status: "issued", sell: before.sell, items: packageLines.map((row) => ({ ...row })) };
const acceptedSnapshot = { quoteId: "q-issued", sell: before.sell, frozen: true };
const variation = { id: "v1", lines: [{ sell: 100, description: "Extra access" }] };

check(
  "unspecified 30 m² package money is unchanged",
  before.cost === 3870 && before.sell === 4837.5 && before.gst === 725.63
);
check(
  "scope names the allowance and refuses a sheet takeoff",
  CEILING_PROVISIONAL_SCOPE.statement.includes("not a plasterboard sheet takeoff") &&
    CEILING_PROVISIONAL_SCOPE.includes.some((line) => line.includes("$75 per m²")) &&
    CEILING_PROVISIONAL_SCOPE.includes.some((line) => line.includes("0.9 person-hours")) &&
    CEILING_PROVISIONAL_SCOPE.excludes.includes("Fixings") &&
    CEILING_PROVISIONAL_SCOPE.excludes.includes("Stopping or plastering") &&
    unspecified.assumptions.some((line) => line.includes(CEILING_PROVISIONAL_SCOPE.statement))
);
check(
  "both provisional lines show quantity, unit, source, and limitations",
  packageLines.length === 2 &&
    packageLines.every(
      (line) =>
        line.quantity === 30 &&
        line.unit === "m²" &&
        line.source === CEILING_PROVISIONAL_SOURCE &&
        line.description.includes("Source: Provisional allowance")
    )
);

const open = ceilingProvisionalDecision({
  lines: packageLines,
  confirmation: null,
  documentOrgId: orgId,
});
check(
  "no confirmation blocks review and Quote",
  open.confirmable &&
    !open.confirmed &&
    open.block === CEILING_PROVISIONAL_UNCONFIRMED_BLOCK
);

const confirmed = confirmCeilingProvisionalDraft({
  lines: packageLines,
  confirmation: null,
  documentOrgId: orgId,
  actorOrgId: orgId,
  actorId: "builder-1",
  canEdit: true,
  now: "2026-10-12T00:00:00.000Z",
  issuedQuote,
  acceptedSnapshot,
  variation,
});
const confirmedAgain = confirmCeilingProvisionalDraft({
  ...{
    lines: packageLines,
    confirmation: confirmed.confirmation,
    documentOrgId: orgId,
    actorOrgId: orgId,
    actorId: "builder-1",
    canEdit: true,
    now: "2026-10-12T01:00:00.000Z",
    issuedQuote,
    acceptedSnapshot,
    variation,
  },
});
const reviewed = ceilingProvisionalDecision({
  lines: packageLines,
  confirmation: confirmed.confirmation,
  documentOrgId: orgId,
});
check(
  "confirmed unchanged package can be reviewed and keeps the client sell",
  confirmed.error == null &&
    reviewed.block == null &&
    reviewed.confirmed &&
    packageLines.reduce((sum, line) => sum + line.totalSell, 0) === 4837.5
);
check(
  "a repeat confirmation is idempotent",
  confirmedAgain.error == null &&
    confirmedAgain.confirmation === confirmed.confirmation &&
    confirmedAgain.confirmation?.confirmedAt === "2026-10-12T00:00:00.000Z"
);
check(
  "issued Quote, accepted snapshot, and variation are not rewritten",
  confirmed.issuedQuote === issuedQuote &&
    confirmed.acceptedSnapshot === acceptedSnapshot &&
    confirmed.variation === variation &&
    issuedQuote.status === "issued" &&
    acceptedSnapshot.frozen === true &&
    variation.lines[0]?.sell === 100
);

function quoteOnce(input: {
  block: string | null;
  existingQuoteId: string | null;
  sell: number;
}): { created: boolean; error?: string; quoteId?: string; sell: number } {
  if (input.block) return { created: false, error: input.block, sell: input.sell };
  if (input.existingQuoteId) {
    return { created: false, quoteId: input.existingQuoteId, sell: input.sell };
  }
  return { created: true, quoteId: "draft-quote", sell: input.sell };
}
const firstQuote = quoteOnce({ block: reviewed.block, existingQuoteId: null, sell: before.sell });
const secondQuote = quoteOnce({
  block: reviewed.block,
  existingQuoteId: firstQuote.quoteId ?? null,
  sell: before.sell,
});
check(
  "a reviewed package creates one draft Quote at the approved client sell",
  firstQuote.created &&
    firstQuote.sell === 4837.5 &&
    secondQuote.created === false &&
    secondQuote.quoteId === firstQuote.quoteId
);

const editedQuantity = packageLines.map((line) =>
  line.componentKey === CEILING_PROVISIONAL_MATERIALS_KEY
    ? {
        ...line,
        quantity: 20,
        totalCost: 1500,
        totalSell: 1875,
      }
    : {
        ...line,
        quantity: 20,
        labourHours: 18,
        totalCost: 1080,
        totalSell: 1350,
      }
);
const afterQuantity = ceilingProvisionalStateAfterLineChange({
  previousConfirmation: confirmed.confirmation,
  lines: editedQuantity,
  documentOrgId: orgId,
  status: "reviewed",
});
check(
  "a quantity edit drops the confirmation and returns Pricing to draft",
  afterQuantity.confirmation == null &&
    afterQuantity.status === "draft" &&
    afterQuantity.block === CEILING_PROVISIONAL_UNCONFIRMED_BLOCK
);

const editedScope = packageLines.map((line) =>
  line.componentKey === CEILING_PROVISIONAL_MATERIALS_KEY
    ? {
        ...line,
        description: "Ceiling materials allowance. Sheet takeoff for 13 mm plasterboard.",
      }
    : line
);
const afterScope = ceilingProvisionalStateAfterLineChange({
  previousConfirmation: confirmed.confirmation,
  lines: editedScope,
  documentOrgId: orgId,
  status: "reviewed",
});
const scopeConfirm = confirmCeilingProvisionalDraft({
  lines: editedScope,
  confirmation: null,
  documentOrgId: orgId,
  actorOrgId: orgId,
  actorId: "builder-1",
  canEdit: true,
  now: "2026-10-12T02:00:00.000Z",
  issuedQuote,
  acceptedSnapshot,
  variation,
});
check(
  "a scope edit blocks option A until the ceiling is priced",
  afterScope.confirmation == null &&
    afterScope.status === "draft" &&
    afterScope.block === CEILING_PROVISIONAL_MISMATCH_BLOCK &&
    scopeConfirm.error === CEILING_PROVISIONAL_MISMATCH_BLOCK &&
    scopeConfirm.confirmation == null
);

const editedMoney = packageLines.map((line) =>
  line.componentKey === CEILING_PROVISIONAL_MATERIALS_KEY
    ? { ...line, totalCost: 3000, totalSell: 3750 }
    : line
);
const afterMoney = ceilingProvisionalStateAfterLineChange({
  previousConfirmation: confirmed.confirmation,
  lines: editedMoney,
  documentOrgId: orgId,
  status: "reviewed",
});
check(
  "a cost edit invalidates the confirmation",
  afterMoney.confirmation == null &&
    afterMoney.status === "draft" &&
    afterMoney.block === CEILING_PROVISIONAL_MISMATCH_BLOCK
);

const hidden = packageLines.map((line) => ({ ...line, visible: false }));
const afterHide = ceilingProvisionalStateAfterLineChange({
  previousConfirmation: confirmed.confirmation,
  lines: hidden,
  documentOrgId: orgId,
  status: "reviewed",
});
check(
  "hiding the package invalidates the confirmation",
  afterHide.confirmation == null && afterHide.status === "draft" && afterHide.block == null
);

const replaced = packageLines.map((line) => ({
  ...line,
  componentKey: "ceilings.manual.lining",
  description: "Specified 13 mm plasterboard, priced manually.",
  source: "Manual price",
}));
const afterReplace = ceilingProvisionalStateAfterLineChange({
  previousConfirmation: confirmed.confirmation,
  lines: replaced,
  documentOrgId: orgId,
  status: "reviewed",
});
check(
  "replacing the lines removes the provisional gate",
  afterReplace.confirmation == null &&
    afterReplace.status === "draft" &&
    afterReplace.block == null
);

const regenerated = ceilingProvisionalStateAfterLineChange({
  previousConfirmation: confirmed.confirmation,
  lines: packageLines,
  documentOrgId: orgId,
  status: "reviewed",
  regenerated: true,
});
check(
  "regeneration invalidates an unchanged package",
  regenerated.confirmation == null &&
    regenerated.status === "draft" &&
    regenerated.block === CEILING_PROVISIONAL_UNCONFIRMED_BLOCK
);

const named = calculateCeilings(
  ctx([
    fact("ceilings.area_m2", "c1", 30),
    fact("ceilings.structure_type", "c1", "Existing structure"),
    fact("ceilings.ceiling_type", "c1", "Plasterboard"),
  ]),
  area
);
const namedDecision = ceilingProvisionalDecision({
  lines: named.lineItems.map(fromEstimate),
  confirmation: confirmed.confirmation,
  documentOrgId: orgId,
});
check(
  "a named lining does not inherit the provisional package",
  named.lineItems.every(
    (row) =>
      row.componentKey !== CEILING_PROVISIONAL_MATERIALS_KEY &&
      row.componentKey !== CEILING_PROVISIONAL_INSTALL_KEY
  ) &&
    namedDecision.active.length === 0 &&
    namedDecision.block == null &&
    money(named.lineItems).cost === 0 &&
    money(named.lineItems).sell === 0
);

const portion = createEmptyCeilingPortion({
  id: "fa_provisional_portion_000000000001",
  label: "Lounge",
});
portion.structure.family = "existing_framing";
portion.structure.job_scope = "reline_existing_suitable_framing";
portion.lining.family = "plasterboard";
portion.lining.plasterboard_product = "standard";
portion.lining.thickness_mm = 13;
portion.lining.sheet_length_mm = 3000;
portion.lining.sheet_width_mm = 1200;
portion.geometry.mode = "area_only";
portion.geometry.area_m2 = 30;
portion.finish.insulation_included = false;
portion.finish.painting_included = false;
portion.finish.stopping_included = false;
portion.finish.demolition_included = false;
portion.has_bulkheads = false;
const nested = calculateCeilings(
  ctx([
    {
      key: CEILINGS_PORTIONS_FACT_KEY,
      work_area_id: "c1",
      source: "user",
      value: [portion],
    },
  ]),
  area
);
const nestedDecision = ceilingProvisionalDecision({
  lines: nested.lineItems.map(fromEstimate),
  confirmation: null,
  documentOrgId: orgId,
});
check(
  "a nested portion does not open the legacy gate",
  nested.lineItems.length > 0 &&
    nested.lineItems.every(
      (row) =>
        row.componentKey !== CEILING_PROVISIONAL_MATERIALS_KEY &&
        row.componentKey !== CEILING_PROVISIONAL_INSTALL_KEY
    ) &&
    !nested.lineItems.some((row) => /\$75\/m²|materials allowance/i.test(row.label)) &&
    nestedDecision.block == null &&
    money(nested.lineItems).cost === 652 &&
    money(nested.lineItems).sell === 815.15
);

const viewer = confirmCeilingProvisionalDraft({
  lines: packageLines,
  confirmation: null,
  documentOrgId: orgId,
  actorOrgId: orgId,
  actorId: "viewer-1",
  canEdit: false,
  now: "2026-10-12T03:00:00.000Z",
  issuedQuote,
  acceptedSnapshot,
  variation,
});
const otherOrg = confirmCeilingProvisionalDraft({
  lines: packageLines,
  confirmation: null,
  documentOrgId: orgId,
  actorOrgId: "org-other",
  actorId: "builder-2",
  canEdit: true,
  now: "2026-10-12T03:00:00.000Z",
  issuedQuote,
  acceptedSnapshot,
  variation,
});
const stale: CeilingProvisionalConfirmation = {
  confirmedAt: "2026-10-01T00:00:00.000Z",
  confirmedBy: "builder-1",
  orgId,
  fingerprint: "stale-fingerprint",
};
const staleDecision = ceilingProvisionalDecision({
  lines: packageLines,
  confirmation: stale,
  documentOrgId: orgId,
});
const foreignConfirmation: CeilingProvisionalConfirmation = {
  ...confirmed.confirmation!,
  orgId: "org-other",
};
const foreignDecision = ceilingProvisionalDecision({
  lines: packageLines,
  confirmation: foreignConfirmation,
  documentOrgId: orgId,
});
check("a viewer cannot confirm", viewer.error != null && viewer.confirmation == null);
check("another organisation cannot confirm", otherOrg.error != null && otherOrg.confirmation == null);
check(
  "a stale or foreign confirmation does not authorise a Quote",
  staleDecision.block === CEILING_PROVISIONAL_UNCONFIRMED_BLOCK &&
    foreignDecision.block === CEILING_PROVISIONAL_UNCONFIRMED_BLOCK &&
    viewer.issuedQuote === issuedQuote &&
    otherOrg.variation === variation
);

const actions = readFileSync("lib/pricing/actions.ts", "utf8");
const quoteBuild = readFileSync("lib/quotes/build-from-pricing.ts", "utf8");
const quoteActions = readFileSync("lib/quotes/actions.ts", "utf8");
const recalibration = readFileSync("lib/pricing/recalibration.ts", "utf8");
const panel = readFileSync("components/pricing/CeilingProvisionalDecision.tsx", "utf8");
const confirmStart = actions.indexOf("export async function confirmCeilingProvisionalPackage");
const confirmEnd = actions.indexOf("export async function setPricingItemsQuoteVisibility");
const confirmSource = actions.slice(confirmStart, confirmEnd);
const createStart = quoteActions.indexOf("export async function createQuoteFromPricing");
const createSource = quoteActions.slice(createStart, createStart + 2500);
const existingQuote = createSource.indexOf("pickLatestQuoteSummary");
const snapshotCall = createSource.indexOf("buildQuoteSnapshotFromReviewedPricing");
check(
  "server review and Quote creation recheck the decision",
  actions.includes("ceilingProvisionalDecision") &&
    quoteBuild.includes("ceilingProvisionalDecision") &&
    confirmSource.includes("requirePricingEditPermission") &&
    confirmSource.includes('.eq("org_id", orgId)') &&
    confirmSource.includes("provisional_ceiling_confirmation") &&
    !confirmSource.includes("from(\"quotes\")") &&
    !confirmSource.includes("from(\"variations\")") &&
    existingQuote > 0 &&
    snapshotCall > existingQuote
);
check(
  "regeneration clears the draft confirmation without quoting a variation",
  recalibration.includes("provisional_ceiling_confirmation: null") &&
    recalibration.includes('status: "draft"') &&
    !recalibration.includes("from(\"variations\")")
);
check(
  "Pricing shows one decision for the package",
  panel.includes("CEILING_PROVISIONAL_SCOPE") &&
    panel.includes("data-ceiling-provisional-decision") &&
    panel.includes("scroll-mb-[11rem]") &&
    panel.includes("CEILING_PROVISIONAL_CONFIRM_LABEL") &&
    panel.includes("CEILING_PROVISIONAL_REPLACE_HINT") &&
    CEILING_PROVISIONAL_SCOPE.heading === "Provisional ceiling package" &&
    !panel.includes("type=\"checkbox\"")
);

if (failed > 0) {
  console.log(`${failed} failed`);
  process.exit(1);
}
console.log("ceilings provisional confirmation passed");
