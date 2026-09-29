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
  loopsSubscribedField,
  preferencePendingAfterLoopsAttempt,
  splitFullName,
} from "../lib/communications/contact-mapping";
import {
  runIsolatedLoopsTask,
  upsertLoopsContact,
} from "../lib/communications/loops-client";

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
    "pricing visited (rates) is onboarding complete",
    loopsOnboardingComplete({
      onboardingStatus: "in_progress",
      onboardingStep: "rates",
    }) === true
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
  assert("stage 1 gaps stay unset", contactPropertiesOmitStage1Gaps(properties));
  assert("contact payload does not include subscribed", !("subscribed" in properties));

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
    "provisioning isolates signup sync",
    provisioning.includes("recordSignupConsentAndSync")
  );
  const syncSourceEarly = read("lib/communications/sync.ts");
  assert(
    "contact sync is wrapped so Loops cannot fail the caller",
    syncSourceEarly.includes("runIsolatedLoopsTask")
  );
}

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
  assert("signup checkbox is optional", signup.includes('name="marketing_consent"') && signup.includes('type="checkbox"'));
  assert(
    "signup checkbox is not required",
    !/marketing_consent[\s\S]{0,180}required/.test(signup)
  );

  const profile = read("components/profile/ProfilePageContent.tsx");
  assert("profile preference uses the same label", profile.includes("Keep me updated about Quotr"));
  assert("profile section title matches the spec", profile.includes("Product & community updates"));

  const example = read(".env.local.example");
  assert("example documents LOOPS_API_KEY", example.includes("LOOPS_API_KEY="));
  assert("example does not publish the Loops key", !example.includes("NEXT_PUBLIC_LOOPS_API_KEY="));

  const clientViolations: string[] = [];
  for (const dir of ["components", "app"]) {
    for (const file of walk(join(process.cwd(), dir))) {
      const source = readFileSync(file, "utf8");
      if (source.includes('"use server"') || source.includes("'use server'")) continue;
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
  const actions = read("app/(auth)/actions.ts");
  assert("signup stores the checkbox in auth metadata", actions.includes("marketing_consent: marketing_consent === true"));
  assert("unchecked signup is false", actions.includes('marketingConsentValue === "true"'));

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
    "preference save does not surface a Loops failure",
    !consentAction.includes("Could not sync") &&
      !/return \{ error:[^}]*[Ll]oops/.test(consentAction)
  );

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

void main().then(() => {
  if (!process.exitCode) {
    console.log("\nLoops communications checks passed.");
  }
});
