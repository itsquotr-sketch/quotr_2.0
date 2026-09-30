/**
 * VARIATIONS-02 — commercial editor and client document.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-commercial-documents.ts
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { roundMoney } from "../lib/commercial-engine/core/money";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  clientFacingVariation,
  internalSellFromKnownCost,
  prepareVariationItem,
  variationRevisionTotals,
  type InternalVariation,
} from "../lib/variations/domain";
import {
  buildVariationDocument,
  formatSignedAdjustment,
  issueConfirmationCopy,
  proposedRevisedContract,
  sellFromKnownCost,
  signedUnitFromMagnitude,
  variationEligibility,
  variationIssueReadiness,
  VARIATION_DOCUMENT_PROPOSED_STATUS,
  VARIATION_EMPTY_LIST,
  VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE,
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
const BASELINE = "f66d06048e3f5130db73819fa754785ee5a19a3d";
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

function money(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
}

const tabs = read("components/projects/ProjectWorkspaceTabs.tsx").replace(/\r/g, "");
const editor = read("components/variations/VariationEditor.tsx");
const documentView = read("components/variations/VariationDocument.tsx");
const list = read("components/variations/VariationList.tsx");
const actions = read("lib/variations/actions.ts");
const workspace = read("lib/variations/workspace-actions.ts");
const presentation = read("lib/variations/presentation.ts");
const printPage = read("app/(protected)/app/projects/[projectId]/variations/[variationId]/print/page.tsx");

console.log("\nA. Project eligibility");
check(
  "A ineligible project explains acceptance in human language",
  variationEligibility({ hasAcceptedSnapshot: false, archived: false, deleted: false, stage: null }).reason ===
    VARIATION_UNAVAILABLE_BEFORE_ACCEPTANCE
);
check(
  "A closed project does not offer an active variation",
  variationEligibility({ hasAcceptedSnapshot: true, archived: false, deleted: false, stage: "completed" }).eligible === false &&
    variationEligibility({ hasAcceptedSnapshot: true, archived: true, deleted: false, stage: null }).eligible === false
);
check(
  "A accepted open project is eligible",
  variationEligibility({ hasAcceptedSnapshot: true, archived: false, deleted: false, stage: "accepted" }).eligible === true
);
check("A list hides create when the project is ineligible", list.includes("props.eligible") && list.includes("data-variation-create"));

console.log("\nB. Variation navigation");
check(
  "B Estimate Pricing Quote remain",
  tabs.includes("\n            Estimate\n") && tabs.includes("Pricing") && tabs.includes("Quote")
);
check("B Variations is an added destination", tabs.includes("Variations") && tabs.includes('data-variations-nav="true"') && tabs.includes("/variations"));
check("B navigation still scrolls on small screens", tabs.includes("overflow-x-auto"));

console.log("\nC. List summaries");
check("C empty state uses the product sentence", list.includes("VARIATION_EMPTY_LIST") && presentation.includes(VARIATION_EMPTY_LIST));
check(
  "C accepted, pending and drafts are separate",
  list.includes("Revised accepted contract") && list.includes("Issued or pending") && list.includes("Draft Variations")
);
check("C list summary does not render internal COST", !list.includes("unitCost") && !list.includes("margin"));

console.log("\nD. Draft header");
check("D title and client summary are labelled", editor.includes('htmlFor="variation-title"') && editor.includes("Summary of change"));
check("D internal notes are marked as internal", editor.includes("data-variation-internal-notes") && editor.includes("Internal notes are never shown to the client."));
check("D variation number is displayed, not chosen by the form", editor.includes("Variation {props.variation.variationNumber}") && !editor.includes('htmlFor="variation-number"'));

console.log("\nE–H. Item type mapping");
check("E addition magnitude stays positive", signedUnitFromMagnitude("addition", 2000) === 2000);
check("E addition label is shown", editor.includes(">Addition<"));
check("F omission form magnitude becomes a negative adjustment", signedUnitFromMagnitude("omission", 500) === -500);
check("F omission display uses a minus sign", formatSignedAdjustment(-500, "NZD") === "−$500.00");
check("F omission explains the contract reduction", editor.includes("VARIATION_OMISSION_HELP") && presentation.includes("This amount will reduce the contract value."));
check("G substitution is saved as a linked pair", editor.includes("substitutionGroupId: groupId") && editor.includes("deleteDraftVariationItem"));
check("H no-cost requires an explicit documented item", prepareVariationItem({
  itemType: "no_cost_scope_change",
  clientDescription: "Move the meter box",
  quantity: 1,
  unit: "item",
  unitSell: 0,
  unitCost: null,
  substitutionGroupId: null,
}).ok === true);
check("H a blank zero addition is rejected", prepareVariationItem({
  itemType: "addition",
  clientDescription: "Blank",
  quantity: 1,
  unit: "item",
  unitSell: 0,
  unitCost: null,
  substitutionGroupId: null,
}).ok === false);

console.log("\nI–J. Scope references");
check("I scope options use accepted snapshot lines", workspace.includes("accepted_commercial_snapshot_lines") && !workspace.includes("pricing_items"));
check("I new scope is available", editor.includes("New scope"));
check("J work areas use names", editor.includes("area.name") && workspace.includes('.select("id, name")'));

console.log("\nK–N. COST, sell, margin, pricing required");
const calculated = sellFromKnownCost(80, 20);
check("K sell uses the shared margin formula", calculated === 100 && internalSellFromKnownCost(80, 0.2) === 100);
check("K unknown COST does not invent a sell", sellFromKnownCost(Number.NaN, 20) == null && internalSellFromKnownCost(null, 0.2) == null);
check("L manual sell is user-owned until reset", editor.includes(': "manual"') && editor.includes("Reset to calculated sell"));
check("M margin changes stay on the calculated path", editor.includes('setProvenance("calculated")') && editor.includes("Target margin"));
const unresolved = variationIssueReadiness({
  title: "Stairs",
  summary: "Extra stairs",
  items: [{
    itemType: "addition",
    clientDescription: "Additional deck stairs",
    quantity: 1,
    unit: "item",
    unitSell: null,
    unitCost: null,
    substitutionGroupId: null,
  }],
});
check("N unresolved pricing blocks issue", unresolved.ready === false && unresolved.blockers.some((line) => line.includes("Additional deck stairs")));
check("N pricing required is named for the user", editor.includes("VARIATION_PRICING_REQUIRED_LABEL") && presentation.includes("Pricing required") && presentation.includes("Add a price before issuing this Variation."));

console.log("\nO–Q. GST and mixed totals");
const mixed = [
  prepareVariationItem({
    itemType: "addition",
    clientDescription: "Additional deck stairs",
    quantity: 1,
    unit: "item",
    unitSell: 2000,
    unitCost: 1200,
    substitutionGroupId: null,
  }),
  prepareVariationItem({
    itemType: "omission",
    clientDescription: "Omit original handrail allowance",
    quantity: 1,
    unit: "item",
    unitSell: -500,
    unitCost: -200,
    substitutionGroupId: null,
  }),
];
const mixedItems = mixed.flatMap((row) => (row.ok ? [row.item] : []));
const mixedTotals = variationRevisionTotals(mixedItems, 15);
const proposed = proposedRevisedContract({
  baseline: {
    currency: "NZD",
    gstRate: 15,
    taxTreatment: "gst_exclusive",
    sellExGst: 10000,
    gstAmount: 1500,
    sellInclGst: 11500,
  },
  accepted: [],
  candidate: {
    id: "00000000-0000-4000-8000-000000000001",
    status: "draft",
    isCurrent: true,
    totalSellAdjustmentExGst: mixedTotals && "totalSellAdjustmentExGst" in mixedTotals ? mixedTotals.totalSellAdjustmentExGst : null,
    gstAdjustment: mixedTotals && "gstAdjustment" in mixedTotals ? mixedTotals.gstAdjustment : null,
    totalAdjustmentInclGst: mixedTotals && "totalAdjustmentInclGst" in mixedTotals ? mixedTotals.totalAdjustmentInclGst : null,
    items: mixedItems.map((item) => ({ itemType: item.itemType, lineSellAdjustmentExGst: item.lineSellAdjustmentExGst })),
  },
});
check(
  "O GST follows the variation domain",
  mixedTotals != null && "totalSellAdjustmentExGst" in mixedTotals &&
    mixedTotals.totalSellAdjustmentExGst === 1500 &&
    mixedTotals.gstAdjustment === 225 &&
    mixedTotals.totalAdjustmentInclGst === 1725
);
check(
  "P negative omission reduces the proposed contract",
  proposed != null && proposed.revisedContractValueExGst === 11500 && proposed.gst === 1725 && proposed.revisedContractValueInclGst === 13225
);
const negative = variationRevisionTotals([
  prepareVariationItem({
    itemType: "omission",
    clientDescription: "Omit decking",
    quantity: 1,
    unit: "item",
    unitSell: -2000,
    unitCost: -1000,
    substitutionGroupId: null,
  }).ok ? prepareVariationItem({
    itemType: "omission",
    clientDescription: "Omit decking",
    quantity: 1,
    unit: "item",
    unitSell: -2000,
    unitCost: -1000,
    substitutionGroupId: null,
  }).item! : { itemType: "omission", quantity: 1, unit: "item", unitSell: -2000, unitCost: -1000, lineSellAdjustmentExGst: -2000, lineCostAdjustment: -1000, substitutionGroupId: null },
], 15);
check(
  "P a negative variation keeps GST negative",
  negative != null && "gstAdjustment" in negative && negative.gstAdjustment === -300 && negative.totalAdjustmentInclGst === -2300
);
check("Q mixed variation keeps both signs", mixedItems.some((item) => (item.lineSellAdjustmentExGst ?? 0) > 0) && mixedItems.some((item) => (item.lineSellAdjustmentExGst ?? 0) < 0));

console.log("\nR–V. Issue, immutability, history");
check("R missing title is a human blocker", variationIssueReadiness({ title: " ", summary: "Because the scope changed", items: mixedItems.map((item) => ({
  itemType: item.itemType,
  clientDescription: item.itemType === "addition" ? "Additional deck stairs" : "Omit original handrail allowance",
  quantity: 1,
  unit: "item",
  unitSell: item.unitSell,
  unitCost: item.unitCost,
  substitutionGroupId: null,
})) }).blockers.includes("Add a title before issuing."));
check("R an empty variation asks for an item", variationIssueReadiness({ title: "Variation", summary: "Scope change", items: [] }).blockers.includes("Add at least one Variation item."));
check(
  "S issue confirmation names the revision and says it cannot be edited",
  issueConfirmationCopy(2, 1).includes("Variation 2, revision 1") && issueConfirmationCopy(2, 1).includes("can’t be edited") && editor.includes("data-issue-confirm")
);
check("T issued revisions use the domain issue command", editor.includes("issueVariationRevision") && actions.includes("IMMUTABLE"));
check("U a new revision uses the domain command", editor.includes("createVariationRevision") && editor.includes("Create new revision"));
check("V history distinguishes current and historical", editor.includes("Historical") && editor.includes("not the current proposal"));

console.log("\nW–Y. Client document");
const goldenDocument = buildVariationDocument({
  companyName: "ERC",
  clientName: "Client",
  projectTitle: "Deck",
  siteAddress: null,
  variationNumber: 1,
  revisionNumber: 1,
  issuedAt: "27 Sept 2026",
  status: "issued",
  title: "Deck stairs",
  summary: "The stair and handrail scope changed.",
  clientNotes: "Please review.",
  currency: "NZD",
  items: [
    { itemType: "addition", clientDescription: "Additional deck stairs", lineSellAdjustmentExGst: 2000, substitutionGroupId: null, sortOrder: 1 },
    { itemType: "omission", clientDescription: "Omit original handrail allowance", lineSellAdjustmentExGst: -500, substitutionGroupId: null, sortOrder: 2 },
  ],
  totals: { totalSellAdjustmentExGst: 1500, gstAdjustment: 225, totalAdjustmentInclGst: 1725 },
  baseline: { sellExGst: 10000, sellInclGst: 11500 },
  proposed,
});
const goldenJson = JSON.stringify(goldenDocument);
check("W document shows the golden adjustment", goldenDocument.netExLabel.includes("1,500.00") && goldenDocument.gstLabel.includes("225.00") && goldenDocument.inclLabel.includes("1,725.00"));
check("W document shows the proposed revised contract", goldenDocument.proposedExLabel.includes("11,500.00") && goldenDocument.proposedInclLabel.includes("13,225.00"));
check("W unaccepted wording is proposed, not approved", goldenDocument.statusWording === VARIATION_DOCUMENT_PROPOSED_STATUS && !goldenJson.toLowerCase().includes("approved"));
check("X document model omits COST and internal notes", !goldenJson.includes("unitCost") && !goldenJson.includes("SECRET") && !documentView.includes("unitCost") && !documentView.includes("internalNotes"));
check("X print payload maps client fields only", printPage.includes("clientDescription") && !printPage.includes("unitCost") && !printPage.includes("internalNotes"));
check("Y document totals are passed in, not recalculated from rates", !documentView.includes("deriveSellFromCost") && !documentView.includes("defaultGstRate"));

console.log("\nZ–AC. Security source contract");
check("Z workspace loaders require an authenticated organisation", workspace.includes("getAuthOrgContext") && workspace.includes("assertOrgOwnsActiveProject"));
check("AA detail rejects a variation from another project", workspace.includes("loaded.variation.projectId !== projectId"));
check("AB unauthenticated copy is explicit", actions.includes("NOT_AUTHENTICATED") && actions.includes("You need to sign in."));
check("AC stale and immutable writes are rejected by the domain actions", actions.includes("STALE_REVISION") && actions.includes("IMMUTABLE"));

console.log("\nAD–AF. Existing work and accessibility");
const diff = execFileSync("git", ["diff", "--name-only", BASELINE], { cwd: root, encoding: "utf8" });
const protectedPaths = ["lib/estimate/", "lib/assistant/", "components/assistant/", "lib/pricing/calculations.ts", "lib/quotes/build-from-pricing.ts", "supabase/migrations/063_"];
check("AD existing estimate pricing and quote files are untouched", protectedPaths.every((path) => !diff.includes(path)));
check("AE deck and recovery files are untouched", !diff.includes("lib/estimate/deck") && !diff.includes("scripts/verify-recovery") && !diff.includes("scripts/verify-deck"));
check(
  "AF controls are labelled and the issue dialog is named",
  editor.includes("<Label") && editor.includes('role="alert"') && editor.includes("DialogTitle") && list.includes("<Label") && tabs.includes('role="tablist"')
);
check("AF mobile items are stacked cards", !editor.includes("<table") && editor.includes("rounded-2xl"));

type Db = SupabaseClient;
type RpcBody = { ok?: boolean; error?: string; variationId?: string; revisionId?: string; itemId?: string };

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
  const email = `hello+variations-02.${stamp}@erccontracting.co.nz`;
  const password = `Var02-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(email);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(email));
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectB = randomUUID();
  const plain = randomUUID();
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
      { id: orgA, name: `Variations 02 ${stamp}` },
      { id: orgB, name: `Variations 02 other ${stamp}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    const profile = await admin.from("profiles").insert({ id: userId, org_id: orgA, role: "owner", full_name: "Variations 02" });
    if (profile.error) throw new Error(profile.error.message);
    const membership = await admin.from("organisation_memberships").insert({
      org_id: orgA,
      user_id: userId,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });
    if (membership.error) throw new Error(membership.error.message);
    const settings = await admin.from("organisation_settings").insert({
      org_id: orgA,
      default_margin_percent: 20,
      default_gst_rate: 15,
      currency: "NZD",
    });
    if (settings.error) throw new Error(settings.error.message);
    const projects = await admin.from("projects").insert([
      { id: projectA, org_id: orgA, created_by: userId, title: `Accepted ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: plain, org_id: orgA, created_by: userId, title: `Plain ${stamp}`, stage: "brief", business_status: "estimating" },
      { id: projectB, org_id: orgB, created_by: userId, title: `Foreign ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
    ]);
    if (projects.error) throw new Error(projects.error.message);
    const user = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await user.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(signedIn.error.message);
    const anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

    async function baseline(projectId: string, orgId: string): Promise<string> {
      const quoteId = randomUUID();
      const quote = await admin.from("quotes").insert({
        id: quoteId,
        org_id: orgId,
        project_id: projectId,
        created_by: userId,
        title: "Accepted baseline",
        status: "draft",
        revision_number: 1,
        subtotal: 10000,
        gst_rate: 15,
        gst_amount: 1500,
        total_incl_gst: 11500,
      });
      if (quote.error) throw new Error(quote.error.message);
      const item = await admin.from("quote_items").insert({
        org_id: orgId,
        quote_id: quoteId,
        project_id: projectId,
        label: "Accepted work",
        description: "Accepted work",
        quantity: 1,
        unit: "ls",
        unit_price: 10000,
        total: 10000,
        sort_order: 1,
      });
      if (item.error) throw new Error(item.error.message);
      const accepted = await admin.from("quotes").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", quoteId);
      if (accepted.error) throw new Error(accepted.error.message);
      const snap = await admin.from("accepted_commercial_snapshots").select("id, sell_ex_gst").eq("project_id", projectId).single();
      if (snap.error || !snap.data) throw new Error(snap.error?.message ?? "snapshot missing");
      return snap.data.id as string;
    }

    const snapshotId = await baseline(projectA, orgA);
    await baseline(projectB, orgB);
    async function call(client: Db, fn: string, args: Record<string, unknown>): Promise<RpcBody> {
      const { data, error } = await client.rpc(fn, args);
      if (error) return { ok: false, error: error.message };
      return (data ?? { ok: false }) as RpcBody;
    }
    const line = (overrides: Record<string, unknown>) => ({
      itemType: "addition",
      clientDescription: "Extra",
      workAreaId: null,
      snapshotLineId: null,
      stableComponentKey: null,
      quantity: 1,
      unit: "item",
      unitCost: 1200,
      unitSell: 2000,
      sortOrder: 1,
      clientInclusion: null,
      clientExclusion: null,
      substitutionGroupId: null,
      internalMetadata: {},
      ...overrides,
    });

    const blocked = await call(user, "create_draft_variation_v1", {
      p_project: plain,
      p_title: "Too early",
      p_summary: null,
      p_idempotency_key: `variations-02-plain-${stamp}`,
    });
    check("A hosted project without an accepted quote cannot create a variation", blocked.ok !== true);

    const foreign = await call(user, "create_draft_variation_v1", {
      p_project: projectB,
      p_title: "Foreign",
      p_summary: "No",
      p_idempotency_key: `variations-02-foreign-${stamp}`,
    });
    check("Z cross-tenant create fails", foreign.ok !== true);
    const anonCreate = await call(anonClient, "create_draft_variation_v1", {
      p_project: projectA,
      p_title: "Anon",
      p_summary: null,
      p_idempotency_key: `variations-02-anon-${stamp}`,
    });
    check("AB unauthenticated create fails", anonCreate.ok !== true);

    const draft = await call(user, "create_draft_variation_v1", {
      p_project: projectA,
      p_title: "Deck stairs",
      p_summary: "The stair and handrail scope changed.",
      p_idempotency_key: `variations-02-golden-${stamp}`,
    });
    check("hosted draft is created", draft.ok === true && Boolean(draft.variationId), draft.error);
    if (!draft.variationId || !draft.revisionId) return;
    const before = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst, gst_amount, sell_incl_gst").eq("id", snapshotId).single();
    await call(user, "add_draft_variation_item_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: line({ clientDescription: "Additional deck stairs", unitSell: 2000, unitCost: 1200, sortOrder: 1 }),
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: line({ itemType: "omission", clientDescription: "Omit original handrail allowance", unitSell: -500, unitCost: -200, sortOrder: 2 }),
    });
    const notes = await call(user, "update_draft_variation_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_title: "Deck stairs",
      p_summary: "The stair and handrail scope changed.",
      p_client_notes: "Please review.",
      p_internal_notes: "SECRET INTERNAL NOTE",
      p_time_effect_days: null,
    });
    check("D hosted header update keeps the draft", notes.ok === true, notes.error);
    const draftSnap = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst, gst_amount, sell_incl_gst").eq("id", snapshotId).single();
    check(
      "Y draft does not change the accepted contract",
      money(before.data?.sell_ex_gst) === 10000 && money(draftSnap.data?.sell_ex_gst) === 10000 && money(draftSnap.data?.sell_incl_gst) === 11500
    );
    const issued = await call(user, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    check("S hosted issue succeeds", issued.ok === true, issued.error);
    const issuedSnap = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst").eq("id", snapshotId).single();
    check("Y issue does not change the accepted contract", money(issuedSnap.data?.sell_ex_gst) === 10000);
    const stale = await call(user, "update_draft_variation_v1", {
      p_variation: draft.variationId,
      p_revision: randomUUID(),
      p_title: "Changed",
      p_summary: "Changed",
      p_client_notes: null,
      p_internal_notes: null,
      p_time_effect_days: null,
    });
    check("AC stale draft update fails", stale.ok !== true);
    const mutate = await call(user, "add_draft_variation_item_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: line({ clientDescription: "After issue", unitSell: 10 }),
    });
    check("T issued revision cannot be edited", mutate.ok !== true);

    const rows = await user.from("variation_revisions").select("id, revision_number, status, total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst, currency, gst_rate").eq("variation_id", draft.variationId);
    const revision = (rows.data ?? []).find((row) => row.revision_number === 1);
    const items = await user.from("variation_items").select("item_type, client_description, line_sell_adjustment_ex_gst, unit_cost, substitution_group_id, sort_order").eq("revision_id", draft.revisionId);
    const facing: InternalVariation = {
      id: draft.variationId,
      projectId: projectA,
      variationNumber: 1,
      title: "Deck stairs",
      summary: "The stair and handrail scope changed.",
      status: "issued",
      revisions: [{
        id: draft.revisionId,
        revisionNumber: 1,
        status: "issued",
        currency: "NZD",
        gstRate: 15,
        taxTreatment: "gst_exclusive",
        totalDirectCostAdjustment: 1000,
        totalSellAdjustmentExGst: money(revision?.total_sell_adjustment_ex_gst),
        gstAdjustment: money(revision?.gst_adjustment),
        totalAdjustmentInclGst: money(revision?.total_adjustment_incl_gst),
        proposedTimeEffectDays: null,
        clientNotes: "Please review.",
        internalNotes: "SECRET INTERNAL NOTE",
        items: (items.data ?? []).map((item, index) => ({
          id: String(index),
          itemType: item.item_type,
          clientDescription: item.client_description,
          quantity: 1,
          unit: "item",
          unitSell: money(item.line_sell_adjustment_ex_gst),
          lineSellAdjustmentExGst: money(item.line_sell_adjustment_ex_gst),
          sortOrder: item.sort_order,
          clientInclusion: null,
          clientExclusion: null,
          substitutionGroupId: item.substitution_group_id,
          workAreaId: null,
          snapshotLineId: null,
          unitCost: money(item.unit_cost),
          lineCostAdjustment: money(item.unit_cost),
          internalMetadata: {},
        })),
      }],
    };
    const client = clientFacingVariation(facing);
    const clientJson = JSON.stringify(client);
    check("X client document loader omits COST and internal notes", !clientJson.includes("unitCost") && !clientJson.includes("SECRET INTERNAL NOTE") && !("internalNotes" in client.revisions[0]));
    check(
      "O hosted golden totals",
      money(revision?.total_sell_adjustment_ex_gst) === 1500 && money(revision?.gst_adjustment) === 225 && money(revision?.total_adjustment_incl_gst) === 1725
    );
    const events = await admin.from("project_lifecycle_events").select("event_type").eq("project_id", projectA).eq("event_type", "variation_issued");
    check("S one variation_issued event exists", (events.data ?? []).length === 1);

    const revised = await call(user, "create_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    check("U hosted new revision is created", revised.ok === true && revised.revisionId !== draft.revisionId, revised.error);
    const revisionOne = await admin.from("variation_revisions").select("status, total_sell_adjustment_ex_gst").eq("id", draft.revisionId).single();
    check("Y later revision does not alter revision 1", revisionOne.data?.status === "superseded" && money(revisionOne.data?.total_sell_adjustment_ex_gst) === 1500);
    const rate = await admin.from("organisation_settings").update({
      default_margin_percent: 40,
      default_gst_rate: 20,
    }).eq("org_id", orgA);
    check("Y rate change is stored", !rate.error, rate.error?.message);
    const afterRate = await admin.from("variation_revisions").select("gst_rate, total_sell_adjustment_ex_gst, gst_adjustment").eq("id", draft.revisionId).single();
    check("Y later rate changes do not alter revision 1", money(afterRate.data?.gst_rate) === 15 && money(afterRate.data?.gst_adjustment) === 225);

    const hidden = await user.from("variations").select("id").eq("project_id", projectB);
    check("AA cross-project variation list is empty", (hidden.data ?? []).length === 0);
  } catch (error) {
    check("hosted proof", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup();
  }
}

hostedProof().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
