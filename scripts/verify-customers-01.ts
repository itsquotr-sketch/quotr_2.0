/**
 * Customer directory and project snapshot rules.
 *
 * Static: npx tsx scripts/verify-customers-01.ts
 * Live Preview: npx tsx scripts/verify-customers-01.ts --live
 *
 * --live uses disposable Preview rows and deletes them. Refuses Production.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { filterCustomers } from "../lib/customers/search";
import { projectSnapshotFromCustomer } from "../lib/customers/snapshot";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";
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
  console.log("=== customers directory ===");
  const sql = read("supabase/migrations/083_organisation_customers.sql");
  const actions = read("lib/projects/actions.ts");
  const customerActions = read("lib/customers/actions.ts");
  const dialog = read("components/projects/NewProjectDialog.tsx");
  const edit = read("components/projects/EditProjectDialog.tsx");
  const sidebar = read("components/app-sidebar.tsx");
  const mobile = read("components/layout/mobile-nav.tsx");
  const menu = read("components/layout/mobile-menu-sheet.tsx");
  const page = read("app/(protected)/app/customers/page.tsx");
  const directory = read("components/customers/CustomersDirectory.tsx");

  section("MIGRATION");
  assert("no Preview ref", !sql.includes(PREVIEW_SUPABASE_PROJECT_REF));
  assert("no Production ref", !sql.includes(PRODUCTION_SUPABASE_PROJECT_REF));
  assert("table is customers", sql.includes("create table if not exists public.customers"));
  assert("nullable project customer link", sql.includes("customer_id uuid"));
  assert("same organisation trigger", sql.includes("PROJECT_CUSTOMER_ORG_MISMATCH"));
  assert("no cascade from customer to project", sql.includes("on delete set null"));
  assert("no unique email", !/unique \(.*email/i.test(sql));
  assert("archive column", sql.includes("archived_at timestamptz"));
  assert("work role on insert and update", sql.includes("public.auth_can_mutate_work()"));
  assert("active member read", sql.includes("m.status = 'active'"));
  assert("no authenticated delete grant", !sql.includes("grant delete on table public.customers to authenticated"));
  assert("atomic function is security invoker", /create_project_with_new_customer[\s\S]*security invoker/.test(sql));
  assert("both inserts share the exception block", (() => {
    const start = sql.indexOf("begin\n    insert into public.customers");
    const handler = sql.indexOf("exception", start);
    const projectInsert = sql.indexOf("insert into public.projects", start);
    return start > 0 && projectInsert > start && projectInsert < handler;
  })());
  assert("repeat request returns existing project", sql.includes("p.creation_request_id = p_creation_request_id"));
  assert("new project still starts at brief", sql.includes("'brief'"));
  assert("does not mention quote or pricing updates", !/update public\.quotes|update public\.pricing_documents|update public\.variations/i.test(sql));

  section("AUTHORITY");
  const createStart = actions.indexOf("export async function createProject");
  const createBody = actions.slice(createStart, createStart + 900);
  assert("createProject still checks projects.create first", createBody.includes('permission: "projects.create"') && createBody.includes('entitlement: "projects.create"'));
  assert("new customer uses the transaction function", actions.includes('rpc(\n      "create_project_with_new_customer"') || actions.includes('"create_project_with_new_customer"'));
  assert("permission check is before the customer transaction", actions.indexOf('permission: "projects.create"') < actions.indexOf("create_project_with_new_customer"));
  assert("existing customer is copied, not updated", actions.includes("projectSnapshotFromCustomer") && !actions.includes('.from("customers")\n      .update'));
  assert("customer edits do not write projects", !customerActions.includes('.from("projects")'));
  assert("customer edits do not write quotes or pricing", !customerActions.includes("quotes") && !customerActions.includes("pricing_documents"));
  assert("draft pricing sync remains limited to draft and reviewed", actions.includes('.in("status", ["draft", "reviewed"])'));
  assert("directory create uses projects.create", customerActions.includes('requireCustomerContext("projects.create")'));
  assert("directory edit uses projects.edit", customerActions.includes('requireCustomerContext("projects.edit")'));

  section("UI");
  assert("page heading and copy", page.includes("Customers") && page.includes("Save customer details for faster project setup."));
  assert("viewer gates", page.includes("memberCanCreateProjects") && page.includes("memberCanEditProjects"));
  assert(
    "search and archive disclosure",
    directory.includes("Search name, email or phone") &&
      directory.includes("Show archived") &&
      directory.includes('type="checkbox"')
  );
  assert(
    "job handoff closes after the project id",
    dialog.includes("result?.projectId") &&
      dialog.includes("router.push(destination)") &&
      dialog.includes("forgetNewProjectTrigger") &&
      dialog.includes("closedAfterCreate") &&
      !dialog.includes("NEXT_REDIRECT")
  );
  assert(
    "selected customer is one panel",
    read("components/customers/CustomerPicker.tsx").includes("Search customers") &&
      read("components/customers/CustomerPicker.tsx").includes("Search by name, email or phone") &&
      read("components/customers/CustomerPicker.tsx").includes("Change customer") &&
      read("components/customers/CustomerPicker.tsx").includes("data-selected-customer")
  );
  assert("desktop list and mobile cards", directory.includes('data-customer-list="aligned"') && directory.includes('data-customer-list="stacked"') && directory.includes("md:hidden") && directory.includes("md:block"));
  assert("sidebar places Customers after Projects and before Rates", (() => {
    const projects = sidebar.indexOf('label: "Projects"');
    const customers = sidebar.indexOf('label: "Customers"');
    const rates = sidebar.indexOf('label: "Rates"');
    return projects < customers && customers < rates;
  })());
  assert("mobile bar stays five items", mobile.includes('data-mobile-nav="five"') && !mobile.includes("/app/customers"));
  assert("menu sheet includes Customers", menu.includes('destination("/app/customers", "Customers"'));
  assert("job dialog has the three customer choices", dialog.includes("Existing customer") && dialog.includes("New customer") && dialog.includes("No customer yet"));
  assert("job dialog keeps job name and site", dialog.includes('htmlFor="project-title"') && dialog.includes('htmlFor="site-address"'));
  assert("edit explains project-only changes", edit.includes("Changes here apply to this project only.") && edit.includes("No linked customer"));
  assert("directory explains document snapshots", read("components/customers/CustomerFormDialog.tsx").includes("Existing projects and issued documents keep their saved details."));

  section("PURE RULES");
  const filtered = filterCustomers(
    [
      { name: "Ada Mason", email: "ada@example.com", phone: "021111" },
      { name: "Bea Cole", email: null, phone: "022222" },
    ],
    "ada@example"
  );
  assert("search matches email", filtered.length === 1 && filtered[0]?.name === "Ada Mason");
  assert("search matches phone", filterCustomers([{ name: "Bea Cole", email: null, phone: "022222" }], "022").length === 1);
  const snapshot = projectSnapshotFromCustomer({ name: "Ada Mason", email: "ada@example.com" });
  assert("snapshot copies name and email", snapshot.client_name === "Ada Mason" && snapshot.client_email === "ada@example.com");
  assert("owner admin estimator can create projects", roleAllowsPermission("owner", "projects.create") && roleAllowsPermission("admin", "projects.create") && roleAllowsPermission("estimator", "projects.create"));
  assert("viewer cannot create or edit projects", !roleAllowsPermission("viewer", "projects.create") && !roleAllowsPermission("viewer", "projects.edit"));

  section("PROTECTED PATHS UNTOUCHED");
  for (const file of [
    "lib/estimate-math.ts",
    "lib/quotes/snapshot-fingerprint.ts",
    "lib/pricing/mappers.ts",
  ]) {
    assert(`${file} is not imported by customer actions`, !customerActions.includes(file));
  }
}

async function liveMain() {
  section("LIVE PREVIEW");
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
  const password = `cust-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userIds: string[] = [];

  async function createBoundUser(
    role: "owner" | "admin" | "estimator" | "viewer",
    orgId: string,
    status: "active" | "pending_billing" | "removed" = "active"
  ) {
    const email = `cust-${role}-${status}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
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
      full_name: `Customers ${role}`,
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
      { id: orgA, name: `Customers A ${suffix}` },
      { id: orgB, name: `Customers B ${suffix}` },
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

    const owner = await signIn(url, anon, ownerA.email, password);
    const adminUser = await signIn(url, anon, adminA.email, password);
    const estimator = await signIn(url, anon, estimatorA.email, password);
    const viewer = await signIn(url, anon, viewerA.email, password);
    const inactive = await signIn(url, anon, inactiveA.email, password);
    const removed = await signIn(url, anon, removedA.email, password);
    const foreign = await signIn(url, anon, ownerB.email, password);

    const existing = await owner.from("customers").insert({
      org_id: orgA,
      created_by: ownerA.userId,
      name: `Existing ${suffix}`,
      email: `existing-${suffix}@example.invalid`,
      phone: "021000111",
    }).select("id").single();
    if (existing.error || !existing.data) throw new Error(existing.error?.message ?? "customer insert failed");
    const customerId = existing.data.id as string;

    const noCustomer = await owner.from("projects").insert({
      org_id: orgA,
      created_by: ownerA.userId,
      title: `No customer ${suffix}`,
      stage: "brief",
      client_name: null,
      client_email: null,
      customer_id: null,
    }).select("id, client_name, customer_id, stage").single();
    assert("no-customer project is allowed", !noCustomer.error && noCustomer.data?.customer_id == null && noCustomer.data?.stage === "brief");

    const selected = await owner.from("projects").insert({
      org_id: orgA,
      created_by: ownerA.userId,
      title: `Selected ${suffix}`,
      stage: "brief",
      client_name: `Existing ${suffix}`,
      client_email: `existing-${suffix}@example.invalid`,
      customer_id: customerId,
    }).select("id, client_name, client_email, customer_id").single();
    assert("existing customer selection stores the snapshot and link", !selected.error && selected.data?.customer_id === customerId && selected.data?.client_name === `Existing ${suffix}`);
    const projectId = selected.data?.id as string;

    const quote = await admin.from("quotes").insert({
      org_id: orgA,
      project_id: projectId,
      title: `Issued ${suffix}`,
      status: "sent",
      client_name: `Existing ${suffix}`,
      created_by: ownerA.userId,
    }).select("id, client_name").single();
    assert("issued quote snapshot can be stored", !quote.error && quote.data?.client_name === `Existing ${suffix}`);
    const quoteId = quote.data?.id as string;

    const pricing = await admin.from("pricing_documents").insert({
      org_id: orgA,
      project_id: projectId,
      title: `Pricing ${suffix}`,
      status: "converted_to_quote",
      client_name: `Existing ${suffix}`,
      created_by: ownerA.userId,
    }).select("id, client_name").single();
    assert("converted pricing snapshot can be stored", !pricing.error && pricing.data?.client_name === `Existing ${suffix}`);

    const renamed = await owner.from("customers").update({ name: `Renamed ${suffix}`, email: `renamed-${suffix}@example.invalid` }).eq("id", customerId).select("id, name").single();
    assert("owner can edit a customer", !renamed.error && renamed.data?.name === `Renamed ${suffix}`);
    const projectAfterCustomerEdit = await admin.from("projects").select("client_name, client_email").eq("id", projectId).single();
    assert("customer edit does not change the project snapshot", projectAfterCustomerEdit.data?.client_name === `Existing ${suffix}` && projectAfterCustomerEdit.data?.client_email === `existing-${suffix}@example.invalid`);
    const quoteAfter = await admin.from("quotes").select("client_name, status").eq("id", quoteId).single();
    assert("issued quote identity is unchanged", quoteAfter.data?.status === "sent" && quoteAfter.data?.client_name === `Existing ${suffix}`);
    const pricingAfter = await admin.from("pricing_documents").select("client_name, status").eq("id", pricing.data?.id).single();
    assert("converted pricing snapshot is unchanged", pricingAfter.data?.status === "converted_to_quote" && pricingAfter.data?.client_name === `Existing ${suffix}`);

    const projectEdit = await owner.from("projects").update({ client_name: `Project only ${suffix}`, client_email: `project-${suffix}@example.invalid` }).eq("id", projectId).select("client_name").single();
    const customerAfterProjectEdit = await admin.from("customers").select("name, email").eq("id", customerId).single();
    assert("project client edit does not change the customer", !projectEdit.error && customerAfterProjectEdit.data?.name === `Renamed ${suffix}` && customerAfterProjectEdit.data?.email === `renamed-${suffix}@example.invalid`);

    const adminCustomer = await adminUser.from("customers").insert({
      org_id: orgA,
      created_by: adminA.userId,
      name: `Admin ${suffix}`,
    }).select("id");
    assert("admin can create a customer", !adminCustomer.error && adminCustomer.data?.length === 1);
    const estimatorCustomer = await estimator.from("customers").insert({
      org_id: orgA,
      created_by: estimatorA.userId,
      name: `Estimator ${suffix}`,
      email: `shared-${suffix}@example.invalid`,
    }).select("id");
    assert("estimator can create a customer", !estimatorCustomer.error && estimatorCustomer.data?.length === 1);
    const sharedEmail = await owner.from("customers").insert({
      org_id: orgA,
      created_by: ownerA.userId,
      name: `Shared email ${suffix}`,
      email: `shared-${suffix}@example.invalid`,
    }).select("id");
    assert("shared email addresses are allowed", !sharedEmail.error && sharedEmail.data?.length === 1);

    const viewerRead = await viewer.from("customers").select("id").eq("id", customerId);
    assert("viewer can read organisation customers", !viewerRead.error && viewerRead.data?.length === 1);
    const viewerWrite = await viewer.from("customers").update({ phone: "099" }).eq("id", customerId).select("id");
    assert("viewer customer update denied", deniedWrite(viewerWrite.data, viewerWrite.error));
    const viewerInsert = await viewer.from("customers").insert({ org_id: orgA, created_by: viewerA.userId, name: "Viewer customer" });
    assert("viewer customer insert denied", Boolean(viewerInsert.error));

    const inactiveRead = await inactive.from("customers").select("id").eq("id", customerId);
    assert("pending_billing cannot read customers", deniedWrite(inactiveRead.data, inactiveRead.error));
    const removedRead = await removed.from("customers").select("id").eq("id", customerId);
    assert("removed membership cannot read customers", deniedWrite(removedRead.data, removedRead.error));
    const foreignRead = await foreign.from("customers").select("id").eq("id", customerId);
    assert("cross-organisation read denied", deniedWrite(foreignRead.data, foreignRead.error));
    const foreignInsert = await foreign.from("customers").insert({ org_id: orgA, created_by: ownerB.userId, name: "Foreign" });
    assert("cross-organisation insert denied", Boolean(foreignInsert.error));
    const anonRead = await anonClient.from("customers").select("id").eq("id", customerId);
    assert("anonymous read denied", deniedWrite(anonRead.data, anonRead.error));
    const anonInsert = await anonClient.from("customers").insert({ org_id: orgA, name: "Anon" });
    assert("anonymous insert denied", Boolean(anonInsert.error));

    const mismatch = await owner.from("projects").insert({
      org_id: orgA,
      created_by: ownerA.userId,
      title: `Mismatch ${suffix}`,
      stage: "brief",
      customer_id: customerId,
    });
    const foreignCustomer = await admin.from("customers").insert({
      org_id: orgB,
      created_by: ownerB.userId,
      name: `Foreign customer ${suffix}`,
    }).select("id").single();
    const crossLink = await owner.from("projects").update({ customer_id: foreignCustomer.data?.id }).eq("id", projectId).select("id");
    assert("project cannot link a customer from another organisation", Boolean(mismatch.error) === false && deniedWrite(crossLink.data, crossLink.error));

    const archived = await owner.from("customers").update({ archived_at: new Date().toISOString() }).eq("id", customerId).select("id, archived_at").single();
    assert("owner can archive", !archived.error && Boolean(archived.data?.archived_at));
    const stillLinked = await admin.from("projects").select("customer_id").eq("id", projectId).single();
    assert("archived customer stays on the project", stillLinked.data?.customer_id === customerId);
    const activeList = await owner.from("customers").select("id").eq("org_id", orgA).is("archived_at", null).eq("id", customerId);
    assert("archived customer is excluded from active selection", !activeList.error && activeList.data?.length === 0);
    const restored = await owner.from("customers").update({ archived_at: null }).eq("id", customerId).select("archived_at").single();
    assert("owner can restore", !restored.error && restored.data?.archived_at == null);

    const found = await owner.from("customers").select("id, name, email, phone").eq("org_id", orgA).ilike("phone", "%021000111%");
    assert("customer search can match phone", !found.error && found.data?.some((row) => row.id === customerId));

    const requestId = randomUUID();
    const created = await owner.rpc("create_project_with_new_customer", {
      p_title: `Atomic ${suffix}`,
      p_customer_name: `Atomic customer ${suffix}`,
      p_customer_email: `atomic-${suffix}@example.invalid`,
      p_customer_phone: "021555",
      p_site_address: "1 Test Road",
      p_creation_request_id: requestId,
    });
    assert("new customer and project are created together", !created.error && typeof created.data === "string");
    const atomicProject = await admin.from("projects").select("id, stage, client_name, client_email, customer_id, business_status").eq("id", created.data).single();
    const atomicCustomer = await admin.from("customers").select("id, name, email").eq("id", atomicProject.data?.customer_id).single();
    assert(
      "atomic project starts at brief and copies the customer snapshot",
      atomicProject.data?.stage === "brief" &&
        atomicProject.data?.business_status === "lead" &&
        atomicProject.data?.client_name === `Atomic customer ${suffix}` &&
        atomicProject.data?.client_email === `atomic-${suffix}@example.invalid` &&
        atomicCustomer.data?.name === `Atomic customer ${suffix}`
    );
    const repeat = await owner.rpc("create_project_with_new_customer", {
      p_title: `Atomic duplicate ${suffix}`,
      p_customer_name: `Should not exist ${suffix}`,
      p_customer_email: null,
      p_customer_phone: null,
      p_site_address: null,
      p_creation_request_id: requestId,
    });
    const duplicateCustomers = await admin.from("customers").select("id").eq("org_id", orgA).eq("name", `Should not exist ${suffix}`);
    assert("repeat submit returns the same project and creates no second customer", repeat.data === created.data && duplicateCustomers.data?.length === 0);

    const beforeFail = await admin.from("customers").select("id", { count: "exact", head: true }).eq("org_id", orgA);
    const viewerRpc = await viewer.rpc("create_project_with_new_customer", {
      p_title: `Viewer job ${suffix}`,
      p_customer_name: `Viewer customer ${suffix}`,
      p_customer_email: null,
      p_customer_phone: null,
      p_site_address: null,
      p_creation_request_id: randomUUID(),
    });
    const longTitle = "x".repeat(121);
    const invalidRpc = await owner.rpc("create_project_with_new_customer", {
      p_title: longTitle,
      p_customer_name: `Invalid title customer ${suffix}`,
      p_customer_email: null,
      p_customer_phone: null,
      p_site_address: null,
      p_creation_request_id: randomUUID(),
    });
    const afterFail = await admin.from("customers").select("id", { count: "exact", head: true }).eq("org_id", orgA);
    const invalidRows = await admin.from("customers").select("id").eq("name", `Invalid title customer ${suffix}`);
    const viewerRows = await admin.from("customers").select("id").eq("name", `Viewer customer ${suffix}`);
    assert("viewer transaction is denied", Boolean(viewerRpc.error));
    assert("invalid project is denied", Boolean(invalidRpc.error));
    assert("failed project creation creates no customer", viewerRows.data?.length === 0 && invalidRows.data?.length === 0 && beforeFail.count === afterFail.count);
  } finally {
    await admin.from("organisations").delete().eq("id", orgA);
    await admin.from("organisations").delete().eq("id", orgB);
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
