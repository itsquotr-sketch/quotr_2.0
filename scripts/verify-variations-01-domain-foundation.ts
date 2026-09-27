/**
 * VARIATIONS-01 — secure revisioned variation domain.
 *
 * Run: npx --yes tsx scripts/verify-variations-01-domain-foundation.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { roundMoney } from "../lib/commercial-engine/core/money";
import { CLADDING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/cladding-portions";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  calculateRevisedContractValue,
  canTransitionVariation,
  clientFacingVariation,
  internalSellFromKnownCost,
  prepareVariationItem,
  VARIATION_EVENT_METADATA_KEYS,
  VARIATION_TRANSITIONS,
  variationIssueBlocker,
  variationRevisionTotals,
  type InternalVariation,
  type PreparedVariationItem,
} from "../lib/variations/domain";
import {
  assertExplicitCleanupTargets,
  cleanupPreviewFixtureOrgs,
  queryPreviewRows,
  registerPreviewFixtureOrg,
} from "./lib/preview-admin-cleanup";
import {
  assertSafePreviewPasswordMutation,
  isPasswordProtectedPreviewAccount,
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

function money(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
}

function same(value: unknown, expected: number): boolean {
  const parsed = money(value);
  return parsed != null && Math.abs(parsed - expected) < 0.001;
}

type RpcBody = {
  ok?: boolean;
  error?: string;
  idempotent?: boolean;
  variationId?: string;
  revisionId?: string;
  variationNumber?: number;
  itemId?: string;
  status?: string;
  sellAdjustmentExGst?: number;
  gstAdjustment?: number;
  inclGstAdjustment?: number;
  revisionNumber?: number;
  supersededRevisionId?: string;
  lineSellAdjustmentExGst?: number | null;
};

function line(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    itemType: "addition",
    clientDescription: "Extra scope",
    workAreaId: null,
    snapshotLineId: null,
    stableComponentKey: null,
    quantity: 1,
    unit: "item",
    unitCost: null,
    unitSell: 100,
    sortOrder: 1,
    clientInclusion: "Included in this variation",
    clientExclusion: null,
    substitutionGroupId: null,
    internalMetadata: { source: "verifier" },
    lineSellAdjustmentExGst: 999999,
    totalSell: 999999,
    ...overrides,
  };
}

function prepared(overrides: Partial<Parameters<typeof prepareVariationItem>[0]>): PreparedVariationItem {
  const result = prepareVariationItem({
    itemType: "addition",
    clientDescription: "Extra scope",
    quantity: 1,
    unit: "item",
    unitSell: 100,
    unitCost: null,
    substitutionGroupId: null,
    ...overrides,
  });
  if (!result.ok) throw new Error(result.error);
  return result.item;
}

function sourceAndDomain(): void {
  const sql = read("supabase/migrations/063_variation_domain_foundation.sql");
  const actions = read("lib/variations/actions.ts");
  const schemas = read("lib/variations/schemas.ts");
  const domain = read("lib/variations/domain.ts");
  const moneySchema = read("lib/security/numeric-validation.ts");
  const foundation = read("lib/projects/lifecycle-foundation.ts");

  console.log("\nA. Schema");
  check("A migration 063 creates variation tables", ["project_variation_counters", "public.variations", "public.variation_revisions", "public.variation_items", "public.variation_command_receipts"].every((name) => sql.includes(name)));
  check("A project number and create key are unique", sql.includes("variations_project_number_uidx") && sql.includes("variations_idempotency_uidx"));
  check("A one accepted revision and one open revision are unique", sql.includes("variation_revisions_one_accepted_uidx") && sql.includes("variation_revisions_one_open_uidx"));
  check("A item types and signed checks are present", sql.includes("'addition', 'omission', 'no_cost_scope_change'") && sql.includes("variation_items_omission_sell_chk") && sql.includes("variation_items_addition_sell_chk"));
  check("A lifecycle vocabulary adds variation events and keeps quote events", ["variation_created", "variation_issued", "variation_accepted", "variation_rejected", "variation_withdrawn", "variation_superseded", "quote_accepted", "project_cancelled"].every((event) => sql.includes(`'${event}'`)) && foundation.includes("variation_accepted"));
  check("A 063 does not write quotes, snapshots, rates, pricing or estimates", !/update\s+public\.(quotes|accepted_commercial_snapshots|rates|pricing_items|pricing_documents)\b/i.test(sql) && !/insert\s+into\s+public\.(quotes|accepted_commercial_snapshots|rates|pricing_items|estimate_line_items)\b/i.test(sql));
  check("A signed money stays out of the global non-negative schema", moneySchema.includes("finiteNonNegativeNumberSchema") && schemas.includes("finiteNumberSchema") && !schemas.includes("moneyAmountSchema"));

  console.log("\nB. Ownership");
  check("B RLS is enabled and anonymous writes are revoked", sql.includes("enable row level security") && sql.includes("revoke all on table public.variations from public, anon, authenticated") && sql.includes("grant select on table public.variations to authenticated"));
  check("B commands are authenticated and helpers are not", sql.includes("grant execute on function public.create_draft_variation_v1(uuid, text, text, text) to authenticated") && sql.includes("revoke all on function public.accept_variation_revision_v1(uuid, uuid) from public, anon, authenticated, service_role"));
  check("B actions derive the actor and do not accept org, totals, status or numbers", actions.includes("getAuthOrgContext") && actions.includes("assertOrgOwnsActiveProject") && !actions.includes("p_org") && !actions.includes("p_variation_number") && !actions.includes("p_status") && !actions.includes("p_total"));
  check("B internal acceptance is not described as client consent", sql.includes("Not public client consent") && actions.includes("not public client consent"));

  console.log("\nC. Accepted-baseline requirement");
  check("C creation reads the project snapshot and rejects a missing baseline", sql.includes("NO_ACCEPTED_BASELINE") && sql.includes("from public.accepted_commercial_snapshots"));
  check("C closed, archived and deleted projects are rejected", sql.includes("PROJECT_CLOSED") && sql.includes("v_stage in ('cancelled', 'completed')") && sql.includes("v_deleted is not null"));

  console.log("\nD. Project-scoped numbering");
  check("D numbers come from a project counter and advisory lock", sql.includes("project_variation_counters") && sql.includes("pg_advisory_xact_lock(87240155"));
  check("D the client payload has no variation number", !schemas.includes("variationNumber") && !actions.includes("p_variation_number"));

  console.log("\nE. Concurrent numbering");
  check("E the same project lock serialises allocation", sql.includes("hashtext(p_project::text)") && sql.includes("variations_project_number_uidx"));

  console.log("\nF. Draft creation");
  check("F create is idempotent on the organisation key", sql.includes("variation_command_receipts") && sql.includes("'idempotent', true"));
  check("F create writes variation_created and not acceptance", sql.includes("'variation_created'") && sql.includes("variation_append_event"));

  console.log("\nG. Draft editing");
  check("G header and item edits require the current draft", sql.includes("update_draft_variation_v1") && sql.includes("IMMUTABLE"));

  console.log("\nH. Addition validation");
  const badAddition = prepareVariationItem({
    itemType: "addition",
    clientDescription: "Bad",
    quantity: 1,
    unit: "item",
    unitSell: -10,
    unitCost: null,
    substitutionGroupId: null,
  });
  const goodAddition = prepareVariationItem({
    itemType: "addition",
    clientDescription: "Good",
    quantity: 2,
    unit: "m2",
    unitSell: 1000,
    unitCost: 400,
    substitutionGroupId: null,
  });
  check("H negative addition sell is rejected", badAddition.ok === false);
  check("H addition sell and cost stay positive", goodAddition.ok === true && goodAddition.ok && goodAddition.item.lineSellAdjustmentExGst === 2000 && goodAddition.item.lineCostAdjustment === 800);

  console.log("\nI. Omission validation");
  const badOmission = prepareVariationItem({
    itemType: "omission",
    clientDescription: "Bad",
    quantity: 1,
    unit: "item",
    unitSell: 10,
    unitCost: null,
    substitutionGroupId: null,
  });
  const goodOmission = prepareVariationItem({
    itemType: "omission",
    clientDescription: "Removed",
    quantity: 1,
    unit: "item",
    unitSell: -500,
    unitCost: -200,
    substitutionGroupId: null,
  });
  check("I positive omission sell is rejected", badOmission.ok === false);
  check("I omission sell and cost stay negative", goodOmission.ok === true && goodOmission.ok && goodOmission.item.lineSellAdjustmentExGst === -500 && goodOmission.item.lineCostAdjustment === -200);

  console.log("\nJ. Substitution traceability");
  const group = "group-1";
  const pair = [
    prepared({ itemType: "omission", clientDescription: "Remove boards", unitSell: -400, substitutionGroupId: group }),
    prepared({ itemType: "addition", clientDescription: "Add composite", unitSell: 700, substitutionGroupId: group }),
  ];
  check("J a substitution is a linked omission and addition", variationIssueBlocker(pair) == null && pair[0].substitutionGroupId === pair[1].substitutionGroupId);
  check("J one side of a substitution cannot be issued", variationIssueBlocker([pair[0]]) === "INVALID_SUBSTITUTION");

  console.log("\nK. Signed arithmetic");
  const mixed = variationRevisionTotals([
    prepared({ itemType: "addition", unitSell: 2000, unitCost: 500 }),
    prepared({ itemType: "omission", unitSell: -500, unitCost: -100 }),
  ], 15);
  check("K mixed addition and omission net +1500", !("ok" in mixed) && mixed.totalSellAdjustmentExGst === 1500 && mixed.totalDirectCostAdjustment === 400);
  const positive = variationRevisionTotals([prepared({ unitSell: 2000 })], 15);
  const negative = variationRevisionTotals([prepared({ itemType: "omission", unitSell: -2000 })], 15);
  const zero = variationRevisionTotals([
    prepared({ unitSell: 100 }),
    prepared({ itemType: "omission", unitSell: -100 }),
  ], 15);
  check("K positive, negative and exact-zero nets are signed", !("ok" in positive) && positive.totalSellAdjustmentExGst === 2000 && !("ok" in negative) && negative.totalSellAdjustmentExGst === -2000 && !("ok" in zero) && zero.totalSellAdjustmentExGst === 0);
  check("K missing sell stays null and blocks issue", variationRevisionTotals([prepared({ unitSell: null })], 15).totalSellAdjustmentExGst == null && variationIssueBlocker([prepared({ unitSell: null })]) === "UNRESOLVED_PRICING");
  check("K a documented no-cost change can net to zero", variationIssueBlocker([prepared({ itemType: "no_cost_scope_change", unitSell: 0 })]) == null);

  console.log("\nL. GST and rounding");
  check("L golden GST is 225 and incl is 1725", !("ok" in mixed) && mixed.gstAdjustment === 225 && mixed.totalAdjustmentInclGst === 1725);
  const rounded = variationRevisionTotals([prepared({ unitSell: 10.1 })], 15);
  const roundedNegative = variationRevisionTotals([prepared({ itemType: "omission", unitSell: -10.1 })], 15);
  check(
    "L GST uses the document rounding contract",
    !("ok" in rounded) &&
      rounded.gstAdjustment === roundMoney(10.1 * 0.15) &&
      !("ok" in roundedNegative) &&
      roundedNegative.gstAdjustment === roundMoney(-10.1 * 0.15)
  );

  console.log("\nM. COST confidentiality");
  const internal: InternalVariation = {
    id: "v",
    projectId: "p",
    variationNumber: 1,
    title: "Variation",
    summary: null,
    status: "issued",
    revisions: [{
      id: "r",
      revisionNumber: 1,
      status: "issued",
      currency: "NZD",
      gstRate: 15,
      taxTreatment: "exclusive",
      totalDirectCostAdjustment: 400,
      totalSellAdjustmentExGst: 1500,
      gstAdjustment: 225,
      totalAdjustmentInclGst: 1725,
      proposedTimeEffectDays: null,
      clientNotes: "Visible",
      internalNotes: "SECRET MARGIN",
      items: [{
        id: "i",
        itemType: "addition",
        clientDescription: "Extra",
        quantity: 1,
        unit: "item",
        unitSell: 2000,
        unitCost: 500,
        lineSellAdjustmentExGst: 2000,
        lineCostAdjustment: 500,
        sortOrder: 1,
        clientInclusion: null,
        clientExclusion: null,
        substitutionGroupId: null,
        workAreaId: null,
        snapshotLineId: null,
        internalMetadata: { margin: 0.2 },
      }],
    }],
  };
  const facing = JSON.stringify(clientFacingVariation(internal));
  check("M client projection omits cost, margin and internal notes", !facing.includes("unitCost") && !facing.includes("lineCost") && !facing.includes("SECRET") && !facing.includes("margin") && facing.includes("Visible"));
  check("M known cost can price sell and unknown cost does not", internalSellFromKnownCost(500, 0.2) === 625 && internalSellFromKnownCost(null, 0.2) == null);
  check("M event metadata keys are an allow-list", VARIATION_EVENT_METADATA_KEYS.every((key) => domain.includes(`"${key}"`)) && sql.includes("jsonb_strip_nulls"));

  console.log("\nN–U. Transitions");
  check("N draft can be issued and cannot be accepted directly", canTransitionVariation("draft", "issued") && !canTransitionVariation("draft", "accepted"));
  check("N issued can be accepted, rejected, withdrawn or superseded", ["accepted", "rejected", "withdrawn", "superseded"].every((status) => canTransitionVariation("issued", status as "accepted")));
  check("R accepted, rejected, withdrawn and superseded are terminal", ["accepted", "rejected", "withdrawn", "superseded"].every((status) => VARIATION_TRANSITIONS[status as "accepted"].length === 0));
  check("N issue checks items before changing status", sql.indexOf("variation_issue_blocker") < sql.indexOf("status = 'issued'"));
  check("O issued content is frozen by the guard", sql.includes("VARIATION_IMMUTABLE") && sql.includes("old.status <> 'draft'"));
  check("P a new revision is only created from the issued revision", sql.includes("v_rev.status is distinct from 'issued'") && sql.includes("revised_from_revision_id"));
  check("Q supersede writes variation_superseded", sql.includes("'variation_superseded'"));
  check("S acceptance is idempotent and writes one event key", sql.includes("'variation_accepted'") && sql.includes("p_type || ':' || p_revision::text") && sql.includes("'idempotent', true"));
  check("T rejection and withdrawal are separate commands", sql.includes("reject_variation_revision_v1") && sql.includes("withdraw_variation_revision_v1"));

  console.log("\nV–Y. Rejection boundaries");
  check("V stale revisions are rejected", sql.includes("STALE_REVISION"));
  check("W cross-project references are rejected", sql.includes("CROSS_PROJECT"));
  check("X cross-tenant access is rejected", sql.includes("CROSS_TENANT"));
  check("Y signed-out access is rejected", sql.includes("NOT_AUTHENTICATED"));

  console.log("\nZ–AB. Revised value and events");
  const before = calculateRevisedContractValue({
    baseline: { currency: "NZD", gstRate: 15, taxTreatment: "exclusive", sellExGst: 10000, gstAmount: 1500, sellInclGst: 11500 },
    revisions: [{
      id: "r1",
      status: "issued",
      isCurrent: true,
      totalSellAdjustmentExGst: 1500,
      gstAdjustment: 225,
      totalAdjustmentInclGst: 1725,
      items: [
        { itemType: "addition", lineSellAdjustmentExGst: 2000 },
        { itemType: "omission", lineSellAdjustmentExGst: -500 },
      ],
    }],
  });
  const after = calculateRevisedContractValue({
    baseline: { currency: "NZD", gstRate: 15, taxTreatment: "exclusive", sellExGst: 10000, gstAmount: 1500, sellInclGst: 11500 },
    revisions: [{
      id: "r1",
      status: "accepted",
      isCurrent: true,
      totalSellAdjustmentExGst: 1500,
      gstAdjustment: 225,
      totalAdjustmentInclGst: 1725,
      items: [
        { itemType: "addition", lineSellAdjustmentExGst: 2000 },
        { itemType: "omission", lineSellAdjustmentExGst: -500 },
      ],
    }],
  });
  const reduced = calculateRevisedContractValue({
    baseline: { currency: "NZD", gstRate: 15, taxTreatment: "exclusive", sellExGst: 10000, gstAmount: 1500, sellInclGst: 11500 },
    revisions: [
      {
        id: "r1",
        status: "accepted",
        isCurrent: true,
        totalSellAdjustmentExGst: 1500,
        gstAdjustment: 225,
        totalAdjustmentInclGst: 1725,
        items: [
          { itemType: "addition", lineSellAdjustmentExGst: 2000 },
          { itemType: "omission", lineSellAdjustmentExGst: -500 },
        ],
      },
      {
        id: "r2",
        status: "accepted",
        isCurrent: true,
        totalSellAdjustmentExGst: -2000,
        gstAdjustment: -300,
        totalAdjustmentInclGst: -2300,
        items: [{ itemType: "omission", lineSellAdjustmentExGst: -2000 }],
      },
    ],
  });
  check("Z issued value does not change the accepted contract", before.ok === true && before.ok && before.value.revisedContractValueExGst === 10000 && before.value.originalAcceptedContractExGst === 10000);
  check("AA pending value is the issued adjustment only", before.ok === true && before.ok && before.value.pendingVariationValueExGst === 1500);
  check("Z accepted golden contract is 11500, GST 1725, incl 13225", after.ok === true && after.ok && after.value.revisedContractValueExGst === 11500 && after.value.gst === 1725 && after.value.revisedContractValueInclGst === 13225 && after.value.pendingVariationValueExGst === 0 && after.value.acceptedAdditionsExGst === 2000 && after.value.acceptedOmissionsExGst === -500);
  check("Z a later net-negative variation reduces the revised contract and keeps the 10000 baseline", reduced.ok === true && reduced.ok && reduced.value.originalAcceptedContractExGst === 10000 && reduced.value.revisedContractValueExGst === 9500 && reduced.value.netAcceptedVariationAdjustmentExGst === -500);
  check("AB revised value is not derived from events", !domain.includes("project_lifecycle_events") && actions.includes("accepted_commercial_snapshots"));

  console.log("\nAC–AF. Compatibility and cleanup");
  const variationInsert = sql.slice(sql.indexOf("insert into public.variations ("));
  check("AC variations are not backfilled", variationInsert.startsWith("insert into public.variations (") && variationInsert.slice(0, 700).includes("values (") && !variationInsert.slice(0, 700).toLowerCase().includes("select"));
  check("AD snapshot immutability from 058 is not replaced", !sql.includes("accepted_commercial_snapshots_immutable"));
  check("AE frozen work-area identities stay frozen", DOORS_V1_HUMAN_QA_FROZEN === true && FLOORING_V1_HUMAN_QA_FROZEN === true && CLADDING_V1_HUMAN_QA_FROZEN === true);
  check("AF cleanup still refuses an unregistered organisation", (() => {
    try {
      assertExplicitCleanupTargets([randomUUID()]);
      return false;
    } catch {
      return true;
    }
  })());
}

type Db = SupabaseClient;

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
  const email = `hello+variations-01.${stamp}@erccontracting.co.nz`;
  const password = `Var01-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(email);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(email));

  const orgA = randomUUID();
  const orgB = randomUUID();
  const orgCleanup = randomUUID();
  const projects = {
    golden: randomUUID(),
    lab: randomUUID(),
    plain: randomUUID(),
    completed: randomUUID(),
    archived: randomUUID(),
    other: randomUUID(),
    numbers: randomUUID(),
    foreign: randomUUID(),
    deleted: randomUUID(),
  };
  registerPreviewFixtureOrg(orgA);
  registerPreviewFixtureOrg(orgB);
  registerPreviewFixtureOrg(orgCleanup);
  let userId = "";

  async function cleanup(): Promise<void> {
    try {
      cleanupPreviewFixtureOrgs([orgA, orgB, orgCleanup]);
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
      { id: orgA, name: `Variations 01 ${stamp}` },
      { id: orgB, name: `Variations 01 other ${stamp}` },
      { id: orgCleanup, name: `Variations 01 cleanup ${stamp}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    const profile = await admin.from("profiles").insert({
      id: userId,
      org_id: orgA,
      role: "owner",
      full_name: "Variations 01",
    });
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

    const projectRows = await admin.from("projects").insert([
      { id: projects.golden, org_id: orgA, created_by: userId, title: `Golden ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projects.lab, org_id: orgA, created_by: userId, title: `Lab ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projects.plain, org_id: orgA, created_by: userId, title: `Plain ${stamp}`, stage: "brief", business_status: "estimating" },
      { id: projects.completed, org_id: orgA, created_by: userId, title: `Completed ${stamp}`, stage: "estimate_ready", business_status: "won" },
      { id: projects.archived, org_id: orgA, created_by: userId, title: `Archived ${stamp}`, stage: "estimate_ready", business_status: "won" },
      { id: projects.other, org_id: orgA, created_by: userId, title: `Other ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projects.numbers, org_id: orgA, created_by: userId, title: `Numbers ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projects.foreign, org_id: orgB, created_by: userId, title: `Foreign ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projects.deleted, org_id: orgA, created_by: userId, title: `Deleted ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready", deleted_at: new Date().toISOString() },
    ]);
    if (projectRows.error) throw new Error(projectRows.error.message);

    const user = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await user.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(signedIn.error.message);
    const anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

    async function baseline(projectId: string, sell = 10000): Promise<{ quoteId: string; snapshotId: string; lineId: string; sell: number }> {
      const quoteId = randomUUID();
      const gst = roundMoney(sell * 0.15);
      const quote = await admin.from("quotes").insert({
        id: quoteId,
        org_id: orgA,
        project_id: projectId,
        created_by: userId,
        title: "Accepted baseline",
        status: "draft",
        revision_number: 1,
        subtotal: sell,
        gst_rate: 15,
        gst_amount: gst,
        total_incl_gst: roundMoney(sell + gst),
      });
      if (quote.error) throw new Error(quote.error.message);
      const item = await admin.from("quote_items").insert({
        org_id: orgA,
        quote_id: quoteId,
        project_id: projectId,
        label: "Accepted work",
        description: "Accepted work",
        quantity: 1,
        unit: "ls",
        unit_price: sell,
        total: sell,
        sort_order: 1,
      });
      if (item.error) throw new Error(item.error.message);
      const accepted = await admin.from("quotes").update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      }).eq("id", quoteId);
      if (accepted.error) throw new Error(accepted.error.message);
      const snap = await admin.from("accepted_commercial_snapshots").select("id, sell_ex_gst").eq("project_id", projectId).single();
      if (snap.error || !snap.data) throw new Error(snap.error?.message ?? "snapshot missing");
      const lineRow = await admin.from("accepted_commercial_snapshot_lines").select("id, line_sell_ex_gst").eq("snapshot_id", snap.data.id).single();
      if (lineRow.error || !lineRow.data) throw new Error(lineRow.error?.message ?? "line missing");
      return { quoteId, snapshotId: snap.data.id, lineId: lineRow.data.id, sell: Number(snap.data.sell_ex_gst) };
    }

    const goldenBase = await baseline(projects.golden);
    await baseline(projects.lab);
    const otherBase = await baseline(projects.other);
    await baseline(projects.completed);
    await baseline(projects.archived);
    await baseline(projects.numbers);
    const completed = await admin.from("project_lifecycle_positions").update({ stage: "completed" }).eq("project_id", projects.completed);
    if (completed.error) throw new Error(completed.error.message);
    const archived = await admin.from("projects").update({ archived_at: new Date().toISOString(), business_status: "archived" }).eq("id", projects.archived);
    if (archived.error) throw new Error(archived.error.message);

    const workArea = await admin.from("work_areas").insert({
      org_id: orgA,
      project_id: projects.golden,
      type: "deck",
      name: `Deck ${stamp}`,
    }).select("id, name, type, status, summary, updated_at").single();
    if (workArea.error || !workArea.data) throw new Error(workArea.error?.message ?? "work area");
    const workAreaBefore = JSON.stringify(workArea.data);
    const otherArea = await admin.from("work_areas").insert({
      org_id: orgA,
      project_id: projects.other,
      type: "fence",
      name: `Fence ${stamp}`,
    }).select("id").single();
    if (otherArea.error || !otherArea.data) throw new Error(otherArea.error?.message ?? "other area");

    async function call(client: Db, fn: string, args: Record<string, unknown>): Promise<RpcBody & { transport?: string }> {
      const { data, error } = await client.rpc(fn, args);
      if (error) return { ok: false, error: error.message, transport: error.message };
      return (data ?? { ok: false }) as RpcBody;
    }

    async function variationEvents(projectId: string): Promise<Array<{ event_type: string; metadata: Record<string, unknown>; idempotency_key: string }>> {
      const rows = await admin.from("project_lifecycle_events").select("event_type, metadata, idempotency_key").eq("project_id", projectId);
      if (rows.error) throw new Error(rows.error.message);
      return (rows.data ?? []) as Array<{ event_type: string; metadata: Record<string, unknown>; idempotency_key: string }>;
    }

    const signedOut = await call(anonClient, "create_draft_variation_v1", {
      p_project: projects.golden,
      p_title: "Signed out",
      p_summary: null,
      p_idempotency_key: `signed-out-${stamp}`,
    });
    check("Y unauthenticated create is rejected", signedOut.ok !== true);

    const crossTenant = await call(user, "create_draft_variation_v1", {
      p_project: projects.foreign,
      p_title: "Foreign",
      p_summary: null,
      p_idempotency_key: `foreign-${stamp}-key`,
    });
    check("X cross-tenant create is rejected", crossTenant.ok === false && crossTenant.error === "CROSS_TENANT");

    const noBaseline = await call(user, "create_draft_variation_v1", {
      p_project: projects.plain,
      p_title: "Too early",
      p_summary: null,
      p_idempotency_key: `plain-${stamp}-key`,
    });
    check("C a project without an accepted baseline cannot create a variation", noBaseline.ok === false && noBaseline.error === "NO_ACCEPTED_BASELINE");
    const plainRows = await admin.from("variations").select("id").eq("project_id", projects.plain);
    const plainEvents = await variationEvents(projects.plain);
    check("AC the plain project gains no variation rows or variation events", (plainRows.data ?? []).length === 0 && !plainEvents.some((row) => String(row.event_type).startsWith("variation_")));

    const closed = await call(user, "create_draft_variation_v1", {
      p_project: projects.completed,
      p_title: "Closed",
      p_summary: null,
      p_idempotency_key: `completed-${stamp}-key`,
    });
    const archivedCreate = await call(user, "create_draft_variation_v1", {
      p_project: projects.archived,
      p_title: "Archived",
      p_summary: null,
      p_idempotency_key: `archived-${stamp}-key`,
    });
    const deletedCreate = await call(user, "create_draft_variation_v1", {
      p_project: projects.deleted,
      p_title: "Deleted",
      p_summary: null,
      p_idempotency_key: `deleted-${stamp}-key`,
    });
    check("C completed and archived projects are rejected", closed.error === "PROJECT_CLOSED" && archivedCreate.error === "PROJECT_CLOSED");
    check("C a deleted project is not found", deletedCreate.error === "NOT_FOUND");

    const goldenKey = `golden-${stamp}-key`;
    const first = await call(user, "create_draft_variation_v1", {
      p_project: projects.golden,
      p_title: "Variation 1",
      p_summary: "Scope change",
      p_idempotency_key: goldenKey,
    });
    const replay = await call(user, "create_draft_variation_v1", {
      p_project: projects.golden,
      p_title: "Variation 1 again",
      p_summary: "Ignored",
      p_idempotency_key: goldenKey,
    });
    check("F the first variation is draft number 1", first.ok === true && first.variationNumber === 1 && Boolean(first.variationId && first.revisionId));
    check("F the same idempotency key returns one variation", replay.idempotent === true && replay.variationId === first.variationId);
    const goldenCount = await admin.from("variations").select("id").eq("project_id", projects.golden);
    check("F replay does not insert a second row", (goldenCount.data ?? []).length === 1);

    const createdEvents = await variationEvents(projects.golden);
    check("AB create writes one variation_created event and no acceptance", createdEvents.filter((row) => row.event_type === "variation_created").length === 1 && createdEvents.filter((row) => row.event_type === "variation_accepted").length === 0);

    const crossLine = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item: line({ snapshotLineId: otherBase.lineId, unitSell: 10 }),
    });
    check("W a snapshot line from another project is rejected", crossLine.ok === false && crossLine.error === "CROSS_PROJECT");
    const crossArea = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item: line({ workAreaId: otherArea.data.id, unitSell: 10 }),
    });
    check("W a work area from another project is rejected", crossArea.ok === false && crossArea.error === "CROSS_PROJECT");

    const addition = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item: line({
        clientDescription: "Additional decking",
        quantity: 1,
        unitSell: 2000,
        unitCost: 500,
        workAreaId: workArea.data.id,
        snapshotLineId: goldenBase.lineId,
        sortOrder: 1,
      }),
    });
    const omission = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item: line({
        itemType: "omission",
        clientDescription: "Omit allowance",
        quantity: 1,
        unitSell: -500,
        unitCost: -100,
        sortOrder: 2,
      }),
    });
    check("H hosted addition stores +2000 and ignores the client total", addition.ok === true && same(addition.lineSellAdjustmentExGst, 2000));
    check("I hosted omission stores -500", omission.ok === true && same(omission.lineSellAdjustmentExGst, -500));

    const badAdd = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item: line({ unitSell: -1 }),
    });
    const badOmit = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item: line({ itemType: "omission", unitSell: 20 }),
    });
    const badQty = await call(user, "add_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item: line({ quantity: "nan" }),
    });
    check("H I malformed addition, omission and quantity are rejected", badAdd.error === "INVALID_ITEM" && badOmit.error === "INVALID_ITEM" && badQty.error === "INVALID_QUANTITY");

    const header = await call(user, "update_draft_variation_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_title: "Variation 1",
      p_summary: "Mixed scope",
      p_client_notes: "Client can read this",
      p_internal_notes: "SECRET MARGIN 20",
      p_time_effect_days: 5,
    });
    check("G draft header accepts client notes and keeps internal notes separate", header.ok === true);

    const draftTotals = await admin.from("variation_revisions").select("total_sell_adjustment_ex_gst, gst_adjustment, total_adjustment_incl_gst, gst_rate, currency, tax_treatment").eq("id", first.revisionId).single();
    check("K hosted mixed total is +1500 before issue", same(draftTotals.data?.total_sell_adjustment_ex_gst, 1500) && same(draftTotals.data?.gst_adjustment, 225) && same(draftTotals.data?.total_adjustment_incl_gst, 1725));
    check("L the revision keeps the baseline 15% GST", same(draftTotals.data?.gst_rate, 15) && draftTotals.data?.currency === "NZD" && draftTotals.data?.tax_treatment === "exclusive");

    const gstSwitch = await admin.from("organisation_settings").update({ default_gst_rate: 0 }).eq("org_id", orgA);
    check("L organisation GST can change without a migration error", !gstSwitch.error);
    const rateAfter = await admin.from("variation_revisions").select("gst_rate").eq("id", first.revisionId).single();
    check("L the variation does not switch to the new organisation GST", same(rateAfter.data?.gst_rate, 15));

    const lineBefore = await admin.from("accepted_commercial_snapshot_lines").select("line_sell_ex_gst, client_description").eq("id", goldenBase.lineId).single();
    const quoteBefore = await admin.from("quotes").select("subtotal, status").eq("id", goldenBase.quoteId).single();
    const snapBefore = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst").eq("id", goldenBase.snapshotId).single();

    const issued = await call(user, "issue_variation_revision_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
    });
    const issuedAgain = await call(user, "issue_variation_revision_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
    });
    const issuedEvents = await variationEvents(projects.golden);
    check("N issue succeeds with the signed totals", issued.ok === true && issued.status === "issued" && same(issued.sellAdjustmentExGst, 1500) && same(issued.gstAdjustment, 225));
    check("N S repeated issue is one result and one event", issuedAgain.idempotent === true && issuedEvents.filter((row) => row.event_type === "variation_issued").length === 1);
    check("AA pending issued value is separate from the accepted contract", same(snapBefore.data?.sell_ex_gst, 10000));

    const metadataSafe = issuedEvents.filter((row) => String(row.event_type).startsWith("variation_")).every((row) => {
      const keys = Object.keys(row.metadata ?? {});
      const text = JSON.stringify(row.metadata ?? {});
      return keys.every((key) => (VARIATION_EVENT_METADATA_KEYS as readonly string[]).includes(key)) && !text.includes("SECRET") && !text.toLowerCase().includes("margin") && !("unitCost" in (row.metadata ?? {}));
    });
    check("M variation events carry identifiers and sell only", metadataSafe && issuedEvents.some((row) => row.event_type === "variation_issued" && same(row.metadata?.sellAdjustmentExGst, 1500)));

    const mutated = await admin.from("variation_items").update({ client_description: "Changed" }).eq("id", addition.itemId);
    check("O a direct edit of an issued item fails", Boolean(mutated.error) && (mutated.error?.message ?? "").includes("VARIATION_IMMUTABLE"));
    const rpcEdit = await call(user, "update_draft_variation_item_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
      p_item_id: addition.itemId,
      p_item: line({ clientDescription: "Changed", unitSell: 2000 }),
    });
    check("O an issued revision cannot be edited through the draft action", rpcEdit.ok === false && rpcEdit.error === "IMMUTABLE");
    const directAccept = await call(user, "accept_variation_revision_v1", {
      p_variation: first.variationId,
      p_revision: randomUUID(),
    });
    check("V a non-current revision cannot be accepted", directAccept.ok === false && directAccept.error === "STALE_REVISION");

    const accepted = await call(user, "accept_variation_revision_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
    });
    const acceptedAgain = await call(user, "accept_variation_revision_v1", {
      p_variation: first.variationId,
      p_revision: first.revisionId,
    });
    const acceptedEvents = await variationEvents(projects.golden);
    check("R acceptance succeeds", accepted.ok === true && accepted.status === "accepted");
    check("S repeated acceptance is one accepted revision and one event", acceptedAgain.idempotent === true && acceptedEvents.filter((row) => row.event_type === "variation_accepted").length === 1);
    const quoteAcceptedCount = acceptedEvents.filter((row) => row.event_type === "quote_accepted").length;
    check("AB variation acceptance does not manufacture another quote acceptance", quoteAcceptedCount === 1);

    const second = await call(user, "create_draft_variation_v1", {
      p_project: projects.golden,
      p_title: "Variation 2",
      p_summary: "Reduction",
      p_idempotency_key: `golden-${stamp}-two`,
    });
    check("D the next variation number is 2", second.ok === true && second.variationNumber === 2);
    const secondItem = await call(user, "add_draft_variation_item_v1", {
      p_variation: second.variationId,
      p_revision: second.revisionId,
      p_item: line({ itemType: "omission", clientDescription: "Reduce scope", unitSell: -2000, sortOrder: 1 }),
    });
    const secondIssue = await call(user, "issue_variation_revision_v1", {
      p_variation: second.variationId,
      p_revision: second.revisionId,
    });
    const secondAccept = await call(user, "accept_variation_revision_v1", {
      p_variation: second.variationId,
      p_revision: second.revisionId,
    });
    check("K a net-negative variation is accepted", secondItem.ok === true && secondIssue.ok === true && same(secondIssue.sellAdjustmentExGst, -2000) && secondAccept.ok === true);

    const snapAfter = await admin.from("accepted_commercial_snapshots").select("sell_ex_gst, gst_amount, sell_incl_gst").eq("id", goldenBase.snapshotId).single();
    const lineAfter = await admin.from("accepted_commercial_snapshot_lines").select("line_sell_ex_gst, client_description").eq("id", goldenBase.lineId).single();
    const quoteAfter = await admin.from("quotes").select("subtotal, status").eq("id", goldenBase.quoteId).single();
    const snapWrite = await admin.from("accepted_commercial_snapshots").update({ sell_ex_gst: 1 }).eq("id", goldenBase.snapshotId);
    check("AD the accepted baseline is unchanged and cannot be replaced", same(snapAfter.data?.sell_ex_gst, 10000) && same(snapAfter.data?.gst_amount, 1500) && same(snapAfter.data?.sell_incl_gst, 11500) && Boolean(snapWrite.error));
    check("AD the referenced snapshot line is unchanged", same(lineBefore.data?.line_sell_ex_gst, lineAfter.data?.line_sell_ex_gst) && lineBefore.data?.client_description === lineAfter.data?.client_description);
    check("AC the quote status and subtotal are unchanged", quoteBefore.data?.status === quoteAfter.data?.status && same(quoteBefore.data?.subtotal, quoteAfter.data?.subtotal));
    const areaAfter = await admin.from("work_areas").select("id, name, type, status, summary, updated_at").eq("id", workArea.data.id).single();
    check("AE the referenced work area row is unchanged", JSON.stringify(areaAfter.data) === workAreaBefore);

    const position = await admin.from("project_lifecycle_positions").select("stage").eq("project_id", projects.golden).single();
    check("AC acceptance does not move the project lifecycle stage", position.data?.stage === "quote_accepted");

    const numberA = call(user, "create_draft_variation_v1", {
      p_project: projects.numbers,
      p_title: "Concurrent A",
      p_summary: null,
      p_idempotency_key: `numbers-${stamp}-a`,
    });
    const numberB = call(user, "create_draft_variation_v1", {
      p_project: projects.numbers,
      p_title: "Concurrent B",
      p_summary: null,
      p_idempotency_key: `numbers-${stamp}-b`,
    });
    const numbered = await Promise.all([numberA, numberB]);
    const numberSet = new Set(numbered.map((row) => row.variationNumber));
    check("E concurrent creates receive variation numbers 1 and 2", numbered.every((row) => row.ok === true) && numberSet.size === 2 && numberSet.has(1) && numberSet.has(2));

    const lab = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "Lab revision",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-revise`,
    });
    const labAdd = await call(user, "add_draft_variation_item_v1", {
      p_variation: lab.variationId,
      p_revision: lab.revisionId,
      p_item: line({ clientDescription: "Original wording", unitSell: 300, sortOrder: 1 }),
    });
    const unresolved = await call(user, "add_draft_variation_item_v1", {
      p_variation: lab.variationId,
      p_revision: lab.revisionId,
      p_item: line({ clientDescription: "Unpriced", unitSell: null, sortOrder: 2 }),
    });
    const unresolvedRow = await admin.from("variation_items").select("line_sell_adjustment_ex_gst").eq("id", unresolved.itemId).single();
    const unresolvedIssue = await call(user, "issue_variation_revision_v1", {
      p_variation: lab.variationId,
      p_revision: lab.revisionId,
    });
    check("K unresolved pricing stays null and blocks issue", unresolved.ok === true && unresolvedRow.data?.line_sell_adjustment_ex_gst == null && unresolvedIssue.error === "UNRESOLVED_PRICING");
    const removed = await call(user, "delete_draft_variation_item_v1", {
      p_variation: lab.variationId,
      p_revision: lab.revisionId,
      p_item_id: unresolved.itemId,
    });
    check("G a draft item can be deleted", removed.ok === true);

    const emptyIssue = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "Empty",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-empty`,
    });
    const emptyResult = await call(user, "issue_variation_revision_v1", {
      p_variation: emptyIssue.variationId,
      p_revision: emptyIssue.revisionId,
    });
    check("N an empty variation cannot be issued", emptyResult.error === "EMPTY_VARIATION");

    const labIssue = await call(user, "issue_variation_revision_v1", {
      p_variation: lab.variationId,
      p_revision: lab.revisionId,
    });
    const revised = await call(user, "create_variation_revision_v1", {
      p_variation: lab.variationId,
      p_revision: lab.revisionId,
    });
    const revisedAgain = await call(user, "create_variation_revision_v1", {
      p_variation: lab.variationId,
      p_revision: lab.revisionId,
    });
    check("P issue then revise creates revision 2", labIssue.ok === true && revised.ok === true && revised.revisionNumber === 2 && revised.revisionId !== lab.revisionId);
    check("P repeating the revise returns the same draft", revisedAgain.idempotent === true && revisedAgain.revisionId === revised.revisionId);
    const oldRevision = await admin.from("variation_revisions").select("status").eq("id", lab.revisionId).single();
    const oldItem = await admin.from("variation_items").select("client_description").eq("id", labAdd.itemId).single();
    check("Q the issued revision is superseded and its wording remains", oldRevision.data?.status === "superseded" && oldItem.data?.client_description === "Original wording");
    const labEvents = await variationEvents(projects.lab);
    check("Q P supersession writes one event and does not accept the variation", labEvents.filter((row) => row.event_type === "variation_superseded").length === 1 && labEvents.filter((row) => row.event_type === "variation_accepted").length === 0);
    const edited = await call(user, "update_draft_variation_item_v1", {
      p_variation: lab.variationId,
      p_revision: revised.revisionId,
      p_item_id: (await admin.from("variation_items").select("id").eq("revision_id", revised.revisionId).single()).data?.id,
      p_item: line({ clientDescription: "Revised wording", unitSell: 300 }),
    });
    const oldItemAfter = await admin.from("variation_items").select("client_description").eq("id", labAdd.itemId).single();
    check("G P the new draft can change while the issued wording stays", edited.ok === true && oldItemAfter.data?.client_description === "Original wording");
    const staleAccept = await call(user, "accept_variation_revision_v1", {
      p_variation: lab.variationId,
      p_revision: lab.revisionId,
    });
    check("V the superseded revision cannot be accepted", staleAccept.error === "STALE_REVISION");
    const draftAccept = await call(user, "accept_variation_revision_v1", {
      p_variation: lab.variationId,
      p_revision: revised.revisionId,
    });
    check("R a draft cannot be accepted", draftAccept.error === "INVALID_TRANSITION");

    const subGroup = randomUUID();
    const substitution = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "Substitution",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-sub`,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: substitution.variationId,
      p_revision: substitution.revisionId,
      p_item: line({ itemType: "omission", clientDescription: "Remove timber", unitSell: -400, substitutionGroupId: subGroup, sortOrder: 1 }),
    });
    const half = await call(user, "issue_variation_revision_v1", {
      p_variation: substitution.variationId,
      p_revision: substitution.revisionId,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: substitution.variationId,
      p_revision: substitution.revisionId,
      p_item: line({ itemType: "addition", clientDescription: "Add composite", unitSell: 700, substitutionGroupId: subGroup, sortOrder: 2 }),
    });
    const both = await call(user, "issue_variation_revision_v1", {
      p_variation: substitution.variationId,
      p_revision: substitution.revisionId,
    });
    const subItems = await admin.from("variation_items").select("item_type, client_description").eq("revision_id", substitution.revisionId);
    const descriptions = (subItems.data ?? []).map((row) => row.client_description).sort();
    check("J a one-sided substitution cannot be issued", half.error === "INVALID_SUBSTITUTION");
    check("J the issued substitution shows the removal and the addition", both.ok === true && same(both.sellAdjustmentExGst, 300) && descriptions.includes("Remove timber") && descriptions.includes("Add composite"));

    const zeroVar = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "Zero net",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-zero`,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: zeroVar.variationId,
      p_revision: zeroVar.revisionId,
      p_item: line({ clientDescription: "Add", unitSell: 100, sortOrder: 1 }),
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: zeroVar.variationId,
      p_revision: zeroVar.revisionId,
      p_item: line({ itemType: "omission", clientDescription: "Remove", unitSell: -100, sortOrder: 2 }),
    });
    const zeroIssue = await call(user, "issue_variation_revision_v1", {
      p_variation: zeroVar.variationId,
      p_revision: zeroVar.revisionId,
    });
    check("K an exact-zero net of real lines can be issued", zeroIssue.ok === true && same(zeroIssue.sellAdjustmentExGst, 0) && same(zeroIssue.gstAdjustment, 0));

    const noCost = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "No cost",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-nocost`,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: noCost.variationId,
      p_revision: noCost.revisionId,
      p_item: line({ itemType: "no_cost_scope_change", clientDescription: "Move the meter box at no charge", unitSell: 0, unitCost: null, sortOrder: 1 }),
    });
    const noCostIssue = await call(user, "issue_variation_revision_v1", {
      p_variation: noCost.variationId,
      p_revision: noCost.revisionId,
    });
    check("K a documented no-cost scope change can be issued", noCostIssue.ok === true && same(noCostIssue.sellAdjustmentExGst, 0));

    const rounding = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "Rounding",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-round`,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: rounding.variationId,
      p_revision: rounding.revisionId,
      p_item: line({ unitSell: 10.1, sortOrder: 1 }),
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: rounding.variationId,
      p_revision: rounding.revisionId,
      p_item: line({ itemType: "omission", clientDescription: "Small omission", unitSell: -10.1, sortOrder: 2 }),
    });
    const roundingIssue = await call(user, "issue_variation_revision_v1", {
      p_variation: rounding.variationId,
      p_revision: rounding.revisionId,
    });
    check(
      "L hosted GST matches the document rounding contract",
      roundingIssue.ok === true && same(roundingIssue.gstAdjustment, roundMoney(0))
    );
    const positiveRound = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "Round positive",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-round-pos`,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: positiveRound.variationId,
      p_revision: positiveRound.revisionId,
      p_item: line({ unitSell: 10.1 }),
    });
    const positiveIssued = await call(user, "issue_variation_revision_v1", {
      p_variation: positiveRound.variationId,
      p_revision: positiveRound.revisionId,
    });
    check("L hosted positive GST rounds 10.10 at 15%", positiveIssued.ok === true && same(positiveIssued.gstAdjustment, roundMoney(10.1 * 0.15)));

    const rejectedVar = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "Reject me",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-reject`,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: rejectedVar.variationId,
      p_revision: rejectedVar.revisionId,
      p_item: line({ unitSell: 50 }),
    });
    await call(user, "issue_variation_revision_v1", {
      p_variation: rejectedVar.variationId,
      p_revision: rejectedVar.revisionId,
    });
    const rejected = await call(user, "reject_variation_revision_v1", {
      p_variation: rejectedVar.variationId,
      p_revision: rejectedVar.revisionId,
    });
    const rejectedAgain = await call(user, "reject_variation_revision_v1", {
      p_variation: rejectedVar.variationId,
      p_revision: rejectedVar.revisionId,
    });
    const rejectedAccept = await call(user, "accept_variation_revision_v1", {
      p_variation: rejectedVar.variationId,
      p_revision: rejectedVar.revisionId,
    });
    const rejectEvents = (await variationEvents(projects.lab)).filter((row) => row.event_type === "variation_rejected" && row.metadata?.variationId === rejectedVar.variationId);
    check("T rejection is terminal and idempotent", rejected.ok === true && rejectedAgain.idempotent === true && rejectedAccept.error === "INVALID_TRANSITION" && rejectEvents.length === 1);

    const withdrawn = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "Withdraw me",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-withdraw`,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: withdrawn.variationId,
      p_revision: withdrawn.revisionId,
      p_item: line({ unitSell: 80 }),
    });
    await call(user, "issue_variation_revision_v1", {
      p_variation: withdrawn.variationId,
      p_revision: withdrawn.revisionId,
    });
    const withdrawResult = await call(user, "withdraw_variation_revision_v1", {
      p_variation: withdrawn.variationId,
      p_revision: withdrawn.revisionId,
    });
    const withdrawIssue = await call(user, "issue_variation_revision_v1", {
      p_variation: withdrawn.variationId,
      p_revision: withdrawn.revisionId,
    });
    const withdrawEvents = (await variationEvents(projects.lab)).filter((row) => row.event_type === "variation_withdrawn" && row.metadata?.variationId === withdrawn.variationId);
    check("U withdrawal is terminal and cannot be reissued", withdrawResult.ok === true && withdrawIssue.error === "INVALID_TRANSITION" && withdrawEvents.length === 1);

    const race = await call(user, "create_draft_variation_v1", {
      p_project: projects.lab,
      p_title: "Race",
      p_summary: null,
      p_idempotency_key: `lab-${stamp}-race`,
    });
    await call(user, "add_draft_variation_item_v1", {
      p_variation: race.variationId,
      p_revision: race.revisionId,
      p_item: line({ unitSell: 40 }),
    });
    await call(user, "issue_variation_revision_v1", {
      p_variation: race.variationId,
      p_revision: race.revisionId,
    });
    const raced = await Promise.all([
      call(user, "accept_variation_revision_v1", { p_variation: race.variationId, p_revision: race.revisionId }),
      call(user, "accept_variation_revision_v1", { p_variation: race.variationId, p_revision: race.revisionId }),
    ]);
    const acceptedRows = await admin.from("variation_revisions").select("id").eq("variation_id", race.variationId).eq("status", "accepted");
    const raceEvents = (await variationEvents(projects.lab)).filter((row) => row.event_type === "variation_accepted" && row.metadata?.variationId === race.variationId);
    check("S concurrent acceptance yields one accepted revision and one event", raced.every((row) => row.ok === true) && (acceptedRows.data ?? []).length === 1 && raceEvents.length === 1);

    const hidden = await user.from("variations").select("id").eq("org_id", orgB);
    const adminForeign = await admin.from("variations").select("id").eq("project_id", projects.foreign);
    check("X the signed-in organisation cannot read the other tenant", (hidden.data ?? []).length === 0 && (adminForeign.data ?? []).length === 0);
    const anonRead = await anonClient.from("variations").select("id").limit(1);
    check("Y anonymous variation reads are rejected", Boolean(anonRead.error) || (anonRead.data ?? []).length === 0);

    const costRow = await admin.from("variation_items").select("unit_cost, line_cost_adjustment, internal_metadata").eq("id", addition.itemId).single();
    const facing = clientFacingVariation({
      id: first.variationId ?? "",
      projectId: projects.golden,
      variationNumber: 1,
      title: "Variation 1",
      summary: "Mixed scope",
      status: "accepted",
      revisions: [{
        id: first.revisionId ?? "",
        revisionNumber: 1,
        status: "accepted",
        currency: "NZD",
        gstRate: 15,
        taxTreatment: "exclusive",
        totalDirectCostAdjustment: money(costRow.data?.line_cost_adjustment),
        totalSellAdjustmentExGst: 1500,
        gstAdjustment: 225,
        totalAdjustmentInclGst: 1725,
        proposedTimeEffectDays: 5,
        clientNotes: "Client can read this",
        internalNotes: "SECRET MARGIN 20",
        items: [{
          id: addition.itemId ?? "",
          itemType: "addition",
          clientDescription: "Additional decking",
          quantity: 1,
          unit: "item",
          unitSell: 2000,
          unitCost: money(costRow.data?.unit_cost),
          lineSellAdjustmentExGst: 2000,
          lineCostAdjustment: money(costRow.data?.line_cost_adjustment),
          sortOrder: 1,
          clientInclusion: "Included in this variation",
          clientExclusion: null,
          substitutionGroupId: null,
          workAreaId: workArea.data.id,
          snapshotLineId: goldenBase.lineId,
          internalMetadata: (costRow.data?.internal_metadata ?? {}) as Record<string, unknown>,
        }],
      }],
    });
    const facingText = JSON.stringify(facing);
    check("M the hosted cost row exists internally and is absent from the client view", same(costRow.data?.unit_cost, 500) && !facingText.includes("unitCost") && !facingText.includes("lineCost") && !facingText.includes("SECRET") && facingText.includes("Client can read this"));

    const rates = await admin.from("rates").select("id").eq("org_id", orgA);
    check("AC company rates were not written", !rates.error && (rates.data ?? []).length === 0);

    console.log("\nAF. Preview fixture cleanup");
    cleanupPreviewFixtureOrgs([orgCleanup]);
    const gone = queryPreviewRows(
      `select id from public.organisations where id = '${orgCleanup}'`
    );
    check("AF the registered cleanup organisation is removed", Array.isArray(gone) && gone.length === 0);
  } catch (error) {
    check("hosted proof completed", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup();
  }
}

async function main(): Promise<void> {
  sourceAndDomain();
  await hostedProof();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
