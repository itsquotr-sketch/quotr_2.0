/**
 * VARIATIONS-02-R4.2 — live rate search stays inside the Add item modal.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-r4-2-live-rate-search.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { buildVariationDocument } from "../lib/variations/presentation";
import {
  listEligibleVariationRates,
  resolveVariationComponentRate,
} from "../lib/variations/rate-selection";
import { cleanupPreviewFixtureOrgs, registerPreviewFixtureOrg } from "./lib/preview-admin-cleanup";
import { assertSafePreviewPasswordMutation, isPasswordProtectedPreviewAccount } from "./lib/preview-auth-fixture";

const root = join(__dirname, "..");
const BRACELINE_KEY = "sheet.plasterboard.braceline.each";
const LABOUR_KEY = "labour.carpenter.hour";
const PRODUCTIVITY_KEY = "deck.base_labour_hours_per_m2";
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
const picker = read("components/variations/VariationRatePicker.tsx");
const actions = read("lib/variations/actions.ts");
const domain = read("lib/variations/domain.ts");
const applied = between(editor, "onApplied={(patch) => {", "}}");
const searchRates = between(editor, "async function searchRates", "function saveComponent");
const saveComponent = between(editor, "function saveComponent()", "function cancelComponent()");
const cancelComponent = between(editor, "function cancelComponent()", "actionsRef.current.save");
const parentSubmit = between(editor, "<form className=\"flex min-h-0 flex-1 flex-col\"", "if (props.pending) return;");
const clientMap = between(domain, "items: revision.items.map((item) => ({", "})),");
const searchAction = between(actions, "export async function searchVariationComponentRates", "type RateSnapshot");

console.log("\nForm ownership");
check("search control is not a nested form or parent submit", !picker.includes("<form") && !picker.includes("type=\"submit\"") && !picker.includes(">Search<"));
check("Enter in the search input does not submit Add item", picker.includes("event.key === \"Enter\"") && picker.includes("event.preventDefault()") && picker.includes("event.stopPropagation()") && picker.includes("selectRate(rate)"));
check("Escape closes the results list and the dialog can cancel that key", picker.includes("event.key === \"Escape\"") && picker.includes("setListOpen(false)") && editor.includes("details.reason === \"escape-key\"") && editor.includes("details.cancel()"));
check("parent Add item is saved only by the parent action", parentSubmit.includes("activeComponentEditor") && parentSubmit.includes("?.save()") && parentSubmit.includes("return") && editor.includes("Save cost component") && editor.includes("Cancel component") && editor.includes("type=\"submit\"") && editor.includes("\"Add item\""));
check("selecting a result leaves the Add item modal open", applied.includes("setPickerOpen(false)") && !applied.includes("props.onClose") && !applied.includes("props.onSave") && !applied.includes("router"));

console.log("\nLive results");
const broad = listEligibleVariationRates({ category: "material", componentUnit: "", companyRates: [], query: "braceline" });
const narrow = listEligibleVariationRates({ category: "material", componentUnit: "", companyRates: [], query: "braceline 13" });
const missed = listEligibleVariationRates({ category: "material", componentUnit: "", companyRates: [], query: "braceline zzzz" });
const sheet = narrow.rates.find((rate) => rate.canonicalKey === BRACELINE_KEY);
check(
  "typing returns narrowed material results",
  broad.rates.length > 0 && narrow.rates.length > 0 && narrow.rates.length <= broad.rates.length && missed.rates.length < broad.rates.length && narrow.rates.every((rate) => broad.rates.some((row) => row.canonicalKey === rate.canonicalKey)),
  `${broad.rates.length} -> ${narrow.rates.length} -> ${missed.rates.length}`
);
check(
  "Braceline search finds the exact sheet",
  Boolean(sheet) && sheet?.unit === "each" && (sheet?.detail ?? "").includes("13 mm") && (sheet?.detail ?? "").includes("2400"),
  sheet ? `${sheet.label} ${sheet.detail}` : "missing"
);
check(
  "results show label, unit COST, unit and source",
  picker.includes("resultHeading(rate)") && picker.includes("resultContext(rate)") && picker.includes("rate.effectiveCost") && picker.includes("displayUnit(rate.unit)") && picker.includes("variationRateSourceText(rate)") && picker.includes("Derived Quotr benchmark") && picker.includes("Company Rate"),
);
const selected = resolveVariationComponentRate({
  category: "material",
  componentUnit: "",
  canonicalKey: BRACELINE_KEY,
  companyRates: [],
});
check("selection can populate the local component from the canonical sheet", selected.ok === true && selected.ok && selected.label.toLowerCase().includes("braceline") && selected.unit === "each" && selected.effectiveCost > 0 && (selected.source === "quotr_benchmark" || selected.source === "company_rate"));
check("selection populates description, unit, cost and key without the parent description", applied.includes("description: patch.description") && applied.includes("unit: patch.unit") && applied.includes("unitCost: patch.unitCost") && applied.includes("canonicalRateKey: patch.canonicalRateKey") && !applied.includes("setDescription"));
check("component quantity remains user-controlled", !applied.includes("quantity") && editor.includes("label=\"Component quantity\""));
check("save component creates one local component", saveComponent.includes("props.onChange") && saveComponent.includes("[...props.rows, draft]") && !saveComponent.includes("saveDraft") && !saveComponent.includes("snapshot_"));
check("cancel component creates none", cancelComponent.includes("setDraft(null)") && !cancelComponent.includes("props.onChange") && !cancelComponent.includes("rpc"));
check("failed search preserves entered data", searchRates.includes("setRateError(result.error)") && !searchRates.includes("setDescription") && !searchRates.includes("setComponents") && !searchRates.includes("setDraft(null)"));
const labour = listEligibleVariationRates({ category: "labour", componentUnit: "", companyRates: [], query: "carpenter" });
const carpenter = labour.rates.find((rate) => rate.canonicalKey === LABOUR_KEY);
check("labour search returns hourly COST only", Boolean(carpenter) && carpenter?.unit === "hour" && carpenter?.rateType === "labour" && labour.rates.every((rate) => rate.rateType === "labour" && rate.unit === "hour"));
const productivity = resolveVariationComponentRate({ category: "labour", componentUnit: "hour", canonicalKey: PRODUCTIVITY_KEY, companyRates: [] });
check("productivity rates remain excluded", productivity.ok === false && productivity.ok === false && productivity.error === "PRODUCTIVITY_REJECTED" && !labour.rates.some((rate) => rate.canonicalKey === PRODUCTIVITY_KEY));
check("manual entry remains available", editor.includes("Enter manually") && editor.includes("Change rate") && editor.includes("Cancel component"));
check("empty, loading and error states stay in the combobox", picker.includes("Start typing to search Rates.") && picker.includes("Loading rates…") && picker.includes("No matching rates.") && picker.includes("role=\"alert\"") && editor.includes("No compatible saved rates are available for this category. Enter the cost manually.") && picker.includes("filterVariationRateOptions") && searchRates.includes("catalogue: true") && !picker.includes("searchVariationComponentRates"));
check("client payload remains confidential", !clientMap.includes("unitCost") && !clientMap.includes("costSource") && !clientMap.includes("canonicalRateKey"));
check("search uses the signed-in organisation and rejects signed-out callers", searchAction.includes("getAuthOrgContext()") && searchAction.includes("NOT_AUTHENTICATED") && searchAction.includes("loadOrganisationRates(context.orgId)"));

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
check("built client document has no internal rate source", documentJson.includes("Client facing stair") && !documentJson.includes("Braceline") && !documentJson.includes("company_rate") && !documentJson.includes("unitCost"));

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
  const emailA = `hello+variations-02r42.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-02r42b.${stamp}@erccontracting.co.nz`;
  const password = `Var02R42-${stamp}-Aa!`;
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
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 02R42" });
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
      { id: orgA, name: `Variations 02R42 ${stamp}` },
      { id: orgB, name: `Variations 02R42 other ${stamp}` },
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
      id: projectA, org_id: orgA, created_by: userIds[0], title: `Live search ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready",
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
      p_project: projectA, p_title: "Live search", p_summary: "Rates", p_idempotency_key: `r42-${stamp}`,
    });
    const built = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item_id: null, p_confirm: false,
      p_item: {
        itemType: "addition", clientDescription: "Client facing stair", quantity: 1, unit: "each",
        workAreaId: null, snapshotLineId: null, sortOrder: 1, substitutionGroupId: null,
        sellProvenance: "calculated", targetMarginPercent: 10, manualSellTotal: null,
      },
      p_components: [{ category: "material", description: "Braceline plasterboard sheet", quantity: 2, unit: "each", unitCost: 12, sortOrder: 0 }],
    });
    const issued = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    const issuedWrite = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item: built.itemId, p_component: built.componentIds?.[0],
      p_canonical_key: BRACELINE_KEY, p_rate_type: "material", p_benchmark_cost: 1, p_benchmark_label: "Late", p_benchmark_unit: "each", p_allow_benchmark: true,
    });
    const stored = await admin.from("variation_items").select("client_description").eq("id", built.itemId ?? "").maybeSingle();
    const component = await admin.from("variation_item_cost_components").select("unit_cost, cost_source, description").eq("id", built.componentIds?.[0] ?? "").maybeSingle();
    check("issued writes remain rejected", issued.ok === true && issuedWrite.ok === false && issuedWrite.error === "IMMUTABLE" && stored.data?.client_description === "Client facing stair" && Number(component.data?.unit_cost) === 12, issued.error ?? issuedWrite.error);
    const foreign = await call(userB, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item: built.itemId, p_component: built.componentIds?.[0],
      p_canonical_key: BRACELINE_KEY, p_rate_type: "material", p_benchmark_cost: 99, p_benchmark_label: "Foreign", p_benchmark_unit: "each", p_allow_benchmark: true,
    });
    const signedOutResult = await call(signedOut, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item: built.itemId, p_component: built.componentIds?.[0],
      p_canonical_key: BRACELINE_KEY, p_rate_type: "material", p_benchmark_cost: 99, p_benchmark_label: "Anon", p_benchmark_unit: "each", p_allow_benchmark: true,
    });
    const after = await admin.from("variation_item_cost_components").select("unit_cost, source_label").eq("id", built.componentIds?.[0] ?? "").maybeSingle();
    check("cross-tenant and signed-out access fail", foreign.ok === false && signedOutResult.ok !== true && Number(after.data?.unit_cost) === 12 && after.data?.source_label !== "Foreign" && after.data?.source_label !== "Anon", foreign.error ?? signedOutResult.error);
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
