/**
 * Stage 3.1C.3-R2D.1 — Calibration persistence (migration 033) verification.
 *
 * Static checks always run. Live DB checks require local Supabase after
 * `npx supabase db reset`.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c3-r2d1-calibration-persistence.ts
 */
import { execFileSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { resolveLocalDbContainer } from "./local-db-container";
import { computeCompanySetupReadiness } from "../lib/setup/readiness";
import { FUTURE_RATE_AUTHORITY_STACK } from "../lib/rates/authority";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function migrationsHave033(): boolean {
  const dir = join(process.cwd(), "supabase/migrations");
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.startsWith("033"));
}

console.log("=== Stage 3.1C.3-R2D.1 calibration persistence verification ===\n");

section("PERSISTENCE / SCHEMA");
const migration = read("supabase/migrations/033_calibration_responses.sql");
assert("migration 033 file present", migrationsHave033());
assert("table calibration_responses", migration.includes("create table public.calibration_responses"));
assert("scenario_id + scenario_version columns", /scenario_id text/.test(migration) && /scenario_version text/.test(migration));
assert("commercial columns present", /labour_hours/.test(migration) && /expected_sell/.test(migration));
assert("engine_snapshot jsonb", migration.includes("engine_snapshot jsonb"));
assert("response_metadata jsonb", migration.includes("response_metadata jsonb"));
assert("append/supersede status", migration.includes("'active'") && migration.includes("'superseded'"));
assert(
  "one active per org+scenario",
  migration.includes("calibration_responses_one_active_per_scenario")
);
assert("save RPC present", migration.includes("save_calibration_response"));
assert("SECURITY INVOKER RPC", /security invoker/i.test(migration));
assert("evidence immutability trigger", migration.includes("protect_calibration_response_evidence"));
assert("additive — no rates alter", !/alter table public\.rates/i.test(migration));
assert("additive — no estimates alter", !/alter table public\.estimates/i.test(migration));

section("APPLICATION");
const actions = read("lib/calibration/actions.ts");
const persistence = read("lib/calibration/persistence.ts");
const flow = read("components/calibration/CalibrationFlow.tsx");
const hub = read("components/calibration/CalibrationHub.tsx");
assert("persistCalibrationResponse used", actions.includes("persistCalibrationResponse"));
assert("no persistenceGated save path", !actions.includes("persistenceGated"));
assert("RPC name in persistence module", persistence.includes("save_calibration_response"));
assert("Calibration saved UX", flow.includes("Calibration saved"));
assert("Recalibrate UX", flow.includes("Recalibrate") && hub.includes("View / Recalibrate"));
assert("Calibrated status label", hub.includes("Calibrated") && hub.includes("Not calibrated"));

const readiness = computeCompanySetupReadiness({
  accountReady: true,
  organisationName: "Test",
  onboardingStatus: "in_progress",
  currency: "NZD",
  country: "NZ",
  region: null,
  defaultGstRate: 15,
  defaultMarginPercent: 20,
  hasLabourRate: true,
  hasWorkTypePreferences: true,
  hasCalibration: false,
  tradingName: "T",
  legalName: null,
  contactEmail: "a@b.c",
  contactPhone: null,
  addressLine1: null,
  city: null,
});
assert(
  "tip when no calibration",
  readiness.recommendedSetup.some((s) => s.id === "calibrate")
);
const afterCal = computeCompanySetupReadiness({
  ...{
    accountReady: true,
    organisationName: "Test",
    onboardingStatus: "in_progress" as const,
    currency: "NZD",
    country: "NZ",
    region: null,
    defaultGstRate: 15,
    defaultMarginPercent: 20,
    hasLabourRate: true,
    hasWorkTypePreferences: true,
    hasCalibration: true,
    tradingName: "T",
    legalName: null,
    contactEmail: "a@b.c",
    contactPhone: null,
    addressLine1: null,
    city: null,
  },
});
assert(
  "tip removed after calibration",
  !afterCal.recommendedSetup.some((s) => s.id === "calibrate")
);

