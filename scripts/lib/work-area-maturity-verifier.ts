/**
 * WORK-AREA-FACTORY-01 — shared maturity verifier helpers.
 *
 * Non-runtime. Import from `scripts/verify-work-area-<slug>-maturity.ts`.
 * Do not import this module from `lib/` or app code.
 *
 * Template for a new Work Area close:
 *
 *   scripts/verify-work-area-<slug>-maturity.ts
 *     1. Catalogue + calculator registration
 *     2. Fact / question namespace isolation
 *     3. Physical quantity proof (calculator-owned)
 *     4. Requirement union (material / labour / plant / subcontract / waste)
 *     5. Rate hierarchy + commercial proof
 *     6. Conditions + assumptions
 *     7. Builder Review (no raw calculator language)
 *     8. Cross-Work-Area isolation (foreign prefixes absent)
 *     9. Company DNA only if an independent productivity key is consumed
 *    10. Multi-Work-Area coexistence with a mature reference (deck/fence/rw)
 *
 * This file does not implement those proofs. It only shares the checklist
 * and isolation helpers so future verifiers do not fork a second catalogue.
 *
 * Bathroom close script is not in this phase. See
 * docs/architecture/QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md §48.
 */

import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import { UNSUPPORTED_WORK_AREA_TYPES } from "@/lib/work-areas/support-contract";

export const WORK_AREA_FACTORY_VERIFIER_VERSION = "wa-factory-01.0" as const;

export const PRODUCT_WORK_AREA_TYPES = SCOPE_CATALOGUE.map((item) => item.type);

export const MATURE_REFERENCE_WORK_AREA_TYPES = [
  "deck",
  "fence",
  "retaining_wall",
] as const;

export type MatureReferenceWorkAreaType =
  (typeof MATURE_REFERENCE_WORK_AREA_TYPES)[number];

/** Product exposure labels — independent of stale support-contract bands. */
export const WORK_AREA_EXPOSURE_LABELS = [
  "EXPERIMENTAL",
  "PARTIAL",
  "SUPPORTED",
  "MATURE",
] as const;

export type WorkAreaExposureLabel = (typeof WORK_AREA_EXPOSURE_LABELS)[number];

export const FACTORY_STAGES = [
  "WA-0",
  "WA-1",
  "WA-2",
  "WA-3",
  "WA-4",
  "WA-5",
  "WA-6",
  "WA-7",
  "WA-8",
  "WA-9",
] as const;

export type FactoryStage = (typeof FACTORY_STAGES)[number];

export type FactoryStageCheck = {
  stage: FactoryStage;
  name: string;
  required: boolean;
  notes: string;
};

/**
 * Repeatable close checklist. WA-8 Company DNA is optional.
 * A Work Area may be MATURE without DNA.
 */
export const FACTORY_STAGE_CHECKS: readonly FactoryStageCheck[] = [
  {
    stage: "WA-0",
    name: "Discovery / scope",
    required: true,
    notes: "In/out jobs, systems, physical authority, minimum input, XOR.",
  },
  {
    stage: "WA-1",
    name: "Fact model",
    required: true,
    notes: "Namespaced project_facts keys, explicit units, no question-response authority.",
  },
  {
    stage: "WA-2",
    name: "Clarification",
    required: true,
    notes: "High-value questions only; Not sure; disclosed assumptions.",
  },
  {
    stage: "WA-3",
    name: "Physical calculator",
    required: true,
    notes: "Calculator owns quantities. AI must not own final quantities.",
  },
  {
    stage: "WA-4",
    name: "Requirements",
    required: true,
    notes: "Audit material/labour/plant/subcontract/waste. Omissions must be deliberate.",
  },
  {
    stage: "WA-5",
    name: "Rate / commercial",
    required: true,
    notes: "Company → specific benchmark → Pricing Required. No WA-specific pricing engine.",
  },
  {
    stage: "WA-6",
    name: "Conditions + assumptions",
    required: true,
    notes: "Project Conditions remain sibling to Facts. Do not encode job conditions in DNA.",
  },
  {
    stage: "WA-7",
    name: "Builder Review",
    required: true,
    notes: "Explainable quantities, materials, labour, allowances, source, edit path.",
  },
  {
    stage: "WA-8",
    name: "Company DNA",
    required: false,
    notes: "Only when an independent productivity key is consumed and builders vary.",
  },
  {
    stage: "WA-9",
    name: "Deterministic + hosted close",
    required: true,
    notes: "Fixture, XOR if relevant, isolation, mobile smoke, coexistence, this verifier.",
  },
];

