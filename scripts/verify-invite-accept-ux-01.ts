/**
 * Invite acceptance UX + paid-seat activation invariants.
 *
 * Run: npx --yes tsx scripts/verify-invite-accept-ux-01.ts
 *
 * No paid AI. No live Stripe. No Production. No secret prints.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mapTeamRpcError } from "../lib/team/rpc-errors";
import { SEAT_ADD_DISCLOSURE } from "../lib/billing/seat-change";
import { roleAllowsPermission } from "../lib/team/permissions";
import { extraSeatQuantityFromPaidSeats } from "../lib/billing/seats";

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

function numberedMigrations(): string[] {
  const dir = join(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function main() {
  console.log("=== INVITE ACCEPT UX 01 ===");

  const signupPage = read("app/(auth)/signup/page.tsx");
  const signupForm = read("components/auth/SignupForm.tsx");
  const signupActions = read("app/(auth)/actions.ts");
  const acceptUi = read("components/invite/InviteAcceptContent.tsx");
  const continueUi = read("components/invite/InviteContinueContent.tsx");
  const teamUi = read("components/team/TeamPageContent.tsx");
  const teamActions = read("lib/team/actions.ts");
  const publicInvite = read("lib/team/public-invite.ts");
  const rpcErrors = read("lib/team/rpc-errors.ts");
  const seatChange = read("lib/billing/seat-change.ts");
  const deferred = read("docs/BETA_LAUNCH_DEFERRED_REGISTER.md");

  section("INVITE EMAIL LOCK");
  assert("signup page is a server component", !/"use client"/.test(signupPage));
  assert(
    "signup page looks up the public invitation",
    /lookupPublicInvitation/.test(signupPage)
  );
  assert(
    "invite signup email is read-only, not disabled",
    /readOnly=\{Boolean\(invitedEmail\)\}/.test(signupForm) &&
      !/disabled=\{Boolean\(invitedEmail\)\}/.test(signupForm)
  );
  assert(
    "invite helper explains the locked address",
    /This invitation was sent to this email address/.test(signupForm)
  );
  assert(
    "invite signup hides company name",
    /inviteToken \? null :/.test(signupForm) &&
      /Company name/.test(signupForm)
  );
  assert(
    "normal signup still collects company name and editable email",
    /organisation_name/.test(signupForm) &&
      /placeholder="you@company.com"/.test(signupForm)
  );

  section("SERVER EMAIL MATCH");
  assert(
    "signup action looks up the invitation",
    /lookupPublicInvitation\(inviteToken\)/.test(signupActions)
  );
  assert(
    "signup action compares normalized emails",
    /normalizeInviteEmail\(email\) !== normalizeInviteEmail\(invitedEmail\)/.test(
      signupActions
    )
  );
  assert(
    "invite signup uses invitation email for Auth signUp",
    /email:\s*signupEmail/.test(signupActions)
  );
  assert(
    "invite signup does not write organisation_name metadata",
    /inviteToken\s*\?\s*\{\s*full_name\s*\}/.test(signupActions)
  );
  assert(
    "acceptInvitation also compares authenticated email to invitation",
    /normalizeInviteEmail\(user\.email\)/.test(teamActions) &&
      /lookupPublicInvitation\(rawToken\)/.test(teamActions)
  );

  section("RECIPIENT COST HIDDEN / OWNER DISCLOSURE");
  assert(
    "invitee Join screen has no $35 seat price",
    !/\$35/.test(acceptUi) && !/\$35/.test(continueUi)
  );
  assert(
    "invitee Join screen states invited role without purchaser copy",
    /You were invited as \{roleLabel\}/.test(acceptUi) &&
      !/prorated/.test(acceptUi)
  );
  assert(
    "Owner Team invite UI shows SEAT_ADD_DISCLOSURE before send",
    /SEAT_ADD_DISCLOSURE/.test(teamUi) &&
      /Send invitation/.test(teamUi)
  );
  assert(
    "Owner disclosure explains price, acceptance billing, and proration",
    SEAT_ADD_DISCLOSURE.includes("$35 + GST/month") &&
      SEAT_ADD_DISCLOSURE.includes("Billing begins when they accept") &&
      SEAT_ADD_DISCLOSURE.includes("prorated")
  );
  assert(
    "seat-change source matches required Owner wording",
    /Additional Business users cost \$35 \+ GST\/month each/.test(seatChange) &&
      /Billing begins when they accept the invitation/.test(seatChange)
  );

  section("FRIENDLY ACCEPTANCE ERRORS");
  assert(
    "mapper reads message, details, hint, and code",
    /error\.details/.test(rpcErrors) && /error\.hint/.test(rpcErrors)
  );
  assert(
    "acceptInvitation maps the full PostgREST error object",
    /mapTeamRpcError\(error\)/.test(teamActions) &&
      !/mapTeamRpcError\(error\.message\)/.test(teamActions)
  );
  assert(
    "NOT_AUTHENTICATED is not the generic fallback",
    mapTeamRpcError("TEAM:NOT_AUTHENTICATED") ===
      "Sign in to accept this invitation."
  );
  assert(
    "permission denied is not the generic fallback",
    mapTeamRpcError("permission denied for function begin_invitation_acceptance_v1") ===
      "Sign in to accept this invitation."
  );
  assert(
    "unique violation asks the invitee to wait",
    mapTeamRpcError("duplicate key value violates unique constraint 23505") ===
      "Seat payment is still being processed. Please wait a moment and try again."
  );
  assert(
    "billing not active points at the company subscription",
    mapTeamRpcError("TEAM:BILLING_NOT_ACTIVE") ===
      "Your company's subscription needs attention before this seat can be added."
  );
  assert(
    "unknown errors still fail closed with the generic line",
    mapTeamRpcError("something-unexpected") ===
      "That team action could not be completed. Try again."
  );
  assert(
    "accept retries begin_invitation_acceptance after unique violation",
    /23505[\s\S]*begin_invitation_acceptance_v1/.test(teamActions)
  );

  section("ACCEPTED INVITE UX");
  assert(
    "public lookup does not treat accepted as expired",
    /expired:\s*status === "expired" \|\| status === "cancelled"/.test(
      publicInvite
    ) && !/status === "accepted"/.test(publicInvite)
  );
  assert(
    "Join screen treats accepted as already in the company",
    /status === "accepted"/.test(acceptUi) &&
      /already in/.test(acceptUi)
  );

  section("SEAT ACTIVATION INVARIANTS");
  const membershipSql = read(
    "supabase/migrations/049_organisation_memberships.sql"
  );
  assert(
    "pending_billing insert still has null joined_at",
    membershipSql.includes("'pending_billing'") &&
      /joined_at\s*\)\s*values[\s\S]{0,400}'pending_billing'[\s\S]{0,200}null/.test(
        membershipSql
      )
  );
  assert(
    "activation still requires paid-seat RPC",
    /activate_membership_if_seats_paid_v1/.test(teamActions)
  );
  assert(
    "paid extra seats: 1 paid user → 0 extras; 2 paid users → 1 extra",
    extraSeatQuantityFromPaidSeats(1) === 0 &&
      extraSeatQuantityFromPaidSeats(2) === 1
  );
  assert(
    "invite send still does not call Stripe from team actions",
    !/processClaimedSeatMutationForOrg/.test(
      teamActions.slice(
        teamActions.indexOf("export async function inviteTeamMember"),
        teamActions.indexOf("export async function cancelTeamInvitation")
      )
    )
  );

  section("SECURITY-053 ROLE AUTHORITY");
  assert(
    "Estimator can run projects, estimates, project pricing, and DNA",
    roleAllowsPermission("estimator", "projects.edit") &&
      roleAllowsPermission("estimator", "estimates.run") &&
      roleAllowsPermission("estimator", "pricing.edit") &&
      roleAllowsPermission("estimator", "company.calibration.manage")
  );
  assert(
    "Estimator cannot manage company rates or paid Team invites",
    !roleAllowsPermission("estimator", "company.rates.manage") &&
      !roleAllowsPermission("estimator", "team.invite") &&
      !roleAllowsPermission("estimator", "billing.manage")
  );

  section("NO NEW MIGRATION");
  const latest = numberedMigrations().at(-1) ?? "";
  assert("latest numbered migration is 054 DNA catalogue seed", latest.startsWith("054_"));
  assert("054 was not a team-invite migration", !existsSync(join(process.cwd(), "supabase/migrations/054_team_invite_accept.sql")));

  section("DELIVERABILITY REGISTER");
  assert(
    "Gmail spam-similar is recorded as deliverability, not auth failure",
    /similar to messages identified as spam/.test(deferred) &&
      /reputation \/ domain warm-up/.test(deferred)
  );
  assert(
    "custom beta domain remains a recommendation, not configured",
    /beta\.get-quotr\.com/.test(deferred) &&
      /Do not configure in this programme/.test(deferred)
  );
  assert(
    "team sender architecture was not retargeted in this verifier's sources",
    /no-reply@get-quotr\.com/.test(read("lib/email/application-email.ts"))
  );

  if (process.exitCode) {
    console.log("\nINVITE ACCEPT UX 01 failed.");
  } else {
    console.log("\nINVITE ACCEPT UX 01 passed.");
  }
}

main();
