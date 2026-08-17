/**
 * REQ-4A — build snapshot + diagnostics for an estimate generation.
 * Does not add requirement cost to estimate totals.
 */
import {
  getComponentCommercialAuthority,
  listRegisteredComponentAuthorities,
  REQ_4B_FIRST_PROMOTION_CANDIDATE,
} from "@/lib/estimate/component-authority";
import {
  evaluatePromotionEligibility,
  reconcileRequirementWithLegacyComponent,
  type RequirementLegacyReconciliation,
} from "@/lib/estimate/requirement-reconciliation";
import { buildEstimateRequirementSnapshotV1 } from "@/lib/estimate/requirement-snapshot";
import type { EstimateRequirementSnapshotV1 } from "@/lib/estimate/requirement-snapshot";
import type { EstimateResult } from "@/lib/estimate/types";
import type { EstimateRequirement } from "@/lib/estimate/requirements";

export type RequirementSnapshotPersistResult =
  | {
      ok: true;
      generationId: string;
      snapshotId: string;
      schemaVersion: string;
    }
  | { ok: false; generationId: string; reason: string };

export type RequirementCommercialDiagnostics = {
  snapshotCreated: boolean;
  snapshotSchemaVersion: string | null;
  requirementCount: number;
  authorityCount: number;
  reconciliationCount: number;
  passed: number;
  failed: number;
  notComparable: number;
  missingRequirement: number;
  missingLegacyComponent: number;
  unpricedRequirement: number;
  promotionEligibleCount: number;
  firstPromotionCandidate: {
    workAreaType: string;
    componentKey: string;
    eligible: boolean;
    promoted: false;
  };
};

function requirementForComponent(
  requirements: readonly EstimateRequirement[],
  workAreaId: string,
  componentKey: string
): { requirement: EstimateRequirement | null; duplicate: boolean } {
  const matches = requirements.filter(
    (item) => item.workAreaId === workAreaId && item.componentKey === componentKey
  );
  return {
    requirement: matches[0] ?? null,
    duplicate: matches.length > 1,
  };
}

export function reconcileRegisteredComponents(result: EstimateResult): {
  reconciliations: RequirementLegacyReconciliation[];
  duplicates: Map<string, boolean>;
} {
  const requirements = result.requirements ?? [];
  const reconciliations: RequirementLegacyReconciliation[] = [];
  const duplicates = new Map<string, boolean>();
  const workAreaIds = [...new Set(result.lineItems.map((item) => item.workAreaId))];

  for (const registered of listRegisteredComponentAuthorities()) {
    const matchingWorkAreas = workAreaIds.filter((workAreaId) => {
      const line = result.lineItems.find(
        (item) =>
          item.workAreaId === workAreaId &&
          item.componentKey === registered.componentKey
      );
      const requirement = requirements.find(
        (item) =>
          item.workAreaId === workAreaId &&
          item.componentKey === registered.componentKey &&
          item.workAreaType === registered.workAreaType
      );
      return line != null || requirement != null;
    });

    const targets =
      matchingWorkAreas.length > 0
        ? matchingWorkAreas
        : requirements
            .filter(
              (item) =>
                item.workAreaType === registered.workAreaType &&
                item.componentKey === registered.componentKey
            )
            .map((item) => item.workAreaId);

    for (const workAreaId of [...new Set(targets)]) {
      const found = requirementForComponent(
        requirements,
        workAreaId,
        registered.componentKey
      );
      duplicates.set(`${workAreaId}::${registered.componentKey}`, found.duplicate);
      reconciliations.push(
        reconcileRequirementWithLegacyComponent({
          requirement: found.requirement,
          lineItems: result.lineItems,
          workAreaId,
          workAreaType: registered.workAreaType,
          componentKey: registered.componentKey,
        })
      );
    }
  }

  return { reconciliations, duplicates };
}

export function buildRequirementCommercialDiagnostics(params: {
  result: EstimateResult;
  snapshot: RequirementSnapshotPersistResult | null;
}): RequirementCommercialDiagnostics {
  const { reconciliations, duplicates } = reconcileRegisteredComponents(
    params.result
  );
  const snapshotPersisted = params.snapshot?.ok === true;
  let promotionEligibleCount = 0;
  let candidateEligible = false;

  for (const reconciliation of reconciliations) {
    const eligibility = evaluatePromotionEligibility({
      reconciliation,
      snapshotPersisted,
      duplicateRequirement:
        duplicates.get(
          `${reconciliation.workAreaId}::${reconciliation.componentKey}`
        ) === true,
    });
    if (eligibility.eligible) promotionEligibleCount += 1;
    if (
      reconciliation.workAreaType ===
        REQ_4B_FIRST_PROMOTION_CANDIDATE.workAreaType &&
      reconciliation.componentKey ===
        REQ_4B_FIRST_PROMOTION_CANDIDATE.componentKey &&
      eligibility.eligible
    ) {
      candidateEligible = true;
    }
  }

  const counts = {
    passed: 0,
    failed: 0,
    notComparable: 0,
    missingRequirement: 0,
    missingLegacyComponent: 0,
    unpricedRequirement: 0,
  };
  for (const item of reconciliations) {
    if (item.status === "PASS") counts.passed += 1;
    else if (item.status === "FAIL") counts.failed += 1;
    else if (item.status === "NOT_COMPARABLE") counts.notComparable += 1;
    else if (item.status === "MISSING_REQUIREMENT") counts.missingRequirement += 1;
    else if (item.status === "MISSING_LEGACY_COMPONENT") {
      counts.missingLegacyComponent += 1;
    } else if (item.status === "UNPRICED_REQUIREMENT") {
      counts.unpricedRequirement += 1;
    }
  }

  return {
    snapshotCreated: snapshotPersisted,
    snapshotSchemaVersion: params.snapshot?.ok
      ? params.snapshot.schemaVersion
      : null,
    requirementCount: params.result.requirements?.length ?? 0,
    authorityCount: listRegisteredComponentAuthorities().length,
    reconciliationCount: reconciliations.length,
    ...counts,
    promotionEligibleCount,
    firstPromotionCandidate: {
      ...REQ_4B_FIRST_PROMOTION_CANDIDATE,
      eligible: candidateEligible,
      promoted: false,
    },
  };
}

export function createGenerationId(): string {
  return crypto.randomUUID();
}

export function buildSnapshotPayloadForEstimate(params: {
  generationId: string;
  result: EstimateResult;
  generatedAt?: string;
}): EstimateRequirementSnapshotV1 {
  return buildEstimateRequirementSnapshotV1({
    generationId: params.generationId,
    generatedAt: params.generatedAt,
    requirements: params.result.requirements ?? [],
  });
}

export function getAuthorityForLine(params: {
  workAreaType: string;
  componentKey: string | undefined;
}) {
  if (!params.componentKey) {
    return getComponentCommercialAuthority({
      workAreaType: params.workAreaType,
      componentKey: "__unregistered__",
    });
  }
  return getComponentCommercialAuthority({
    workAreaType: params.workAreaType,
    componentKey: params.componentKey,
  });
}
