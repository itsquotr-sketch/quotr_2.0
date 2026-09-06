/**
 * DNA-V2B.1 — data-only catalogue seed + Preview persistence close.
 *
 * Static: npx --yes tsx scripts/verify-dna-v2b1-catalogue-seed.ts
 * Live Preview: npx --yes tsx scripts/verify-dna-v2b1-catalogue-seed.ts --live
 *
 * Production is never in scope. Plus-address fixtures only.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { COMPANY_DNA_TASKS, getCompanyDnaTask } from "../lib/company-dna/catalogue";
import {
  COMPANY_DNA_V2B_DEFERRED_KEYS,
  COMPANY_DNA_V2B_NEW_TASKS,
  companyDnaPersistableCatalogueFields,
  listCompanyDnaTasksVisibleInCurrentUi,
} from "../lib/company-dna/v2-foundation";
import { calculateFence } from "../lib/estimate/calculators/fence";
import {
  productivityUnitsCompatible,
  resolveProductivity,
} from "../lib/estimate/productivity";
import { summarizeProductivityWorkAreas } from "../lib/rates/productivity-work-area-summary";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  assertSafePreviewPasswordMutation,
  isPasswordProtectedPreviewAccount,
  PREVIEW_PASSWORD_PROTECTED_EMAILS,
} from "./lib/preview-auth-fixture";
import type { OrganisationRate } from "../components/setup/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

const LIVE = process.argv.includes("--live");
const MIGRATION_NAME = "054_company_dna_v2_catalogue_seed.sql";
const V1_KEYS = [
  "deck.framing.v1",
  "deck.decking.v1",
  "deck.posts.v1",
  "deck.demolition.v1",
  "fence.posts.v1",
  "fence.boards.v1",
  "fence.rails.v1",
  "retaining_wall.piles.v1",
  "retaining_wall.face.v1",
] as const;

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

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function sqlValueBlock(sql: string, key: string): string {
  const token = `'${key}'`;
  const start = sql.indexOf(token);
  if (start < 0) return "";
  const end = sql.indexOf("\n  ),", start);
  return sql.slice(start, end < 0 ? start + 1200 : end);
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "f1", value };
}

function wa(): EstimateWorkArea & { status: "confirmed" } {
  return { id: "f1", type: "fence", name: "Fence", sort_order: 1, status: "confirmed" };
}

function fenceCtx(rates: OrganisationRate[] = []): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts: [
      fact("fence.length_m", 18),
      fact("fence.height_m", 1.8),
      fact("fence.system", "Timber paling — vertical board"),
      fact("fence.timber_species", "Radiata Pine"),
      fact("fence.board_thickness_mm", "150 × 19mm"),
      fact("fence.post_spacing_m", 1.8),
      fact("fence.gate_included", false),
      fact("fence.top_capping", "No"),
      fact("fence.vertical_paling_gap_mm", 0),
      fact("fence.demolition_required", true),
    ],
    constraints: [
      { key: "site_access", value: "Moderate" },
      { key: "material_carry_distance", value: "10–30m" },
    ],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: null,
    rates: [
      {
        id: "labour.carpenter.hour",
        rate_type: "labour",
        item_key: "labour.carpenter.hour",
        label: "Carpenter",
        unit: "hour",
        cost_rate: 60,
        sell_rate: null,
        markup_percent: null,
        active: true,
        trade: "carpenter",
        work_area_type: "fence",
        source: "explicit_company",
      },
      ...rates,
    ],
  } as EstimateContext;
}

console.log("=== DNA-V2B.1 CATALOGUE SEED ===\n");

const sql = read(`supabase/migrations/${MIGRATION_NAME}`);
const insertSql = sql.split("Historical V1")[0] ?? sql;
const actions = read("lib/company-dna/actions.ts");
const migrations = numberedMigrations();

const sqlCode = sql.replace(/--[^\n]*/g, "");
check("054 file present", existsSync(join(process.cwd(), "supabase/migrations", MIGRATION_NAME)));
check("latest numbered migration is 054", migrations.at(-1) === MIGRATION_NAME);
check("053 remains in chain", migrations.includes("053_role_aware_rls_hardening.sql"));
check("052 V1 seed remains", migrations.includes("052_company_productivity_calibration.sql"));
check("no ALTER TABLE", !/\balter\s+table\b/i.test(sqlCode));
check("no CREATE TABLE", !/\bcreate\s+table\b/i.test(sqlCode));
check("no CREATE POLICY / RLS", !/\bcreate\s+policy\b/i.test(sqlCode) && !/\benable\s+row level\b/i.test(sqlCode));
check("no RPC rewrite", !sql.includes("save_productivity_calibration"));
check("no response UPDATE/DELETE", !/\bupdate\s+public\.productivity_calibration_responses\b/i.test(sql));
check("no rates UPDATE/DELETE", !/\bupdate\s+public\.rates\b/i.test(sql) && !/\bdelete\s+from\s+public\.rates\b/i.test(sql));
check("INSERT uses ON CONFLICT DO NOTHING", sql.includes("on conflict (calibration_task_key) do nothing"));
check("does not INSERT V1 keys", V1_KEYS.every((key) => !insertSql.includes(`'${key}'`)));
check("V1 integrity check present", sql.includes("DNA-V2B.1: V1 deck.framing.v1 mutated"));
check("no protected-account emails", PREVIEW_PASSWORD_PROTECTED_EMAILS.every((email) => !sql.includes(email)));
check("no admin password mutation", !sql.includes("updateUserById") && !actions.includes("updateUserById"));

