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

const SERVER_ENV_CHECKS: EnvCheck[] = [
  { name: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY, required: false },
  { name: "ANTHROPIC_API_KEY", value: process.env.ANTHROPIC_API_KEY, required: false },
  { name: "ANTHROPIC_MODEL", value: process.env.ANTHROPIC_MODEL, required: false },
  {
    name: "NEXT_PUBLIC_FEEDBACK_EMAIL",
    value: process.env.NEXT_PUBLIC_FEEDBACK_EMAIL,
    required: false,
  },
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

assertEnvSafety();
assertRequiredEnv();
