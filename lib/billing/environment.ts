import {
  BILLING_ENVIRONMENTS,
  type BillingEnvironment,
} from "@/lib/billing/types";

export type BillingEnvironmentInput = Readonly<
  Record<string, string | undefined>
>;

function vercelEnv(env: BillingEnvironmentInput): string | undefined {
  return env.VERCEL_ENV?.trim() || undefined;
}

function explicitBillingEnvironment(
  env: BillingEnvironmentInput
): string | undefined {
  const raw = env.BILLING_ENVIRONMENT?.trim();
  return raw || undefined;
}

function isBillingEnvironment(value: string): value is BillingEnvironment {
  return (BILLING_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Canonical server-only billing environment.
 *
 * Authority is explicit `BILLING_ENVIRONMENT` (`test` | `live`).
 * `VERCEL_ENV` is a mismatch guard only — never the sole inference source
 * on hosted deployments.
 *
 * Local: unset → test. Explicit non-test / unknown → fail closed.
 * Hosted preview: must be test. Hosted production: must be live.
 */
export function resolveBillingEnvironment(
  env: BillingEnvironmentInput = process.env
): BillingEnvironment {
  const explicit = explicitBillingEnvironment(env);
  const hosted = vercelEnv(env);

  if (hosted === "production") {
    if (explicit !== "live") {
      throw new Error(
        "Hosted production requires explicit BILLING_ENVIRONMENT=live."
      );
    }
    return "live";
  }

  if (hosted === "preview") {
    if (explicit !== "test") {
      throw new Error(
        "Hosted preview requires explicit BILLING_ENVIRONMENT=test."
      );
    }
    return "test";
  }

  if (!explicit) {
    return "test";
  }

  if (!isBillingEnvironment(explicit)) {
    throw new Error(`Unknown BILLING_ENVIRONMENT: ${explicit}`);
  }

  if (explicit === "live") {
    throw new Error("Local development cannot use BILLING_ENVIRONMENT=live.");
  }

  return "test";
}

export function stripeLivemodeForEnvironment(
  billingEnvironment: BillingEnvironment
): boolean {
  return billingEnvironment === "live";
}

export function eventMatchesBillingEnvironment(
  billingEnvironment: BillingEnvironment,
  livemode: boolean
): boolean {
  return livemode === stripeLivemodeForEnvironment(billingEnvironment);
}
