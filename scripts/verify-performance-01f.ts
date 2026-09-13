/**
 * PERFORMANCE-01F — Billing + Profile page-latency verifier.
 *
 * Run: npx --yes tsx scripts/verify-performance-01f.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname ?? __dirname, "..");

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

function read(relativePath: string): string {
  const path = join(root, relativePath);
  if (!existsSync(path)) {
    check(`${relativePath} exists`, false, path);
    return "";
  }
  return readFileSync(path, "utf8");
}

console.log("verify-performance-01f: starting…\n");

const billingPage = read("app/(protected)/app/settings/billing/page.tsx");
const profilePage = read("app/(protected)/app/profile/page.tsx");
const billingView = read("lib/billing/billing-page-view.ts");
const billingActions = read("lib/billing/billing-actions.ts");
const billingServer = read("lib/billing/server.ts");
const displaySrc = read("lib/security/auth-display.ts");
const authOrg = read("lib/security/auth-org-context.ts");
const profileActions = read("lib/auth/profile-actions.ts");
const layout = read("app/(protected)/app/layout.tsx");
const shell = read("components/layout/app-shell.tsx");
const dashboardPage = read("app/(protected)/app/dashboard/page.tsx");
const ratesPage = read("app/(protected)/app/rates/page.tsx");
const companyPage = read("app/(protected)/app/settings/company/page.tsx");
const billingContent = read("components/billing/BillingPageContent.tsx");

console.log("-- A. Billing does not duplicate request-scoped billing reads --");
check(
  "Billing page uses getOrgBillingState (same helper as layout)",
  billingPage.includes("getOrgBillingState(auth.orgId)") &&
    layout.includes("getOrgBillingState(auth.orgId)")
);
check(
  "Billing page does not start a second getUser/profile waterfall",
  !billingPage.includes("createClient") &&
    !billingPage.includes("auth.getUser") &&
    !billingPage.includes('from("profiles")')
);
check(
  "billing helper remains request-scoped React.cache, not cross-request",
  billingServer.includes('import { cache } from "react"') &&
    billingServer.includes("cache(getOrgBillingStateUncached)") &&
    !billingServer.includes("unstable_cache")
);

console.log("\n-- B. Billing render does not perform action-only Stripe calls --");
check(
  "Billing page / view do not import Stripe",
  !billingPage.includes("@/lib/billing/stripe") &&
    !billingPage.includes("getStripeClient") &&
    !billingPage.includes("ensureOrgStripeCustomer") &&
    !billingPage.includes("startCustomerPortal") &&
    !billingView.includes("getStripeClient") &&
    !billingView.includes("stripe.")
);
check(
  "Stripe portal/checkout live on server actions, not page render",
  billingActions.includes("export async function startCustomerPortal") &&
    billingActions.includes("export async function startCheckout") &&
    billingActions.includes("getStripeClient()") &&
    billingContent.includes("startCustomerPortal") &&
    billingContent.includes("startCheckout")
);
check(
  "initial Billing view is built from local OrgBillingState",
  billingPage.includes("buildBillingPageView(state)") &&
    billingView.includes("state.subscription") &&
    billingView.includes("state.customer?.stripeCustomerId")
);

console.log("\n-- C. Profile does not duplicate profile/auth/org reads --");
check(
  "Profile reuses requireAuthOrgContext + getAuthDisplayProfile",
  profilePage.includes("requireAuthOrgContext") &&
    profilePage.includes("getAuthDisplayProfile()") &&
    !profilePage.includes("createClient") &&
    !profilePage.includes("auth.getUser")
);
check(
  "display profile still binds to signed-in user and cached org name",
  displaySrc.includes('.select("full_name, role")') &&
    displaySrc.includes('.eq("id", auth.user.id)') &&
    displaySrc.includes("loadOrganisationName(auth.orgId)") &&
    displaySrc.includes("cache(")
);
check(
  "Profile page has no second organisations SELECT",
  !profilePage.includes('from("organisations")') &&
    !profilePage.includes('from("profiles")')
);

console.log("\n-- D. independent render reads run concurrently --");
check(
  "layout chrome still parallel after auth",
  layout.includes("await Promise.all([") &&
    layout.includes("getAuthDisplayProfile()") &&
    layout.includes("getOrgBillingState(auth.orgId)")
);
check(
  "display profile loads name/settings/profile together",
  displaySrc.includes("await Promise.all([") &&
    displaySrc.includes("loadOrganisationName") &&
    displaySrc.includes("loadOrganisationSettingsRow")
);
check(
  "Billing page parallelises searchParams with cached billing state",
  billingPage.includes("await Promise.all([") &&
    billingPage.includes("searchParams") &&
    billingPage.includes("getOrgBillingState")
);

console.log("\n-- E. Billing mutations/actions remain fresh --");
check(
  "checkout/portal/upgrade still resolve auth + billing on the action",
  billingActions.includes("async function requireOrgContext") &&
    billingActions.includes("getAuthOrgContext()") &&
    /export async function startCheckout[\s\S]*requireOrgContext/.test(
      billingActions
    ) &&
    /export async function startCustomerPortal[\s\S]*getOrgBillingState/.test(
      billingActions
    ) &&
    /permission:\s*"billing.manage"/.test(billingActions)
);
check(
  "getBillingPageState is a server action, not the page loader",
  billingActions.includes("export async function getBillingPageState") &&
    !billingPage.includes("getBillingPageState") &&
    billingContent.includes("getBillingPageState")
);

console.log("\n-- F. Profile mutations remain fresh --");
check(
  "profile save still getUser + eq auth.uid, not cached display",
  profileActions.includes("supabase.auth.getUser()") &&
    profileActions.includes('.eq("id", user.id)') &&
    !profileActions.includes("getAuthDisplayProfile")
);
check(
  "password change still reauthenticates",
  profileActions.includes("signInWithPassword") &&
    profileActions.includes("updateUser({")
);

console.log("\n-- G. tenant isolation unchanged --");
check(
  "org still derived from signed-in profile, never client org id",
  authOrg.includes("Organisation is always derived from the signed-in profile") &&
    authOrg.includes('.from("profiles")') &&
    authOrg.includes('.select("org_id")')
);
check(
  "Billing page does not accept a client organisation id",
  !billingPage.includes("params.org") &&
    !billingPage.includes("org_id") &&
    billingPage.includes("auth.orgId")
);

console.log("\n-- H. existing fast pages retain their query graph --");
check(
  "Dashboard still does not re-fetch session profile",
  dashboardPage.includes("loadDashboardPageData") &&
    !dashboardPage.includes("auth.getUser")
);
check(
  "Rates/Company still do not re-read getUser",
  !ratesPage.includes("auth.getUser") &&
    !companyPage.includes("auth.getUser") &&
    companyPage.includes("await Promise.all([")
);
check(
  "layout still loads billing once for chrome",
  layout.includes("getOrgBillingState(auth.orgId).catch(() => null)")
);
check(
  "Billing/Profile have route loading states",
  existsSync(join(root, "app/(protected)/app/settings/billing/loading.tsx")) &&
    existsSync(join(root, "app/(protected)/app/profile/loading.tsx")) &&
    read("app/(protected)/app/settings/billing/loading.tsx").includes(
      "SettingsRouteLoading"
    )
);
check(
  "Account routes are prefetched from the shell",
  shell.includes('href="/app/profile"') &&
    shell.includes('href="/app/settings/billing"') &&
    shell.includes("prefetch")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log(`\nOK  ${passed} checks`);
