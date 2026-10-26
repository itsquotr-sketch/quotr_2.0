/**
 * Deck post-hole excavation and bank spoil.
 *
 * Ordinary task (provisional Quotr productivity only inside this scope,
 * and only after the builder has confirmed each condition):
 * - Ground: ordinary soil a hand post-hole spade or hand auger can dig.
 * - Method: hand excavation. No machine hire.
 * - Hole: one circular hole, diameter 250–450 mm, depth 400–900 mm.
 * - Includes: marking that hole and placing the dug soil at the immediate workface.
 * - Excludes: post or pile setting, concrete placement, rock, groundwater,
 *   dewatering, truck loading, haulage, tip fees, and deck demolition waste.
 *
 * The approved figure is 0.50 person-hours per hole (one person, 30 minutes),
 * owner decision 14 October 2026, and only inside the ordinary scope below.
 * It is not the imported 1.00 h pile/post task and not the 0.0667 h/bag concrete
 * placement. An explicit this-job hours figure wins. A company or calibrated
 * hours-per-hole wins for a job inside this scope, and also when the builder
 * has not marked the hours unknown. Outside the scope, 0.50 is not applied.
 * Unknown ground stays Pricing Required with the reason on the line.
 *
 * Absent dimensions are shown as an assumed 350 mm × 600 mm circular hole.
 * They are not measured and do not receive the 0.50 h starter.
 *
 * Bank volume is in-situ m³. Loose spoil is not calculated. The roughly 3×
 * swell note is not an approved factor.
 */
import { deriveDeckPostConcrete, type DeckPostConcretePlan } from "@/lib/estimate/deck-post-concrete";
import { getBooleanFact, getNumberFact, getStringFact } from "@/lib/estimate/facts";
import type { DeckHoleDraftStamp } from "@/lib/estimate/line-item-metadata";
import { resolveProductivity } from "@/lib/estimate/productivity";
import type { OrganisationRate } from "@/components/setup/types";
import type { EstimateFact } from "@/lib/estimate/types";

export const DECK_HOLE_EXCAVATE_KEY = "deck.hole.excavate.hours_per_hole" as const;
export const DECK_HOLE_EXCAVATE_COMPONENT = "deck.hole.excavate" as const;
export const DECK_HOLE_DIAMETER_FACT = "deck.hole_diameter_mm" as const;
export const DECK_HOLE_DEPTH_FACT = "deck.hole_depth_mm" as const;
export const DECK_HOLE_LENGTH_FACT = "deck.hole_length_mm" as const;
export const DECK_HOLE_WIDTH_FACT = "deck.hole_width_mm" as const;
export const DECK_HOLE_SHAPE_FACT = "deck.hole_shape" as const;
export const DECK_HOLE_GROUND_FACT = "deck.hole_ground" as const;
export const DECK_HOLE_METHOD_FACT = "deck.hole_method" as const;
export const DECK_HOLE_COUNT_FACT = "deck.hole_count" as const;
export const DECK_HOLE_COUNT_REASON_FACT = "deck.hole_count_reason" as const;
export const DECK_HOLE_JOB_HOURS_FACT = "deck.hole_job_hours_per_hole" as const;
export const DECK_SPOIL_LEAVES_SITE_FACT = "deck.spoil_leaves_site" as const;
export const DECK_SPOIL_DESTINATION_FACT = "deck.spoil_destination" as const;

export const DECK_SPOIL_ALL_IN_KEY = "deck.spoil.removal.all_in.m3" as const;
export const DECK_SPOIL_HAULAGE_KEY = "deck.spoil.haulage.m3" as const;
export const DECK_SPOIL_TIP_KEY = "deck.spoil.tip.m3" as const;
export const DECK_SPOIL_ALL_IN_COMPONENT = "deck.spoil.removal" as const;
export const DECK_SPOIL_HAULAGE_COMPONENT = "deck.spoil.haulage" as const;
export const DECK_SPOIL_TIP_COMPONENT = "deck.spoil.tip" as const;
export const DECK_SPOIL_DECISION_COMPONENT = "deck.spoil.destination" as const;

export const DECK_HOLE_ASSUMED_DIAMETER_MM = 350;
export const DECK_HOLE_ASSUMED_DEPTH_MM = 600;
/** One person for 30 minutes. Approved 14 October 2026, ordinary scope only. */
export const DECK_HOLE_PROVISIONAL_HOURS = 0.5;
export const DECK_HOLE_HOURS_STATUS_FACT = "deck.hole_hours_status" as const;
export const DECK_SPOIL_HAULAGE_CHOICE_FACT = "deck.spoil_haulage_choice" as const;
export const DECK_SPOIL_HAULAGE_COST_FACT = "deck.spoil_haulage_job_cost" as const;
export const DECK_SPOIL_TIP_CHOICE_FACT = "deck.spoil_tip_choice" as const;
export const DECK_SPOIL_TIP_COST_FACT = "deck.spoil_tip_job_cost" as const;
export const DECK_SPOIL_FIT_FACT = "deck.spoil_load_fit" as const;
/** Flat ex-GST planning allowance. Not a $/bank-m³ rate and not a live tariff. */
export const DECK_SPOIL_HAULAGE_ALLOWANCE_EX_GST = 150;
export const DECK_SPOIL_TIP_ALLOWANCE_EX_GST = 150;
export const DECK_SPOIL_SMALL_BANK_MAX_M3 = 1;
export const DECK_SPOIL_ALLOWANCE_NOTICE =
  "Provisional local allowance—confirm or replace";
