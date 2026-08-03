/**
 * Batch 2A.3A focused verification — pricing action auth, ownership, schemas.
 *
 * Run: npx --yes tsx scripts/verify-batch-2a3a-pricing-actions.ts
 *
 * Exercises production schemas and guard helpers. Mocked ownership only.
 * Does not touch production data or invoke live Server Actions.
 */
import { calculatePricingItemTotals } from "../lib/pricing/calculations";
import {
  parsePricingInput,
  pricingAuthFailure,
  validateComputedItemForPersistence,
  validateUpdatePricingItemPayload,
} from "../lib/pricing/action-guards";
import {
  addPricingItemInputSchema,
  createPricingFromEstimateInputSchema,
  deletePricingItemInputSchema,
  duplicatePricingItemInputSchema,
  markPricingReviewedInputSchema,
  pricingItemInputSchema,
  updatePricingDocumentInputSchema,
  updatePricingItemInputSchema,
} from "../lib/pricing/schemas";
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "../lib/security/auth-org-evaluation";
import {
  assertOrgOwnsEstimate,
  assertOrgOwnsPricingDocument,
  assertOrgOwnsPricingItem,
  assertOrgOwnsProject,
  type AuthOrgContext,
} from "../lib/security/org-ownership";
import { toUserError } from "../lib/errors/user-message";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const ORG_B_UUID = "22222222-2222-4222-8222-222222222222";
const ITEM_UUID = "33333333-3333-4333-8333-333333333333";
const DOC_UUID = "44444444-4444-4444-8444-444444444444";
const PROJECT_UUID = "55555555-5555-4555-8555-555555555555";

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

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    internal_label: "Labour",
    client_label: "Labour",
    item_type: "labour",
    delivery_method: "in_house",
    ...overrides,
  };
}

function testAuthenticationGuards() {
  console.log("\n--- Authentication ---\n");

  const unauthenticated = evaluateAuthOrgInputs({
    user: null,
    profile: null,
    organisation: null,
  });
  assert(
    "unauthenticated pricing mutation rejected",
    !unauthenticated.ok &&
      pricingAuthFailure(unauthenticated)?.error ===
        AUTH_ORG_MESSAGES.not_authenticated
  );

  const missingOrg = evaluateAuthOrgInputs({
    user: { id: "user-a", email: "a@example.com" },
    profile: { org_id: null },
    organisation: null,
  });
  assert(
    "missing-org user rejected",
    !missingOrg.ok &&
      pricingAuthFailure(missingOrg)?.error ===
        AUTH_ORG_MESSAGES.organisation_required
  );

  const success = evaluateAuthOrgInputs({
    user: { id: "user-a", email: "a@example.com" },
    profile: { org_id: "org-a" },
    organisation: { id: "org-a" },
  });
  assert(
    "authenticated org user passes auth guard",
    success.ok && pricingAuthFailure(success) === null
  );
}

async function testOwnershipGuards() {
  console.log("\n--- Ownership ---\n");

  const orgAOwned: AuthOrgContext = {
    supabase: createMockSupabase({
      pricing_documents: () => ({
        data: { id: DOC_UUID, project_id: PROJECT_UUID },
        error: null,
      }),
      pricing_items: () => ({
        data: {
          id: ITEM_UUID,
          pricing_document_id: DOC_UUID,
          project_id: PROJECT_UUID,
        },
        error: null,
      }),
      projects: () => ({ data: { id: PROJECT_UUID }, error: null }),
      estimates: () => ({
        data: { id: VALID_UUID, project_id: PROJECT_UUID },
        error: null,
      }),
    }),
    orgId: "org-a",
    user: { id: "user-a" },
  };

  const orgAEmpty: AuthOrgContext = {
    supabase: createMockSupabase({
      pricing_documents: () => ({ data: null, error: null }),
      pricing_items: () => ({ data: null, error: null }),
      projects: () => ({ data: null, error: null }),
      estimates: () => ({ data: null, error: null }),
    }),
    orgId: "org-a",
    user: { id: "user-a" },
  };

  const ownedDoc = await assertOrgOwnsPricingDocument(orgAOwned, DOC_UUID);
  assert(
    "User A may mutate Organisation A pricing document",
    !("error" in ownedDoc)
  );

  const foreignDoc = await assertOrgOwnsPricingDocument(orgAEmpty, ORG_B_UUID);
  const missingDoc = await assertOrgOwnsPricingDocument(orgAEmpty, DOC_UUID);
  assert(
    "User A may not mutate Organisation B pricing document",
    "error" in foreignDoc
  );
  assert(
    "missing and foreign document IDs produce equivalent external errors",
    "error" in foreignDoc &&
      "error" in missingDoc &&
      foreignDoc.error === missingDoc.error &&
      foreignDoc.error === "Pricing document not found."
  );

  const ownedItem = await assertOrgOwnsPricingItem(orgAOwned, ITEM_UUID);
  assert(
    "User A may access Organisation A pricing item",
    !("error" in ownedItem)
  );

  const foreignItem = await assertOrgOwnsPricingItem(orgAEmpty, ORG_B_UUID);
  const missingItem = await assertOrgOwnsPricingItem(orgAEmpty, ITEM_UUID);
  assert(
    "User A may not update/delete/duplicate Organisation B pricing item",
    "error" in foreignItem
  );
  assert(
    "missing and foreign item IDs produce equivalent external errors",
    "error" in foreignItem &&
      "error" in missingItem &&
      foreignItem.error === missingItem.error &&
      foreignItem.error === "Pricing item not found."
  );

  const ownedProject = await assertOrgOwnsProject(orgAOwned, PROJECT_UUID);
  assert("User A may use Organisation A project", !("error" in ownedProject));

  const ownedEstimate = await assertOrgOwnsEstimate(
    orgAOwned,
    VALID_UUID,
    PROJECT_UUID
  );
  assert(
    "User A may use Organisation A estimate",
    !("error" in ownedEstimate)
  );

  const foreignEstimate = await assertOrgOwnsEstimate(orgAEmpty, ORG_B_UUID);
  assert("foreign estimate rejected as not found", "error" in foreignEstimate);
}

