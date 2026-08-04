/**
 * Shadow-parity fixtures — Batch 2B.4.
 * Expected results for intentional disagreements are declared on the fixture.
 */

import {
  adaptEstimateSellFromMarginToEngineRequest,
  adaptPricingDocumentToEngineRequest,
  adaptPricingItemToEngineRequest,
  adaptQuoteDocumentToEngineRequest,
} from "./pricing-adapter";
import {
  normalizeEngineOutputsFromRequest,
} from "./compare-legacy-result";
import { legacyClientProfitPreview, legacyClientUnroundedMargin } from "./legacy/legacy-client-calculations";
import {
  legacyDeriveSellFromCost,
  legacyRecalculateSellFromCost,
  legacySumEstimateLineTotals,
} from "./legacy/legacy-estimate";
import {
  legacyCalculatePricingDocument,
  legacyCreatePricingFromEstimateGstBug,
  legacyCreatePricingFromEstimateGstCorrected,
} from "./legacy/legacy-pricing-document";
import {
  legacyCalculatePricingItem,
  legacySellOnlyLumpProfit,
} from "./legacy/legacy-pricing-item";
import {
  legacyCalculateQuoteDocument,
  legacyCalculateQuoteItemTotal,
} from "./legacy/legacy-quote";
import type { ParityFixture } from "./types";

function freezeFixture(f: ParityFixture): ParityFixture {
  return Object.freeze({
    ...f,
    legacyInputs: Object.freeze({ ...f.legacyInputs }),
  });
}

