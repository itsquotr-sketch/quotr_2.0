/**
 * QUOTE-TRANSACTION-01: immutable revisions, status transitions, events.
 * Does not restamp economic goldens. No live DB mutations.
 *
 * Run: npx tsx scripts/verify-quote-transaction-01.ts
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { calculateQuoteBaseTotalsFromItems } from "../lib/quotes/base-totals";
import { resolveQuoteIssuerSettings } from "../lib/quotes/issuer-snapshot";
import { mapQuote } from "../lib/quotes/mappers";
import { nextQuoteNumber, parseQuoteNumberSequence } from "../lib/quotes/quote-numbers";
import {
  parseQuoteTxnResult,
} from "../lib/quotes/quote-rpc";
import {
  buildQuoteSnapshotFingerprintPayload,
  hashQuoteSnapshotFingerprint,
  QUOTE_SNAPSHOT_FINGERPRINT_VERSION,
} from "../lib/quotes/snapshot-fingerprint";
import {
  assertQuoteSnapshotMutable,
  assertQuoteStatusTransition,
  canMutateQuoteSnapshot,
  isQuoteExpired,
  isQuoteStatusTransitionAllowed,
  quoteThreadId,
  QUOTE_STATUS_TRANSITION_MATRIX,
  shouldSupersedeQuoteOnSend,
} from "../lib/quotes/transaction";
import type { Quote, QuoteItem, QuoteStatus } from "../lib/quotes/types";
import type { CompanySettings } from "../lib/settings/types";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function quoteDoc(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q-1",
    org_id: "org-1",
    project_id: "project-1",
    pricing_document_id: "doc-1",
    estimate_id: null,
    quote_number: "Q-0001",
    title: "Quote",
    status: "draft",
    client_name: "Client",
    site_address: "1 Site Rd",
    issue_date: "2026-08-01",
    valid_until: "2026-08-31",
    subtotal: 1000,
    gst_rate: 15,
    gst_amount: 150,
    total_incl_gst: 1150,
    scope_summary: "Deck",
    inclusions: ["Deck"],
    exclusions: ["Painting"],
    assumptions: ["Access"],
    terms: "Net 7",
    notes_to_client: "Thanks",
    created_by: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    expired_at: null,
    issuer_snapshot: null,
    snapshot_fingerprint: null,
    snapshot_fingerprint_version: null,
    revision_number: 1,
    parent_quote_id: null,
    revised_from_quote_id: null,
    superseded_by_quote_id: null,
    superseded_at: null,
    revision_note: null,
    presentation_mode: "grouped",
    ...overrides,
  };
}

function quoteItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: "qi-1",
    org_id: "org-1",
    quote_id: "q-1",
    project_id: "project-1",
    pricing_item_id: null,
    work_area_id: "wa-1",
    section_title: "Deck",
    section_description: "Supply and construct deck.",
    label: "Decking",
    description: "Kwila",
    quantity: 10,
    unit: "m2",
    unit_price: 100,
    total: 1000,
    visible: true,
    optional: false,
    sort_order: 1,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const actionsSrc = readFileSync("lib/quotes/actions.ts", "utf8");
const transactionSrc = readFileSync("lib/quotes/transaction.ts", "utf8");
const eventsSrc = readFileSync("lib/quotes/events.ts", "utf8");
const migrationSrc = readFileSync(
  "supabase/migrations/041_quote_transaction.sql",
  "utf8"
);
const templateSrc = readFileSync("components/quotes/QuoteTemplate.tsx", "utf8");
const rpcSrc = readFileSync("lib/quotes/quote-rpc.ts", "utf8");
const fingerprintSrc = readFileSync("lib/quotes/snapshot-fingerprint.ts", "utf8");
const statusSrc = readFileSync("lib/quotes/status.ts", "utf8");
const workspaceSrc = readFileSync("components/quotes/QuoteWorkspace.tsx", "utf8");

console.log("--- Revision identity ---");
assert("root quote thread id is self", quoteThreadId(quoteDoc()) === "q-1");
assert(
  "child revision uses parent_quote_id as thread",
  quoteThreadId(quoteDoc({ id: "q-2", parent_quote_id: "q-1" })) === "q-1"
);
assert("first quote number is Q-0001", nextQuoteNumber([]) === "Q-0001");
assert("next quote number increments", nextQuoteNumber(["Q-0017"]) === "Q-0018");
assert("parse ignores non-canonical numbers", parseQuoteNumberSequence("INV-9") === null);
assert(
  "mapper reads revision_number",
  mapQuote({ revision_number: 3 }).revision_number === 3
);

console.log("\n--- Draft mutability / sent immutability ---");
assert("draft is mutable", canMutateQuoteSnapshot(quoteDoc({ status: "draft" })));
assert(
  "draft with send lock is immutable",
  !canMutateQuoteSnapshot(
    quoteDoc({ status: "draft", send_lock_delivery_id: "d-1" })
  )
);
assert(
  "sent is immutable",
  !canMutateQuoteSnapshot(quoteDoc({ status: "sent" }))
);
assert(
  "accepted is immutable",
  !canMutateQuoteSnapshot(quoteDoc({ status: "accepted" }))
);
assert(
  "superseded draft is immutable",
  !canMutateQuoteSnapshot(
    quoteDoc({ status: "draft", superseded_by_quote_id: "q-2" })
  )
);
assert(
  "sent mutation is rejected",
  assertQuoteSnapshotMutable(quoteDoc({ status: "sent" })) != null
);
assert(
  "send-lock mutation is rejected",
  assertQuoteSnapshotMutable(
    quoteDoc({ status: "draft", send_lock_delivery_id: "d-1" })
  ) === "This quote cannot be edited while it is being sent."
);
assert(
  "accepted mutation is rejected",
  assertQuoteSnapshotMutable(quoteDoc({ status: "accepted" })) != null
);

console.log("\n--- Status transition matrix ---");
const allowed: Array<[QuoteStatus, QuoteStatus]> = [
  ["draft", "sent"],
  ["draft", "archived"],
  ["sent", "viewed"],
  ["sent", "accepted"],
  ["sent", "declined"],
  ["sent", "expired"],
  ["sent", "superseded"],
  ["viewed", "accepted"],
  ["viewed", "declined"],
  ["viewed", "expired"],
  ["viewed", "superseded"],
];
const blocked: Array<[QuoteStatus, QuoteStatus]> = [
  ["draft", "accepted"],
  ["draft", "declined"],
  ["accepted", "draft"],
  ["accepted", "sent"],
  ["accepted", "superseded"],
  ["declined", "sent"],
  ["expired", "sent"],
  ["superseded", "sent"],
  ["archived", "draft"],
];
for (const [from, to] of allowed) {
  assert(`${from} → ${to} allowed`, isQuoteStatusTransitionAllowed(from, to));
}
for (const [from, to] of blocked) {
  assert(`${from} → ${to} blocked`, !isQuoteStatusTransitionAllowed(from, to));
}
assert(
  "idempotent sent→sent",
  assertQuoteStatusTransition("sent", "sent").ok &&
    assertQuoteStatusTransition("sent", "sent").idempotent === true
);
assert(
  "matrix has no accepted outbound transitions",
  QUOTE_STATUS_TRANSITION_MATRIX.accepted.length === 0
);

console.log("\n--- Supersede / expiry ---");
assert("sent is supersedable", shouldSupersedeQuoteOnSend({ status: "sent" }));
assert("viewed is supersedable", shouldSupersedeQuoteOnSend({ status: "viewed" }));
assert(
  "accepted is not auto-superseded",
  !shouldSupersedeQuoteOnSend({ status: "accepted" })
);
const stillValid = quoteDoc({
  status: "sent",
  valid_until: "2099-12-31",
});
const pastDue = quoteDoc({
  status: "sent",
  valid_until: "2020-01-01",
});
assert("future valid_until is not expired", !isQuoteExpired(stillValid));
assert("past valid_until is expired", isQuoteExpired(pastDue));
assert(
  "today is inclusive in Auckland",
  !isQuoteExpired(
    quoteDoc({
      status: "sent",
      valid_until: new Date().toLocaleDateString("en-CA", {
        timeZone: "Pacific/Auckland",
      }),
    })
  )
);

console.log("\n--- Snapshot fingerprint ---");
const items = [
  quoteItem(),
  quoteItem({
    id: "qi-opt",
    label: "Optional light",
    total: 200,
    optional: true,
    sort_order: 2,
  }),
];
const hash1 = hashQuoteSnapshotFingerprint(quoteDoc(), items);
const hash2 = hashQuoteSnapshotFingerprint(quoteDoc(), items);
assert("fingerprint is stable", hash1 === hash2 && hash1.length === 64);
const hashMoneyChange = hashQuoteSnapshotFingerprint(
  quoteDoc({ subtotal: 1001 }),
  items
);
assert("fingerprint changes when money changes", hash1 !== hashMoneyChange);
const hashPresentation = hashQuoteSnapshotFingerprint(
  quoteDoc({ presentation_mode: "detailed" }),
  items
);
assert(
  "fingerprint changes when presentation changes",
  hash1 !== hashPresentation
);
const hashLifecycle = hashQuoteSnapshotFingerprint(
  quoteDoc({ status: "sent", viewed_at: "2026-08-02T00:00:00.000Z" }),
  items
);
assert(
  "fingerprint ignores lifecycle status/timestamps",
  hash1 === hashLifecycle
);
const issuerForHash = {
  organisationName: "Frozen Co",
  tradingName: "Frozen Trading",
  legalName: null,
  contactEmail: "frozen@example.com",
  contactPhone: null,
  website: null,
  addressLine1: "Old address",
  addressLine2: null,
  city: "Wellington",
  region: null,
  postcode: null,
  addressCountry: "New Zealand",
  nzbn: null,
  gstNumber: "GST-FROZEN",
  logoUrl: "https://example.com/frozen.png",
  brandPrimaryColour: null,
  brandAccentColour: null,
  defaultPaymentTerms: "Frozen terms",
  source: "send" as const,
};
const hashWithIssuer = hashQuoteSnapshotFingerprint(
  quoteDoc(),
  items,
  issuerForHash
);
assert(
  "fingerprint includes issuer snapshot",
  hash1 !== hashWithIssuer
);
const payload = buildQuoteSnapshotFingerprintPayload(quoteDoc(), items, issuerForHash);
assert(
  "fingerprint payload versions as v1",
  payload.version === QUOTE_SNAPSHOT_FINGERPRINT_VERSION &&
    QUOTE_SNAPSHOT_FINGERPRINT_VERSION === "v1" &&
    fingerprintSrc.includes("version: QUOTE_SNAPSHOT_FINGERPRINT_VERSION")
);
assert(
  "send stores fingerprint version",
  actionsSrc.includes("p_fingerprint_version: QUOTE_SNAPSHOT_FINGERPRINT_VERSION") &&
    migrationSrc.includes("snapshot_fingerprint_version")
);

console.log("\n--- Optional / presentation isolation ---");
const totals = calculateQuoteBaseTotalsFromItems(items, 15, "txn-optional");
assert("optional stays out of base total", totals.ok && totals.totals.subtotal === 1000);
assert(
  "revision copies presentation_mode",
  actionsSrc.includes("presentation_mode: quote.presentation_mode")
);
assert(
  "revision preserves notes_to_client",
  actionsSrc.includes("notes_to_client: quote.notes_to_client")
);
assert(
  "draft update-from-pricing stays on the draft row",
  actionsSrc.includes('quote.status === "draft"') &&
    actionsSrc.includes("applyPricingSnapshotToDraft")
);

console.log("\n--- Events / actors / RLS ---");
assert(
  "append-only events table exists",
  migrationSrc.includes("create table if not exists public.quote_events") &&
    migrationSrc.includes("quote_events are append-only")
);
assert(
  "events have no insert/update/delete policies for authenticated",
  migrationSrc.includes("No INSERT/UPDATE/DELETE policies") &&
    migrationSrc.includes("grant select on public.quote_events to authenticated") &&
    !migrationSrc.includes("Users can insert quote events") &&
    !/grant select, insert on public.quote_events/.test(migrationSrc)
);
assert(
  "actor model includes user/client/system",
  migrationSrc.includes("'user', 'client', 'system'") &&
    eventsSrc.includes("actorType: QuoteActorType")
);
assert(
  "draft updates record quote_updated via domain RPC only",
  eventsSrc.includes("APPEND_QUOTE_UPDATED_RPC") &&
    eventsSrc.includes('eventType !== "quote_updated"') &&
    !eventsSrc.includes('.from("quote_events")')
);
assert(
  "mark as sent records quote_sent inside send RPC",
  migrationSrc.includes("'quote_sent'") &&
    actionsSrc.includes("SEND_QUOTE_REVISION_RPC")
);
assert(
  "accepted/declined record canonical events inside RPCs",
  migrationSrc.includes("'quote_accepted'") &&
    migrationSrc.includes("'quote_declined'") &&
    actionsSrc.includes("ACCEPT_QUOTE_REVISION_RPC") &&
    actionsSrc.includes("DECLINE_QUOTE_REVISION_RPC")
);
assert(
  "viewed helper exists but UI does not fabricate views",
  actionsSrc.includes("export async function markQuoteViewed") &&
    !workspaceSrc.includes("markQuoteViewed")
);
assert(
  "snapshot freeze trigger is not draft-only UI",
  migrationSrc.includes("prevent_quote_snapshot_mutation") &&
    migrationSrc.includes("prevent_quote_item_snapshot_mutation")
);
assert(
  "write actions go through assertQuoteEditable/assertQuoteSnapshotMutable",
  actionsSrc.includes("assertQuoteEditable") &&
    transactionSrc.includes("canMutateQuoteSnapshot")
);

console.log("\n--- Delivery / acceptance boundary ---");
assert(
  "quote freeze is not SMTP; email is the Resend adapter",
  actionsSrc.includes("getQuoteDeliveryProvider") &&
    actionsSrc.includes("sendQuoteToClient") &&
    !/nodemailer|sendgrid|smtp/i.test(actionsSrc)
);
assert(
  "public access is a hashed token path not a raw quote UUID helper",
  actionsSrc.includes("quotePublicPath") &&
    !actionsSrc.includes("public-quote") &&
    !actionsSrc.includes("client_token")
);
assert("no Stripe in quote transaction", !/stripe/i.test(actionsSrc));

console.log("\n--- Issuer / client snapshot ---");
const live: CompanySettings = {
  organisationName: "Live Co",
  tradingName: "Live Trading",
  legalName: "Live Legal",
  contactEmail: "live@example.com",
  contactPhone: "021",
  website: null,
  addressLine1: "New address",
  addressLine2: null,
  city: "Auckland",
  region: null,
  postcode: null,
  addressCountry: "New Zealand",
  nzbn: null,
  gstNumber: "GST-LIVE",
  defaultGstRate: 15,
  defaultQuoteValidityDays: 30,
  defaultPaymentTerms: "Live terms",
  defaultQuoteTerms: null,
  defaultQuoteExclusions: null,
  defaultQuoteAssumptions: null,
  logoUrl: "https://example.com/live.png",
  brandPrimaryColour: null,
  brandAccentColour: null,
  defaultMaterialWastagePercent: 0,
  deckingWastagePercent: null,
  sheetMaterialWastagePercent: null,
  flooringWastagePercent: null,
  paintWastagePercent: null,
  timberFramingWastagePercent: null,
};
const frozen = quoteDoc({
  status: "sent",
  issuer_snapshot: {
    organisationName: "Frozen Co",
    tradingName: "Frozen Trading",
    legalName: null,
    contactEmail: "frozen@example.com",
    contactPhone: null,
    website: null,
    addressLine1: "Old address",
    addressLine2: null,
    city: "Wellington",
    region: null,
    postcode: null,
    addressCountry: "New Zealand",
    nzbn: null,
    gstNumber: "GST-FROZEN",
    logoUrl: "https://example.com/frozen.png",
    brandPrimaryColour: null,
    brandAccentColour: null,
    defaultPaymentTerms: "Frozen terms",
  },
});
const issuer = resolveQuoteIssuerSettings(frozen, live);
assert(
  "sent quote uses issuer snapshot not live company",
  issuer?.organisationName === "Frozen Co" &&
    issuer.gstNumber === "GST-FROZEN" &&
    issuer.logoUrl === "https://example.com/frozen.png"
);
assert(
  "draft without snapshot still uses live company",
  resolveQuoteIssuerSettings(quoteDoc(), live)?.organisationName === "Live Co"
);
assert(
  "template resolves issuer snapshot",
  templateSrc.includes("resolveQuoteIssuerSettings") &&
    templateSrc.includes("quote.client_name") &&
    !/getLatestPricing|from\("pricing_documents"\)/.test(templateSrc)
);
assert(
  "client name/site live on quote row",
  templateSrc.includes("quote.client_name") &&
    templateSrc.includes("quote.site_address")
);

console.log("\n--- Schema / source safety ---");
const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();
assert(
  "041 quote transaction exists; 042–048 follow additively",
  migrations.includes("041_quote_transaction.sql") &&
    migrations.includes("042_quote_delivery.sql") &&
    migrations.includes("043_project_client_email.sql") &&
    migrations.includes("044_quote_acceptance.sql") &&
    migrations.includes("045_commercial_close.sql") &&
    migrations.includes("046_billing_foundation.sql") &&
    migrations.includes("047_past_due_authority.sql") &&
    migrations.at(-1) === "048_billing_checkout_trial.sql"
);
assert("viewed status added", migrationSrc.includes("'viewed'"));
assert(
  "canonical status uses superseded not revised",
  migrationSrc.includes("'superseded'") &&
    !/status in \([^)]*'revised'/.test(migrationSrc) &&
    statusSrc.includes('value: "superseded"') &&
    !transactionSrc.includes('"revised"')
);
assert(
  "one-open-draft unique index is omitted for Production compatibility",
  !migrationSrc.includes("quotes_one_open_draft_per_thread_uidx")
);
assert(
  "quote number/revision unique when numbered",
  migrationSrc.includes("quotes_org_number_revision_uidx")
);
assert(
  "events remain tenant isolated",
  migrationSrc.includes("org_id = public.auth_org_id()")
);
assert(
  "create/send allocate quote numbers via durable counter",
  migrationSrc.includes("allocate_org_quote_number_v1") &&
    migrationSrc.includes("organisation_quote_counters") &&
    actionsSrc.includes("INSERT_DRAFT_QUOTE_RPC") &&
    !actionsSrc.includes("allocateQuoteNumberForOrg") &&
    !actionsSrc.includes("nextQuoteNumber(")
);
assert(
  "lifecycle transitions go through atomic RPCs",
  actionsSrc.includes("SEND_QUOTE_REVISION_RPC") &&
    actionsSrc.includes("ACCEPT_QUOTE_REVISION_RPC") &&
    actionsSrc.includes("CREATE_QUOTE_REVISION_RPC") &&
    !actionsSrc.includes("supersedePriorRevisionsOnSend")
);

console.log("\n--- Atomic RPCs ---");
assert(
  "send RPC is one plpgsql function",
  migrationSrc.includes("create or replace function public.send_quote_revision_v1") &&
    migrationSrc.includes("status = 'sent'") &&
    migrationSrc.includes("status = 'superseded'") &&
    migrationSrc.includes("'quote_sent'") &&
    migrationSrc.includes("'quote_superseded'")
);
assert(
  "accept/decline/expire/view RPCs append matching events",
  migrationSrc.includes("create or replace function public.accept_quote_revision_v1") &&
    migrationSrc.includes("create or replace function public.decline_quote_revision_v1") &&
    migrationSrc.includes("create or replace function public.expire_quote_revision_v1") &&
    migrationSrc.includes("create or replace function public.mark_quote_viewed_v1")
);
assert(
  "create revision RPC inserts quote+items+event together",
  migrationSrc.includes("create or replace function public.create_quote_revision_v1") &&
    migrationSrc.includes("quote_txn_insert_items") &&
    migrationSrc.includes("'quote_revision_created'")
);
assert(
  "RPCs use auth_org_id not client-supplied org",
  /send_quote_revision_v1[\s\S]*v_org uuid := public.auth_org_id\(\)/.test(
    migrationSrc
  ) && !migrationSrc.includes("p_org_id")
);
assert(
  "RPCs are SECURITY DEFINER granted only to authenticated",
  /function public.send_quote_revision_v1[\s\S]{0,250}security definer/.test(
    migrationSrc
  ) &&
    !/function public.send_quote_revision_v1[\s\S]{0,250}security invoker/.test(
      migrationSrc
    ) &&
    migrationSrc.includes(
      "grant execute on function public.send_quote_revision_v1(uuid, jsonb, text, text) to authenticated"
    ) &&
    migrationSrc.includes(
      "revoke all on function public.send_quote_revision_v1(uuid, jsonb, text, text) from public, anon, service_role"
    )
);
assert(
  "event helpers are not executable by authenticated",
  migrationSrc.includes(
    "revoke all on function public.quote_txn_append_event(uuid, uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated, service_role"
  ) &&
    migrationSrc.includes(
      "revoke all on function public.quote_txn_insert_items(uuid, uuid, uuid, jsonb) from public, anon, authenticated, service_role"
    ) &&
    !/grant execute on function public.quote_txn_append_event/.test(migrationSrc) &&
    !/grant execute on function public.quote_txn_fail/.test(migrationSrc)
);
assert(
  "append helper refuses cross-org org id",
  migrationSrc.includes("p_org is distinct from v_org")
);
assert(
  "send/accept RPCs append canonical events in-function",
  /send_quote_revision_v1[\s\S]*'quote_sent'/.test(migrationSrc) &&
    /accept_quote_revision_v1[\s\S]*'quote_accepted'/.test(migrationSrc)
);
assert(
  "draft quote_updated RPC exists and is granted",
  migrationSrc.includes("create or replace function public.append_quote_updated_v1") &&
    migrationSrc.includes(
      "grant execute on function public.append_quote_updated_v1(uuid, jsonb) to authenticated"
    ) &&
    /v_quote.status is distinct from 'draft'/.test(migrationSrc)
);
assert(
  "send concurrency uses row lock + draft predicate + sent idempotent",
  migrationSrc.includes("for update") &&
    /if v_quote.status = 'sent' then[\s\S]*idempotent/.test(migrationSrc) &&
    migrationSrc.includes("pg_advisory_xact_lock")
);
assert(
  "revision concurrency returns existing open draft",
  /select id into v_open[\s\S]*status = 'draft'[\s\S]*idempotent/.test(
    migrationSrc
  )
);
assert(
  "quote number allocator uses GREATEST(counter, max existing)",
  migrationSrc.includes("greatest(last_value, v_max) + 1")
);
assert(
  "one-shot events unique excluding quote_updated",
  (() => {
    const idx = migrationSrc.indexOf("quote_events_one_shot_uidx");
    const whereStart = migrationSrc.indexOf("where event_type in", idx);
    const whereEnd = migrationSrc.indexOf(");", whereStart);
    if (idx < 0 || whereStart < 0 || whereEnd < 0) return false;
    const oneShot = migrationSrc.slice(whereStart, whereEnd);
    return (
      oneShot.includes("'quote_sent'") &&
      oneShot.includes("'quote_superseded'") &&
      !oneShot.includes("quote_updated")
    );
  })()
);
assert(
  "idempotent RPC result parser treats same-state as success",
  parseQuoteTxnResult({ ok: true, idempotent: true, status: "sent" })
    ?.idempotent === true &&
    parseQuoteTxnResult({ ok: false }) === null &&
    rpcSrc.includes("idempotent")
);

console.log("\n--- Freeze trigger allow-list ---");
assert(
  "draft updates bypass snapshot freeze",
  migrationSrc.includes("if old.status = 'draft' then")
);
assert(
  "lifecycle columns are not in the frozen comparison list",
  !/new\.status is distinct from old\.status/.test(migrationSrc) &&
    !/new\.sent_at is distinct from old\.sent_at/.test(migrationSrc) &&
    !/new\.viewed_at is distinct from old\.viewed_at/.test(migrationSrc) &&
    !/new\.accepted_at is distinct from old\.accepted_at/.test(migrationSrc) &&
    !/new\.superseded_by_quote_id is distinct from old\.superseded_by_quote_id/.test(
      migrationSrc
    )
);
assert(
  "money and client snapshot columns are frozen after send",
  migrationSrc.includes("new.subtotal is distinct from old.subtotal") &&
    migrationSrc.includes("new.client_name is distinct from old.client_name") &&
    migrationSrc.includes("new.presentation_mode is distinct from old.presentation_mode")
);
assert(
  "quote items freeze non-draft insert/update/delete",
  /before insert or update or delete on public.quote_items/.test(migrationSrc) &&
    migrationSrc.includes("if quote_status is null or quote_status = 'draft' then")
);
assert(
  "issuer snapshot may be written once then frozen",
  migrationSrc.includes("old.issuer_snapshot is not null") &&
    migrationSrc.includes("Quote issuer snapshot is immutable once recorded")
);

console.log("\n--- Shared-DB / Production HEAD compatibility ---");
let headActions = "";
try {
  headActions = execSync("git show HEAD:lib/quotes/actions.ts", {
    encoding: "utf8",
  });
} catch {
  headActions = "";
}
assert("can read Production HEAD quote actions", headActions.length > 0);
assert(
  "HEAD create inserts draft quotes only",
  headActions.includes("export async function createQuoteFromPricing") &&
    /status:\s*"draft"/.test(headActions)
);
assert(
  "committed app freezes via send RPC",
  headActions.includes("SEND_QUOTE_REVISION_RPC") &&
    headActions.includes("ACCEPT_QUOTE_REVISION_RPC")
);
assert(
  "committed app accept/decline/expire use lifecycle RPCs",
  headActions.includes("DECLINE_QUOTE_REVISION_RPC") &&
    headActions.includes("EXPIRE_QUOTE_REVISION_RPC") &&
    !headActions.includes('status: "revised"')
);
assert(
  "committed app revises via create revision RPC",
  headActions.includes("CREATE_QUOTE_REVISION_RPC") &&
    !headActions.includes('status: "revised"')
);
assert(
  "committed draft edits still require draft",
  headActions.includes("assertQuoteEditable") &&
    transactionSrc.includes("Only draft quotes can be edited")
);
assert(
  "post-041 freeze allows HEAD lifecycle writes",
  migrationSrc.includes("if old.status = 'draft' then") &&
    migrationSrc.includes("--   status, sent_at, viewed_at, accepted_at, declined_at, expired_at,")
);
assert(
  "041 does not rewrite quote money",
  !/update public.quotes[\s\S]{0,200}set[\s\S]{0,80}subtotal/.test(
    migrationSrc
  ) && !migrationSrc.includes("total_incl_gst =")
);
assert(
  "historical issuer backfill is marked migration-derived",
  migrationSrc.includes("migration_041_current_org") &&
    migrationSrc.includes("and q.issuer_snapshot is null")
);
assert(
  "HEAD does not require quote_events insert",
  !headActions.includes("quote_events")
);
assert(
  "workspace uses superseded copy",
  workspaceSrc.includes("This quote has been superseded.") &&
    !workspaceSrc.includes("This quote has been revised.")
);
assert(
  "future send/acceptance entitlements are not hard-coded plan strings",
  transactionSrc.includes("quotes.send") &&
    transactionSrc.includes("quotes.acceptance") &&
    !transactionSrc.includes("NZD") &&
    !migrationSrc.includes("BUILDER") &&
    !migrationSrc.includes("BUSINESS")
);

if (process.exitCode) {
  console.error("\nQUOTE-TRANSACTION-01 verifier failed.");
} else {
  console.log("\nQUOTE-TRANSACTION-01 verifier passed.");
}
