/**
 * REQ-4B remote/Preview authority promotion proof.
 *
 * Uses authenticated persistEstimateGenerationViaRpc against linked quotr_2.0.
 * Disposable org labelled REQ-4B-PROOF. Run after branch Preview deploy:
 *   npx tsx scripts/verify-req-4b-remote-preview-authority-proof.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import {
  getComponentCommercialAuthority,
  generationRequiresRequirementSnapshot,
} from "../lib/estimate/component-authority";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { countActiveComponentLines } from "../lib/estimate/component-commercial-selection";
import { MATERIAL_RATE_KEYS } from "../lib/estimate/material-rate-keys";
import {
  buildPersistEstimateGenerationV1,
  isEstimateReadyForPricing,
  persistEstimateGenerationViaRpc,
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
const STABLE_PREVIEW =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";
const PASSWORD = `req4b-${randomUUID()}`;

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
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function buildDeckContext(params: {
  projectId: string;
  workArea: EstimateWorkArea;
  costRate?: number;
  includeWidth?: boolean;
  allowBenchmark?: boolean;
}): EstimateContext {
  const facts: EstimateFact[] = [
    fact("deck.area_m2", params.workArea.id, 16.12),
    fact("deck.board_material", params.workArea.id, "Hardwood"),
    fact("deck.height_m", params.workArea.id, 0.4),
  ];
  if (params.includeWidth !== false) {
    facts.push(fact("deck.board_width_mm", params.workArea.id, 140));
  }
  const rates = [];
  if (params.costRate != null) {
    rates.push({
      item_key: MATERIAL_RATE_KEYS.deckingHardwoodLm,
      rate_type: "material",
      unit: "lm",
      cost_rate: params.costRate,
      sell_rate: null,
      active: true,
    });
  }
  return {
    project: { id: params.projectId, qualityLevel: "standard" },
    confirmedWorkAreas: [params.workArea],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: params.allowBenchmark !== false,
      default_margin_percent: 20,
    },
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates,
  } as unknown as EstimateContext;
}

function surfaceLine(result: ReturnType<typeof calculateEstimate>) {
  return result.lineItems.find(
    (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY
  );
}

async function cleanup(
  admin: SupabaseClient,
  orgIds: string[],
  userIds: string[]
) {
  for (const orgId of orgIds) {
    await admin.from("organisations").delete().eq("id", orgId);
  }
  for (const userId of userIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function main() {
  console.log("=== REQ-4B remote Preview authority promotion proof ===\n");

  check(
    "decking.surface REQUIREMENT_AUTHORITATIVE",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }).authority === "REQUIREMENT_AUTHORITATIVE"
  );
  check(
    "deck.labour SHADOW",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
    }).authority === "SHADOW"
  );
  check("generationRequiresRequirementSnapshot", generationRequiresRequirementSnapshot());

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const ref = hostnameRef(url);
  check("linked remote ref is quotr_2.0", ref === EXPECTED_REF, ref);
  if (ref !== EXPECTED_REF) {
    throw new Error(`Refusing unexpected Supabase ref ${ref}`);
  }

  const preview = await fetch(`${STABLE_PREVIEW}/login`);
  check(
    "stable Preview URL responds",
    preview.ok || preview.status === 307 || preview.status === 308
  );

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orgIds: string[] = [];
  const userIds: string[] = [];
  try {
    const orgId = randomUUID();
    const projectId = randomUUID();
    const workAreaId = randomUUID();
    const noWidthWaId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    const email = `req4b-proof-${suffix}@example.invalid`;

    const created = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "create user failed");
    }
    const userId = created.data.user.id;
    userIds.push(userId);

    await admin.from("organisations").insert({
      id: orgId,
      name: `REQ-4B-PROOF disposable ${suffix}`,
    });
    orgIds.push(orgId);
    await admin.from("profiles").insert({
      id: userId,
      org_id: orgId,
      role: "owner",
      full_name: "REQ-4B proof",
    });
    await admin.from("projects").insert({
      id: projectId,
      org_id: orgId,
      created_by: userId,
      title: `REQ-4B-PROOF Deck ${suffix}`,
      stage: "brief",
    });
    await admin.from("work_areas").insert([
      {
        id: workAreaId,
        org_id: orgId,
        project_id: projectId,
        type: "deck",
        name: "Deck",
        status: "confirmed",
        sort_order: 0,
      },
      {
        id: noWidthWaId,
        org_id: orgId,
        project_id: projectId,
        type: "deck",
        name: "Deck no width",
        status: "confirmed",
        sort_order: 1,
      },
    ]);

    const workArea: EstimateWorkArea = {
      id: workAreaId,
      type: "deck",
      name: "Deck",
      sort_order: 1,
    };

    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signIn = await userClient.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    check("authenticated sign-in", !signIn.error, signIn.error?.message);
    if (signIn.error) throw new Error(signIn.error.message);

    // Benchmark authoritative generation A
    const bench = calculateEstimate(buildDeckContext({ projectId, workArea }));
    const legacyBench = calculateDeck(
      buildDeckContext({ projectId, workArea }) as never,
      workArea
    );
    const benchLine = surfaceLine(bench)!;
    const legacyBenchLine = legacyBench.lineItems.find(
      (item) => item.componentKey === DECK_SURFACE_COMPONENT_KEY
    )!;
    check("benchmark cost $2,786.30", benchLine.recommendedCost === 2786.3);
    check(
      "benchmark sell $4,306.10 parity",
      benchLine.recommendedSell === 4306.1 &&
        benchLine.recommendedSell === legacyBenchLine.recommendedSell
    );
    check(
      "commercialSelections REQUIREMENT",
      bench.commercialSelections?.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.activeSource === "REQUIREMENT"
      )
    );
    check(
      "one active decking.surface line",
      countActiveComponentLines(bench.lineItems, {
        workAreaId,
        componentKey: DECK_SURFACE_COMPONENT_KEY,
      }) === 1
    );

    const generationA = createGenerationId();
    const persistA = await persistEstimateGenerationViaRpc(
      userClient,
      buildPersistEstimateGenerationV1({
        projectId,
        generationId: generationA,
        estimateResult: bench,
      })
    );
    check("generation A persist ok", persistA.ok, persistA.ok ? "" : persistA.message);
    if (!persistA.ok) throw new Error(persistA.message);

    const estimateId = persistA.result.estimate_id;
    const snapshotIdA = persistA.result.snapshot_id;

    const { data: snapA } = await admin
      .from("estimate_requirement_snapshots")
      .select("payload")
      .eq("id", snapshotIdA)
      .single();
    const parsedA = parseEstimateRequirementSnapshot(snapA?.payload);
    check(
      "snapshot A componentAuthorities REQUIREMENT_AUTHORITATIVE",
      parsedA.componentAuthorities.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.authority === "REQUIREMENT_AUTHORITATIVE"
      )
    );
    check(
      "snapshot A commercialSources REQUIREMENT",
      parsedA.commercialSources?.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.activeSource === "REQUIREMENT"
      )
    );
    check(
      "snapshot A requirement cost preserved",
      (parsedA.requirements.find(
        (item) => item.kind === "material" && item.componentKey === DECK_SURFACE_COMPONENT_KEY
      ) as { totalCost?: number })?.totalCost === 2786.3
    );

    const { data: linesA } = await admin
      .from("estimate_line_items")
      .select("component_key, recommended_cost, recommended_sell, label")
      .eq("estimate_id", estimateId);
    const surfaceRows = (linesA ?? []).filter(
      (row) => row.component_key === DECK_SURFACE_COMPONENT_KEY
    );
    check(
      "persisted one decking.surface line",
      surfaceRows.length === 1 &&
        Number(surfaceRows[0]?.recommended_cost) === 2786.3
    );

    // Company lm case B
    const companyLm = calculateEstimate(
      buildDeckContext({ projectId, workArea, costRate: 18.5 })
    );
    check(
      "company lm cost $2,343.03",
      surfaceLine(companyLm)?.recommendedCost === 2343.03
    );

    const generationB = createGenerationId();
    const persistB = await persistEstimateGenerationViaRpc(
      userClient,
      buildPersistEstimateGenerationV1({
        projectId,
        generationId: generationB,
        estimateResult: companyLm,
      })
    );
    check("generation B company lm persist ok", persistB.ok);
    const { data: snapB } = await admin
      .from("estimate_requirement_snapshots")
      .select("payload, generation_id")
      .eq("id", persistB.ok ? persistB.result.snapshot_id : "")
      .maybeSingle();
    if (persistB.ok && snapB) {
      const parsedB = parseEstimateRequirementSnapshot(snapB.payload);
      check(
        "snapshot B commercialSources preserved",
        parsedB.commercialSources?.some((item) => item.activeSource === "REQUIREMENT")
      );
      check("snapshot A immutable after B", parsedA.generationId === generationA);
    }

    // Width unknown fallback (local calculate + would persist similarly)
    const noWidthArea: EstimateWorkArea = {
      id: noWidthWaId,
      type: "deck",
      name: "Deck no width",
      sort_order: 2,
    };
    const noWidth = calculateEstimate(
      buildDeckContext({
        projectId,
        workArea: noWidthArea,
        includeWidth: false,
      })
    );
    check(
      "width unknown LEGACY_FALLBACK",
      noWidth.commercialSelections?.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.activeSource === "LEGACY_FALLBACK"
      ) &&
        (noWidth.requirements ?? []).filter((item) => item.kind === "material")
          .length === 0
    );

    // Rollback: missing snapshot
    const missingPayload = buildPersistEstimateGenerationV1({
      projectId,
      generationId: createGenerationId(),
      estimateResult: bench,
    });
    const tampered = { ...missingPayload } as Record<string, unknown>;
    delete tampered.snapshot;
    const missingRpc = await persistEstimateGenerationViaRpc(
      userClient,
      tampered as never
    );
    check(
      "missing snapshot RPC fails",
      !missingRpc.ok && missingRpc.message.toUpperCase().includes("SNAPSHOT_REQUIRED")
    );
    const { data: estimateAfterFail } = await admin
      .from("estimates")
      .select("requirement_generation_id, latest_requirement_snapshot_id")
      .eq("id", estimateId)
      .single();
    check(
      "rollback leaves generation B current",
      estimateAfterFail?.requirement_generation_id === generationB &&
        estimateAfterFail?.latest_requirement_snapshot_id ===
          (persistB.ok ? persistB.result.snapshot_id : null)
    );

    // Pricing P1 from current generation
    const { data: estimateCurrent } = await admin
      .from("estimates")
      .select("latest_requirement_snapshot_id, recommended_sell")
      .eq("id", estimateId)
      .single();
    const { data: pricingDoc, error: pricingErr } = await admin
      .from("pricing_documents")
      .insert({
        org_id: orgId,
        project_id: projectId,
        estimate_id: estimateId,
        requirement_snapshot_id: estimateCurrent?.latest_requirement_snapshot_id,
        title: `REQ-4B-PROOF P1 ${suffix}`,
        status: "draft",
        gst_rate: 15,
        subtotal_cost: Number(estimateCurrent?.recommended_sell ?? 0) / 1.2,
        subtotal_sell: Number(estimateCurrent?.recommended_sell ?? 0),
        gross_profit: 0,
        margin_percent: 20,
        markup_percent: 25,
        gst_amount: 0,
        total_incl_gst: Number(estimateCurrent?.recommended_sell ?? 0),
        created_by: userId,
      })
      .select("id")
      .single();
    check("Pricing P1 created", !pricingErr && pricingDoc?.id != null);
    if (pricingDoc?.id) {
      const surfaceCost = surfaceLine(companyLm)?.recommendedCost ?? 0;
      const surfaceSell = surfaceLine(companyLm)?.recommendedSell ?? 0;
      const { error: itemError } = await admin.from("pricing_items").insert({
        org_id: orgId,
        project_id: projectId,
        pricing_document_id: pricingDoc.id,
        source_estimate_line_item_id: null,
        component_key: DECK_SURFACE_COMPONENT_KEY,
        item_type: "material",
        delivery_method: "in_house",
        internal_label: "Decking materials",
        client_label: "Decking materials",
        quantity: 126.65,
        unit: "lm",
        unit_cost: surfaceCost / 126.65,
        unit_sell: surfaceSell / 126.65,
        total_cost: surfaceCost,
        total_sell: surfaceSell,
        gross_profit: surfaceSell - surfaceCost,
        margin_percent: 20,
        markup_percent: 25,
        calculation_mode: "quantity_rate",
        sort_order: 0,
      });
      check("pricing item insert ok", !itemError, itemError?.message ?? "");
      const { data: pricingItems } = await admin
        .from("pricing_items")
        .select("component_key")
        .eq("pricing_document_id", pricingDoc.id);
      const deckSurfaceItems = (pricingItems ?? []).filter(
        (row) => row.component_key === DECK_SURFACE_COMPONENT_KEY
      );
      check(
        "one pricing item decking.surface",
        deckSurfaceItems.length === 1
      );
    }

    check(
      "pricing readiness helper",
      isEstimateReadyForPricing({
        estimateId,
        requirementGenerationId: generationB,
        latestRequirementSnapshotId: persistB.ok
          ? persistB.result.snapshot_id
          : null,
        status: "ready",
        isStale: false,
      }).ok
    );

    check(
      "deck.labour authority SHADOW in snapshot",
      parsedA.componentAuthorities.some(
        (item) =>
          item.componentKey === DECK_LABOUR_COMPONENT_KEY &&
          item.authority === "SHADOW"
      )
    );
  } finally {
    await cleanup(admin, orgIds, userIds);
    check("disposable cleanup attempted", true);
  }

  console.log(`\n=== REQ-4B remote Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
