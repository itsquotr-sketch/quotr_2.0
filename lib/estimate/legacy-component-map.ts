/**
 * REQ-4A — requirement ↔ legacy estimate-line mapping.
 *
 * Mapping key is in-memory `componentKey` on the line, not description text
 * and not the rate/item key.
 */
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import type { EstimateLineItemInput } from "@/lib/estimate/types";

export type LegacyComponentMatch = {
  workAreaId: string;
  componentKey: string;
  lines: EstimateLineItemInput[];
};

export function findLegacyLinesForComponent(
  lineItems: readonly EstimateLineItemInput[],
  params: { workAreaId: string; componentKey: string }
): EstimateLineItemInput[] {
  return lineItems.filter(
    (item) =>
      item.workAreaId === params.workAreaId &&
      item.componentKey === params.componentKey
  );
}

export function findLegacyLinesForRequirement(
  lineItems: readonly EstimateLineItemInput[],
  requirement: Pick<EstimateRequirement, "workAreaId" | "componentKey">
): EstimateLineItemInput[] {
  return findLegacyLinesForComponent(lineItems, {
    workAreaId: requirement.workAreaId,
    componentKey: requirement.componentKey,
  });
}

export function isRateKeyUsedAsComponentKey(
  line: Pick<EstimateLineItemInput, "componentKey" | "itemKey">
): boolean {
  if (!line.componentKey || !line.itemKey) return false;
  return line.componentKey === line.itemKey;
}
