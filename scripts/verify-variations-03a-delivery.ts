/**
 * VARIATIONS-03A — issue delivery and secure client view.
 *
 * Run: npx --yes tsx scripts/verify-variations-03a-delivery.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { buildVariationDeliveryEmail } from "../lib/variations/delivery-email";
import {
  generateVariationAccessToken,
  hashVariationAccessToken,
} from "../lib/variations/delivery-token";
import { variationDeliveryListLabel } from "../lib/variations/presentation";
import { cleanupPreviewFixtureOrgs, registerPreviewFixtureOrg } from "./lib/preview-admin-cleanup";
import { assertSafePreviewPasswordMutation, isPasswordProtectedPreviewAccount } from "./lib/preview-auth-fixture";

const root = join(__dirname, "..");
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

type Db = SupabaseClient;
type Rpc = { ok?: boolean; error?: string; deliveryId?: string; status?: string; kind?: string; state?: string; title?: string; revisionNumber?: number; idempotent?: boolean };

function line(unitSell: number, description: string): Record<string, unknown> {
  return {
    itemType: "addition",
    clientDescription: description,
    workAreaId: null,
    snapshotLineId: null,
    stableComponentKey: null,
    quantity: 1,
    unit: "item",
    unitCost: null,
    unitSell,
    sortOrder: 1,
    clientInclusion: null,
    clientExclusion: null,
    substitutionGroupId: null,
    internalMetadata: null,
  };
}

function envValue(): Record<string, string> {
  return Object.fromEntries(
    read(".env.local")
      .split("\n")
      .filter((row) => row && !row.startsWith("#") && row.includes("="))
      .map((row) => {
        const index = row.indexOf("=");
        return [row.slice(0, index), row.slice(index + 1).replace(/^"|"$/g, "")];
      })
  );
}

async function main(): Promise<void> {
  const sql = read("supabase/migrations/069_variation_client_delivery.sql");
  const action = read("lib/variations/delivery-actions.ts");
  const email = read("lib/variations/delivery-email.ts");
  const view = read("components/variations/VariationPublicView.tsx");
  const panel = read("components/variations/VariationDeliveryPanel.tsx");
  const lookupSql = sql.slice(sql.indexOf("lookup_variation_client_by_token_hash_v1"));
  const sample = buildVariationDeliveryEmail({
    companyName: "ERC Contracting",
    clientName: "Ada Client",
    projectTitle: "Deck",
    variationNumber: 4,
    revisionNumber: 2,
    title: "Deck stair addition",
    adjustmentInclGst: 1725,
    publicUrl: "https://example.test/v/vt_example",
    contactEmail: "builder@example.test",
    contactPhone: "021000000",
  });
  const confidential = ["unitCost", "unit_cost", "margin", "profit", "canonicalRateKey", "cost_source", "internalNotes", "internal_notes", "COST"];
  const emailSource = email.replaceAll("margin:", "");
  const emailHtml = sample.html.replaceAll("margin:", "");

  console.log("\nVARIATIONS-03A");
  const env = envValue();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !service || !anonKey) {
    check("hosted Preview credentials", false, "missing env");
    return;
  }
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    check("hosted database is Preview", false, ref);
    return;
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = randomUUID().slice(0, 8);
  const emailA = `hello+variations-03a.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-03ab.${stamp}@erccontracting.co.nz`;
  const password = `Var03A-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(emailA);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectOther = randomUUID();
  registerPreviewFixtureOrg(orgA);
  registerPreviewFixtureOrg(orgB);
  const userIds: string[] = [];

  async function cleanup(): Promise<void> {
    try {
      cleanupPreviewFixtureOrgs([orgA, orgB]);
    } catch (error) {
      console.error("cleanup", error instanceof Error ? error.message : error);
    }
    for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
  }

  try {
    async function userFor(address: string, orgId: string): Promise<Db> {
      const created = await admin.auth.admin.createUser({ email: address, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? address);
      userIds.push(created.data.user.id);
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 03A" });
      if (profile.error) throw new Error(profile.error.message);
      const membership = await admin.from("organisation_memberships").insert({
        org_id: orgId, user_id: created.data.user.id, role: "owner", status: "active", joined_at: new Date().toISOString(),
      });
      if (membership.error) throw new Error(membership.error.message);
      const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const signedIn = await client.auth.signInWithPassword({ email: address, password });
      if (signedIn.error) throw new Error(signedIn.error.message);
      return client;
    }
    const orgs = await admin.from("organisations").insert([
      { id: orgA, name: `Variations 03A ${stamp}` },
      { id: orgB, name: `Variations 03A other ${stamp}` },
    ]);
    if (orgs.error) throw new Error(orgs.error.message);
    const settings = await admin.from("organisation_settings").insert([
      { org_id: orgA, default_margin_percent: 20, default_gst_rate: 15, currency: "NZD", contact_email: "builder@example.test", contact_phone: "021000000" },
      { org_id: orgB, default_margin_percent: 20, default_gst_rate: 15, currency: "NZD" },
    ]);
    if (settings.error) throw new Error(settings.error.message);
    const userA = await userFor(emailA, orgA);
    const userB = await userFor(emailB, orgB);
    const signedOut = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const project = await admin.from("projects").insert([
      { id: projectA, org_id: orgA, created_by: userIds[0], title: `Delivery ${stamp}`, client_name: "Ada Client", client_email: "kept@example.test", stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectOther, org_id: orgA, created_by: userIds[0], title: `Other ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
    ]);
    if (project.error) throw new Error(project.error.message);
    const quoteId = randomUUID();
    const quote = await admin.from("quotes").insert({
      id: quoteId, org_id: orgA, project_id: projectA, created_by: userIds[0],
      title: "Accepted baseline", status: "draft", revision_number: 1,
      subtotal: 10000, gst_rate: 15, gst_amount: 1500, total_incl_gst: 11500,
    });
    if (quote.error) throw new Error(quote.error.message);
    const quoteItem = await admin.from("quote_items").insert({
      org_id: orgA, quote_id: quoteId, project_id: projectA, label: "Accepted work",
      description: "Accepted work", quantity: 1, unit: "ls", unit_price: 10000, total: 10000, sort_order: 1,
    });
    if (quoteItem.error) throw new Error(quoteItem.error.message);
    const accepted = await admin.from("quotes").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", quoteId);
    if (accepted.error) throw new Error(accepted.error.message);

    async function call(client: Db, fn: string, args: Record<string, unknown>): Promise<Rpc> {
      const { data, error } = await client.rpc(fn, args);
      if (error) return { ok: false, error: error.message };
      return (data ?? { ok: false }) as Rpc;
    }
    async function issueVariation(title: string, description: string): Promise<{ variationId: string; revisionId: string }> {
      const draft = await call(userA, "create_draft_variation_v1", {
        p_project: projectA, p_title: title, p_summary: "Client summary", p_idempotency_key: `03a-${title}-${stamp}`,
      });
      if (draft.ok !== true) throw new Error(draft.error ?? "draft");
      const item = await call(userA, "add_draft_variation_item_v1", {
        p_variation: draft.variationId, p_revision: draft.revisionId, p_item: line(1500, description),
      });
      if (item.ok !== true) throw new Error(item.error ?? "item");
      const issued = await call(userA, "issue_variation_revision_v1", {
        p_variation: draft.variationId, p_revision: draft.revisionId,
      });
      if (issued.ok !== true) throw new Error(issued.error ?? "issue");
      return { variationId: String(draft.variationId), revisionId: String(draft.revisionId) };
    }

    const draftOnly = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Still a draft", p_summary: null, p_idempotency_key: `03a-draft-${stamp}`,
    });
    const current = await issueVariation("Deck stair addition", "Client facing stair");
    const withdrawTarget = await issueVariation("Withdraw after send", "Temporary stair");
    const baseline = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst, sell_incl_gst").eq("project_id", projectA).maybeSingle();
    const beforeSell = baseline.data?.sell_ex_gst;
    const stored = await admin.from("variation_revisions").select("title, total_adjustment_incl_gst, status").eq("id", current.revisionId).maybeSingle();

    const draftSend = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: draftOnly.variationId, p_revision: draftOnly.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada Client",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `draft-${stamp}`,
    });
    const crossTenant = await call(userB, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `tenant-${stamp}`,
    });
    const signedOutSend = await call(signedOut, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `signed-out-${stamp}`,
    });
    const crossProject = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectOther, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `project-${stamp}`,
    });

    const rawToken = generateVariationAccessToken();
    const firstKey = `send-${stamp}`;
    const first = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada Client",
      p_token_hash: hashVariationAccessToken(rawToken), p_idempotency_key: firstKey,
    });
    const duplicate = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada Client",
      p_token_hash: hashVariationAccessToken(rawToken), p_idempotency_key: firstKey,
    });
    const failed = await call(userA, "fail_variation_delivery_v1", {
      p_delivery: first.deliveryId, p_code: "provider_unavailable", p_message: "The email service is temporarily unavailable. Try again shortly.",
    });
    const afterFail = await admin.from("variation_revisions").select("status, title, total_adjustment_incl_gst").eq("id", current.revisionId).maybeSingle();
    const eventsAfterFail = await admin.from("project_lifecycle_events").select("event_type").eq("source_entity_id", current.variationId);

    const retryToken = generateVariationAccessToken();
    const retry = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada Client",
      p_token_hash: hashVariationAccessToken(retryToken), p_idempotency_key: `retry-${stamp}`,
    });
    const completed = await call(userA, "complete_variation_delivery_v1", {
      p_delivery: retry.deliveryId, p_provider_message_id: `provider-${stamp}`,
    });
    const afterSend = await admin.from("variation_revisions").select("status, title, total_adjustment_incl_gst").eq("id", current.revisionId).maybeSingle();
    const deliveries = await admin.from("variation_deliveries").select("status, kind, recipient_email").eq("revision_id", current.revisionId);
    const events = await admin.from("project_lifecycle_events").select("event_type").eq("source_entity_id", current.variationId);
    const projectEmail = await admin.from("projects").select("client_email").eq("id", projectA).maybeSingle();
    const publicView = await call(signedOut, "lookup_variation_client_by_token_hash_v1", {
      p_token_hash: hashVariationAccessToken(retryToken),
    });
    const invalid = await call(signedOut, "lookup_variation_client_by_token_hash_v1", {
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()),
    });
    const withOrg = await signedOut.rpc("lookup_variation_client_by_token_hash_v1", {
      p_token_hash: hashVariationAccessToken(retryToken),
      p_org_id: orgB,
    });
    const withOrgBody = (withOrg.data ?? {}) as Rpc;

    const resend = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada Client",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `resend-${stamp}`,
    });
    const resent = await call(userA, "complete_variation_delivery_v1", {
      p_delivery: resend.deliveryId, p_provider_message_id: `provider-resend-${stamp}`,
    });
    const eventsAfterResend = await admin.from("project_lifecycle_events").select("event_type").eq("source_entity_id", current.variationId);
    const deliveriesAfterResend = await admin.from("variation_deliveries").select("status, kind").eq("revision_id", current.revisionId);
    const issuedEvents = (eventsAfterResend.data ?? []).filter((row) => row.event_type === "variation_issued").length;
    const sentEvents = (eventsAfterResend.data ?? []).filter((row) => row.event_type === "variation_sent").length;

    const revised = await call(userA, "create_variation_revision_v1", {
      p_variation: current.variationId, p_revision: current.revisionId,
    });
    const stale = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `stale-${stamp}`,
    });
    const crossed = await call(signedOut, "lookup_variation_client_by_token_hash_v1", {
      p_token_hash: hashVariationAccessToken(retryToken),
    });

    const withdrawToken = generateVariationAccessToken();
    const withdrawBegin = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: withdrawTarget.variationId, p_revision: withdrawTarget.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada Client",
      p_token_hash: hashVariationAccessToken(withdrawToken), p_idempotency_key: `withdraw-send-${stamp}`,
    });
    await call(userA, "complete_variation_delivery_v1", {
      p_delivery: withdrawBegin.deliveryId, p_provider_message_id: `provider-withdraw-${stamp}`,
    });
    const withdrawn = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: withdrawTarget.variationId, p_revision: withdrawTarget.revisionId, p_reason: "Hold this change.",
    });
    const withdrawnSend = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: withdrawTarget.variationId, p_revision: withdrawTarget.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `withdrawn-${stamp}`,
    });
    const withdrawnView = await call(signedOut, "lookup_variation_client_by_token_hash_v1", {
      p_token_hash: hashVariationAccessToken(withdrawToken),
    });
    const afterContract = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst").eq("project_id", projectA).maybeSingle();
    const acceptEvents = await admin.from("project_lifecycle_events").select("id").eq("project_id", projectA).eq("event_type", "variation_accepted");
    const quoteDeliveries = await admin.from("quote_deliveries").select("id").eq("project_id", projectA);
    const tokenRead = await userA.from("variation_access_tokens").select("id");
    const otherDeliveries = await userB.from("variation_deliveries").select("id").eq("org_id", orgA);
    const deliveryCount = (deliveriesAfterResend.data ?? []).length;

    check(
      "1 only issued current revisions are eligible",
      sql.includes("v_rev.status is distinct from 'issued'") &&
        sql.includes("variation_lock_current") &&
        first.ok === true &&
        first.status === "pending" &&
        first.kind === "send" &&
        variationDeliveryListLabel({ status: "issued", latestAttempt: null }) === "Issued · Not sent"
    );
    check("2 draft is rejected", draftSend.ok !== true && draftSend.error === "DRAFT");
    check("3 withdrawn is rejected", withdrawn.ok === true && withdrawnSend.ok !== true && withdrawnSend.error === "WITHDRAWN");
    check("4 stale revision is rejected", revised.ok === true && stale.ok !== true && stale.error === "STALE_REVISION");
    check(
      "5 first send creates one successful delivery and one first-send milestone",
      completed.ok === true &&
        completed.kind === "send" &&
        (deliveries.data ?? []).filter((row) => row.status === "sent" && row.kind === "send").length === 1 &&
        (events.data ?? []).filter((row) => row.event_type === "variation_sent").length === 1
    );
    check(
      "6 resend creates a delivery attempt but no second milestone",
      resend.kind === "resend" && resent.ok === true && sentEvents === 1 && issuedEvents === 1
    );
    check(
      "7 provider failure records failed and keeps revision issued",
      failed.ok === true &&
        failed.status === "failed" &&
        afterFail.data?.status === "issued" &&
        (eventsAfterFail.data ?? []).filter((row) => row.event_type === "variation_sent").length === 0
    );
    check("8 retry can later succeed", retry.ok === true && completed.status === "sent" && afterSend.data?.status === "issued");
    check(
      "9 immutable revision snapshot is used",
      stored.data?.title === "Deck stair addition" &&
        afterSend.data?.title === stored.data?.title &&
        afterSend.data?.total_adjustment_incl_gst === stored.data?.total_adjustment_incl_gst &&
        action.includes("total_adjustment_incl_gst") &&
        !action.includes("p_total")
    );
    check(
      "10 email recipient and content are correct",
      sample.subject === "Variation 4 — Deck" &&
        sample.text.includes("Ada Client") &&
        sample.text.includes("ERC Contracting") &&
        sample.text.includes("Revision 2") &&
        sample.text.includes("Deck stair addition") &&
        sample.text.includes("View Variation") &&
        sample.text.includes("has not yet been accepted") &&
        panel.includes("Send to client") &&
        panel.includes("Send Variation") &&
        (deliveries.data ?? []).some((row) => row.recipient_email === "client@example.test")
    );
    check(
      "11 email has no confidential commercial fields",
      confidential.every((field) => !sample.text.includes(field) && !emailHtml.includes(field) && !emailSource.includes(field))
    );
    check(
      "12 public view uses the exact issued revision",
      publicView.ok === true &&
        publicView.state === "proposed" &&
        publicView.title === "Deck stair addition" &&
        publicView.revisionNumber === 1 &&
        !JSON.stringify(publicView).includes("unitCost") &&
        !JSON.stringify(publicView).includes("internalNotes")
    );
    check(
      "13 public view has no acceptance controls",
      view.includes("Proposed Variation — awaiting response") &&
        view.includes("Client response will be available in the next Variation stage.") &&
        !view.includes(">Accept<") &&
        !view.includes(">Decline<")
    );
    check(
      "14 invalid token is generic",
      invalid.ok !== true && invalid.error === "NOT_FOUND" && view.includes("This Variation is unavailable.")
    );
    check(
      "15 withdrawn link is non-actionable",
      withdrawnView.ok === true &&
        withdrawnView.state === "withdrawn" &&
        !JSON.stringify(withdrawnView).includes("totalAdjustmentInclGst") &&
        view.includes("This Variation has been withdrawn. Contact the builder if you received this link in error.")
    );
    check(
      "16 cross-tenant and signed-out internal calls fail",
      crossTenant.ok !== true &&
        signedOutSend.ok !== true &&
        (tokenRead.error != null) &&
        (otherDeliveries.data ?? []).length === 0
    );
    check(
      "17 public token cannot cross revisions or projects",
      lookupSql.includes("p_token_hash text") &&
        !lookupSql.slice(0, lookupSql.indexOf("returns jsonb")).includes("p_org") &&
        (withOrg.error != null || (withOrgBody.title === "Deck stair addition" && withOrgBody.revisionNumber === 1)) &&
        crossed.ok !== true &&
        crossed.state !== "proposed" &&
        crossProject.error === "CROSS_PROJECT"
    );
    check(
      "18 existing accepted contract remains unchanged",
      beforeSell != null && afterContract.data?.sell_ex_gst === beforeSell && (acceptEvents.data ?? []).length === 0
    );
    check(
      "19 proposed contract remains proposed",
      afterSend.data?.status === "issued" &&
        projectEmail.data?.client_email === "kept@example.test" &&
        (quoteDeliveries.data ?? []).length === 0
    );
    check(
      "20 delivery analytics distinguish first send from resend",
      variationDeliveryListLabel({ status: "issued", latestAttempt: "sent" }) === "Issued · Sent" &&
        variationDeliveryListLabel({ status: "issued", latestAttempt: "failed" }) === "Issued · Delivery failed" &&
        variationDeliveryListLabel({ status: "withdrawn", latestAttempt: null }) === "Withdrawn" &&
        sentEvents === 1 &&
        resent.kind === "resend" &&
        deliveryCount >= 3 &&
        duplicate.idempotent === true,
      JSON.stringify({ sentEvents, kind: resent.kind, deliveryCount, idempotent: duplicate.idempotent })
    );
  } catch (error) {
    check("hosted delivery proof", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
