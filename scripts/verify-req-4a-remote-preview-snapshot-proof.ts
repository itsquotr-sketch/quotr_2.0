/**
 * REQ-4A remote/Preview snapshot persistence proof.
 *
 * Uses the committed persistEstimateResult path against the linked remote
 * project. Creates a disposable labelled org and deletes it afterwards.
 *
 * Run:
 *   npx tsx scripts/verify-req-4a-remote-preview-snapshot-proof.ts
 *
 * Refuses to run unless NEXT_PUBLIC_SUPABASE_URL is the linked quotr_2.0 ref.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import {
  buildSnapshotPayloadForEstimate,
  createGenerationId,
} from "../lib/estimate/requirement-snapshot-persist";
import { createSupabaseRequirementSnapshotStore } from "../lib/estimate/requirement-snapshot-store";
import { parseEstimateRequirementSnapshot } from "../lib/estimate/requirement-snapshot";
import type {
  EstimateContext,
  EstimateFact,
  EstimateResult,
  EstimateWorkArea,
} from "../lib/estimate/types";

config({ path: ".env.local" });

const EXPECTED_REF = "lxvnylhsbvudzzupxeqr";
const PASSWORD = `req4a-${randomUUID()}`;

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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function buildContext(
  projectId: string,
  workArea: EstimateWorkArea,
  costRate: number
): EstimateContext {
  return {
    project: { id: projectId, qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts: [
      fact("deck.area_m2", workArea.id, 16.12),
      fact("deck.board_material", workArea.id, "Hardwood"),
      fact("deck.height_m", workArea.id, 0.4),
      fact("deck.board_width_mm", workArea.id, 140),
    ],
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [
      {
        item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
        rate_type: "material",
        unit: "lm",
        cost_rate: costRate,
        sell_rate: null,
        active: true,
      },
      {
        item_key: "labour.carpenter.hour",
        rate_type: "labour",
        unit: "hour",
        cost_rate: 80,
        sell_rate: null,
        active: true,
      },
    ],
  } as unknown as EstimateContext;
}

async function persistEstimateGeneration(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string,
  estimateResult: EstimateResult
): Promise<{
  estimateId: string;
  snapshotId: string;
  generationId: string;
}> {
  const generationId = createGenerationId();
  const store = createSupabaseRequirementSnapshotStore(supabase);
  const lineItemRows = estimateResult.lineItems.map((item) => ({
    org_id: orgId,
    project_id: projectId,
    work_area_id: item.workAreaId,
    work_area_name: item.workAreaName,
    label: item.label,
    category: item.category,
    cost_low: item.costLow,
    cost_high: item.costHigh,
    sell_low: item.sellLow,
    sell_high: item.sellHigh,
    recommended_cost: item.recommendedCost,
    recommended_sell: item.recommendedSell,
    gross_profit: item.grossProfit,
    margin_percent: item.marginPercent,
    markup_percent: item.markupPercent ?? null,
    rate_source: item.rateSource,
    notes: buildLineItemNotes(item),
    sort_order: item.sortOrder,
    component_key: item.componentKey ?? null,
  }));

  const estimatePayload = {
    org_id: orgId,
    project_id: projectId,
    status: "draft",
    is_stale: true,
    cost_low: estimateResult.costLow,
    cost_high: estimateResult.costHigh,
    sell_low: estimateResult.sellLow,
    sell_high: estimateResult.sellHigh,
    recommended_cost: estimateResult.recommendedCost,
    recommended_sell: estimateResult.recommendedSell,
    gross_profit: estimateResult.grossProfit,
    margin_percent: estimateResult.marginPercent,
    markup_percent: estimateResult.markupPercent,
    confidence: estimateResult.confidence,
    rate_source_summary: estimateResult.rateSourceSummary,
    assumptions: estimateResult.assumptions,
    missing_info: estimateResult.missingInfo,
    exclusions: estimateResult.exclusions,
    assumption_metadata: estimateResult.assumptionMetadata ?? {},
    generated_at: new Date().toISOString(),
    requirement_generation_id: generationId,
    latest_requirement_snapshot_id: null,
  };

  const { data: existing } = await supabase
    .from("estimates")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  let estimateId: string;
  if (existing?.id) {
    estimateId = existing.id;
    const staging = await supabase
      .from("estimates")
      .update(estimatePayload)
      .eq("id", estimateId);
    if (staging.error) throw new Error(staging.error.message);
  } else {
    const inserted = await supabase
      .from("estimates")
      .insert(estimatePayload)
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      throw new Error(inserted.error?.message ?? "estimate insert failed");
    }
    estimateId = inserted.data.id;
  }

  const deleted = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", estimateId);
  if (deleted.error) throw new Error(deleted.error.message);

  if (lineItemRows.length > 0) {
    const insertedLines = await supabase.from("estimate_line_items").insert(
      lineItemRows.map((row) => ({ ...row, estimate_id: estimateId }))
    );
    if (insertedLines.error) throw new Error(insertedLines.error.message);
  }

  const payload = buildSnapshotPayloadForEstimate({
    generationId,
    result: estimateResult,
  });
  const snapshot = await store.insert({
    orgId,
    projectId,
    estimateId,
    generationId,
    payload,
  });

  const finalize = await supabase
    .from("estimates")
    .update({
      ...estimatePayload,
      status: "ready",
      is_stale: false,
      latest_requirement_snapshot_id: snapshot.id,
    })
    .eq("id", estimateId);
  if (finalize.error) throw new Error(finalize.error.message);

  return { estimateId, snapshotId: snapshot.id, generationId };
}

async function insertPricing(
  admin: SupabaseClient,
  params: {
    orgId: string;
    projectId: string;
    estimateId: string;
    snapshotId: string | null;
    userId: string;
    title: string;
    sell: number;
    componentKey: string | null;
    sourceLineId: string | null;
  }
): Promise<string> {
  const { data, error } = await admin
    .from("pricing_documents")
    .insert({
      org_id: params.orgId,
      project_id: params.projectId,
      estimate_id: params.estimateId,
      requirement_snapshot_id: params.snapshotId,
      title: params.title,
      status: "draft",
      gst_rate: 15,
      subtotal_cost: params.sell / 1.2,
      subtotal_sell: params.sell,
      gross_profit: params.sell - params.sell / 1.2,
      margin_percent: 20,
      markup_percent: 25,
      gst_amount: params.sell * 0.15,
      total_incl_gst: params.sell * 1.15,
      created_by: params.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "pricing insert failed");
  }
  const { error: itemError } = await admin.from("pricing_items").insert({
    org_id: params.orgId,
    project_id: params.projectId,
    pricing_document_id: data.id,
    source_estimate_line_item_id: params.sourceLineId,
    item_type: "material",
    delivery_method: "in_house",
    internal_label: "Decking materials",
    client_label: "Decking materials",
    total_cost: params.sell / 1.2,
    total_sell: params.sell,
    gross_profit: params.sell - params.sell / 1.2,
    margin_percent: 20,
    markup_percent: 25,
    sort_order: 0,
    component_key: params.componentKey,
  });
  if (itemError) {
    throw new Error(itemError.message);
  }
  return data.id;
}

async function cleanup(
  admin: SupabaseClient,
  orgIds: string[],
  userIds: string[]
): Promise<void> {
  for (const orgId of orgIds) {
    await admin.from("organisations").delete().eq("id", orgId);
  }
  for (const userId of userIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function main() {
  console.log("=== REQ-4A remote Preview snapshot persistence proof ===\n");

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const ref = hostnameRef(url);
  check("linked remote ref is quotr_2.0", ref === EXPECTED_REF, ref);
  if (ref !== EXPECTED_REF) {
    throw new Error(`Refusing to run against unexpected Supabase ref ${ref}`);
  }

  const preview = await fetch(
    "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/login"
  );
  check(
    "stable Preview URL responds",
    preview.ok || preview.status === 307 || preview.status === 308
  );

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const schemaEstimate = await admin
    .from("estimates")
    .select("requirement_generation_id, latest_requirement_snapshot_id")
    .limit(1);
  if (schemaEstimate.error && String(schemaEstimate.error.message).includes("522")) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const retry = await admin
      .from("estimates")
      .select("requirement_generation_id, latest_requirement_snapshot_id")
      .limit(1);
    check(
      "remote estimates snapshot columns exist",
      !retry.error,
      retry.error?.message
    );
  } else {
    check(
      "remote estimates snapshot columns exist",
      !schemaEstimate.error,
      schemaEstimate.error?.message
    );
  }
  const schemaPricing = await admin
    .from("pricing_documents")
    .select("requirement_snapshot_id")
    .limit(1);
  check(
    "remote pricing_documents.requirement_snapshot_id exists",
    !schemaPricing.error,
    schemaPricing.error?.message
  );
  const schemaLines = await admin
    .from("estimate_line_items")
    .select("component_key")
    .limit(1);
  check(
    "remote estimate_line_items.component_key exists",
    !schemaLines.error,
    schemaLines.error?.message
  );
  const schemaPricingItems = await admin
    .from("pricing_items")
    .select("component_key")
    .limit(1);
  check(
    "remote pricing_items.component_key exists",
    !schemaPricingItems.error,
    schemaPricingItems.error?.message
  );
  const schemaSnapshots = await admin
    .from("estimate_requirement_snapshots")
    .select("id")
    .limit(1);
  check(
    "remote estimate_requirement_snapshots exists",
    !schemaSnapshots.error,
    schemaSnapshots.error?.message
  );

  const orgIds: string[] = [];
  const userIds: string[] = [];
  try {
    const orgA = randomUUID();
    const orgB = randomUUID();
    const projectId = randomUUID();
    const workAreaId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    const emailA = `req4a-proof-a-${suffix}@example.invalid`;
    const emailB = `req4a-proof-b-${suffix}@example.invalid`;

    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password: PASSWORD,
      email_confirm: true,
    });
    if (createdA.error || !createdA.data.user) {
      throw new Error(createdA.error?.message ?? "create user A failed");
    }
    const userA = createdA.data.user.id;
    userIds.push(userA);

    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password: PASSWORD,
      email_confirm: true,
    });
    if (createdB.error || !createdB.data.user) {
      throw new Error(createdB.error?.message ?? "create user B failed");
    }
    const userB = createdB.data.user.id;
    userIds.push(userB);

    const orgInsert = await admin.from("organisations").insert([
      { id: orgA, name: `REQ-4A-PROOF disposable A ${suffix}` },
      { id: orgB, name: `REQ-4A-PROOF disposable B ${suffix}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    orgIds.push(orgA, orgB);

    const profileInsert = await admin.from("profiles").insert([
      { id: userA, org_id: orgA, role: "owner", full_name: "REQ-4A proof A" },
      { id: userB, org_id: orgB, role: "owner", full_name: "REQ-4A proof B" },
    ]);
    if (profileInsert.error) throw new Error(profileInsert.error.message);

    const projectInsert = await admin.from("projects").insert({
      id: projectId,
      org_id: orgA,
      created_by: userA,
      title: `REQ-4A-PROOF Deck ${suffix}`,
      stage: "brief",
    });
    if (projectInsert.error) throw new Error(projectInsert.error.message);

    const waInsert = await admin.from("work_areas").insert({
      id: workAreaId,
      org_id: orgA,
      project_id: projectId,
      type: "deck",
      name: "Deck",
      status: "confirmed",
      sort_order: 0,
    });
    if (waInsert.error) throw new Error(waInsert.error.message);

    const workArea: EstimateWorkArea = {
      id: workAreaId,
      type: "deck",
      name: "Deck",
      sort_order: 1,
    };

    const userClientA = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signA = await userClientA.auth.signInWithPassword({
      email: emailA,
      password: PASSWORD,
    });
    check("authenticated own-org sign-in", !signA.error, signA.error?.message);
    if (signA.error) {
      throw new Error(signA.error.message);
    }

    const resultA = calculateEstimate(buildContext(projectId, workArea, 18.5));
    const persistA = await persistEstimateGeneration(
      userClientA,
      orgA,
      projectId,
      resultA
    );
    check("generation A persist succeeds", Boolean(persistA.snapshotId));
    const snapshotIdA = persistA.snapshotId;
    const generationIdA = persistA.generationId;
    const estimateId = persistA.estimateId;

    const { data: estimateA } = await admin
      .from("estimates")
      .select(
        "status, is_stale, requirement_generation_id, latest_requirement_snapshot_id, recommended_sell"
      )
      .eq("id", estimateId)
      .single();
    check("estimate A is ready/current", estimateA?.status === "ready" && estimateA.is_stale === false);
    check(
      "estimate A generation_id matches snapshot",
      estimateA?.requirement_generation_id === generationIdA
    );
    check(
      "estimate A latest_requirement_snapshot_id points at snapshot A",
      estimateA?.latest_requirement_snapshot_id === snapshotIdA
    );

    const { data: snapRowA } = await admin
      .from("estimate_requirement_snapshots")
      .select("*")
      .eq("id", snapshotIdA)
      .single();
    const payloadA = parseEstimateRequirementSnapshot(snapRowA?.payload);
    check(
      "snapshot A payload parses as v1",
      payloadA.schemaVersion === "estimate-requirement-snapshot-v1"
    );
    check(
      "snapshot A contains decking.surface + deck.labour",
      payloadA.requirements.some(
        (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY
      ) &&
        payloadA.requirements.some(
          (item) => item.componentKey === DECK_LABOUR_COMPONENT_KEY
        )
    );
    check(
      "snapshot A authorities are SHADOW for both Deck components",
      payloadA.componentAuthorities.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.authority === "SHADOW"
      ) &&
        payloadA.componentAuthorities.some(
          (item) =>
            item.componentKey === DECK_LABOUR_COMPONENT_KEY &&
            item.authority === "SHADOW"
        )
    );

    const { data: linesA } = await admin
      .from("estimate_line_items")
      .select("id, component_key, recommended_sell")
      .eq("estimate_id", estimateId);
    const surfaceLineA = (linesA ?? []).find(
      (row) => row.component_key === DECK_SURFACE_COMPONENT_KEY
    );
    const labourLineA = (linesA ?? []).find(
      (row) => row.component_key === DECK_LABOUR_COMPONENT_KEY
    );
    check("persisted estimate lines include decking.surface", surfaceLineA != null);
    check("persisted estimate lines include deck.labour", labourLineA != null);
    check(
      "estimate totals remain line-sum authority",
      Math.abs(
        Number(estimateA?.recommended_sell ?? 0) -
          (linesA ?? []).reduce(
            (sum, row) => sum + Number(row.recommended_sell ?? 0),
            0
          )
      ) < 0.02
    );
    const sellA = Number(estimateA?.recommended_sell ?? 0);

    const pricingP1 = await insertPricing(admin, {
      orgId: orgA,
      projectId,
      estimateId,
      snapshotId: snapshotIdA,
      userId: userA,
      title: `REQ-4A-PROOF P1 ${suffix}`,
      sell: sellA,
      componentKey: DECK_SURFACE_COMPONENT_KEY,
      sourceLineId: surfaceLineA?.id ?? null,
    });
    const { data: p1 } = await admin
      .from("pricing_documents")
      .select("requirement_snapshot_id")
      .eq("id", pricingP1)
      .single();
    check("Pricing P1 requirement_snapshot_id = A", p1?.requirement_snapshot_id === snapshotIdA);
    const { data: p1Item } = await admin
      .from("pricing_items")
      .select("component_key")
      .eq("pricing_document_id", pricingP1)
      .maybeSingle();
    check(
      "Pricing P1 copies component_key decking.surface",
      p1Item?.component_key === DECK_SURFACE_COMPONENT_KEY
    );

    const quoteId = randomUUID();
    const quoteInsert = await admin.from("quotes").insert({
      id: quoteId,
      org_id: orgA,
      project_id: projectId,
      pricing_document_id: pricingP1,
      estimate_id: estimateId,
      title: `REQ-4A-PROOF Q1 ${suffix}`,
      status: "draft",
      subtotal: sellA,
      gst_rate: 15,
      gst_amount: sellA * 0.15,
      total_incl_gst: sellA * 1.15,
      created_by: userA,
    });
    check("Quote Q1 created from P1 (draft only)", !quoteInsert.error, quoteInsert.error?.message);

    const resultB = calculateEstimate(buildContext(projectId, workArea, 21));
    const persistB = await persistEstimateGeneration(
      userClientA,
      orgA,
      projectId,
      resultB
    );
    check("generation B persist succeeds", Boolean(persistB.snapshotId));
    const snapshotIdB = persistB.snapshotId;
    const generationIdB = persistB.generationId;
    check("generation IDs A and B differ", generationIdA !== generationIdB);
    check("snapshot IDs A and B differ", snapshotIdA !== snapshotIdB);

    const { data: estimateB } = await admin
      .from("estimates")
      .select("latest_requirement_snapshot_id, requirement_generation_id, recommended_sell")
      .eq("id", estimateId)
      .single();
    check(
      "estimate current pointer moved to B",
      estimateB?.latest_requirement_snapshot_id === snapshotIdB &&
        estimateB.requirement_generation_id === generationIdB
    );

    const { data: snapAAfter } = await admin
      .from("estimate_requirement_snapshots")
      .select("generation_id, payload")
      .eq("id", snapshotIdA)
      .single();
    const rereadA = parseEstimateRequirementSnapshot(snapAAfter?.payload);
    check(
      "snapshot A remains readable and unchanged after B",
      snapAAfter?.generation_id === generationIdA &&
        rereadA.generationId === payloadA.generationId &&
        rereadA.requirements.length === payloadA.requirements.length
    );

    const { data: p1After } = await admin
      .from("pricing_documents")
      .select("requirement_snapshot_id, subtotal_sell")
      .eq("id", pricingP1)
      .single();
    check(
      "Pricing P1 still links A after estimate B",
      p1After?.requirement_snapshot_id === snapshotIdA
    );

    const pricingP2 = await insertPricing(admin, {
      orgId: orgA,
      projectId,
      estimateId,
      snapshotId: snapshotIdB,
      userId: userA,
      title: `REQ-4A-PROOF P2 ${suffix}`,
      sell: Number(estimateB?.recommended_sell ?? 0),
      componentKey: DECK_SURFACE_COMPONENT_KEY,
      sourceLineId: null,
    });
    const { data: p2 } = await admin
      .from("pricing_documents")
      .select("requirement_snapshot_id")
      .eq("id", pricingP2)
      .single();
    check("Pricing P2 requirement_snapshot_id = B", p2?.requirement_snapshot_id === snapshotIdB);

    const { data: q1Lineage } = await admin
      .from("quotes")
      .select("pricing_document_id")
      .eq("id", quoteId)
      .single();
    check("Quote Q1 still points at Pricing P1", q1Lineage?.pricing_document_id === pricingP1);
    check(
      "Quote Q1 → P1 → snapshot A",
      q1Lineage?.pricing_document_id === pricingP1 &&
        p1After?.requirement_snapshot_id === snapshotIdA
    );

    const ownRead = await userClientA
      .from("estimate_requirement_snapshots")
      .select("id")
      .eq("id", snapshotIdA);
    check(
      "authenticated own-org SELECT snapshot succeeds",
      (ownRead.data ?? []).length === 1,
      ownRead.error?.message
    );
    const ownUpdate = await userClientA
      .from("estimate_requirement_snapshots")
      .update({ schema_version: "mutated" })
      .eq("id", snapshotIdA);
    check(
      "authenticated UPDATE snapshot fails",
      Boolean(ownUpdate.error)
    );
    const ownDelete = await userClientA
      .from("estimate_requirement_snapshots")
      .delete()
      .eq("id", snapshotIdA);
    check("authenticated DELETE snapshot fails", Boolean(ownDelete.error));

    const userClientB = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signB = await userClientB.auth.signInWithPassword({
      email: emailB,
      password: PASSWORD,
    });
    check("cross-org user sign-in", !signB.error, signB.error?.message);
    const crossRead = await userClientB
      .from("estimate_requirement_snapshots")
      .select("id")
      .eq("id", snapshotIdA);
    check(
      "authenticated cross-org SELECT snapshot returns no rows",
      (crossRead.data ?? []).length === 0 && !crossRead.error
    );

    const triggerUpdate = await admin
      .from("estimate_requirement_snapshots")
      .update({ schema_version: "mutated" })
      .eq("id", snapshotIdA);
    check(
      "immutability trigger rejects update even as service role",
      Boolean(triggerUpdate.error) &&
        (triggerUpdate.error?.message.includes("REQ_SNAPSHOT:IMMUTABLE") ?? false),
      triggerUpdate.error?.message
    );

    const requirementCostSum = (resultA.requirements ?? []).reduce(
      (sum, item) =>
        sum +
        (item.kind === "material" || item.kind === "labour"
          ? item.totalCost ?? 0
          : 0),
      0
    );
    const includedCost = resultA.lineItems
      .filter((item) => item.includedInTotal !== false)
      .reduce((sum, item) => sum + item.recommendedCost, 0);
    check(
      "estimate money still from lines (no requirement totals)",
      requirementCostSum > 0 &&
        Math.abs(resultA.recommendedCost - includedCost) < 0.02 &&
        resultA.recommendedCost !== resultA.recommendedCost + requirementCostSum
    );
  } finally {
    await cleanup(admin, orgIds, userIds);
    console.log("Disposed REQ-4A-PROOF organisations and auth users.");
  }

  console.log(`\n=== REQ-4A remote proof: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
