/**
 * Viewer and cross-organisation denial for manual work areas and Pricing.
 * Direct Preview PostgREST writes. Refuses Production.
 *
 * Run: npx --yes tsx scripts/verify-manual-pricing-permissions-live.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";

const PRODUCTION_REF = "lxvnylhsbvudzzupxeqr";
let failed = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
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

function denied(
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

async function main(): Promise<void> {
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const anon = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = local.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    throw new Error("Preview env is missing from .env.local");
  }
  const ref = hostnameRef(url);
  if (ref === PRODUCTION_REF) {
    throw new Error("Refusing Production Supabase URL");
  }
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    throw new Error(`Refusing non-Preview Supabase ref ${ref}`);
  }
  check("live target is Preview", true);

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const password = `mwp-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectId = randomUUID();
  const documentId = randomUUID();
  const itemId = randomUUID();
  const workAreaId = randomUUID();
  const userIds: string[] = [];

  async function createUser(role: "owner" | "viewer", orgId: string) {
    const email = `mwp-${role}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
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
      full_name: `Manual pricing ${role}`,
    });
    if (profileError) throw new Error(profileError.message);
    const { error: membershipError } = await admin
      .from("organisation_memberships")
      .insert({
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
      { id: orgA, name: `MWP-A ${suffix}` },
      { id: orgB, name: `MWP-B ${suffix}` },
    ]) {
      const { error } = await admin.from("organisations").insert({
        id: org.id,
        name: org.name,
      });
      if (error) throw new Error(error.message);
    }

    const ownerA = await createUser("owner", orgA);
    const viewerA = await createUser("viewer", orgA);
    const ownerB = await createUser("owner", orgB);

    const { error: projectError } = await admin.from("projects").insert({
      id: projectId,
      org_id: orgA,
      created_by: ownerA.userId,
      title: `Manual pricing ${suffix}`,
      stage: "brief",
    });
    if (projectError) throw new Error(projectError.message);

    const { error: areaError } = await admin.from("work_areas").insert({
      id: workAreaId,
      org_id: orgA,
      project_id: projectId,
      type: "custom",
      name: "Concreting",
      status: "confirmed",
      summary: "Supply and lay a driveway.",
      quote_description: "Supply and lay a driveway.",
      sort_order: 1,
    });
    if (areaError) throw new Error(areaError.message);

    const { error: documentError } = await admin.from("pricing_documents").insert({
      id: documentId,
      org_id: orgA,
      project_id: projectId,
      estimate_id: null,
      title: `Manual pricing ${suffix}`,
      status: "draft",
      subtotal_cost: 0,
      subtotal_sell: 0,
      gross_profit: 0,
      margin_percent: 0,
      markup_percent: 0,
      gst_rate: 15,
      gst_amount: 0,
      total_incl_gst: 0,
      created_by: ownerA.userId,
    });
    if (documentError) throw new Error(documentError.message);
    check("Preview accepts a null-estimate Pricing document", true);

    const { error: itemError } = await admin.from("pricing_items").insert({
      id: itemId,
      org_id: orgA,
      pricing_document_id: documentId,
      project_id: projectId,
      work_area_id: workAreaId,
      item_type: "allowance",
      delivery_method: "allowance",
      internal_label: "Concreting",
      client_label: "Concreting",
      client_description: "Supply and lay a driveway.",
      quantity: 1,
      unit: "item",
      total_cost: 0,
      total_sell: 0,
      gross_profit: 0,
      margin_percent: 0,
      markup_percent: 0,
      calculation_mode: "lump_sum",
      visible_on_quote: true,
      optional: false,
      sort_order: 0,
    });
    if (itemError) throw new Error(itemError.message);

    const viewer = await signIn(url, anon, viewerA.email, password);
    const foreign = await signIn(url, anon, ownerB.email, password);
    const owner = await signIn(url, anon, ownerA.email, password);

    const viewerArea = await viewer.from("work_areas").insert({
      org_id: orgA,
      project_id: projectId,
      type: "custom",
      name: "Viewer concreting",
      status: "confirmed",
      summary: "Should not save.",
      quote_description: "Should not save.",
      sort_order: 2,
    }).select("id");
    const viewerPrice = await viewer
      .from("pricing_items")
      .update({ total_sell: 500 })
      .eq("id", itemId)
      .select("id");
    const viewerDoc = await viewer
      .from("pricing_documents")
      .update({ subtotal_sell: 500 })
      .eq("id", documentId)
      .select("id");
    check(
      "viewer cannot create or price manual work",
      denied(viewerArea.data, viewerArea.error) &&
        denied(viewerPrice.data, viewerPrice.error) &&
        denied(viewerDoc.data, viewerDoc.error)
    );

    const foreignArea = await foreign.from("work_areas").insert({
      org_id: orgA,
      project_id: projectId,
      type: "custom",
      name: "Foreign concreting",
      status: "confirmed",
      summary: "Should not save.",
      quote_description: "Should not save.",
      sort_order: 3,
    }).select("id");
    const foreignPrice = await foreign
      .from("pricing_items")
      .update({ total_sell: 900 })
      .eq("id", itemId)
      .select("id");
    const foreignProject = await foreign
      .from("projects")
      .update({ title: "Taken over" })
      .eq("id", projectId)
      .select("id");
    check(
      "cross-organisation writes are denied",
      denied(foreignArea.data, foreignArea.error) &&
        denied(foreignPrice.data, foreignPrice.error) &&
        denied(foreignProject.data, foreignProject.error)
    );

    const ownerPrice = await owner
      .from("pricing_items")
      .update({ total_sell: 1000 })
      .eq("id", itemId)
      .select("id, total_sell");
    check(
      "owning member can price the manual item",
      !ownerPrice.error &&
        ownerPrice.data?.length === 1 &&
        Number(ownerPrice.data[0]?.total_sell) === 1000
    );

    const { data: afterDenial } = await admin
      .from("work_areas")
      .select("id, name")
      .eq("project_id", projectId);
    check(
      "denied writes did not create another work area",
      (afterDenial ?? []).length === 1 && afterDenial?.[0]?.name === "Concreting"
    );

    const { data: persisted } = await admin
      .from("work_areas")
      .select("name, summary, quote_description")
      .eq("id", workAreaId)
      .maybeSingle();
    check(
      "manual name and scope remain stored",
      persisted?.name === "Concreting" &&
        persisted?.summary === "Supply and lay a driveway." &&
        persisted?.quote_description === "Supply and lay a driveway."
    );
  } finally {
    await admin.from("organisations").delete().eq("id", orgA);
    await admin.from("organisations").delete().eq("id", orgB);
    for (const userId of userIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nmanual pricing permission checks passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
