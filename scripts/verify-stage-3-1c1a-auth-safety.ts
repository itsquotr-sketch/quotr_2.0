/**
 * Stage 3.1C.1A — Auth safety, configuration & diagnostics verification.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c1a-auth-safety.ts
 *
 * Does not print secret values. Does not call live Supabase.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  evaluateSignupServerConfiguration,
} from "../lib/auth/config";
import {
  AUTH_USER_MESSAGES,
  classifyAuthProviderError,
  containsUnsafeAuthDiagnostic,
  presentAuthError,
  presentLoginError,
  type AuthErrorCategory,
} from "../lib/auth/errors";
import { logAuthEvent } from "../lib/auth/logging";

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

function assertSafeUi(label: string, message: string) {
  assert(`${label}: non-empty`, message.trim().length > 0);
  assert(
    `${label}: no unsafe diagnostic`,
    !containsUnsafeAuthDiagnostic(message)
  );
  assert(
    `${label}: no SUPABASE_SERVICE_ROLE_KEY`,
    !message.includes("SUPABASE_SERVICE_ROLE_KEY")
  );
}

function testErrorTaxonomy() {
  section("ERROR TAXONOMY");

  const categories: AuthErrorCategory[] = [
    "CONFIGURATION",
    "INVALID_CREDENTIALS",
    "EMAIL_NOT_CONFIRMED",
    "RATE_LIMITED",
    "EMAIL_ALREADY_REGISTERED",
    "SIGNUP_FAILED",
    "ORG_PROVISION_FAILED",
    "PROFILE_PROVISION_FAILED",
    "UNKNOWN",
  ];

  for (const category of categories) {
    assertSafeUi(`presentAuthError(${category})`, presentAuthError(category));
    assert(
      `AUTH_USER_MESSAGES has ${category}`,
      Boolean(AUTH_USER_MESSAGES[category])
    );
  }

  assert(
    "CONFIGURATION message does not name env vars",
    !presentAuthError("CONFIGURATION").includes("SUPABASE") &&
      !presentAuthError("CONFIGURATION").includes("SERVICE_ROLE")
  );
}

function testConfigFailure() {
  section("CONFIG FAILURE (SERVICE ROLE UNAVAILABLE)");

  const missingKey = evaluateSignupServerConfiguration({
    supabaseUrl: "https://example.supabase.co",
    serviceRoleKey: "",
  });
  assert("missing service role → not ok", !missingKey.ok);
  if (!missingKey.ok) {
    assert("category is CONFIGURATION", missingKey.category === "CONFIGURATION");
    assert(
      "diagnostic names SUPABASE_SERVICE_ROLE_KEY (internal only)",
      missingKey.diagnostic.includes("SUPABASE_SERVICE_ROLE_KEY")
    );
    assert(
      "diagnostic does not include secret values",
      !missingKey.diagnostic.includes("eyJ") &&
        !/serviceRoleKey\s*[:=]\s*\S+/i.test(missingKey.diagnostic)
    );
    assertSafeUi(
      "UI for CONFIGURATION",
      presentAuthError(missingKey.category)
    );
  }

  const missingUrl = evaluateSignupServerConfiguration({
    supabaseUrl: null,
    serviceRoleKey: "not-a-real-secret-for-test",
  });
  assert("missing url → not ok", !missingUrl.ok);
  if (!missingUrl.ok) {
    assert(
      "missing url lists NEXT_PUBLIC_SUPABASE_URL",
      missingUrl.missing.includes("NEXT_PUBLIC_SUPABASE_URL")
    );
  }

  const ok = evaluateSignupServerConfiguration({
    supabaseUrl: "https://example.supabase.co",
    serviceRoleKey: "not-a-real-secret-for-test",
  });
  assert("both present → ok", ok.ok);

  const actions = read("app/(auth)/actions.ts");
  assert(
    "signup calls assertSignupServerConfiguration before admin provision",
    /assertSignupServerConfiguration\(\)/.test(actions) &&
      actions.indexOf("assertSignupServerConfiguration") <
        actions.indexOf("createAdminClient()")
  );
  assert(
    "signup does not retain old SERVICE_ROLE UI string",
    !actions.includes("Ensure SUPABASE_SERVICE_ROLE_KEY is set")
  );
}

function testRawErrorLeakage() {
  section("RAW ERROR LEAKAGE");

  const orgDb =
    'duplicate key value violates unique constraint "organisations_pkey"';
  const profileDb =
    'insert or update on table "profiles" violates foreign key constraint "profiles_org_id_fkey"';
  const provider =
    "Database error finding user via email: permission denied for table users";

  assert(
    "org DB error is unsafe if shown raw",
    containsUnsafeAuthDiagnostic(orgDb)
  );
  assert(
    "profile DB error is unsafe if shown raw",
    containsUnsafeAuthDiagnostic(profileDb)
  );
  assert(
    "provider DB-like error is unsafe if shown raw",
    containsUnsafeAuthDiagnostic(provider)
  );

  assertSafeUi(
    "org failure UI",
    presentAuthError("ORG_PROVISION_FAILED")
  );
  assertSafeUi(
    "profile failure UI",
    presentAuthError("PROFILE_PROVISION_FAILED")
  );
  assertSafeUi(
    "signup provider failure UI",
    presentAuthError(classifyAuthProviderError(provider, "signup"))
  );

  const actions = read("app/(auth)/actions.ts");
  assert(
    "signup does not return org/profile provider .message to UI",
    !/return\s*\{\s*error:\s*orgError/.test(actions) &&
      !/return\s*\{\s*error:\s*profileError/.test(actions) &&
      !/error:\s*orgError\?\.message/.test(actions) &&
      !/error:\s*profileError\.message/.test(actions)
  );
  assert(
    "login does not return error.message directly",
    !/return \{\s*error:\s*error\.message\s*\}/.test(actions)
  );
  assert(
    "authError.message not returned directly",
    !/return \{\s*error:\s*authError\.message\s*\}/.test(actions)
  );
}

function testLoginNormalization() {
  section("LOGIN NORMALIZATION");

  const invalid = classifyAuthProviderError(
    "Invalid login credentials",
    "login"
  );
  assert("invalid credentials category", invalid === "INVALID_CREDENTIALS");
  assertSafeUi("invalid login UI", presentLoginError(invalid));

  const unconfirmed = classifyAuthProviderError("Email not confirmed", "login");
  assert(
    "email-not-confirmed classified internally",
    unconfirmed === "EMAIL_NOT_CONFIRMED"
  );
  const loginUi = presentLoginError(unconfirmed);
  assert(
    "login UI does not distinguish unconfirmed (enumeration-safe)",
    loginUi === AUTH_USER_MESSAGES.INVALID_CREDENTIALS
  );
  assert(
    "login UI is not raw GoTrue string",
    loginUi !== "Email not confirmed"
  );

  const rate = classifyAuthProviderError(
    "Request rate limit reached",
    "login"
  );
  assert("rate limited category", rate === "RATE_LIMITED");
  assertSafeUi("rate limited login UI", presentLoginError(rate));
}

function testObservability() {
  section("OBSERVABILITY");

  const events = [
    "signup_started",
    "auth_user_created",
    "organisation_provisioned",
    "profile_linked",
    "signup_completed",
    "signup_failed",
    "login_failed",
  ] as const;

  const loggingSrc = read("lib/auth/logging.ts");
  for (const event of events) {
    assert(`logging supports ${event}`, loggingSrc.includes(`"${event}"`));
  }

  assert(
    "logging forbids password field",
    loggingSrc.includes('"password"')
  );
  assert(
    "logging forbids tokens / service role",
    loggingSrc.includes("access_token") &&
      loggingSrc.includes("SUPABASE_SERVICE_ROLE_KEY")
  );

  // Must not throw into auth flow even if console is broken.
  const originalError = console.error;
  const originalInfo = console.info;
  let threw = false;
  try {
    console.error = () => {
      throw new Error("console broken");
    };
    console.info = () => {
      throw new Error("console broken");
    };
    logAuthEvent({ event: "signup_started", correlationId: "test" });
    logAuthEvent({
      event: "signup_failed",
      category: "CONFIGURATION",
      correlationId: "test",
    });
  } catch {
    threw = true;
  } finally {
    console.error = originalError;
    console.info = originalInfo;
  }
  assert("logAuthEvent never throws into caller", !threw);

  const actions = read("app/(auth)/actions.ts");
  for (const event of [
    "signup_started",
    "auth_user_created",
    "organisation_provisioned",
    "profile_linked",
    "signup_completed",
    "signup_failed",
  ] as const) {
    assert(`actions emit ${event}`, actions.includes(`"${event}"`));
  }
  assert('actions emit login_failed', actions.includes('"login_failed"'));
}

function testSecurityBoundary() {
  section("SECURITY BOUNDARY / STAGE 2A");

  const admin = read("lib/supabase/admin.ts");
  assert('admin.ts imports "server-only"', /import\s+["']server-only["']/.test(admin));
  assert(
    "admin uses SUPABASE_SERVICE_ROLE_KEY not NEXT_PUBLIC",
    /SUPABASE_SERVICE_ROLE_KEY/.test(admin) &&
      !/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/.test(admin)
  );

  const envSrc = read("lib/env.ts");
  assert(
    "env forbids NEXT_PUBLIC service-role aliases",
    envSrc.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
  );
  assert(
    "service-role remains optional at boot (Preview build)",
    /SUPABASE_SERVICE_ROLE_KEY[\s\S]*?required:\s*false/.test(envSrc)
  );

  const example = read(".env.local.example");
  assert(
    ".env.local.example documents service-role runtime need",
    /SUPABASE_SERVICE_ROLE_KEY/.test(example) &&
      /runtime/i.test(example)
  );
  assert(
    "no NEXT_PUBLIC service-role in example",
    !/NEXT_PUBLIC_.*SERVICE_ROLE/.test(example)
  );

  const authOrg = read("lib/security/auth-org-context.ts");
  assert(
    "auth-org still derives org from profile (no client org_id)",
    /Never accepts a client-supplied organisation ID/.test(authOrg) ||
      /never from a\s*\n?\s*client-supplied organisation ID/i.test(authOrg)
  );

  // Client pages must not import admin.
  for (const page of [
    "app/(auth)/signup/page.tsx",
    "app/(auth)/login/page.tsx",
  ]) {
    const src = read(page);
    assert(
      `${page} does not import admin client`,
      !src.includes("createAdminClient") &&
        !src.includes("@/lib/supabase/admin")
    );
    assert(`${page} error region has role=alert`, /role=["']alert["']/.test(src));
  }

  const actions = read("app/(auth)/actions.ts");
  assert(
    "profile insert uses auth user id (server), not client-supplied id field alone",
    /id:\s*userId|id:\s*authData\.user\.id/.test(actions)
  );
}

function testBoundaries() {
  section("BATCH BOUNDARIES");

  assert(
    "no migration 032",
    !existsSync(join(process.cwd(), "supabase/migrations/032_transactional_signup.sql")) &&
      !existsSync(
        join(
          process.cwd(),
          "supabase/migrations/032_provision_organisation_for_new_user.sql"
        )
      )
  );

  const actions = read("app/(auth)/actions.ts");
  assert(
    "no password reset implementation in auth actions",
    !/resetPasswordForEmail|recoverSession/.test(actions)
  );
  assert(
    "no auth callback route",
    !existsSync(join(process.cwd(), "app/auth/callback/route.ts")) &&
      !existsSync(join(process.cwd(), "app/(auth)/callback/route.ts"))
  );

  // Architecture still non-transactional in this batch (documented).
  assert(
    "signup still uses sequential org then profile (1A does not replace architecture)",
    /\.from\(["']organisations["']\)/.test(actions) &&
      /\.from\(["']profiles["']\)/.test(actions)
  );

  assert(
    "transactional design doc exists",
    existsSync(
      join(
        process.cwd(),
        "docs/architecture/STAGE_3_1C_TRANSACTIONAL_SIGNUP_PROVISIONING_DESIGN.md"
      )
    )
  );
}

function main() {
  console.log("=== Stage 3.1C.1A auth safety verification ===");

  testErrorTaxonomy();
  testConfigFailure();
  testRawErrorLeakage();
  testLoginNormalization();
  testObservability();
  testSecurityBoundary();
  testBoundaries();

  if (!process.exitCode) {
    console.log("\nStage 3.1C.1A auth safety verification passed.");
  } else {
    console.log("\nStage 3.1C.1A auth safety verification FAILED.");
  }
}

main();
