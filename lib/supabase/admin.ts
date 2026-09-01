import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for trusted server-side operations only
 * (local verification scripts, privileged admin tooling).
 *
 * After Stage 3.1C.1B, normal signup/org provisioning does **not** use this
 * client — it calls `provision_organisation_for_new_user` via the authenticated
 * session client instead.
 *
 * Never import this from client components.
 */
function readServerEnv(name: string): string | undefined {
  return process.env[name];
}

export function createAdminClient() {
  const url = readServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
