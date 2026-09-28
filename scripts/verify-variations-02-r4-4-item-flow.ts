/**
 * VARIATIONS-02-R4.4 — simplified Add item and cost build-up flow.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-r4-4-item-flow.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { componentLineCost } from "../lib/variations/domain";
import { buildVariationDocument, sellFromKnownCost, signedUnitFromMagnitude } from "../lib/variations/presentation";
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
  return readFileSync(join(root, path), "utf8");
}

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return from >= 0 && to > from ? source.slice(from, to) : "";
}

const editor = read("components/variations/VariationEditor.tsx");
const domain = read("lib/variations/domain.ts");
const actions = read("lib/variations/actions.ts");
const componentForm = between(editor, "← Back to item", "Component COST");
const footer = between(editor, "shrink-0 border-t bg-popover", "</DialogFooter>");
const componentFooter = between(footer, "activeComponentEditor ? (", ") : (");
const itemFooter = footer.slice(footer.indexOf(") : ("));
const summary = between(editor, "Add at least one cost.", "Enter a manual client sell");
const parentSubmit = between(editor, "<form className=\"flex min-h-0 flex-1 flex-col\"", "if (props.pending) return;");
const clientMap = between(domain, "items: revision.items.map((item) => ({", "})),");
const saveBuildUp = between(actions, "export async function saveDraftVariationBuildUp", "const { data: rpcData, error }");

console.log("\nItem flow");
check("change type is always visibly labelled", editor.includes("Change type") && editor.includes("\"Addition\"") && editor.includes("\"Omission\"") && editor.includes("\"Substitution\"") && editor.includes("Adds scope and contract value") && editor.includes("Removes scope and reduces contract value") && editor.includes("Replaces accepted scope") && editor.includes("role=\"radiogroup\""));
check("existing domain values remain unchanged", editor.includes("\"addition\"") && editor.includes("\"omission\"") && editor.includes("\"substitution\"") && editor.includes("\"no_cost\"") && editor.includes("no_cost_scope_change"));
check("pricing methods map to existing stored values", editor.includes("value: \"simple\"") && editor.includes("value: \"build_up\"") && editor.includes("Enter a total price") && editor.includes("Build from materials and labour") && editor.includes("Simple price") && editor.includes("Build from costs"));
check("build from costs opens with no component editor", editor.includes("useState<CostDraft | null>(null)") && editor.includes("+ Add cost") && !editor.includes("useState(blankCostDraft())"));
check("add cost enters the focused component view", editor.includes("openEditor(blankCostDraft())") && editor.includes("Add cost") && editor.includes("Edit cost"));
check("parent fields are not displayed in the focused component view", componentForm.includes("Cost category") && componentForm.includes("Cost source") && !componentForm.includes("Client-facing description") && !componentForm.includes("Change type") && !componentForm.includes("Target gross margin") && !componentForm.includes("Client sell total"));
check("cancel component preserves the item draft", between(editor, "function cancelComponent()", "actionsRef.current.save").includes("setDraft(null)") && !between(editor, "function cancelComponent()", "actionsRef.current.save").includes("props.onChange"));
check("save component returns to the item summary", between(editor, "function saveComponent()", "function cancelComponent()").includes("props.onChange") && between(editor, "function saveComponent()", "function cancelComponent()").includes("setDraft(null)") && editor.includes("No costs added yet."));
check("rate-backed component is not duplicated across several fields", editor.includes("Edit internal description") && editor.includes("rateLocked && !showDescription") && componentForm.includes("Change rate"));
check("manual entry retains description, quantity, unit and unit COST", componentForm.includes("Internal description") && componentForm.includes("label=\"Component quantity\"") && componentForm.includes(">Unit<") && componentForm.includes("Internal COST per unit"));
check("component cards show category, source and arithmetic", editor.includes("COST_CATEGORY_LABELS[row.category]") && editor.includes(" × ") && editor.includes(">Edit<") && editor.includes(">Remove<"));
check("only one primary action is active at a time", componentFooter.includes("Add cost") && componentFooter.includes("Save cost") && !componentFooter.includes("type=\"submit\"") && itemFooter.includes("type=\"submit\"") && itemFooter.includes("\"Add item\"") && itemFooter.includes("Save item"));
check("incomplete pricing has one clear message", summary.includes("Add at least one cost.") && summary.includes("Add the missing internal cost before saving this item.") && summary.includes("Internal COST") && summary.includes("Client sell") && !summary.includes("VARIATION_PRICING_REQUIRED_LABEL") && !summary.includes("Internal cost incomplete"));
check("parent item cannot submit from the component view", parentSubmit.includes("activeComponentEditor") && parentSubmit.includes("?.save()") && parentSubmit.includes("return"));

console.log("\nCommercial protection");
check("existing COST and sell calculations are unchanged", componentLineCost(10, 22) === 220 && sellFromKnownCost(220, 20) === 275 && editor.includes("sellFromKnownCost") && editor.includes("componentLineCost") && saveBuildUp.includes("unitCost: resolved.effectiveCost"));
check("legacy simple-price items still edit correctly", editor.includes("Internal cost per unit") && editor.includes("Client sell per unit, ex GST") && editor.includes("pricingMode === \"simple\"") && editor.includes("Reset to calculated sell"));
check("omission and substitution behaviour is unchanged", signedUnitFromMagnitude("omission", 100) === -100 && signedUnitFromMagnitude("addition", 100) === 100 && editor.includes("kind === \"omission\"") && editor.includes("substitutionGroupId: groupId") && editor.includes("Delete this substitution and add it again to change the type.") && editor.includes("Complete both sides of the substitution."));
const document = buildVariationDocument({
  companyName: "ERC",
  clientName: "Client",
  projectTitle: "Deck",
  siteAddress: null,
  variationNumber: 1,
  revisionNumber: 1,
  issuedAt: null,
  status: "draft",
  title: "Stair",
  summary: null,
  clientNotes: null,
  currency: "NZD",
  items: [{ itemType: "addition", clientDescription: "Client facing stair", lineSellAdjustmentExGst: 100, substitutionGroupId: null, sortOrder: 1 }],
  totals: { totalSellAdjustmentExGst: 100, gstAdjustment: 15, totalAdjustmentInclGst: 115 },
  baseline: { sellExGst: 10000, sellInclGst: 11500 },
  proposed: null,
});
const documentJson = JSON.stringify(document);
check("client output remains confidential", !clientMap.includes("unitCost") && !clientMap.includes("costSource") && !clientMap.includes("canonicalRateKey") && documentJson.includes("Client facing stair") && !documentJson.includes("company_rate") && !documentJson.includes("unitCost"));
check("search cache and server re-resolution stay in place", editor.includes("catalogue: true") && editor.includes("rememberRateCatalogue") && saveBuildUp.includes("resolveVariationComponentRate"));

type Db = SupabaseClient;
type Rpc = { ok?: boolean; error?: string; variationId?: string; revisionId?: string; itemId?: string; componentIds?: string[] };

async function hostedProof(): Promise<void> {
  console.log("\nHosted Preview proof");
  const env = Object.fromEntries(
    read(".env.local")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
      })
  );
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
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = randomUUID().slice(0, 8);
  const emailA = `hello+variations-02r44.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-02r44b.${stamp}@erccontracting.co.nz`;
  const password = `Var02R44-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(emailA);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(emailA) && !isPasswordProtectedPreviewAccount(emailB));
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
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
    async function userFor(email: string, orgId: string): Promise<Db> {
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? email);
      userIds.push(created.data.user.id);
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 02R44" });
      if (profile.error) throw new Error(profile.error.message);
      const membership = await admin.from("organisation_memberships").insert({
        org_id: orgId, user_id: created.data.user.id, role: "owner", status: "active", joined_at: new Date().toISOString(),
      });
      if (membership.error) throw new Error(membership.error.message);
      const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
      const signedIn = await client.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw new Error(signedIn.error.message);
      return client;
    }
    const orgs = await admin.from("organisations").insert([
      { id: orgA, name: `Variations 02R44 ${stamp}` },
      { id: orgB, name: `Variations 02R44 other ${stamp}` },
    ]);
    if (orgs.error) throw new Error(orgs.error.message);
    const settings = await admin.from("organisation_settings").insert([
      { org_id: orgA, default_margin_percent: 20, default_gst_rate: 15, currency: "NZD" },
      { org_id: orgB, default_margin_percent: 20, default_gst_rate: 15, currency: "NZD" },
    ]);
    if (settings.error) throw new Error(settings.error.message);
    const userA = await userFor(emailA, orgA);
    const userB = await userFor(emailB, orgB);
    const signedOut = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const project = await admin.from("projects").insert({
      id: projectA, org_id: orgA, created_by: userIds[0], title: `Item flow ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready",
    });
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
    const draft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Item flow", p_summary: "Costs", p_idempotency_key: `r44-${stamp}`,
    });
    const built = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: null, p_confirm: false,
      p_item: {
        itemType: "addition", clientDescription: "Client facing stair", quantity: 1, unit: "item",
        workAreaId: null, snapshotLineId: null, sortOrder: 1, substitutionGroupId: null,
        sellProvenance: "calculated", targetMarginPercent: 20, manualSellTotal: null,
      },
      p_components: [{ category: "material", description: "Braceline plasterboard sheet", quantity: 10, unit: "each", unitCost: 22, sortOrder: 0 }],
    });
    const issued = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    const issuedWrite = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_confirm: false,
      p_item: {
        itemType: "addition", clientDescription: "Changed after issue", quantity: 1, unit: "item",
        workAreaId: null, snapshotLineId: null, sortOrder: 1, substitutionGroupId: null,
        sellProvenance: "calculated", targetMarginPercent: 20, manualSellTotal: null,
      },
      p_components: [{ category: "material", description: "Changed", quantity: 1, unit: "each", unitCost: 1, sortOrder: 0 }],
    });
    const withdrawn = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: draft.variationId, p_revision: draft.revisionId, p_reason: "Hold this change.",
    });
    const withdrawnWrite = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_confirm: false,
      p_item: {
        itemType: "addition", clientDescription: "Changed after withdrawal", quantity: 1, unit: "item",
        workAreaId: null, snapshotLineId: null, sortOrder: 1, substitutionGroupId: null,
        sellProvenance: "calculated", targetMarginPercent: 20, manualSellTotal: null,
      },
      p_components: [{ category: "material", description: "Changed", quantity: 1, unit: "each", unitCost: 1, sortOrder: 0 }],
    });
    const stored = await admin.from("variation_items").select("client_description").eq("id", built.itemId ?? "").maybeSingle();
    const component = await admin.from("variation_item_cost_components").select("unit_cost").eq("id", built.componentIds?.[0] ?? "").maybeSingle();
    check(
      "issued and withdrawn writes remain rejected",
      issued.ok === true && withdrawn.ok === true && issuedWrite.ok === false && withdrawnWrite.ok === false && stored.data?.client_description === "Client facing stair" && Number(component.data?.unit_cost) === 22,
      issued.error ?? issuedWrite.error ?? withdrawn.error ?? withdrawnWrite.error
    );
    const foreign = await call(userB, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_confirm: false,
      p_item: {
        itemType: "addition", clientDescription: "Foreign", quantity: 1, unit: "item",
        workAreaId: null, snapshotLineId: null, sortOrder: 1, substitutionGroupId: null,
        sellProvenance: "manual", targetMarginPercent: 20, manualSellTotal: 9,
      },
      p_components: [],
    });
    const signedOutResult = await call(signedOut, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_confirm: false,
      p_item: {
        itemType: "addition", clientDescription: "Anon", quantity: 1, unit: "item",
        workAreaId: null, snapshotLineId: null, sortOrder: 1, substitutionGroupId: null,
        sellProvenance: "manual", targetMarginPercent: 20, manualSellTotal: 9,
      },
      p_components: [],
    });
    const after = await admin.from("variation_items").select("client_description").eq("id", built.itemId ?? "").maybeSingle();
    check("cross-tenant and signed-out access fail", foreign.ok === false && signedOutResult.ok !== true && after.data?.client_description === "Client facing stair", foreign.error ?? signedOutResult.error);
  } finally {
    await cleanup();
  }
}

hostedProof()
  .catch((error) => {
    check("hosted proof completed", false, error instanceof Error ? error.message : String(error));
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });
