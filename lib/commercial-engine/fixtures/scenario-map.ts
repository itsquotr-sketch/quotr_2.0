/**
 * Scenario execution map — mirrors docs/specifications/GOLDEN_SCENARIO_EXECUTION_MAP.md
 */

import type { ScenarioMapEntry } from "./fixture-types";

export const CANONICAL_SCENARIO_IDS = Object.freeze(
  Array.from({ length: 52 }, (_, i) => `CCS-${String(i + 1).padStart(3, "0")}`)
);

const L = "Executable now — line item" as const;
const A = "Executable now — aggregate/document" as const;
const DOC = "Documentation-only — future workflow" as const;
const DEF_P = "Deferred — requires live persistence" as const;
const DEF_PA = "Deferred — requires pricing-action integration" as const;
const DEF_DNA = "Deferred — requires Company DNA" as const;

function e(
  scenarioId: string,
  category: string,
  classification: ScenarioMapEntry["classification"],
  engineCapability: string,
  fixtureFile: string | null,
  deferredDependency: string | null = null,
  deferralReason: string | null = null,
  futureBatch: string | null = null
): ScenarioMapEntry {
  return Object.freeze({
    scenarioId,
    category,
    classification,
    engineCapability,
    fixtureFile,
    expectedResultSource: `GOLDEN_PRICING_EXPECTED_RESULTS.md (${scenarioId})`,
    deferredDependency,
    deferralReason,
    futureBatch,
  });
}

