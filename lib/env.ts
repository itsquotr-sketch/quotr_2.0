import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  supabaseProjectRefFromUrl,
} from "@/lib/deployment/environment";

type EnvCheck = {
  name: string;
  value: string | undefined;
  required: boolean;
};

const PUBLIC_ENV_CHECKS: EnvCheck[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL, required: true },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    required: true,
  },
];

/**
 * Server env remains optional at build/boot so Vercel Preview can compile
 * without every secret present. After Stage 3.1C.1B, signup provisioning uses
 * an authenticated RPC and does not require SUPABASE_SERVICE_ROLE_KEY.
 * Service-role may still be needed for admin/ops tooling — see
 * `assertAdminServerConfiguration()` in `lib/auth/config.ts`.
 * Do NOT expose the service-role key as NEXT_PUBLIC_*.
 */
const SERVER_ENV_CHECKS: EnvCheck[] = [
  { name: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY, required: false },
  { name: "ANTHROPIC_API_KEY", value: process.env.ANTHROPIC_API_KEY, required: false },
  { name: "ANTHROPIC_MODEL", value: process.env.ANTHROPIC_MODEL, required: false },
  {
    name: "NEXT_PUBLIC_FEEDBACK_EMAIL",
    value: process.env.NEXT_PUBLIC_FEEDBACK_EMAIL,
    required: false,
  },
  { name: "BILLING_ENVIRONMENT", value: process.env.BILLING_ENVIRONMENT, required: false },
  { name: "STRIPE_SECRET_KEY", value: process.env.STRIPE_SECRET_KEY, required: false },
  { name: "STRIPE_WEBHOOK_SECRET", value: process.env.STRIPE_WEBHOOK_SECRET, required: false },
  { name: "RESEND_FROM_EMAIL", value: process.env.RESEND_FROM_EMAIL, required: false },
  { name: "RESEND_TEAM_FROM_EMAIL", value: process.env.RESEND_TEAM_FROM_EMAIL, required: false },
  { name: "RESEND_QUOTE_FROM_EMAIL", value: process.env.RESEND_QUOTE_FROM_EMAIL, required: false },
];

function formatMissing(checks: EnvCheck[]): string[] {
  return checks
    .filter((check) => check.required && !check.value?.trim())
    .map((check) => check.name);
}

/**
 * Validates required environment variables. Throws in production build/runtime
 * when critical public Supabase vars are missing.
 */
export function assertRequiredEnv(): void {
  const missing = formatMissing(PUBLIC_ENV_CHECKS);

  if (missing.length === 0) {
    return;
  }

  const message = `Missing required environment variables: ${missing.join(", ")}. See .env.local.example and docs/PRODUCTION_READINESS.md.`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }

  console.warn(`[env] ${message}`);
}

export function getEnvSummary(): {
  publicConfigured: string[];
  publicMissing: string[];
  serverConfigured: string[];
  serverMissing: string[];
} {
  const summarize = (checks: EnvCheck[]) => ({
    configured: checks.filter((c) => Boolean(c.value?.trim())).map((c) => c.name),
    missing: formatMissing(checks),
  });

  const pub = summarize(PUBLIC_ENV_CHECKS);
  const server = summarize(SERVER_ENV_CHECKS);

  return {
    publicConfigured: pub.configured,
    publicMissing: pub.missing,
    serverConfigured: server.configured,
    serverMissing: server.missing,
  };
}

const FORBIDDEN_PUBLIC_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE",
  "NEXT_PUBLIC_SUPABASE_SERVICE",
  "NEXT_PUBLIC_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_WEBHOOK_SECRET",
];

export function assertEnvSafety(): void {
  for (const name of FORBIDDEN_PUBLIC_ENV_NAMES) {
    if (process.env[name]) {
      throw new Error(
        `Forbidden environment variable ${name}. Service role keys must never be exposed to the browser.`
      );
    }
  }
}

/**
 * Local `next dev` must not silently use Production Supabase.
 * Hosted Vercel Preview/Production skip this check (they use their own env).
 */
export function assertLocalNotProductionSupabase(): void {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "preview" || vercelEnv === "production") {
    return;
  }

  const ref = supabaseProjectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error(
      "Local development must not use Production Supabase (lxvnylhsbvudzzupxeqr). Point .env.local at `supabase start` (http://127.0.0.1:54321) or the Preview project shhpjsoldmqtkdbgrbtm. See docs/architecture/QUOTR_ENVIRONMENT_ARCHITECTURE.md."
    );
  }
}

assertEnvSafety();
assertRequiredEnv();
assertLocalNotProductionSupabase();