check("V1 live catalogue still 9", COMPANY_DNA_TASKS.length === 9);
check("current UI still 9", listCompanyDnaTasksVisibleInCurrentUi().length === 9);
check(
  "Rates Fence/RW remain V1 counts",
  summarizeProductivityWorkAreas([]).every((row) => {
    if (row.workAreaType === "deck") return row.taskTotal === 7 && row.keyTaskTotal === 3;
    const v1Count = COMPANY_DNA_TASKS.filter(
      (task) => task.workAreaType === row.workAreaType
    ).length;
    return row.taskTotal === v1Count;
  })
);
check(
  "server action uses unified resolver",
  actions.includes("resolveCompanyDnaTask") &&
    !actions.includes("getCompanyDnaTask(")
);
check("V1 lookup rejects fascia", getCompanyDnaTask("deck.fascia.v1") == null);

const newKeys = COMPANY_DNA_V2B_NEW_TASKS.map((task) => task.calibrationTaskKey);
check("exactly 22 new foundation keys", newKeys.length === 22);
check("no key collision with V1", newKeys.every((key) => !V1_KEYS.includes(key as (typeof V1_KEYS)[number])));
check(
  "no steps seed",
  !insertSql.includes("deck.steps.v1") &&
    !insertSql.includes("deck.steps.install.hours_per_m2") &&
    COMPANY_DNA_V2B_DEFERRED_KEYS.includes("deck.steps.install.hours_per_m2")
);
check(
  "no extra pile split keys",
  (insertSql.match(/retaining_wall\.piles/g) ?? []).length === 0 &&
    sql.includes("RW pile catalogue must stay a single V1 key")
);

const forbidden = [
  "fence.labour_hours_per_lm",
  "fence.gate_hours_allowance",
  "deck.base_labour_hours_per_m2",
  "retaining_wall.base_labour_hours_per_face_m2",
];
check(
  "package lumps not seeded",
  forbidden.every((key) => !insertSql.includes(`'${key}'`))
);

for (const task of COMPANY_DNA_V2B_NEW_TASKS) {
  const fields = companyDnaPersistableCatalogueFields(task);
  const block = sqlValueBlock(insertSql, fields.calibrationTaskKey);
  check(
    `${fields.calibrationTaskKey} seeded`,
    block.length > 0 &&
      block.includes(`'${fields.productivityRateKey}'`) &&
      block.includes(`'${fields.workAreaType}'`) &&
      block.includes(`'${fields.authorityUnit}'`) &&
      block.includes(fields.prompt) &&
      block.includes(String(fields.authorityQuantity)) &&
      block.includes(String(fields.benchmarkProductivity)) &&
      block.includes(fields.isHighImpact ? "true" : "false")
  );
  check(
    `${fields.calibrationTaskKey} hidden from V1 UI`,
    task.exposeInCurrentUi === false
  );
  check(
    `${fields.calibrationTaskKey} benchmark > 0`,
    fields.benchmarkProductivity > 0 && Number.isFinite(fields.benchmarkProductivity)
  );
}

const v1Migration = read("supabase/migrations/052_company_productivity_calibration.sql");
for (const key of V1_KEYS) {
  const live = COMPANY_DNA_TASKS.find((task) => task.calibrationTaskKey === key);
  check(`V1 ${key} still in 052`, v1Migration.includes(`'${key}'`));
  check(`V1 ${key} still live`, live != null);
}

