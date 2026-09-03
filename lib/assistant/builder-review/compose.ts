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
import {
  RW_BACKFILL_COMPONENT,
  RW_EXCAVATION_COMPONENT,
  RW_EXCAVATION_LABOUR_COMPONENT,
  RW_EXCAVATION_SUBCONTRACT_COMPONENT,
  RW_FACE_AREA_COMPONENT,
  RW_MASONRY_BLOCKS_COMPONENT,
  RW_MASONRY_CORE_COMPONENT,
  RW_MASONRY_FOOTING_COMPONENT,
  RW_MASONRY_REBAR_COMPONENT,
  RW_MASONRY_SUBBASE_COMPONENT,
  RW_MASONRY_WATERPROOF_COMPONENT,
  RW_NOVACOIL_COMPONENT,
  RW_SLEEPER_COMPONENT,
  RW_SLEEPER_CONCRETE_COMPONENT,
  RW_SLEEPER_FIXINGS_COMPONENT,
  RW_SLEEPER_POSTS_EA_COMPONENT,
  RW_SLEEPER_POSTS_LM_COMPONENT,
  RW_SLEEPER_POSTS_PROCURE_COMPONENT,
  RW_SPOIL_DISPOSAL_COMPONENT,
  RW_SPOIL_DISPOSAL_M3_KEY,
  RW_SPOIL_REMOVAL_ALL_IN_M3_KEY,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_FIXINGS_COMPONENT,
  RW_TIMBER_PILES_EA_COMPONENT,
  RW_TIMBER_PILES_LM_COMPONENT,
  isRwTimberPileStockComponent,
} from "@/lib/estimate/retaining-wall-identities";
import { RW_TIMBER_CONCRETE_COMPONENT } from "@/lib/estimate/retaining-wall-family-coverage";
import {
  formatPileGroupSupporting,
  formatPileProcurementSummary,
  formatSleeperGroupSupporting,
  stripInternalEstimateTokens,
} from "@/lib/estimate/retaining-wall-builder-copy";
import { RW_SPOIL_REMOVAL_PRICING_HELPER } from "@/lib/estimate/retaining-wall-spoil-removal";
import { timberRateVarianceContext } from "@/lib/estimate/retaining-wall-rate-context";
import { RW_PLANNING_TAKEOFF_DISCLAIMER } from "@/lib/estimate/retaining-wall-physical";
import { FENCE_PLANNING_TAKEOFF_DISCLAIMER } from "@/lib/estimate/fence-physical";
import {
  FENCE_BOARDS_COMPONENT,
  FENCE_CAPPING_COMPONENT,
  FENCE_CONCRETE_COMPONENT,
  FENCE_FACE_AREA_COMPONENT,
  FENCE_FIXINGS_MODULAR_COMPONENT,
  FENCE_FIXINGS_TIMBER_COMPONENT,
  FENCE_GATE_FRAME_COMPONENT,
  FENCE_GATE_HARDWARE_COMPONENT,
  FENCE_GATE_POSTS_EA_COMPONENT,
  FENCE_POSTS_EA_COMPONENT,
  FENCE_POSTS_LM_COMPONENT,
  FENCE_RAILS_COMPONENT,
  FENCE_SECTIONS_COMPONENT,
  FENCE_TAKEOFF_COMPONENT_KEYS,
} from "@/lib/estimate/fence-identities";
import { classifyRateSource, getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import type { EstimateLineItem } from "@/components/assistant/types";
import type { EstimateRequirement, MaterialRequirement } from "@/lib/estimate/requirements";
import type {
  BuilderReviewCategoryGroup,
  BuilderReviewCategoryId,
  BuilderReviewImprovement,
  BuilderReviewIssue,
  BuilderReviewLineGroup,
  BuilderReviewPricedLine,
  BuilderReviewTakeoffRow,
  BuilderReviewView,
  BuilderReviewWorkAreaGroup,
  ComposeBuilderReviewInput,
} from "@/lib/assistant/builder-review/types";
import { isUserFacingEstimateAssumption } from "@/lib/assistant/presentation/user-facing-estimate-assumptions";

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
  RW_FACE_AREA_COMPONENT,
  RW_NOVACOIL_COMPONENT,
  RW_BACKFILL_COMPONENT,
  RW_EXCAVATION_COMPONENT,
  RW_TIMBER_BOARDS_COMPONENT,
  RW_TIMBER_PILES_EA_COMPONENT,
  RW_TIMBER_PILES_LM_COMPONENT,
  RW_SLEEPER_COMPONENT,
  RW_SLEEPER_POSTS_EA_COMPONENT,
  RW_SLEEPER_POSTS_LM_COMPONENT,
  RW_SLEEPER_CONCRETE_COMPONENT,
  RW_SLEEPER_FIXINGS_COMPONENT,
  RW_TIMBER_FIXINGS_COMPONENT,
  RW_MASONRY_BLOCKS_COMPONENT,
  RW_MASONRY_FOOTING_COMPONENT,
  RW_MASONRY_SUBBASE_COMPONENT,
  RW_MASONRY_CORE_COMPONENT,
  RW_MASONRY_WATERPROOF_COMPONENT,
  RW_MASONRY_REBAR_COMPONENT,
  ...FENCE_TAKEOFF_COMPONENT_KEYS,
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
  if (item.itemKey?.startsWith("plant.") || /mini-excavator|auger/i.test(item.label)) {
    return "PLANT";
  }
  const source = classifyRateSource(item.rateSource ?? "");
  if (
    item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT ||
    item.itemKey === RW_SPOIL_DISPOSAL_M3_KEY ||
    item.itemKey === RW_SPOIL_REMOVAL_ALL_IN_M3_KEY ||
    /spoil (disposal|removal)/i.test(item.label)
  ) {
    return source === "missing" ? "PRICING_REQUIRED" : "WASTE";
  }
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
  if (type === "calibrated_productivity") return "Your calibrated productivity";
  if (type === "benchmark") return "Quotr benchmark";
  if (type === "fallback") return "Preliminary fallback";
  if (type === "missing") return "Rate required";
  if (type === "default") return "Default allowance";
  if (type === "work_area_rate") return "Work area rate";
  return getRateSourceLabel(type);
}

