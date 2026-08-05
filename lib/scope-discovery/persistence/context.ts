/**
 * Shared persistence context — org always from auth profile, never client.
 * Injectable for local verification without Next.js cookies.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PERSISTENCE_ERROR_CODES,
  ScopeDiscoveryPersistenceError,
} from "./errors";

export interface PersistenceAuthContext {
  readonly supabase: SupabaseClient;
  readonly orgId: string;
  readonly userId: string;
}

export async function assertProjectOwnedByOrg(
  ctx: PersistenceAuthContext,
  projectId: string
): Promise<void> {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id, org_id")
    .eq("id", projectId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error || !data) {
    throw new ScopeDiscoveryPersistenceError(
      PERSISTENCE_ERROR_CODES.PROJECT_NOT_OWNED,
      "Project was not found in your organisation."
    );
  }
}

export function mapDbError(
  error: { message?: string; code?: string } | null,
  fallback: ScopeDiscoveryPersistenceError
): ScopeDiscoveryPersistenceError {
  if (!error) return fallback;
  const msg = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";

  if (code === "23505" || msg.includes("duplicate key")) {
    if (msg.includes("active_idempotency") || msg.includes("idempotency")) {
      return new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.DUPLICATE_ACTIVE_RUN,
        "A matching discovery run is already in progress."
      );
    }
    if (msg.includes("run_identity") || msg.includes("suggestion_identity")) {
      return new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.DUPLICATE_SUGGESTION_IDENTITY,
        "Duplicate suggestion identity in this run."
      );
    }
    if (msg.includes("one_accept") || msg.includes("accept")) {
      return new ScopeDiscoveryPersistenceError(
        PERSISTENCE_ERROR_CODES.DUPLICATE_ACCEPT,
        "This suggestion has already been accepted."
      );
    }
  }
  if (msg.includes("immutable") || msg.includes("append-only")) {
    return new ScopeDiscoveryPersistenceError(
      PERSISTENCE_ERROR_CODES.IMMUTABLE_RECORD,
      "This discovery record cannot be modified."
    );
  }

  return fallback;
}
