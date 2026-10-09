/**
 * RFQ phase 2.
 *
 * Static: npx tsx scripts/verify-rfq-01.ts
 * Live Preview: npx tsx scripts/verify-rfq-01.ts --live
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { evaluateOrgEntitlement } from "../lib/billing/entitlements";
import { planAllowsCapability, trialAllowsCapability } from "../lib/billing/entitlement-matrix";
import { buildInternalTrialSubscription } from "../lib/billing/trial";
import type { OrgBillingState } from "../lib/billing/types";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";
import { composeJobDraft } from "../lib/rfqs/draft-compose";
import { NO_RELIABLE_SCOPE, selectWorkAreaScope } from "../lib/rfqs/scope-selection";
import { mismatchedScheduleQuantity, parseScheduleMeasure } from "../lib/rfqs/schedule";
import { rfqEmailLogoUrl } from "../lib/rfqs/email";
import { sharedAnswerLeak, withholdReason } from "../lib/rfqs/draft-privacy";
import { buildRfqDeliveryEmail } from "../lib/rfqs/email";
import { scopeIsMeaningful } from "../lib/rfqs/validate";
import { RFQ_WITHHELD } from "../lib/rfqs/shared";
import { rfqResponseLabel } from "../lib/rfqs/states";
import { generateRfqAccessToken, hashRfqAccessToken, isRfqAccessTokenFormat } from "../lib/rfqs/token";
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function staticMain() {
  console.log("=== rfq phase 2 ===");
  const sql = read("supabase/migrations/090_rfq_requests.sql");
  const actions = read("lib/rfqs/actions.ts");
  const email = read("lib/rfqs/email.ts");
  const rates = read("lib/estimate/rates.ts");
  const mobile = read("components/layout/mobile-nav.tsx");
  const header = read("components/projects/ProjectSectionHeader.tsx");
  const composer = read("components/rfqs/RfqComposer.tsx");
  const detail = read("components/rfqs/RfqDetailView.tsx");
  const pub = read("components/rfqs/RfqPublicExperience.tsx");
  const webhook = read("app/api/webhooks/resend/route.ts");

  section("ENTITLEMENT");
  const now = new Date("2026-10-07T00:00:00.000Z");
  const billingBase = {
    orgId: "00000000-0000-4000-8000-000000000001",
    billingEnvironment: "test" as const,
    customer: null,
    activeOverride: null,
    effectiveTrialState: null,
  };
  const billingState = (subscription: OrgBillingState["subscription"]): OrgBillingState => ({
    ...billingBase,
    subscription,
  });
  const activeTrial = buildInternalTrialSubscription({
    id: "trial-active",
    orgId: billingBase.orgId,
    billingEnvironment: "test",
    now,
    trialEndsAt: new Date("2026-11-01T00:00:00.000Z"),
  });
  const expiredTrial = buildInternalTrialSubscription({
    id: "trial-expired",
    orgId: billingBase.orgId,
    billingEnvironment: "test",
    now,
    trialEndsAt: new Date("2026-09-01T00:00:00.000Z"),
  });
  assert(
    "Builder and Business already allow projects.create",
    planAllowsCapability("builder", "projects.create") && planAllowsCapability("business", "projects.create")
  );
  assert("active trial allows projects.create", trialAllowsCapability("projects.create") && evaluateOrgEntitlement({
    state: billingState(activeTrial),
    capability: "projects.create",
    mode: "strict",
    now,
  }).ok);
  assert(
    "expired trial denies projects.create",
    evaluateOrgEntitlement({
      state: billingState(expiredTrial),
      capability: "projects.create",
      mode: "strict",
      now,
    }).ok === false
  );
  assert(
    "RFQ writes use projects.edit and projects.create",
    actions.includes('permission: "projects.edit"') && actions.includes('entitlement: "projects.create"')
  );
  assert("Viewer cannot edit projects", !roleAllowsPermission("viewer", "projects.edit"));
  assert(
    "owner admin and estimator can edit projects",
    (["owner", "admin", "estimator"] as const).every((role) => permissionsForRole(role).includes("projects.edit"))
  );
  assert("no new RFQ capability key", !read("lib/billing/capabilities.ts").includes("rfq"));

  section("ISOLATION");
  assert("request freezes sent content", sql.includes("RFQ_FROZEN") && sql.includes("status = 'sent'"));
  assert("delivery is separate from response", sql.includes("rfq_deliveries") && sql.includes("response_state"));
  assert("awaiting is labelled No response", rfqResponseLabel("awaiting") === "No response");
  assert("declined is explicit", rfqResponseLabel("declined") === "Declined to quote");
  assert("public lookup does not return client identity", !sql.includes("'clientName'") && sql.includes("'builderName'"));
  assert("withheld list names pricing and client", RFQ_WITHHELD.includes("Pricing") && RFQ_WITHHELD.includes("Client name and email"));
  assert("files are explicit", composer.includes("Nothing is shared until you select it"));
  const mail = buildRfqDeliveryEmail({
    builderName: "Ada Builders",
    contactName: "Bea",
    scopeLabel: "Bathroom",
    responseDueOn: null,
    publicUrl: "https://example.test/r/rfq_example",
  });
  assert("email carries the link and not a price", mail.text.includes("https://example.test/r/rfq_example") && !mail.text.includes("$") && !email.includes("client_name") && mail.html.includes("Sent securely via Quotr") && mail.text.includes("Submitting a price does not mean the work has been accepted."));
  assert("no award control", !detail.includes("Award") && !detail.includes("notify the subcontractor of acceptance"));
  assert("using a price does not award work", read("components/rfqs/RfqPricingApply.tsx").includes("does not award the work or notify the subcontractor"));
  assert("rate resolver is untouched", rates.includes("export function resolveRate") && !actions.includes("resolveRate"));
  assert("inbound mail is not parsed into a price", actions.includes("Inbound email is not captured"));
  assert("tokens are hashed", sql.includes("token_hash") && !sql.includes("raw_token"));
  assert("public writes are rate limited", sql.includes("rfq_public_rate_ok"));
  assert("response versions stay", sql.includes("RFQ_RESPONSE_FROZEN") && sql.includes("version_number"));
  assert("webhook does not mark a response from email", webhook.includes("apply_rfq_delivery_event_v1") && !webhook.includes("response_state"));
  assert("mobile nav stays five items", mobile.includes('data-mobile-nav="five"') && !mobile.includes("/requests"));
  assert("project sections stay four columns", header.includes('data-project-section-columns="four"') && header.includes("Requests"));
  assert("public page has no sign-in", !pub.includes("requireAuth"));
  const questions = read("supabase/migrations/097_rfq_questions.sql");
  const facts = read("lib/rfqs/draft-facts.ts");
  assert("placeholder scope is rejected", scopeIsMeaningful("as") === false && scopeIsMeaningful("   ") === false);
  assert("a real scope is accepted", scopeIsMeaningful("Supply and install the bathroom wall lining."));
  assert("draft comes from job details", composer.includes("Draft from job details") && composer.includes("data-rfq-review"));
  assert("job draft does not copy client or cost columns into the scope", facts.includes("withholdReason") && facts.includes("clientNames") && !facts.includes("unit_cost") && !facts.includes("projects.notes"));
  const privateRecords = {
    clientNames: ["Jane Smith"],
    emails: ["jane@secret.test"],
    internalNotes: ["Do not tell the client the margin is 40"],
  };
  const adversarial = "Supply lining for Jane Smith at jane@secret.test. Do not tell the client the margin is 40. Supplier price $1800.";
  const held = withholdReason(adversarial, privateRecords);
  const proposed = composeJobDraft(held ? [] : [{ id: "bad", field: "scope", source: "Work area details", text: adversarial, uncertain: false }]);
  assert("adversarial free text is held out of the proposed draft", Boolean(held) && !proposed.requestedScope.includes("Jane Smith") && !proposed.requestedScope.includes("jane@secret.test") && !proposed.requestedScope.includes("$1800"));
  assert("an ordinary supplier sentence stays available", withholdReason("Supply and install the wall lining.", privateRecords) === null);
  assert("draft facts stay inside the organisation", facts.includes('.eq("org_id", orgId)') && !facts.includes("text: fact.text"));
  const draft = composeJobDraft([
    { id: "a", field: "scope", source: "Project description", text: "Bathroom lining", uncertain: false },
    { id: "b", field: "measurements", source: "Measured quantity", text: "12 m2", uncertain: true },
  ]);
  assert("uncertain quantity is marked", draft.measurementNotes.includes("(check this quantity)") && draft.requestedScope === "Bathroom lining");
  const question = "Ada at ada@tile.test can call 0215550199. Our price is $400.";
  const leak = sharedAnswerLeak(`Ask Northside and ada@tile.test about $400`, {
    names: ["Northside"],
    emails: ["ada@tile.test"],
    phones: ["0215550199"],
    question,
  });
  const clean = sharedAnswerLeak("White silicone is acceptable.", {
    names: ["Northside"],
    emails: ["ada@tile.test"],
    phones: ["0215550199"],
    question,
  });
  assert("a shared answer is blocked when it repeats the question's private details", Boolean(leak) && clean === null);
  assert("email button names the action", mail.html.includes("View request and respond"));
  assert("logo-absent mail has no image", !mail.html.includes("<img"));
  const withLogo = buildRfqDeliveryEmail({
    builderName: "Ada Builders",
    contactName: "Bea",
    scopeLabel: "Cladding",
    responseDueOn: null,
    publicUrl: "https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app/r/rfq_example",
    logoUrl: "https://cdn.example.test/ada-logo.png",
  });
  assert("a saved image logo renders and a webpage logo does not", withLogo.html.includes("ada-logo.png") && rfqEmailLogoUrl("https://example.test/not-a-file") === null);
  assert("mail does not point at the hardening alias", !withLogo.html.includes("hardening-stage-2a-security") && withLogo.html.includes("quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app"));
  const mixed = [
    "Doors: Supply and hang 4 prehung internal doors, including hardware.",
    "Flooring: Lay 18 m² vinyl plank to the living room. Exclude the kitchen.",
    "Walls: Line and stop the new internal walls with 10 mm plasterboard.",
    "Ceilings: Install plasterboard ceilings to the living room, 22 m².",
    "Cladding: Supply and fix 25 m² vertical cedar cladding to the north elevation.",
  ].join("\n");
  const vague = selectWorkAreaScope({
    areaType: "custom",
    areaName: "Miscellaneous",
    areaConfirmed: true,
    brief: mixed,
    summary: "",
    description: "",
    items: [{ id: "m", title: "Materials", description: "" }, { id: "e", title: "EXPLICIT: whole project", description: mixed }],
    facts: [],
    notes: [],
  });
  assert("a vague area does not copy the mixed brief", vague.fallback === NO_RELIABLE_SCOPE && vague.facts.every((fact) => !fact.text.includes("vinyl")) && vague.suggestions.length === 0);
  for (const area of [
    { type: "doors", name: "Doors", own: "internal doors", other: "vinyl plank" },
    { type: "flooring", name: "Flooring", own: "vinyl plank", other: "cedar cladding" },
    { type: "internal_walls", name: "Walls", own: "internal walls", other: "vinyl plank" },
    { type: "ceilings", name: "Ceilings", own: "plasterboard ceilings", other: "cedar cladding" },
    { type: "cladding", name: "Cladding", own: "cedar cladding", other: "internal doors" },
  ]) {
    const selected = selectWorkAreaScope({
      areaType: area.type,
      areaName: area.name,
      areaConfirmed: true,
      brief: mixed,
      summary: "",
      description: "",
      items: [],
      facts: [],
      notes: [],
    });
    const scope = selected.facts.filter((fact) => fact.field === "scope").map((fact) => fact.text).join("\n");
    const measures = selected.facts.filter((fact) => fact.field === "measurements").map((fact) => fact.text).join("\n");
    assert(`${area.name} draft stays on its own scope`, scope.includes(area.own) && !scope.includes(area.other) && !scope.includes(mixed));
    if (area.type === "cladding") {
      assert("cladding quantity is separate from the other trades", measures.includes("25 m²") && !measures.includes("18 m²"));
      const ownedItem = selectWorkAreaScope({
        areaType: "cladding",
        areaName: "Cladding",
        areaConfirmed: true,
        brief: mixed,
        summary: "",
        description: "",
        items: [
          { id: "cedar", title: "Vertical cedar boards", description: "North elevation boards only" },
          { id: "materials", title: "Materials", description: "" },
          { id: "other", title: "Vinyl plank to the kitchen", description: "" },
        ],
        facts: [],
        notes: [],
      });
      const boards = ownedItem.suggestions.find((item) => item.title === "Vertical cedar boards");
      const area = ownedItem.suggestions.find((item) => item.title === "Cladding area");
      assert(
        "a recorded cladding item is suggested without copying other trades",
        Boolean(boards)
          && ownedItem.suggestions.every((item) => item.title !== "Materials" && !item.title.toLowerCase().includes("vinyl"))
          && !ownedItem.facts.some((fact) => fact.text.toLowerCase().includes("vinyl"))
      );
      assert(
        "a board row does not inherit the cladding area as an item count",
        boards?.quantity === "" && boards.unit === "item" && area?.quantity === "25" && area.unit === "m2"
          && ownedItem.suggestions.every((item) => !(item.unit === "item" && item.quantity === "25"))
      );
    }
    if (area.type === "ceilings") assert("ceilings quantity is separate from cladding", measures.includes("22 m²") && !measures.includes("25 m²"));
    if (area.type === "flooring") {
      const flooringArea = selected.suggestions.find((item) => item.title === "Flooring area");
      assert("flooring area stays 18 m² and is not the cladding count", flooringArea?.quantity === "18" && flooringArea.unit === "m2");
    }
  }
  const units = selectWorkAreaScope({
    areaType: "cladding",
    areaName: "Cladding",
    areaConfirmed: true,
    brief: "Cladding: Supply and fix 25 m² vertical cedar cladding.",
    summary: "",
    description: "",
    items: [
      { id: "area-line", title: "Fix 25 m² of cladding", description: "" },
      { id: "length", title: "Install 12 m of cladding trim", description: "" },
      { id: "each", title: "Supply 6 each cladding corners", description: "" },
      { id: "lump", title: "Price the cladding as a lump sum", description: "" },
      { id: "boards", title: "Vertical cedar boards", description: "North elevation boards only" },
      { id: "mm", title: "10 mm cladding packers", description: "" },
    ],
    facts: [],
    notes: [],
  });
  const byTitle = (title: string) => units.suggestions.find((item) => item.title === title);
  assert("an m² line keeps m²", byTitle("Fix 25 m² of cladding")?.quantity === "25" && byTitle("Fix 25 m² of cladding")?.unit === "m2");
  assert("a linear metre stays metres", byTitle("Install 12 m of cladding trim")?.quantity === "12" && byTitle("Install 12 m of cladding trim")?.unit === "m");
  assert("an each line stays a count", byTitle("Supply 6 each cladding corners")?.quantity === "6" && byTitle("Supply 6 each cladding corners")?.unit === "item");
  assert("a lump sum has no borrowed quantity", byTitle("Price the cladding as a lump sum")?.unit === "lump_sum" && byTitle("Price the cladding as a lump sum")?.quantity === "");
  assert("millimetres are not read as metres", parseScheduleMeasure("10 mm plasterboard") === null && byTitle("10 mm cladding packers")?.quantity === "");
  assert("25 m² cannot be sent as 25 item", Boolean(mismatchedScheduleQuantity("25", "item", "25 m²")) && mismatchedScheduleQuantity("25", "m2", "25 m²") === null);
  assert("public request names the work", pub.includes("The work requested") && pub.includes("Your price and qualifications"));
  assert("scope change is not an ordinary answer", questions.includes("SCOPE_CHANGE") && actions.includes("SCOPE_CHANGE"));
  assert("questions notify editors only", questions.includes("rfq_question") && questions.includes("'owner', 'admin', 'estimator'") && !questions.includes("'viewer'"));
  const priceNotice = read("supabase/migrations/107_rfq_price_notification.sql");
  assert(
    "a priced response notifies editors only",
    priceNotice.includes("'rfq_price'")
      && priceNotice.includes("submitted a revised price")
      && priceNotice.includes("membership.status = 'active'")
      && priceNotice.includes("'owner', 'admin', 'estimator'")
      && !priceNotice.includes("client_name")
      && !priceNotice.includes("access_token")
      && !priceNotice.includes("storage_object")
  );
  assert("file download stays on the request page", pub.includes('target="_blank"') && pub.includes("download=1"));
  assert("token format is unguessable length", isRfqAccessTokenFormat(generateRfqAccessToken()) && hashRfqAccessToken("rfq_x").length === 64);
}

async function liveMain() {
  section("LIVE PREVIEW");
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = local.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !service) {
    assert("Preview env present", false);
    return;
  }
  const ref = hostnameRef(url);
  assert("live target is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF || ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = randomUUID().slice(0, 8);
  const password = `rfq-${randomUUID()}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectId = randomUUID();
  const userIds: string[] = [];

  async function userFor(role: "owner" | "viewer", orgId: string) {
    const email = `rfq-${role}-${orgId.slice(0, 8)}-${suffix}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    userIds.push(created.data.user.id);
    const profile = await admin.from("profiles").upsert({
      id: created.data.user.id, org_id: orgId, role, full_name: `RFQ ${role}`,
    });
    if (profile.error) throw new Error(profile.error.message);
    const membership = await admin.from("organisation_memberships").insert({
      org_id: orgId, user_id: created.data.user.id, role, status: "active", joined_at: new Date().toISOString(),
    });
    if (membership.error) throw new Error(membership.error.message);
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error(signed.error.message);
    return client;
  }

  try {
    for (const org of [
      { id: orgA, name: `RFQ A ${suffix}` },
      { id: orgB, name: `RFQ B ${suffix}` },
    ]) {
      const inserted = await admin.from("organisations").insert(org);
      if (inserted.error) throw new Error(inserted.error.message);
    }
    const owner = await userFor("owner", orgA);
    const viewer = await userFor("viewer", orgA);
    const foreign = await userFor("owner", orgB);
    async function membershipOnly(role: "estimator" | "admin", status: "pending_billing" | "removed") {
      const email = `rfq-${status}-${role}-${suffix}@example.invalid`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "member");
      userIds.push(created.data.user.id);
      const profile = await admin.from("profiles").upsert({
        id: created.data.user.id, org_id: orgA, role, full_name: `RFQ ${status}`,
      });
      if (profile.error) throw new Error(profile.error.message);
      const membership = await admin.from("organisation_memberships").insert({
        org_id: orgA, user_id: created.data.user.id, role, status,
      });
      if (membership.error) throw new Error(membership.error.message);
      return created.data.user.id;
    }
    const pendingId = await membershipOnly("estimator", "pending_billing");
    const removedId = await membershipOnly("admin", "removed");
    const project = await admin.from("projects").insert({
      id: projectId,
      org_id: orgA,
      created_by: userIds[0],
      title: `Client secret ${suffix}`,
      client_name: `Hidden Client ${suffix}`,
      client_email: `hidden-${suffix}@example.invalid`,
      site_address: `12 Site Road ${suffix}`,
      notes: `Internal note ${suffix}`,
      stage: "estimate_ready",
      business_status: "estimate_ready",
    });
    if (project.error) throw new Error(project.error.message);
    const areas = await admin.from("work_areas").insert([
      { org_id: orgA, project_id: projectId, type: "bathroom", name: "Bathroom", status: "confirmed", sort_order: 1 },
      { org_id: orgA, project_id: projectId, type: "deck", name: "Deck", status: "confirmed", sort_order: 2 },
    ]).select("id, type");
    if (areas.error || !areas.data) throw new Error(areas.error?.message ?? "areas");
    const bathroom = areas.data.find((row) => row.type === "bathroom");
    if (!bathroom) throw new Error("bathroom");

    const quotesBefore = await admin.from("quotes").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    const first = await owner.rpc("save_subcontractor_v1", {
      p_payload: {
        trading_name: `Tile Co ${suffix}`,
        country_code: "NZ",
        work_area_types: ["bathroom"],
        contacts: [{ name: "Ada", email: `ada-${suffix}@example.invalid`, is_primary: true }],
      },
    });
    const second = await owner.rpc("save_subcontractor_v1", {
      p_payload: {
        trading_name: `Deck Co ${suffix}`,
        country_code: "NZ",
        work_area_types: ["deck"],
        contacts: [{ name: "Bea", email: `bea-${suffix}@example.invalid`, is_primary: true }],
      },
    });
    const archived = await owner.rpc("save_subcontractor_v1", {
      p_payload: {
        trading_name: `Old Co ${suffix}`,
        work_area_types: ["bathroom"],
        contacts: [{ name: "Cam", email: `cam-${suffix}@example.invalid`, is_primary: true }],
      },
    });
    if (first.error || second.error || archived.error || typeof first.data !== "string") {
      throw new Error(first.error?.message ?? second.error?.message ?? archived.error?.message ?? "subcontractor seed");
    }
    const archivedId = archived.data as string;
    const secondId = second.data as string;
    const firstId = first.data;
    const archivedRow = await owner.from("subcontractors").update({ archived_at: new Date().toISOString() }).eq("id", archivedId);
    if (archivedRow.error) throw new Error(archivedRow.error.message);
    const contacts = await admin.from("subcontractor_contacts").select("id, subcontractor_id").in("subcontractor_id", [firstId, secondId, archivedId]);
    const contactFor = (businessId: string) => contacts.data?.find((row) => row.subcontractor_id === businessId)?.id;
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    async function readyFile(title: string) {
      const prepared = await owner.rpc("prepare_project_document_upload_v1", {
        p_project: projectId, p_document: null, p_category: "photos", p_title: title, p_visibility: "internal",
        p_original_filename: "site.jpg", p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_version_note: null,
      });
      if (prepared.data?.ok !== true) throw new Error(prepared.data?.error ?? "prepare");
      const version = await admin.from("project_document_versions").select("storage_object_path").eq("id", prepared.data.versionId).single();
      if (version.error || !version.data) throw new Error(version.error?.message ?? "path");
      const uploaded = await admin.storage.from("project-documents").upload(version.data.storage_object_path, jpeg, { contentType: "image/jpeg", upsert: true });
      if (uploaded.error) throw new Error(uploaded.error.message);
      const completed = await owner.rpc("complete_project_document_version_v1", { p_version: prepared.data.versionId, p_byte_size: jpeg.byteLength });
      if (completed.data?.ok !== true) throw new Error(completed.data?.error ?? "complete");
      return { versionId: prepared.data.versionId as string, documentId: prepared.data.documentId as string, title };
    }
    const selectedFile = await readyFile(`Selected ${suffix}`);
    const hiddenFile = await readyFile(`Hidden ${suffix}`);

    const archivedSave = await owner.rpc("save_rfq_draft_v1", {
      p_payload: {
        project_id: projectId, scope_kind: "work_area", work_area_id: bathroom.id, requested_scope: "Tile the room",
        recipients: [{ subcontractor_id: archivedId, contact_id: contactFor(archivedId), selection_source: "suggested" }],
        document_version_ids: [],
      },
    });
    assert("archived subcontractor is rejected", archivedSave.data?.error === "ARCHIVED_SUBCONTRACTOR");

    const draft = await owner.rpc("save_rfq_draft_v1", {
      p_payload: {
        project_id: projectId,
        scope_kind: "work_area",
        work_area_id: bathroom.id,
        requested_scope: `Tile the bathroom ${suffix}`,
        measurement_notes: "12 m2",
        include_site_address: false,
        site_details: "Access from the side gate",
        questions: "Can you start in June?",
        message: "Please price the tiling only",
        recipients: [
          { subcontractor_id: firstId, contact_id: contactFor(firstId), selection_source: "suggested" },
          { subcontractor_id: secondId, contact_id: contactFor(secondId), selection_source: "manual" },
        ],
        document_version_ids: [selectedFile.versionId],
      },
    });
    assert("draft saves", draft.data?.ok === true);
    const stored = await admin.from("rfqs").select("site_address, site_details, requested_scope, status").eq("id", draft.data.id).single();
    assert(
      "site address stays off and internal notes are not copied",
      stored.data?.site_address === "" && stored.data?.site_details === "Access from the side gate" && !String(stored.data?.requested_scope).includes("Hidden Client")
    );
    const viewerSend = await viewer.rpc("send_rfq_v1", { p_rfq: draft.data.id, p_tokens: [] });
    assert("viewer cannot send", viewerSend.data?.error === "FORBIDDEN" || Boolean(viewerSend.error));
    const rawA = generateRfqAccessToken();
    const rawB = generateRfqAccessToken();
    const recipients = await admin.from("rfq_recipients").select("id, subcontractor_id, suggestion_reason, selection_source").eq("rfq_id", draft.data.id);
    const recipientA = recipients.data?.find((row) => row.subcontractor_id === firstId);
    const recipientB = recipients.data?.find((row) => row.subcontractor_id === secondId);
    if (!recipientA || !recipientB) throw new Error("recipients");
    assert("suggestion reason comes from the work area tag", String(recipientA.suggestion_reason).includes("Bathroom"));
    assert("manual choice is not labelled as a suggestion", recipientB.selection_source === "manual" && recipientB.suggestion_reason == null);
    const sent = await owner.rpc("send_rfq_v1", {
      p_rfq: draft.data.id,
      p_tokens: [
        { recipient_id: recipientA.id, token_hash: hashRfqAccessToken(rawA) },
        { recipient_id: recipientB.id, token_hash: hashRfqAccessToken(rawB) },
      ],
    });
    assert("send freezes the request", sent.data?.ok === true);
    const edited = await owner.rpc("save_rfq_draft_v1", {
      p_payload: { id: draft.data.id, project_id: projectId, scope_kind: "written", written_scope_label: "Changed", requested_scope: "Changed" },
    });
    assert("sent request cannot be edited", edited.data?.error === "FROZEN");
    const failedDelivery = await owner.rpc("begin_rfq_delivery_v1", { p_recipient: recipientA.id, p_idempotency_key: `rfq-live-fail-${suffix}` });
    const failed = await owner.rpc("fail_rfq_delivery_v1", { p_delivery: failedDelivery.data?.deliveryId, p_failure_code: "provider_rejected" });
    const afterFail = await admin.from("rfq_recipients").select("response_state").eq("id", recipientA.id).single();
    assert("failed email stays awaiting and is not a response", failed.data?.status === "failed" && afterFail.data?.response_state === "awaiting");

    const seenA = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(rawA) });
    const seenB = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(rawB) });
    const payloadA = JSON.stringify(seenA.data);
    assert("recipient sees the selected file only", seenA.data?.ok === true && payloadA.includes("Selected") && !payloadA.includes("Hidden") && !payloadA.includes("Hidden Client") && !payloadA.includes(`Deck Co ${suffix}`));
    assert("other recipient does not see the first response later", seenB.data?.ok === true && !JSON.stringify(seenB.data).includes(`Tile Co ${suffix}`));
    const foreignRead = await foreign.from("rfqs").select("id").eq("id", draft.data.id);
    assert("another organisation cannot read the request", !foreignRead.data?.length);
    const question = await anon.rpc("public_rfq_clarify_v1", { p_token_hash: hashRfqAccessToken(rawA), p_body: "Does this include silicone?" });
    const asked = await admin.from("rfq_clarifications").select("id").eq("recipient_id", recipientA.id).eq("from_recipient", true);
    const noteId = asked.data?.[0]?.id;
    const ownerNotes = noteId
      ? await admin.from("notifications").select("id").eq("notification_type", "rfq_question").eq("resource_id", noteId).eq("recipient_user_id", userIds[0])
      : { data: [] };
    const viewerNotes = noteId
      ? await admin.from("notifications").select("id").eq("notification_type", "rfq_question").eq("resource_id", noteId).eq("recipient_user_id", userIds[1])
      : { data: [] };
    const duplicateNote = noteId
      ? await admin.from("notifications").insert({
          org_id: orgA,
          recipient_user_id: userIds[0],
          notification_type: "rfq_question",
          title: "Question on a request",
          body: "duplicate",
          resource_type: "rfq",
          resource_id: noteId,
          project_id: projectId,
        })
      : { error: null };
    assert("one question notifies the owner once", question.data?.ok === true && ownerNotes.data?.length === 1);
    assert("a viewer is not notified to answer", (viewerNotes.data ?? []).length === 0);
    assert("the same question is not notified twice", Boolean(duplicateNote.error));
    const blockedAnswer = await owner.rpc("answer_rfq_clarification_v1", {
      p_payload: { clarification_id: noteId, body: "Please also tile the laundry", audience: "private", scope_unchanged: "false" },
    });
    const scopeAfterBlock = await admin.from("rfqs").select("requested_scope").eq("id", draft.data.id).single();
    assert("a scope change is refused and the sent request stays", blockedAnswer.data?.error === "SCOPE_CHANGE" && String(scopeAfterBlock.data?.requested_scope).includes(`Tile the bathroom ${suffix}`));
    const viewerAnswer = await viewer.rpc("answer_rfq_clarification_v1", {
      p_payload: { clarification_id: noteId, body: "No", audience: "private", scope_unchanged: "true" },
    });
    assert("a viewer cannot answer", viewerAnswer.data?.error === "FORBIDDEN");
    const viewerThread = await viewer.from("rfq_clarifications").select("id").eq("id", noteId);
    const foreignThread = await foreign.from("rfq_clarifications").select("id").eq("id", noteId);
    assert("a viewer cannot read the private thread", (viewerThread.data ?? []).length === 0);
    assert("another organisation cannot read the private thread", (foreignThread.data ?? []).length === 0);
    const leakyAnswer = await owner.rpc("answer_rfq_clarification_v1", {
      p_payload: { clarification_id: noteId, body: `Ask Tile Co ${suffix} about the silicone`, audience: "all", scope_unchanged: "true" },
    });
    const leakyStored = await admin.from("rfq_clarifications").select("id").eq("parent_id", noteId).ilike("body", `%Tile Co ${suffix}%`);
    assert("a shared answer cannot name the asking business", leakyAnswer.data?.error === "BROADCAST_PRIVATE" && (leakyStored.data ?? []).length === 0);
    const privateAnswer = await owner.rpc("answer_rfq_clarification_v1", {
      p_payload: { clarification_id: noteId, body: "Silicone is included for this bathroom", audience: "private", scope_unchanged: "true" },
    });
    const privateSeenA = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(rawA) });
    const privateSeenB = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(rawB) });
    assert(
      "a private answer reaches only the asking recipient",
      privateAnswer.data?.ok === true && JSON.stringify(privateSeenA.data).includes("Silicone is included") && !JSON.stringify(privateSeenB.data).includes("Silicone is included")
    );
    const sharedAnswer = await owner.rpc("answer_rfq_clarification_v1", {
      p_payload: { clarification_id: noteId, body: "White silicone is acceptable", audience: "all", scope_unchanged: "true" },
    });
    const sharedSeenB = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(rawB) });
    const sharedPayload = JSON.stringify(sharedSeenB.data);
    const storedShared = await admin
      .from("rfq_clarifications")
      .select("body, author_user_id, request_sent_at, shared_recipient_ids")
      .eq("parent_id", noteId)
      .eq("audience", "all");
    assert(
      "a shared answer reaches the other recipient without the asking business",
      sharedAnswer.data?.ok === true && sharedPayload.includes("White silicone is acceptable") && !sharedPayload.includes(`Tile Co ${suffix}`)
        && (storedShared.data ?? []).every((row) => row.body === "White silicone is acceptable" && row.author_user_id === userIds[0] && row.request_sent_at && Array.isArray(row.shared_recipient_ids) && row.shared_recipient_ids.length === 2)
    );
    const sensitiveQuestion = await anon.rpc("public_rfq_clarify_v1", {
      p_token_hash: hashRfqAccessToken(rawA),
      p_body: `Ada at ada-${suffix}@example.invalid can call 0215550199. Our price is $400.`,
    });
    const sensitiveRow = await admin.from("rfq_clarifications").select("id").eq("recipient_id", recipientA.id).eq("from_recipient", true).ilike("body", "%0215550199%").maybeSingle();
    const copied = await owner.rpc("answer_rfq_clarification_v1", {
      p_payload: {
        clarification_id: sensitiveRow.data?.id,
        body: `Ada at ada-${suffix}@example.invalid can call 0215550199. Our price is $400.`,
        audience: "all",
        scope_unchanged: "true",
      },
    });
    const cleanShared = await owner.rpc("answer_rfq_clarification_v1", {
      p_payload: { clarification_id: sensitiveRow.data?.id, body: "Use a standard white finish.", audience: "all", scope_unchanged: "true" },
    });
    const afterClean = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(rawB) });
    const cleanPayload = JSON.stringify(afterClean.data);
    const originalQuestion = await admin.from("rfq_clarifications").select("body").eq("id", sensitiveRow.data?.id).maybeSingle();
    assert(
      "a copied private question is not broadcast, and the original question stays",
      sensitiveQuestion.data?.ok === true && copied.data?.error === "BROADCAST_PRIVATE" && cleanShared.data?.ok === true
        && cleanPayload.includes("Use a standard white finish.")
        && !cleanPayload.includes(`ada-${suffix}@example.invalid`)
        && !cleanPayload.includes("0215550199")
        && !cleanPayload.includes("$400")
        && String(originalQuestion.data?.body).includes("0215550199")
    );
    const draftPrice = await anon.rpc("public_rfq_save_response_v1", {
      p_token_hash: hashRfqAccessToken(rawA),
      p_payload: { price_ex_gst: "1800", gst_treatment: "extra", pricing_structure: "lump_sum", included_scope: "Wall tiles" },
      p_confirm: false,
      p_revise: false,
    });
    const draftNotes = await admin.from("notifications").select("id").eq("org_id", orgA).eq("notification_type", "rfq_price");
    const offer = await anon.rpc("public_rfq_save_response_v1", {
      p_token_hash: hashRfqAccessToken(rawA),
      p_payload: { price_ex_gst: "1800", gst_treatment: "extra", pricing_structure: "lump_sum", included_scope: "Wall tiles", excluded_scope: "Floor tiles", valid_until: "2027-01-01" },
      p_confirm: true,
      p_revise: false,
    });
    const duplicate = await anon.rpc("public_rfq_save_response_v1", {
      p_token_hash: hashRfqAccessToken(rawA),
      p_payload: { price_ex_gst: "1", gst_treatment: "none", pricing_structure: "lump_sum" },
      p_confirm: true,
      p_revise: false,
    });
    const revised = await anon.rpc("public_rfq_save_response_v1", {
      p_token_hash: hashRfqAccessToken(rawA),
      p_payload: { price_ex_gst: "2100", gst_treatment: "extra", pricing_structure: "itemised", included_scope: "Wall and trim", excluded_scope: "Floor tiles" },
      p_confirm: true,
      p_revise: true,
    });
    const decline = await anon.rpc("public_rfq_decline_v1", { p_token_hash: hashRfqAccessToken(rawB), p_message: "Fully booked" });
    const states = await admin.from("rfq_recipients").select("id, response_state").in("id", [recipientA.id, recipientB.id]);
    const versions = await admin.from("rfq_responses").select("version_number, price_ex_gst, status").eq("recipient_id", recipientA.id).order("version_number");
    assert("question, two offer versions, and a decline are distinct", question.data?.ok === true && offer.data?.ok === true && duplicate.data?.error === "DUPLICATE" && revised.data?.ok === true && decline.data?.ok === true);
    assert(
      "original price remains beside the revision",
      versions.data?.length === 2 && Number(versions.data?.[0]?.price_ex_gst) === 1800 && Number(versions.data?.[1]?.price_ex_gst) === 2100
    );
    assert(
      "states stay independent",
      states.data?.find((row) => row.id === recipientA.id)?.response_state === "responded" &&
        states.data?.find((row) => row.id === recipientB.id)?.response_state === "declined"
    );
    const notices = await admin.from("notifications").select("id, recipient_user_id, body, resource_id, payload").eq("org_id", orgA).eq("notification_type", "rfq_price");
    const priceNotes = (notices.data ?? []).filter((row) => row.recipient_user_id === userIds[0]);
    const priceViewerNotes = (notices.data ?? []).filter((row) => row.recipient_user_id === userIds[1]);
    const foreignNotes = await admin.from("notifications").select("id").eq("org_id", orgB).eq("notification_type", "rfq_price");
    const versionsById = await admin.from("rfq_responses").select("id, version_number").eq("recipient_id", recipientA.id);
    const versionOne = versionsById.data?.find((row) => row.version_number === 1);
    const versionTwo = versionsById.data?.find((row) => row.version_number === 2);
    const firstBody = `Tile Co ${suffix} submitted a price for Bathroom on Client secret ${suffix}.`;
    const revisedBody = `Tile Co ${suffix} submitted a revised price for Bathroom on Client secret ${suffix}.`;
    assert("a saved public draft does not notify", draftPrice.data?.ok === true && (draftNotes.data?.length ?? 0) === 0);
    assert(
      "a priced response notifies the owner once per version",
      priceNotes.length === 2
        && priceNotes.some((row) => row.body === firstBody && row.resource_id === versionOne?.id)
        && priceNotes.some((row) => row.body === revisedBody && row.resource_id === versionTwo?.id)
        && priceNotes.every((row) => !String(row.body).includes("1800") && !String(row.body).includes("2100") && !String(row.body).includes(`Hidden Client ${suffix}`) && !String(row.body).includes(`hidden-${suffix}`))
        && priceViewerNotes.length === 0
        && !notices.data?.some((row) => row.recipient_user_id === pendingId || row.recipient_user_id === removedId)
        && (foreignNotes.data?.length ?? 0) === 0
    );
    const action = priceNotes.find((row) => row.resource_id === versionTwo?.id)?.payload as { actionUrl?: string } | null;
    const marked = await owner.rpc("mark_notifications_read_v1", { p_ids: priceNotes.map((row) => row.id) });
    const afterRead = await owner.from("notifications").select("read_at").eq("notification_type", "rfq_price");
    const foreignPriceRead = await foreign.from("notifications").select("id").eq("notification_type", "rfq_price");
    assert(
      "the price notification opens that version and only the owner can read it",
      String(action?.actionUrl).includes(`/requests/`) && String(action?.actionUrl).includes(`response=${versionTwo?.id}`)
        && marked.error == null
        && (afterRead.data?.length ?? 0) === 2
        && afterRead.data?.every((row) => row.read_at != null) === true
        && (foreignPriceRead.data?.length ?? 0) === 0
    );
    const cross = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(rawB) });
    assert("declined recipient cannot see the other price", cross.data?.ok === true && !JSON.stringify(cross.data).includes("2100") && !JSON.stringify(cross.data).includes("1800"));
    const removed = await owner.rpc("authorize_project_document_delete_v1", { p_project: projectId, p_document: selectedFile.documentId });
    const hiddenDelete = await owner.rpc("authorize_project_document_delete_v1", { p_project: projectId, p_document: hiddenFile.documentId });
    assert("selected file is kept and the unselected file can be removed", removed.data?.error === "REFERENCED" && hiddenDelete.data?.ok === true);
    const oldHash = hashRfqAccessToken(rawA);
    const replacement = generateRfqAccessToken();
    const resent = await owner.rpc("resend_rfq_recipient_v1", { p_recipient: recipientA.id, p_token_hash: hashRfqAccessToken(replacement) });
    const stale = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: oldHash });
    const fresh = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(replacement) });
    assert("resend revokes the previous link", resent.data?.ok === true && stale.data?.error === "UNAVAILABLE" && fresh.data?.ok === true);
    await admin.from("rfq_access_tokens").update({ expires_at: "2020-01-01T00:00:00Z" }).eq("token_hash", hashRfqAccessToken(replacement));
    const expired = await anon.rpc("lookup_rfq_by_token_hash_v1", { p_token_hash: hashRfqAccessToken(replacement) });
    assert("expired link is refused", expired.data?.error === "EXPIRED");
    const quotesAfter = await admin.from("quotes").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    assert("quotes were not created", quotesBefore.count === quotesAfter.count);
    const viewerList = await viewer.from("rfqs").select("id").eq("id", draft.data.id);
    assert("viewer can read the request", viewerList.data?.length === 1);
  } finally {
    await admin.from("rfqs").delete().eq("project_id", projectId);
    await admin.from("projects").delete().eq("id", projectId);
    for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    await admin.from("organisations").delete().in("id", [orgA, orgB]);
  }
}

staticMain();
if (process.argv.includes("--live")) {
  liveMain().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
