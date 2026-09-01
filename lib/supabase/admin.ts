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

function serviceRoleJwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8")
    ) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function createAdminClient() {
  const url = readServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }
  if (serviceRoleJwtRole(serviceRoleKey) !== "service_role") {
    throw new Error("Supabase admin key is not a service_role JWT.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
