/**
 * Batch 2B.4 — Legacy calculation shadow parity harness.
 *
 * Does not connect to Supabase, invoke server actions, or change live totals.
 * Does not import into application production paths.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runShadowParitySuite } from "../lib/commercial-engine/parity";

function main(): void {
  console.log("=== Batch 2B.4 Shadow Parity Verification ===\n");

  const outcome = runShadowParitySuite();

  for (const r of outcome.results) {
    const flag = r.blockingStatus ? "BLOCK" : "ok";
    console.log(
      `${r.classification.padEnd(32)} [${flag}] ${r.fixtureId} (${r.legacyId})`
    );
  }

  console.log("\n=== Totals ===");
  console.log(`fixtures run:                  ${outcome.totals.fixturesRun}`);
  console.log(`exact matches:                 ${outcome.totals.exactMatches}`);
  console.log(
    `rounding/normalisation:        ${outcome.totals.roundingOrNormalisation}`
  );
  console.log(
    `approved engine corrections:   ${outcome.totals.approvedEngineCorrections}`
  );
  console.log(
    `legacy inconsistencies:        ${outcome.totals.legacyInconsistencies}`
  );
  console.log(`adoption blockers:             ${outcome.totals.adoptionBlockers}`);
  console.log(`deferred differences:          ${outcome.totals.deferredDifferences}`);
  console.log(`presentation-only:             ${outcome.totals.presentationOnly}`);

  if (outcome.errors.length > 0) {
    console.log("\n=== Errors ===");
    for (const e of outcome.errors) {
      console.log(`FAIL  ${e}`);
    }
  }

  const outDir = join(process.cwd(), "docs", "implementation");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "STAGE_2B_BATCH_2B4_PARITY_REPORT.md"),
    outcome.markdownReport,
    "utf8"
  );
  writeFileSync(
    join(outDir, "STAGE_2B_BATCH_2B4_PARITY_REPORT.json"),
    outcome.jsonReport,
    "utf8"
  );
  console.log(
    "\nWrote docs/implementation/STAGE_2B_BATCH_2B4_PARITY_REPORT.md"
  );
  console.log(
    "Wrote docs/implementation/STAGE_2B_BATCH_2B4_PARITY_REPORT.json"
  );

  if (!outcome.ok) {
    process.exit(1);
  }
  console.log("\nShadow parity suite passed (approved mismatches documented).");
}

main();