export const DECK_SPOIL_HAULAGE_SUMMARY =
  "One local trip · clean spoil · allowance confirmed for this job";
export const DECK_SPOIL_TIP_SUMMARY =
  "One clean-spoil load · allowance confirmed for this job";
export const DECK_SPOIL_ALLOWANCE_SOURCE =
  "Quotr provisional allowance · confirmed for this job";
export const DECK_SPOIL_HAULAGE_SHORT =
  "One local trip for clean spoil from a small accessible job, including loading.";
export const DECK_SPOIL_TIP_SHORT =
  "One clean-spoil load at a receiving facility.";
export const DECK_SPOIL_HAULAGE_SCOPE =
  "Small accessible job, clean natural spoil, up to 1 bank m³ and one local trip. Includes loading at the workface and that trip. No second loading labour charge.";
export const DECK_SPOIL_TIP_SCOPE =
  "Provisional receiving-facility allowance for one load of clean natural spoil. Not a uniform council tariff and not scaled from bank volume.";
export const DECK_SPOIL_ALLOWANCE_CONTEXT =
  "Context on 14 October 2026, not a live supplier tariff: an Auckland operator lists a six-wheeler at $115/hour ex GST and clean dry spoil at $22/tonne ex GST; Tauranga lists clean soil at $111/tonne with a $111 minimum; Waimakariri lists commercial cleanfill at $95/m³.";

export const DECK_HOLE_ORDINARY_DIAMETER_MIN_MM = 250;
export const DECK_HOLE_ORDINARY_DIAMETER_MAX_MM = 450;
export const DECK_HOLE_ORDINARY_DEPTH_MIN_MM = 400;
export const DECK_HOLE_ORDINARY_DEPTH_MAX_MM = 900;
export const DECK_HOLE_DIMENSION_MIN_MM = 50;
export const DECK_HOLE_DIMENSION_MAX_MM = 3000;
export const DECK_HOLE_COUNT_MAX = 200;

export const DECK_HOLE_ORDINARY_SCOPE =
  "Ordinary hand-dug circular deck post hole in soil a post-hole spade or hand auger can dig, 250–450 mm diameter and 400–900 mm deep. Includes marking the hole and placing spoil at the immediate workface. Excludes post setting, concrete, rock, groundwater, machine hire, truck loading, haulage, tip fees, and deck demolition.";

export const DECK_HOLE_CONFIRM_ACTION =
  "Confirm or change these before using the estimate";

export type DeckHoleGround = "ordinary" | "rock" | "groundwater" | "other";
export type DeckHoleMethod = "hand" | "machine" | "other";

export type DeckHoleGeometry = {
  readonly shape: "circular" | "rectangular";
  readonly diameterMm: number | null;
  readonly lengthMm: number | null;
  readonly widthMm: number | null;
  readonly depthMm: number | null;
  readonly diameterAssumed: boolean;
  readonly depthAssumed: boolean;
  readonly shapeAssumed: boolean;
  readonly dimensionsComplete: boolean;
  readonly ground: DeckHoleGround | null;
  readonly groundAssumed: boolean;
  readonly method: DeckHoleMethod | null;
  readonly methodAssumed: boolean;
  readonly ordinaryScope: boolean;
  readonly bankVolumeEachM3: number | null;
  readonly bankVolumeM3: number | null;
  readonly formula: string;
};

export type DeckHoleProductivity = {
  readonly applies: boolean;
  readonly hoursPerHole: number;
  readonly sourceLabel: string;
  readonly sourceType: "user_rate" | "calibrated_productivity" | "benchmark" | "missing";
  readonly reason: string;
};

export type DeckSpoilDestination = "on_site" | "off_site" | "unknown";

export type DeckSpoilMoneyLine = {
  readonly kind: "priced" | "pricing_required";
  readonly itemKey: string;
  readonly componentKey: string;
  readonly label: string;
  /** Bank volume, kept separate from the charged quantity. */
  readonly quantityM3: number;
  readonly chargeQuantity: number;
  readonly chargeUnit: "m³" | "job" | "load";
  readonly unitCost: number | null;
  readonly unitSell: number | null;
  readonly rateSourceType: "user_rate" | "benchmark" | "missing";
  readonly rateSourceLabel?: string;
  readonly notes: string;
};

export type DeckHoleCountDecision = {
  readonly postCount: number;
  readonly holeCount: number;
  readonly typedCount: number | null;
  readonly overrideRequested: boolean;
  readonly reason: string | null;
  readonly reasonMissing: boolean;
};

