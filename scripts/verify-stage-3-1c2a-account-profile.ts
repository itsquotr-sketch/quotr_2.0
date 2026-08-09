/**
 * Stage 3.1C.2A — Account menu, logout, profile & logged-in security verification.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c2a-account-profile.ts
 */
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  AUTH_USER_MESSAGES,
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
  console.log("=== Stage 3.1C.2A account / profile verification ===");

  section("ACCOUNT MENU");
  const menu = read("components/layout/account-menu.tsx");
  assert("AccountMenu component exists", /export function AccountMenu/.test(menu));
  assert("Profile action present", /\/app\/profile/.test(menu) && /Profile/.test(menu));
  assert(
    "Company settings action present",
    /\/app\/settings\/company/.test(menu) && /Company settings/.test(menu)
  );
  assert("Logout action present", /Log out|logout/.test(menu));
  assert(
    "Uses onClick (Base UI compatible), not onSelect for nav",
    /onClick=\{/.test(menu) && !/onSelect=\{/.test(menu)
  );
  assert("aria-label on trigger", /aria-label=["']Open account menu["']/.test(menu));
  assert(
    "menu trigger uses Base UI DropdownMenuTrigger (sets aria-haspopup)",
    /<DropdownMenuTrigger/.test(menu) &&
      /function DropdownMenuTrigger/.test(
        read("components/ui/dropdown-menu.tsx")
      )
  );

  const sidebar = read("components/layout/sidebar-account.tsx");
  assert(
    "SidebarAccount opens AccountMenu (not inert display)",
    sidebar.includes("AccountMenu") && !sidebar.includes("getInitials")
  );

  const userMenuShim = read("components/layout/user-menu.tsx");
  assert(
    "user-menu re-exports AccountMenu for existing imports",
    userMenuShim.includes("account-menu")
  );

  const dashboard = read("app/(protected)/app/dashboard/page.tsx");
  assert(
    "Dashboard still wires account control",
    dashboard.includes("UserMenu") || dashboard.includes("AccountMenu")
  );

  section("LOGOUT");
  const actions = read("app/(auth)/actions.ts");
  assert(
    "logout calls supabase.auth.signOut",
    /auth\.signOut\(/.test(actions)
  );
  assert("logout redirects to /login", /redirect\(["']\/login["']\)/.test(actions));
  assert("logout emits structured log", /event:\s*["']logout["']/.test(actions));
  assert(
    "AccountMenu invokes logout server action",
    menu.includes("logout") && menu.includes("startTransition")
  );

  section("PROFILE");
  const profileRel = "app/(protected)/app/profile/page.tsx";
  assert(
    "profile route exists",
    existsSync(join(process.cwd(), profileRel))
  );
  assert(
    "profile route is git-tracked (Preview deploy guard — 3.1C.2A-R1)",
    gitTracked(profileRel)
  );
  const profilePage = read(profileRel);
  assert("profile requires auth user", /getUser\(/.test(profilePage));
  assert(
    "profile loads full_name/role/org from profiles",
    /full_name/.test(profilePage) && /role/.test(profilePage) && /org_id/.test(profilePage)
  );
  assert(
    "email from auth user, not client trust",
    /user\.email/.test(profilePage)
  );
  assert(
    "missing profile routes to setup-required",
    /setup-required/.test(profilePage)
  );

  const profileActions = read("lib/auth/profile-actions.ts");
  assert(
    "full name update uses auth.uid via getUser + eq id",
    /getUser\(/.test(profileActions) &&
      /\.eq\(["']id["'],\s*user\.id\)/.test(profileActions)
  );
  assert(
    "profile update does not accept client user/org/role",
    !/formData\.get\(["']user_id["']\)/.test(profileActions) &&
      !/formData\.get\(["']org_id["']\)/.test(profileActions) &&
      !/formData\.get\(["']role["']\)/.test(profileActions)
  );
  assert(
    "email is not updated in profile actions",
    !/\.update\(\{[^}]*email/.test(profileActions) &&
      !/updateUser\(\{\s*email/.test(profileActions)
  );

  const profileUi = read("components/profile/ProfilePageContent.tsx");
  assert("full name editable", /name=["']full_name["']/.test(profileUi));
  assert("email read-only", /readOnly/.test(profileUi) && /email/.test(profileUi));
  assert("role/org read-only fields present", /Role/.test(profileUi) && /Organisation/.test(profileUi));
  assert("Company settings link present", /\/app\/settings\/company/.test(profileUi));

  section("PASSWORD");
  assert(
    "changePassword reauthenticates with signInWithPassword",
    /signInWithPassword/.test(profileActions)
  );
  assert(
    "changePassword calls updateUser({ password })",
    /updateUser\(\{\s*password:/.test(profileActions)
  );
  // Ensure structured logs never include password field values.
  // updateUser({ password }) is expected; logAuthEvent payloads must not.
  const logAuthEventBlocks = [
    ...profileActions.matchAll(/logAuthEvent\(\{[\s\S]*?\}\);/g),
  ].map((m) => m[0]);
  assert(
    "password fields never logged",
    logAuthEventBlocks.length > 0 &&
      logAuthEventBlocks.every(
        (block) =>
          !/\bpassword\s*:/.test(block) &&
          !/current_password/.test(block) &&
          !/new_password/.test(block) &&
          !/confirm_password/.test(block)
      ) &&
      !/console\.\w+\([\s\S]*current_password/.test(profileActions)
  );
  assert(
    "safe password failure category",
    presentAuthError("PASSWORD_CHANGE_FAILED") ===
      AUTH_USER_MESSAGES.PASSWORD_CHANGE_FAILED &&
      !containsUnsafeAuthDiagnostic(presentAuthError("PASSWORD_CHANGE_FAILED"))
  );
  assert(
    "min 8 char new password + confirm match validation",
    (/min\(8/.test(profileActions) || /passwordSchema/.test(profileActions)) &&
      /confirm_password/.test(profileActions)
  );

  section("SECURITY / BOUNDARIES");
  assert(
    "profile actions do not import admin client",
    !profileActions.includes("createAdminClient") &&
      !profileActions.includes("@/lib/supabase/admin")
  );
  assert(
    "no password-reset email flow in profile actions",
    !/resetPasswordForEmail/.test(profileActions)
  );
  assert(
    "auth callback exists (3.1C.2B)",
    existsSync(join(process.cwd(), "app/auth/callback/route.ts"))
  );
  assert(
    "no migration 033 for this batch",
    !existsSync(
      join(process.cwd(), "supabase/migrations/033_account_profile.sql")
    )
  );
  assert(
    "SCOPE_DISCOVERY not force-enabled in example",
    !/^SCOPE_DISCOVERY_ENABLED=true/m.test(read(".env.local.example"))
  );

  const boundaryDoc = join(
    process.cwd(),
    "docs/architecture/QUOTR_ACCOUNT_PROFILE_AND_COMPANY_BOUNDARY.md"
  );
  assert("profile/company boundary doc exists", existsSync(boundaryDoc));

  if (!process.exitCode) {
    console.log("\nStage 3.1C.2A account / profile verification passed.");
  } else {
    console.log("\nStage 3.1C.2A account / profile verification FAILED.");
  }
}

main();