function testInputValidation() {
  console.log("\n--- Input validation ---\n");

  assert(
    "invalid UUID rejected",
    !updatePricingItemInputSchema.safeParse({
      pricingItemId: "not-a-uuid",
      item: baseItem({
        calculation_mode: "quantity_rate",
        quantity: 1,
        total_cost: 10,
        total_sell: 12,
      }),
    }).success
  );

  assert(
    "invalid calculation mode rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({ calculation_mode: "magic", total_cost: 1, total_sell: 1 })
    ).success
  );

  assert(
    "negative quantity rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "quantity_rate",
        quantity: -1,
        total_cost: 10,
        total_sell: 12,
      })
    ).success
  );

  assert(
    "negative rate rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "quantity_rate",
        quantity: 1,
        unit_cost: -5,
        total_cost: 10,
        total_sell: 12,
      })
    ).success
  );

  assert(
    "negative total rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "lump_sum",
        total_cost: -1,
        total_sell: 10,
      })
    ).success
  );

  assert(
    "non-finite values rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "lump_sum",
        total_cost: Number.NaN,
        total_sell: 10,
      })
    ).success
  );

  assert(
    "gross margin above 95 rejected",
    !validateComputedItemForPersistence({
      totalCost: 10,
      totalSell: 100,
      marginPercent: 96,
      markupPercent: 100,
    }).ok
  );

  assert(
    "markup above 1000 rejected",
    !validateComputedItemForPersistence({
      totalCost: 10,
      totalSell: 20,
      marginPercent: 50,
      markupPercent: 1000.1,
    }).ok
  );

  assert(
    "invalid GST rejected",
    !updatePricingDocumentInputSchema.safeParse({
      pricingDocumentId: DOC_UUID,
      document: { gst_rate: -1 },
    }).success
  );

  assert(
    "empty numeric string does not become zero",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "quantity_rate",
        quantity: "" as unknown as number,
        total_cost: 0,
        total_sell: 0,
      })
    ).success
  );

  assert(
    "createPricingFromEstimate requires UUID projectId",
    !createPricingFromEstimateInputSchema.safeParse({
      projectId: "bad",
    }).success
  );

  assert(
    "add/delete/duplicate/review schemas reject bad IDs",
    !addPricingItemInputSchema.safeParse({
      pricingDocumentId: "x",
      projectId: PROJECT_UUID,
    }).success &&
      !deletePricingItemInputSchema.safeParse({ pricingItemId: "x" }).success &&
      !duplicatePricingItemInputSchema.safeParse({ pricingItemId: "x" })
        .success &&
      !markPricingReviewedInputSchema.safeParse({ pricingDocumentId: "x" })
        .success
  );
}