function isAllowanceLine(item: EstimateLineItem): boolean {
  if (item.itemKey?.startsWith("plant.") || /mini-excavator|auger/i.test(item.label)) {
    return false;
  }
  if (item.category === "allowance" || item.category === "contingency") {
    return true;
  }
  const key = (item.itemKey ?? "").toLowerCase();
  return (
    key.includes("fixings") ||
    key.includes("substructure") ||
    key.includes("allowance") ||
    /package/i.test(item.label) ||
    /excavation allowance/i.test(item.label)
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
    const note = stripInternalEstimateTokens(item.notes.trim());
    const identityCut = note.split(" · Identity:")[0]?.trim() ?? note;
    if (identityCut && !parts.includes(identityCut)) {
      parts.push(identityCut);
    }
  }
  const joined = parts.length > 0 ? parts.join(" · ") : null;
  return joined ? stripInternalEstimateTokens(joined) : null;
}

function mapRwBuilderLabel(label: string): string {
  if (label === "Pile installation labour") return "Pile installation";
  if (label === "Face-board installation") return "Retaining-wall face installation";
  if (label === "Drainage installation labour") return "Drainage installation";
  if (label === "Drainage backfill labour") return "Drainage backfill";
  if (label === "Excavation labour") return "Excavation";
  if (/EXCAVATION ALLOWANCE/i.test(label)) return "Excavation allowance";
  if (/mini-excavator/i.test(label)) return "Mini-excavator / auger";
  if (/fixings, connectors and sundries/i.test(label)) {
    return "Fixings and connectors allowance";
  }
  if (/novacoil/i.test(label) && !/labour/i.test(label)) {
    return "Punched / slotted drainage coil";
  }
  if (/spoil disposal/i.test(label)) return "Spoil removal";
  if (label === "Steel post installation") return "Post installation";
  if (label === "Concrete sleeper installation") return "Sleeper installation";
  if (label === "Post-hole concrete placement") return "Post-hole concrete placement";
  if (label === "Sleeper hole concrete placement") return "Post-hole concrete placement";
  if (label === "Block laying subcontract") return "Masonry block laying — subcontract labour";
  return label;
}

