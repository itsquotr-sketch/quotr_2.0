/**
 * Preview-only account phone claim tests.
 *
 * Run: npx --yes tsx scripts/verify-signup-phone-live.ts
 *
 * Refuses Production. Does not print private phone numbers.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeAccountPhone } from "../lib/auth/account-phone";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

function mustPhone(country: "NZ" | "AU", raw: string) {
  const phone = normalizeAccountPhone(country, raw);
  if (!phone.ok) throw new Error(`example number rejected for ${country}`);
  return phone;
}

type Admin = SupabaseClient;

async function createClaimedUser(
  admin: Admin,
  email: string,
  password: string,
  phone: { e164: string; display: string; country: "NZ" | "AU" },
  metadata: Record<string, string> = {}
) {
  return admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      signup_phone_required: "true",
      phone_e164: phone.e164,
      phone_country: phone.country,
      phone_display: phone.display,
      full_name: "Phone Test",
      ...metadata,
    },
  });
}

async function signInWorks(url: string, anon: string, email: string, password: string) {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  return { ok: !signed.error && Boolean(signed.data.user), client, userId: signed.data.user?.id ?? null };
}

async function main() {
  section("TARGET");
  const env = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  assert("live target is Preview", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF || ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const password = `Phone-${randomUUID()}`;
  const userIds: string[] = [];

  const nz = mustPhone("NZ", "021 123 4567");
  const nzSame = mustPhone("NZ", "+64 21 123 4567");
  const au = mustPhone("AU", "0412 345 678");
  const auSame = mustPhone("AU", "+61 412 345 678");
  const other = mustPhone("NZ", "021 987 6543");

  try {
    section("NZ AND AU COLLISIONS");
    assert("normalized NZ forms match", nz.e164 === nzSame.e164);
    assert("normalized AU forms match", au.e164 === auSame.e164);

    const first = await createClaimedUser(
      admin,
      `phone-nz-${suffix}@example.invalid`,
      password,
      nz
    );
    if (first.data.user) userIds.push(first.data.user.id);
    assert("first NZ claim succeeds", Boolean(first.data.user) && !first.error);

    const second = await createClaimedUser(
      admin,
      `phone-nz-intl-${suffix}@example.invalid`,
      password,
      nzSame
    );
    if (second.data.user) userIds.push(second.data.user.id);
    assert("NZ +64 form does not create a second account", !second.data.user);
    const nzRows = await admin
      .from("account_phone_numbers")
      .select("user_id")
      .eq("phone_e164", nz.e164);
    assert(
      "NZ number has exactly one claim",
      !nzRows.error && nzRows.data?.length === 1 && nzRows.data[0]?.user_id === first.data.user?.id
    );
    const loserSignIn = await signInWorks(
      url,
      anonKey,
      `phone-nz-intl-${suffix}@example.invalid`,
      password
    );
    if (loserSignIn.userId) userIds.push(loserSignIn.userId);
    assert("failed NZ claim left no sign-in account", loserSignIn.ok === false);

    const auFirst = await createClaimedUser(
      admin,
      `phone-au-${suffix}@example.invalid`,
      password,
      au
    );
    if (auFirst.data.user) userIds.push(auFirst.data.user.id);
    const auSecond = await createClaimedUser(
      admin,
      `phone-au-intl-${suffix}@example.invalid`,
      password,
      auSame
    );
    if (auSecond.data.user) userIds.push(auSecond.data.user.id);
    assert("AU local claim succeeds", Boolean(auFirst.data.user) && !auFirst.error);
    assert("AU +61 form does not create a second account", !auSecond.data.user);

    const different = await createClaimedUser(
      admin,
      `phone-other-${suffix}@example.invalid`,
      password,
      other
    );
    if (different.data.user) userIds.push(different.data.user.id);
    assert("a different valid number succeeds", Boolean(different.data.user) && !different.error);

    section("CONCURRENCY");
    const concurrentPhone = mustPhone("AU", "0398765432");
    const [left, right] = await Promise.all([
      createClaimedUser(
        admin,
        `phone-race-a-${suffix}@example.invalid`,
        password,
        concurrentPhone
      ),
      createClaimedUser(
        admin,
        `phone-race-b-${suffix}@example.invalid`,
        password,
        concurrentPhone
      ),
    ]);
    const winners = [left, right].filter((result) => result.data.user && !result.error);
    for (const result of [left, right]) {
      if (result.data.user) userIds.push(result.data.user.id);
    }
    const raceRows = await admin
      .from("account_phone_numbers")
      .select("user_id")
      .eq("phone_e164", concurrentPhone.e164);
    assert("concurrent claims produce exactly one success", winners.length === 1);
    assert("concurrent claims produce exactly one row", !raceRows.error && raceRows.data?.length === 1);

    section("LEGACY, PROFILE EDIT, RETRY");
    const legacy = await admin.auth.admin.createUser({
      email: `phone-legacy-${suffix}@example.invalid`,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Legacy" },
    });
    if (legacy.data.user) userIds.push(legacy.data.user.id);
    const legacyPhone = await admin
      .from("account_phone_numbers")
      .select("user_id")
      .eq("user_id", legacy.data.user?.id ?? "");
    const legacySignIn = await signInWorks(
      url,
      anonKey,
      `phone-legacy-${suffix}@example.invalid`,
      password
    );
    assert("legacy account has no phone row", !legacyPhone.error && (legacyPhone.data?.length ?? 0) === 0);
    assert("legacy account can sign in", legacySignIn.ok === true);

    const taken = await legacySignIn.client.rpc("set_own_account_phone", {
      p_phone_e164: nz.e164,
      p_phone_display: "021 123 4567",
      p_country_code: "NZ",
    });
    const takenText = `${taken.error?.message ?? ""} ${taken.error?.details ?? ""} ${taken.error?.hint ?? ""}`;
    assert(
      "profile edit collision is rejected",
      Boolean(taken.error) && /PHONE:ALREADY_LINKED/i.test(takenText)
    );
    assert(
      "profile collision error has no account details",
      !takenText.includes("@") && !/organisation/i.test(takenText)
    );

    const own = await legacySignIn.client.rpc("set_own_account_phone", {
      p_phone_e164: other.e164,
      p_phone_display: other.display,
      p_country_code: "NZ",
    });
    assert(
      "profile edit of a number already owned by someone else stays blocked",
      Boolean(own.error)
    );
    const free = mustPhone("NZ", "09 555 1234");
    const added = await legacySignIn.client.rpc("set_own_account_phone", {
      p_phone_e164: free.e164,
      p_phone_display: free.display,
      p_country_code: "NZ",
    });
    assert("legacy profile can add a free number", !added.error && added.data === true);

    section("INVITE SHAPE AND CLEANUP");
    const inviteShaped = await createClaimedUser(
      admin,
      `phone-invite-${suffix}@example.invalid`,
      password,
      mustPhone("AU", "0287654321"),
      {}
    );
    if (inviteShaped.data.user) userIds.push(inviteShaped.data.user.id);
    const inviteProfile = await admin
      .from("profiles")
      .select("id, org_id")
      .eq("id", inviteShaped.data.user?.id ?? "")
      .maybeSingle();
    assert(
      "phone claim does not create a profile or organisation",
      Boolean(inviteShaped.data.user) && !inviteProfile.data
    );

    const hidden = await anon.rpc("account_phone_is_claimed", {
      p_phone_e164: nz.e164,
    });
    assert("anon cannot run the claim lookup", Boolean(hidden.error));
    const signedLookup = await legacySignIn.client.rpc("account_phone_is_claimed", {
      p_phone_e164: nz.e164,
    });
    assert("signed-in users cannot run the claim lookup", Boolean(signedLookup.error));

    const ownerId = first.data.user?.id;
    if (ownerId) {
      const removed = await admin.auth.admin.deleteUser(ownerId);
      assert("account delete succeeds", !removed.error);
      userIds.splice(userIds.indexOf(ownerId), 1);
      const afterDelete = await admin
        .from("account_phone_numbers")
        .select("user_id")
        .eq("phone_e164", nz.e164);
      assert("deleting the auth user releases the number", !afterDelete.error && (afterDelete.data?.length ?? 0) === 0);
      const retry = await createClaimedUser(
        admin,
        `phone-retry-${suffix}@example.invalid`,
        password,
        nz
      );
      if (retry.data.user) userIds.push(retry.data.user.id);
      assert("signup retry after release succeeds", Boolean(retry.data.user) && !retry.error);
      const retryProfile = await admin
        .from("profiles")
        .select("id")
        .eq("id", retry.data.user?.id ?? "")
        .maybeSingle();
      assert("released claim still does not create an organisation", !retryProfile.data);
    }

    if (!process.exitCode) {
      console.log("\nSignup phone live verification passed.");
    }
  } finally {
    for (const userId of userIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : "live phone verification failed");
  process.exit(1);
});
