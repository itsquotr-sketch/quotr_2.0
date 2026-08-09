/**
 * Stage 3.1C.2B-R2 — Forgot password / auth route deployment remediation.
 *
 * Catches the Preview defect where Login linked to /forgot-password but the
 * App Router page was never git-tracked (same class as /app/profile in 2A-R1).
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c2b-r2-auth-route-deployment.ts
 */
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

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

function gitTracked(rel: string): boolean {
  try {
    const out = execSync(`git ls-files -- "${rel}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

/**
 * True when the path is in the git index (tracked).
 * Catches: local-only files that `next build` sees but Vercel never receives.
 */
function reportHeadContains(rel: string): boolean {
  try {
    execSync(`git cat-file -e HEAD:"${rel}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

const FORGOT_PAGE = "app/(auth)/forgot-password/page.tsx";
const RESET_PAGE = "app/(auth)/reset-password/page.tsx";
const CALLBACK_ROUTE = "app/auth/callback/route.ts";
const LOGIN_PAGE = "app/(auth)/login/page.tsx";
const RESET_CLIENT = "components/auth/ResetPasswordClient.tsx";
const RECOVERY_ACTIONS = "lib/auth/recovery-actions.ts";
const SAFE_REDIRECT = "lib/auth/safe-redirect.ts";
const PASSWORD_HELPER = "lib/auth/password.ts";
const SITE_URL = "lib/auth/site-url.ts";

function main() {
  console.log("=== Stage 3.1C.2B-R2 auth route deployment verification ===");

  section("LOGIN HREF");
  const login = read(LOGIN_PAGE);
  assert(
    "Login Forgot password href is exactly /forgot-password",
    /href=["']\/forgot-password["']/.test(login) &&
      /Forgot password\?/.test(login)
  );
  assert(
    "Login does not use /auth/forgot-password",
    !/href=["']\/auth\/forgot-password["']/.test(login)
  );
  assert(
    "Login does not use /app/forgot-password",
    !/href=["']\/app\/forgot-password["']/.test(login)
  );
  assert(
    "Login Forgot link is not /reset-password",
    !/Forgot password\?[\s\S]{0,80}href=["']\/reset-password["']/.test(login) &&
      !/href=["']\/reset-password["'][\s\S]{0,80}Forgot password\?/.test(login)
  );

  section("FORGOT-PASSWORD ROUTE");
  assert("forgot-password page exists on disk", existsSync(join(process.cwd(), FORGOT_PAGE)));
  assert("forgot-password page is git-tracked", gitTracked(FORGOT_PAGE));
  const forgot = read(FORGOT_PAGE);
  assert("forgot page title Forgot password", /Forgot password/.test(forgot));
  assert("forgot page Email address label", /Email address/.test(forgot));
  assert("forgot page Send reset link", /Send reset link/.test(forgot));
  assert("forgot page Back to login", /Back to login/.test(forgot));
  assert(
    "forgot page email autocomplete + inputMode",
    /autoComplete=["']email["']/.test(forgot) &&
      /inputMode=["']email["']/.test(forgot)
  );
  assert(
    "forgot page uses requestPasswordReset (no session gate in page)",
    /requestPasswordReset/.test(forgot) && !/getUser\(/.test(forgot)
  );
  assert(
    "forgot page does not require profile/org imports",
    !/provisionOrganisation|createAdminClient|getAuthOrg/.test(forgot)
  );

  section("RESET-PASSWORD ROUTE");
  assert("reset-password page exists on disk", existsSync(join(process.cwd(), RESET_PAGE)));
  assert("reset-password page is git-tracked", gitTracked(RESET_PAGE));
  assert("ResetPasswordClient is git-tracked", gitTracked(RESET_CLIENT));
  const reset = read(RESET_PAGE);
  assert(
    "reset route distinguishes missing recovery session (not a 404)",
    /getUser\(/.test(reset) && /invalid or has expired/.test(reset)
  );

  section("CALLBACK ROUTE");
  assert("callback route exists on disk", existsSync(join(process.cwd(), CALLBACK_ROUTE)));
  assert("callback route is git-tracked", gitTracked(CALLBACK_ROUTE));
  assert(
    "callback uses exchangeCodeForSession",
    /exchangeCodeForSession/.test(read(CALLBACK_ROUTE))
  );

  section("SUPPORTING 3.1C.2B PRODUCTION FILES TRACKED");
  for (const rel of [
    RECOVERY_ACTIONS,
    SAFE_REDIRECT,
    PASSWORD_HELPER,
    SITE_URL,
  ]) {
    assert(`${rel} git-tracked`, gitTracked(rel));
  }

  section("HEAD DEPLOYABILITY REPORT");
  // Hard-fail: untracked local pages would 404 on Vercel. Soft-report: staged
  // but not yet in HEAD still need commit+push before Preview receives them.
  for (const rel of [FORGOT_PAGE, RESET_PAGE, CALLBACK_ROUTE, RESET_CLIENT]) {
    const inHead = reportHeadContains(rel);
    const tracked = gitTracked(rel);
    if (inHead) {
      console.log("PASS", `${rel} present in HEAD`);
    } else if (tracked) {
      console.log(
        "WARN",
        `${rel} git-tracked but not in HEAD — commit+push required before Preview`
      );
    } else {
      assert(`${rel} present in HEAD or at least git-tracked`, false);
    }
  }

  section("NO WRONG ROUTE ALIASES IN SOURCE");
  const middleware = read("middleware.ts");
  assert(
    "middleware treats /forgot-password as public auth route",
    /pathname === ["']\/forgot-password["']/.test(middleware)
  );
  assert(
    "middleware does not require /auth/forgot-password path",
    !/\/auth\/forgot-password/.test(middleware)
  );

  section("BOUNDARIES");
  assert(
    "no migration 033 introduced by this remediation",
    !existsSync(join(process.cwd(), "supabase/migrations/033_auth_route_deployment.sql"))
  );

  if (process.exitCode) {
    console.error(
      "\nIf a route exists locally but is not git-tracked / not in HEAD, " +
        "add and commit it before Preview deploy (Vercel cannot see untracked files)."
    );
  } else {
    console.log("\nStage 3.1C.2B-R2 auth route deployment verification passed.");
  }
}

main();
