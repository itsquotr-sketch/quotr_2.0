/**
 * REQ-4A — component-level commercial authority.
 *
 * Authority is external to EstimateRequirement. Requirements never gain a
 * commercialAuthority field. This module does not select or suppress money.
 *
 * REQ-4A: no live promotions. SHADOW components stay SHADOW.
 */
import {
  DECK_LABOUR_COMPONENT_KEY,
} from "@/lib/estimate/deck-labour-requirement";
import { DECK_SURFACE_COMPONENT_KEY } from "@/lib/estimate/deck-surface-requirement";

export const COMPONENT_COMMERCIAL_AUTHORITY_STATES = [
  "LEGACY_AUTHORITATIVE",
  "SHADOW",
  "REQUIREMENT_AUTHORITATIVE",
  "LEGACY_FALLBACK",
  "LEGACY_RETIRED",
] as const;

export type ComponentCommercialAuthority =
  (typeof COMPONENT_COMMERCIAL_AUTHORITY_STATES)[number];

export const REQUIREMENT_PARITY_CLASSES = [
  "SEMANTIC_REIMPLEMENTATION",
  "INTENTIONAL_MODEL_IMPROVEMENT",
] as const;

export type RequirementParityClass = (typeof REQUIREMENT_PARITY_CLASSES)[number];

export type ComponentAuthorityKey = {
  workAreaType: string;
  componentKey: string;
};

export type RegisteredComponentAuthority = ComponentAuthorityKey & {
  authority: ComponentCommercialAuthority;
  parityClass: RequirementParityClass;
};

/**
 * Future REQ-4B+ fallback contract. Not activated in REQ-4A.
 *
 * REQUIREMENT_AUTHORITATIVE: requirement is the normal money source.
 * LEGACY_FALLBACK: requirement path is expected, but the legacy line may be
 * used under a defined failure/unsupported condition.
 * Both sources must never contribute money in the same generation.
 *
 * LEGACY_RETIRED: legacy calculation is unused for new estimates.
 * Historical snapshots/quotes remain readable. Do not delete helpers until
 * no consumers remain, goldens prove safety, and history needs are understood.
 */
export const LEGACY_FALLBACK_CONTRACT = {
  activated: false,
  bothSourcesMustNotContributeMoney: true,
  requirementAuthoritativeIsNormalMoneySource: true,
  retiredKeepsHistoricalSnapshotsReadable: true,
  physicalDeletionIsSeparateCleanup: true,
} as const;

/** First REQ-4B candidate. Do not promote in REQ-4A. */
export const REQ_4B_FIRST_PROMOTION_CANDIDATE: ComponentAuthorityKey = {
  workAreaType: "deck",
  componentKey: DECK_SURFACE_COMPONENT_KEY,
};

const REGISTERED_COMPONENT_AUTHORITIES: readonly RegisteredComponentAuthority[] =
  [
    {
      workAreaType: "deck",
      componentKey: DECK_SURFACE_COMPONENT_KEY,
      authority: "SHADOW",
      parityClass: "SEMANTIC_REIMPLEMENTATION",
    },
    {
      workAreaType: "deck",
      componentKey: DECK_LABOUR_COMPONENT_KEY,
      authority: "SHADOW",
      parityClass: "SEMANTIC_REIMPLEMENTATION",
    },
  ];

function authorityLookupKey(input: ComponentAuthorityKey): string {
  return `${input.workAreaType}::${input.componentKey}`;
}

const REGISTERED_BY_KEY = new Map(
  REGISTERED_COMPONENT_AUTHORITIES.map((entry) => [
    authorityLookupKey(entry),
    entry,
  ])
);

export function listRegisteredComponentAuthorities(): readonly RegisteredComponentAuthority[] {
  return REGISTERED_COMPONENT_AUTHORITIES;
}

export function getRegisteredComponentAuthority(
  input: ComponentAuthorityKey
): RegisteredComponentAuthority | null {
  return REGISTERED_BY_KEY.get(authorityLookupKey(input)) ?? null;
}

/**
 * Single authority resolver. Component-level, not Work-Area global.
 * Unregistered components default to LEGACY_AUTHORITATIVE.
 */
export function getComponentCommercialAuthority(input: ComponentAuthorityKey): {
  workAreaType: string;
  componentKey: string;
  authority: ComponentCommercialAuthority;
  parityClass: RequirementParityClass | null;
  registered: boolean;
} {
  const registered = getRegisteredComponentAuthority(input);
  if (registered) {
    return {
      workAreaType: registered.workAreaType,
      componentKey: registered.componentKey,
      authority: registered.authority,
      parityClass: registered.parityClass,
      registered: true,
    };
  }
  return {
    workAreaType: input.workAreaType,
    componentKey: input.componentKey,
    authority: "LEGACY_AUTHORITATIVE",
    parityClass: null,
    registered: false,
  };
}

export function snapshotRegisteredAuthorities(): readonly {
  workAreaType: string;
  componentKey: string;
  authority: ComponentCommercialAuthority;
  parityClass: RequirementParityClass;
}[] {
  return REGISTERED_COMPONENT_AUTHORITIES.map((entry) => ({
    workAreaType: entry.workAreaType,
    componentKey: entry.componentKey,
    authority: entry.authority,
    parityClass: entry.parityClass,
  }));
}

/**
 * Server-side helper: true when any registered component is REQUIREMENT_AUTHORITATIVE.
 * Persist always snapshots regardless. This flag gates promotion-unsafe fallback
 * and future commercial authority behaviour — not snapshot optionality.
 */
export function generationRequiresRequirementSnapshot(): boolean {
  return REGISTERED_COMPONENT_AUTHORITIES.some(
    (entry) => entry.authority === "REQUIREMENT_AUTHORITATIVE"
  );
}
