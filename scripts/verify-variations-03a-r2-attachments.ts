/**
 * VARIATIONS-03A.2 — photos, attachments and issued evidence.
 *
 * Run: npx --yes tsx scripts/verify-variations-03a-r2-attachments.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  canDeleteVariationAttachmentObject,
  safeVariationDisplayFilename,
  sniffVariationAttachment,
  VARIATION_ATTACHMENT_BUCKET,
} from "../lib/variations/attachment-files";
import { indexVariationAttachments } from "../lib/variations/attachment-index";
import { buildVariationDeliveryEmail } from "../lib/variations/delivery-email";
import { hashVariationAccessToken, generateVariationAccessToken } from "../lib/variations/delivery-token";
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

type Db = SupabaseClient;
type Rpc = Record<string, unknown> & { ok?: boolean; error?: string; state?: string };

const sql = read("supabase/migrations/071_variation_attachments.sql");
const editor = read("components/variations/VariationSupportingFiles.tsx");
const document = read("components/variations/VariationDocument.tsx");
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0xd9]);
const pdf = Uint8Array.from(Buffer.from("%PDF-1.4\n"));
const withFiles = buildVariationDeliveryEmail({
  companyName: "ERC Contracting",
  clientName: "Ada Client",
  projectTitle: "Deck",
  variationNumber: 4,
  revisionNumber: 1,
  title: "Deck stair addition",
  adjustmentInclGst: 1725,
  publicUrl: "https://example.test/v/vt_example",
  contactEmail: null,
  contactPhone: null,
  clientAttachmentCount: 2,
});
const withoutFiles = buildVariationDeliveryEmail({
  companyName: "ERC Contracting",
  clientName: "Ada Client",
  projectTitle: "Deck",
  variationNumber: 4,
  revisionNumber: 1,
  title: "Deck stair addition",
  adjustmentInclGst: 1725,
  publicUrl: "https://example.test/v/vt_example",
  contactEmail: null,
  contactPhone: null,
});

function envValue(): Record<string, string> {
  return Object.fromEntries(
    read(".env.local").split("\n").filter((row) => row && !row.startsWith("#") && row.includes("=")).map((row) => {
      const index = row.indexOf("=");
      return [row.slice(0, index), row.slice(index + 1).replace(/^"|"$/g, "")];
    })
  );
}

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

function keysOf(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => keysOf(item, found));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      found.push(key);
      keysOf(child, found);
    }
  }
  return found;
}

async function main(): Promise<void> {
  console.log("\nVARIATIONS-03A.2 attachments");
  check(
    "1 private bucket and server-owned path",
    sql.includes("'variation-attachments'") &&
      sql.includes("false") &&
      sql.includes("{org}/{project}/{variation}/{revision}/{attachment}") === false &&
      sql.includes("v_rev.org_id::text || '/' || v_rev.project_id::text") &&
      sql.includes("No storage policies") &&
      !sql.includes("p_org_id")
  );
  check(
    "2 client and internal wording stays separate",
    editor.includes("Client attachments") &&
      editor.includes("Visible to the client and included with this Variation.") &&
      editor.includes("Internal files") &&
      editor.includes("Only your organisation can see these files.") &&
      editor.includes("Uploading") &&
      editor.includes("Upload failed") &&
      editor.includes("Ready") &&
      editor.includes('role="alert"')
  );
  check(
    "3 email points to the secure link when client files exist",
    withFiles.text.includes("Supporting documents or photos are available through the secure View Variation link.") &&
      withFiles.text.includes("View Variation:") &&
      !withoutFiles.text.includes("Supporting documents or photos") &&
      !withFiles.html.includes("Content-Disposition")
  );
  check(
    "4 file rules reject unsafe types and path names",
    sniffVariationAttachment(jpeg, "north.jpg")?.mime === "image/jpeg" &&
      sniffVariationAttachment(pdf, "note.pdf")?.mime === "application/pdf" &&
      sniffVariationAttachment(Uint8Array.from([1, 2, 3]), "photo.heic") == null &&
      sniffVariationAttachment(Uint8Array.from(Buffer.from("hello")), "notes.txt") == null &&
      safeVariationDisplayFilename("../../secret.jpg", "image/jpeg") === "secret.jpg" &&
      canDeleteVariationAttachmentObject(0) &&
      !canDeleteVariationAttachmentObject(1)
  );
  const indexed = indexVariationAttachments([
    {
      id: "file-1",
      variationNumber: 2,
      revisionNumber: 1,
      revisionStatus: "issued",
      visibility: "client",
      mimeType: "image/jpeg",
      createdAt: "2026-09-28T00:00:00.000Z",
      frozen: true,
    },
  ]);
  check(
    "5 project index keeps the same row and blocks issued deletion",
    indexed[0]?.attachments[0]?.id === "file-1" &&
      indexed[0]?.attachments[0]?.deletableThroughDocuments === false &&
      read("lib/variations/attachment-index.ts").includes("Variation revision remains the owner") &&
      read("lib/variations/attachment-index.ts").includes("Issued Variation attachments cannot be deleted")
  );
  check(
    "6 print lists captions without a storage url",
    document.includes("Supporting information") &&
      document.includes("file.caption") &&
      document.includes("print:block") &&
      !document.includes(VARIATION_ATTACHMENT_BUCKET)
  );
  check(
    "7 issue copy, touch targets and allowed types are explicit",
    read("lib/variations/presentation.ts").includes("This revision includes {attachments} client attachments.") &&
      read("lib/variations/presentation.ts").includes("Once issued, its scope, pricing and client attachments cannot be changed.") &&
      editor.includes('size="touch"') &&
      editor.includes(">Close<") &&
      editor.includes("Display name") &&
      editor.includes("Caption") &&
      editor.includes("Internal description") &&
      editor.includes("Retry") &&
      editor.includes("Remove") &&
      sql.includes("15728640") &&
      sql.includes("image/jpeg") &&
      sql.includes("image/png") &&
      sql.includes("application/pdf") &&
      sql.includes("wordprocessingml") &&
      sql.includes("spreadsheetml") &&
      !sql.includes("image/heic") &&
      !sql.includes("video/")
  );
  const route = read("app/v/[token]/files/[fileId]/route.ts");
  check(
    "8 public file route stays on the token and does not publish the bucket",
    route.includes("resolve_variation_client_attachment_v1") &&
      route.includes("private, no-store") &&
      route.includes("This Variation has been withdrawn.") &&
      !route.includes("getPublicUrl")
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
  const emailA = `hello+variations-03a2.${stamp}@erccontracting.co.nz`;
  const emailB = `hello+variations-03a2b.${stamp}@erccontracting.co.nz`;
  const password = `Var03A2-${stamp}-Aa!`;
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

  async function cleanup(): Promise<void> {
    if (objectPaths.length > 0) {
      await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).remove(objectPaths);
    }
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
      const profile = await admin.from("profiles").insert({ id: created.data.user.id, org_id: orgId, role: "owner", full_name: "Variations 03A2" });
      if (profile.error) throw new Error(profile.error.message);
      const membership = await admin.from("organisation_memberships").insert({
        org_id: orgId, user_id: created.data.user.id, role: "owner", status: "active", joined_at: new Date().toISOString(),
      });
      if (membership.error) throw new Error(membership.error.message);
      const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const signedIn = await client.auth.signInWithPassword({ email: address, password });
      if (signedIn.error) throw new Error(signedIn.error.message);
      return client;
    }
    async function call(client: Db, fn: string, args: Record<string, unknown>): Promise<Rpc> {
      const { data, error } = await client.rpc(fn, args);
      if (error) return { ok: false, error: error.message };
      return (data ?? { ok: false }) as Rpc;
    }
    const orgs = await admin.from("organisations").insert([
      { id: orgA, name: `Variations 03A2 ${stamp}` },
      { id: orgB, name: `Other ${stamp}` },
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
      { id: projectA, org_id: orgA, created_by: userIds[0], title: `Attachments ${stamp}`, client_name: "Ada Client", client_email: "ada@example.test", stage: "estimate_ready", business_status: "estimate_ready" },
      { id: projectOther, org_id: orgA, created_by: userIds[0], title: `Other project ${stamp}`, stage: "estimate_ready", business_status: "estimate_ready" },
    ]);
    if (project.error) throw new Error(project.error.message);
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
      p_project: projectA, p_title: "Photo variation", p_summary: "Client summary", p_idempotency_key: `03a2-${stamp}`,
    });
    if (draft.ok !== true) throw new Error(draft.error ?? "draft");
    const item = await call(userA, "add_draft_variation_item_v1", {
      p_variation: draft.variationId, p_revision: draft.revisionId, p_item: line("Add a landing"),
    });
    if (item.ok !== true) throw new Error(item.error ?? "item");

    const signedOutUpload = await signedOut.storage.from(VARIATION_ATTACHMENT_BUCKET).upload(`${orgA}/guess.jpg`, jpeg, { contentType: "image/jpeg" });
    const crossUpload = await userB.storage.from(VARIATION_ATTACHMENT_BUCKET).upload(`${orgA}/${projectA}/guess.jpg`, jpeg, { contentType: "image/jpeg" });
    const ownUpload = await userA.storage.from(VARIATION_ATTACHMENT_BUCKET).upload(`${orgA}/${projectA}/guess.jpg`, jpeg, { contentType: "image/jpeg" });
    check("7 signed-out and direct storage uploads fail", Boolean(signedOutUpload.error && crossUpload.error && ownUpload.error));

    const signedOutPrepare = await call(signedOut, "prepare_variation_attachment_v1", {
      p_revision: draft.revisionId, p_visibility: "client", p_original_filename: "north.jpg",
      p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_caption: null, p_internal_description: null, p_linked_item: null,
    });
    const crossPrepare = await call(userB, "prepare_variation_attachment_v1", {
      p_revision: draft.revisionId, p_visibility: "client", p_original_filename: "north.jpg",
      p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_caption: null, p_internal_description: null, p_linked_item: null,
    });
    check(
      "8 signed-out and cross-tenant attachment writes fail",
      signedOutPrepare.ok !== true &&
        crossPrepare.ok !== true &&
        crossPrepare.storageObjectPath == null &&
        crossPrepare.attachmentId == null
    );

    const badType = await call(userA, "prepare_variation_attachment_v1", {
      p_revision: draft.revisionId, p_visibility: "client", p_original_filename: "notes.txt",
      p_mime_type: "text/plain", p_byte_size: 5, p_caption: null, p_internal_description: null, p_linked_item: null,
    });
    const tooBig = await call(userA, "prepare_variation_attachment_v1", {
      p_revision: draft.revisionId, p_visibility: "client", p_original_filename: "north.jpg",
      p_mime_type: "image/jpeg", p_byte_size: 15 * 1024 * 1024 + 1, p_caption: null, p_internal_description: null, p_linked_item: null,
    });
    check("9 type and size are checked on the server", badType.error === "FILE_TYPE" && tooBig.error === "FILE_TOO_LARGE");

    const missingPrepared = await call(userA, "prepare_variation_attachment_v1", {
      p_revision: draft.revisionId, p_visibility: "client", p_original_filename: "missing.jpg",
      p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_caption: null, p_internal_description: null, p_linked_item: null,
    });
    const missingComplete = await call(userA, "complete_variation_attachment_v1", {
      p_attachment: missingPrepared.attachmentId, p_byte_size: jpeg.byteLength,
    });
    await call(userA, "remove_draft_variation_attachment_v1", { p_attachment: missingPrepared.attachmentId });
    check("10 metadata without a storage object cannot become ready", missingPrepared.ok === true && missingComplete.error === "MISSING_OBJECT");

    const pending = await call(userA, "prepare_variation_attachment_v1", {
      p_revision: draft.revisionId, p_visibility: "client", p_original_filename: "../north elevation.jpg",
      p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_caption: "North elevation", p_internal_description: "hidden", p_linked_item: null,
    });
    const pendingPath = String(pending.storageObjectPath ?? "");
    const blocked = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    const failedRow = await call(userA, "fail_variation_attachment_v1", { p_attachment: pending.attachmentId });
    const blockedFailed = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    const removedPending = await call(userA, "remove_draft_variation_attachment_v1", { p_attachment: pending.attachmentId });
    check(
      "10 incomplete client files block issue and the path is server-owned",
      pending.ok === true &&
        pendingPath.startsWith(`${orgA}/${projectA}/${draft.variationId}/${draft.revisionId}/${pending.attachmentId}/`) &&
        !pendingPath.includes("..") &&
        blocked.error === "ATTACHMENT_INCOMPLETE" &&
        failedRow.ok === true &&
        blockedFailed.error === "ATTACHMENT_INCOMPLETE" &&
        removedPending.ok === true
    );

    async function storeReady(visibility: "client" | "internal", filename: string, bytes: Uint8Array, mime: string, caption: string | null): Promise<Rpc> {
      const prepared = await call(userA, "prepare_variation_attachment_v1", {
        p_revision: draft.revisionId, p_visibility: visibility, p_original_filename: filename,
        p_mime_type: mime, p_byte_size: bytes.byteLength, p_caption: caption, p_internal_description: visibility === "internal" ? "Site diary" : null,
        p_linked_item: visibility === "client" ? (item.itemId ?? null) : null,
      });
      if (prepared.ok !== true || typeof prepared.storageObjectPath !== "string") return prepared;
      objectPaths.push(prepared.storageObjectPath);
      const uploaded = await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).upload(prepared.storageObjectPath, bytes, { contentType: mime, upsert: false });
      if (uploaded.error) return { ok: false, error: uploaded.error.message };
      return call(userA, "complete_variation_attachment_v1", { p_attachment: prepared.attachmentId, p_byte_size: bytes.byteLength });
    }

    const clientFile = await storeReady("client", "north-elevation.jpg", jpeg, "image/jpeg", "North elevation");
    const internalFile = await storeReady("internal", "private-note.pdf", pdf, "application/pdf", null);
    const internalPending = await call(userA, "prepare_variation_attachment_v1", {
      p_revision: draft.revisionId, p_visibility: "internal", p_original_filename: "scratch.pdf",
      p_mime_type: "application/pdf", p_byte_size: pdf.byteLength, p_caption: null, p_internal_description: "scratch", p_linked_item: null,
    });
    const issued = await call(userA, "issue_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    check("11 a pending internal file does not block issue", internalPending.ok === true && issued.ok === true && clientFile.ok === true && internalFile.ok === true, String(issued.error ?? clientFile.error ?? ""));

    const issuedRow = await admin.from("variation_attachments").select("id, display_filename, caption, issued_manifest, frozen_at").eq("variation_revision_id", draft.revisionId).eq("visibility", "client").eq("upload_status", "ready").maybeSingle();
    const manifest = issuedRow.data?.issued_manifest as { displayFilename?: string; caption?: string; storageObjectPath?: string } | null;
    const renameIssued = await call(userA, "update_draft_variation_attachment_v1", {
      p_attachment: manifest ? issuedRow.data?.id : null, p_display_filename: "changed.jpg", p_caption: "Changed", p_internal_description: null, p_linked_item: null, p_clear_link: false,
    });
    const reorderIssued = await call(userA, "reorder_draft_variation_attachments_v1", {
      p_revision: draft.revisionId, p_visibility: "client", p_ids: [issuedRow.data?.id],
    });
    const hiddenFromOther = await userB.from("variation_attachments").select("id").eq("id", issuedRow.data?.id ?? "");
    check(
      "12 issued client manifest is frozen",
      manifest?.displayFilename === "north-elevation.jpg" &&
        manifest?.caption === "North elevation" &&
        Boolean(manifest?.storageObjectPath) &&
        issuedRow.data?.frozen_at != null &&
        renameIssued.error === "IMMUTABLE" &&
        reorderIssued.error === "IMMUTABLE" &&
        (hiddenFromOther.data ?? []).length === 0
    );

    const rawToken = generateVariationAccessToken();
    const begun = await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: draft.variationId, p_revision: draft.revisionId,
      p_recipient_email: "ada@example.test", p_recipient_name: "Ada Client",
      p_token_hash: hashVariationAccessToken(rawToken), p_idempotency_key: `03a2-send-${stamp}`,
    });
    const publicView = await call(signedOut, "lookup_variation_client_by_token_hash_v1", { p_token_hash: hashVariationAccessToken(rawToken) });
    const publicText = JSON.stringify(publicView);
    const publicKeys = keysOf(publicView);
    const clientFiles = Array.isArray(publicView.clientAttachments) ? publicView.clientAttachments as Array<Record<string, unknown>> : [];
    check(
      "13 public payload keeps client files and drops internal data",
      begun.ok === true &&
        publicView.state === "proposed" &&
        clientFiles.length === 1 &&
        clientFiles[0]?.displayFilename === "north-elevation.jpg" &&
        clientFiles[0]?.caption === "North elevation" &&
        !publicText.includes("private-note.pdf") &&
        !publicText.includes("Site diary") &&
        !publicText.includes("scratch.pdf") &&
        !publicKeys.some((key) => ["storageObjectPath", "storageBucket", "internalDescription", "internalNotes", "margin", "profit", "orgId", "projectId"].includes(key))
    );

    const clientAttachmentId = String(clientFiles[0]?.fileId ?? "");
    const anonResolve = await signedOut.rpc("resolve_variation_client_attachment_v1", {
      p_token_hash: hashVariationAccessToken(rawToken), p_file_id: clientAttachmentId,
    });
    const resolved = await call(admin, "resolve_variation_client_attachment_v1", {
      p_token_hash: hashVariationAccessToken(rawToken), p_file_id: clientAttachmentId,
    });
    const internalId = await admin.from("variation_attachments").select("id").eq("variation_revision_id", draft.revisionId).eq("visibility", "internal").eq("display_filename", "private-note.pdf").maybeSingle();
    const internalResolve = await call(admin, "resolve_variation_client_attachment_v1", {
      p_token_hash: hashVariationAccessToken(rawToken), p_file_id: internalId.data?.id,
    });
    check(
      "14 token download resolves only a client file for the service role",
      Boolean(anonResolve.error) &&
        resolved.ok === true &&
        typeof resolved.storageObjectPath === "string" &&
        internalResolve.ok !== true &&
        !publicText.includes(String(resolved.storageObjectPath))
    );

    const otherAuth = await call(userB, "authorize_variation_attachment_v1", { p_attachment: clientAttachmentId });
    const ownAuth = await call(userA, "authorize_variation_attachment_v1", { p_attachment: clientAttachmentId });
    const guessed = await userB.storage.from(VARIATION_ATTACHMENT_BUCKET).createSignedUrl(String(ownAuth.storageObjectPath ?? "missing"), 60);
    check(
      "15 another organisation cannot obtain the file or a signed url",
      otherAuth.ok !== true &&
        ownAuth.ok === true &&
        ownAuth.storageObjectPath === resolved.storageObjectPath &&
        Boolean(guessed.error)
    );

    const revised = await call(userA, "create_variation_revision_v1", { p_variation: draft.variationId, p_revision: draft.revisionId });
    const copies = await admin.from("variation_attachments").select("id, display_filename, storage_object_path, source_attachment_id, frozen_at, issued_manifest").eq("variation_revision_id", revised.revisionId);
    const copy = (copies.data ?? []).find((row) => row.display_filename === "north-elevation.jpg");
    const renamed = copy ? await call(userA, "update_draft_variation_attachment_v1", {
      p_attachment: copy.id, p_display_filename: "renamed-elevation.jpg", p_caption: "Updated caption", p_internal_description: null, p_linked_item: null, p_clear_link: true,
    }) : { ok: false };
    const issuedAfter = await admin.from("variation_attachments").select("display_filename, issued_manifest").eq("id", clientAttachmentId).maybeSingle();
    const issuedManifest = issuedAfter.data?.issued_manifest as { displayFilename?: string; caption?: string } | null;
    const removedCopy = copy ? await call(userA, "remove_draft_variation_attachment_v1", { p_attachment: copy.id }) : { ok: false, deleteObject: true };
    const sharedStillThere = await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).download(String(manifest?.storageObjectPath ?? ""));
    check(
      "16 a new revision copies the reference without changing the issued file",
      revised.ok === true &&
        copy?.storage_object_path === manifest?.storageObjectPath &&
        copy?.source_attachment_id === clientAttachmentId &&
        copy?.frozen_at == null &&
        copy?.issued_manifest == null &&
        renamed.ok === true &&
        issuedManifest?.displayFilename === "north-elevation.jpg" &&
        issuedManifest?.caption === "North elevation" &&
        removedCopy.ok === true &&
        removedCopy.deleteObject === false &&
        !sharedStillThere.error
    );

    const limitDraft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Limit variation", p_summary: "Client summary", p_idempotency_key: `03a2-limit-${stamp}`,
    });
    let limitError = "";
    for (let index = 0; index < 21; index += 1) {
      const prepared = await call(userA, "prepare_variation_attachment_v1", {
        p_revision: limitDraft.revisionId, p_visibility: "client", p_original_filename: `file-${index}.pdf`,
        p_mime_type: "application/pdf", p_byte_size: pdf.byteLength, p_caption: null, p_internal_description: null, p_linked_item: null,
      });
      if (index === 20) limitError = String(prepared.error ?? "");
    }
    check("17 the revision stops at 20 active files", limitDraft.ok === true && limitError === "ATTACHMENT_LIMIT");

    const exclusiveDraft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Exclusive file", p_summary: "Client summary", p_idempotency_key: `03a2-exclusive-${stamp}`,
    });
    const exclusiveItem = await call(userA, "add_draft_variation_item_v1", {
      p_variation: exclusiveDraft.variationId, p_revision: exclusiveDraft.revisionId, p_item: line("Temporary"),
    });
    const exclusivePrepared = await call(userA, "prepare_variation_attachment_v1", {
      p_revision: exclusiveDraft.revisionId, p_visibility: "client", p_original_filename: "only.jpg",
      p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_caption: null, p_internal_description: null, p_linked_item: null,
    });
    if (typeof exclusivePrepared.storageObjectPath === "string") {
      objectPaths.push(exclusivePrepared.storageObjectPath);
      await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).upload(exclusivePrepared.storageObjectPath, jpeg, { contentType: "image/jpeg" });
      await call(userA, "complete_variation_attachment_v1", { p_attachment: exclusivePrepared.attachmentId, p_byte_size: jpeg.byteLength });
    }
    const exclusiveRemoved = await call(userA, "remove_draft_variation_attachment_v1", { p_attachment: exclusivePrepared.attachmentId });
    if (exclusiveRemoved.deleteObject === true && typeof exclusivePrepared.storageObjectPath === "string") {
      await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).remove([exclusivePrepared.storageObjectPath]);
    }
    const exclusiveGone = await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).download(String(exclusivePrepared.storageObjectPath ?? "missing"));
    check(
      "18 a draft-only object can be removed and a shared object cannot",
      exclusiveItem.ok === true && exclusiveRemoved.ok === true && exclusiveRemoved.deleteObject === true && Boolean(exclusiveGone.error)
    );

    const mismatched = await admin.from("variation_attachments").insert({
      org_id: orgA,
      project_id: projectOther,
      variation_id: draft.variationId,
      variation_revision_id: draft.revisionId,
      visibility: "client",
      storage_bucket: VARIATION_ATTACHMENT_BUCKET,
      storage_object_path: `${orgA}/${projectOther}/${draft.variationId}/${draft.revisionId}/${randomUUID()}/bad.jpg`,
      shared_object_key: "bad",
      original_filename: "bad.jpg",
      display_filename: "bad.jpg",
      mime_type: "image/jpeg",
      byte_size: jpeg.byteLength,
      upload_status: "pending",
      object_confirmed: false,
    });
    const moved = await admin.from("variation_attachments").update({ variation_revision_id: exclusiveDraft.revisionId }).eq("id", clientAttachmentId);
    const reassigned = await admin.from("variation_attachments").update({ storage_object_path: `${orgA}/${projectA}/other.jpg` }).eq("id", clientAttachmentId);
    check("19 cross-project, cross-revision and storage reassignment writes fail", Boolean(mismatched.error && moved.error && reassigned.error));

    const withdrawDraft = await call(userA, "create_draft_variation_v1", {
      p_project: projectA, p_title: "Withdraw file", p_summary: "Client summary", p_idempotency_key: `03a2-withdraw-${stamp}`,
    });
    await call(userA, "add_draft_variation_item_v1", {
      p_variation: withdrawDraft.variationId, p_revision: withdrawDraft.revisionId, p_item: line("Hold"),
    });
    const withdrawPrepared = await call(userA, "prepare_variation_attachment_v1", {
      p_revision: withdrawDraft.revisionId, p_visibility: "client", p_original_filename: "hold.jpg",
      p_mime_type: "image/jpeg", p_byte_size: jpeg.byteLength, p_caption: "Hold photo", p_internal_description: null, p_linked_item: null,
    });
    if (typeof withdrawPrepared.storageObjectPath === "string") {
      objectPaths.push(withdrawPrepared.storageObjectPath);
      await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).upload(withdrawPrepared.storageObjectPath, jpeg, { contentType: "image/jpeg" });
      await call(userA, "complete_variation_attachment_v1", { p_attachment: withdrawPrepared.attachmentId, p_byte_size: jpeg.byteLength });
    }
    const withdrawIssued = await call(userA, "issue_variation_revision_v1", { p_variation: withdrawDraft.variationId, p_revision: withdrawDraft.revisionId });
    const withdrawToken = generateVariationAccessToken();
    await call(userA, "begin_variation_delivery_v1", {
      p_project: projectA, p_variation: withdrawDraft.variationId, p_revision: withdrawDraft.revisionId,
      p_recipient_email: "ada@example.test", p_recipient_name: "Ada Client",
      p_token_hash: hashVariationAccessToken(withdrawToken), p_idempotency_key: `03a2-withdraw-send-${stamp}`,
    });
    await call(userA, "withdraw_issued_variation_v1", {
      p_project: projectA, p_variation: withdrawDraft.variationId, p_revision: withdrawDraft.revisionId, p_reason: "Hold this change.",
    });
    const withdrawnView = await call(signedOut, "lookup_variation_client_by_token_hash_v1", { p_token_hash: hashVariationAccessToken(withdrawToken) });
    const withdrawnFile = await call(admin, "resolve_variation_client_attachment_v1", {
      p_token_hash: hashVariationAccessToken(withdrawToken), p_file_id: withdrawPrepared.attachmentId,
    });
    const invalidView = await call(signedOut, "lookup_variation_client_by_token_hash_v1", { p_token_hash: hashVariationAccessToken(generateVariationAccessToken()) });
    const invalidFile = await call(admin, "resolve_variation_client_attachment_v1", {
      p_token_hash: hashVariationAccessToken(generateVariationAccessToken()), p_file_id: clientAttachmentId,
    });
    check(
      "20 withdrawn and invalid tokens expose no file",
      withdrawIssued.ok === true &&
        withdrawnView.state === "withdrawn" &&
        !JSON.stringify(withdrawnView).includes("hold.jpg") &&
        withdrawnFile.error === "WITHDRAWN" &&
        withdrawnFile.storageObjectPath == null &&
        invalidView.ok !== true &&
        invalidFile.ok !== true &&
        invalidFile.storageObjectPath == null
    );

    const listed = await call(userA, "list_project_variation_attachments_v1", { p_project: projectA });
    const listedRows = Array.isArray(listed.attachments) ? listed.attachments as Array<Record<string, unknown>> : [];
    const grouped = indexVariationAttachments(listedRows.flatMap((row) => {
      const variationNumber = Number(row.variation_number);
      const revisionNumber = Number(row.revision_number);
      if (typeof row.id !== "string" || !Number.isFinite(variationNumber) || !Number.isFinite(revisionNumber)) return [];
      if (row.visibility !== "client" && row.visibility !== "internal") return [];
      return [{
        id: row.id,
        variationNumber,
        revisionNumber,
        revisionStatus: String(row.revision_status),
        visibility: row.visibility,
        mimeType: String(row.mime_type),
        createdAt: String(row.created_at),
        frozen: row.frozen === true,
      }];
    }));
    const listedText = JSON.stringify(listed);
    check(
      "21 project index returns the same attachment ids without storage paths",
      listed.ok === true &&
        listedRows.some((row) => row.id === clientAttachmentId) &&
        grouped.some((group) => group.attachments.some((file) => file.id === clientAttachmentId && file.deletableThroughDocuments === false)) &&
        !listedText.includes("storageObjectPath") &&
        !listedText.includes(VARIATION_ATTACHMENT_BUCKET)
    );

    const otherList = await call(userB, "list_project_variation_attachments_v1", { p_project: projectA });
    check("22 another organisation cannot list the project files", otherList.ok !== true);
    check(
      "23 issue blocker copy and ownership comment stay with the revision",
      read("lib/variations/actions.ts").includes("Finish or remove the client attachments that are still uploading or failed.") &&
        sql.includes("Owned by one Variation revision") &&
        sql.includes("ATTACHMENT_INCOMPLETE")
    );
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
