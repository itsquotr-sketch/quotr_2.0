/**
 * PLATFORM-02D — Preview fixture cleanup must not be product authorisation.
 *
 * 060 and 061 stay in history. 062 restores append-only quote triggers and
 * drops the name-gated cleanup functions. Verifiers delete explicit Preview
 * organisation UUIDs through scripts/lib/preview-admin-cleanup.ts.
 *
 * Run: npx --yes tsx scripts/verify-platform-02d-lifecycle-migration-hygiene.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readLifecycleAnalytics } from "../lib/projects/lifecycle-foundation";
import {
  assertExplicitCleanupTargets,
  cleanupPreviewFixtureOrgs,
  isRegisteredPreviewFixtureOrg,
  queryPreviewRows,
  registerPreviewFixtureOrg,
} from "./lib/preview-admin-cleanup";
import {
  assertSafePreviewPasswordMutation,
  isPasswordProtectedPreviewAccount,
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
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

function sqlFiles(): string[] {
  return readdirSync(join(root, "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function sourceText(dir: string): string {
  const full = join(root, dir);
  const parts: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (/\.(ts|tsx|js|mjs|sql)$/.test(entry)) {
        parts.push(readFileSync(path, "utf8"));
      }
    }
  };
  walk(full);
  return parts.join("\n");
}

function sourceChecks(): void {
  const m060 = read("supabase/migrations/060_preview_lifecycle_fixture_cleanup.sql");
  const m061 = read("supabase/migrations/061_preview_lifecycle_fixture_cleanup_order.sql");
  const m062 = read("supabase/migrations/062_remove_preview_lifecycle_cleanup.sql");
  const m041 = read("supabase/migrations/041_quote_transaction.sql");
  const m042 = read("supabase/migrations/042_quote_delivery.sql");
  const m044 = read("supabase/migrations/044_quote_acceptance.sql");
  const m058 = read("supabase/migrations/058_project_lifecycle_foundation.sql");
  const cleanup = read("scripts/lib/preview-admin-cleanup.ts");
  const dbTarget = read("scripts/db-target.mjs");
  const historical = new Set([
    "059_hosted_lifecycle_event_adoption.sql",
    "060_preview_lifecycle_fixture_cleanup.sql",
    "061_preview_lifecycle_fixture_cleanup_order.sql",
  ]);
  const otherSql = sqlFiles()
    .filter((name) => !historical.has(name) && name !== "062_remove_preview_lifecycle_cleanup.sql")
    .map((name) => read(`supabase/migrations/${name}`))
    .join("\n");
  const application = `${sourceText("lib")}\n${sourceText("app")}`;

  console.log("\nA–B. 060 and 061 inventory");
  check(
    "A 060 adds the name-gated org predicate and cleanup function",
    m060.includes("function public.preview_fixture_org") &&
      m060.includes("function public.preview_lifecycle_fixture_cleanup") &&
      m060.includes("grant execute on function public.preview_fixture_org(uuid) to service_role") &&
      m060.includes("grant execute on function public.preview_lifecycle_fixture_cleanup(uuid) to service_role")
  );
  check(
    "A 060 opens delete exceptions on quote events, acceptance evidence and items",
    m060.includes("function public.enforce_quote_events_append_only") &&
      m060.includes("function public.enforce_quote_acceptance_evidence_append_only") &&
      m060.includes("function public.prevent_quote_item_snapshot_mutation") &&
      m060.includes("preview_fixture_org(old.org_id)")
  );
  check(
    "A 060 adds no table, trigger or policy",
    !/create table/i.test(m060) && !/create trigger/i.test(m060) && !/create policy/i.test(m060)
  );
  check(
    "B 061 only replaces the cleanup function and its delete order",
    m061.includes("function public.preview_lifecycle_fixture_cleanup") &&
      m061.includes("p.created_by in") &&
      (m061.match(/create or replace function/g) ?? []).length === 1 &&
      !/create trigger/i.test(m061)
  );

  console.log("\nC–E. 062 neutralisation");
  check(
    "C 062 restores append-only quote events and acceptance evidence",
    m062.includes("raise exception 'quote_events are append-only'") &&
      m062.includes("raise exception 'quote acceptance evidence is append-only'") &&
      !m062.includes("preview_fixture_org(old.org_id)")
  );
  check(
    "C 062 restores the delivery item trigger, including the send lock",
    m062.includes("QUOTE_TXN:SEND_IN_PROGRESS") &&
      m062.includes("Quote items are immutable once the quote is no longer a draft")
  );
  check(
    "C 062 drops both preview functions if they exist",
    m062.includes("drop function if exists public.preview_lifecycle_fixture_cleanup(uuid)") &&
      m062.includes("drop function if exists public.preview_fixture_org(uuid)")
  );
  check(
    "D 062 has no organisation-name authorisation",
    !m062.toLowerCase().includes("platform-02c") && !/name like/i.test(m062)
  );
  check(
    "E application code has no preview cleanup rule",
    !application.includes("PLATFORM-02C") &&
      !application.includes("preview_lifecycle_fixture") &&
      !application.includes("preview_fixture_org")
  );
  check(
    "E other migrations do not keep the preview rule",
    !otherSql.includes("PLATFORM-02C") &&
      !otherSql.includes("preview_lifecycle_fixture") &&
      !otherSql.includes("preview_fixture_org")
  );
  check(
    "E verifier cleanup does not authorise by name",
    !cleanup.includes("PLATFORM-02C") &&
      !cleanup.includes("preview_lifecycle_fixture") &&
      cleanup.includes("organisation was not created by this verifier")
  );

  console.log("\nF–I. Immutability source");
  check(
    "F authenticated quote events have select only",
    m041.includes("grant select on public.quote_events to authenticated") &&
      !m041.includes("grant select, insert, update, delete on public.quote_events to authenticated")
  );
  check(
    "G anonymous role is not granted quote event deletes",
    !m041.includes("grant delete on public.quote_events to anon") &&
      !m062.includes("grant execute") 
  );
  check(
    "H 062 does not weaken the accepted snapshot trigger",
    m058.includes("accepted_commercial_snapshots_immutable") &&
      !m062.includes("accepted_commercial_snapshots")
  );
  check(
    "I 062 quote events always raise, and 058 lifecycle events stay immutable",
    m062.includes("raise exception 'quote_events are append-only'") &&
      m058.includes("project_lifecycle_events_immutable") &&
      m041.includes("quote_events are append-only") &&
      m042.includes("Quote items are immutable once the quote is no longer a draft") &&
      m044.includes("quote acceptance evidence is append-only")
  );

  console.log("\nK–N and Q. Cleanup contract and chain");
  let unregisteredRefused = false;
  try {
    assertExplicitCleanupTargets([randomUUID()]);
  } catch {
    unregisteredRefused = true;
  }
  const registered = randomUUID();
  registerPreviewFixtureOrg(registered);
  check("K unregistered uuid is refused before SQL", unregisteredRefused);
  check("K a uuid registered by this process is explicit", isRegisteredPreviewFixtureOrg(registered));
  check(
    "K cleanup SQL is built only for registered uuids",
    assertExplicitCleanupTargets([registered]).length === 1
  );
  check(
    "M fresh chain and Preview upgrade share one final definition",
    m062.includes("create or replace function public.enforce_quote_events_append_only") &&
      m062.includes("drop function if exists public.preview_fixture_org(uuid)") &&
      sqlFiles().at(-1) === "062_remove_preview_lifecycle_cleanup.sql"
  );
  check(
    "N 062 is safe when 060 objects already exist",
    m062.includes("create or replace function") && m062.includes("drop function if exists")
  );
  check(
    "Q production push stays refused and cleanup targets Preview only",
    dbTarget.includes("Refusing Production db push") &&
      dbTarget.includes(PRODUCTION_SUPABASE_PROJECT_REF) &&
      cleanup.includes("PREVIEW_SUPABASE_PROJECT_REF") &&
      cleanup.includes(`"--project-ref"`) &&
      !cleanup.includes("db push")
  );
}

type Db = SupabaseClient;

async function hostedProof(): Promise<void> {
  console.log("\nHosted Preview proof");
  const env = Object.fromEntries(
    readFileSync(join(root, ".env.local"), "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
      })
  );
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !service || !anonKey) {
    check("hosted Preview credentials", false, "missing env");
    return;
  }
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  check("hosted database is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF, ref);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) return;

  const functions = queryPreviewRows(
    "select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (proname in ('preview_fixture_org', 'preview_lifecycle_fixture_cleanup') or prosrc ilike '%PLATFORM-02C%')"
  );
  check("D live functions have no preview name rule", functions.length === 0, JSON.stringify(functions));
  check("C live cleanup functions are gone", functions.length === 0);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = randomUUID().slice(0, 8);
  const email = `hello+platform-02d.${stamp}@erccontracting.co.nz`;
  const password = `Life02d-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(email);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(email));

  const orgA = randomUUID();
  const orgB = randomUUID();
  const namedOnly = randomUUID();
  const projectA = randomUUID();
  const projectB = randomUUID();
  registerPreviewFixtureOrg(orgA);
  registerPreviewFixtureOrg(orgB);
  let userId = "";

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) {
      check("hosted user", false, created.error?.message ?? "createUser");
      return;
    }
    userId = created.data.user.id;
    const orgInsert = await admin.from("organisations").insert([
      { id: orgA, name: `Lifecycle hygiene ${stamp}` },
      { id: orgB, name: `Lifecycle other ${stamp}` },
      { id: namedOnly, name: `PLATFORM-02C unregistered ${stamp}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);

    let nameRefused = false;
    try {
      assertExplicitCleanupTargets([namedOnly]);
    } catch {
      nameRefused = true;
    }
    const namedRow = await admin.from("organisations").select("id").eq("id", namedOnly);
    check("D an organisation-name prefix grants nothing", nameRefused && (namedRow.data ?? []).length === 1);
    check("L an unregistered organisation cannot be cleaned", nameRefused);

    await admin.from("profiles").insert({
      id: userId,
      org_id: orgA,
      role: "owner",
      full_name: "Platform 02D",
    });
    await admin.from("organisation_memberships").insert({
      org_id: orgA,
      user_id: userId,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });
    const projects = await admin.from("projects").insert([
      {
        id: projectA,
        org_id: orgA,
        created_by: userId,
        title: `Hygiene ${stamp}`,
        stage: "estimate_ready",
        business_status: "estimate_ready",
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

    const user = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await user.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(signedIn.error.message);
    const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const signedOut = await anon.rpc("insert_draft_quote_v1", { p_payload: quotePayload(projectA) });
    check("G anonymous quote create fails", Boolean(signedOut.error));
    const anonCleanup = await anon.rpc("preview_lifecycle_fixture_cleanup", { p_org: orgA });
    check("G anonymous cleanup call fails", Boolean(anonCleanup.error));
    const userCleanup = await user.rpc("preview_lifecycle_fixture_cleanup", { p_org: orgA });
    check("F authenticated cleanup call fails", Boolean(userCleanup.error));

    const cross = await user.rpc("insert_draft_quote_v1", { p_payload: quotePayload(projectB) });
    check("L cross-tenant create fails", Boolean(cross.error));

    const draft = await user.rpc("insert_draft_quote_v1", { p_payload: quotePayload(projectA) });
    const quote1 = rpcId(draft.data);
    check("O revision 1 is created", !draft.error && Boolean(quote1), draft.error?.message ?? "");
    if (!quote1) return;
    let events = await lifecycleEvents(admin, projectA);
    check("O one quote_created for revision 1", count(events, "quote_created", quote1) === 1);

    const failedSend = await user.rpc("send_quote_revision_v1", {
      p_quote_id: quote1,
      p_issuer_snapshot: null,
      p_snapshot_fingerprint: "",
      p_fingerprint_version: "v1",
    });
    events = await lifecycleEvents(admin, projectA);
    check("O failed send writes no quote_sent", Boolean(failedSend.error) && count(events, "quote_sent", quote1) === 0);

    const sent = await user.rpc("send_quote_revision_v1", {
      p_quote_id: quote1,
      p_issuer_snapshot: { organisationName: "Lifecycle hygiene" },
      p_snapshot_fingerprint: `fp-${stamp}-1`,
      p_fingerprint_version: "v1",
    });
    events = await lifecycleEvents(admin, projectA);
    check("O first send writes one quote_sent", !sent.error && count(events, "quote_sent", quote1) === 1, sent.error?.message ?? "");

    const resent = await user.rpc("send_quote_revision_v1", {
      p_quote_id: quote1,
      p_issuer_snapshot: { organisationName: "Lifecycle hygiene" },
      p_snapshot_fingerprint: `fp-${stamp}-1`,
      p_fingerprint_version: "v1",
    });
    events = await lifecycleEvents(admin, projectA);
    check("O resend does not duplicate quote_sent", resent.data?.idempotent === true && count(events, "quote_sent", quote1) === 1);

    const revised = await user.rpc("create_quote_revision_v1", {
      p_source_quote_id: quote1,
      p_payload: { quote: quoteFields(), items: [quoteItem()] },
    });
    const quote2 = rpcId(revised.data);
    events = await lifecycleEvents(admin, projectA);
    check(
      "O revision 2 has its own quote_created",
      !revised.error && Boolean(quote2) && quote2 !== quote1 && count(events, "quote_created", quote2) === 1,
      revised.error?.message ?? ""
    );
    if (!quote2) return;

    const sent2 = await user.rpc("send_quote_revision_v1", {
      p_quote_id: quote2,
      p_issuer_snapshot: { organisationName: "Lifecycle hygiene" },
      p_snapshot_fingerprint: `fp-${stamp}-2`,
      p_fingerprint_version: "v1",
    });
    const quote1Status = await admin.from("quotes").select("status").eq("id", quote1).single();
    events = await lifecycleEvents(admin, projectA);
    check("O revision 2 has its own quote_sent", !sent2.error && count(events, "quote_sent", quote2) === 1, sent2.error?.message ?? "");
    check("O revision 1 is superseded", quote1Status.data?.status === "superseded");

    const stale = await user.rpc("accept_quote_revision_v1", { p_quote_id: quote1 });
    check("O stale acceptance fails", Boolean(stale.error));
    const accepted = await user.rpc("accept_quote_revision_v1", { p_quote_id: quote2 });
    const snaps = await admin
      .from("accepted_commercial_snapshots")
      .select("id, quote_id, sell_ex_gst")
      .eq("project_id", projectA);
    events = await lifecycleEvents(admin, projectA);
    check("O acceptance creates one snapshot", !accepted.error && (snaps.data ?? []).length === 1 && snaps.data?.[0]?.quote_id === quote2, accepted.error?.message ?? "");
    check("O acceptance writes one quote_accepted", count(events, "quote_accepted", quote2) === 1);

    const acceptedAgain = await user.rpc("accept_quote_revision_v1", { p_quote_id: quote2 });
    const snapsAgain = await admin.from("accepted_commercial_snapshots").select("id").eq("project_id", projectA);
    events = await lifecycleEvents(admin, projectA);
    check(
      "O acceptance retry is idempotent",
      acceptedAgain.data?.idempotent === true && (snapsAgain.data ?? []).length === 1 && count(events, "quote_accepted", quote2) === 1
    );

    const eventId = events.find((row) => row.event_type === "quote_accepted")?.id;
    const updatedEvent = await admin.from("project_lifecycle_events").update({ schema_version: 99 }).eq("id", eventId ?? "");
    const deletedEvents = await user.from("project_lifecycle_events").delete().eq("project_id", projectA);
    const eventsAfter = await lifecycleEvents(admin, projectA);
    check("I lifecycle event update is rejected", Boolean(updatedEvent.error));
    check("F authenticated lifecycle delete removes nothing", (deletedEvents.data ?? []).length === 0 && eventsAfter.length === events.length);

    const updatedSnap = await admin
      .from("accepted_commercial_snapshots")
      .update({ sell_ex_gst: 1 })
      .eq("project_id", projectA);
    const snapAfter = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst").eq("project_id", projectA).single();
    check("H snapshot update is rejected", Boolean(updatedSnap.error) && Number(snapAfter.data?.sell_ex_gst) !== 1);

    const anonDelete = await anon.from("quote_events").delete().eq("quote_id", quote1);
    const userDelete = await user.from("quote_events").delete().eq("quote_id", quote1);
    const quoteEvents = await admin.from("quote_events").select("id").eq("quote_id", quote1);
    check("G anonymous quote-event delete removes nothing", (anonDelete.data ?? []).length === 0 && (quoteEvents.data ?? []).length > 0);
    check("F authenticated quote-event delete removes nothing", (userDelete.data ?? []).length === 0 && (quoteEvents.data ?? []).length > 0);

    const analytics = readLifecycleAnalytics({
      events: eventsAfter.map((row) => ({
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
    check(
      "P conversion ignores the resend and the second revision does not split one project",
      analytics.firstSendCount === 2 && analytics.sentProjectCount === 1 && analytics.quoteConversion === 1 && analytics.acceptedRevenueExGst === 100
    );
  } finally {
    registerPreviewFixtureOrg(namedOnly);
    try {
      cleanupPreviewFixtureOrgs([orgA, orgB, namedOnly]);
    } catch (error) {
      console.error("cleanup", error instanceof Error ? error.message : error);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
    const left = await admin.from("organisations").select("id").in("id", [orgA, orgB, namedOnly]);
    check("J fixture organisations are removed", (left.data ?? []).length === 0, JSON.stringify(left.data));
    const triggers = queryPreviewRows(
      "select tgname, tgenabled from pg_trigger where tgname in ('quote_events_no_delete', 'quote_acceptances_no_delete', 'quote_declines_no_delete', 'quote_items_protect_snapshot')"
    ) as Array<{ tgenabled?: string }>;
    check(
      "J immutability triggers are enabled after cleanup",
      triggers.length === 4 && triggers.every((row) => row.tgenabled === "O"),
      JSON.stringify(triggers)
    );
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
  return { projectId, quote: quoteFields(), items: [quoteItem()] };
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
  metadata: { revisionNumber?: number } | null;
  schema_version: number;
};

async function lifecycleEvents(admin: Db, projectId: string): Promise<LifecycleRow[]> {
  const { data } = await admin
    .from("project_lifecycle_events")
    .select("id, org_id, project_id, actor_user_id, event_type, occurred_at, source_entity_type, source_entity_id, idempotency_key, metadata, schema_version")
    .eq("project_id", projectId);
  return (data ?? []) as LifecycleRow[];
}

function count(rows: LifecycleRow[], type: string, quoteId: string): number {
  return rows.filter((row) => row.event_type === type && row.source_entity_id === quoteId).length;
}

async function main(): Promise<void> {
  sourceChecks();
  await hostedProof();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
