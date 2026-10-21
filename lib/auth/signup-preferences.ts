import {
  TERMS_OF_USE_VERSION,
} from "@/lib/auth/signup-choices";

type PreferenceClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ error: { message?: string } | null }>;
};

/**
 * Copies the signup choices onto the signed-in profile.
 * Terms are recorded once. Marketing uses the existing consent RPC,
 * which only marks Loops sync pending. This does not start a campaign.
 * A missing profile is left for the next authenticated opportunity.
 */
export async function recordSignupPreferences(
  supabase: PreferenceClient,
  metadata: Record<string, unknown> | null | undefined
): Promise<void> {
  if (!metadata) return;
  try {
    if (
      metadata.terms_version === TERMS_OF_USE_VERSION &&
      typeof metadata.terms_accepted_at === "string"
    ) {
      await supabase.rpc("set_own_terms_acceptance", {
        p_version: TERMS_OF_USE_VERSION,
        p_accepted_at: metadata.terms_accepted_at,
      });
    }
    if (
      metadata.marketing_consent === "true" ||
      metadata.marketing_consent === "false"
    ) {
      await supabase.rpc("set_own_marketing_consent", {
        p_consent: metadata.marketing_consent === "true",
        p_source: "signup",
      });
    }
  } catch {
    // Account creation still stands when preference storage is unavailable.
  }
}
