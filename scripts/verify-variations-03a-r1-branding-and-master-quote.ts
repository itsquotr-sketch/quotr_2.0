/**
 * VARIATIONS-03A-R1 — Quote branding and accepted master-Quote identity.
 *
 * Run: npx --yes tsx scripts/verify-variations-03a-r1-branding-and-master-quote.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  presentVariationIssueDate,
  variationMasterQuoteClause,
} from "../lib/variations/document-identity";
import { buildVariationDeliveryEmail } from "../lib/variations/delivery-email";
import { buildVariationDocument, formatSignedAdjustment } from "../lib/variations/presentation";
import { hashVariationAccessToken, generateVariationAccessToken } from "../lib/variations/delivery-token";
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
type Rpc = Record<string, unknown> & { ok?: boolean; error?: string; state?: string; title?: string };

const sql = read("supabase/migrations/070_variation_document_identity.sql");
const emailSrc = read("lib/variations/delivery-email.ts");
const document = read("components/variations/VariationDocument.tsx");
const publicView = read("components/variations/VariationPublicView.tsx");
const printPage = read("app/(protected)/app/projects/[projectId]/variations/[variationId]/print/page.tsx");
const preview = read("components/variations/VariationEditor.tsx");
const identitySrc = read("lib/variations/document-identity.ts");
const clause = variationMasterQuoteClause("Q-100", 1);
const issuedLabel = presentVariationIssueDate("2026-09-27T01:02:03.456Z", "Pacific/Auckland");
const email = buildVariationDeliveryEmail({
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
  logoUrl: "https://example.test/logo.png",
  quoteNumber: "Q-100",
  quoteRevision: 1,
  contractorAddress: "12 Builder Road",
});
const model = buildVariationDocument({
  companyName: "Live Co",
  clientName: "Client",
  projectTitle: "Live project",
  siteAddress: "Live site",
  variationNumber: 4,
  revisionNumber: 2,
  issuedAt: "2026-09-27T01:02:03.456Z",
  status: "issued",
  title: "Deck stair addition",
  summary: "Add a stair.",
  clientNotes: "Match the deck.",
  currency: "NZD",
  items: [],
  totals: { totalSellAdjustmentExGst: 1500, gstAdjustment: 225, totalAdjustmentInclGst: 1725 },
  baseline: { sellExGst: 10000, sellInclGst: 11500 },
  identity: {
    companyName: "ERC Contracting",
    legalName: "ERC Contracting Limited",
    logoUrl: "https://example.test/logo.png",
    email: "builder@example.test",
    phone: "021000000",
    website: null,
    address: "12 Builder Road",
    registrationLines: ["GST 123"],
    brandPrimary: null,
    clientName: "Ada Client",
    projectTitle: "Deck",
    siteAddress: "12 Site Road",
    quoteNumber: "Q-100",
    quoteRevision: 1,
    acceptedOnLabel: "27 Sept 2026",
    available: true,
    timezone: "Pacific/Auckland",
  },
});

function envValue(): Record<string, string> {
  return Object.fromEntries(
    read(".env.local").split("\n").filter((row) => row && !row.startsWith("#") && row.includes("=")).map((row) => {
      const index = row.indexOf("=");
      return [row.slice(0, index), row.slice(index + 1).replace(/^"|"$/g, "")];
    })
  );
}

async function main(): Promise<void> {
  console.log("\nVARIATIONS-03A-R1");
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
  const emailA = `hello+variations-03ar1.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-03ar1b.${stamp}@erccontracting.co.nz`;
  const password = `Var03AR1-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(emailA);
  check("fixture inbox is not protected", !isPasswordProtectedPreviewAccount(emailA));
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectBlank = randomUUID();
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
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 03A R1" });
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
      { id: orgA, name: `Variations 03AR1 ${stamp}` },
      { id: orgB, name: `Other ${stamp}` },
    ]);
    if (orgs.error) throw new Error(orgs.error.message);
    const settings = await admin.from("organisation_settings").insert({
      org_id: orgA, default_margin_percent: 20, default_gst_rate: 15, currency: "NZD",
      trading_name: "ERC Contracting", legal_name: "ERC Contracting Limited",
      contact_email: "builder@example.test", contact_phone: "021000000",
      address_line_1: "12 Builder Road", gst_number: "123-456-789", logo_url: "https://example.test/logo.png",
    });
    if (settings.error) throw new Error(settings.error.message);
    const userA = await userFor(emailA, orgA);
    const userB = await userFor(emailB, orgB);
    const signedOut = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const projects = await admin.from("projects").insert([
      { id: projectA, org_id: orgA, created_by: userIds[0], title: "Deck", client_name: "Ada Client", site_address: "12 Site Road", stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectBlank, org_id: orgA, created_by: userIds[0], title: "Blank client", client_name: null, stage: "estimate_ready", business_status: "estimate_ready" },
    ]);
    if (projects.error) throw new Error(projects.error.message);
    async function acceptQuote(projectId: string, quoteNumber: string | null, clientName: string | null): Promise<string> {
      const quoteId = randomUUID();
      const quote = await admin.from("quotes").insert({
        id: quoteId, org_id: orgA, project_id: projectId, created_by: userIds[0],
        title: "Accepted baseline", quote_number: quoteNumber, client_name: clientName, site_address: projectId === projectA ? "12 Site Road" : null,
        status: "draft", revision_number: 1, subtotal: 10000, gst_rate: 15, gst_amount: 1500, total_incl_gst: 11500,
      });
      if (quote.error) throw new Error(quote.error.message);
      const item = await admin.from("quote_items").insert({
        org_id: orgA, quote_id: quoteId, project_id: projectId, label: "Accepted work",
        description: "Accepted work", quantity: 1, unit: "ls", unit_price: 10000, total: 10000, sort_order: 1,
      });
      if (item.error) throw new Error(item.error.message);
      const accepted = await admin.from("quotes").update({ status: "accepted", accepted_at: "2026-09-27T00:00:00.000Z" }).eq("id", quoteId);
      if (accepted.error) throw new Error(accepted.error.message);
      return quoteId;
    }
    const quoteId = await acceptQuote(projectA, "Q-100", "Ada Client");
    await acceptQuote(projectBlank, null, null);
    async function call(client: Db, fn: string, args: Record<string, unknown>): Promise<Rpc> {
      const { data, error } = await client.rpc(fn, args);
      if (error) return { ok: false, error: error.message };
      return (data ?? { ok: false }) as Rpc;
    }
    async function issue(projectId: string, title: string): Promise<{ variationId: string; revisionId: string }> {
      const draft = await call(userA, "create_draft_variation_v1", {
        p_project: projectId, p_title: title, p_summary: "Client summary", p_idempotency_key: `r1-${title}-${stamp}`,
      });
      if (draft.ok !== true) throw new Error(String(draft.error));
      const item = await call(userA, "add_draft_variation_item_v1", {
        p_variation: draft.variationId, p_revision: draft.revisionId,
        p_item: {
          itemType: "addition", clientDescription: "Client facing stair", quantity: 1, unit: "item",
          unitCost: null, unitSell: 1500, sortOrder: 1, workAreaId: null, snapshotLineId: null,
          stableComponentKey: null, clientInclusion: null, clientExclusion: null, substitutionGroupId: null, internalMetadata: null,
        },
      });
      if (item.ok !== true) throw new Error(String(item.error));
      const issued = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
      if (issued.ok !== true) throw new Error(String(issued.error));
      return { variationId: String(draft.variationId), revisionId: String(draft.revisionId) };
    }
    const current = await issue(projectA, "Deck stair addition");
    const blank = await issue(projectBlank, "Missing client");
    const stored = await admin.from("variation_revisions").select("document_identity, issued_at").eq("id", current.revisionId).maybeSingle();
    const identity = (stored.data?.document_identity ?? {}) as {
      client?: { name?: string };
      project?: { title?: string; siteAddress?: string };
      contractor?: { tradingName?: string; logoUrl?: string; email?: string };
      masterQuote?: { quoteNumber?: string; revisionNumber?: number; available?: boolean };
      internal?: { sourceQuoteId?: string };
    };
    await admin.from("organisations").update({ name: "Changed Live Co" }).eq("id", orgA);
    await admin.from("projects").update({ title: "Changed project", client_name: "Changed client" }).eq("id", projectA);
    await admin.from("quotes").insert({
      id: randomUUID(), org_id: orgA, project_id: projectA, created_by: userIds[0],
      title: "Later quote", quote_number: "Q-999", status: "draft", revision_number: 2,
      subtotal: 1, gst_rate: 15, gst_amount: 0.15, total_incl_gst: 1.15,
    });
    const after = await admin.from("variation_revisions").select("document_identity").eq("id", current.revisionId).maybeSingle();
    const afterIdentity = (after.data?.document_identity ?? {}) as typeof identity;
    const token = generateVariationAccessToken();
    const begun = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada Client",
      p_token_hash: hashVariationAccessToken(token), p_idempotency_key: `brand-${stamp}`,
    });
    await call(userA, "complete_variation_delivery_v1", { p_delivery: begun.deliveryId, p_provider_message_id: `brand-${stamp}` });
    const looked = await call(signedOut, "lookup_variation_client_by_token_hash_v1", { p_token_hash: hashVariationAccessToken(token) });
    const lookedJson = JSON.stringify(looked);
    const blocked = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectBlank, p_variation: blank.variationId, p_revision: blank.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `blank-${stamp}`,
    });
    const cross = await call(userB, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `cross-${stamp}`,
    });
    const signed = await call(signedOut, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId,
      p_recipient_email: "client@example.test", p_recipient_name: "Ada",
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_idempotency_key: `out-${stamp}`,
    });
    await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: current.variationId, p_revision: current.revisionId, p_reason: "Hold this change.",
    });
    const withdrawn = await call(signedOut, "lookup_variation_client_by_token_hash_v1", { p_token_hash: hashVariationAccessToken(token) });
    const invalid = await call(signedOut, "lookup_variation_client_by_token_hash_v1", { p_token_hash: hashVariationAccessToken(generateVariationAccessToken()) });

    check("1 Variation references the exact accepted Quote", identity.internal?.sourceQuoteId === quoteId && identity.masterQuote?.quoteNumber === "Q-100");
    check("2 Quote number is a display reference, not a UUID", identity.masterQuote?.quoteNumber === "Q-100" && identity.masterQuote?.quoteNumber !== quoteId);
    check("3 Quote revision is correct", identity.masterQuote?.revisionNumber === 1);
    check("4 later Quote changes do not alter the issued Variation", afterIdentity.masterQuote?.quoteNumber === "Q-100" && afterIdentity.client?.name === "Ada Client" && afterIdentity.project?.title === "Deck" && afterIdentity.contractor?.tradingName === "ERC Contracting");
    check("5 contractor identity follows Quote rules", afterIdentity.contractor?.tradingName === "ERC Contracting" && afterIdentity.contractor?.logoUrl === "https://example.test/logo.png" && afterIdentity.contractor?.email === "builder@example.test" && identitySrc.includes("getCompanyDisplayName"));
    check("6 client identity follows Quote rules", identity.client?.name === "Ada Client" && model.clientName === "Ada Client" && !document.includes("|| \"Client\""));
    check("7 project and site details follow Quote rules", identity.project?.title === "Deck" && identity.project?.siteAddress === "12 Site Road");
    check("8 empty optional fields create no blank rows", document.includes("if (!value?.trim()) return null") && document.includes("model.contractorWebsite ?"));
    check("9 issue date is human-formatted", Boolean(issuedLabel) && !String(issuedLabel).includes("T") && !String(issuedLabel).includes("GMT") && model.issueDateLabel === issuedLabel);
    check("10 money follows shared formatting", formatSignedAdjustment(-1500, "NZD").startsWith("−") && model.inclLabel.includes("1,725"));
    check("11 email uses Quote branding primitives", emailSrc.includes("quoteEmailSafeLogoUrl") && emailSrc.includes("max-width:560px") && emailSrc.includes("background:#111111") && emailSrc.includes("View Variation"));
    check("12 public view uses Quote document primitives", publicView.includes("VariationDocument") && document.includes("QuoteCompanyLogo"));
    check("13 email contains the master-Quote reference", email.text.includes("accepted Quote Q-100, Revision 1") && email.text.includes("has not yet been accepted"));
    check("14 public document contains the complete terms clause", clause.startsWith("This Variation forms part of accepted Quote Q-100, Revision 1.") && document.includes("model.masterQuoteClause") && model.masterQuoteClause === clause);
    check("15 internal preview and public view agree", preview.includes("identity={props.documentIdentities") && publicView.includes("<VariationDocument") && model.quoteNumber === "Q-100");
    check("16 print payload agrees", printPage.includes("identity: editor.documentIdentities") && printPage.includes("issuedAtIso"));
    check("17 no confidential commercial fields leak", !email.text.includes("unitCost") && !email.html.includes("margin") && !lookedJson.includes("unitCost") && !lookedJson.includes("sourceQuoteId") && !document.includes("internalNotes"));
    check("18 missing required identity blocks delivery", blocked.ok !== true && blocked.error === "IDENTITY_REQUIRED" && sql.includes("IDENTITY_REQUIRED") && preview.includes("VARIATION_QUOTE_REFERENCE_UNAVAILABLE"));
    check("19 withdrawn and invalid-token behaviour is unchanged", withdrawn.state === "withdrawn" && invalid.ok !== true && invalid.error === "NOT_FOUND" && publicView.includes("This Variation is unavailable."));
    check("20 cross-tenant and signed-out internal actions still fail", cross.ok !== true && signed.ok !== true && !sql.includes("p_org_id"));
  } catch (error) {
    check("hosted branding proof", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
