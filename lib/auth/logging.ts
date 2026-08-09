/**
 * Minimal structured auth logging (Stage 3.1C.1A / 3.1C.1B).
 *
 * Never logs passwords, tokens, service-role keys, raw form payloads,
 * or raw provider responses. Logging must never throw into auth flows.
 */

import type { AuthErrorCategory } from "@/lib/auth/errors";

export type AuthLogEvent =
  | "signup_started"
  | "auth_user_created"
  | "provisioning_started"
  | "organisation_profile_provisioned"
  | "organisation_provisioned"
  | "profile_linked"
  | "signup_completed"
  | "signup_failed"
  | "provisioning_failed"
  | "account_repair_started"
  | "account_repair_completed"
  | "account_repair_failed"
  | "login_failed"
  | "confirmation_pending";

export type AuthLogFields = {
  readonly event: AuthLogEvent;
  readonly category?: AuthErrorCategory;
  readonly userId?: string;
  readonly orgId?: string;
  readonly elapsedMs?: number;
  readonly correlationId?: string;
  readonly alreadyProvisioned?: boolean;
};

const FORBIDDEN_KEYS = new Set([
  "password",
  "token",
  "access_token",
  "refresh_token",
  "confirmation_token",
  "recovery_token",
  "service_role",
  "serviceRoleKey",
  "SUPABASE_SERVICE_ROLE_KEY",
  "email",
  "raw",
  "formData",
  "payload",
]);

function sanitizeFields(fields: AuthLogFields): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    scope: "auth",
    event: fields.event,
  };

  if (fields.category) payload.category = fields.category;
  if (fields.userId) payload.userId = fields.userId;
  if (fields.orgId) payload.orgId = fields.orgId;
  if (fields.elapsedMs != null) payload.elapsedMs = fields.elapsedMs;
  if (fields.correlationId) payload.correlationId = fields.correlationId;
  if (fields.alreadyProvisioned != null) {
    payload.alreadyProvisioned = fields.alreadyProvisioned;
  }

  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.has(key)) {
      delete payload[key];
    }
  }

  return payload;
}

/**
 * Emit a structured auth event. Swallows all logging errors so auth
 * actions are never broken by observability failures.
 */
export function logAuthEvent(fields: AuthLogFields): void {
  try {
    const payload = sanitizeFields(fields);
    if (
      fields.event === "signup_failed" ||
      fields.event === "login_failed" ||
      fields.event === "provisioning_failed" ||
      fields.event === "account_repair_failed"
    ) {
      console.error("[auth]", payload);
      return;
    }
    console.info("[auth]", payload);
  } catch {
    // Observability must not break signup/login/repair.
  }
}

/**
 * Create a short request-safe correlation id (not a secret).
 */
export function createAuthCorrelationId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().slice(0, 8);
    }
  } catch {
    // fall through
  }
  return `a${Date.now().toString(36).slice(-7)}`;
}
