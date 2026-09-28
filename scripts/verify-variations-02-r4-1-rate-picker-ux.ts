/**
 * VARIATIONS-02-R4.1 — rate picker and Add item UX.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-r4-1-rate-picker-ux.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { componentLineCost } from "../lib/variations/domain";
import { buildVariationDocument } from "../lib/variations/presentation";
import {
  listEligibleVariationRates,
  resolveVariationComponentRate,
  variationRateUnitIsOpen,
  type VariationCompanyRate,
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

function money(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
const saveComponent = between(editor, "function saveComponent()", "function cancelComponent()");
const cancelComponent = between(editor, "function cancelComponent()", "const rateLocked");
const applied = between(editor, "onApplied={(patch) => {", "}}");
const clientMap = between(domain, "items: revision.items.map((item) => ({", "})),");

console.log("\nPicker visibility and search");
check("Select from Rates exposes the picker without a saved component id", editor.includes("Select from Rates") && editor.includes("<VariationRatePicker") && editor.includes("setPickerOpen(true)") && !editor.includes("Save this item, then select a rate."));
check("picker fills an unsaved component from a loaded option", picker.includes("props.onApplied") && picker.includes("rate.canonicalKey") && !picker.includes("describeVariationComponentRate") && !picker.includes("selectVariationComponentRate") && !picker.includes("componentId"));
check("blank and generic units stay open", variationRateUnitIsOpen("") && variationRateUnitIsOpen("item") && variationRateUnitIsOpen("unit") && !variationRateUnitIsOpen("m2") && !variationRateUnitIsOpen("lm"));

const materialQueries = ["braceline", "braceline 13", "2400 1200", "13mm braceline"];
for (const query of materialQueries) {
  const listed = listEligibleVariationRates({ category: "material", componentUnit: "item", companyRates: [], query });
  const hit = listed.rates.find((rate) => rate.canonicalKey === BRACELINE_KEY);
  check(
    `material search “${query}” finds Braceline 13 mm 2400 × 1200`,
    Boolean(hit) && hit?.unit === "each" && (hit?.detail ?? "").includes("13 mm") && (hit?.detail ?? "").includes("2400"),
    hit ? `${hit.canonicalKey} ${hit.detail ?? ""}` : listed.rates.slice(0, 5).map((rate) => rate.label).join(" | ")
  );
}

const selected = resolveVariationComponentRate({
  category: "material",
  componentUnit: "item",
  canonicalKey: BRACELINE_KEY,
  companyRates: [],
});
check(
  "selecting Braceline adopts label, unit, cost and source",
  selected.ok === true && selected.ok && selected.canonicalKey === BRACELINE_KEY && selected.unit === "each" && selected.effectiveCost > 0 && selected.source === "quotr_benchmark" && selected.label.toLowerCase().includes("braceline"),
  selected.ok ? `${selected.label} ${selected.unit} ${selected.effectiveCost}` : selected.error
);
const benchmarkCost = selected.ok ? selected.effectiveCost : 0;
const company: VariationCompanyRate = {
  id: "company-braceline",
  item_key: BRACELINE_KEY,
  rate_type: "material",
  label: "Company Braceline sheet",
  unit: "each",
  cost_rate: 31.25,
  active: true,
};
const companyWin = resolveVariationComponentRate({
  category: "material",
  componentUnit: "",
  canonicalKey: BRACELINE_KEY,
  companyRates: [company],
});
check("valid Company Rate wins", companyWin.ok === true && companyWin.ok && companyWin.source === "company_rate" && companyWin.effectiveCost === 31.25 && companyWin.rateId === "company-braceline" && companyWin.badge === "Company Rate");
const invalidCompany = resolveVariationComponentRate({
  category: "material",
  componentUnit: "each",
  canonicalKey: BRACELINE_KEY,
  companyRates: [{ ...company, id: "bad", cost_rate: 0, label: "Zero Braceline" }],
});
check("invalid Company Rate falls back to Quotr", invalidCompany.ok === true && invalidCompany.ok && invalidCompany.source === "quotr_benchmark" && invalidCompany.effectiveCost === benchmarkCost && invalidCompany.badge === "Quotr benchmark");

const labourSearch = listEligibleVariationRates({ category: "labour", componentUnit: "item", companyRates: [], query: "carpenter" });
const carpenter = labourSearch.rates.find((rate) => rate.canonicalKey === LABOUR_KEY);
check("labour search finds carpenter hourly COST", Boolean(carpenter) && carpenter?.unit === "hour" && carpenter?.rateType === "labour" && (carpenter?.effectiveCost ?? 0) > 0, carpenter ? `${carpenter.label} ${carpenter.unit}` : "missing");
const hourly = resolveVariationComponentRate({
  category: "labour",
  componentUnit: "hours",
  canonicalKey: LABOUR_KEY,
  companyRates: [{ id: "lab", item_key: LABOUR_KEY, rate_type: "labour", label: "Carpenter", unit: "hour", cost_rate: 65, active: true }],
});
const twelve = hourly.ok ? componentLineCost(12, hourly.effectiveCost) : null;
check("twelve hours uses 12 × hourly COST", hourly.ok === true && hourly.ok && hourly.effectiveCost === 65 && twelve === 780, String(twelve));
const productivityListed = listEligibleVariationRates({ category: "labour", componentUnit: "", companyRates: [], query: "deck" });
const productivityResolved = resolveVariationComponentRate({
  category: "labour",
  componentUnit: "hour",
  canonicalKey: PRODUCTIVITY_KEY,
  companyRates: [],
});
check("productivity is not applied again", !productivityListed.rates.some((rate) => rate.canonicalKey === PRODUCTIVITY_KEY) && productivityResolved.ok === false && productivityResolved.ok === false && productivityResolved.error === "PRODUCTIVITY_REJECTED");
const openList = listEligibleVariationRates({ category: "material", componentUnit: "item", companyRates: [], query: "braceline" });
check("generic component unit does not hide results", openList.rates.length > 0 && openList.rates.some((rate) => rate.canonicalKey === BRACELINE_KEY));
const wrongUnit = resolveVariationComponentRate({
  category: "material",
  componentUnit: "lm",
  canonicalKey: BRACELINE_KEY,
  companyRates: [company],
});
check("incompatible unit selection is rejected", wrongUnit.ok === false && wrongUnit.ok === false && wrongUnit.error === "WRONG_UNIT");

console.log("\nEditor behaviour");
check("manual mode remains available", editor.includes("Enter manually") && editor.includes("Internal COST per unit") && editor.includes("Component quantity"));
check("manual override clears the rate-source claim", editor.includes("canonicalRateKey: null") && editor.includes("clearRate: true") && editor.includes("costSource: value.trim() === \"\" ? \"missing\" : \"manual\"") && actions.includes("set_draft_variation_component_manual_cost_v1"));
check("missing manual cost stays Pricing required", componentLineCost(2, null) == null && editor.includes("VARIATION_PRICING_REQUIRED_LABEL") && editor.includes("value.trim() === \"\" ? \"missing\"") && !editor.includes("unitCost: 0"));
check("empty and error states are visible", picker.includes("Loading rates…") && picker.includes("Start typing to search Rates.") && picker.includes("No matching rates.") && picker.includes("role=\"alert\"") && editor.includes("No compatible saved rates are available for this category. Enter the cost manually.") && actions.includes("That rate is no longer available. Choose another rate or enter the cost manually."));
check("component save and cancel do not create partial rows", saveComponent.includes("props.onChange") && !saveComponent.includes("saveDraft") && !saveComponent.includes("snapshot_") && cancelComponent.includes("setDraft(null)") && !cancelComponent.includes("props.onChange") && !cancelComponent.includes("rpc"));
check("parent client description is not replaced by the internal rate label", applied.includes("description: patch.description") && !applied.includes("setDescription") && editor.includes("htmlFor=\"item-description\"") === false && editor.includes("label=\"Client-facing description\""));
check("client payload contains no COST or source information", !clientMap.includes("unitCost") && !clientMap.includes("costSource") && !clientMap.includes("components") && !clientMap.includes("canonicalRateKey"));
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
check("built client document keeps the client description only", documentJson.includes("Client facing stair") && !documentJson.includes("Braceline") && !documentJson.includes("company_rate") && !documentJson.includes("unitCost"));
check("dialog sections and sticky actions", editor.includes("Scope change") && editor.includes("Cost build-up") && editor.includes("No cost components yet") && editor.includes("Add cost component") && editor.includes("Add item") && editor.includes("overflow-y-auto") && editor.includes("shrink-0 border-t"));
check("save re-resolves a selected rate instead of trusting the client cost", actions.includes("resolveVariationComponentRate") && actions.includes("snapshot_draft_variation_component_rate_v1") && actions.includes("unit: resolved.unit") && actions.includes("unitCost: resolved.effectiveCost"));

type Db = SupabaseClient;
type Rpc = { ok?: boolean; error?: string; variationId?: string; revisionId?: string; itemId?: string; componentIds?: string[]; unitCost?: number | null };

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
  const emailA = `hello+variations-02r41.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-02r41b.${stamp}@erccontracting.co.nz`;
  const password = `Var02R41-${stamp}-Aa!`;
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
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 02R41" });
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
      { id: orgA, name: `Variations 02R41 ${stamp}` },
      { id: orgB, name: `Variations 02R41 other ${stamp}` },
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
      id: projectA, org_id: orgA, created_by: userIds[0], title: `Picker ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready",
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

    const companyRate = await admin.from("rates").insert({
      org_id: orgA, rate_type: "material", item_key: BRACELINE_KEY, label: "Company Braceline sheet",
      unit: "each", cost_rate: 31.25, active: true, source: "explicit_company",
    }).select("id").single();
    if (companyRate.error || !companyRate.data) throw new Error(companyRate.error?.message ?? "company rate");

    const draft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Picker", p_summary: "Rates", p_idempotency_key: `r41-${stamp}`,
    });
    const built = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item_id: null,
      p_item: {
        itemType: "addition",
        clientDescription: "Client facing stair",
        quantity: 1,
        unit: "each",
        workAreaId: null,
        snapshotLineId: null,
        sortOrder: 1,
        substitutionGroupId: null,
        sellProvenance: "calculated",
        targetMarginPercent: 10,
        manualSellTotal: null,
      },
      p_components: [
        { category: "material", description: "Braceline plasterboard sheet", quantity: 2, unit: "each", unitCost: 1, sortOrder: 0 },
      ],
      p_confirm: false,
    });
    const componentId = built.componentIds?.[0];
    const snapshot = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: componentId,
      p_canonical_key: BRACELINE_KEY,
      p_rate_type: "material",
      p_benchmark_cost: 1,
      p_benchmark_label: "Client supplied label",
      p_benchmark_unit: "each",
      p_allow_benchmark: true,
    });
    const stored = await admin.from("variation_item_cost_components").select("unit_cost, cost_source, canonical_rate_key, source_label, source_record_id, description").eq("id", componentId ?? "").maybeSingle();
    const parent = await admin.from("variation_items").select("client_description").eq("id", built.itemId ?? "").maybeSingle();
    check(
      "hosted selection stores Company Rate and leaves the client description",
      snapshot.ok === true && money(stored.data?.unit_cost) === 31.25 && stored.data?.cost_source === "company_rate" && stored.data?.canonical_rate_key === BRACELINE_KEY && stored.data?.source_record_id === companyRate.data.id && parent.data?.client_description === "Client facing stair",
      snapshot.error ?? String(stored.data?.unit_cost)
    );
    const preview = await call(userA, "refresh_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: componentId,
      p_confirm: false,
      p_benchmark_cost: benchmarkCost,
      p_benchmark_label: "Braceline plasterboard sheet",
      p_benchmark_unit: "each",
      p_rate_type: "material",
    });
    const duringPreview = await admin.from("variation_item_cost_components").select("unit_cost, cost_source").eq("id", componentId ?? "").maybeSingle();
    check("refresh preview does not change the stored snapshot", preview.ok === true && money(duringPreview.data?.unit_cost) === 31.25 && duringPreview.data?.cost_source === "company_rate", preview.error);
    await admin.from("rates").update({ cost_rate: 40 }).eq("id", companyRate.data.id);
    const confirmed = await call(userA, "refresh_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: componentId,
      p_confirm: true,
      p_benchmark_cost: benchmarkCost,
      p_benchmark_label: "Braceline plasterboard sheet",
      p_benchmark_unit: "each",
      p_rate_type: "material",
    });
    const afterRefresh = await admin.from("variation_item_cost_components").select("unit_cost").eq("id", componentId ?? "").maybeSingle();
    check("confirmed refresh updates only the draft component", confirmed.ok === true && money(afterRefresh.data?.unit_cost) === 40, confirmed.error ?? String(afterRefresh.data?.unit_cost));
    const manual = await call(userA, "set_draft_variation_component_manual_cost_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: componentId,
      p_unit_cost: 40,
    });
    const afterManual = await admin.from("variation_item_cost_components").select("cost_source, canonical_rate_key, source_record_id").eq("id", componentId ?? "").maybeSingle();
    check("hosted manual override clears the rate claim without changing the catalogue", manual.ok === true && afterManual.data?.cost_source === "manual" && afterManual.data?.canonical_rate_key == null && afterManual.data?.source_record_id == null);
    const catalogue = await admin.from("rates").select("cost_rate").eq("id", companyRate.data.id).maybeSingle();
    check("manual override does not update Company Rates", money(catalogue.data?.cost_rate) === 40);
    const restored = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: componentId,
      p_canonical_key: BRACELINE_KEY,
      p_rate_type: "material",
      p_benchmark_cost: benchmarkCost,
      p_benchmark_label: "Braceline plasterboard sheet",
      p_benchmark_unit: "each",
      p_allow_benchmark: true,
    });
    check("rate can be selected again after manual entry", restored.ok === true, restored.error);
    const issued = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    const issuedRefresh = await call(userA, "refresh_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: componentId,
      p_confirm: true,
      p_benchmark_cost: benchmarkCost,
      p_benchmark_label: "Braceline plasterboard sheet",
      p_benchmark_unit: "each",
      p_rate_type: "material",
    });
    const issuedRow = await admin.from("variation_item_cost_components").select("unit_cost").eq("id", componentId ?? "").maybeSingle();
    check("issued revisions remain immutable", issued.ok === true && issuedRefresh.ok === false && issuedRefresh.error === "IMMUTABLE" && money(issuedRow.data?.unit_cost) === 40, issued.error ?? issuedRefresh.error);
    const foreign = await call(userB, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: componentId,
      p_canonical_key: BRACELINE_KEY,
      p_rate_type: "material",
      p_benchmark_cost: 1,
      p_benchmark_label: "Foreign",
      p_benchmark_unit: "each",
      p_allow_benchmark: true,
    });
    const signedOutResult = await call(signedOut, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: componentId,
      p_canonical_key: BRACELINE_KEY,
      p_rate_type: "material",
      p_benchmark_cost: 1,
      p_benchmark_label: "Anon",
      p_benchmark_unit: "each",
      p_allow_benchmark: true,
    });
    const afterDenied = await admin.from("variation_item_cost_components").select("unit_cost, source_label").eq("id", componentId ?? "").maybeSingle();
    check(
      "cross-tenant and signed-out access fail",
      foreign.ok === false && signedOutResult.ok !== true && money(afterDenied.data?.unit_cost) === 40 && afterDenied.data?.source_label !== "Foreign" && afterDenied.data?.source_label !== "Anon",
      foreign.error ?? signedOutResult.error
    );
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