export const PARITY_FIXTURES: readonly ParityFixture[] = Object.freeze([
  freezeFixture({
    fixtureId: "PAR-P-GP-001",
    legacyId: "LEG-P-01",
    kind: "pricing_item",
    description: "pricing item GP triad (computeProfitFields via totals)",
    scenarioRef: "CCS-001",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: { totalCost: 2310, totalSell: 2887.5 },
    run: () => {
      const legacy = legacyCalculatePricingItem({
        calculationMode: "lump_sum",
        totalCost: 2310,
        totalSell: 2887.5,
        itemType: "other",
      });
      const engineRequest = adaptPricingItemToEngineRequest({
        requestId: "par-gp-001",
        mode: "lump_sum",
        totalCost: 2310,
        totalSell: 2887.5,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: ["LEG-P-01 triad"],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-E-MARGIN-001",
    legacyId: "LEG-E-15",
    kind: "estimate",
    description: "recalculateSellFromCost @ 20%",
    scenarioRef: "CCS-001-margin",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.7",
    legacyInputs: { cost: 2310, margin: 20 },
    run: () => {
      const legacy = legacyRecalculateSellFromCost(2310, 20);
      const engineRequest = adaptEstimateSellFromMarginToEngineRequest({
        requestId: "par-e-margin",
        cost: 2310,
        marginPercent: 20,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: [],
      };
    },
  }),

  // --- Pricing items ---
  freezeFixture({
    fixtureId: "PAR-P-QTY-001",
    legacyId: "LEG-P-02",
    kind: "pricing_item",
    description: "quantity_rate 55 × 42/52.50",
    scenarioRef: "CCS-001",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: { mode: "quantity_rate", quantity: 55, unitCost: 42, unitSell: 52.5 },
    run: () => {
      const legacy = legacyCalculatePricingItem({
        calculationMode: "quantity_rate",
        quantity: 55,
        unitCost: 42,
        unitSell: 52.5,
      });
      const engineRequest = adaptPricingItemToEngineRequest({
        requestId: "par-qty-001",
        mode: "quantity_rate",
        quantity: 55,
        unitCost: 42,
        unitSell: 52.5,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: [],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-P-PROD-001",
    legacyId: "LEG-P-02",
    kind: "pricing_item",
    description: "productivity_labour 40 × 1.2 × 65/81.25",
    scenarioRef: "CCS-002",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: {
      mode: "productivity_labour",
      quantity: 40,
      productivityRate: 1.2,
      unitCost: 65,
      unitSell: 81.25,
    },
    run: () => {
      const legacy = legacyCalculatePricingItem({
        calculationMode: "productivity_labour",
        quantity: 40,
        productivityRate: 1.2,
        unitCost: 65,
        unitSell: 81.25,
      });
      const engineRequest = adaptPricingItemToEngineRequest({
        requestId: "par-prod-001",
        mode: "productivity_labour",
        quantity: 40,
        productivityRate: 1.2,
        unitCost: 65,
        unitSell: 81.25,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: [],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-P-LUMP-001",
    legacyId: "LEG-P-02",
    kind: "pricing_item",
    description: "known-cost lump 2800/3500",
    scenarioRef: "CCS-006",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: { mode: "lump_sum", totalCost: 2800, totalSell: 3500 },
    run: () => {
      const legacy = legacyCalculatePricingItem({
        calculationMode: "lump_sum",
        totalCost: 2800,
        totalSell: 3500,
        itemType: "allowance",
      });
      const engineRequest = adaptPricingItemToEngineRequest({
        requestId: "par-lump-001",
        mode: "lump_sum",
        totalCost: 2800,
        totalSell: 3500,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: [],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-P-SELLONLY-001",
    legacyId: "LEG-P-02",
    kind: "pricing_item",
    description: "sell-only lump — legacy 100% margin vs engine null",
    scenarioRef: "CCS-042",
    expectedClassification: "APPROVED_ENGINE_CORRECTION",
    commercialAuthority: "owner_commercial_decisions",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: { mode: "lump_sum", totalSell: 5000 },
    run: () => {
      const legacy = legacySellOnlyLumpProfit(5000);
      const engineRequest = adaptPricingItemToEngineRequest({
        requestId: "par-sellonly-001",
        mode: "lump_sum",
        totalSell: 5000,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: ["KM-SELL-ONLY-MARGIN"],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-P-ZERO-001",
    legacyId: "LEG-P-02",
    kind: "pricing_item",
    description: "zero-value no-charge lump",
    scenarioRef: "CCS-009",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: { mode: "lump_sum", totalCost: 0, totalSell: 0 },
    run: () => {
      const legacy = legacyCalculatePricingItem({
        calculationMode: "lump_sum",
        totalCost: 0,
        totalSell: 0,
        itemType: "allowance",
      });
      const engineRequest = adaptPricingItemToEngineRequest({
        requestId: "par-zero-001",
        mode: "lump_sum",
        totalCost: 0,
        totalSell: 0,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: [],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-P-MANUAL-SELL-001",
    legacyId: "LEG-P-02",
    kind: "pricing_item",
    description: "manual sell override on qty-rate (unit sell set)",
    scenarioRef: "CCS-024-glass",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: { quantity: 1, unitCost: 3000, unitSell: 3300 },
    run: () => {
      const legacy = legacyCalculatePricingItem({
        calculationMode: "quantity_rate",
        quantity: 1,
        unitCost: 3000,
        unitSell: 3300,
      });
      const engineRequest = adaptPricingItemToEngineRequest({
        requestId: "par-manual-sell",
        mode: "quantity_rate",
        quantity: 1,
        unitCost: 3000,
        unitSell: 3300,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: ["manual sell preserved as unit_sell input"],
      };
    },
  }),

  // --- Pricing documents ---
  freezeFixture({
    fixtureId: "PAR-P-DOC-001",
    legacyId: "LEG-P-03",
    kind: "pricing_document",
    description: "document aggregate mixed package + GST 15%",
    scenarioRef: "CCS-004",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: {
      items: [
        { total_cost: 1680, total_sell: 2100 },
        { total_cost: 660, total_sell: 825 },
      ],
      gstRate: 15,
    },
    run: () => {
      const items = [
        { total_cost: 1680, total_sell: 2100 },
        { total_cost: 660, total_sell: 825 },
      ];
      const legacy = legacyCalculatePricingDocument(items, 15);
      const engineRequest = adaptPricingDocumentToEngineRequest({
        requestId: "par-doc-001",
        items,
        gstRate: 15,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: [],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-P-DOC-MIXED-001",
    legacyId: "LEG-P-03",
    kind: "pricing_document",
    description: "mixed margins — blended from totals not averaged",
    scenarioRef: "CCS-024",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: {
      items: [
        { total_cost: 4000, total_sell: 5000 },
        { total_cost: 3000, total_sell: 3300 },
      ],
    },
    run: () => {
      const items = [
        { total_cost: 4000, total_sell: 5000 },
        { total_cost: 3000, total_sell: 3300 },
      ];
      const legacy = legacyCalculatePricingDocument(items, 15);
      const engineRequest = adaptPricingDocumentToEngineRequest({
        requestId: "par-mixed",
        items,
        gstRate: 15,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: ["KM-AVERAGED-MARGINS guard"],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-P-DOC-GST0-001",
    legacyId: "LEG-P-03",
    kind: "pricing_document",
    description: "non-15% GST (0%)",
    scenarioRef: "EXT-GST-0",
    expectedClassification: null,
    commercialAuthority: "owner_commercial_decisions",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: { gstRate: 0, sell: 10000 },
    run: () => {
      const items = [{ total_cost: 8000, total_sell: 10000 }];
      const legacy = legacyCalculatePricingDocument(items, 0);
      const engineRequest = adaptPricingDocumentToEngineRequest({
        requestId: "par-gst0",
        items,
        gstRate: 0,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: [],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-P-GST-BUG-C28",
    legacyId: "LEG-P-05",
    kind: "known_defect",
    description:
      "C-28 corrected (2B.5): createPricingFromEstimate uses organisation GST for insert and post-item recalc; historic bug path retained for evidence notes",
    scenarioRef: "CCS-022",
    expectedClassification: null,
    commercialAuthority: "owner_commercial_decisions",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.6",
    legacyInputs: { orgGstRate: 0, sell: 8000 },
    run: () => {
      const items = [{ total_cost: 6400, total_sell: 8000 }];
      const historicBug = legacyCreatePricingFromEstimateGstBug({
        items,
        orgGstRate: 0,
      });
      const corrected = legacyCreatePricingFromEstimateGstCorrected({
        items,
        orgGstRate: 0,
      });
      const engineRequest = adaptPricingDocumentToEngineRequest({
        requestId: "par-c28",
        items,
        gstRate: corrected.labelledGstRate,
      });
      const engine = normalizeEngineOutputsFromRequest(engineRequest);
      return {
        legacyOutputs: corrected.postRecalcTotals,
        engineRequest,
        engineOutputs: engine,
        notes: [
          "KM-GST-C28",
          "corrected_2B.5",
          `labelled=${corrected.labelledGstRate}`,
          `recalcWith=${corrected.recalculatedWith}`,
          `historicBugRecalcWith=${historicBug.recalculatedWith}`,
          `historicPostGst=${historicBug.postRecalcTotals.gstAmount}`,
          `correctedPostGst=${corrected.postRecalcTotals.gstAmount}`,
        ],
      };
    },
  }),

  // --- Estimates ---
  freezeFixture({
    fixtureId: "PAR-E-SFM-001",
    legacyId: "LEG-E-01",
    kind: "estimate",
    description: "deriveSellFromCost 20000 @ 25%",
    scenarioRef: "CCS-023",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.7",
    legacyInputs: { cost: 20000, margin: 25 },
    run: () => {
      const sell = legacyDeriveSellFromCost(20000, 25);
      const legacy = legacyRecalculateSellFromCost(20000, 25);
      const engineRequest = adaptEstimateSellFromMarginToEngineRequest({
        requestId: "par-e-sfm",
        cost: 20000,
        marginPercent: 25,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: [`deriveSell=${sell}`],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-E-AGG-001",
    legacyId: "LEG-E-16",
    kind: "estimate",
    description: "estimate line sum (no GST)",
    scenarioRef: "CCS-004-est",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.7",
    legacyInputs: {
      lines: [
        { recommendedCost: 1680, recommendedSell: 2100 },
        { recommendedCost: 660, recommendedSell: 825 },
      ],
    },
    run: () => {
      const lines = [
        { recommendedCost: 1680, recommendedSell: 2100 },
        { recommendedCost: 660, recommendedSell: 825 },
      ];
      const legacyBase = legacySumEstimateLineTotals(lines);
      const engineRequest = adaptPricingDocumentToEngineRequest({
        requestId: "par-e-agg",
        items: lines.map((l) => ({
          total_cost: l.recommendedCost,
          total_sell: l.recommendedSell,
        })),
        gstRate: 0,
      });
      const engine = normalizeEngineOutputsFromRequest(engineRequest);
      // Estimates are GST-exclusive; align GST fields to engine's explicit 0% for money compare
      const legacy = Object.freeze({
        ...legacyBase,
        gstAmount: 0,
        totalInclGst: legacyBase.totalSell,
        gstRatePercent: 0,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: engine,
        notes: ["estimate excl GST — compared with engine gstRate 0"],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-E-TO-P-001",
    legacyId: "LEG-E-21",
    kind: "estimate",
    description: "estimate labour → pricing item (no double margin)",
    scenarioRef: "CCS-002",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.7",
    legacyInputs: {
      labourHours: 5,
      labourCostRate: 60,
      labourSellRate: 80,
    },
    run: () => {
      const legacy = legacyCalculatePricingItem({
        calculationMode: "productivity_labour",
        quantity: 5,
        calculatedQuantity: 5,
        productivityRate: 1,
        unitCost: 60,
        unitSell: 80,
      });
      // Engine path mirrors createPricingFromEstimate rate-based conversion.
      const engineRequest = adaptPricingItemToEngineRequest({
        requestId: "par-e-to-p",
        mode: "productivity_labour",
        quantity: 5,
        calculatedQuantity: 5,
        productivityRate: 1,
        unitCost: 60,
        unitSell: 80,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: [
          "estimate recommended 300/400 from 5h×60/80",
          "pricing conversion must use rates — not re-apply margin on totals",
        ],
      };
    },
  }),

  // --- Quotes ---
  freezeFixture({
    fixtureId: "PAR-Q-DOC-001",
    legacyId: "LEG-Q-01",
    kind: "quote",
    description: "quote visible-only + GST 15%",
    scenarioRef: "CCS-045",
    expectedClassification: null,
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.8",
    legacyInputs: {
      items: [
        { total: 20000, visible: true },
        { total: 2000, visible: false },
      ],
    },
    run: () => {
      const items = [
        { total: 20000, visible: true, total_cost: 16000 },
        { total: 2000, visible: false, total_cost: 1600 },
      ];
      const legacy = legacyCalculateQuoteDocument(items, 15);
      const engineRequest = adaptQuoteDocumentToEngineRequest({
        requestId: "par-q-001",
        items,
        gstRate: 15,
      });
      const engine = normalizeEngineOutputsFromRequest(engineRequest);
      // Quote legacy has null cost/GP — compare sell/GST only via expected match on those fields
      return {
        legacyOutputs: Object.freeze({
          ...legacy,
          // Align costKnown for compare: quote doesn't track cost
          totalCost: engine.totalCost,
          grossProfit: engine.grossProfit,
          grossMarginPercent: engine.grossMarginPercent,
          markupPercent: engine.markupPercent,
          costKnown: engine.costKnown,
        }),
        engineRequest,
        engineOutputs: engine,
        notes: [
          "KM-PRICING-QUOTE-DIVERGENCE",
          "cost fields copied from engine for sell/GST-focused compare",
        ],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-Q-ITEM-001",
    legacyId: "LEG-Q-02",
    kind: "quote",
    description: "quote item prefers supplied total over qty×price",
    scenarioRef: null,
    expectedClassification: "DEFERRED_WORKFLOW_DIFFERENCE",
    commercialAuthority: "live_legacy_behaviour",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.8",
    legacyInputs: { quantity: 10, unitPrice: 50, total: 600 },
    run: () => {
      const total = legacyCalculateQuoteItemTotal({
        quantity: 10,
        unitPrice: 50,
        total: 600,
      });
      return {
        legacyOutputs: Object.freeze({
          totalCost: null,
          totalSell: total,
          grossProfit: null,
          grossMarginPercent: null,
          markupPercent: null,
          gstAmount: null,
          totalInclGst: null,
          gstRatePercent: null,
          costKnown: null,
        }),
        engineRequest: null,
        engineOutputs: null,
        notes: [
          "Engine line modes do not prefer client total over qty×rate; CD-22 policy deferred to quote adoption",
        ],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-PQ-DIVERGENCE-001",
    legacyId: "LEG-P-03",
    kind: "pricing_document",
    description: "pricing all vs quote visible on same basket",
    scenarioRef: "CCS-045",
    expectedClassification: "DEFERRED_WORKFLOW_DIFFERENCE",
    commercialAuthority: "mixed_documented_disagreement",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.8",
    legacyInputs: {
      pricingAll: 22000,
      quoteVisible: 20000,
    },
    run: () => {
      const items = [
        { total_cost: 16000, total_sell: 20000, visible: true },
        { total_cost: 1600, total_sell: 2000, visible: false },
      ];
      const pricing = legacyCalculatePricingDocument(
        items.map((i) => ({
          total_cost: i.total_cost,
          total_sell: i.total_sell,
        })),
        15
      );
      const quote = legacyCalculateQuoteDocument(
        items.map((i) => ({ total: i.total_sell, visible: i.visible })),
        15
      );
      return {
        legacyOutputs: pricing,
        engineRequest: null,
        engineOutputs: Object.freeze({
          ...quote,
          totalCost: pricing.totalCost,
          grossProfit: pricing.grossProfit,
          grossMarginPercent: pricing.grossMarginPercent,
          markupPercent: pricing.markupPercent,
          costKnown: true,
        }),
        notes: [
          "KM-PRICING-QUOTE-DIVERGENCE",
          `pricingSell=${pricing.totalSell}`,
          `quoteSell=${quote.totalSell}`,
        ],
      };
    },
  }),

  // --- Client display ---
  freezeFixture({
    fixtureId: "PAR-UI-PROFIT-001",
    legacyId: "LEG-UI-01",
    kind: "client_display",
    description: "client profit preview matches rounded triad",
    scenarioRef: null,
    expectedClassification: "PRESENTATION_ONLY_DIFFERENCE",
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.9",
    legacyInputs: { totalCost: 2310, totalSell: 2887.5 },
    run: () => {
      const legacy = legacyClientProfitPreview(2310, 2887.5);
      const engineRequest = adaptPricingItemToEngineRequest({
        requestId: "par-ui-profit",
        mode: "quantity_rate",
        quantity: 55,
        unitCost: 42,
        unitSell: 52.5,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: ["KM-CLIENT-DUP — numbers match; classification presentation"],
      };
    },
  }),
  freezeFixture({
    fixtureId: "PAR-UI-UNROUNDED-001",
    legacyId: "LEG-UI-02",
    kind: "client_display",
    description: "unrounded work-area margin vs 2dp engine",
    scenarioRef: null,
    expectedClassification: "PRESENTATION_ONLY_DIFFERENCE",
    commercialAuthority: "canonical_golden_results",
    blockingAdoption: false,
    futureAdoptionBatch: "2B.9",
    legacyInputs: { cost: 7000, sell: 8300 },
    run: () => {
      const u = legacyClientUnroundedMargin(7000, 8300);
      const legacy = Object.freeze({
        totalCost: 7000,
        totalSell: 8300,
        grossProfit: u.profit,
        grossMarginPercent: u.marginPercent,
        markupPercent: null,
        gstAmount: null,
        totalInclGst: null,
        gstRatePercent: null,
        costKnown: true,
      });
      const engineRequest = adaptPricingDocumentToEngineRequest({
        requestId: "par-unrounded",
        items: [
          { total_cost: 4000, total_sell: 5000 },
          { total_cost: 3000, total_sell: 3300 },
        ],
        gstRate: 0,
      });
      return {
        legacyOutputs: legacy,
        engineRequest,
        engineOutputs: normalizeEngineOutputsFromRequest(engineRequest),
        notes: ["unrounded margin% vs roundPercent"],
      };
    },
  }),
]);

export function getParityFixtureIds(): string[] {
  return PARITY_FIXTURES.map((f) => f.fixtureId);
}

export function getCoveredLegacyIds(): Set<string> {
  return new Set(PARITY_FIXTURES.map((f) => f.legacyId));
}
