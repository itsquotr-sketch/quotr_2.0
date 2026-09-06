/**
 * AUTH STABILITY-01 — Preview session / password mutation guards.
 *
 * Run: npx --yes tsx scripts/verify-auth-stability-01.ts
 *
 * Does not fake browser persistence. Hosted cookie/session proof is
 * `.tmp-auth-stability/hosted-proof.mjs`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PREVIEW_AUTH_SITE_ORIGIN_STABLE } from "../lib/auth/site-url";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";
import {
  assertSafePreviewPasswordMutation,
  isPasswordProtectedPreviewAccount,
  isPlusAddressFixture,
  PREVIEW_PASSWORD_PROTECTED_EMAILS,
  PREVIEW_SUPABASE_PROJECT_REF as FIXTURE_PREVIEW_REF,
  PRODUCTION_SUPABASE_PROJECT_REF as FIXTURE_PRODUCTION_REF,
} from "./lib/preview-auth-fixture";

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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (
      entry === "node_modules" ||
      entry === ".next" ||
      entry === ".tmp" ||
      entry.startsWith(".tmp-")
    ) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function latestMigration(): string | null {
  const dir = join(process.cwd(), "supabase/migrations");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
  return files.at(-1) ?? null;
}

console.log("=== AUTH STABILITY-01 ===\n");

console.log("--- PREVIEW REF / SITE ORIGIN ---\n");
check(
  "Preview Supabase ref locked",
  PREVIEW_SUPABASE_PROJECT_REF === "shhpjsoldmqtkdbgrbtm" &&
    FIXTURE_PREVIEW_REF === "shhpjsoldmqtkdbgrbtm"
);
check(
  "Production Supabase ref is distinct",
  PRODUCTION_SUPABASE_PROJECT_REF === "lxvnylhsbvudzzupxeqr" &&
    FIXTURE_PRODUCTION_REF === "lxvnylhsbvudzzupxeqr" &&
    PREVIEW_SUPABASE_PROJECT_REF !== PRODUCTION_SUPABASE_PROJECT_REF
);
check(
  "stable Preview origin is branch alias, not unique deployment",
  PREVIEW_AUTH_SITE_ORIGIN_STABLE ===
    "https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app" &&
    PREVIEW_AUTH_SITE_ORIGIN_STABLE.includes("-git-hardening-stage-2a-security-") &&
    !/quotr-2-0-[a-z0-9]{8,12}-quotr1\.vercel\.app/i.test(
      PREVIEW_AUTH_SITE_ORIGIN_STABLE
    )
);
check(
  "site-url Preview fallback uses stable alias",
  /PREVIEW_AUTH_SITE_ORIGIN_STABLE/.test(read("lib/auth/site-url.ts")) &&
    /vercelEnv === "preview"/.test(read("lib/auth/site-url.ts"))
);
check(
  "hosted Preview ignores localhost / ephemeral Vercel origins",
  /isLocalhostOrigin/.test(read("lib/auth/site-url.ts")) &&
    /isEphemeralVercelOrigin/.test(read("lib/auth/site-url.ts"))
);

console.log("\n--- NO PRODUCTION AUTH FALLBACK ---\n");
const envSrc = read("lib/env.ts");
check(
  "local boot refuses Production Supabase",
  /assertLocalNotProductionSupabase/.test(envSrc) &&
    envSrc.includes(PRODUCTION_SUPABASE_PROJECT_REF)
);
check(
  "build:safe refuses Production URL",
  /build:safe refused: \.env\.local points at Production/.test(
    read("scripts/next-build-safe.mjs")
  )
);
const clientSrc = read("lib/supabase/client.ts");
const serverSrc = read("lib/supabase/server.ts");
const mwSrc = read("lib/supabase/middleware.ts");
check(
  "browser client has no Production URL fallback",
  /NEXT_PUBLIC_SUPABASE_URL/.test(clientSrc) &&
    !clientSrc.includes(PRODUCTION_SUPABASE_PROJECT_REF) &&
    !/lxvnylhsbvudzzupxeqr/.test(clientSrc)
);
check(
  "server client has no Production URL fallback",
  /NEXT_PUBLIC_SUPABASE_URL/.test(serverSrc) &&
    !serverSrc.includes(PRODUCTION_SUPABASE_PROJECT_REF)
);
check(
  "middleware client has no Production URL fallback",
  /NEXT_PUBLIC_SUPABASE_URL/.test(mwSrc) &&
    !mwSrc.includes(PRODUCTION_SUPABASE_PROJECT_REF)
);

console.log("\n--- SESSION HELPERS ---\n");
check(
  "middleware refreshes session via getUser",
  /supabase\.auth\.getUser\(/.test(mwSrc)
);
check(
  "server and middleware share SSR cookie getAll/setAll",
  /getAll\(\)/.test(serverSrc) &&
    /setAll\(/.test(serverSrc) &&
    /getAll\(\)/.test(mwSrc) &&
    /setAll\(/.test(mwSrc)
);
check(
  "no explicit cookie Domain (host-scoped default)",
  !/domain:\s*["']/.test(clientSrc) &&
    !/domain:\s*["']/.test(serverSrc) &&
    !/domain:\s*["']/.test(mwSrc) &&
    !/cookieOptions/.test(clientSrc + serverSrc + mwSrc)
);
const rootMw = read("middleware.ts");
check(
  "root middleware copies Supabase cookies onto redirects",
  /supabaseResponse\.cookies\.getAll\(\)/.test(rootMw) &&
    /redirectResponse\.cookies\.set/.test(rootMw)
);
check(
  "auth callback exchanges code and preserves Set-Cookie",
  /exchangeCodeForSession/.test(read("app/auth/callback/route.ts")) &&
    /redirectResponse\.cookies\.getAll/.test(read("app/auth/callback/route.ts"))
);

console.log("\n--- PASSWORD RESET SCOPED TO CURRENT USER ---\n");
const recovery = read("lib/auth/recovery-actions.ts");
const resetFnStart = recovery.indexOf(
  "export async function resetPasswordWithRecoverySession"
);
const resetFnEnd = recovery.indexOf(
  "export async function resendSignupConfirmation"
);
const resetFn = recovery.slice(
  resetFnStart,
  resetFnEnd === -1 ? undefined : resetFnEnd
);
check(
  "reset uses authenticated updateUser({ password })",
  /updateUser\(\{\s*password:/.test(resetFn)
);
check(
  "reset requires getUser() session first",
  resetFn.indexOf("getUser()") < resetFn.indexOf("updateUser({") &&
    resetFn.indexOf("getUser()") >= 0
);
check(
  "reset does not take user id or email for the password write",
  !/updateUserById/.test(resetFn) &&
    !/admin\.auth/.test(resetFn) &&
    !/formData\.get\(["']email["']\)/.test(resetFn)
);
check(
  "reset does not change email or org",
  !/updateUser\(\{[^}]*email:/.test(resetFn) &&
    !/organisation_memberships/.test(resetFn)
);
const profileActions = read("lib/auth/profile-actions.ts");
check(
  "settings password change re-auths current user then updateUser",
  /signInWithPassword/.test(profileActions) &&
    /updateUser\(\{\s*password:/.test(profileActions) &&
    !/updateUserById/.test(profileActions)
);

console.log("\n--- BUILD / DEPLOY DO NOT MUTATE AUTH ---\n");
const pkg = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};
const lifecycle = Object.entries(pkg.scripts ?? {});
check(
  "no postinstall / deploy auth mutation scripts",
  !lifecycle.some(
    ([name, cmd]) =>
      /postinstall|preinstall|postbuild|prebuild|deploy/.test(name) ||
      /updateUserById|auth\.users|deleteUser/.test(cmd)
  )
);
const appLibFiles = [
  ...walk(join(process.cwd(), "app")),
  ...walk(join(process.cwd(), "lib")),
  ...walk(join(process.cwd(), "components")),
].filter((file) => /\.(ts|tsx|js|mjs)$/.test(file));
const productAdminPassword = appLibFiles.filter((file) => {
  const rel = relative(process.cwd(), file).replaceAll("\\", "/");
  if (rel.startsWith("lib/auth/") && rel.endsWith("preview-auth-fixture.ts")) {
    return false;
  }
  const text = readFileSync(file, "utf8");
  return /updateUserById/.test(text) || /admin\.deleteUser/.test(text);
});
check(
  "product runtime does not Admin-rotate or delete Auth users",
  productAdminPassword.length === 0,
  productAdminPassword.map((f) => relative(process.cwd(), f)).join(", ")
);

console.log("\n--- FIXTURE GUARD ---\n");
check(
  "jeanluc inbox is protected",
  isPasswordProtectedPreviewAccount("jeanluc@erccontracting.co.nz")
);
check(
  "hello inbox is protected",
  isPasswordProtectedPreviewAccount("hello@erccontracting.co.nz")
);
check(
  "plus-address hello is not the protected inbox",
  !isPasswordProtectedPreviewAccount(
    "hello+auth-stability-01@erccontracting.co.nz"
  ) &&
    isPlusAddressFixture("hello+auth-stability-01@erccontracting.co.nz")
);
let protectedBlocked = false;
try {
  assertSafePreviewPasswordMutation("jeanluc@erccontracting.co.nz");
} catch {
  protectedBlocked = true;
}
check("guard refuses jeanluc password mutation", protectedBlocked);
let domainOwnerBlocked = false;
try {
  assertSafePreviewPasswordMutation("owner@erccontracting.co.nz");
} catch {
  domainOwnerBlocked = true;
}
check(
  "guard refuses non-plus erccontracting addresses",
  domainOwnerBlocked
);
let plusAllowed = true;
try {
  assertSafePreviewPasswordMutation(
    "hello+auth-stability-01@erccontracting.co.nz"
  );
} catch {
  plusAllowed = false;
}
check("guard allows isolated plus-address fixture", plusAllowed);
check(
  "protected list is explicit (not domain-wide)",
  PREVIEW_PASSWORD_PROTECTED_EMAILS.length >= 2
);

const scriptFiles = walk(join(process.cwd(), "scripts")).filter((file) =>
  /\.(ts|tsx|js|mjs)$/.test(file)
);
const dangerousOwnerRotation = scriptFiles.filter((file) => {
  const rel = relative(process.cwd(), file).replaceAll("\\", "/");
  if (rel.includes("preview-auth-fixture")) return false;
  if (rel.includes("verify-auth-stability-01")) return false;
  const text = readFileSync(file, "utf8");
  if (!/updateUserById/.test(text) || !/password/.test(text)) return false;
  return (
    /jeanluc@erccontracting\.co\.nz/.test(text) ||
    /hello@erccontracting\.co\.nz/.test(text)
  );
});
check(
  "committed scripts do not Admin-rotate jeanluc/hello passwords",
  dangerousOwnerRotation.length === 0,
  dangerousOwnerRotation.map((f) => relative(process.cwd(), f)).join(", ")
);

console.log("\n--- MIGRATIONS ---\n");
const latest = latestMigration();
check("latest migration remains 053", latest === "053_role_aware_rls_hardening.sql");
check("no 054 migration file", !existsSync("supabase/migrations/054_auth_stability.sql"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
