/**
 * Stage 3.1C.2A-R1 — Profile route runtime remediation verification.
 *
 * Catches the Preview defect where AccountMenu linked to /app/profile but the
 * Next.js page route was never committed/deployed.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c2a-r1-profile-route.ts
 */
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  containsUnsafeAuthDiagnostic,
  presentAuthError,
} from "../lib/auth/errors";

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

function main() {
  console.log("=== Stage 3.1C.2A-R1 profile route verification ===");

  const profileRel = "app/(protected)/app/profile/page.tsx";
  const menuRel = "components/layout/account-menu.tsx";
  const companyRel = "app/(protected)/app/settings/company/page.tsx";

  section("DEPLOYMENT / ROUTE EXISTENCE");
  assert("profile page exists on disk", existsSync(join(process.cwd(), profileRel)));
  assert(
    "profile page is git-tracked (would ship to Preview)",
    gitTracked(profileRel)
  );
  assert("AccountMenu is git-tracked", gitTracked(menuRel));
  assert(
    "Company settings page exists",
    existsSync(join(process.cwd(), companyRel))
  );

  const profilePage = read(profileRel);
  const menu = read(menuRel);

  section("ACCOUNT MENU");
  assert(
    "Profile href is canonical /app/profile",
    /router\.push\(["']\/app\/profile["']\)/.test(menu) ||
      /href=["']\/app\/profile["']/.test(menu)
  );
  assert(
    "Company settings href is /app/settings/company",
    /\/app\/settings\/company/.test(menu)
  );
  assert("Logout remains wired", /logout/.test(menu) && /Log out/.test(menu));

  section("PROFILE LOADER STATES");
  assert("authenticated user required (getUser)", /getUser\(/.test(profilePage));
  assert(
    "unauthenticated redirects to login",
    /redirect\(["']\/login["']\)/.test(profilePage)
  );
  assert(
    "profile lookup bound to auth user id",
    /\.eq\(["']id["'],\s*user\.id\)/.test(profilePage)
  );
  assert(
    "organisation derived from profile.org_id",
    /\.eq\(["']id["'],\s*profile\.org_id\)/.test(profilePage)
  );
  assert(
    "missing profile/org routes to setup-required",
    /redirect\(["']\/app\/setup-required["']\)/.test(profilePage) &&
      /!profile\?\.org_id|!profile/.test(profilePage)
  );
  assert(
    "unresolvable organisation routes to setup-required (STATE D)",
    /!organisation/.test(profilePage) &&
      /setup-required/.test(profilePage)
  );
  assert(
    "optional null fields use safe defaults",
    /full_name\?\.trim\(\)\s*\?\?\s*["']["']/.test(profilePage) &&
      /formatRole/.test(profilePage)
  );
  assert(
    "no service-role client on profile page",
    !profilePage.includes("createAdminClient") &&
      !profilePage.includes("@/lib/supabase/admin")
  );
  assert(
    "no client user/org authority from searchParams",
    !/searchParams/.test(profilePage)
  );
  assert(
    "email from auth user",
    /user\.email/.test(profilePage)
  );
  assert(
    "does not expose raw DB errors to UI",
    !/error\.message/.test(profilePage) &&
      !/profileError\.message/.test(profilePage) &&
      !/organisationError\.message/.test(profilePage)
  );

  section("ACTIONS SAFETY");
  const actions = read("lib/auth/profile-actions.ts");
  assert(
    "profile actions no admin client",
    !actions.includes("createAdminClient")
  );
  assert(
    "presentAuthError PROFILE_UPDATE_FAILED is safe",
    !containsUnsafeAuthDiagnostic(presentAuthError("PROFILE_UPDATE_FAILED"))
  );
  assert(
    "presentAuthError PASSWORD_CHANGE_FAILED is safe",
    !containsUnsafeAuthDiagnostic(presentAuthError("PASSWORD_CHANGE_FAILED"))
  );

  section("REGRESSION GUARD");
  assert(
    "2A verify still checks profile route exists",
    /profile route exists/.test(
      read("scripts/verify-stage-3-1c2a-account-profile.ts")
    )
  );

  if (process.exitCode) {
    console.log("\nStage 3.1C.2A-R1 profile route verification FAILED.");
    console.log(
      "If profile page exists locally but is not git-tracked, add and commit it before Preview deploy."
    );
  } else {
    console.log("\nStage 3.1C.2A-R1 profile route verification passed.");
  }
}

main();
