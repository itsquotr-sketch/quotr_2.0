/**
 * Server-runtime configuration helpers (Stage 3.1C.1A / 3.1C.1B).
 *
 * After 3.1C.1B, normal signup provisioning uses an authenticated RPC and does
 * NOT require SUPABASE_SERVICE_ROLE_KEY.
 *
 * Service-role remains optional at boot (`lib/env.ts`) and may still be used
 * by server-only admin tooling / local verification scripts via
 * `lib/supabase/admin.ts`.
 *
 * Never log secret values.
 */

import type { AuthErrorCategory } from "@/lib/auth/errors";

export type AdminConfigInput = {
  supabaseUrl?: string | null;
  serviceRoleKey?: string | null;
};

export type AdminConfigOk = { ok: true };

export type AdminConfigFailure = {
  ok: false;
  category: Extract<AuthErrorCategory, "CONFIGURATION">;
  /** Internal diagnostic — names missing config keys only; never values. */
  diagnostic: string;
  missing: readonly string[];
};

export type AdminConfigResult = AdminConfigOk | AdminConfigFailure;

/**
 * Pure evaluator for service-role admin paths (not required for signup RPC).
 */
export function evaluateAdminServerConfiguration(
  env: AdminConfigInput
): AdminConfigResult {
  const missing: string[] = [];

  if (!env.supabaseUrl?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!env.serviceRoleKey?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    category: "CONFIGURATION",
    diagnostic: `Admin server configuration incomplete: missing ${missing.join(", ")}`,
    missing,
  };
}

/**
 * Runtime assertion before createAdminClient / privileged admin operations.
 * Not used by transactional signup provisioning (3.1C.1B).
 */
export function assertAdminServerConfiguration(): AdminConfigResult {
  return evaluateAdminServerConfiguration({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

/**
 * @deprecated Prefer {@link assertAdminServerConfiguration}. Kept as an alias
 * so Stage 3.1C.1A references remain discoverable; signup no longer calls this.
 */
export function assertSignupServerConfiguration(): AdminConfigResult {
  return assertAdminServerConfiguration();
}

/**
 * @deprecated Prefer {@link evaluateAdminServerConfiguration}.
 */
export function evaluateSignupServerConfiguration(
  env: AdminConfigInput
): AdminConfigResult {
  return evaluateAdminServerConfiguration(env);
}
