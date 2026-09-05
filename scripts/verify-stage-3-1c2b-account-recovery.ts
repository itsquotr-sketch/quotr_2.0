/**
 * Stage 3.1C.2B — Account recovery / email confirmation / auth routing verification.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c2b-account-recovery.ts
 */
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  AUTH_USER_MESSAGES,
  PASSWORD_RESET_REQUEST_ACK,
  containsUnsafeAuthDiagnostic,
  presentAuthError,
  presentLoginError,
} from "../lib/auth/errors";
import {
  DEFAULT_AUTH_DESTINATION,
  getSafeInternalPath,
} from "../lib/auth/safe-redirect";
import { PASSWORD_MIN_LENGTH } from "../lib/auth/password";

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

/** Fail if a local route exists but is untracked (Preview would 404). */
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

function main() {
  console.log("=== Stage 3.1C.2B account recovery verification ===");

  section("CALLBACK");
  const callbackRel = "app/auth/callback/route.ts";
  assert("callback route exists", existsSync(join(process.cwd(), callbackRel)));
  assert("callback route is git-tracked", gitTracked(callbackRel));
  const callback = read(callbackRel);
  assert(
    "server-side exchangeCodeForSession",
    /exchangeCodeForSession/.test(callback)
  );
  assert(
    "does not log code/token fields",
    !/logAuthEvent\([\s\S]*\bcode\s*:/.test(callback) &&
      !/console\.\w+\([\s\S]*searchParams\.get\(["']code["']\)/.test(callback)
  );
  assert(
    "invalid/missing code safe redirect",
    /CONFIRMATION_LINK_INVALID|confirmation_invalid/.test(callback)
  );
  assert(
    "missing profile → setup-required",
    /setup-required/.test(callback)
  );
  assert(
    "uses getSafeInternalPath for next",
    /getSafeInternalPath/.test(callback)
  );
  assert(
    "no admin/service-role client",
    !callback.includes("createAdminClient") &&
      !callback.includes("SERVICE_ROLE")
  );

  section("REDIRECT SECURITY");
  assert(
    "/app/projects/x accepted",
    getSafeInternalPath("/app/projects/x") === "/app/projects/x"
  );
  assert(
    "/app/dashboard accepted",
    getSafeInternalPath("/app/dashboard") === "/app/dashboard"
  );
  assert(
    "https://evil.com rejected",
    getSafeInternalPath("https://evil.com") === DEFAULT_AUTH_DESTINATION
  );
  assert(
    "//evil.com rejected",
    getSafeInternalPath("//evil.com") === DEFAULT_AUTH_DESTINATION
  );
  assert(
    "javascript: rejected",
    getSafeInternalPath("javascript:alert(1)") === DEFAULT_AUTH_DESTINATION
  );
  assert(
    "data: rejected",
    getSafeInternalPath("/data:text/html,hi") === DEFAULT_AUTH_DESTINATION ||
      getSafeInternalPath("data:text/html,hi") === DEFAULT_AUTH_DESTINATION
  );
  assert(
    "malformed falls back safely",
    getSafeInternalPath("") === DEFAULT_AUTH_DESTINATION &&
      getSafeInternalPath(null) === DEFAULT_AUTH_DESTINATION
  );

  section("SIGNUP CONFIRMATION");
  const actions = read("app/(auth)/actions.ts");
  assert(
    "no-session signup produces confirmation pending",
    /CONFIRMATION_PENDING/.test(actions) && /confirmationPending/.test(actions)
  );
  assert(
    "emailRedirectTo points at auth callback",
    /emailRedirectTo/.test(actions) && /\/auth\/callback/.test(actions)
  );
  assert(
    "does not provision without session",
    /if \(!hasSession\)[\s\S]*?confirmation_pending[\s\S]*?return \{[\s\S]*?confirmationPending:\s*true/.test(
      actions
    ) && /provisionOrganisationForCurrentUser/.test(actions)
  );
  assert(
    "no service-role in signup actions",
    !actions.includes("createAdminClient")
  );
  const signupPage = `${read("app/(auth)/signup/page.tsx")}\n${read("components/auth/SignupForm.tsx")}`;
  assert(
    "confirmation pending dedicated UX",
    /Check your email/.test(signupPage) && /confirmationPending/.test(signupPage)
  );
  assert(
    "resend confirmation supported",
    existsSync(join(process.cwd(), "lib/auth/recovery-actions.ts")) &&
      /resendSignupConfirmation/.test(read("lib/auth/recovery-actions.ts"))
  );

  section("FORGOT PASSWORD");
  const forgotRel = "app/(auth)/forgot-password/page.tsx";
  assert(
    "forgot-password page exists",
    existsSync(join(process.cwd(), forgotRel))
  );
  assert(
    "forgot-password page is git-tracked (Preview deploy guard — 3.1C.2B-R2)",
    gitTracked(forgotRel)
  );
  const recovery = read("lib/auth/recovery-actions.ts");
  assert("uses resetPasswordForEmail", /resetPasswordForEmail/.test(recovery));
  assert(
    "non-enumerating ack copy",
    recovery.includes("PASSWORD_RESET_REQUEST_ACK") ||
      recovery.includes(PASSWORD_RESET_REQUEST_ACK.slice(0, 20))
  );
  assert(
    "PASSWORD_RESET_REQUEST_ACK is non-enumerating",
    PASSWORD_RESET_REQUEST_ACK.toLowerCase().includes("if an account exists")
  );
  const loginPage = read("app/(auth)/login/page.tsx");
  assert("login links Forgot password", /forgot-password/.test(loginPage));
  assert(
    "login Forgot href is /forgot-password",
    /href=["']\/forgot-password["']/.test(loginPage)
  );

  section("RESET PASSWORD");
  const resetRel = "app/(auth)/reset-password/page.tsx";
  assert(
    "reset-password page exists",
    existsSync(join(process.cwd(), resetRel))
  );
  assert(
    "reset-password page is git-tracked (Preview deploy guard — 3.1C.2B-R2)",
    gitTracked(resetRel)
  );
  assert(
    "recovery session required (getUser)",
    /getUser\(/.test(read("app/(auth)/reset-password/page.tsx")) &&
      /RESET_LINK_INVALID|invalid or has expired/.test(
        read("app/(auth)/reset-password/page.tsx")
      )
  );
  assert(
    "updateUser password without current password",
    /updateUser\(\{\s*password:/.test(recovery) &&
      !/current_password/.test(recovery)
  );
  assert(
    "uses shared newPasswordPairSchema",
    /newPasswordPairSchema/.test(recovery)
  );

  section("PASSWORD POLICY");
  const passwordMod = read("lib/auth/password.ts");
  assert(
    `shared min length is ${PASSWORD_MIN_LENGTH}`,
    passwordMod.includes(`PASSWORD_MIN_LENGTH = ${PASSWORD_MIN_LENGTH}`) &&
      actions.includes("passwordSchema")
  );
  assert(
    "profile change uses passwordSchema",
    /passwordSchema/.test(read("lib/auth/profile-actions.ts"))
  );

  section("LOGIN NEXT");
  assert("login reads safe next", /readSafeNext/.test(actions));
  assert(
    "middleware preserves next on protected redirect",
    /searchParams\.set\(\s*["']next["']/.test(read("middleware.ts"))
  );
  assert(
    "invalid credentials still generic",
    presentLoginError("EMAIL_NOT_CONFIRMED") ===
      AUTH_USER_MESSAGES.INVALID_CREDENTIALS &&
      presentLoginError("INVALID_CREDENTIALS") ===
        AUTH_USER_MESSAGES.INVALID_CREDENTIALS
  );

  section("ERRORS / LOGGING");
  for (const cat of [
    "CONFIRMATION_LINK_INVALID",
    "RESET_LINK_INVALID",
    "PASSWORD_RESET_FAILED",
    "RESET_REQUEST_FAILED",
  ] as const) {
    assert(
      `${cat} safe`,
      !containsUnsafeAuthDiagnostic(presentAuthError(cat)) &&
        AUTH_USER_MESSAGES[cat].length > 0
    );
  }
  const logging = read("lib/auth/logging.ts");
  assert(
    "callback/reset log events present",
    /confirmation_callback_started/.test(logging) &&
      /password_reset_requested/.test(logging) &&
      /password_reset_completed/.test(logging)
  );
  assert(
    "forbidden log keys include code/token",
    /"code"/.test(logging) && /access_token/.test(logging)
  );

  section("MOBILE / UX");
  assert(
    "auth inputs use h-11 tap targets",
    /className=["']h-11["']/.test(loginPage) &&
      /className=["']h-11["']/.test(signupPage)
  );
  assert(
    "email inputMode on login/signup/forgot",
    /inputMode=["']email["']/.test(loginPage) &&
      /inputMode=["']email["']/.test(signupPage) &&
      /inputMode=["']email["']/.test(
        read("app/(auth)/forgot-password/page.tsx")
      )
  );
  assert(
    "auth layout uses safe-area / compact top",
    /safe-area-inset-bottom/.test(read("app/(auth)/layout.tsx")) &&
      /pt-6/.test(read("app/(auth)/layout.tsx"))
  );

  section("BOUNDARIES");
  assert(
    "no migration 033 for recovery",
    !existsSync(
      join(process.cwd(), "supabase/migrations/033_account_recovery.sql")
    )
  );
  assert(
    "SCOPE_DISCOVERY not force-enabled",
    !/^SCOPE_DISCOVERY_ENABLED=true\s*$/m.test(read(".env.local.example"))
  );
  assert(
    "email change not implemented (deferred)",
    !/updateUser\(\{\s*email/.test(read("lib/auth/profile-actions.ts"))
  );
  assert(
    "architecture doc exists",
    existsSync(
      join(
        process.cwd(),
        "docs/architecture/QUOTR_AUTH_CALLBACK_AND_RECOVERY_ARCHITECTURE.md"
      )
    )
  );

  if (process.exitCode) {
    console.log("\nStage 3.1C.2B account recovery verification FAILED.");
  } else {
    console.log("\nStage 3.1C.2B account recovery verification passed.");
  }
}

main();
