"use server";

import { revalidatePath } from "next/cache";
import type { ProfileActionState } from "@/lib/auth/profile-actions";
import { isMarketingConsentSource } from "@/lib/communications/marketing-consent-source";
import { syncSessionUser } from "@/lib/communications/sync";
import type { LoopsSyncMode } from "@/lib/communications/contact-mapping";
import { createClient } from "@/lib/supabase/server";

const SAVE_ERROR = "Could not save your preference. Please try again.";

function choiceFromForm(formData: FormData): "yes" | "no" | null {
  const value = formData.get("marketing_consent");
  if (value === "yes") return "yes";
  if (value === "no") return "no";
  return null;
}

/**
 * Explicit product-update preference for the signed-in user only.
 * Uses set_own_marketing_consent, which records consent evidence and sets
 * marketing_loops_sync_pending. An unset profile can opt in or opt out.
 * A Loops failure does not undo the saved preference.
 */
export async function updateMarketingConsent(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const choice = choiceFromForm(formData);
  if (!choice) {
    return { error: "Choose whether you want product updates." };
  }

  const next = choice === "yes";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to sign in." };
  }

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("marketing_consent, marketing_consent_source")
    .eq("id", user.id)
    .maybeSingle();

  if (readError || !existing) {
    return { error: SAVE_ERROR };
  }

  const previous = existing.marketing_consent === true;
  const explicit = isMarketingConsentSource(
    typeof existing.marketing_consent_source === "string"
      ? existing.marketing_consent_source
      : null
  );
  if (explicit && previous === next) {
    return { success: "Preference saved." };
  }

  const { data: updated, error } = await supabase.rpc("set_own_marketing_consent", {
    p_consent: next,
    p_source: "settings",
  });

  if (error || updated !== true) {
    return { error: SAVE_ERROR };
  }

  const mode: LoopsSyncMode = next ? "explicit_opt_in" : "explicit_opt_out";
  await syncSessionUser(supabase, mode);

  revalidatePath("/app/profile");
  return { success: "Preference saved." };
}
