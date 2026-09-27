/**
 * VARIATIONS-02-R2 — manual editor, performance and safe draft deletion.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-r2-editor-performance.ts
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { roundMoney } from "../lib/commercial-engine/core/money";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { clientFacingVariation, internalSellFromKnownCost } from "../lib/variations/domain";
import {
  variationIssueReadiness,
  variationUnitLineReadout,
} from "../lib/variations/presentation";
import {
  cleanupPreviewFixtureOrgs,
  registerPreviewFixtureOrg,
} from "./lib/preview-admin-cleanup";
import {
  assertSafePreviewPasswordMutation,
  isPasswordProtectedPreviewAccount,
} from "./lib/preview-auth-fixture";

const root = join(__dirname, "..");
let passed = 0;
let failed = 0;
const samples: string[] = [];

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

function money(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

const editor = read("components/variations/VariationEditor.tsx");
const list = read("components/variations/VariationList.tsx");
const workspace = read("lib/variations/workspace-actions.ts");
const actions = read("lib/variations/actions.ts");
const sql065 = read("supabase/migrations/065_delete_unissued_draft_variation.sql");
const domain = read("lib/variations/domain.ts");
const diff = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: root, encoding: "utf8" });

console.log("\nA. Creation");
check("A create surface is hidden until requested", list.includes("createOpen") && list.includes("props.eligible && createOpen"));
check("A cancel closes without calling create", list.includes("function closeCreate") && list.includes("onClick={closeCreate}") && list.includes("Cancel") && !list.slice(list.indexOf("function closeCreate"), list.indexOf("async function submitCreate")).includes("createDraftVariation"));
check("A create navigates to the draft editor", list.includes("router.push") && list.includes("/variations/${created.variationId}"));
check("A double submission uses one idempotency key and a lock", list.includes("createKey") && list.includes("createLock.current"));

console.log("\nB. Complete editing");
check("B saved item editor includes quantity, unit, cost, margin and sell", editor.includes('label="Quantity"') && editor.includes('label="Unit"') && editor.includes("Internal cost per unit") && editor.includes("Target gross margin") && editor.includes("Client sell per unit, ex GST"));
check("B reset restores calculated sell", editor.includes("Reset to calculated sell") && editor.includes('setProvenance("calculated")'));
check("B manual sell is recorded", editor.includes(': "manual"'));
check("B substitution stays a linked pair", editor.includes("substitutionGroupId: groupId") && editor.includes("deleteDraftVariationItem"));
check("B substitution type change requires delete and recreate", editor.includes("Delete this substitution and add it again to change the type."));
check("B issued revisions do not open the item editor", editor.includes("{draft && itemEditor"));

console.log("\nC. Labelling and arithmetic");
const readout = variationUnitLineReadout({
  quantity: 15,
  unit: "lm",
  unitCost: 650,
  unitSell: 722.22,
  sign: 1,
  currency: "NZD",
});
check("C cost and sell are labelled per unit", editor.includes("Internal cost per unit") && editor.includes("Client sell per unit, ex GST"));
check("C line cost equals quantity times unit cost", readout.lineCost === roundMoney(15 * 650) && readout.lineCost === 9750);
check("C line sell equals quantity times unit sell", readout.lineSell === roundMoney(15 * 722.22));
check("C shared rounding is preserved", internalSellFromKnownCost(650, 0.1) === roundMoney(650 / 0.9));
check("C client document component has no internal cost", !read("components/variations/VariationDocument.tsx").includes("unitCost") && !read("components/variations/VariationDocument.tsx").includes("margin"));

console.log("\nD. Readiness");
const empty = variationIssueReadiness({ title: "Deck", summary: "Scope", items: [] });
const unpriced = variationIssueReadiness({
  title: "Deck",
  summary: "Scope",
  items: [{ itemType: "addition", clientDescription: "Stair", quantity: 1, unit: "item", unitSell: null, unitCost: null, substitutionGroupId: null }],
});
const noCost = variationIssueReadiness({
  title: "Deck",
  summary: "Scope",
  items: [{ itemType: "no_cost_scope_change", clientDescription: "Move the light", quantity: 1, unit: "item", unitSell: 0, unitCost: null, substitutionGroupId: null }],
});
const ready = variationIssueReadiness({
  title: "Deck",
  summary: "Scope",
  items: [{ itemType: "addition", clientDescription: "Stair", quantity: 1, unit: "item", unitSell: 100, unitCost: 80, substitutionGroupId: null }],
});
check("D empty draft is not ready", empty.ready === false && empty.blockerCodes.includes("EMPTY_VARIATION"));
check("D unpriced ordinary item blocks issue", unpriced.ready === false && unpriced.blockerCodes.includes("UNRESOLVED_PRICING"));
check("D explicit no-cost item can be ready", noCost.ready === true && noCost.blockers.length === 0);
check("D complete priced draft is ready", ready.ready === true && ready.blockers.length === 0);
check("D ready copy contains no blocker text", editor.includes("VARIATION_READY_DETAIL") && editor.includes("readiness.ready ? VARIATION_READY_HEADING"));
check("D blocked copy uses the not-ready heading", editor.includes("VARIATION_NOT_READY_HEADING"));
check("D issue button follows the canonical result", editor.includes("disabled={!readiness.ready || pending}"));

console.log("\nE. Deletion");
check("E delete function is security definer with a fixed search path", sql065.includes("delete_unissued_draft_variation_v1") && sql065.includes("security definer") && sql065.includes("set search_path = public"));
check("E delete rejects issued history", sql065.includes("ISSUED_HISTORY") && sql065.includes("issued_at is not null"));
check("E delete does not trust a client organisation id", !sql065.includes("p_org") && sql065.includes("auth_org_id()"));
check("E ordinary delete remains blocked without the delete mode", sql065.includes("v_mode = 'delete_draft'"));
check("E confirmation names the permanent draft deletion", editor.includes("Delete draft Variation?") && editor.includes("Variation numbers are not reused."));

console.log("\nF. Performance architecture");
const preview = editor.slice(editor.indexOf("function ClientPreview"));
check("F ordinary editor load does not build the print document", preview.indexOf("if (!props.open) return null") < preview.indexOf("buildVariationDocument"));
check("F editor loader starts the variation read with the snapshot", workspace.includes("loadVariation({ variationId })") && workspace.indexOf("loadVariation({ variationId })") < workspace.lastIndexOf("accepted_commercial_snapshots"));
check("F list does not reload the contract through a second snapshot query", !workspace.includes("sell_incl_gst\")\n    .eq"));
check("F variation header, revisions and items load together", actions.includes("const [variation, revisions, items] = await Promise.all"));
check("F add and edit open in client state", editor.includes('setItemEditor("add")') && editor.includes("setItemEditor(lead.id)"));
check("F pending and error states exist", editor.includes('role="alert"') && editor.includes("Saving…") && list.includes("Creating Variation…"));
check("F detail save does not force a route refresh", editor.includes("updateDraftVariation") && !editor.slice(editor.indexOf("updateDraftVariation"), editor.indexOf("updateDraftVariation") + 500).includes("true"));

console.log("\nG. Regression");
check("G sell formula is unchanged", domain.includes("return roundMoney(cost / (1 - marginRate))"));
check("G migrations 063 and 064 are not in this diff", !diff.includes("supabase/migrations/063_") && !diff.includes("supabase/migrations/064_"));
check("G estimate and quote calculation files are untouched", ["lib/estimate/", "lib/pricing/calculations.ts", "lib/quotes/build-from-pricing.ts"].every((path) => !diff.includes(path)));

type Db = SupabaseClient;
type RpcBody = { ok?: boolean; error?: string; variationId?: string; revisionId?: string; itemId?: string; idempotent?: boolean; variationNumber?: number };

async function hostedProof(): Promise<void> {
  console.log("\nHosted Preview proof");
  const env = Object.fromEntries(
    readFileSync(join(root, ".env.local"), "utf8")
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
  const email = `hello+variations-02r2.${stamp}@erccontracting.co.nz`;
  const password = `Var02R2-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(email);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(email));
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectB = randomUUID();
  const projectC = randomUUID();
  registerPreviewFixtureOrg(orgA);
  registerPreviewFixtureOrg(orgB);
  let userId = "";

  async function cleanup(): Promise<void> {
    try {
      cleanupPreviewFixtureOrgs([orgA, orgB]);
    } catch (error) {
      console.error("cleanup", error instanceof Error ? error.message : error);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  }

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) {
      check("hosted user", false, created.error?.message ?? "createUser");
      return;
    }
    userId = created.data.user.id;
    const orgInsert = await admin.from("organisations").insert([
      { id: orgA, name: `Variations 02R2 ${stamp}` },
      { id: orgB, name: `Variations 02R2 other ${stamp}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    const profile = await admin.from("profiles").insert({ id: userId, org_id: orgA, role: "owner", full_name: "Variations 02R2" });
    if (profile.error) throw new Error(profile.error.message);
    const membership = await admin.from("organisation_memberships").insert({
      org_id: orgA, user_id: userId, role: "owner", status: "active", joined_at: new Date().toISOString(),
    });
    if (membership.error) throw new Error(membership.error.message);
    const settings = await admin.from("organisation_settings").insert({
      org_id: orgA, default_margin_percent: 20, default_gst_rate: 15, currency: "NZD",
    });
    if (settings.error) throw new Error(settings.error.message);
    const projects = await admin.from("projects").insert([
      { id: projectA, org_id: orgA, created_by: userId, title: `Deck ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectB, org_id: orgB, created_by: userId, title: `Foreign ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectC, org_id: orgA, created_by: userId, title: `Other ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
    ]);
    if (projects.error) throw new Error(projects.error.message);
    const user = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedOut = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await user.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(signedIn.error.message);

    async function baseline(projectId: string, orgId: string): Promise<void> {
      const quoteId = randomUUID();
      const quote = await admin.from("quotes").insert({
        id: quoteId, org_id: orgId, project_id: projectId, created_by: userId,
        title: "Accepted baseline", status: "draft", revision_number: 1,
        subtotal: 10000, gst_rate: 15, gst_amount: 1500, total_incl_gst: 11500,
      });
      if (quote.error) throw new Error(quote.error.message);
      const item = await admin.from("quote_items").insert({
        org_id: orgId, quote_id: quoteId, project_id: projectId, label: "Accepted work",
        description: "Accepted work", quantity: 1, unit: "ls", unit_price: 10000, total: 10000, sort_order: 1,
      });
      if (item.error) throw new Error(item.error.message);
      const accepted = await admin.from("quotes").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", quoteId);
      if (accepted.error) throw new Error(accepted.error.message);
    }
    await baseline(projectA, orgA);
    await baseline(projectB, orgB);
    await baseline(projectC, orgA);

    async function call(client: Db, fn: string, args: Record<string, unknown>): Promise<RpcBody> {
      const started = Date.now();
      const { data, error } = await client.rpc(fn, args);
      samples.push(`${fn} ${Date.now() - started}ms`);
      if (error) return { ok: false, error: error.message };
      return (data ?? { ok: false }) as RpcBody;
    }
    const line = (overrides: Record<string, unknown>) => ({
      itemType: "addition",
      clientDescription: "External stair set",
      workAreaId: null,
      snapshotLineId: null,
      stableComponentKey: null,
      quantity: 1,
      unit: "item",
      unitCost: 80,
      unitSell: 100,
      sortOrder: 1,
      clientInclusion: null,
      clientExclusion: null,
      substitutionGroupId: null,
      internalMetadata: { sellProvenance: "calculated", targetMarginPercent: 20 },
      ...overrides,
    });

    const foreign = await call(user, "create_draft_variation_v1", {
      p_project: projectB, p_title: "Foreign", p_summary: "No", p_idempotency_key: `r2-foreign-${stamp}`,
    });
    check("A cross-tenant create fails", foreign.ok !== true);
    const anonCreate = await call(signedOut, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Unsigned", p_summary: "No", p_idempotency_key: `r2-anon-${stamp}`,
    });
    check("A unsigned create fails", anonCreate.ok !== true);

    const key = `r2-create-${stamp}-key`;
    const first = await call(user, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Draft stair", p_summary: "First draft", p_idempotency_key: key,
    });
    const second = await call(user, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Draft stair", p_summary: "First draft", p_idempotency_key: key,
    });
    check("A valid create produces one draft", first.ok === true && Boolean(first.variationId), first.error);
    check("A repeated create with the same key is idempotent", second.ok === true && second.idempotent === true && second.variationId === first.variationId);
    if (!first.variationId || !first.revisionId) return;

    const added = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item: line({ quantity: 15, unit: "lm", unitCost: 650, unitSell: roundMoney(650 / 0.9), clientDescription: "Handrail" }),
    });
    check("B item is added", added.ok === true && Boolean(added.itemId), added.error);
    const edited = await call(user, "update_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item_id: added.itemId,
      p_item: line({ quantity: 2, unit: "m", unitCost: 100, unitSell: 125, clientDescription: "Wider handrail", sortOrder: 1 }),
    });
    check("B quantity, unit, cost and sell can be edited", edited.ok === true, edited.error);
    const stored = await user.from("variation_items").select("quantity, unit, unit_cost, unit_sell, line_sell_adjustment_ex_gst, line_cost_adjustment").eq("id", added.itemId).maybeSingle();
    const row = stored.data as { quantity: unknown; unit: string; unit_cost: unknown; unit_sell: unknown; line_sell_adjustment_ex_gst: unknown; line_cost_adjustment: unknown } | null;
    check("B edited quantity and unit are stored", money(row?.quantity) === 2 && row?.unit === "m");
    check("C stored line cost is quantity times unit cost", money(row?.line_cost_adjustment) === 200 && money(row?.unit_cost) === 100);
    check("C stored line sell is quantity times unit sell", money(row?.line_sell_adjustment_ex_gst) === 250 && money(row?.unit_sell) === 125);
    const manual = await call(user, "update_draft_variation_item_v1", {
      p_variation: first.variationId, p_revision: first.revisionId, p_item_id: added.itemId,
      p_item: line({ quantity: 2, unit: "m", unitCost: 100, unitSell: 140, clientDescription: "Wider handrail", internalMetadata: { sellProvenance: "manual", targetMarginPercent: 20 } }),
    });
    const manualRow = await user.from("variation_items").select("unit_sell").eq("id", added.itemId).maybeSingle();
    check("B manual unit sell persists", manual.ok === true && money((manualRow.data as { unit_sell?: unknown } | null)?.unit_sell) === 140);
    const reset = await call(user, "update_draft_variation_item_v1", {
      p_variation: first.variationId, p_revision: first.revisionId, p_item_id: added.itemId,
      p_item: line({ quantity: 2, unit: "m", unitCost: 100, unitSell: 125, clientDescription: "Wider handrail", internalMetadata: { sellProvenance: "calculated", targetMarginPercent: 20 } }),
    });
    const resetRow = await user.from("variation_items").select("unit_sell").eq("id", added.itemId).maybeSingle();
    check("B reset restores calculated unit sell", reset.ok === true && money((resetRow.data as { unit_sell?: unknown } | null)?.unit_sell) === 125);

    const omission = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId, p_revision: first.revisionId,
      p_item: line({ itemType: "omission", clientDescription: "Remove old rail", quantity: 1, unit: "item", unitCost: -50, unitSell: -80, sortOrder: 2 }),
    });
    const omissionRow = await user.from("variation_items").select("unit_sell, line_sell_adjustment_ex_gst").eq("id", omission.itemId).maybeSingle();
    check("B omission sign remains negative", omission.ok === true && money((omissionRow.data as { unit_sell?: unknown } | null)?.unit_sell) === -80 && money((omissionRow.data as { line_sell_adjustment_ex_gst?: unknown } | null)?.line_sell_adjustment_ex_gst) === -80);

    const groupId = randomUUID();
    const remove = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId, p_revision: first.revisionId,
      p_item: line({ itemType: "omission", clientDescription: "Remove narrow stair", unitSell: -200, unitCost: -120, sortOrder: 3, substitutionGroupId: groupId }),
    });
    const add = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId, p_revision: first.revisionId,
      p_item: line({ itemType: "addition", clientDescription: "Add wider stair", unitSell: 300, unitCost: 180, sortOrder: 4, substitutionGroupId: groupId }),
    });
    const pair = await user.from("variation_items").select("id").eq("substitution_group_id", groupId);
    check("B substitution pair is stored atomically as two rows", remove.ok === true && add.ok === true && (pair.data ?? []).length === 2);

    const noCost = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId, p_revision: first.revisionId,
      p_item: line({ itemType: "no_cost_scope_change", clientDescription: "Move the light", unitSell: 0, unitCost: null, sortOrder: 5, internalMetadata: { sellProvenance: "no_cost" } }),
    });
    check("D no-cost item is stored as zero, not a missing price", noCost.ok === true, noCost.error);

    const beforeSnap = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst").eq("project_id", projectA).maybeSingle();
    const disposable = await call(user, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Disposable draft", p_summary: "Delete me", p_idempotency_key: `r2-delete-${stamp}`,
    });
    const deleted = await call(user, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: disposable.variationId, p_revision: disposable.revisionId,
    });
    const gone = await admin.from("variations").select("id").eq("id", disposable.variationId);
    const goneItems = await admin.from("variation_items").select("id").eq("variation_id", disposable.variationId);
    const goneRevisions = await admin.from("variation_revisions").select("id").eq("variation_id", disposable.variationId);
    check("E never-issued draft can be deleted", deleted.ok === true, deleted.error);
    check("E items and revisions are removed", (gone.data ?? []).length === 0 && (goneItems.data ?? []).length === 0 && (goneRevisions.data ?? []).length === 0);
    const next = await call(user, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Next number", p_summary: "After delete", p_idempotency_key: `r2-next-${stamp}`,
    });
    check("E variation number is not reused", (next.variationNumber ?? 0) > (first.variationNumber ?? 0) && next.variationNumber !== disposable.variationNumber);
    const afterSnap = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst").eq("project_id", projectA).maybeSingle();
    check("E accepted contract remains unchanged", money(beforeSnap.data?.sell_ex_gst) === 10000 && money(afterSnap.data?.sell_ex_gst) === 10000);

    const issued = await call(user, "issue_variation_revision_v1", { p_variation: first.variationId, p_revision: first.revisionId });
    const deleteIssued = await call(user, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: first.variationId, p_revision: first.revisionId,
    });
    check("E issued history cannot be deleted", issued.ok === true && deleteIssued.ok !== true && deleteIssued.error === "ISSUED_HISTORY");
    const issuedEdit = await call(user, "update_draft_variation_item_v1", {
      p_variation: first.variationId, p_revision: first.revisionId, p_item_id: added.itemId,
      p_item: line({ clientDescription: "Changed after issue", unitSell: 999 }),
    });
    check("B issued item edits fail", issuedEdit.ok !== true);

    const acceptedDraft = await call(user, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Accept me", p_summary: "Accepted history", p_idempotency_key: `r2-accept-${stamp}`,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: acceptedDraft.variationId, p_revision: acceptedDraft.revisionId, p_item: line({ unitSell: 50, unitCost: 30 }),
    });
    await call(user, "issue_variation_revision_v1", { p_variation: acceptedDraft.variationId, p_revision: acceptedDraft.revisionId });
    const accepted = await call(user, "accept_variation_revision_v1", { p_variation: acceptedDraft.variationId, p_revision: acceptedDraft.revisionId });
    const deleteAccepted = await call(user, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: acceptedDraft.variationId, p_revision: acceptedDraft.revisionId,
    });
    check("E accepted history cannot be deleted", accepted.ok === true && deleteAccepted.error === "ISSUED_HISTORY");

    const crossProject = await call(user, "delete_unissued_draft_variation_v1", {
      p_project: projectC, p_variation: next.variationId, p_revision: next.revisionId,
    });
    check("E cross-project deletion fails", crossProject.error === "CROSS_PROJECT");
    const crossTenant = await call(user, "delete_unissued_draft_variation_v1", {
      p_project: projectB, p_variation: next.variationId, p_revision: next.revisionId,
    });
    check("E cross-tenant deletion fails", crossTenant.ok !== true);
    const signedOutDelete = await call(signedOut, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: next.variationId, p_revision: next.revisionId,
    });
    check("E signed-out deletion fails", signedOutDelete.ok !== true);
    const stale = await call(user, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: next.variationId, p_revision: randomUUID(),
    });
    check("E stale-state deletion fails", stale.error === "STALE_REVISION");

    const client = clientFacingVariation({
      id: first.variationId,
      projectId: projectA,
      variationNumber: first.variationNumber ?? 1,
      title: "Draft stair",
      summary: "First draft",
      status: "issued",
      revisions: [{
        id: first.revisionId,
        revisionNumber: 1,
        status: "issued",
        title: "Draft stair",
        summary: "First draft",
        currency: "NZD",
        gstRate: 15,
        taxTreatment: "exclusive",
        totalDirectCostAdjustment: 200,
        totalSellAdjustmentExGst: 250,
        gstAdjustment: 37.5,
        totalAdjustmentInclGst: 287.5,
        proposedTimeEffectDays: null,
        clientNotes: null,
        internalNotes: "SECRET INTERNAL NOTE",
        items: [{
          id: added.itemId ?? randomUUID(),
          itemType: "addition",
          clientDescription: "Wider handrail",
          quantity: 2,
          unit: "m",
          unitSell: 125,
          unitCost: 100,
          lineSellAdjustmentExGst: 250,
          lineCostAdjustment: 200,
          sortOrder: 1,
          clientInclusion: null,
          clientExclusion: null,
          substitutionGroupId: null,
          workAreaId: null,
          snapshotLineId: null,
          internalMetadata: { sellProvenance: "calculated", targetMarginPercent: 20 },
        }],
      }],
    });
    const clientJson = JSON.stringify(client);
    check("C client payload contains no cost or margin", !clientJson.includes("unitCost") && !clientJson.includes("targetMarginPercent") && !clientJson.includes("SECRET INTERNAL NOTE"));

    console.log("\nTiming samples (single Preview round trips, not p95)");
    for (const sample of samples) console.log(`  ${sample}`);
  } catch (error) {
    check("hosted proof", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup();
  }
}

hostedProof().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
