/**
 * REQ-4B — central commercial source selection.
 *
 * Calculators still emit legacy line candidates + requirements.
 * This module chooses ONE money source per registered
 * requirement-authoritative component. Do not spread authority
 * conditionals through calculators, Pricing, or Quote.
 *
 * Policy (registry) stays REQUIREMENT_AUTHORITATIVE even when a
 * generation uses LEGACY_FALLBACK as the active source.
 */
import {
  getComponentCommercialAuthority,
  listRegisteredComponentAuthorities,
  type ComponentCommercialAuthority,
} from "@/lib/estimate/component-authority";
import { findLegacyLinesForComponent } from "@/lib/estimate/legacy-component-map";
import {
  adaptPricedMaterialRequirementToEstimateLine,
  adaptPricedMaterialRequirementWithoutLegacy,
  isPricedMaterialRequirement,
} from "@/lib/estimate/requirement-commercial-line";
import type { EstimateRequirement, MaterialRequirement } from "@/lib/estimate/requirements";
import type { EstimateLineItemInput, EstimateWorkArea } from "@/lib/estimate/types";
import type { OrganisationSettings } from "@/components/setup/types";

export const COMMERCIAL_ACTIVE_SOURCES = [
  "REQUIREMENT",
  "LEGACY_FALLBACK",
  "LEGACY",
] as const;

export type CommercialActiveSource = (typeof COMMERCIAL_ACTIVE_SOURCES)[number];

export type CommercialFallbackReason =
  | "missing_requirement"
  | "unpriced_requirement";

export type CommercialComponentSelection = {
  workAreaId: string;
  workAreaType: string;
  componentKey: string;
  registeredAuthority: ComponentCommercialAuthority;
  activeSource: CommercialActiveSource;
  requirementId: string | null;
  requirementCost: number | null;
  legacyCost: number | null;
  activeCost: number | null;
  fallbackReason?: CommercialFallbackReason;
};

export class DuplicateActiveComponentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateActiveComponentError";
  }
}

function requirementCostOf(
  requirement: EstimateRequirement | null
): number | null {
  if (
    requirement &&
    (requirement.kind === "material" || requirement.kind === "labour")
  ) {
    return requirement.totalCost;
  }
  return null;
}

function isActiveMoneyLine(item: EstimateLineItemInput): boolean {
  return item.includedInTotal !== false;
}

export function countActiveComponentLines(
  lineItems: readonly EstimateLineItemInput[],
  params: { workAreaId: string; componentKey: string }
): number {
  return lineItems.filter(
    (item) =>
      item.workAreaId === params.workAreaId &&
      item.componentKey === params.componentKey &&
      isActiveMoneyLine(item)
  ).length;
}

export function assertSingleActiveComponentLine(
  lineItems: readonly EstimateLineItemInput[],
  params: { workAreaId: string; componentKey: string }
): void {
  const count = countActiveComponentLines(lineItems, params);
  if (count > 1) {
    throw new DuplicateActiveComponentError(
      `Duplicate active commercial line for ${params.workAreaId}:${params.componentKey}`
    );
  }
}

