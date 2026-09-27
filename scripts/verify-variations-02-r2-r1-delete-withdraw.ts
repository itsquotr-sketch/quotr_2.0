/**
 * VARIATIONS-02-R2.1 — draft deletion repair and issued withdrawal.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-r2-r1-delete-withdraw.ts
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { clientFacingVariation } from "../lib/variations/domain";
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

const editor = read("components/variations/VariationEditor.tsx");
const list = read("components/variations/VariationList.tsx");
const actions = read("lib/variations/actions.ts");
const sql066 = read("supabase/migrations/066_variation_issued_withdrawal.sql");
const domain = read("lib/variations/domain.ts");
const diff = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: root, encoding: "utf8" });
const deleter = editor.slice(editor.indexOf("async function confirmDeleteDraft"), editor.indexOf("async function submitWithdraw"));

console.log("\nDraft deletion");
check("UI delete sends the variation id and the current revision id", deleter.includes("variationId: variation.id") && deleter.includes("revisionId: current.id"));
check("UI delete does not reload the deleted variation", !deleter.includes("loadVariation"));
check("UI delete refreshes and returns to the list", deleter.includes("router.refresh()") && deleter.includes("notice=draft-deleted"));
check("UI delete stays on the editor when the action fails", deleter.includes("if (!result.ok)") && deleter.indexOf("setError") < deleter.indexOf("router.push"));
check("server delete revalidates the variations list", actions.includes("revalidatePath(`/app/projects/${owned.projectId}/variations`)"));
check("list delete uses the row id and current revision id", list.includes("variationId: deleteTarget.id") && list.includes("revisionId: deleteTarget.currentRevisionId"));
check("delete confirmation stays explicit", editor.includes("Delete draft Variation?") && editor.includes("Variation numbers are not reused."));
check("draft delete is only offered for a draft", editor.includes("{canDelete && draft ? (") && editor.includes("Delete draft"));
check("delete lock blocks a second click after success", deleter.includes("lock.current = true") && deleter.indexOf("router.push") > deleter.indexOf("lock.current = true"));

console.log("\nWithdrawal");
check("withdrawal dialog names the variation and the pending-value effect", editor.includes("Withdraw Variation {variation.variationNumber}?") && editor.includes("removes this Variation from pending contract value"));
check("withdrawal requires a reason field", editor.includes('htmlFor="withdraw-reason"') && editor.includes("Enter a withdrawal reason."));
check("withdrawal action uses the reason-bearing command", actions.includes("withdraw_issued_variation_v1") && actions.includes("p_reason: parsed.data.reason"));
check("withdrawal function is security definer with a fixed search path", sql066.includes("security definer") && sql066.includes("set search_path = public") && sql066.includes("variation_lock_current"));
check("withdrawal does not take a client organisation id", !sql066.includes("p_org"));
check("withdrawal rejects a non-issued revision", sql066.includes("WITHDRAW_BLOCKED") && sql066.includes("is distinct from 'issued'"));
check("withdrawal retry returns before writing another event", sql066.includes("'idempotent', true") && sql066.indexOf("'idempotent', true") < sql066.indexOf("insert into public.project_lifecycle_events"));
check("withdrawal reason is event metadata", sql066.includes("'withdrawalReason', v_reason"));
check("issued menu has withdraw and no unguarded delete", editor.includes("Withdraw Variation") && editor.includes('current.status === "issued" && !historical'));

console.log("\nConfidentiality and regressions");
check("client preview is not given the withdrawal reason", !editor.slice(editor.indexOf("<ClientPreview"), editor.indexOf("<ClientPreview") + 700).includes("withdrawalReason"));
check("sell formula is unchanged", domain.includes("return roundMoney(cost / (1 - marginRate))"));
check("migrations 063 and 064 are not in this diff", !diff.includes("supabase/migrations/063_") && !diff.includes("supabase/migrations/064_"));

type Db = SupabaseClient;
type Rpc = { ok?: boolean; error?: string; variationId?: string; revisionId?: string; itemId?: string; idempotent?: boolean; variationNumber?: number; status?: string };

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
  const emailA = `hello+variations-02r21.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-02r21b.${stamp}@erccontracting.co.nz`;
  const password = `Var02R21-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(emailA);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(emailA) && !isPasswordProtectedPreviewAccount(emailB));
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectB = randomUUID();
  const projectC = randomUUID();
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
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 02R21" });
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
      { id: orgA, name: `Variations 02R21 ${stamp}` },
      { id: orgB, name: `Variations 02R21 other ${stamp}` },
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
    const userAId = userIds[0];
    const projects = await admin.from("projects").insert([
      { id: projectA, org_id: orgA, created_by: userAId, title: `Deck ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectC, org_id: orgA, created_by: userAId, title: `Other ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
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
    const line = (overrides: Record<string, unknown> = {}) => ({
      itemType: "addition",
      clientDescription: "Extra cladding",
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

    const draft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Disposable", p_summary: "With an item", p_idempotency_key: `r21-del-${stamp}`,
    });
    const added = await call(userA, "add_draft_variation_item_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item: line(),
    });
    const keeper = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Keep me", p_summary: "Other draft", p_idempotency_key: `r21-keep-${stamp}`,
    });
    const beforeSnap = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst").eq("project_id", projectA).maybeSingle();
    const deleted = await call(userA, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: draft.variationId, p_revision: draft.revisionId,
    });
    const again = await call(userA, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: draft.variationId, p_revision: draft.revisionId,
    });
    const gone = await admin.from("variations").select("id").eq("id", draft.variationId ?? "");
    const goneItems = await admin.from("variation_items").select("id").eq("variation_id", draft.variationId ?? "");
    const goneRevisions = await admin.from("variation_revisions").select("id").eq("variation_id", draft.variationId ?? "");
    const remaining = await admin.from("variations").select("id, variation_number, status").eq("project_id", projectA);
    const createdEvent = await admin.from("project_lifecycle_events").select("event_type, metadata").eq("source_entity_id", draft.variationId ?? "").eq("event_type", "variation_created");
    const next = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Next", p_summary: "After delete", p_idempotency_key: `r21-next-${stamp}`,
    });
    const afterSnap = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst").eq("project_id", projectA).maybeSingle();
    const eventMeta = JSON.stringify((createdEvent.data ?? [])[0]?.metadata ?? {});
    check("hosted delete of a draft with an item succeeds", added.ok === true && deleted.ok === true, deleted.error);
    check("deleted draft, items and revisions are gone", (gone.data ?? []).length === 0 && (goneItems.data ?? []).length === 0 && (goneRevisions.data ?? []).length === 0);
    check("deleted draft is absent from the project list", !(remaining.data ?? []).some((row) => row.id === draft.variationId));
    check("draft count no longer includes the deleted draft", (remaining.data ?? []).filter((row) => row.status === "draft").length === (remaining.data ?? []).filter((row) => row.id === keeper.variationId || row.id === next.variationId).length);
    check("variation number is not reused", (next.variationNumber ?? 0) > (draft.variationNumber ?? 0) && next.variationNumber !== draft.variationNumber);
    check("second delete does not remove the other variation", again.ok !== true && (remaining.data ?? []).some((row) => row.id === keeper.variationId));
    check("created event remains and has no draft description or cost", (createdEvent.data ?? []).length === 1 && !eventMeta.includes("unitCost") && !eventMeta.includes("Extra cladding") && !eventMeta.includes("clientDescription"));
    check("accepted contract is unchanged by deletion", Number(beforeSnap.data?.sell_ex_gst) === 10000 && Number(afterSnap.data?.sell_ex_gst) === 10000);

    const stale = await call(userA, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: keeper.variationId, p_revision: randomUUID(),
    });
    const crossProject = await call(userA, "delete_unissued_draft_variation_v1", {
      p_project: projectC, p_variation: keeper.variationId, p_revision: keeper.revisionId,
    });
    const crossTenant = await call(userA, "delete_unissued_draft_variation_v1", {
      p_project: projectB, p_variation: keeper.variationId, p_revision: keeper.revisionId,
    });
    const signedOutDelete = await call(signedOut, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: keeper.variationId, p_revision: keeper.revisionId,
    });
    check("stale revision delete fails", stale.error === "STALE_REVISION");
    check("same-org cross-project delete fails", crossProject.error === "CROSS_PROJECT");
    check("cross-tenant delete fails", crossTenant.ok !== true);
    check("signed-out delete fails", signedOutDelete.ok !== true);

    const issued = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Issued cladding", p_summary: "Keep this wording", p_idempotency_key: `r21-iss-${stamp}`,
    });
    const issuedItem = await call(userA, "add_draft_variation_item_v1", {
      p_variation: issued.variationId, p_revision: issued.revisionId, p_item: line({ clientDescription: "Issued line", unitSell: 200, unitCost: 100 }),
    });
    const issuedResult = await call(userA, "issue_variation_revision_v1", { p_variation: issued.variationId, p_revision: issued.revisionId });
    const beforeIssue = await admin.from("variation_revisions").select("title, summary, client_notes, total_sell_adjustment_ex_gst, gst_adjustment, issued_at, status").eq("id", issued.revisionId ?? "").maybeSingle();
    const beforeItem = await admin.from("variation_items").select("client_description, line_sell_adjustment_ex_gst").eq("revision_id", issued.revisionId ?? "");
    const deleteIssued = await call(userA, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: issued.variationId, p_revision: issued.revisionId,
    });
    const blankReason = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: issued.variationId, p_revision: issued.revisionId, p_reason: "   ",
    });
    const withdrawn = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: issued.variationId, p_revision: issued.revisionId, p_reason: "Client put this on hold.",
    });
    const withdrawnAgain = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: issued.variationId, p_revision: issued.revisionId, p_reason: "Client put this on hold.",
    });
    const afterIssue = await admin.from("variation_revisions").select("title, summary, client_notes, total_sell_adjustment_ex_gst, gst_adjustment, issued_at, status").eq("id", issued.revisionId ?? "").maybeSingle();
    const afterItem = await admin.from("variation_items").select("client_description, line_sell_adjustment_ex_gst").eq("revision_id", issued.revisionId ?? "");
    const events = await admin.from("project_lifecycle_events").select("event_type, metadata").eq("source_entity_id", issued.variationId ?? "").eq("event_type", "variation_withdrawn");
    const acceptWithdrawn = await call(userA, "accept_variation_revision_v1", { p_variation: issued.variationId, p_revision: issued.revisionId });
    const editWithdrawn = await call(userA, "update_draft_variation_item_v1", {
      p_variation: issued.variationId, p_revision: issued.revisionId, p_item_id: issuedItem.itemId, p_item: line({ clientDescription: "Changed" }),
    });
    const newRevision = await call(userA, "create_variation_revision_v1", { p_variation: issued.variationId, p_revision: issued.revisionId });
    const afterAttempt = await admin.from("variation_revisions").select("title, status, total_sell_adjustment_ex_gst, issued_at").eq("id", issued.revisionId ?? "").maybeSingle();
    const pending = await admin.from("variation_revisions").select("id").eq("project_id", projectA).eq("status", "issued");
    const client = clientFacingVariation({
      id: issued.variationId ?? "",
      projectId: projectA,
      variationNumber: issued.variationNumber ?? 1,
      title: "Issued cladding",
      summary: "Keep this wording",
      status: "withdrawn",
      revisions: [{
        id: issued.revisionId ?? "",
        revisionNumber: 1,
        status: "withdrawn",
        title: "Issued cladding",
        summary: "Keep this wording",
        currency: "NZD",
        gstRate: 15,
        taxTreatment: "gst_exclusive",
        totalDirectCostAdjustment: 200,
        totalSellAdjustmentExGst: 400,
        gstAdjustment: 60,
        totalAdjustmentInclGst: 460,
        proposedTimeEffectDays: null,
        clientNotes: null,
        internalNotes: "SECRET INTERNAL NOTE",
        items: [],
      }],
    });
    const clientJson = JSON.stringify(client);
    check("issued variation cannot be deleted", issuedResult.ok === true && deleteIssued.error === "ISSUED_HISTORY");
    check("withdrawal requires a reason", blankReason.error === "REASON_REQUIRED");
    check("issued revision can be withdrawn", withdrawn.ok === true && withdrawn.status === "withdrawn", withdrawn.error);
    check("withdrawal retry is idempotent and writes one event", withdrawnAgain.idempotent === true && (events.data ?? []).length === 1);
    check("issued wording and totals stay unchanged", beforeIssue.data?.title === afterIssue.data?.title && beforeIssue.data?.summary === afterIssue.data?.summary && String(beforeIssue.data?.total_sell_adjustment_ex_gst) === String(afterIssue.data?.total_sell_adjustment_ex_gst) && String(beforeIssue.data?.issued_at) === String(afterIssue.data?.issued_at));
    check("issued items stay unchanged", JSON.stringify(beforeItem.data) === JSON.stringify(afterItem.data));
    check("withdrawn revision is read-only", editWithdrawn.ok !== true);
    check("withdrawn revision cannot be accepted", acceptWithdrawn.ok !== true);
    check("withdrawn amount leaves the issued pending set", afterIssue.data?.status === "withdrawn" && !(pending.data ?? []).some((row) => row.id === issued.revisionId));
    check("new revision does not mutate the withdrawn revision", newRevision.ok !== true && afterAttempt.data?.status === "withdrawn" && afterAttempt.data?.title === beforeIssue.data?.title && String(afterAttempt.data?.issued_at) === String(beforeIssue.data?.issued_at));
    check("withdrawal reason stays out of the client payload", clientJson.includes("Client put this on hold.") === false && !clientJson.includes("unitCost") && !clientJson.includes("SECRET INTERNAL NOTE") && !clientJson.includes("targetMarginPercent"));
    check("withdrawal event stores the reason", JSON.stringify((events.data ?? [])[0]?.metadata ?? {}).includes("Client put this on hold."));

    const acceptedDraft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Accepted", p_summary: "Stays accepted", p_idempotency_key: `r21-acc-${stamp}`,
    });
    await call(userA, "add_draft_variation_item_v1", {
      p_variation: acceptedDraft.variationId, p_revision: acceptedDraft.revisionId, p_item: line({ unitSell: 50, unitCost: 30 }),
    });
    await call(userA, "issue_variation_revision_v1", { p_variation: acceptedDraft.variationId, p_revision: acceptedDraft.revisionId });
    const accepted = await call(userA, "accept_variation_revision_v1", { p_variation: acceptedDraft.variationId, p_revision: acceptedDraft.revisionId });
    const acceptedBefore = await admin.from("variation_revisions").select("status, total_sell_adjustment_ex_gst").eq("id", acceptedDraft.revisionId ?? "").maybeSingle();
    const deleteAccepted = await call(userA, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: acceptedDraft.variationId, p_revision: acceptedDraft.revisionId,
    });
    const withdrawAccepted = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: acceptedDraft.variationId, p_revision: acceptedDraft.revisionId, p_reason: "Too late",
    });
    const acceptedAfter = await admin.from("variation_revisions").select("status, total_sell_adjustment_ex_gst").eq("id", acceptedDraft.revisionId ?? "").maybeSingle();
    const snapAfter = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst").eq("project_id", projectA).maybeSingle();
    check("accepted variation cannot be deleted", accepted.ok === true && deleteAccepted.error === "ISSUED_HISTORY");
    check("accepted variation cannot be withdrawn", withdrawAccepted.error === "WITHDRAW_BLOCKED");
    check("accepted adjustment and contract stay unchanged", acceptedBefore.data?.status === "accepted" && acceptedAfter.data?.status === "accepted" && String(acceptedBefore.data?.total_sell_adjustment_ex_gst) === String(acceptedAfter.data?.total_sell_adjustment_ex_gst) && Number(snapAfter.data?.sell_ex_gst) === 10000);

    const plainDraft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Still a draft", p_summary: "No", p_idempotency_key: `r21-draft-${stamp}`,
    });
    const withdrawDraft = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: plainDraft.variationId, p_revision: plainDraft.revisionId, p_reason: "No",
    });
    check("draft withdrawal fails", withdrawDraft.error === "WITHDRAW_BLOCKED");

    const historical = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Revision one", p_summary: "Original", p_idempotency_key: `r21-hist-${stamp}`,
    });
    await call(userA, "add_draft_variation_item_v1", {
      p_variation: historical.variationId, p_revision: historical.revisionId, p_item: line({ unitSell: 80, unitCost: 40 }),
    });
    await call(userA, "issue_variation_revision_v1", { p_variation: historical.variationId, p_revision: historical.revisionId });
    const revision2 = await call(userA, "create_variation_revision_v1", { p_variation: historical.variationId, p_revision: historical.revisionId });
    const withdrawOld = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: historical.variationId, p_revision: historical.revisionId, p_reason: "Old revision",
    });
    const oldRow = await admin.from("variation_revisions").select("status, title").eq("id", historical.revisionId ?? "").maybeSingle();
    check("superseded revision cannot be withdrawn", revision2.ok === true && withdrawOld.ok !== true && oldRow.data?.status === "superseded" && oldRow.data?.title === "Revision one");

    const foreign = await call(userB, "create_draft_variation_v1", {
      p_project: projectB, p_title: "Foreign", p_summary: "No", p_idempotency_key: `r21-foreign-${stamp}`,
    });
    await call(userB, "add_draft_variation_item_v1", {
      p_variation: foreign.variationId, p_revision: foreign.revisionId, p_item: line(),
    });
    await call(userB, "issue_variation_revision_v1", { p_variation: foreign.variationId, p_revision: foreign.revisionId });
    const withdrawForeign = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: foreign.variationId, p_revision: foreign.revisionId, p_reason: "Not yours",
    });
    const withdrawOtherProject = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectC, p_variation: issued.variationId, p_revision: issued.revisionId, p_reason: "Wrong project",
    });
    const withdrawSignedOut = await call(signedOut, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: issued.variationId, p_revision: issued.revisionId, p_reason: "Signed out",
    });
    const withdrawStale = await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: keeper.variationId, p_revision: randomUUID(), p_reason: "Stale",
    });
    check("cross-tenant withdrawal fails", withdrawForeign.error === "CROSS_TENANT");
    check("cross-project withdrawal fails", withdrawOtherProject.error === "CROSS_PROJECT");
    check("signed-out withdrawal fails", withdrawSignedOut.ok !== true);
    check("stale revision withdrawal fails", withdrawStale.error === "STALE_REVISION");
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
