/**
 * DECK-1C-B2 remote Preview structural benchmark proof.
 *
 * Disposable org labelled DECK-1C-B2-PROOF. Run after branch Preview deploy:
 *   npx tsx scripts/verify-deck-1c-b2-remote-preview-structural-benchmarks.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import { deckRateRef01Facts } from "../lib/estimate/deck-rate-ref-01";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS,
  DECK_SUPPORTS_COMPONENT_KEY,
} from "../lib/estimate/deck-structure";
import { DECK_LABOUR_COMPONENT_KEY } from "../lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "../lib/estimate/deck-surface-requirement";
import { round2 } from "../lib/estimate/facts";
import {
  buildPersistEstimateGenerationV1,
  persistEstimateGenerationViaRpc,
} from "../lib/estimate/persist-estimate-generation";
import { createGenerationId } from "../lib/estimate/requirement-snapshot-persist";
import { parseEstimateRequirementSnapshot } from "../lib/estimate/requirement-snapshot";
import {
  NZ_GST_INCLUSIVE_DIVISOR,
  STRUCTURAL_TIMBER_BENCHMARKS,
} from "../lib/estimate/structural-timber-benchmarks";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import {
  buildStructuralTimberIdentity,
  serializeMaterialIdentityKey,
} from "../lib/materials/identity";

config({ path: ".env.local" });

const EXPECTED_REF = "lxvnylhsbvudzzupxeqr";
const STABLE_PREVIEW =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";
const PASSWORD = `deck1cb2-${randomUUID()}`;

const expected140 = round2(75.35 / 4.8 / NZ_GST_INCLUSIVE_DIVISOR);
const expected190 = round2(125.09 / 6.0 / NZ_GST_INCLUSIVE_DIVISOR);

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

function materialReq(
  result: ReturnType<typeof calculateEstimate>,
  componentKey: string
): MaterialRequirement | undefined {
  return result.requirements?.find(
    (item): item is MaterialRequirement =>
      item.kind === "material" && item.componentKey === componentKey
  );
}

function snapMaterial(
  parsed: ReturnType<typeof parseEstimateRequirementSnapshot>,
  componentKey: string
): MaterialRequirement | undefined {
  return parsed.requirements.find(
    (item): item is MaterialRequirement =>
      item.kind === "material" && item.componentKey === componentKey
  );
}

function buildDeckContext(params: {
  projectId: string;
  workArea: EstimateWorkArea;
  facts: EstimateFact[];
  rates?: OrganisationRate[];
}): EstimateContext {
  return {
    project: { id: params.projectId, qualityLevel: "standard" },
    confirmedWorkAreas: [params.workArea],
    facts: params.facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: params.rates ?? [],
  } as unknown as EstimateContext;
}

function kd140ItemKey(): string {
  const identity = buildStructuralTimberIdentity({
    sectionRaw: "140x45",
    gradeRaw: "SG8",
    treatmentRaw: "H3.2",
    processingRaw: "KD",
  });
  if (!identity) throw new Error("failed to build 140x45 identity");
  return `${serializeMaterialIdentityKey(identity)}.lm`;
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

async function persistAndParse(
  userClient: ReturnType<typeof createClient>,
  admin: SupabaseClient,
  projectId: string,
  estimateResult: ReturnType<typeof calculateEstimate>
) {
  const persist = await persistEstimateGenerationViaRpc(
    userClient,
    buildPersistEstimateGenerationV1({
      projectId,
      generationId: createGenerationId(),
      estimateResult,
    })
  );
  if (!persist.ok) {
    throw new Error(persist.message);
  }
  const { data: snapRow } = await admin
    .from("estimate_requirement_snapshots")
    .select("payload")
    .eq("id", persist.result.snapshot_id)
    .single();
  return parseEstimateRequirementSnapshot(snapRow?.payload);
}

async function main() {
  console.log("=== DECK-1C-B2 remote Preview structural benchmark proof ===\n");

  check(
    "decking.surface REQUIREMENT_AUTHORITATIVE",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }).authority === "REQUIREMENT_AUTHORITATIVE"
  );
  check(
    "structural children LEGACY (shadow)",
    DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.every(
      (key) =>
        getComponentCommercialAuthority({
          workAreaType: "deck",
          componentKey: key,
        }).authority === "LEGACY_AUTHORITATIVE"
    )
  );
  check(
    "deck.labour SHADOW",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
    }).authority === "SHADOW"
  );
  check("three Quotr benchmark records only", STRUCTURAL_TIMBER_BENCHMARKS.length === 3);

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
    const suffix = randomUUID().slice(0, 8);
    const email = `deck1cb2-proof-${suffix}@example.invalid`;

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
      name: `DECK-1C-B2-PROOF disposable ${suffix}`,
    });
    orgIds.push(orgId);
    await admin.from("profiles").insert({
      id: userId,
      org_id: orgId,
      role: "owner",
      full_name: "DECK-1C-B2 proof",
    });
    await admin.from("projects").insert({
      id: projectId,
      org_id: orgId,
      created_by: userId,
      title: `DECK-RATE-REF-01 Preview ${suffix}`,
      stage: "brief",
    });
    await admin.from("work_areas").insert({
      id: workAreaId,
      org_id: orgId,
      project_id: projectId,
      type: "deck",
      name: "Deck",
      status: "confirmed",
      sort_order: 0,
    });

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

    const rateFacts = deckRateRef01Facts(workAreaId);
    rateFacts.push(fact("deck.substructure_included", workAreaId, true));
    const { error: insertFactsError } = await admin.from("project_facts").insert(
      rateFacts.map((row) => ({
        org_id: orgId,
        project_id: projectId,
        work_area_id: workAreaId,
        key: row.key,
        label: row.key,
        value: row.value,
        source: "user",
      }))
    );
    check("DECK-RATE-REF-01 facts insert ok", !insertFactsError, insertFactsError?.message ?? "");

    const baseline = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: rateFacts })
    );
    const sellBaseline = Math.round(baseline.recommendedSell);
    const joist = materialReq(baseline, DECK_JOISTS_COMPONENT_KEY);
    const rim = materialReq(baseline, DECK_RIM_FRAMING_COMPONENT_KEY);
    const bearer = materialReq(baseline, DECK_BEARERS_COMPONENT_KEY);
    const supports = materialReq(baseline, DECK_SUPPORTS_COMPONENT_KEY);
    const concrete = materialReq(baseline, DECK_CONCRETE_COMPONENT_KEY);

    check("joists 42.32 lm benchmark", joist?.purchaseQuantity === 42.32);
    check("joists rate 13.65/lm", joist?.unitCost === expected140);
    check("joists cost 577.67", joist?.totalCost === round2(42.32 * expected140));
    check("joists rateSource=benchmark", joist?.rateSource === "benchmark");
    check("rim 10.92 lm", rim?.purchaseQuantity === 10.92);
    check("rim cost 149.06", rim?.totalCost === round2(10.92 * expected140));
    check("rim rateSource=benchmark", rim?.rateSource === "benchmark");
    check("bearers 10.92 lm", bearer?.purchaseQuantity === 10.92);
    check("bearers rate 18.13/lm", bearer?.unitCost === expected190);
    check("bearers cost 197.98", bearer?.totalCost === round2(10.92 * expected190));
    check("supports 8 EA priced=false", supports?.purchaseQuantity === 8 && supports.priced === false);
    check(
      "concrete 0.324 m3 priced=false",
      concrete?.purchaseQuantity === 0.324 && concrete.priced === false
    );
    check(
      "no structural child line items in commercial total",
      baseline.lineItems.every(
        (item) =>
          !DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.includes(
            item.componentKey as (typeof DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS)[number]
          )
      )
    );
    check(
      "legacy Framing/substructure present",
      baseline.lineItems.some((item) => item.label === "Framing/substructure")
    );
    check(
      "partial coverage note",
      baseline.deckSubstructureReconciliation?.commercialNote.includes(
        "PARTIAL PRICED STRUCTURAL CHILD COST"
      )
    );

    const snapBaseline = await persistAndParse(userClient, admin, projectId, baseline);
    const snapJoist = snapMaterial(snapBaseline, DECK_JOISTS_COMPONENT_KEY);
    check(
      "snapshot benchmark provenance",
      snapJoist?.rateSource === "benchmark" &&
        snapJoist.materialIdentity?.processing === "kd" &&
        snapJoist.rateEvidence?.normalizedRateExGst === expected140 &&
        snapJoist.rateEvidence?.sourceURL?.includes("bunnings.co.nz") &&
        snapJoist.rateEvidence?.sourcePrice === 75.35 &&
        snapJoist.rateEvidence?.gstBasis === "inclusive" &&
        snapJoist.totalCost === joist?.totalCost
    );
    check(
      "snapshot immutability fields present",
      snapJoist?.rateEvidence?.researchedAt === "2026-08-18" &&
        snapJoist.rateEvidence?.verifiedAt === "2026-08-18" &&
        snapJoist.rateEvidence?.evidenceId === "T01"
    );

    const unknownGradeFacts = rateFacts.map((row) =>
      row.key === "deck.framing_treatment"
        ? fact("deck.framing_treatment", workAreaId, "H3.2 KD")
        : row
    );
    const negA = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: unknownGradeFacts })
    );
    check(
      "A grade unknown — no benchmark",
      materialReq(negA, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
        materialReq(negA, DECK_JOISTS_COMPONENT_KEY)?.purchaseQuantity === 42.32
    );

    const unknownTreatmentFacts = rateFacts.map((row) =>
      row.key === "deck.framing_treatment"
        ? fact("deck.framing_treatment", workAreaId, "SG8 KD")
        : row
    );
    const negB = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: unknownTreatmentFacts })
    );
    check(
      "B treatment unknown — no benchmark",
      materialReq(negB, DECK_JOISTS_COMPONENT_KEY)?.priced === false
    );

    const unknownProcessingFacts = rateFacts.map((row) =>
      row.key === "deck.framing_treatment"
        ? fact("deck.framing_treatment", workAreaId, "H3.2 SG8")
        : row
    );
    const negC = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: unknownProcessingFacts })
    );
    check(
      "C processing unknown — no benchmark",
      materialReq(negC, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
        materialReq(negC, DECK_JOISTS_COMPONENT_KEY)?.materialIdentity?.processingKind ===
          "unknown"
    );

    const greenFacts = rateFacts.map((row) =>
      row.key === "deck.framing_treatment"
        ? fact("deck.framing_treatment", workAreaId, "H3.2 SG8 green")
        : row
    );
    const negD = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: greenFacts })
    );
    check(
      "D green — no KD benchmark",
      materialReq(negD, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
        materialReq(negD, DECK_JOISTS_COMPONENT_KEY)?.materialIdentity?.processing === "green"
    );

    const customFacts = rateFacts.map((row) =>
      row.key === "deck.joist_section"
        ? fact("deck.joist_section", workAreaId, "200x50")
        : row
    );
    const negE = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: customFacts })
    );
    check(
      "E 200x50 custom — no benchmark",
      materialReq(negE, DECK_JOISTS_COMPONENT_KEY)?.priced === false &&
        materialReq(negE, DECK_JOISTS_COMPONENT_KEY)?.materialIdentity?.section === "200x50"
    );
    check("negative cases sell unchanged", Math.round(negE.recommendedSell) === sellBaseline);

    const itemKey = kd140ItemKey();
    const companyRateId = randomUUID();
    await admin.from("rates").insert({
      id: companyRateId,
      org_id: orgId,
      rate_type: "material",
      item_key: itemKey,
      label: "Disposable company 140x45",
      unit: "lm",
      cost_rate: 20,
      sell_rate: null,
      active: true,
    });
    const companyRates: OrganisationRate[] = [
      {
        id: companyRateId,
        rate_type: "material",
        trade: null,
        work_area_type: "deck",
        item_key: itemKey,
        label: "Disposable company 140x45",
        unit: "lm",
        cost_rate: 20,
        sell_rate: null,
        markup_percent: null,
        active: true,
      },
    ];
    const companyDeck = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: rateFacts, rates: companyRates })
    );
    check(
      "company exact outranks benchmark",
      materialReq(companyDeck, DECK_JOISTS_COMPONENT_KEY)?.rateSource === "company" &&
        materialReq(companyDeck, DECK_JOISTS_COMPONENT_KEY)?.unitCost === 20
    );
    check(
      "company precedence sell unchanged",
      Math.round(companyDeck.recommendedSell) === sellBaseline
    );
    const snapCompany = await persistAndParse(userClient, admin, projectId, companyDeck);
    check(
      "company snapshot rateSource=company",
      snapMaterial(snapCompany, DECK_JOISTS_COMPONENT_KEY)?.rateSource === "company"
    );

    const projectRateId = randomUUID();
    await admin.from("rates").insert({
      id: projectRateId,
      org_id: orgId,
      rate_type: "project_material",
      item_key: itemKey,
      label: "Disposable project 140x45",
      unit: "lm",
      cost_rate: 25,
      sell_rate: null,
      active: true,
    });
    const projectRates: OrganisationRate[] = [
      ...companyRates,
      {
        id: projectRateId,
        rate_type: "project_material",
        trade: null,
        work_area_type: "deck",
        item_key: itemKey,
        label: "Disposable project 140x45",
        unit: "lm",
        cost_rate: 25,
        sell_rate: null,
        markup_percent: null,
        active: true,
      },
    ];
    const projectDeck = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: rateFacts, rates: projectRates })
    );
    check(
      "project override outranks company/benchmark",
      materialReq(projectDeck, DECK_JOISTS_COMPONENT_KEY)?.rateSource === "project_override" &&
        materialReq(projectDeck, DECK_JOISTS_COMPONENT_KEY)?.unitCost === 25
    );
    const snapProject = await persistAndParse(userClient, admin, projectId, projectDeck);
    check(
      "project snapshot rateSource=project_override",
      snapMaterial(snapProject, DECK_JOISTS_COMPONENT_KEY)?.rateSource === "project_override"
    );
  } finally {
    await cleanup(admin, orgIds, userIds);
    check("disposable cleanup attempted", true);
  }

  console.log(
    `\n=== DECK-1C-B2 remote Preview Results: ${passed} passed, ${failed} failed ===`
  );
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
