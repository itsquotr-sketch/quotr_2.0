/**
 * CEILINGS WA-06 — Builder Review Portion-first grouping.
 *
 * Work Area → Ceiling Portion → Framing / Lining / Labour / Fixings /
 * Insulation / Bulkheads / Checks. Presentation only.
 */

import { round2 } from "@/lib/estimate/facts";
import type { EstimateFact } from "@/lib/estimate/types";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import {
  ceilingRequirementComponentId,
  ceilingRequirementNestedItemId,
} from "@/lib/estimate/ceilings-physical";
import {
  CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION,
  hasCanonicalCeilingsPortions,
  isUnsupportedCeilingBulkhead,
  resolveCeilingsPortions,
  type CeilingPortion,
} from "@/lib/estimate/ceilings-portions";
import {
  CEILINGS_EDGE_OFFSET_ASSUMPTION_STATEMENT,
  CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT,
  CEILINGS_PLASTERBOARD_SHEET_SIZE_ASSUMPTION_STATEMENT,
  CEILINGS_SUSPENSION_SPACING_ASSUMPTION_STATEMENT,
  CEILINGS_TIMBER_SPACING_ASSUMPTION_STATEMENT,
} from "@/lib/estimate/ceilings-information-contract";
import {
  ceilingAllowsDisclosedPlasterboardLayers,
  ceilingAllowsDisclosedPlasterboardSheetSize,
} from "@/lib/estimate/ceilings-disclosed-lining";
import { CEILING_TIMBER_LINING_EDGE_GAP_ASSUMPTION } from "@/lib/estimate/ceilings-lining";
import {
  CEILINGS_BUILDER_REVIEW_PARTIAL_MESSAGE,
} from "@/lib/estimate/ceilings-quote-readiness";
import { CEILINGS_PARTIAL_ESTIMATE_MESSAGE } from "@/lib/estimate/ceilings-identities";
import type {
  BuilderReviewCategoryGroup,
  BuilderReviewLineGroup,
  BuilderReviewPricedLine,
  BuilderReviewPortionGroup,
} from "@/lib/assistant/builder-review/types";

export function formatCeilingStructureFamily(
  family: CeilingPortion["structure"]["family"]
): string | null {
  if (family === "existing_framing") return "Existing framing";
  if (family === "timber_direct_fix") return "Timber direct-fix";
  if (family === "steel_direct_fix") return "Steel direct-fix";
  if (family === "suspended_steel") return "Suspended steel";
  if (family === "tile_and_grid") return "Tile & grid";
  return null;
}

export function formatCeilingLiningSummary(portion: CeilingPortion): string | null {
  const lining = portion.lining.family;
  if (lining === "plasterboard") {
    const product = portion.lining.plasterboard_product;
    const productLabel =
      product === "standard"
        ? "Standard"
        : product === "aqualine"
          ? "Aqualine"
          : product === "fyreline"
            ? "Fyreline"
            : product === "other"
              ? "specified"
              : "plasterboard";
    const thickness =
      portion.lining.thickness_mm === 10
        ? "10mm"
        : portion.lining.thickness_mm === 13
          ? "13mm"
          : portion.lining.thickness_mm === "other"
            ? "Specified"
            : null;
    return [thickness, productLabel, "plasterboard"].filter(Boolean).join(" ");
  }
  if (lining === "plywood") {
    return portion.lining.plywood_spec?.trim() || "Plywood lining";
  }
  if (lining === "timber_lined") return "Timber lining";
  if (lining === "tile_and_grid") {
    const size = portion.lining.tile?.size;
    return size ? `Tile & grid ${size.replace("x", "×")}` : "Tile & grid";
  }
  return null;
}