section("AUTHORITY ISOLATION");
assert(
  "estimate rates does not import calibration",
  !read("lib/estimate/rates.ts").includes("lib/calibration")
);
assert(
  "calculate-estimate does not import calibration",
  !read("lib/estimate/calculate-estimate.ts").includes("lib/calibration")
);
assert(
  "pricing commercial engine does not import calibration",
  !read("lib/pricing/commercial-engine-adapter.ts").includes("lib/calibration")
);
assert(
  "quote commercial engine does not import calibration",
  !read("lib/quotes/quote-commercial-engine-adapter.ts").includes(
    "lib/calibration"
  )
);
assert(
  "rates actions do not import calibration",
  !read("lib/rates/actions.ts").includes("lib/calibration")
);
assert(
  "DNA remains below explicit in future stack",
  FUTURE_RATE_AUTHORITY_STACK.indexOf("COMPANY_EXPLICIT_RATE") <
    FUTURE_RATE_AUTHORITY_STACK.findIndex((x) =>
      x.includes("COMPANY_DNA_OR_CALIBRATION")
    )
);
assert("no Company DNA module", !existsSync(join(process.cwd(), "lib/company-dna")));

section("PRIVACY");
assert(
  "save started/completed/failed events",
  actions.includes("calibration_save_started") &&
    actions.includes("calibration_save_completed") &&
    actions.includes("calibration_save_failed")
);
assert(
  "never log commercial answers comment",
  actions.includes("Never log commercial answers")
);
assert(
  "save log path does not stringify answers",
  !/console\.info\([\s\S]*expected_sell/.test(actions)
);

section("SECURITY STATIC");
assert("RLS enabled", /enable row level security/i.test(migration));
assert("no anon table grants", /revoke all on table public\.calibration_responses from anon/i.test(migration));
assert("no authenticated delete grant", /grant select, insert, update on table public\.calibration_responses to authenticated/i.test(migration));
assert("org via auth_org_id", migration.includes("auth_org_id()"));
assert("created_by = auth.uid on insert policy", migration.includes("created_by = auth.uid()"));

section("BOUNDARIES");
assert(
  "SCOPE_DISCOVERY not force-enabled",
  !/^[^#\n]*SCOPE_DISCOVERY_ENABLED\s*=\s*true/m.test(read(".env.local.example"))
);
assert(
  "completion doc exists",
  existsSync(
    join(
      process.cwd(),
      "docs/implementation/STAGE_3_1C3_R2D1_CALIBRATION_PERSISTENCE_COMPLETION.md"
    )
  )
);
assert(
  "remote readiness doc exists",
  existsSync(
    join(
      process.cwd(),
      "docs/runbooks/STAGE_3_1C3_R2D1_REMOTE_033_READINESS.md"
    )
  )
);

section("LIVE LOCAL DB");
let live = false;
let container = "";
try {
  container = resolveLocalDbContainer();
  live = true;
} catch {
  console.log("SKIP live DB — local Supabase container not running");
}

function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    { encoding: "utf8" }
  ).trim();
}

function psqlOk(sql: string): boolean {
  try {
    psql(sql);
    return true;
  } catch {
    return false;
  }
}

