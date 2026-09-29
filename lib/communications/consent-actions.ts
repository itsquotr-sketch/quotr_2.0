"use server";

import { revalidatePath } from "next/cache";
import { syncSessionUser } from "@/lib/communications/sync";
import type { LoopsSyncMode } from "@/lib/communications/contact-mapping";
import { createClient } from "@/lib/supabase/server";
import type { ProfileActionState } from "@/lib/auth/profile-actions";

function consentFromForm(formData: FormData): boolean {
  const value = formData.get("marketing_consent");
  return value === "true" || value === "on";
}

/**
 * Explicit product-communications preference for the signed-in user.
 * False → true subscribes them in Loops. True → false unsubscribes them.
 * An unchanged value does not send `subscribed`.
 * A Loops failure does not undo the saved preference or fail this action.
 */
export async function updateMarketingConsent(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const next = consentFromForm(formData);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to sign in." };
  }

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("marketing_consent")
    .eq("id", user.id)
    .maybeSingle();

  if (readError || !existing) {
    return { error: "Could not save your preference. Please try again." };
  }

  const previous = existing.marketing_consent === true;
  if (previous === next) {
    return { success: "Preference saved." };
  }

  const { data: updated, error } = await supabase.rpc("set_own_marketing_consent", {
    p_consent: next,
    p_source: "settings",
  });

  if (error || updated !== true) {
    return { error: "Could not save your preference. Please try again." };
  }

  const mode: LoopsSyncMode = next ? "explicit_opt_in" : "explicit_opt_out";
  await syncSessionUser(supabase, mode);

  revalidatePath("/app/profile");
  return { success: "Preference saved." };
}