export function isProductWorkAreaType(type: string): boolean {
  return PRODUCT_WORK_AREA_TYPES.includes(type);
}

export function isUnsupportedRecognisedType(type: string): boolean {
  return (UNSUPPORTED_WORK_AREA_TYPES as readonly string[]).includes(type);
}

export function isMatureReferenceWorkAreaType(
  type: string
): type is MatureReferenceWorkAreaType {
  return (MATURE_REFERENCE_WORK_AREA_TYPES as readonly string[]).includes(type);
}

/** Requirement / fact / rate keys for a product WA must use this prefix. */
export function workAreaKeyPrefix(workAreaType: string): string {
  return `${workAreaType}.`;
}

export function keyBelongsToWorkArea(
  key: string,
  workAreaType: string
): boolean {
  return key === workAreaType || key.startsWith(workAreaKeyPrefix(workAreaType));
}

/**
 * Shared / plant / sheet catalogue keys that may appear beside a WA prefix.
 * Keep this list explicit — do not treat unmatched keys as belonging to the WA.
 */
export const SHARED_CATALOGUE_KEY_PREFIXES = [
  "plant.",
  "sheet.",
  "ceiling.tile.",
] as const;

export function isSharedCatalogueKey(key: string): boolean {
  return SHARED_CATALOGUE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export type IsolationHit = {
  key: string;
  foreignPrefix: string;
};

/**
 * Flag keys that belong to another product Work Area.
 * Shared catalogue prefixes and the target prefix are allowed.
 */
export function findForeignWorkAreaKeys(
  keys: readonly string[],
  workAreaType: string
): IsolationHit[] {
  const hits: IsolationHit[] = [];
  for (const key of keys) {
    if (keyBelongsToWorkArea(key, workAreaType)) continue;
    if (isSharedCatalogueKey(key)) continue;
    for (const other of PRODUCT_WORK_AREA_TYPES) {
      if (other === workAreaType) continue;
      if (keyBelongsToWorkArea(key, other)) {
        hits.push({ key, foreignPrefix: workAreaKeyPrefix(other) });
        break;
      }
    }
  }
  return hits;
}

export function assertNoForeignWorkAreaKeys(
  keys: readonly string[],
  workAreaType: string,
  label: string
): void {
  const hits = findForeignWorkAreaKeys(keys, workAreaType);
  if (hits.length === 0) return;
  const detail = hits
    .map((hit) => `${hit.key} (${hit.foreignPrefix})`)
    .join(", ");
  throw new Error(`${label}: foreign Work Area keys: ${detail}`);
}

export function assertProductWorkAreaType(type: string): void {
  if (!isProductWorkAreaType(type)) {
    throw new Error(
      `Not a product Work Area: ${type}. Creatable types: ${PRODUCT_WORK_AREA_TYPES.join(", ")}`
    );
  }
}

export type WorkAreaVerifierContext = {
  workAreaType: string;
  factKeys: readonly string[];
  questionKeys: readonly string[];
  requirementKeys: readonly string[];
  rateKeys: readonly string[];
};

/**
 * Minimum isolation proof every mature WA verifier should run.
 * Does not prove quantities, rates, or commercial money.
 */
export function assertWorkAreaNamespaceIsolation(
  context: WorkAreaVerifierContext
): void {
  assertProductWorkAreaType(context.workAreaType);
  assertNoForeignWorkAreaKeys(
    context.factKeys,
    context.workAreaType,
    "facts"
  );
  assertNoForeignWorkAreaKeys(
    context.questionKeys,
    context.workAreaType,
    "questions"
  );
  assertNoForeignWorkAreaKeys(
    context.requirementKeys,
    context.workAreaType,
    "requirements"
  );
  assertNoForeignWorkAreaKeys(
    context.rateKeys,
    context.workAreaType,
    "rates"
  );
}