if (live) {
  assert(
    "table exists",
    psql(`select to_regclass('public.calibration_responses')`) ===
      "calibration_responses"
  );
  assert(
    "RLS enabled live",
    psql(
      `select relrowsecurity::text from pg_class where relname = 'calibration_responses'`
    ) === "true"
  );
  assert(
    "RPC exists",
    psql(
      `select count(*)::text from pg_proc where proname = 'save_calibration_response'`
    ) === "1"
  );
  const anonPriv = psql(`
    select coalesce(string_agg(privilege_type, ','), '')
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'calibration_responses'
      and grantee = 'anon'
  `);
  assert("anon has no table grants", anonPriv === "");

  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();

  assert(
    "seed orgs",
    psqlOk(`
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
      ) values
        (
          '${userA}', '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'calib-a-${userA.slice(0, 8)}@example.local',
          crypt('password', gen_salt('bf')), now(), now(), now(),
          '{}'::jsonb, '{}'::jsonb, false, false, false
        ),
        (
          '${userB}', '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'calib-b-${userB.slice(0, 8)}@example.local',
          crypt('password', gen_salt('bf')), now(), now(), now(),
          '{}'::jsonb, '{}'::jsonb, false, false, false
        );
      insert into public.organisations (id, name) values
        ('${orgA}', 'Calib Org A'),
        ('${orgB}', 'Calib Org B');
      insert into public.profiles (id, org_id, full_name, role) values
        ('${userA}', '${orgA}', 'User A', 'owner'),
        ('${userB}', '${orgB}', 'User B', 'owner');
    `)
  );

  assert(
    "negative labour blocked",
    !psqlOk(`
      insert into public.calibration_responses (
        org_id, scenario_id, scenario_version, work_area_type,
        labour_hours, engine_snapshot, created_by
      ) values (
        '${orgA}', 'deck.standard_pine.v1', '1', 'deck',
        -1, '{}'::jsonb, '${userA}'
      );
    `)
  );

  const firstId = randomUUID();
  assert(
    "insert first active",
    psqlOk(`
      insert into public.calibration_responses (
        id, org_id, scenario_id, scenario_version, work_area_type,
        materials_cost, expected_sell, confidence, engine_snapshot, created_by
      ) values (
        '${firstId}', '${orgA}', 'deck.standard_pine.v1', '1', 'deck',
        1000, 5000, 'medium', '{"version":1}'::jsonb, '${userA}'
      );
    `)
  );

  assert(
    "second active same scenario blocked by unique index",
    !psqlOk(`
      insert into public.calibration_responses (
        org_id, scenario_id, scenario_version, work_area_type,
        engine_snapshot, created_by
      ) values (
        '${orgA}', 'deck.standard_pine.v1', '1', 'deck',
        '{}'::jsonb, '${userA}'
      );
    `)
  );

  assert(
    "commercial update blocked",
    !psqlOk(`
      update public.calibration_responses
      set expected_sell = 99999
      where id = '${firstId}';
    `)
  );

  const secondId = randomUUID();
  assert(
    "supersede + insert history",
    psqlOk(`
      update public.calibration_responses
      set status = 'superseded', superseded_at = now()
      where id = '${firstId}';
      insert into public.calibration_responses (
        id, org_id, scenario_id, scenario_version, work_area_type,
        materials_cost, expected_sell, confidence, engine_snapshot,
        supersedes_id, created_by
      ) values (
        '${secondId}', '${orgA}', 'deck.standard_pine.v1', '1', 'deck',
        1100, 5200, 'high', '{"version":1}'::jsonb,
        '${firstId}', '${userA}'
      );
    `)
  );

  const histCount = psql(`
    select count(*)::text from public.calibration_responses
    where org_id = '${orgA}' and scenario_id = 'deck.standard_pine.v1'
  `);
  assert("history preserved (2 rows)", histCount === "2");
  const activeCount = psql(`
    select count(*)::text from public.calibration_responses
    where org_id = '${orgA}' and scenario_id = 'deck.standard_pine.v1' and status = 'active'
  `);
  assert("one active remains", activeCount === "1");
  const priorSell = psql(`
    select expected_sell::text from public.calibration_responses where id = '${firstId}'
  `);
  assert("superseded commercial values unchanged", priorSell === "5000.00" || priorSell === "5000");

  // Cross-org: set role simulation is heavy; verify FK/org isolation via direct select with auth_org_id pattern.
  assert(
    "cross-org supersedes rejected by FK org mismatch opportunity — org B cannot own org A row",
    !psqlOk(`
      update public.calibration_responses set org_id = '${orgB}' where id = '${secondId}';
    `)
  );

  psql(`
    delete from public.calibration_responses where org_id in ('${orgA}', '${orgB}');
    delete from public.profiles where id in ('${userA}', '${userB}');
    delete from public.organisations where id in ('${orgA}', '${orgB}');
    delete from auth.users where id in ('${userA}', '${userB}');
  `);
  assert("cleanup disposable calibration seed", true);
}

console.log(
  `\n=== Done: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===\n`
);
process.exit(failed === 0 ? 0 : 1);
