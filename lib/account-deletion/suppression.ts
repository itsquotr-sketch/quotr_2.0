import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDeletionEmail } from "@/lib/account-deletion/request";

const TABLE = "account_deletion_suppressions";

function missingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || (error.message ?? "").includes(TABLE);
}

export async function isDeletedContactSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeDeletionEmail(email);
  if (!normalized) return false;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from(TABLE)
      .select("email_normalized")
      .eq("email_normalized", normalized)
      .maybeSingle();
    if (error) return !missingTable(error);
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function recordDeletedContact(input: {
  email: string;
  reason: string;
}): Promise<void> {
  const email = normalizeDeletionEmail(input.email);
  if (!email) throw new Error("Deletion suppression needs an email.");
  const admin = createAdminClient();
  const { error } = await admin.from(TABLE).insert({
    email_normalized: email,
    reason: input.reason,
  });
  if (error && error.code !== "23505") throw new Error("Deletion suppression was not recorded.");
}
