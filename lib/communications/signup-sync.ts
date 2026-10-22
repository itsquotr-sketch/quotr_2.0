import "server-only";

import { after } from "next/server";
import {
  marketingLoopsAllowsEmail,
  marketingLoopsScope,
  PREVIEW_LOOPS_TEST_EMAIL,
} from "@/lib/communications/loops-automation";
import { readLoopsApiKey } from "@/lib/communications/loops-client";
import { syncPendingMarketingContacts } from "@/lib/communications/pending-sync";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Queues one confirmed signup for Loops after the confirmation response.
 * Unconfirmed signups are not queued. The provider call is inside after(),
 * so a Loops failure cannot change confirmation or the welcome email.
 * Existing pending profiles are not selected.
 */
export async function scheduleConfirmedSignupLoopsSync(input: {
  userId: string;
  email: string;
}): Promise<void> {
  try {
    const scope = marketingLoopsScope(process.env);
    if (!marketingLoopsAllowsEmail(scope, input.email)) return;
    const userId = input.userId.trim();
    const email = input.email.trim();
    if (!userId || !email) return;

    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return;
    }

    await admin
      .from("profiles")
      .update({
        marketing_loops_auto_retry: true,
        marketing_loops_retry_stopped: false,
        marketing_loops_retry_attempts: 0,
        marketing_loops_retry_after: null,
        marketing_loops_last_error: null,
      })
      .eq("id", userId)
      .eq("marketing_loops_sync_pending", true);

    after(async () => {
      try {
        const apiKey = readLoopsApiKey();
        if (!apiKey) return;
        const current = marketingLoopsScope(process.env);
        if (!marketingLoopsAllowsEmail(current, email)) return;
        if (current === "preview" && email.toLowerCase() !== PREVIEW_LOOPS_TEST_EMAIL) return;
        await syncPendingMarketingContacts({
          admin,
          apiKey,
          userId,
          email,
          limit: 1,
          autoRetryOnly: true,
        });
      } catch {
        // Pending stays set for the five-minute retry.
      }
    });
  } catch {
    // Confirmation and the welcome email continue.
  }
}
