/**
 * VARIATIONS-02-R4 — rate-backed cost components.
 *
 * Run: npx --yes tsx scripts/verify-variations-02-r4-rate-backed-components.ts
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { buildVariationDocument } from "../lib/variations/presentation";
import {
  resolveVariationComponentRate,
  type VariationCompanyRate,
} from "../lib/variations/rate-selection";
import { cleanupPreviewFixtureOrgs, registerPreviewFixtureOrg } from "./lib/preview-admin-cleanup";
import { assertSafePreviewPasswordMutation, isPasswordProtectedPreviewAccount } from "./lib/preview-auth-fixture";

const root = join(__dirname, "..");
const MATERIAL_KEY = "retaining_wall.timber.face_board.200x50.h4";
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

function rate(overrides: Partial<VariationCompanyRate> & Pick<VariationCompanyRate, "id" | "cost_rate" | "active" | "unit">): VariationCompanyRate {
  return {
    item_key: MATERIAL_KEY,
    rate_type: "material",
    label: "Company face board",
    ...overrides,
  };
}

const material = getCatalogueEntry(MATERIAL_KEY);
const labour = getCatalogueEntry(LABOUR_KEY);
const productivity = getCatalogueEntry(PRODUCTIVITY_KEY);
const company: VariationCompanyRate = rate({ id: "company-1", cost_rate: 22.5, active: true, unit: "lm" });

console.log("\nResolver authority");
const selected = resolveVariationComponentRate({
  category: "material",
  componentUnit: "lm",
  canonicalKey: MATERIAL_KEY,
  companyRates: [company],
});
check(
  "Company Material Rate selected",
  selected.ok === true && selected.ok && selected.source === "company_rate" && selected.effectiveCost === 22.5 && selected.rateId === "company-1",
  selected.ok ? "" : selected.error
);
const benchmarkFallback = resolveVariationComponentRate({
  category: "material",
  componentUnit: "lm",
  canonicalKey: MATERIAL_KEY,
  companyRates: [rate({ id: "bad", cost_rate: 0, active: true, unit: "lm" })],
});
check(
  "Quotr material benchmark fallback",
  benchmarkFallback.ok === true && benchmarkFallback.ok && benchmarkFallback.source === "quotr_benchmark" && benchmarkFallback.effectiveCost === material?.defaultCostRate,
  benchmarkFallback.ok ? String(benchmarkFallback.effectiveCost) : benchmarkFallback.error
);
const invalid = resolveVariationComponentRate({
  category: "material",
  componentUnit: "lm",
  canonicalKey: MATERIAL_KEY,
  companyRates: [rate({ id: "neg", cost_rate: -5, active: true, unit: "lm" })],
});
check("Invalid Company Rate ignored", invalid.ok === true && invalid.ok && invalid.source === "quotr_benchmark");
const inactive = resolveVariationComponentRate({
  category: "material",
  componentUnit: "lm",
  canonicalKey: MATERIAL_KEY,
  companyRates: [rate({ id: "off", cost_rate: 99, active: false, unit: "lm" })],
});
check("Inactive Company Rate ignored", inactive.ok === true && inactive.ok && inactive.source === "quotr_benchmark" && inactive.effectiveCost === material?.defaultCostRate);
const wrongUnit = resolveVariationComponentRate({
  category: "material",
  componentUnit: "lm",
  canonicalKey: MATERIAL_KEY,
  companyRates: [rate({ id: "sheet", cost_rate: 99, active: true, unit: "sheet" })],
});
check("Wrong-unit rate rejected", wrongUnit.ok === true && wrongUnit.ok && wrongUnit.source === "quotr_benchmark" && wrongUnit.effectiveCost !== 99);
const wrongComponent = resolveVariationComponentRate({
  category: "material",
  componentUnit: "m2",
  canonicalKey: MATERIAL_KEY,
  companyRates: [company],
});
check("Wrong component unit is not adopted", wrongComponent.ok === false && wrongComponent.ok === false && wrongComponent.error === "WRONG_UNIT");
const hourly = resolveVariationComponentRate({
  category: "labour",
  componentUnit: "hours",
  canonicalKey: LABOUR_KEY,
  companyRates: [{ id: "lab", item_key: LABOUR_KEY, rate_type: "labour", label: "Carpenter", unit: "hour", cost_rate: 65, active: true }],
});
check("Labour hourly COST selected", hourly.ok === true && hourly.ok && hourly.source === "company_rate" && hourly.effectiveCost === 65 && hourly.rateType === "labour");
const productivityResolved = resolveVariationComponentRate({
  category: "labour",
  componentUnit: "hours",
  canonicalKey: PRODUCTIVITY_KEY,
  companyRates: [{ id: "prod", item_key: PRODUCTIVITY_KEY, rate_type: "productivity", label: "Deck hours", unit: "m2", cost_rate: 0.45, active: true }],
});
check(
  "Labour productivity not used as hourly COST",
  productivity?.rate_type === "productivity" && productivityResolved.ok === false && productivityResolved.ok === false && productivityResolved.error === "PRODUCTIVITY_REJECTED"
);

const editor = read("components/variations/VariationEditor.tsx");
const documentView = read("components/variations/VariationDocument.tsx");
const migration = read("supabase/migrations/068_variation_component_rate_snapshots.sql");
const diff = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: root, encoding: "utf8" });
check("editor offers manual entry and rate selection", editor.includes("Enter cost manually") && editor.includes("Select from Rates") && editor.includes("Refresh rate") && editor.includes("Cost source"));
check("client document view has no rate source", !documentView.includes("Company Rate") && !documentView.includes("Quotr benchmark") && !documentView.includes("cost_source"));
check("migration 068 does not edit 063 to 067", migration.includes("cost_source") && !diff.includes("supabase/migrations/063_") && !diff.includes("supabase/migrations/064_") && !diff.includes("supabase/migrations/065_") && !diff.includes("supabase/migrations/066_") && !diff.includes("supabase/migrations/067_"));
check("catalogue identity is present", material?.defaultCostRate === 17.4 && labour?.defaultCostRate === 60 && labour?.unit === "hour");

type Db = SupabaseClient;
type Rpc = {
  ok?: boolean;
  error?: string;
  variationId?: string;
  revisionId?: string;
  itemId?: string;
  componentIds?: string[];
  applied?: boolean;
  changed?: boolean;
  currentCost?: number | null;
  proposedCost?: number | null;
  proposedSource?: string;
  unitCost?: number | null;
  costSource?: string;
};

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
  const emailA = `hello+variations-02r4.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-02r4b.${stamp}@erccontracting.co.nz`;
  const password = `Var02R4-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(emailA);
  check("hosted fixture is not a protected inbox", !isPasswordProtectedPreviewAccount(emailA) && !isPasswordProtectedPreviewAccount(emailB));
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
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
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 02R4" });
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
      { id: orgA, name: `Variations 02R4 ${stamp}` },
      { id: orgB, name: `Variations 02R4 other ${stamp}` },
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
      { id: projectA, org_id: orgA, created_by: userIds[0], title: `Rates ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectC, org_id: orgA, created_by: userIds[0], title: `Other ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
    ]);
    if (projects.error) throw new Error(projects.error.message);

    async function baseline(projectId: string): Promise<void> {
      const quoteId = randomUUID();
      const quote = await admin.from("quotes").insert({
        id: quoteId, org_id: orgA, project_id: projectId, created_by: userIds[0],
        title: "Accepted baseline", status: "draft", revision_number: 1,
        subtotal: 10000, gst_rate: 15, gst_amount: 1500, total_incl_gst: 11500,
      });
      if (quote.error) throw new Error(quote.error.message);
      const item = await admin.from("quote_items").insert({
        org_id: orgA, quote_id: quoteId, project_id: projectId, label: "Accepted work",
        description: "Accepted work", quantity: 1, unit: "ls", unit_price: 10000, total: 10000, sort_order: 1,
      });
      if (item.error) throw new Error(item.error.message);
      const accepted = await admin.from("quotes").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", quoteId);
      if (accepted.error) throw new Error(accepted.error.message);
    }
    await baseline(projectA);
    await baseline(projectC);

    async function call(client: Db, fn: string, args: Record<string, unknown>): Promise<Rpc> {
      const { data, error } = await client.rpc(fn, args);
      if (error) return { ok: false, error: error.message };
      return (data ?? { ok: false }) as Rpc;
    }

    const companyRate = await admin.from("rates").insert({
      org_id: orgA, rate_type: "material", item_key: MATERIAL_KEY, label: "Company face board",
      unit: "lm", cost_rate: 22.5, active: true, source: "explicit_company",
    }).select("id").single();
    if (companyRate.error || !companyRate.data) throw new Error(companyRate.error?.message ?? "company rate");
    const foreignRate = await admin.from("rates").insert({
      org_id: orgB, rate_type: "material", item_key: MATERIAL_KEY, label: "Foreign face board",
      unit: "lm", cost_rate: 99, active: true, source: "explicit_company",
    }).select("id").single();
    if (foreignRate.error) throw new Error(foreignRate.error.message);
    const labourRate = await admin.from("rates").insert({
      org_id: orgA, rate_type: "labour", item_key: LABOUR_KEY, label: "Carpenter",
      unit: "hour", cost_rate: 65, active: true, source: "explicit_company",
    });
    if (labourRate.error) throw new Error(labourRate.error.message);
    const productivityRate = await admin.from("rates").insert({
      org_id: orgA, rate_type: "productivity", item_key: PRODUCTIVITY_KEY, label: "Deck labour hours",
      unit: "m2", cost_rate: 0.45, active: true, source: "explicit_company",
    });
    if (productivityRate.error) throw new Error(productivityRate.error.message);

    const parent = {
      itemType: "addition",
      clientDescription: "Additional retaining timber",
      quantity: 10,
      unit: "lm",
      workAreaId: null,
      snapshotLineId: null,
      sortOrder: 1,
      substitutionGroupId: null,
      sellProvenance: "calculated",
      targetMarginPercent: 10,
      manualSellTotal: null,
    };
    const draft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Rate backed", p_summary: "Rates", p_idempotency_key: `r4-${stamp}`,
    });
    const built = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item_id: null,
      p_item: parent,
      p_components: [
        { category: "material", description: "Face boards", quantity: 10, unit: "lm", unitCost: null, sortOrder: 0 },
        { category: "material", description: "Sibling boards", quantity: 4, unit: "lm", unitCost: 11, sortOrder: 1 },
        { category: "labour", description: "Carpenter", quantity: 12, unit: "hours", unitCost: null, sortOrder: 2 },
      ],
      p_confirm: false,
    });
    const ids = built.componentIds ?? [];
    const materialId = ids[0];
    const siblingId = ids[1];
    const labourId = ids[2];
    check("draft components were created", built.ok === true && ids.length === 3, built.error);

    async function component(id: string | undefined) {
      const row = await admin.from("variation_item_cost_components").select("unit_cost, line_cost, cost_source, canonical_rate_key, source_label, source_unit, source_unit_cost, source_record_id, source_selected_at").eq("id", id ?? "").maybeSingle();
      return row.data;
    }

    const snapshot = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_canonical_key: MATERIAL_KEY,
      p_rate_type: "material",
      p_benchmark_cost: 1,
      p_benchmark_label: "Client supplied label",
      p_benchmark_unit: "lm",
      p_allow_benchmark: true,
    });
    const storedCompany = await component(materialId);
    check(
      "hosted Company Rate snapshot ignores the client cost and label",
      snapshot.ok === true && money(storedCompany?.unit_cost) === 22.5 && money(storedCompany?.line_cost) === 225 && storedCompany?.cost_source === "company_rate" && storedCompany?.source_label === "Company face board" && storedCompany?.source_record_id === companyRate.data.id && storedCompany?.canonical_rate_key === MATERIAL_KEY,
      snapshot.error
    );

    const changed = await admin.from("rates").update({ cost_rate: 30 }).eq("id", companyRate.data.id);
    if (changed.error) throw new Error(changed.error.message);
    const stillStored = await component(materialId);
    check("Later rate change does not silently change stored Draft", money(stillStored?.unit_cost) === 22.5 && stillStored?.cost_source === "company_rate");

    const preview = await call(userA, "refresh_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_confirm: false,
      p_benchmark_cost: material?.defaultCostRate,
      p_benchmark_label: material?.label,
      p_benchmark_unit: "lm",
      p_rate_type: "material",
    });
    const duringPreview = await component(materialId);
    check(
      "Refresh shows the proposed change before it is applied",
      preview.ok === true && preview.applied !== true && preview.changed === true && money(preview.currentCost) === 22.5 && money(preview.proposedCost) === 30 && money(duringPreview?.unit_cost) === 22.5,
      preview.error
    );
    const confirmed = await call(userA, "refresh_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_confirm: true,
      p_benchmark_cost: material?.defaultCostRate,
      p_benchmark_label: material?.label,
      p_benchmark_unit: "lm",
      p_rate_type: "material",
    });
    const refreshed = await component(materialId);
    const sibling = await component(siblingId);
    check(
      "Refresh changes only the targeted component",
      confirmed.ok === true && money(refreshed?.unit_cost) === 30 && money(refreshed?.line_cost) === 300 && money(sibling?.unit_cost) === 11 && sibling?.cost_source === "manual",
      confirmed.error
    );

    const zeroed = await admin.from("rates").update({ cost_rate: 0, unit: "lm", active: true }).eq("id", companyRate.data.id);
    if (zeroed.error) throw new Error(zeroed.error.message);
    const fallback = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: siblingId,
      p_canonical_key: MATERIAL_KEY,
      p_rate_type: "material",
      p_benchmark_cost: material?.defaultCostRate,
      p_benchmark_label: material?.label,
      p_benchmark_unit: "lm",
      p_allow_benchmark: true,
    });
    const fallbackRow = await component(siblingId);
    check(
      "hosted invalid Company Rate falls back to the Quotr benchmark",
      fallback.ok === true && fallbackRow?.cost_source === "quotr_benchmark" && money(fallbackRow?.unit_cost) === material?.defaultCostRate && fallbackRow?.source_record_id == null,
      fallback.error
    );

    const disabled = await admin.from("rates").update({ cost_rate: 40, active: false, unit: "lm" }).eq("id", companyRate.data.id);
    if (disabled.error) throw new Error(disabled.error.message);
    const inactiveWrite = await call(userA, "refresh_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_confirm: true,
      p_benchmark_cost: material?.defaultCostRate,
      p_benchmark_label: material?.label,
      p_benchmark_unit: "lm",
      p_rate_type: "material",
    });
    const inactiveRow = await component(materialId);
    check(
      "hosted inactive Company Rate falls back to the Quotr benchmark",
      inactiveWrite.ok === true && inactiveRow?.cost_source === "quotr_benchmark" && money(inactiveRow?.unit_cost) === material?.defaultCostRate,
      inactiveWrite.error
    );

    const wrong = await admin.from("rates").update({ cost_rate: 99, active: true, unit: "sheet" }).eq("id", companyRate.data.id);
    if (wrong.error) throw new Error(wrong.error.message);
    const wrongWrite = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_canonical_key: MATERIAL_KEY,
      p_rate_type: "material",
      p_benchmark_cost: 99,
      p_benchmark_label: "Wrong unit",
      p_benchmark_unit: "sheet",
      p_allow_benchmark: true,
    });
    const wrongRow = await component(materialId);
    check(
      "hosted wrong-unit Company Rate does not override the benchmark",
      wrongWrite.ok === false && wrongWrite.error === "INVALID_RATE" && wrongRow?.cost_source === "quotr_benchmark" && money(wrongRow?.unit_cost) === material?.defaultCostRate,
      wrongWrite.error ?? String(money(wrongRow?.unit_cost))
    );

    const labourWrite = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: labourId,
      p_canonical_key: LABOUR_KEY,
      p_rate_type: "labour",
      p_benchmark_cost: 0.45,
      p_benchmark_label: "Productivity",
      p_benchmark_unit: "m2",
      p_allow_benchmark: true,
    });
    const labourRow = await component(labourId);
    check(
      "hosted labour hourly COST is 12 hours times 65",
      labourWrite.ok === true && money(labourRow?.unit_cost) === 65 && money(labourRow?.line_cost) === 780 && labourRow?.cost_source === "company_rate",
      labourWrite.error ?? String(money(labourRow?.line_cost))
    );
    const productivityWrite = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: labourId,
      p_canonical_key: PRODUCTIVITY_KEY,
      p_rate_type: "productivity",
      p_benchmark_cost: 0.45,
      p_benchmark_label: "Deck labour hours",
      p_benchmark_unit: "m2",
      p_allow_benchmark: true,
    });
    const labourAfterProductivity = await component(labourId);
    check(
      "hosted labour productivity is rejected",
      productivityWrite.ok === false && productivityWrite.error === "PRODUCTIVITY_REJECTED" && money(labourAfterProductivity?.unit_cost) === 65,
      productivityWrite.error
    );

    const manual = await call(userA, "set_draft_variation_component_manual_cost_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_unit_cost: 18,
    });
    const manualRow = await component(materialId);
    check(
      "Manual override clears misleading provenance",
      manual.ok === true && manualRow?.cost_source === "manual" && money(manualRow?.unit_cost) === 18 && manualRow?.canonical_rate_key == null && manualRow?.source_record_id == null && manualRow?.source_label == null,
      manual.error
    );
    const blank = await call(userA, "set_draft_variation_component_manual_cost_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_unit_cost: null,
    });
    const blankRow = await component(materialId);
    const blankParent = await admin.from("variation_items").select("line_cost_adjustment").eq("id", built.itemId ?? "").maybeSingle();
    check(
      "Blank cost remains missing",
      blank.ok === true && blankRow?.cost_source === "missing" && blankRow?.unit_cost == null && money(blankRow?.unit_cost) !== 0 && blankParent.data?.line_cost_adjustment == null,
      blank.error
    );

    const restored = await admin.from("rates").update({ cost_rate: 22.5, active: true, unit: "lm" }).eq("id", companyRate.data.id);
    if (restored.error) throw new Error(restored.error.message);
    const restoredWrite = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_canonical_key: MATERIAL_KEY,
      p_rate_type: "material",
      p_benchmark_cost: null,
      p_benchmark_label: null,
      p_benchmark_unit: null,
      p_allow_benchmark: false,
    });
    check("Company Rate can be selected again", restoredWrite.ok === true && (await component(materialId))?.cost_source === "company_rate", restoredWrite.error);

    const omission = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item_id: null,
      p_item: { ...parent, itemType: "omission", clientDescription: "Remove timber", sortOrder: 2 },
      p_components: [{ category: "material", description: "Face boards", quantity: 2, unit: "lm", unitCost: null, sortOrder: 0 }],
      p_confirm: false,
    });
    const omissionComponent = omission.componentIds?.[0];
    const omissionRate = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: omission.itemId,
      p_component: omissionComponent,
      p_canonical_key: MATERIAL_KEY,
      p_rate_type: "material",
      p_benchmark_cost: null,
      p_benchmark_label: null,
      p_benchmark_unit: null,
      p_allow_benchmark: false,
    });
    const omissionPart = await component(omissionComponent);
    const omissionParent = await admin.from("variation_items").select("line_cost_adjustment, line_sell_adjustment_ex_gst").eq("id", omission.itemId ?? "").maybeSingle();
    check(
      "Omission sign remains correct",
      omissionRate.ok === true && money(omissionPart?.unit_cost) === 22.5 && (money(omissionPart?.line_cost) ?? 0) > 0 && (money(omissionParent.data?.line_cost_adjustment) ?? 0) < 0 && (money(omissionParent.data?.line_sell_adjustment_ex_gst) ?? 0) < 0,
      omissionRate.error
    );

    const issued = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    const issuedMaterial = await component(materialId);
    const rateAfterIssue = await admin.from("rates").update({ cost_rate: 80 }).eq("id", companyRate.data.id);
    if (rateAfterIssue.error) throw new Error(rateAfterIssue.error.message);
    const issuedRefresh = await call(userA, "refresh_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_confirm: true,
      p_benchmark_cost: material?.defaultCostRate,
      p_benchmark_label: material?.label,
      p_benchmark_unit: "lm",
      p_rate_type: "material",
    });
    const issuedStill = await component(materialId);
    check("Refresh requires Draft", issued.ok === true && issuedRefresh.ok === false && issuedRefresh.error === "IMMUTABLE", issuedRefresh.error);
    check("Issued component remains unchanged", money(issuedStill?.unit_cost) === money(issuedMaterial?.unit_cost) && issuedStill?.cost_source === issuedMaterial?.cost_source && money(issuedStill?.unit_cost) === 22.5);

    const document = buildVariationDocument({
      companyName: "ERC Contracting",
      clientName: "Client",
      projectTitle: "Rates",
      siteAddress: null,
      variationNumber: 1,
      revisionNumber: 1,
      issuedAt: new Date().toISOString(),
      status: "issued",
      title: "Rate backed",
      summary: "Rates",
      clientNotes: null,
      currency: "NZD",
      items: [{ itemType: "addition", clientDescription: "Additional retaining timber", lineSellAdjustmentExGst: 250, substitutionGroupId: null, sortOrder: 1, quantity: 10, unit: "lm" }],
      totals: { totalSellAdjustmentExGst: 250, gstAdjustment: 37.5, totalAdjustmentInclGst: 287.5 },
      baseline: { sellExGst: 10000, sellInclGst: 11500 },
      proposed: { revisedContractValueExGst: 10250, gst: 1537.5, revisedContractValueInclGst: 11787.5 },
    });
    const documentJson = JSON.stringify(document);
    check(
      "Client document excludes source and cost",
      !documentJson.includes("Company Rate") && !documentJson.includes("Quotr benchmark") && !documentJson.includes("cost_source") && !documentJson.includes("Company face board") && !documentJson.includes("22.5") && !documentJson.includes("unitCost")
    );

    const revised = await call(userA, "create_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    const copied = await admin.from("variation_item_cost_components").select("id, unit_cost, cost_source, canonical_rate_key, source_label, source_unit, source_unit_cost, item_id, category").eq("revision_id", revised.revisionId ?? "").eq("category", "material").order("sort_order");
    const copiedMaterial = (copied.data ?? []).find((row) => row.canonical_rate_key === MATERIAL_KEY && money(row.unit_cost) === 22.5);
    check(
      "New revision copies the snapshot",
      revised.ok === true && copiedMaterial != null && copiedMaterial.cost_source === "company_rate" && copiedMaterial.source_label === "Company face board" && money(copiedMaterial.source_unit_cost) === 22.5,
      revised.error
    );
    const bumped = await admin.from("rates").update({ cost_rate: 44, active: true, unit: "lm" }).eq("id", companyRate.data.id);
    if (bumped.error) throw new Error(bumped.error.message);
    const issuedAfterCopy = await component(materialId);
    const draftBeforeRefresh = copiedMaterial ? await component(copiedMaterial.id) : null;
    check("Issued revision stays unchanged after the later rate change", money(issuedAfterCopy?.unit_cost) === 22.5 && money(draftBeforeRefresh?.unit_cost) === 22.5);
    const draftRefresh = await call(userA, "refresh_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: revised.revisionId,
      p_item: copiedMaterial?.item_id,
      p_component: copiedMaterial?.id,
      p_confirm: true,
      p_benchmark_cost: material?.defaultCostRate,
      p_benchmark_label: material?.label,
      p_benchmark_unit: "lm",
      p_rate_type: "material",
    });
    const draftAfter = copiedMaterial ? await component(copiedMaterial.id) : null;
    const issuedAfterRefresh = await component(materialId);
    check(
      "New Draft can explicitly refresh it",
      draftRefresh.ok === true && money(draftAfter?.unit_cost) === 44 && money(issuedAfterRefresh?.unit_cost) === 22.5,
      draftRefresh.error
    );

    const otherDraft = await call(userA, "create_draft_variation_v1", {
      p_project: projectC, p_title: "Other project", p_summary: "Other", p_idempotency_key: `r4-other-${stamp}`,
    });
    const crossProject = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: otherDraft.variationId,
      p_revision: otherDraft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_canonical_key: MATERIAL_KEY,
      p_rate_type: "material",
      p_benchmark_cost: 99,
      p_benchmark_label: "Foreign",
      p_benchmark_unit: "lm",
      p_allow_benchmark: true,
    });
    check("Cross-project component rejected", crossProject.ok === false && (crossProject.error === "CROSS_PROJECT" || crossProject.error === "NOT_FOUND" || crossProject.error === "STALE_REVISION"), crossProject.error);
    const signedOutWrite = await call(signedOut, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: revised.revisionId,
      p_item: copiedMaterial?.item_id,
      p_component: copiedMaterial?.id,
      p_canonical_key: MATERIAL_KEY,
      p_rate_type: "material",
      p_benchmark_cost: 99,
      p_benchmark_label: "Signed out",
      p_benchmark_unit: "lm",
      p_allow_benchmark: true,
    });
    const signedOutRow = copiedMaterial ? await component(copiedMaterial.id) : null;
    check(
      "Signed-out selection rejected",
      signedOutWrite.ok !== true && money(signedOutRow?.unit_cost) === 44,
      signedOutWrite.error
    );
    const stale = await call(userA, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: draft.revisionId,
      p_item: built.itemId,
      p_component: materialId,
      p_canonical_key: MATERIAL_KEY,
      p_rate_type: "material",
      p_benchmark_cost: 99,
      p_benchmark_label: "Stale",
      p_benchmark_unit: "lm",
      p_allow_benchmark: true,
    });
    check("Stale revision rejected", stale.ok === false && stale.error === "STALE_REVISION", stale.error);
    const foreignSelection = await call(userB, "snapshot_draft_variation_component_rate_v1", {
      p_variation: draft.variationId,
      p_revision: revised.revisionId,
      p_item: copiedMaterial?.item_id,
      p_component: copiedMaterial?.id,
      p_canonical_key: MATERIAL_KEY,
      p_rate_type: "material",
      p_benchmark_cost: 99,
      p_benchmark_label: "Foreign face board",
      p_benchmark_unit: "lm",
      p_allow_benchmark: true,
    });
    const afterForeign = copiedMaterial ? await component(copiedMaterial.id) : null;
    check(
      "Cross-tenant rate rejected",
      foreignSelection.ok === false && (foreignSelection.error === "CROSS_TENANT" || foreignSelection.error === "NOT_FOUND") && money(afterForeign?.unit_cost) === 44 && afterForeign?.source_record_id !== foreignRate.data?.id,
      foreignSelection.error
    );

    const disposable = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Disposable", p_summary: "Delete", p_idempotency_key: `r4-delete-${stamp}`,
    });
    const disposableItem = await call(userA, "apply_draft_variation_build_up_v1", {
      p_variation: disposable.variationId,
      p_revision: disposable.revisionId,
      p_item_id: null,
      p_item: parent,
      p_components: [{ category: "material", description: "Face boards", quantity: 1, unit: "lm", unitCost: 10, sortOrder: 0 }],
      p_confirm: false,
    });
    const removed = await call(userA, "delete_unissued_draft_variation_v1", {
      p_project: projectA, p_variation: disposable.variationId, p_revision: disposable.revisionId,
    });
    const leftover = await admin.from("variation_item_cost_components").select("id").eq("id", disposableItem.componentIds?.[0] ?? "");
    check("Draft deletion deletes component provenance", removed.ok === true && (leftover.data ?? []).length === 0, removed.error);
  } finally {
    await cleanup();
  }
}

hostedProof()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
