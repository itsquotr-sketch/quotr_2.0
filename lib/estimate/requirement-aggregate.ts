import { normalizeRequirements } from "@/lib/estimate/requirement-normalize";
import type {
  EstimateRequirement,
  LabourAdjustmentFactorRef,
  LabourRequirement,
  MaterialRequirement,
  PlantRequirement,
  RequirementAssumption,
  RequirementConfidence,
  RequirementKind,
  SubcontractRequirement,
  WasteRequirement,
} from "@/lib/estimate/requirements";

export type RequirementContributorRef = {
  requirementId: string;
  workAreaId: string;
  workAreaType: string;
  componentKey: string;
  variantKey?: string;
  description: string;
  priced: boolean;
};

export type UnsafeAggregationRefusal = {
  kind: RequirementKind;
  identity: string;
  reason: "incompatible_units";
  units: readonly string[];
};

export type RequirementDiagnostics = {
  requirementCount: number;
  countsByKind: Record<RequirementKind, number>;
  pricedCount: number;
  unpricedCount: number;
  missingPricingCount: number;
  duplicateIdCount: number;
  unsafeAggregationRefusals: readonly UnsafeAggregationRefusal[];
  confidenceCounts: Record<RequirementConfidence, number>;
};

/**
 * Diagnostic cost rollup of priced requirements only.
 * NOT estimate / Pricing / Quote commercial authority.
 */
export type PricedRequirementCostTotals = {
  materialCost: number;
  labourCost: number;
  plantCost: number;
  subcontractCost: number;
  wasteCost: number;
  totalCost: number;
  pricedCount: number;
  unpricedExcludedCount: number;
};

export type MaterialRequirementAggregate = {
  aggregateKey: string;
  materialKey: string;
  category: string;
  specification?: string;
  variantKey?: string;
  baseUnit: string;
  purchaseUnit: string;
  baseQuantity: number;
  purchaseQuantity: number;
  /** Display-only. Physical base/purchase totals are authoritative. */
  impliedWasteFactor: number | null;
  pricedContributorCount: number;
  unpricedContributorCount: number;
  pricedTotalCost: number | null;
  contributors: readonly (RequirementContributorRef & {
    baseQuantity: number;
    purchaseQuantity: number;
    wasteFactor: number;
    totalCost: number | null;
  })[];
  assumptions: readonly RequirementAssumption[];
};

export type LabourTaskAggregate = {
  aggregateKey: string;
  componentKey: string;
  variantKey?: string;
  trade: string;
  baseHours: number;
  adjustedHours: number;
  hoursAreElapsedDuration: false;
  pricedTotalCost: number | null;
  contributors: readonly (RequirementContributorRef & {
    trade: string;
    baseHours: number;
    adjustedHours: number;
    totalCost: number | null;
  })[];
  adjustmentFactors: readonly {
    requirementId: string;
    factors: readonly LabourAdjustmentFactorRef[];
  }[];
  assumptions: readonly RequirementAssumption[];
};

export type LabourTradeAggregate = {
  trade: string;
  baseHours: number;
  adjustedHours: number;
  hoursAreElapsedDuration: false;
  taskKeys: readonly string[];
  contributorRequirementIds: readonly string[];
};

export type LabourWorkAreaAggregate = {
  workAreaId: string;
  workAreaType: string;
  baseHours: number;
  adjustedHours: number;
  hoursAreElapsedDuration: false;
  contributorRequirementIds: readonly string[];
};

export type PlantRequirementAggregate = {
  aggregateKey: string;
  plantKey: string | null;
  unit?: string;
  hours: number | null;
  quantity: number | null;
  pricedTotalCost: number | null;
  contributors: readonly RequirementContributorRef[];
};

export type SubcontractRequirementAggregate = {
  aggregateKey: string;
  workAreaId: string;
  workAreaType: string;
  trade: string | null;
  componentKey: string;
  pricedTotalCost: number | null;
  contributors: readonly RequirementContributorRef[];
};

export type SubcontractTradeTotal = {
  trade: string;
  requirementCount: number;
  pricedTotalCost: number | null;
  workAreaIds: readonly string[];
  contributorRequirementIds: readonly string[];
};

