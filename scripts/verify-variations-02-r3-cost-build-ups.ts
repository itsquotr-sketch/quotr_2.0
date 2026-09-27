/**
 * VARIATIONS-02-R3 — structured cost build-ups.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-r3-cost-build-ups.ts
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { roundMoney } from "../lib/commercial-engine/core/money";
import {
  aggregateComponentCost,
  approximateClientUnitRate,
  componentLineCost,
  internalSellFromKnownCost,
} from "../lib/variations/domain";
import { buildVariationDocument } from "../lib/variations/presentation";
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

const sql = read("supabase/migrations/067_variation_cost_build_ups.sql");
const editor = read("components/variations/VariationEditor.tsx");
const documentView = read("components/variations/VariationDocument.tsx");
const domain = read("lib/variations/domain.ts");
const diff = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: root, encoding: "utf8" });

console.log("\nSchema and confidentiality source");
check("component table is organisation owned and draft guarded", sql.includes("variation_item_cost_components") && sql.includes("org_id = public.auth_org_id()") && sql.includes("VARIATION_IMMUTABLE") && sql.includes("pricing_mode"));
check("categories and non-negative component cost are constrained", sql.includes("'material'") && sql.includes("'labour'") && sql.includes("'subcontract'") && sql.includes("'plant'") && sql.includes("'allowance'") && sql.includes("'other'") && sql.includes("unit_cost >= 0"));
check("migration does not take a client organisation id or fixture authority", !sql.includes("p_org") && !sql.includes("preview_fixture_org"));
check("migrations 063 to 066 are not edited", !diff.includes("supabase/migrations/063_") && !diff.includes("supabase/migrations/064_") && !diff.includes("supabase/migrations/065_") && !diff.includes("supabase/migrations/066_"));
check("editor offers both pricing methods and a total sell", editor.includes("Simple price") && editor.includes("Build from costs") && editor.includes("Client sell total, ex GST") && editor.includes("Approx. client rate per unit"));
check("mode changes are explicit", editor.includes("does not turn the existing unit cost into components") && editor.includes("deletes the draft cost components") && editor.includes("Confirm pricing method change"));
check("internal incomplete-cost warning stays off the client document view", editor.includes("Internal cost is incomplete. Margin and profit are not available.") && !documentView.includes("Internal cost is incomplete") && !documentView.includes("variation_item_cost_components"));
check("simple price wording remains", editor.includes("Internal cost per unit") && editor.includes("Client sell per unit, ex GST") && domain.includes("return roundMoney(cost / (1 - marginRate))"));

const lines = [componentLineCost(15, 28), componentLineCost(9.6, 4.75), componentLineCost(12, 65), componentLineCost(1, 300)];
const cost = aggregateComponentCost(lines);
const sell = internalSellFromKnownCost(cost, 0.1);
const approx = sell == null ? null : approximateClientUnitRate(sell, 15);
check("golden component lines sum to 1545.60", lines.join(",") === "420,45.6,780,300" && cost === 1545.6);
check("golden calculated sell is 1717.33", sell === 1717.33);
check("golden profit gst and incl gst reconcile", sell != null && cost != null && roundMoney(sell - cost) === 171.73 && roundMoney(sell * 0.15) === 257.6 && roundMoney(sell + 257.6) === 1974.93);
check("approximate unit display does not replace the stored sell", approx === 114.49 && roundMoney(114.49 * 15) !== sell);
check("a missing component cost is not zero", componentLineCost(1, null) == null && aggregateComponentCost([420, null]) == null);

type Db = SupabaseClient;
type Rpc = {
  ok?: boolean;
  error?: string;
  variationId?: string;
  revisionId?: string;
  itemId?: string;
  componentId?: string;
  componentIds?: string[];
  variationNumber?: number;
};

function money(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  const emailA = `hello+variations-02r3.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-02r3b.${stamp}@erccontracting.co.nz`;
  const password = `Var02R3-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(emailA);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(emailA) && !isPasswordProtectedPreviewAccount(emailB));
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectC = randomUUID();
  const projectB = randomUUID();
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
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 02R3" });
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
      { id: orgA, name: `Variations 02R3 ${stamp}` },
      { id: orgB, name: `Variations 02R3 other ${stamp}` },
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
    const projects = await admin.from("projects").insert([
      { id: projectA, org_id: orgA, created_by: userIds[0], title: `Cladding ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectC, org_id: orgA, created_by: userIds[0], title: `Other ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectB, org_id: orgB, created_by: userIds[1], title: `Foreign ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
    ]);
    if (projects.error) throw new Error(projects.error.message);

    async function baseline(projectId: string, orgId: string, createdBy: string): Promise<void> {
      const quoteId = randomUUID();
      const quote = await admin.from("quotes").insert({
        id: quoteId, org_id: orgId, project_id: projectId, created_by: createdBy,
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
    await baseline(projectA, orgA, userIds[0]);
    await baseline(projectC, orgA, userIds[0]);
    await baseline(projectB, orgB, userIds[1]);

    async function call(client: Db, fn: string, args: Record<string, unknown>): Promise<Rpc> {
      const { data, error } = await client.rpc(fn, args);
      if (error) return { ok: false, error: error.message };
      return (data ?? { ok: false }) as Rpc;
    }

    const simpleLine = (overrides: Record<string, unknown> = {}) => ({
      itemType: "addition",
      clientDescription: "Legacy cladding",
      workAreaId: null,
      snapshotLineId: null,
      stableComponentKey: null,
      quantity: 2,
      unit: "lm",
      unitCost: 100,
      unitSell: 125,
      sortOrder: 1,
      clientInclusion: null,
      clientExclusion: null,
      substitutionGroupId: null,
      internalMetadata: { sellProvenance: "calculated", targetMarginPercent: 20 },
      ...overrides,
    });
    const goldenComponents = [
      { category: "material", description: "Bevelback weatherboards", quantity: 15, unit: "lm", unitCost: 28, sortOrder: 0 },
      { category: "material", description: "Cavity battens", quantity: 9.6, unit: "lm", unitCost: 4.75, sortOrder: 1 },
      { category: "labour", description: "Carpenter installation", quantity: 12, unit: "hours", unitCost: 65, sortOrder: 2 },
      { category: "allowance", description: "Flashings and sundries", quantity: 1, unit: "allowance", unitCost: 300, sortOrder: 3 },
    ];
    const parent = (overrides: Record<string, unknown> = {}) => ({
      itemType: "addition",
      clientDescription: "Additional front-door cladding",
      quantity: 15,
      unit: "lm",
      workAreaId: null,
      snapshotLineId: null,
      sortOrder: 1,
      substitutionGroupId: null,
      sellProvenance: "calculated",
      targetMarginPercent: 10,
      manualSellTotal: null,
      ...overrides,
    });

    const legacy = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Legacy simple", p_summary: "Unchanged money", p_idempotency_key: `r3-legacy-${stamp}`,
    });
    const legacyItem = await call(userA, "add_draft_variation_item_v1", {
      p_variation: legacy.variationId, p_revision: legacy.revisionId, p_item: simpleLine(),
    });
    const legacyIssued = await call(userA, "issue_variation_revision_v1", { p_variation: legacy.variationId, p_revision: legacy.revisionId });
    const legacyRow = await admin.from("variation_items").select("pricing_mode, unit_cost, unit_sell, line_cost_adjustment, line_sell_adjustment_ex_gst").eq("id", legacyItem.itemId ?? "").maybeSingle();
    const legacyComponents = await admin.from("variation_item_cost_components").select("id").eq("item_id", legacyItem.itemId ?? "");
    check("existing item remains simple price", legacyIssued.ok === true && legacyRow.data?.pricing_mode === "simple", legacyIssued.error);
    check("existing stored money is unchanged", money(legacyRow.data?.unit_cost) === 100 && money(legacyRow.data?.unit_sell) === 125 && money(legacyRow.data?.line_cost_adjustment) === 200 && money(legacyRow.data?.line_sell_adjustment_ex_gst) === 250);
    check("legacy item has no manufactured components", (legacyComponents.data ?? []).length === 0);

    const draft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Front door cladding", p_summary: "Golden build-up", p_idempotency_key: `r3-golden-${stamp}`,
    });
    const built = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: null, p_item: parent(), p_components: goldenComponents, p_confirm: false,
    });
    const builtRow = await admin.from("variation_items").select("pricing_mode, unit_cost, unit_sell, line_cost_adjustment, line_sell_adjustment_ex_gst, internal_metadata").eq("id", built.itemId ?? "").maybeSingle();
    const builtParts = await admin.from("variation_item_cost_components").select("id, category, description, quantity, unit, unit_cost, line_cost, sort_order").eq("item_id", built.itemId ?? "").order("sort_order");
    const builtRevision = await admin.from("variation_revisions").select("total_direct_cost_adjustment, total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst").eq("id", draft.revisionId ?? "").maybeSingle();
    const partCosts = (builtParts.data ?? []).map((row) => money(row.line_cost));
    check("golden build-up is stored", built.ok === true && builtRow.data?.pricing_mode === "build_up" && (builtParts.data ?? []).length === 4, built.error);
    check("golden COST is 1545.60", partCosts.join(",") === "420,45.6,780,300" && money(builtRow.data?.line_cost_adjustment) === 1545.6);
    check("golden sell profit gst and incl gst are stored", money(builtRow.data?.line_sell_adjustment_ex_gst) === 1717.33 && money(builtRevision.data?.gst_adjustment) === 257.6 && money(builtRevision.data?.total_adjustment_incl_gst) === 1974.93 && roundMoney(1717.33 - 1545.6) === 171.73);
    check("stored sell is not a rounded unit rate", builtRow.data?.unit_sell == null && builtRow.data?.unit_cost == null && money(builtRow.data?.line_sell_adjustment_ex_gst) === 1717.33);

    const componentIds = (built.componentIds ?? (builtParts.data ?? []).map((row) => row.id)) as string[];
    const withIds = goldenComponents.map((row, index) => ({ ...row, id: componentIds[index] }));
    const manual = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_confirm: false,
      p_item: parent({ sellProvenance: "manual", manualSellTotal: 2000 }),
      p_components: withIds,
    });
    const manualRow = await admin.from("variation_items").select("line_sell_adjustment_ex_gst, line_cost_adjustment, internal_metadata").eq("id", built.itemId ?? "").maybeSingle();
    const manualParts = await admin.from("variation_item_cost_components").select("id, unit_cost").eq("item_id", built.itemId ?? "").order("sort_order");
    const manualMeta = (manualRow.data?.internal_metadata ?? {}) as { effectiveMarginPercent?: number };
    check("manual total sell persists and component costs stay", manual.ok === true && money(manualRow.data?.line_sell_adjustment_ex_gst) === 2000 && money(manualRow.data?.line_cost_adjustment) === 1545.6 && (manualParts.data ?? []).map((row) => money(row.unit_cost)).join(",") === "28,4.75,65,300", manual.error);
    check("manual sell keeps the same component ids", (manualParts.data ?? []).map((row) => row.id).join(",") === componentIds.join(","));
    check("effective margin recalculates from stored money", manualMeta.effectiveMarginPercent != null && money(manualRow.data?.line_sell_adjustment_ex_gst) === 2000);
    const reset = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_confirm: false,
      p_item: parent({ sellProvenance: "calculated", manualSellTotal: null }),
      p_components: withIds,
    });
    const resetRow = await admin.from("variation_items").select("line_sell_adjustment_ex_gst").eq("id", built.itemId ?? "").maybeSingle();
    check("reset restores the calculated total sell", reset.ok === true && money(resetRow.data?.line_sell_adjustment_ex_gst) === 1717.33, reset.error);

    const cleared = await call(userA, "update_draft_variation_cost_component_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_component_id: componentIds[3],
      p_component: { category: "allowance", description: "Flashings and sundries", quantity: 1, unit: "allowance", unitCost: null, sortOrder: 3 },
    });
    const clearedRow = await admin.from("variation_items").select("line_cost_adjustment, line_sell_adjustment_ex_gst, internal_metadata").eq("id", built.itemId ?? "").maybeSingle();
    const clearedPart = await admin.from("variation_item_cost_components").select("unit_cost, line_cost").eq("id", componentIds[3] ?? "").maybeSingle();
    check("null component cost stays unresolved", cleared.ok === true && clearedPart.data?.unit_cost == null && clearedPart.data?.line_cost == null, cleared.error);
    check("unresolved cost is not treated as zero", money(clearedRow.data?.line_cost_adjustment) == null && money(clearedRow.data?.line_sell_adjustment_ex_gst) == null);
    const manualIncomplete = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_confirm: false,
      p_item: parent({ sellProvenance: "manual", manualSellTotal: 1800 }),
      p_components: withIds.map((row, index) => index === 3 ? { ...row, unitCost: null } : row),
    });
    const incompleteRow = await admin.from("variation_items").select("line_cost_adjustment, line_sell_adjustment_ex_gst, internal_metadata").eq("id", built.itemId ?? "").maybeSingle();
    const incompleteMeta = (incompleteRow.data?.internal_metadata ?? {}) as { effectiveMarginPercent?: number | null };
    const incompleteIssue = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    check("manual total can satisfy client-price readiness", manualIncomplete.ok === true && money(incompleteRow.data?.line_sell_adjustment_ex_gst) === 1800 && incompleteIssue.ok === true, incompleteIssue.error);
    check("margin and profit stay unavailable while cost is incomplete", incompleteRow.data?.line_cost_adjustment == null && incompleteMeta.effectiveMarginPercent == null);
    const issuedInsert = await call(userA, "add_draft_variation_cost_component_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId,
      p_component: { category: "other", description: "After issue", quantity: 1, unit: "item", unitCost: 10, sortOrder: 8 },
    });
    const issuedUpdate = await call(userA, "update_draft_variation_cost_component_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_component_id: componentIds[0],
      p_component: { category: "material", description: "Changed issued", quantity: 15, unit: "lm", unitCost: 99, sortOrder: 0 },
    });
    const issuedDelete = await call(userA, "delete_draft_variation_cost_component_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_component_id: componentIds[0],
    });
    const issuedReorder = await call(userA, "reorder_draft_variation_cost_components_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_ids: [...componentIds].reverse(),
    });
    check("issued component insert update delete and reorder fail", issuedInsert.error === "IMMUTABLE" && issuedUpdate.error === "IMMUTABLE" && issuedDelete.error === "IMMUTABLE" && issuedReorder.error === "IMMUTABLE", `${issuedInsert.error} ${issuedUpdate.error} ${issuedDelete.error} ${issuedReorder.error}`);
    const clientModel = buildVariationDocument({
      companyName: "ERC", clientName: "Client", projectTitle: "Cladding", siteAddress: null,
      variationNumber: 2, revisionNumber: 1, issuedAt: "28 Sept 2026", status: "issued",
      title: "Front door cladding", summary: "Golden build-up", clientNotes: null, currency: "NZD",
      items: [{ itemType: "addition", clientDescription: "Additional front-door cladding", quantity: 15, unit: "lm", lineSellAdjustmentExGst: 1800, substitutionGroupId: null, sortOrder: 1 }],
      totals: { totalSellAdjustmentExGst: 1800, gstAdjustment: 270, totalAdjustmentInclGst: 2070 },
      baseline: { sellExGst: 10000, sellInclGst: 11500 },
      proposed: { revisedContractValueExGst: 11800, gst: 1770, revisedContractValueInclGst: 13570 },
    });
    const clientJson = JSON.stringify(clientModel);
    check("client document keeps the parent scope and sell", clientJson.includes("Additional front-door cladding") && clientJson.includes("1,800.00") && clientJson.includes("15 lm"));
    check("client document omits components cost margin and the internal warning", !clientJson.includes("Bevelback") && !clientJson.includes("1545.60") && !clientJson.includes("margin") && !clientJson.includes("Internal cost is incomplete") && !clientJson.includes("material"));

    const restored = await call(userA, "create_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    check("issued incomplete revision can open a new draft", restored.ok === true && restored.revisionId !== draft.revisionId, restored.error);

    const omission = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Omit boards", p_summary: "Avoided cost", p_idempotency_key: `r3-omit-${stamp}`,
    });
    const omitted = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: omission.variationId, p_revision: omission.revisionId, p_item_id: null, p_confirm: false,
      p_item: parent({ itemType: "omission", clientDescription: "Omit weatherboards", quantity: 15, sellProvenance: "calculated" }),
      p_components: goldenComponents,
    });
    const omittedRow = await admin.from("variation_items").select("line_cost_adjustment, line_sell_adjustment_ex_gst").eq("id", omitted.itemId ?? "").maybeSingle();
    const omittedParts = await admin.from("variation_item_cost_components").select("unit_cost").eq("item_id", omitted.itemId ?? "");
    check("omission components stay positive and the commercial effect is negative", omitted.ok === true && (omittedParts.data ?? []).every((row) => (money(row.unit_cost) ?? -1) >= 0) && (money(omittedRow.data?.line_cost_adjustment) ?? 0) < 0 && money(omittedRow.data?.line_sell_adjustment_ex_gst) === -1717.33, omitted.error);

    const groupId = randomUUID();
    const substitution = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Swap boards", p_summary: "Paired", p_idempotency_key: `r3-sub-${stamp}`,
    });
    const removeSide = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: substitution.variationId, p_revision: substitution.revisionId, p_item_id: null, p_confirm: false,
      p_item: parent({ itemType: "omission", clientDescription: "Remove boards", substitutionGroupId: groupId, sortOrder: 1 }),
      p_components: [{ category: "material", description: "Old boards", quantity: 1, unit: "item", unitCost: 100, sortOrder: 0 }],
    });
    const addSide = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: substitution.variationId, p_revision: substitution.revisionId, p_item_id: null, p_confirm: false,
      p_item: parent({ itemType: "addition", clientDescription: "Add boards", substitutionGroupId: groupId, sortOrder: 2 }),
      p_components: [{ category: "material", description: "New boards", quantity: 1, unit: "item", unitCost: 180, sortOrder: 0 }],
    });
    const pairBefore = await admin.from("variation_items").select("id").eq("substitution_group_id", groupId);
    const deletedPair = await call(userA, "delete_draft_variation_item_v1", {
      p_variation: substitution.variationId, p_revision: substitution.revisionId, p_item_id: removeSide.itemId,
    });
    const pairAfter = await admin.from("variation_items").select("id").eq("substitution_group_id", groupId);
    const pairComponents = await admin.from("variation_item_cost_components").select("id").in("item_id", [removeSide.itemId ?? randomUUID(), addSide.itemId ?? randomUUID()]);
    check("substitution stays paired until delete removes both component sets", removeSide.ok === true && addSide.ok === true && (pairBefore.data ?? []).length === 2 && deletedPair.ok === true && (pairAfter.data ?? []).length === 0 && (pairComponents.data ?? []).length === 0, deletedPair.error);

    const noCostDraft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "No cost", p_summary: "Explicit", p_idempotency_key: `r3-nocost-${stamp}`,
    });
    const noCost = await call(userA, "add_draft_variation_item_v1", {
      p_variation: noCostDraft.variationId, p_revision: noCostDraft.revisionId,
      p_item: simpleLine({ itemType: "no_cost_scope_change", clientDescription: "Move the light", unitSell: 0, unitCost: null, internalMetadata: { sellProvenance: "no_cost" } }),
    });
    const noCostRow = await admin.from("variation_items").select("pricing_mode, line_sell_adjustment_ex_gst, unit_cost").eq("id", noCost.itemId ?? "").maybeSingle();
    const noCostParts = await admin.from("variation_item_cost_components").select("id").eq("item_id", noCost.itemId ?? "");
    check("no-cost stays explicit and has no inferred components", noCost.ok === true && noCostRow.data?.pricing_mode === "simple" && money(noCostRow.data?.line_sell_adjustment_ex_gst) === 0 && noCostRow.data?.unit_cost == null && (noCostParts.data ?? []).length === 0, noCost.error);

    const twin = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: noCostDraft.variationId, p_revision: noCostDraft.revisionId, p_item_id: null, p_confirm: false,
      p_item: parent({ clientDescription: "Additional front-door cladding", sortOrder: 2 }),
      p_components: goldenComponents,
    });
    const twinAgain = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: noCostDraft.variationId, p_revision: noCostDraft.revisionId, p_item_id: null, p_confirm: false,
      p_item: parent({ clientDescription: "Additional front-door cladding", sortOrder: 3 }),
      p_components: goldenComponents,
    });
    const twinParts = await admin.from("variation_item_cost_components").select("id, item_id").in("item_id", [twin.itemId ?? randomUUID(), twinAgain.itemId ?? randomUUID()]);
    const idsA = (twinParts.data ?? []).filter((row) => row.item_id === twin.itemId).map((row) => row.id);
    const idsB = (twinParts.data ?? []).filter((row) => row.item_id === twinAgain.itemId).map((row) => row.id);
    check("identical parents keep separate component ids", twin.ok === true && twinAgain.ok === true && idsA.length === 4 && idsB.length === 4 && idsA.every((id) => !idsB.includes(id)));

    const otherProject = await call(userA, "create_draft_variation_v1", {
      p_project: projectC, p_title: "Other project", p_summary: "Boundary", p_idempotency_key: `r3-other-${stamp}`,
    });
    const otherItem = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: otherProject.variationId, p_revision: otherProject.revisionId, p_item_id: null, p_confirm: false,
      p_item: parent(), p_components: goldenComponents.slice(0, 1),
    });
    const crossItem = await call(userA, "add_draft_variation_cost_component_v1", {
      p_variation: otherProject.variationId, p_revision: otherProject.revisionId, p_item_id: otherItem.itemId,
      p_component: { itemId: twin.itemId, category: "material", description: "Wrong parent", quantity: 1, unit: "lm", unitCost: 1, sortOrder: 9 },
    });
    const crossProject = await call(userA, "add_draft_variation_cost_component_v1", {
      p_variation: otherProject.variationId, p_revision: otherProject.revisionId, p_item_id: twin.itemId,
      p_component: { category: "material", description: "Wrong project", quantity: 1, unit: "lm", unitCost: 1, sortOrder: 9 },
    });
    const crossTenant = await call(userB, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: built.itemId, p_confirm: true, p_item: parent(), p_components: goldenComponents,
    });
    const signedOutWrite = await call(signedOut, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: null, p_confirm: false, p_item: parent(), p_components: goldenComponents,
    });
    const direct = await userA.from("variation_item_cost_components").insert({
      org_id: orgA, project_id: projectA, variation_id: draft.variationId, revision_id: draft.revisionId, item_id: built.itemId,
      category: "other", description: "Direct", quantity: 1, unit: "item", unit_cost: 1, line_cost: 1, sort_order: 9,
    });
    check("cross-item attachment fails", crossItem.ok !== true);
    check("cross-project attachment fails", crossProject.error === "CROSS_PROJECT", crossProject.error);
    check("cross-tenant build-up fails", crossTenant.error === "CROSS_TENANT", crossTenant.error);
    check("signed-out build-up fails", signedOutWrite.ok !== true);
    check("RLS rejects a direct component insert", direct.error != null);

    const copied = await admin.from("variation_items").select("id, line_sell_adjustment_ex_gst").eq("revision_id", restored.revisionId ?? "").eq("client_description", "Additional front-door cladding");
    const copiedItemId = copied.data?.[0]?.id;
    const copiedParts = await admin.from("variation_item_cost_components").select("id, unit_cost").eq("item_id", copiedItemId ?? "").order("sort_order");
    const issuedPartsBefore = await admin.from("variation_item_cost_components").select("unit_cost, description").eq("item_id", built.itemId ?? "").order("sort_order");
    const edited = await call(userA, "update_draft_variation_cost_component_v1", {
      p_variation: draft.variationId, p_revision: restored.revisionId, p_item_id: copiedItemId, p_component_id: copiedParts.data?.[0]?.id,
      p_component: { category: "material", description: "Bevelback weatherboards", quantity: 15, unit: "lm", unitCost: 30, sortOrder: 0 },
    });
    const issuedPartsAfter = await admin.from("variation_item_cost_components").select("unit_cost, description").eq("item_id", built.itemId ?? "").order("sort_order");
    check("new revision copies components and editing it leaves the issued revision unchanged", edited.ok === true && (copiedParts.data ?? []).length === 4 && JSON.stringify(issuedPartsBefore.data) === JSON.stringify(issuedPartsAfter.data), edited.error);

    const disposable = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Withdraw me", p_summary: "Disposable", p_idempotency_key: `r3-wd-${stamp}`,
    });
    const disposableItem = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: disposable.variationId, p_revision: disposable.revisionId, p_item_id: null, p_confirm: false,
      p_item: parent({ clientDescription: "Disposable cladding" }), p_components: goldenComponents,
    });
    const disposableIssue = await call(userA, "issue_variation_revision_v1", { p_variation: disposable.variationId, p_revision: disposable.revisionId });
    const beforeWithdraw = await admin.from("variation_item_cost_components").select("id, line_cost").eq("item_id", disposableItem.itemId ?? "").order("sort_order");
    const withdrawn = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: disposable.variationId, p_revision: disposable.revisionId, p_reason: "Hold the cladding.",
    });
    const afterWithdraw = await admin.from("variation_item_cost_components").select("id, line_cost").eq("item_id", disposableItem.itemId ?? "").order("sort_order");
    check("withdrawal preserves the issued component build-up", disposableIssue.ok === true && withdrawn.ok === true && JSON.stringify(beforeWithdraw.data) === JSON.stringify(afterWithdraw.data), withdrawn.error);

    const doomed = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Delete me", p_summary: "Draft components", p_idempotency_key: `r3-del-${stamp}`,
    });
    const doomedItem = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: doomed.variationId, p_revision: doomed.revisionId, p_item_id: null, p_confirm: false,
      p_item: parent({ clientDescription: "Temporary cladding" }), p_components: goldenComponents,
    });
    const removed = await call(userA, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: doomed.variationId, p_revision: doomed.revisionId,
    });
    const doomedParts = await admin.from("variation_item_cost_components").select("id").eq("item_id", doomedItem.itemId ?? "");
    check("draft deletion deletes draft components", doomedItem.ok === true && removed.ok === true && (doomedParts.data ?? []).length === 0, removed.error);

    const legacyAfter = await admin.from("variation_items").select("line_sell_adjustment_ex_gst, pricing_mode").eq("id", legacyItem.itemId ?? "").maybeSingle();
    const legacyPartsAfter = await admin.from("variation_item_cost_components").select("id").eq("item_id", legacyItem.itemId ?? "");
    check("legacy issued money and document inputs stay unchanged", money(legacyAfter.data?.line_sell_adjustment_ex_gst) === 250 && legacyAfter.data?.pricing_mode === "simple" && (legacyPartsAfter.data ?? []).length === 0);

    const badCategory = await call(userA, "add_draft_variation_cost_component_v1", {
      p_variation: otherProject.variationId, p_revision: otherProject.revisionId, p_item_id: otherItem.itemId,
      p_component: { category: "ai", description: "Not a category", quantity: 1, unit: "item", unitCost: 1, sortOrder: 4 },
    });
    const negative = await call(userA, "add_draft_variation_cost_component_v1", {
      p_variation: otherProject.variationId, p_revision: otherProject.revisionId, p_item_id: otherItem.itemId,
      p_component: { category: "labour", description: "Negative", quantity: 1, unit: "hours", unitCost: -5, sortOrder: 4 },
    });
    check("invalid category and negative component cost are rejected", badCategory.ok !== true && negative.ok !== true);
  } finally {
    await cleanup();
  }
}

hostedProof()
  .catch((error) => {
    failed += 1;
    console.error("FAIL  hosted proof crashed", error instanceof Error ? error.message : error);
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });
