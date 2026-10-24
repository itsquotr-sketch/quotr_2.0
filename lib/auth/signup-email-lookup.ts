import "server-only";

import type { ExistingSignupConfirmation } from "@/lib/auth/signup-existing-account";
import { createAdminClient } from "@/lib/supabase/admin";

type ListedUser = {
  email?: string | null;
  email_confirmed_at?: string | null;
};

/**
 * Confirmation state for an email the person just submitted.
 * Returns no name, company, or other address. Service role only.
 * Unknown means the lookup could not be completed, not that the account is new.
 */
export async function lookupSignupEmailConfirmation(
  email: string
): Promise<ExistingSignupConfirmation> {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return "unknown";

  try {
    createAdminClient();
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    if (!base || !key) return "unknown";

    const url = new URL("/auth/v1/admin/users", base);
    url.searchParams.set("filter", normalised);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "20");
    const response = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      console.info("[auth] signup_email_lookup_failed", { status: response.status });
      return "unknown";
    }
    const body = (await response.json()) as { users?: ListedUser[] };
    const matches = (body.users ?? []).filter(
      (user) => (user.email ?? "").trim().toLowerCase() === normalised
    );
    if (matches.length === 0) return "unknown";
    return matches.some((user) => Boolean(user.email_confirmed_at))
      ? "confirmed"
      : "unconfirmed";
  } catch {
    return "unknown";
  }
}
