/**
 * Stage 3.1C.2A-R2 — Account menu trigger interaction verification.
 *
 * Catches the Preview defect where AccountMenu triggers appeared dead because
 * DropdownMenuLabel (Base UI GroupLabel) was rendered outside DropdownMenuGroup,
 * throwing on open: "MenuGroupContext is missing".
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c2a-r2-account-menu-trigger.ts
 *
 * NOTE: Static checks cannot prove browser click behaviour — mark Preview owner
 * interaction tests as required.
 */
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

function main() {
  console.log("=== Stage 3.1C.2A-R2 account menu trigger verification ===");
  console.log(
    "NOTE: Click/open behaviour requires Preview owner test; this script is static only.\n"
  );

  const menuRel = "components/layout/account-menu.tsx";
  const sidebarRel = "components/layout/sidebar-account.tsx";
  const userMenuRel = "components/layout/user-menu.tsx";
  const dropdownRel = "components/ui/dropdown-menu.tsx";

  assert("AccountMenu file exists", existsSync(join(process.cwd(), menuRel)));
  const menu = read(menuRel);
  const sidebar = read(sidebarRel);
  const userMenu = read(userMenuRel);
  const dropdown = read(dropdownRel);

  section("SHARED ACCOUNTMENU");
  assert("exports AccountMenu", /export function AccountMenu/.test(menu));
  assert(
    "header/sidebar/panel variants",
    /"header"/.test(menu) && /"sidebar"/.test(menu) && /"panel"/.test(menu)
  );
  assert(
    "user-menu re-exports shared AccountMenu",
    userMenu.includes("account-menu") && userMenu.includes("AccountMenu")
  );
  assert(
    "sidebar uses AccountMenu (not static stub)",
    sidebar.includes("AccountMenu") && !/getInitials/.test(sidebar)
  );

  section("TRIGGER PRIMITIVE");
  assert(
    "uses DropdownMenuTrigger",
    /<DropdownMenuTrigger[\s\S]*?>/.test(menu)
  );
  assert(
    "trigger is type=button",
    /<DropdownMenuTrigger[\s\S]*?type=["']button["']/.test(menu)
  );
  assert(
    "trigger has accessible name",
    /aria-label=["']Open account menu["']/.test(menu)
  );
  assert(
    "trigger has cursor-pointer affordance",
    /cursor-pointer/.test(menu)
  );
  assert(
    "header tap target sized",
    /size-9|min-h-9|h-9/.test(menu)
  );
  assert(
    "sidebar/panel full-row hit target",
    /min-h-11/.test(menu) && /w-full/.test(menu)
  );
  assert(
    "no legacy onSelect on trigger/items (Base UI uses onClick)",
    !/onSelect=\{/.test(menu)
  );
  assert(
    "items use onClick",
    /onClick=\{\(\) => router\.push/.test(menu) && /onClick=\{handleLogout\}/.test(menu)
  );

  section("BASE UI GROUPLABEL FIX (R2 ROOT CAUSE)");
  assert(
    "dropdown primitive exports DropdownMenuGroup + Label",
    /function DropdownMenuGroup/.test(dropdown) &&
      /function DropdownMenuLabel/.test(dropdown) &&
      /GroupLabel/.test(dropdown)
  );
  assert(
    "DropdownMenuLabel is wrapped in DropdownMenuGroup",
    /<DropdownMenuGroup>[\s\S]*<DropdownMenuLabel[\s\S]*<\/DropdownMenuLabel>[\s\S]*<\/DropdownMenuGroup>/.test(
      menu
    )
  );
  assert(
    "no bare DropdownMenuLabel outside Group",
    (() => {
      // Strip Group-wrapped labels, then ensure no leftover Label
      const withoutGroups = menu.replace(
        /<DropdownMenuGroup>[\s\S]*?<\/DropdownMenuGroup>/g,
        ""
      );
      return !/<DropdownMenuLabel/.test(withoutGroups);
    })()
  );

  section("ACTIONS");
  assert("Profile → /app/profile", /\/app\/profile/.test(menu));
  assert(
    "Company settings → /app/settings/company",
    /\/app\/settings\/company/.test(menu)
  );
  assert(
    "logout server action wired",
    /from ["']@\/app\/\(auth\)\/actions["']/.test(menu) &&
      /logout/.test(menu) &&
      /Log out/.test(menu)
  );

  section("CONSUMERS");
  const dashboard = read("app/(protected)/app/dashboard/page.tsx");
  assert(
    "dashboard header wires UserMenu/AccountMenu",
    dashboard.includes("UserMenu") || dashboard.includes("AccountMenu")
  );
  const appSidebar = read("components/app-sidebar.tsx");
  assert(
    "desktop sidebar wires SidebarAccount",
    appSidebar.includes("SidebarAccount")
  );
  const mobileSheet = read("components/layout/mobile-menu-sheet.tsx");
  assert(
    "mobile sheet includes SidebarAccount",
    mobileSheet.includes("SidebarAccount")
  );

  section("NAME REFRESH PATH");
  const profileActions = read("lib/auth/profile-actions.ts");
  assert(
    "profile update revalidates app layout (menu identity)",
    /revalidatePath\(\s*["']\/app["']\s*,\s*["']layout["']\s*\)/.test(
      profileActions
    )
  );

  if (process.exitCode) {
    console.log("\nStage 3.1C.2A-R2 account menu trigger verification FAILED.");
  } else {
    console.log("\nStage 3.1C.2A-R2 account menu trigger verification passed.");
    console.log(
      "Preview owner must still confirm header/sidebar/mobile clicks open the menu."
    );
  }
}

main();
