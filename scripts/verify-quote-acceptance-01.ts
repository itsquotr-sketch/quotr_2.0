/**
 * QUOTE-ACCEPTANCE-01: client accept/decline + immutable evidence.
 * No live email. No AI. Does not restamp economic goldens.
 *
 * Run: npx tsx scripts/verify-quote-acceptance-01.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import {
  buildQuoteAcceptanceDeclaration,
  canClientAcceptQuote,
  canClientDeclineQuote,
  decideQuoteTerminalOutcome,
  formatQuoteAcceptanceMoney,
  isSafeAcceptanceEmail,
  isValidDrawnSignatureSvg,
  validateClientAcceptanceInput,
  QUOTE_ACCEPTANCE_DECLARATION_VERSION,
} from "../lib/quotes/acceptance";
import type { Quote } from "../lib/quotes/types";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

const migrationSrc = readFileSync(
  "supabase/migrations/044_quote_acceptance.sql",
  "utf8"
);
const txn041 = readFileSync(
  "supabase/migrations/041_quote_transaction.sql",
  "utf8"
);
const delivery042 = readFileSync(
  "supabase/migrations/042_quote_delivery.sql",
  "utf8"
);
const actionsSrc = readFileSync("lib/quotes/acceptance-actions.ts", "utf8");
const publicLookupSrc = readFileSync("lib/quotes/public-lookup.ts", "utf8");
const publicDocSrc = readFileSync(
  "components/quotes/QuotePublicDocument.tsx",
  "utf8"
);
const publicShellSrc = readFileSync(
  "components/quotes/QuotePublicShell.tsx",
  "utf8"
);
const publicActionsSrc = readFileSync(
  "components/quotes/QuotePublicActions.tsx",
  "utf8"
);
const acceptSheetSrc = readFileSync(
  "components/quotes/QuoteAcceptSheet.tsx",
  "utf8"
);
const declineSheetSrc = readFileSync(
  "components/quotes/QuoteDeclineSheet.tsx",
  "utf8"
);
const templateSrc = readFileSync("components/quotes/QuoteTemplate.tsx", "utf8");
const summarySrc = readFileSync(
  "components/quotes/QuoteSummaryPanel.tsx",
  "utf8"
);
const detailsSrc = readFileSync(
  "components/quotes/QuoteAcceptanceDetails.tsx",
  "utf8"
);
const entitlementsSrc = readFileSync("lib/quotes/entitlements.ts", "utf8");
const payloadSrc = readFileSync(
  "lib/quotes/delivery-client-payload.ts",
  "utf8"
);
const quoteRpcSrc = readFileSync("lib/quotes/quote-rpc.ts", "utf8");
const sendSrc = readFileSync(
  "supabase/migrations/041_quote_transaction.sql",
  "utf8"
);

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();

const quote = {
  status: "viewed",
  valid_until: "2099-01-01",
  expired_at: null,
  superseded_by_quote_id: null,
  revision_number: 2,
  quote_number: "Q-0002",
  title: "Quote",
  total_incl_gst: 23074.42,
} as Quote;

console.log("=== QUOTE-ACCEPTANCE-01 ===\n");

assert(
  "044 acceptance remains; later billing/membership migrations follow additively",
  migrations.includes("044_quote_acceptance.sql") &&
    migrations.includes("045_commercial_close.sql") &&
    migrations.includes("046_billing_foundation.sql") &&
    migrations.includes("047_past_due_authority.sql") &&
    migrations.includes("048_billing_checkout_trial.sql") &&
    migrations.includes("049_organisation_memberships.sql") &&
    migrations.includes("050_unbind_removed_membership.sql") &&
    migrations.includes("051_organisation_timezone.sql") &&
    migrations.includes("052_company_productivity_calibration.sql") &&
    migrations.at(-1) === "052_company_productivity_calibration.sql"
);
assert(
  "041 accept/decline RPCs remain",
  txn041.includes("accept_quote_revision_v1") &&
    txn041.includes("decline_quote_revision_v1")
);
assert(
  "044 keeps accept_quote_revision_v1(uuid) signature",
  migrationSrc.includes(
    "create or replace function public.accept_quote_revision_v1(p_quote_id uuid)"
  ) &&
    migrationSrc.includes(
      "create or replace function public.decline_quote_revision_v1(p_quote_id uuid)"
    )
);

assert(
  "quote_acceptances unique per quote",
  migrationSrc.includes("quote_acceptances_quote_uidx")
);
assert(
  "quote_declines unique per quote",
  migrationSrc.includes("quote_declines_quote_uidx")
);
assert(
  "evidence append-only triggers",
  migrationSrc.includes("enforce_quote_acceptance_evidence_append_only") &&
    migrationSrc.includes("quote_acceptances_no_update") &&
    migrationSrc.includes("quote_declines_no_delete")
);
assert(
  "anon cannot insert evidence tables",
  migrationSrc.includes(
    "revoke all on table public.quote_acceptances from public, anon, authenticated"
  ) &&
    migrationSrc.includes(
      "grant select on table public.quote_acceptances to authenticated"
    )
);
assert(
  "token-authorised public RPCs granted to anon",
  migrationSrc.includes("accept_quote_by_access_token_v1") &&
    migrationSrc.includes("decline_quote_by_access_token_v1") &&
    migrationSrc.includes(
      "grant execute on function public.accept_quote_by_access_token_v1"
    ) &&
    /grant execute on function public.accept_quote_by_access_token_v1[\s\S]*to anon, authenticated/.test(
      migrationSrc
    )
);
assert(
  "public RPC uses token hash not quote id",
  migrationSrc.includes("p_token_hash text") &&
    /accept_quote_by_access_token_v1[\s\S]*token_hash = v_hash/.test(migrationSrc)
);
assert(
  "token not revoked after acceptance",
  !/accept_quote_by_access_token_v1[\s\S]*revoked_at = now\(\)/.test(migrationSrc)
);
assert(
  "client actor_type on public accept event",
  /quote_apply_accepted_state_v1\([\s\S]*'client', null/.test(migrationSrc)
);
assert(
  "manual accept writes source=manual and signature none",
  migrationSrc.includes("'manual'") &&
    /accept_quote_revision_v1[\s\S]*signature_method, signature_value[\s\S]*'none', null/.test(
      migrationSrc
    )
);
assert(
  "client check requires signer and declaration",
  migrationSrc.includes("source = 'client'") &&
    migrationSrc.includes("signer_name is not null") &&
    migrationSrc.includes("acceptance_declaration is not null")
);
assert(
  "shared apply helper reused by public and internal",
  migrationSrc.includes("quote_apply_accepted_state_v1") &&
    migrationSrc.includes("quote_apply_declined_state_v1") &&
    (migrationSrc.match(/perform public.quote_apply_accepted_state_v1/g) || [])
      .length >= 2
);
assert(
  "unauthenticated events allow quote_accepted and quote_declined as client",
  migrationSrc.includes("'quote_viewed', 'quote_accepted', 'quote_declined'") &&
    migrationSrc.includes("p_actor_type is distinct from 'client'")
);
assert(
  "accepted quotes are not auto-superseded on send",
  /status in \('sent', 'viewed'\)/.test(sendSrc) &&
    sendSrc.includes("shouldSupersede") === false &&
    sendSrc.includes("and status in ('sent', 'viewed')")
);
assert(
  "send supersedes only sent/viewed",
  delivery042.includes("lookup_quote_public_by_token_hash_v1") &&
    txn041.includes("and status in ('sent', 'viewed')")
);

assert(
  "no Quote money columns altered",
  !/alter table public.quotes[\s\S]*total_incl_gst/.test(migrationSrc) &&
    !migrationSrc.includes("drop column")
);
assert(
  "lookup does not expose ip_address on acceptance summary",
  /v_acceptance jsonb[\s\S]*signer_name[\s\S]*signature_value/.test(
    migrationSrc
  ) && !/v_acceptance jsonb[\s\S]*ip_address/.test(migrationSrc.slice(
    migrationSrc.indexOf("select jsonb_build_object(\n    'source', a.source")
  ).slice(0, 800))
);

assert(
  "eligibility: sent/viewed only",
  canClientAcceptQuote(quote) &&
    !canClientAcceptQuote({ ...quote, status: "accepted" }) &&
    !canClientAcceptQuote({ ...quote, status: "declined" }) &&
    !canClientAcceptQuote({ ...quote, status: "superseded" }) &&
    !canClientAcceptQuote({ ...quote, status: "expired" }) &&
    !canClientAcceptQuote({
      ...quote,
      superseded_by_quote_id: "other",
    })
);
assert(
  "expiry blocks accept, not view semantics",
  !canClientAcceptQuote({
    ...quote,
    valid_until: "2000-01-01",
  }) && canClientDeclineQuote(quote) === canClientAcceptQuote(quote)
);

const declaration = buildQuoteAcceptanceDeclaration({
  quoteNumber: "Q-0002",
  revisionNumber: 2,
  totalInclGst: 23074.42,
});
assert(
  "declaration is human-readable and stores money/revision",
  declaration.includes("Q-0002") &&
    declaration.includes("Revision 2") &&
    declaration.includes(formatQuoteAcceptanceMoney(23074.42)) &&
    declaration.includes("incl GST") &&
    QUOTE_ACCEPTANCE_DECLARATION_VERSION === "v1"
);
assert(
  "money formatter matches SQL $'||to_char pattern",
  formatQuoteAcceptanceMoney(23074.42) === "$23,074.42" &&
    formatQuoteAcceptanceMoney(0) === "$0.00"
);

assert(
  "missing declaration denied",
  validateClientAcceptanceInput({
    signerName: "Ada Client",
    signerEmail: "ada@example.com",
    declared: false,
    declaration,
    expectedDeclaration: declaration,
    signatureMethod: "typed",
    signatureValue: "Ada Client",
  }).ok === false
);
assert(
  "missing signer denied",
  validateClientAcceptanceInput({
    signerName: "",
    signerEmail: "ada@example.com",
    declared: true,
    declaration,
    expectedDeclaration: declaration,
    signatureMethod: "typed",
    signatureValue: "",
  }).ok === false
);
assert(
  "bad email denied",
  !isSafeAcceptanceEmail("not-an-email") &&
    !isSafeAcceptanceEmail("ada@example.com\nBcc: x")
);
assert(
  "typed signature valid",
  validateClientAcceptanceInput({
    signerName: "Ada Client",
    signerEmail: "ada@example.com",
    declared: true,
    declaration,
    expectedDeclaration: declaration,
    signatureMethod: "typed",
    signatureValue: "Ada Client",
  }).ok === true
);
assert(
  "drawn signature valid svg path",
  isValidDrawnSignatureSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><path d="M 10 10 L 40 40"/></svg>'
  ) &&
    !isValidDrawnSignatureSvg('<svg><script>alert(1)</script></svg>') &&
    !isValidDrawnSignatureSvg("data:image/png;base64,AAAA") &&
    !isValidDrawnSignatureSvg(
      '<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">x</body></foreignObject><path d="M1 1"/></svg>'
    ) &&
    !isValidDrawnSignatureSvg(
      '<svg><image href="https://evil.example/x.png"/><path d="M1 1"/></svg>'
    )
);
assert(
  "drawn SVG sanitiser rejects script, handlers, foreignObject and href",
  migrationSrc.includes("foreignobject") &&
    migrationSrc.includes("xlink:href") &&
    migrationSrc.includes("<path")
);
assert(
  "oversized drawn signature denied",
  !isValidDrawnSignatureSvg(`<svg>${"a".repeat(30000)}<path d="M1 1"/></svg>`)
);

assert(
  "double accept is idempotent",
  decideQuoteTerminalOutcome("accepted", "accept").ok === true &&
    decideQuoteTerminalOutcome("accepted", "accept").ok &&
    "idempotent" in decideQuoteTerminalOutcome("accepted", "accept") &&
    decideQuoteTerminalOutcome("accepted", "accept").ok &&
    decideQuoteTerminalOutcome("accepted", "accept").ok === true &&
    (decideQuoteTerminalOutcome("accepted", "accept") as { idempotent: boolean })
      .idempotent === true
);
assert(
  "accept after decline blocked",
  decideQuoteTerminalOutcome("declined", "accept").ok === false
);
assert(
  "decline after accept blocked",
  decideQuoteTerminalOutcome("accepted", "decline").ok === false
);
assert(
  "superseded accept denied",
  decideQuoteTerminalOutcome("superseded", "accept").ok === false
);
assert(
  "accepted is not superseded by a later send",
  decideQuoteTerminalOutcome("accepted", "supersede").ok === false
);
assert(
  "sent revision can be superseded if not yet accepted",
  decideQuoteTerminalOutcome("sent", "supersede").ok === true
);
assert(
  "expired accept denied",
  decideQuoteTerminalOutcome("expired", "accept").ok === false
);

assert(
  "public page has Accept/Decline and print",
  publicActionsSrc.includes("Accept quote") &&
    publicActionsSrc.includes("Decline") &&
    publicShellSrc.includes("Print / Save PDF")
);
assert(
  "desktop dialog and mobile sheet for accept",
  acceptSheetSrc.includes('data-quote-accept-mode="dialog"') &&
    acceptSheetSrc.includes('data-quote-accept-mode="sheet"')
);
assert(
  "declaration checkbox is not pre-checked",
  acceptSheetSrc.includes("const [declared, setDeclared] = useState(false)")
);
assert(
  "no optional-item checkboxes in accept UI",
  !acceptSheetSrc.includes("optional") ||
    acceptSheetSrc.includes("Optional items stay optional")
);
assert(
  "success copy does not promise notification",
  publicShellSrc.includes("Your acceptance has been recorded.") &&
    !publicShellSrc.includes("contractor has been notified")
);
assert(
  "expired client message includes date",
  publicShellSrc.includes("This quote expired on")
);
assert(
  "superseded banner without redirect",
  publicShellSrc.includes(
    "This quote has been superseded by a newer revision."
  ) && !publicDocSrc.includes("latest revision")
);
assert(
  "QuoteTemplate appends acceptance section without mutating snapshot",
  templateSrc.includes("QuoteAcceptanceRecordSection") &&
    templateSrc.includes("acceptance = null")
);
assert(
  "builder details hide IP",
  detailsSrc.includes("Technical network evidence is stored privately") &&
    !detailsSrc.includes("acceptance.ip_address")
);
assert(
  "manual override labelled without fake signature",
  summarySrc.includes("does not create a client signature") &&
    migrationSrc.includes("Manually marked accepted by the contractor.")
);
assert(
  "public acceptance is transaction completion, not contractor billing",
  entitlementsSrc.includes('"quotes.acceptance"') &&
    entitlementsSrc.includes("transaction completion") &&
    !actionsSrc.includes("requireOrgEntitlement") &&
    !entitlementsSrc.includes("starter")
);
assert(
  "public payload still forbids org_id and costs",
  payloadSrc.includes('"org_id"') && payloadSrc.includes('"margin"')
);
assert(
  "RPC constants registered",
  quoteRpcSrc.includes("ACCEPT_QUOTE_BY_ACCESS_TOKEN_RPC") &&
    quoteRpcSrc.includes("DECLINE_QUOTE_BY_ACCESS_TOKEN_RPC")
);
assert(
  "public lookup hashes token",
  publicLookupSrc.includes("hashQuoteAccessToken") &&
    publicLookupSrc.includes("lookup_quote_public_by_token_hash_v1")
);
assert(
  "IP taken from headers not form fields",
  actionsSrc.includes("clientIpFromHeaders") &&
    !acceptSheetSrc.includes("ip_address") &&
    !declineSheetSrc.includes("user-agent")
);
assert(
  "no Stripe/billing/acceptance email in this batch",
  !actionsSrc.includes("resend") &&
    !migrationSrc.includes("stripe") &&
    !actionsSrc.includes("quotes.billing")
);

if (process.exitCode) {
  console.log("\nQUOTE-ACCEPTANCE-01 FAILED");
} else {
  console.log("\nQUOTE-ACCEPTANCE-01 passed");
}
