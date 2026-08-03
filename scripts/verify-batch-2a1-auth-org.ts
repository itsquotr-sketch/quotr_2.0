/**
 * Batch 2A.1 focused verification — auth-org context and ownership responses.
 *
 * Run: npx --yes tsx scripts/verify-batch-2a1-auth-org.ts
 *
 * Uses pure helpers and mocked Supabase chains. Does not touch production data.
 */
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "../lib/security/auth-org-evaluation";
import {
  assertOrgOwnsProject,
  type AuthOrgContext,
} from "../lib/security/org-ownership";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

type QueryResult<T> = { data: T | null; error: { message: string } | null };

function createMockSupabase(
  handlers: Record<string, () => QueryResult<unknown>>
) {
  const from = (table: string) => {
    const handler = handlers[table];
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () =>
        handler ? handler() : { data: null, error: null },
    };
    return chain;
  };

  return { from } as AuthOrgContext["supabase"];
}

function testAuthOrgEvaluation() {
  console.log("\n--- Auth org evaluation ---\n");

  const unauthenticated = evaluateAuthOrgInputs({
    user: null,
    profile: null,
    organisation: null,
  });
  assert(
    "Unauthenticated request fails",
    !unauthenticated.ok && unauthenticated.code === "not_authenticated"
  );
  assert(
    "Unauthenticated message is controlled",
    !unauthenticated.ok &&
      unauthenticated.error === AUTH_ORG_MESSAGES.not_authenticated
  );

  const noProfile = evaluateAuthOrgInputs({
    user: { id: "user-a", email: "a@example.com" },
    profile: null,
    organisation: null,
  });
  assert(
    "Authenticated user with no profile fails safely",
    !noProfile.ok && noProfile.code === "organisation_required"
  );

  const noOrg = evaluateAuthOrgInputs({
    user: { id: "user-a", email: "a@example.com" },
    profile: { org_id: null },
    organisation: null,
  });
  assert(
    "Authenticated user with profile but no organisation fails safely",
    !noOrg.ok && noOrg.code === "organisation_required"
  );

  const invalidOrgRef = evaluateAuthOrgInputs({
    user: { id: "user-a", email: "a@example.com" },
    profile: { org_id: "org-a" },
    organisation: null,
  });
  assert(
    "Invalid organisation reference fails safely",
    !invalidOrgRef.ok && invalidOrgRef.code === "organisation_required"
  );

  const success = evaluateAuthOrgInputs({
    user: { id: "user-a", email: "a@example.com" },
    profile: { org_id: "org-a" },
    organisation: { id: "org-a" },
  });
  assert(
    "Authenticated user with valid profile and organisation succeeds",
    success.ok && success.orgId === "org-a" && success.user.id === "user-a"
  );

  assert(
    "Missing profile and missing organisation share the same failure code",
    !noProfile.ok &&
      !noOrg.ok &&
      noProfile.code === noOrg.code &&
      noProfile.error === noOrg.error
  );
}

async function testOwnershipIndistinguishability() {
  console.log("\n--- Project ownership ---\n");

  const orgA: AuthOrgContext = {
    supabase: createMockSupabase({
      projects: () => ({ data: { id: "project-a" }, error: null }),
    }),
    orgId: "org-a",
    user: { id: "user-a" },
  };

  const owned = await assertOrgOwnsProject(orgA, "project-a");
  assert(
    "User A in Organisation A can access Project A",
    !("error" in owned) && owned.projectId === "project-a"
  );

  const foreignCtx: AuthOrgContext = {
    supabase: createMockSupabase({
      projects: () => ({ data: null, error: null }),
    }),
    orgId: "org-a",
    user: { id: "user-a" },
  };

  const missing = await assertOrgOwnsProject(foreignCtx, "missing-project");
  const foreign = await assertOrgOwnsProject(foreignCtx, "project-b");

  assert("Missing project returns generic not-found", "error" in missing);
  assert("Foreign project returns generic not-found", "error" in foreign);
  assert(
    "Missing and foreign project IDs produce the same external response",
    "error" in missing &&
      "error" in foreign &&
      missing.error === foreign.error &&
      missing.error === "Project not found."
  );
}

async function main() {
  console.log("=== Batch 2A.1 auth-org verification ===");
  testAuthOrgEvaluation();
  await testOwnershipIndistinguishability();

  if (!process.exitCode) {
    console.log("\nBatch 2A.1 focused checks passed.");
  } else {
    console.log("\nBatch 2A.1 focused checks failed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
