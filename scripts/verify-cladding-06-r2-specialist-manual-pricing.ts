/**
 * CLADDING-06-R2 — known-area brick specialist review, Pricing and Quote.
 *
 * Run: npx --yes tsx scripts/verify-cladding-06-r2-specialist-manual-pricing.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { extractCladdingPortionsFromBrief } from "../lib/estimate/cladding-brief";
import { calculateCladdingPhysical } from "../lib/estimate/cladding-physical";
import { CLADDING_SPECIALIST_BRICK_VENEER, CLADDING_SPECIALIST_MASONRY } from "../lib/estimate/cladding-identities";
import {
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_V1_HUMAN_QA_FROZEN,
  createEmptyCladdingPortion,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { buildNestedCladdingQuoteDraft } from "../lib/estimate/cladding-quote";
import type { EstimateFact, EstimateLineItem, EstimateWorkArea } from "../lib/estimate/types";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  computeManualPromotionMoney,
  evaluateManualPricingEligibility,
  loadAuthoritativeEstimateForProject,
  projectEligibleUnresolvedPricingItems,
  saveManualPriceForUnresolvedRequirement,
} from "../lib/pricing/manual-requirement-promotion";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";

const QA3 =
  "Supply and install 25 m² of brick veneer cladding to the Lower elevation. The area already excludes openings. No existing cladding removal is required. The final brick selection is still to be confirmed.";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${passed + failed}. ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${passed + failed}. ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const workArea = { id: "c1", type: "cladding", name: "Cladding", sort_order: 1, status: "confirmed" } as EstimateWorkArea;

function factsFor(rows: CladdingPortion[], workAreaId = "c1"): EstimateFact[] {
  return [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: workAreaId, value: rows, source: "user" }];
}
function estimateOf(rows: CladdingPortion[], workAreaId = "c1") {
  return calculateEstimate({
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [{ ...workArea, id: workAreaId }],
    facts: factsFor(rows, workAreaId),
    constraints: [],
    organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
    materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
    rates: [],
  });
}
function quoteOf(rows: CladdingPortion[], items: { component_key: string; nested_item_id: string; total_cost: number; total_sell: number; cost_known: boolean }[] = []): string {
  return buildNestedCladdingQuoteDraft(
    [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "quote", value: JSON.stringify(rows), source: "user" }],
    items.map((row) => ({
      label: "Brick",
      component_key: row.component_key,
      nested_item_id: row.nested_item_id,
      cost_known: row.cost_known,
      total_cost: row.total_cost,
      total_sell: row.total_sell,
      notes_internal: null,
    }))
  );
}

const extracted = extractCladdingPortionsFromBrief(QA3);
const lower = extracted[0];
check("QA3 extracts one Lower elevation section", extracted.length === 1 && lower?.label === "Lower elevation");
check("family is brick veneer", lower?.cladding_family === "brick_veneer" && lower.cladding_system === "specialist_unresolved");
check("direct and net area stay 25", lower?.direct_area_m2 === 25 && lower.openings_already_deducted === true);
check("removal is No", lower?.existing_cladding_removal_required === false);
const physical = calculateCladdingPhysical({ facts: factsFor(extracted), workArea });
const brickReq = physical.requirements.find((row) => row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER);
check("physical emits one brick requirement", physical.requirements.filter((row) => row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER).length === 1);
check("brick quantity is the known net area", brickReq?.kind === "material" && brickReq.baseQuantity === 25 && brickReq.purchaseUnit === "m2");
check("brick money stays null", brickReq?.kind === "material" && brickReq.unitCost == null && brickReq.totalCost == null && brickReq.priced === false);
check("brick keeps the section identity", brickReq?.kind === "material" && brickReq.variantKey === lower?.id);
check("no ordinary timber or fibre-cement material is emitted", !physical.requirements.some((row) => /bevelback|fibre_cement|weatherboard|carpenter/.test(row.componentKey)));
check("no carpenter labour is emitted", !physical.requirements.some((row) => row.kind === "labour"));

const estimate = estimateOf(extracted);
const brickLine = estimate.lineItems.find((row) => row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER);
check("commercial brick line is unresolved", brickLine?.includedInTotal === false && brickLine.rateSourceType === "missing" && (brickLine.recommendedCost ?? 0) === 0);
check("brick description is the supply sentence", brickLine?.label === "Brick veneer cladding supply and installation");
check("brick quantity stays 25 m2", brickLine?.quantity === 25 && brickLine.unit === "m2");
check("unresolved brick is not counted as direct COST", estimate.recommendedCost === 0);
check("no legitimate zero-dollar inclusion", !estimate.lineItems.some((row) => row.includedInTotal !== false && (row.recommendedCost ?? 0) === 0 && row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER));

const review = composeBuilderReview({
  estimate: {
    recommendedCost: estimate.recommendedCost,
    recommendedSell: estimate.recommendedSell,
    marginPercent: estimate.marginPercent,
    confidence: estimate.confidence,
    assumptions: estimate.assumptions,
    missingInfo: estimate.missingInfo,
    lineItems: estimate.lineItems.map((item, index) => ({ ...item, id: `line-${index}` })) as EstimateLineItem[],
  },
  workAreas: [workArea],
  requirements: estimate.requirements,
  facts: factsFor(extracted),
});
const portion = review.workAreas[0]?.portionGroups?.[0];
const pricingGroup = portion?.lineGroups.find((row) => row.label === "Pricing Required");
const child = pricingGroup?.children[0];
check("review creates the Cladding section", portion?.label.includes("Lower elevation") === true && portion.label.includes("brick"));
check("review group is Pricing Required", pricingGroup != null && pricingGroup.costHidden === true);
check("review names the brick supply line", child?.label === "Brick veneer cladding supply and installation");
check("review shows 25 m2", child?.quantity === 25 && child.unit === "m2");
check("review points to Pricing", (pricingGroup?.supporting ?? "").includes("Continue to Pricing and add a price") || (child?.supporting ?? "").includes("Continue to Pricing"));
check("review hides specialist enums", !JSON.stringify({ label: portion?.label, summary: portion?.summary, supporting: pricingGroup?.supporting, child: child?.label }).includes("UNSUPPORTED_SPECIALIST"));
check("work area explains Pricing required instead of an empty estimate", /pricing required/i.test(review.workAreas[0]?.partialEstimateLabel ?? "") && /specialist/i.test(review.workAreas[0]?.partialEstimateLabel ?? ""));

const pendingQuote = quoteOf(extracted);
check("quote before a price stays pending", pendingQuote.includes("Lower elevation: Brick veneer cladding is excluded pending final specification and pricing."));
check("pending quote does not claim cavity or scaffold", !/cavity|underlay|scaffold|painting|foundation/i.test(pendingQuote));

const eligibility = evaluateManualPricingEligibility(brickLine);
check("known-area brick is manually priceable", eligibility.ok === true);
check("trims are not manually priceable", evaluateManualPricingEligibility({ ...brickLine, componentKey: "cladding.trims_flashings_corners.unresolved", quantity: null }).ok === false);
check("a missing quantity is not priceable", evaluateManualPricingEligibility({ ...brickLine, quantity: 0 }).ok === false);
const projected = projectEligibleUnresolvedPricingItems({
  items: [],
  estimateLines: estimate.lineItems,
  orgId: "org-a",
  projectId: "p1",
  pricingDocumentId: "pd",
});
check("Pricing projection is a pending brick item", projected.length === 1 && projected[0]?.component_key === CLADDING_SPECIALIST_BRICK_VENEER && projected[0]?.quantity === 25 && projected[0]?.unit === "m2");
check("projection keeps the section and description", projected[0]?.internal_label === "Brick veneer cladding supply and installation" && (projected[0]?.notes_internal ?? "").includes(lower?.id ?? "missing"));
const again = projectEligibleUnresolvedPricingItems({
  items: projected,
  estimateLines: estimate.lineItems,
  orgId: "org-a",
  projectId: "p1",
  pricingDocumentId: "pd",
});
check("refresh does not create a second pending item", again.length === 0);

const twin = { ...createEmptyCladdingPortion({ id: "brick-b" }), ...lower, id: "brick-b", label: "Lower elevation" };
const two = estimateOf([lower!, twin]);
const twoProjected = projectEligibleUnresolvedPricingItems({
  items: [],
  estimateLines: two.lineItems,
  orgId: "org-a",
  projectId: "p1",
  pricingDocumentId: "pd",
});
check("two specialist sections stay independent", twoProjected.length === 2 && twoProjected.some((row) => (row.notes_internal ?? "").includes(lower!.id)) && twoProjected.some((row) => (row.notes_internal ?? "").includes("brick-b")));

const money = computeManualPromotionMoney({ totalCost: 5000, quantity: 25, unit: "m2", itemType: "material", marginPercent: 20 });
check("manual price uses shared margin", money.ok === true && money.fields.totalSell === deriveSellFromCost(5000, 20));
const zero = computeManualPromotionMoney({ totalCost: 0, quantity: 25, unit: "m2", itemType: "material", marginPercent: 20 });
check("clearing to zero is not a known inclusion", zero.ok === true && zero.costKnown === false && zero.fields.totalCost === 0);
const pricedQuote = quoteOf(extracted, [{ component_key: CLADDING_SPECIALIST_BRICK_VENEER, nested_item_id: lower!.id, total_cost: 5000, total_sell: 6250, cost_known: true }]);
check("quote after a price names 25 m2", pricedQuote.includes("Lower elevation: Supply and install 25 m² of the specified brick veneer cladding, subject to final product selection and confirmed construction details."));
const clearedQuote = quoteOf(extracted, [{ component_key: CLADDING_SPECIALIST_BRICK_VENEER, nested_item_id: lower!.id, total_cost: 0, total_sell: 0, cost_known: false }]);
check("clearing the price restores the pending sentence", clearedQuote.includes("excluded pending final specification and pricing") && !clearedQuote.includes("Supply and install 25"));
check("priced quote does not claim unpriced cavity or scaffold", !/Includes a drained cavity|scaffold is included|painting is included/i.test(pricedQuote));

const masonry = {
  ...createEmptyCladdingPortion({ id: "masonry" }),
  label: "Side wall",
  scope_intent: "install" as const,
  cladding_family: "masonry" as const,
  cladding_system: "specialist_unresolved" as const,
  specialist_kind: "masonry" as const,
  other_description: "Cut stone veneer",
  area_method: "direct_m2" as const,
  direct_area_m2: 10,
  openings_already_deducted: true,
  existing_cladding_removal_required: false,
};
const masonryPhysical = calculateCladdingPhysical({ facts: factsFor([masonry]), workArea });
check("masonry uses the veneer specialist key", masonryPhysical.requirements.some((row) => row.componentKey === CLADDING_SPECIALIST_MASONRY && row.kind === "material" && row.baseQuantity === 10));
check("freeze stays closed", CLADDING_V1_HUMAN_QA_FROZEN === true);

function parseEnv(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
        })
    );
  } catch {
    return {};
  }
}

async function previewFixture(): Promise<void> {
  const env = parseEnv(join(process.cwd(), ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    check("Preview credentials absent; in-memory specialist path still proved", true);
    return;
  }
  const ref = new URL(url).hostname.split(".")[0];
  check("database target is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) return;
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = randomUUID().slice(0, 8);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const created = await admin.auth.admin.createUser({
    email: `cladding-r2+${suffix}@example.invalid`,
    password: `CladR2-${suffix}-Aa!`,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    check("Preview user fixture", false, created.error?.message ?? "createUser failed");
    return;
  }
  const userId = created.data.user.id;
  const projectA = randomUUID();
  const projectB = randomUUID();
  const areaA = randomUUID();
  const docA = randomUUID();
  async function cleanup(): Promise<void> {
    for (const orgId of [orgA, orgB]) {
      await admin.from("pricing_items").delete().eq("org_id", orgId);
      await admin.from("pricing_documents").delete().eq("org_id", orgId);
      await admin.from("project_facts").delete().eq("org_id", orgId);
      await admin.from("work_areas").delete().eq("org_id", orgId);
      await admin.from("projects").delete().eq("org_id", orgId);
      await admin.from("organisation_settings").delete().eq("org_id", orgId);
      await admin.from("profiles").delete().eq("org_id", orgId);
      await admin.from("organisations").delete().eq("id", orgId);
    }
    await admin.auth.admin.deleteUser(userId);
  }
  try {
    const orgInsert = await admin.from("organisations").insert([
      { id: orgA, name: `CLADDING-R2 ${suffix}` },
      { id: orgB, name: `CLADDING-R2 other ${suffix}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    await admin.from("profiles").insert({ id: userId, org_id: orgA, role: "owner", full_name: "Cladding R2" });
    await admin.from("organisation_settings").insert({ org_id: orgA, default_margin_percent: 20, default_gst_rate: 15 });
    await admin.from("projects").insert([
      { id: projectA, org_id: orgA, created_by: userId, title: `Brick ${suffix}`, stage: "estimate_ready", brief_text: QA3 },
      { id: projectB, org_id: orgB, created_by: userId, title: `Other ${suffix}`, stage: "estimate_ready" },
    ]);
    await admin.from("work_areas").insert({ id: areaA, org_id: orgA, project_id: projectA, type: "cladding", name: "Cladding", status: "confirmed", sort_order: 0 });
    await admin.from("project_facts").insert({
      org_id: orgA,
      project_id: projectA,
      work_area_id: areaA,
      key: CLADDING_PORTIONS_FACT_KEY,
      label: CLADDING_PORTIONS_FACT_KEY,
      value: extracted,
      source: "user",
    });
    await admin.from("pricing_documents").insert({
      id: docA,
      org_id: orgA,
      project_id: projectA,
      title: `Pricing ${suffix}`,
      status: "draft",
      gst_rate: 15,
      subtotal_cost: 0,
      subtotal_sell: 0,
      gross_profit: 0,
      margin_percent: 0,
      markup_percent: 0,
      gst_amount: 0,
      total_incl_gst: 0,
    });
    const loaded = await loadAuthoritativeEstimateForProject(admin, orgA, projectA);
    if ("error" in loaded) throw new Error(loaded.error);
    const line = loaded.result.lineItems.find((row) => row.componentKey === CLADDING_SPECIALIST_BRICK_VENEER);
    check("Preview estimate projects the brick requirement", line?.quantity === 25 && line.rateSourceType === "missing");
    const saved = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      pricingDocumentId: docA,
      totalCost: 5000,
      identity: {
        projectId: projectA,
        workAreaId: line?.workAreaId ?? areaA,
        nestedItemId: line?.nestedItemId ?? "",
        componentKey: CLADDING_SPECIALIST_BRICK_VENEER,
      },
    });
    check("Add price persists one project-owned item", "success" in saved && saved.item != null && saved.item.total_cost === 5000);
    const itemId = "success" in saved ? saved.item?.id : null;
    const refreshed = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      pricingDocumentId: docA,
      totalCost: 5000,
      identity: {
        projectId: projectA,
        workAreaId: line?.workAreaId ?? areaA,
        nestedItemId: line?.nestedItemId ?? "",
        componentKey: CLADDING_SPECIALIST_BRICK_VENEER,
      },
    });
    check("refresh keeps the same Pricing item id", "success" in refreshed && refreshed.item?.id === itemId && refreshed.created === false);
    const foreign = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgB,
      pricingDocumentId: docA,
      totalCost: 100,
      identity: {
        projectId: projectB,
        workAreaId: areaA,
        nestedItemId: line?.nestedItemId ?? "",
        componentKey: CLADDING_SPECIALIST_BRICK_VENEER,
      },
    });
    check("cross-tenant promotion fails", "error" in foreign);
    const portionsBefore = await admin.from("project_facts").select("value").eq("project_id", projectA).eq("key", CLADDING_PORTIONS_FACT_KEY);
    const cleared = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      pricingDocumentId: docA,
      totalCost: 0,
      identity: {
        projectId: projectA,
        workAreaId: line?.workAreaId ?? areaA,
        nestedItemId: line?.nestedItemId ?? "",
        componentKey: CLADDING_SPECIALIST_BRICK_VENEER,
      },
    });
    const portionsAfter = await admin.from("project_facts").select("value").eq("project_id", projectA).eq("key", CLADDING_PORTIONS_FACT_KEY);
    check("clearing restores Pricing Required without mutating portions", "success" in cleared && cleared.item?.total_cost === 0 && JSON.stringify(portionsBefore.data) === JSON.stringify(portionsAfter.data));
    const rates = await admin.from("rates").select("id").eq("org_id", orgA);
    check("manual price does not create a company rate", (rates.data ?? []).length === 0);
  } catch (error) {
    check("Preview fixture", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup();
  }
}

previewFixture().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
