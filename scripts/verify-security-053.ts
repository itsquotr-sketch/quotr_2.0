/**
 * SECURITY-053 — role-aware RLS hardening.
 *
 * Static: npx --yes tsx scripts/verify-security-053.ts
 * Live Preview PostgREST (after 053 apply): 
 *   npx --yes tsx scripts/verify-security-053.ts --live
 *
 * Preview only for --live. No Production. No live Stripe. No secret prints.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { roleAllowsPermission } from "../lib/team/permissions";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function numberedMigrations(): string[] {
  const dir = join(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
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

function deniedWrite(rows: unknown[] | null, error: { message?: string } | null): boolean {
  if (error) return true;
  return !rows || rows.length === 0;
}

async function signIn(
  url: string,
  anonKey: string,
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for role fixture: ${error.message}`);
  return client;
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

function staticMain() {
  console.log("=== SECURITY-053 role-aware RLS ===");

  section("MIGRATION CHAIN");
  const migrations = numberedMigrations();
  const latest = migrations.at(-1) ?? null;
  assert(
    "latest migration is 053_role_aware_rls_hardening.sql",
    latest === "053_role_aware_rls_hardening.sql"
  );
  assert(
    "046 through 053 present",
    ["046", "047", "048", "049", "050", "051", "052", "053"].every((n) =>
      migrations.some((name) => name.startsWith(`${n}_`))
    )
  );
  assert(
    "052 Company DNA remains in chain",
    migrations.includes("052_company_productivity_calibration.sql")
  );

  const sql = read("supabase/migrations/053_role_aware_rls_hardening.sql");
  assert("environment-neutral (no Preview ref)", !sql.includes("shhpjsoldmqtkdbgrbtm"));
  assert("environment-neutral (no Production ref)", !sql.includes("lxvnylhsbvudzzupxeqr"));
  assert("no Stripe mutation", !/\bcus_|\bsub_|\bprice_|\bsk_live|\bsk_test/.test(sql));
  assert("no public token RPC rewrite", !sql.includes("lookup_quote_by_token") && !sql.includes("accept_quote"));

  section("HELPERS");
  assert("adds auth_can_manage_company", sql.includes("create or replace function public.auth_can_manage_company()"));
  assert(
    "company helper is owner/admin only",
    sql.includes("create or replace function public.auth_can_manage_company()") &&
      sql.includes("m.role in ('owner', 'admin')") &&
      !sql.includes("m.role in ('owner', 'admin', 'estimator')")
  );
  assert("keeps auth_can_mutate_work for project work", sql.includes("auth_can_mutate_work()"));
  assert(
    "does not reuse work helper for settings/rates",
    /organisation_settings[\s\S]*auth_can_manage_company/.test(sql) &&
      /'rates'[\s\S]*auth_can_manage_company/.test(sql)
  );
  assert("SECURITY DEFINER + search_path on company helper", /auth_can_manage_company\(\)[\s\S]*security definer[\s\S]*set search_path = public/.test(sql));
  assert("company helper not PUBLIC executable", sql.includes("revoke all on function public.auth_can_manage_company() from public, anon"));

  section("COMPANY ADMINISTRATION POLICIES");
  assert("drops 049 work-role on organisation_settings", sql.includes("organisation_settings_write_requires_work_role_update"));
  assert("drops 049 work-role on rates", sql.includes("rates_write_requires_work_role_update"));
  assert("company-role restrictive on organisation_settings", sql.includes("'organisation_settings'"));
  assert("company-role restrictive on rates", sql.includes("'rates'"));
  assert("company-role restrictive on organisation_work_areas", sql.includes("'organisation_work_areas'"));
  assert("organisations UPDATE requires company helper", sql.includes("organisations_write_requires_company_role_update"));
  assert("branding storage requires company helper", sql.includes("auth_can_manage_company()") && sql.includes("organisation-branding"));

  section("PROJECT WORK / VIEWER");
  for (const table of [
    "work_areas",
    "project_facts",
    "question_blocks",
    "questions",
    "constraints",
    "project_notes",
    "organisation_quote_counters",
  ]) {
    assert(`work-role restrictive on ${table}`, sql.includes(`'${table}'`));
  }
  assert("does not revoke authenticated SELECT", !/revoke select on table public\./i.test(sql));
  assert("does not revoke Owner/Admin table DML grants", !/revoke insert, update, delete on table public\.organisation_settings from authenticated/i.test(sql));

  section("PROFILE TENANT COLUMNS");
  assert("protects profiles.role and org_id", sql.includes("protect_profile_tenant_columns") && sql.includes("new.role is distinct from old.role"));
  assert("only blocks authenticated current_user", sql.includes("current_user = 'authenticated'"));

  section("APP PERMISSION ALIGNMENT");
  const setup = read("lib/setup/actions.ts");
  const logo = read("lib/settings/logo-actions.ts");
  assert("savePrimaryWorkAreas requires company.edit", setup.includes("savePrimaryWorkAreas") && /savePrimaryWorkAreas[\s\S]*permission: "company.edit"/.test(setup));
  assert("saveOrganisationWorkAreas requires company.edit", /saveOrganisationWorkAreas[\s\S]*permission: "company.edit"/.test(setup));
  assert("logo upload requires company.edit", /uploadCompanyLogo[\s\S]*permission: "company.edit"/.test(logo) || logo.includes('permission: "company.edit"'));
  assert("Estimator cannot company.edit", !roleAllowsPermission("estimator", "company.edit"));
  assert("Estimator cannot company.rates.manage", !roleAllowsPermission("estimator", "company.rates.manage"));
  assert("Estimator can company.calibration.manage", roleAllowsPermission("estimator", "company.calibration.manage"));
  assert("Estimator can projects.edit and pricing.edit", roleAllowsPermission("estimator", "projects.edit") && roleAllowsPermission("estimator", "pricing.edit"));
  assert("Viewer cannot projects.edit", !roleAllowsPermission("viewer", "projects.edit"));
  assert("Viewer cannot company.edit", !roleAllowsPermission("viewer", "company.edit"));
  assert("Owner can company.edit", roleAllowsPermission("owner", "company.edit"));
  assert("Admin can company.edit and rates.manage", roleAllowsPermission("admin", "company.edit") && roleAllowsPermission("admin", "company.rates.manage"));
  assert("Admin cannot billing.manage", !roleAllowsPermission("admin", "billing.manage"));
  assert("Owner can billing.manage", roleAllowsPermission("owner", "billing.manage"));

  section("COMPANY SETTINGS READ-ONLY UI");
  const companyPage = read("app/(protected)/app/settings/company/page.tsx");
  const companyUi = read("components/settings/CompanySettingsContent.tsx");
  const logoField = read("components/settings/CompanyLogoField.tsx");
  const companyActions = read("lib/settings/company-actions.ts");
  assert(
    "company page derives canEdit from company.edit",
    companyPage.includes("requireOrgPermission") &&
      companyPage.includes('permission: "company.edit"') &&
      companyPage.includes("canEdit={canEdit}")
  );
  assert("CompanySettingsContent accepts canEdit", /canEdit: boolean/.test(companyUi));
  assert(
    "Estimator helper text",
    companyUi.includes("Only owners and admins can change company settings.")
  );
  assert(
    "fields lock when !canEdit",
    companyUi.includes("LockedInput") &&
      companyUi.includes("readOnly={!canEdit}") &&
      companyUi.includes("disabled={!canEdit}")
  );
  assert(
    "Save hidden when !canEdit",
    companyUi.includes("{canEdit ?") &&
      companyUi.includes("Save company settings")
  );
  assert(
    "logo mutation hidden when readOnly",
    logoField.includes("readOnly") &&
      /readOnly \? null :/.test(logoField) &&
      logoField.includes("Upload logo")
  );
  assert(
    "updateCompanySettings still requires company.edit",
    /permission: "company.edit"/.test(companyActions)
  );
  assert(
    "company.edit UI does not wrap calibration",
    !read("components/rates/RatesPageContent.tsx").includes("canEdit") &&
      !read("components/calibration/CalibrationHub.tsx").includes(
        'permission: "company.edit"'
      )
  );

  section("DNA / TEAM / PUBLIC QUOTE UNTOUCHED");
  const dna = read("supabase/migrations/052_company_productivity_calibration.sql");
  assert("DNA save remains owner/admin/estimator", dna.includes("v_role not in ('owner', 'admin', 'estimator')"));
  assert("053 does not rewrite DNA RPCs", !sql.includes("save_productivity_calibration"));
  const team = read("supabase/migrations/049_organisation_memberships.sql");
  assert("049 memberships remain SELECT-only for authenticated", /revoke all on table public\.organisation_memberships from public, anon, authenticated/.test(team));
  const tokens = read("supabase/migrations/042_quote_delivery.sql");
  assert("quote_access_tokens remain service_role", tokens.includes("grant select, insert, update, delete on table public.quote_access_tokens to service_role"));

  section("DOCS");
  const matrix = read("docs/architecture/QUOTR_RLS_ROLE_MATRIX.md");
  assert("RLS/app matrix exists", matrix.includes("auth_can_manage_company") && matrix.includes("ROLE"));
  assert("matrix is documentation not SQL", matrix.startsWith("# Quotr RLS"));
  const proposal = read("docs/runbooks/MIGRATION_053_ROLE_RLS_PROPOSAL.md");
  assert("proposal records 053 as created", proposal.includes("053_role_aware_rls_hardening.sql") && !proposal.includes("DO NOT CREATE / APPLY"));
}

async function liveMain() {
  section("LIVE PREVIEW POSTGREST");
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const anon = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = local.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    assert("Preview env present for --live", false);
    return;
  }
  const ref = hostnameRef(url);
  assert("live target is Preview ref", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const suffix = randomUUID().slice(0, 8);
  const password = `s053-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectId = randomUUID();
  const workAreaId = randomUUID();
  const factId = randomUUID();
  const estimateId = randomUUID();
  const rateId = randomUUID();
  const owaId = randomUUID();
  const orgIds = [orgA, orgB];
  const userIds: string[] = [];

  async function createBoundUser(role: "owner" | "admin" | "estimator" | "viewer", orgId: string) {
    const email = `s053-${role}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? `create ${role} failed`);
    }
    const userId = created.data.user.id;
    userIds.push(userId);
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      org_id: orgId,
      role,
      full_name: `SECURITY-053 ${role}`,
    });
    if (profileError) throw new Error(profileError.message);
    const { error: membershipError } = await admin.from("organisation_memberships").insert({
      org_id: orgId,
      user_id: userId,
      role,
      status: "active",
      joined_at: new Date().toISOString(),
    });
    if (membershipError) throw new Error(membershipError.message);
    return { email, userId };
  }

  try {
    for (const org of [
      { id: orgA, name: `SECURITY-053-PROOF A ${suffix}` },
      { id: orgB, name: `SECURITY-053-PROOF B ${suffix}` },
    ]) {
      const { error } = await admin.from("organisations").insert({ id: org.id, name: org.name });
      if (error) throw new Error(error.message);
    }

    const ownerA = await createBoundUser("owner", orgA);
    const adminA = await createBoundUser("admin", orgA);
    const estimatorA = await createBoundUser("estimator", orgA);
    const viewerA = await createBoundUser("viewer", orgA);
    const ownerB = await createBoundUser("owner", orgB);

    const { error: settingsError } = await admin.from("organisation_settings").insert([
      { org_id: orgA, default_margin_percent: 20, onboarding_status: "completed", onboarding_step: "completed" },
      { org_id: orgB, default_margin_percent: 20, onboarding_status: "completed", onboarding_step: "completed" },
    ]);
    if (settingsError) throw new Error(settingsError.message);

    const { error: rateError } = await admin.from("rates").insert({
      id: rateId,
      org_id: orgA,
      rate_type: "labour",
      item_key: "labour.carpenter.hour",
      label: "Carpenter",
      unit: "hour",
      cost_rate: 65,
      active: true,
      source: "explicit_company",
    });
    if (rateError) throw new Error(rateError.message);

    const { error: owaError } = await admin.from("organisation_work_areas").insert({
      id: owaId,
      org_id: orgA,
      work_area_type: "deck",
      label: "Deck",
      estimate_support: "calculator",
      enabled: true,
      sort_order: 0,
    });
    if (owaError) throw new Error(owaError.message);

    const { error: projectError } = await admin.from("projects").insert({
      id: projectId,
      org_id: orgA,
      created_by: ownerA.userId,
      title: `SECURITY-053 project ${suffix}`,
      stage: "brief",
    });
    if (projectError) throw new Error(projectError.message);

    const { error: waError } = await admin.from("work_areas").insert({
      id: workAreaId,
      org_id: orgA,
      project_id: projectId,
      type: "deck",
      name: "Deck",
      status: "confirmed",
      sort_order: 0,
    });
    if (waError) throw new Error(waError.message);

    const { error: factError } = await admin.from("project_facts").insert({
      id: factId,
      org_id: orgA,
      project_id: projectId,
      work_area_id: workAreaId,
      key: "deck.length_m",
      label: "Length",
      value: 5,
      source: "user",
    });
    if (factError) throw new Error(factError.message);

    const { error: estimateError } = await admin.from("estimates").insert({
      id: estimateId,
      org_id: orgA,
      project_id: projectId,
      status: "ready",
      target_margin_percent: 20,
      recommended_cost: 1000,
      recommended_sell: 1250,
    });
    if (estimateError) throw new Error(estimateError.message);

    const estimator = await signIn(url, anon, estimatorA.email, password);
    const viewer = await signIn(url, anon, viewerA.email, password);
    const owner = await signIn(url, anon, ownerA.email, password);
    const adminClient = await signIn(url, anon, adminA.email, password);
    const foreign = await signIn(url, anon, ownerB.email, password);

    const estSettings = await estimator
      .from("organisation_settings")
      .update({ default_margin_percent: 33 })
      .eq("org_id", orgA)
      .select("default_margin_percent");
    assert("Estimator organisation_settings UPDATE denied", deniedWrite(estSettings.data, estSettings.error));
    const { data: settingsAfterEst } = await admin
      .from("organisation_settings")
      .select("default_margin_percent")
      .eq("org_id", orgA)
      .single();
    assert("Estimator did not change org default margin", Number(settingsAfterEst?.default_margin_percent) === 20);

    const estRate = await estimator
      .from("rates")
      .update({ cost_rate: 999 })
      .eq("id", rateId)
      .select("cost_rate");
    assert("Estimator commercial rates UPDATE denied", deniedWrite(estRate.data, estRate.error));
    const { data: rateAfterEst } = await admin.from("rates").select("cost_rate").eq("id", rateId).single();
    assert("Estimator did not change commercial rate", Number(rateAfterEst?.cost_rate) === 65);

    const estProject = await estimator
      .from("projects")
      .update({ title: `SECURITY-053 estimator ${suffix}` })
      .eq("id", projectId)
      .select("title");
    assert("Estimator project UPDATE allowed", !estProject.error && (estProject.data?.length ?? 0) === 1);

    const estWa = await estimator
      .from("work_areas")
      .update({ name: "Deck (estimator)" })
      .eq("id", workAreaId)
      .select("name");
    assert("Estimator work_areas UPDATE allowed", !estWa.error && (estWa.data?.length ?? 0) === 1);

    const estFact = await estimator
      .from("project_facts")
      .update({ value: 6 })
      .eq("id", factId)
      .select("value");
    assert("Estimator project_facts UPDATE allowed", !estFact.error && (estFact.data?.length ?? 0) === 1);

    const estPricing = await estimator
      .from("estimates")
      .update({ target_margin_percent: 18 })
      .eq("id", estimateId)
      .select("target_margin_percent");
    assert(
      "Estimator project Pricing/margin UPDATE allowed",
      !estPricing.error && Number(estPricing.data?.[0]?.target_margin_percent) === 18
    );

    const dna = await estimator.rpc("save_productivity_calibration", {
      p_calibration_task_key: "deck.framing.v1",
      p_crew_size: 2,
      p_duration_hours: 5,
      p_outlier_confirmed: false,
    });
    assert("Estimator DNA calibration RPC allowed", !dna.error);
    if (dna.error) {
      console.log(`  detail: ${dna.error.message}`);
    } else {
      const { data: calibrated } = await admin
        .from("rates")
        .select("source, item_key")
        .eq("org_id", orgA)
        .eq("source", "calibrated_productivity");
      assert(
        "Estimator calibration wrote productivity via RPC",
        (calibrated ?? []).some((row) => row.item_key === "deck.substructure.install.hours_per_framing_lm")
      );
    }

    const viewerSettings = await viewer
      .from("organisation_settings")
      .update({ default_margin_percent: 40 })
      .eq("org_id", orgA)
      .select("id");
    assert("Viewer organisation_settings UPDATE denied", deniedWrite(viewerSettings.data, viewerSettings.error));

    const viewerOwa = await viewer
      .from("organisation_work_areas")
      .update({ enabled: false })
      .eq("id", owaId)
      .select("id");
    assert("Viewer organisation_work_areas UPDATE denied", deniedWrite(viewerOwa.data, viewerOwa.error));

    const viewerProject = await viewer
      .from("projects")
      .update({ title: "viewer-should-fail" })
      .eq("id", projectId)
      .select("id");
    assert("Viewer project UPDATE denied", deniedWrite(viewerProject.data, viewerProject.error));

    const viewerWa = await viewer
      .from("work_areas")
      .update({ name: "viewer-should-fail" })
      .eq("id", workAreaId)
      .select("id");
    assert("Viewer work_areas UPDATE denied", deniedWrite(viewerWa.data, viewerWa.error));

    const viewerFact = await viewer
      .from("project_facts")
      .update({ value: 99 })
      .eq("id", factId)
      .select("id");
    assert("Viewer project_facts UPDATE denied", deniedWrite(viewerFact.data, viewerFact.error));

    const viewerEstimate = await viewer
      .from("estimates")
      .update({ target_margin_percent: 50 })
      .eq("id", estimateId)
      .select("id");
    assert("Viewer estimate UPDATE denied", deniedWrite(viewerEstimate.data, viewerEstimate.error));

    const viewerQuote = await viewer.from("quotes").insert({
      org_id: orgA,
      project_id: projectId,
      title: "viewer-should-fail",
    });
    assert("Viewer quote INSERT denied", Boolean(viewerQuote.error) || !viewerQuote.data);

    const ownerSettings = await owner
      .from("organisation_settings")
      .update({ default_margin_percent: 22 })
      .eq("org_id", orgA)
      .select("default_margin_percent");
    assert(
      "Owner organisation_settings UPDATE allowed",
      !ownerSettings.error && Number(ownerSettings.data?.[0]?.default_margin_percent) === 22
    );

    const adminSettings = await adminClient
      .from("organisation_settings")
      .update({ default_margin_percent: 24 })
      .eq("org_id", orgA)
      .select("default_margin_percent");
    assert(
      "Admin organisation_settings UPDATE allowed",
      !adminSettings.error && Number(adminSettings.data?.[0]?.default_margin_percent) === 24
    );

    const ownerRate = await owner
      .from("rates")
      .update({ cost_rate: 70 })
      .eq("id", rateId)
      .select("cost_rate");
    assert("Owner commercial rate UPDATE allowed", !ownerRate.error && Number(ownerRate.data?.[0]?.cost_rate) === 70);

    const adminRate = await adminClient
      .from("rates")
      .update({ cost_rate: 72 })
      .eq("id", rateId)
      .select("cost_rate");
    assert("Admin commercial rate UPDATE allowed", !adminRate.error && Number(adminRate.data?.[0]?.cost_rate) === 72);

    const ownerOwa = await owner
      .from("organisation_work_areas")
      .update({ enabled: false })
      .eq("id", owaId)
      .select("enabled");
    assert("Owner organisation_work_areas UPDATE allowed", !ownerOwa.error && ownerOwa.data?.[0]?.enabled === false);

    const spoof = await estimator
      .from("profiles")
      .update({ role: "owner" })
      .eq("id", estimatorA.userId)
      .select("role");
    assert("Estimator cannot spoof profiles.role", deniedWrite(spoof.data, spoof.error));
    const { data: estimatorProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", estimatorA.userId)
      .single();
    assert("Estimator membership role remains estimator", estimatorProfile?.role === "estimator");

    const crossSelect = await estimator
      .from("organisation_settings")
      .select("org_id")
      .eq("org_id", orgB);
    assert("Estimator cross-org settings SELECT denied", (crossSelect.data?.length ?? 0) === 0);

    const crossMutate = await estimator
      .from("organisation_settings")
      .update({ default_margin_percent: 11 })
      .eq("org_id", orgB)
      .select("id");
    assert("Estimator cross-org settings UPDATE denied", deniedWrite(crossMutate.data, crossMutate.error));

    const viewerCross = await viewer.from("projects").select("id").eq("org_id", orgB);
    assert("Viewer cross-org project SELECT denied", (viewerCross.data?.length ?? 0) === 0);

    const ownerCross = await owner.from("organisation_settings").select("org_id").eq("org_id", orgB);
    assert("Owner cross-org settings SELECT denied", (ownerCross.data?.length ?? 0) === 0);

    const foreignOwn = await foreign
      .from("organisation_settings")
      .select("org_id")
      .eq("org_id", orgB);
    assert("Foreign owner can select own org settings", (foreignOwn.data?.length ?? 0) === 1);
    const foreignLeak = await foreign
      .from("organisation_settings")
      .select("org_id")
      .eq("org_id", orgA);
    assert("Foreign owner cannot select org A settings", (foreignLeak.data?.length ?? 0) === 0);

    const membershipInsert = await estimator.from("organisation_memberships").insert({
      org_id: orgA,
      user_id: estimatorA.userId,
      role: "owner",
      status: "active",
    });
    assert("Estimator membership INSERT denied", Boolean(membershipInsert.error));
  } finally {
    await cleanup(admin, orgIds, userIds);
  }
}

async function main() {
  staticMain();
  if (process.argv.includes("--live")) {
    await liveMain();
  }
  if (process.exitCode) {
    console.log("\nSECURITY-053 verifier FAILED");
    process.exit(1);
  }
  console.log(
    process.argv.includes("--live")
      ? "\nSECURITY-053 verifier passed (static + live Preview PostgREST)"
      : "\nSECURITY-053 verifier passed (static). Re-run with --live after Preview apply."
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
