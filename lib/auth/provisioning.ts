/**
 * Shared transactional organisation/profile provisioning (Stage 3.1C.1B).
 *
 * Calls public.provision_organisation_for_new_user via the authenticated
 * Supabase client. Never uses the service-role admin client.
 * Never accepts caller-supplied user_id / org_id.
 */

import {
  classifyProvisioningError,
  type AuthErrorCategory,
} from "@/lib/auth/errors";
import { logAuthEvent } from "@/lib/auth/logging";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ProvisionInput = {
  organisationName: string;
  fullName: string;
  correlationId: string;
  /** Optional known user id for logging only (never sent to RPC). */
  userId?: string;
  context: "signup" | "repair";
};

export type ProvisionSuccess = {
  ok: true;
  orgId: string;
  profileId: string;
  alreadyProvisioned: boolean;
};

export type ProvisionFailure = {
  ok: false;
  category: AuthErrorCategory;
};

export type ProvisionResult = ProvisionSuccess | ProvisionFailure;

type RpcRow = {
  org_id: string;
  profile_id: string;
  already_provisioned: boolean;
};

/**
 * Atomically provision organisation + profile for the signed-in auth user.
 */
export async function provisionOrganisationForCurrentUser(
  supabase: SupabaseServerClient,
  input: ProvisionInput
): Promise<ProvisionResult> {
  const startedAt = Date.now();
  const startEvent =
    input.context === "repair" ? "account_repair_started" : "provisioning_started";
  const failEvent =
    input.context === "repair" ? "account_repair_failed" : "provisioning_failed";

  logAuthEvent({
    event: startEvent,
    correlationId: input.correlationId,
    userId: input.userId,
  });

  const { data, error } = await supabase.rpc(
    "provision_organisation_for_new_user",
    {
      p_organisation_name: input.organisationName,
      p_full_name: input.fullName,
    }
  );

  if (error) {
    const category = classifyProvisioningError(error.message, input.context);
    logAuthEvent({
      event: failEvent,
      category,
      correlationId: input.correlationId,
      userId: input.userId,
      elapsedMs: Date.now() - startedAt,
    });
    console.error("[auth]", {
      scope: "auth",
      event: "provision_rpc_error",
      correlationId: input.correlationId,
      category,
    });
    return { ok: false, category };
  }

  const row = Array.isArray(data) ? (data[0] as RpcRow | undefined) : undefined;
  if (!row?.org_id || !row?.profile_id) {
    const category =
      input.context === "repair" ? "ACCOUNT_REPAIR_FAILED" : "PROVISIONING_FAILED";
    logAuthEvent({
      event: failEvent,
      category,
      correlationId: input.correlationId,
      userId: input.userId,
      elapsedMs: Date.now() - startedAt,
    });
    return { ok: false, category };
  }

  logAuthEvent({
    event: "organisation_profile_provisioned",
    correlationId: input.correlationId,
    userId: row.profile_id,
    orgId: row.org_id,
    alreadyProvisioned: Boolean(row.already_provisioned),
    elapsedMs: Date.now() - startedAt,
  });

  if (input.context === "repair") {
    logAuthEvent({
      event: "account_repair_completed",
      correlationId: input.correlationId,
      userId: row.profile_id,
      orgId: row.org_id,
      alreadyProvisioned: Boolean(row.already_provisioned),
      elapsedMs: Date.now() - startedAt,
    });
  }

  return {
    ok: true,
    orgId: row.org_id,
    profileId: row.profile_id,
    alreadyProvisioned: Boolean(row.already_provisioned),
  };
}
