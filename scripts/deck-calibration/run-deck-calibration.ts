/**
 * DECK-1D-B calibration runner — diagnostic only.
 * Reads estimate outputs; does not change calculators, authority, or money.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateEstimate } from "../../lib/estimate/calculate-estimate";
import { getComponentCommercialAuthority } from "../../lib/estimate/component-authority";
import {
  DECK_BEARERS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS,
  DECK_SUPPORTS_COMPONENT_KEY,
} from "../../lib/estimate/deck-structure";
import { round2 } from "../../lib/estimate/facts";
import type { MaterialRequirement } from "../../lib/estimate/requirements";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../../lib/estimate/types";
import { serializeMaterialIdentityKey } from "../../lib/materials/identity";
import type {
  DeckCalibrationBucket,
  DeckCalibrationBucketState,
  DeckCalibrationChildRow,
  DeckCalibrationCoverageOverride,
  DeckCalibrationFixture,
  DeckCalibrationReport,
  DeckCalibrationScopeRequirement,
} from "./types";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/deck-calibration");

const STRUCTURAL_CHILD_KEYS = [
  DECK_JOISTS_COMPONENT_KEY,
  DECK_RIM_FRAMING_COMPONENT_KEY,
  DECK_BEARERS_COMPONENT_KEY,
  DECK_SUPPORTS_COMPONENT_KEY,
  DECK_CONCRETE_COMPONENT_KEY,
] as const;

export function fixturePath(fileName: string): string {
  return join(FIXTURE_DIR, fileName);
}

export function loadCalibrationFixture(fileName: string): DeckCalibrationFixture {
  return JSON.parse(readFileSync(fixturePath(fileName), "utf8")) as DeckCalibrationFixture;
}

function factsFromRecord(
  workAreaId: string,
  record: Record<string, string | number | boolean>
): EstimateFact[] {
  return Object.entries(record).map(([key, value]) => ({
    key,
    work_area_id: workAreaId,
    value,
  }));
}

function materialReq(
  requirements: readonly { kind: string; componentKey: string }[] | undefined,
  componentKey: string
): MaterialRequirement | undefined {
  return requirements?.find(
    (item): item is MaterialRequirement =>
      item.kind === "material" && item.componentKey === componentKey
  );
}

function childState(req: MaterialRequirement | undefined): DeckCalibrationBucketState {
  if (!req) return "NOT_MODELLED";
  if (req.priced && req.totalCost != null) return "PRICED";
  return "UNPRICED";
}

function applyOverride(
  state: DeckCalibrationBucketState,
  override?: DeckCalibrationCoverageOverride
): DeckCalibrationBucketState {
  return override?.state ?? state;
}

function scopeRequirementFromState(
  state: DeckCalibrationBucketState,
  hasPhysicalRequirement: boolean
): DeckCalibrationScopeRequirement {
  if (state === "NOT_REQUIRED") return "NOT_REQUIRED";
  if (hasPhysicalRequirement) return "REQUIRED";
  return "UNKNOWN";
}

function isEconomicGap(params: {
  required: boolean;
  state: DeckCalibrationBucketState;
}): boolean {
  if (!params.required) return false;
  if (params.state === "NOT_REQUIRED") return false;
  if (params.state === "PRICED") return false;
  if (params.state === "ALLOWANCE") return false;
  if (params.state === "LEGACY_FALLBACK") return false;
  return params.state === "UNPRICED" || params.state === "NOT_MODELLED";
}

export function runDeckCalibration(
  fixture: DeckCalibrationFixture,
  coverageOverrides?: Record<string, DeckCalibrationCoverageOverride>
): DeckCalibrationReport {
  if (fixture.template || Object.keys(fixture.facts).length === 0) {
    return templateReport(fixture);
  }
  const overrides = {
    ...(fixture.coverageOverrides ?? {}),
    ...(coverageOverrides ?? {}),
  };
  const workArea: EstimateWorkArea = {
    id: fixture.id,
    type: "deck",
    name: fixture.id,
    sort_order: 1,
  };
  const facts = factsFromRecord(fixture.id, fixture.facts);
  const context = {
    project: { id: fixture.id, qualityLevel: fixture.qualityLevel ?? "standard" },
    confirmedWorkAreas: [workArea],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;

  const estimate = calculateEstimate(context);
  const length = Number(fixture.facts["deck.length_m"]);
  const width = Number(fixture.facts["deck.width_m"]);
  const areaFact = Number(fixture.facts["deck.area_m2"]);
  const areaM2 =
    Number.isFinite(areaFact) && areaFact > 0
      ? areaFact
      : Number.isFinite(length) && Number.isFinite(width)
        ? round2(length * width)
        : null;

  const framing = estimate.lineItems.find((item) => item.label === "Framing/substructure");
  const fixings = estimate.lineItems.find((item) => item.label === "Fixings and consumables");
  const labour = estimate.lineItems.find((item) => item.label === "Deck labour");
  const otherStructuralLines = estimate.lineItems
    .filter((item) =>
      /pile\/post replacement|substructure replacement|stair|balustrade|handrail/i.test(
        item.label
      )
    )
    .map((item) => ({ label: item.label, cost: item.recommendedCost }));

  const children: DeckCalibrationChildRow[] = STRUCTURAL_CHILD_KEYS.map((key) => {
    const req = materialReq(estimate.requirements, key);
    const inferred = childState(req);
    const state = applyOverride(inferred, overrides[key]);
    const scopeRequirement = scopeRequirementFromState(state, Boolean(req));
    const requiredFinal = scopeRequirement === "REQUIRED";
    return {
      componentKey: key,
      scopeRequirement,
      quantity: req?.purchaseQuantity ?? null,
      unit: req?.purchaseUnit ?? null,
      identity: req?.materialIdentity
        ? serializeMaterialIdentityKey(req.materialIdentity)
        : req?.materialKey ?? null,
      priced: req?.priced ?? null,
      rateSource: req?.rateSource ?? null,
      unitCost: req?.unitCost ?? null,
      totalCost: req?.totalCost ?? null,
      authority: getComponentCommercialAuthority({
        workAreaType: "deck",
        componentKey: key,
      }).authority,
      bucketState: state,
      economicGap: isEconomicGap({ required: requiredFinal, state }),
    };
  });

  const pricedTimber = children.filter(
    (row) =>
      (row.componentKey === DECK_JOISTS_COMPONENT_KEY ||
        row.componentKey === DECK_RIM_FRAMING_COMPONENT_KEY ||
        row.componentKey === DECK_BEARERS_COMPONENT_KEY) &&
      row.priced === true &&
      row.totalCost != null
  );
  const partialPricedStructuralChildCost =
    pricedTimber.length > 0
      ? round2(pricedTimber.reduce((sum, row) => sum + (row.totalCost ?? 0), 0))
      : null;

  const supportsRow = children.find((row) => row.componentKey === DECK_SUPPORTS_COMPONENT_KEY)!;
  const concreteRow = children.find((row) => row.componentKey === DECK_CONCRETE_COMPONENT_KEY)!;

  const blockingState = applyOverride("NOT_MODELLED", overrides.blocking);
  const trimmerState = applyOverride("NOT_MODELLED", overrides.trimmers);
  const fixingsState = applyOverride("LEGACY_FALLBACK", overrides.fixings);
  const blockingScopeRequirement: DeckCalibrationScopeRequirement =
    blockingState === "NOT_REQUIRED"
      ? "NOT_REQUIRED"
      : blockingState === "ALLOWANCE" || blockingState === "LEGACY_FALLBACK"
        ? "REQUIRED"
        : "UNKNOWN";
  const trimmerScopeRequirement: DeckCalibrationScopeRequirement =
    trimmerState === "NOT_REQUIRED"
      ? "NOT_REQUIRED"
      : trimmerState === "ALLOWANCE" || trimmerState === "LEGACY_FALLBACK"
        ? "REQUIRED"
        : "UNKNOWN";

  const buckets: DeckCalibrationBucket[] = [
    bucketFromChild("joists", "Joists", children, DECK_JOISTS_COMPONENT_KEY),
    bucketFromChild("rim", "Rim / boundary framing", children, DECK_RIM_FRAMING_COMPONENT_KEY),
    bucketFromChild("bearers", "Bearers", children, DECK_BEARERS_COMPONENT_KEY),
    {
      key: "supports",
      label: "Supports / posts",
      scopeRequirement: supportsRow.scopeRequirement,
      bucketState: supportsRow.bucketState,
      economicGap: supportsRow.economicGap,
      knownModelGap: false,
      quantity: supportsRow.quantity,
      unit: supportsRow.unit,
      cost: supportsRow.totalCost,
      notes: [
        "Physical EA only. Post length is not invented.",
        supportsRow.economicGap
          ? "Required + unpriced = ECONOMIC_GAP (not excluded)."
          : "Coverage closed or not required.",
      ],
    },
    {
      key: "concrete",
      label: "Footing concrete",
      scopeRequirement: concreteRow.scopeRequirement,
      bucketState: concreteRow.bucketState,
      economicGap: concreteRow.economicGap,
      knownModelGap: false,
      quantity: concreteRow.quantity,
      unit: concreteRow.unit,
      cost: concreteRow.totalCost,
      notes: [
        "No bag conversion. No new mix benchmark.",
        concreteRow.economicGap
          ? "Required + unpriced = ECONOMIC_GAP (not excluded)."
          : "Coverage closed or not required.",
      ],
    },
    {
      key: "fixings",
      label: "LEGACY CATCH-ALL FIXINGS (deck.fixings.m2)",
      scopeRequirement: "REQUIRED",
      bucketState: fixingsState,
      economicGap: isEconomicGap({
        required: fixingsState !== "NOT_REQUIRED",
        state: fixingsState,
      }),
      knownModelGap: false,
      quantity: areaM2,
      unit: "m2",
      cost: fixings?.recommendedCost ?? null,
      notes: [
        "Commercially covered today via retained legacy fixings/consumables line.",
        "Shown separately from deck.substructure.",
        "Not included in PARTIAL PRICED STRUCTURAL CHILD COST.",
        "Surface vs structural split remains UNKNOWN.",
      ],
    },
    {
      key: "blocking",
      label: "Blocking / nogs",
      scopeRequirement: blockingScopeRequirement,
      bucketState: blockingState,
      economicGap: isEconomicGap({
        required: blockingScopeRequirement === "REQUIRED",
        state: blockingState,
      }),
      knownModelGap: blockingState === "NOT_MODELLED",
      quantity: null,
      unit: null,
      cost: null,
      notes: [
        "Requirement evidence is UNKNOWN unless Owner explicitly marks allowance/fallback/not-required.",
        "NOT_MODELLED. Do not treat as $0.",
        "Known decomposition gap only; do not auto-classify as ECONOMIC_GAP.",
      ],
    },
    {
      key: "trimmers",
      label: "Trimmers / openings",
      scopeRequirement: trimmerScopeRequirement,
      bucketState: trimmerState,
      economicGap: isEconomicGap({
        required: trimmerScopeRequirement === "REQUIRED",
        state: trimmerState,
      }),
      knownModelGap: trimmerState === "NOT_MODELLED",
      quantity: null,
      unit: null,
      cost: null,
      notes: [
        "Requirement evidence is UNKNOWN unless Owner explicitly marks allowance/fallback/not-required.",
        "NOT_MODELLED. Do not invent quantities.",
      ],
    },
    {
      key: "labour",
      label: "CURRENT LABOUR AUTHORITY (Deck labour)",
      scopeRequirement: "REQUIRED",
      bucketState: "PRICED",
      economicGap: false,
      knownModelGap: false,
      quantity: labour?.quantity ?? null,
      unit: labour?.unit ?? null,
      cost: labour?.recommendedCost ?? null,
      notes: [
        "Not included in detailed structural child subtotal.",
        "Not DECK-3 task labour.",
      ],
    },
  ];

  const economicGaps = [
    ...children.filter((row) => row.economicGap).map((row) => row.componentKey),
    ...buckets.filter((row) => row.economicGap).map((row) => row.key),
  ].filter((key, index, all) => all.indexOf(key) === index);

  const unpricedOrMissing = children.some(
    (row) => row.bucketState === "UNPRICED" || row.economicGap
  );
  const economicCompleteness = unpricedOrMissing || buckets.some((row) => row.knownModelGap)
    ? "INCOMPLETE"
    : "COMPLETE";

  const difference =
    framing?.recommendedCost != null && partialPricedStructuralChildCost != null
      ? round2(framing.recommendedCost - partialPricedStructuralChildCost)
      : null;

  const missingCostExplanation = [
    supportsRow.economicGap ? "supports UNPRICED (ECONOMIC_GAP)" : null,
    concreteRow.economicGap ? "concrete UNPRICED (ECONOMIC_GAP)" : null,
    "blocking/trimmers may be required, not required, or residual allowance items depending on fixture evidence; do not treat NOT_MODELLED as automatic gap",
    "structural connectors not detailed; fixings remain LEGACY CATCH-ALL and are commercially covered but not yet decomposed",
    "difference vs legacy package is incomplete/unexplained variance; legacy cost provenance unknown — not a cost reduction",
  ]
    .filter(Boolean)
    .join("; ");

  const realComparisons: DeckCalibrationReport["realJob"]["comparisons"] = [];
  const actuals = fixture.realJob;
  if (actuals?.quotedSubstructureCost != null && framing?.recommendedCost != null) {
    realComparisons.push({
      label: "quoted substructure vs legacy package",
      actual: actuals.quotedSubstructureCost,
      model: framing.recommendedCost,
    });
  }
  if (actuals?.actualFramingMaterialCost != null) {
    realComparisons.push({
      label: "actual framing invoice vs PARTIAL PRICED STRUCTURAL CHILD COST",
      actual: actuals.actualFramingMaterialCost,
      model: partialPricedStructuralChildCost,
    });
  }
  if (actuals?.actualSupportsCost != null) {
    realComparisons.push({
      label: "actual supports vs model supports",
      actual: actuals.actualSupportsCost,
      model: supportsRow.totalCost,
    });
  }

  const structuralChildrenContributeMoney = estimate.lineItems.some((item) =>
    DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS.includes(
      item.componentKey as (typeof DECK_STRUCTURAL_SHADOW_COMPONENT_KEYS)[number]
    )
  );

  const status: DeckCalibrationReport["status"] = unpricedOrMissing
    ? "PARTIAL_COVERAGE"
    : fixture.class === "REAL-JOB" && !actuals
      ? "NOT_COMPARABLE"
      : "PARTIAL_COVERAGE";

  return {
    fixtureId: fixture.id,
    fixtureClass: fixture.class,
    comparisonLabel: "MATERIAL / SUBSTRUCTURE COMPARISON",
    confidence: fixture.confidence,
    notes: [...fixture.notes],
    limitations: [...fixture.limitations],
    areaM2,
    legacy: {
      substructureCost: framing?.recommendedCost ?? null,
      fixingsCost: fixings?.recommendedCost ?? null,
      fixingsLabel: "LEGACY CATCH-ALL FIXINGS",
      labourCost: labour?.recommendedCost ?? null,
      labourLabel: "CURRENT LABOUR AUTHORITY",
      otherStructuralLines,
    },
    detailed: {
      children,
      partialPricedStructuralChildCost,
      partialLabel: "PARTIAL PRICED STRUCTURAL CHILD COST",
    },
    buckets,
    economicGaps,
    economicCompleteness,
    status,
    directionalLegacyVsPricedTimber: {
      label:
        "Directional only — legacy cost provenance unknown; not complete structural variance; not a cost reduction",
      legacyPackageCost: framing?.recommendedCost ?? null,
      pricedDetailedSubtotal: partialPricedStructuralChildCost,
      difference,
      notCostReduction: true,
    },
    variance: {
      comparable: false,
      buckets:
        "not comparable as complete substructure (missing/unpriced buckets) and legacy cost provenance unknown",
      varianceDollars: null,
      variancePercent: null,
      missingCostExplanation,
    },
    realJob: {
      supplied: Boolean(
        actuals &&
          Object.values(actuals).some((value) => typeof value === "number")
      ),
      comparisons: realComparisons,
    },
    commercialSafety: {
      structuralChildrenContributeMoney,
      estimateSell: estimate.recommendedSell,
    },
  };
}

function templateReport(fixture: DeckCalibrationFixture): DeckCalibrationReport {
  return {
    fixtureId: fixture.id,
    fixtureClass: fixture.class,
    comparisonLabel: "MATERIAL / SUBSTRUCTURE COMPARISON",
    confidence: fixture.confidence,
    notes: [...fixture.notes],
    limitations: [...fixture.limitations],
    areaM2: null,
    legacy: {
      substructureCost: null,
      fixingsCost: null,
      fixingsLabel: "LEGACY CATCH-ALL FIXINGS",
      labourCost: null,
      labourLabel: "CURRENT LABOUR AUTHORITY",
      otherStructuralLines: [],
    },
    detailed: {
      children: [],
      partialPricedStructuralChildCost: null,
      partialLabel: "PARTIAL PRICED STRUCTURAL CHILD COST",
    },
    buckets: [],
    economicGaps: [],
    economicCompleteness: "NOT_COMPARABLE",
    status: "NOT_COMPARABLE",
    directionalLegacyVsPricedTimber: {
      label:
        "Directional only — legacy cost provenance unknown; not complete structural variance; not a cost reduction",
      legacyPackageCost: null,
      pricedDetailedSubtotal: null,
      difference: null,
      notCostReduction: true,
    },
    variance: {
      comparable: false,
      buckets: "template has no job facts",
      varianceDollars: null,
      variancePercent: null,
      missingCostExplanation: "REAL-JOB template — no invented actuals",
    },
    realJob: { supplied: false, comparisons: [] },
    commercialSafety: {
      structuralChildrenContributeMoney: false,
      estimateSell: 0,
    },
  };
}

function bucketFromChild(
  key: string,
  label: string,
  children: DeckCalibrationChildRow[],
  componentKey: string
): DeckCalibrationBucket {
  const row = children.find((item) => item.componentKey === componentKey)!;
  return {
    key,
    label,
    scopeRequirement: row.scopeRequirement,
    bucketState: row.bucketState,
    economicGap: row.economicGap,
    knownModelGap: false,
    quantity: row.quantity,
    unit: row.unit,
    cost: row.totalCost,
    notes: [],
  };
}

export function scaleComparison(
  simple: DeckCalibrationReport,
  medium: DeckCalibrationReport
): {
  simpleArea: number | null;
  mediumArea: number | null;
  legacyPerM2Simple: number | null;
  legacyPerM2Medium: number | null;
  timberPerM2Simple: number | null;
  timberPerM2Medium: number | null;
  legacyScale: "stable" | "growing" | "shrinking" | "unknown";
  timberScale: "stable" | "growing" | "shrinking" | "unknown";
  note: string;
} {
  const per = (cost: number | null, area: number | null) =>
    cost != null && area != null && area > 0 ? round2(cost / area) : null;
  const legacySimple = per(simple.legacy.substructureCost, simple.areaM2);
  const legacyMedium = per(medium.legacy.substructureCost, medium.areaM2);
  const timberSimple = per(
    simple.detailed.partialPricedStructuralChildCost,
    simple.areaM2
  );
  const timberMedium = per(
    medium.detailed.partialPricedStructuralChildCost,
    medium.areaM2
  );
  const trend = (
    a: number | null,
    b: number | null
  ): "stable" | "growing" | "shrinking" | "unknown" => {
    if (a == null || b == null) return "unknown";
    const delta = b - a;
    if (Math.abs(delta) <= 1) return "stable";
    return delta > 0 ? "growing" : "shrinking";
  };
  return {
    simpleArea: simple.areaM2,
    mediumArea: medium.areaM2,
    legacyPerM2Simple: legacySimple,
    legacyPerM2Medium: legacyMedium,
    timberPerM2Simple: timberSimple,
    timberPerM2Medium: timberMedium,
    legacyScale: trend(legacySimple, legacyMedium),
    timberScale: trend(timberSimple, timberMedium),
    note: "Do not infer which is correct. Legacy cost provenance unknown (stored $120/m² semantics); detailed timber is takeoff×benchmark.",
  };
}

export function reportContainsSavingsLanguage(report: DeckCalibrationReport): boolean {
  const blob = JSON.stringify(report).toLowerCase();
  return blob.includes("savings");
}

export function reportContainsFakeCompletenessPercent(
  report: DeckCalibrationReport
): boolean {
  const blob = JSON.stringify(report);
  return /3\s*\/\s*5|60%/.test(blob);
}
