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

function serviceRoleClaims(token: string): { role: string | null; ref: string | null } {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8")
    ) as { role?: unknown; ref?: unknown };
    return {
      role: typeof payload.role === "string" ? payload.role : null,
      ref: typeof payload.ref === "string" ? payload.ref : null,
    };
  } catch {
    return { role: null, ref: null };
  }
}

function projectRefFromUrl(url: string): string | null {
  const match = url.match(/^https:\/\/([a-z]{20})\.supabase\.co\/?$/);
  return match?.[1] ?? null;
}

export function createAdminClient() {
  const url = readServerEnv("NEXT_PUBLIC_SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY")?.trim().replace(/^"|"$/g, "") ?? "";

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }
  const claims = serviceRoleClaims(serviceRoleKey);
  const urlRef = projectRefFromUrl(url);
  if (claims.role !== "service_role") {
    throw new Error("Supabase admin key is not a service_role JWT.");
  }
  if (urlRef && claims.ref && claims.ref !== urlRef) {
    throw new Error("Supabase admin key does not match this project.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