check(
  "V1 framing identity unchanged",
  COMPANY_DNA_TASKS.find((task) => task.calibrationTaskKey === "deck.framing.v1")
    ?.authorityQuantity === 80 &&
    COMPANY_DNA_TASKS.find((task) => task.calibrationTaskKey === "deck.framing.v1")
      ?.benchmarkProductivity === 0.13
);

const baselineFence = calculateFence(fenceCtx(), wa());
const calibratedFence = calculateFence(
  fenceCtx([
    {
      id: "fence.demolition_hours_per_lm",
      rate_type: "productivity",
      item_key: "fence.demolition_hours_per_lm",
      label: "Fence removal labour",
      unit: "lm",
      cost_rate: 0.5,
      sell_rate: null,
      markup_percent: null,
      active: true,
      trade: null,
      work_area_type: "fence",
      source: "calibrated_productivity",
      source_calibration_id: "ev-v2b1",
    },
  ]),
  wa()
);
const demoA = baselineFence.lineItems.find((item) => item.label === "Existing fence removal");
const demoB = calibratedFence.lineItems.find((item) => item.label === "Existing fence removal");
check("fence demolition line present", demoA != null && demoB != null);
check("fence demolition quantity unchanged", demoA?.quantity === 18 && demoB?.quantity === 18);
check(
  "fence demolition company hours win",
  (demoB?.labourHours ?? 0) > (demoA?.labourHours ?? 0)
);
const benchDemo = resolveProductivity({
  productivityKey: "fence.demolition_hours_per_lm",
  unit: "lm",
  fallbackHoursPerUnit: 0.25,
});
check("fence demolition benchmark fallback", benchDemo.hoursPerUnit === 0.25);

const architecture = read("docs/architecture/QUOTR_COMPANY_DNA_V2_ARCHITECTURE.md");
check("architecture records 054 seed", architecture.includes("054_company_dna_v2_catalogue_seed.sql"));
check("architecture records V1 UX still narrower", architecture.includes("V1 live UX remains 9 tasks"));

