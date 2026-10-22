/**
 * Stage 1 Loops contact mapping, consent, and failure isolation.
 *
 * Run: npx tsx scripts/verify-loops-communications-01.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveEffectiveAccessPolicy } from "../lib/billing/access-policy";
import { buildInternalTrialSubscription } from "../lib/billing/trial";
import type { OrgBillingOverride } from "../lib/billing/types";
import {
  buildLoopsContactProperties,
  contactPropertiesOmitStage1Gaps,
  loopsBillingFields,
  loopsCompanyName,
  loopsCountry,
  loopsOnboardingComplete,
  loopsPreferenceAckDecision,
  loopsSubscribedField,
  preferencePendingAfterLoopsAttempt,
  splitFullName,
} from "../lib/communications/contact-mapping";
import {
  EMAIL_PREFERENCE_HELPER,
  EMAIL_PREFERENCE_LABEL,
  emailPreferenceChoice,
} from "../lib/communications/email-preference";
import {
  confirmedSignupLoopsEligible,
  compareLoopsRetryPriority,
  cronAuthorizationMatches,
  loopsRetryBackoffMs,
  loopsRetryDisposition,
  MARKETING_LOOPS_RETRY_ATTEMPT_CAP,
  MARKETING_LOOPS_RETRY_BATCH,
  MARKETING_LOOPS_RETRY_CONCURRENCY,
  MARKETING_LOOPS_RETRY_SCHEDULE,
  marketingLoopsAllowsEmail,
  marketingLoopsRetriesExistingPending,
  loopsEngagementEligibleUpdate,
  marketingLoopsScope,
  planLoopsRetryWave,
  PREVIEW_LOOPS_TEST_EMAIL,
} from "../lib/communications/loops-automation";
import {
  runIsolatedLoopsTask,
  upsertLoopsContact,
} from "../lib/communications/loops-client";
import { withConsentLease } from "../lib/communications/sync-lease";

function existsVercelCron(): boolean {
  try {
    return read("vercel.json").includes("crons");
  } catch {
    return false;
  }
}

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const baseDraft = {
  userId: "user-1",
  email: "alex@example.com",
  fullName: "Alex Smith",
  marketingConsent: false,
  organisationName: "Smith Building Co.",
  tradingName: null,
  country: "NZ",
  countryExplicit: true,
  region: "Auckland",
  onboardingComplete: false,
  plan: "business" as const,
  subscriptionStatus: "trialing",
  trialEndsAt: "2026-10-12T00:00:00.000Z",
  projectsCreated: 2,
  estimatesGenerated: 3,
  quotesSent: 1,
  quotesAccepted: 0,
  ratesConfigured: true,
};

console.log("=== Loops communications stage 1 ===\n");

{
  const name = splitFullName("Alex Smith");
  assert("first token is firstName", name.firstName === "Alex");
  assert("remaining tokens are lastName", name.lastName === "Smith");
  const multi = splitFullName("Mary Ann Smith");
  assert("multi-word remainder stays in lastName", multi.lastName === "Ann Smith");
  const single = splitFullName("Alex");
  assert(
    "single token clears lastName",
    single.firstName === "Alex" && single.lastName === null
  );
  const hyphenated = splitFullName("Jean-Luc");
  assert(
    "single hyphenated token clears lastName",
    hyphenated.firstName === "Jean-Luc" && hyphenated.lastName === null
  );
  const renamed = splitFullName("Jean-Luc Ellis");
  assert(
    "multi-token name keeps the surname",
    renamed.firstName === "Jean-Luc" && renamed.lastName === "Ellis"
  );
  assert("blank name omits both", splitFullName("   ").firstName === undefined && !("lastName" in splitFullName("   ")));
}

{
  assert(
    "trading name wins",
    loopsCompanyName("ERC Contracting", "Smith Building Co.") === "ERC Contracting"
  );
  assert(
    "blank trading name falls back to organisation name",
    loopsCompanyName("  ", "Smith Building Co.") === "Smith Building Co."
  );
  assert("both blank omits company name", loopsCompanyName(null, "  ") === undefined);
}

{
  assert(
    "schema-default country is omitted during company basics",
    loopsCountry({
      country: "NZ",
      onboardingStatus: "not_started",
      onboardingStep: "company",
    }) === undefined
  );
  assert(
    "saved country is included after company basics",
    loopsCountry({
      country: "AU",
      onboardingStatus: "in_progress",
      onboardingStep: "work_areas",
      hasPrimaryWorkAreas: false,
    }) === "AU"
  );
}

{
  assert(
    "in-progress company step is not onboarding complete",
    loopsOnboardingComplete({
      onboardingStatus: "in_progress",
      onboardingStep: "company",
    }) === false
  );
  assert(
    "historical rates step is not onboarding complete",
    loopsOnboardingComplete({
      onboardingStatus: "in_progress",
      onboardingStep: "rates",
    }) === false
  );
  assert(
    "completed status is onboarding complete",
    loopsOnboardingComplete({
      onboardingStatus: "completed",
      onboardingStep: "completed",
    }) === true
  );
  assert(
    "work areas step is not yet onboarding complete",
    loopsOnboardingComplete({
      onboardingStatus: "in_progress",
      onboardingStep: "work_areas",
      hasPrimaryWorkAreas: true,
    }) === false
  );
}

{
  const now = new Date("2026-09-29T00:00:00.000Z");
  const trial = buildInternalTrialSubscription({
    id: "sub-1",
    orgId: "org-1",
    billingEnvironment: "test",
    now,
  });
  const active = loopsBillingFields({
    subscription: trial,
    activeOverride: null,
    now,
  });
  assert("active internal trial plan is business", active.plan === "business");
  assert("active internal trial status is trialing", active.subscriptionStatus === "trialing");
  assert("trial end is copied from the subscription row", active.trialEndsAt === trial.trialEndsAt);

  const expired = loopsBillingFields({
    subscription: trial,
    activeOverride: null,
    now: new Date("2026-12-01T00:00:00.000Z"),
  });
  assert("expired internal trial status is trial_expired", expired.subscriptionStatus === "trial_expired");
  assert("expired trial still reports the business plan", expired.plan === "business");

  const policy = resolveEffectiveAccessPolicy({
    subscription: null,
    activeOverride: null,
    now,
  });
  assert("uninitialized billing has no plan", policy.planCode === null);

  const override: OrgBillingOverride = {
    id: "ov-1",
    orgId: "org-1",
    billingEnvironment: "test",
    planCode: "custom",
    overrideType: "administratively_comped",
    status: "administratively_comped",
    paidSeatQuantity: 1,
    startsAt: now.toISOString(),
    expiresAt: null,
    reason: "preview",
    createdBy: null,
    operatorRef: "ops",
    createdAt: now.toISOString(),
  };
  const comped = loopsBillingFields({
    subscription: trial,
    activeOverride: override,
    now,
  });
  assert("override plan wins", comped.plan === "custom");
  assert(
    "comped override status is administratively_comped",
    comped.subscriptionStatus === "administratively_comped"
  );
}

{
  const properties = buildLoopsContactProperties(baseDraft);
  assert("maps user id and email", properties.userId === "user-1" && properties.email === "alex@example.com");
  assert("maps split name", properties.firstName === "Alex" && properties.lastName === "Smith");
  assert("maps company, country, region", properties.companyName === "Smith Building Co." && properties.country === "NZ" && properties.region === "Auckland");
  assert("maps counts and rates", properties.projectsCreated === 2 && properties.estimatesGenerated === 3 && properties.quotesSent === 1 && properties.quotesAccepted === 0 && properties.ratesConfigured === true);
  assert("default consent is false on the contact", properties.marketingConsent === false);
  assert(
    "the engagement marker stays off a routine contact",
    !("engagementEligible" in properties) &&
      buildLoopsContactProperties({ ...baseDraft, engagementEligible: true }).engagementEligible === true
  );
  assert("stage 1 gaps stay unset", contactPropertiesOmitStage1Gaps(properties));
  assert("contact payload does not include subscribed", !("subscribed" in properties));
  const allowed = new Set([
    "email",
    "userId",
    "marketingConsent",
    "firstName",
    "lastName",
    "companyName",
    "country",
    "region",
    "onboardingComplete",
    "plan",
    "subscriptionStatus",
    "trialEndsAt",
    "projectsCreated",
    "estimatesGenerated",
    "quotesSent",
    "quotesAccepted",
    "ratesConfigured",
  ]);
  assert(
    "contact payload stays within contact, consent, and lifecycle fields",
    Object.keys(properties).every((key) => allowed.has(key)) &&
      !("mailingLists" in properties) &&
      !("projectName" in properties) &&
      !("clientEmail" in properties) &&
      !("quoteTitle" in properties)
  );

  const hiddenCountry = buildLoopsContactProperties({
    ...baseDraft,
    countryExplicit: false,
    region: "  ",
    tradingName: "ERC Contracting",
  });
  assert("non-explicit country is omitted", hiddenCountry.country === undefined);
  assert("blank region is omitted", hiddenCountry.region === undefined);
  assert("trading name is companyName", hiddenCountry.companyName === "ERC Contracting");
}

{
  assert(
    "routine sync of an existing contact omits subscribed",
    loopsSubscribedField({
      mode: "routine",
      contactExists: true,
      marketingConsent: true,
    }) === undefined
  );
  assert(
    "routine create without consent sends subscribed false",
    loopsSubscribedField({
      mode: "routine",
      contactExists: false,
      marketingConsent: false,
    }) === false
  );
  assert(
    "explicit opt-in sends subscribed true",
    loopsSubscribedField({
      mode: "explicit_opt_in",
      contactExists: true,
      marketingConsent: true,
    }) === true
  );
  assert(
    "explicit opt-out sends subscribed false",
    loopsSubscribedField({
      mode: "explicit_opt_out",
      contactExists: true,
      marketingConsent: false,
    }) === false
  );
  assert(
    "routine sync of an opted-out existing contact omits subscribed",
    loopsSubscribedField({
      mode: "routine",
      contactExists: true,
      marketingConsent: false,
      preferencePending: false,
    }) === undefined
  );
  assert(
    "pending opt-out retry sends subscribed false",
    loopsSubscribedField({
      mode: "routine",
      contactExists: true,
      marketingConsent: false,
      preferencePending: true,
    }) === false
  );
  assert(
    "pending opt-in retry sends subscribed true",
    loopsSubscribedField({
      mode: "routine",
      contactExists: true,
      marketingConsent: true,
      preferencePending: true,
    }) === true
  );
  assert(
    "failed explicit opt-out remains pending",
    preferencePendingAfterLoopsAttempt({
      preferencePending: true,
      sentSubscribed: false,
      loopsAccepted: false,
      storedConsent: false,
      sentConsent: false,
    }) === true
  );
  assert(
    "failed explicit opt-in remains pending",
    preferencePendingAfterLoopsAttempt({
      preferencePending: true,
      sentSubscribed: true,
      loopsAccepted: false,
      storedConsent: true,
      sentConsent: true,
    }) === true
  );
  assert(
    "successful opt-out reconciliation clears pending",
    preferencePendingAfterLoopsAttempt({
      preferencePending: true,
      sentSubscribed: false,
      loopsAccepted: true,
      storedConsent: false,
      sentConsent: false,
    }) === false
  );
  assert(
    "matching revision clears a confirmed opt-out",
    loopsPreferenceAckDecision({
      preferencePending: true,
      sentSubscribed: false,
      loopsAccepted: true,
      skippedUnconfigured: false,
      sentConsent: false,
      sentRevision: 4,
      storedConsent: false,
      storedRevision: 4,
    }) === "clear"
  );
  assert(
    "failed acknowledgement does not clear or re-arm",
    loopsPreferenceAckDecision({
      preferencePending: true,
      sentSubscribed: false,
      loopsAccepted: false,
      skippedUnconfigured: false,
      sentConsent: false,
      sentRevision: 4,
      storedConsent: false,
      storedRevision: 4,
    }) === "skip"
  );
  assert(
    "newer revision after a subscribed send is re-armed",
    loopsPreferenceAckDecision({
      preferencePending: true,
      sentSubscribed: true,
      loopsAccepted: true,
      skippedUnconfigured: false,
      sentConsent: true,
      sentRevision: 4,
      storedConsent: false,
      storedRevision: 5,
    }) === "rearm"
  );
  assert(
    "newer revision after a routine update is not cleared or re-armed",
    loopsPreferenceAckDecision({
      preferencePending: false,
      sentSubscribed: undefined,
      loopsAccepted: true,
      skippedUnconfigured: false,
      sentConsent: true,
      sentRevision: 4,
      storedConsent: false,
      storedRevision: 5,
    }) === "skip"
  );
  assert(
    "unconfigured Loops does not clear pending",
    loopsPreferenceAckDecision({
      preferencePending: true,
      sentSubscribed: undefined,
      loopsAccepted: false,
      skippedUnconfigured: true,
      sentConsent: false,
      sentRevision: 4,
      storedConsent: false,
      storedRevision: 4,
    }) === "skip"
  );
  assert(
    "unset source is not an opt-out",
    emailPreferenceChoice({ marketingConsent: false, marketingConsentSource: null }) === "unset"
  );
  assert(
    "explicit opt-out stays distinct from unset",
    emailPreferenceChoice({ marketingConsent: false, marketingConsentSource: "settings" }) === "no"
  );
  assert(
    "explicit opt-in is yes",
    emailPreferenceChoice({ marketingConsent: true, marketingConsentSource: "signup" }) === "yes"
  );

  assert(
    "successful opt-in reconciliation clears pending",
    preferencePendingAfterLoopsAttempt({
      preferencePending: true,
      sentSubscribed: true,
      loopsAccepted: true,
      storedConsent: true,
      sentConsent: true,
    }) === false
  );
  assert(
    "a newer consent choice stays pending",
    preferencePendingAfterLoopsAttempt({
      preferencePending: true,
      sentSubscribed: false,
      loopsAccepted: true,
      storedConsent: true,
      sentConsent: false,
    }) === true
  );
  const cleared = buildLoopsContactProperties({
    ...baseDraft,
    fullName: "Jean-Luc",
  });
  assert(
    "single-token contact sends lastName null",
    cleared.firstName === "Jean-Luc" && cleared.lastName === null
  );
  const kept = buildLoopsContactProperties({
    ...baseDraft,
    fullName: "Jean-Luc Ellis",
  });
  assert("multi-token contact keeps lastName", kept.lastName === "Ellis");
}

async function main(): Promise<void> {
  const bodies: Array<Record<string, unknown>> = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    if (init?.body) bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    if (url.includes("/contacts/find")) {
      return { ok: true, status: 200, json: async () => [{ id: "existing" }] };
    }
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  };
  const properties = buildLoopsContactProperties(baseDraft);
  const routine = await upsertLoopsContact({
    properties,
    mode: "routine",
    marketingConsent: false,
    apiKey: "test-key",
    fetchImpl,
  });
  assert("routine upsert succeeds", routine.ok === true);
  assert(
    "routine update of an existing contact does not send subscribed",
    bodies.length === 1 && !("subscribed" in bodies[0])
  );

  bodies.length = 0;
  const missingFetch = async (url: string, init?: RequestInit) => {
    if (init?.body) bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    if (url.includes("/contacts/find")) {
      return { ok: true, status: 200, json: async () => [] };
    }
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  };
  await upsertLoopsContact({
    properties,
    mode: "routine",
    marketingConsent: false,
    apiKey: "test-key",
    fetchImpl: missingFetch,
  });
  assert(
    "first create without consent sends subscribed false",
    bodies[0]?.subscribed === false
  );

  const optOut = await upsertLoopsContact({
    properties,
    mode: "explicit_opt_out",
    marketingConsent: false,
    apiKey: "test-key",
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
  });
  assert("explicit opt-out succeeds", optOut.ok === true);
  assert("explicit opt-out body sets subscribed false", bodies.at(-1)?.subscribed === false);

  const failed = await upsertLoopsContact({
    properties,
    mode: "explicit_opt_in",
    marketingConsent: true,
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new Error("loops down user@example.com");
    },
  });
  assert("Loops network failure does not throw", failed.ok === false && failed.code === "network");

  const skipped = await upsertLoopsContact({
    properties,
    mode: "routine",
    marketingConsent: false,
    apiKey: null,
    fetchImpl: async () => {
      throw new Error("should not be called");
    },
  });
  assert("missing API key skips without calling Loops", skipped.ok === true && skipped.skipped === "unconfigured");

  let updateCalls = 0;
  const findFailed = await upsertLoopsContact({
    properties,
    mode: "routine",
    marketingConsent: false,
    apiKey: "test-key",
    fetchImpl: async (url) => {
      if (url.includes("/contacts/update")) updateCalls += 1;
      return { ok: false, status: 500, json: async () => ({}) };
    },
  });
  assert("routine find failure does not update the contact", findFailed.ok === false && updateCalls === 0);

  const optInBodies: Array<Record<string, unknown>> = [];
  const optIn = await upsertLoopsContact({
    properties: { ...properties, marketingConsent: true },
    mode: "explicit_opt_in",
    marketingConsent: true,
    apiKey: "test-key",
    fetchImpl: async (_url, init) => {
      optInBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
  });
  assert("explicit opt-in succeeds", optIn.ok === true);
  assert("explicit opt-in body sets subscribed true", optInBodies[0]?.subscribed === true);

  const renameBodies: Array<Record<string, unknown>> = [];
  const renamed = await upsertLoopsContact({
    properties: buildLoopsContactProperties({ ...baseDraft, fullName: "Jean-Luc" }),
    mode: "routine",
    marketingConsent: false,
    preferencePending: false,
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      if (init?.body) renameBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      if (url.includes("/contacts/find")) {
        return { ok: true, status: 200, json: async () => [{ id: "existing", lastName: "Ellis" }] };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
  });
  assert("single-token rename upsert succeeds", renamed.ok === true);
  assert(
    "single-token rename clears lastName with JSON null",
    renameBodies[0]?.firstName === "Jean-Luc" &&
      Object.prototype.hasOwnProperty.call(renameBodies[0] ?? {}, "lastName") &&
      renameBodies[0]?.lastName === null
  );
  assert(
    "single-token rename does not re-subscribe",
    !("subscribed" in (renameBodies[0] ?? {}))
  );

  const pendingBodies: Array<Record<string, unknown>> = [];
  const pendingOptOut = await upsertLoopsContact({
    properties: buildLoopsContactProperties(baseDraft),
    mode: "routine",
    marketingConsent: false,
    preferencePending: true,
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      if (init?.body) pendingBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      if (url.includes("/contacts/find")) {
        return { ok: true, status: 200, json: async () => [{ id: "existing" }] };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
  });
  assert("pending opt-out reconciliation upsert succeeds", pendingOptOut.ok === true && pendingOptOut.sentSubscribed === false);
  assert(
    "pending opt-out reconciliation sends subscribed false",
    pendingBodies[0]?.subscribed === false
  );

  const emailFindBodies: Array<Record<string, unknown>> = [];
  let emailFinds = 0;
  const existingByEmail = await upsertLoopsContact({
    properties: buildLoopsContactProperties({ ...baseDraft, marketingConsent: true }),
    mode: "routine",
    marketingConsent: true,
    preferencePending: false,
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      if (url.includes("/contacts/find")) {
        emailFinds += 1;
        if (url.includes("userId=")) {
          return { ok: true, status: 200, json: async () => [] };
        }
        return { ok: true, status: 200, json: async () => [{ id: "by-email", subscribed: false }] };
      }
      if (init?.body) {
        emailFindBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      }
      return { ok: true, status: 200, json: async () => ({ success: true, id: "by-email" }) };
    },
  });
  assert("email find runs when user id is missing", existingByEmail.ok === true && emailFinds === 2);
  assert(
    "routine update of an email-matched contact does not resubscribe",
    existingByEmail.sentSubscribed === undefined && !("subscribed" in (emailFindBodies[0] ?? {}))
  );

  const rejected = await upsertLoopsContact({
    properties: buildLoopsContactProperties(baseDraft),
    mode: "explicit_opt_out",
    marketingConsent: false,
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: false, message: "rejected" }),
    }),
  });
  assert(
    "Loops acknowledgement requires success true",
    rejected.ok === false && rejected.code === "update_rejected"
  );

  const failedOptOut = await upsertLoopsContact({
    properties: buildLoopsContactProperties(baseDraft),
    mode: "explicit_opt_out",
    marketingConsent: false,
    preferencePending: true,
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new Error("loops unavailable");
    },
  });
  assert(
    "failed explicit opt-out does not throw",
    failedOptOut.ok === false
  );
  assert(
    "failed explicit opt-out does not clear pending",
    preferencePendingAfterLoopsAttempt({
      preferencePending: true,
      sentSubscribed: false,
      loopsAccepted: failedOptOut.ok,
      storedConsent: false,
      sentConsent: false,
    }) === true
  );

  const logs: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args);
  };
  await runIsolatedLoopsTask(async () => {
    throw new Error("loops failed for alex@example.com sk_live_secret");
  });
  console.error = original;
  const serialized = JSON.stringify(logs);
  assert("isolated Loops failure does not throw", true);
  assert("failure log omits email and secrets", !serialized.includes("alex@") && !serialized.includes("sk_live"));

  const provisioning = read("lib/auth/provisioning.ts");
  assert(
    "provisioning records signup choices without calling Loops",
    provisioning.includes("recordSignupPreferences") &&
      !provisioning.includes("recordSignupConsentAndSync") &&
      !provisioning.includes("loops") &&
      !provisioning.includes("@/lib/communications")
  );
  const syncSourceEarly = read("lib/communications/sync.ts");
  assert(
    "contact sync is wrapped so Loops cannot fail the caller",
    syncSourceEarly.includes("runIsolatedLoopsTask")
  );
}

let overlapCheck: Promise<unknown> = Promise.resolve();

{
  const migration = read("supabase/migrations/074_marketing_consent.sql");
  assert("consent defaults false", /marketing_consent boolean not null default false/.test(migration));
  assert("consent timestamp is nullable", /marketing_consent_at timestamptz/.test(migration));
  assert(
    "opt-in timestamp constraint rejects a true flag without a timestamp",
    /marketing_consent = true and marketing_consent_at is not null/.test(migration)
  );
  assert("consent write is limited to auth.uid()", /where id = v_uid/.test(migration));
  assert("anon cannot execute consent RPC", /revoke all on function public\.set_own_marketing_consent/.test(migration));

  const communicationsDir = join(process.cwd(), "lib", "communications");
  const communicationsSource = walk(communicationsDir)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  assert(
    "Loops integration does not read organisations.subscription_tier",
    !communicationsSource.includes("subscription_tier")
  );

  const signup = read("components/auth/SignupForm.tsx");
  assert(
    "signup still asks for an explicit product-update choice",
    signup.includes("Would you like occasional product updates and practical Quotr tips?") &&
      signup.includes("Yes, send me updates") &&
      signup.includes("No thanks")
  );

  const profile = read("components/profile/ProfilePageContent.tsx");
  assert("profile has Email preferences", profile.includes("Email preferences"));
  assert("profile uses the product-update label", profile.includes("EMAIL_PREFERENCE_LABEL") && EMAIL_PREFERENCE_LABEL === "Send me occasional product updates and practical Quotr tips.");
  assert("profile helper separates service email", profile.includes("EMAIL_PREFERENCE_HELPER") && EMAIL_PREFERENCE_HELPER.includes("Account, security, and service emails are separate."));
  const help = read("lib/help/content.ts");
  const privacy = read("app/(legal)/privacy/page.tsx");
  assert(
    "help and privacy name Profile email preferences and say campaigns have not started",
    help.includes("Profile** → **Email preferences") &&
      help.includes("Campaign sending has not started.") &&
      privacy.includes("Profile → Email preferences") &&
      privacy.includes("Campaign sending has not started.")
  );
  assert("profile shows saving and saved feedback", profile.includes("Saving…") && profile.includes("Save preference"));
  assert("profile keeps an unset choice visible", profile.includes("No choice saved yet."));

  const example = read(".env.local.example");
  assert("example documents LOOPS_API_KEY", example.includes("LOOPS_API_KEY="));
  assert("example does not publish the Loops key", !example.includes("NEXT_PUBLIC_LOOPS_API_KEY="));

  const clientViolations: string[] = [];
  for (const dir of ["components", "app"]) {
    for (const file of walk(join(process.cwd(), dir))) {
      const source = readFileSync(file, "utf8");
      if (source.includes('"use server"') || source.includes("'use server'")) continue;
      const normalised = file.replaceAll("\\", "/");
      if (normalised.includes("/app/api/") && normalised.endsWith("/route.ts")) continue;
      if (
        source.includes("LOOPS_API_KEY") ||
        source.includes("app.loops.so") ||
        source.includes("@/lib/communications/loops-client") ||
        source.includes("@/lib/communications/sync")
      ) {
        clientViolations.push(file);
      }
    }
  }
  assert(
    clientViolations.length === 0
      ? "client modules do not reference the Loops API key or client"
      : `client Loops exposure: ${clientViolations.join(", ")}`,
    clientViolations.length === 0
  );

  const syncSource = read("lib/communications/sync.ts");
  assert("sync module is server-only", syncSource.includes('import "server-only"'));
  assert(
    "sync acknowledges the sent revision",
    syncSource.includes("acknowledge_own_marketing_loops_sync") &&
      syncSource.includes("p_revision") &&
      syncSource.includes("rearm_own_marketing_loops_sync")
  );
  assert(
    "organisation sync does not import members who are not pending",
    syncSource.includes("marketing_loops_sync_pending !== true) continue")
  );
  const actions = read("app/(auth)/actions.ts");
  const preferences = read("lib/auth/signup-preferences.ts");
  const welcome = read("lib/auth/account-welcome-delivery.ts");
  assert(
    "signup response does not call Loops",
    !actions.includes("@/lib/communications") &&
      !actions.includes("loops.so") &&
      preferences.includes('p_source: "signup"') &&
      !preferences.includes("syncSessionUser") &&
      !preferences.includes("loops.so") &&
      !welcome.includes("loops") &&
      !welcome.includes("marketing_consent")
  );

  const pendingMigration = read("supabase/migrations/075_marketing_loops_sync_pending.sql");
  assert(
    "pending preference defaults false",
    /marketing_loops_sync_pending boolean not null default false/.test(pendingMigration)
  );
  assert(
    "explicit consent write marks Loops sync pending",
    /marketing_loops_sync_pending = true/.test(pendingMigration)
  );
  assert(
    "acknowledgement matches the stored consent",
    /marketing_consent = p_consent/.test(pendingMigration) &&
      /acknowledge_own_marketing_loops_sync/.test(pendingMigration)
  );
  assert(
    "authenticated clients cannot change the pending flag",
    /marketing_loops_sync_pending is distinct from old\.marketing_loops_sync_pending/.test(
      pendingMigration
    )
  );

  const consentAction = read("lib/communications/consent-actions.ts");
  assert(
    "preference save returns success after the Loops attempt",
    /set_own_marketing_consent[\s\S]*syncSessionUser[\s\S]*return \{ success: "Preference saved\." \}/.test(
      consentAction
    )
  );
  assert(
    "an unset choice can still be saved as an explicit opt-out",
    consentAction.includes("isMarketingConsentSource") &&
      consentAction.includes('p_source: "settings"')
  );
  assert(
    "profile stays available when billing is restricted",
    read("lib/setup/first-run-stage.ts").includes('path === "/app/profile"') &&
      !read("app/(protected)/app/profile/page.tsx").includes("entitlementDeniedError")
  );
  const revisionMigration = read("supabase/migrations/115_marketing_consent_revision.sql");
  assert(
    "acknowledgement matches consent and revision",
    /marketing_consent = p_consent/.test(revisionMigration) &&
      /marketing_consent_revision = p_revision/.test(revisionMigration) &&
      /marketing_consent_revision = marketing_consent_revision \+ 1/.test(revisionMigration)
  );
  assert(
    "stale send can re-arm pending and cannot clear a newer revision",
    revisionMigration.includes("rearm_own_marketing_loops_sync") &&
      revisionMigration.includes("marketing_consent_revision is distinct from p_revision")
  );
  const operator = read("scripts/sync-preview-marketing-loops.ts");
  const productionOperator = read("scripts/sync-production-marketing-loops.ts");
  const pendingSync = read("lib/communications/pending-sync.ts");
  assert(
    "operator sync is preview-only and pending-only",
    operator.includes("Refusing Loops sync") &&
      operator.includes("shhpjsoldmqtkdbgrbtm") &&
      operator.includes("lxvnylhsbvudzzupxeqr") &&
      operator.includes("--yes") &&
      pendingSync.includes('eq("marketing_loops_sync_pending", true)') &&
      !pendingSync.includes("/campaigns") &&
      !pendingSync.includes("/events")
  );
  assert(
    "production operator sync requires one email and ignores .env.local",
    productionOperator.includes("lxvnylhsbvudzzupxeqr") &&
      productionOperator.includes("without one --email") &&
      productionOperator.includes("email,") &&
      productionOperator.includes("Does not load .env.local") &&
      !productionOperator.includes("parseEnvFile") &&
      !productionOperator.includes("shhpjsoldmqtkdbgrbtm")
  );
  assert(
    "preference save does not surface a Loops failure",
    !consentAction.includes("Could not sync") &&
      !/return \{ error:[^}]*[Ll]oops/.test(consentAction)
  );

  const confirmation = read("lib/auth/finish-email-confirmation.ts");
  const signupSync = read("lib/communications/signup-sync.ts");
  const retryRoute = read("app/api/internal/marketing-loops-retry/route.ts");
  const leaseMigration = read("supabase/migrations/116_marketing_loops_sync_lease.sql");
  const retryMigration = read("supabase/migrations/117_marketing_loops_retry_schedule.sql");
  const engagementMigration = read("supabase/migrations/118_marketing_engagement_marker.sql");
  const engagementSync = read("lib/communications/engagement.ts");
  const sessionSync = read("lib/communications/sync.ts");
  assert(
    "confirmed signup is eligible and an unconfirmed signup is not",
    confirmedSignupLoopsEligible({
      emailConfirmed: true,
      newlyProvisioned: true,
      destination: "/app/setup",
    }) &&
      !confirmedSignupLoopsEligible({
        emailConfirmed: false,
        newlyProvisioned: true,
        destination: "/app/setup",
      }) &&
      !confirmedSignupLoopsEligible({
        emailConfirmed: true,
        newlyProvisioned: false,
        destination: "/app/setup",
      })
  );
  assert(
    "preview automation allows only the test address and production refuses the preview database",
    marketingLoopsScope({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: "https://shhpjsoldmqtkdbgrbtm.supabase.co",
    }) === "preview" &&
      marketingLoopsAllowsEmail("preview", PREVIEW_LOOPS_TEST_EMAIL) &&
      !marketingLoopsAllowsEmail("preview", "someoneelse@erccontracting.co.nz") &&
      marketingLoopsScope({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://shhpjsoldmqtkdbgrbtm.supabase.co",
      }) === "off" &&
      marketingLoopsScope({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://lxvnylhsbvudzzupxeqr.supabase.co",
      }) === "production"
  );
  const activated = "2026-10-22T00:00:00.000Z";
  const afterActivation = "2026-10-22T00:00:01.000Z";
  assert(
    "the engagement marker is production-only and only for new explicit consent after activation",
    loopsEngagementEligibleUpdate({
      scope: "production",
      activatedAt: activated,
      consent: true,
      consentSource: "signup",
      consentAt: afterActivation,
      alreadyEligible: false,
    }) &&
      !loopsEngagementEligibleUpdate({
        scope: "preview",
        activatedAt: activated,
        consent: true,
        consentSource: "signup",
        consentAt: afterActivation,
        alreadyEligible: false,
      }) &&
      !loopsEngagementEligibleUpdate({
        scope: "production",
        activatedAt: null,
        consent: true,
        consentSource: "settings",
        consentAt: afterActivation,
        alreadyEligible: false,
      }) &&
      !loopsEngagementEligibleUpdate({
        scope: "production",
        activatedAt: activated,
        consent: true,
        consentSource: "signup",
        consentAt: "2026-10-21T23:59:59.000Z",
        alreadyEligible: false,
      }) &&
      !loopsEngagementEligibleUpdate({
        scope: "production",
        activatedAt: activated,
        consent: true,
        consentSource: null,
        consentAt: afterActivation,
        alreadyEligible: false,
      }) &&
      !loopsEngagementEligibleUpdate({
        scope: "production",
        activatedAt: activated,
        consent: false,
        consentSource: "onboarding",
        consentAt: afterActivation,
        alreadyEligible: false,
      }) &&
      !loopsEngagementEligibleUpdate({
        scope: "production",
        activatedAt: activated,
        consent: true,
        consentSource: "signup",
        consentAt: afterActivation,
        alreadyEligible: true,
      }) &&
      !engagementSync.includes("projectsCreated") &&
      engagementMigration.includes("activated_at timestamptz") &&
      engagementMigration.includes("values (true, null)") &&
      !engagementMigration.includes("clock_timestamp()") &&
      engagementMigration.includes("marketing_engagement_eligible boolean not null default false") &&
      !engagementMigration.includes("set marketing_engagement_eligible = true")
  );
  const failedRetry = pendingSync.indexOf("if (!upsert.ok)");
  const recordedRetry = pendingSync.indexOf("await recordEngagementMarker");
  assert(
    "a failed retry does not record enrolment and a successful send records it once",
    failedRetry >= 0 &&
      recordedRetry > failedRetry &&
      pendingSync.slice(failedRetry, recordedRetry).includes('return "failed"') &&
      pendingSync.includes('upsert.skipped !== "unconfigured"') &&
      sessionSync.includes('result.skipped !== "unconfigured"') &&
      !pendingSync.includes("engagementEligible: false") &&
      !sessionSync.includes("engagementEligible: false")
  );
  assert(
    "existing pending rows stay outside the scheduled retry until the flag is set",
    !marketingLoopsRetriesExistingPending({}) &&
      marketingLoopsRetriesExistingPending({ MARKETING_LOOPS_RETRY_EXISTING: "true" }) &&
      leaseMigration.includes("marketing_loops_auto_retry boolean not null default false") &&
      retryRoute.includes("autoRetryOnly: !includeExisting")
  );
  assert(
    "confirmation schedules Loops after the response and keeps welcome independent",
    confirmation.includes("scheduleConfirmedSignupLoopsSync") &&
      confirmation.includes("scheduleAccountWelcomeEmail") &&
      !confirmation.includes("upsertLoopsContact") &&
      !confirmation.includes("app.loops.so") &&
      signupSync.includes("after(async () =>") &&
      !signupSync.includes("account-welcome") &&
      !welcome.includes("loops") &&
      !welcome.includes("marketing_consent")
  );
  assert(
    "supabase cron replaces the daily Vercel schedule",
    retryMigration.includes(MARKETING_LOOPS_RETRY_SCHEDULE) &&
      retryMigration.includes("vault.decrypted_secrets") &&
      !retryMigration.includes("app.get-quotr.com") &&
      !retryMigration.includes("vercel.app") &&
      !retryMigration.includes("Bearer sk") &&
      retryRoute.includes("scheduled: true") &&
      retryRoute.includes("CRON_SECRET") &&
      !existsVercelCron()
  );
  assert(
    "opt-outs go first, a wave stops before the timeout, and permanent errors stop",
    compareLoopsRetryPriority(
      { marketingConsent: false, attempts: 3 },
      { marketingConsent: true, attempts: 0 }
    ) < 0 &&
      planLoopsRetryWave({ elapsedMs: 0, remaining: 8 }) === MARKETING_LOOPS_RETRY_CONCURRENCY &&
      planLoopsRetryWave({ elapsedMs: 1_000, remaining: 8 }) === 0 &&
      MARKETING_LOOPS_RETRY_BATCH === 8 &&
      loopsRetryDisposition("update_400") === "permanent" &&
      loopsRetryDisposition("update_429") === "transient" &&
      loopsRetryDisposition("network") === "transient" &&
      loopsRetryBackoffMs(1) === 5 * 60 * 1000 &&
      loopsRetryBackoffMs(2) === 10 * 60 * 1000 &&
      loopsRetryBackoffMs(MARKETING_LOOPS_RETRY_ATTEMPT_CAP) <= 6 * 60 * 60 * 1000 &&
      !cronAuthorizationMatches("short", "Bearer short") &&
      !cronAuthorizationMatches("1234567890123456", null) &&
      !cronAuthorizationMatches("1234567890123456", "Bearer 1234567890123457") &&
      cronAuthorizationMatches("1234567890123456", "Bearer 1234567890123456")
  );
  let heldRevision: number | null = null;
  let sends = 0;
  overlapCheck = Promise.all([
    withConsentLease({
      claim: async () => {
        if (heldRevision === 4) return false;
        heldRevision = 4;
        return true;
      },
      release: async () => {
        if (heldRevision === 4) heldRevision = null;
      },
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        sends += 1;
        return "sent";
      },
    }),
    withConsentLease({
      claim: async () => {
        if (heldRevision === 4) return false;
        heldRevision = 4;
        return true;
      },
      release: async () => {
        if (heldRevision === 4) heldRevision = null;
      },
      run: async () => {
        sends += 1;
        return "sent";
      },
    }),
  ]).then(() => {
    assert("overlapping workers do not send the same consent revision", sends === 1);
  });
  const stale = loopsPreferenceAckDecision({
    preferencePending: true,
    sentSubscribed: false,
    loopsAccepted: true,
    skippedUnconfigured: false,
    sentConsent: false,
    sentRevision: 2,
    storedConsent: true,
    storedRevision: 3,
  });
  assert("a failed opt-out retry still sends subscribed false", loopsSubscribedField({
    mode: "routine",
    contactExists: true,
    marketingConsent: false,
    preferencePending: true,
  }) === false);
  assert("a stale revision is re-armed and a routine update still omits subscribed", stale === "rearm" && loopsSubscribedField({
    mode: "routine",
    contactExists: true,
    marketingConsent: true,
    preferencePending: false,
  }) === undefined);

  const webhook = read("lib/billing/webhook-http.ts");
  assert(
    "Stripe webhook still processes the billing event",
    webhook.includes("processBillingStripeEvent")
  );
  assert(
    "Stripe webhook does not call Loops",
    !webhook.includes("syncOrganisationContacts") &&
      !webhook.includes("LOOPS_API_KEY") &&
      !webhook.includes("app.loops.so") &&
      !webhook.includes("@/lib/communications")
  );
}

void Promise.all([main(), overlapCheck]).then(() => {
  if (!process.exitCode) {
    console.log("\nLoops communications checks passed.");
  }
});
