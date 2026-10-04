/**
 * Authentication presentation and Quotr loading system.
 *
 * Run: npx --yes tsx scripts/verify-auth-loading-ui.ts
 *
 * Source checks only. Does not contact Production or move aliases.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POST_SIGNUP_DESTINATION } from "../lib/auth/post-auth-navigation";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const login = read("app/(auth)/login/page.tsx");
const shell = read("components/auth/AuthShell.tsx");
const layout = read("app/(auth)/layout.tsx");
const loader = read("components/brand/QuotrLoader.tsx");
const mark = read("components/brand/QuotrMark.tsx");
const continueUi = read("components/auth/AuthContinue.tsx");
const submit = read("components/auth/AuthSubmitButton.tsx");
const password = read("components/auth/PasswordField.tsx");
const signup = read("components/auth/SignupForm.tsx");
const forgot = read("app/(auth)/forgot-password/page.tsx");
const reset = read("app/(auth)/reset-password/page.tsx");
const resetClient = read("components/auth/ResetPasswordClient.tsx");
const invite = read("components/invite/InviteAcceptContent.tsx");
const inviteContinue = read("components/invite/InviteContinueContent.tsx");
const protectedLayout = read("app/(protected)/app/layout.tsx");
const setupRequired = read("app/(protected)/app/setup-required/page.tsx");
const actions = read("app/(auth)/actions.ts");
const css = read("app/globals.css");
const routeLoading = read("components/layout/route-loading.tsx");
const dashboardLoading = read("app/(protected)/app/dashboard/loading.tsx");

console.log("=== Auth loading UI ===\n");

assert("auth layout uses the shared shell", layout.includes("AuthShell"));
assert(
  "shell sets product ground, wordmark, width, and safe area",
  shell.includes("data-auth-shell") &&
    shell.includes('variant="wordmark"') &&
    shell.includes("QUOTR_PRODUCT_LINE") &&
    shell.includes("max-w-sm") &&
    shell.includes("bg-background") &&
    shell.includes("safe-area-inset-bottom") &&
    shell.includes("pt-6") &&
    shell.includes("min-h-dvh") &&
    !shell.includes("MobileNav")
);

assert(
  "loader exposes fullscreen and compact variants",
  loader.includes('variant === "compact"') &&
    loader.includes('data-quotr-loader="fullscreen"') &&
    loader.includes('data-quotr-loader="compact"') &&
    loader.includes("min-h-dvh")
);
assert(
  "loader status is polite and the mark is decorative",
  loader.includes('role="status"') &&
    loader.includes('aria-live="polite"') &&
    mark.includes('aria-hidden="true"') &&
    mark.includes("<path") &&
    mark.includes("<line") &&
    !mark.includes("<img") &&
    !loader.includes("Loader2") &&
    !loader.includes("animate-spin") &&
    !loader.includes("lottie")
);
assert(
  "reduced motion holds the completed mark",
  /prefers-reduced-motion:\s*reduce/.test(css) &&
    css.includes(".quotr-mark-ring") &&
    css.includes("animation: none !important") &&
    css.includes("stroke-dashoffset: 0 !important")
);
assert(
  "mark animation settles without a spinner loop",
  css.includes("quotr-ring-draw") &&
    css.includes("quotr-slash-enter") &&
    css.includes("quotr-slash-breathe") &&
    !css.includes("quotr-spin")
);

assert(
  "login submits with the compact loader",
  login.includes("AuthSubmitButton") &&
    login.includes('pendingLabel="Signing in…"') &&
    login.includes('idle="Sign in"') &&
    submit.includes('variant="compact"') &&
    submit.includes("disabled={pending}")
);
assert(
  "successful sign-in uses the fullscreen workspace transition",
  login.includes("AuthContinue") &&
    login.includes('label="Opening your workspace…"') &&
    continueUi.includes('variant="fullscreen"') &&
    continueUi.includes("window.location.assign") &&
    !continueUi.includes("setTimeout") &&
    !continueUi.includes("setInterval") &&
    !loader.includes("setTimeout")
);
assert(
  "login no longer shows the generic post-sign-in box",
  !login.includes("Signed in") &&
    !login.includes("Continuing to Quotr") &&
    !login.includes("Opening Quotr") &&
    !continueUi.includes("Opening Quotr") &&
    !continueUi.includes("rounded-lg border")
);
assert(
  "login keeps labels, autocomplete, forgot password, and create account",
  login.includes('autoComplete="email"') &&
    login.includes('autoComplete="current-password"') &&
    login.includes(">Email<") &&
    login.includes(">Password<") &&
    /Forgot password\?/.test(login) &&
    /href=["']\/forgot-password["']/.test(login) &&
    login.includes("Create account") &&
    password.includes('aria-label={visible ? "Hide password" : "Show password"}') &&
    password.includes("min-h-11")
);

const autofillLines = css
  .split("\n")
  .filter((line) => /autofill/i.test(line) && !line.trim().startsWith("/*"));
assert(
  "autofill styling stays on the auth shell",
  autofillLines.length > 0 &&
    autofillLines.every((line) => line.includes("[data-auth-shell]"))
);

assert(
  "signup, recovery, and invitation pages use the shared card",
  signup.includes("AuthCard") &&
    forgot.includes("AuthCard") &&
    reset.includes("AuthCard") &&
    resetClient.includes("AuthCard") &&
    invite.includes("AuthCard") &&
    inviteContinue.includes("AuthCard") &&
    setupRequired.includes("AuthCard")
);
assert(
  "account preparation uses the branded transition",
  signup.includes('label="Preparing your account…"') &&
    setupRequired.includes('label="Preparing your account…"')
);
assert(
  "protected session restoration uses the fullscreen loader",
  protectedLayout.includes("<Suspense") &&
    protectedLayout.includes('status="Loading Quotr…"') &&
    protectedLayout.includes("QuotrLoader")
);
assert(
  "route skeletons remain for dashboard content",
  dashboardLoading.includes("DashboardRouteLoading") &&
    routeLoading.includes("Skeleton") &&
    !dashboardLoading.includes("QuotrLoader")
);

assert(
  "sign-in redirect authority is unchanged",
  /return \{\s*continueTo:\s*next\s*\}/.test(actions) &&
    POST_SIGNUP_DESTINATION === "/app/setup?mode=basics" &&
    actions.includes("signInWithPassword") &&
    !actions.includes("setTimeout")
);
assert(
  "invite acceptance still navigates through AuthContinue",
  invite.includes("AuthContinue") &&
    invite.includes('label={label}') &&
    invite.includes("acceptInvitation") &&
    inviteContinue.includes("acceptPendingInvitationForCurrentUser")
);

if (process.exitCode) {
  console.error("\nAuth loading UI verification failed.");
} else {
  console.log("\nAuth loading UI verification passed.");
}