export type DeckHoleExcavationPlan = {
  readonly holeCount: number;
  readonly postCount: number;
  readonly count: DeckHoleCountDecision;
  readonly geometry: DeckHoleGeometry | null;
  readonly productivity: DeckHoleProductivity | null;
  readonly spoilDestination: DeckSpoilDestination;
  readonly spoilLines: readonly DeckSpoilMoneyLine[];
  readonly assumptions: readonly string[];
  readonly missingInfo: readonly string[];
  readonly draftStamp: DeckHoleDraftStamp | null;
  readonly concrete: DeckPostConcretePlan;
};

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function positive(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

export function deckHoleMillimetreError(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) {
    return "Enter a positive length in millimetres.";
  }
  if (value < DECK_HOLE_DIMENSION_MIN_MM || value > DECK_HOLE_DIMENSION_MAX_MM) {
    return `Use a hole dimension between ${DECK_HOLE_DIMENSION_MIN_MM} mm and ${DECK_HOLE_DIMENSION_MAX_MM} mm.`;
  }
  return null;
}

export function deckHoleCountError(
  value: number,
  subject: "holes" | "posts" = "holes"
): string | null {
  if (!Number.isInteger(value) || value <= 0) {
    return subject === "posts"
      ? "Enter a whole number of posts."
      : "Enter a whole number of holes.";
  }
  if (value > DECK_HOLE_COUNT_MAX) return `Use a hole count up to ${DECK_HOLE_COUNT_MAX}.`;
  return null;
}

function usableMillimetres(value: number | null): number | null {
  const next = positive(value);
  if (next == null || deckHoleMillimetreError(next)) return null;
  return next;
}

export function deckHoleOrdinaryScope(params: {
  diameterMm: number;
  depthMm: number;
  ground: DeckHoleGround | null;
  method: DeckHoleMethod | null;
}): boolean {
  return (
    params.ground === "ordinary" &&
    params.method === "hand" &&
    params.diameterMm >= DECK_HOLE_ORDINARY_DIAMETER_MIN_MM &&
    params.diameterMm <= DECK_HOLE_ORDINARY_DIAMETER_MAX_MM &&
    params.depthMm >= DECK_HOLE_ORDINARY_DEPTH_MIN_MM &&
    params.depthMm <= DECK_HOLE_ORDINARY_DEPTH_MAX_MM
  );
}

/** In-situ bank m³. Not wall face area and not loose spoil. */
export function circularBankVolumeM3(
  diameterMm: number,
  depthMm: number,
  holeCount: number
): { eachM3: number; totalM3: number; formula: string } {
  const radiusM = diameterMm / 1000 / 2;
  const depthM = depthMm / 1000;
  const each = Math.PI * radiusM * radiusM * depthM;
  const total = each * holeCount;
  const formula = `${holeCount} × π × (${diameterMm}/1000 ÷ 2 m)² × (${depthMm}/1000 m) bank m³`;
  return {
    eachM3: round3(each),
    totalM3: round3(total),
    formula,
  };
}

export function rectangularBankVolumeM3(
  lengthMm: number,
  widthMm: number,
  depthMm: number,
  holeCount: number
): { eachM3: number; totalM3: number; formula: string } {
  const each = (lengthMm / 1000) * (widthMm / 1000) * (depthMm / 1000);
  const total = each * holeCount;
  const formula = `${holeCount} × (${lengthMm}/1000 m) × (${widthMm}/1000 m) × (${depthMm}/1000 m) bank m³`;
  return {
    eachM3: round3(each),
    totalM3: round3(total),
    formula,
  };
}

export function resolveDeckHoleCount(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  postCount: number;
}): DeckHoleCountDecision {
  const postCount = Math.max(0, Math.round(params.postCount));
  const facts = [...params.facts];
  const typed = positive(getNumberFact(facts, params.workAreaId, DECK_HOLE_COUNT_FACT));
  const reason =
    getStringFact(facts, params.workAreaId, DECK_HOLE_COUNT_REASON_FACT)?.trim() || null;
  if (typed == null || Math.round(typed) === postCount) {
    return {
      postCount,
      holeCount: postCount,
      typedCount: typed == null ? null : Math.round(typed),
      overrideRequested: false,
      reason,
      reasonMissing: false,
    };
  }
  const typedCount = Math.round(typed);
  if (!reason) {
    return {
      postCount,
      holeCount: postCount,
      typedCount,
      overrideRequested: true,
      reason: null,
      reasonMissing: true,
    };
  }
  return {
    postCount,
    holeCount: typedCount,
    typedCount,
    overrideRequested: true,
    reason,
    reasonMissing: false,
  };
}

function parseGround(value: string | null): DeckHoleGround | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (!text || text === "not sure") return null;
  if (text === "ordinary" || text.includes("ordinary soil") || text === "soil") return "ordinary";
  if (text.includes("rock") || text.includes("hard")) return "rock";
  if (text.includes("groundwater") || text.includes("ground water") || text === "water") {
    return "groundwater";
  }
  if (text === "unsupported" || text === "other" || text.includes("unknown")) return "other";
  return "other";
}

function parseMethod(value: string | null): DeckHoleMethod | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (!text || text === "not sure") return null;
  if (text === "hand" || text.includes("auger") || text.includes("hand")) return "hand";
  if (text.includes("machine") || text.includes("digger") || text.includes("excavator")) {
    return "machine";
  }
  if (text === "other" || text.includes("unknown")) return "other";
  return "other";
}

