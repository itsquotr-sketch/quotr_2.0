/**
 * VARIATIONS-02-R4.3 — rate result layout and picker latency.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-r4-3-picker-layout-performance.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { buildVariationDocument } from "../lib/variations/presentation";
import { filterVariationRateOptions, variationRateHeading, variationRateRank } from "../lib/variations/rate-query";
import {
  CATEGORY_CATALOGUE_LIMIT,
  listEligibleVariationRates,
  resolveVariationComponentRate,
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

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return from >= 0 && to > from ? source.slice(from, to) : "";
}

const picker = read("components/variations/VariationRatePicker.tsx");
const editor = read("components/variations/VariationEditor.tsx");
const actions = read("lib/variations/actions.ts");
const domain = read("lib/variations/domain.ts");
const option = between(picker, "role=\"option\"", "onMouseEnter");
const searchRates = between(editor, "async function searchRates", "function saveComponent");
const applied = between(editor, "onApplied={(patch) => {", "}}");
const saveBuildUp = between(actions, "export async function saveDraftVariationBuildUp", "const { data: rpcData, error }");
const clientMap = between(domain, "items: revision.items.map((item) => ({", "})),");

console.log("\nResult rows");
check("each result is a multi-line row", option.includes("flex-col") && option.includes("leading-5") && option.includes("whitespace-normal") && option.includes("py-2.5"));
check("results are distinct options", picker.includes("role=\"listbox\"") && picker.includes("role=\"option\"") && picker.includes("type=\"button\"") && !picker.includes("<form") && !picker.includes("type=\"submit\""));
check("result rows do not use a fixed single-line height", option.includes("h-auto") && !option.includes("h-11") && !option.includes("min-h-11") && !option.includes("h-8") && !option.includes("h-9"));
check("each option shows label, context, unit COST and source", picker.includes("resultHeading(rate)") && picker.includes("resultContext(rate)") && picker.includes("rate.effectiveCost") && picker.includes("displayUnit(rate.unit)") && picker.includes("variationRateSourceText(rate)"));

type Sample = {
  canonicalKey: string;
  label: string;
  searchText: string;
  familyName: string | null;
  thickness: string | null;
  sheetSize: string | null;
  detail: string | null;
  source: "company_rate" | "quotr_benchmark";
  derived: boolean;
};

const samples: Sample[] = [
  { canonicalKey: "partial", label: "Other board", searchText: "braceline 13 leftover", familyName: null, thickness: null, sheetSize: null, detail: null, source: "quotr_benchmark", derived: true },
  { canonicalKey: "sheet", label: "13 mm Braceline", searchText: "braceline 13 mm 2400", familyName: "GIB Braceline", thickness: "13 mm", sheetSize: "2400 × 1200", detail: "13 mm", source: "quotr_benchmark", derived: false },
  { canonicalKey: "sheet", label: "13 mm Braceline duplicate", searchText: "braceline 13 mm 2400", familyName: "GIB Braceline", thickness: "13 mm", sheetSize: "2400 × 1200", detail: "13 mm", source: "company_rate", derived: false },
  { canonicalKey: "company", label: "13 mm Braceline company", searchText: "braceline 13 mm 2700", familyName: "GIB Braceline", thickness: "13 mm", sheetSize: "2700 × 1200", detail: "13 mm", source: "company_rate", derived: false },
  { canonicalKey: "direct", label: "13 mm Braceline direct", searchText: "braceline 13 mm 2700", familyName: "GIB Braceline", thickness: "13 mm", sheetSize: "2700 × 1200", detail: "13 mm", source: "quotr_benchmark", derived: false },
  { canonicalKey: "derived", label: "13 mm Braceline derived", searchText: "braceline 13 mm 2700", familyName: "GIB Braceline", thickness: "13 mm", sheetSize: "2700 × 1200", detail: "13 mm", source: "quotr_benchmark", derived: true },
];
const ranked = filterVariationRateOptions(samples, "13 mm braceline");
const rankedAgain = filterVariationRateOptions(samples, "13 mm braceline");
check("duplicate canonical identities are removed", ranked.filter((rate) => rate.canonicalKey === "sheet").length === 1 && new Set(ranked.map((rate) => rate.canonicalKey)).size === ranked.length);
check(
  "ranking is deterministic",
  ranked.map((rate) => rate.canonicalKey).join(",") === rankedAgain.map((rate) => rate.canonicalKey).join(",") &&
    ranked.map((rate) => rate.canonicalKey).join(",") === "company,sheet,direct,derived,partial" &&
    variationRateRank(samples[3]!, "13 mm braceline") > variationRateRank(samples[4]!, "13 mm braceline") &&
    variationRateRank(samples[4]!, "13 mm braceline") > variationRateRank(samples[5]!, "13 mm braceline") &&
    variationRateRank(samples[5]!, "13 mm braceline") > variationRateRank(samples[0]!, "13 mm braceline"),
  ranked.map((rate) => rate.canonicalKey).join(",")
);

console.log("\nCatalogue load and local filter");
const catalogue = listEligibleVariationRates({
  category: "material",
  componentUnit: "",
  companyRates: [],
  limit: CATEGORY_CATALOGUE_LIMIT,
});
const filtered = filterVariationRateOptions(catalogue.rates, "braceline");
const narrowed = filterVariationRateOptions(catalogue.rates, "braceline 13");
const sheet = filtered.find((rate) => rate.canonicalKey === BRACELINE_KEY);
const keys = catalogue.rates.map((rate) => rate.canonicalKey);
check("initial catalogue loading is category-scoped", searchRates.includes("catalogue: true") && searchRates.includes("category") && editor.includes("rememberRateCatalogue") && !picker.includes("searchVariationComponentRates"));
check("typing after load does not call the server per keystroke", picker.includes("filterVariationRateOptions") && !picker.includes("window.setTimeout") && !picker.includes("onSearch") && !searchRates.includes("query"));
check("selection populates local state immediately", picker.includes("props.onApplied") && !picker.includes("describeVariationComponentRate") && !picker.includes("await"));
check("loaded Braceline results stay distinct and readable", Boolean(sheet) && variationRateHeading(sheet!).includes("13 mm") && variationRateHeading(sheet!).includes("Braceline") && (sheet?.sheetSize ?? "").includes("2400") && sheet?.familyName === "GIB Braceline" && sheet?.unit === "each" && filtered.length > 0 && narrowed.length > 0 && narrowed.length <= filtered.length && new Set(keys).size === keys.length, sheet ? variationRateHeading(sheet) : "missing");

console.log("\nAuthority");
const company: VariationCompanyRate = {
  id: "company-braceline",
  item_key: BRACELINE_KEY,
  rate_type: "material",
  label: "Company Braceline sheet",
  unit: "each",
  cost_rate: 31.25,
  active: true,
};
const won = resolveVariationComponentRate({ category: "material", componentUnit: "", canonicalKey: BRACELINE_KEY, companyRates: [company] });
const wrongUnit = resolveVariationComponentRate({ category: "material", componentUnit: "m2", canonicalKey: BRACELINE_KEY, companyRates: [] });
const productivity = resolveVariationComponentRate({ category: "labour", componentUnit: "hour", canonicalKey: PRODUCTIVITY_KEY, companyRates: [] });
const labour = listEligibleVariationRates({ category: "labour", componentUnit: "", companyRates: [], query: "carpenter" });
check("save still re-resolves server-side", saveBuildUp.includes("resolveVariationComponentRate") && saveBuildUp.includes("unitCost: resolved.effectiveCost"));
check("stale or altered client COST is not trusted", saveBuildUp.includes("unitCost: resolved.effectiveCost") && saveBuildUp.includes("unit: resolved.unit"));
check("Company Rate precedence remains unchanged", won.ok === true && won.ok && won.source === "company_rate" && won.effectiveCost === 31.25 && won.rateId === "company-braceline");
check("unit safety remains unchanged", wrongUnit.ok === false && wrongUnit.ok === false && wrongUnit.error === "WRONG_UNIT" && productivity.ok === false && productivity.ok === false && productivity.error === "PRODUCTIVITY_REJECTED" && labour.rates.every((rate) => rate.unit === "hour" && rate.rateType === "labour") && labour.rates.some((rate) => rate.canonicalKey === LABOUR_KEY));
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
check("modal remains open on selection", applied.includes("setPickerOpen(false)") && !applied.includes("props.onClose") && !applied.includes("props.onSave") && !applied.includes("router") && applied.includes("description: patch.description") && !applied.includes("setDescription"));
check("existing error and empty states remain", picker.includes("Start typing to search Rates.") && picker.includes("Loading rates…") && picker.includes("No matching rates.") && picker.includes("role=\"alert\"") && editor.includes("No compatible saved rates are available for this category. Enter the cost manually.") && searchRates.includes("setRateError(result.error)") && !searchRates.includes("setDraft(null)"));
check("search stays on the signed-in organisation", actions.includes("loadOrganisationRates(context.orgId)") && actions.includes("NOT_AUTHENTICATED"));

type Db = SupabaseClient;

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
  const emailA = `hello+variations-02r43.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-02r43b.${stamp}@erccontracting.co.nz`;
  const password = `Var02R43-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(emailA);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(emailA) && !isPasswordProtectedPreviewAccount(emailB));
  const orgA = randomUUID();
  const orgB = randomUUID();
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
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 02R43" });
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
      { id: orgA, name: `Variations 02R43 ${stamp}` },
      { id: orgB, name: `Variations 02R43 other ${stamp}` },
    ]);
    if (orgs.error) throw new Error(orgs.error.message);
    const userA = await userFor(emailA, orgA);
    const userB = await userFor(emailB, orgB);
    const companyRate = await admin.from("rates").insert({
      org_id: orgA, rate_type: "material", item_key: BRACELINE_KEY, label: "Company Braceline sheet",
      unit: "each", cost_rate: 31.25, active: true, source: "explicit_company",
    }).select("id").single();
    if (companyRate.error || !companyRate.data) throw new Error(companyRate.error?.message ?? "company rate");
    const own = await userA.from("rates").select("id, cost_rate").eq("id", companyRate.data.id).maybeSingle();
    const foreign = await userB.from("rates").select("id, cost_rate").eq("id", companyRate.data.id).maybeSingle();
    const signedOut = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const anonRead = await signedOut.from("rates").select("id").eq("id", companyRate.data.id).maybeSingle();
    check(
      "cross-tenant and signed-out access fail",
      own.data?.id === companyRate.data.id && Number(own.data?.cost_rate) === 31.25 && foreign.data == null && anonRead.data == null,
      foreign.error ?? anonRead.error?.message ?? "row leaked"
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
