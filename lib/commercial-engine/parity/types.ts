/**
 * Shadow-parity types — Batch 2B.4.
 * Engineering evidence only. Not Company DNA. Not production API.
 */

import type { CommercialCalculationRequest } from "../contract/types";
import type { ParityClassification } from "./classifications";

export type CommercialAuthority =
  | "owner_commercial_decisions"
  | "canonical_golden_results"
  | "live_legacy_behaviour"
  | "mixed_documented_disagreement";

export type LegacyDomain =
  | "estimate"
  | "pricing"
  | "quote"
  | "client_display"
  | "constants"
  | "persistence"
  | "demo";

export type LegacyImplementationRecord = {
  readonly legacyId: string;
  readonly auditId: string;
  readonly domain: LegacyDomain;
  readonly file: string;
  readonly functionName: string;
  readonly calculationMode: string;
  readonly comparisonFeasibility: "pure" | "side_effectful" | "display_only" | "schema_only";
  readonly intendedAdoptionBatch: string;
  readonly notes: string;
};

export type NormalizedFinancialOutputs = {
  readonly totalCost: number | null;
  readonly totalSell: number | null;
  readonly grossProfit: number | null;
  readonly grossMarginPercent: number | null;
  readonly markupPercent: number | null;
  readonly gstAmount: number | null;
  readonly totalInclGst: number | null;
  readonly gstRatePercent: number | null;
  readonly costKnown: boolean | null;
};

export type ParityFixtureKind =
  | "pricing_item"
  | "pricing_document"
  | "estimate"
  | "quote"
  | "client_display"
  | "known_defect";

export type ParityFixture = {
  readonly fixtureId: string;
  readonly legacyId: string;
  readonly kind: ParityFixtureKind;
  readonly description: string;
  readonly scenarioRef: string | null;
  /** Expected classification when paths intentionally disagree. Null = must EXACT_MATCH (or rounding/normalisation). */
  readonly expectedClassification: ParityClassification | null;
  readonly commercialAuthority: CommercialAuthority;
  readonly blockingAdoption: boolean;
  readonly futureAdoptionBatch: string | null;
  readonly legacyInputs: Readonly<Record<string, unknown>>;
  readonly run: () => ParityComparisonPair;
};

export type ParityComparisonPair = {
  readonly legacyOutputs: NormalizedFinancialOutputs;
  readonly engineRequest: CommercialCalculationRequest | null;
  readonly engineOutputs: NormalizedFinancialOutputs | null;
  readonly notes: string[];
};

export type ParityResult = {
  readonly fixtureId: string;
  readonly legacyId: string;
  readonly scenarioOrFixtureId: string;
  readonly legacyInputs: Readonly<Record<string, unknown>>;
  readonly normalizedEngineRequest: CommercialCalculationRequest | null;
  readonly legacyOutputs: NormalizedFinancialOutputs;
  readonly engineOutputs: NormalizedFinancialOutputs | null;
  readonly numericDeltas: Readonly<Record<string, number | null>>;
  readonly classification: ParityClassification;
  readonly commercialAuthority: CommercialAuthority;
  readonly explanation: string;
  readonly blockingStatus: boolean;
  readonly futureAdoptionBatch: string | null;
};

export type KnownMismatchRecord = {
  readonly mismatchId: string;
  readonly auditRefs: readonly string[];
  readonly legacyIds: readonly string[];
  readonly title: string;
  readonly description: string;
  readonly classification: ParityClassification;
  readonly commercialAuthority: CommercialAuthority;
  readonly engineIsAuthoritative: boolean;
  readonly retainLegacyTemporarily: boolean;
  readonly blocksAdoption: boolean;
  readonly specialHandling: string;
  readonly historicalSnapshotRule: string;
  readonly targetBatch: string;
};