function parseShape(value: string | null): "circular" | "rectangular" | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (text.startsWith("rect")) return "rectangular";
  if (text.startsWith("circ")) return "circular";
  return null;
}

function parseSpoil(
  facts: EstimateFact[],
  workAreaId: string
): DeckSpoilDestination {
  const raw = getStringFact(facts, workAreaId, DECK_SPOIL_DESTINATION_FACT);
  if (raw) {
    const text = raw.trim().toLowerCase();
    if (text === "on_site" || text.includes("retain") || text.includes("reuse") || text === "on site") {
      return "on_site";
    }
    if (text === "off_site" || text.includes("remove") || text.includes("off site") || text.includes("off-site")) {
      return "off_site";
    }
    return "unknown";
  }
  const leaves = getBooleanFact(facts, workAreaId, DECK_SPOIL_LEAVES_SITE_FACT);
  if (leaves === true) return "off_site";
  if (leaves === false) return "on_site";
  return "unknown";
}

function companySpoilRate(
  rates: readonly OrganisationRate[] | undefined,
  itemKey: string
): { cost: number; sell: number | null } | null {
  const row = rates?.find(
    (rate) =>
      rate.active &&
      rate.item_key === itemKey &&
      rate.cost_rate != null &&
      Number(rate.cost_rate) > 0
  );
  if (!row?.cost_rate) return null;
  return {
    cost: Number(row.cost_rate),
    sell: row.sell_rate != null ? Number(row.sell_rate) : null,
  };
}

function groundLabel(ground: DeckHoleGround | null, assumed: boolean): string {
  if (assumed || ground == null) return "ground not confirmed";
  if (ground === "ordinary") return "ordinary diggable soil";
  if (ground === "rock") return "rock or hard ground";
  if (ground === "groundwater") return "groundwater";
  return "other ground";
}

function methodLabel(method: DeckHoleMethod | null, assumed: boolean): string {
  if (assumed || method == null) return "method not confirmed";
  if (method === "hand") return "hand or post-hole auger";
  if (method === "machine") return "machine";
  return "other method";
}

export function describeDeckHoleStamp(stamp: DeckHoleDraftStamp): string {
  const size =
    stamp.shape === "rectangular"
      ? `${stamp.lengthMm ?? "—"} × ${stamp.widthMm ?? "—"} × ${stamp.depthMm ?? "—"} mm`
      : `${stamp.diameterMm ?? "—"} mm diameter × ${stamp.depthMm ?? "—"} mm deep${
          stamp.sizeConfirmed ? "" : " (assumed)"
        }`;
  const volume = stamp.bankM3 == null ? "bank volume not calculated" : `${stamp.bankM3} m³ bank`;
  const concrete =
    stamp.concreteAuthority && stamp.concreteAuthority !== "none"
      ? `, concrete ${stamp.concreteAuthority} ${stamp.concreteBags ?? 0} bags`
      : "";
  return `${stamp.count} ${stamp.shape} holes, ${size}, ${stamp.ground}, ${stamp.method}, spoil ${stamp.spoil}, ${volume}${concrete}`;
}

function spoilChoice(value: string | null): "allowance" | "job" | "rfq" | null {
  if (value === "allowance" || value === "job" || value === "rfq") return value;
  return null;
}

function deckSpoilCharge(params: {
  facts: EstimateFact[];
  workAreaId: string;
  rates: readonly OrganisationRate[] | undefined;
  itemKey: string;
  componentKey: string;
  label: string;
  choiceFact: string;
  costFact: string;
  allowance: number;
  unit: "job" | "load";
  scope: string;
  bankM3: number;
  quantityNote: string;
  smallEligible: boolean;
}): DeckSpoilMoneyLine {
  const company = companySpoilRate(params.rates, params.itemKey);
  if (company) {
    return {
      kind: "priced",
      itemKey: params.itemKey,
      componentKey: params.componentKey,
      label: params.label,
      quantityM3: params.bankM3,
      chargeQuantity: params.bankM3,
      chargeUnit: "m³",
      unitCost: company.cost,
      unitSell: company.sell,
      rateSourceType: "user_rate",
      notes: `${params.quantityNote} Company rate per bank m³. This is not the Quotr per-trip allowance and is not a facility minimum.`,
    };
  }
  const choice = spoilChoice(getStringFact(params.facts, params.workAreaId, params.choiceFact));
  const jobCost = positive(getNumberFact(params.facts, params.workAreaId, params.costFact));
  const base = {
    itemKey: params.itemKey,
    componentKey: params.componentKey,
    label: params.label,
    quantityM3: params.bankM3,
  };
  if (!params.smallEligible) {
    if (choice === "job" && jobCost != null) {
      return {
        ...base,
        kind: "priced",
        chargeQuantity: 1,
        chargeUnit: params.unit,
        unitCost: jobCost,
        unitSell: null,
        rateSourceType: "user_rate",
        rateSourceLabel: "This job",
        notes: "This job's price. Bank volume is not the charge quantity.",
      };
    }
    return {
      ...base,
      kind: "pricing_required",
      chargeQuantity: 1,
      chargeUnit: params.unit,
      unitCost: null,
      unitSell: null,
      rateSourceType: "missing",
      notes: "Outside the small clean local allowance. Enter a job price or request a price. The $150 allowance is not scaled.",
    };
  }
  if (choice === "allowance") {
    return {
      ...base,
      kind: "priced",
      chargeQuantity: 1,
      chargeUnit: params.unit,
      unitCost: params.allowance,
      unitSell: null,
      rateSourceType: "benchmark",
      rateSourceLabel: DECK_SPOIL_ALLOWANCE_SOURCE,
      notes:
        params.componentKey === "deck.spoil.haulage"
          ? DECK_SPOIL_HAULAGE_SUMMARY
          : DECK_SPOIL_TIP_SUMMARY,
    };
  }
  if (choice === "job" && jobCost != null) {
    return {
      ...base,
      kind: "priced",
      chargeQuantity: 1,
      chargeUnit: params.unit,
      unitCost: jobCost,
      unitSell: null,
      rateSourceType: "user_rate",
      rateSourceLabel: "This job",
      notes: "This job's price replaces the provisional allowance.",
    };
  }
  if (choice === "rfq") {
    return {
      ...base,
      kind: "pricing_required",
      chargeQuantity: 1,
      chargeUnit: params.unit,
      unitCost: null,
      unitSell: null,
      rateSourceType: "missing",
      notes: "A price was requested. The provisional allowance is not charged.",
    };
  }
  return {
    ...base,
    kind: "pricing_required",
    chargeQuantity: 1,
    chargeUnit: params.unit,
    unitCost: null,
    unitSell: null,
    rateSourceType: "missing",
    notes: "Choose an allowance, a job price, or a request for price. Nothing is charged until you choose.",
  };
}

