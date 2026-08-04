/**
 * Batch 2B.3B — Golden commercial engine regression runner.
 *
 * Loads executable fixtures, runs the standalone commercial kernel,
 * compares against approved golden expected results (never recomputed).
 *
 * No React, Supabase, server actions, or application state.
 */

import {
  calculateDocumentAggregate,
  calculateLineItem,
} from "../lib/commercial-engine";
import type {
  AggregateInput,
  CalculationLineInput,
} from "../lib/commercial-engine";
import {
  AGGREGATE_VALIDATION_FIXTURES,
  CANONICAL_AGGREGATE_FIXTURES,
  CANONICAL_LINE_FIXTURES,
  CANONICAL_SCENARIO_IDS,
  compareAggregateScenario,
  compareLineScenario,
  compareValidationScenario,
  getDeferredScenarioIds,
  getExecutableScenarioIds,
  isExecutableClassification,
  KNOWN_SCENARIO_IDS,
  LINE_VALIDATION_FIXTURES,
  SCENARIO_EXECUTION_MAP,
  SUPPLEMENTAL_SCENARIO_IDS,
} from "../lib/commercial-engine/fixtures";
import type {
  GoldenAggregateScenario,
  GoldenCompareReport,
  GoldenLineScenario,
  GoldenValidationScenario,
} from "../lib/commercial-engine/fixtures";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function printReport(kind: string, report: GoldenCompareReport): void {
  if (report.pass) {
    console.log(`PASS  [${kind}] ${report.scenario_id}`);
    return;
  }
  console.log(`FAIL  [${kind}] ${report.scenario_id}`);
  for (const d of report.differences) {
    console.log(
      `        mismatch ${d.field}: expected=${String(d.expected)} actual=${String(d.actual)}${
        d.delta != null ? ` delta=${d.delta}` : ""
      }`
    );
  }
}

function main(): void {
  // --- Map integrity ---
  if (SCENARIO_EXECUTION_MAP.length !== 52) {
    fail(`Execution map must have 52 scenarios, got ${SCENARIO_EXECUTION_MAP.length}`);
  }
  if (CANONICAL_SCENARIO_IDS.length !== 52) {
    fail("Canonical ID list must be 52");
  }

  const mapIds = SCENARIO_EXECUTION_MAP.map((s) => s.scenarioId);
  const mapSet = new Set(mapIds);
  if (mapSet.size !== mapIds.length) {
    fail("Duplicate scenario IDs in execution map");
  }
  for (const id of CANONICAL_SCENARIO_IDS) {
    if (!mapSet.has(id)) fail(`Missing map entry for ${id}`);
  }

  const executableIds = getExecutableScenarioIds();
  const deferredIds = getDeferredScenarioIds();

  const lineFixtures = [...CANONICAL_LINE_FIXTURES];
  const aggregateFixtures = [...CANONICAL_AGGREGATE_FIXTURES];
  const validationFixtures: GoldenValidationScenario[] = [
    ...LINE_VALIDATION_FIXTURES,
    ...AGGREGATE_VALIDATION_FIXTURES,
  ];

  const allFixtureIds = [
    ...lineFixtures.map((f) => f.scenarioId),
    ...aggregateFixtures.map((f) => f.scenarioId),
    ...validationFixtures.map((f) => f.scenarioId),
  ];
  const fixtureSet = new Set(allFixtureIds);
  if (fixtureSet.size !== allFixtureIds.length) {
    const seen = new Set<string>();
    for (const id of allFixtureIds) {
      if (seen.has(id)) fail(`Duplicate fixture scenario ID: ${id}`);
      seen.add(id);
    }
  }

  const knownSet = new Set<string>(KNOWN_SCENARIO_IDS);
  for (const id of allFixtureIds) {
    if (!knownSet.has(id)) fail(`Fixture references unknown scenario ID: ${id}`);
  }

  for (const id of executableIds) {
    if (!fixtureSet.has(id)) {
      fail(`Executable scenario ${id} has no fixture`);
    }
  }

  for (const id of SUPPLEMENTAL_SCENARIO_IDS) {
    if (!fixtureSet.has(id)) {
      fail(`Supplemental scenario ${id} has no fixture`);
    }
  }

  // Coverage vs map
  const mapExecutable = SCENARIO_EXECUTION_MAP.filter((s) =>
    isExecutableClassification(s.classification)
  );
  if (mapExecutable.length !== executableIds.length) {
    fail("Executable classification count mismatch");
  }

  let passed = 0;
  let failed = 0;

  const runLine = (fixture: GoldenLineScenario): void => {
    const result = calculateLineItem(fixture.input);
    const report = compareLineScenario(result, fixture);
    printReport("line", report);
    if (report.pass) passed += 1;
    else failed += 1;
  };

  const runAggregate = (fixture: GoldenAggregateScenario): void => {
    const input: AggregateInput = {
      lines: fixture.lines.map((l) => ({
        total_cost: l.total_cost,
        total_sell: l.total_sell,
        visible: l.visible,
        included_in_total: l.included_in_total,
        cost_known: l.cost_known,
      })),
      inclusion_rule: fixture.inclusionRule,
      gst_rate_percent: fixture.gstRate === undefined ? undefined : fixture.gstRate,
    };
    const result = calculateDocumentAggregate(input);
    const report = compareAggregateScenario(result, fixture);
    printReport("aggregate", report);
    if (report.pass) passed += 1;
    else failed += 1;
  };

  const runValidation = (fixture: GoldenValidationScenario): void => {
    let report: GoldenCompareReport;
    if (fixture.kind === "line") {
      const result = calculateLineItem(
        fixture.invalidInput as CalculationLineInput
      );
      report = compareValidationScenario(result, fixture);
    } else {
      const inv = fixture.invalidInput as {
        lines: AggregateInput["lines"];
        inclusion_rule: AggregateInput["inclusion_rule"];
        gst_rate_percent?: number | null;
      };
      const result = calculateDocumentAggregate({
        lines: inv.lines,
        inclusion_rule: inv.inclusion_rule,
        gst_rate_percent: inv.gst_rate_percent,
      });
      report = compareValidationScenario(result, fixture);
    }
    printReport("validation", report);
    if (report.pass) passed += 1;
    else failed += 1;
  };

  console.log("=== Batch 2B.3B Golden Commercial Engine Verification ===\n");

  for (const f of lineFixtures) runLine(f);
  for (const f of aggregateFixtures) runAggregate(f);
  for (const f of validationFixtures) runValidation(f);

  const scenariosLoaded = SCENARIO_EXECUTION_MAP.length;
  const executable = executableIds.length;
  const deferred = deferredIds.length;
  const supplemental = SUPPLEMENTAL_SCENARIO_IDS.length;
  const fixturesRun = lineFixtures.length + aggregateFixtures.length + validationFixtures.length;
  const coveragePct = ((executable / scenariosLoaded) * 100).toFixed(1);

  console.log("\n=== Totals ===");
  console.log(`scenarios loaded (CCS):     ${scenariosLoaded}`);
  console.log(`executable (CCS):           ${executable}`);
  console.log(`deferred/doc-only (CCS):    ${deferred}`);
  console.log(`supplemental fixtures:      ${supplemental}`);
  console.log(`fixtures executed:          ${fixturesRun}`);
  console.log(`passed:                     ${passed}`);
  console.log(`failed:                     ${failed}`);
  console.log(`CCS executable coverage:    ${coveragePct}%`);

  if (failed > 0) {
    process.exit(1);
  }
  console.log("\nAll executable golden fixtures passed.");
}

main();
