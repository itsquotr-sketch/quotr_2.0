/**
 * Lightweight smoke checks for Sprint 3 performance/responsive deliverables.
 * Does not replace manual viewport QA — see docs/PERFORMANCE_RESPONSIVE_QA.md.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  isRetryableAnthropicError,
  withAnthropicRetry,
} from "../lib/ai/retry";

const root = resolve(import.meta.dirname ?? __dirname, "..");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function fileContains(relativePath: string, needle: string): boolean {
  const path = resolve(root, relativePath);
  assert(existsSync(path), `Missing file: ${relativePath}`);
  return readFileSync(path, "utf8").includes(needle);
}

async function testRetryUtility(): Promise<void> {
  assert(isRetryableAnthropicError({ status: 429 }), "429 should be retryable");
  assert(isRetryableAnthropicError({ status: 503 }), "503 should be retryable");
  assert(
    !isRetryableAnthropicError({ status: 400 }),
    "400 should not be retryable"
  );

  let attempts = 0;
  const result = await withAnthropicRetry(
    async () => {
      attempts += 1;
      if (attempts < 2) {
        throw { status: 503, message: "transient" };
      }
      return "ok";
    },
    { maxAttempts: 3, label: "smoke-test" }
  );
  assert(result === "ok", "retry should succeed on second attempt");
  assert(attempts === 2, `expected 2 attempts, got ${attempts}`);
}

function testDeliverableFiles(): void {
  const required = [
    "docs/PERFORMANCE_RESPONSIVE_QA.md",
    "lib/hooks/use-media-query.ts",
    "lib/ai/retry.ts",
    "components/pricing/PricingItemListItem.tsx",
    "components/quotes/QuoteMobileActionBar.tsx",
  ];

  for (const file of required) {
    assert(existsSync(resolve(root, file)), `Missing deliverable: ${file}`);
  }
}

function testResponsivePatterns(): void {
  assert(
    fileContains(
      "components/pricing/PricingWorkAreaSection.tsx",
      "useIsDesktop"
    ),
    "Pricing work areas should use single-layout mount"
  );
  assert(
    fileContains("components/projects/DashboardProjectList.tsx", "useIsDesktop"),
    "Dashboard should use single-layout mount"
  );
  assert(
    fileContains("components/pricing/PricingItemRow.tsx", "useMemo"),
    "PricingItemRow should memoise expensive derivations"
  );
  assert(
    fileContains("components/assistant/AssistantShell.tsx", "actionLockRef"),
    "Assistant should guard against duplicate actions"
  );
}

async function main(): Promise<void> {
  console.log("verify-performance-smoke: starting…");
  testDeliverableFiles();
  testResponsivePatterns();
  await testRetryUtility();
  console.log("verify-performance-smoke: all checks passed");
}

main().catch((error) => {
  console.error("verify-performance-smoke: FAILED");
  console.error(error);
  process.exit(1);
});