if (!LIVE) {
  console.log("\n(skip live Preview probe — pass --live)\n");
  console.log(`=== ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runLive()
  .then(() => {
    /* runLive prints the summary */
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

async function runLive(): Promise<void> {
  console.log("\n--- Live Preview ---");
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const anon = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = local.SUPABASE_SERVICE_ROLE_KEY;
  check("Preview env present", Boolean(url && anon && service));
  if (!url || !anon || !service) {
    console.log(`=== ${passed} passed, ${failed} failed ===`);
    process.exit(1);
  }
  const ref = hostnameRef(url);
  check("live target is Preview ref", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: catalogue, error: catalogueError } = await admin
    .from("productivity_calibration_catalogue")
    .select(
      "calibration_task_key, productivity_rate_key, authority_quantity, authority_unit, benchmark_productivity, work_area_type"
    );
  check("catalogue select ok", !catalogueError, catalogueError?.message ?? "");
  const rows = catalogue ?? [];
  const byKey = new Map(rows.map((row) => [row.calibration_task_key, row]));

  for (const key of V1_KEYS) {
    check(`Preview DB still has V1 ${key}`, byKey.has(key));
  }
  const framing = byKey.get("deck.framing.v1");
  check(
    "Preview V1 framing unchanged",
    Number(framing?.authority_quantity) === 80 &&
      framing?.authority_unit === "lm" &&
      Number(framing?.benchmark_productivity) === 0.13
  );

  const duplicates = rows.filter(
    (row, index) =>
      rows.findIndex((other) => other.calibration_task_key === row.calibration_task_key) !==
      index
  );
  check("no duplicate catalogue keys", duplicates.length === 0);

  for (const task of COMPANY_DNA_V2B_NEW_TASKS) {
    const row = byKey.get(task.calibrationTaskKey);
    check(`Preview DB has ${task.calibrationTaskKey}`, row != null);
    check(
      `Preview ${task.calibrationTaskKey} maps estimator key`,
      row?.productivity_rate_key === task.productivityRateKey
    );
    check(
      `Preview ${task.calibrationTaskKey} unit ${task.authorityUnit}`,
      row?.authority_unit === task.authorityUnit &&
        productivityUnitsCompatible(String(row?.authority_unit), task.authorityUnit)
    );
    check(
      `Preview ${task.calibrationTaskKey} benchmark`,
      Number(row?.benchmark_productivity) === task.benchmarkProductivity
    );
    check(
      `Preview ${task.calibrationTaskKey} authority qty`,
      Number(row?.authority_quantity) === task.authorityQuantity
    );
  }
  check("Preview has no steps key", !byKey.has("deck.steps.v1"));
  check(
    "Preview has one pile key",
    rows.filter((row) => row.calibration_task_key.startsWith("retaining_wall.piles")).length === 1
  );

  const suffix = randomUUID().slice(0, 8);
  const email = `dna-v2b1+fascia-${suffix}@example.invalid`;
  const password = `v2b1-${randomUUID()}`;
  const orgId = randomUUID();
  let userId: string | null = null;

  try {
    assertSafePreviewPasswordMutation(email);
    check("probe email is plus-address fixture", email.includes("+"));
    check(
      "probe is not a protected inbox",
      !isPasswordProtectedPreviewAccount(email)
    );

    const orgInsert = await admin.from("organisations").insert({
      id: orgId,
      name: `DNA-V2B.1 probe ${suffix}`,
    });
    if (orgInsert.error) throw new Error(orgInsert.message);

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "createUser failed");
    }
    userId = created.data.user.id;

    const profileError = (
      await admin.from("profiles").upsert({
        id: userId,
        org_id: orgId,
        role: "owner",
        full_name: "DNA-V2B.1 probe",
      })
    ).error;
    if (profileError) throw new Error(profileError.message);

    const membershipError = (
      await admin.from("organisation_memberships").insert({
        org_id: orgId,
        user_id: userId,
        role: "owner",
        status: "active",
        joined_at: new Date().toISOString(),
      })
    ).error;
    if (membershipError) throw new Error(membershipError.message);

    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(signedIn.error.message);

    const saved = await client.rpc("save_productivity_calibration", {
      p_calibration_task_key: "deck.fascia.v1",
      p_crew_size: 2,
      p_duration_hours: 4,
      p_outlier_confirmed: false,
    });
    check("fascia RPC save ok", !saved.error, saved.error?.message ?? "");
    const payload = (saved.data ?? {}) as Record<string, unknown>;
    const derived = Number(payload.derived_productivity);
    check("derived productivity is 0.4444 (2×4h / 18 lm)", derived === 0.4444);

    const { data: responseRows } = await admin
      .from("productivity_calibration_responses")
      .select("id, derived_productivity, authority_quantity, status, org_id")
      .eq("org_id", orgId)
      .eq("calibration_task_key", "deck.fascia.v1")
      .eq("status", "active");
    const evidence = responseRows?.[0];
    check("evidence row saved", evidence != null && Number(evidence.authority_quantity) === 18);

    const { data: rateRows } = await admin
      .from("rates")
      .select("item_key, cost_rate, unit, source, source_calibration_id, org_id, active")
      .eq("org_id", orgId)
      .eq("item_key", "deck.fascia.install.hours_per_lm")
      .eq("rate_type", "productivity");
    const rate = rateRows?.[0];
    check(
      "organisation rate provenance",
      rate?.source === "calibrated_productivity" &&
        rate?.source_calibration_id === evidence?.id &&
        Number(rate?.cost_rate) === 0.4444 &&
        rate?.active === true
    );

    const resolved = resolveProductivity({
      productivityKey: "deck.fascia.install.hours_per_lm",
      unit: "lm",
      fallbackHoursPerUnit: 0.45,
      rates: [
        {
          id: "probe",
          rate_type: "productivity",
          item_key: "deck.fascia.install.hours_per_lm",
          label: "Fascia",
          unit: "lm",
          cost_rate: Number(rate?.cost_rate),
          sell_rate: null,
          markup_percent: null,
          active: true,
          trade: null,
          work_area_type: "deck",
          source: "calibrated_productivity",
          source_calibration_id: String(rate?.source_calibration_id ?? ""),
        },
      ],
    });
    check(
      "estimator consumes company fascia productivity",
      resolved.hoursPerUnit === 0.4444 && resolved.hoursPerUnit !== 0.45
    );

    const { count: otherCalibrations } = await admin
      .from("productivity_calibration_responses")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .neq("calibration_task_key", "deck.fascia.v1");
    check("probe did not create extra calibrations", (otherCalibrations ?? 0) === 0);
  } catch (error) {
    check("live fascia persistence probe", false, error instanceof Error ? error.message : String(error));
  } finally {
    await admin.from("rates").delete().eq("org_id", orgId);
    await admin.from("productivity_calibration_responses").delete().eq("org_id", orgId);
    await admin.from("organisation_memberships").delete().eq("org_id", orgId);
    await admin.from("profiles").delete().eq("org_id", orgId);
    await admin.from("organisations").delete().eq("id", orgId);
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
    check("probe fixture cleaned up", true);
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}
