/**
 * RFQ phase 3 — apply a submitted response to draft pricing.
 *
 * Static: npx tsx scripts/verify-rfq-pricing-01.ts
 * Live Preview: npx tsx scripts/verify-rfq-pricing-01.ts --live
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { evaluateOrgEntitlement } from "../lib/billing/entitlements";
import { planAllowsCapability, trialAllowsCapability } from "../lib/billing/entitlement-matrix";
import { buildInternalTrialSubscription } from "../lib/billing/trial";
import type { OrgBillingState } from "../lib/billing/types";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";
import { PREVIEW_AUTH_SITE_ORIGIN_STABLE } from "../lib/auth/site-url";
import { resolveRfqPublicOrigin } from "../lib/rfqs/origin";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { buildRfqPricingPreview } from "../lib/rfqs/pricing-preview";
import { generateRfqAccessToken, hashRfqAccessToken } from "../lib/rfqs/token";
import { roleAllowsPermission } from "../lib/team/permissions";

function assert(label: string, ok: boolean, detail = "") {
  console.log(ok ? "PASS" : "FAIL", label, detail);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

function staticMain() {
  console.log("=== rfq pricing application ===");
  const sql = read("supabase/migrations/091_rfq_pricing_application.sql");
  const apply = read("lib/rfqs/pricing-apply.ts");
  const actions = read("lib/rfqs/actions.ts");
  const rates = read("lib/estimate/rates.ts");
  assert("pricing.access already exists for Builder and Business", planAllowsCapability("builder", "pricing.access") && planAllowsCapability("business", "pricing.access"));
  const now = new Date("2026-10-07T00:00:00.000Z");
  const billing = (subscription: OrgBillingState["subscription"]): OrgBillingState => ({
    orgId: "00000000-0000-4000-8000-000000000001",
    billingEnvironment: "test",
    customer: null,
    activeOverride: null,
    effectiveTrialState: null,
    subscription,
  });
  const activeTrial = buildInternalTrialSubscription({
    id: "trial-active",
    orgId: "00000000-0000-4000-8000-000000000001",
    billingEnvironment: "test",
    now,
    trialEndsAt: new Date("2026-11-01T00:00:00.000Z"),
  });
  const expiredTrial = buildInternalTrialSubscription({
    id: "trial-expired",
    orgId: "00000000-0000-4000-8000-000000000001",
    billingEnvironment: "test",
    now,
    trialEndsAt: new Date("2026-09-01T00:00:00.000Z"),
  });
  assert("active trial allows pricing.access", trialAllowsCapability("pricing.access") && evaluateOrgEntitlement({
    state: billing(activeTrial), capability: "pricing.access", mode: "strict", now,
  }).ok);
  assert("expired trial denies pricing.access", evaluateOrgEntitlement({
    state: billing(expiredTrial), capability: "pricing.access", mode: "strict", now,
  }).ok === false);
  assert("apply uses pricing.edit and pricing.access", apply.includes('permission: "pricing.edit"') && apply.includes('entitlement: "pricing.access"'));
  assert("Viewer cannot edit pricing", !roleAllowsPermission("viewer", "pricing.edit"));
  assert("no award mail", !apply.includes("getQuoteDeliveryProvider") && sql.includes("was not notified"));
  assert("public token is not granted the pricing function", sql.includes("revoke all on function public.apply_rfq_response_to_pricing_v1(jsonb) from public, anon"));
  assert("document totals use the existing pricing persist", apply.includes("persistPricingDocumentTotals"));
  assert("estimate rate resolver is untouched by this path", !apply.includes("resolveRate") && rates.includes("export function resolveRate"));
  assert("preview branch host is the RFQ link", resolveRfqPublicOrigin({
    VERCEL_ENV: "preview",
    VERCEL_BRANCH_URL: "quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app",
  }) === "https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app");
  assert("a missing branch host does not use the hardening alias", resolveRfqPublicOrigin({ VERCEL_ENV: "preview" }) === null);
  assert("localhost is not emailed", resolveRfqPublicOrigin({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }) === null);
  assert("send uses the RFQ origin helper", actions.includes("resolveRfqPublicOrigin()") && !actions.includes("resolveConfiguredSiteOrigin"));
  assert("hardening alias constant is unchanged", PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("hardening-stage-2a-security"));

  const unpriced = "00000000-0000-4000-8000-0000000000a1";
  const known = "00000000-0000-4000-8000-0000000000a2";
  const preview = buildRfqPricingPreview({
    responseId: "00000000-0000-4000-8000-0000000000aa",
    priceExGst: 1800,
    gstRate: 15,
    items: [
      { id: unpriced, totalCost: 0, totalSell: 0 },
      { id: known, totalCost: 400, totalSell: 800 },
    ],
    replacedIds: [known],
    existingAllowanceId: null,
  });
  assert("itemised replacement keeps the known sell and the subcontract cost", preview.ok && preview.preview.sellKnown && preview.preview.allowance.totalCost === 1800 && preview.preview.allowance.totalSell === 800);
  if (preview.ok) {
    console.log("EXAMPLE before", JSON.stringify(preview.preview.before));
    console.log("EXAMPLE after", JSON.stringify(preview.preview.after));
    console.log("EXAMPLE allowance", JSON.stringify({
      cost: preview.preview.allowance.totalCost,
      sell: preview.preview.allowance.totalSell,
      margin: preview.preview.allowance.marginPercent,
    }));
    assert("document cost replaces 400 with 1800 and leaves the unpriced line at zero", preview.preview.after.cost === 1800 && preview.preview.before.cost === 400);
    assert("document sell stays 800", preview.preview.after.sell === 800 && preview.preview.before.sell === 800);
  }
  const both = buildRfqPricingPreview({
    responseId: "00000000-0000-4000-8000-0000000000ab",
    priceExGst: 1800,
    gstRate: 15,
    items: [
      { id: unpriced, totalCost: 0, totalSell: 0 },
      { id: known, totalCost: 400, totalSell: 800 },
    ],
    replacedIds: [unpriced, known],
    existingAllowanceId: null,
  });
  assert("an unpriced line keeps the subcontract sell unknown", both.ok && both.preview.sellKnown === false && both.preview.allowance.totalSell === 0);
}

async function liveMain() {
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = local.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !service) {
    assert("Preview env present", false);
    return;
  }
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  assert("live target is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF || ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = randomUUID().slice(0, 8);
  const password = `rfq-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectId = randomUUID();
  const userIds: string[] = [];

  async function userFor(role: "owner" | "viewer", orgId: string) {
    const email = `price-${role}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    userIds.push(created.data.user.id);
    const profile = await admin.from("profiles").upsert({
      id: created.data.user.id, org_id: orgId, role, full_name: `Price ${role}`,
    });
    if (profile.error) throw new Error(profile.error.message);
    const membership = await admin.from("organisation_memberships").insert({
      org_id: orgId, user_id: created.data.user.id, role, status: "active", joined_at: new Date().toISOString(),
    });
    if (membership.error) throw new Error(membership.error.message);
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error(signed.error.message);
    return client;
  }

  try {
    for (const org of [
      { id: orgA, name: `Price A ${suffix}` },
      { id: orgB, name: `Price B ${suffix}` },
    ]) {
      const inserted = await admin.from("organisations").insert(org);
      if (inserted.error) throw new Error(inserted.error.message);
    }
    const owner = await userFor("owner", orgA);
    const viewer = await userFor("viewer", orgA);
    const foreign = await userFor("owner", orgB);
    const project = await admin.from("projects").insert({
      id: projectId, org_id: orgA, created_by: userIds[0], title: `Pricing ${suffix}`,
      stage: "estimate_ready", business_status: "estimate_ready",
    });
    if (project.error) throw new Error(project.error.message);
    const area = await admin.from("work_areas").insert({
      org_id: orgA, project_id: projectId, type: "bathroom", name: "Bathroom", status: "confirmed", sort_order: 1,
    }).select("id").single();
    if (area.error) throw new Error(area.error.message);
    const business = await owner.rpc("save_subcontractor_v1", {
      p_payload: {
        trading_name: `Tile Co ${suffix}`,
        work_area_types: ["bathroom"],
        contacts: [{ name: "Ada", email: `ada-${suffix}@example.invalid`, is_primary: true }],
      },
    });
    if (typeof business.data !== "string") throw new Error(business.error?.message ?? "business");
    const contact = await admin.from("subcontractor_contacts").select("id").eq("subcontractor_id", business.data).single();
    if (contact.error) throw new Error(contact.error.message);
    const estimate = await admin.from("estimates").insert({
      org_id: orgA, project_id: projectId, status: "ready", recommended_cost: 400, recommended_sell: 800,
    }).select("id, recommended_cost, recommended_sell").single();
    if (estimate.error) throw new Error(estimate.error.message);
    const estimateLine = await admin.from("estimate_line_items").insert({
      org_id: orgA, project_id: projectId, estimate_id: estimate.data.id, work_area_id: area.data.id,
      work_area_name: "Bathroom", label: "Tiling", category: "subcontractor", recommended_cost: 400, recommended_sell: 800,
    }).select("id, recommended_cost, recommended_sell").single();
    if (estimateLine.error) throw new Error(estimateLine.error.message);
    const document = await owner.from("pricing_documents").insert({
      org_id: orgA, project_id: projectId, title: "Job pricing", status: "reviewed",
      reviewed_at: new Date().toISOString(), gst_rate: 15,
      subtotal_cost: 400, subtotal_sell: 800, gross_profit: 400, margin_percent: 50, markup_percent: 100,
      gst_amount: 120, total_incl_gst: 920,
    }).select("id").single();
    if (document.error) throw new Error(document.error.message);
    const items = await owner.from("pricing_items").insert([
      {
        org_id: orgA, pricing_document_id: document.data.id, project_id: projectId, work_area_id: area.data.id,
        item_type: "subcontractor", delivery_method: "subcontracted", internal_label: "Wall tiling", client_label: "Wall tiling",
        quantity: 1, total_cost: 0, total_sell: 0, gross_profit: 0, margin_percent: 0, markup_percent: 0, sort_order: 1,
        notes_internal: "Cost unknown\n__quotr_meta__:{\"rateSourceType\":\"missing\"}",
      },
      {
        org_id: orgA, pricing_document_id: document.data.id, project_id: projectId, work_area_id: area.data.id,
        item_type: "allowance", delivery_method: "allowance", internal_label: "Known allowance", client_label: "Known allowance",
        quantity: 1, unit_cost: 400, unit_sell: 800, total_cost: 400, total_sell: 800,
        gross_profit: 400, margin_percent: 50, markup_percent: 100, sort_order: 2,
      },
    ]).select("id, client_label, total_cost, total_sell");
    if (items.error || !items.data) throw new Error(items.error?.message ?? "items");
    const unpriced = items.data.find((row) => row.client_label === "Wall tiling");
    const known = items.data.find((row) => row.client_label === "Known allowance");
    if (!unpriced || !known) throw new Error("lines");
    const quote = await admin.from("quotes").insert({
      org_id: orgA, project_id: projectId, pricing_document_id: document.data.id, title: "Issued quote",
      status: "draft", subtotal: 800, gst_rate: 15, gst_amount: 120, total_incl_gst: 920,
      snapshot_fingerprint: `fp-${suffix}`, snapshot_fingerprint_version: "v1",
    }).select("id").single();
    if (quote.error) throw new Error(quote.error.message);
    const quoteItem = await admin.from("quote_items").insert({
      org_id: orgA, quote_id: quote.data.id, project_id: projectId, pricing_item_id: known.id,
      work_area_id: area.data.id, label: "Known allowance", quantity: 1, unit_price: 800, total: 800,
    }).select("id, label, total").single();
    if (quoteItem.error) throw new Error(quoteItem.error.message);
    const issued = await admin.from("quotes").update({
      status: "sent", sent_at: new Date().toISOString(),
    }).eq("id", quote.data.id).select("id, status, subtotal, gst_amount, total_incl_gst, snapshot_fingerprint, snapshot_fingerprint_version").single();
    if (issued.error) throw new Error(issued.error.message);
    quote.data = issued.data;
    const snapshot = await admin.from("accepted_commercial_snapshots").insert({
      org_id: orgA, project_id: projectId, quote_id: quote.data.id, revision_number: 1, currency: "NZD",
      gst_rate: 15, tax_treatment: "gst", sell_ex_gst: 800, gst_amount: 120, sell_incl_gst: 920,
      accepted_at: new Date().toISOString(), acceptance_source: "manual",
    }).select("id, sell_ex_gst, gst_amount, sell_incl_gst, quote_id").single();
    if (snapshot.error) throw new Error(snapshot.error.message);
    const variationsBefore = await admin.from("variations").select("id", { count: "exact", head: true }).eq("project_id", projectId);

    const draft = await owner.rpc("save_rfq_draft_v1", {
      p_payload: {
        project_id: projectId, scope_kind: "work_area", work_area_id: area.data.id,
        requested_scope: "Tile the walls", recipients: [{
          subcontractor_id: business.data, contact_id: contact.data.id, selection_source: "suggested",
        }],
        document_version_ids: [],
      },
    });
    const rfqId = (draft.data as { id?: string } | null)?.id;
    if (!rfqId) throw new Error(draft.error?.message ?? "draft");
    const recipient = await admin.from("rfq_recipients").select("id").eq("rfq_id", rfqId).single();
    if (recipient.error) throw new Error(recipient.error.message);
    const raw = generateRfqAccessToken();
    const sent = await owner.rpc("send_rfq_v1", {
      p_rfq: rfqId, p_tokens: [{ recipient_id: recipient.data.id, token_hash: hashRfqAccessToken(raw) }],
    });
    if ((sent.data as { ok?: boolean } | null)?.ok !== true) throw new Error(JSON.stringify(sent.data ?? sent.error));

    async function respond(price: number, structure: "lump_sum" | "itemised", validUntil: string | null, revise: boolean) {
      const saved = await anon.rpc("public_rfq_save_response_v1", {
        p_token_hash: hashRfqAccessToken(raw),
        p_confirm: true,
        p_revise: revise,
        p_payload: {
          price_ex_gst: price,
          gst_treatment: "extra",
          pricing_structure: structure,
          included_scope: structure === "itemised" ? "Walls\nFloors" : "",
          excluded_scope: structure === "itemised" ? "Ceiling" : "",
          assumptions: "Access during work hours",
          valid_until: validUntil,
        },
      });
      const body = saved.data as { ok?: boolean; id?: string; error?: string } | null;
      if (body?.ok !== true) throw new Error(JSON.stringify(saved.data ?? saved.error));
      const row = await admin.from("rfq_responses").select("id, version_number, price_ex_gst").eq("recipient_id", recipient.data.id).eq("status", "submitted").order("version_number", { ascending: false }).limit(1).single();
      if (row.error) throw new Error(row.error.message);
      return row.data;
    }

    const first = await respond(1800, "itemised", "2026-12-01", false);
    const quoteBefore = JSON.stringify(quote.data);
    const quoteItemBefore = JSON.stringify(quoteItem.data);
    const snapshotBefore = JSON.stringify(snapshot.data);
    const estimateBefore = JSON.stringify(estimate.data);
    const estimateLineBefore = JSON.stringify(estimateLine.data);

    const forced = await owner.rpc("apply_rfq_response_to_pricing_v1", {
      p_payload: {
        response_id: first.id,
        pricing_document_id: document.data.id,
        work_area_id: area.data.id,
        replaced_item_ids: [known.id],
        total_cost: 1800,
        total_sell: 800,
        force_fail: "true",
      },
    });
    assert("failed transaction returns an error", Boolean(forced.error), forced.error?.message ?? "");
    const afterFail = await admin.from("pricing_items").select("id, total_cost, total_sell").eq("id", known.id).single();
    const appsAfterFail = await admin.from("rfq_pricing_applications").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    assert("failed transaction leaves the known line unchanged", Number(afterFail.data?.total_cost) === 400 && Number(afterFail.data?.total_sell) === 800);
    assert("failed transaction writes no provenance", (appsAfterFail.count ?? 0) === 0);

    const applied = await owner.rpc("apply_rfq_response_to_pricing_v1", {
      p_payload: {
        response_id: first.id,
        pricing_document_id: document.data.id,
        work_area_id: area.data.id,
        replaced_item_ids: [known.id],
        total_cost: 1800,
        total_sell: 800,
        gross_profit: -1000,
        margin_percent: -125,
        markup_percent: -55.56,
      },
    });
    const appliedBody = applied.data as { ok?: boolean; alreadyApplied?: boolean; sellKnown?: boolean; costExGst?: number } | null;
    assert("itemised response applies once", applied.error == null && appliedBody?.ok === true && appliedBody.alreadyApplied !== true, JSON.stringify(applied.data ?? applied.error));
    const lines = await admin.from("pricing_items").select("id, client_label, total_cost, total_sell, item_type").eq("pricing_document_id", document.data.id);
    const allowance = (lines.data ?? []).find((row) => String(row.client_label).startsWith("Subcontract —"));
    const unpricedAfter = (lines.data ?? []).find((row) => row.id === unpriced.id);
    const knownAfter = (lines.data ?? []).find((row) => row.id === known.id);
    assert("one subcontract line carries 1800 ex GST and the known sell", Boolean(allowance) && Number(allowance?.total_cost) === 1800 && Number(allowance?.total_sell) === 800);
    assert("the unpriced line is not given the subcontract cost", Number(unpricedAfter?.total_cost) === 0 && Number(unpricedAfter?.total_sell) === 0);
    assert("the replaced line no longer adds its old cost", Number(knownAfter?.total_cost) === 0 && Number(knownAfter?.total_sell) === 0);
    const provenance = await admin.from("rfq_pricing_applications").select("cost_ex_gst, currency, gst_treatment, included_scope, excluded_scope, response_id, subcontractor_id").eq("response_id", first.id).single();
    assert("provenance stores the response, cost, currency, GST treatment, and scope", provenance.data?.currency === "NZD" && Number(provenance.data?.cost_ex_gst) === 1800 && provenance.data?.gst_treatment === "extra" && String(provenance.data?.included_scope).includes("Walls") && provenance.data?.subcontractor_id === business.data);
    const docAfter = await admin.from("pricing_documents").select("status, reviewed_at").eq("id", document.data.id).single();
    assert("reviewed pricing returns to draft", docAfter.data?.status === "draft" && docAfter.data?.reviewed_at == null);
    const persistedLines = await admin.from("pricing_items").select("total_cost, total_sell").eq("pricing_document_id", document.data.id);
    const persistedTotals = calculateAuthoritativeDocumentTotals(
      (persistedLines.data ?? []).map((row) => ({ total_cost: Number(row.total_cost), total_sell: Number(row.total_sell), visible: true })),
      15,
      "rfq-live-totals"
    );
    assert("saved lines reconcile through the pricing document totals", persistedTotals.ok && persistedTotals.totals.subtotalCost === 1800 && persistedTotals.totals.subtotalSell === 800 && persistedTotals.totals.gstAmount === 120 && persistedTotals.totals.totalInclGst === 920);

    const again = await owner.rpc("apply_rfq_response_to_pricing_v1", {
      p_payload: {
        response_id: first.id,
        pricing_document_id: document.data.id,
        work_area_id: area.data.id,
        replaced_item_ids: [known.id],
        total_cost: 1800,
        total_sell: 800,
      },
    });
    const againBody = again.data as { ok?: boolean; alreadyApplied?: boolean } | null;
    const allowanceCount = (lines.data ?? []).filter((row) => String(row.client_label).startsWith("Subcontract")).length;
    const linesAgain = await admin.from("pricing_items").select("id").eq("pricing_document_id", document.data.id).like("client_label", "Subcontract%");
    assert("applying the same response does not add a second cost", againBody?.alreadyApplied === true && (linesAgain.data ?? []).length === allowanceCount);

    const revised = await respond(2100, "itemised", "2026-12-15", true);
    const replacedIds = [known.id];
    const revisedApply = await owner.rpc("apply_rfq_response_to_pricing_v1", {
      p_payload: {
        response_id: revised.id,
        pricing_document_id: document.data.id,
        work_area_id: area.data.id,
        replaced_item_ids: replacedIds,
        total_cost: 2100,
        total_sell: 800,
      },
    });
    const revisedBody = revisedApply.data as { ok?: boolean; costExGst?: number } | null;
    const allowanceNow = await admin.from("pricing_items").select("total_cost").eq("pricing_document_id", document.data.id).like("client_label", "Subcontract%");
    const activeApps = await admin.from("rfq_pricing_applications").select("id, response_id, superseded_at").eq("pricing_document_id", document.data.id);
    const liveApps = (activeApps.data ?? []).filter((row) => row.superseded_at == null);
    assert("a newer response replaces the applied cost instead of adding it", revisedApply.error == null && revisedBody?.ok === true && (allowanceNow.data ?? []).length === 1 && Number(allowanceNow.data?.[0]?.total_cost) === 2100 && liveApps.length === 1 && liveApps[0]?.response_id === revised.id, JSON.stringify(revisedApply.data ?? revisedApply.error));

    const expired = await respond(900, "lump_sum", "2020-01-01", true);
    const expiredApply = await owner.rpc("apply_rfq_response_to_pricing_v1", {
      p_payload: {
        response_id: expired.id, pricing_document_id: document.data.id, work_area_id: area.data.id,
        replaced_item_ids: replacedIds, total_cost: 900, total_sell: 800,
      },
    });
    const expiredBody = expiredApply.data as { ok?: boolean; error?: string } | null;
    const costAfterExpired = await admin.from("pricing_items").select("total_cost").eq("pricing_document_id", document.data.id).like("client_label", "Subcontract%").single();
    assert("an expired response is not applied", expiredBody?.ok !== true && expiredBody?.error === "EXPIRED" && Number(costAfterExpired.data?.total_cost) === 2100, JSON.stringify(expiredApply.data ?? expiredApply.error));

    const revoked = await owner.rpc("revoke_rfq_recipient_v1", { p_recipient: recipient.data.id });
    if ((revoked.data as { ok?: boolean } | null)?.ok !== true) throw new Error(JSON.stringify(revoked.data ?? revoked.error));
    const revokedApply = await owner.rpc("apply_rfq_response_to_pricing_v1", {
      p_payload: {
        response_id: revised.id, pricing_document_id: document.data.id, work_area_id: area.data.id,
        replaced_item_ids: replacedIds, total_cost: 2100, total_sell: 800,
      },
    });
    assert("a revoked response cannot be applied again", (revokedApply.data as { error?: string } | null)?.error === "REVOKED");

    const viewerApply = await viewer.rpc("apply_rfq_response_to_pricing_v1", {
      p_payload: {
        response_id: revised.id, pricing_document_id: document.data.id, work_area_id: area.data.id,
        replaced_item_ids: replacedIds, total_cost: 2100, total_sell: 800,
      },
    });
    assert("Viewer cannot apply", (viewerApply.data as { error?: string } | null)?.error === "FORBIDDEN");
    const foreignApply = await foreign.rpc("apply_rfq_response_to_pricing_v1", {
      p_payload: {
        response_id: revised.id, pricing_document_id: document.data.id, work_area_id: area.data.id,
        replaced_item_ids: replacedIds, total_cost: 2100, total_sell: 800,
      },
    });
    assert("another organisation cannot apply", (foreignApply.data as { ok?: boolean } | null)?.ok !== true);
    const anonApply = await anon.rpc("apply_rfq_response_to_pricing_v1", { p_payload: { response_id: revised.id } });
    assert("the public client cannot apply pricing", Boolean(anonApply.error) || (anonApply.data as { ok?: boolean } | null)?.ok !== true);

    const quoteAfter = await admin.from("quotes").select("id, status, subtotal, gst_amount, total_incl_gst, snapshot_fingerprint, snapshot_fingerprint_version").eq("id", quote.data.id).single();
    const quoteItemAfter = await admin.from("quote_items").select("id, label, total").eq("id", quoteItem.data.id).single();
    const snapshotAfter = await admin.from("accepted_commercial_snapshots").select("id, sell_ex_gst, gst_amount, sell_incl_gst, quote_id").eq("id", snapshot.data.id).single();
    const estimateAfter = await admin.from("estimates").select("id, recommended_cost, recommended_sell").eq("id", estimate.data.id).single();
    const estimateLineAfter = await admin.from("estimate_line_items").select("id, recommended_cost, recommended_sell").eq("id", estimateLine.data.id).single();
    const variationsAfter = await admin.from("variations").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    assert("issued quote is unchanged", JSON.stringify(quoteAfter.data) === quoteBefore);
    assert("quote line is unchanged", JSON.stringify(quoteItemAfter.data) === quoteItemBefore);
    assert("accepted snapshot is unchanged", JSON.stringify(snapshotAfter.data) === snapshotBefore);
    assert("estimate is unchanged", JSON.stringify(estimateAfter.data) === estimateBefore && JSON.stringify(estimateLineAfter.data) === estimateLineBefore);
    assert("no variation was created", (variationsBefore.count ?? 0) === (variationsAfter.count ?? 0));
    void (owner as SupabaseClient);
  } finally {
    await admin.from("rfq_pricing_applications").delete().eq("project_id", projectId);
    await admin.from("rfqs").delete().eq("project_id", projectId);
    await admin.from("accepted_commercial_snapshots").delete().eq("project_id", projectId);
    await admin.from("quotes").delete().eq("project_id", projectId);
    await admin.from("pricing_documents").delete().eq("project_id", projectId);
    await admin.from("estimates").delete().eq("project_id", projectId);
    await admin.from("projects").delete().eq("id", projectId);
    for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    await admin.from("organisations").delete().eq("id", orgA);
    await admin.from("organisations").delete().eq("id", orgB);
  }
}

if (process.argv.includes("--live")) {
  liveMain().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  staticMain();
}
