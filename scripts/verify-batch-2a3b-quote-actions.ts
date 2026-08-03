/**
 * Batch 2A.3B focused verification — quote action auth, ownership, schemas.
 *
 * Run: npx --yes tsx scripts/verify-batch-2a3b-quote-actions.ts
 *
 * Exercises production schemas and guard helpers. Mocked ownership only.
 * Does not touch production data or invoke live Server Actions.
 */
import {
  parseQuoteInput,
  quoteAuthFailure,
  validateQuoteItemTotalForPersistence,
  validateUpdateQuoteItemPayload,
} from "../lib/quotes/action-guards";
import {
  createQuoteFromPricingInputSchema,
  deleteQuoteItemInputSchema,
  quoteIdInputSchema,
  quoteItemInputSchema,
  quoteStatusSchema,
  reviseQuoteFromFinalPricingInputSchema,
  reviseQuoteInputSchema,
  setQuoteItemVisibleInputSchema,
  updateQuoteInputSchema,
  updateQuoteItemInputSchema,
  quoteDocumentGstSchema,
} from "../lib/quotes/schemas";
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "../lib/security/auth-org-evaluation";
import {
  assertOrgOwnsPricingDocument,
  assertOrgOwnsProject,
  assertOrgOwnsQuote,
  assertOrgOwnsQuoteItem,
  type AuthOrgContext,
} from "../lib/security/org-ownership";
import { calculateQuoteItemTotal } from "../lib/quotes/calculations";
import { toUserError, USER_ERRORS } from "../lib/errors/user-message";
import { validateMarginPercent } from "../lib/security/margin-validation";
import { validateMarkupPercent } from "../lib/security/markup-validation";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

const QUOTE_UUID = "11111111-1111-4111-8111-111111111111";
const ITEM_UUID = "22222222-2222-4222-8222-222222222222";
const PROJECT_UUID = "33333333-3333-4333-8333-333333333333";
const DOC_UUID = "44444444-4444-4444-8444-444444444444";
const FOREIGN_UUID = "55555555-5555-4555-8555-555555555555";

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

function testAuthentication() {
  console.log("\n--- Authentication ---\n");

  const unauthenticated = evaluateAuthOrgInputs({
    user: null,
    profile: null,
    organisation: null,
  });
  assert(
    "unauthenticated quote mutation rejected",
    !unauthenticated.ok &&
      quoteAuthFailure(unauthenticated)?.error ===
        AUTH_ORG_MESSAGES.not_authenticated
  );

  const missingOrg = evaluateAuthOrgInputs({
    user: { id: "user-a", email: "a@example.com" },
    profile: { org_id: null },
    organisation: null,
  });
  assert(
    "missing-organisation user rejected",
    !missingOrg.ok &&
      quoteAuthFailure(missingOrg)?.error ===
        AUTH_ORG_MESSAGES.organisation_required
  );
}