export const SCENARIO_EXECUTION_MAP: readonly ScenarioMapEntry[] = Object.freeze([
  e("CCS-001", "A", L, "quantity_rate + sell-from-margin", "canonical-line-fixtures.ts"),
  e("CCS-002", "B, C", L, "productivity_labour", "canonical-line-fixtures.ts"),
  e("CCS-003", "A, C", L, "waste before money", "canonical-line-fixtures.ts"),
  e("CCS-004", "C", A, "labour + materials package + GST", "canonical-aggregate-fixtures.ts"),
  e("CCS-005", "D", A, "labour + materials + subcontractor", "canonical-aggregate-fixtures.ts"),
  e("CCS-006", "E", L, "lump sum cost+sell", "canonical-line-fixtures.ts"),
  e("CCS-007", "F", L, "allowance lump + warning", "canonical-line-fixtures.ts"),
  e("CCS-008", "G", L, "provisional lump + warning", "canonical-line-fixtures.ts"),
  e("CCS-009", "H", L, "intentional zero / no-charge", "canonical-line-fixtures.ts"),
  e("CCS-010", "I", L, "informational zero-money line", "canonical-line-fixtures.ts"),
  e("CCS-011", "J", L, "travel lump", "canonical-line-fixtures.ts"),
  e("CCS-012", "K", L, "airport loading lump", "canonical-line-fixtures.ts"),
  e("CCS-013", "L, C", A, "occupied productivity package", "canonical-aggregate-fixtures.ts"),
  e("CCS-014", "M, B", L, "access-adjusted hours (input)", "canonical-line-fixtures.ts"),
  e("CCS-015", "N", L, "restricted-hours allowance", "canonical-line-fixtures.ts"),
  e("CCS-016", "O", L, "long-carry allowance", "canonical-line-fixtures.ts"),
  e("CCS-017", "P, D", A, "steep-site package", "canonical-aggregate-fixtures.ts"),
  e("CCS-018", "Q, C", A, "multi work-area totals", "canonical-aggregate-fixtures.ts"),
  e("CCS-019", "R, S", DEF_P, "quote revision immutability", null, "persistence", "Pure kernel cannot assert snapshot immutability", "2B.8"),
  e("CCS-020", "S", DEF_P, "historical quote after rate rise", null, "persistence", "Needs immutable stored quote", "2B.8"),
  e("CCS-021", "T", A, "GST 15% once at document", "canonical-aggregate-fixtures.ts"),
  e("CCS-022", "T", A, "document GST rate authority", "canonical-aggregate-fixtures.ts"),
  e("CCS-023", "U", L, "target margin 25% override", "canonical-line-fixtures.ts"),
  e("CCS-024", "V", A, "mixed margins blended from totals", "canonical-aggregate-fixtures.ts"),
  e("CCS-025", "W", DOC, "estimate range bands", null, "estimate workflow", "Range heuristics outside pure money kernel", "2B.7"),
  e("CCS-026", "X", L, "manual hours override metadata", "canonical-line-fixtures.ts"),
  e("CCS-027", "B, Y", L, "labour-only productivity", "canonical-line-fixtures.ts"),
  e("CCS-028", "A, Y", L, "material-only quantity_rate", "canonical-line-fixtures.ts"),
  e("CCS-029", "D, Y", L, "subcontractor-only lump", "canonical-line-fixtures.ts"),
  e("CCS-030", "C, Z", A, "multi-trade package", "canonical-aggregate-fixtures.ts"),
  e("CCS-031", "A", L, "timber framing qty×rate", "canonical-line-fixtures.ts"),
  e("CCS-032", "D", A, "steel portal sub + labour", "canonical-aggregate-fixtures.ts"),
  e("CCS-033", "A", L, "concrete pad qty×rate", "canonical-line-fixtures.ts"),
  e("CCS-034", "B", L, "window install productivity", "canonical-line-fixtures.ts"),
  e("CCS-035", "C", A, "cladding labour + materials", "canonical-aggregate-fixtures.ts"),
  e("CCS-036", "A, C", A, "roofing waste + labour", "canonical-aggregate-fixtures.ts"),
  e("CCS-037", "A", L, "vinyl waste qty×rate", "canonical-line-fixtures.ts"),
  e("CCS-038", "Q, D, Z", A, "commercial package totals", "canonical-aggregate-fixtures.ts"),
  e("CCS-039", "E, J", L, "site establishment lump", "canonical-line-fixtures.ts"),
  e("CCS-040", "R, C", L, "variation line money", "canonical-line-fixtures.ts"),
  e("CCS-041", "E", L, "zero-qty lump allowed", "canonical-line-fixtures.ts"),
  e("CCS-042", "E", L, "sell-only; null margin", "canonical-line-fixtures.ts"),
  e("CCS-043", "validation", L, "reject negative credit", "canonical-line-fixtures.ts"),
  e("CCS-044", "validation", L, "reject margin > 95%", "canonical-line-fixtures.ts"),
  e("CCS-045", "Q, R", A, "visible_only vs all", "canonical-aggregate-fixtures.ts"),
  e("CCS-046", "X, U", DEF_PA, "recalibration preserve manual", null, "pricing actions", "Needs live recalibration path", "2B.6–2B.9"),
  e("CCS-047", "E", L, "scaffold lump", "canonical-line-fixtures.ts"),
  e("CCS-048", "F", L, "contingency allowance", "canonical-line-fixtures.ts"),
  e("CCS-049", "Q, C, Z", A, "extension multi-area", "canonical-aggregate-fixtures.ts"),
  e("CCS-050", "N, F, Z", L, "weekend allowance lump", "canonical-line-fixtures.ts"),
  e("CCS-051", "B, Y", L, "minimum labour hours (pre-applied)", "canonical-line-fixtures.ts"),
  e("CCS-052", "Y, Z, X", DEF_DNA, "DNA fencing uplift evidence", null, "Company DNA", "Learning product must not alter arithmetic", "Stage 6 / DNA"),
]);

export const SUPPLEMENTAL_SCENARIO_IDS = Object.freeze([
  "EXT-MARGIN-0",
  "EXT-MARGIN-95",
  "EXT-QTY-ZERO",
  "EXT-QTY-NEG",
  "EXT-PROD-ZERO",
  "EXT-PROD-NEG",
  "EXT-NONFINITE",
  "EXT-INVALID-MODE",
  "EXT-GST-0",
  "EXT-GST-10",
  "EXT-GST-100",
  "EXT-GST-INVALID",
  "EXT-ROUND-DRIFT",
] as const);

export const KNOWN_SCENARIO_IDS = Object.freeze([
  ...CANONICAL_SCENARIO_IDS,
  ...SUPPLEMENTAL_SCENARIO_IDS,
]);

export function isExecutableClassification(
  c: ScenarioMapEntry["classification"]
): boolean {
  return (
    c === "Executable now — line item" ||
    c === "Executable now — aggregate/document"
  );
}

export function getExecutableScenarioIds(): string[] {
  return SCENARIO_EXECUTION_MAP.filter((s) =>
    isExecutableClassification(s.classification)
  ).map((s) => s.scenarioId);
}

export function getDeferredScenarioIds(): string[] {
  return SCENARIO_EXECUTION_MAP.filter(
    (s) => !isExecutableClassification(s.classification)
  ).map((s) => s.scenarioId);
}
