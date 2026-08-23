/**
 * RECOVERY-5B — Builder Review projection.
 * Active commercial lines only contribute money.
 * Shadow / structural requirements may appear as non-commercial takeoff.
 */

import { round2 } from "@/lib/estimate/facts";
import {
  presentEstimateCategoryTotals,
  presentEstimateWorkAreaTotals,
} from "@/lib/estimate/presentation-breakdown";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_SUPPORTS_COMPONENT_KEY,
  DECK_SUBSTRUCTURE_GROUP_KEY,
  DECK_STRUCTURAL_ESTIMATING_DISCLAIMER,
  DECK_PHYSICAL_TAKEOFF_UNAVAILABLE_HINT,
  PLANNING_TAKEOFF_PARENT_HINT,
} from "@/lib/estimate/deck-structure";
import { DECK_SURFACE_COMPONENT_KEY } from "@/lib/estimate/deck-surface-requirement";
import {
  DECK_CONCRETE_BAGS_COMPONENT_KEY,
  DECK_STEPS_FRAMING_COMPONENT_KEY,
  DECK_STEPS_TREADS_COMPONENT_KEY,
} from "@/lib/estimate/deck-scope-2c";
import { classifyRateSource, getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import type { EstimateLineItem } from "@/components/assistant/types";
import type { EstimateRequirement, MaterialRequirement } from "@/lib/estimate/requirements";
import type {
  BuilderReviewCategoryGroup,
  BuilderReviewCategoryId,
  BuilderReviewImprovement,
  BuilderReviewIssue,
  BuilderReviewPricedLine,
  BuilderReviewTakeoffRow,
  BuilderReviewView,
  BuilderReviewWorkAreaGroup,
  ComposeBuilderReviewInput,
} from "@/lib/assistant/builder-review/types";

const CATEGORY_LABELS: Record<BuilderReviewCategoryId, string> = {
  MATERIALS: "Materials",
  LABOUR: "Labour",
  ALLOWANCES: "Allowances",
  SUBCONTRACT: "Subcontract",
  PLANT: "Plant",
  WASTE: "Waste",
  OTHER_DIRECT_COSTS: "Other direct costs",
  PRICING_REQUIRED: "Pricing required",
};

const CATEGORY_ORDER: BuilderReviewCategoryId[] = [
  "MATERIALS",
  "LABOUR",
  "ALLOWANCES",
  "SUBCONTRACT",
  "PLANT",
  "WASTE",
  "OTHER_DIRECT_COSTS",
  "PRICING_REQUIRED",
];

const STRUCTURAL_TAKEOFF_KEYS = new Set([
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_BEARERS_COMPONENT_KEY,
  DECK_SUPPORTS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_CONCRETE_BAGS_COMPONENT_KEY,
  "deck.steps.treads",
  "deck.steps.framing",
  DECK_STEPS_TREADS_COMPONENT_KEY,
  DECK_STEPS_FRAMING_COMPONENT_KEY,
]);

const MAX_IMPROVEMENTS = 4;

function activeLines(
  items: readonly EstimateLineItem[]
): EstimateLineItem[] {
  return items.filter((item) => item.includedInTotal !== false);
}

export function mapLineCategory(
  item: EstimateLineItem
): BuilderReviewCategoryId {
  const source = classifyRateSource(item.rateSource ?? "");
  if (source === "missing") return "PRICING_REQUIRED";

  switch (item.category) {
    case "labour":
      return "LABOUR";
    case "materials":
      return "MATERIALS";
    case "subcontractor":
      return "SUBCONTRACT";
    case "allowance":
      return "ALLOWANCES";
    case "contingency":
      return "OTHER_DIRECT_COSTS";
    default:
      return "OTHER_DIRECT_COSTS";
  }
}

export function mapRateLabel(raw: string): string {
  const type = classifyRateSource(raw);
  if (type === "user_rate") return "Company rate";
  if (type === "benchmark") return "Quotr benchmark";
  if (type === "fallback") return "Preliminary fallback";
  if (type === "missing") return "Rate required";
  if (type === "default") return "Default allowance";
  if (type === "work_area_rate") return "Work area rate";
  return getRateSourceLabel(type);
}

function isAllowanceLine(item: EstimateLineItem): boolean {
  if (item.category === "allowance" || item.category === "contingency") {
    return true;
  }
  const key = (item.itemKey ?? "").toLowerCase();
  return (
    key.includes("fixings") ||
    key.includes("substructure") ||
    key.includes("allowance") ||
    /package/i.test(item.label)
  );
}

function lineSpecification(item: EstimateLineItem): string | null {
  if (item.identitySummary?.trim()) {
    return item.identitySummary.trim();
  }
  const parts: string[] = [];
  const resolution = item.materialRateResolution;
  if (resolution?.display) {
    parts.push(resolution.display);
  }
  if (item.notes?.trim()) {
    const note = item.notes.trim();
    const identityCut = note.split(" · Identity:")[0]?.trim() ?? note;
    if (identityCut && !parts.includes(identityCut)) {
      parts.push(identityCut);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function toPricedLine(item: EstimateLineItem): BuilderReviewPricedLine {
  const category = mapLineCategory(item);
  return {
    id: item.id,
    label: item.label,
    category,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    labourHours: item.labourHours ?? null,
    costRate: item.costRate ?? null,
    rateLabel: mapRateLabel(item.rateSource ?? ""),
    itemKey: item.itemKey ?? null,
    componentKey: item.componentKey ?? item.itemKey ?? null,
    isAllowance: isAllowanceLine(item),
    specification: lineSpecification(item),
    sourceLine: item,
  };
}

function takeoffConfidence(
  req: MaterialRequirement
): BuilderReviewTakeoffRow["confidenceLabel"] {
  if (req.confidence === "low") return "Preliminary quantity";
  if (req.assumptions.some((a) => a.source === "calculator_default")) {
    return "Based on current layout assumptions";
  }
  if (req.confidence === "medium") return "Based on current layout assumptions";
  return null;
}

function takeoffLabel(req: MaterialRequirement): string {
  if (req.componentKey === DECK_JOISTS_COMPONENT_KEY) return "Joists";
  if (req.componentKey === DECK_RIM_FRAMING_COMPONENT_KEY) return "Rim framing";
  if (req.componentKey === DECK_BEARERS_COMPONENT_KEY) return "Bearers";
  if (req.componentKey === DECK_SUPPORTS_COMPONENT_KEY) return "Supports";
  if (req.componentKey === DECK_CONCRETE_COMPONENT_KEY) return "Concrete";
  return req.description;
}

export function isNonCommercialStructuralTakeoff(
  req: EstimateRequirement
): req is MaterialRequirement {
  return (
    req.kind === "material" && STRUCTURAL_TAKEOFF_KEYS.has(req.componentKey)
  );
}

export function toTakeoffRow(
  req: MaterialRequirement
): BuilderReviewTakeoffRow {
  return {
    requirementId: req.requirementId,
    componentKey: req.componentKey,
    label: takeoffLabel(req),
    quantity: round2(req.purchaseQuantity),
    unit: req.purchaseUnit,
    specification: req.specification ?? null,
    detail: req.specification ?? null,
    confidenceLabel: takeoffConfidence(req),
    commercial: false,
    parentAllowanceHint: PLANNING_TAKEOFF_PARENT_HINT,
  };
}

function workAreaTypeForName(
  name: string,
  workAreas: ComposeBuilderReviewInput["workAreas"]
): { id: string | null; type: string | null } {
  const match = workAreas.find(
    (wa) =>
      wa.status !== "excluded" &&
      wa.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  return match
    ? { id: match.id, type: match.type }
    : { id: null, type: null };
}

function attachTakeoff(
  categories: BuilderReviewCategoryGroup[],
  takeoff: readonly BuilderReviewTakeoffRow[],
  workAreaType: string | null,
  unavailableHint: string | null
): BuilderReviewCategoryGroup[] {
  if (workAreaType !== "deck") return categories;
  if (takeoff.length === 0 && !unavailableHint) return categories;

  const withMeta = (
    target: BuilderReviewCategoryGroup
  ): BuilderReviewCategoryGroup => ({
    ...target,
    takeoff,
    takeoffDisclaimer:
      takeoff.length > 0 ? DECK_STRUCTURAL_ESTIMATING_DISCLAIMER : null,
    takeoffUnavailableHint:
      takeoff.length === 0 ? unavailableHint : null,
  });

  const framingIdx = categories.findIndex(
    (c) =>
      c.id === "ALLOWANCES" ||
      c.lines.some(
        (line) =>
          (line.itemKey ?? "").includes("substructure") ||
          /framing|substructure/i.test(line.label)
      )
  );
  if (framingIdx >= 0) {
    const target = categories[framingIdx]!;
    const next = [...categories];
    next[framingIdx] = withMeta(target);
    return next;
  }

  // Framing package missing — still show takeoff under Materials as evidence only.
  const materialsIdx = categories.findIndex((c) => c.id === "MATERIALS");
  if (materialsIdx >= 0) {
    const target = categories[materialsIdx]!;
    const next = [...categories];
    next[materialsIdx] = withMeta(target);
    return next;
  }

  if (takeoff.length === 0 && unavailableHint) {
    return [
      ...categories,
      {
        id: "ALLOWANCES",
        label: CATEGORY_LABELS.ALLOWANCES,
        cost: 0,
        lines: [],
        takeoff: [],
        takeoffDisclaimer: null,
        takeoffUnavailableHint: unavailableHint,
      },
    ];
  }

  if (takeoff.length > 0) {
    return [
      ...categories,
      {
        id: "ALLOWANCES",
        label: CATEGORY_LABELS.ALLOWANCES,
        cost: 0,
        lines: [],
        takeoff,
        takeoffDisclaimer: DECK_STRUCTURAL_ESTIMATING_DISCLAIMER,
        takeoffUnavailableHint: null,
      },
    ];
  }

  return categories;
}

function normalizeIssueKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildIssues(
  input: ComposeBuilderReviewInput
): {
  assumptions: BuilderReviewIssue[];
  checks: BuilderReviewIssue[];
  improvements: BuilderReviewImprovement[];
} {
  const assumptionKeys = new Set<string>();
  const assumptions: BuilderReviewIssue[] = [];
  for (const row of input.estimate.assumptions) {
    const key = normalizeIssueKey(row);
    if (!key || assumptionKeys.has(key)) continue;
    assumptionKeys.add(key);
    assumptions.push({
      id: `assumption:${key}`,
      kind: "assumption",
      label: row,
      detail: null,
      editSection: "details",
    });
  }

  const checkKeys = new Set<string>();
  const checks: BuilderReviewIssue[] = [];
  const improvements: BuilderReviewImprovement[] = [];

  for (const item of input.attentionItems ?? []) {
    const key = normalizeIssueKey(item.label);
    if (!key) continue;
    if (assumptionKeys.has(key)) continue;

    // Non-actionable informational items are not improvements.
    if (item.attentionKind === "NON_ACTIONABLE_INFORMATION") continue;

    const severity = item.productSeverity ?? "check";
    if (severity === "assumption") {
      if (assumptionKeys.has(key)) continue;
      assumptionKeys.add(key);
      assumptions.push({
        id: item.id,
        kind: "assumption",
        label: item.label,
        detail: null,
        editSection: "job_plan",
      });
      continue;
    }

    if (checkKeys.has(key)) continue;
    checkKeys.add(key);

    // Only include items that have an actionable route (reviewTarget maps to an editable section).
    const hasActionableTarget = Boolean(
      item.reviewTarget === "projectConditions" ||
      item.reviewTarget === "constraints" ||
      item.reviewTarget === "questions" ||
      item.reviewTarget === "estimateReview" ||
      item.reviewTarget === "scopeReview" ||
      item.factKey ||
      item.workAreaId
    );

    const section =
      item.reviewTarget === "projectConditions" ||
      item.reviewTarget === "constraints"
        ? "project_conditions"
        : item.reviewTarget === "questions"
          ? "advanced"
          : "job_plan";
    checks.push({
      id: item.id,
      kind: "check",
      label: item.label,
      detail: null,
      editSection: section,
      // Carry actionability to filter improvements below.
      _actionable: hasActionableTarget,
    } as BuilderReviewIssue & { _actionable: boolean });
  }

  for (const row of input.estimate.missingInfo) {
    const key = normalizeIssueKey(row);
    if (!key || assumptionKeys.has(key) || checkKeys.has(key)) continue;
    checkKeys.add(key);
    checks.push({
      id: `missing:${key}`,
      kind: "check",
      label: row,
      detail: null,
      editSection: "job_plan",
    });
  }

  for (const check of checks) {
    if (improvements.length >= MAX_IMPROVEMENTS) break;
    // Only include actionable items (have an editable target).
    const actionable = "_actionable" in check ? (check as BuilderReviewIssue & { _actionable: boolean })._actionable : true;
    if (!actionable) continue;
    improvements.push({
      id: `improve:${check.id}`,
      label: check.label,
      reason: "Could improve estimate accuracy",
      editSection: check.editSection === "advanced" ? "refine" : check.editSection,
    });
  }

  if (improvements.length < MAX_IMPROVEMENTS) {
    for (const assumption of assumptions) {
      if (improvements.length >= MAX_IMPROVEMENTS) break;
      if (/finish|standard|budget|premium/i.test(assumption.label)) continue;
      improvements.push({
        id: `improve:${assumption.id}`,
        label: assumption.label.replace(/^Assuming\s+/i, "Confirm "),
        reason: "Currently assumed",
        editSection: "refine",
      });
    }
  }

  return { assumptions, checks, improvements };
}

function confidenceExplanation(
  band: string | null,
  assumptionCount: number,
  checkCount: number
): string | null {
  if (!band) return null;
  const lower = band.toLowerCase();
  if (lower.includes("low")) {
    if (checkCount > 0 || assumptionCount > 0) {
      return "Low confidence because several dimensions or scope details remain unconfirmed.";
    }
    return "Low confidence — more confirmed details would strengthen this estimate.";
  }
  if (lower.includes("medium") || lower.includes("moderate")) {
    return assumptionCount > 0
      ? "Some assumptions remain; confirming key details would improve accuracy."
      : "Reasonable confidence for an initial estimate.";
  }
  if (lower.includes("high") || lower.includes("good")) {
    return "Most high-value inputs are confirmed.";
  }
  return null;
}

export function composeBuilderReview(
  input: ComposeBuilderReviewInput
): BuilderReviewView {
  const lines = activeLines(input.estimate.lineItems);
  const confirmedNames = input.workAreas
    .filter((wa) => wa.status !== "excluded")
    .map((wa) => wa.name);

  const waTotals = presentEstimateWorkAreaTotals(
    lines.map((item) => ({
      workAreaName: item.workAreaName,
      label: item.label,
      category: item.category,
      recommendedCost: item.recommendedCost,
      recommendedSell: item.recommendedSell,
      grossProfit: item.grossProfit,
      marginPercent: item.marginPercent,
      markupPercent: item.markupPercent,
      costLow: item.costLow,
      costHigh: item.costHigh,
      sellLow: item.sellLow,
      sellHigh: item.sellHigh,
      rateSource: item.rateSource,
      labourHours: item.labourHours,
      includedInTotal: item.includedInTotal,
    })),
    { confirmedWorkAreaNames: confirmedNames }
  );

  const requirements = input.requirements ?? [];
  const commercialComponentKeys = new Set(
    activeLines(input.estimate.lineItems)
      .map((item) => item.componentKey)
      .filter((key): key is string => Boolean(key))
  );
  const structuralTakeoff = requirements
    .filter(isNonCommercialStructuralTakeoff)
    .filter((req) => {
      if (
        req.componentKey === DECK_CONCRETE_COMPONENT_KEY &&
        commercialComponentKeys.has(DECK_CONCRETE_BAGS_COMPONENT_KEY)
      ) {
        return false;
      }
      return !commercialComponentKeys.has(req.componentKey);
    })
    .map(toTakeoffRow);

  const workAreas: BuilderReviewWorkAreaGroup[] = waTotals.map((wa) => {
    const meta = workAreaTypeForName(wa.name, input.workAreas);
    const areaLines = lines.filter((item) => {
      const raw = item.workAreaName?.trim() || "";
      if (!raw) return wa.name === "Unallocated";
      if (
        confirmedNames.length > 0 &&
        !confirmedNames.some((n) => n.trim().toLowerCase() === raw.toLowerCase())
      ) {
        return wa.name === "Unallocated";
      }
      return raw.toLowerCase() === wa.name.toLowerCase();
    });
    const priced = areaLines.map(toPricedLine);

    const byCategory = new Map<BuilderReviewCategoryId, BuilderReviewPricedLine[]>();
    for (const line of priced) {
      const list = byCategory.get(line.category) ?? [];
      list.push(line);
      byCategory.set(line.category, list);
    }

    let categories: BuilderReviewCategoryGroup[] = CATEGORY_ORDER.filter(
      (id) => (byCategory.get(id)?.length ?? 0) > 0
    ).map((id) => {
      const catLines = byCategory.get(id) ?? [];
      return {
        id,
        label: CATEGORY_LABELS[id],
        cost: round2(catLines.reduce((sum, line) => sum + line.recommendedCost, 0)),
        lines: catLines,
        takeoff: [],
        takeoffDisclaimer: null,
        takeoffUnavailableHint: null,
      };
    });

    const deckTakeoff =
      meta.type === "deck"
        ? structuralTakeoff.filter((row) => {
            const req = requirements.find(
              (r) => r.requirementId === row.requirementId
            );
            return !meta.id || req?.workAreaId === meta.id;
          })
        : [];

    const hasFramingAllowance = priced.some(
      (line) =>
        (line.itemKey ?? "").includes("substructure") ||
        /framing|substructure/i.test(line.label)
    );
    const unavailableHint =
      meta.type === "deck" &&
      deckTakeoff.length === 0 &&
      hasFramingAllowance
        ? DECK_PHYSICAL_TAKEOFF_UNAVAILABLE_HINT
        : null;

    categories = attachTakeoff(
      categories,
      deckTakeoff,
      meta.type,
      unavailableHint
    );

    return {
      workAreaId: meta.id,
      workAreaName: wa.name,
      workAreaType: meta.type,
      cost: wa.cost,
      sell: wa.sell,
      categories,
    };
  });

  const projectedCost = round2(
    workAreas.reduce((sum, wa) => sum + wa.cost, 0)
  );
  const estimateCost = round2(input.estimate.recommendedCost);
  const costReconciles = Math.abs(projectedCost - estimateCost) < 0.05;

  const categoryRollup = presentEstimateCategoryTotals(lines);
  const categorySummary = CATEGORY_ORDER.map((id) => {
    let cost = 0;
    if (id === "MATERIALS") cost = categoryRollup.materials?.cost ?? 0;
    else if (id === "LABOUR") cost = categoryRollup.labour?.cost ?? 0;
    else if (id === "SUBCONTRACT") cost = categoryRollup.subcontractor?.cost ?? 0;
    else if (id === "ALLOWANCES") {
      cost =
        (categoryRollup.allowance?.cost ?? 0) + (categoryRollup.mixed?.cost ?? 0);
    } else if (id === "OTHER_DIRECT_COSTS") {
      cost = categoryRollup.contingency?.cost ?? 0;
    }
    return {
      id,
      label: CATEGORY_LABELS[id],
      cost: round2(cost),
    };
  }).filter((row) => row.cost > 0);

  const { assumptions, checks, improvements } = buildIssues(input);
  const band = input.confidenceBand ?? null;

  // Surface material requirements that are authoritative are NOT takeoff-under-allowance.
  // They appear only via priced lines. Ensure we never sum takeoff.
  const takeoffCostProbe = structuralTakeoff.reduce(
    (sum, row) => sum + (typeof row.quantity === "number" ? 0 : 0),
    0
  );
  void takeoffCostProbe;
  void DECK_SURFACE_COMPONENT_KEY;
  void DECK_SUBSTRUCTURE_GROUP_KEY;

  return {
    overview: {
      recommendedSell: input.estimate.recommendedSell,
      recommendedCost: estimateCost,
      marginPercent: input.estimate.marginPercent,
      confidenceBand: band,
      confidenceExplanation: confidenceExplanation(
        band,
        assumptions.length,
        checks.length
      ),
      workAreaCount: workAreas.filter((wa) => wa.workAreaName !== "Unallocated")
        .length,
      workAreaNames: workAreas.map((wa) => wa.workAreaName),
      categorySummary,
      isStale: Boolean(input.estimate.isStale),
    },
    workAreas,
    assumptions,
    checks,
    improvements,
    costReconciles,
    projectedCost,
    estimateCost,
    takeoffAffectsMoney: false,
    requirements,
  };
}