export type WasteRequirementAggregate = {
  aggregateKey: string;
  wasteKey: string | null;
  unit?: string;
  quantity: number | null;
  pricedTotalCost: number | null;
  contributors: readonly RequirementContributorRef[];
};

export type RequirementShadowFields = {
  requirementId: string;
  kind: RequirementKind;
  workAreaId: string;
  componentKey: string;
  variantKey?: string;
  priced: boolean;
  physicalQuantity: number | null;
  physicalUnit: string | null;
  totalCost: number | null;
};

export type EstimateRequirementSummary = {
  requirements: readonly EstimateRequirement[];
  materials: readonly MaterialRequirementAggregate[];
  labourByTask: readonly LabourTaskAggregate[];
  labourByTrade: readonly LabourTradeAggregate[];
  labourByWorkArea: readonly LabourWorkAreaAggregate[];
  labourTotalHours: {
    baseHours: number;
    adjustedHours: number;
    hoursAreElapsedDuration: false;
  };
  plant: readonly PlantRequirementAggregate[];
  subcontract: readonly SubcontractRequirementAggregate[];
  subcontractByTrade: readonly SubcontractTradeTotal[];
  waste: readonly WasteRequirementAggregate[];
  pricedRequirementCostTotals: PricedRequirementCostTotals;
  diagnostics: RequirementDiagnostics;
};

function contributorRef(
  requirement: EstimateRequirement
): RequirementContributorRef {
  return {
    requirementId: requirement.requirementId,
    workAreaId: requirement.workAreaId,
    workAreaType: requirement.workAreaType,
    componentKey: requirement.componentKey,
    variantKey: requirement.variantKey,
    description: requirement.description,
    priced: requirement.priced,
  };
}