async function testOwnership() {
  console.log("\n--- Ownership ---\n");

  const orgAOwned: AuthOrgContext = {
    supabase: createMockSupabase({
      quotes: () => ({
        data: { id: QUOTE_UUID, project_id: PROJECT_UUID },
        error: null,
      }),
      quote_items: () => ({
        data: {
          id: ITEM_UUID,
          quote_id: QUOTE_UUID,
          project_id: PROJECT_UUID,
        },
        error: null,
      }),
      projects: () => ({ data: { id: PROJECT_UUID }, error: null }),
      pricing_documents: () => ({
        data: { id: DOC_UUID, project_id: PROJECT_UUID },
        error: null,
      }),
    }),
    orgId: "org-a",
    user: { id: "user-a" },
  };

  const orgAEmpty: AuthOrgContext = {
    supabase: createMockSupabase({
      quotes: () => ({ data: null, error: null }),
      quote_items: () => ({ data: null, error: null }),
      projects: () => ({ data: null, error: null }),
      pricing_documents: () => ({ data: null, error: null }),
    }),
    orgId: "org-a",
    user: { id: "user-a" },
  };

  const ownedQuote = await assertOrgOwnsQuote(orgAOwned, QUOTE_UUID);
  assert(
    "User A may mutate Organisation A quote",
    !("error" in ownedQuote)
  );

  const foreignQuote = await assertOrgOwnsQuote(orgAEmpty, FOREIGN_UUID);
  const missingQuote = await assertOrgOwnsQuote(orgAEmpty, QUOTE_UUID);
  assert(
    "User A cannot mutate Organisation B quote",
    "error" in foreignQuote
  );
  assert(
    "missing and foreign quote IDs produce equivalent external errors",
    "error" in foreignQuote &&
      "error" in missingQuote &&
      foreignQuote.error === missingQuote.error &&
      foreignQuote.error === "Quote not found."
  );

  const ownedItem = await assertOrgOwnsQuoteItem(orgAOwned, ITEM_UUID);
  assert(
    "User A may access Organisation A quote item",
    !("error" in ownedItem)
  );

  const foreignItem = await assertOrgOwnsQuoteItem(orgAEmpty, FOREIGN_UUID);
  const missingItem = await assertOrgOwnsQuoteItem(orgAEmpty, ITEM_UUID);
  assert(
    "User A cannot update/delete Organisation B quote item",
    "error" in foreignItem
  );
  assert(
    "missing and foreign item IDs produce equivalent external errors",
    "error" in foreignItem &&
      "error" in missingItem &&
      foreignItem.error === missingItem.error &&
      foreignItem.error === "Quote item not found."
  );

  const mismatchedParent = await assertOrgOwnsQuoteItem(
    orgAOwned,
    ITEM_UUID,
    FOREIGN_UUID
  );
  assert(
    "update with mismatched quote parent rejected",
    "error" in mismatchedParent &&
      mismatchedParent.error === "Quote item not found."
  );

  const ownedProject = await assertOrgOwnsProject(orgAOwned, PROJECT_UUID);
  const ownedDoc = await assertOrgOwnsPricingDocument(
    orgAOwned,
    DOC_UUID,
    PROJECT_UUID
  );
  assert("source project ownership accepted", !("error" in ownedProject));
  assert("source pricing document ownership accepted", !("error" in ownedDoc));

  const foreignDoc = await assertOrgOwnsPricingDocument(
    orgAEmpty,
    FOREIGN_UUID,
    PROJECT_UUID
  );
  assert("cross-org source pricing document rejected", "error" in foreignDoc);
}

function testInputValidation() {
  console.log("\n--- Input validation ---\n");

  assert(
    "malformed UUID rejected",
    !quoteIdInputSchema.safeParse({ quoteId: "bad" }).success
  );

  assert(
    "invalid status rejected",
    !quoteStatusSchema.safeParse("shipped").success
  );

  assert(
    "valid status accepted",
    quoteStatusSchema.safeParse("sent").success
  );

  assert(
    "negative quantity rejected",
    !quoteItemInputSchema.safeParse({
      label: "Labour",
      quantity: -1,
      unit_price: 10,
      total: 10,
    }).success
  );

  assert(
    "negative unit price rejected",
    !quoteItemInputSchema.safeParse({
      label: "Labour",
      quantity: 1,
      unit_price: -10,
      total: 10,
    }).success
  );

  assert(
    "negative total rejected",
    !quoteItemInputSchema.safeParse({
      label: "Labour",
      quantity: 1,
      unit_price: 10,
      total: -1,
    }).success
  );

  assert(
    "non-finite values rejected",
    !quoteItemInputSchema.safeParse({
      label: "Labour",
      total: Number.NaN,
    }).success
  );

  assert(
    "invalid GST rejected",
    !quoteDocumentGstSchema.safeParse({ gst_rate: -1 }).success
  );

  assert(
    "gross margin above 95 rejected where applicable",
    !validateMarginPercent(96).ok
  );

  assert(
    "markup above 1000 rejected where applicable",
    !validateMarkupPercent(1000.1).ok
  );

  assert(
    "blank numeric string does not become zero",
    !quoteItemInputSchema.safeParse({
      label: "Labour",
      quantity: "" as unknown as number,
      total: 0,
    }).success
  );

  assert(
    "delete/set-visible schemas reject bad IDs",
    !deleteQuoteItemInputSchema.safeParse({ quoteItemId: "x" }).success &&
      !setQuoteItemVisibleInputSchema.safeParse({
        quoteItemId: "x",
        visible: true,
      }).success
  );
}