export function spoilAccessAllowsAllowance(
  constraints?: readonly { key: string; value: unknown }[] | null
): boolean {
  if (!constraints) return true;
  const read = (key: string) =>
    String(constraints.find((row) => row.key === key)?.value ?? "")
      .trim()
      .toLowerCase();
  const access = read("site_access");
  const bin = read("waste_bin_access");
  if (access === "difficult" || access === "very poor" || access === "not sure") return false;
  if (bin === "poor" || bin === "not sure") return false;
  return true;
}

export function planDeckHoleExcavation(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  holeCount: number;
  rates?: readonly OrganisationRate[];
  constraints?: readonly { key: string; value: unknown }[];
}): DeckHoleExcavationPlan {
  const count = resolveDeckHoleCount({
    facts: params.facts,
    workAreaId: params.workAreaId,
    postCount: params.holeCount,
  });
  const holeCount = count.holeCount;
  if (holeCount === 0) {
    return {
      holeCount: 0,
      postCount: count.postCount,
      count,
      geometry: null,
      productivity: null,
      spoilDestination: "unknown",
      spoilLines: [],
      assumptions: [],
      missingInfo: [],
      draftStamp: null,
      concrete: deriveDeckPostConcrete({
        facts: params.facts,
        workAreaId: params.workAreaId,
        holeCount: 0,
        geometry: null,
      }),
    };
  }

  const facts = [...params.facts];
  const shapeRaw = parseShape(getStringFact(facts, params.workAreaId, DECK_HOLE_SHAPE_FACT));
  const shape = shapeRaw ?? "circular";
  const shapeAssumed = shapeRaw == null;
  const statedDiameter = usableMillimetres(
    getNumberFact(facts, params.workAreaId, DECK_HOLE_DIAMETER_FACT)
  );
  const statedDepth = usableMillimetres(
    getNumberFact(facts, params.workAreaId, DECK_HOLE_DEPTH_FACT)
  );
  const statedLength = usableMillimetres(
    getNumberFact(facts, params.workAreaId, DECK_HOLE_LENGTH_FACT)
  );
  const statedWidth = usableMillimetres(
    getNumberFact(facts, params.workAreaId, DECK_HOLE_WIDTH_FACT)
  );
  const ground = parseGround(getStringFact(facts, params.workAreaId, DECK_HOLE_GROUND_FACT));
  const method = parseMethod(getStringFact(facts, params.workAreaId, DECK_HOLE_METHOD_FACT));
  const groundAssumed = ground == null;
  const methodAssumed = method == null;

  let diameterMm: number | null = null;
  let depthMm: number | null = null;
  let lengthMm: number | null = null;
  let widthMm: number | null = null;
  let diameterAssumed = false;
  let depthAssumed = false;
  let dimensionsComplete = false;
  let volume: { eachM3: number; totalM3: number; formula: string } | null = null;

  if (shape === "rectangular") {
    lengthMm = statedLength;
    widthMm = statedWidth;
    depthMm = statedDepth;
    dimensionsComplete = lengthMm != null && widthMm != null && depthMm != null;
    if (dimensionsComplete && lengthMm != null && widthMm != null && depthMm != null) {
      volume = rectangularBankVolumeM3(lengthMm, widthMm, depthMm, holeCount);
    }
  } else {
    diameterMm = statedDiameter ?? DECK_HOLE_ASSUMED_DIAMETER_MM;
    depthMm = statedDepth ?? DECK_HOLE_ASSUMED_DEPTH_MM;
    diameterAssumed = statedDiameter == null;
    depthAssumed = statedDepth == null;
    dimensionsComplete = !diameterAssumed && !depthAssumed;
    volume = circularBankVolumeM3(diameterMm, depthMm, holeCount);
  }

  const sizeConfirmed =
    shape === "rectangular" ? dimensionsComplete : dimensionsComplete && !diameterAssumed && !depthAssumed;
  const ordinarySize =
    shape === "circular" &&
    diameterMm != null &&
    depthMm != null &&
    deckHoleOrdinaryScope({
      diameterMm,
      depthMm,
      ground: ground ?? "other",
      method: method ?? "other",
    });
  const confirmedOrdinary =
    sizeConfirmed &&
    !groundAssumed &&
    !methodAssumed &&
    ordinarySize;
  const geometry: DeckHoleGeometry = {
    shape,
    diameterMm,
    lengthMm,
    widthMm,
    depthMm,
    diameterAssumed,
    depthAssumed,
    shapeAssumed,
    dimensionsComplete,
    ground,
    groundAssumed,
    method,
    methodAssumed,
    ordinaryScope: confirmedOrdinary,
    bankVolumeEachM3: volume?.eachM3 ?? null,
    bankVolumeM3: volume?.totalM3 ?? null,
    formula: volume?.formula ?? "Bank volume needs a complete hole size.",
  };

  const resolved = resolveProductivity({
    productivityKey: DECK_HOLE_EXCAVATE_KEY,
    unit: "hole",
    fallbackHoursPerUnit: DECK_HOLE_PROVISIONAL_HOURS,
    rates: params.rates,
  });
  const companyHours =
    resolved.sourceType === "user_rate" ||
    resolved.sourceType === "calibrated_productivity";
  const jobHours = positive(
    getNumberFact(facts, params.workAreaId, DECK_HOLE_JOB_HOURS_FACT)
  );
  const hoursUnknown =
    getStringFact(facts, params.workAreaId, DECK_HOLE_HOURS_STATUS_FACT) === "unknown";
  const unsupportedReason = (() => {
    if (hoursUnknown) {
      return "Excavation hours for this ground were marked unknown, so hole excavation is Pricing Required. The approved 0.5 h/hole ordinary-soil rate is not used.";
    }
    if (shape === "rectangular") {
      return "A rectangular hole is outside the approved ordinary hand-dug rate. Enter person-hours per hole for this ground, or mark the hours unknown.";
    }
    if (ground === "rock") {
      return "Rock or hard ground is outside the approved 0.5 h/hole ordinary-soil rate. Enter the expected person-hours per hole, or mark the hours unknown.";
    }
    if (ground === "groundwater") {
      return "Groundwater is outside the approved ordinary hand-dug rate. Enter person-hours per hole, or mark the hours unknown.";
    }
    if (method === "machine") {
      return "Machine digging is outside the approved hand-dug rate. Enter person-hours per hole, or mark the hours unknown.";
    }
    if (method === "other" || ground === "other") {
      return "This ground or method is outside the approved ordinary hand-dug rate. Enter person-hours per hole, or mark the hours unknown.";
    }
    if (!sizeConfirmed || diameterAssumed || depthAssumed || shapeAssumed) {
      return `${DECK_HOLE_CONFIRM_ACTION}. Assumed size is not measured, so the 0.50 h/hole rate is not applied.`;
    }
    if (groundAssumed || methodAssumed) {
      return `${DECK_HOLE_CONFIRM_ACTION}. Ground and hand excavation must be confirmed before the 0.50 h/hole rate is used.`;
    }
    return "This hole size is outside the ordinary 250–450 mm by 400–900 mm hand-dug scope. Enter person-hours per hole, or mark the hours unknown.";
  })();
  const productivity: DeckHoleProductivity = jobHours != null
    ? {
        applies: true,
        hoursPerHole: jobHours,
        sourceLabel: "This job",
        sourceType: "user_rate",
        reason: `This job: ${jobHours} h/hole. The approved 0.5 h/hole ordinary-soil rate is not used.`,
      }
    : hoursUnknown
      ? {
          applies: false,
          hoursPerHole: 0,
          sourceLabel: "Pricing required",
          sourceType: "missing",
          reason: unsupportedReason,
        }
      : companyHours
        ? {
            applies: resolved.hoursPerUnit > 0,
            hoursPerHole: resolved.hoursPerUnit,
            sourceLabel: resolved.sourceLabel,
            sourceType: resolved.sourceType as "user_rate" | "calibrated_productivity",
            reason: "Company or calibrated hours per hole replace the approved Quotr figure.",
          }
        : confirmedOrdinary
          ? {
              applies: true,
              hoursPerHole: DECK_HOLE_PROVISIONAL_HOURS,
              sourceLabel: resolved.sourceLabel,
              sourceType: "benchmark",
              reason: `Approved Quotr benchmark, 14 October 2026, ordinary scope only: ${DECK_HOLE_PROVISIONAL_HOURS} h/hole. Access is applied once. ${DECK_HOLE_ORDINARY_SCOPE}`,
            }
          : {
              applies: false,
              hoursPerHole: 0,
              sourceLabel: "Pricing required",
              sourceType: "missing",
              reason: unsupportedReason,
            };

  const spoilDestination = parseSpoil(facts, params.workAreaId);
  const assumptions: string[] = [];
  if (count.overrideRequested && count.reason) {
    assumptions.push(
      `Hole count ${holeCount} is not the post count ${count.postCount}. Reason: ${count.reason}.`
    );
  }
  if (shape === "rectangular") {
    if (!dimensionsComplete) {
      assumptions.push(
        "Rectangular hole length, width, and depth are not complete. Bank volume is not calculated until they are entered."
      );
    } else {
      assumptions.push(
        `Confirmed rectangular hole ${lengthMm} × ${widthMm} × ${depthMm} mm. ${volume?.formula} = ${volume?.totalM3} m³ bank.`
      );
    }
  } else if (diameterAssumed || depthAssumed) {
    assumptions.push(
      `Assumed circular hole ${diameterMm} mm diameter × ${depthMm} mm deep — not measured. ${volume?.formula} = ${volume?.totalM3} m³ bank. ${DECK_HOLE_CONFIRM_ACTION}.`
    );
  } else {
    assumptions.push(
      `Confirmed circular hole ${diameterMm} mm diameter × ${depthMm} mm deep. ${volume?.formula} = ${volume?.totalM3} m³ bank.`
    );
  }
  assumptions.push(
    `${groundLabel(ground, groundAssumed)}. ${methodLabel(method, methodAssumed)}.`
  );
  assumptions.push(
    "Bank volume is in-situ m³. Loose spoil is not calculated, and the roughly 3× swell note is not applied."
  );
  const bankText =
    volume == null ? "Bank volume is not calculated yet." : `${volume.totalM3} m³ bank`;
  if (spoilDestination === "on_site") {
    assumptions.push(
      `Spoil stays on site (${bankText}). No haulage or tip charge. This is post-hole soil, not deck demolition waste.`
    );
  } else if (spoilDestination === "off_site") {
    assumptions.push(
      `Spoil is taken off site. Quantity is ${bankText}, not loose m³. Haulage and tip are separate unless one all-in company rate covers both.`
    );
  } else {
    assumptions.push(
      `Spoil destination is not confirmed. ${bankText} is shown and disposal money is Pricing Required until the builder keeps it on site or prices haulage and tip.`
    );
  }

  const missingInfo: string[] = [];
  if (count.reasonMissing && count.typedCount != null) {
    missingInfo.push(
      `Hole count ${count.typedCount} needs a short reason before it can differ from the post count ${count.postCount}.`
    );
  }
  if (!productivity.applies) missingInfo.push("Hole excavation productivity");
  if (shape === "rectangular" && !dimensionsComplete) {
    missingInfo.push("Rectangular hole length, width, and depth");
  }

  const spoilLines: DeckSpoilMoneyLine[] = [];
  const quantityM3 = volume?.totalM3 ?? 0;
  const quantityNote = volume
    ? `${volume.totalM3} m³ bank. ${volume.formula}. Not loose m³ and not deck demolition waste.`
    : "Bank volume is waiting for a complete hole size. Not loose m³ and not deck demolition waste.";
  if (volume && spoilDestination === "unknown") {
    missingInfo.push("Spoil destination");
    spoilLines.push({
      kind: "pricing_required",
      itemKey: DECK_SPOIL_DECISION_COMPONENT,
      componentKey: DECK_SPOIL_DECISION_COMPONENT,
      label: "Post-hole spoil destination",
      quantityM3,
      chargeQuantity: quantityM3,
      chargeUnit: "m³",
      unitCost: null,
      unitSell: null,
      rateSourceType: "missing",
      notes: `${quantityNote} Choose retain on site (no disposal charge) or remove off site (haulage and tip).`,
    });
  } else if (volume && spoilDestination === "off_site") {
    const fit = getStringFact(facts, params.workAreaId, DECK_SPOIL_FIT_FACT) ?? "";
    const smallEligible =
      quantityM3 > 0 &&
      quantityM3 <= DECK_SPOIL_SMALL_BANK_MAX_M3 &&
      fit !== "other" &&
      fit !== "unknown" &&
      spoilAccessAllowsAllowance(params.constraints);
    const allIn = companySpoilRate(params.rates, DECK_SPOIL_ALL_IN_KEY);
    if (allIn) {
      spoilLines.push({
        kind: "priced",
        itemKey: DECK_SPOIL_ALL_IN_KEY,
        componentKey: DECK_SPOIL_ALL_IN_COMPONENT,
        label: "Post-hole spoil removal",
        quantityM3,
        chargeQuantity: quantityM3,
        chargeUnit: "m³",
        unitCost: allIn.cost,
        unitSell: allIn.sell,
        rateSourceType: "user_rate",
        notes: `${quantityNote} Company all-in rate per bank m³ covers loading, haulage, and tip once. It is not the Quotr per-trip allowance. No separate tip line.`,
      });
    } else {
      spoilLines.push(
        deckSpoilCharge({
          facts,
          workAreaId: params.workAreaId,
          rates: params.rates,
          itemKey: DECK_SPOIL_HAULAGE_KEY,
          componentKey: DECK_SPOIL_HAULAGE_COMPONENT,
          label: "Post-hole spoil loading and local haulage",
          choiceFact: DECK_SPOIL_HAULAGE_CHOICE_FACT,
          costFact: DECK_SPOIL_HAULAGE_COST_FACT,
          allowance: DECK_SPOIL_HAULAGE_ALLOWANCE_EX_GST,
          unit: "job",
          scope: DECK_SPOIL_HAULAGE_SCOPE,
          bankM3: quantityM3,
          quantityNote,
          smallEligible,
        }),
        deckSpoilCharge({
          facts,
          workAreaId: params.workAreaId,
          rates: params.rates,
          itemKey: DECK_SPOIL_TIP_KEY,
          componentKey: DECK_SPOIL_TIP_COMPONENT,
          label: "Post-hole spoil tip fee",
          choiceFact: DECK_SPOIL_TIP_CHOICE_FACT,
          costFact: DECK_SPOIL_TIP_COST_FACT,
          allowance: DECK_SPOIL_TIP_ALLOWANCE_EX_GST,
          unit: "load",
          scope: DECK_SPOIL_TIP_SCOPE,
          bankM3: quantityM3,
          quantityNote,
          smallEligible,
        })
      );
      for (const line of spoilLines) {
        if (line.kind === "pricing_required" && line.componentKey !== DECK_SPOIL_DECISION_COMPONENT) {
          missingInfo.push(line.label);
        }
      }
      if (spoilLines.some((line) => line.rateSourceLabel === DECK_SPOIL_ALLOWANCE_SOURCE)) {
        assumptions.push(
          `${DECK_SPOIL_HAULAGE_SCOPE} ${DECK_SPOIL_TIP_SCOPE} ${DECK_SPOIL_ALLOWANCE_CONTEXT} Bank volume stays separate from loose volume, and no swell factor is applied.`
        );
      }
    }
  }

  const needsConfirmation = !sizeConfirmed || groundAssumed || methodAssumed;
  const concrete = deriveDeckPostConcrete({
    facts,
    workAreaId: params.workAreaId,
    holeCount,
    geometry,
  });
  const draftStamp: DeckHoleDraftStamp = {
    count: holeCount,
    shape,
    diameterMm,
    lengthMm,
    widthMm,
    depthMm,
    ground: groundLabel(ground, groundAssumed),
    method: methodLabel(method, methodAssumed),
    spoil: spoilDestination,
    sizeConfirmed,
    groundConfirmed: !groundAssumed,
    methodConfirmed: !methodAssumed,
    bankM3: volume?.totalM3 ?? null,
    needsConfirmation,
    ...concrete.stamp,
  };

  return {
    holeCount,
    postCount: count.postCount,
    count,
    geometry,
    productivity,
    spoilDestination,
    spoilLines,
    assumptions,
    missingInfo,
    draftStamp,
    concrete,
  };
}

