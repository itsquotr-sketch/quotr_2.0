/**
 * Signup phone capture: normalization, collision copy, and claim ordering.
 *
 * Run: npx --yes tsx scripts/verify-signup-phone.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PHONE_ALREADY_LINKED_MESSAGE,
  buildSignupUserMetadata,
  isExplicitPhoneClaimFailure,
  isSignupDatabaseSaveFailure,
  normalizeAccountPhone,
} from "../lib/auth/account-phone";
import {
  containsUnsafeAuthDiagnostic,
  presentAuthError,
} from "../lib/auth/errors";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function main() {
  section("NORMALIZATION");
  const nzLocal = normalizeAccountPhone("NZ", "021 123 4567");
  const nzIntl = normalizeAccountPhone("NZ", "+64 21 123 4567");
  const nzCompact = normalizeAccountPhone("NZ", "0211234567");
  assert("NZ local is valid", nzLocal.ok === true);
  assert("NZ +64 is valid", nzIntl.ok === true);
  assert(
    "NZ local and +64 collide",
    nzLocal.ok && nzIntl.ok && nzCompact.ok && nzLocal.e164 === nzIntl.e164 && nzLocal.e164 === nzCompact.e164
  );
  assert(
    "NZ comparison value is E.164",
    nzLocal.ok && nzLocal.e164 === "+64211234567"
  );
  assert(
    "NZ display keeps what was typed",
    nzLocal.ok && nzLocal.display === "021 123 4567" && nzIntl.ok && nzIntl.display === "+64 21 123 4567"
  );

  const auLocal = normalizeAccountPhone("AU", "0412 345 678");
  const auIntl = normalizeAccountPhone("AU", "+61 412 345 678");
  assert(
    "AU local and +61 collide",
    auLocal.ok && auIntl.ok && auLocal.e164 === auIntl.e164 && auLocal.e164 === "+61412345678"
  );
  assert(
    "different valid numbers stay different",
    nzLocal.ok && auLocal.ok && nzLocal.e164 !== auLocal.e164
  );
  assert(
    "NZ field rejects an AU international number",
    normalizeAccountPhone("NZ", "+61 412 345 678").ok === false
  );
  assert(
    "AU field rejects an NZ international number",
    normalizeAccountPhone("AU", "+64 21 123 4567").ok === false
  );
  assert("empty phone is rejected", normalizeAccountPhone("NZ", "  ").ok === false);
  assert("short phone is rejected", normalizeAccountPhone("NZ", "123").ok === false);
  assert("unknown country is rejected", normalizeAccountPhone("US", "021 123 4567").ok === false);
  assert(
    "US number is rejected",
    normalizeAccountPhone("NZ", "+1 415 555 2671").ok === false
  );

  section("COPY");
  assert(
    "linked-number message is the safe sentence",
    PHONE_ALREADY_LINKED_MESSAGE ===
      "This phone number is already linked to an account. Sign in or use a different number." &&
      presentAuthError("PHONE_ALREADY_LINKED") === PHONE_ALREADY_LINKED_MESSAGE
  );
  assert(
    "linked-number message discloses no account",
    !PHONE_ALREADY_LINKED_MESSAGE.includes("@") &&
      !/organisation|email|owner|admin/i.test(PHONE_ALREADY_LINKED_MESSAGE) &&
      !containsUnsafeAuthDiagnostic(PHONE_ALREADY_LINKED_MESSAGE)
  );
  assert(
    "explicit claim failure is recognized",
    isExplicitPhoneClaimFailure("PHONE:ALREADY_LINKED") &&
      !isExplicitPhoneClaimFailure("User already registered")
  );
  assert(
    "generic auth database failure can be checked after submit",
    isSignupDatabaseSaveFailure("Database error saving new user") &&
      !isSignupDatabaseSaveFailure("User already registered") &&
      !isSignupDatabaseSaveFailure("email rate limit exceeded")
  );

  section("ORDERING");
  const actions = read("app/(auth)/actions.ts");
  const signupStart = actions.indexOf("export async function signup");
  const signupBody = actions.slice(signupStart);
  const signUpAt = signupBody.indexOf("auth.signUp");
  const claimAt = signupBody.indexOf("signupWasBlockedByExistingPhone");
  const provisionAt = signupBody.indexOf("provisionOrganisationForCurrentUser");
  assert("signup validates before Auth signUp", signUpAt > signupBody.indexOf("normalizeAccountPhone"));
  assert(
    "phone claim check is after signUp and not a pre-check",
    signUpAt > 0 && claimAt > signUpAt && signupBody.indexOf("accountPhoneIsClaimed") === -1
  );
  assert(
    "rate limit is classified before the phone claim check",
    signupBody.indexOf("RATE_LIMITED") < claimAt
  );
  assert("ordinary signup still provisions after the phone claim", provisionAt > claimAt);
  assert(
    "invite success does not provision",
    /if \(inviteToken\) \{[\s\S]*?return \{ continueTo: getSafeInternalPath\(`\/invite\/\$\{inviteToken\}`\) \};[\s\S]*?const provisioned/.test(
      signupBody
    )
  );
  assert(
    "signup action does not import the admin client",
    !actions.includes("createAdminClient") && !actions.includes("@/lib/supabase/admin")
  );
  const inviteMetadata = buildSignupUserMetadata({
    invite: true,
    fullName: "Ada",
    organisationName: "Should Not Persist",
    phone: { e164: "+64211234567", display: "021 123 4567", country: "NZ" },
  });
  const ownerMetadata = buildSignupUserMetadata({
    invite: false,
    fullName: "Ada",
    organisationName: "Ada Building",
    phone: { e164: "+64211234567", display: "021 123 4567", country: "NZ" },
  });
  assert("invite metadata has no organisation name", !("organisation_name" in inviteMetadata));
  assert(
    "invite metadata still carries the normalized phone",
    inviteMetadata.phone_e164 === "+64211234567" &&
      inviteMetadata.signup_phone_required === "true"
  );
  assert(
    "ordinary metadata keeps company name and phone",
    ownerMetadata.organisation_name === "Ada Building" &&
      ownerMetadata.phone_e164 === inviteMetadata.phone_e164
  );

  const form = read("components/auth/SignupForm.tsx");
  assert(
    "signup links sign-in and account recovery",
    form.includes('href="/forgot-password"') &&
      form.includes('"/login"') &&
      form.includes("Account recovery") &&
      form.includes("This phone number is already linked to an account.")
  );
  assert("signup phone field is country aware", form.includes("AccountPhoneField"));
  assert(
    "phone collision copy does not interpolate provider errors",
    !form.includes("{state.error}") || form.includes("state.phoneAlreadyLinked")
  );

  const migration = read("supabase/migrations/085_account_phone_uniqueness.sql");
  assert(
    "uniqueness is a database unique index",
    migration.includes("account_phone_numbers_phone_e164_uidx") &&
      migration.includes("unique index")
  );
  assert(
    "claim is inside auth user insert and rolls back on conflict",
    migration.includes("after insert on auth.users") &&
      migration.includes("PHONE:ALREADY_LINKED") &&
      migration.includes("on delete cascade")
  );
  assert(
    "availability function is not granted to anon or authenticated",
    /revoke all on function public\.account_phone_is_claimed\(text\) from public, anon, authenticated/.test(
      migration
    ) && /grant execute on function public\.account_phone_is_claimed\(text\) to service_role/.test(migration)
  );
  assert(
    "missing phone is not treated as required",
    read("supabase/migrations/086_account_phone_optional_claim.sql").includes(
      "signup_phone_required' is distinct from 'true'"
    )
  );
  assert(
    "migrations do not backfill phones",
    !/update\s+public\.profiles/i.test(migration) &&
      !/update\s+public\.profiles/i.test(
        read("supabase/migrations/086_account_phone_optional_claim.sql")
      )
  );
  assert(
    "profile edit uses the same claim function",
    migration.includes("set_own_account_phone") &&
      read("lib/auth/profile-actions.ts").includes("set_own_account_phone") &&
      !read("lib/auth/profile-actions.ts").includes("createAdminClient")
  );

  const routes = read("components/auth/SignupForm.tsx") + read("app/(auth)/actions.ts");
  assert("no public phone availability route is referenced", !/phone-available|phoneAvailable/.test(routes));

  if (!process.exitCode) {
    console.log("\nSignup phone verification passed.");
  }
}

main();
