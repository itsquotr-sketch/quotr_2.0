/**
 * VARIATIONS-03A.2-R2 — editor layout stays intact while an upload is pending.
 *
 * Run: npx --yes tsx scripts/verify-variations-03a-r2-2-editor-layout.ts
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { chromium, type Page } from "playwright";

const require = createRequire(import.meta.url);
const root = join(__dirname, "..");
const ITEM_TEXT = "Landing addition priced item";
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
  return require("node:fs").readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

function bundle(outfile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "--yes",
        "esbuild",
        join(root, "scripts/variation-upload-layout-harness.tsx"),
        "--bundle",
        "--format=iife",
        "--platform=browser",
        "--jsx=automatic",
        `--outfile=${outfile}`,
        `--alias:@=${root}`,
        "--define:process.env.NODE_ENV=\\\"production\\\"",
        "--define:process.env.NEXT_PUBLIC_SUPABASE_URL=\\\"https://layout.local\\\"",
        "--define:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=\\\"layout-anon\\\"",
      ],
      { cwd: root, stdio: "inherit", shell: true }
    );
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`esbuild exited ${code}`))));
  });
}

async function compileCss(): Promise<string> {
  const postcss = require("postcss") as typeof import("postcss");
  const tailwind = require("@tailwindcss/postcss") as { default?: () => unknown };
  const plugin = typeof tailwind === "function" ? tailwind : tailwind.default;
  const from = join(root, "app/globals.css");
  const result = await postcss([plugin()]).process(require("node:fs").readFileSync(from, "utf8"), { from });
  return result.css;
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const ids = ["shell", "sidebar", "page", "scroll", "editor", "details", "scope", "item", "summary", "history", "issue", "document"];
    const support = document.querySelector("[data-variation-supporting='true']");
    const boxes: Record<string, { h: number; w: number; display: string; top: number } | null> = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) {
        boxes[id] = null;
        continue;
      }
      const rect = el.getBoundingClientRect();
      boxes[id] = { h: Math.round(rect.height), w: Math.round(rect.width), display: getComputedStyle(el).display, top: Math.round(rect.top) };
    }
    if (support) {
      const rect = support.getBoundingClientRect();
      boxes.support = { h: Math.round(rect.height), w: Math.round(rect.width), display: getComputedStyle(support).display, top: Math.round(rect.top) };
    } else {
      boxes.support = null;
    }
    const preview = document.querySelector("[data-upload-status='pending'] img");
    const previewBox = preview ? preview.getBoundingClientRect() : null;
    const hidden = ["editor", "scope", "item", "summary", "history", "issue", "document"].filter((id) => {
      const el = document.getElementById(id);
      return !el || getComputedStyle(el).display === "none";
    });
    if (support && getComputedStyle(support).display === "none") hidden.push("support");
    const oversized: string[] = [];
    return {
      boxes,
      hidden,
      oversized,
      doc: document.documentElement.scrollHeight,
      scroll: document.getElementById("scroll")?.scrollTop ?? 0,
      instance: document.getElementById("editor")?.getAttribute("data-editor-instance"),
      title: (document.getElementById("title") as HTMLInputElement | null)?.value ?? "",
      item: document.getElementById("item")?.textContent ?? "",
      uploading: document.body.innerText.includes("Uploading"),
      ready: document.body.innerText.includes("Ready"),
      skeleton: document.body.innerText.includes("Loading variation") || Boolean(document.querySelector("[data-route-loading]")),
      preview: previewBox ? { h: Math.round(previewBox.height), w: Math.round(previewBox.width) } : null,
    };
  });
}

async function main(): Promise<void> {
  console.log("\nVARIATIONS-03A.2-R2 editor layout");
  const files = read("components/variations/VariationSupportingFiles.tsx");
  const editor = read("components/variations/VariationEditor.tsx");
  const page = read("app/(protected)/app/projects/[projectId]/variations/[variationId]/page.tsx");
  check(
    "1 upload traffic is not a server action",
    files.includes("@/lib/variations/attachment-client") &&
      !files.includes("@/lib/variations/attachment-actions") &&
      !files.includes("useRouter") &&
      !files.includes("startTransition") &&
      !files.includes("revalidatePath") &&
      !files.includes("if (uploading) return")
  );
  check(
    "2 editor identity is not keyed by upload state",
    editor.includes("function mergeAttachments") &&
      editor.includes("onChange={mergeAttachments}") &&
      editor.includes("data-editor-instance={editorInstance}") &&
      page.includes("editor.variation.id}:${editor.variation.status}:${editor.withdrawalReason") &&
      !page.includes("key={attachments") &&
      !editor.includes("key={uploading") &&
      !editor.includes("key={attachments")
  );
  check(
    "3 preview and file input cannot stretch the editor",
    files.includes("relative block h-16 w-16 shrink-0 overflow-hidden") &&
      files.includes("absolute inset-0 size-full cursor-pointer opacity-0") &&
      page.includes('className="min-h-0"')
  );

  const dir = await mkdtemp(join(tmpdir(), "quotr-upload-layout-"));
  const photo = join(dir, "photo.jpg");
  const bundlePath = join(dir, "harness.js");
  await sharp({
    create: { width: 2400, height: 3600, channels: 3, background: { r: 210, g: 210, b: 210 } },
  }).jpeg().toFile(photo);
  const css = await compileCss();
  await bundle(bundlePath);
  const script = await readFile(bundlePath, "utf8");
  const html = `<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const layout = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  let releasePrepare = () => {};
  let releaseUpload = () => {};
  const prepareGate = new Promise<void>((resolve) => {
    releasePrepare = resolve;
  });
  const uploadGate = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });
  await layout.route("https://layout.local/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/")) {
      await route.fulfill({ contentType: "text/html", body: html });
      return;
    }
    if (url.includes("/api/variations/attachments")) {
      const body = route.request().postDataJSON() as { op?: string };
      if (body.op === "prepare") {
        await prepareGate;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            attachmentId: "server-1",
            signedUrl: "https://layout.local/object/upload/sign/photo.jpg",
            displayFilename: "photo.jpg",
            mimeType: "image/jpeg",
          }),
        });
        return;
      }
      if (body.op === "finalize") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            attachment: {
              id: "server-1",
              revisionId: "revision",
              visibility: "client",
              displayFilename: "photo.jpg",
              mimeType: "image/jpeg",
              byteSize: 120000,
              caption: null,
              internalDescription: null,
              linkedVariationItemId: null,
              sortOrder: 0,
              uploadStatus: "ready",
              objectConfirmed: true,
              createdAt: "2026-09-28T00:00:00.000Z",
              frozen: false,
            },
          }),
        });
        return;
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, url: "https://layout.local/signed/photo.jpg" }) });
      return;
    }
    if (url.includes("/object/upload/sign/")) {
      await uploadGate;
      await route.fulfill({ status: 200, body: "" });
      return;
    }
    await route.fulfill({ status: 200, body: "" });
  });
  await layout.goto("https://layout.local/", { waitUntil: "load" });
  await layout.getByText(ITEM_TEXT).waitFor({ timeout: 10000 });
  await layout.getByLabel("Title").fill("Unsaved stair note");
  const before = await measure(layout);
  await layout.setInputFiles('[aria-label="Add photos or files"]', photo);
  await layout.getByText("Uploading").waitFor({ timeout: 10000 });
  const during = await measure(layout);
  releasePrepare();
  await layout.getByText("Uploading").waitFor({ timeout: 10000 });
  const transferring = await measure(layout);
  releaseUpload();
  await layout.getByText("Ready", { exact: true }).waitFor({ timeout: 10000 });
  const after = await measure(layout);
  await browser.close();
  await rm(dir, { recursive: true, force: true });

  const scopeDelta = (during.boxes.scope?.h ?? 0) - (before.boxes.scope?.h ?? 0);
  const editorDelta = (during.boxes.editor?.h ?? 0) - (before.boxes.editor?.h ?? 0);
  const supportDelta = (during.boxes.support?.h ?? 0) - (before.boxes.support?.h ?? 0);
  const transferEditorDelta = (transferring.boxes.editor?.h ?? 0) - (before.boxes.editor?.h ?? 0);
  const transferSupportDelta = (transferring.boxes.support?.h ?? 0) - (before.boxes.support?.h ?? 0);
  check("4 existing item stays visible while the upload is held", during.item.includes(ITEM_TEXT) && during.boxes.item != null && during.boxes.item.h > 0 && during.boxes.item.display !== "none");
  check("5 supporting information stays visible while uploading", during.boxes.support != null && during.boxes.support.display !== "none" && during.boxes.support.h > 0);
  check("6 commercial summary stays visible while uploading", during.boxes.summary != null && during.boxes.summary.display !== "none" && during.uploading);
  check("7 no route skeleton and no editor section is hidden", during.hidden.length === 0 && !during.skeleton && transferring.hidden.length === 0, during.hidden.join(","));
  check(
    "8 scope does not gain an empty viewport",
    scopeDelta < 40 &&
      editorDelta < 400 &&
      Math.abs(editorDelta - supportDelta) < 40 &&
      transferEditorDelta < 400 &&
      Math.abs(transferEditorDelta - transferSupportDelta) < 40 &&
      (during.preview?.h ?? 999) <= 80 &&
      (during.preview?.w ?? 999) <= 80,
    `scope=${scopeDelta} editor=${editorDelta} support=${supportDelta} preview=${JSON.stringify(during.preview)}`
  );
  check("9 sidebar stays viewport height and the page does not jump", (during.boxes.sidebar?.h ?? 0) >= 790 && Math.abs(during.scroll - before.scroll) < 80 && during.doc - before.doc < 500);
  check("10 the same editor instance keeps the unsaved title", during.instance === before.instance && during.instance === after.instance && during.title === "Unsaved stair note" && after.title === "Unsaved stair note");
  check("11 the card becomes Ready and the item remains", after.ready && after.item.includes(ITEM_TEXT) && after.boxes.summary != null && after.boxes.support != null);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