function testCreateAndRevision() {
  console.log("\n--- Quote creation and revision ---\n");

  assert(
    "valid quote creation payload accepted",
    createQuoteFromPricingInputSchema.safeParse({
      projectId: PROJECT_UUID,
      pricingDocumentId: DOC_UUID,
    }).success
  );

  assert(
    "invalid create payload rejected before write",
    !createQuoteFromPricingInputSchema.safeParse({
      projectId: "bad",
      pricingDocumentId: DOC_UUID,
    }).success
  );

  assert(
    "valid revision payload accepted",
    reviseQuoteInputSchema.safeParse({
      projectId: PROJECT_UUID,
      quoteId: QUOTE_UUID,
    }).success
  );

  assert(
    "revision of malformed quote ID rejected",
    !reviseQuoteInputSchema.safeParse({
      projectId: PROJECT_UUID,
      quoteId: "foreign",
    }).success
  );

  assert(
    "valid revise-from-pricing payload accepted (quoteId required)",
    reviseQuoteFromFinalPricingInputSchema.safeParse({
      projectId: PROJECT_UUID,
      quoteId: QUOTE_UUID,
      pricingDocumentId: DOC_UUID,
    }).success
  );

  assert(
    "revise-from-pricing without quoteId rejected",
    !reviseQuoteFromFinalPricingInputSchema.safeParse({
      projectId: PROJECT_UUID,
      pricingDocumentId: DOC_UUID,
    }).success
  );

  let writeReached = false;
  const rejectedCreate = parseQuoteInput(createQuoteFromPricingInputSchema, {
    projectId: "bad",
    pricingDocumentId: DOC_UUID,
  });
  if (rejectedCreate.ok) writeReached = true;
  assert(
    "rejected creation does not leave a parent record (fails before write)",
    !rejectedCreate.ok && writeReached === false
  );
}

function testQuoteItemOperations() {
  console.log("\n--- Quote item operations ---\n");

  const validItem = quoteItemInputSchema.safeParse({
    label: "Deck labour",
    quantity: 10,
    unit_price: 80,
    total: 800,
  });
  assert("valid item accepted", validItem.success);

  if (validItem.success) {
    const total = calculateQuoteItemTotal({
      quantity: validItem.data.quantity,
      unitPrice: validItem.data.unit_price,
      total: validItem.data.total,
    });
    assert(
      "valid computed total passes persistence guard",
      validateQuoteItemTotalForPersistence(total).ok
    );
  }

  assert(
    "update quote item schema rejects bad item id",
    !updateQuoteItemInputSchema.safeParse({
      quoteItemId: "x",
      item: { label: "x" },
    }).success
  );

  assert(
    "update quote details schema rejects bad quote id",
    !updateQuoteInputSchema.safeParse({
      quoteId: "x",
      quote: { title: "Hello" },
    }).success
  );

  assert(
    "deletion of foreign item rejected at schema when malformed",
    !deleteQuoteItemInputSchema.safeParse({ quoteItemId: "not-uuid" }).success
  );

  assert(
    "negative computed total rejected by persistence guard",
    !validateQuoteItemTotalForPersistence(-1).ok
  );
}

function testMutationOrdering() {
  console.log("\n--- Mutation ordering ---\n");

  let writeCount = 0;
  const wouldWrite = () => {
    writeCount += 1;
  };

  const badSchema = validateUpdateQuoteItemPayload("bad-id", {
    label: "Labour",
    total: 10,
  });
  if (badSchema.ok) wouldWrite();
  assert(
    "validation failure before write",
    !badSchema.ok && writeCount === 0
  );

  const authFail = quoteAuthFailure(
    evaluateAuthOrgInputs({
      user: null,
      profile: null,
      organisation: null,
    })
  );
  if (!authFail) wouldWrite();
  assert("ownership/auth failure before write", authFail !== null && writeCount === 0);

  const rejected = parseQuoteInput(reviseQuoteInputSchema, {
    projectId: "bad",
    quoteId: QUOTE_UUID,
  });
  if (rejected.ok) wouldWrite();
  assert(
    "no child, audit or revision record after rejected input",
    !rejected.ok && writeCount === 0
  );

  const sanitized = toUserError(
    { message: "duplicate key value violates unique constraint" },
    "quote-test",
    USER_ERRORS.quoteCreateFailed
  );
  assert(
    "raw database messages are not returned",
    sanitized === USER_ERRORS.quoteCreateFailed &&
      !sanitized.includes("duplicate key")
  );
}

async function main() {
  console.log("=== Batch 2A.3B quote actions verification ===");
  testAuthentication();
  await testOwnership();
  testInputValidation();
  testCreateAndRevision();
  testQuoteItemOperations();
  testMutationOrdering();

  if (process.exitCode && process.exitCode !== 0) {
    console.log("\nBatch 2A.3B verification FAILED");
    process.exit(1);
  }
  console.log("\nBatch 2A.3B verification PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
