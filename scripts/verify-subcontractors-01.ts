/**
 * Subcontractor directory (Contacts phase 1).
 *
 * Static: npx tsx scripts/verify-subcontractors-01.ts
 * Live Preview: npx tsx scripts/verify-subcontractors-01.ts --live
 *
 * --live uses disposable Preview rows and deletes them. Refuses Production.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { subcontractorSchema } from "../lib/subcontractors/schema";
import {
  filterSubcontractors,
  suggestSubcontractorsForWorkArea,
} from "../lib/subcontractors/search";
import type { Subcontractor } from "../lib/subcontractors/types";
import { SUBCONTRACTOR_WORK_AREA_TYPES } from "../lib/subcontractors/work-areas";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";
import { permissionsForRole, roleAllowsPermission } from "../lib/team/permissions";

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

function sample(overrides: Partial<Subcontractor> = {}): Subcontractor {
  return {
    id: "1",
    trading_name: "North Plumbing",
    legal_name: null,
    website: null,
    country: "Australia",
    service_regions: ["Auckland"],
    work_area_types: ["bathroom"],
    specialties: "Waterproofing",
    internal_notes: null,
    preferred_pricing_method: null,
    currency: null,
    abn: null,
    gst_number: null,
    gst_notes: null,
    minimum_charge_notes: null,
    travel_notes: null,
    archived_at: null,
    created_at: "",
    updated_at: "",
    contacts: [
      {
        id: "c1",
        name: "Ada Mason",
        role: "Estimator",
        email: "office@example.invalid",
        phone: "021111",
        is_primary: true,
        preferred_contact: "email",
      },
    ],
    documents: [],
    ...overrides,
  };
}

function staticMain() {
  console.log("=== subcontractors directory ===");
  const sql = read("supabase/migrations/087_organisation_subcontractors.sql");
  const actions = read("lib/subcontractors/actions.ts");
  const rates = read("lib/estimate/rates.ts");
  const directory = read("components/subcontractors/SubcontractorsDirectory.tsx");
  const dialog = read("components/subcontractors/SubcontractorFormDialog.tsx");
  const sidebar = read("components/app-sidebar.tsx");
  const mobile = read("components/layout/mobile-nav.tsx");
  const menu = read("components/layout/mobile-menu-sheet.tsx");
  const page = read("app/(protected)/app/contacts/subcontractors/page.tsx");
  const customersSql = read("supabase/migrations/083_organisation_customers.sql");

  section("MIGRATION");
  assert("no Preview ref", !sql.includes(PREVIEW_SUPABASE_PROJECT_REF));
  assert("no Production ref", !sql.includes(PRODUCTION_SUPABASE_PROJECT_REF));
  assert("business table", sql.includes("create table if not exists public.subcontractors"));
  assert("contacts table", sql.includes("create table if not exists public.subcontractor_contacts"));
  assert("document metadata table", sql.includes("create table if not exists public.subcontractor_documents"));
  assert("does not alter customers", !/alter table public\.customers/i.test(sql));
  assert("customers migration remains", customersSql.includes("create table if not exists public.customers"));
  assert("no rates writes", !/insert into public\.rates|update public\.rates|alter table public\.rates/i.test(sql));
  assert("no quote or estimate writes", !/update public\.quotes|update public\.estimates|insert into public\.pricing/i.test(sql));
  assert("email is not unique", !/unique \(.*email/i.test(sql));
  assert("one primary contact", sql.includes("subcontractor_contacts_one_primary_uidx"));
  assert("archive column", sql.includes("archived_at timestamptz"));
  assert("work role on insert and update", sql.includes("public.auth_can_mutate_work()"));
  assert("active member read", sql.includes("m.status = 'active'"));
  assert(
    "no authenticated delete grant",
    !sql.includes("grant delete on table public.subcontractors to authenticated") &&
      !sql.includes("grant delete on table public.subcontractor_contacts to authenticated") &&
      !sql.includes("grant delete on table public.subcontractor_documents to authenticated")
  );
  assert("save function is security invoker", /save_subcontractor_v1[\s\S]*security invoker/.test(sql));
  assert("capability tags are not rates", sql.includes("Not a priced rate"));
  assert("commercial details are not verified", sql.includes("Not verified."));
  assert("minimum charge is notes", sql.includes("minimum_charge_notes") && !sql.includes("minimum_charge_cents"));
  assert("documents have no storage path", !sql.includes("storage_path") && !sql.includes("create bucket"));
  assert("anonymous access is revoked", sql.includes("revoke all on table public.subcontractors from public, anon, authenticated"));
  for (const type of SUBCONTRACTOR_WORK_AREA_TYPES) {
    assert(`capability list includes ${type}`, sql.includes(`'${type}'`));
  }

  section("AUTHORITY");
  assert("directory save checks subcontractors.edit", actions.includes('permission: "subcontractors.edit"'));
  assert("directory save keeps the project billing gate", actions.includes('entitlement: "projects.create"'));
  assert("actions do not call the rate resolver", !actions.includes("resolveRate") && !actions.includes("lib/estimate/rates"));
  assert("rate resolver file is unchanged by this module", rates.includes("export function resolveRate"));
  assert("actions do not write customers, projects, quotes, or rates", !actions.includes('.from("customers")') && !actions.includes('.from("projects")') && !actions.includes('.from("quotes")') && !actions.includes('.from("rates")'));

  section("UI");
  assert("subcontractor page is read-only for viewers", page.includes("memberCanEditSubcontractors"));
  assert("search, work area, and archive", directory.includes("Search trading name, contact, email or phone") && directory.includes("All work areas") && directory.includes("Show archived"));
  assert("desktop rows and mobile cards", directory.includes('data-subcontractor-list="aligned"') && directory.includes('data-subcontractor-list="stacked"') && directory.includes("md:hidden") && directory.includes("md:block"));
  assert("status badges", directory.includes("Active") && directory.includes("Archived"));
  assert("no invented job history", !directory.includes("Prior jobs") && !directory.includes("RFQ score"));
  assert("dialog allows shared contact details and unverified commercial notes", dialog.includes("share an email or phone") && dialog.includes("Not verified") && dialog.includes("Uploading the file is not part of this directory."));
  assert("sidebar Contacts destination", sidebar.includes('href: "/app/contacts"') && sidebar.includes('label: "Contacts"'));
  assert("mobile bar stays five items without Contacts", mobile.includes('data-mobile-nav="five"') && !mobile.includes("/app/contacts"));
  assert("menu includes Contacts", menu.includes('destination("/app/contacts", "Contacts"'));

  section("PURE RULES");
  const shared = subcontractorSchema.safeParse({
    trading_name: "North Plumbing",
    work_area_types: ["bathroom"],
    service_regions: ["Auckland"],
    contacts: [
      { name: "Ada Mason", email: "office@example.invalid", phone: "021", is_primary: true },
      { name: "Bea Cole", email: "office@example.invalid", phone: "021", is_primary: false },
    ],
    documents: [],
  });
  assert("shared office email is allowed", shared.success);
  const unknown = subcontractorSchema.safeParse({
    trading_name: "North Plumbing",
    work_area_types: ["not-a-work-area"],
    service_regions: [],
    contacts: [],
    documents: [],
  });
  assert("unknown capability tag is rejected", !unknown.success);
  const filtered = filterSubcontractors(
    [sample(), sample({ id: "2", trading_name: "South Electric", work_area_types: ["kitchen"], contacts: [] })],
    "office@example",
    "bathroom"
  );
  assert("search and work area filter together", filtered.length === 1 && filtered[0]?.trading_name === "North Plumbing");
  const suggested = suggestSubcontractorsForWorkArea(
    [
      sample(),
      sample({ id: "2", archived_at: "2026-01-01T00:00:00Z", work_area_types: ["bathroom"] }),
      sample({ id: "3", trading_name: "Other", work_area_types: ["deck"], contacts: [] }),
    ],
    "bathroom"
  );
  assert("suggestion uses active capability tags only", suggested.length === 1 && suggested[0]?.id === "1");
  assert(
    "owner admin estimator can edit subcontractors",
    roleAllowsPermission("owner", "subcontractors.edit") &&
      roleAllowsPermission("admin", "subcontractors.edit") &&
      roleAllowsPermission("estimator", "subcontractors.edit")
  );
  assert("viewer cannot edit subcontractors", !roleAllowsPermission("viewer", "subcontractors.edit"));
  assert(
    "viewer permission list is unchanged",
    permissionsForRole("viewer").join(",") === "team.view,billing.view"
  );
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
  const password = `sub-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userIds: string[] = [];
  const sharedEmail = `office-${suffix}@example.invalid`;

  async function createBoundUser(
    role: "owner" | "admin" | "estimator" | "viewer",
    orgId: string,
    status: "active" | "pending_billing" | "removed" = "active"
  ) {
    const email = `sub-${role}-${status}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
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
      full_name: `Subcontractors ${role}`,
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
      { id: orgA, name: `Subcontractors A ${suffix}` },
      { id: orgB, name: `Subcontractors B ${suffix}` },
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

    const customersBefore = await admin.from("customers").select("id", { count: "exact", head: true }).eq("org_id", orgA);
    const saved = await owner.rpc("save_subcontractor_v1", {
      p_payload: {
        trading_name: `North Plumbing ${suffix}`,
        legal_name: `North Plumbing Pty Ltd ${suffix}`,
        country: "Australia",
        service_regions: ["Auckland", "North Shore"],
        work_area_types: ["bathroom", "kitchen"],
        specialties: "Waterproofing",
        preferred_pricing_method: "quoted",
        currency: "aud",
        abn: "12 345 678 901",
        gst_number: "123-456-789",
        minimum_charge_notes: "Call-out note only",
        contacts: [
          {
            name: `Ada Mason ${suffix}`,
            role: "Estimator",
            email: sharedEmail,
            phone: "021000111",
            is_primary: true,
            preferred_contact: "email",
          },
          {
            name: `Bea Cole ${suffix}`,
            role: "Accounts",
            email: sharedEmail,
            phone: "021000111",
            is_primary: false,
            preferred_contact: "phone",
          },
        ],
        documents: [
          {
            document_kind: "insurance",
            title: `Public liability ${suffix}`,
            reference: "PL-100",
            expires_on: "2027-01-01",
            notes: "Supplied, not verified",
          },
        ],
      },
    });
    assert("owner can save a subcontractor", !saved.error && typeof saved.data === "string");
    const subcontractorId = saved.data as string;

    const contacts = await owner
      .from("subcontractor_contacts")
      .select("id, name, email, phone, is_primary")
      .eq("subcontractor_id", subcontractorId)
      .is("archived_at", null);
    assert(
      "two contacts can share one office email and phone",
      !contacts.error &&
        contacts.data?.length === 2 &&
        contacts.data.every((row) => row.email === sharedEmail && row.phone === "021000111") &&
        contacts.data.filter((row) => row.is_primary).length === 1
    );

    const business = await owner
      .from("subcontractors")
      .select("currency, abn, work_area_types, minimum_charge_notes")
      .eq("id", subcontractorId)
      .single();
    assert(
      "currency is stored and commercial notes are not a numeric rate",
      business.data?.currency === "AUD" &&
        business.data?.abn === "12 345 678 901" &&
        Array.isArray(business.data?.work_area_types) &&
        business.data.work_area_types.includes("bathroom") &&
        business.data?.minimum_charge_notes === "Call-out note only"
    );

    const documents = await owner
      .from("subcontractor_documents")
      .select("title, document_kind, expires_on")
      .eq("subcontractor_id", subcontractorId)
      .is("archived_at", null);
    assert(
      "document metadata is stored without a file",
      !documents.error && documents.data?.length === 1 && documents.data[0]?.document_kind === "insurance"
    );

    const second = await owner.rpc("save_subcontractor_v1", {
      p_payload: {
        trading_name: `Shared Office ${suffix}`,
        work_area_types: ["deck"],
        contacts: [{ name: `Cam ${suffix}`, email: sharedEmail, is_primary: true }],
        documents: [],
      },
    });
    assert("another business can reuse the same email", !second.error && typeof second.data === "string");

    const found = await owner
      .from("subcontractors")
      .select("id, trading_name")
      .eq("org_id", orgA)
      .ilike("trading_name", `%North Plumbing ${suffix}%`);
    assert("search can match the trading name", !found.error && found.data?.some((row) => row.id === subcontractorId));
    const byArea = await owner
      .from("subcontractors")
      .select("id")
      .eq("org_id", orgA)
      .contains("work_area_types", ["bathroom"]);
    assert(
      "work area filter matches capability tags",
      !byArea.error &&
        byArea.data?.some((row) => row.id === subcontractorId) &&
        !byArea.data?.some((row) => row.id === second.data)
    );

    const twoPrimaries = await owner.rpc("save_subcontractor_v1", {
      p_payload: {
        id: subcontractorId,
        trading_name: `North Plumbing ${suffix}`,
        work_area_types: ["bathroom"],
        contacts: [
          { name: "Ada", email: sharedEmail, is_primary: true },
          { name: "Bea", email: sharedEmail, is_primary: true },
        ],
        documents: [],
      },
    });
    assert("two primary contacts are rejected", Boolean(twoPrimaries.error));

    const adminSaved = await adminUser.rpc("save_subcontractor_v1", {
      p_payload: {
        trading_name: `Admin Trade ${suffix}`,
        work_area_types: ["painting"],
        contacts: [],
        documents: [],
      },
    });
    assert("admin can create a subcontractor", !adminSaved.error && typeof adminSaved.data === "string");
    const estimatorSaved = await estimator.rpc("save_subcontractor_v1", {
      p_payload: {
        trading_name: `Estimator Trade ${suffix}`,
        work_area_types: ["fence"],
        contacts: [],
        documents: [],
      },
    });
    assert("estimator can create a subcontractor", !estimatorSaved.error && typeof estimatorSaved.data === "string");

    const viewerRead = await viewer.from("subcontractors").select("id").eq("id", subcontractorId);
    assert("viewer can read organisation subcontractors", !viewerRead.error && viewerRead.data?.length === 1);
    const viewerContacts = await viewer.from("subcontractor_contacts").select("id").eq("subcontractor_id", subcontractorId);
    assert("viewer can read contacts", !viewerContacts.error && (viewerContacts.data?.length ?? 0) >= 1);
    const viewerWrite = await viewer.from("subcontractors").update({ specialties: "Denied" }).eq("id", subcontractorId).select("id");
    assert("viewer subcontractor update denied", deniedWrite(viewerWrite.data, viewerWrite.error));
    const viewerInsert = await viewer.from("subcontractors").insert({
      org_id: orgA,
      created_by: viewerA.userId,
      trading_name: `Viewer trade ${suffix}`,
    });
    assert("viewer subcontractor insert denied", Boolean(viewerInsert.error));
    const viewerRpc = await viewer.rpc("save_subcontractor_v1", {
      p_payload: { trading_name: `Viewer rpc ${suffix}`, contacts: [], documents: [] },
    });
    assert("viewer save is denied", Boolean(viewerRpc.error));

    const inactiveRead = await inactive.from("subcontractors").select("id").eq("id", subcontractorId);
    assert("pending_billing cannot read subcontractors", deniedWrite(inactiveRead.data, inactiveRead.error));
    const removedRead = await removed.from("subcontractors").select("id").eq("id", subcontractorId);
    assert("removed membership cannot read subcontractors", deniedWrite(removedRead.data, removedRead.error));
    const foreignRead = await foreign.from("subcontractors").select("id").eq("id", subcontractorId);
    assert("cross-organisation read denied", deniedWrite(foreignRead.data, foreignRead.error));
    const foreignContacts = await foreign.from("subcontractor_contacts").select("id").eq("subcontractor_id", subcontractorId);
    assert("cross-organisation contact read denied", deniedWrite(foreignContacts.data, foreignContacts.error));
    const foreignInsert = await foreign.from("subcontractors").insert({
      org_id: orgA,
      created_by: ownerB.userId,
      trading_name: `Foreign ${suffix}`,
    });
    assert("cross-organisation insert denied", Boolean(foreignInsert.error));
    const anonRead = await anonClient.from("subcontractors").select("id").eq("id", subcontractorId);
    assert("anonymous read denied", deniedWrite(anonRead.data, anonRead.error));

    const unknown = await owner.from("subcontractors").insert({
      org_id: orgA,
      created_by: ownerA.userId,
      trading_name: `Unknown area ${suffix}`,
      work_area_types: ["not-a-work-area"],
    });
    assert("unknown capability tag is rejected in the database", Boolean(unknown.error));

    const removedContact = await owner.from("subcontractor_contacts").delete().eq("subcontractor_id", subcontractorId).select("id");
    assert("authenticated contact delete denied", deniedWrite(removedContact.data, removedContact.error));
    const removedBusiness = await owner.from("subcontractors").delete().eq("id", subcontractorId).select("id");
    assert("authenticated business delete denied", deniedWrite(removedBusiness.data, removedBusiness.error));

    const archived = await owner
      .from("subcontractors")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", subcontractorId)
      .select("id, archived_at")
      .single();
    assert("owner can archive", !archived.error && Boolean(archived.data?.archived_at));
    const contactsAfterArchive = await admin
      .from("subcontractor_contacts")
      .select("id")
      .eq("subcontractor_id", subcontractorId)
      .is("archived_at", null);
    assert("archive keeps the contact rows", (contactsAfterArchive.data?.length ?? 0) >= 2);
    const activeList = await owner
      .from("subcontractors")
      .select("id")
      .eq("org_id", orgA)
      .is("archived_at", null)
      .eq("id", subcontractorId);
    assert("archived business leaves the active directory", !activeList.error && activeList.data?.length === 0);
    const restored = await owner
      .from("subcontractors")
      .update({ archived_at: null })
      .eq("id", subcontractorId)
      .select("archived_at")
      .single();
    assert("owner can restore", !restored.error && restored.data?.archived_at == null);

    const rates = await admin.from("rates").select("id").eq("org_id", orgA).ilike("item_key", `%${suffix}%`);
    assert("saving a subcontractor does not write a rate", !rates.error && (rates.data?.length ?? 0) === 0);
    const customersAfter = await admin.from("customers").select("id", { count: "exact", head: true }).eq("org_id", orgA);
    assert("subcontractor saves do not create customers", customersBefore.count === customersAfter.count);
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
