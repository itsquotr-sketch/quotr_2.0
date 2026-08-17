/**
 * DECK-1B remote Preview structural shadow proof.
 *
 * Uses authenticated persistEstimateGenerationViaRpc against linked quotr_2.0.
 * Disposable org labelled DECK-1B-PROOF. Run after branch Preview deploy:
 *   npx tsx scripts/verify-deck-1b-remote-preview-structural-proof.ts
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
import {
  getComponentCommercialAuthority,
  generationRequiresRequirementSnapshot,
} from "../lib/estimate/component-authority";
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
const PASSWORD = `deck1b-${randomUUID()}`;

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

function deckRef01Facts(workAreaId: string): EstimateFact[] {
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
    fact("deck.framing_treatment", workAreaId, "H3.2"),
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

function buildDeckRefContext(params: {
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

async function main() {
  console.log("=== DECK-1B remote Preview structural shadow proof ===\n");

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
    const suffix = randomUUID().slice(0, 8);
    const email = `deck1b-proof-${suffix}@example.invalid`;

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
      name: `DECK-1B-PROOF disposable ${suffix}`,
    });
    orgIds.push(orgId);
    await admin.from("profiles").insert({
      id: userId,
      org_id: orgId,
      role: "owner",
      full_name: "DECK-1B proof",
    });
    await admin.from("projects").insert({
      id: projectId,
      org_id: orgId,
      created_by: userId,
      title: `DECK-1B-PROOF Deck ${suffix}`,
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

    const refFacts = deckRef01Facts(workAreaId);
    const factRows = refFacts.map((row) => ({
      org_id: orgId,
      project_id: projectId,
      work_area_id: workAreaId,
      key: row.key,
      label: row.key,
      value: row.value,
      source: "user",
    }));
    const { error: insertFactsError } = await admin
      .from("project_facts")
      .insert(factRows);
    check("project_facts insert ok", !insertFactsError, insertFactsError?.message ?? "");

    const { data: readBack, error: readError } = await admin
      .from("project_facts")
      .select("key, value, work_area_id")
      .eq("project_id", projectId)
      .eq("work_area_id", workAreaId);
    check("project_facts read ok", !readError && (readBack?.length ?? 0) >= 17);
    const reloadedFacts: EstimateFact[] = (readBack ?? []).map((row) => ({
      key: row.key,
      work_area_id: row.work_area_id ?? workAreaId,
      value: row.value,
    }));
    check(
      "reload preserves joist centres 450",
      reloadedFacts.find((row) => row.key === "deck.joist_centres_mm")?.value === 450
    );

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

    const refEstimate = calculateEstimate(
      buildDeckRefContext({ projectId, workArea, facts: reloadedFacts })
    );
    const joistReq = materialReq(refEstimate, DECK_JOISTS_COMPONENT_KEY);
    check("DECK-REF-01 joists purchase 42.32", joistReq?.purchaseQuantity === 42.32);
    check(
      "DECK-REF-01 rim purchase 10.92",
      materialReq(refEstimate, DECK_RIM_FRAMING_COMPONENT_KEY)?.purchaseQuantity === 10.92
    );
    check(
      "DECK-REF-01 bearers purchase 10.92",
      materialReq(refEstimate, DECK_BEARERS_COMPONENT_KEY)?.purchaseQuantity === 10.92
    );
    check(
      "DECK-REF-01 supports 8 EA",
      materialReq(refEstimate, DECK_SUPPORTS_COMPONENT_KEY)?.purchaseQuantity === 8
    );
    check(
      "DECK-REF-01 concrete 0.324 m3",
      materialReq(refEstimate, DECK_CONCRETE_COMPONENT_KEY)?.purchaseQuantity === 0.324
    );
    check(
      "legacy substructure line present",
      refEstimate.lineItems.some((item) => item.label === "Framing/substructure")
    );
    check(
      "no structural line on money",
      refEstimate.lineItems.every(
        (item) =>
          !DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.includes(
            item.componentKey as (typeof DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS)[number]
          )
      )
    );

    const generationId = createGenerationId();
    const persist = await persistEstimateGenerationViaRpc(
      userClient,
      buildPersistEstimateGenerationV1({
        projectId,
        generationId,
        estimateResult: refEstimate,
      })
    );
    check("persist ok", persist.ok, persist.ok ? "" : persist.message);
    if (!persist.ok) throw new Error(persist.message);

    const { data: snapRow } = await admin
      .from("estimate_requirement_snapshots")
      .select("payload")
      .eq("id", persist.result.snapshot_id)
      .single();
    const parsed = parseEstimateRequirementSnapshot(snapRow?.payload);
    const snapJoist = parsed.requirements.find(
      (item) => item.kind === "material" && item.componentKey === DECK_JOISTS_COMPONENT_KEY
    ) as MaterialRequirement | undefined;
    check("snapshot joists shadow 42.32", snapJoist?.purchaseQuantity === 42.32);
    check(
      "snapshot surface REQUIREMENT authority",
      parsed.componentAuthorities.some(
        (item) =>
          item.componentKey === DECK_SURFACE_COMPONENT_KEY &&
          item.authority === "REQUIREMENT_AUTHORITATIVE"
      )
    );
    check(
      "snapshot labour SHADOW",
      parsed.componentAuthorities.some(
        (item) =>
          item.componentKey === DECK_LABOUR_COMPONENT_KEY &&
          item.authority === "SHADOW"
      )
    );
    check(
      "snapshot structural children present",
      DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.every((key) =>
        parsed.requirements.some(
          (item) => item.kind === "material" && item.componentKey === key
        )
      )
    );

    const centres400Facts = reloadedFacts.map((row) =>
      row.key === "deck.joist_centres_mm"
        ? fact("deck.joist_centres_mm", workAreaId, 400)
        : row
    );
    await admin
      .from("project_facts")
      .update({ value: 400 })
      .eq("project_id", projectId)
      .eq("work_area_id", workAreaId)
      .eq("key", "deck.joist_centres_mm");

    const regen400 = calculateEstimate(
      buildDeckRefContext({ projectId, workArea, facts: centres400Facts })
    );
    check(
      "400 centres joist purchase 45.57",
      materialReq(regen400, DECK_JOISTS_COMPONENT_KEY)?.purchaseQuantity === 45.57
    );
    check(
      "400 centres no spacing default assumption",
      !materialReq(regen400, DECK_JOISTS_COMPONENT_KEY)?.assumptions.some(
        (item) => item.key === "deck.joists.spacing_default"
      )
    );
    check(
      "400 centres legacy substructure unchanged",
      regen400.lineItems.find((item) => item.label === "Framing/substructure")
        ?.quantity === 16.12
    );

    const partialFacts = centres400Facts.filter(
      (row) =>
        ![
          "deck.footing_length_mm",
          "deck.footing_width_mm",
          "deck.footing_depth_mm",
        ].includes(row.key)
    );
    const partial = calculateEstimate(
      buildDeckRefContext({ projectId, workArea, facts: partialFacts })
    );
    check(
      "partial maturity omits concrete only",
      materialReq(partial, DECK_CONCRETE_COMPONENT_KEY) == null &&
        materialReq(partial, DECK_JOISTS_COMPONENT_KEY) != null
    );
    check(
      "partial maturity money unchanged",
      partial.lineItems.find((item) => item.label === "Framing/substructure")
        ?.quantity === 16.12
    );
  } finally {
    await cleanup(admin, orgIds, userIds);
    check("disposable cleanup attempted", true);
  }

  console.log(`\n=== DECK-1B remote Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
