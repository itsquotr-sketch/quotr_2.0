/**
 * UX-01F.2 — Project Document Centre.
 *
 * Run: npx --yes tsx scripts/verify-ux-01f2-project-documents.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readProjectDocumentCentre } from "../lib/projects/document-centre";
import { PROJECT_DOCUMENT_BUCKET, PROJECT_DOCUMENT_MAX_BYTES } from "../lib/projects/document-files";
import { mergeReadyVersion, summariseProjectDocuments } from "../lib/projects/document-model";
import { putTransfer } from "../lib/projects/document-upload-state";
import { VARIATION_ATTACHMENT_BUCKET } from "../lib/variations/attachment-files";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import { cleanupPreviewFixtureOrgs, registerPreviewFixtureOrg } from "./lib/preview-admin-cleanup";
import { assertSafePreviewPasswordMutation, isPasswordProtectedPreviewAccount } from "./lib/preview-auth-fixture";

const root = join(__dirname, "..");
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

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

function envValue(): Record<string, string> {
  return Object.fromEntries(
    read(".env.local").split("\n").filter((row) => row && !row.startsWith("#") && row.includes("=")).map((row) => {
      const index = row.indexOf("=");
      return [row.slice(0, index), row.slice(index + 1).replace(/^"|"$/g, "")];
    })
  );
}

function keysOf(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, found));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      found.push(key);
      keysOf(child, found);
    }
  }
  return found;
}

function exposesStorage(value: unknown): boolean {
  return keysOf(value).some((key) => /storage|object_path|bucket/i.test(key));
}

type Db = SupabaseClient;
type Rpc = Record<string, unknown> & { ok?: boolean; error?: string };

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0xd9]);

function line(description: string): Record<string, unknown> {
  return {
    itemType: "addition",
    clientDescription: description,
    workAreaId: null,
    snapshotLineId: null,
    stableComponentKey: null,
    quantity: 1,
    unit: "item",
    unitCost: null,
    unitSell: 1500,
    sortOrder: 1,
    clientInclusion: null,
    clientExclusion: null,
    substitutionGroupId: null,
    internalMetadata: null,
  };
}

async function main(): Promise<void> {
  console.log("\nUX-01F.2 project documents");
  const section = read("components/projects/information/ProjectDocumentsSection.tsx");
  const client = read("lib/projects/document-client.ts");
  const route = read("app/api/projects/documents/route.ts");
  const direct = read("lib/projects/document-direct-upload.ts");
  const page = read("app/(protected)/app/projects/[projectId]/information/page.tsx");
  const estimate = read("app/(protected)/app/projects/[projectId]/page.tsx");
  const pricing = read("app/(protected)/app/projects/[projectId]/pricing/[pricingId]/page.tsx");
  const quote = read("app/(protected)/app/projects/[projectId]/quotes/[quoteId]/page.tsx");
  const variationPage = read("app/(protected)/app/projects/[projectId]/variations/[variationId]/page.tsx");
  const sql = read("supabase/migrations/078_project_documents.sql");
  const transfers = putTransfer(putTransfer({}, "a", { progress: 10, error: null }), "b", { progress: 40, error: null });
  check(
    "1 upload state stays independent and the page does not refresh",
    transfers.a?.progress === 10 &&
      transfers.b?.progress === 40 &&
      !section.includes("router.refresh") &&
      !section.includes("useRouter") &&
      section.includes("putTransfer") &&
      section.includes("void uploadOne") &&
      direct.includes("/object/upload/sign/") &&
      !section.includes("use server")
  );
  check(
    "2 client payloads and other workflow pages omit storage paths",
    !section.includes("storage_object_path") &&
      !section.includes("storageObjectPath") &&
      !client.includes("storageObjectPath") &&
      !route.includes("storageObjectPath") &&
      !page.includes("storage_object_path") &&
      page.includes("readProjectDocumentCentre") &&
      !estimate.includes("readProjectDocumentCentre") &&
      !pricing.includes("readProjectDocumentCentre") &&
      !quote.includes("readProjectDocumentCentre") &&
      !variationPage.includes("readProjectDocumentCentre") &&
      sql.includes("shareable: eligible for a later deliberate share") &&
      sql.includes("It does not delete storage objects")
  );
  const merged = mergeReadyVersion(
    [{
      id: "doc",
      title: "Plan",
      category: "plans_and_drawings",
      archived: false,
      createdAt: "2026-09-01T00:00:00.000Z",
      versions: [{
        id: "v1",
        versionNumber: 1,
        displayFilename: "plan.pdf",
        mimeType: "application/pdf",
        byteSize: 12,
        visibility: "internal",
        versionNote: null,
        uploadStatus: "ready",
        createdAt: "2026-09-01T00:00:00.000Z",
        uploaderName: null,
        current: true,
      }],
    }],
    {
      id: "doc",
      title: "Plan",
      category: "plans_and_drawings",
      archived: false,
      createdAt: "2026-09-01T00:00:00.000Z",
      versions: [{
        id: "v2",
        versionNumber: 2,
        displayFilename: "plan-v2.pdf",
        mimeType: "application/pdf",
        byteSize: 20,
        visibility: "shareable",
        versionNote: "Revised",
        uploadStatus: "ready",
        createdAt: "2026-09-02T00:00:00.000Z",
        uploaderName: null,
        current: true,
      }],
    }
  );
  check(
    "3 a new version keeps the earlier version",
    merged.length === 1 &&
      merged[0]?.versions.length === 2 &&
      merged[0]?.versions.find((version) => version.id === "v1")?.displayFilename === "plan.pdf" &&
      merged[0]?.versions.find((version) => version.id === "v2")?.current === true &&
      summariseProjectDocuments(merged).shareable === 1
  );

  const env = envValue();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !service || !anonKey) {
    check("hosted Preview credentials", false, "missing env");
    return;
  }
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    check("hosted database is Preview", false, ref);
    return;
  }

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = randomUUID().slice(0, 8);
  const emailA = `hello+ux01f2.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+ux01f2b.${stamp}@erccontracting.co.nz`;
  const password = `Doc01F2-${stamp}-Aa!`;
  assertSafePreviewPasswordMutation(emailA);
  check("fixture inbox is not protected", !isPasswordProtectedPreviewAccount(emailA));
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectA = randomUUID();
  const projectOther = randomUUID();
  registerPreviewFixtureOrg(orgA);
  registerPreviewFixtureOrg(orgB);
  const userIds: string[] = [];
  const objectPaths: string[] = [];
  const variationPaths: string[] = [];

  async function cleanup(): Promise<void> {
    if (objectPaths.length > 0) await admin.storage.from(PROJECT_DOCUMENT_BUCKET).remove(objectPaths);
    if (variationPaths.length > 0) await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).remove(variationPaths);
    try {
      cleanupPreviewFixtureOrgs([orgA, orgB]);
    } catch (error) {
      console.error("cleanup", error instanceof Error ? error.message : error);
    }
    for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
  }

  try {
    async function userFor(address: string, orgId: string): Promise<Db> {
      const created = await admin.auth.admin.createUser({ email: address, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? address);
      userIds.push(created.data.user.id);
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Document Centre" });
      if (profile.error) throw new Error(profile.error.message);
      const membership = await admin.from("organisation_memberships").insert({
        org_id: orgId, user_id: created.data.user.id, role: "owner", status: "active", joined_at: new Date().toISOString(),
      });
      if (membership.error) throw new Error(membership.error.message);
      const session = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const signedIn = await session.auth.signInWithPassword({ email: address, password });
      if (signedIn.error) throw new Error(signedIn.error.message);
      return session;
    }
    async function call(db: Db, fn: string, args: Record<string, unknown>): Promise<Rpc> {
      const { data, error } = await db.rpc(fn, args);
      if (error) return { ok: false, error: error.message };
      return (data ?? { ok: false }) as Rpc;
    }

    const orgs = await admin.from("organisations").insert([
      { id: orgA, name: `Documents ${stamp}` },
      { id: orgB, name: `Other documents ${stamp}` },
    ]);
    if (orgs.error) throw new Error(orgs.error.message);
    const settings = await admin.from("organisation_settings").insert({
      org_id: orgA, default_margin_percent: 20, default_gst_rate: 15, currency: "NZD",
    });
    if (settings.error) throw new Error(settings.error.message);
    const userA = await userFor(emailA, orgA);
    const userB = await userFor(emailB, orgB);
    const signedOut = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const project = await admin.from("projects").insert([
      { id: projectA, org_id: orgA, created_by: userIds[0], title: `Documents ${stamp}`, client_name: "Ada Client", client_email: "ada@example.test", stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectOther, org_id: orgA, created_by: userIds[0], title: `Other ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
    ]);
    if (project.error) throw new Error(project.error.message);

    const emptyStarted = performance.now();
    const emptyCentre = await readProjectDocumentCentre(userA, projectA, orgA);
    const emptyMs = Math.round(performance.now() - emptyStarted);
    console.log(`TIMING project-information-without-files ${emptyMs}ms`);
    check("4 empty Project Information read stays available", !emptyCentre.documentsUnavailable && emptyCentre.documents.length === 0);

    const signedOutUpload = await signedOut.storage.from(PROJECT_DOCUMENT_BUCKET).upload(`${orgA}/guess.jpg`, jpeg, { contentType: "image/jpeg" });
    const ownUpload = await userA.storage.from(PROJECT_DOCUMENT_BUCKET).upload(`${orgA}/${projectA}/guess.jpg`, jpeg, { contentType: "image/jpeg" });
    const signedOutPrepare = await call(signedOut, "prepare_project_document_upload_v1", {
      p_project: projectA, p_document: null, p_category: "photos", p_title: "North", p_visibility: "internal",
      p_original_filename: "north.jpg", p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_version_note: null,
    });
    const crossPrepare = await call(userB, "prepare_project_document_upload_v1", {
      p_project: projectA, p_document: null, p_category: "photos", p_title: "North", p_visibility: "shareable",
      p_original_filename: "north.jpg", p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_version_note: null,
    });
    check(
      "5 signed-out and direct uploads are rejected",
      Boolean(signedOutUpload.error && ownUpload.error) && signedOutPrepare.ok !== true && crossPrepare.ok !== true && !exposesStorage(crossPrepare)
    );

    const badType = await call(userA, "prepare_project_document_upload_v1", {
      p_project: projectA, p_document: null, p_category: "other", p_title: null, p_visibility: "internal",
      p_original_filename: "notes.txt", p_mime_type: "text/plain", p_byte_size: 5, p_version_note: null,
    });
    const tooBig = await call(userA, "prepare_project_document_upload_v1", {
      p_project: projectA, p_document: null, p_category: "other", p_title: null, p_visibility: "internal",
      p_original_filename: "north.jpg", p_mime_type: "image/jpeg", p_byte_size: PROJECT_DOCUMENT_MAX_BYTES + 1, p_version_note: null,
    });
    check("6 invalid MIME and oversized files are rejected", badType.error === "FILE_TYPE" && tooBig.error === "FILE_TOO_LARGE");

    async function store(input: {
      projectId: string;
      documentId: string | null;
      category: string;
      title: string;
      visibility: string;
      filename: string;
      bytes: Uint8Array;
      mime: string;
      note: string | null;
    }): Promise<Rpc> {
      const prepared = await call(userA, "prepare_project_document_upload_v1", {
        p_project: input.projectId,
        p_document: input.documentId,
        p_category: input.category,
        p_title: input.title,
        p_visibility: input.visibility,
        p_original_filename: input.filename,
        p_mime_type: input.mime,
        p_byte_size: input.bytes.byteLength,
        p_version_note: input.note,
      });
      if (prepared.ok !== true || exposesStorage(prepared) || typeof prepared.versionId !== "string") return prepared;
      const stored = await admin.from("project_document_versions").select("storage_object_path, storage_bucket, visibility").eq("id", prepared.versionId).maybeSingle();
      const path = stored.data?.storage_object_path;
      if (typeof path !== "string" || stored.data?.storage_bucket !== PROJECT_DOCUMENT_BUCKET) return { ok: false, error: "PATH" };
      objectPaths.push(path);
      const uploaded = await admin.storage.from(PROJECT_DOCUMENT_BUCKET).upload(path, input.bytes, { contentType: input.mime, upsert: false });
      if (uploaded.error) return { ok: false, error: uploaded.error.message };
      const completed = await call(userA, "complete_project_document_version_v1", { p_version: prepared.versionId, p_byte_size: input.bytes.byteLength });
      return { ...prepared, ...completed };
    }

    const internalFile = await store({
      projectId: projectA, documentId: null, category: "plans_and_drawings", title: "Site plan", visibility: "internal",
      filename: "../site plan.jpg", bytes: jpeg, mime: "image/jpeg", note: null,
    });
    const shareableFile = await store({
      projectId: projectA, documentId: null, category: "photos", title: "North elevation", visibility: "shareable",
      filename: "north.jpg", bytes: jpeg, mime: "image/jpeg", note: "First look",
    });
    const internalRow = await admin.from("project_document_versions").select("visibility, upload_status, object_confirmed").eq("id", internalFile.versionId ?? "").maybeSingle();
    const shareableRow = await admin.from("project_document_versions").select("visibility, upload_status, storage_object_path").eq("id", shareableFile.versionId ?? "").maybeSingle();
    const bucket = await admin.storage.getBucket(PROJECT_DOCUMENT_BUCKET);
    const publicUrl = signedOut.storage.from(PROJECT_DOCUMENT_BUCKET).getPublicUrl(String(shareableRow.data?.storage_object_path ?? "missing")).data.publicUrl;
    const publicFetch = await fetch(publicUrl);
    const anonDownload = await signedOut.storage.from(PROJECT_DOCUMENT_BUCKET).download(String(shareableRow.data?.storage_object_path ?? "missing"));
    check(
      "7 internal and shareable uploads finalise without becoming public",
      internalFile.ok === true &&
        shareableFile.ok === true &&
        !exposesStorage(internalFile) &&
        internalRow.data?.visibility === "internal" &&
        internalRow.data?.upload_status === "ready" &&
        internalRow.data?.object_confirmed === true &&
        shareableRow.data?.visibility === "shareable" &&
        bucket.data?.public === false &&
        publicFetch.status !== 200 &&
        Boolean(anonDownload.error)
    );

    const loadedStarted = performance.now();
    const loaded = await readProjectDocumentCentre(userA, projectA, orgA);
    const loadedMs = Math.round(performance.now() - loadedStarted);
    console.log(`TIMING project-information-with-files ${loadedMs}ms`);
    const hiddenColumn = await userA.from("project_document_versions").select("storage_object_path").eq("project_id", projectA);
    const loadedText = JSON.stringify(loaded);
    check(
      "8 the document read hides storage paths",
      !loaded.documentsUnavailable &&
        loaded.documents.length === 2 &&
        !loadedText.includes("storage") &&
        Boolean(hiddenColumn.error)
    );

    const nextVersion = await store({
      projectId: projectA, documentId: String(internalFile.documentId), category: "plans_and_drawings", title: "Site plan revised",
      visibility: "internal", filename: "site-plan-v2.jpg", bytes: jpeg, mime: "image/jpeg", note: "Markup",
    });
    const both = await admin.from("project_document_versions").select("id, version_number, upload_status, display_filename").eq("document_id", internalFile.documentId ?? "");
    const numbers = new Set((both.data ?? []).map((row) => row.version_number));
    check(
      "9 a new version keeps the previous version",
      nextVersion.ok === true &&
        (both.data ?? []).length === 2 &&
        numbers.has(1) &&
        numbers.has(2) &&
        (both.data ?? []).every((row) => row.upload_status === "ready")
    );

    const [firstRace, secondRace] = await Promise.all([
      call(userA, "prepare_project_document_upload_v1", {
        p_project: projectA, p_document: internalFile.documentId, p_category: "plans_and_drawings", p_title: null,
        p_visibility: "internal", p_original_filename: "race-a.jpg", p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_version_note: null,
      }),
      call(userA, "prepare_project_document_upload_v1", {
        p_project: projectA, p_document: internalFile.documentId, p_category: "plans_and_drawings", p_title: null,
        p_visibility: "internal", p_original_filename: "race-b.jpg", p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_version_note: null,
      }),
    ]);
    const raceNumbers = [firstRace.versionNumber, secondRace.versionNumber];
    check(
      "10 concurrent versions stay unique",
      firstRace.ok === true && secondRace.ok === true && new Set(raceNumbers).size === 2
    );
    for (const versionId of [firstRace.versionId, secondRace.versionId]) {
      if (typeof versionId === "string") await call(userA, "remove_unready_project_document_version_v1", { p_version: versionId });
    }

    const otherOrgDownload = await call(userB, "authorize_project_document_version_v1", { p_version: shareableFile.versionId });
    const otherProject = await call(userA, "prepare_project_document_upload_v1", {
      p_project: projectOther, p_document: internalFile.documentId, p_category: "plans_and_drawings", p_title: null,
      p_visibility: "internal", p_original_filename: "moved.jpg", p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_version_note: null,
    });
    const otherRead = await userB.from("project_documents").select("id").eq("id", internalFile.documentId ?? "");
    check(
      "11 another organisation or project cannot use the file",
      otherOrgDownload.ok !== true &&
        !exposesStorage(otherOrgDownload) &&
        otherProject.ok !== true &&
        (otherRead.data ?? []).length === 0
    );

    const openStarted = performance.now();
    const authorized = await call(userA, "authorize_project_document_version_v1", { p_version: shareableFile.versionId });
    const storedPath = await admin.from("project_document_versions").select("storage_object_path, display_filename").eq("id", shareableFile.versionId ?? "").maybeSingle();
    const signed = storedPath.data?.storage_object_path
      ? await admin.storage.from(PROJECT_DOCUMENT_BUCKET).createSignedUrl(storedPath.data.storage_object_path, 60, { download: storedPath.data.display_filename ?? true })
      : { data: null, error: { message: "missing" } };
    const openMs = Math.round(performance.now() - openStarted);
    console.log(`TIMING open-one-file ${openMs}ms`);
    check(
      "12 opening one file returns a short-lived URL without a storage field",
      authorized.ok === true && !exposesStorage(authorized) && Boolean(signed.data?.signedUrl) && !("error" in signed && signed.error)
    );

    const reassigned = await admin.from("project_document_versions").update({
      storage_object_path: `${orgA}/${projectA}/reassigned.jpg`,
    }).eq("id", internalFile.versionId ?? "");
    const renamed = await call(userA, "rename_project_document_v1", { p_document: internalFile.documentId, p_title: "Updated site plan" });
    const filenameAfterRename = await admin.from("project_document_versions").select("display_filename").eq("id", internalFile.versionId ?? "").maybeSingle();
    check(
      "13 storage reassignment is rejected and rename keeps the filename",
      Boolean(reassigned.error) && renamed.ok === true && filenameAfterRename.data?.display_filename !== "Updated site plan"
    );

    const quoteId = randomUUID();
    const quote = await admin.from("quotes").insert({
      id: quoteId, org_id: orgA, project_id: projectA, created_by: userIds[0],
      title: "Accepted baseline", status: "draft", revision_number: 1,
      subtotal: 10000, gst_rate: 15, gst_amount: 1500, total_incl_gst: 11500,
    });
    if (quote.error) throw new Error(quote.error.message);
    const quoteItem = await admin.from("quote_items").insert({
      org_id: orgA, quote_id: quoteId, project_id: projectA, label: "Accepted work",
      description: "Accepted work", quantity: 1, unit: "ls", unit_price: 10000, total: 10000, sort_order: 1,
    });
    if (quoteItem.error) throw new Error(quoteItem.error.message);
    const accepted = await admin.from("quotes").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", quoteId);
    if (accepted.error) throw new Error(accepted.error.message);
    const draft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Indexed variation", p_summary: "Client summary", p_idempotency_key: `01f2-${stamp}`,
    });
    if (draft.ok !== true) throw new Error(draft.error ?? "draft");
    const item = await call(userA, "add_draft_variation_item_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item: line("Landing"),
    });
    if (item.ok !== true) throw new Error(item.error ?? "item");
    const attachment = await call(userA, "prepare_variation_attachment_v1", {
      p_revision: draft.revisionId, p_visibility: "client", p_original_filename: "variation-photo.jpg",
      p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_caption: "Landing", p_internal_description: null, p_linked_item: null,
    });
    if (attachment.ok !== true || typeof attachment.storageObjectPath !== "string") throw new Error(attachment.error ?? "attachment");
    variationPaths.push(attachment.storageObjectPath);
    const uploadedAttachment = await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).upload(attachment.storageObjectPath, jpeg, { contentType: "image/jpeg", upsert: false });
    if (uploadedAttachment.error) throw new Error(uploadedAttachment.error.message);
    const readyAttachment = await call(userA, "complete_variation_attachment_v1", { p_attachment: attachment.attachmentId, p_byte_size: jpeg.byteLength });
    const issued = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    const indexed = await readProjectDocumentCentre(userA, projectA, orgA);
    const indexedFile = indexed.variationGroups.flatMap((group) => group.attachments).find((file) => file.id === attachment.attachmentId);
    const copied = await admin.from("project_document_versions").select("id").eq("project_id", projectA).eq("display_filename", "variation-photo.jpg");
    const mutateIssued = await call(userA, "update_draft_variation_attachment_v1", {
      p_attachment: attachment.attachmentId, p_display_filename: "changed.jpg", p_caption: "Changed", p_internal_description: null, p_linked_item: null, p_clear_link: true,
    });
    const removedThroughDocuments = await call(userA, "remove_unready_project_document_version_v1", { p_version: attachment.attachmentId });
    check(
      "14 variation attachments are indexed without being copied or edited",
      readyAttachment.ok === true &&
        issued.ok === true &&
        indexedFile?.displayFilename === "variation-photo.jpg" &&
        indexedFile?.deletableThroughDocuments === false &&
        indexedFile?.revisionStatus === "issued" &&
        (copied.data ?? []).length === 0 &&
        mutateIssued.error === "IMMUTABLE" &&
        removedThroughDocuments.ok !== true &&
        !JSON.stringify(indexed).includes("storage_object_path")
    );
  } catch (error) {
    check("hosted document centre proof", false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup();
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log(`\nUX-01F.2 project documents passed (${passed})`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
