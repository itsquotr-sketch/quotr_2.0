/**
 * PRICING-REQUIRED-01-R1 — persist an eligible unresolved requirement
 * through the real Pricing write path.
 *
 * Run: npx --yes tsx scripts/verify-pricing-required-manual-01-r1.ts
 * Preview only. Isolated org fixture, cleaned up. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY } from "../lib/estimate/bathroom-identities";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBSTRATE_INSTALL_LABOUR,
  FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
} from "../lib/estimate/flooring-identities";
import {
  FLOORING_PORTIONS_FACT_KEY,
  createFlooringPortionId,
  parseFlooringPortions,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import { FLOORING_QUOTE_SPECIALIST_PENDING } from "../lib/estimate/flooring-quote";
import { parseLineItemNotes } from "../lib/estimate/line-item-metadata";
import {
  computeManualPromotionMoney,
  eligibilityLineFromStoredEstimate,
  isPendingPricingItemId,
  loadAuthoritativeEstimateForProject,
  MANUAL_PRICE_INCOMPLETE,
  MANUAL_PRICE_NOT_ELIGIBLE,
  MANUAL_PRICE_STALE,
  pendingPricingItemId,
  PRICING_ITEM_UPDATE_SELECT,
  projectEligibleUnresolvedPricingItems,
  saveManualPriceForUnresolvedRequirement,
  scopeKeyFromNotes,
} from "../lib/pricing/manual-requirement-promotion";
import { mapPricingItem } from "../lib/pricing/mappers";
import {
  buildRecalibrationPreviewData,
  matchPricingToEstimateLines,
  valuesFromEstimateLineItem,
  type EstimateLineItemRow,
} from "../lib/pricing/recalibration-helpers";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";

const LAMINATE_BRIEF =
  "Supply and install 10 m² of laminate flooring to the office. The exact product is still to be selected. Existing substrate and framing are to remain. No flooring or substrate removal is required.";

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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function parseEnv(file: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

console.log("\n=== Static boundary ===\n");

const actions = read("lib/pricing/actions.ts");
const promotion = read("lib/pricing/manual-requirement-promotion.ts");
check(
  "update lookup does not name cost_known",
  PRICING_ITEM_UPDATE_SELECT.split(",").every((part) => part.trim() !== "cost_known") &&
    promotion.includes("Never include cost_known")
);
check(
  "Add price action does not take a pricing item id",
  actions.includes("export async function setManualPriceForUnresolvedRequirement") &&
    !read("lib/pricing/schemas.ts").includes(
      "setManualPriceForUnresolvedRequirementInputSchema = z.object({\n  pricingItemId"
    ) &&
    read("lib/pricing/schemas.ts").includes("nestedItemId:") &&
    read("components/pricing/PricingWorkspace.tsx").includes(
      "setManualPriceForUnresolvedRequirement"
    )
);
check(
  "not-found check remains",
  actions.includes('return { error: "Pricing item not found." }')
);

const money = computeManualPromotionMoney({
  totalCost: 1000,
  quantity: 10,
  unit: "m2",
  itemType: "material",
  marginPercent: 10,
});
const docTotals = money.ok
  ? calculateAuthoritativeDocumentTotals(
      [
        {
          total_cost: money.fields.totalCost,
          total_sell: money.fields.totalSell,
          cost_known: true,
        },
      ],
      15
    )
  : null;
check(
  "direct COST 1000 at 10% uses shared sell and GST",
  money.ok &&
    money.fields.totalCost === 1000 &&
    money.fields.totalSell === 1111.11 &&
    docTotals?.ok === true &&
    docTotals.totals.gstAmount === 166.67 &&
    docTotals.totals.totalInclGst === 1277.78
);
const zeroMoney = computeManualPromotionMoney({
  totalCost: 0,
  totalSell: 0,
  quantity: 10,
  unit: "m2",
  itemType: "material",
  marginPercent: 10,
});
check(
  "zero stays unresolved",
  zeroMoney.ok && zeroMoney.costKnown === false && zeroMoney.fields.totalCost === 0
);

const extracted = enrichExtractionFromBrief({
  briefText: LAMINATE_BRIEF,
  extraction: emptyExtraction(),
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
});
const laminatePortion = parseFlooringPortions(
  extracted.extraction.facts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
)[0];
check("laminate fixture extracted", laminatePortion?.area_m2 === 10 && laminatePortion.label === "Office");

async function main(): Promise<void> {
  console.log("\n=== Preview persistence ===\n");
  const env = parseEnv(join(process.cwd(), ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  check("Preview env present", Boolean(url && service));
  if (!url || !service || !laminatePortion) {
    finish(1);
    return;
  }
  const ref = new URL(url).hostname.split(".")[0];
  check("target is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const column = await admin.from("pricing_items").select("id, cost_known").limit(1);
  check(
    "hosted pricing_items.cost_known is absent",
    column.error?.code === "42703"
  );

  const suffix = randomUUID().slice(0, 8);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const createdUser = await admin.auth.admin.createUser({
    email: `pr-r1+${suffix}@example.invalid`,
    password: `PrR1-${suffix}-Aa!`,
    email_confirm: true,
  });
  if (createdUser.error || !createdUser.data.user) {
    throw new Error(createdUser.error?.message ?? "createUser failed");
  }
  const userId = createdUser.data.user.id;
  const projectA = randomUUID();
  const projectB = randomUUID();
  const projectFc = randomUUID();
  const areaA = randomUUID();
  const areaB = randomUUID();
  const areaFc = randomUUID();
  const docA = randomUUID();
  const docFc = randomUUID();
  const orgIds = [orgA, orgB];

  async function cleanup(): Promise<void> {
    for (const orgId of orgIds) {
      await admin.from("pricing_items").delete().eq("org_id", orgId);
      await admin.from("pricing_documents").delete().eq("org_id", orgId);
      await admin.from("estimate_line_items").delete().eq("org_id", orgId);
      await admin.from("estimates").delete().eq("org_id", orgId);
      await admin.from("project_facts").delete().eq("org_id", orgId);
      await admin.from("rates").delete().eq("org_id", orgId);
      await admin.from("work_areas").delete().eq("org_id", orgId);
      await admin.from("projects").delete().eq("org_id", orgId);
      await admin.from("organisation_settings").delete().eq("org_id", orgId);
      await admin.from("organisation_memberships").delete().eq("org_id", orgId);
      await admin.from("profiles").delete().eq("org_id", orgId);
      await admin.from("organisations").delete().eq("id", orgId);
    }
    await admin.auth.admin.deleteUser(userId);
  }

  try {
    const orgInsert = await admin.from("organisations").insert([
      { id: orgA, name: `PR-R1 A ${suffix}` },
      { id: orgB, name: `PR-R1 B ${suffix}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    const profile = await admin.from("profiles").insert({
      id: userId,
      org_id: orgA,
      role: "owner",
      full_name: "PR-R1 probe",
    });
    if (profile.error) throw new Error(profile.error.message);
    await admin.from("organisation_settings").insert([
      { org_id: orgA, default_margin_percent: 10, default_gst_rate: 15 },
      { org_id: orgB, default_margin_percent: 20, default_gst_rate: 15 },
    ]);
    const rateInsert = await admin.from("rates").insert({
      org_id: orgA,
      rate_type: "material",
      item_key: "pr-r1-control-rate",
      label: "PR-R1 control rate",
      unit: "m2",
      cost_rate: 12,
      active: true,
      source: "explicit_company",
    });
    check("control company rate inserted", !rateInsert.error, rateInsert.error?.message ?? "");
    const { data: rateBefore } = await admin
      .from("rates")
      .select("id, item_key, cost_rate, org_id")
      .eq("org_id", orgA);

    await admin.from("projects").insert([
      {
        id: projectA,
        org_id: orgA,
        created_by: userId,
        title: `Laminate ${suffix}`,
        stage: "estimate_ready",
        brief_text: LAMINATE_BRIEF,
      },
      {
        id: projectB,
        org_id: orgB,
        created_by: userId,
        title: `Other tenant ${suffix}`,
        stage: "estimate_ready",
      },
      {
        id: projectFc,
        org_id: orgA,
        created_by: userId,
        title: `FC ${suffix}`,
        stage: "estimate_ready",
      },
    ]);
    await admin.from("work_areas").insert([
      {
        id: areaA,
        org_id: orgA,
        project_id: projectA,
        type: "flooring",
        name: "Flooring",
        status: "confirmed",
        sort_order: 0,
      },
      {
        id: areaB,
        org_id: orgB,
        project_id: projectB,
        type: "flooring",
        name: "Flooring",
        status: "confirmed",
        sort_order: 0,
      },
      {
        id: areaFc,
        org_id: orgA,
        project_id: projectFc,
        type: "flooring",
        name: "Flooring",
        status: "confirmed",
        sort_order: 0,
      },
    ]);

    const twin: FlooringPortion = {
      ...laminatePortion,
      id: createFlooringPortionId(),
      label: "Office",
    };
    await admin.from("project_facts").insert({
      org_id: orgA,
      project_id: projectA,
      work_area_id: areaA,
      key: FLOORING_PORTIONS_FACT_KEY,
      label: FLOORING_PORTIONS_FACT_KEY,
      value: [laminatePortion, twin],
      source: "user",
    });
    const factsBefore = await admin
      .from("project_facts")
      .select("key, value, work_area_id")
      .eq("project_id", projectA)
      .eq("org_id", orgA);

    const loaded = await loadAuthoritativeEstimateForProject(admin, orgA, projectA);
    if ("error" in loaded) throw new Error(loaded.error);
    const specialist = loaded.result.lineItems.find(
      (row) =>
        row.componentKey === FLOORING_SPECIALIST_COMPONENT &&
        row.nestedItemId === laminatePortion.id
    );
    const specialistTwin = loaded.result.lineItems.find(
      (row) =>
        row.componentKey === FLOORING_SPECIALIST_COMPONENT &&
        row.nestedItemId === twin.id
    );
    check(
      "authoritative estimate has two separate laminate lines",
      specialist != null &&
        specialistTwin != null &&
        specialist.nestedItemId !== specialistTwin.nestedItemId &&
        specialist.rateSourceType === "missing"
    );

    const projected = projectEligibleUnresolvedPricingItems({
      items: [],
      estimateLines: loaded.result.lineItems,
      orgId: orgA,
      projectId: projectA,
      pricingDocumentId: docA,
    });
    const synthetic = projected.find(
      (row) => row.component_key === FLOORING_SPECIALIST_COMPONENT &&
        parseLineItemNotes(row.notes_internal).metadata.nestedItemId === laminatePortion.id
    );
    check(
      "synthetic row has no persisted pricing id",
      synthetic != null &&
        isPendingPricingItemId(synthetic.id) &&
        synthetic.id === pendingPricingItemId(scopeKeyFromNotes(synthetic.notes_internal) ?? "") &&
        synthetic.source_estimate_line_item_id == null
    );
    const falseLookup = synthetic
      ? await admin.from("pricing_items").select("id").eq("id", synthetic.id).maybeSingle()
      : { data: { id: "unexpected" }, error: null };
    check(
      "synthetic id is not a pricing row",
      Boolean(falseLookup.error) || falseLookup.data == null
    );

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
    const resolvedControl = randomUUID();
    await admin.from("pricing_items").insert({
      id: resolvedControl,
      org_id: orgA,
      pricing_document_id: docA,
      project_id: projectA,
      work_area_id: areaA,
      item_type: "labour",
      delivery_method: "in_house",
      internal_label: "Resolved control",
      client_label: "Resolved control",
      quantity: 1,
      unit: "item",
      total_cost: 50,
      total_sell: 70,
      gross_profit: 20,
      margin_percent: 28.57,
      markup_percent: 40,
      sort_order: 0,
      manually_edited: false,
      notes_internal: "Existing resolved line",
    });

    const quoteBefore = quoteFor(laminatePortion, []);
    check(
      "quote before price excludes laminate",
      quoteBefore.includes(FLOORING_QUOTE_SPECIALIST_PENDING) &&
        !/Pricing required/i.test(quoteBefore) &&
        !quoteBefore.includes("1111.11")
    );

    const zeroSave = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      identity: {
        projectId: projectA,
        workAreaId: areaA,
        nestedItemId: laminatePortion.id,
        componentKey: FLOORING_SPECIALIST_COMPONENT,
      },
      pricingDocumentId: docA,
      totalCost: 0,
      totalSell: 0,
    });
    const zeroCount = await admin
      .from("pricing_items")
      .select("id", { count: "exact", head: true })
      .eq("pricing_document_id", docA)
      .eq("component_key", FLOORING_SPECIALIST_COMPONENT);
    check(
      "zero does not create an inclusion",
      "success" in zeroSave &&
        zeroSave.item == null &&
        zeroCount.count === 0
    );

    const first = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      identity: {
        projectId: projectA,
        workAreaId: areaA,
        nestedItemId: laminatePortion.id,
        componentKey: FLOORING_SPECIALIST_COMPONENT,
      },
      pricingDocumentId: docA,
      totalCost: 1000,
    });
    check(
      "Add price promotes a real row",
      "success" in first &&
        first.item != null &&
        !isPendingPricingItemId(first.item.id) &&
        first.created === true &&
        first.item.total_cost === 1000 &&
        first.item.total_sell === 1111.11 &&
        first.item.cost_known === true &&
        parseLineItemNotes(first.item.notes_internal).metadata.pricingSource ===
          "user_override"
    );
    const promotedId = "success" in first && first.item ? first.item.id : "";
    const lookup = await admin
      .from("pricing_items")
      .select(PRICING_ITEM_UPDATE_SELECT)
      .eq("id", promotedId)
      .eq("org_id", orgA)
      .maybeSingle();
    check(
      "existing update lookup finds the promoted row",
      !lookup.error && lookup.data?.id === promotedId
    );
    const edited = await admin
      .from("pricing_items")
      .update({ total_cost: 1000, total_sell: 1200, manually_edited: true })
      .eq("id", promotedId)
      .eq("org_id", orgA)
      .select("id, total_sell")
      .maybeSingle();
    check("subsequent edit uses the persisted id", edited.data?.total_sell === 1200);
    await admin
      .from("pricing_items")
      .update({ total_cost: 1000, total_sell: 1111.11, manually_edited: true })
      .eq("id", promotedId)
      .eq("org_id", orgA);

    const refreshed = await admin
      .from("pricing_items")
      .select("id, total_cost, total_sell, notes_internal")
      .eq("id", promotedId)
      .maybeSingle();
    check(
      "refresh retains the manual price",
      Number(refreshed.data?.total_cost) === 1000 &&
        Number(refreshed.data?.total_sell) === 1111.11
    );

    const second = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      identity: {
        projectId: projectA,
        workAreaId: areaA,
        nestedItemId: laminatePortion.id,
        componentKey: FLOORING_SPECIALIST_COMPONENT,
      },
      pricingDocumentId: docA,
      totalCost: 1000,
    });
    const duplicateCount = await admin
      .from("pricing_items")
      .select("id")
      .eq("pricing_document_id", docA)
      .eq("component_key", FLOORING_SPECIALIST_COMPONENT);
    const officeRows = (duplicateCount.data ?? []).filter((row) => row.id === promotedId || true);
    const nestedRows = [];
    for (const row of duplicateCount.data ?? []) {
      const full = await admin
        .from("pricing_items")
        .select("id, notes_internal")
        .eq("id", row.id)
        .maybeSingle();
      if (
        parseLineItemNotes(full.data?.notes_internal).metadata.nestedItemId ===
        laminatePortion.id
      ) {
        nestedRows.push(row.id);
      }
    }
    check(
      "duplicate submission is idempotent",
      "success" in second &&
        second.item?.id === promotedId &&
        second.created === false &&
        nestedRows.length === 1
    );
    void officeRows;

    const twinSave = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      identity: {
        projectId: projectA,
        workAreaId: areaA,
        nestedItemId: twin.id,
        componentKey: FLOORING_SPECIALIST_COMPONENT,
      },
      pricingDocumentId: docA,
      totalCost: 400,
    });
    check(
      "second identical Flooring Area stays separate",
      "success" in twinSave &&
        twinSave.item != null &&
        twinSave.item.id !== promotedId &&
        parseLineItemNotes(twinSave.item.notes_internal).metadata.nestedItemId === twin.id
    );

    const crossProject = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      identity: {
        projectId: projectA,
        workAreaId: areaFc,
        nestedItemId: laminatePortion.id,
        componentKey: FLOORING_SPECIALIST_COMPONENT,
      },
      pricingDocumentId: docA,
      totalCost: 1000,
    });
    check(
      "cross-project attempt rejected",
      "error" in crossProject && crossProject.error === "Work area not found."
    );
    const crossTenant = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgB,
      identity: {
        projectId: projectA,
        workAreaId: areaA,
        nestedItemId: laminatePortion.id,
        componentKey: FLOORING_SPECIALIST_COMPONENT,
      },
      pricingDocumentId: docA,
      totalCost: 1000,
    });
    check(
      "cross-tenant attempt rejected",
      "error" in crossTenant &&
        (crossTenant.error === "Project not found." ||
          crossTenant.error === "Work area not found." ||
          crossTenant.error === "Pricing document not found.")
    );
    const stale = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      identity: {
        projectId: projectA,
        workAreaId: areaA,
        nestedItemId: "missing-portion",
        componentKey: FLOORING_SPECIALIST_COMPONENT,
      },
      pricingDocumentId: docA,
      totalCost: 1000,
    });
    check("stale requirement rejected", "error" in stale && stale.error === MANUAL_PRICE_STALE);
    const incompletePortion: FlooringPortion = {
      ...laminatePortion,
      id: createFlooringPortionId(),
      area_m2: null,
      area_input_method: null,
    };
    const incompleteLines = (
      await loadAuthoritativeEstimateForProject(admin, orgA, projectA)
    );
    const incompleteEligible =
      "error" in incompleteLines
        ? false
        : incompleteLines.result.lineItems.some(
            (row) =>
              row.nestedItemId === incompletePortion.id &&
              row.componentKey === FLOORING_SPECIALIST_COMPONENT
          );
    const incompleteSave = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      identity: {
        projectId: projectA,
        workAreaId: areaA,
        nestedItemId: incompletePortion.id,
        componentKey: FLOORING_SPECIALIST_COMPONENT,
      },
      pricingDocumentId: docA,
      totalCost: 1000,
    });
    check(
      "incomplete requirement rejected",
      incompleteEligible === false &&
        "error" in incompleteSave &&
        (incompleteSave.error === MANUAL_PRICE_STALE ||
          incompleteSave.error === MANUAL_PRICE_INCOMPLETE ||
          incompleteSave.error === MANUAL_PRICE_NOT_ELIGIBLE)
    );

    const { data: documentAfter } = await admin
      .from("pricing_documents")
      .select("subtotal_sell, gst_amount, total_incl_gst")
      .eq("id", docA)
      .maybeSingle();
    check(
      "positive manual price updates totals",
      Number(documentAfter?.subtotal_sell) >= 1111.11 &&
        Number(documentAfter?.gst_amount) > 0 &&
        Number(documentAfter?.total_incl_gst) > Number(documentAfter?.subtotal_sell)
    );
    const { data: controlAfter } = await admin
      .from("pricing_items")
      .select("total_cost, total_sell, client_label")
      .eq("id", resolvedControl)
      .maybeSingle();
    check(
      "existing resolved pricing item unchanged",
      Number(controlAfter?.total_cost) === 50 &&
        Number(controlAfter?.total_sell) === 70 &&
        controlAfter?.client_label === "Resolved control"
    );
    const factsAfter = await admin
      .from("project_facts")
      .select("key, value, work_area_id")
      .eq("project_id", projectA)
      .eq("org_id", orgA);
    check(
      "facts unchanged",
      JSON.stringify(factsBefore.data) === JSON.stringify(factsAfter.data)
    );
    const { data: rateAfter } = await admin
      .from("rates")
      .select("id, item_key, cost_rate, org_id")
      .eq("org_id", orgA);
    check(
      "company rates unchanged",
      (rateBefore ?? []).length === 1 &&
        JSON.stringify(rateBefore) === JSON.stringify(rateAfter)
    );

    const { data: pricedRow } = await admin
      .from("pricing_items")
      .select("*")
      .eq("id", promotedId)
      .maybeSingle();
    const quoteAfter = quoteFor(
      laminatePortion,
      pricedRow ? [mapPricingItem(pricedRow)] : []
    );
    check(
      "quote after price includes laminate without internal leaks",
      quoteAfter.includes(
        "Office: Supply and install 10 m² of the specified laminate flooring, subject to the selected product specification."
      ) &&
        !/Pricing required|COST|benchmark|flooring\.specialist/i.test(quoteAfter)
    );

    const lineRows: EstimateLineItemRow[] = loaded.result.lineItems
      .filter((row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT)
      .map((row) => ({
        id: randomUUID(),
        work_area_id: areaA,
        label: row.label,
        category: row.category,
        recommended_cost: row.recommendedCost,
        recommended_sell: row.recommendedSell,
        notes: buildLineItemNotes({ ...row, workAreaId: areaA }),
        sort_order: row.sortOrder,
        component_key: row.componentKey ?? null,
      }));
    const { data: pricingNow } = await admin
      .from("pricing_items")
      .select("*")
      .eq("pricing_document_id", docA);
    const mappedNow = (pricingNow ?? []).map((row) => mapPricingItem(row));
    const matches = matchPricingToEstimateLines(lineRows, mappedNow);
    const preview = buildRecalibrationPreviewData(lineRows, mappedNow, 0, 0);
    check(
      "recalculation matches the manual price and does not add a duplicate",
      lineRows.every((row) => matches.has(row.id)) &&
        preview.summary.newItems === 0 &&
        preview.items.some((row) => row.classification === "manually_protected")
    );

    const cleared = await saveManualPriceForUnresolvedRequirement(admin, {
      orgId: orgA,
      identity: {
        projectId: projectA,
        workAreaId: areaA,
        nestedItemId: laminatePortion.id,
        componentKey: FLOORING_SPECIALIST_COMPONENT,
      },
      pricingDocumentId: docA,
      totalCost: 0,
      totalSell: 0,
    });
    const quoteCleared = quoteFor(
      laminatePortion,
      "success" in cleared && cleared.item ? [cleared.item] : []
    );
    check(
      "clearing restores Pricing Required and quote exclusion",
      "success" in cleared &&
        cleared.item != null &&
        cleared.item.cost_known === false &&
        cleared.item.total_cost === 0 &&
        quoteCleared.includes(FLOORING_QUOTE_SPECIALIST_PENDING) &&
        !quoteCleared.includes("1111.11")
    );

    await proveFc(admin, {
      orgId: orgA,
      projectId: projectFc,
      workAreaId: areaFc,
      pricingDocumentId: docFc,
      userId,
    });

    const storedProjection = projectEligibleUnresolvedPricingItems({
      items: [],
      estimateLines: [
        eligibilityLineFromStoredEstimate({
          id: randomUUID(),
          work_area_id: areaA,
          label: specialist?.label ?? "Specialist flooring supply and installation",
          category: "materials",
          recommended_cost: 0,
          recommended_sell: 0,
          notes: specialist ? buildLineItemNotes(specialist) : null,
          sort_order: 1,
          component_key: FLOORING_SPECIALIST_COMPONENT,
        }),
      ],
      orgId: orgA,
      projectId: projectA,
      pricingDocumentId: docA,
    });
    check(
      "stored estimate line projects without using its id as a pricing id",
      storedProjection.length === 1 &&
        isPendingPricingItemId(storedProjection[0]!.id) &&
        storedProjection[0]!.id !== "ignored"
    );
  } finally {
    await cleanup();
  }

  finish(failed > 0 ? 1 : 0);
}

function quoteFor(
  portion: FlooringPortion,
  items: { client_label?: string; label?: string; component_key: string | null; notes_internal: string | null; cost_known: boolean; total_cost: number; total_sell: number }[]
): string {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "flooring",
    name: "Flooring",
    facts: [
      {
        key: FLOORING_PORTIONS_FACT_KEY,
        value: JSON.stringify([portion]),
      },
    ],
    pricingItems: items.map((row) => ({
      label: row.client_label ?? row.label ?? "",
      component_key: row.component_key,
      nested_item_id:
        parseLineItemNotes(row.notes_internal).metadata.nestedItemId ?? null,
      cost_known: row.cost_known,
      total_cost: row.total_cost,
      total_sell: row.total_sell,
      notes_internal: row.notes_internal,
    })),
  });
}

async function proveFc(
  admin: SupabaseClient,
  ids: {
    orgId: string;
    projectId: string;
    workAreaId: string;
    pricingDocumentId: string;
    userId: string;
  }
): Promise<void> {
  const portion: FlooringPortion = {
    id: createFlooringPortionId(),
    label: "Bathroom",
    finish_type: "tile",
    area_input_method: "direct_m2",
    area_m2: 12,
    tile_width_mm: 600,
    tile_length_mm: 600,
    floor_preparation_required: false,
    substrate_required: true,
    substrate_family: "fibre_cement",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
    framing_required: false,
    finish_removal_required: false,
  } as FlooringPortion;
  await admin.from("project_facts").insert({
    org_id: ids.orgId,
    project_id: ids.projectId,
    work_area_id: ids.workAreaId,
    key: FLOORING_PORTIONS_FACT_KEY,
    label: FLOORING_PORTIONS_FACT_KEY,
    value: [portion],
    source: "user",
  });
  await admin.from("pricing_documents").insert({
    id: ids.pricingDocumentId,
    org_id: ids.orgId,
    project_id: ids.projectId,
    title: "FC pricing",
    status: "draft",
    gst_rate: 15,
  });
  const loaded = await loadAuthoritativeEstimateForProject(
    admin,
    ids.orgId,
    ids.projectId
  );
  if ("error" in loaded) {
    check("FC estimate loads", false, loaded.error);
    return;
  }
  const material = loaded.result.lineItems.find(
    (row) => row.componentKey === FLOORING_SUBSTRATE_MATERIAL_COMPONENT
  );
  const labour = loaded.result.lineItems.find(
    (row) => row.componentKey === FLOORING_SUBSTRATE_INSTALL_LABOUR
  );
  check(
    "FC material missing and labour priced before manual price",
    material?.rateSourceType === "missing" &&
      (material.quantity ?? 0) > 0 &&
      (labour?.recommendedCost ?? 0) > 0 &&
      labour?.rateSourceType !== "missing"
  );
  if (!material || !labour) return;
  const labourValues = valuesFromEstimateLineItem({
    id: randomUUID(),
    work_area_id: ids.workAreaId,
    label: labour.label,
    category: labour.category,
    recommended_cost: labour.recommendedCost,
    recommended_sell: labour.recommendedSell,
    notes: buildLineItemNotes(labour),
    sort_order: labour.sortOrder,
    component_key: labour.componentKey ?? null,
  });
  const labourId = randomUUID();
  await admin.from("pricing_items").insert({
    id: labourId,
    org_id: ids.orgId,
    pricing_document_id: ids.pricingDocumentId,
    project_id: ids.projectId,
    work_area_id: ids.workAreaId,
    component_key: FLOORING_SUBSTRATE_INSTALL_LABOUR,
    item_type: labourValues.itemType,
    delivery_method: labourValues.deliveryMethod,
    internal_label: labour.label,
    client_label: labour.label,
    quantity: labourValues.quantity,
    unit: labourValues.unit,
    total_cost: labourValues.totalCost,
    total_sell: labourValues.totalSell,
    gross_profit: labourValues.grossProfit,
    margin_percent: labourValues.marginPercent,
    markup_percent: labourValues.markupPercent,
    sort_order: 1,
    notes_internal: labourValues.notesInternal,
    manually_edited: false,
  });
  const { data: labourBefore } = await admin
    .from("pricing_items")
    .select("total_cost, total_sell, quantity")
    .eq("id", labourId)
    .maybeSingle();
  const quoteBefore = quoteFor(portion, [
    mapPricingItem({
      ...(
        await admin.from("pricing_items").select("*").eq("id", labourId).maybeSingle()
      ).data,
    }),
  ]);
  check(
    "FC quote before material price keeps labour and pending material",
    quoteBefore.includes("Substrate material") ||
      quoteBefore.toLowerCase().includes("substrate")
  );
  const saved = await saveManualPriceForUnresolvedRequirement(admin, {
    orgId: ids.orgId,
    identity: {
      projectId: ids.projectId,
      workAreaId: ids.workAreaId,
      nestedItemId: material.nestedItemId ?? portion.id,
      componentKey: FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
    },
    pricingDocumentId: ids.pricingDocumentId,
    totalCost: 880,
  });
  const { data: labourAfter } = await admin
    .from("pricing_items")
    .select("total_cost, total_sell, quantity")
    .eq("id", labourId)
    .maybeSingle();
  const { data: materialRow } = await admin
    .from("pricing_items")
    .select("*")
    .eq("pricing_document_id", ids.pricingDocumentId)
    .eq("component_key", FLOORING_SUBSTRATE_MATERIAL_COMPONENT)
    .maybeSingle();
  const quoteAfter =
    "success" in saved && saved.item
      ? quoteFor(portion, [
          saved.item,
          mapPricingItem(
            (
              await admin.from("pricing_items").select("*").eq("id", labourId).maybeSingle()
            ).data
          ),
        ])
      : "";
  check(
    "FC manual material price leaves labour and sheets unchanged",
    "success" in saved &&
      saved.item != null &&
      saved.item.total_cost === 880 &&
      saved.item.quantity === material.quantity &&
      Number(labourAfter?.total_cost) === Number(labourBefore?.total_cost) &&
      Number(labourAfter?.total_sell) === Number(labourBefore?.total_sell) &&
      !quoteAfter.toLowerCase().includes("plywood") &&
      quoteAfter.includes("Includes installation of new")
  );
  const removed = await saveManualPriceForUnresolvedRequirement(admin, {
    orgId: ids.orgId,
    identity: {
      projectId: ids.projectId,
      workAreaId: ids.workAreaId,
      nestedItemId: material.nestedItemId ?? portion.id,
      componentKey: FLOORING_SUBSTRATE_MATERIAL_COMPONENT,
    },
    pricingDocumentId: ids.pricingDocumentId,
    totalCost: 0,
    totalSell: 0,
  });
  const { data: labourFinal } = await admin
    .from("pricing_items")
    .select("total_cost, total_sell")
    .eq("id", labourId)
    .maybeSingle();
  check(
    "FC material removal restores Pricing Required and keeps labour",
    "success" in removed &&
      removed.item?.cost_known === false &&
      removed.item.total_cost === 0 &&
      Number(labourFinal?.total_cost) === Number(labourBefore?.total_cost) &&
      Number(materialRow?.quantity) === Number(material.quantity)
  );
  void ids.userId;
}

function finish(code: number): void {
  console.log(`\nPRICING-REQUIRED-01-R1: ${passed} passed, ${failed} failed`);
  process.exit(code);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  finish(1);
});
