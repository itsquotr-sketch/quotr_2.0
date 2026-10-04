/**
 * Signup confirmation host, metadata handoff, and ready-screen actions.
 *
 * Run: npx --yes tsx scripts/verify-signup-onboarding-handoff.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  ALREADY_CONFIRMED_MESSAGE,
  confirmationContinueOmitsError,
  confirmationLoginPath,
  decideConfirmationCallback,
  decideFailedExchange,
  loginConfirmationPresentation,
} from "../lib/auth/confirmation-link";
import {
  explicitFullNameFromUserMetadata,
  organisationNameFromUserMetadata,
  repairFieldValue,
  resolveEmailConfirmDestination,
  shouldProvisionSignupOrganisation,
} from "../lib/auth/email-confirm-destination";
import { POST_SIGNUP_DESTINATION } from "../lib/auth/post-auth-navigation";
import { AUTH_USER_MESSAGES } from "../lib/auth/errors";
import {
  PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  resolveAuthEmailOrigin,
} from "../lib/auth/site-url";

const WORKFLOW_ORIGIN =
  "https://quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function main() {
  console.log("=== Signup to onboarding handoff ===\n");

  const shell = read("components/auth/AuthShell.tsx");
  assert(
    "auth cards use min-h-dvh, safe area, and auto margins",
    shell.includes("min-h-dvh") &&
      shell.includes("m-auto") &&
      shell.includes("safe-area-inset-top") &&
      shell.includes("safe-area-inset-bottom") &&
      shell.includes("data-auth-card-frame")
  );
  assert(
    "auth shell scrolls with the page and is not fixed",
    !shell.includes("position:") &&
      !shell.includes("fixed") &&
      !/\bh-dvh\b/.test(shell.replaceAll("min-h-dvh", ""))
  );

  const workflow = resolveAuthEmailOrigin({
    vercelEnv: "preview",
    requestOrigin: WORKFLOW_ORIGIN,
    branchHost: "quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app",
    deploymentHost: "quotr-2-0-jdkuoevz9-quotr1.vercel.app",
    configuredSiteUrl: PREVIEW_AUTH_SITE_ORIGIN_STABLE,
  });
  assert(
    "Preview confirmation stays on the signup host",
    workflow === WORKFLOW_ORIGIN && workflow !== PREVIEW_AUTH_SITE_ORIGIN_STABLE
  );
  assert(
    "configured hardening URL is not used when the request host differs",
    resolveAuthEmailOrigin({
      vercelEnv: "preview",
      requestOrigin: null,
      branchHost: null,
      deploymentHost: null,
      configuredSiteUrl: PREVIEW_AUTH_SITE_ORIGIN_STABLE,
    }) !== PREVIEW_AUTH_SITE_ORIGIN_STABLE
  );
  assert(
    "branch host is used when the request host is missing",
    resolveAuthEmailOrigin({
      vercelEnv: "preview",
      requestOrigin: null,
      branchHost: "quotr-2-0-git-ui-core-workflow-overhaul-quotr1.vercel.app",
      deploymentHost: "quotr-2-0-jdkuoevz9-quotr1.vercel.app",
      configuredSiteUrl: PREVIEW_AUTH_SITE_ORIGIN_STABLE,
    }) === WORKFLOW_ORIGIN
  );

  const signup = read("app/(auth)/actions.ts");
  assert(
    "signup stores full name, company name, and email",
    signup.includes("full_name") &&
      signup.includes("organisation_name") &&
      signup.includes("email: signupEmail") &&
      signup.includes("getAuthCallbackOrigin")
  );
  assert(
    "invite signup does not store a new organisation name",
    /inviteToken\s*\?\s*\{\s*full_name\s*\}/.test(signup)
  );

  const metadata = {
    full_name: "Ada Lovelace",
    organisation_name: "Analytical Engines",
  };
  assert(
    "signup metadata survives as stored values",
    explicitFullNameFromUserMetadata(metadata) === "Ada Lovelace" &&
      organisationNameFromUserMetadata(metadata) === "Analytical Engines"
  );
  assert(
    "placeholders are not treated as stored values",
    explicitFullNameFromUserMetadata({}) === null &&
      organisationNameFromUserMetadata({}) === null &&
      repairFieldValue(null) === "" &&
      repairFieldValue("Ada Lovelace") === "Ada Lovelace" &&
      repairFieldValue("Analytical Engines") === "Analytical Engines"
  );
  assert(
    "ordinary signup provisions once from metadata",
    shouldProvisionSignupOrganisation({
      hasOrg: false,
      pendingInvite: "none",
      organisationName: "Analytical Engines",
      fullName: "Ada Lovelace",
    }) &&
      resolveEmailConfirmDestination({
        next: "/app/dashboard",
        hasOrg: false,
        pendingInvite: "none",
        provisioned: true,
      }) === POST_SIGNUP_DESTINATION
  );
  assert(
    "existing members and invitations do not create another organisation",
    !shouldProvisionSignupOrganisation({
      hasOrg: true,
      pendingInvite: "none",
      organisationName: "Analytical Engines",
      fullName: "Ada Lovelace",
    }) &&
      !shouldProvisionSignupOrganisation({
        hasOrg: false,
        pendingInvite: "one",
        organisationName: "Analytical Engines",
        fullName: "Ada Lovelace",
      })
  );

  const repair = read("components/auth/SetupRequiredForm.tsx");
  const repairPage = read("app/(protected)/app/setup-required/page.tsx");
  assert(
    "repair fields use metadata values and keep example placeholders",
    repair.includes("defaultValue={defaultFullName}") &&
      repair.includes("defaultValue={defaultOrganisationName}") &&
      repair.includes('placeholder="Alex Smith"') &&
      repair.includes('placeholder="Smith Building Co."') &&
      !repair.includes('defaultValue="Alex Smith"') &&
      !repair.includes('defaultValue="Smith Building Co."') &&
      repairPage.includes("shouldProvisionSignupOrganisation") &&
      repairPage.includes("POST_SIGNUP_DESTINATION") &&
      repairPage.includes('redirect("/invite/continue")')
  );

  const provisionSql = read(
    "supabase/migrations/049_organisation_memberships.sql"
  );
  assert(
    "provisioning is idempotent and refuses a second organisation",
    provisionSql.includes("pg_advisory_xact_lock") &&
      provisionSql.includes("already_provisioned") &&
      provisionSql.includes("PROVISION:PENDING_INVITATION") &&
      provisionSql.includes("return query") &&
      provisionSql.includes("v_existing_org, v_uid, true")
  );

  const callback = read("app/auth/callback/route.ts");
  assert(
    "callback uses the confirmation decision and does not invent success",
    callback.includes("decideConfirmationCallback") &&
      callback.includes("decideFailedExchange") &&
      callback.includes("shouldProvisionSignupOrganisation") &&
      callback.includes("explicitFullNameFromUserMetadata")
  );
  assert(
    "successful confirmation does not add an invalid-link error",
    confirmationContinueOmitsError(POST_SIGNUP_DESTINATION) &&
      !POST_SIGNUP_DESTINATION.includes("confirmation_invalid") &&
      decideConfirmationCallback({
        code: "unused-code",
        next: POST_SIGNUP_DESTINATION,
        errorCode: null,
        errorDescription: null,
        hasConfirmedSession: false,
      }).type === "exchange" &&
      decideFailedExchange({
        next: POST_SIGNUP_DESTINATION,
        providerMessage: "pkce code verifier not found",
        hasConfirmedSession: true,
      }).type === "continue"
  );
  assert(
    "already-confirmed reused link uses the calm message",
    decideConfirmationCallback({
      code: null,
      next: POST_SIGNUP_DESTINATION,
      errorCode: "email_already_confirmed",
      errorDescription: "Email address already confirmed",
      hasConfirmedSession: false,
    }).type === "login" &&
      confirmationLoginPath("confirmation_already") ===
        "/login?error=confirmation_already" &&
      loginConfirmationPresentation("confirmation_already").message ===
        ALREADY_CONFIRMED_MESSAGE &&
      loginConfirmationPresentation("confirmation_already").showResend === false
  );
  assert(
    "a genuinely invalid token keeps the existing error and a resend route",
    decideConfirmationCallback({
      code: null,
      next: POST_SIGNUP_DESTINATION,
      errorCode: "otp_expired",
      errorDescription: "Email link is invalid or has expired",
      hasConfirmedSession: false,
    }).type === "login" &&
      loginConfirmationPresentation("confirmation_invalid").message ===
        AUTH_USER_MESSAGES.CONFIRMATION_LINK_INVALID &&
      loginConfirmationPresentation("confirmation_invalid").showResend === true &&
      decideFailedExchange({
        next: POST_SIGNUP_DESTINATION,
        providerMessage: "invalid token",
        hasConfirmedSession: false,
      }).type === "login"
  );
  assert(
    "invitation and password-recovery callbacks stay on their paths",
    decideConfirmationCallback({
      code: null,
      next: "/reset-password",
      errorCode: "otp_expired",
      errorDescription: "Email address already confirmed",
      hasConfirmedSession: true,
    }).type === "recovery_invalid" &&
      decideFailedExchange({
        next: "/reset-password",
        providerMessage: "pkce code verifier not found",
        hasConfirmedSession: true,
      }).type === "recovery_invalid" &&
      resolveEmailConfirmDestination({
        next: "/invite/abc",
        hasOrg: false,
        pendingInvite: "one",
        provisioned: false,
      }) === "/invite/abc" &&
      resolveEmailConfirmDestination({
        next: "/reset-password",
        hasOrg: false,
        pendingInvite: "none",
        provisioned: false,
      }) === "/reset-password"
  );

  const ready = read("components/setup/FirstRunReady.tsx");
  const setupShell = read("components/setup/SetupShell.tsx");
  assert(
    "ready screen offers create project and dashboard",
    ready.includes("Create your first project") &&
      ready.includes("Go to Dashboard") &&
      ready.includes("completeRequiredOnboarding") &&
      ready.includes('intent="first-job"') &&
      ready.includes("later under Rates") &&
      !ready.includes("Improve my rates and productivity") &&
      !ready.includes("Improve Quotr") &&
      !ready.includes("mode=improve") &&
      !ready.includes("createProject")
  );
  assert(
    "ready shell does not pass an improve branch",
    setupShell.includes("<FirstRunReady") &&
      !setupShell.includes("improveHref") &&
      !setupShell.includes("Improve Quotr") &&
      !setupShell.includes("mode=improve") &&
      ready.includes("later under Rates")
  );

  const login = read("app/(auth)/login/page.tsx");
  assert(
    "login shows the calm copy and the resend action",
    login.includes("loginConfirmationPresentation") &&
      login.includes("resendSignupConfirmation") &&
      login.includes("Resend confirmation email")
  );

  if (process.exitCode) {
    console.error("\nSignup handoff verification failed");
  } else {
    console.log("\nSignup handoff verification passed");
  }
}

main();
