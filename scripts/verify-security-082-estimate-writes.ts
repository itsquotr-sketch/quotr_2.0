/**
 * SECURITY-082 — estimate write policies require an active work role.
 *
 * Static: npx --yes tsx scripts/verify-security-082-estimate-writes.ts
 * Live Preview: npx --yes tsx scripts/verify-security-082-estimate-writes.ts --live
 *
 * --live uses disposable Preview rows and deletes them. Refuses Production.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF, PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { roleAllowsPermission } from "../lib/team/permissions";

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
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return client;
}

function staticMain() {
  console.log("=== SECURITY-082 estimate write role ===");
  const sql = read("supabase/migrations/082_estimate_write_role.sql");
  const margin = read("lib/assistant/margin-actions.ts");
  const gate = margin.indexOf('permission: "estimates.run"');
  const estimateRead = margin.indexOf('.from("estimates")');

  section("MIGRATION");
  assert("no Preview ref", !sql.includes(PREVIEW_SUPABASE_PROJECT_REF));
  assert("no Production ref", !sql.includes(PRODUCTION_SUPABASE_PROJECT_REF));
  assert("does not create a security definer function", !/security definer/i.test(sql));
  assert("reuses auth_can_mutate_work", sql.includes("public.auth_can_mutate_work()"));
  assert("reuses auth_org_id", sql.includes("public.auth_org_id()"));
  assert("does not encode billing entitlement", !/entitlement|stripe|subscription/i.test(sql));
  assert("does not drop select policies", !/drop policy if exists "Users can select/i.test(sql));
  assert("does not drop project/org triggers", !/drop trigger/i.test(sql));
  for (const name of [
    "Users can insert estimates in their organisation",
    "Users can update estimates in their organisation",
    "Users can delete estimates in their organisation",
    "Users can insert estimate line items in their organisation",
    "Users can update estimate line items in their organisation",
    "Users can delete estimate line items in their organisation",
  ]) {
    assert(`drops ${name}`, sql.includes(name));
  }
  for (const name of [
    "estimates_insert_active_work_role",
    "estimates_update_active_work_role",
    "estimates_delete_active_work_role",
    "estimate_line_items_insert_active_work_role",
    "estimate_line_items_update_active_work_role",
    "estimate_line_items_delete_active_work_role",
  ]) {
    assert(`creates ${name}`, sql.includes(name));
  }
  assert(
    "update policies constrain both existing and resulting rows",
    sql.includes("for update") &&
      /estimates_update_active_work_role[\s\S]*using \(/.test(sql) &&
      /estimates_update_active_work_role[\s\S]*with check \(/.test(sql) &&
      /estimate_line_items_update_active_work_role[\s\S]*using \(/.test(sql) &&
      /estimate_line_items_update_active_work_role[\s\S]*with check \(/.test(sql)
  );
  assert(
    "line writes must stay on the parent estimate and project",
    sql.includes("e.id = estimate_line_items.estimate_id") &&
      sql.includes("e.project_id = estimate_line_items.project_id") &&
      sql.includes("p.id = estimate_line_items.project_id")
  );

  section("APPLICATION GATE");
  assert(
    "margin action still checks estimates.run before reading estimates",
    margin.includes('entitlement: "estimates.create"') &&
      gate > 0 &&
      estimateRead > gate &&
      margin.includes("applyMarginToAmounts")
  );
  assert("Viewer still lacks estimates.run", !roleAllowsPermission("viewer", "estimates.run"));
  assert(
    "Owner, admin, and estimator still have estimates.run",
    roleAllowsPermission("owner", "estimates.run") &&
      roleAllowsPermission("admin", "estimates.run") &&
      roleAllowsPermission("estimator", "estimates.run")
  );

  section("FORMULA FILES UNTOUCHED BY THIS SCRIPT");
  const formula = read("lib/estimate/margin-override.ts");
  assert("margin formula file still exports applyMarginToAmounts", formula.includes("export function applyMarginToAmounts"));
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
  assert("live target is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF || ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const suffix = randomUUID().slice(0, 8);
  const password = `s082-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectB = randomUUID();
  const estimateA = randomUUID();
  const estimateB = randomUUID();
  const lineA = randomUUID();
  const orgIds = [orgA, orgB];
  const userIds: string[] = [];

  async function createBoundUser(
    role: "owner" | "admin" | "estimator" | "viewer",
    orgId: string,
    status: "active" | "pending_billing" | "removed" = "active"
  ) {
    const email = `s082-${role}-${status}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
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
      full_name: `SECURITY-082 ${role}`,
    });
    if (profileError) throw new Error(profileError.message);
    const { error: membershipError } = await admin.from("organisation_memberships").insert({
      org_id: orgId,
      user_id: userId,
      role,
      status,
      joined_at: new Date().toISOString(),
    });
    if (membershipError) throw new Error(membershipError.message);
    return { email, userId };
  }

  try {
    for (const org of [
      { id: orgA, name: `SECURITY-082 A ${suffix}` },
      { id: orgB, name: `SECURITY-082 B ${suffix}` },
    ]) {
      const { error } = await admin.from("organisations").insert({ id: org.id, name: org.name });
      if (error) throw new Error(error.message);
    }

    const ownerA = await createBoundUser("owner", orgA);
    const adminA = await createBoundUser("admin", orgA);
    const estimatorA = await createBoundUser("estimator", orgA);
    const viewerA = await createBoundUser("viewer", orgA);
    const inactiveA = await createBoundUser("estimator", orgA, "pending_billing");
    const removedA = await createBoundUser("estimator", orgA, "removed");
    const ownerB = await createBoundUser("owner", orgB);

    const { error: projectError } = await admin.from("projects").insert([
      {
        id: projectA,
        org_id: orgA,
        created_by: ownerA.userId,
        title: `SECURITY-082 A ${suffix}`,
        stage: "estimate_ready",
      },
      {
        id: projectB,
        org_id: orgB,
        created_by: ownerB.userId,
        title: `SECURITY-082 B ${suffix}`,
        stage: "estimate_ready",
      },
    ]);
    if (projectError) throw new Error(projectError.message);

    const { error: estimateError } = await admin.from("estimates").insert([
      {
        id: estimateA,
        org_id: orgA,
        project_id: projectA,
        status: "ready",
        recommended_cost: 1000,
        recommended_sell: 1250,
      },
      {
        id: estimateB,
        org_id: orgB,
        project_id: projectB,
        status: "ready",
        recommended_cost: 1000,
        recommended_sell: 1250,
      },
    ]);
    if (estimateError) throw new Error(estimateError.message);

    const { error: lineError } = await admin.from("estimate_line_items").insert({
      id: lineA,
      org_id: orgA,
      project_id: projectA,
      estimate_id: estimateA,
      work_area_name: "Deck",
      label: "Decking",
      category: "materials",
      recommended_cost: 100,
      recommended_sell: 125,
      sort_order: 0,
    });
    if (lineError) throw new Error(lineError.message);

    const owner = await signIn(url, anon, ownerA.email, password);
    const adminUser = await signIn(url, anon, adminA.email, password);
    const estimator = await signIn(url, anon, estimatorA.email, password);
    const viewer = await signIn(url, anon, viewerA.email, password);
    const inactive = await signIn(url, anon, inactiveA.email, password);
    const removed = await signIn(url, anon, removedA.email, password);
    const foreign = await signIn(url, anon, ownerB.email, password);

    const viewerRead = await viewer.from("estimates").select("id").eq("id", estimateA);
    assert("Viewer can read the organisation estimate", !viewerRead.error && viewerRead.data?.length === 1);
    const viewerLineRead = await viewer.from("estimate_line_items").select("id").eq("id", lineA);
    assert("Viewer can read the organisation line", !viewerLineRead.error && viewerLineRead.data?.length === 1);

    const viewerUpdate = await viewer
      .from("estimates")
      .update({ recommended_sell: 1 })
      .eq("id", estimateA)
      .select("id");
    assert("Viewer estimate UPDATE denied", deniedWrite(viewerUpdate.data, viewerUpdate.error));
    const viewerInsert = await viewer.from("estimates").insert({
      org_id: orgA,
      project_id: projectA,
      status: "draft",
    });
    assert("Viewer estimate INSERT denied", Boolean(viewerInsert.error));
    const viewerDelete = await viewer.from("estimates").delete().eq("id", estimateA).select("id");
    assert("Viewer estimate DELETE denied", deniedWrite(viewerDelete.data, viewerDelete.error));
    const viewerLineUpdate = await viewer
      .from("estimate_line_items")
      .update({ recommended_sell: 1 })
      .eq("id", lineA)
      .select("id");
    assert("Viewer line UPDATE denied", deniedWrite(viewerLineUpdate.data, viewerLineUpdate.error));
    const viewerLineInsert = await viewer.from("estimate_line_items").insert({
      org_id: orgA,
      project_id: projectA,
      estimate_id: estimateA,
      work_area_name: "Deck",
      label: "Viewer line",
      category: "labour",
    });
    assert("Viewer line INSERT denied", Boolean(viewerLineInsert.error));
    const viewerLineDelete = await viewer.from("estimate_line_items").delete().eq("id", lineA).select("id");
    assert("Viewer line DELETE denied", deniedWrite(viewerLineDelete.data, viewerLineDelete.error));

    const ownerUpdate = await owner
      .from("estimates")
      .update({ rate_source_summary: "security-082" })
      .eq("id", estimateA)
      .select("id");
    assert("Owner estimate UPDATE allowed", !ownerUpdate.error && ownerUpdate.data?.length === 1);
    const adminUpdate = await adminUser
      .from("estimate_line_items")
      .update({ notes: "security-082" })
      .eq("id", lineA)
      .select("id");
    assert("Admin line UPDATE allowed", !adminUpdate.error && adminUpdate.data?.length === 1);
    const estimatorLine = await estimator.from("estimate_line_items").insert({
      org_id: orgA,
      project_id: projectA,
      estimate_id: estimateA,
      work_area_name: "Deck",
      label: "Estimator line",
      category: "labour",
      recommended_cost: 60,
      recommended_sell: 75,
    }).select("id");
    assert("Estimator line INSERT allowed", !estimatorLine.error && estimatorLine.data?.length === 1);

    const moveOrg = await owner
      .from("estimates")
      .update({ org_id: orgB })
      .eq("id", estimateA)
      .select("id");
    assert("Owner cannot move estimate org_id", deniedWrite(moveOrg.data, moveOrg.error));
    const moveProject = await owner
      .from("estimates")
      .update({ project_id: projectB })
      .eq("id", estimateA)
      .select("id");
    assert("Owner cannot attach estimate to another organisation project", deniedWrite(moveProject.data, moveProject.error));
    const foreignLine = await owner.from("estimate_line_items").insert({
      org_id: orgA,
      project_id: projectA,
      estimate_id: estimateB,
      work_area_name: "Deck",
      label: "Foreign parent",
      category: "materials",
    });
    assert("Owner cannot attach a line to another organisation estimate", Boolean(foreignLine.error));

    const cross = await foreign
      .from("estimates")
      .update({ rate_source_summary: "cross" })
      .eq("id", estimateA)
      .select("id");
    assert("Cross-organisation estimate UPDATE denied", deniedWrite(cross.data, cross.error));

    const inactiveWrite = await inactive
      .from("estimates")
      .update({ rate_source_summary: "inactive" })
      .eq("id", estimateA)
      .select("id");
    assert("pending_billing membership UPDATE denied", deniedWrite(inactiveWrite.data, inactiveWrite.error));
    const removedWrite = await removed
      .from("estimate_line_items")
      .update({ notes: "removed" })
      .eq("id", lineA)
      .select("id");
    assert("removed membership line UPDATE denied", deniedWrite(removedWrite.data, removedWrite.error));

    const anonWrite = await anonClient.from("estimates").insert({
      org_id: orgA,
      project_id: projectA,
      status: "draft",
    });
    assert("Anonymous estimate INSERT denied", Boolean(anonWrite.error));
    const anonUpdate = await anonClient
      .from("estimates")
      .update({ recommended_sell: 1 })
      .eq("id", estimateA)
      .select("id");
    assert("Anonymous estimate UPDATE denied", deniedWrite(anonUpdate.data, anonUpdate.error));

    const { data: stillThere } = await admin.from("estimates").select("id, org_id, recommended_sell").eq("id", estimateA).single();
    assert(
      "Disposable estimate org and sell were not rewritten by denied calls",
      stillThere?.org_id === orgA && Number(stillThere.recommended_sell) === 1250
    );
  } finally {
    for (const orgId of orgIds) {
      await admin.from("organisations").delete().eq("id", orgId);
    }
    for (const userId of userIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

staticMain();
if (process.argv.includes("--live")) {
  liveMain().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "live verification failed");
    process.exitCode = 1;
  });
}
