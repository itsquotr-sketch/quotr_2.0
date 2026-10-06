import "server-only";

import {
  isExplicitPhoneClaimFailure,
  isSignupDatabaseSaveFailure,
} from "@/lib/auth/account-phone";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-only existence check used after signup submit already failed in Auth.
 * Returns a boolean. It is not granted to anon or authenticated, and it does
 * not return a name, email, or organisation.
 */
export async function accountPhoneIsClaimed(
  phoneE164: string
): Promise<boolean | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("account_phone_is_claimed", {
      p_phone_e164: phoneE164,
    });
    if (error) return null;
    return data === true;
  } catch {
    return null;
  }
}

/**
 * True when this signup attempt lost the phone claim.
 * A database save failure is treated as a phone collision only when the
 * normalized number is already claimed. Other failures stay generic.
 */
export async function signupWasBlockedByExistingPhone(
  providerText: string,
  phoneE164: string
): Promise<boolean> {
  if (isExplicitPhoneClaimFailure(providerText)) return true;
  if (!isSignupDatabaseSaveFailure(providerText)) return false;
  return (await accountPhoneIsClaimed(phoneE164)) === true;
}
