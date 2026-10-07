/**
 * Itemised RFQ schedule.
 *
 * Static: npx tsx scripts/verify-rfq-schedule-01.ts
 * Live Preview: npx tsx scripts/verify-rfq-schedule-01.ts --live
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";
import { buildRfqDeliveryEmail } from "../lib/rfqs/email";
import { scheduleExtended, scheduleProblems, type ScheduleDraftRow } from "../lib/rfqs/schedule";
import { generateRfqAccessToken, hashRfqAccessToken } from "../lib/rfqs/token";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return out;
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function cents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

function row(scope: string, unit: ScheduleDraftRow["unit"], quantity: string, role: ScheduleDraftRow["role"]): ScheduleDraftRow {
  return {
    id: randomUUID(),
    scope,
    specification: "",
    quantity,
    unit,
    role,
    quantitySource: null,
    quantityConfirmed: true,
  };
}

function staticMain() {
  const sql = read("supabase/migrations/101_rfq_schedule.sql");
  const composer = read("components/rfqs/RfqComposer.tsx");
  const pricing = read("components/rfqs/RfqPricingApply.tsx") + read("components/rfqs/RfqSchedulePricing.tsx");
  const apply = read("lib/rfqs/pricing-apply.ts");
  const head = read("scripts/verify-quote-transaction-01.ts");
  assert("migration is additive and defaults existing requests to one price", sql.includes("default 'lump_sum'") && sql.includes("'schedule'"));
  assert("sent schedule cannot change with the job", sql.includes("rfq_freeze_schedule_item") && sql.includes("pricing_request is distinct from old.pricing_request"));
  assert("extended amount is calculated in the database", sql.includes("round(v_item.quantity * v_unit_price, 2)") && !sql.includes("p_payload->>'amount'"));
  assert("a schedule response is refused by the whole-response pricing path", sql.includes("SCHEDULE_NOT_APPLIED"));
  assert("stale schedule is rejected", sql.includes("STALE_SCHEDULE"));
  assert("builder offers one price or specific items", composer.includes("One price for this scope") && composer.includes("Price specific items"));
  assert("pricing apply offers selected schedule items", pricing.includes("Use items in Pricing"));
  assert("server apply stops before pricing changes", apply.includes("scheduleApplyBlock"));
  assert("migration head check is unchanged", head.includes('migrations.at(-1) === "080_project_document_delete.sql"'));
  assert("measured extension rounds to cents", scheduleExtended("m2", 12.5, 48.4) === 605 && scheduleExtended("item", 3, 25.33) === 75.99);
  assert("lump sum ignores quantity", scheduleExtended("lump_sum", 12, 400) === 400);
  const invalid = row("Wall lining", "m2", "0", "required");
  const duplicate = [row("Same scope", "item", "1", "required"), row("Same scope", "item", "1", "optional")];
  assert("invalid quantity and duplicate scope are rejected before send", scheduleProblems([invalid]).length > 0 && scheduleProblems(duplicate).some((problem) => problem.includes("same scope")));
  const mail = buildRfqDeliveryEmail({
    builderName: "Ada Builders",
    contactName: "Bea",
    scopeLabel: "Bathroom",
    responseDueOn: null,
    publicUrl: "https://example.test/r/rfq_example",
    pricingRequest: "schedule",
  });
  assert("schedule email explains the item list and carries no price", mail.text.includes("Price each item on the schedule") && mail.text.includes("https://example.test/r/rfq_example") && !mail.text.includes("$"));
  const lump = buildRfqDeliveryEmail({
    builderName: "Ada Builders",
    contactName: "Bea",
    scopeLabel: "Bathroom",
    responseDueOn: null,
    publicUrl: "https://example.test/r/rfq_example",
  });
  assert("one-price email stays free of a dollar amount", lump.text.includes("one price for the whole scope") && !lump.text.includes("$"));
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
  const password = `schedule-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectId = randomUUID();
  const userIds: string[] = [];

  async function userFor(role: "owner" | "viewer", orgId: string) {
    const email = `schedule-${role}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    userIds.push(created.data.user.id);
    const profile = await admin.from("profiles").upsert({ id: created.data.user.id, org_id: orgId, role, full_name: `Schedule ${role}` });
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
    for (const org of [{ id: orgA, name: `Schedule A ${suffix}` }, { id: orgB, name: `Schedule B ${suffix}` }]) {
      const inserted = await admin.from("organisations").insert(org);
      if (inserted.error) throw new Error(inserted.error.message);
    }
    const owner = await userFor("owner", orgA);
    const viewer = await userFor("viewer", orgA);
    const foreign = await userFor("owner", orgB);
    const project = await admin.from("projects").insert({
      id: projectId, org_id: orgA, created_by: userIds[0], title: `Schedule job ${suffix}`,
      client_name: `Hidden Client ${suffix}`, client_email: `hidden-${suffix}@example.invalid`,
      site_address: "12 Site Road", notes: `Internal note ${suffix}`, stage: "estimate_ready", business_status: "estimate_ready",
    });
    if (project.error) throw new Error(project.error.message);
    const area = await admin.from("work_areas").insert({
      org_id: orgA, project_id: projectId, type: "bathroom", name: "Bathroom", status: "confirmed", sort_order: 1,
    }).select("id").single();
    if (area.error || !area.data) throw new Error(area.error?.message ?? "area");
    const businesses: string[] = [];
    for (const name of ["Complete Co", "Partial Co", "Decline Co"]) {
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
    assert("schedule draft saves", draft.data?.ok === true && typeof draft.data?.id === "string");
    const rfqId = draft.data.id as string;
    const viewerMode = await viewer.rpc("set_rfq_pricing_request_v1", { p_rfq: rfqId, p_mode: "schedule" });
    assert("viewer cannot compose a schedule", viewerMode.data?.error === "FORBIDDEN");
    const mode = await owner.rpc("set_rfq_pricing_request_v1", { p_rfq: rfqId, p_mode: "schedule" });
    assert("owner chooses an item schedule", mode.data?.ok === true);
    const badQuantity = await owner.rpc("save_rfq_schedule_v1", {
      p_rfq: rfqId,
      p_items: [{ id: randomUUID(), scope: "Bad quantity", specification: "", quantity: "0", unit: "m2", role: "required" }],
    });
    const duplicate = await owner.rpc("save_rfq_schedule_v1", {
      p_rfq: rfqId,
      p_items: [
        { id: randomUUID(), scope: "Same wording", specification: "", quantity: "1", unit: "item", role: "required" },
        { id: randomUUID(), scope: "Same wording", specification: "", quantity: "1", unit: "item", role: "optional" },
      ],
    });
    assert("invalid quantity and duplicate rows are rejected", badQuantity.data?.error === "INVALID_INPUT" && duplicate.data?.error === "DUPLICATE_ROW");
    const items = [
      { id: randomUUID(), scope: "Wall lining", specification: "Moisture resistant", quantity: "12.5", unit: "m2", role: "required" },
      { id: randomUUID(), scope: "Access panels", specification: "", quantity: "3", unit: "item", role: "required" },
      { id: randomUUID(), scope: "Site set-up", specification: "", quantity: null, unit: "lump_sum", role: "required" },
      { id: randomUUID(), scope: "Trim", specification: "", quantity: "2", unit: "m", role: "optional" },
      { id: randomUUID(), scope: "Alternative board", specification: "", quantity: null, unit: "lump_sum", role: "alternative" },
    ];
    const savedItems = await owner.rpc("save_rfq_schedule_v1", { p_rfq: rfqId, p_items: items });
    assert("five schedule rows save", savedItems.data?.ok === true && savedItems.data?.count === 5);
    const raw = [generateRfqAccessToken(), generateRfqAccessToken(), generateRfqAccessToken()];
    const recipients = await admin.from("rfq_recipients").select("id, subcontractor_id").eq("rfq_id", rfqId);
    const recipientFor = (businessId: string) => recipients.data?.find((row) => row.subcontractor_id === businessId);
    const sent = await owner.rpc("send_rfq_v1", {
      p_rfq: rfqId,
      p_tokens: businesses.map((id, index) => ({ recipient_id: recipientFor(id)?.id, token_hash: hashRfqAccessToken(raw[index]) })),
    });
    assert("schedule send freezes the request", sent.data?.ok === true);
    const frozen = await admin.from("rfq_schedule_items").update({ scope: "Changed after send" }).eq("rfq_id", rfqId);
    assert("sent rows cannot be edited", Boolean(frozen.error));
    await admin.from("work_areas").update({ name: "Renamed bathroom" }).eq("id", area.data.id);
    const still = await admin.from("rfq_schedule_items").select("scope").eq("rfq_id", rfqId).order("sort_order");
    assert("a later job change does not rewrite the schedule", still.data?.[0]?.scope === "Wall lining");
    const opened = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(raw[0]) });
    const other = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(raw[1]) });
    const openedText = JSON.stringify(opened.data);
    assert(
      "public schedule hides the client and the other business",
      opened.data?.ok === true && opened.data?.schedule?.length === 5 && !openedText.includes("Hidden Client") && !openedText.includes("Partial Co") && !openedText.includes(`Internal note ${suffix}`)
    );
    assert("both recipients see the same item identities", opened.data?.schedule?.[0]?.id === other.data?.schedule?.[0]?.id);
    const requestSentAt = opened.data?.requestSentAt;
    function linesFor(prices: Array<string | null>, reason = "", qualification = "") {
      return items.map((item, index) => {
        const price = prices[index];
        if (price == null && item.role === "required") {
          return { schedule_item_id: item.id, decision: "not_priced", unit_price: null, reason, qualification };
        }
        if (price == null) return { schedule_item_id: item.id, decision: "excluded", unit_price: null, reason: "", qualification };
        return { schedule_item_id: item.id, decision: "priced", unit_price: price, amount: "1.00", reason: "", qualification };
      });
    }
    const complete = await anon.rpc("public_rfq_save_schedule_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[0]),
      p_payload: {
        request_sent_at: requestSentAt,
        gst_treatment: "extra",
        lines: linesFor(["48.40", "25.33", "400", "10", "75"]),
      },
      p_confirm: true,
      p_revise: false,
    });
    const partial = await anon.rpc("public_rfq_save_schedule_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[1]),
      p_payload: {
        request_sent_at: requestSentAt,
        gst_treatment: "extra",
        assumptions: "Weekday access only",
        lines: linesFor(["48.40", null, "400", null, null], "No access", "Subject to access"),
      },
      p_confirm: true,
      p_revise: false,
    });
    assert("complete and partial responses submit", complete.data?.ok === true && partial.data?.ok === true);
    assert(
      "server totals keep optional and alternative amounts out of the base",
      cents(complete.data?.baseExGst) === 108099 && cents(complete.data?.optionalExGst) === 2000 && cents(complete.data?.alternativeExGst) === 7500 && complete.data?.completeness === "complete"
    );
    assert(
      "partial is not a complete comparable total",
      cents(partial.data?.baseExGst) === 100500 && partial.data?.completeness === "partial" && cents(partial.data?.baseExGst) < cents(complete.data?.baseExGst)
    );
    const partialRow = await admin.from("rfq_responses").select("qualified, price_ex_gst").eq("id", partial.data.responseId).single();
    assert("qualification is recorded separately from the total", partialRow.data?.qualified === true);
    const duplicateSubmit = await anon.rpc("public_rfq_save_schedule_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[0]),
      p_payload: { request_sent_at: requestSentAt, gst_treatment: "extra", lines: linesFor(["50", "25.33", "400", null, null]) },
      p_confirm: true,
      p_revise: false,
    });
    const revised = await anon.rpc("public_rfq_save_schedule_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[0]),
      p_payload: { request_sent_at: requestSentAt, gst_treatment: "extra", lines: linesFor(["50", "25.33", "400", null, null]) },
      p_confirm: true,
      p_revise: true,
    });
    const versions = await admin.from("rfq_responses").select("version_number, price_ex_gst, status").eq("recipient_id", recipientFor(businesses[0])?.id).order("version_number");
    assert("repeat without revise is refused and the first version stays", duplicateSubmit.data?.error === "DUPLICATE" && revised.data?.ok === true && cents(versions.data?.[0]?.price_ex_gst) === 108099 && cents(versions.data?.[1]?.price_ex_gst) === 110099);
    const stale = await anon.rpc("public_rfq_save_schedule_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[1]),
      p_payload: { request_sent_at: "2000-01-01T00:00:00.000Z", gst_treatment: "extra", lines: [] },
      p_confirm: true,
      p_revise: true,
    });
    assert("a response for a different schedule time is refused", stale.data?.error === "STALE_SCHEDULE");
    const lumpAttempt = await anon.rpc("public_rfq_save_response_v1", {
      p_token_hash: hashRfqAccessToken(raw[2]),
      p_payload: { price_ex_gst: "1", gst_treatment: "extra", pricing_structure: "lump_sum" },
      p_confirm: true,
      p_revise: false,
    });
    assert("a schedule cannot be answered as one lump price", lumpAttempt.data?.error === "UNAVAILABLE");
    const question = await anon.rpc("public_rfq_clarify_v1", { p_token_hash: hashRfqAccessToken(raw[2]), p_body: "Is the set-up included?" });
    const asked = await admin.from("rfq_clarifications").select("id").eq("recipient_id", recipientFor(businesses[2])?.id).eq("from_recipient", true).maybeSingle();
    const answer = await owner.rpc("answer_rfq_clarification_v1", {
      p_payload: { clarification_id: asked.data?.id, body: "The set-up is a separate item.", audience: "private", scope_unchanged: "true" },
    });
    const decline = await anon.rpc("public_rfq_decline_v1", { p_token_hash: hashRfqAccessToken(raw[2]), p_message: "Fully booked" });
    const declinedState = await admin.from("rfq_recipients").select("response_state").eq("id", recipientFor(businesses[2])?.id).single();
    assert("question, answer, and decline stay distinct", question.data?.ok === true && answer.data?.ok === true && decline.data?.ok === true && declinedState.data?.response_state === "declined");
    const foreignRead = await foreign.from("rfq_schedule_items").select("id").eq("rfq_id", rfqId);
    const viewerRead = await viewer.from("rfq_schedule_items").select("id").eq("rfq_id", rfqId);
    assert("viewer can read and another organisation cannot", (viewerRead.data?.length ?? 0) === 5 && (foreignRead.data?.length ?? 0) === 0);
    const applied = await owner.rpc("apply_rfq_response_to_pricing_v1", { p_payload: { response_id: complete.data.responseId } });
    const pricingItems = await admin.from("pricing_items").select("id", { count: "exact", head: true }).eq("org_id", orgA);
    assert("itemised response is not written into pricing", applied.data?.error === "SCHEDULE_NOT_APPLIED" && (pricingItems.count ?? 0) === 0);
    await owner.rpc("revoke_rfq_recipient_v1", { p_recipient: recipientFor(businesses[1])?.id });
    const revoked = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(raw[1]) });
    assert("revoked link is refused", revoked.data?.error === "UNAVAILABLE");
    await admin.from("rfq_access_tokens").update({ expires_at: "2020-01-01T00:00:00Z" }).eq("token_hash", hashRfqAccessToken(raw[0]));
    const expired = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(raw[0]) });
    assert("expired link is refused", expired.data?.error === "EXPIRED");
  } finally {
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
