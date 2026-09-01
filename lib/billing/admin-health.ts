import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBillingEnvironment } from "@/lib/billing/environment";

export function probeBillingEnvironmentLabel(): string {
  try {
    return resolveBillingEnvironment();
  } catch {
    return "rejected";
  }
}

export async function probePreviewServiceRole(): Promise<string> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("organisations").select("id").limit(1);
    if (error) {
      return "rejected";
    }
    return "valid";
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Missing Supabase admin")) {
      return "not_configured";
    }
    if (message.includes("not a service_role JWT")) {
      return "not_service_role_jwt";
    }
    return "rejected";
  }
}
