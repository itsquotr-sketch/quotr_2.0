/**
 * Subcontractor rate book: versioned rates, response source trail, and
 * job suggestions that do not write Estimate or Pricing.
 * Run: npx tsx scripts/verify-subcontractor-rates-01.ts
 *      npx tsx scripts/verify-subcontractor-rates-01.ts --live
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  draftRateFromRfqResponse,
  previewRateCost,
  suggestRatesForWorkArea,
  type StoredRateVersion,
} from "../lib/subcontractors/rate-book";
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

function rate(overrides: Partial<StoredRateVersion>): StoredRateVersion {
  return {
    rateId: "r1",
    versionId: "v1",
    versionNumber: 1,
    subcontractorId: "s1",
    tradingName: "North Tiling",
    subcontractorArchived: false,
    retired: false,
    workAreaType: "bathroom",
    scope: "Supply and install wall tiles",
    unit: "m2",
    costExGst: 85,
    currency: "NZD",
    minimumCharge: null,
    quantityBandMin: null,
    quantityBandMax: null,
    inclusions: "Tiles",
    exclusions: "Waterproofing",
    effectiveFrom: "2026-10-01",
    effectiveUntil: null,
    source: "builder",
    originResponseId: null,
    informingResponseId: null,
    sourceAmountExGst: null,
    lastConfirmedOn: "2026-10-01",
    internalNotes: "",
    ...overrides,
  };
}

function staticMain() {
  console.log("=== subcontractor rate book ===");
  const sql = read("supabase/migrations/093_subcontractor_rate_book.sql");
  const book = read("lib/subcontractors/rate-book.ts");
  const actions = read("lib/subcontractors/rate-actions.ts");
  const resolver = read("lib/estimate/rates.ts");
  const profile = read("components/subcontractors/SubcontractorProfile.tsx");
  const suggestions = read("components/projects/JobRateSuggestions.tsx");
  const saveUi = read("components/rfqs/SaveResponseAsRate.tsx");
  assert("no Preview ref", !sql.includes(PREVIEW_SUPABASE_PROJECT_REF));
  assert("no Production ref", !sql.includes(PRODUCTION_SUPABASE_PROJECT_REF));
  assert("versioned tables", sql.includes("subcontractor_rates") && sql.includes("subcontractor_rate_versions"));
  assert("versions cannot be updated", sql.includes("SUBCONTRACTOR_RATE_VERSION_IMMUTABLE"));
  assert("no estimate or pricing writes", !/update public\.(estimates|pricing_|quotes|accepted_commercial)/i.test(sql));
  assert("resolver is unchanged", !resolver.includes("subcontractor_rate"));
  assert("actions do not call the resolver", !actions.includes("resolveRate") && !book.includes("resolveRate"));
  assert("schedule upload is not parsed", profile.includes("not read or turned into a rate") && !actions.includes("storage.from"));
  assert("job preview does not save", suggestions.includes("not applied to the Estimate or to Pricing") && !suggestions.includes("updatePricingItem"));
  assert("response save requires confirmation", saveUi.includes("Save as reusable rate") && saveUi.includes("I confirm this scope."));

  const lump = draftRateFromRfqResponse({
    priceExGst: 1800,
    pricingStructure: "lump_sum",
    includedScope: "Tiles",
    excludedScope: "Waterproofing",
    validUntil: "2026-12-01",
    workAreaType: "bathroom",
  });
  assert("lump sum stays a lump sum", lump.unit === "lump_sum" && lump.unitLocked);
  assert("scope is not invented", lump.scope === "" && lump.effectiveFrom === "");
  assert("amount and validity are offered for confirmation", lump.costExGst === 1800 && lump.suggestedEffectiveUntil === "2026-12-01");
  const itemised = draftRateFromRfqResponse({
    priceExGst: 1800, pricingStructure: "itemised", includedScope: null, excludedScope: null, validUntil: null, workAreaType: null,
  });
  assert("itemised total does not become per square metre", itemised.unit === null && !itemised.unitLocked);

  const today = "2026-10-07";
  const job = { workAreaType: "bathroom", specification: "Supply and install wall tiles", quantityUnit: "m2", quantity: 10 };
  const matched = suggestRatesForWorkArea([rate({})], job, today);
  assert("matching rate is applicable", matched[0]?.fit === "applicable");
  const mismatch = suggestRatesForWorkArea([rate({})], { ...job, quantityUnit: "hour" }, today);
  assert("unit mismatch is reference only", mismatch[0]?.fit === "reference" && mismatch[0]?.reasons.some((reason) => reason.includes("does not match")));
  const expired = suggestRatesForWorkArea([rate({ effectiveUntil: "2026-10-01" })], job, today);
  assert("expired rate is omitted", expired.length === 0);
  const archived = suggestRatesForWorkArea([rate({ subcontractorArchived: true })], job, today);
  assert("archived business is omitted", archived.length === 0);
  const mixed = suggestRatesForWorkArea([rate({ workAreaType: "kitchen" })], job, today);
  assert("another work area is omitted", mixed.length === 0);
  const overlap = suggestRatesForWorkArea([
    rate({ rateId: "a", effectiveUntil: "2026-12-31" }),
    rate({ rateId: "b", versionId: "v2", effectiveUntil: "2026-11-30" }),
  ], job, today);
  assert("overlapping dates are flagged", overlap.every((item) => item.overlaps));
  const preview = previewRateCost({ unit: "m2", costExGst: 85, minimumCharge: 200, quantity: 10, jobUnit: "m2" });
  assert("preview extends a matching unit", preview.amountExGst === 850);
  const lumpPreview = previewRateCost({ unit: "lump_sum", costExGst: 1800, minimumCharge: null, quantity: 10, jobUnit: null });
  assert("lump sum is not multiplied", lumpPreview.amountExGst === 1800);
  const wrong = previewRateCost({ unit: "m2", costExGst: 85, minimumCharge: null, quantity: 10, jobUnit: "item" });
  assert("mismatched preview has no total", wrong.amountExGst === null && wrong.statement.includes("Estimate and Pricing are unchanged"));
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
  const password = `Rate-Book-${suffix}-Aa1`;
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const userIds: string[] = [];
  async function boundUser(role: "owner" | "viewer", orgId: string) {
    const email = `rate-${role}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
    const created = await createUser(admin, email, password);
    userIds.push(created.id);
    const profile = await admin.from("profiles").upsert({
      id: created.id, org_id: orgId, role, full_name: `Rate ${role}`,
    });
    if (profile.error) throw new Error(profile.error.message);
    const membership = await admin.from("organisation_memberships").insert({
      org_id: orgId, user_id: created.id, role, status: "active", joined_at: new Date().toISOString(),
    });
    if (membership.error) throw new Error(membership.error.message);
    return created.client;
  }
  try {
    for (const org of [
      { id: orgA, name: `Rate Org ${suffix}` },
      { id: orgB, name: `Other Org ${suffix}` },
    ]) {
      const inserted = await admin.from("organisations").insert(org);
      if (inserted.error) throw new Error(inserted.error.message);
    }
    const owner = await boundUser("owner", orgA);
    const viewer = await boundUser("viewer", orgA);
    const foreign = await boundUser("owner", orgB);

    const project = await admin.from("projects").insert({
      org_id: orgA, created_by: userIds[0], title: `Rate ${suffix}`, stage: "estimate_ready", business_status: "estimate_ready",
    }).select("id").single();
    if (project.error) throw new Error(project.error.message);
    const area = await admin.from("work_areas").insert({
      org_id: orgA, project_id: project.data.id, type: "bathroom", name: "Bathroom", summary: "Supply and install wall tiles", status: "confirmed", sort_order: 1,
    }).select("id").single();
    if (area.error) throw new Error(area.error.message);
    const estimate = await admin.from("estimates").insert({
      org_id: orgA, project_id: project.data.id, status: "ready", recommended_cost: 400, recommended_sell: 800,
      target_margin_percent: 25, assumptions: ["untouched"],
    }).select("id, recommended_cost, recommended_sell, assumptions").single();
    if (estimate.error) throw new Error(estimate.error.message);
    const pricing = await admin.from("pricing_documents").insert({
      org_id: orgA, project_id: project.data.id, estimate_id: estimate.data.id, title: "Untouched pricing", status: "reviewed", subtotal_sell: 800,
    }).select("id, title, subtotal_sell, status").single();
    if (pricing.error) throw new Error(pricing.error.message);
    const quote = await admin.from("quotes").insert({
      org_id: orgA, project_id: project.data.id, pricing_document_id: pricing.data.id, estimate_id: estimate.data.id,
      title: "Issued quote", status: "sent", subtotal: 800, total_incl_gst: 920, sent_at: new Date().toISOString(),
    }).select("id, status, subtotal, total_incl_gst").single();
    if (quote.error) throw new Error(quote.error.message);
    const snapshot = await admin.from("accepted_commercial_snapshots").insert({
      org_id: orgA, project_id: project.data.id, quote_id: quote.data.id, revision_number: 1, currency: "NZD",
      gst_rate: 15, tax_treatment: "standard", sell_ex_gst: 800, gst_amount: 120, sell_incl_gst: 920,
      accepted_at: new Date().toISOString(), acceptance_source: "manual",
    }).select("id, sell_ex_gst, sell_incl_gst").single();
    if (snapshot.error) throw new Error(snapshot.error.message);

    const business = await owner.rpc("save_subcontractor_v1", {
      p_payload: {
        trading_name: `Rate Co ${suffix}`,
        work_area_types: ["bathroom", "kitchen"],
        contacts: [{ name: "Ada", email: `ada-${suffix}@example.invalid`, is_primary: true }],
      },
    });
    if (typeof business.data !== "string") throw new Error(business.error?.message ?? "business");
    const contact = await admin.from("subcontractor_contacts").select("id").eq("subcontractor_id", business.data).single();
    if (!contact.data) throw new Error("contact");
    const rfq = await admin.from("rfqs").insert({
      org_id: orgA, project_id: project.data.id, scope_kind: "work_area", status: "draft",
      work_area_id: area.data.id, work_area_type: "bathroom", work_area_name: "Bathroom",
    }).select("id").single();
    if (rfq.error) throw new Error(rfq.error.message);
    const recipient = await admin.from("rfq_recipients").insert({
      org_id: orgA, rfq_id: rfq.data.id, subcontractor_id: business.data, contact_id: contact.data.id,
      trading_name: `Rate Co ${suffix}`, contact_name: "Ada", contact_email: `ada-${suffix}@example.invalid`,
      selection_source: "manual", response_state: "responded",
    }).select("id").single();
    if (recipient.error) throw new Error(recipient.error.message);
    const sent = await admin.from("rfqs").update({ status: "sent" }).eq("id", rfq.data.id);
    if (sent.error) throw new Error(sent.error.message);
    const first = await admin.from("rfq_responses").insert({
      org_id: orgA, recipient_id: recipient.data.id, version_number: 1, price_ex_gst: 1800,
      gst_treatment: "extra", pricing_structure: "lump_sum", included_scope: "Tiles", excluded_scope: "Waterproofing",
      valid_until: "2026-12-01", status: "submitted", submitted_at: new Date().toISOString(),
    }).select("id").single();
    if (first.error) throw new Error(first.error.message);
    const revised = await admin.from("rfq_responses").insert({
      org_id: orgA, recipient_id: recipient.data.id, version_number: 2, price_ex_gst: 2100,
      gst_treatment: "extra", pricing_structure: "lump_sum", status: "submitted", submitted_at: new Date().toISOString(),
    }).select("id").single();
    if (revised.error) throw new Error(revised.error.message);

    const base = {
      scope: "Supply and install wall tiles", unit: "lump_sum", cost_ex_gst: 1800, currency: "NZD",
      inclusions: "Tiles", exclusions: "Waterproofing", effective_from: "2026-10-01", effective_until: "2026-12-01",
      source: "rfq_response", response_id: first.data.id, confirm_scope: "true", confirm_unit: "true", confirm_amount: "true", confirm_validity: "true",
    };
    const saved = await owner.rpc("save_subcontractor_rate_v1", { p_payload: { subcontractor_id: business.data, work_area_type: "bathroom", ...base } });
    assert("owner saves a confirmed rate", saved.data?.ok === true, JSON.stringify(saved.data ?? saved.error));
    const perMetre = await owner.rpc("save_subcontractor_rate_v1", {
      p_payload: { subcontractor_id: business.data, work_area_type: "bathroom", ...base, unit: "m2" },
    });
    assert("lump sum cannot become per square metre", perMetre.data?.error === "LUMP_SUM_UNIT");
    const unconfirmed = await owner.rpc("save_subcontractor_rate_v1", {
      p_payload: { subcontractor_id: business.data, work_area_type: "bathroom", ...base, confirm_scope: "false" },
    });
    assert("unconfirmed facts are refused", unconfirmed.data?.error === "CONFIRM");
    const edited = await owner.rpc("save_subcontractor_rate_v1", {
      p_payload: {
        rate_id: saved.data.rateId, work_area_type: "bathroom", ...base, source: "builder", response_id: null,
        cost_ex_gst: 1900, confirm_scope: "true",
      },
    });
    assert("an edit creates version 2", edited.data?.versionNumber === 2, JSON.stringify(edited.data ?? edited.error));
    const informed = await owner.rpc("save_subcontractor_rate_v1", {
      p_payload: { rate_id: saved.data.rateId, work_area_type: "bathroom", ...base, response_id: revised.data.id, cost_ex_gst: 2100 },
    });
    assert("revised response creates version 3", informed.data?.versionNumber === 3);
    const versions = await admin.from("subcontractor_rate_versions").select("version_number, cost_ex_gst, source_amount_ex_gst, origin_response_id, informing_response_id").eq("rate_id", saved.data.rateId).order("version_number");
    const rows = versions.data ?? [];
    assert("origin amount stays on every version", rows.length === 3 && rows.every((row) => Number(row.source_amount_ex_gst) === 1800 && row.origin_response_id === first.data.id));
    assert("version 1 is unchanged", Number(rows[0]?.cost_ex_gst) === 1800);
    assert("version 3 records the revised response", rows[2]?.informing_response_id === revised.data.id && Number(rows[2]?.cost_ex_gst) === 2100);
    const mutated = await owner.from("subcontractor_rate_versions").update({ cost_ex_gst: 1 }).eq("rate_id", saved.data.rateId);
    assert("direct version edits are denied", Boolean(mutated.error));

    const overlap = await owner.rpc("save_subcontractor_rate_v1", {
      p_payload: { subcontractor_id: business.data, work_area_type: "bathroom", ...base, source: "builder", response_id: null, effective_until: "2026-11-01" },
    });
    assert("overlapping validity is allowed", overlap.data?.ok === true, JSON.stringify(overlap.data ?? overlap.error));
    const viewerDenied = await viewer.rpc("save_subcontractor_rate_v1", {
      p_payload: { subcontractor_id: business.data, work_area_type: "bathroom", ...base, source: "builder", response_id: null },
    });
    assert("viewer cannot save", viewerDenied.data?.error === "FORBIDDEN");
    const viewerRead = await viewer.from("subcontractor_rates").select("id").eq("id", saved.data.rateId);
    assert("viewer can read", (viewerRead.data ?? []).length === 1);
    const foreignRead = await foreign.from("subcontractor_rate_versions").select("id").eq("rate_id", saved.data.rateId);
    assert("another organisation cannot read", (foreignRead.data ?? []).length === 0);
    const foreignWrite = await foreign.rpc("retire_subcontractor_rate_v1", { p_rate_id: saved.data.rateId });
    assert("another organisation cannot retire", foreignWrite.data?.ok !== true);

    const afterEstimate = await admin.from("estimates").select("recommended_cost, recommended_sell, assumptions").eq("id", estimate.data.id).single();
    const afterPricing = await admin.from("pricing_documents").select("title, subtotal_sell, status").eq("id", pricing.data.id).single();
    const afterQuote = await admin.from("quotes").select("status, subtotal, total_incl_gst").eq("id", quote.data.id).single();
    const afterSnapshot = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst, sell_incl_gst").eq("id", snapshot.data.id).single();
    assert("estimate is unchanged", Number(afterEstimate.data?.recommended_cost) === 400 && Number(afterEstimate.data?.recommended_sell) === 800 && JSON.stringify(afterEstimate.data?.assumptions) === JSON.stringify(estimate.data.assumptions));
    assert("pricing is unchanged", afterPricing.data?.title === "Untouched pricing" && Number(afterPricing.data?.subtotal_sell) === 800 && afterPricing.data?.status === "reviewed");
    assert("issued quote is unchanged", afterQuote.data?.status === "sent" && Number(afterQuote.data?.subtotal) === 800 && Number(afterQuote.data?.total_incl_gst) === 920);
    assert("accepted snapshot is unchanged", Number(afterSnapshot.data?.sell_ex_gst) === 800 && Number(afterSnapshot.data?.sell_incl_gst) === 920);
    console.log("Live rate book checks finished.");
  } finally {
    await admin.from("organisations").delete().in("id", [orgA, orgB]);
    for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
  }
}

async function main() {
  staticMain();
  if (process.argv.includes("--live")) await liveMain();
  if (failed > 0) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