export function formatCeilingPortionSummary(portion: CeilingPortion): string {
  const area =
    portion.geometry.area_m2 != null
      ? `${portion.geometry.area_m2.toFixed(1)} m²`
      : portion.geometry.length_m != null && portion.geometry.width_m != null
        ? `${portion.geometry.length_m} × ${portion.geometry.width_m} m`
        : null;
  const geometry =
    portion.geometry.length_m != null && portion.geometry.width_m != null
      ? `${portion.geometry.length_m} × ${portion.geometry.width_m} m`
      : null;
  return [
    area,
    geometry && geometry !== area ? geometry : null,
    portion.lining.family === "tile_and_grid"
      ? null
      : formatCeilingStructureFamily(portion.structure.family),
    formatCeilingLiningSummary(portion),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function formatCeilingPortionLabel(
  portion: CeilingPortion,
  index: number
): string {
  return portion.label?.trim() || `Ceiling ${index + 1}`;
}

function lineIsPricingRequired(line: BuilderReviewPricedLine): boolean {
  return (
    line.category === "PRICING_REQUIRED" ||
    line.rateLabel === "Rate required" ||
    line.rateLabel === "Pricing Required" ||
    /pricing required/i.test(line.supporting ?? "")
  );
}

function formatMoneyOrPr(
  line: BuilderReviewPricedLine,
  kind: "cost" | "sell" = "cost"
): string {
  if (lineIsPricingRequired(line)) return "Pricing Required";
  const value = kind === "sell" ? line.recommendedSell : line.recommendedCost;
  return `$${value.toFixed(2)}`;
}

function classifyCeilingBucket(
  line: BuilderReviewPricedLine
): "framing" | "lining" | "labour" | "fixings" | "insulation" | "bulkhead" | "finishing" | "other" {
  const key = (line.componentKey ?? line.itemKey ?? "").toLowerCase();
  const componentId = line.sourceLine.componentId;
  if (
    key.includes("ceilings.finish.stopping") ||
    key.includes("ceilings.finish.painting") ||
    key.includes("finish.stopping") ||
    key.includes("finish.painting") ||
    key === "painting.material.m2" ||
    key === "painting.labour_hours_per_m2"
  ) {
    return "finishing";
  }
  if (componentId || key.includes("bulkhead")) return "bulkhead";
  if (key.includes("fixings")) return "fixings";
  if (key.includes("insulation")) {
    return line.category === "LABOUR" ? "labour" : "insulation";
  }
  if (
    key.includes("tile_grid") ||
    key.includes("lining.") ||
    key.includes("plasterboard") ||
    key.includes("plywood") ||
    key.includes("timber_lining") ||
    key.includes("tile.install")
  ) {
    return line.category === "LABOUR" ? "labour" : "lining";
  }
  if (
    key.includes("framing") ||
    key.includes("suspension") ||
    key.includes("steel.") ||
    key.includes("timber_framing")
  ) {
    return line.category === "LABOUR" ? "labour" : "framing";
  }
  if (line.category === "LABOUR") return "labour";
  return "other";
}

function lineBelongsToPortion(
  line: BuilderReviewPricedLine,
  portionId: string
): boolean {
  if (line.sourceLine.nestedItemId === portionId) return true;
  if (line.sourceLine.contributingNestedItemIds?.includes(portionId)) {
    return true;
  }
  const fromLabel = line.label.split(" — ")[0]?.trim();
  return Boolean(fromLabel && fromLabel.length > 0 && line.label.startsWith(fromLabel));
}

function supportingForLine(line: BuilderReviewPricedLine): string {
  const parts = [
    line.quantity != null
      ? `${Number.isInteger(line.quantity) ? line.quantity : line.quantity.toFixed(1)}${
          line.unit ? ` ${line.unit}` : ""
        }`
      : null,
    line.labourHours != null ? `${line.labourHours} person-hours` : null,
    line.supporting,
    lineIsPricingRequired(line) ? "Pricing Required" : null,
  ].filter(Boolean);
  return [...new Set(parts)].join(" · ");
}

function lineIsSharedCommercial(line: BuilderReviewPricedLine): boolean {
  return (line.sourceLine.contributingNestedItemIds?.length ?? 0) > 1;
}

function makeGroup(
  id: string,
  label: string,
  secondary: string,
  children: readonly BuilderReviewPricedLine[]
): BuilderReviewLineGroup | null {
  if (children.length === 0) return null;
  const pricingRequired = children.some(lineIsPricingRequired);
  const priced = children.filter((row) => !lineIsPricingRequired(row));
  const cost = round2(
    priced.reduce((sum, row) => sum + row.recommendedCost, 0)
  );
  return {
    id,
    label,
    recommendedCost: cost,
    supporting: children.map(supportingForLine).filter(Boolean).join(" · ") || null,
    secondary,
    itemKey: children[0]?.itemKey ?? null,
    showChangeMaterial: false,
    rateContext: pricingRequired ? "Pricing Required" : null,
    pricingRequired,
    costHidden: children.length > 0 && children.every((row) => row.recommendedCost === 0) && !pricingRequired,
    children,
  };
}

function builderFacingAssumptions(portion: CeilingPortion): string[] {
  const out: string[] = [];
  const family = portion.structure.family;
  const lining = portion.lining.family;
  if (
    lining === "plasterboard" &&
    ceilingAllowsDisclosedPlasterboardSheetSize(portion) &&
    portion.lining.sheet_length_mm == null &&
    portion.lining.sheet_width_mm == null
  ) {
    out.push(
      `Assumed: ${CEILINGS_PLASTERBOARD_SHEET_SIZE_ASSUMPTION_STATEMENT.replace(/^Assumes\s+/i, "").replace(/\.$/, "")}`
    );
  }
  if (
    lining === "plasterboard" &&
    ceilingAllowsDisclosedPlasterboardLayers(portion) &&
    portion.lining.layers == null
  ) {
    out.push(
      `Assumed: ${CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT.replace(/^Assumes\s+/i, "").replace(/\.$/, "")}`
    );
  } else if (
    lining === "plywood" &&
    (portion.lining.layers == null || portion.lining.layers === 1)
  ) {
    out.push(
      `Assumed: ${CEILINGS_LINING_LAYERS_ASSUMPTION_STATEMENT.replace(/^Assumes\s+/i, "").replace(/\.$/, "")}`
    );
  }
  if (family === "timber_direct_fix" && portion.structure.timber?.spacing_mm === 450) {
    out.push(`Assumed: 450 mm timber framing centres`);
  }
  if (family === "suspended_steel") {
    if (
      portion.structure.suspended?.max_spacing_m == null ||
      portion.structure.suspended.max_spacing_m === 1.2
    ) {
      out.push(CEILINGS_SUSPENSION_SPACING_ASSUMPTION_STATEMENT.replace(/^Assuming\s+/i, "Assumed: "));
    }
    if (
      portion.structure.suspended?.edge_offset_m == null ||
      portion.structure.suspended.edge_offset_m === 0.2
    ) {
      out.push(CEILINGS_EDGE_OFFSET_ASSUMPTION_STATEMENT.replace(/^Assuming\s+/i, "Assumed: "));
    }
  }
  if (lining === "timber_lined") {
    out.push(CEILING_TIMBER_LINING_EDGE_GAP_ASSUMPTION);
  }
  if (portion.has_bulkheads === true && portion.bulkheads.length > 0) {
    if (portion.bulkheads.some((row) => !isUnsupportedCeilingBulkhead(row))) {
      out.push(
        CEILINGS_BULKHEAD_TOPOLOGY_ASSUMPTION.replace(/^Assumes\s+/i, "Assumed: ")
      );
    }
  }
  const waste = portion.lining.family === "plasterboard" || lining === "plywood" || lining === "tile_and_grid";
  if (waste) {
    out.push("Sheet / tile purchase includes the configured wastage allowance.");
  }
  return out;
}

function quantityFromRequirement(
  requirements: readonly EstimateRequirement[],
  portionId: string,
  componentKey: string
): { qty: number | null; unit: string | null; spec: string | null } {
  const match = requirements.find((row) => {
    if (row.componentKey !== componentKey) return false;
    return ceilingRequirementNestedItemId(row) === portionId;
  });
  if (!match) return { qty: null, unit: null, spec: null };
  if (match.kind === "material") {
    return {
      qty: match.purchaseQuantity ?? match.baseQuantity,
      unit: match.purchaseUnit ?? match.baseUnit,
      spec: match.specification ?? match.description,
    };
  }
  if (match.kind === "labour") {
    return {
      qty: match.productivityBasis.quantity,
      unit: match.productivityBasis.unit,
      spec: match.description,
    };
  }
  return { qty: null, unit: null, spec: match.description };
}

export function applyCeilingsReviewGroups(params: {
  readonly categories: BuilderReviewCategoryGroup[];
  readonly priced: readonly BuilderReviewPricedLine[];
  readonly facts?: readonly EstimateFact[];
  readonly workAreaId: string | null;
  readonly workAreaName: string;
  readonly requirements: readonly EstimateRequirement[];
  readonly missingInfo: readonly string[];
  readonly briefText?: string | null;
}): {
  readonly categories: BuilderReviewCategoryGroup[];
  readonly portionGroups: readonly BuilderReviewPortionGroup[];
  readonly sharedLineGroups: readonly BuilderReviewLineGroup[];
  readonly partialEstimateLabel: string | null;
  readonly resolvedSubtotalLabel: string | null;
} {
  const workAreaId = params.workAreaId;
  const nested =
    workAreaId != null &&
    params.facts != null &&
    hasCanonicalCeilingsPortions(params.facts, workAreaId);

  if (!nested) {
    return {
      categories: params.categories,
      portionGroups: [],
      sharedLineGroups: [],
      partialEstimateLabel: null,
      resolvedSubtotalLabel: null,
    };
  }

  const resolved = resolveCeilingsPortions({
    facts: params.facts!,
    workAreaId,
    briefText: params.briefText,
  });
  const portions = resolved.portions;
  const waRequirements = params.requirements.filter(
    (row) => !workAreaId || row.workAreaId === workAreaId
  );

  const portionGroups: BuilderReviewPortionGroup[] = portions.map(
    (portion, index) => {
      const owned = params.priced.filter((line) => {
        if (lineIsSharedCommercial(line)) {
          return false;
        }
        if (line.sourceLine.nestedItemId === portion.id) return true;
        if (
          line.sourceLine.nestedItemId &&
          line.sourceLine.nestedItemId !== portion.id
        ) {
          return false;
        }
        if (line.sourceLine.componentId) {
          return portion.bulkheads.some(
            (bh) => rowMatchesBulkhead(line, portion.id, bh.id)
          );
        }
        const reqMatch = waRequirements.some(
          (req) =>
            ceilingRequirementNestedItemId(req) === portion.id &&
            (req.componentKey === line.componentKey ||
              req.componentKey === line.itemKey)
        );
        if (reqMatch) return true;
        const labelPrefix = formatCeilingPortionLabel(portion, index);
        return line.label.startsWith(`${labelPrefix} `) ||
          line.label.startsWith(`${labelPrefix} —`);
      });

      const sharedForPortion = params.priced.filter(
        (line) =>
          lineIsSharedCommercial(line) &&
          (line.sourceLine.contributingNestedItemIds?.includes(portion.id) ||
            line.sourceLine.nestedItemId === portion.id)
      );

      const contributionLines = sharedForPortion.map((line) => {
        const qty = quantityFromRequirement(
          waRequirements,
          portion.id,
          line.componentKey ?? line.itemKey ?? ""
        );
        return {
          ...line,
          recommendedCost: 0,
          recommendedSell: 0,
          quantity: qty.qty ?? line.quantity,
          unit: qty.unit ?? line.unit,
          supporting: [
            qty.qty != null
              ? `${Number.isInteger(qty.qty) ? qty.qty : qty.qty.toFixed(1)}${
                  qty.unit ? ` ${qty.unit}` : line.unit ? ` ${line.unit}` : ""
                }`
              : null,
            "Shared commercial line",
          ]
            .filter(Boolean)
            .join(" · "),
        };
      });

      const framing = owned.filter((row) => classifyCeilingBucket(row) === "framing");
      const lining = [
        ...owned.filter((row) => classifyCeilingBucket(row) === "lining"),
        ...contributionLines.filter((row) => classifyCeilingBucket(row) === "lining"),
      ];
      const labour = owned.filter((row) => classifyCeilingBucket(row) === "labour");
      const fixings = [
        ...owned.filter((row) => classifyCeilingBucket(row) === "fixings"),
        ...contributionLines.filter((row) => classifyCeilingBucket(row) === "fixings"),
      ];
      const insulation = [
        ...owned.filter((row) => classifyCeilingBucket(row) === "insulation"),
        ...contributionLines.filter(
          (row) => classifyCeilingBucket(row) === "insulation"
        ),
      ];
      const bulkheadLines = owned.filter(
        (row) => classifyCeilingBucket(row) === "bulkhead"
      );
      const finishing = owned.filter(
        (row) => classifyCeilingBucket(row) === "finishing"
      );
      const other = owned.filter((row) => classifyCeilingBucket(row) === "other");

      const lineGroups: BuilderReviewLineGroup[] = [];
      const framingGroup = makeGroup(
        `ceilings-framing-${portion.id}`,
        "Framing",
        "Framing",
        framing
      );
      if (framingGroup) lineGroups.push(enrichFramingGroup(framingGroup, framing, labour));
      const liningGroup = makeGroup(
        `ceilings-lining-${portion.id}`,
        liningFamilyLabel(portion),
        "Lining",
        lining
      );
      if (liningGroup) lineGroups.push(liningGroup);
      const labourGroup = makeGroup(
        `ceilings-labour-${portion.id}`,
        "Labour",
        "Labour",
        labour
      );
      if (labourGroup) lineGroups.push(labourGroup);
      const fixingsGroup = makeGroup(
        `ceilings-fixings-${portion.id}`,
        "Fixings & Consumables",
        "Fixings",
        fixings
      );
      if (fixingsGroup) lineGroups.push(fixingsGroup);
      if (portion.finish.insulation_included === true) {
        const insulationGroup = makeGroup(
          `ceilings-insulation-${portion.id}`,
          portion.finish.insulation_type?.trim()
            ? `${portion.finish.insulation_type} insulation`
            : "Ceiling insulation",
          "Insulation",
          insulation
        );
        if (insulationGroup) {
          lineGroups.push(insulationGroup);
        } else {
          lineGroups.push({
            id: `ceilings-insulation-${portion.id}`,
            label: portion.finish.insulation_type?.trim()
              ? `${portion.finish.insulation_type}`
              : "Ceiling insulation",
            recommendedCost: 0,
            supporting: [
              portion.geometry.area_m2 != null
                ? `${portion.geometry.area_m2} m²`
                : null,
              "Pricing Required",
            ]
              .filter(Boolean)
              .join(" · "),
            secondary: "Insulation",
            itemKey: null,
            showChangeMaterial: false,
            rateContext: "Pricing Required",
            pricingRequired: true,
            children: [],
          });
        }
      }
      if (
        portion.finish.stopping_included === true ||
        portion.finish.painting_included === true
      ) {
        const finishingGroup = makeGroup(
          `ceilings-finishing-${portion.id}`,
          "Finishing",
          "Finishing",
          finishing
        );
        if (finishingGroup) {
          lineGroups.push(finishingGroup);
        } else {
          if (portion.finish.stopping_included === true) {
            lineGroups.push({
              id: `ceilings-finishing-stopping-${portion.id}`,
              label: "Stopping / plastering",
              recommendedCost: 0,
              supporting: "Pricing Required",
              secondary: "Finishing",
              itemKey: null,
              showChangeMaterial: false,
              rateContext: "Pricing Required",
              pricingRequired: true,
              children: [],
            });
          }
          if (portion.finish.painting_included === true) {
            lineGroups.push({
              id: `ceilings-finishing-painting-${portion.id}`,
              label: "Painting",
              recommendedCost: 0,
              supporting: "Pricing Required",
              secondary: "Finishing",
              itemKey: null,
              showChangeMaterial: false,
              rateContext: "Pricing Required",
              pricingRequired: true,
              children: [],
            });
          }
        }
      }
      for (const bulkhead of portion.bulkheads) {
        const bhLines = bulkheadLines.filter((row) =>
          rowMatchesBulkhead(row, portion.id, bulkhead.id)
        );
        const dims = [
          bulkhead.length_m != null ? `${bulkhead.length_m}m long` : null,
          bulkhead.depth_m != null ? `${bulkhead.depth_m}m deep` : null,
          bulkhead.height_m != null ? `${bulkhead.height_m}m high` : null,
        ]
          .filter(Boolean)
          .join(" × ");
        const liningArea =
          bulkhead.length_m != null &&
          bulkhead.depth_m != null &&
          bulkhead.height_m != null
            ? Number(
                (bulkhead.length_m * (bulkhead.depth_m + bulkhead.height_m)).toFixed(1)
              )
            : null;
        const assumption = isUnsupportedCeilingBulkhead(bulkhead)
          ? null
          : "standard wall-adjacent downstand with underside and one exposed vertical face";
        const bhGroup = makeGroup(
          `ceilings-bulkhead-${bulkhead.id}`,
          bulkhead.label?.trim() || "Bulkhead",
          "Bulkhead",
          bhLines
        );
        if (bhGroup) {
          lineGroups.push({
            ...bhGroup,
            supporting: [
              dims || null,
              liningArea != null ? `${liningArea}m² lining` : null,
              assumption,
              bhGroup.supporting,
            ]
              .filter(Boolean)
              .join(" · "),
          });
        }
      }
      const otherGroup = makeGroup(
        `ceilings-other-${portion.id}`,
        "Other",
        "Other",
        other
      );
      if (otherGroup) lineGroups.push(otherGroup);

      const areaLabel =
        portion.geometry.area_m2 != null
          ? `${portion.geometry.area_m2.toFixed(1)} m²`
          : null;

      return {
        id: portion.id,
        label: formatCeilingPortionLabel(portion, index),
        summary: formatCeilingPortionSummary(portion),
        areaLabel,
        lineGroups,
        assumptions: builderFacingAssumptions(portion),
      };
    }
  );

  const hasPr =
    params.priced.some(lineIsPricingRequired) ||
    params.missingInfo.some(
      (row) =>
        row === CEILINGS_PARTIAL_ESTIMATE_MESSAGE ||
        /pricing required/i.test(row)
    );

  const sharedMaterials = params.priced.filter(lineIsSharedCommercial);
  const seenShared = new Set<string>();
  const uniqueShared: BuilderReviewPricedLine[] = [];
  for (const line of sharedMaterials) {
    if (seenShared.has(line.id)) continue;
    seenShared.add(line.id);
    uniqueShared.push(line);
  }
  const sharedLineGroups: BuilderReviewLineGroup[] = [];
  for (const line of uniqueShared) {
    const ids = line.sourceLine.contributingNestedItemIds ?? [];
    const names = ids
      .map((id) => {
        const index = portions.findIndex((row) => row.id === id);
        return index >= 0
          ? formatCeilingPortionLabel(portions[index]!, index)
          : null;
      })
      .filter((row): row is string => Boolean(row));
    const includesCue =
      names.length > 0
        ? `Includes ${names.join(" + ")}`
        : ids.length > 1
          ? `Includes ${ids.length} ceiling portions`
          : null;
    const qty =
      line.quantity != null
        ? `${Number.isInteger(line.quantity) ? line.quantity : line.quantity.toFixed(1)}${
            line.unit ? ` ${line.unit}` : ""
          }`
        : null;
    const group = makeGroup(
      `ceilings-shared-${line.id}`,
      line.label.replace(/^.* — /, ""),
      "Shared materials",
      [line]
    );
    if (!group) continue;
    sharedLineGroups.push({
      ...group,
      supporting: [qty, includesCue, group.supporting]
        .filter(Boolean)
        .join(" · "),
      costHidden: false,
    });
  }

  return {
    categories: params.categories.map((cat) => ({
      ...cat,
      lines: [],
      lineGroups: [],
    })),
    portionGroups,
    sharedLineGroups,
    partialEstimateLabel: hasPr
      ? CEILINGS_BUILDER_REVIEW_PARTIAL_MESSAGE
      : null,
    resolvedSubtotalLabel: hasPr ? "Current priced total" : null,
  };
}

function liningFamilyLabel(portion: CeilingPortion): string {
  if (portion.lining.family === "tile_and_grid") return "Grid & tiles";
  if (portion.lining.family === "timber_lined") return "Timber lining";
  if (portion.lining.family === "plywood") return "Plywood lining";
  return "Lining";
}

function enrichFramingGroup(
  group: BuilderReviewLineGroup,
  framing: readonly BuilderReviewPricedLine[],
  labour: readonly BuilderReviewPricedLine[]
): BuilderReviewLineGroup {
  const framingLabour = labour.filter((row) => {
    const key = (row.componentKey ?? "").toLowerCase();
    return (
      key.includes("framing") ||
      key.includes("steel") ||
      key.includes("dropper") ||
      key.includes("clip")
    );
  });
  const extras = framingLabour
    .map((row) =>
      row.labourHours != null
        ? `Labour — ${row.label.replace(/^.* — /, "")}: ${row.labourHours} person-hours · ${formatMoneyOrPr(row)}`
        : null
    )
    .filter(Boolean);
  if (extras.length === 0) return group;
  return {
    ...group,
    supporting: [group.supporting, ...extras].filter(Boolean).join(" · "),
  };
}

function rowMatchesBulkhead(
  line: BuilderReviewPricedLine,
  portionId: string,
  bulkheadId: string
): boolean {
  if (line.sourceLine.componentId === bulkheadId) return true;
  const variant = `${portionId}::${bulkheadId}`;
  return (
    (line.sourceLine.overlapGroup ?? "").includes(variant) ||
    (line.sourceLine.notes ?? "").includes(bulkheadId)
  );
}

export function requirementQuantityForPortion(
  requirements: readonly EstimateRequirement[],
  portionId: string,
  componentKey: string
) {
  return quantityFromRequirement(requirements, portionId, componentKey);
}

void ceilingRequirementComponentId;
void lineBelongsToPortion;
void CEILINGS_TIMBER_SPACING_ASSUMPTION_STATEMENT;
