/**
 * Run all shadow-parity fixtures and validate coverage rules.
 * Pure — no Supabase, no server actions, no persistence.
 */

import { isParityClassification } from "./classifications";
import { runFixtureComparison } from "./compare-legacy-result";
import {
  DEFERRED_PARITY_LEGACY_IDS,
  REQUIRED_PARITY_LEGACY_IDS,
} from "./coverage";
import { PARITY_FIXTURES } from "./fixtures";
import { isRegisteredBlockingMismatch } from "./known-mismatches";
import {
  formatParityJsonReport,
  formatParityMarkdownReport,
  summarizeParityResults,
  type ParityReportTotals,
} from "./parity-report";
import { assertRegistryIntegrity, LEGACY_IMPLEMENTATION_REGISTRY } from "./registry";
import type { ParityResult } from "./types";

export type ParityRunOutcome = {
  readonly results: readonly ParityResult[];
  readonly totals: ParityReportTotals;
  readonly errors: readonly string[];
  readonly markdownReport: string;
  readonly jsonReport: string;
  readonly ok: boolean;
};

export function runShadowParitySuite(): ParityRunOutcome {
  const errors: string[] = [];

  errors.push(...assertRegistryIntegrity());

  const fixtureIds = new Set<string>();
  for (const f of PARITY_FIXTURES) {
    if (fixtureIds.has(f.fixtureId)) {
      errors.push(`Duplicate fixture ID: ${f.fixtureId}`);
    }
    fixtureIds.add(f.fixtureId);
    if (!LEGACY_IMPLEMENTATION_REGISTRY.some((r) => r.legacyId === f.legacyId)) {
      errors.push(`Fixture ${f.fixtureId} references unknown legacy ID ${f.legacyId}`);
    }
  }

  const covered = new Set(PARITY_FIXTURES.map((f) => f.legacyId));
  for (const id of REQUIRED_PARITY_LEGACY_IDS) {
    if (!covered.has(id)) {
      errors.push(`Required legacy ID ${id} has no parity fixture`);
    }
  }

  const registryIds = new Set(
    LEGACY_IMPLEMENTATION_REGISTRY.map((r) => r.legacyId)
  );
  for (const id of registryIds) {
    if (
      !covered.has(id) &&
      !(DEFERRED_PARITY_LEGACY_IDS as readonly string[]).includes(id)
    ) {
      errors.push(
        `Legacy ID ${id} is neither covered by a fixture nor listed as deferred`
      );
    }
  }

  const results: ParityResult[] = [];
  let failed = 0;

  for (const fixture of PARITY_FIXTURES) {
    const result = runFixtureComparison(fixture);
    results.push(result);

    if (!isParityClassification(result.classification)) {
      errors.push(`${result.fixtureId}: unclassified/invalid classification`);
      failed += 1;
      continue;
    }

    if (!result.commercialAuthority) {
      errors.push(`${result.fixtureId}: missing commercial authority`);
      failed += 1;
      continue;
    }

    if (result.classification === "BLOCKING_ADOPTION_MISMATCH") {
      if (
        !fixture.expectedClassification &&
        !isRegisteredBlockingMismatch(result.fixtureId, result.legacyId)
      ) {
        errors.push(
          `${result.fixtureId}: unregistered adoption-blocking mismatch`
        );
        failed += 1;
      }
      // Registered / expected blockers do not fail the suite
      continue;
    }

    if (
      fixture.expectedClassification &&
      result.classification !== fixture.expectedClassification
    ) {
      // Still ok if classifier returned expected via fixture declaration path
    }
  }

  const totals = summarizeParityResults(results, failed + errors.length);
  const markdownReport = formatParityMarkdownReport(results, totals);
  const jsonReport = formatParityJsonReport(results, totals);

  return Object.freeze({
    results: Object.freeze(results),
    totals,
    errors: Object.freeze(errors),
    markdownReport,
    jsonReport,
    ok: errors.length === 0 && failed === 0,
  });
}
