/**
 * REQ-TXN-01 remote/Preview atomic persist proof.
 *
 * Uses persistEstimateGenerationViaRpc — the same helper persistEstimateResult
 * calls from Preview — against linked quotr_2.0. Creates disposable labelled
 * orgs and deletes them.
 * against linked quotr_2.0. Creates disposable labelled orgs and deletes them.
 *
 * Run:
 *   npx tsx scripts/verify-req-txn-01-remote-preview-atomic-proof.ts
 *
 * Refuses to run unless NEXT_PUBLIC_SUPABASE_URL is lxvnylhsbvudzzupxeqr.
 * Admin/service-role is used only for provisioning, readback, and grant smoke.
 * Estimate persist uses the signed-in user JWT client.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  getComponentCommercialAuthority,
} from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import {
  buildPersistEstimateGenerationV1,
  isEstimateReadyForPricing,
  persistEstimateGenerationViaRpc,
  PERSIST_ESTIMATE_GENERATION_RPC,
} from "../lib/estimate/persist-estimate-generation";
import { createGenerationId } from "../lib/estimate/requirement-snapshot-persist";
import { parseEstimateRequirementSnapshot } from "../lib/estimate/requirement-snapshot";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

config({ path: ".env.local" });

const EXPECTED_REF = "lxvnylhsbvudzzupxeqr";
const PASSWORD = `reqtxn-${randomUUID()}`;
const STABLE_PREVIEW =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";

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

function buildDeckContext(
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

function buildFenceContext(
  projectId: string,
  workArea: EstimateWorkArea
): EstimateContext {
  return {
    project: { id: projectId, qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts: [
      fact("fence.length_m", workArea.id, 20),
      fact("fence.height_m", workArea.id, 1.8),
      fact("fence.material", workArea.id, "Timber"),
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
    rates: [],
  } as unknown as EstimateContext;
}

async function insertPricing(
  admin: SupabaseClient,
  params: {
    orgId: string;
    projectId: string;
    estimateId: string;
    snapshotId: string;
    userId: string;
    title: string;
    sell: number;
    componentKey: string | null;
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
    source_estimate_line_item_id: null,
    item_type: "material",
    delivery_method: "in_house",
    internal_label: "REQ-TXN-01 proof line",
    client_label: "REQ-TXN-01 proof line",
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
  console.log("=== REQ-TXN-01 remote Preview atomic persist proof ===\n");

  if (
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }).authority === "REQUIREMENT_AUTHORITATIVE"
  ) {
    console.log(
      "SKIP  REQ-4B local promotion active — remote Preview still SHADOW until deploy"
    );
    process.exit(0);
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const ref = hostnameRef(url);
  check("linked remote ref is quotr_2.0", ref === EXPECTED_REF, ref);
  if (ref !== EXPECTED_REF) {
    throw new Error(`Refusing to run against unexpected Supabase ref ${ref}`);
  }

  const preview = await fetch(`${STABLE_PREVIEW}/login`);
  check(
    "stable Preview URL responds",
    preview.ok || preview.status === 307 || preview.status === 308
  );

  check(
    "decking.surface remains SHADOW",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }).authority === "SHADOW"
  );
  check(
    "deck.labour remains SHADOW",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
    }).authority === "SHADOW"
  );

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orgIds: string[] = [];
  const userIds: string[] = [];
  try {
    const orgA = randomUUID();
    const orgB = randomUUID();
    const projectId = randomUUID();
    const fenceProjectId = randomUUID();
    const workAreaId = randomUUID();
    const fenceWaId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    const emailA = `reqtxn-proof-a-${suffix}@example.invalid`;
    const emailB = `reqtxn-proof-b-${suffix}@example.invalid`;

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
      { id: orgA, name: `REQ-TXN-01-PROOF disposable A ${suffix}` },
      { id: orgB, name: `REQ-TXN-01-PROOF disposable B ${suffix}` },
    ]);
    if (orgInsert.error) throw new Error(orgInsert.error.message);
    orgIds.push(orgA, orgB);

    const profileInsert = await admin.from("profiles").insert([
      { id: userA, org_id: orgA, role: "owner", full_name: "REQ-TXN proof A" },
      { id: userB, org_id: orgB, role: "owner", full_name: "REQ-TXN proof B" },
    ]);
    if (profileInsert.error) throw new Error(profileInsert.error.message);

    const projectInsert = await admin.from("projects").insert([
      {
        id: projectId,
        org_id: orgA,
        created_by: userA,
        title: `REQ-TXN-01-PROOF Deck ${suffix}`,
        stage: "brief",
      },
      {
        id: fenceProjectId,
        org_id: orgA,
        created_by: userA,
        title: `REQ-TXN-01-PROOF Fence ${suffix}`,
        stage: "brief",
      },
    ]);
    if (projectInsert.error) throw new Error(projectInsert.error.message);

    const waInsert = await admin.from("work_areas").insert([
      {
        id: workAreaId,
        org_id: orgA,
        project_id: projectId,
        type: "deck",
        name: "Deck",
        status: "confirmed",
        sort_order: 0,
      },
      {
        id: fenceWaId,
        org_id: orgA,
        project_id: fenceProjectId,
        type: "fence",
        name: "Fence",
        status: "confirmed",
        sort_order: 0,
      },
    ]);
    if (waInsert.error) throw new Error(waInsert.error.message);

    const workArea: EstimateWorkArea = {
      id: workAreaId,
      type: "deck",
      name: "Deck",
      sort_order: 1,
    };
    const fenceArea: EstimateWorkArea = {
      id: fenceWaId,
      type: "fence",
      name: "Fence",
      sort_order: 1,
    };

    const anonRpc = await anon.rpc(PERSIST_ESTIMATE_GENERATION_RPC, {
      p_payload: { contractVersion: "persist-estimate-generation-v1" },
    });
    check(
      "anon cannot execute persist_estimate_generation_v1",
      Boolean(anonRpc.error)
    );

    const serviceRpc = await admin.rpc(PERSIST_ESTIMATE_GENERATION_RPC, {
      p_payload: { contractVersion: "persist-estimate-generation-v1" },
    });
    check(
      "service_role cannot execute persist_estimate_generation_v1",
      Boolean(serviceRpc.error)
    );

    const userClientA = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signA = await userClientA.auth.signInWithPassword({
      email: emailA,
      password: PASSWORD,
    });
    check("authenticated own-org sign-in", !signA.error, signA.error?.message);
    if (signA.error) throw new Error(signA.error.message);

    const resultA = calculateEstimate(buildDeckContext(projectId, workArea, 18.5));
    const persistA = await persistEstimateGenerationViaRpc(
      userClientA,
      buildPersistEstimateGenerationV1({
        projectId,
        generationId: createGenerationId(),
        estimateResult: resultA,
      })
    );
    check(
      "generation A persistEstimateGenerationViaRpc succeeds",
      persistA.ok,
      persistA.ok ? "" : persistA.message
    );
    if (!persistA.ok) {
      throw new Error(persistA.message);
    }
    check(
      "generation A RPC result includes snapshot_id",
      typeof persistA.result.snapshot_id === "string" &&
        persistA.result.status === "ready"
    );
    const snapshotIdA = persistA.result.snapshot_id;
    const generationIdA = persistA.result.generation_id;
    const estimateId = persistA.result.estimate_id;

    const { data: estimateA } = await admin
      .from("estimates")
      .select(
        "status, requirement_generation_id, latest_requirement_snapshot_id, recommended_sell"
      )
      .eq("id", estimateId)
      .single();
    check("estimate A ready", estimateA?.status === "ready");
    check(
      "estimate A generation/pointer aligned",
      estimateA?.requirement_generation_id === generationIdA &&
        estimateA?.latest_requirement_snapshot_id === snapshotIdA
    );
    check(
      "pricing helper accepts atomic generation A",
      isEstimateReadyForPricing({
        estimateId,
        requirementGenerationId: estimateA?.requirement_generation_id ?? null,
        latestRequirementSnapshotId:
          estimateA?.latest_requirement_snapshot_id ?? null,
        status: estimateA?.status ?? null,
        isStale: false,
      }).ok
    );

    const { data: snapA } = await admin
      .from("estimate_requirement_snapshots")
      .select("id, estimate_id, generation_id, payload")
      .eq("id", snapshotIdA)
      .single();
    const parsedA = parseEstimateRequirementSnapshot(snapA?.payload);
    check(
      "snapshot A generation matches estimate",
      snapA?.generation_id === generationIdA &&
        snapA?.estimate_id === estimateId &&
        parsedA.generationId === generationIdA
    );
    check(
      "Deck requirements emitted: surface + labour",
      parsedA.requirements.some(
        (item) =>
          item.kind === "material" &&
          item.componentKey === DECK_SURFACE_COMPONENT_KEY
      ) &&
        parsedA.requirements.some(
          (item) =>
            item.kind === "labour" &&
            item.componentKey === DECK_LABOUR_COMPONENT_KEY
        )
    );

    const { data: linesA } = await admin
      .from("estimate_line_items")
      .select("component_key")
      .eq("estimate_id", estimateId);
    const keysA = new Set((linesA ?? []).map((row) => row.component_key));
    check(
      "Deck line component_keys retained",
      keysA.has(DECK_SURFACE_COMPONENT_KEY) &&
        keysA.has(DECK_LABOUR_COMPONENT_KEY)
    );

    const sellA = Number(estimateA?.recommended_sell ?? 0);
    const includedCost = resultA.lineItems
      .filter((item) => item.includedInTotal !== false)
      .reduce((sum, item) => sum + item.recommendedCost, 0);
    check(
      "estimate money still from lines",
      Math.abs(resultA.recommendedCost - includedCost) < 0.02
    );

    const missingPayload = buildPersistEstimateGenerationV1({
      projectId,
      generationId: createGenerationId(),
      estimateResult: resultA,
    });
    const missing = { ...missingPayload } as Record<string, unknown>;
    delete missing.snapshot;
    missing.snapshotRequired = false;
    missing.componentAuthorities = [
      {
        workAreaType: "deck",
        componentKey: DECK_SURFACE_COMPONENT_KEY,
        authority: "SHADOW",
      },
    ];
    const missingRpc = await persistEstimateGenerationViaRpc(
      userClientA,
      missing as never
    );
    check(
      "missing snapshot fails via RPC even with snapshotRequired=false / SHADOW authorities",
      !missingRpc.ok &&
        missingRpc.message.toUpperCase().includes("SNAPSHOT_REQUIRED")
    );

    const { data: estimateAfterMissing } = await admin
      .from("estimates")
      .select("requirement_generation_id, latest_requirement_snapshot_id, status")
      .eq("id", estimateId)
      .single();
    check(
      "missing-snapshot leaves generation A current",
      estimateAfterMissing?.requirement_generation_id === generationIdA &&
        estimateAfterMissing?.latest_requirement_snapshot_id === snapshotIdA &&
        estimateAfterMissing?.status === "ready"
    );

    const invalidPayload = buildPersistEstimateGenerationV1({
      projectId,
      generationId: createGenerationId(),
      estimateResult: resultA,
    });
    invalidPayload.snapshot = {
      ...invalidPayload.snapshot,
      generationId: generationIdA,
    };
    const invalidRpc = await persistEstimateGenerationViaRpc(
      userClientA,
      invalidPayload
    );
    check(
      "invalid snapshot generation mismatch fails via RPC",
      !invalidRpc.ok &&
        invalidRpc.message.toUpperCase().includes("INVALID_SNAPSHOT")
    );

    const { data: estimateAfterInvalid } = await admin
      .from("estimates")
      .select("requirement_generation_id, latest_requirement_snapshot_id")
      .eq("id", estimateId)
      .single();
    check(
      "invalid snapshot leaves generation A current",
      estimateAfterInvalid?.requirement_generation_id === generationIdA &&
        estimateAfterInvalid?.latest_requirement_snapshot_id === snapshotIdA
    );

    const pricingP1 = await insertPricing(admin, {
      orgId: orgA,
      projectId,
      estimateId,
      snapshotId: snapshotIdA,
      userId: userA,
      title: `REQ-TXN-01-PROOF P1 ${suffix}`,
      sell: sellA,
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    });
    const quoteId = randomUUID();
    const quoteInsert = await admin.from("quotes").insert({
      id: quoteId,
      org_id: orgA,
      project_id: projectId,
      pricing_document_id: pricingP1,
      estimate_id: estimateId,
      title: `REQ-TXN-01-PROOF Q1 ${suffix}`,
      status: "draft",
      subtotal: sellA,
      gst_rate: 15,
      gst_amount: sellA * 0.15,
      total_incl_gst: sellA * 1.15,
      created_by: userA,
    });
    check("Quote Q1 created from P1 (draft only)", !quoteInsert.error, quoteInsert.error?.message);

    const resultB = calculateEstimate(buildDeckContext(projectId, workArea, 21));
    const persistB = await persistEstimateGenerationViaRpc(
      userClientA,
      buildPersistEstimateGenerationV1({
        projectId,
        generationId: createGenerationId(),
        estimateResult: resultB,
      })
    );
    check(
      "generation B persistEstimateGenerationViaRpc succeeds",
      persistB.ok,
      persistB.ok ? "" : persistB.message
    );
    if (!persistB.ok) {
      throw new Error(persistB.message);
    }
    const snapshotIdB = persistB.result.snapshot_id;
    const generationIdB = persistB.result.generation_id;
    check("generation IDs A and B differ", generationIdA !== generationIdB);
    check("snapshot IDs A and B differ", snapshotIdA !== snapshotIdB);

    const { data: estimateB } = await admin
      .from("estimates")
      .select(
        "latest_requirement_snapshot_id, requirement_generation_id, recommended_sell, status"
      )
      .eq("id", estimateId)
      .single();
    check(
      "estimate current pointer moved to B",
      estimateB?.latest_requirement_snapshot_id === snapshotIdB &&
        estimateB.requirement_generation_id === generationIdB &&
        estimateB.status === "ready"
    );

    const { data: snapAAfter } = await admin
      .from("estimate_requirement_snapshots")
      .select("generation_id")
      .eq("id", snapshotIdA)
      .single();
    check(
      "snapshot A remains after B",
      snapAAfter?.generation_id === generationIdA
    );

    const { data: p1After } = await admin
      .from("pricing_documents")
      .select("requirement_snapshot_id, subtotal_sell")
      .eq("id", pricingP1)
      .single();
    check(
      "Pricing P1 still links A after estimate B",
      p1After?.requirement_snapshot_id === snapshotIdA &&
        Number(p1After?.subtotal_sell) === sellA
    );

    const pricingP2 = await insertPricing(admin, {
      orgId: orgA,
      projectId,
      estimateId,
      snapshotId: snapshotIdB,
      userId: userA,
      title: `REQ-TXN-01-PROOF P2 ${suffix}`,
      sell: Number(estimateB?.recommended_sell ?? 0),
      componentKey: DECK_SURFACE_COMPONENT_KEY,
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
    check(
      "Quote Q1 → P1 → snapshot A after B",
      q1Lineage?.pricing_document_id === pricingP1 &&
        p1After?.requirement_snapshot_id === snapshotIdA
    );

    const fenceResult = calculateEstimate(
      buildFenceContext(fenceProjectId, fenceArea)
    );
    check(
      "Fence calculator emits no requirements",
      (fenceResult.requirements ?? []).length === 0
    );
    const persistFence = await persistEstimateGenerationViaRpc(
      userClientA,
      buildPersistEstimateGenerationV1({
        projectId: fenceProjectId,
        generationId: createGenerationId(),
        estimateResult: fenceResult,
      })
    );
    check(
      "empty-requirement Fence persist succeeds",
      persistFence.ok,
      persistFence.ok ? "" : persistFence.message
    );
    if (persistFence.ok) {
      const { data: fenceEstimate } = await admin
        .from("estimates")
        .select("status, latest_requirement_snapshot_id, requirement_generation_id")
        .eq("id", persistFence.result.estimate_id)
        .single();
      const { data: fenceSnap } = await admin
        .from("estimate_requirement_snapshots")
        .select("payload, generation_id")
        .eq("id", persistFence.result.snapshot_id)
        .single();
      const parsedFence = parseEstimateRequirementSnapshot(fenceSnap?.payload);
      check(
        "empty-requirement snapshot has requirements []",
        Array.isArray(parsedFence.requirements) &&
          parsedFence.requirements.length === 0
      );
      check(
        "empty-requirement estimate ready with pointer",
        fenceEstimate?.status === "ready" &&
          fenceEstimate.latest_requirement_snapshot_id ===
            persistFence.result.snapshot_id &&
          fenceEstimate.requirement_generation_id ===
            persistFence.result.generation_id
      );
    }

    const userClientB = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signB = await userClientB.auth.signInWithPassword({
      email: emailB,
      password: PASSWORD,
    });
    check("cross-org user sign-in", !signB.error, signB.error?.message);
    const crossPersist = await persistEstimateGenerationViaRpc(
      userClientB,
      buildPersistEstimateGenerationV1({
        projectId,
        generationId: createGenerationId(),
        estimateResult: resultA,
      })
    );
    check(
      "cross-org persist fails",
      !crossPersist.ok,
      crossPersist.ok ? "unexpected success" : ""
    );
    const { data: estimateAfterCross } = await admin
      .from("estimates")
      .select("requirement_generation_id")
      .eq("id", estimateId)
      .single();
    check(
      "cross-org persist does not mutate A/B current generation",
      estimateAfterCross?.requirement_generation_id === generationIdB
    );

    const rpcProbe = await persistEstimateGenerationViaRpc(
      userClientA,
      buildPersistEstimateGenerationV1({
        projectId,
        generationId: createGenerationId(),
        estimateResult: resultB,
      })
    );
    check(
      "authenticated RPC return includes snapshot_id (RPC path, not multi-call fallback)",
      rpcProbe.ok && typeof rpcProbe.result.snapshot_id === "string"
    );
  } finally {
    await cleanup(admin, orgIds, userIds);
    console.log("Disposed REQ-TXN-01-PROOF organisations and auth users.");
  }

  console.log(
    `\n=== REQ-TXN-01 remote proof: ${passed} passed, ${failed} failed ===`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
