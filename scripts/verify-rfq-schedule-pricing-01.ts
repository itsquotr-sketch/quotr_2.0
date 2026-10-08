/**
 * Selected schedule lines applied to draft pricing.
 *
 * Static: npx tsx scripts/verify-rfq-schedule-pricing-01.ts
 * Live Preview: npx tsx scripts/verify-rfq-schedule-pricing-01.ts --live
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";
import { generateRfqAccessToken, hashRfqAccessToken } from "../lib/rfqs/token";
import { loadScheduleScopeReview } from "../lib/rfqs/schedule-scope-gaps";

function assert(label: string, ok: boolean, detail = "") {
  console.log(ok ? "PASS" : "FAIL", label, detail);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function parseEnvFile(path: string): Record<string, string> {
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

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function cents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

function staticMain() {
  const sql = read("supabase/migrations/102_rfq_schedule_pricing.sql");
  const scope = read("supabase/migrations/103_rfq_schedule_scope_resolution.sql");
  const commercial = read("supabase/migrations/104_rfq_schedule_commercial_scope.sql");
  const previous = read("supabase/migrations/101_rfq_schedule.sql");
  const head = read("scripts/verify-quote-transaction-01.ts");
  const pricing = read("lib/pricing/actions.ts");
  assert("selected lines have their own apply function", sql.includes("apply_rfq_schedule_lines_v1") && sql.includes("NOT_PRICED"));
  assert("a schedule response is still refused as one allowance", previous.includes("SCHEDULE_NOT_APPLIED"));
  assert("supplier lock covers schedule-backed items", sql.includes("rfq_schedule_pricing_applications") && sql.includes("SUPPLIER_PRICE_LOCKED"));
  assert("pricing edits consult schedule provenance", pricing.includes("rfq_schedule_pricing_applications"));
  assert("migration head check is unchanged", head.includes('migrations.at(-1) === "080_project_document_delete.sql"'));
  assert("a qualification needs a coverage decision", scope.includes("COVERAGE") && scope.includes("resolve_rfq_schedule_gap_v1"));
  assert("a private note does not clear a required row", commercial.includes("A private note does not clear a required row") && commercial.includes("client_condition") && commercial.includes("on delete set null"));
  assert("replaced lines stay out of the active pricing list", read("components/pricing/PricingWorkspace.tsx").includes("isReplacedSubcontractPlaceholder"));
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
  const ref = hostnameRef(url);
  assert("live target is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF || ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = randomUUID().slice(0, 8);
  const password = `sched-price-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectId = randomUUID();
  const userIds: string[] = [];

  async function userFor(role: "owner" | "viewer", orgId: string) {
    const email = `sched-price-${role}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    userIds.push(created.data.user.id);
    const profile = await admin.from("profiles").upsert({ id: created.data.user.id, org_id: orgId, role, full_name: `Schedule price ${role}` });
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
    for (const org of [{ id: orgA, name: `Schedule price A ${suffix}` }, { id: orgB, name: `Schedule price B ${suffix}` }]) {
      const inserted = await admin.from("organisations").insert(org);
      if (inserted.error) throw new Error(inserted.error.message);
    }
    const owner = await userFor("owner", orgA);
    const viewer = await userFor("viewer", orgA);
    const foreign = await userFor("owner", orgB);
    const project = await admin.from("projects").insert({
      id: projectId, org_id: orgA, created_by: userIds[0], title: `Schedule pricing ${suffix}`,
      stage: "estimate_ready", business_status: "estimate_ready",
    });
    if (project.error) throw new Error(project.error.message);
    const area = await admin.from("work_areas").insert({
      org_id: orgA, project_id: projectId, type: "bathroom", name: "Bathroom", status: "confirmed", sort_order: 1,
    }).select("id").single();
    if (area.error || !area.data) throw new Error(area.error?.message ?? "area");
    const otherArea = await admin.from("work_areas").insert({
      org_id: orgA, project_id: projectId, type: "kitchen", name: "Kitchen", status: "confirmed", sort_order: 2,
    }).select("id").single();
    if (otherArea.error || !otherArea.data) throw new Error(otherArea.error?.message ?? "other area");
    const businesses: string[] = [];
    for (const name of ["Complete Co", "Partial Co"]) {
      const saved = await owner.rpc("save_subcontractor_v1", {
        p_payload: {
          trading_name: `${name} ${suffix}`,
          country_code: "NZ",
          work_area_types: ["bathroom"],
          contacts: [{ name, email: `${name.split(" ")[0].toLowerCase()}-${suffix}@example.invalid`, is_primary: true }],
        },
      });
      if (typeof saved.data !== "string") throw new Error(saved.error?.message ?? "business");
      businesses.push(saved.data);
    }
    const contacts = await admin.from("subcontractor_contacts").select("id, subcontractor_id").in("subcontractor_id", businesses);
    const contactFor = (id: string) => contacts.data?.find((row) => row.subcontractor_id === id)?.id;
    const draft = await owner.rpc("save_rfq_draft_v1", {
      p_payload: {
        project_id: projectId,
        scope_kind: "work_area",
        work_area_id: area.data.id,
        requested_scope: `Price the bathroom package ${suffix}`,
        recipients: businesses.map((id) => ({ subcontractor_id: id, contact_id: contactFor(id), selection_source: "manual" })),
        document_version_ids: [],
      },
    });
    if (draft.data?.ok !== true) throw new Error(JSON.stringify(draft.data ?? draft.error));
    const rfqId = draft.data.id as string;
    await owner.rpc("set_rfq_pricing_request_v1", { p_rfq: rfqId, p_mode: "schedule" });
    const items = [
      { id: randomUUID(), scope: "Wall lining", specification: "Moisture resistant board for the wet area", quantity: "12.5", unit: "m2", role: "required" },
      { id: randomUUID(), scope: "Access panels", specification: "", quantity: "3", unit: "item", role: "required" },
      { id: randomUUID(), scope: "Site set-up", specification: "", quantity: null, unit: "lump_sum", role: "required" },
      { id: randomUUID(), scope: "Trim", specification: "", quantity: "2", unit: "m", role: "optional" },
      { id: randomUUID(), scope: "Alternative board", specification: "", quantity: null, unit: "lump_sum", role: "alternative" },
    ];
    const savedItems = await owner.rpc("save_rfq_schedule_v1", { p_rfq: rfqId, p_items: items });
    if (savedItems.data?.ok !== true) throw new Error(JSON.stringify(savedItems.data ?? savedItems.error));
    const raw = [generateRfqAccessToken(), generateRfqAccessToken()];
    const recipients = await admin.from("rfq_recipients").select("id, subcontractor_id").eq("rfq_id", rfqId);
    const recipientFor = (businessId: string) => recipients.data?.find((row) => row.subcontractor_id === businessId);
    const sent = await owner.rpc("send_rfq_v1", {
      p_rfq: rfqId,
      p_tokens: businesses.map((id, index) => ({ recipient_id: recipientFor(id)?.id, token_hash: hashRfqAccessToken(raw[index]) })),
    });
    if (sent.data?.ok !== true) throw new Error(JSON.stringify(sent.data ?? sent.error));
    const opened = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(raw[0]) });
    const requestSentAt = opened.data?.requestSentAt as string;
    function linesFor(prices: Array<string | null>, reason = "", qualification = "") {
      return items.map((item, index) => {
        const price = prices[index];
        if (price == null && item.role === "required") return { schedule_item_id: item.id, decision: "not_priced", unit_price: null, reason, qualification };
        if (price == null) return { schedule_item_id: item.id, decision: "excluded", unit_price: null, reason: "", qualification };
        return { schedule_item_id: item.id, decision: "priced", unit_price: price, reason: "", qualification };
      });
    }
    const completeLines = linesFor(["48.40", "25.33", "400", "10", "75"]);
    completeLines[0].qualification = "Subject to weekday access";
    const complete = await anon.rpc("public_rfq_save_schedule_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[0]),
      p_payload: { request_sent_at: requestSentAt, gst_treatment: "extra", excluded_scope: "Painting", lines: completeLines },
      p_confirm: true,
      p_revise: false,
    });
    const partial = await anon.rpc("public_rfq_save_schedule_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[1]),
      p_payload: { request_sent_at: requestSentAt, gst_treatment: "extra", lines: linesFor(["48.40", null, "400", null, null], "No access") },
      p_confirm: true,
      p_revise: false,
    });
    if (complete.data?.ok !== true || partial.data?.ok !== true) throw new Error(JSON.stringify({ complete: complete.data, partial: partial.data }));
    assert("complete base stays 1080.99 and partial stays 1005.00", cents(complete.data.baseExGst) === 108099 && cents(partial.data.baseExGst) === 100500);

    const estimate = await admin.from("estimates").insert({
      org_id: orgA, project_id: projectId, status: "ready", recommended_cost: 100, recommended_sell: 900,
    }).select("id, recommended_cost, recommended_sell").single();
    if (estimate.error) throw new Error(estimate.error.message);
    const document = await admin.from("pricing_documents").insert({
      org_id: orgA, project_id: projectId, title: "Draft pricing", status: "reviewed",
      reviewed_at: new Date().toISOString(), gst_rate: 15,
      subtotal_cost: 100, subtotal_sell: 900, gross_profit: 800, margin_percent: 88.89, gst_amount: 135, total_incl_gst: 1035,
    }).select("id").single();
    if (document.error) throw new Error(document.error.message);
    const issued = await admin.from("pricing_documents").insert({
      org_id: orgA, project_id: projectId, title: "Issued source", status: "converted_to_quote", gst_rate: 15,
    }).select("id").single();
    if (issued.error) throw new Error(issued.error.message);
    const quote = await admin.from("quotes").insert({
      org_id: orgA, project_id: projectId, pricing_document_id: issued.data.id, title: "Issued quote",
      status: "draft", subtotal: 800, gst_rate: 15, gst_amount: 120, total_incl_gst: 920,
    }).select("id").single();
    if (quote.error) throw new Error(quote.error.message);
    const quoteItem = await admin.from("quote_items").insert({
      org_id: orgA, quote_id: quote.data.id, project_id: projectId, label: "Original wall tiles",
      quantity: 1, unit: "m²", unit_price: 800, total: 800, visible: true, sort_order: 1,
    }).select("id, label, total").single();
    if (quoteItem.error) throw new Error(quoteItem.error.message);
    const sentQuote = await admin.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", quote.data.id).select("status, subtotal, total_incl_gst").single();
    if (sentQuote.error) throw new Error(sentQuote.error.message);
    const snapshot = await admin.from("accepted_commercial_snapshots").insert({
      org_id: orgA, project_id: projectId, quote_id: quote.data.id, revision_number: 1, currency: "NZD",
      gst_rate: 15, tax_treatment: "standard", sell_ex_gst: 800, gst_amount: 120, sell_incl_gst: 920,
      accepted_at: new Date().toISOString(), acceptance_source: "manual",
    }).select("id").single();
    if (snapshot.error) throw new Error(snapshot.error.message);
    const variationDraft = await owner.rpc("create_draft_variation_v1", {
      p_project: projectId, p_title: "Extra lining", p_summary: "Issued before the schedule price.",
      p_idempotency_key: `schedule-price-${suffix}`,
    });
    const variationCreated = variationDraft.data as { ok?: boolean; variationId?: string; revisionId?: string } | null;
    if (!variationCreated?.ok || !variationCreated.variationId || !variationCreated.revisionId) throw new Error(JSON.stringify(variationDraft.data ?? variationDraft.error));
    const variationItem = await owner.rpc("add_draft_variation_item_v1", {
      p_variation: variationCreated.variationId, p_revision: variationCreated.revisionId,
      p_item: {
        itemType: "addition", clientDescription: "Extra wall lining", workAreaId: null, snapshotLineId: null,
        stableComponentKey: null, quantity: 1, unit: "item", unitCost: 100, unitSell: 200, sortOrder: 1,
        clientInclusion: null, clientExclusion: null, substitutionGroupId: null, internalMetadata: {},
      },
    });
    if (variationItem.data?.ok !== true) throw new Error(JSON.stringify(variationItem.data ?? variationItem.error));
    const variationIssued = await owner.rpc("issue_variation_revision_v1", { p_variation: variationCreated.variationId, p_revision: variationCreated.revisionId });
    if (variationIssued.data?.ok !== true) throw new Error(JSON.stringify(variationIssued.data ?? variationIssued.error));
    const variationBefore = JSON.stringify({
      items: (await admin.from("variation_items").select("client_description, quantity, unit, unit_cost, unit_sell").eq("variation_id", variationCreated.variationId)).data,
      revision: (await admin.from("variation_revisions").select("status, total_sell_adjustment_ex_gst").eq("id", variationCreated.revisionId).single()).data,
    });

    const wallItem = await admin.from("pricing_items").insert({
      org_id: orgA, pricing_document_id: document.data.id, project_id: projectId, work_area_id: area.data.id,
      item_type: "allowance", delivery_method: "allowance", internal_label: "Wall lining allowance", client_label: "Wall lining allowance",
      quantity: 1, unit: "m2", unit_cost: 100, unit_sell: 900, total_cost: 100, total_sell: 900,
      gross_profit: 800, margin_percent: 88.89, markup_percent: 800, sort_order: 1, visible_on_quote: true,
    }).select("id").single();
    const metreItem = await admin.from("pricing_items").insert({
      org_id: orgA, pricing_document_id: document.data.id, project_id: projectId, work_area_id: area.data.id,
      item_type: "allowance", delivery_method: "allowance", internal_label: "Trim allowance", client_label: "Trim allowance",
      quantity: 1, unit: "m", unit_cost: 10, unit_sell: 20, total_cost: 10, total_sell: 20,
      gross_profit: 10, margin_percent: 50, markup_percent: 100, sort_order: 2, visible_on_quote: true,
    }).select("id").single();
    const foreignItem = await admin.from("pricing_items").insert({
      org_id: orgA, pricing_document_id: document.data.id, project_id: projectId, work_area_id: otherArea.data.id,
      item_type: "allowance", delivery_method: "allowance", internal_label: "Kitchen item", client_label: "Kitchen item",
      quantity: 1, unit: "m2", unit_cost: 10, unit_sell: 20, total_cost: 10, total_sell: 20,
      gross_profit: 10, margin_percent: 50, markup_percent: 100, sort_order: 3, visible_on_quote: true,
    }).select("id").single();
    if (wallItem.error || metreItem.error || foreignItem.error) throw new Error(wallItem.error?.message ?? metreItem.error?.message ?? "items");

    const conditionWording = "Pricing assumes weekday site access and a clear work area.";
    const exclusionWording = "Painting is not included in this quote.";
    const responseCoverage = { decision: "client_exclusion", wording: exclusionWording };
    const itemCoverage = { decision: "client_condition", wording: conditionWording };
    function row(scheduleId: string, extra: Record<string, unknown>) {
      const merged: Record<string, unknown> = {
        schedule_item_id: scheduleId,
        mode: "add",
        replaced_item_ids: [],
        client_label: "Client scope",
        scope_confirmed: "true",
        sell_treatment: "manual",
        total_sell: 1,
        acknowledge_loss: "false",
        qualification_acknowledged: "false",
        acknowledge_alternative: "false",
        acknowledge_source: "false",
        ...extra,
      };
      if (scheduleId === items[0].id && merged.qualification_acknowledged === "true" && extra.coverage !== null) {
        merged.coverage = extra.coverage ?? itemCoverage;
      }
      return merged;
    }
    async function apply(responseId: string, rows: unknown[], extra: Record<string, unknown> = {}) {
      const { omit_response_coverage, ...rest } = extra;
      const result = await owner.rpc("apply_rfq_schedule_lines_v1", {
        p_payload: {
          response_id: responseId,
          pricing_document_id: document.data.id,
          work_area_id: area.data.id,
          request_sent_at: requestSentAt,
          rows,
          ...(responseId === complete.data.responseId && omit_response_coverage !== true ? { response_coverage: responseCoverage } : {}),
          ...rest,
        },
      });
      return (result.data ?? { ok: false, error: result.error?.message }) as { ok?: boolean; error?: string; alreadyApplied?: boolean; rows?: Array<{ allowanceItemId?: string; costExGst?: number; sellExGst?: number }> };
    }

    const deliveriesBefore = await admin.from("rfq_deliveries").select("id", { count: "exact", head: true }).eq("org_id", orgA);
    const forced = await apply(complete.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [wallItem.data.id], client_label: "Wall lining",
      sell_treatment: "keep", total_cost: 605, total_sell: 900, qualification_acknowledged: "true",
    })], { force_fail: "true" });
    const afterForce = await admin.from("rfq_schedule_pricing_applications").select("id", { count: "exact", head: true }).eq("rfq_id", rfqId);
    const wallAfterForce = await admin.from("pricing_items").select("total_cost, total_sell").eq("id", wallItem.data.id).single();
    assert("a failed apply writes nothing", forced.ok !== true && (afterForce.count ?? 0) === 0 && cents(wallAfterForce.data?.total_cost) === 10000 && cents(wallAfterForce.data?.total_sell) === 90000, JSON.stringify(forced));

    const missingAck = await apply(complete.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [wallItem.data.id], total_cost: 605, total_sell: 900, sell_treatment: "keep",
    })]);
    assert("a qualified line needs acknowledgement", missingAck.error === "QUALIFICATION");
    const missingResponse = await apply(complete.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [wallItem.data.id], total_cost: 605, total_sell: 900, sell_treatment: "keep", qualification_acknowledged: "true",
    })], { omit_response_coverage: true });
    assert("a response exclusion needs a coverage decision", missingResponse.error === "COVERAGE", JSON.stringify(missingResponse));
    const ackOnly = await apply(complete.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [wallItem.data.id], total_cost: 605, total_sell: 900, sell_treatment: "keep", qualification_acknowledged: "true", coverage: null,
    })]);
    assert("an acknowledgement is not a coverage decision", ackOnly.error === "COVERAGE", JSON.stringify(ackOnly));
    const notPriced = await apply(partial.data.responseId, [row(items[1].id, { total_cost: 0, total_sell: 1 })]);
    assert("a Not priced line is refused", notPriced.error === "NOT_PRICED");
    const ambiguous = await apply(complete.data.responseId, [row(items[0].id, { mode: "replace", replaced_item_ids: [], total_cost: 605, total_sell: 900, qualification_acknowledged: "true", sell_treatment: "keep" })]);
    assert("a replacement without an item is refused", ambiguous.error === "AMBIGUOUS");
    const wrongUnit = await apply(complete.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [metreItem.data.id], total_cost: 605, total_sell: 20, sell_treatment: "keep", qualification_acknowledged: "true",
    })]);
    assert("a different unit is refused", wrongUnit.error === "UNIT");
    const wrongArea = await apply(complete.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [foreignItem.data.id], total_cost: 605, total_sell: 20, sell_treatment: "keep", qualification_acknowledged: "true",
    })]);
    assert("another work area is refused", wrongArea.error === "WORK_AREA");
    const issuedApply = await owner.rpc("apply_rfq_schedule_lines_v1", {
      p_payload: {
        response_id: complete.data.responseId, pricing_document_id: issued.data.id, work_area_id: area.data.id, request_sent_at: requestSentAt,
        rows: [row(items[0].id, { total_cost: 605, total_sell: 800, qualification_acknowledged: "true" })],
      },
    });
    assert("an issued quote blocks the apply", (issuedApply.data as { error?: string } | null)?.error === "QUOTE_ISSUED", JSON.stringify(issuedApply.data ?? issuedApply.error));

    const loss = await apply(complete.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [wallItem.data.id], client_label: "Wall lining",
      sell_treatment: "manual", total_cost: 605, total_sell: 100, qualification_acknowledged: "true",
    })]);
    const afterLoss = await admin.from("pricing_items").select("total_cost, total_sell").eq("id", wallItem.data.id).single();
    assert("a loss is refused until that row acknowledges it", loss.error === "LOSS_ACK" && cents(afterLoss.data?.total_cost) === 10000 && cents(afterLoss.data?.total_sell) === 90000, JSON.stringify(loss));
    const wall = await apply(complete.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [wallItem.data.id], client_label: "Wall lining",
      sell_treatment: "keep", total_cost: 605, total_sell: 900, qualification_acknowledged: "true",
    })]);
    assert("wall lining uses its own 605.00 cost and the kept sell", wall.ok === true && cents(wall.rows?.[0]?.costExGst) === 60500 && cents(wall.rows?.[0]?.sellExGst) === 90000, JSON.stringify(wall));
    const wallAllowance = wall.rows?.[0]?.allowanceItemId;
    const replaced = await admin.from("pricing_items").select("total_cost, total_sell, visible_on_quote").eq("id", wallItem.data.id).single();
    assert("the replaced item is not left as charged client scope", cents(replaced.data?.total_cost) === 0 && cents(replaced.data?.total_sell) === 0 && replaced.data?.visible_on_quote === false);
    const noteOnly = await owner.rpc("resolve_rfq_schedule_gap_v1", {
      p_payload: {
        pricing_document_id: document.data.id, schedule_item_id: items[2].id, response_id: complete.data.responseId,
        decision: "builder_responsibility", note: "Site set-up stays with the builder until its price is used.",
      },
    });
    const noteRow = await admin.from("rfq_schedule_scope_resolutions").select("id").eq("schedule_item_id", items[2].id).is("superseded_at", null);
    assert("a private note does not clear a required row", (noteOnly.data as { error?: string })?.error === "COVERAGE" && (noteRow.data ?? []).length === 0, JSON.stringify(noteOnly.data ?? noteOnly.error));
    const coverItem = await admin.from("pricing_items").insert({
      org_id: orgA, pricing_document_id: document.data.id, project_id: projectId, work_area_id: area.data.id,
      item_type: "allowance", delivery_method: "allowance", internal_label: "Builder site cover", client_label: "Builder site cover",
      quantity: 1, unit: "lump_sum", unit_cost: 15, unit_sell: 30, total_cost: 15, total_sell: 30,
      gross_profit: 15, margin_percent: 50, markup_percent: 100, sort_order: 8, visible_on_quote: true,
    }).select("id").single();
    const beforeCover = await admin.from("pricing_documents").select("subtotal_cost, subtotal_sell").eq("id", document.data.id).single();
    const gap = await owner.rpc("resolve_rfq_schedule_gap_v1", {
      p_payload: {
        pricing_document_id: document.data.id, schedule_item_id: items[2].id, response_id: complete.data.responseId,
        decision: "covered_by_item", item_id: coverItem.data?.id, note: "The builder site cover already includes this set-up.",
      },
    });
    const afterCover = await admin.from("pricing_documents").select("subtotal_cost, subtotal_sell").eq("id", document.data.id).single();
    const gapRow = await admin.from("rfq_schedule_scope_resolutions").select("decision, coverage_item_id, internal_note").eq("schedule_item_id", items[2].id).is("superseded_at", null).maybeSingle();
    const coverCount = await admin.from("pricing_items").select("id", { count: "exact", head: true }).eq("pricing_document_id", document.data.id).eq("client_label", "Builder site cover");
    assert("linking an existing item does not add the supplier price", (gap.data as { ok?: boolean })?.ok === true && gapRow.data?.decision === "covered_by_item" && gapRow.data?.coverage_item_id === coverItem.data?.id && (coverCount.count ?? 0) === 1 && cents(beforeCover.data?.subtotal_cost) === cents(afterCover.data?.subtotal_cost) && cents(beforeCover.data?.subtotal_sell) === cents(afterCover.data?.subtotal_sell), JSON.stringify({ gap: gap.data ?? gap.error, before: beforeCover.data, after: afterCover.data }));
    await admin.from("pricing_items").update({ visible_on_quote: false }).eq("id", coverItem.data?.id);
    const hiddenReview = await loadScheduleScopeReview(admin, orgA, document.data.id);
    assert("hiding the linked item reopens the gap", hiddenReview.unresolved.some((item) => item.scheduleItemId === items[2].id), JSON.stringify(hiddenReview.unresolved));
    await admin.from("pricing_items").update({ visible_on_quote: true }).eq("id", coverItem.data?.id);
    const removed = await admin.from("pricing_items").delete().eq("id", coverItem.data?.id);
    const removedRow = await admin.from("rfq_schedule_scope_resolutions").select("coverage_item_id, decision").eq("schedule_item_id", items[2].id).is("superseded_at", null).maybeSingle();
    const removedReview = await loadScheduleScopeReview(admin, orgA, document.data.id);
    assert("deleting the linked item reopens the gap", !removed.error && removedRow.data?.coverage_item_id == null && removedReview.unresolved.some((item) => item.scheduleItemId === items[2].id), JSON.stringify({ removed: removed.error?.message, row: removedRow.data, unresolved: removedReview.unresolved }));
    const panels = await apply(complete.data.responseId, [row(items[1].id, { client_label: "Access panels", total_cost: 75.99, total_sell: 100 })]);
    const setup = await apply(complete.data.responseId, [row(items[2].id, { client_label: "Site set-up", total_cost: 400, total_sell: 500 })]);
    assert("panels and the lump sum are separate items", panels.ok === true && cents(panels.rows?.[0]?.costExGst) === 7599 && setup.ok === true && cents(setup.rows?.[0]?.costExGst) === 40000, JSON.stringify({ panels, setup }));
    const optional = await apply(complete.data.responseId, [row(items[3].id, { client_label: "Trim", total_cost: 20, total_sell: 30 })]);
    const alternativeBlocked = await apply(complete.data.responseId, [row(items[4].id, { client_label: "Alternative board", total_cost: 75, total_sell: 90 })]);
    assert("the chosen optional trim is its own 20.00 item", optional.ok === true && cents(optional.rows?.[0]?.costExGst) === 2000, JSON.stringify(optional));
    assert("the alternative is refused beside the base", alternativeBlocked.error === "ALTERNATIVE", JSON.stringify(alternativeBlocked));
    const alternative = await apply(complete.data.responseId, [row(items[4].id, {
      client_label: "Alternative board", total_cost: 75, total_sell: 90, acknowledge_alternative: "true",
    })]);
    assert("the acknowledged alternative is its own 75.00 item", alternative.ok === true && cents(alternative.rows?.[0]?.costExGst) === 7500, JSON.stringify(alternative));
    const charged = await admin.from("pricing_items").select("client_label, client_description, total_cost, total_sell, visible_on_quote, notes_internal").eq("pricing_document_id", document.data.id).eq("visible_on_quote", true);
    const labels = (charged.data ?? []).map((item) => item.client_label).sort();
    const costs = (charged.data ?? []).map((item) => cents(item.total_cost)).sort((a, b) => a - b);
    assert("selected rows are not copied as one 1080.99 allowance", !costs.includes(108099) && costs.includes(60500) && costs.includes(7599) && costs.includes(40000) && costs.includes(2000) && costs.includes(7500), JSON.stringify(charged.data));
    const wallCopy = (charged.data ?? []).find((item) => item.client_label === "Wall lining");
    assert("client labels do not carry the supplier", labels.every((label) => !String(label).includes(suffix)) && (charged.data ?? []).every((item) => !String(item.notes_internal).includes("Complete Co") && !String(item.client_description).includes("Subject to weekday access") && !String(item.client_description).includes("Painting")), JSON.stringify(labels));
    const wallProvenance = await admin.from("rfq_schedule_pricing_applications").select("coverage_decision, coverage_wording, response_exclusion_decision, response_exclusion_wording").eq("schedule_item_id", items[0].id).is("superseded_at", null).maybeSingle();
    assert("the weekday qualification is the approved condition", wallProvenance.data?.coverage_decision === "client_condition" && wallProvenance.data?.coverage_wording === conditionWording && !String(wallCopy?.client_description ?? "").includes("Excluded:") && !String(wallCopy?.client_description ?? "").includes(conditionWording), JSON.stringify(wallProvenance.data ?? wallCopy?.client_description));
    assert("the supplier exclusion keeps the builder's exclusion wording", wallProvenance.data?.response_exclusion_decision === "client_exclusion" && wallProvenance.data?.response_exclusion_wording === exclusionWording && !String(wallCopy?.client_description ?? "").includes(exclusionWording), JSON.stringify(wallProvenance.data));
    const repeat = await apply(complete.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [wallItem.data.id], client_label: "Wall lining",
      sell_treatment: "keep", total_cost: 605, total_sell: 900, qualification_acknowledged: "true",
    })]);
    const activeWall = await admin.from("rfq_schedule_pricing_applications").select("id", { count: "exact", head: true }).eq("schedule_item_id", items[0].id).is("superseded_at", null);
    assert("the same confirmed wall line does not write again", repeat.alreadyApplied === true && (activeWall.count ?? 0) === 1, JSON.stringify(repeat));

    const revised = await anon.rpc("public_rfq_save_schedule_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[0]),
      p_payload: { request_sent_at: requestSentAt, gst_treatment: "extra", lines: linesFor(["50", "25.33", "400", "10", "75"]) },
      p_confirm: true,
      p_revise: true,
    });
    const still = await admin.from("pricing_items").select("total_cost").eq("id", wallAllowance).single();
    const versionOne = await admin.from("rfq_schedule_pricing_applications").select("response_version, cost_ex_gst").eq("schedule_item_id", items[0].id).is("superseded_at", null).single();
    assert("version 2 does not change the applied version 1 price", revised.data?.ok === true && cents(revised.data.baseExGst) === 110099 && cents(still.data?.total_cost) === 60500 && versionOne.data?.response_version === 1, JSON.stringify({ revised: revised.data, still: still.data, versionOne: versionOne.data }));
    const versionTwo = await apply(revised.data.responseId, [row(items[0].id, {
      mode: "add", client_label: "Wall lining", sell_treatment: "manual", total_cost: 625, total_sell: 900,
    })]);
    const wallItems = await admin.from("pricing_items").select("id, total_cost, visible_on_quote").eq("pricing_document_id", document.data.id).eq("client_label", "Wall lining").eq("visible_on_quote", true);
    const activeAfter = await admin.from("rfq_schedule_pricing_applications").select("response_version, cost_ex_gst").eq("schedule_item_id", items[0].id).is("superseded_at", null);
    assert("revising the wall line updates the same item to 625.00", versionTwo.ok === true && wallItems.data?.length === 1 && cents(wallItems.data[0]?.total_cost) === 62500 && activeAfter.data?.length === 1 && activeAfter.data[0]?.response_version === 2, JSON.stringify({ versionTwo, wallItems: wallItems.data, activeAfter: activeAfter.data }));

    const partialWall = await owner.rpc("apply_rfq_schedule_lines_v1", {
      p_payload: {
        response_id: partial.data.responseId, pricing_document_id: document.data.id, work_area_id: area.data.id, request_sent_at: requestSentAt,
        rows: [row(items[0].id, { client_label: "Partial wall lining", total_cost: 605, total_sell: 800 })],
      },
    });
    const partialStored = await admin.from("rfq_schedule_pricing_applications").select("completeness, cost_ex_gst").eq("response_id", partial.data.responseId).is("superseded_at", null);
    assert("a partial response contributes only the selected 605.00 line", (partialWall.data as { ok?: boolean })?.ok === true && partialStored.data?.every((item) => item.completeness === "partial" && cents(item.cost_ex_gst) === 60500) && !JSON.stringify(partialStored.data).includes("1005"), JSON.stringify(partialWall.data ?? partialStored.data));

    const beforeLock = await admin.from("pricing_items").select("total_cost").eq("id", wallAllowance).single();
    const locked = await owner.from("pricing_items").update({ total_cost: 1 }).eq("id", wallAllowance);
    const renamed = await owner.from("pricing_items").update({ client_label: "Wall lining" }).eq("id", wallAllowance).select("total_cost").single();
    assert("a direct money edit is locked and a label save keeps the cost", Boolean(locked.error) && locked.error?.message.includes("SUPPLIER_PRICE_LOCKED") && cents(renamed.data?.total_cost) === cents(beforeLock.data?.total_cost), locked.error?.message ?? "");
    const direct = await owner.from("rfq_schedule_pricing_applications").insert({ org_id: orgA, project_id: projectId });
    assert("a direct provenance write is refused", Boolean(direct.error));

    const viewerApply = await viewer.rpc("apply_rfq_schedule_lines_v1", { p_payload: { response_id: complete.data.responseId, pricing_document_id: document.data.id, work_area_id: area.data.id, request_sent_at: requestSentAt, rows: [row(items[2].id, { total_cost: 400, total_sell: 500 })] } });
    const pendingEmail = `sched-price-pending-${suffix}@example.invalid`;
    const pendingUser = await admin.auth.admin.createUser({ email: pendingEmail, password, email_confirm: true });
    if (pendingUser.error || !pendingUser.data.user) throw new Error(pendingUser.error?.message ?? "pending user");
    userIds.push(pendingUser.data.user.id);
    await admin.from("profiles").upsert({ id: pendingUser.data.user.id, org_id: orgA, role: "estimator", full_name: "Pending estimator" });
    await admin.from("organisation_memberships").insert({
      org_id: orgA, user_id: pendingUser.data.user.id, role: "estimator", status: "pending_billing", joined_at: new Date().toISOString(),
    });
    const pendingClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const pendingSignIn = await pendingClient.auth.signInWithPassword({ email: pendingEmail, password });
    if (pendingSignIn.error) throw new Error(pendingSignIn.error.message);
    const inactiveApply = await pendingClient.rpc("apply_rfq_schedule_lines_v1", { p_payload: { response_id: complete.data.responseId, pricing_document_id: document.data.id, work_area_id: area.data.id, request_sent_at: requestSentAt, rows: [row(items[2].id, { total_cost: 400, total_sell: 500 })] } });
    const foreignApply = await foreign.rpc("apply_rfq_schedule_lines_v1", { p_payload: { response_id: complete.data.responseId, pricing_document_id: document.data.id, work_area_id: area.data.id, request_sent_at: requestSentAt, rows: [row(items[2].id, { total_cost: 400, total_sell: 500 })] } });
    assert("viewer, inactive, and other-organisation applies are refused", (viewerApply.data as { error?: string })?.error === "FORBIDDEN" && (inactiveApply.data as { error?: string })?.error === "FORBIDDEN" && (foreignApply.data as { ok?: boolean })?.ok !== true, JSON.stringify({ viewer: viewerApply.data, inactive: inactiveApply.data, foreign: foreignApply.data }));
    const viewerGap = await viewer.rpc("resolve_rfq_schedule_gap_v1", { p_payload: { pricing_document_id: document.data.id, schedule_item_id: items[1].id, response_id: complete.data.responseId, decision: "builder_responsibility", note: "A viewer cannot decide this." } });
    const foreignGap = await foreign.rpc("resolve_rfq_schedule_gap_v1", { p_payload: { pricing_document_id: document.data.id, schedule_item_id: items[1].id, response_id: complete.data.responseId, decision: "builder_responsibility", note: "Another organisation cannot decide this." } });
    assert("a viewer and another organisation cannot resolve scope", (viewerGap.data as { error?: string })?.error === "FORBIDDEN" && (foreignGap.data as { ok?: boolean })?.ok !== true, JSON.stringify({ viewerGap: viewerGap.data, foreignGap: foreignGap.data }));

    const expiredResponse = await anon.rpc("public_rfq_save_schedule_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[0]),
      p_payload: { request_sent_at: requestSentAt, gst_treatment: "extra", valid_until: "2020-01-01", lines: linesFor(["50", "25.33", "400", "10", "75"]) },
      p_confirm: true,
      p_revise: true,
    });
    const expired = await apply(expiredResponse.data?.responseId, [row(items[0].id, { client_label: "Expired wall", total_cost: 625, total_sell: 900 })]);
    assert("an expired response is refused", expiredResponse.data?.ok === true && expired.error === "EXPIRED", JSON.stringify({ expiredResponse: expiredResponse.data, expired }));
    const stale = await owner.rpc("apply_rfq_schedule_lines_v1", {
      p_payload: { response_id: complete.data.responseId, pricing_document_id: document.data.id, work_area_id: area.data.id, request_sent_at: "2000-01-01T00:00:00.000Z", rows: [row(items[3].id, { total_cost: 20, total_sell: 30 })] },
    });
    assert("a stale schedule time is refused", (stale.data as { error?: string } | null)?.error === "STALE", JSON.stringify(stale.data ?? stale.error));
    await owner.rpc("revoke_rfq_recipient_v1", { p_recipient: recipientFor(businesses[1])?.id });
    const revoked = await owner.rpc("apply_rfq_schedule_lines_v1", {
      p_payload: { response_id: partial.data.responseId, pricing_document_id: document.data.id, work_area_id: area.data.id, request_sent_at: requestSentAt, rows: [row(items[2].id, { client_label: "Should not apply", total_cost: 400, total_sell: 500 })] },
    });
    assert("a revoked response is refused", (revoked.data as { error?: string } | null)?.error === "REVOKED", JSON.stringify(revoked.data ?? revoked.error));

    const whole = await owner.rpc("apply_rfq_response_to_pricing_v1", { p_payload: { response_id: complete.data.responseId } });
    const deliveriesAfter = await admin.from("rfq_deliveries").select("id", { count: "exact", head: true }).eq("org_id", orgA);
    const estimateAfter = await admin.from("estimates").select("recommended_cost, recommended_sell").eq("id", estimate.data.id).single();
    const quoteAfter = await admin.from("quotes").select("status, subtotal, total_incl_gst").eq("id", quote.data.id).single();
    const quoteItemAfter = await admin.from("quote_items").select("label, total, unit_price").eq("id", quoteItem.data.id).single();
    const snapshotAfter = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst, gst_amount, sell_incl_gst").eq("id", snapshot.data.id).single();
    const variationAfter = JSON.stringify({
      items: (await admin.from("variation_items").select("client_description, quantity, unit, unit_cost, unit_sell").eq("variation_id", variationCreated.variationId)).data,
      revision: (await admin.from("variation_revisions").select("status, total_sell_adjustment_ex_gst").eq("id", variationCreated.revisionId).single()).data,
    });
    const docStatus = await admin.from("pricing_documents").select("status").eq("id", document.data.id).single();
    assert("the whole-response path still refuses a schedule", (whole.data as { error?: string } | null)?.error === "SCHEDULE_NOT_APPLIED");
    assert("no award delivery was created", (deliveriesAfter.count ?? 0) === (deliveriesBefore.count ?? 0));
    assert("the estimate is unchanged", cents(estimateAfter.data?.recommended_cost) === 10000 && cents(estimateAfter.data?.recommended_sell) === 90000);
    assert("the issued quote and snapshot are unchanged", quoteAfter.data?.status === "sent" && cents(quoteAfter.data?.subtotal) === 80000 && quoteItemAfter.data?.label === "Original wall tiles" && cents(quoteItemAfter.data?.total) === 80000 && cents(snapshotAfter.data?.sell_ex_gst) === 80000);
    assert("the issued variation is unchanged", variationAfter === variationBefore, variationAfter);
    assert("reviewed pricing returns to draft", docStatus.data?.status === "draft");
    const rate = await owner.rpc("save_subcontractor_rate_v1", {
      p_payload: {
        subcontractor_id: businesses[0], work_area_type: "bathroom", currency: "NZD", source: "builder",
        effective_from: "2026-01-01", inclusions: "", exclusions: "", scope: "Supply lining", unit: "m2", cost_ex_gst: 40,
        confirm_scope: "true", confirm_unit: "true", confirm_amount: "true", confirm_validity: "true",
      },
    });
    const rateBody = rate.data as { ok?: boolean; versionId?: string } | null;
    const rateTarget = await admin.from("pricing_items").insert({
      org_id: orgA, pricing_document_id: document.data.id, project_id: projectId, work_area_id: area.data.id,
      item_type: "subcontractor", delivery_method: "subcontracted", internal_label: "Rate lining", client_label: "Rate lining",
      quantity: 1, unit: "m2", unit_cost: 40, unit_sell: 80, total_cost: 40, total_sell: 80,
      gross_profit: 40, margin_percent: 50, markup_percent: 100, sort_order: 9, visible_on_quote: true,
    }).select("id, total_cost, total_sell").single();
    if (rateTarget.error || !rateBody?.versionId) throw new Error(rateTarget.error?.message ?? JSON.stringify(rate.data));
    const rateUse = await owner.rpc("apply_subcontractor_rate_to_pricing_v1", {
      p_payload: {
        rate_version_id: rateBody.versionId, pricing_document_id: document.data.id, work_area_id: area.data.id,
        target_mode: "replace", target_item_id: rateTarget.data.id, quantity: 1, confirm_scope: "true", confirm_quantity: "true",
        sell_treatment: "keep", total_cost: 40, total_sell: 80, gross_profit: 40, margin_percent: 50, markup_percent: 100,
        acknowledge_loss: "false",
      },
    });
    const conflict = await apply(revised.data.responseId, [row(items[0].id, {
      mode: "replace", replaced_item_ids: [rateUse.data?.allowanceItemId ?? rateTarget.data.id], client_label: "Wall lining",
      sell_treatment: "manual", total_cost: 625, total_sell: 900,
    })]);
    assert("an existing supplier rate must be chosen as the one source", rateUse.data?.ok === true && conflict.error === "SOURCE", JSON.stringify({ rateUse: rateUse.data, conflict }));
  } finally {
    await admin.from("rfq_schedule_pricing_applications").delete().eq("project_id", projectId);
    await admin.from("rfqs").delete().eq("project_id", projectId);
    await admin.from("projects").delete().eq("id", projectId);
    for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    await admin.from("organisations").delete().in("id", [orgA, orgB]);
  }
}

staticMain();
if (process.argv.includes("--live")) {
  liveMain().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
