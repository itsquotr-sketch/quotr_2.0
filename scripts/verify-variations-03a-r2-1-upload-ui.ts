/**
 * VARIATIONS-03A.2-R1 — stable attachment upload UI.
 *
 * Run: npx --yes tsx scripts/verify-variations-03a-r2-1-upload-ui.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  VARIATION_ATTACHMENT_BUCKET,
  VARIATION_ATTACHMENT_MAX_BYTES,
  variationAttachmentSelectionError,
} from "../lib/variations/attachment-files";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";

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

function bytes(size: number, header: number[]): Buffer {
  const body = Buffer.alloc(size);
  header.forEach((value, index) => {
    body[index] = value;
  });
  return body;
}

async function putSigned(
  url: string,
  anonKey: string,
  signedUrl: string,
  file: Buffer,
  contentType: string
): Promise<number> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", new Blob([file], { type: contentType }));
  const response = await fetch(signedUrl, {
    method: "PUT",
    body,
    headers: { "x-upsert": "false", apikey: anonKey },
  });
  return response.status;
}

async function main(): Promise<void> {
  console.log("\nVARIATIONS-03A.2-R1 upload UI");
  const editor = read("components/variations/VariationEditor.tsx");
  const files = read("components/variations/VariationSupportingFiles.tsx");
  const actions = read("lib/variations/attachment-actions.ts");
  const direct = read("lib/variations/attachment-direct-upload.ts");
  const presentation = read("lib/variations/presentation.ts");
  const sql = read("supabase/migrations/071_variation_attachments.sql");
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

  check(
    "1 attachment input does not submit the Variation form",
    !files.includes("<form") &&
      files.includes('type="file"') &&
      !files.includes("useFormStatus") &&
      !files.includes("router.refresh") &&
      !files.includes("revalidatePath") &&
      editor.includes('data-variation-editor="true"') &&
      editor.includes("Scope and pricing") &&
      editor.includes('data-variation-commercial-summary="true"') &&
      editor.includes("<VariationSupportingFiles") &&
      !editor.includes("if (uploading) return")
  );
  check(
    "2 upload state is per file and does not revalidate the page",
    files.includes("Record<string, Transfer>") &&
      files.includes("void uploadOne(file, retry)") &&
      !actions.includes("revalidatePath") &&
      !actions.includes('formData.get("file")') &&
      !actions.includes("uploadVariationAttachment")
  );
  check(
    "3 uploading, ready and failed states stay accessible",
    files.includes("Uploading…") &&
      files.includes("Ready") &&
      files.includes("Upload failed") &&
      files.includes("Loader2") &&
      files.includes('aria-live="polite"') &&
      files.includes('role="alert"') &&
      files.includes('role="progressbar"') &&
      files.includes("motion-reduce:animate-none") &&
      files.includes(">Cancel<") &&
      files.includes("Retry") &&
      files.includes("Remove") &&
      files.includes('size="touch"')
  );
  check(
    "4 local selection rejects an oversized or unknown file before upload",
    variationAttachmentSelectionError("photo.jpg", 800 * 1024, jpeg) == null &&
      variationAttachmentSelectionError("notes.txt", 20, Uint8Array.from([1, 2, 3, 4])) != null &&
      variationAttachmentSelectionError("photo.jpg", VARIATION_ATTACHMENT_MAX_BYTES + 1, jpeg) ===
        "Each file must be 15 MB or smaller."
  );
  check(
    "5 unresolved client uploads still block issue",
    presentation.includes("ATTACHMENT_INCOMPLETE") &&
      actions.includes("ATTACHMENT_INCOMPLETE") &&
      editor.includes("clientAttachments")
  );
  check(
    "6 signed upload stays on the server-owned path",
    actions.includes("createSignedUploadUrl") &&
      actions.includes("startsWith(expectedPrefix)") &&
      actions.includes("sniffVariationAttachment") &&
      !actions.includes("orgId: input") &&
      direct.includes("/object/upload/sign/") &&
      direct.includes("target.host") &&
      sql.includes("No storage policies") &&
      !/create policy[^;]*storage\.objects/i.test(sql)
  );

  const env = envValue();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !service || !anonKey || new URL(url).hostname.split(".")[0] !== PREVIEW_SUPABASE_PROJECT_REF) {
    check("7 hosted Preview storage", false, "missing Preview credentials");
    finish();
    return;
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const folder = `verifier-upload-ui/${randomUUID()}`;
  const paths = [`${folder}/small.jpg`, `${folder}/mid.pdf`, `${folder}/near-limit.jpg`];
  try {
    const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const anonUpload = await anon.storage.from(VARIATION_ATTACHMENT_BUCKET).upload(`${folder}/anon.jpg`, jpeg, {
      contentType: "image/jpeg",
    });
    check("7 unsigned storage uploads still fail", Boolean(anonUpload.error));

    async function signedStatus(path: string, file: Buffer, contentType: string): Promise<number> {
      const signed = await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).createSignedUploadUrl(path);
      if (signed.error || !signed.data?.signedUrl) return 0;
      if (new URL(signed.data.signedUrl).host !== new URL(url).host) return 0;
      return putSigned(url, anonKey, signed.data.signedUrl, file, contentType);
    }

    const small = await signedStatus(paths[0], bytes(800 * 1024, [0xff, 0xd8, 0xff, 0xd9]), "image/jpeg");
    const pdf = await signedStatus(paths[1], bytes(6 * 1024 * 1024, [0x25, 0x50, 0x44, 0x46, 0x2d]), "application/pdf");
    const near = await signedStatus(
      paths[2],
      bytes(VARIATION_ATTACHMENT_MAX_BYTES - 1024, [0xff, 0xd8, 0xff, 0xd9]),
      "image/jpeg"
    );
    const over = await signedStatus(
      `${folder}/over.jpg`,
      bytes(VARIATION_ATTACHMENT_MAX_BYTES + 1, [0xff, 0xd8, 0xff, 0xd9]),
      "image/jpeg"
    );
    check("8 a JPG under 1 MB uploads through the signed URL", small >= 200 && small < 300, String(small));
    check("9 a PDF around 6 MB uploads through the signed URL", pdf >= 200 && pdf < 300, String(pdf));
    check("10 a file just under 15 MB uploads through the signed URL", near >= 200 && near < 300, String(near));
    check("11 a file over 15 MB is rejected by storage", over >= 400, String(over));
  } finally {
    await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).remove([...paths, `${folder}/over.jpg`, `${folder}/anon.jpg`]);
  }
  finish();
}

function finish(): void {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
