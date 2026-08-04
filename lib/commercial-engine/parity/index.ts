/**
 * Shadow-parity package — Batch 2B.4.
 *
 * NOT part of the commercial-engine production public API.
 * Do not import from application server actions or UI.
 * Comparison / documentation evidence only — not Company DNA.
 */

export type { ParityClassification } from "./classifications";
export { PARITY_CLASSIFICATIONS, isParityClassification } from "./classifications";
export type {
  LegacyImplementationRecord,
  NormalizedFinancialOutputs,
  ParityFixture,
  ParityResult,
  KnownMismatchRecord,
  CommercialAuthority,
} from "./types";
export {
  LEGACY_IMPLEMENTATION_REGISTRY,
  getLegacyById,
  assertRegistryIntegrity,
} from "./registry";
export { KNOWN_MISMATCH_REGISTER } from "./known-mismatches";
export { PARITY_FIXTURES, getParityFixtureIds, getCoveredLegacyIds } from "./fixtures";
export {
  REQUIRED_PARITY_LEGACY_IDS,
  DEFERRED_PARITY_LEGACY_IDS,
} from "./coverage";
export { runShadowParitySuite } from "./run-parity";
export {
  summarizeParityResults,
  formatParityMarkdownReport,
  formatParityJsonReport,
} from "./parity-report";
export { runFixtureComparison } from "./compare-legacy-result";
