/**
 * Pricing recalibration permission gate.
 *
 * Static: npx --yes tsx scripts/verify-pricing-recalibration-permission.ts
 * Live Preview PostgREST (RLS 049): add --live
 *
 * Refuses any Supabase ref other than Preview. Does not contact Production.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  decideMembershipAuthority,
  membershipGrantsRolePermissions,
} from "../lib/team/membership-authority";
import {
  PERMISSION_DENIED_MESSAGE,
  roleAllowsPermission,
} from "../lib/team/permissions";
import type { MembershipRole } from "../lib/team/roles";

const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";

function assert(label: string, ok: boolean): void {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8").replaceAll("\r", "");
}

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function staticMain(): void {
  console.log("=== Pricing recalibration permission ===\n");
  const source = read("lib/pricing/recalibration.ts");
  const actions = read("lib/pricing/actions.ts");
  const migration049 = read(
    "supabase/migrations/049_organisation_memberships.sql"
  );
  const applyBody = functionBody(source, "applyRecalibration");
  const keepBody = functionBody(source, "keepCurrentPricing");
  const previewBody = functionBody(source, "previewRecalibration");

  assert("applyRecalibration exists", applyBody.length > 0);
  assert("keepCurrentPricing exists", keepBody.length > 0);
  assert(
    "gate uses permissionDeniedError and pricing.edit",
    source.includes("permissionDeniedError") &&
      source.includes('permission: "pricing.edit"') &&
      source.includes("async function requirePricingEditPermission")
  );
  assert(
    "recalibration does not add a pricing.access entitlement check",
    !source.includes("entitlement:")
  );
  assert(
    "create-from-estimate still requires pricing.edit and pricing.access",
    actions.includes('permission: "pricing.edit"') &&
      actions.includes('entitlement: "pricing.access"')
  );
  assert(
    "applyRecalibration checks pricing.edit before loading Pricing",
    applyBody.indexOf("requirePricingEditPermission") >= 0 &&
      applyBody.indexOf("requirePricingEditPermission") <
        applyBody.indexOf("loadRecalibrationContext")
  );
  assert(
    "keepCurrentPricing checks pricing.edit before any Pricing read",
    keepBody.indexOf("requirePricingEditPermission") >= 0 &&
      keepBody.indexOf("requirePricingEditPermission") <
        keepBody.indexOf("assertOrgOwnsPricingDocument") &&
      keepBody.indexOf("requirePricingEditPermission") < keepBody.indexOf(".from(")
  );
  assert(
    "preview remains a read and is not newly gated",
    !previewBody.includes("requirePricingEditPermission")
  );
  assert(
    "denied result is the permission helper error",
    source.includes("return { error: denied.error }")
  );
  assert(
    "049 remains the write authority for pricing tables",
    migration049.includes("auth_can_mutate_work()") &&
      migration049.includes("'pricing_documents'") &&
      migration049.includes("'pricing_items'") &&
      migration049.includes("m.role in ('owner', 'admin', 'estimator')")
  );

  const workRoles: MembershipRole[] = ["owner", "admin", "estimator"];
  for (const role of workRoles) {
    const decision = decideMembershipAuthority({
      membershipTableAvailable: true,
      membership: { role, status: "active" },
      profile: { orgId: "org", role },
    });
    assert(
      `${role} retains pricing.edit`,
      membershipGrantsRolePermissions(decision) &&
        roleAllowsPermission(role, "pricing.edit")
    );
  }

  assert(
    "viewer is denied pricing.edit",
    !roleAllowsPermission("viewer", "pricing.edit")
  );
  assert(
    "viewer permission error is the established message",
    PERMISSION_DENIED_MESSAGE === "You don't have permission to do that."
  );

  for (const status of ["pending_billing", "removed"] as const) {
    const decision = decideMembershipAuthority({
      membershipTableAvailable: true,
      membership: { role: "estimator", status },
      profile: { orgId: "org", role: "estimator" },
    });
    assert(
      `${status} membership does not grant pricing.edit`,
      !membershipGrantsRolePermissions(decision)
    );
  }

  const absent = decideMembershipAuthority({
    membershipTableAvailable: true,
    membership: null,
    profile: { orgId: "org-b", role: "owner" },
  });
  assert(
    "cross-organisation profile without this org membership is not granted",
    !membershipGrantsRolePermissions(absent)
  );
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

function deniedWrite(
  rows: unknown[] | null,
  error: { message?: string } | null
): boolean {
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

type MoneySnapshot = {
  subtotal_cost: number;
  subtotal_sell: number;
  gross_profit: number;
  margin_percent: number;
  markup_percent: number;
  gst_rate: number;
  gst_amount: number;
  total_incl_gst: number;
  needs_recalibration: boolean;
  recalibration_status: string;
  updated_at: string;
  item_total_cost: number;
  item_total_sell: number;
};

async function readSnapshot(
  admin: SupabaseClient,
  documentId: string,
  itemId: string
): Promise<MoneySnapshot> {
  const { data: document, error: documentError } = await admin
    .from("pricing_documents")
    .select(
      "subtotal_cost, subtotal_sell, gross_profit, margin_percent, markup_percent, gst_rate, gst_amount, total_incl_gst, needs_recalibration, recalibration_status, updated_at"
    )
    .eq("id", documentId)
    .single();
  if (documentError || !document) {
    throw new Error(documentError?.message ?? "snapshot document missing");
  }
  const { data: item, error: itemError } = await admin
    .from("pricing_items")
    .select("total_cost, total_sell")
    .eq("id", itemId)
    .single();
  if (itemError || !item) {
    throw new Error(itemError?.message ?? "snapshot item missing");
  }
  return {
    subtotal_cost: Number(document.subtotal_cost),
    subtotal_sell: Number(document.subtotal_sell),
    gross_profit: Number(document.gross_profit),
    margin_percent: Number(document.margin_percent),
    markup_percent: Number(document.markup_percent),
    gst_rate: Number(document.gst_rate),
    gst_amount: Number(document.gst_amount),
    total_incl_gst: Number(document.total_incl_gst),
    needs_recalibration: Boolean(document.needs_recalibration),
    recalibration_status: String(document.recalibration_status),
    updated_at: String(document.updated_at),
    item_total_cost: Number(item.total_cost),
    item_total_sell: Number(item.total_sell),
  };
}

function sameSnapshot(left: MoneySnapshot, right: MoneySnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function liveMain(): Promise<void> {
  console.log("\n=== Live Preview RLS ===\n");
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const anon = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = local.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    assert("Preview env present for --live", false);
    return;
  }
  const ref = hostnameRef(url);
  if (ref === PRODUCTION_REF) {
    throw new Error("Refusing Production Supabase URL");
  }
  assert("live target is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const password = `prc-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectId = randomUUID();
  const documentId = randomUUID();
  const itemId = randomUUID();
  const orgIds = [orgA, orgB];
  const userIds: string[] = [];

  async function createBoundUser(
    role: "owner" | "admin" | "estimator" | "viewer",
    orgId: string,
    status: "active" | "pending_billing" | "removed" = "active"
  ) {
    const email = `prc-${role}-${status}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
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
      full_name: `Pricing recalibration ${role}`,
    });
    if (profileError) throw new Error(profileError.message);
    const { error: membershipError } = await admin
      .from("organisation_memberships")
      .insert({
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
      { id: orgA, name: `PRC-A ${suffix}` },
      { id: orgB, name: `PRC-B ${suffix}` },
    ]) {
      const { error } = await admin
        .from("organisations")
        .insert({ id: org.id, name: org.name });
      if (error) throw new Error(error.message);
    }

    const ownerA = await createBoundUser("owner", orgA);
    const adminA = await createBoundUser("admin", orgA);
    const estimatorA = await createBoundUser("estimator", orgA);
    const viewerA = await createBoundUser("viewer", orgA);
    const pendingA = await createBoundUser("estimator", orgA, "pending_billing");
    const removedA = await createBoundUser("estimator", orgA, "removed");
    const ownerB = await createBoundUser("owner", orgB);

    const { error: projectError } = await admin.from("projects").insert({
      id: projectId,
      org_id: orgA,
      created_by: ownerA.userId,
      title: `PRC project ${suffix}`,
      stage: "brief",
    });
    if (projectError) throw new Error(projectError.message);

    const { error: documentError } = await admin.from("pricing_documents").insert({
      id: documentId,
      org_id: orgA,
      project_id: projectId,
      title: `PRC pricing ${suffix}`,
      status: "draft",
      subtotal_cost: 80,
      subtotal_sell: 100,
      gross_profit: 20,
      margin_percent: 20,
      markup_percent: 25,
      gst_rate: 15,
      gst_amount: 15,
      total_incl_gst: 115,
      needs_recalibration: false,
      recalibration_status: "current",
      created_by: ownerA.userId,
    });
    if (documentError) throw new Error(documentError.message);

    const { error: itemError } = await admin.from("pricing_items").insert({
      id: itemId,
      org_id: orgA,
      pricing_document_id: documentId,
      project_id: projectId,
      item_type: "labour",
      delivery_method: "in_house",
      internal_label: "Labour",
      client_label: "Labour",
      quantity: 2,
      unit: "hr",
      unit_cost: 40,
      unit_sell: 50,
      total_cost: 80,
      total_sell: 100,
      gross_profit: 20,
      margin_percent: 20,
      markup_percent: 25,
      visible_on_quote: true,
      optional: false,
      sort_order: 0,
    });
    if (itemError) throw new Error(itemError.message);

    const owner = await signIn(url, anon, ownerA.email, password);
    const adminUser = await signIn(url, anon, adminA.email, password);
    const estimator = await signIn(url, anon, estimatorA.email, password);
    const viewer = await signIn(url, anon, viewerA.email, password);
    const pending = await signIn(url, anon, pendingA.email, password);
    const removed = await signIn(url, anon, removedA.email, password);
    const foreign = await signIn(url, anon, ownerB.email, password);
    const anonymous = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ownerWrite = await owner
      .from("pricing_documents")
      .update({ needs_recalibration: true })
      .eq("id", documentId)
      .select("needs_recalibration, subtotal_sell");
    assert(
      "Owner Pricing update succeeds",
      !ownerWrite.error &&
        ownerWrite.data?.length === 1 &&
        ownerWrite.data[0]?.needs_recalibration === true &&
        Number(ownerWrite.data[0]?.subtotal_sell) === 100
    );

    const adminWrite = await adminUser
      .from("pricing_documents")
      .update({ needs_recalibration: false })
      .eq("id", documentId)
      .select("needs_recalibration, subtotal_cost");
    assert(
      "Admin Pricing update succeeds",
      !adminWrite.error &&
        adminWrite.data?.length === 1 &&
        adminWrite.data[0]?.needs_recalibration === false &&
        Number(adminWrite.data[0]?.subtotal_cost) === 80
    );

    const estimatorWrite = await estimator
      .from("pricing_items")
      .update({ recalibration_note: "estimator write probe" })
      .eq("id", itemId)
      .select("total_cost, total_sell, recalibration_note");
    assert(
      "Estimator Pricing item update succeeds",
      !estimatorWrite.error &&
        estimatorWrite.data?.length === 1 &&
        Number(estimatorWrite.data[0]?.total_cost) === 80 &&
        Number(estimatorWrite.data[0]?.total_sell) === 100
    );

    const { error: restoreError } = await admin
      .from("pricing_documents")
      .update({
        needs_recalibration: false,
        recalibration_status: "current",
      })
      .eq("id", documentId);
    if (restoreError) throw new Error(restoreError.message);
    const { error: restoreItemError } = await admin
      .from("pricing_items")
      .update({ recalibration_note: null })
      .eq("id", itemId);
    if (restoreItemError) throw new Error(restoreItemError.message);

    const baseline = await readSnapshot(admin, documentId, itemId);

    async function expectRejected(
      label: string,
      client: SupabaseClient
    ): Promise<void> {
      const documentWrite = await client
        .from("pricing_documents")
        .update({
          subtotal_sell: 1,
          gst_amount: 1,
          total_incl_gst: 2,
          needs_recalibration: true,
          recalibration_status: "estimate_changed",
        })
        .eq("id", documentId)
        .select("id");
      const itemWrite = await client
        .from("pricing_items")
        .update({ total_sell: 1, total_cost: 1 })
        .eq("id", itemId)
        .select("id");
      const after = await readSnapshot(admin, documentId, itemId);
      assert(
        label,
        deniedWrite(documentWrite.data, documentWrite.error) &&
          deniedWrite(itemWrite.data, itemWrite.error) &&
          sameSnapshot(baseline, after)
      );
    }

    await expectRejected("Viewer Pricing write denied and money unchanged", viewer);
    await expectRejected(
      "pending_billing Pricing write denied and money unchanged",
      pending
    );
    await expectRejected(
      "removed membership Pricing write denied and money unchanged",
      removed
    );
    await expectRejected(
      "anonymous Pricing write denied and money unchanged",
      anonymous
    );
    await expectRejected(
      "cross-organisation Pricing write denied and money unchanged",
      foreign
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

async function main(): Promise<void> {
  staticMain();
  if (process.argv.includes("--live")) {
    await liveMain();
  }
  if (process.exitCode) {
    console.log("\nPricing recalibration permission verifier FAILED");
    process.exit(1);
  }
  console.log(
    process.argv.includes("--live")
      ? "\nPricing recalibration permission verifier passed (static + live Preview)"
      : "\nPricing recalibration permission verifier passed (static)"
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
