/**
 * CAT-IDENTITY-01 remote Preview identity smoke.
 *
 * Disposable org labelled CAT-IDENTITY-01-PROOF. Run after branch Preview deploy:
 *   npx tsx scripts/verify-cat-identity-01-remote-preview.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
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
import { getComponentCommercialAuthority } from "../lib/estimate/component-authority";
import {
  buildPersistEstimateGenerationV1,
  persistEstimateGenerationViaRpc,
} from "../lib/estimate/persist-estimate-generation";
import { createGenerationId } from "../lib/estimate/requirement-snapshot-persist";
import { parseEstimateRequirementSnapshot } from "../lib/estimate/requirement-snapshot";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { MaterialRequirement } from "../lib/estimate/requirements";

config({ path: ".env.local" });

const EXPECTED_REF = "lxvnylhsbvudzzupxeqr";
const STABLE_PREVIEW =
  "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app";
const PASSWORD = `catid01-${randomUUID()}`;

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

function deckBaseFacts(workAreaId: string): EstimateFact[] {
  return [
    fact("deck.length_m", workAreaId, 5.2),
    fact("deck.width_m", workAreaId, 3.1),
    fact("deck.area_m2", workAreaId, 16.12),
    fact("deck.board_material", workAreaId, "Hardwood"),
    fact("deck.board_width_mm", workAreaId, 140),
    fact("deck.height_m", workAreaId, 0.4),
    fact("deck.substructure_included", workAreaId, true),
    fact("deck.joist_section", workAreaId, "140x45"),
    fact("deck.joist_centres_mm", workAreaId, 450),
    fact("deck.bearer_section", workAreaId, "190x45"),
    fact("deck.bearer_row_count", workAreaId, 2),
    fact("deck.support_type", workAreaId, "Post"),
    fact("deck.supports_per_bearer", workAreaId, 4),
    fact("deck.support_section", workAreaId, "90x90"),
    fact("deck.footing_length_mm", workAreaId, 300),
    fact("deck.footing_width_mm", workAreaId, 300),
    fact("deck.footing_depth_mm", workAreaId, 450),
  ];
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
    rates: [],
  } as unknown as EstimateContext;
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
  console.log("=== CAT-IDENTITY-01 remote Preview identity smoke ===\n");

  check(
    "decking.surface REQUIREMENT_AUTHORITATIVE",
    getComponentCommercialAuthority({
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
    }).authority === "REQUIREMENT_AUTHORITATIVE"
  );
  check(
    "structural children SHADOW/LEGACY",
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
    const email = `catid01-proof-${suffix}@example.invalid`;

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
      name: `CAT-IDENTITY-01-PROOF disposable ${suffix}`,
    });
    orgIds.push(orgId);
    await admin.from("profiles").insert({
      id: userId,
      org_id: orgId,
      role: "owner",
      full_name: "CAT-IDENTITY-01 proof",
    });
    await admin.from("projects").insert({
      id: projectId,
      org_id: orgId,
      created_by: userId,
      title: `CAT-IDENTITY-01-PROOF Deck ${suffix}`,
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

    const unknownFacts = deckBaseFacts(workAreaId);
    const { error: insertFactsError } = await admin.from("project_facts").insert(
      unknownFacts.map((row) => ({
        org_id: orgId,
        project_id: projectId,
        work_area_id: workAreaId,
        key: row.key,
        label: row.key,
        value: row.value,
        source: "user",
      }))
    );
    check("A facts insert ok", !insertFactsError, insertFactsError?.message ?? "");

    const estimateA = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: unknownFacts })
    );
    const joistA = materialReq(estimateA, DECK_JOISTS_COMPONENT_KEY);
    const rimA = materialReq(estimateA, DECK_RIM_FRAMING_COMPONENT_KEY);
    const sellA = Math.round(estimateA.recommendedSell);
    check("A joists 42.32 lm", joistA?.purchaseQuantity === 42.32);
    check("A rim 10.92 lm", rimA?.purchaseQuantity === 10.92);
    check(
      "A treatment unknown",
      joistA?.materialIdentity?.treatmentKind === "unknown" &&
        joistA.materialIdentity.treatment == null &&
        joistA.materialIdentity.grade == null
    );
    check("A priced=false", joistA?.priced === false && rimA?.priced === false);
    check(
      "A legacy substructure present",
      estimateA.lineItems.some((item) => item.label === "Framing/substructure")
    );
    check(
      "A no structural money lines",
      estimateA.lineItems.every(
        (item) =>
          !DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.includes(
            item.componentKey as (typeof DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS)[number]
          )
      )
    );

    const snapA = await persistAndParse(userClient, admin, projectId, estimateA);
    const snapJoistA = snapMaterial(snapA, DECK_JOISTS_COMPONENT_KEY);
    check(
      "A snapshot retains unknown treatment identity",
      snapJoistA?.purchaseQuantity === 42.32 &&
        snapJoistA.materialIdentity?.section === "140x45" &&
        snapJoistA.materialIdentity.treatmentKind === "unknown" &&
        snapJoistA.priced === false
    );

    await admin
      .from("project_facts")
      .update({ value: "200x50" })
      .eq("project_id", projectId)
      .eq("work_area_id", workAreaId)
      .eq("key", "deck.joist_section");
    const customFacts = unknownFacts.map((row) =>
      row.key === "deck.joist_section"
        ? fact("deck.joist_section", workAreaId, "200x50")
        : row
    );
    const estimateB = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: customFacts })
    );
    const joistB = materialReq(estimateB, DECK_JOISTS_COMPONENT_KEY);
    check("B custom 200x50 section valid", joistB?.materialIdentity?.section === "200x50");
    check("B quantity emits", joistB != null && joistB.purchaseQuantity === 42.32);
    check("B priced=false", joistB?.priced === false);
    check("B sell unchanged vs A", Math.round(estimateB.recommendedSell) === sellA);
    const snapB = await persistAndParse(userClient, admin, projectId, estimateB);
    const snapJoistB = snapMaterial(snapB, DECK_JOISTS_COMPONENT_KEY);
    check(
      "B snapshot retains custom section identity",
      snapJoistB?.materialIdentity?.section === "200x50" &&
        snapJoistB.priced === false
    );

    await admin.from("project_facts").insert({
      org_id: orgId,
      project_id: projectId,
      work_area_id: workAreaId,
      key: "deck.framing_treatment",
      label: "deck.framing_treatment",
      value: "H3.2",
      source: "user",
    });
    await admin
      .from("project_facts")
      .update({ value: "140x45" })
      .eq("project_id", projectId)
      .eq("work_area_id", workAreaId)
      .eq("key", "deck.joist_section");
    const knownFacts = [
      ...unknownFacts,
      fact("deck.framing_treatment", workAreaId, "H3.2"),
    ];
    const estimateC = calculateEstimate(
      buildDeckContext({ projectId, workArea, facts: knownFacts })
    );
    const joistC = materialReq(estimateC, DECK_JOISTS_COMPONENT_KEY);
    const bearerC = materialReq(estimateC, DECK_BEARERS_COMPONENT_KEY);
    const concreteC = materialReq(estimateC, DECK_CONCRETE_COMPONENT_KEY);
    const supportC = materialReq(estimateC, DECK_SUPPORTS_COMPONENT_KEY);
    check(
      "C known H3.2 identity",
      joistC?.materialIdentity?.treatment === "h3.2" &&
        joistC.materialIdentity.treatmentKind === "known" &&
        joistC.materialIdentity.grade == null
    );
    check("C joists still 42.32", joistC?.purchaseQuantity === 42.32);
    check("C bearers 10.92", bearerC?.purchaseQuantity === 10.92);
    check("C supports 8 EA", supportC?.purchaseQuantity === 8 && supportC.purchaseUnit === "ea");
    check(
      "C concrete 0.324 mix unknown",
      concreteC?.purchaseQuantity === 0.324 &&
        concreteC.materialIdentity?.family === "concrete" &&
        concreteC.materialIdentity.grade == null &&
        concreteC.priced === false
    );
    check("C priced=false without rates", joistC?.priced === false);
    check("C sell unchanged vs A", Math.round(estimateC.recommendedSell) === sellA);
    const snapC = await persistAndParse(userClient, admin, projectId, estimateC);
    const snapJoistC = snapMaterial(snapC, DECK_JOISTS_COMPONENT_KEY);
    check(
      "C snapshot retains known H3.2 unknown grade",
      snapJoistC?.materialIdentity?.treatment === "h3.2" &&
        snapJoistC.materialIdentity.treatmentKind === "known" &&
        snapJoistC.materialIdentity.grade == null
    );
    check(
      "C snapshot structural SHADOW authorities",
      DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.every((key) =>
        snapC.componentAuthorities.some(
          (item) =>
            item.componentKey === key && item.authority === "LEGACY_AUTHORITATIVE"
        )
      )
    );
    check(
      "C snapshot surface REQUIREMENT_AUTHORITATIVE",
      snapC.componentAuthorities.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.authority === "REQUIREMENT_AUTHORITATIVE"
      )
    );
    check(
      "C snapshot labour SHADOW",
      snapC.componentAuthorities.some(
        (item) =>
          item.componentKey === DECK_LABOUR_COMPONENT_KEY &&
          item.authority === "SHADOW"
      )
    );
  } finally {
    await cleanup(admin, orgIds, userIds);
    check("disposable cleanup attempted", true);
  }

  console.log(
    `\n=== CAT-IDENTITY-01 remote Preview Results: ${passed} passed, ${failed} failed ===`
  );
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
