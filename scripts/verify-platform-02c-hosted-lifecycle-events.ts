/**
 * PLATFORM-02C — hosted quote create, revision, send and acceptance
 * write the project lifecycle ledger.
 *
 * Send success is send_quote_revision_v1: the quote status becomes sent and
 * quote_events records quote_sent once. Email resend does not call that RPC
 * again. Provider failure after a successful issue leaves the quote sent;
 * a failed issue RPC writes no quote_sent event.
 *
 * Run: npx --yes tsx scripts/verify-platform-02c-hosted-lifecycle-events.ts
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { CLADDING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/cladding-portions";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import {
  adoptHostedQuoteMilestone,
  QUOTE_CONVERSION_DEFINITION,
  readLifecycleAnalytics,
  type ProjectLifecycleEvent,
} from "../lib/projects/lifecycle-foundation";
import {
  assertSafePreviewPasswordMutation,
  isPasswordProtectedPreviewAccount,
} from "./lib/preview-auth-fixture";

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
  return readFileSync(join(root, path), "utf8");
}

function parseEnv(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
        })
    );
  } catch {
    return {};
  }
}

function event(partial: Partial<ProjectLifecycleEvent> & Pick<ProjectLifecycleEvent, "eventType" | "projectId" | "idempotencyKey">): ProjectLifecycleEvent {
  return {
    id: partial.idempotencyKey,
    orgId: "org",
    actorUserId: "user",
    displayCopy: partial.eventType,
    occurredAt: "2026-09-26T00:00:00.000Z",
    sourceEntityType: "quote",
    sourceEntityId: "quote",
    metadata: {},
    schemaVersion: 1,
    ...partial,
  };
}

function sourceChecks(): void {
  const actions = read("lib/quotes/actions.ts");
  const txn = read("supabase/migrations/041_quote_transaction.sql");
  const delivery = read("supabase/migrations/042_quote_delivery.sql");
  const accept = read("supabase/migrations/044_quote_acceptance.sql");
  const foundation = read("supabase/migrations/058_project_lifecycle_foundation.sql");
  const bridge = read("supabase/migrations/059_hosted_lifecycle_event_adoption.sql");
  const fixtureCleanup = read("supabase/migrations/060_preview_lifecycle_fixture_cleanup.sql");

  console.log("\nA–D. Creation paths");
  check(
    "A hosted create calls insert_draft_quote_v1 after ownership checks",
    actions.includes("INSERT_DRAFT_QUOTE_RPC") &&
      actions.indexOf("assertOrgOwnsActiveProject") < actions.indexOf("INSERT_DRAFT_QUOTE_RPC")
  );
  const draftRpc = txn.slice(txn.indexOf("function public.insert_draft_quote_v1"));
  check(
    "A draft RPC writes the quote, then items, then quote_created",
    draftRpc.indexOf("insert into public.quotes") <
      draftRpc.indexOf("perform public.quote_txn_insert_items") &&
      draftRpc.indexOf("perform public.quote_txn_insert_items") <
        draftRpc.indexOf("'quote_created'")
  );
  check(
    "B revision RPC writes items, then quote_revision_created",
    txn.includes("quote_revision_created") &&
      actions.includes("CREATE_QUOTE_REVISION_RPC")
  );
  check(
    "C bridge maps create and revision onto quote_created",
    bridge.includes("quote_revision_created") &&
      bridge.includes("v_type := 'quote_created'")
  );
  check(
    "C event metadata is quote id and revision only",
    bridge.includes("'quoteId', new.quote_id") &&
      bridge.includes("'revisionNumber', v_revision") &&
      !bridge.toLowerCase().includes("direct_cost") &&
      !bridge.toLowerCase().includes("margin")
  );
  check(
    "D creation idempotency key is one per quote revision",
    bridge.includes("v_type || ':' || new.quote_id::text") &&
      bridge.includes("on conflict (org_id, idempotency_key) do nothing")
  );
  const created = adoptHostedQuoteMilestone([], {
    succeeded: true,
    quoteEventType: "quote_created",
    orgId: "org",
    projectId: "project",
    quoteId: "q1",
    revisionNumber: 1,
    actorUserId: "user",
    occurredAt: "2026-09-26T00:00:00.000Z",
  });
  const retried = adoptHostedQuoteMilestone(created, {
    succeeded: true,
    quoteEventType: "quote_created",
    orgId: "org",
    projectId: "project",
    quoteId: "q1",
    revisionNumber: 1,
    actorUserId: "user",
    occurredAt: "2026-09-26T00:01:00.000Z",
  });
  const revision = adoptHostedQuoteMilestone(retried, {
    succeeded: true,
    quoteEventType: "quote_revision_created",
    orgId: "org",
    projectId: "project",
    quoteId: "q2",
    revisionNumber: 2,
    actorUserId: "user",
    occurredAt: "2026-09-26T00:02:00.000Z",
  });
  const failed = adoptHostedQuoteMilestone(revision, {
    succeeded: false,
    quoteEventType: "quote_created",
    orgId: "org",
    projectId: "project",
    quoteId: "q3",
    revisionNumber: 3,
    actorUserId: "user",
    occurredAt: "2026-09-26T00:03:00.000Z",
  });
  check("D retry of revision 1 does not add a second event", retried.length === 1);
  check("B revision 2 is a separate quote_created event", revision.length === 2 && revision[1].sourceEntityId === "q2");
  check("H failed creation adds no event", failed.length === 2);

  console.log("\nE–H. Send and resend");
  check(
    "E first email send calls send_quote_revision_v1",
    actions.includes("SEND_QUOTE_REVISION_RPC") &&
      actions.includes('const kind = isFirstSend ? "send" : "resend"')
  );
  check(
    "E send RPC writes quote_sent only when status moves from draft",
    txn.includes("if v_quote.status = 'sent'") &&
      txn.includes("'quote_sent'")
  );
  check(
    "G resend branch does not call the send RPC before the provider",
    actions.includes("if (isFirstSend)") &&
      actions.includes('kind === "resend"')
  );
  check(
    "H failed delivery RPC does not append quote_sent",
    delivery.includes("fail_quote_delivery_v1") &&
      !delivery.slice(delivery.indexOf("function public.fail_quote_delivery_v1")).includes("'quote_sent'")
  );
  const sent = adoptHostedQuoteMilestone(revision, {
    succeeded: true,
    quoteEventType: "quote_sent",
    orgId: "org",
    projectId: "project",
    quoteId: "q1",
    revisionNumber: 1,
    actorUserId: "user",
    occurredAt: "2026-09-26T01:00:00.000Z",
  });
  const resent = adoptHostedQuoteMilestone(sent, {
    succeeded: true,
    quoteEventType: "quote_sent",
    orgId: "org",
    projectId: "project",
    quoteId: "q1",
    revisionNumber: 1,
    actorUserId: "user",
    occurredAt: "2026-09-26T02:00:00.000Z",
  });
  const sendFailed = adoptHostedQuoteMilestone(resent, {
    succeeded: false,
    quoteEventType: "quote_sent",
    orgId: "org",
    projectId: "project",
    quoteId: "q9",
    revisionNumber: 9,
    actorUserId: "user",
    occurredAt: "2026-09-26T03:00:00.000Z",
  });
  check("F send event points at the quote revision", sent.some((row) => row.eventType === "quote_sent" && row.metadata.revisionNumber === 1 && row.sourceEntityId === "q1"));
  check("G resend does not add a second milestone", resent.filter((row) => row.eventType === "quote_sent").length === 1);
  check("H failed send adds no milestone", sendFailed.length === resent.length);

  console.log("\nI–O. Acceptance and rejection");
  check(
    "I acceptance still uses accept_quote_revision_v1 and the snapshot trigger",
    accept.includes("accept_quote_revision_v1") &&
      foundation.includes("quotes_capture_accepted_commercial_snapshot") &&
      !bridge.includes("accept_quote_revision_v1")
  );
  check(
    "J acceptance event key stays one per quote",
    foundation.includes("'quote_accepted:' || new.id::text")
  );
  check(
    "K acceptance RPC returns idempotent when already accepted",
    accept.includes("'idempotent', true") && accept.includes("v_quote.status = 'accepted'")
  );
  check(
    "L superseded status cannot be accepted",
    accept.includes("v_quote.status not in ('sent', 'viewed')")
  );
  check(
    "M quote RPC requires the project to belong to the session organisation",
    txn.includes("id = v_project and org_id = v_org")
  );
  check(
    "N session organisation comes from auth_org_id, not the payload",
    txn.includes("v_org uuid := public.auth_org_id()") &&
      !txn.includes("p_org_id")
  );
  check(
    "O unauthenticated quote RPC fails closed",
    txn.includes("QUOTE_TXN:NOT_AUTHENTICATED")
  );

  console.log("\nP–W. Projection, analytics, safety");
  check(
    "P estimating projects are not moved to quote sent by the create bridge",
    bridge.includes("v_business is distinct from 'estimate_ready'") &&
      bridge.includes("'quote_accepted', 'active_job', 'completed', 'cancelled'")
  );
  check(
    "Q business_status updates remain in the existing actions",
    actions.includes('"quote_draft"') && actions.includes('"quote_sent"')
  );
  check(
    "U bridge does not backfill existing quote rows",
    !/insert into public\.project_lifecycle_events[\s\S]*select[\s\S]*from public\.quotes/i.test(bridge) &&
      bridge.includes("after insert on public.quote_events")
  );
  check(
    "V bridge does not call calculators or rate lookup",
    !bridge.includes("calculateDeck") && !bridge.includes("from public.rates")
  );
  check(
    "W client metadata has no cost",
    !bridge.toLowerCase().includes("cost")
  );
  const sentTwice = adoptHostedQuoteMilestone(sent, {
    succeeded: true,
    quoteEventType: "quote_sent",
    orgId: "org",
    projectId: "project",
    quoteId: "q2",
    revisionNumber: 2,
    actorUserId: "user",
    occurredAt: "2026-09-26T04:00:00.000Z",
  });
  const acceptedEvent = event({
    eventType: "quote_accepted",
    projectId: "project",
    idempotencyKey: "quote_accepted:q2",
  });
  const analytics = readLifecycleAnalytics({
    events: [...sentTwice, acceptedEvent],
    snapshots: [
      {
        id: "snap",
        orgId: "org",
        projectId: "project",
        quoteId: "q2",
        revisionNumber: 2,
        currency: "NZD",
        gstRate: 15,
        taxTreatment: "exclusive",
        directCostTotal: null,
        sellExGst: 100,
        gstAmount: 15,
        sellInclGst: 115,
        targetMargin: null,
        effectiveMargin: null,
        acceptedAt: "2026-09-26T05:00:00.000Z",
        acceptingPartyLabel: null,
        acceptanceSource: "manual",
        inclusions: [],
        exclusions: [],
        scopeSummary: null,
        lines: [],
      },
    ],
  });
  check("R created, first-send and accepted counts", analytics.quoteCreatedCount === 2 && analytics.firstSendCount === 2 && analytics.quoteAcceptedCount === 1);
  check("S two revisions of one project do not double the conversion denominator", analytics.sentProjectCount === 1 && analytics.acceptedBaselineCount === 1 && analytics.quoteConversion === 1);
  check("S conversion definition excludes resends", QUOTE_CONVERSION_DEFINITION.includes("quote_sent"));
  check("R empty conversion stays null and revenue is not profit", readLifecycleAnalytics({ events: [], snapshots: [] }).quoteConversion === null && !("profit" in analytics));
  check("T lifecycle events stay append-only in 058", foundation.includes("project_lifecycle_events_immutable"));
  check(
    "T fixture delete is name-gated and updates stay forbidden",
    fixtureCleanup.includes("tg_op = 'DELETE'") &&
      fixtureCleanup.includes("PLATFORM-02C %") &&
      fixtureCleanup.includes("quote_events are append-only") &&
      !fixtureCleanup.includes("set_config('session_replication_role'")
  );
  check(
    "R frozen work areas stay frozen",
    DOORS_V1_HUMAN_QA_FROZEN === true &&
      FLOORING_V1_HUMAN_QA_FROZEN === true &&
      CLADDING_V1_HUMAN_QA_FROZEN === true
  );
}

type Db = SupabaseClient;

async function hostedProof(): Promise<void> {
  console.log("\nHosted Preview proof");
  const env = parseEnv(join(root, ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !service || !anon) {
    check("hosted Preview credentials", false, "missing env");
    return;
  }
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  check("hosted database is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF, ref);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) return;

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = randomUUID().slice(0, 8);
  const email = `hello+platform-02c.${stamp}@erccontracting.co.nz`;
  const password = `Life02c-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(email);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(email));

  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectEstimating = randomUUID();
  const projectB = randomUUID();
  let userId = "";

  async function cleanup(): Promise<void> {
    const removedA = await admin.rpc("preview_lifecycle_fixture_cleanup", { p_org: orgA });
    const removedB = await admin.rpc("preview_lifecycle_fixture_cleanup", { p_org: orgB });
    if (removedA.error) console.error("cleanup org A", removedA.error.message);
    if (removedB.error) console.error("cleanup org B", removedB.error.message);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      check("hosted user", false, created.error?.message ?? "createUser");
      return;
    }
    userId = created.data.user.id;
    const orgInsert = await admin.from("organisations").insert([
      { id: orgA, name: `PLATFORM-02C ${stamp}` },
      { id: orgB, name: `PLATFORM-02C other ${stamp}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    await admin.from("profiles").insert({
      id: userId,
      org_id: orgA,
      role: "owner",
      full_name: "Platform 02C",
    });
    await admin.from("organisation_memberships").insert({
      org_id: orgA,
      user_id: userId,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });
    await admin.from("organisation_settings").insert({
      org_id: orgA,
      default_margin_percent: 20,
      default_gst_rate: 15,
      currency: "NZD",
    });
    const projects = await admin.from("projects").insert([
      {
        id: projectA,
        org_id: orgA,
        created_by: userId,
        title: `Lifecycle ${stamp}`,
        stage: "estimate_ready",
        business_status: "estimate_ready",
      },
      {
        id: projectEstimating,
        org_id: orgA,
        created_by: userId,
        title: `Estimating ${stamp}`,
        stage: "brief",
        business_status: "estimating",
      },
      {
        id: projectB,
        org_id: orgB,
        created_by: userId,
        title: `Other ${stamp}`,
        stage: "estimate_ready",
        business_status: "estimate_ready",
      },
    ]);
    if (projects.error) throw new Error(projects.error.message);

    const user = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await user.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(signedIn.error.message);

    const anonClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedOut = await anonClient.rpc("insert_draft_quote_v1", {
      p_payload: quotePayload(projectA),
    });
    check("O unauthenticated create fails", Boolean(signedOut.error));

    const crossTenant = await user.rpc("insert_draft_quote_v1", {
      p_payload: quotePayload(projectB),
    });
    check("N cross-tenant create fails", Boolean(crossTenant.error));

    const draft = await user.rpc("insert_draft_quote_v1", {
      p_payload: quotePayload(projectA),
    });
    const quote1 = rpcId(draft.data);
    check("A hosted revision 1 is created", !draft.error && Boolean(quote1), draft.error?.message ?? "");
    if (!quote1) return;

    const items = await admin
      .from("quote_items")
      .select("id")
      .eq("quote_id", quote1)
      .eq("org_id", orgA);
    check("A quote items exist before the lifecycle event is trusted", (items.data ?? []).length === 1);
    let events = await lifecycleEvents(admin, orgA, projectA);
    check("C exactly one quote_created for revision 1", count(events, "quote_created", quote1) === 1);
    check(
      "C created event is safe",
      events.some(
        (row) =>
          row.event_type === "quote_created" &&
          row.source_entity_type === "quote" &&
          row.source_entity_id === quote1 &&
          row.actor_user_id === userId &&
          row.schema_version === 1 &&
          row.metadata?.revisionNumber === 1 &&
          !("cost" in (row.metadata ?? {}))
      )
    );
    const position = await stage(admin, projectA);
    check("P pricing project becomes quote draft", position === "quote_draft");

    const estimating = await user.rpc("insert_draft_quote_v1", {
      p_payload: quotePayload(projectEstimating),
    });
    check("P estimating create does not become sent", !estimating.error && (await stage(admin, projectEstimating)) !== "quote_sent");

    const issuer = { organisationName: "PLATFORM-02C" };
    const sent = await user.rpc("send_quote_revision_v1", {
      p_quote_id: quote1,
      p_issuer_snapshot: issuer,
      p_snapshot_fingerprint: `fp-${stamp}-1`,
      p_fingerprint_version: "v1",
    });
    check("E hosted send succeeds", !sent.error && sent.data?.status === "sent", sent.error?.message ?? "");
    events = await lifecycleEvents(admin, orgA, projectA);
    check("F exactly one quote_sent for revision 1", count(events, "quote_sent", quote1) === 1);
    check("P send moves the position to quote sent", (await stage(admin, projectA)) === "quote_sent");

    const resent = await user.rpc("send_quote_revision_v1", {
      p_quote_id: quote1,
      p_issuer_snapshot: issuer,
      p_snapshot_fingerprint: `fp-${stamp}-1`,
      p_fingerprint_version: "v1",
    });
    events = await lifecycleEvents(admin, orgA, projectA);
    check("G resend is idempotent and does not add a milestone", resent.data?.idempotent === true && count(events, "quote_sent", quote1) === 1);

    const revised = await user.rpc("create_quote_revision_v1", {
      p_source_quote_id: quote1,
      p_payload: {
        quote: quoteFields(),
        items: [quoteItem()],
      },
    });
    const quote2 = rpcId(revised.data);
    check("B revision 2 is a new quote", !revised.error && Boolean(quote2) && quote2 !== quote1, revised.error?.message ?? "");
    if (!quote2) return;
    events = await lifecycleEvents(admin, orgA, projectA);
    check("B revision 2 has its own quote_created", count(events, "quote_created", quote2) === 1 && count(events, "quote_created", quote1) === 1);

    const revisedAgain = await user.rpc("create_quote_revision_v1", {
      p_source_quote_id: quote1,
      p_payload: {
        quote: quoteFields(),
        items: [quoteItem()],
      },
    });
    events = await lifecycleEvents(admin, orgA, projectA);
    check("D revision retry returns the open draft and no extra event", revisedAgain.data?.idempotent === true && revisedAgain.data?.quoteId === quote2 && count(events, "quote_created", quote2) === 1);

    const sent2 = await user.rpc("send_quote_revision_v1", {
      p_quote_id: quote2,
      p_issuer_snapshot: issuer,
      p_snapshot_fingerprint: `fp-${stamp}-2`,
      p_fingerprint_version: "v1",
    });
    check("E revision 2 send succeeds", !sent2.error && sent2.data?.status === "sent", sent2.error?.message ?? "");
    const quote1Row = await admin.from("quotes").select("status").eq("id", quote1).single();
    check("L revision 1 is superseded", quote1Row.data?.status === "superseded");
    events = await lifecycleEvents(admin, orgA, projectA);
    check("F revision 2 has its own quote_sent", count(events, "quote_sent", quote2) === 1 && count(events, "quote_sent", quote1) === 1);

    const stale = await user.rpc("accept_quote_revision_v1", { p_quote_id: quote1 });
    check("L stale revision cannot be accepted", Boolean(stale.error));

    const accepted = await user.rpc("accept_quote_revision_v1", { p_quote_id: quote2 });
    check("I acceptance succeeds", !accepted.error && accepted.data?.status === "accepted", accepted.error?.message ?? "");
    const snaps = await admin
      .from("accepted_commercial_snapshots")
      .select("id, quote_id, sell_ex_gst, direct_cost_total")
      .eq("project_id", projectA);
    events = await lifecycleEvents(admin, orgA, projectA);
    check("I one snapshot for the accepted revision", (snaps.data ?? []).length === 1 && snaps.data?.[0]?.quote_id === quote2);
    check("J one quote_accepted event", count(events, "quote_accepted", quote2) === 1);
    check("V snapshot does not invent direct cost", snaps.data?.[0]?.direct_cost_total == null);
    check("P acceptance does not activate the job", (await stage(admin, projectA)) === "quote_accepted");

    const acceptedAgain = await user.rpc("accept_quote_revision_v1", { p_quote_id: quote2 });
    const snapsAgain = await admin
      .from("accepted_commercial_snapshots")
      .select("id")
      .eq("project_id", projectA);
    events = await lifecycleEvents(admin, orgA, projectA);
    check("K retry acceptance is idempotent", acceptedAgain.data?.idempotent === true && (snapsAgain.data ?? []).length === 1 && count(events, "quote_accepted", quote2) === 1);

    const afterAccept = await user.rpc("create_quote_revision_v1", {
      p_source_quote_id: quote2,
      p_payload: { quote: quoteFields(), items: [quoteItem()] },
    });
    const snapsAfter = await admin
      .from("accepted_commercial_snapshots")
      .select("id, quote_id")
      .eq("project_id", projectA);
    check(
      "P a later revision does not replace the accepted baseline",
      !afterAccept.error &&
        (snapsAfter.data ?? []).length === 1 &&
        snapsAfter.data?.[0]?.quote_id === quote2 &&
        (await stage(admin, projectA)) === "quote_accepted"
    );

    const loaded = await lifecycleEvents(admin, orgA, projectA);
    const analytics = readLifecycleAnalytics({
      events: loaded.map((row) => ({
        id: row.id,
        orgId: row.org_id,
        projectId: row.project_id,
        actorUserId: row.actor_user_id,
        eventType: row.event_type,
        displayCopy: row.event_type,
        occurredAt: row.occurred_at,
        sourceEntityType: row.source_entity_type,
        sourceEntityId: row.source_entity_id,
        idempotencyKey: row.idempotency_key,
        metadata: row.metadata ?? {},
        schemaVersion: row.schema_version,
      })),
      snapshots: [
        {
          id: snaps.data?.[0]?.id ?? "snap",
          orgId: orgA,
          projectId: projectA,
          quoteId: quote2,
          revisionNumber: 2,
          currency: "NZD",
          gstRate: 15,
          taxTreatment: "exclusive",
          directCostTotal: null,
          sellExGst: Number(snaps.data?.[0]?.sell_ex_gst),
          gstAmount: 15,
          sellInclGst: 115,
          targetMargin: null,
          effectiveMargin: null,
          acceptedAt: "2026-09-26T00:00:00.000Z",
          acceptingPartyLabel: null,
          acceptanceSource: "manual",
          inclusions: [],
          exclusions: [],
          scopeSummary: null,
          lines: [],
        },
      ],
    });
    check("R hosted first-send count is two revisions, not resends", analytics.firstSendCount === 2 && analytics.quoteCreatedCount >= 2);
    check("S hosted conversion denominator is one project", analytics.sentProjectCount === 1 && analytics.quoteConversion === 1);
  } finally {
    await cleanup();
    const left = await admin.from("organisations").select("id").eq("id", orgA);
    check("hosted fixture removed", (left.data ?? []).length === 0);
  }
}

function quoteItem() {
  return {
    label: "Hardwood decking",
    description: "Hardwood decking",
    quantity: 1,
    unit: "m2",
    unit_price: 100,
    total: 100,
    visible: true,
    optional: false,
    sort_order: 1,
  };
}

function quoteFields() {
  return {
    title: "Quote",
    subtotal: 100,
    gst_rate: 15,
    gst_amount: 15,
    total_incl_gst: 115,
  };
}

function quotePayload(projectId: string) {
  return {
    projectId,
    quote: quoteFields(),
    items: [quoteItem()],
  };
}

function rpcId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const id = (data as { quoteId?: unknown }).quoteId;
  return typeof id === "string" ? id : null;
}

type LifecycleRow = {
  id: string;
  org_id: string;
  project_id: string;
  actor_user_id: string | null;
  event_type: "quote_created" | "quote_sent" | "quote_accepted";
  occurred_at: string;
  source_entity_type: string;
  source_entity_id: string;
  idempotency_key: string;
  metadata: { quoteId?: string; revisionNumber?: number; cost?: unknown } | null;
  schema_version: number;
};

async function lifecycleEvents(admin: Db, orgId: string, projectId: string): Promise<LifecycleRow[]> {
  const { data } = await admin
    .from("project_lifecycle_events")
    .select("id, org_id, project_id, actor_user_id, event_type, occurred_at, source_entity_type, source_entity_id, idempotency_key, metadata, schema_version")
    .eq("org_id", orgId)
    .eq("project_id", projectId);
  return (data ?? []) as LifecycleRow[];
}

function count(rows: LifecycleRow[], type: string, quoteId: string): number {
  return rows.filter((row) => row.event_type === type && row.source_entity_id === quoteId).length;
}

async function stage(admin: Db, projectId: string): Promise<string | null> {
  const { data } = await admin
    .from("project_lifecycle_positions")
    .select("stage")
    .eq("project_id", projectId)
    .maybeSingle();
  return (data?.stage as string | undefined) ?? null;
}

async function main(): Promise<void> {
  sourceChecks();
  await hostedProof();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