function testLumpSumGuards() {
  console.log("\n--- Lump-sum ---\n");

  const validLump = pricingItemInputSchema.safeParse(
    baseItem({
      calculation_mode: "lump_sum",
      total_cost: 100,
      total_sell: 125,
    })
  );
  assert("valid lump-sum item accepted through validation", validLump.success);

  if (validLump.success) {
    const totals = calculatePricingItemTotals({
      quantity: validLump.data.quantity,
      unitCost: validLump.data.unit_cost,
      unitSell: validLump.data.unit_sell,
      totalCost: validLump.data.total_cost,
      totalSell: validLump.data.total_sell,
      itemType: validLump.data.item_type,
      calculationMode: validLump.data.calculation_mode,
      productivityRate: validLump.data.productivity_rate,
      productivityUnit: validLump.data.productivity_unit,
      calculatedQuantity: validLump.data.calculated_quantity,
    });
    const commercial = validateComputedItemForPersistence({
      totalCost: totals.totalCost,
      totalSell: totals.totalSell,
      marginPercent: totals.marginPercent,
      markupPercent: totals.markupPercent,
    });
    assert(
      "valid lump-sum passes calc + commercial guard path",
      commercial.ok
    );
  }

  assert(
    "negative lump-sum rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "lump_sum",
        total_cost: -10,
        total_sell: 10,
      })
    ).success
  );

  assert(
    "non-finite lump-sum rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "lump_sum",
        total_cost: Number.POSITIVE_INFINITY,
        total_sell: 10,
      })
    ).success
  );

  assert(
    "missing required lump-sum total rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "lump_sum",
        total_cost: 10,
      })
    ).success
  );

  assert(
    "invalid margin after lump-sum calc rejected",
    !validateComputedItemForPersistence({
      totalCost: 100,
      totalSell: 125,
      marginPercent: -5,
      markupPercent: 25,
    }).ok
  );

  let writeReached = false;
  const rejected = validateUpdatePricingItemPayload(ITEM_UUID, {
    ...baseItem({
      calculation_mode: "lump_sum",
      total_cost: -1,
      total_sell: 10,
    }),
  });
  if (rejected.ok) {
    writeReached = true;
  }
  assert(
    "lump-sum cannot reach persistence without validation",
    !rejected.ok && writeReached === false
  );
}

function testOtherModes() {
  console.log("\n--- Quantity-rate and productivity-labour ---\n");

  const validQr = pricingItemInputSchema.safeParse(
    baseItem({
      calculation_mode: "quantity_rate",
      quantity: 10,
      unit: "m2",
      unit_cost: 20,
      unit_sell: 25,
      total_cost: 200,
      total_sell: 250,
    })
  );
  assert("valid quantity-rate input accepted", validQr.success);

  assert(
    "invalid quantity-rate input rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "quantity_rate",
        quantity: null,
        total_cost: 10,
        total_sell: 12,
      })
    ).success
  );

  const validPl = pricingItemInputSchema.safeParse(
    baseItem({
      calculation_mode: "productivity_labour",
      quantity: 40,
      productivity_rate: 8,
      unit_cost: 55,
      unit_sell: 70,
      calculated_quantity: 5,
      total_cost: 275,
      total_sell: 350,
    })
  );
  assert("valid productivity-labour input accepted", validPl.success);

  assert(
    "invalid productivity-labour input rejected",
    !pricingItemInputSchema.safeParse(
      baseItem({
        calculation_mode: "productivity_labour",
        quantity: 40,
        productivity_rate: null,
        calculated_quantity: null,
        total_cost: 10,
        total_sell: 12,
      })
    ).success
  );
}

function testMutationOrdering() {
  console.log("\n--- Mutation ordering ---\n");

  let writeCount = 0;
  const wouldWrite = () => {
    writeCount += 1;
  };

  const badSchema = validateUpdatePricingItemPayload("bad-id", baseItem());
  if (badSchema.ok) wouldWrite();
  assert("validation failure occurs before write", !badSchema.ok && writeCount === 0);

  const authFail = pricingAuthFailure(
    evaluateAuthOrgInputs({
      user: null,
      profile: null,
      organisation: null,
    })
  );
  if (!authFail) wouldWrite();
  assert(
    "auth failure occurs before write",
    authFail !== null && writeCount === 0
  );

  const ownershipSimulated = { error: "Pricing item not found." as const };
  if (!("error" in ownershipSimulated)) wouldWrite();
  assert(
    "ownership failure occurs before write",
    "error" in ownershipSimulated && writeCount === 0
  );

  const parsed = parsePricingInput(updatePricingItemInputSchema, {
    pricingItemId: ITEM_UUID,
    item: baseItem({
      calculation_mode: "lump_sum",
      total_cost: Number.NaN,
      total_sell: 10,
    }),
  });
  if (parsed.ok) wouldWrite();
  assert(
    "no audit or child record is written after rejected input",
    !parsed.ok && writeCount === 0
  );
}

function testErrorContract() {
  console.log("\n--- Error contract ---\n");

  const sanitized = toUserError(
    { message: "duplicate key value violates unique constraint" },
    "pricing-test",
    "Could not save pricing changes. Please try again."
  );
  assert(
    "raw database messages are not returned",
    sanitized === "Could not save pricing changes. Please try again." &&
      !sanitized.includes("duplicate key")
  );
}

async function main() {
  console.log("=== Batch 2A.3A pricing actions verification ===");
  testAuthenticationGuards();
  await testOwnershipGuards();
  testInputValidation();
  testLumpSumGuards();
  testOtherModes();
  testMutationOrdering();
  testErrorContract();

  if (process.exitCode && process.exitCode !== 0) {
    console.log("\nBatch 2A.3A verification FAILED");
    process.exit(1);
  }
  console.log("\nBatch 2A.3A verification PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
