import type { QualityLevel } from "@/components/assistant/types";
import type { OrganisationRate, OrganisationSettings } from "@/components/setup/types";
import type { MaterialBuildUpEntry } from "@/lib/estimate/material-buildup-meta";
import type { MaterialRateResolution } from "@/lib/estimate/material-rate-pricing";
import type {
  PricingOwner,
  PricingSource,
} from "@/lib/estimate/pricing-ownership";
import type {
  AllowanceMinimumMeta,
  LabourMinimumMeta,
  QuantityBasis,
} from "@/lib/estimate/line-item-metadata";
import type { RateSourceType } from "@/lib/estimate/rate-source-labels";
import type { AssumptionMetadata } from "@/lib/estimate/assumption-metadata";
import type { MaterialWastageSettings } from "@/lib/settings/material-wastage";
import type {
  EstimateSellAuthority,
  SellAuthority,
} from "@/lib/commercial-engine/core/cost-first-authority";
import type { DeckSubstructureGroupReconciliation } from "@/lib/estimate/deck-structure";
import type { EstimateRequirement } from "@/lib/estimate/requirements";
import type { CommercialComponentSelection } from "@/lib/estimate/component-commercial-selection";

export type EstimateProject = {
  id: string;
  qualityLevel: QualityLevel | null;
};

export type EstimateWorkArea = {
  id: string;
  type: string;
  name: string;
  summary?: string | null;
  sort_order: number;
};

export type EstimateFact = {
  key: string;
  work_area_id: string | null;
  value: unknown;
  source?: string | null;
};

export type EstimateConstraint = {
  key: string;
  label: string;
  value: unknown;
};

export type EstimateContext = {
  project: EstimateProject;
  confirmedWorkAreas: EstimateWorkArea[];
  facts: EstimateFact[];
  constraints: EstimateConstraint[];
  organisationSettings: OrganisationSettings | null;
  materialWastageSettings: MaterialWastageSettings | null;
  rates: OrganisationRate[];
};

export type LineItemCategory =
  | "labour"
  | "materials"
  | "subcontractor"
  | "allowance"
  | "contingency"
  | "mixed";

export type LineItemCostComponents = {
  labourCost?: number;
  materialCost?: number;
  subcontractorCost?: number;
  allowanceCost?: number;
};

export type EstimateLineItemInput = {
  workAreaId: string;
  workAreaName: string;
  label: string;
  category: LineItemCategory;
  costLow: number;
  costHigh: number;
  sellLow: number;
  sellHigh: number;
  recommendedCost: number;
  recommendedSell: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent: number;
  quantity?: number;
  unit?: string;
  labourHours?: number;
  productivityRate?: number;
  productivityUnit?: string;
  rateSource: string;
  rateSourceType?: RateSourceType;
  itemKey?: string;
  /**
   * Stable semantic component identity for REQ-4A mapping (e.g. decking.surface).
   * Not the rate/item key. Persisted on estimate_line_items when present.
   */
  componentKey?: string;
  costRate?: number;
  sellRate?: number;
  sellDerivedFromMargin?: boolean;
  /** Current sell authority (distinct from rateSource). */
  sellAuthority?: SellAuthority;
  notes?: string;
  /** Short builder-facing material identity; preferred over long notes in Builder Review. */
  identitySummary?: string;
  materialBuildUp?: MaterialBuildUpEntry;
  materialBuildUps?: MaterialBuildUpEntry[];
  materialRateResolution?: MaterialRateResolution;
  sortOrder: number;
  pricingOwner?: PricingOwner;
  scopeKey?: string;
  overlapGroup?: string;
  includedInTotal?: boolean;
  clientVisible?: boolean;
  pricingSource?: PricingSource;
  quantityBasis?: QuantityBasis;
  labourMinimum?: LabourMinimumMeta;
  allowanceMinimum?: AllowanceMinimumMeta;
  costComponents?: LineItemCostComponents;
};

export type CalculatorResult = {
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  exclusions: string[];
  confidence: number;
  assumptionMetadata?: AssumptionMetadata;
  /**
   * Optional EstimateRequirement envelope (REQ-1).
   * Omit or [] is valid. Not commercial authority. Production calculators
   * must not emit until REQ-2 / REQ-3.
   */
  requirements?: readonly EstimateRequirement[];
  /**
   * DECK-1B — shadow structural group reconciliation vs legacy substructure package.
   * Diagnostics only; legacy package remains money authority.
   */
  deckSubstructureReconciliation?: DeckSubstructureGroupReconciliation;
};

export type EstimateResult = {
  costLow: number;
  costHigh: number;
  sellLow: number;
  sellHigh: number;
  recommendedCost: number;
  recommendedSell: number;
  grossProfit: number;
  marginPercent: number;
  markupPercent: number;
  confidence: number;
  rateSourceSummary: string;
  assumptions: string[];
  missingInfo: string[];
  exclusions: string[];
  assumptionMetadata?: AssumptionMetadata;
  lineItems: EstimateLineItemInput[];
  /**
   * How this generation's recommended sell was obtained.
   * Default `line_resolved_sells`. Project GM rewrite → `project_target_margin`.
   */
  estimateSellAuthority?: EstimateSellAuthority;
  /**
   * Project-level collected requirements after normalisation.
   * Empty until REQ-2 / REQ-3 emit. Never added on top of estimate money.
   */
  requirements?: readonly EstimateRequirement[];
  /**
   * REQ-4B — per-component commercial source after authority composition.
   * Policy remains in the registry; this is the generation active source.
   */
  commercialSelections?: readonly CommercialComponentSelection[];
  /**
   * Pre-composition calculator lines for shadow reconciliation / fallback compare.
   * Not persisted as a second money set.
   */
  legacyCommercialCandidates?: readonly EstimateLineItemInput[];
};

export type ProductivityRate = {
  key: string;
  label: string;
  hoursPerUnit: number;
  unit: string;
  sourceLabel: string;
};

export type ResolvedRate = {
  costRate: number;
  sellRate: number;
  costRateLow: number;
  costRateHigh: number;
  sellRateLow: number;
  sellRateHigh: number;
  unit: string;
  sourceLabel: string;
  sourceType: RateSourceType;
  itemKey: string;
  /** @deprecated Prefer sellAuthority === "derived_from_gross_margin" */
  sellDerivedFromMargin: boolean;
  /** COMMERCIAL-P0 — how unit sell was obtained */
  sellAuthority: SellAuthority;
  /** Org/default GM when sell was derived; null for legacy/explicit */
  grossMarginPercent: number | null;
  isLegacyPairedRate: boolean;
  isExplicitSellOverride: boolean;
};

export type ResolvedLabourRate = {
  costRate: number;
  sellRate: number;
  sourceLabel: string;
  sourceType: RateSourceType;
  itemKey?: string;
  /** @deprecated Prefer sellAuthority === "derived_from_gross_margin" */
  sellDerivedFromMargin: boolean;
  sellAuthority: SellAuthority;
  grossMarginPercent: number | null;
  isLegacyPairedRate: boolean;
  isExplicitSellOverride: boolean;
};

export type WorkAreaCalculator = (
  context: EstimateContext,
  workArea: EstimateWorkArea
) => CalculatorResult;
