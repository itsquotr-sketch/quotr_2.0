/**
 * Server-runtime configuration contract for signup provisioning (Stage 3.1C.1A).
 *
 * Public env validation in `lib/env.ts` stays unchanged so Preview can still
 * build when the service-role key is absent. Signup must fail closed at
 * runtime before privileged provisioning begins.
 *
 * Never log secret values.
 */

import type { AuthErrorCategory } from "@/lib/auth/errors";

export type SignupConfigInput = {
  supabaseUrl?: string | null;
  serviceRoleKey?: string | null;
};

export type SignupConfigOk = { ok: true };

export type SignupConfigFailure = {
  ok: false;
  category: Extract<AuthErrorCategory, "CONFIGURATION">;
  /** Internal diagnostic — names missing config keys only; never values. */
  diagnostic: string;
  missing: readonly string[];
};

export type SignupConfigResult = SignupConfigOk | SignupConfigFailure;

/**
 * Pure evaluator — safe to unit-test without mutating process.env.
 */
export function evaluateSignupServerConfiguration(
  env: SignupConfigInput
): SignupConfigResult {
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
    diagnostic: `Signup server configuration incomplete: missing ${missing.join(", ")}`,
    missing,
  };
}

/**
 * Runtime assertion for the current service-role signup architecture.
 * Call before createAdminClient / organisation / profile provisioning.
 */
export function assertSignupServerConfiguration(): SignupConfigResult {
  return evaluateSignupServerConfiguration({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
