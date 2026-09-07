/**
 * WA-BATHROOM-07 — mature Bathroom commercial authority.
 *
 * Cost-first: physical quantity or explicit allowance → resolve cost source →
 * commercial engine owns sell. Bathroom must not calculate a Work-Area-specific
 * margin or restore $18k/$25k package money on a canonical job_scope path.
 *
 * Historical Bathrooms without `bathroom.job_scope` may still use LEGACY ONLY
 * lumps. Do not delete those blocks; do not reinterpret snapshots.
 */

import type { EstimateLineItemInput } from "@/lib/estimate/types";

export const BATHROOM_MATURE_FALLBACK_PROHIBITION_STATEMENT =
  "Mature Bathroom path: money is physical quantity × resolved rate, or an explicit allowance/PC. $18k/$25k package, scope.bathroom.m2, mixed tiling, generic carpentry, fixture bundle, 8h fixture install, leftover floor-prep lump, coordination lump, and legacy trade formulas are forbidden.";

/**
 * Legacy calculator scopeKeys that must never emit on a canonical job_scope path.
 * Mature plumbing/electrical/waterproofing reuse sibling names (`bathroom.plumbing`)
 * with hybrid/install identities — those are allowed. These keys are leftover-only.
 */
export const MATURE_BATHROOM_FORBIDDEN_SCOPE_KEYS = [
  "bathroom.materials_package",
  "bathroom.coordination",
  "bathroom.floor_prep",
  "bathroom.carpentry_prep",
  "bathroom.tiling",
  "bathroom.fixtures",
  "bathroom.fixture_install",
  "bathroom.underfloor_heating",
  "bathroom.ventilation",
  "bathroom.wall_lining",
  "bathroom.wall_lining_install",
  "bathroom.demolition",
] as const;

export const MATURE_BATHROOM_FORBIDDEN_ITEM_KEYS = [
  "scope.bathroom.m2",
  "bathroom.tiling.m2",
  "bathroom.fixtures.allowance",
  "bathroom.waterproofing.allowance",
  "bathroom.demolition_hours_allowance",
] as const;

const FORBIDDEN_LABEL =
  /bathroom materials\/finishes allowance|project coordination and site allowance|floor levelling\/substrate prep allowance|bathroom carpentry\/prep labour|fixtures allowance|fixture installation labour|underfloor heating allowance|extractor fan allowance|wall lining install labour|demolition\/strip-out|^tiling allowance$/i;

export type MatureBathroomLegacyViolation = {
  reason: string;
  label: string;
  scopeKey?: string;
  itemKey?: string;
  recommendedCost?: number;
};

export function findMatureBathroomLegacyViolations(
  lineItems: readonly EstimateLineItemInput[]
): MatureBathroomLegacyViolation[] {
  const violations: MatureBathroomLegacyViolation[] = [];
  for (const item of lineItems) {
    const scopeKey = item.scopeKey;
    const itemKey = item.itemKey;
    const cost = item.recommendedCost ?? 0;
    if (
      scopeKey &&
      (MATURE_BATHROOM_FORBIDDEN_SCOPE_KEYS as readonly string[]).includes(scopeKey)
    ) {
      violations.push({
        reason: `forbidden scopeKey ${scopeKey}`,
        label: item.label,
        scopeKey,
        itemKey,
        recommendedCost: cost,
      });
    }
    if (
      itemKey &&
      (MATURE_BATHROOM_FORBIDDEN_ITEM_KEYS as readonly string[]).includes(itemKey)
    ) {
      violations.push({
        reason: `forbidden itemKey ${itemKey}`,
        label: item.label,
        scopeKey,
        itemKey,
        recommendedCost: cost,
      });
    }
    if (FORBIDDEN_LABEL.test(item.label)) {
      violations.push({
        reason: `legacy label ${item.label}`,
        label: item.label,
        scopeKey,
        itemKey,
        recommendedCost: cost,
      });
    }
    if (cost >= 17999 && cost <= 18001) {
      violations.push({
        reason: "$18k package cost",
        label: item.label,
        scopeKey,
        itemKey,
        recommendedCost: cost,
      });
    }
    if (cost >= 24999 && cost <= 25001) {
      violations.push({
        reason: "$25k package sell/cost",
        label: item.label,
        scopeKey,
        itemKey,
        recommendedCost: cost,
      });
    }
  }
  return violations;
}

/**
 * PC vs company-rate chip rule (WA-BATHROOM-07).
 *
 * Generic fixture / tile-supply PCs stay a PC family (not a merchant SKU).
 * Company/project rate on the same PC key may override the dollar amount.
 * Builder Review shows one chip:
 *   - Quotr PC catalogue → "PC allowance"
 *   - Company rate on that PC key → "Your company rate" / "Company rate"
 * The line name still says PC allowance. Never two chips. Never convert a
 * generic PC into a specific-material catalogue row.
 */
export const BATHROOM_PC_OVERRIDE_RULE =
  "Company/project rate on a PC key overrides the PC dollar amount. The line remains a PC allowance (generic product family). The single rate chip is PC allowance for Quotr catalogue, or Your company rate when a company rate exists on that key. Do not show both. Do not treat the override as a merchant SKU.";
