/**
 * VARIATIONS-02-R1 — issued revision wording stays on the revision.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-r1-document-snapshots.ts
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { clientFacingVariation, type InternalVariation } from "../lib/variations/domain";
import {
  cleanupPreviewFixtureOrgs,
  queryPreviewRows,
  registerPreviewFixtureOrg,
} from "./lib/preview-admin-cleanup";
import {
  assertSafePreviewPasswordMutation,
  isPasswordProtectedPreviewAccount,
} from "./lib/preview-auth-fixture";

const root = join(__dirname, "..");
const HEAD = "2c3cb2768351009c4f79b5a42ad5868d42b4bf60";
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
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

const sql064 = read("supabase/migrations/064_variation_revision_client_wording.sql");
const sql063 = read("supabase/migrations/063_variation_domain_foundation.sql");
const actions = read("lib/variations/actions.ts");
const domain = read("lib/variations/domain.ts");
const workspace = read("lib/variations/workspace-actions.ts");
const editor = read("components/variations/VariationEditor.tsx");
const printPage = read("app/(protected)/app/projects/[projectId]/variations/[variationId]/print/page.tsx");
const variations02 = read("scripts/verify-variations-02-commercial-documents.ts");
const diffNames = execFileSync("git", ["diff", "--name-only", HEAD], { cwd: root, encoding: "utf8" });

console.log("\nA. Schema ownership");
check("A revision owns title and summary", sql064.includes("add column if not exists title text") && sql064.includes("add column if not exists summary text") && sql064.includes("variation_revisions"));
check("A client notes stay the existing revision column", sql063.includes("client_notes text") && !sql064.includes("add column if not exists client_notes"));
check("A logical title is described as a list copy", sql064.includes("Not the authority for an issued historical document"));
check("A migration 063 was not edited", !diffNames.includes("supabase/migrations/063_variation_domain_foundation.sql"));

console.log("\nB. Migration backfill");
check(
  "B backfill copies the current logical wording once",
  sql064.includes("set") && sql064.includes("title = variation.title") && sql064.includes("revision.title is null")
);
check("B backfill does not write internal notes into client fields", !sql064.includes("internal_notes = variation"));

console.log("\nC–E. Draft wording source");
check("C draft title is written onto the revision", sql064.includes("title = v_title") && sql064.includes("update public.variation_revisions"));
check("D draft summary is written onto the revision", sql064.includes("summary = v_summary"));
check("E draft client notes stay on the revision", sql064.includes("client_notes = v_client") && sql064.includes("internal_notes = v_internal"));
check("C current title projection is limited to the current revision", sql064.includes("and current_revision_id = p_revision"));

console.log("\nF–I. Issue and immutability source");
check("F issue is not redefined and leaves the stored revision wording", !sql064.includes("function public.issue_variation_revision_v1") && sql063.includes("function public.issue_variation_revision_v1"));
check("G issued title is guarded", sql064.includes("new.title is distinct from old.title"));
check("H issued summary is guarded", sql064.includes("new.summary is distinct from old.summary"));
check("I issued client notes remain guarded", sql064.includes("new.client_notes is distinct from old.client_notes"));

console.log("\nJ–T. Copy, document and list source");
check("J new revision copies title, summary and client notes from the issued revision", sql064.includes("v_rev.title, v_rev.summary") && sql064.includes("v_rev.client_notes"));
check("T list title comes from the current revision", workspace.includes("Current revision title") && workspace.includes("current?.title"));
check("T history shows the revision title", editor.includes("{row.title}") && workspace.includes("title: revision.title"));
check("S document title comes from the revision being viewed", editor.includes("title: viewing.title") && printPage.includes("title: viewing.title"));
check("S client payload copies revision wording and drops internal notes", domain.includes("title: revision.title") && domain.includes("summary: revision.summary") && !read("components/variations/VariationDocument.tsx").includes("internalNotes"));

console.log("\nR. Estimate and Pricing isolation");
check(
  "R wording loader does not read estimate or pricing tables",
  !actions.includes("from(\"estimates\")") && !actions.includes("from(\"pricing_items\")") && !workspace.includes("pricing_items")
);

console.log("\nX–Z. Existing equality");
check("X variation domain file 063 still defines the variation tables", sql063.includes("create table if not exists public.variation_revisions"));
check("Y VARIATIONS-02 golden contract remains", variations02.includes("1,500.00") && variations02.includes("VARIATION_DOCUMENT_PROPOSED_STATUS") && variations02.includes("13,225.00"));
check(
  "Z estimate, deck and quote calculation files are untouched",
  ["lib/estimate/", "lib/assistant/", "components/assistant/", "lib/pricing/calculations.ts", "supabase/migrations/063_"].every(
    (path) => !diffNames.includes(path)
  )
);

type Db = SupabaseClient;
type RpcBody = { ok?: boolean; error?: string; variationId?: string; revisionId?: string; itemId?: string };

const ORIGINAL_TITLE = "Deck stair addition";
const ORIGINAL_SUMMARY = "Add one external stair set to the accepted deck scope.";
const ORIGINAL_NOTES = "Timber finish to match the accepted deck.";
const REVISED_TITLE = "Revised deck access";
const REVISED_SUMMARY = "Replace the proposed stair set with a wider stair arrangement.";
const REVISED_NOTES = "Final width subject to confirmed site measure.";

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

  const prior = queryPreviewRows(
    "select o.name as org_name, r.status, count(*)::int as n from public.variation_revisions r join public.organisations o on o.id = r.org_id where r.status <> 'draft' and o.name not like 'Variations %' group by o.name, r.status"
  ) as Array<{ org_name: string; status: string; n: number }>;
  check(
    "B no non-fixture issued variations exist to reconstruct",
    prior.length === 0,
    prior.map((row) => `${row.org_name} ${row.status} ${row.n}`).join("; ")
  );

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = randomUUID().slice(0, 8);
  const email = `hello+variations-02r1.${stamp}@erccontracting.co.nz`;
  const password = `Var02R1-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(email);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(email));
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectB = randomUUID();
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
      { id: orgA, name: `Variations 02R1 ${stamp}` },
      { id: orgB, name: `Variations 02R1 other ${stamp}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    const profile = await admin.from("profiles").insert({ id: userId, org_id: orgA, role: "owner", full_name: "Variations 02R1" });
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
    ]);
    if (projects.error) throw new Error(projects.error.message);

    const user = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
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

    async function call(client: Db, fn: string, args: Record<string, unknown>): Promise<RpcBody> {
      const { data, error } = await client.rpc(fn, args);
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
      unitCost: 900,
      unitSell: 1500,
      sortOrder: 1,
      clientInclusion: null,
      clientExclusion: null,
      substitutionGroupId: null,
      internalMetadata: { sellProvenance: "manual" },
      ...overrides,
    });

    const foreign = await call(user, "create_draft_variation_v1", {
      p_project: projectB, p_title: "Foreign", p_summary: "No", p_idempotency_key: `r1-foreign-${stamp}`,
    });
    check("U cross-tenant create fails", foreign.ok !== true);
    const hidden = await user.from("variations").select("id").eq("project_id", projectB);
    check("V cross-project variation list is empty", (hidden.data ?? []).length === 0);

    const draft = await call(user, "create_draft_variation_v1", {
      p_project: projectA,
      p_title: ORIGINAL_TITLE,
      p_summary: ORIGINAL_SUMMARY,
      p_idempotency_key: `r1-golden-${stamp}`,
    });
    check("hosted draft is created", draft.ok === true && Boolean(draft.revisionId), draft.error);
    if (!draft.variationId || !draft.revisionId) return;

    const header = await call(user, "update_draft_variation_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_title: ORIGINAL_TITLE,
      p_summary: ORIGINAL_SUMMARY,
      p_client_notes: ORIGINAL_NOTES,
      p_internal_notes: "SECRET INTERNAL NOTE",
      p_time_effect_days: null,
    });
    check("C–E hosted draft wording is saved", header.ok === true, header.error);
    const added = await call(user, "add_draft_variation_item_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: line({}),
    });
    check("hosted item is added", added.ok === true, added.error);
    const issued = await call(user, "issue_variation_revision_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
    });
    check("F hosted issue succeeds", issued.ok === true, issued.error);

    const issuedTitle = await call(user, "update_draft_variation_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_title: REVISED_TITLE,
      p_summary: ORIGINAL_SUMMARY,
      p_client_notes: ORIGINAL_NOTES,
      p_internal_notes: "SECRET INTERNAL NOTE",
      p_time_effect_days: null,
    });
    check("G issued title update is rejected", issuedTitle.ok !== true);
    const issuedSummary = await call(user, "update_draft_variation_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_title: ORIGINAL_TITLE,
      p_summary: REVISED_SUMMARY,
      p_client_notes: ORIGINAL_NOTES,
      p_internal_notes: null,
      p_time_effect_days: null,
    });
    check("H issued summary update is rejected", issuedSummary.ok !== true);
    const issuedNotes = await call(user, "update_draft_variation_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_title: ORIGINAL_TITLE,
      p_summary: ORIGINAL_SUMMARY,
      p_client_notes: REVISED_NOTES,
      p_internal_notes: null,
      p_time_effect_days: null,
    });
    check("I issued client-note update is rejected", issuedNotes.ok !== true);
    const issuedItem = await call(user, "add_draft_variation_item_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: line({ clientDescription: "After issue", unitSell: 10 }),
    });
    check("I issued item update is rejected", issuedItem.ok !== true);
    const directTitle = await admin.from("variation_revisions").update({ title: "Hijacked title" }).eq("id", draft.revisionId);
    const directSummary = await admin.from("variation_revisions").update({ summary: "Hijacked summary" }).eq("id", draft.revisionId);
    const directNotes = await admin.from("variation_revisions").update({ client_notes: "Hijacked notes" }).eq("id", draft.revisionId);
    const directTotal = await admin.from("variation_revisions").update({ total_sell_adjustment_ex_gst: 1 }).eq("id", draft.revisionId);
    check("G direct issued title update fails", Boolean(directTitle.error));
    check("H direct issued summary update fails", Boolean(directSummary.error));
    check("I direct issued client-note update fails", Boolean(directNotes.error));
    check("P direct issued total update fails", Boolean(directTotal.error));

    const stale = await call(user, "update_draft_variation_v1", {
      p_variation: draft.variationId,
      p_revision: randomUUID(),
      p_title: ORIGINAL_TITLE,
      p_summary: ORIGINAL_SUMMARY,
      p_client_notes: ORIGINAL_NOTES,
      p_internal_notes: null,
      p_time_effect_days: null,
    });
    check("W stale draft update fails", stale.ok !== true);

    const before = await admin.from("variation_revisions").select("title, summary, client_notes, internal_notes, total_sell_adjustment_ex_gst, gst_adjustment, gst_rate, status").eq("id", draft.revisionId).single();
    const beforeItems = await admin.from("variation_items").select("client_description, quantity, unit_sell, line_sell_adjustment_ex_gst, sort_order").eq("revision_id", draft.revisionId);
    check(
      "F issued snapshot stored the original wording",
      before.data?.title === ORIGINAL_TITLE &&
        before.data?.summary === ORIGINAL_SUMMARY &&
        before.data?.client_notes === ORIGINAL_NOTES &&
        money(before.data?.total_sell_adjustment_ex_gst) === 1500 &&
        money(before.data?.gst_adjustment) === 225
    );

    const revised = await call(user, "create_variation_revision_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
    });
    check("J hosted new revision is created", revised.ok === true && revised.revisionId !== draft.revisionId, revised.error);
    if (!revised.revisionId) return;
    const copied = await admin.from("variation_revisions").select("title, summary, client_notes, status").eq("id", revised.revisionId).single();
    check(
      "J revision 2 starts from revision 1 wording",
      copied.data?.title === ORIGINAL_TITLE && copied.data?.summary === ORIGINAL_SUMMARY && copied.data?.client_notes === ORIGINAL_NOTES && copied.data?.status === "draft"
    );
    const edited = await call(user, "update_draft_variation_v1", {
      p_variation: draft.variationId,
      p_revision: revised.revisionId,
      p_title: REVISED_TITLE,
      p_summary: REVISED_SUMMARY,
      p_client_notes: REVISED_NOTES,
      p_internal_notes: "Later internal note",
      p_time_effect_days: null,
    });
    check("K revision 2 wording can be edited", edited.ok === true, edited.error);
    const copiedItems = await user.from("variation_items").select("id").eq("revision_id", revised.revisionId);
    const copiedItemId = copiedItems.data?.[0]?.id as string | undefined;
    const editedItem = copiedItemId
      ? await call(user, "update_draft_variation_item_v1", {
          p_variation: draft.variationId,
          p_revision: revised.revisionId,
          p_item_id: copiedItemId,
          p_item: line({ clientDescription: "Wider external stair set", quantity: 2, unitSell: 1800, sortOrder: 1 }),
        })
      : { ok: false, error: "missing copied item" };
    check("K revision 2 item can be edited", editedItem.ok === true, editedItem.error);

    const after = await admin.from("variation_revisions").select("title, summary, client_notes, internal_notes, total_sell_adjustment_ex_gst, gst_adjustment, gst_rate, status").eq("id", draft.revisionId).single();
    const afterItems = await admin.from("variation_items").select("client_description, quantity, unit_sell, line_sell_adjustment_ex_gst, sort_order").eq("revision_id", draft.revisionId);
    check("L revision 1 title is unchanged", after.data?.title === ORIGINAL_TITLE && after.data?.title === before.data?.title);
    check("M revision 1 summary is unchanged", after.data?.summary === ORIGINAL_SUMMARY);
    check("N revision 1 client notes are unchanged", after.data?.client_notes === ORIGINAL_NOTES && after.data?.internal_notes === "SECRET INTERNAL NOTE");
    check(
      "O revision 1 items are unchanged",
      JSON.stringify(beforeItems.data ?? []) === JSON.stringify(afterItems.data ?? []) &&
        afterItems.data?.[0]?.client_description === "External stair set"
    );
    check(
      "P revision 1 totals are unchanged",
      money(after.data?.total_sell_adjustment_ex_gst) === 1500 && money(after.data?.gst_adjustment) === 225
    );
    const logical = await admin.from("variations").select("title, summary").eq("id", draft.variationId).single();
    check("T logical title follows the current draft only", logical.data?.title === REVISED_TITLE && after.data?.title === ORIGINAL_TITLE);

    const rate = await admin.from("organisation_settings").update({ default_margin_percent: 40, default_gst_rate: 20 }).eq("org_id", orgA);
    const projectFact = await admin.from("projects").update({ title: `Renamed ${stamp}` }).eq("id", projectA);
    check("Q rate and project updates are stored", !rate.error && !projectFact.error, rate.error?.message ?? projectFact.error?.message);
    const isolated = await admin.from("variation_revisions").select("title, summary, client_notes, gst_rate, gst_adjustment, total_sell_adjustment_ex_gst").eq("id", draft.revisionId).single();
    check(
      "Q–R revision 1 wording and tax stay isolated",
      isolated.data?.title === ORIGINAL_TITLE &&
        isolated.data?.summary === ORIGINAL_SUMMARY &&
        isolated.data?.client_notes === ORIGINAL_NOTES &&
        money(isolated.data?.gst_rate) === 15 &&
        money(isolated.data?.gst_adjustment) === 225 &&
        money(isolated.data?.total_sell_adjustment_ex_gst) === 1500
    );

    const facing: InternalVariation = {
      id: draft.variationId,
      projectId: projectA,
      variationNumber: 1,
      title: REVISED_TITLE,
      summary: REVISED_SUMMARY,
      status: "draft",
      revisions: [{
        id: draft.revisionId,
        revisionNumber: 1,
        status: "superseded",
        title: ORIGINAL_TITLE,
        summary: ORIGINAL_SUMMARY,
        currency: "NZD",
        gstRate: 15,
        taxTreatment: "gst_exclusive",
        totalDirectCostAdjustment: 900,
        totalSellAdjustmentExGst: 1500,
        gstAdjustment: 225,
        totalAdjustmentInclGst: 1725,
        proposedTimeEffectDays: null,
        clientNotes: ORIGINAL_NOTES,
        internalNotes: "SECRET INTERNAL NOTE",
        items: [{
          id: "item-1",
          itemType: "addition",
          clientDescription: "External stair set",
          quantity: 1,
          unit: "item",
          unitSell: 1500,
          unitCost: 900,
          lineSellAdjustmentExGst: 1500,
          lineCostAdjustment: 900,
          sortOrder: 1,
          clientInclusion: null,
          clientExclusion: null,
          substitutionGroupId: null,
          workAreaId: null,
          snapshotLineId: null,
          internalMetadata: { sellProvenance: "manual" },
        }],
      }],
    };
    const client = clientFacingVariation(facing);
    const clientJson = JSON.stringify(client);
    check(
      "S client payload keeps revision wording and omits COST and internal notes",
      client.revisions[0]?.title === ORIGINAL_TITLE &&
        client.revisions[0]?.summary === ORIGINAL_SUMMARY &&
        client.revisions[0]?.clientNotes === ORIGINAL_NOTES &&
        !clientJson.includes("unitCost") &&
        !clientJson.includes("SECRET INTERNAL NOTE") &&
        !("internalNotes" in client.revisions[0])
    );
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
