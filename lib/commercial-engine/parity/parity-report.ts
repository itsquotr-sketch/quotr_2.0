/**
 * Parity report builders — Batch 2B.4.
 */

import type { ParityClassification } from "./classifications";
import type { ParityResult } from "./types";

export type ParityReportTotals = {
  readonly fixturesRun: number;
  readonly exactMatches: number;
  readonly roundingOrNormalisation: number;
  readonly approvedEngineCorrections: number;
  readonly legacyInconsistencies: number;
  readonly adoptionBlockers: number;
  readonly deferredDifferences: number;
  readonly presentationOnly: number;
  readonly other: number;
  readonly failed: number;
};

function countClass(
  results: readonly ParityResult[],
  classes: readonly ParityClassification[]
): number {
  return results.filter((r) => classes.includes(r.classification)).length;
}

export function summarizeParityResults(
  results: readonly ParityResult[],
  failed: number
): ParityReportTotals {
  return Object.freeze({
    fixturesRun: results.length,
    exactMatches: countClass(results, ["EXACT_MATCH"]),
    roundingOrNormalisation: countClass(results, [
      "MATCH_WITH_ROUNDING_DIFFERENCE",
      "MATCH_AFTER_INPUT_NORMALISATION",
    ]),
    approvedEngineCorrections: countClass(results, [
      "APPROVED_ENGINE_CORRECTION",
    ]),
    legacyInconsistencies: countClass(results, ["LEGACY_INCONSISTENCY"]),
    adoptionBlockers: countClass(results, ["BLOCKING_ADOPTION_MISMATCH"]),
    deferredDifferences: countClass(results, [
      "DEFERRED_WORKFLOW_DIFFERENCE",
      "UNSUPPORTED_LEGACY_MODE",
      "MISSING_LEGACY_INPUT",
      "PERSISTENCE_ONLY_DIFFERENCE",
    ]),
    presentationOnly: countClass(results, ["PRESENTATION_ONLY_DIFFERENCE"]),
    other: 0,
    failed,
  });
}

export function formatParityMarkdownReport(
  results: readonly ParityResult[],
  totals: ParityReportTotals
): string {
  const lines: string[] = [
    "# Shadow Parity Report — Batch 2B.4",
    "",
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Totals",
    "",
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Fixtures run | ${totals.fixturesRun} |`,
    `| Exact matches | ${totals.exactMatches} |`,
    `| Rounding / normalisation | ${totals.roundingOrNormalisation} |`,
    `| Approved engine corrections | ${totals.approvedEngineCorrections} |`,
    `| Legacy inconsistencies | ${totals.legacyInconsistencies} |`,
    `| Adoption blockers | ${totals.adoptionBlockers} |`,
    `| Deferred differences | ${totals.deferredDifferences} |`,
    `| Presentation-only | ${totals.presentationOnly} |`,
    `| Runner failures | ${totals.failed} |`,
    "",
    "## Results",
    "",
    `| Fixture | Legacy ID | Classification | Blocking | Authority |`,
    `| --- | --- | --- | --- | --- |`,
  ];

  for (const r of results) {
    lines.push(
      `| ${r.fixtureId} | ${r.legacyId} | ${r.classification} | ${r.blockingStatus ? "yes" : "no"} | ${r.commercialAuthority} |`
    );
  }

  lines.push("", "## Explanations", "");
  for (const r of results) {
    lines.push(`### ${r.fixtureId}`);
    lines.push(r.explanation);
    lines.push("");
  }

  return lines.join("\n");
}

export function formatParityJsonReport(
  results: readonly ParityResult[],
  totals: ParityReportTotals
): string {
  return JSON.stringify(
    {
      batch: "2B.4",
      totals,
      results: results.map((r) => ({
        fixtureId: r.fixtureId,
        legacyId: r.legacyId,
        classification: r.classification,
        commercialAuthority: r.commercialAuthority,
        blockingStatus: r.blockingStatus,
        futureAdoptionBatch: r.futureAdoptionBatch,
        explanation: r.explanation,
        numericDeltas: r.numericDeltas,
        legacyOutputs: r.legacyOutputs,
        engineOutputs: r.engineOutputs,
      })),
    },
    null,
    2
  );
}