export function toPricedLine(item: EstimateLineItem): BuilderReviewPricedLine {
  const category = mapLineCategory(item);
  const rateLabel = mapRateLabel(item.rateSource ?? "");
  const variance = timberRateVarianceContext({
    itemKey: item.itemKey,
    unit: item.unit,
    appliedCostRate: item.costRate,
    rateLabel,
  });
  const hierarchy = lineHierarchy(item, rateLabel, category);
  const spoil =
    item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT ||
    /spoil (disposal|removal)/i.test(item.label);
  return {
    id: item.id,
    label: mapRwBuilderLabel(item.label),
    category,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    labourHours: item.labourHours ?? null,
    costRate: item.costRate ?? null,
    rateLabel,
    itemKey: item.itemKey ?? null,
    componentKey: item.componentKey ?? item.itemKey ?? null,
    isAllowance: isAllowanceLine(item),
    specification: hierarchy.supporting,
    supporting: hierarchy.supporting,
    detail: hierarchy.detail,
    pricingHelper: spoil && rateLabel === "Rate required" ? RW_SPOIL_REMOVAL_PRICING_HELPER : null,
    rateContext: variance?.copy ?? null,
    sourceLine: item,
  };
}

function lineHierarchy(
  item: EstimateLineItem,
  rateLabel: string,
  category: BuilderReviewCategoryId
): { supporting: string | null; detail: string | null } {
  const spec = lineSpecification(item);
  const qty =
    item.quantity != null
      ? Number.isInteger(item.quantity)
        ? String(item.quantity)
        : item.quantity.toFixed(item.unit === "m3" ? 2 : 1)
      : null;
  const qtyUnit = qty && item.unit ? `${qty}${item.unit === "m3" ? "m³" : item.unit === "lm" ? "lm" : ` ${item.unit}`}` : qty;

  if (category === "LABOUR") {
    const compact = stripInternalEstimateTokens(
      item.identitySummary?.trim() || ""
    );
    const notes = stripInternalEstimateTokens(item.notes?.trim() || "");
    return {
      supporting: compact || notes || null,
      detail: compact && notes && notes !== compact ? notes : null,
    };
  }

  if (category === "PLANT") {
    const rate =
      item.costRate != null
        ? `$${item.costRate}/day · ${rateLabel}`
        : rateLabel;
    const hoursMatch = (item.notes ?? "").match(
      /([\d.]+)\s+estimated machine hours rounded to (\d+)/i
    );
    return {
      supporting: rate,
      detail: hoursMatch
        ? `${hoursMatch[1]} estimated machine hours rounded to ${hoursMatch[2]} hire day.`
        : null,
    };
  }

  if (item.componentKey === RW_NOVACOIL_COMPONENT) {
    const rate =
      item.costRate != null
        ? `$${item.costRate}/lm · ${rateLabel}`
        : rateLabel;
    return {
      supporting: [qtyUnit, rate].filter(Boolean).join(" · ") || null,
      detail: null,
    };
  }

  if (item.componentKey === RW_SLEEPER_POSTS_PROCURE_COMPONENT) {
    return {
      supporting: spec,
      detail: null,
    };
  }

  if (item.componentKey === RW_SLEEPER_COMPONENT) {
    return {
      supporting: item.identitySummary || spec || qtyUnit,
      detail:
        item.notes &&
        item.identitySummary &&
        item.notes !== item.identitySummary
          ? item.notes
          : null,
    };
  }

  if (
    item.componentKey === RW_SLEEPER_CONCRETE_COMPONENT ||
    item.componentKey === RW_TIMBER_CONCRETE_COMPONENT
  ) {
    return {
      supporting: item.identitySummary || spec || qtyUnit,
      detail:
        item.notes &&
        item.identitySummary &&
        item.notes !== item.identitySummary
          ? item.notes
          : null,
    };
  }

  if (
    item.componentKey === RW_SPOIL_DISPOSAL_COMPONENT ||
    /spoil (disposal|removal)/i.test(item.label)
  ) {
    return {
      supporting: qtyUnit,
      detail: null,
    };
  }

  const rateBit =
    item.costRate != null && item.unit
      ? `$${item.costRate}/${item.unit} · ${rateLabel}`
      : rateLabel !== "Rate required"
        ? rateLabel
        : null;
  const stepTreadDetail =
    item.componentKey === DECK_STEPS_TREADS_COMPONENT_KEY &&
    item.notes &&
    item.identitySummary &&
    item.notes !== item.identitySummary
      ? item.notes
      : null;
  return {
    supporting: [spec, rateBit].filter(Boolean).join(" · ") || null,
    detail: stepTreadDetail,
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
  if (req.componentKey === RW_FACE_AREA_COMPONENT) return "Wall face";
  if (req.componentKey === RW_NOVACOIL_COMPONENT) {
    return "Punched / slotted drainage coil";
  }
  if (req.componentKey === RW_BACKFILL_COMPONENT) return "Drainage aggregate / drainage backfill";
  if (req.componentKey === RW_EXCAVATION_COMPONENT) return "Bulk excavation";
  if (req.componentKey === RW_TIMBER_BOARDS_COMPONENT) return "Face boards";
  if (req.componentKey === RW_TIMBER_PILES_EA_COMPONENT) return "Piles";
  if (req.componentKey === RW_TIMBER_PILES_LM_COMPONENT) return "Pile length (theoretical)";
  if (isRwTimberPileStockComponent(req.componentKey)) return req.description;
  if (req.componentKey === RW_SLEEPER_COMPONENT) return "Concrete sleepers";
  if (req.componentKey === RW_SLEEPER_POSTS_EA_COMPONENT) return "Steel posts";
  if (req.componentKey === RW_SLEEPER_POSTS_LM_COMPONENT) return "Steel post length";
  if (req.componentKey === RW_SLEEPER_POSTS_PROCURE_COMPONENT) return "Steel retaining posts";
  if (req.componentKey === RW_SLEEPER_CONCRETE_COMPONENT) return "Post-hole concrete";
  if (req.componentKey === RW_TIMBER_CONCRETE_COMPONENT) return "Post-hole concrete";
  if (req.componentKey === RW_TIMBER_FIXINGS_COMPONENT) return "Fixings / connectors";
  if (req.componentKey === RW_SLEEPER_FIXINGS_COMPONENT) return "Sleeper connectors";
  if (req.componentKey === RW_MASONRY_BLOCKS_COMPONENT) return "Concrete masonry blocks";
  if (req.componentKey === RW_MASONRY_FOOTING_COMPONENT) return "Concrete footing";
  if (req.componentKey === RW_MASONRY_SUBBASE_COMPONENT) return "Subbase";
  if (req.componentKey === RW_MASONRY_CORE_COMPONENT) return "Core fill";
  if (req.componentKey === RW_MASONRY_WATERPROOF_COMPONENT) {
    return "Retaining-side waterproofing";
  }
  if (req.componentKey === RW_MASONRY_REBAR_COMPONENT) return "Reinforcement";
  if (req.componentKey === "retaining_wall.masonry.rebar.allowance") {
    return "Reinforcement allowance";
  }
  if (req.componentKey === "retaining_wall.masonry.mortar.allowance") {
    return "Masonry mortar / laying consumables";
  }
  if (req.componentKey === FENCE_FACE_AREA_COMPONENT) return "Fence face";
  if (req.componentKey === FENCE_POSTS_EA_COMPONENT) return "Fence posts";
  if (req.componentKey === FENCE_GATE_POSTS_EA_COMPONENT) return "Gate posts";
  if (req.componentKey === FENCE_POSTS_LM_COMPONENT) return "Fence post length";
  if (req.componentKey === FENCE_BOARDS_COMPONENT) {
    if (/paling/i.test(req.description)) return "Palings";
    if (/slat/i.test(req.description)) return "Slats";
    return req.description;
  }
  if (req.componentKey === FENCE_RAILS_COMPONENT) return "Rails";
  if (req.componentKey === FENCE_CAPPING_COMPONENT) return "Top capping";
  if (req.componentKey === FENCE_GATE_FRAME_COMPONENT) return "Gate framing";
  if (req.componentKey === FENCE_GATE_HARDWARE_COMPONENT) return "Gate hardware";
  if (req.componentKey === FENCE_CONCRETE_COMPONENT) {
    return "Post-hole concrete (bagged premix)";
  }
  if (req.componentKey === FENCE_FIXINGS_TIMBER_COMPONENT) return "Fixings";
  if (req.componentKey === FENCE_FIXINGS_MODULAR_COMPONENT) return "Fixings/brackets";
  if (req.componentKey === FENCE_SECTIONS_COMPONENT) return "Fence sections";
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
  const netPurchaseDiffer =
    req.wasteFactor > 0 && req.baseQuantity !== req.purchaseQuantity;
  const qtyDetail = netPurchaseDiffer
    ? `${round2(req.baseQuantity)} ${req.baseUnit} net · ${round2(req.purchaseQuantity)} ${req.purchaseUnit} purchased`
    : null;
  const spec = [qtyDetail, req.specification].filter(Boolean).join(" · ") || null;
  return {
    requirementId: req.requirementId,
    componentKey: req.componentKey,
    label: takeoffLabel(req),
    quantity: round2(req.purchaseQuantity),
    unit: req.purchaseUnit,
    specification: spec,
    detail: spec,
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

function buildPileLineGroup(
  requirements: readonly EstimateRequirement[],
  workAreaId: string | null,
  stockLines: readonly BuilderReviewPricedLine[]
): BuilderReviewLineGroup | null {
  if (stockLines.length === 0) return null;
  const inArea = requirements.filter(
    (row) => !workAreaId || row.workAreaId === workAreaId
  );
  const ea = inArea.find(
    (row) => row.kind === "material" && row.componentKey === RW_TIMBER_PILES_EA_COMPONENT
  ) as MaterialRequirement | undefined;
  const lm = inArea.find(
    (row) => row.kind === "material" && row.componentKey === RW_TIMBER_PILES_LM_COMPONENT
  ) as MaterialRequirement | undefined;
  const purchaseLm = round2(
    stockLines.reduce((sum, line) => {
      const fromKey = line.componentKey?.match(/(\d+)_(\d+)m$/);
      const length = fromKey ? Number(`${fromKey[1]}.${fromKey[2]}`) : 0;
      return sum + (line.quantity ?? 0) * length;
    }, 0)
  );
  const compact = formatPileGroupSupporting({
    pileCount: ea?.purchaseQuantity ?? stockLines.reduce((s, l) => s + (l.quantity ?? 0), 0),
    theoreticalLm: lm?.baseQuantity ?? lm?.purchaseQuantity ?? 0,
    purchaseLm,
  });
  const company = stockLines.every((line) => line.rateLabel === "Company rate");
  const hasVariance = stockLines.some((line) => Boolean(line.rateContext));
  return {
    id: "h5-retaining-poles",
    label: "H5 retaining poles",
    recommendedCost: round2(
      stockLines.reduce((sum, line) => sum + line.recommendedCost, 0)
    ),
    supporting: compact.supporting,
    secondary: compact.secondary,
    itemKey: stockLines[0]?.itemKey ?? null,
    showChangeMaterial: true,
    rateContext: company && hasVariance ? "Company stock rates are being used." : null,
    children: stockLines,
  };
}

function buildSleeperPostLineGroup(
  requirements: readonly EstimateRequirement[],
  workAreaId: string | null,
  procureLines: readonly BuilderReviewPricedLine[]
): BuilderReviewLineGroup | null {
  if (procureLines.length === 0) return null;
  const inArea = requirements.filter(
    (row) => !workAreaId || row.workAreaId === workAreaId
  );
  const ea = inArea.find(
    (row) =>
      row.kind === "material" && row.componentKey === RW_SLEEPER_POSTS_EA_COMPONENT
  ) as MaterialRequirement | undefined;
  const lm = inArea.find(
    (row) =>
      row.kind === "material" && row.componentKey === RW_SLEEPER_POSTS_LM_COMPONENT
  ) as MaterialRequirement | undefined;
  const compact = formatSleeperGroupSupporting({
    postCount: ea?.purchaseQuantity ?? 0,
    theoreticalLm: lm?.baseQuantity ?? lm?.purchaseQuantity ?? 0,
  });
  const lengths = inArea.find(
    (row) =>
      row.kind === "material" && row.componentKey === RW_SLEEPER_POSTS_LM_COMPONENT
  ) as MaterialRequirement | undefined;
  return {
    id: "steel-retaining-posts",
    label: "Steel retaining posts",
    recommendedCost: round2(
      procureLines.reduce((sum, line) => sum + line.recommendedCost, 0)
    ),
    supporting: compact.supporting,
    secondary: compact.secondary,
    itemKey: procureLines[0]?.itemKey ?? null,
    showChangeMaterial: true,
    rateContext: procureLines[0]?.rateContext ?? null,
    children: procureLines.map((line) => ({
      ...line,
      supporting:
        line.supporting ??
        (lengths
          ? `${round2(lengths.purchaseQuantity)}lm theoretical`
          : line.supporting),
    })),
  };
}

function pileProcurementGroupNote(
  requirements: readonly EstimateRequirement[],
  workAreaId: string | null
): { id: string; title: string; detail: string } | null {
  const inArea = requirements.filter(
    (row) => !workAreaId || row.workAreaId === workAreaId
  );
  const stock = inArea.filter(
    (row): row is MaterialRequirement =>
      row.kind === "material" && isRwTimberPileStockComponent(row.componentKey)
  );
  if (stock.length === 0) return null;
  const ea = inArea.find(
    (row) => row.kind === "material" && row.componentKey === RW_TIMBER_PILES_EA_COMPONENT
  ) as MaterialRequirement | undefined;
  const lm = inArea.find(
    (row) => row.kind === "material" && row.componentKey === RW_TIMBER_PILES_LM_COMPONENT
  ) as MaterialRequirement | undefined;
  const byStock = stock.map((row) => {
    const fromKey = row.componentKey.match(/(\d+)_(\d+)m$/);
    const fromLabel = row.description.match(/×\s*([\d.]+)\s*m/);
    const stockLengthM = fromLabel
      ? Number(fromLabel[1])
      : fromKey
        ? Number(`${fromKey[1]}.${fromKey[2]}`)
        : 0;
    return { stockLengthM, ea: row.purchaseQuantity };
  });
  const purchaseEa = stock.reduce((sum, row) => sum + row.purchaseQuantity, 0);
  const purchaseLm = round2(
    byStock.reduce((sum, row) => sum + row.ea * row.stockLengthM, 0)
  );
  const summary = formatPileProcurementSummary({
    pileCount: ea?.purchaseQuantity ?? purchaseEa,
    theoreticalLm: lm?.baseQuantity ?? lm?.purchaseQuantity ?? 0,
    purchaseEa,
    purchaseLm,
    byStock,
  });
  return { id: "pile-procurement", ...summary };
}

function attachTakeoff(
  categories: BuilderReviewCategoryGroup[],
  takeoff: readonly BuilderReviewTakeoffRow[],
  workAreaType: string | null,
  unavailableHint: string | null
): BuilderReviewCategoryGroup[] {
  if (
    workAreaType !== "deck" &&
    workAreaType !== "retaining_wall" &&
    workAreaType !== "fence"
  ) {
    return categories;
  }
  if (takeoff.length === 0 && !unavailableHint) return categories;

  const withMeta = (
    target: BuilderReviewCategoryGroup
  ): BuilderReviewCategoryGroup => ({
    ...target,
    takeoff,
    takeoffDisclaimer:
      takeoff.length > 0
        ? workAreaType === "retaining_wall"
          ? RW_PLANNING_TAKEOFF_DISCLAIMER
          : workAreaType === "fence"
            ? FENCE_PLANNING_TAKEOFF_DISCLAIMER
            : DECK_STRUCTURAL_ESTIMATING_DISCLAIMER
        : null,
    takeoffUnavailableHint:
      takeoff.length === 0 ? unavailableHint : null,
    takeoffCollapsedByDefault:
      workAreaType === "retaining_wall" || workAreaType === "fence",
    takeoffTitle:
      workAreaType === "retaining_wall" || workAreaType === "fence"
        ? "Takeoff details"
        : takeoff.length > 0
          ? "Framing takeoff available"
          : "Planning takeoff",
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
        takeoffCollapsedByDefault: false,
        takeoffTitle: "Planning takeoff",
        groupNotes: [],
        lineGroups: [],
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
        takeoffCollapsedByDefault: false,
        takeoffTitle: "Framing takeoff available",
        groupNotes: [],
        lineGroups: [],
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

function isHighValueBuilderImprovement(
  label: string,
  retainingWallOnly: boolean,
  fenceOnly = false
): boolean {
  if (/confirm sleeper system/i.test(label)) return true;
  if (/post spacing does not match the selected sleeper length/i.test(label)) return true;
  const estimatingDisclosureOnly =
    /estimating assumption only|not a manufacturer requirement|not a manufacturer SKU/i.test(
      label
    );
  if (!estimatingDisclosureOnly && /consent|engineering/i.test(label)) return true;
  if (/spoil removal|disposal included|spoil leaving/i.test(label)) return true;
  if (/quantity required|price required|trusted price|hardfill removal rate/i.test(label)) {
    return true;
  }
  if (/face.board|material specification|wall type|unsupported/i.test(label)) return true;
  if (fenceOnly) {
    return /confirm (post spacing|post embedment|gate width|horizontal slat gap|horizontal slat support|gap between vertical palings|modular panel|section width|top capp|existing.fence removal)/i.test(
      label
    ) || /tall fence|modular (fence )?gate.{0,40}pricing required|panel height does not match|compatible manufactured gate/i.test(label);
  }
  if (!retainingWallOnly) return true;
  if (/spacing|waste factor|procurement allowance|10% waste|site access|carry distance|compaction|stock length|target\/max/i.test(label)) {
    return false;
  }
  return false;
}

function buildIssues(
  input: ComposeBuilderReviewInput
): {
  assumptions: BuilderReviewIssue[];
  checks: BuilderReviewIssue[];
  improvements: BuilderReviewImprovement[];
} {
  const retainingWallOnly =
    input.workAreas.length > 0 &&
    input.workAreas.every((wa) => wa.type === "retaining_wall");
  const fenceOnly =
    input.workAreas.length > 0 &&
    input.workAreas.every((wa) => wa.type === "fence");
  const assumptionKeys = new Set<string>();
  const assumptions: BuilderReviewIssue[] = [];
  for (const row of input.estimate.assumptions) {
    if (!isUserFacingEstimateAssumption(row)) continue;
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
    const actionable = "_actionable" in check ? (check as BuilderReviewIssue & { _actionable: boolean })._actionable : true;
    if (!actionable) continue;
    if (!isHighValueBuilderImprovement(check.label, retainingWallOnly, fenceOnly)) continue;
    improvements.push({
      id: `improve:${check.id}`,
      label: check.label,
      reason: "Could improve estimate accuracy",
      editSection: check.editSection === "advanced" ? "refine" : check.editSection,
    });
  }

  if (improvements.length < MAX_IMPROVEMENTS && !retainingWallOnly && !fenceOnly) {
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
  } else if (improvements.length < MAX_IMPROVEMENTS) {
    for (const assumption of assumptions) {
      if (improvements.length >= MAX_IMPROVEMENTS) break;
      if (!isHighValueBuilderImprovement(assumption.label, true, fenceOnly)) continue;
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
      if (
        req.componentKey === RW_EXCAVATION_COMPONENT &&
        (commercialComponentKeys.has(RW_EXCAVATION_LABOUR_COMPONENT) ||
          commercialComponentKeys.has(RW_EXCAVATION_SUBCONTRACT_COMPONENT))
      ) {
        return false;
      }
      if (
        commercialComponentKeys.has(FENCE_POSTS_LM_COMPONENT) &&
        (req.componentKey === FENCE_POSTS_EA_COMPONENT ||
          req.componentKey === FENCE_GATE_POSTS_EA_COMPONENT)
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
        takeoffCollapsedByDefault:
          meta.type === "retaining_wall" || meta.type === "fence",
        takeoffTitle:
          meta.type === "retaining_wall" || meta.type === "fence"
            ? "Takeoff details"
            : "Planning takeoff",
        groupNotes: [],
        lineGroups: [],
      };
    });

    const areaTakeoff =
      meta.type === "deck" ||
      meta.type === "retaining_wall" ||
      meta.type === "fence"
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
    const hasDetailedFramingMaterials = priced.some(
      (line) =>
        line.componentKey === DECK_JOISTS_COMPONENT_KEY ||
        line.componentKey === DECK_BEARERS_COMPONENT_KEY ||
        line.componentKey === DECK_RIM_FRAMING_COMPONENT_KEY
    );
    const unavailableHint =
      meta.type === "deck" &&
      areaTakeoff.length === 0 &&
      hasFramingAllowance &&
      !hasDetailedFramingMaterials
        ? DECK_PHYSICAL_TAKEOFF_UNAVAILABLE_HINT
        : null;

    categories = attachTakeoff(
      categories,
      areaTakeoff,
      meta.type,
      unavailableHint
    );

    const pileNote = pileProcurementGroupNote(requirements, meta.id);
    if (pileNote) {
      categories = categories.map((cat) => {
        if (cat.id !== "MATERIALS") return cat;
        const stockLines = cat.lines.filter(
          (line) =>
            Boolean(line.componentKey) &&
            isRwTimberPileStockComponent(line.componentKey!)
        );
        const remaining = cat.lines.filter(
          (line) =>
            !line.componentKey ||
            !isRwTimberPileStockComponent(line.componentKey)
        );
        const group = buildPileLineGroup(requirements, meta.id, stockLines);
        return {
          ...cat,
          lines: remaining,
          groupNotes: [...cat.groupNotes, pileNote],
          lineGroups: group ? [...cat.lineGroups, group] : cat.lineGroups,
        };
      });
    }

    const sleeperPostGroup = buildSleeperPostLineGroup(
      requirements,
      meta.id,
      priced.filter(
        (line) => line.componentKey === RW_SLEEPER_POSTS_PROCURE_COMPONENT
      )
    );
    if (sleeperPostGroup) {
      categories = categories.map((cat) => {
        if (cat.id !== "MATERIALS") return cat;
        const remaining = cat.lines.filter(
          (line) => line.componentKey !== RW_SLEEPER_POSTS_PROCURE_COMPONENT
        );
        return {
          ...cat,
          lines: remaining,
          lineGroups: [...cat.lineGroups, sleeperPostGroup],
        };
      });
    }

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
  const plantCost = round2(
    lines
      .filter((item) => mapLineCategory(item) === "PLANT")
      .reduce((sum, item) => sum + item.recommendedCost, 0)
  );
  const wasteCost = round2(
    lines
      .filter((item) => mapLineCategory(item) === "WASTE")
      .reduce((sum, item) => sum + item.recommendedCost, 0)
  );
  const categorySummary = CATEGORY_ORDER.map((id) => {
    let cost = 0;
    if (id === "MATERIALS") {
      cost = round2((categoryRollup.materials?.cost ?? 0) - wasteCost);
    } else if (id === "LABOUR") cost = categoryRollup.labour?.cost ?? 0;
    else if (id === "SUBCONTRACT") cost = categoryRollup.subcontractor?.cost ?? 0;
    else if (id === "PLANT") cost = plantCost;
    else if (id === "WASTE") cost = wasteCost;
    else if (id === "ALLOWANCES") {
      cost = round2(
        (categoryRollup.allowance?.cost ?? 0) +
          (categoryRollup.mixed?.cost ?? 0) -
          plantCost
      );
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
      marginSourceLabel:
        "Target GM comes from company Rates defaults. Quotr starter is 20% if unset.",
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