export function assertNoDuplicateActiveComponents(
  lineItems: readonly EstimateLineItemInput[]
): void {
  const seen = new Map<string, number>();
  for (const item of lineItems) {
    if (!item.componentKey || !isActiveMoneyLine(item)) continue;
    const key = `${item.workAreaId}::${item.componentKey}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) {
      throw new DuplicateActiveComponentError(
        `Duplicate active commercial line for ${key}`
      );
    }
  }
}

function materialRequirementFor(
  requirements: readonly EstimateRequirement[],
  workAreaId: string,
  componentKey: string
): MaterialRequirement | null {
  const matches = requirements.filter(
    (item) =>
      item.workAreaId === workAreaId &&
      item.componentKey === componentKey &&
      item.kind === "material"
  );
  if (matches.length > 1) {
    throw new DuplicateActiveComponentError(
      `Duplicate material requirement for ${workAreaId}:${componentKey}`
    );
  }
  return (matches[0] as MaterialRequirement | undefined) ?? null;
}

function anyRequirementFor(
  requirements: readonly EstimateRequirement[],
  workAreaId: string,
  componentKey: string
): EstimateRequirement | null {
  return (
    requirements.find(
      (item) =>
        item.workAreaId === workAreaId && item.componentKey === componentKey
    ) ?? null
  );
}

function isRequirementAuthoritative(authority: ComponentCommercialAuthority): boolean {
  return authority === "REQUIREMENT_AUTHORITATIVE";
}

export function applyRegisteredComponentCommercialAuthority(params: {
  lineItems: readonly EstimateLineItemInput[];
  requirements: readonly EstimateRequirement[];
  workAreas: readonly Pick<EstimateWorkArea, "id" | "type" | "name">[];
  organisationSettings: OrganisationSettings | null;
}): {
  lineItems: EstimateLineItemInput[];
  selections: CommercialComponentSelection[];
  legacyCandidates: EstimateLineItemInput[];
} {
  const lineItems = params.lineItems.map((item) => ({ ...item }));
  const legacyCandidates = params.lineItems.map((item) => ({ ...item }));
  const selections: CommercialComponentSelection[] = [];
  const workAreaById = new Map(params.workAreas.map((item) => [item.id, item]));

  for (const registered of listRegisteredComponentAuthorities()) {
    const authority = getComponentCommercialAuthority(registered).authority;
    const targets = params.workAreas.filter(
      (workArea) => workArea.type === registered.workAreaType
    );

    for (const workArea of targets) {
      const legacyLines = findLegacyLinesForComponent(legacyCandidates, {
        workAreaId: workArea.id,
        componentKey: registered.componentKey,
      });
      const requirement = anyRequirementFor(
        params.requirements,
        workArea.id,
        registered.componentKey
      );
      if (legacyLines.length === 0 && requirement == null) {
        continue;
      }
      if (legacyLines.length > 1) {
        throw new DuplicateActiveComponentError(
          `Duplicate calculator candidate for ${workArea.id}:${registered.componentKey}`
        );
      }

      const legacyLine = legacyLines[0] ?? null;
      const legacyCost = legacyLine?.recommendedCost ?? null;

      if (!isRequirementAuthoritative(authority)) {
        selections.push({
          workAreaId: workArea.id,
          workAreaType: registered.workAreaType,
          componentKey: registered.componentKey,
          registeredAuthority: authority,
          activeSource: "LEGACY",
          requirementId: requirement?.requirementId ?? null,
          requirementCost: requirementCostOf(requirement),
          legacyCost,
          activeCost: legacyCost,
        });
        continue;
      }

      const material = materialRequirementFor(
        params.requirements,
        workArea.id,
        registered.componentKey
      );

      if (material && isPricedMaterialRequirement(material)) {
        if (legacyLine) {
          const adapted = adaptPricedMaterialRequirementToEstimateLine({
            requirement: material,
            legacyLine,
            organisationSettings: params.organisationSettings,
          });
          const index = lineItems.findIndex(
            (item) =>
              item.workAreaId === workArea.id &&
              item.componentKey === registered.componentKey
          );
          if (index >= 0) {
            lineItems[index] = adapted;
          }
        } else {
          lineItems.push(
            adaptPricedMaterialRequirementWithoutLegacy({
              requirement: material,
              workAreaName: workAreaById.get(workArea.id)?.name ?? workArea.name,
              sortOrder: lineItems.length + 1,
              organisationSettings: params.organisationSettings,
            })
          );
        }
        const active = lineItems.find(
          (item) =>
            item.workAreaId === workArea.id &&
            item.componentKey === registered.componentKey &&
            isActiveMoneyLine(item)
        );
        selections.push({
          workAreaId: workArea.id,
          workAreaType: registered.workAreaType,
          componentKey: registered.componentKey,
          registeredAuthority: authority,
          activeSource: "REQUIREMENT",
          requirementId: material.requirementId,
          requirementCost: material.totalCost,
          legacyCost,
          activeCost: active?.recommendedCost ?? material.totalCost,
        });
        continue;
      }

      const fallbackReason: CommercialFallbackReason = material
        ? "unpriced_requirement"
        : "missing_requirement";
      selections.push({
        workAreaId: workArea.id,
        workAreaType: registered.workAreaType,
        componentKey: registered.componentKey,
        registeredAuthority: authority,
        activeSource: "LEGACY_FALLBACK",
        requirementId: material?.requirementId ?? requirement?.requirementId ?? null,
        requirementCost: requirementCostOf(material ?? requirement),
        legacyCost,
        activeCost: legacyCost,
        fallbackReason,
      });
    }
  }

  assertNoDuplicateActiveComponents(lineItems);
  return { lineItems, selections, legacyCandidates };
}