function dedupeAssumptions(
  requirements: readonly EstimateRequirement[]
): RequirementAssumption[] {
  const seen = new Set<string>();
  const out: RequirementAssumption[] = [];
  for (const requirement of requirements) {
    for (const assumption of requirement.assumptions) {
      const key = `${assumption.key}\0${assumption.source}\0${assumption.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...assumption });
    }
  }
  return out;
}

function sumPricedCost(requirements: readonly EstimateRequirement[]): number | null {
  const priced = requirements.filter((requirement) => requirement.priced);
  if (priced.length === 0) return null;
  let total = 0;
  for (const requirement of priced) {
    if (typeof requirement.totalCost === "number") {
      total += requirement.totalCost;
    }
  }
  return total;
}

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

export function materialAggregateKey(requirement: MaterialRequirement): string {
  if (!requirement.materialKey) {
    return `unkeyed:${requirement.requirementId}`;
  }
  const spec = (requirement.specification ?? "").trim().toLowerCase();
  const variant = (requirement.variantKey ?? "").trim().toLowerCase();
  return [
    "key",
    requirement.materialKey,
    "unit",
    normalizeUnit(requirement.purchaseUnit),
    "spec",
    spec,
    "variant",
    variant,
  ].join(":");
}

export function groupMaterialRequirements(
  requirements: readonly MaterialRequirement[]
): readonly MaterialRequirementAggregate[] {
  const groups = new Map<string, MaterialRequirement[]>();
  for (const requirement of requirements) {
    const key = materialAggregateKey(requirement);
    const list = groups.get(key);
    if (list) {
      list.push(requirement);
    } else {
      groups.set(key, [requirement]);
    }
  }

  const aggregates: MaterialRequirementAggregate[] = [];
  for (const [aggregateKey, members] of groups) {
    const first = members[0];
    if (!first) continue;
    const baseQuantity = members.reduce((sum, item) => sum + item.baseQuantity, 0);
    const purchaseQuantity = members.reduce(
      (sum, item) => sum + item.purchaseQuantity,
      0
    );
    const pricedMembers = members.filter((item) => item.priced);
    aggregates.push({
      aggregateKey,
      materialKey: first.materialKey ?? "",
      category: first.category,
      specification: first.specification,
      variantKey: first.variantKey,
      baseUnit: first.baseUnit,
      purchaseUnit: first.purchaseUnit,
      baseQuantity,
      purchaseQuantity,
      impliedWasteFactor:
        baseQuantity > 0 ? (purchaseQuantity - baseQuantity) / baseQuantity : null,
      pricedContributorCount: pricedMembers.length,
      unpricedContributorCount: members.length - pricedMembers.length,
      pricedTotalCost: sumPricedCost(members),
      contributors: members.map((item) => ({
        ...contributorRef(item),
        baseQuantity: item.baseQuantity,
        purchaseQuantity: item.purchaseQuantity,
        wasteFactor: item.wasteFactor,
        totalCost: item.totalCost,
      })),
      assumptions: dedupeAssumptions(members),
    });
  }

  return aggregates.sort((left, right) =>
    left.aggregateKey < right.aggregateKey
      ? -1
      : left.aggregateKey > right.aggregateKey
        ? 1
        : 0
  );
}

function labourTaskKey(requirement: LabourRequirement): string {
  return `task:${requirement.componentKey}|variant:${requirement.variantKey ?? ""}|trade:${requirement.trade}`;
}

export function summarizeLabourRequirements(
  requirements: readonly LabourRequirement[]
): {
  byTask: readonly LabourTaskAggregate[];
  byTrade: readonly LabourTradeAggregate[];
  byWorkArea: readonly LabourWorkAreaAggregate[];
  totalHours: {
    baseHours: number;
    adjustedHours: number;
    hoursAreElapsedDuration: false;
  };
} {
  const taskGroups = new Map<string, LabourRequirement[]>();
  const tradeGroups = new Map<string, LabourRequirement[]>();
  const workAreaGroups = new Map<string, LabourRequirement[]>();

  for (const requirement of requirements) {
    const taskKey = labourTaskKey(requirement);
    const taskList = taskGroups.get(taskKey);
    if (taskList) taskList.push(requirement);
    else taskGroups.set(taskKey, [requirement]);

    const tradeList = tradeGroups.get(requirement.trade);
    if (tradeList) tradeList.push(requirement);
    else tradeGroups.set(requirement.trade, [requirement]);

    const workAreaList = workAreaGroups.get(requirement.workAreaId);
    if (workAreaList) workAreaList.push(requirement);
    else workAreaGroups.set(requirement.workAreaId, [requirement]);
  }

  const byTask: LabourTaskAggregate[] = [];
  for (const [aggregateKey, members] of taskGroups) {
    const first = members[0];
    if (!first) continue;
    byTask.push({
      aggregateKey,
      componentKey: first.componentKey,
      variantKey: first.variantKey,
      trade: first.trade,
      baseHours: members.reduce((sum, item) => sum + item.baseHours, 0),
      adjustedHours: members.reduce((sum, item) => sum + item.adjustedHours, 0),
      hoursAreElapsedDuration: false,
      pricedTotalCost: sumPricedCost(members),
      contributors: members.map((item) => ({
        ...contributorRef(item),
        trade: item.trade,
        baseHours: item.baseHours,
        adjustedHours: item.adjustedHours,
        totalCost: item.totalCost,
      })),
      adjustmentFactors: members.map((item) => ({
        requirementId: item.requirementId,
        factors: item.adjustmentRef.factors.map((factor) => ({ ...factor })),
      })),
      assumptions: dedupeAssumptions(members),
    });
  }

  const byTrade: LabourTradeAggregate[] = [...tradeGroups.entries()].map(
    ([trade, members]) => ({
      trade,
      baseHours: members.reduce((sum, item) => sum + item.baseHours, 0),
      adjustedHours: members.reduce((sum, item) => sum + item.adjustedHours, 0),
      hoursAreElapsedDuration: false as const,
      taskKeys: [...new Set(members.map(labourTaskKey))],
      contributorRequirementIds: members.map((item) => item.requirementId),
    })
  );

  const byWorkArea: LabourWorkAreaAggregate[] = [...workAreaGroups.entries()].map(
    ([workAreaId, members]) => ({
      workAreaId,
      workAreaType: members[0]?.workAreaType ?? "",
      baseHours: members.reduce((sum, item) => sum + item.baseHours, 0),
      adjustedHours: members.reduce((sum, item) => sum + item.adjustedHours, 0),
      hoursAreElapsedDuration: false as const,
      contributorRequirementIds: members.map((item) => item.requirementId),
    })
  );

  return {
    byTask: byTask.sort((left, right) =>
      left.aggregateKey < right.aggregateKey ? -1 : 1
    ),
    byTrade: byTrade.sort((left, right) => (left.trade < right.trade ? -1 : 1)),
    byWorkArea: byWorkArea.sort((left, right) =>
      left.workAreaId < right.workAreaId ? -1 : 1
    ),
    totalHours: {
      baseHours: requirements.reduce((sum, item) => sum + item.baseHours, 0),
      adjustedHours: requirements.reduce((sum, item) => sum + item.adjustedHours, 0),
      hoursAreElapsedDuration: false,
    },
  };
}

function plantAggregateKey(requirement: PlantRequirement): string {
  if (!requirement.plantKey) {
    return `unkeyed:${requirement.requirementId}`;
  }
  return `plant:${requirement.plantKey}|unit:${normalizeUnit(requirement.unit ?? "")}`;
}

export function groupPlantRequirements(
  requirements: readonly PlantRequirement[]
): readonly PlantRequirementAggregate[] {
  const groups = new Map<string, PlantRequirement[]>();
  for (const requirement of requirements) {
    const key = plantAggregateKey(requirement);
    const list = groups.get(key);
    if (list) list.push(requirement);
    else groups.set(key, [requirement]);
  }

  const aggregates: PlantRequirementAggregate[] = [];
  for (const [aggregateKey, members] of groups) {
    const first = members[0];
    if (!first) continue;
    const hours = members.every((item) => item.hours == null)
      ? null
      : members.reduce((sum, item) => sum + (item.hours ?? 0), 0);
    const quantity = members.every((item) => item.quantity == null)
      ? null
      : members.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    aggregates.push({
      aggregateKey,
      plantKey: first.plantKey ?? null,
      unit: first.unit,
      hours,
      quantity,
      pricedTotalCost: sumPricedCost(members),
      contributors: members.map(contributorRef),
    });
  }
  return aggregates.sort((left, right) =>
    left.aggregateKey < right.aggregateKey ? -1 : 1
  );
}

function subcontractAggregateKey(requirement: SubcontractRequirement): string {
  return [
    requirement.workAreaId,
    requirement.trade ?? "",
    requirement.componentKey,
    requirement.variantKey ?? "",
  ].join("|");
}

export function groupSubcontractRequirements(
  requirements: readonly SubcontractRequirement[]
): {
  byScope: readonly SubcontractRequirementAggregate[];
  byTrade: readonly SubcontractTradeTotal[];
} {
  const scopeGroups = new Map<string, SubcontractRequirement[]>();
  const tradeGroups = new Map<string, SubcontractRequirement[]>();
  for (const requirement of requirements) {
    const scopeKey = subcontractAggregateKey(requirement);
    const scopeList = scopeGroups.get(scopeKey);
    if (scopeList) scopeList.push(requirement);
    else scopeGroups.set(scopeKey, [requirement]);

    const trade = requirement.trade ?? "unspecified";
    const tradeList = tradeGroups.get(trade);
    if (tradeList) tradeList.push(requirement);
    else tradeGroups.set(trade, [requirement]);
  }

  const byScope: SubcontractRequirementAggregate[] = [];
  for (const [aggregateKey, members] of scopeGroups) {
    const first = members[0];
    if (!first) continue;
    byScope.push({
      aggregateKey,
      workAreaId: first.workAreaId,
      workAreaType: first.workAreaType,
      trade: first.trade ?? null,
      componentKey: first.componentKey,
      pricedTotalCost: sumPricedCost(members),
      contributors: members.map(contributorRef),
    });
  }

  const byTrade: SubcontractTradeTotal[] = [...tradeGroups.entries()].map(
    ([trade, members]) => ({
      trade,
      requirementCount: members.length,
      pricedTotalCost: sumPricedCost(members),
      workAreaIds: [...new Set(members.map((item) => item.workAreaId))],
      contributorRequirementIds: members.map((item) => item.requirementId),
    })
  );

  return {
    byScope: byScope.sort((left, right) =>
      left.aggregateKey < right.aggregateKey ? -1 : 1
    ),
    byTrade: byTrade.sort((left, right) => (left.trade < right.trade ? -1 : 1)),
  };
}

function wasteAggregateKey(requirement: WasteRequirement): string {
  if (!requirement.wasteKey) {
    return `unkeyed:${requirement.requirementId}`;
  }
  return `waste:${requirement.wasteKey}|unit:${normalizeUnit(requirement.unit ?? "")}`;
}

export function groupWasteRequirements(
  requirements: readonly WasteRequirement[]
): readonly WasteRequirementAggregate[] {
  const groups = new Map<string, WasteRequirement[]>();
  for (const requirement of requirements) {
    const key = wasteAggregateKey(requirement);
    const list = groups.get(key);
    if (list) list.push(requirement);
    else groups.set(key, [requirement]);
  }

  const aggregates: WasteRequirementAggregate[] = [];
  for (const [aggregateKey, members] of groups) {
    const first = members[0];
    if (!first) continue;
    const quantity = members.every((item) => item.quantity == null)
      ? null
      : members.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    aggregates.push({
      aggregateKey,
      wasteKey: first.wasteKey ?? null,
      unit: first.unit,
      quantity,
      pricedTotalCost: sumPricedCost(members),
      contributors: members.map(contributorRef),
    });
  }
  return aggregates.sort((left, right) =>
    left.aggregateKey < right.aggregateKey ? -1 : 1
  );
}

export function aggregatePricedRequirementCosts(
  requirements: readonly EstimateRequirement[]
): PricedRequirementCostTotals {
  const totals: PricedRequirementCostTotals = {
    materialCost: 0,
    labourCost: 0,
    plantCost: 0,
    subcontractCost: 0,
    wasteCost: 0,
    totalCost: 0,
    pricedCount: 0,
    unpricedExcludedCount: 0,
  };

  for (const requirement of requirements) {
    if (!requirement.priced) {
      totals.unpricedExcludedCount += 1;
      continue;
    }
    totals.pricedCount += 1;
    const cost = requirement.totalCost ?? 0;
    switch (requirement.kind) {
      case "material":
        totals.materialCost += cost;
        break;
      case "labour":
        totals.labourCost += cost;
        break;
      case "plant":
        totals.plantCost += cost;
        break;
      case "subcontract":
        totals.subcontractCost += cost;
        break;
      case "waste":
        totals.wasteCost += cost;
        break;
    }
    totals.totalCost += cost;
  }

  return totals;
}

function detectUnsafeMaterialUnitMerges(
  materials: readonly MaterialRequirement[]
): UnsafeAggregationRefusal[] {
  const byKey = new Map<string, Set<string>>();
  for (const requirement of materials) {
    if (!requirement.materialKey) continue;
    const units = byKey.get(requirement.materialKey) ?? new Set<string>();
    units.add(normalizeUnit(requirement.purchaseUnit));
    byKey.set(requirement.materialKey, units);
  }
  const refusals: UnsafeAggregationRefusal[] = [];
  for (const [identity, units] of byKey) {
    if (units.size > 1) {
      refusals.push({
        kind: "material",
        identity,
        reason: "incompatible_units",
        units: [...units].sort(),
      });
    }
  }
  return refusals;
}

export function buildRequirementDiagnostics(
  requirements: readonly EstimateRequirement[],
  materials: readonly MaterialRequirement[]
): RequirementDiagnostics {
  const countsByKind: Record<RequirementKind, number> = {
    material: 0,
    labour: 0,
    plant: 0,
    subcontract: 0,
    waste: 0,
  };
  const confidenceCounts: Record<RequirementConfidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  let pricedCount = 0;
  let missingPricingCount = 0;
  const seenIds = new Set<string>();
  let duplicateIdCount = 0;

  for (const requirement of requirements) {
    countsByKind[requirement.kind] += 1;
    confidenceCounts[requirement.confidence] += 1;
    if (requirement.priced) pricedCount += 1;
    if (seenIds.has(requirement.requirementId)) {
      duplicateIdCount += 1;
    }
    seenIds.add(requirement.requirementId);
    if (requirement.kind === "material" && requirement.rateSource === "missing") {
      missingPricingCount += 1;
    } else if (
      requirement.kind === "labour" &&
      requirement.rateProvenance === "missing"
    ) {
      missingPricingCount += 1;
    } else if (!requirement.priced) {
      missingPricingCount += 1;
    }
  }

  return {
    requirementCount: requirements.length,
    countsByKind,
    pricedCount,
    unpricedCount: requirements.length - pricedCount,
    missingPricingCount,
    duplicateIdCount,
    unsafeAggregationRefusals: detectUnsafeMaterialUnitMerges(materials),
    confidenceCounts,
  };
}

export function toRequirementShadowFields(
  requirement: EstimateRequirement
): RequirementShadowFields {
  if (requirement.kind === "material") {
    return {
      requirementId: requirement.requirementId,
      kind: requirement.kind,
      workAreaId: requirement.workAreaId,
      componentKey: requirement.componentKey,
      variantKey: requirement.variantKey,
      priced: requirement.priced,
      physicalQuantity: requirement.purchaseQuantity,
      physicalUnit: requirement.purchaseUnit,
      totalCost: requirement.totalCost,
    };
  }
  if (requirement.kind === "labour") {
    return {
      requirementId: requirement.requirementId,
      kind: requirement.kind,
      workAreaId: requirement.workAreaId,
      componentKey: requirement.componentKey,
      variantKey: requirement.variantKey,
      priced: requirement.priced,
      physicalQuantity: requirement.adjustedHours,
      physicalUnit: "h",
      totalCost: requirement.totalCost,
    };
  }
  return {
    requirementId: requirement.requirementId,
    kind: requirement.kind,
    workAreaId: requirement.workAreaId,
    componentKey: requirement.componentKey,
    variantKey: requirement.variantKey,
    priced: requirement.priced,
    physicalQuantity:
      requirement.kind === "plant"
        ? (requirement.hours ?? requirement.quantity ?? null)
        : requirement.kind === "waste"
          ? (requirement.quantity ?? null)
          : null,
    physicalUnit:
      requirement.kind === "plant" || requirement.kind === "waste"
        ? (requirement.unit ?? null)
        : null,
    totalCost: requirement.totalCost ?? null,
  };
}

/**
 * Physical / information aggregation. Not pricing-authority promotion.
 */
export function summarizeEstimateRequirements(
  requirements: readonly EstimateRequirement[] | null | undefined
): EstimateRequirementSummary {
  const normalized = normalizeRequirements(requirements);
  const materials = normalized.filter(
    (requirement): requirement is MaterialRequirement =>
      requirement.kind === "material"
  );
  const labour = normalized.filter(
    (requirement): requirement is LabourRequirement => requirement.kind === "labour"
  );
  const plant = normalized.filter(
    (requirement): requirement is PlantRequirement => requirement.kind === "plant"
  );
  const subcontract = normalized.filter(
    (requirement): requirement is SubcontractRequirement =>
      requirement.kind === "subcontract"
  );
  const waste = normalized.filter(
    (requirement): requirement is WasteRequirement => requirement.kind === "waste"
  );

  const labourSummary = summarizeLabourRequirements(labour);
  const subcontractSummary = groupSubcontractRequirements(subcontract);

  return {
    requirements: normalized,
    materials: groupMaterialRequirements(materials),
    labourByTask: labourSummary.byTask,
    labourByTrade: labourSummary.byTrade,
    labourByWorkArea: labourSummary.byWorkArea,
    labourTotalHours: labourSummary.totalHours,
    plant: groupPlantRequirements(plant),
    subcontract: subcontractSummary.byScope,
    subcontractByTrade: subcontractSummary.byTrade,
    waste: groupWasteRequirements(waste),
    pricedRequirementCostTotals: aggregatePricedRequirementCosts(normalized),
    diagnostics: buildRequirementDiagnostics(normalized, materials),
  };
}

/** Alias: physical aggregation entry point. Does not promote commercial authority. */
export const aggregateEstimateRequirements = summarizeEstimateRequirements;
