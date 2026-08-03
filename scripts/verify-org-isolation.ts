/**
 * Cross-organisation data isolation tests.
 *
 * Preferred Batch 2A.5 entry point:
 *   npx tsx scripts/verify-batch-2a5-tenant-isolation.ts
 *
 * This script retains static ownership-helper smoke tests and refuses to run
 * live checks against a non-local Supabase URL.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import {
  assertOrgOwnsPricingDocument,
  assertOrgOwnsProject,
  assertOrgOwnsQuote,
  assertOrgOwnsWorkArea,
  type AuthOrgContext,
} from "../lib/security/org-ownership";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

type QueryResult<T> = { data: T | null; error: { message: string } | null };

function createMockSupabase(handlers: Record<string, () => QueryResult<unknown>>) {
  const from = (table: string) => {
    const handler = handlers[table];
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => (handler ? handler() : { data: null, error: null }),
    };
    return chain;
  };

  return { from } as AuthOrgContext["supabase"];
}

async function testOwnershipHelpers() {
  console.log("--- Ownership helper unit tests ---\n");

  const ctxA: AuthOrgContext = {
    orgId: "org-a",
    user: { id: "user-a" },
    supabase: createMockSupabase({
      projects: () => ({ data: { id: "project-a" }, error: null }),
      pricing_documents: () => ({
        data: { id: "pricing-a", project_id: "project-a" },
        error: null,
      }),
      quotes: () => ({ data: { id: "quote-a", project_id: "project-a" }, error: null }),
      work_areas: () => ({
        data: { id: "work-area-a", project_id: "project-a" },
        error: null,
      }),
    }),
  };

  const ctxB: AuthOrgContext = {
    orgId: "org-b",
    user: { id: "user-b" },
    supabase: createMockSupabase({
      projects: () => ({ data: null, error: null }),
      pricing_documents: () => ({ data: null, error: null }),
      quotes: () => ({ data: null, error: null }),
      work_areas: () => ({ data: null, error: null }),
    }),
  };

  const projectA = await assertOrgOwnsProject(ctxA, "project-a");
  assert("Org A can own project A", !("error" in projectA));

  const projectDenied = await assertOrgOwnsProject(ctxB, "project-a");
  assert("Org B cannot own project A", "error" in projectDenied);

  const pricingDenied = await assertOrgOwnsPricingDocument(
    ctxB,
    "pricing-a",
    "project-a"
  );
  assert("Org B cannot own org A pricing document", "error" in pricingDenied);

  const quoteDenied = await assertOrgOwnsQuote(ctxB, "quote-a", "project-a");
  assert("Org B cannot own org A quote", "error" in quoteDenied);

  const workAreaDenied = await assertOrgOwnsWorkArea(
    ctxB,
    "work-area-a",
    "project-a"
  );
  assert("Org B cannot own org A work area", "error" in workAreaDenied);

  const pricingMismatch = await assertOrgOwnsPricingDocument(
    ctxA,
    "pricing-a",
    "wrong-project"
  );
  assert(
    "Pricing document rejected when project mismatch",
    "error" in pricingMismatch
  );
}

async function main() {
  console.log("=== Organisation isolation verification ===\n");
  console.log(
    "NOTE: Full end-to-end local isolation proof is Batch 2A.5:\n" +
      "  npx tsx scripts/verify-batch-2a5-tenant-isolation.ts\n"
  );

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (envUrl && !isLocalSupabaseUrl(envUrl)) {
    console.log(
      "REFUSING live remote checks from NEXT_PUBLIC_SUPABASE_URL — non-local host detected."
    );
    console.log(
      "Static ownership helper tests still run. Use the Batch 2A.5 script for local live proof.\n"
    );
  }

  await testOwnershipHelpers();

  if (!process.exitCode) {
    console.log("\nOrganisation isolation static checks passed.");
  } else {
    console.log("\nOrganisation isolation checks failed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
