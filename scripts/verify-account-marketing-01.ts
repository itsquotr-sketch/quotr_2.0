/**
 * Account and marketing fixes: Profile server actions, duplicate signup,
 * phone ownership, consent through Loops, and the empty billing label.
 *
 * Run: npx --yes tsx scripts/verify-account-marketing-01.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSignupUserMetadata, normalizeAccountPhone } from "../lib/auth/account-phone";
import { recordSignupPreferences } from "../lib/auth/signup-preferences";
import {
  EXISTING_EMAIL_MESSAGE,
  marketingConsentFromMetadata,
  retainedAuthEmail,
  signupResponseConcealsExistingAccount,
} from "../lib/auth/signup-existing-account";
import {
  billingAccountHasStatusCard,
  billingFallbackTitle,
  buildBillingPageView,
} from "../lib/billing/billing-page-view";
import {
  loopsPreferenceAckDecision,
  loopsSubscribedField,
  preferencePendingAfterLoopsAttempt,
} from "../lib/communications/contact-mapping";
import { runIsolatedLoopsTask } from "../lib/communications/loops-client";
import {
  confirmedSignupLoopsEligible,
  marketingLoopsAllowsEmail,
  marketingLoopsRetriesExistingPending,
  marketingLoopsScope,
  PREVIEW_LOOPS_TEST_EMAIL,
} from "../lib/communications/loops-automation";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";

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

async function main() {
  section("PROFILE SERVER ACTIONS");
  for (const rel of [
    "lib/auth/profile-actions.ts",
    "lib/communications/consent-actions.ts",
  ]) {
    const source = read(rel);
    assert(`${rel} is a server action module`, source.startsWith('"use server"'));
    assert(`${rel} exports no object`, !/^export const /m.test(source));
    assert(`${rel} exports no sync function`, !/^export function /m.test(source));
  }
  const profile = read("components/profile/ProfilePageContent.tsx");
  assert(
    "marketing save shows Saving and blocks a second submit",
    profile.includes('consentPending ? "Saving…" : "Save preference"') &&
      profile.includes("disabled={consentPending}") &&
      profile.includes("disabled={consentPending}")
  );
  const consent = read("lib/communications/consent-actions.ts");
  const rpcAt = consent.indexOf('await supabase.rpc("set_own_marketing_consent"');
  const syncAt = consent.indexOf("await syncSessionUser");
  assert(
    "consent is stored before Loops sync",
    rpcAt > 0 && syncAt > rpcAt && consent.includes('p_source: "settings"')
  );
  assert(
    "a Loops throw after a saved preference does not fail the action",
    /try \{\s*await syncSessionUser/.test(consent)
  );
  let isolated = false;
  await runIsolatedLoopsTask(async () => {
    isolated = true;
    throw new Error("loops down");
  });
  assert("an isolated Loops failure does not escape", isolated);

  section("CONSENT PERSISTENCE");
  assert("yes string is opt-in", marketingConsentFromMetadata("true") === true);
  assert("no string is opt-out", marketingConsentFromMetadata("false") === false);
  assert("yes boolean is opt-in", marketingConsentFromMetadata(true) === true);
  assert("no boolean is opt-out", marketingConsentFromMetadata(false) === false);
  assert("missing consent is not a choice", marketingConsentFromMetadata(undefined) === null);

  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { error: null };
    },
  };
  await recordSignupPreferences(client, { marketing_consent: "true" });
  await recordSignupPreferences(client, { marketing_consent: "false" });
  await recordSignupPreferences(client, { marketing_consent: true });
  await recordSignupPreferences(client, { marketing_consent: false });
  await recordSignupPreferences(client, { marketing_consent: "later" });
  const consentCalls = calls.filter((call) => call.fn === "set_own_marketing_consent");
  assert(
    "signup yes and no are stored with source signup",
    consentCalls.length === 4 &&
      consentCalls[0]?.args.p_consent === true &&
      consentCalls[1]?.args.p_consent === false &&
      consentCalls[2]?.args.p_consent === true &&
      consentCalls[3]?.args.p_consent === false &&
      consentCalls.every((call) => call.args.p_source === "signup")
  );

  const yesMeta = buildSignupUserMetadata({
    invite: false,
    fullName: "Ada",
    organisationName: "Ada Building",
    phone: { e164: "+64211234567", display: "021 123 4567", country: "NZ" },
    marketingConsent: true,
  });
  const noMeta = buildSignupUserMetadata({
    invite: false,
    fullName: "Ada",
    organisationName: "Ada Building",
    phone: { e164: "+64211234567", display: "021 123 4567", country: "NZ" },
    marketingConsent: false,
  });
  assert(
    "signup metadata keeps yes and no as strings",
    yesMeta.marketing_consent === "true" && noMeta.marketing_consent === "false"
  );

  section("LOOPS ACK AND RETRY");
  assert(
    "pending yes sends subscribed true",
    loopsSubscribedField({
      mode: "routine",
      contactExists: true,
      marketingConsent: true,
      preferencePending: true,
    }) === true
  );
  assert(
    "pending no sends subscribed false",
    loopsSubscribedField({
      mode: "routine",
      contactExists: true,
      marketingConsent: false,
      preferencePending: true,
    }) === false
  );
  assert(
    "a routine update of an existing contact omits subscribed",
    loopsSubscribedField({
      mode: "routine",
      contactExists: true,
      marketingConsent: true,
      preferencePending: false,
    }) === undefined
  );
  assert(
    "explicit opt-out still sends false",
    loopsSubscribedField({
      mode: "explicit_opt_out",
      contactExists: true,
      marketingConsent: false,
    }) === false
  );
  assert(
    "a failed Loops attempt stays pending",
    preferencePendingAfterLoopsAttempt({
      preferencePending: true,
      sentSubscribed: true,
      loopsAccepted: false,
      storedConsent: true,
      sentConsent: true,
    }) === true &&
      loopsPreferenceAckDecision({
        preferencePending: true,
        sentSubscribed: true,
        loopsAccepted: false,
        skippedUnconfigured: false,
        sentConsent: true,
        sentRevision: 2,
        storedConsent: true,
        storedRevision: 2,
      }) === "skip"
  );
  assert(
    "a stale revision is re-armed when subscribed was sent",
    loopsPreferenceAckDecision({
      preferencePending: true,
      sentSubscribed: true,
      loopsAccepted: true,
      skippedUnconfigured: false,
      sentConsent: true,
      sentRevision: 2,
      storedConsent: false,
      storedRevision: 3,
    }) === "rearm"
  );
  assert(
    "omitting subscribed does not re-arm a newer revision",
    loopsPreferenceAckDecision({
      preferencePending: false,
      sentSubscribed: undefined,
      loopsAccepted: true,
      skippedUnconfigured: false,
      sentConsent: true,
      sentRevision: 2,
      storedConsent: false,
      storedRevision: 3,
    }) === "skip"
  );

  const pending = read("lib/communications/pending-sync.ts");
  const failure = pending.slice(pending.indexOf("async function noteLoopsRetryFailure"));
  assert(
    "retry failure does not clear pending or auto-retry",
    !failure.slice(0, failure.indexOf("function revisionOf")).includes("marketing_loops_sync_pending: false") &&
      !failure.slice(0, failure.indexOf("function revisionOf")).includes("marketing_loops_auto_retry: false")
  );
  const schedule = read("lib/communications/signup-sync.ts");
  assert(
    "confirmed signup retry is limited to a pending row",
    schedule.includes("marketing_loops_auto_retry: true") &&
      schedule.includes('.eq("marketing_loops_sync_pending", true)') &&
      schedule.includes("if (!apiKey) return;")
  );
  assert(
    "unconfirmed signup is not eligible for Loops",
    confirmedSignupLoopsEligible({
      emailConfirmed: false,
      newlyProvisioned: true,
      destination: "/app",
    }) === false
  );
  assert(
    "a newly confirmed profile is eligible",
    confirmedSignupLoopsEligible({
      emailConfirmed: true,
      newlyProvisioned: true,
      destination: "/app",
    }) === true
  );
  const finish = read("lib/auth/finish-email-confirmation.ts");
  const unconfirmedReturn = finish.indexOf('return "/signup?confirm=required"');
  const loopsCall = finish.indexOf("await scheduleConfirmedSignupLoopsSync");
  assert(
    "confirmation returns an unconfirmed user before Loops",
    unconfirmedReturn > 0 && loopsCall > unconfirmedReturn
  );
  assert(
    "preview automation stays on the one test address",
    marketingLoopsScope({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: `https://${PREVIEW_SUPABASE_PROJECT_REF}.supabase.co`,
    }) === "preview" &&
      marketingLoopsAllowsEmail("preview", PREVIEW_LOOPS_TEST_EMAIL) &&
      !marketingLoopsAllowsEmail("preview", "someone-else@example.com") &&
      marketingLoopsScope({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
      }) === "production" &&
      marketingLoopsRetriesExistingPending({}) === false
  );
  const sync = read("lib/communications/sync.ts");
  assert(
    "a first stored no is an explicit opt-out",
    sync.includes('return consent ? "explicit_opt_in" : "explicit_opt_out"')
  );

  section("EXISTING EMAIL");
  assert(
    "an empty identity list is an existing account",
    signupResponseConcealsExistingAccount({ identities: [] }) &&
      !signupResponseConcealsExistingAccount({ identities: [{ id: "1" }] }) &&
      !signupResponseConcealsExistingAccount(null)
  );
  assert(
    "confirmed duplicate copy is the required sentence",
    EXISTING_EMAIL_MESSAGE ===
      "This email already has a Quotr account. Sign in or reset your password."
  );
  const actions = read("app/(auth)/actions.ts");
  const concealAt = actions.indexOf("signupResponseConcealsExistingAccount");
  const provisionAt = actions.indexOf("provisionOrganisationForCurrentUser");
  assert(
    "an existing email returns before a profile or company is created",
    concealAt > 0 && provisionAt > concealAt
  );
  const form = read("components/auth/SignupForm.tsx");
  assert(
    "confirmed duplicate offers sign in and forgot password",
    form.includes("EXISTING_EMAIL_MESSAGE") &&
      form.includes('emailHref("/login"') &&
      form.includes('emailHref("/forgot-password"')
  );
  assert(
    "unconfirmed duplicate uses resend and does not claim a new link was sent",
    form.includes('mode="resend"') &&
      form.includes("This email already has an unconfirmed Quotr signup.")
  );
  assert(
    "email is retained only when it is an address",
    retainedAuthEmail("ada@example.com") === "ada@example.com" &&
      retainedAuthEmail("not an email") === undefined
  );
  const lookup = read("lib/auth/signup-email-lookup.ts");
  assert(
    "confirmation lookup is server-only and returns no account details",
    lookup.includes('import "server-only"') &&
      lookup.includes("Promise<ExistingSignupConfirmation>") &&
      !lookup.includes("NextResponse")
  );

  section("PHONE");
  const nzLocal = normalizeAccountPhone("NZ", "021 123 4567");
  const nzIntl = normalizeAccountPhone("NZ", "+64 21 123 4567");
  const auLocal = normalizeAccountPhone("AU", "0412 345 678");
  const auIntl = normalizeAccountPhone("AU", "+61 412 345 678");
  assert(
    "NZ and AU local and international forms match",
    nzLocal.ok &&
      nzIntl.ok &&
      auLocal.ok &&
      auIntl.ok &&
      nzLocal.e164 === nzIntl.e164 &&
      auLocal.e164 === auIntl.e164
  );
  const phoneSql = read("supabase/migrations/085_account_phone_uniqueness.sql");
  assert(
    "the same user can keep their number and another account cannot take it",
    phoneSql.includes("on conflict (user_id) do update") &&
      phoneSql.includes("when unique_violation then") &&
      phoneSql.includes("PHONE:ALREADY_LINKED")
  );
  const migrations = readdirSync(join(process.cwd(), "supabase/migrations"));
  const deletionMigrations = [
    "121_account_deletion_requests.sql",
    "122_account_deletion_fulfilment.sql",
    "123_detach_personal_authors.sql",
  ];
  assert(
    "deletion migrations do not add another phone uniqueness rule",
    deletionMigrations.every((name) => migrations.includes(name)) &&
      deletionMigrations.every(
        (name) => !read(`supabase/migrations/${name}`).includes("PHONE:ALREADY_LINKED")
      )
  );

  section("BILLING LABEL");
  const empty = buildBillingPageView({
    orgId: "org",
    billingEnvironment: "live",
    customer: null,
    subscription: null,
    activeOverride: null,
    effectiveTrialState: null,
  });
  assert(
    "an account with no subscription is labelled No subscription",
    empty.kind === "uninitialized" &&
      empty.statusLabel === "Not started" &&
      empty.source === "none" &&
      billingFallbackTitle(empty) === "No subscription" &&
      !billingAccountHasStatusCard(empty)
  );
  const billing = read("components/billing/BillingPageContent.tsx");
  const fallbackAt = billing.indexOf("billingFallbackTitle");
  const plansAt = billing.indexOf("showPlans && !playSurface");
  assert(
    "Android still hides plan purchase while the status card can render",
    fallbackAt > 0 &&
      plansAt > fallbackAt &&
      billing.includes("PLAY_SURFACE_BILLING_NOTE") &&
      !billing.slice(fallbackAt, plansAt).includes("startCheckout")
  );

  if (process.exitCode) {
    console.log("\nAccount marketing checks failed.");
  } else {
    console.log("\nAccount marketing checks passed.");
  }
}

main();
