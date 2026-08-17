/**
 * Shared labour-hours shaping used by estimate labour lines and LabourRequirements.
 *
 * Formula is unchanged from createLabourLineItem:
 *   adjustedHours = round2(quantity × hoursPerUnit × adjustment × quality)
 *
 * baseHours is the same product before the Project Condition adjustmentFactor.
 * Quality/spec is not a Project Condition; it is included in both values because
 * the current calculator applies it inside the hours product.
 *
 * Do not reverse-engineer baseHours by dividing adjustedHours by a factor.
 */
import { round2 } from "@/lib/estimate/facts";

export type LabourHoursResult = {
  quantity: number;
  productivityHoursPerUnit: number;
  adjustmentFactor: number;
  qualityFactor: number;
  baseHours: number;
  adjustedHours: number;
};

export function shapeLabourHours(params: {
  quantity: number;
  productivityHoursPerUnit: number;
  adjustmentFactor?: number;
  qualityFactor?: number;
}): LabourHoursResult {
  const adjustmentFactor = params.adjustmentFactor ?? 1;
  const qualityFactor = params.qualityFactor ?? 1;
  const baseHours = round2(
    params.quantity * params.productivityHoursPerUnit * qualityFactor
  );
  const adjustedHours = round2(
    params.quantity *
      params.productivityHoursPerUnit *
      adjustmentFactor *
      qualityFactor
  );
  return {
    quantity: params.quantity,
    productivityHoursPerUnit: params.productivityHoursPerUnit,
    adjustmentFactor,
    qualityFactor,
    baseHours,
    adjustedHours,
  };
}