export function planDeckPostConcrete(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  holeCount: number;
}): DeckPostConcretePlan {
  return planDeckHoleExcavation({
    facts: params.facts,
    workAreaId: params.workAreaId,
    holeCount: params.holeCount,
  }).concrete;
}

export function deckHoleStampsDiffer(
  saved: DeckHoleDraftStamp,
  next: DeckHoleDraftStamp
): boolean {
  return (
    saved.count !== next.count ||
    saved.shape !== next.shape ||
    saved.diameterMm !== next.diameterMm ||
    saved.lengthMm !== next.lengthMm ||
    saved.widthMm !== next.widthMm ||
    saved.depthMm !== next.depthMm ||
    saved.ground !== next.ground ||
    saved.method !== next.method ||
    saved.spoil !== next.spoil ||
    saved.sizeConfirmed !== next.sizeConfirmed ||
    saved.groundConfirmed !== next.groundConfirmed ||
    saved.methodConfirmed !== next.methodConfirmed ||
    !closeVolume(saved.bankM3, next.bankM3) ||
    concreteStampChanged(saved, next)
  );
}

function concreteStampChanged(
  saved: DeckHoleDraftStamp,
  next: DeckHoleDraftStamp
): boolean {
  const savedAuthority = saved.concreteAuthority ?? null;
  const nextAuthority = next.concreteAuthority ?? null;
  if (savedAuthority == null && (nextAuthority == null || nextAuthority === "none")) {
    return false;
  }
  return (
    savedAuthority !== nextAuthority ||
    (saved.concreteFill ?? null) !== (next.concreteFill ?? null) ||
    (saved.concreteFillDepthMm ?? null) !== (next.concreteFillDepthMm ?? null) ||
    (saved.postSection ?? null) !== (next.postSection ?? null) ||
    (saved.postEmbedmentMm ?? null) !== (next.postEmbedmentMm ?? null) ||
    !closeVolume(saved.concreteYieldM3 ?? null, next.concreteYieldM3 ?? null) ||
    (saved.concreteBags ?? null) !== (next.concreteBags ?? null) ||
    (saved.concreteProductKey ?? null) !== (next.concreteProductKey ?? null)
  );
}

function closeVolume(left: number | null, right: number | null): boolean {
  if (left == null || right == null) return left === right;
  return Math.abs(left - right) < 0.0005;
}
