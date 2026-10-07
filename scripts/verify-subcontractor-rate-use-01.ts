/**
 * Job-specific use of a reusable subcontractor rate.
 * Run: npx tsx scripts/verify-subcontractor-rate-use-01.ts
 *      npx tsx scripts/verify-subcontractor-rate-use-01.ts --live
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { calculateAuthoritativePricingItem } from "../lib/pricing/commercial-engine-adapter";
import { buildRfqSellChoices } from "../lib/rfqs/pricing-preview";
import {
  rateScopeConflictsWithResponse,
  rateVersionUsable,
  supplierCostFromRate,
  unitsAreCompatible,
} from "../lib/subcontractors/rate-use";
import { PREVIEW_SUPABASE_PROJECT_REF, PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";

const root = process.cwd();
let failed = 0;
function assert(name: string, condition: boolean, detail?: string) {
  if (condition) console.log(`PASS: ${name}`);
  else {
    failed += 1;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}
function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[match[1]] = value;
  }
  return out;
}
function money(value: number | null | undefined): string {
  if (value == null) return "unknown";
  return value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function staticMain() {
  console.log("=== subcontractor rate use ===");
  const sql = read("supabase/migrations/094_subcontractor_rate_use.sql");
  const resolver = read("lib/estimate/rates.ts");
  const persist = read("lib/estimate/persist-estimate.ts") + read("lib/estimate/persist-estimate-generation.ts");
  const actions = read("lib/subcontractors/rate-use-actions.ts");
  const profile = read("components/subcontractors/SubcontractorProfile.tsx");
  const ratesUi = read("components/subcontractors/SubcontractorRates.tsx");
  const suggestions = read("components/projects/JobRateSuggestions.tsx");
  const recalibration = read("lib/pricing/recalibration.ts");
  assert("no Preview ref", !sql.includes(PREVIEW_SUPABASE_PROJECT_REF));
  assert("no Production ref", !sql.includes(PRODUCTION_SUPABASE_PROJECT_REF));
  assert("resolver is unchanged", !resolver.includes("subcontractor_rate"));
  assert("estimate generation does not apply rates", !persist.includes("apply_subcontractor_rate") && !persist.includes("subcontractor_rate_applications"));
  assert("quotes snapshots and variations are not written", !/update public\.(quotes|accepted_commercial|variations)/i.test(sql));
  assert("document totals use the pricing authority", actions.includes("persistPricingDocumentTotals"));
  assert("regeneration asks before dropping a supplier rate", recalibration.includes("RATE_RECONCILIATION_REQUIRED") && recalibration.includes('reconciliation_status: "pending"'));
  assert("a suggestion is not an application", suggestions.includes("not applied to the Estimate or to Pricing") && suggestions.includes("does not mean the supplier scope matches the job"));
  assert("section edit sits on its own row", profile.includes("w-full whitespace-normal sm:w-auto") && profile.includes("Edit {title}"));
  assert("people text can wrap", profile.includes('className="break-words">{primary.name}'));
  assert("profile tabs stay in one row", profile.includes("touchTargets\n        />"));
  assert("rate card shows version, dates, and exclusions", ratesUi.includes("Version {current.versionNumber}") && ratesUi.includes("Exclusions:"));
  const perMetre = supplierCostFromRate({ unit: "m2", unitCostExGst: 85, minimumCharge: 200, quantity: 10 });
  const lump = supplierCostFromRate({ unit: "lump_sum", unitCostExGst: 1800, minimumCharge: 500, quantity: 10 });
  const minimum = supplierCostFromRate({ unit: "m2", unitCostExGst: 85, minimumCharge: 200, quantity: 1 });
  const missing = supplierCostFromRate({ unit: "m2", unitCostExGst: 85, minimumCharge: null, quantity: null });
  assert("10 m² at 85 is 850", perMetre.ok && perMetre.costExGst === 850 && !perMetre.minimumApplied);
  assert("a lump sum is not multiplied", lump.ok && lump.costExGst === 1800 && lump.quantityUsed == null);
  assert("minimum charge applies once", minimum.ok && minimum.costExGst === 200 && minimum.minimumApplied);
  assert("missing quantity is refused", !missing.ok);
  assert("m² matches a square-metre item", unitsAreCompatible("m2", "m²"));
  assert("m² does not match hours", !unitsAreCompatible("m2", "hour"));
  assert("same scope conflicts with a response", rateScopeConflictsWithResponse("Supply and install wall tiles", "Supply and install wall tiles", "Bathroom"));
  assert("a different scope does not conflict", !rateScopeConflictsWithResponse("Supply and install floor tiles", "Waterproof wet areas", "Bathroom"));
  assert("expired and retired versions are refused", rateVersionUsable({ retired: true, currency: "NZD", effectiveFrom: "2026-01-01", effectiveUntil: null, today: "2026-10-07" }).ok === false);
  assert("another currency is refused", rateVersionUsable({ retired: false, currency: "AUD", effectiveFrom: "2026-01-01", effectiveUntil: null, today: "2026-10-07" }).ok === false);
  const preview = buildRfqSellChoices({
    responseId: "rate-preview",
    priceExGst: 850,
    gstRate: 15,
    items: [{ id: "line", totalCost: 400, totalSell: 800 }],
    replacedIds: ["line"],
    existingAllowanceId: null,
    targetMarginPercent: 25,
    manualSell: 1000,
  });
  if (!preview.ok) {
    assert("sell choices preview", false, preview.error);
  } else {
    const target = preview.preview.choices.find((choice) => choice.treatment === "target_margin");
    console.log(`PER_M2_BEFORE cost ${money(preview.preview.before.cost)} sell ${money(preview.preview.before.sell)} gp ${money(preview.preview.before.grossProfit)} margin ${money(preview.preview.before.marginPercent)} gst ${money(preview.preview.before.gstAmount)} total ${money(preview.preview.before.totalInclGst)}`);
    console.log(`PER_M2_TARGET cost ${money(target?.after.cost)} sell ${money(target?.after.sell)} gp ${money(target?.after.grossProfit)} margin ${money(target?.after.marginPercent)} gst ${money(target?.after.gstAmount)} total ${money(target?.after.totalInclGst)}`);
    assert("target sell is above the 850 cost", Boolean(target?.available && target.sell && target.sell > 850));
  }
  const lockSql = read("supabase/migrations/095_supplier_rate_pricing_lock.sql");
  const pricingActions = read("lib/pricing/actions.ts");
  const rateDialog = read("components/projects/UseSubcontractorRate.tsx");
  const supplierEditor = read("components/pricing/SupplierPriceEditor.tsx");
  const updateStart = pricingActions.indexOf("export async function updatePricingItem");
  const updateBody = pricingActions.slice(updateStart, pricingActions.indexOf("export async function duplicatePricingItem"));
  const lockAt = updateBody.indexOf("supplierCommercialUnchanged");
  const computeAt = updateBody.indexOf("computePricingItemMoneyFields");
  assert("the pricing save checks the supplier lock before the commercial engine", lockAt > 0 && computeAt > lockAt);
  assert("duplicate, delete, visibility, and final sell refuse a supplier allowance", ["duplicatePricingItem", "deletePricingItem", "setPricingItemsQuoteVisibility", "deleteManualPricingItems", "applyPricingFinalSell"].every((name) => pricingActions.includes(name) && pricingActions.includes("SUPPLIER_PRICE_REVIEW")));
  assert("a lump sum says it is used once", rateDialog.includes("One lump sum") && rateDialog.includes("data-lump-sum"));
  assert("the pricing editor offers a supplier review", supplierEditor.includes("Review supplier price") && supplierEditor.includes("Supplier cost") && supplierEditor.includes("Client sell"));
  assert("the database refuses a normal rewrite of a supplier allowance", lockSql.includes("SUPPLIER_PRICE_LOCKED") && lockSql.includes("pricing_items_supplier_rate_lock") && lockSql.split("quotr.supplier_rate_write").length >= 3);
  const ordinaryEdit = calculateAuthoritativePricingItem({
    calculationMode: "lump_sum",
    quantity: 10,
    unit: "m2",
    unitCost: 85,
    unitSell: 113.33,
    totalCost: 850,
    totalSell: 1133.33,
    itemType: "allowance",
  });
  assert(
    "the ordinary lump-sum engine drops the rate unit cost",
    ordinaryEdit.ok && ordinaryEdit.fields.unitCost == null && ordinaryEdit.fields.totalCost === 850 && ordinaryEdit.fields.totalSell === 1133.33,
    ordinaryEdit.ok ? `unit ${ordinaryEdit.fields.unitCost}` : ordinaryEdit.error
  );
}

function totals(items: Array<{ total_cost: number; total_sell: number }>) {
  return calculateAuthoritativeDocumentTotals(items.map((item) => ({ ...item, visible: true, cost_known: true })), 15, "rate-use");
}

async function createUser(admin: SupabaseClient, email: string, password: string) {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!created.data.user || created.error) throw new Error(created.error?.message ?? "user");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error(signed.error.message);
  return { id: created.data.user.id, client };
}

async function liveMain() {
  const env = parseEnvFile(resolve(root, ".env.local"));
  for (const [key, value] of Object.entries(env)) if (!process.env[key]) process.env[key] = value;
  const host = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!host.includes(PREVIEW_SUPABASE_PROJECT_REF) || host.includes(PRODUCTION_SUPABASE_PROJECT_REF)) throw new Error("refused: not Preview");
  const admin = createClient(host, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = `${Date.now()}`;
  const password = `Rate-Use-${suffix}-Aa1`;
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const userIds: string[] = [];
  async function boundUser(role: "owner" | "viewer" | "estimator", orgId: string, status: "active" | "pending_billing" = "active") {
    const email = `use-${role}-${status}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
    const created = await createUser(admin, email, password);
    userIds.push(created.id);
    const profile = await admin.from("profiles").upsert({ id: created.id, org_id: orgId, role, full_name: `Use ${role}` });
    if (profile.error) throw new Error(profile.error.message);
    const membership = await admin.from("organisation_memberships").insert({
      org_id: orgId, user_id: created.id, role, status, joined_at: new Date().toISOString(),
    });
    if (membership.error) throw new Error(membership.error.message);
    return created.client;
  }
  try {
    for (const org of [{ id: orgA, name: `Use Org ${suffix}` }, { id: orgB, name: `Other Use ${suffix}` }]) {
      const inserted = await admin.from("organisations").insert(org);
      if (inserted.error) throw new Error(inserted.error.message);
    }
    const owner = await boundUser("owner", orgA);
    const viewer = await boundUser("viewer", orgA);
    const foreign = await boundUser("owner", orgB);
    const inactive = await boundUser("estimator", orgA, "pending_billing");
    const project = await admin.from("projects").insert({
      org_id: orgA, created_by: userIds[0], title: `Use ${suffix}`, stage: "estimate_ready", business_status: "estimate_ready",
    }).select("id").single();
    if (project.error) throw new Error(project.error.message);
    const area = await admin.from("work_areas").insert({
      org_id: orgA, project_id: project.data.id, type: "bathroom", name: "Bathroom", summary: "Supply and install wall tiles", status: "confirmed", sort_order: 1,
    }).select("id").single();
    if (area.error) throw new Error(area.error.message);
    const estimate = await admin.from("estimates").insert({
      org_id: orgA, project_id: project.data.id, status: "ready", recommended_cost: 400, recommended_sell: 800,
      target_margin_percent: 25, assumptions: ["generated"],
    }).select("id").single();
    if (estimate.error) throw new Error(estimate.error.message);
    const line = await admin.from("estimate_line_items").insert({
      org_id: orgA, project_id: project.data.id, estimate_id: estimate.data.id, work_area_id: area.data.id,
      work_area_name: "Bathroom", label: "Wall tiles", category: "subcontractor", recommended_cost: 400, recommended_sell: 800, sort_order: 1,
    }).select("id, recommended_cost, recommended_sell").single();
    if (line.error) throw new Error(line.error.message);
    const pricing = await admin.from("pricing_documents").insert({
      org_id: orgA, project_id: project.data.id, estimate_id: estimate.data.id, title: "Draft pricing", status: "reviewed",
      subtotal_cost: 400, subtotal_sell: 800, gross_profit: 400, margin_percent: 50, gst_rate: 15, gst_amount: 120, total_incl_gst: 920,
    }).select("id").single();
    if (pricing.error) throw new Error(pricing.error.message);
    const issued = await admin.from("pricing_documents").insert({
      org_id: orgA, project_id: project.data.id, estimate_id: estimate.data.id, title: "Issued source", status: "converted_to_quote", gst_rate: 15,
    }).select("id").single();
    if (issued.error) throw new Error(issued.error.message);
    const quote = await admin.from("quotes").insert({
      org_id: orgA, project_id: project.data.id, pricing_document_id: issued.data.id, estimate_id: estimate.data.id,
      title: "Issued quote", status: "draft", subtotal: 800, total_incl_gst: 920,
    }).select("id").single();
    if (quote.error) throw new Error(quote.error.message);
    const snapshot = await admin.from("accepted_commercial_snapshots").insert({
      org_id: orgA, project_id: project.data.id, quote_id: quote.data.id, revision_number: 1, currency: "NZD",
      gst_rate: 15, tax_treatment: "standard", sell_ex_gst: 800, gst_amount: 120, sell_incl_gst: 920,
      accepted_at: new Date().toISOString(), acceptance_source: "manual",
    }).select("id, sell_ex_gst").single();
    if (snapshot.error) throw new Error(snapshot.error.message);
    const issuedItem = await admin.from("quote_items").insert({
      org_id: orgA, quote_id: quote.data.id, project_id: project.data.id, label: "Original wall tiles",
      quantity: 1, unit: "m²", unit_price: 800, total: 800, visible: true, sort_order: 1,
    }).select("id, label, total, quantity, unit, unit_price, visible").single();
    if (issuedItem.error) throw new Error(issuedItem.error.message);
    const sentQuote = await admin.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", quote.data.id).select("id, status, subtotal, total_incl_gst").single();
    if (sentQuote.error) throw new Error(sentQuote.error.message);
    quote.data = sentQuote.data;
    const variationDraft = await owner.rpc("create_draft_variation_v1", {
      p_project: project.data.id, p_title: "Extra tiling", p_summary: "Issued before the supplier rate.",
      p_idempotency_key: `rate-use-${suffix}`,
    });
    const variationCreated = variationDraft.data as { ok?: boolean; error?: string; variationId?: string; revisionId?: string } | null;
    if (!variationCreated?.ok || !variationCreated.variationId || !variationCreated.revisionId) throw new Error(JSON.stringify(variationDraft.data ?? variationDraft.error));
    const variationItem = await owner.rpc("add_draft_variation_item_v1", {
      p_variation: variationCreated.variationId, p_revision: variationCreated.revisionId,
      p_item: {
        itemType: "addition", clientDescription: "Extra wall tiling", workAreaId: null, snapshotLineId: null,
        stableComponentKey: null, quantity: 1, unit: "item", unitCost: 400, unitSell: 800, sortOrder: 1,
        clientInclusion: null, clientExclusion: null, substitutionGroupId: null, internalMetadata: {},
      },
    });
    if (variationItem.data?.ok !== true) throw new Error(JSON.stringify(variationItem.data ?? variationItem.error));
    const variationIssued = await owner.rpc("issue_variation_revision_v1", {
      p_variation: variationCreated.variationId, p_revision: variationCreated.revisionId,
    });
    if (variationIssued.data?.ok !== true) throw new Error(JSON.stringify(variationIssued.data ?? variationIssued.error));
    const issuedVariationItems = await admin.from("variation_items").select("client_description, quantity, unit, unit_cost, unit_sell, line_cost_adjustment, line_sell_adjustment_ex_gst").eq("variation_id", variationCreated.variationId);
    const issuedVariationRevision = await admin.from("variation_revisions").select("status, total_direct_cost_adjustment, total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst").eq("id", variationCreated.revisionId).single();
    const variationFingerprint = JSON.stringify({ items: issuedVariationItems.data, revision: issuedVariationRevision.data });
    const business = await owner.rpc("save_subcontractor_v1", {
      p_payload: { trading_name: `Use Co ${suffix}`, work_area_types: ["bathroom"], contacts: [{ name: "Ada", is_primary: true }] },
    });
    if (typeof business.data !== "string") throw new Error(JSON.stringify(business.data ?? business.error));

    async function saveRate(payload: Record<string, unknown>) {
      const saved = await owner.rpc("save_subcontractor_rate_v1", {
        p_payload: {
          subcontractor_id: business.data, work_area_type: "bathroom", currency: "NZD", source: "builder",
          effective_from: "2026-01-01", inclusions: "", exclusions: "Waterproofing",
          confirm_scope: "true", confirm_unit: "true", confirm_amount: "true", confirm_validity: "true",
          ...payload,
        },
      });
      return saved.data as { ok?: boolean; error?: string; rateId?: string; versionId?: string; versionNumber?: number };
    }
    const metre = await saveRate({ scope: "Supply and install wall tiles", unit: "m2", cost_ex_gst: 85, minimum_charge: 200 });
    assert("per m² rate is saved", metre.ok === true, JSON.stringify(metre));
    const lumpRate = await saveRate({ scope: "Supply and install a bathroom", unit: "lump_sum", cost_ex_gst: 1800 });
    const floor = await saveRate({ scope: "Supply and install floor tiles", unit: "m2", cost_ex_gst: 85, minimum_charge: 200 });
    const expired = await saveRate({ scope: "Expired tiling", unit: "m2", cost_ex_gst: 85, effective_until: "2026-01-02" });
    assert("lump, floor, and expired rates exist", Boolean(lumpRate.versionId && floor.versionId && expired.versionId));

    async function addItem(label: string, unit: string, cost: number, sell: number) {
      const inserted = await admin.from("pricing_items").insert({
        org_id: orgA, pricing_document_id: pricing.data.id, project_id: project.data.id, work_area_id: area.data.id,
        item_type: "subcontractor", delivery_method: "subcontracted", internal_label: label, client_label: label,
        quantity: unit === "lump_sum" ? 1 : 10, unit, unit_cost: cost, unit_sell: sell, total_cost: cost, total_sell: sell,
        gross_profit: Math.round((sell - cost) * 100) / 100, margin_percent: sell > 0 ? Math.round(((sell - cost) / sell) * 10000) / 100 : 0,
        markup_percent: cost > 0 ? Math.round(((sell - cost) / cost) * 10000) / 100 : 0,
        visible_on_quote: true, sort_order: 1,
      }).select("id, total_cost, total_sell").single();
      if (inserted.error) throw new Error(inserted.error.message);
      return inserted.data;
    }
    async function clearItems() {
      await admin.from("subcontractor_rate_applications").delete().eq("pricing_document_id", pricing.data.id);
      await admin.from("rfq_pricing_applications").delete().eq("pricing_document_id", pricing.data.id);
      await admin.from("pricing_items").delete().eq("pricing_document_id", pricing.data.id);
      await admin.from("pricing_documents").update({ status: "reviewed", reviewed_at: new Date().toISOString() }).eq("id", pricing.data.id);
    }
    async function apply(payload: Record<string, unknown>) {
      const result = await owner.rpc("apply_subcontractor_rate_to_pricing_v1", { p_payload: payload });
      return (result.data ?? { ok: false, error: result.error?.message }) as { ok?: boolean; error?: string; alreadyApplied?: boolean; allowanceItemId?: string; costExGst?: number; sellExGst?: number };
    }
    function priced(price: number, item: { id: string; total_cost: number; total_sell: number }, treatment: "keep" | "target_margin" | "manual", manual: number | null) {
      const preview = buildRfqSellChoices({
        responseId: "rate-live", priceExGst: price, gstRate: 15,
        items: [{ id: item.id, totalCost: Number(item.total_cost), totalSell: Number(item.total_sell) }],
        replacedIds: [item.id], existingAllowanceId: null, targetMarginPercent: 25, manualSell: manual,
      });
      if (!preview.ok) throw new Error(preview.error);
      const choice = preview.preview.choices.find((entry) => entry.treatment === treatment);
      if (!choice?.allowance || choice.sell == null) throw new Error(choice?.unavailableReason ?? treatment);
      return { preview: preview.preview, choice };
    }

    await clearItems();
    const tile = await addItem("Wall tiles", "m²", 400, 800);
    const metrePrice = priced(850, tile, "target_margin", null);
    console.log(`LIVE_PER_M2_BEFORE cost ${money(metrePrice.preview.before.cost)} sell ${money(metrePrice.preview.before.sell)} gp ${money(metrePrice.preview.before.grossProfit)} margin ${money(metrePrice.preview.before.marginPercent)} gst ${money(metrePrice.preview.before.gstAmount)} total ${money(metrePrice.preview.before.totalInclGst)}`);
    console.log(`LIVE_PER_M2_AFTER cost ${money(metrePrice.choice.after.cost)} sell ${money(metrePrice.choice.after.sell)} gp ${money(metrePrice.choice.after.grossProfit)} margin ${money(metrePrice.choice.after.marginPercent)} gst ${money(metrePrice.choice.after.gstAmount)} total ${money(metrePrice.choice.after.totalInclGst)}`);
    const metreBase = {
      rate_version_id: metre.versionId, pricing_document_id: pricing.data.id, work_area_id: area.data.id,
      target_mode: "replace", target_item_id: tile.id, quantity: 10, confirm_scope: "true", confirm_quantity: "true",
      total_cost: metrePrice.choice.allowance!.totalCost, total_sell: metrePrice.choice.allowance!.totalSell,
      gross_profit: metrePrice.choice.allowance!.grossProfit, margin_percent: metrePrice.choice.allowance!.marginPercent,
      markup_percent: metrePrice.choice.allowance!.markupPercent, sell_treatment: "target_margin", target_margin_percent: 25,
      acknowledge_loss: "false",
    };
    const used = await apply(metreBase);
    assert("per m² rate replaces the tile item", used.ok === true && used.alreadyApplied !== true, JSON.stringify(used));
    const again = await apply(metreBase);
    assert("repeating the same use does not add a second allowance", again.alreadyApplied === true);
    const allowances = await admin.from("pricing_items").select("id, total_cost, total_sell, visible_on_quote").eq("pricing_document_id", pricing.data.id).gt("total_cost", 0);
    assert("one charged item remains", (allowances.data ?? []).length === 1 && Number(allowances.data?.[0]?.total_cost) === 850, JSON.stringify(allowances.data));
    const afterTotals = totals((allowances.data ?? []).map((item) => ({ total_cost: Number(item.total_cost), total_sell: Number(item.total_sell) })));
    assert("stored line matches the commercial after totals", afterTotals.ok && afterTotals.totals.subtotalCost === metrePrice.choice.after.cost && afterTotals.totals.totalInclGst === metrePrice.choice.after.totalInclGst);
    const reviewed = await admin.from("pricing_documents").select("status").eq("id", pricing.data.id).single();
    assert("reviewed pricing returns to draft", reviewed.data?.status === "draft");
    const storedLine = await admin.from("pricing_items").select("quantity, unit, unit_cost, unit_sell, total_cost, total_sell, gross_profit, margin_percent, calculation_mode, item_type").eq("id", used.allowanceItemId!).single();
    const storedSource = await admin.from("subcontractor_rate_applications").select("rate_version_id, version_number, quantity, cost_ex_gst, sell_ex_gst, sell_treatment, minimum_applied, scope").eq("allowance_item_id", used.allowanceItemId!).is("superseded_at", null).single();
    console.log(`LIVE_STORED_LINE ${JSON.stringify(storedLine.data)}`);
    console.log(`LIVE_STORED_SOURCE ${JSON.stringify(storedSource.data)}`);
    const moneyBeforeEdit = JSON.stringify(storedLine.data);
    const sourceBeforeEdit = JSON.stringify(storedSource.data);
    async function moneySame(name: string) {
      const current = await admin.from("pricing_items").select("quantity, unit, unit_cost, unit_sell, total_cost, total_sell, gross_profit, margin_percent, calculation_mode, item_type").eq("id", used.allowanceItemId!).single();
      const source = await admin.from("subcontractor_rate_applications").select("rate_version_id, version_number, quantity, cost_ex_gst, sell_ex_gst, sell_treatment, minimum_applied, scope").eq("allowance_item_id", used.allowanceItemId!).is("superseded_at", null).single();
      assert(name, JSON.stringify(current.data) === moneyBeforeEdit && JSON.stringify(source.data) === sourceBeforeEdit, JSON.stringify(current.data));
    }
    const sameLabel = await owner.from("pricing_items").update({ client_label: "Wall tiles" }).eq("id", used.allowanceItemId!);
    assert("saving the same client label is allowed", !sameLabel.error, sameLabel.error?.message);
    await moneySame("a no-op label save leaves the supplier money and source unchanged");
    const renamed = await owner.from("pricing_items").update({ client_label: "Wall tiles — supplier" }).eq("id", used.allowanceItemId!);
    assert("a client label can change", !renamed.error, renamed.error?.message);
    await moneySame("a label change leaves the supplier money and source unchanged");
    const lockedFields = [
      { quantity: 11 }, { unit: "m²" }, { unit_cost: 1 }, { unit_sell: 1 }, { total_cost: 1 }, { total_sell: 1 },
      { gross_profit: 1 }, { margin_percent: 1 }, { markup_percent: 1 }, { calculation_mode: "quantity_rate" },
      { item_type: "material" }, { delivery_method: "in_house" }, { visible_on_quote: false }, { optional: true },
    ];
    for (const patch of lockedFields) {
      const refused = await owner.from("pricing_items").update(patch).eq("id", used.allowanceItemId!);
      assert(`ordinary edit of ${Object.keys(patch)[0]} is refused`, Boolean(refused.error?.message.includes("SUPPLIER_PRICE_LOCKED")), refused.error?.message ?? "no error");
      await moneySame(`${Object.keys(patch)[0]} stays at the confirmed supplier figures`);
    }
    const removed = await owner.from("pricing_items").delete().eq("id", used.allowanceItemId!);
    assert("deleting the supplier allowance is refused", Boolean(removed.error?.message.includes("SUPPLIER_PRICE_LOCKED")), removed.error?.message ?? "no error");
    const noted = await owner.from("pricing_items").update({ recalibration_note: "Kept during a pricing recalculation." }).eq("id", used.allowanceItemId!);
    assert("a recalibration note can be saved", !noted.error, noted.error?.message);
    await moneySame("a recalibration note does not change the supplier money");
    const manualPrice = priced(850, { id: used.allowanceItemId!, total_cost: 850, total_sell: 1133.33 }, "manual", 1000);
    const manualUse = await apply({
      ...metreBase, target_item_id: used.allowanceItemId, quantity: 10,
      total_cost: manualPrice.choice.allowance!.totalCost, total_sell: manualPrice.choice.allowance!.totalSell,
      gross_profit: manualPrice.choice.allowance!.grossProfit, margin_percent: manualPrice.choice.allowance!.marginPercent,
      markup_percent: manualPrice.choice.allowance!.markupPercent, sell_treatment: "manual", manual_sell: 1000,
    });
    assert("a deliberate sell override is recorded on the same allowance", manualUse.ok === true && manualUse.allowanceItemId === used.allowanceItemId, JSON.stringify(manualUse));
    const override = await admin.from("subcontractor_rate_applications").select("sell_treatment, sell_ex_gst, cost_ex_gst, rate_version_id").eq("allowance_item_id", used.allowanceItemId!).is("superseded_at", null).single();
    const versionStill = await admin.from("subcontractor_rate_versions").select("cost_ex_gst").eq("id", metre.versionId).single();
    assert("the override keeps the supplier cost and the original version", override.data?.sell_treatment === "manual" && Number(override.data?.sell_ex_gst) === 1000 && Number(override.data?.cost_ex_gst) === 850 && override.data?.rate_version_id === metre.versionId && Number(versionStill.data?.cost_ex_gst) === 85, JSON.stringify(override.data));
    const reviewedForQuote = await admin.from("pricing_documents").update({ status: "reviewed", reviewed_at: new Date().toISOString() }).eq("id", pricing.data.id);
    if (reviewedForQuote.error) throw new Error(reviewedForQuote.error.message);
    const { mapPricingItem } = await import("../lib/pricing/mappers");
    const { mapPricingItemsToQuoteItems } = await import("../lib/quotes/from-pricing");
    const { calculateQuoteBaseTotalsFromItems } = await import("../lib/quotes/base-totals");
    const pricingRows = await owner.from("pricing_items").select("*").eq("pricing_document_id", pricing.data.id);
    if (pricingRows.error) throw new Error(pricingRows.error.message);
    const quoteItems = mapPricingItemsToQuoteItems((pricingRows.data ?? []).map((row) => mapPricingItem(row)), new Map([[area.data.id, "Bathroom"]]));
    const quoteTotals = calculateQuoteBaseTotalsFromItems(quoteItems, 15, "rate-use-new-quote");
    if (!quoteTotals.ok) throw new Error(quoteTotals.error);
    const supplierQuotes = quoteItems.filter((item) => Number(item.total) === Number(manualPrice.choice.sell));
    assert("the new quote snapshot contains the approved sell once", supplierQuotes.length === 1 && quoteItems.length === 1, JSON.stringify(quoteItems.map((item) => item.total)));
    const insertedQuote = await owner.rpc("insert_draft_quote_v1", {
      p_payload: {
        projectId: project.data.id,
        quote: {
          pricing_document_id: pricing.data.id, estimate_id: estimate.data.id, title: `Quote — Use ${suffix}`,
          client_name: null, site_address: null, issue_date: "2026-10-07", valid_until: "2026-11-06",
          subtotal: quoteTotals.totals.subtotal, gst_rate: 15, gst_amount: quoteTotals.totals.gstAmount,
          total_incl_gst: quoteTotals.totals.totalInclGst, scope_summary: null, inclusions: ["Bathroom"],
          exclusions: [], assumptions: [], terms: null, presentation_mode: "detailed",
        },
        items: quoteItems.map((item) => ({
          pricing_item_id: item.pricing_item_id ?? null, work_area_id: item.work_area_id ?? null,
          section_title: item.section_title ?? null, section_description: item.section_description ?? null,
          label: item.label, description: item.description ?? null, quantity: item.quantity ?? null,
          unit: item.unit ?? null, unit_price: item.unit_price ?? null, total: item.total ?? 0,
          visible: item.visible ?? true, optional: item.optional ?? false, sort_order: item.sort_order ?? 0,
        })),
      },
    });
    const newQuoteId = (insertedQuote.data as { quoteId?: string } | null)?.quoteId;
    assert("the new quote is stored", Boolean(newQuoteId), JSON.stringify(insertedQuote.data ?? insertedQuote.error));
    const newQuoteItems = await admin.from("quote_items").select("label, total, quantity, unit, unit_price, visible").eq("quote_id", newQuoteId!);
    const newQuoteFingerprint = JSON.stringify(newQuoteItems.data);
    assert("the stored quote has the approved sell once", (newQuoteItems.data ?? []).filter((item) => Number(item.total) === 1000).length === 1, newQuoteFingerprint);
    const revised = await saveRate({ rate_id: metre.rateId, scope: "Supply and install wall tiles", unit: "m2", cost_ex_gst: 90, minimum_charge: 200 });
    assert("a revised rate is version 2", revised.versionNumber === 2, JSON.stringify(revised));
    const revisedPrice = priced(900, { id: used.allowanceItemId!, total_cost: 850, total_sell: Number(metrePrice.choice.sell) }, "target_margin", null);
    const revisedUse = await apply({
      ...metreBase, rate_version_id: revised.versionId, target_item_id: used.allowanceItemId, quantity: 10,
      total_cost: revisedPrice.choice.allowance!.totalCost, total_sell: revisedPrice.choice.allowance!.totalSell,
      gross_profit: revisedPrice.choice.allowance!.grossProfit, margin_percent: revisedPrice.choice.allowance!.marginPercent,
      markup_percent: revisedPrice.choice.allowance!.markupPercent,
    });
    assert("the revised version updates the same allowance", revisedUse.ok === true && revisedUse.allowanceItemId === used.allowanceItemId, JSON.stringify(revisedUse));
    const revisedItem = await admin.from("pricing_items").select("total_cost, total_sell").eq("id", used.allowanceItemId!).single();
    assert("the revised allowance stores the new version cost", Number(revisedItem.data?.total_cost) === 900 && Number(revisedItem.data?.total_sell) === Number(revisedPrice.choice.sell), JSON.stringify(revisedItem.data));
    console.log(`LIVE_REVISED_AFTER cost ${money(revisedPrice.choice.after.cost)} sell ${money(revisedPrice.choice.after.sell)} gp ${money(revisedPrice.choice.after.grossProfit)} margin ${money(revisedPrice.choice.after.marginPercent)} gst ${money(revisedPrice.choice.after.gstAmount)} total ${money(revisedPrice.choice.after.totalInclGst)}`);
    const jobSnapshot = await admin.from("subcontractor_rate_applications").select("version_number, quantity, cost_ex_gst, unit, applied_by, scope, exclusions").eq("allowance_item_id", used.allowanceItemId!).is("superseded_at", null).single();
    assert("the job snapshot keeps version 2 after the rate book changes", jobSnapshot.data?.version_number === 2 && Number(jobSnapshot.data?.quantity) === 10 && Number(jobSnapshot.data?.cost_ex_gst) === 900 && jobSnapshot.data?.unit === "m2" && jobSnapshot.data?.applied_by === userIds[0] && jobSnapshot.data?.scope === "Supply and install wall tiles", JSON.stringify(jobSnapshot.data));
    const versionOne = await admin.from("subcontractor_rate_versions").select("cost_ex_gst").eq("id", metre.versionId).single();
    assert("version 1 is unchanged after the job uses version 2", Number(versionOne.data?.cost_ex_gst) === 85);
    const charged = await admin.from("pricing_items").select("id").eq("pricing_document_id", pricing.data.id).gt("total_cost", 0);
    assert("revision did not add a second charged item", (charged.data ?? []).length === 1);

    const missingQuantity = await apply({ ...metreBase, rate_version_id: floor.versionId, quantity: null });
    assert("missing quantity is refused", missingQuantity.error === "QUANTITY", JSON.stringify(missingQuantity));
    const hour = await addItem("Hours", "hour", 100, 200);
    const wrongUnit = await apply({ ...metreBase, target_item_id: hour.id, rate_version_id: floor.versionId, quantity: 1 });
    assert("an incompatible unit is refused", wrongUnit.error === "UNIT", JSON.stringify(wrongUnit));
    const ambiguous = await apply({ ...metreBase, target_mode: "replace", target_item_id: null });
    assert("an unnamed replacement is refused", ambiguous.error === "AMBIGUOUS", JSON.stringify(ambiguous));
    const expiredUse = await apply({ ...metreBase, rate_version_id: expired.versionId, quantity: 10 });
    assert("an expired version is refused", expiredUse.error === "EXPIRED", JSON.stringify(expiredUse));
    const retired = await owner.rpc("retire_subcontractor_rate_v1", { p_rate: floor.rateId });
    assert("floor rate retires", retired.data?.ok === true, JSON.stringify(retired.data));
    const retiredUse = await apply({ ...metreBase, rate_version_id: floor.versionId, quantity: 1 });
    assert("a retired rate is refused", retiredUse.error === "RETIRED", JSON.stringify(retiredUse));

    await clearItems();
    const lumpItem = await addItem("Bathroom allowance", "lump_sum", 400, 800);
    const lumpPreview = priced(1800, lumpItem, "keep", null);
    console.log(`LIVE_LUMP_BEFORE cost ${money(lumpPreview.preview.before.cost)} sell ${money(lumpPreview.preview.before.sell)} gp ${money(lumpPreview.preview.before.grossProfit)} margin ${money(lumpPreview.preview.before.marginPercent)} gst ${money(lumpPreview.preview.before.gstAmount)} total ${money(lumpPreview.preview.before.totalInclGst)}`);
    console.log(`LIVE_LUMP_KEEP cost ${money(lumpPreview.choice.after.cost)} sell ${money(lumpPreview.choice.after.sell)} gp ${money(lumpPreview.choice.after.grossProfit)} margin ${money(lumpPreview.choice.after.marginPercent)} gst ${money(lumpPreview.choice.after.gstAmount)} total ${money(lumpPreview.choice.after.totalInclGst)}`);
    const lumpPayload = {
      rate_version_id: lumpRate.versionId, pricing_document_id: pricing.data.id, work_area_id: area.data.id,
      target_mode: "replace", target_item_id: lumpItem.id, quantity: 4, confirm_scope: "true", confirm_quantity: "true",
      total_cost: 1800, total_sell: lumpPreview.choice.allowance!.totalSell,
      gross_profit: lumpPreview.choice.allowance!.grossProfit, margin_percent: lumpPreview.choice.allowance!.marginPercent,
      markup_percent: lumpPreview.choice.allowance!.markupPercent, sell_treatment: "keep", acknowledge_loss: "false",
    };
    const silentLoss = await apply(lumpPayload);
    assert("a loss is not kept silently", silentLoss.error === "LOSS_ACK", JSON.stringify(silentLoss));
    const lumpUsed = await apply({ ...lumpPayload, acknowledge_loss: "true" });
    assert("a lump sum is used once", lumpUsed.ok === true && Number(lumpUsed.costExGst) === 1800, JSON.stringify(lumpUsed));

    await clearItems();
    const small = await addItem("Floor tiles", "m²", 40, 80);
    const minimumPreview = priced(200, small, "target_margin", null);
    console.log(`LIVE_MINIMUM_BEFORE cost ${money(minimumPreview.preview.before.cost)} sell ${money(minimumPreview.preview.before.sell)} gp ${money(minimumPreview.preview.before.grossProfit)} margin ${money(minimumPreview.preview.before.marginPercent)} gst ${money(minimumPreview.preview.before.gstAmount)} total ${money(minimumPreview.preview.before.totalInclGst)}`);
    console.log(`LIVE_MINIMUM_AFTER cost ${money(minimumPreview.choice.after.cost)} sell ${money(minimumPreview.choice.after.sell)} gp ${money(minimumPreview.choice.after.grossProfit)} margin ${money(minimumPreview.choice.after.marginPercent)} gst ${money(minimumPreview.choice.after.gstAmount)} total ${money(minimumPreview.choice.after.totalInclGst)}`);
    const floorAgain = await saveRate({ scope: "Supply and install floor tiles", unit: "m2", cost_ex_gst: 85, minimum_charge: 200 });
    const minimumUsed = await apply({
      rate_version_id: floorAgain.versionId, pricing_document_id: pricing.data.id, work_area_id: area.data.id,
      target_mode: "replace", target_item_id: small.id, quantity: 1, confirm_scope: "true", confirm_quantity: "true",
      total_cost: minimumPreview.choice.allowance!.totalCost, total_sell: minimumPreview.choice.allowance!.totalSell,
      gross_profit: minimumPreview.choice.allowance!.grossProfit, margin_percent: minimumPreview.choice.allowance!.marginPercent,
      markup_percent: minimumPreview.choice.allowance!.markupPercent, sell_treatment: "target_margin", target_margin_percent: 25,
      acknowledge_loss: "false",
    });
    assert("minimum charge is the supplier cost", minimumUsed.ok === true && Number(minimumUsed.costExGst) === 200, JSON.stringify(minimumUsed));

    const responseAllowance = await addItem("Response allowance", "lump_sum", 500, 700);
    const conflictRate = await saveRate({ scope: "Supply and install floor tiles", unit: "m2", cost_ex_gst: 85, minimum_charge: 200 });
    const rfq = await admin.from("rfqs").insert({
      org_id: orgA, project_id: project.data.id, scope_kind: "written", status: "draft", written_scope_label: "Supply and install floor tiles",
    }).select("id").single();
    if (rfq.error) throw new Error(rfq.error.message);
    const contact = await admin.from("subcontractor_contacts").select("id").eq("subcontractor_id", business.data).limit(1).single();
    const recipient = await admin.from("rfq_recipients").insert({
      org_id: orgA, rfq_id: rfq.data.id, subcontractor_id: business.data, contact_id: contact.data!.id,
      trading_name: `Use Co ${suffix}`, contact_name: "Ada", contact_email: `ada-${suffix}@example.invalid`,
      selection_source: "manual", response_state: "responded",
    }).select("id").single();
    if (recipient.error) throw new Error(recipient.error.message);
    const sent = await admin.from("rfqs").update({ status: "sent" }).eq("id", rfq.data.id);
    if (sent.error) throw new Error(sent.error.message);
    const response = await admin.from("rfq_responses").insert({
      org_id: orgA, recipient_id: recipient.data.id, version_number: 1, price_ex_gst: 500,
      gst_treatment: "extra", pricing_structure: "lump_sum", included_scope: "Supply and install floor tiles",
      status: "submitted", submitted_at: new Date().toISOString(),
    }).select("id").single();
    if (response.error) throw new Error(response.error.message);
    const application = await admin.from("rfq_pricing_applications").insert({
      org_id: orgA, project_id: project.data.id, pricing_document_id: pricing.data.id, rfq_id: rfq.data.id,
      recipient_id: recipient.data.id, response_id: response.data.id, subcontractor_id: business.data,
      work_area_id: area.data.id, allowance_item_id: responseAllowance.id, replaced_item_ids: [small.id], before_lines: [],
      cost_ex_gst: 500, sell_ex_gst: 700, sell_known: true, currency: "NZD", gst_treatment: "extra",
      pricing_structure: "lump_sum", scope_label: "Supply and install floor tiles", included_scope: "Supply and install floor tiles",
    });
    if (application.error) throw new Error(application.error.message);
    const conflictPreview = buildRfqSellChoices({
      responseId: "conflict", priceExGst: 200, gstRate: 15, items: [{ id: "existing", totalCost: 200, totalSell: 266.67 }],
      replacedIds: [], existingAllowanceId: null, targetMarginPercent: 25, manualSell: null,
    });
    if (!conflictPreview.ok) throw new Error(conflictPreview.error);
    const conflictChoice = conflictPreview.preview.choices.find((entry) => entry.treatment === "target_margin");
    if (!conflictChoice?.allowance) throw new Error("conflict sell");
    const blocked = await apply({
      rate_version_id: conflictRate.versionId, pricing_document_id: pricing.data.id, work_area_id: area.data.id,
      target_mode: "add", quantity: 2, confirm_scope: "true", confirm_quantity: "true",
      total_cost: conflictChoice.allowance.totalCost, total_sell: conflictChoice.allowance.totalSell,
      gross_profit: conflictChoice.allowance.grossProfit, margin_percent: conflictChoice.allowance.marginPercent,
      markup_percent: conflictChoice.allowance.markupPercent, sell_treatment: "target_margin", target_margin_percent: 25,
      acknowledge_loss: "false",
    });
    assert("an RFQ covering the same scope blocks a second charge", blocked.error === "SOURCE", JSON.stringify(blocked));
    const chosen = await apply({
      rate_version_id: conflictRate.versionId, pricing_document_id: pricing.data.id, work_area_id: area.data.id,
      target_mode: "add", quantity: 2, confirm_scope: "true", confirm_quantity: "true", source_choice: "rate",
      total_cost: conflictChoice.allowance.totalCost, total_sell: conflictChoice.allowance.totalSell,
      gross_profit: conflictChoice.allowance.grossProfit, margin_percent: conflictChoice.allowance.marginPercent,
      markup_percent: conflictChoice.allowance.markupPercent, sell_treatment: "target_margin", target_margin_percent: 25,
      acknowledge_loss: "false",
    });
    assert("choosing the rate supersedes the response", chosen.ok === true, JSON.stringify(chosen));
    const responseLeft = await admin.from("pricing_items").select("total_cost, visible_on_quote").eq("id", responseAllowance.id).single();
    assert("the response allowance is no longer charged", Number(responseLeft.data?.total_cost) === 0 && responseLeft.data?.visible_on_quote === false);

    const active = await admin.from("subcontractor_rate_applications").select("id, allowance_item_id").eq("pricing_document_id", pricing.data.id).is("superseded_at", null).eq("rate_id", floorAgain.rateId).single();
    await admin.from("subcontractor_rate_applications").update({ reconciliation_status: "pending" }).eq("id", active.data!.id);
    const kept = await owner.rpc("reconcile_subcontractor_rate_v1", { p_payload: { application_id: active.data!.id, decision: "keep" } });
    assert("regeneration can keep the supplier rate", kept.data?.ok === true, JSON.stringify(kept.data));
    const stillOne = await admin.from("pricing_items").select("id").eq("id", active.data!.allowance_item_id).gt("total_cost", 0);
    assert("keeping it does not add another item", (stillOne.data ?? []).length === 1);
    await admin.from("subcontractor_rate_applications").update({ reconciliation_status: "pending" }).eq("id", active.data!.id);
    const dropped = await owner.rpc("reconcile_subcontractor_rate_v1", { p_payload: { application_id: active.data!.id, decision: "drop" } });
    assert("regeneration can remove the supplier rate", dropped.data?.decision === "drop", JSON.stringify(dropped.data));

    const viewerUse = await viewer.rpc("apply_subcontractor_rate_to_pricing_v1", { p_payload: metreBase });
    assert("a viewer cannot use a rate", viewerUse.data?.error === "FORBIDDEN");
    const inactiveUse = await inactive.rpc("apply_subcontractor_rate_to_pricing_v1", { p_payload: metreBase });
    assert("a member who is not active cannot use a rate", inactiveUse.data?.error === "FORBIDDEN", JSON.stringify(inactiveUse.data ?? inactiveUse.error));
    const foreignUse = await foreign.rpc("apply_subcontractor_rate_to_pricing_v1", { p_payload: metreBase });
    assert("another organisation cannot use the rate", foreignUse.data?.ok !== true);
    const issuedUse = await apply({ ...metreBase, pricing_document_id: issued.data.id, target_mode: "add", target_item_id: null });
    assert("an issued quote blocks the rate", issuedUse.error === "QUOTE_ISSUED", JSON.stringify(issuedUse));

    const afterEstimate = await admin.from("estimates").select("recommended_cost, recommended_sell, assumptions").eq("id", estimate.data.id).single();
    const afterLine = await admin.from("estimate_line_items").select("recommended_cost, recommended_sell").eq("id", line.data.id).single();
    const afterQuote = await admin.from("quotes").select("status, subtotal, total_incl_gst").eq("id", quote.data.id).single();
    const afterIssuedItem = await admin.from("quote_items").select("id, label, total, quantity, unit, unit_price, visible").eq("id", issuedItem.data.id).single();
    const afterSnapshot = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst, gst_amount, sell_incl_gst").eq("id", snapshot.data.id).single();
    const afterVariationItems = await admin.from("variation_items").select("client_description, quantity, unit, unit_cost, unit_sell, line_cost_adjustment, line_sell_adjustment_ex_gst").eq("variation_id", variationCreated.variationId);
    const afterVariationRevision = await admin.from("variation_revisions").select("status, total_direct_cost_adjustment, total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst").eq("id", variationCreated.revisionId).single();
    const afterNewQuoteItems = await admin.from("quote_items").select("label, total, quantity, unit, unit_price, visible").eq("quote_id", newQuoteId!);
    assert("the estimate calculation is unchanged", Number(afterEstimate.data?.recommended_cost) === 400 && Number(afterEstimate.data?.recommended_sell) === 800 && Number(afterLine.data?.recommended_cost) === 400);
    assert(
      "the issued quote is unchanged",
      afterQuote.data?.status === "sent" && Number(afterQuote.data?.subtotal) === 800 && Number(afterQuote.data?.total_incl_gst) === 920
        && afterIssuedItem.data?.label === "Original wall tiles" && Number(afterIssuedItem.data?.total) === 800
        && Number(afterIssuedItem.data?.unit_price) === 800 && Number(afterIssuedItem.data?.quantity) === 1
        && afterIssuedItem.data?.unit === "m²" && afterIssuedItem.data?.visible === true
        && afterQuote.data?.status === sentQuote.data?.status && Number(afterQuote.data?.subtotal) === Number(sentQuote.data?.subtotal)
        && Number(afterQuote.data?.total_incl_gst) === Number(sentQuote.data?.total_incl_gst),
      JSON.stringify({ before: sentQuote.data, after: afterQuote.data, item: afterIssuedItem.data })
    );
    assert("the accepted snapshot is unchanged", Number(afterSnapshot.data?.sell_ex_gst) === 800 && Number(afterSnapshot.data?.gst_amount) === 120 && Number(afterSnapshot.data?.sell_incl_gst) === 920);
    assert("the issued variation is unchanged", JSON.stringify({ items: afterVariationItems.data, revision: afterVariationRevision.data }) === variationFingerprint, JSON.stringify(afterVariationRevision.data));
    assert("the new quote still contains the approved sell once", JSON.stringify(afterNewQuoteItems.data) === newQuoteFingerprint);
    console.log("Live rate use checks finished.");
  } finally {
    await admin.from("organisations").delete().in("id", [orgA, orgB]);
    for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
  }
}

staticMain();
if (process.argv.includes("--live")) {
  liveMain().catch((error) => {
    console.error(error);
    failed += 1;
  }).finally(() => {
    if (failed > 0) process.exit(1);
  });
} else if (failed > 0) {
  process.exit(1);
}
