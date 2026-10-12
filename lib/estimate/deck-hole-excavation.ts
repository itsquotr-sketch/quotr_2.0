/**
 * Deck post-hole excavation and bank spoil.
 *
 * Ordinary task (provisional Quotr productivity only inside this scope):
 * - Ground: soil a hand post-hole spade or hand auger can dig.
 * - Method: hand excavation. No machine hire.
 * - Hole: one circular hole, diameter 250–450 mm, depth 400–900 mm.
 * - Includes: marking that hole and placing the dug soil at the immediate workface.
 * - Excludes: post or pile setting, concrete placement, rock, groundwater,
 *   dewatering, truck loading, haulage, tip fees, and deck demolition waste.
 *
 * The provisional figure is 0.50 person-hours per hole (one person, 30 minutes).
 * It is not the 1.00 h pile/post installation and not the 0.0667 h/bag concrete
 * placement. A company or calibrated hours-per-hole on this key wins, including
 * outside this scope. Outside the scope with no company hours, the line is
 * Pricing Required.
 *
 * Bank volume is in-situ m³. Loose spoil is not calculated. The roughly 3×
 * swell note is not an approved factor.
 */
import { getBooleanFact, getNumberFact, getStringFact, round2 } from "@/lib/estimate/facts";
import { resolveProductivity } from "@/lib/estimate/productivity";
import type { OrganisationRate } from "@/components/setup/types";
import type { EstimateFact } from "@/lib/estimate/types";

export const DECK_HOLE_EXCAVATE_KEY = "deck.hole.excavate.hours_per_hole" as const;
export const DECK_HOLE_EXCAVATE_COMPONENT = "deck.hole.excavate" as const;
export const DECK_HOLE_DIAMETER_FACT = "deck.hole_diameter_mm" as const;
export const DECK_HOLE_DEPTH_FACT = "deck.hole_depth_mm" as const;
export const DECK_HOLE_GROUND_FACT = "deck.hole_ground" as const;
export const DECK_SPOIL_LEAVES_SITE_FACT = "deck.spoil_leaves_site" as const;

export const DECK_SPOIL_ALL_IN_KEY = "deck.spoil.removal.all_in.m3" as const;
export const DECK_SPOIL_HAULAGE_KEY = "deck.spoil.haulage.m3" as const;
export const DECK_SPOIL_TIP_KEY = "deck.spoil.tip.m3" as const;
export const DECK_SPOIL_ALL_IN_COMPONENT = "deck.spoil.removal" as const;
export const DECK_SPOIL_HAULAGE_COMPONENT = "deck.spoil.haulage" as const;
export const DECK_SPOIL_TIP_COMPONENT = "deck.spoil.tip" as const;
export const DECK_SPOIL_DECISION_COMPONENT = "deck.spoil.destination" as const;

export const DECK_HOLE_ASSUMED_DIAMETER_MM = 350;
export const DECK_HOLE_ASSUMED_DEPTH_MM = 600;
/** One person for 30 minutes. Provisional, ordinary scope only. */
export const DECK_HOLE_PROVISIONAL_HOURS = 0.5;

export const DECK_HOLE_ORDINARY_DIAMETER_MIN_MM = 250;
export const DECK_HOLE_ORDINARY_DIAMETER_MAX_MM = 450;
export const DECK_HOLE_ORDINARY_DEPTH_MIN_MM = 400;
export const DECK_HOLE_ORDINARY_DEPTH_MAX_MM = 900;

export const DECK_HOLE_ORDINARY_SCOPE =
  "Ordinary hand-dug circular deck post hole in soil a post-hole spade or hand auger can dig, 250–450 mm diameter and 400–900 mm deep. Includes marking the hole and placing spoil at the immediate workface. Excludes post setting, concrete, rock, groundwater, machine hire, truck loading, haulage, tip fees, and deck demolition.";

export type DeckHoleGeometry = {
  readonly shape: "circular";
  readonly diameterMm: number;
  readonly depthMm: number;
  readonly diameterAssumed: boolean;
  readonly depthAssumed: boolean;
  readonly ground: "ordinary" | "unsupported";
  readonly groundAssumed: boolean;
  readonly ordinaryScope: boolean;
  readonly bankVolumeEachM3: number;
  readonly bankVolumeM3: number;
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
  readonly quantityM3: number;
  readonly unitCost: number | null;
  readonly unitSell: number | null;
  readonly notes: string;
};

export type DeckHoleExcavationPlan = {
  readonly holeCount: number;
  readonly geometry: DeckHoleGeometry | null;
  readonly productivity: DeckHoleProductivity | null;
  readonly spoilDestination: DeckSpoilDestination;
  readonly spoilLines: readonly DeckSpoilMoneyLine[];
  readonly assumptions: readonly string[];
  readonly missingInfo: readonly string[];
};

function positive(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

export function deckHoleOrdinaryScope(params: {
  diameterMm: number;
  depthMm: number;
  ground: "ordinary" | "unsupported";
}): boolean {
  return (
    params.ground === "ordinary" &&
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
  const radiusM = diameterMm / 2000;
  const depthM = depthMm / 1000;
  const each = Math.PI * radiusM * radiusM * depthM;
  const total = each * holeCount;
  const formula = `${holeCount} × π × (${diameterMm}/2000 m)² × (${depthMm}/1000 m) bank m³`;
  return {
    eachM3: round2(each),
    totalM3: round2(total),
    formula,
  };
}

function parseGround(value: string | null): "ordinary" | "unsupported" | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (!text || text === "not sure") return null;
  if (text === "ordinary" || text.includes("ordinary soil") || text === "soil") {
    return "ordinary";
  }
  return "unsupported";
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

export function planDeckHoleExcavation(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  holeCount: number;
  rates?: readonly OrganisationRate[];
}): DeckHoleExcavationPlan {
  const holeCount = Math.max(0, Math.round(params.holeCount));
  if (holeCount === 0) {
    return {
      holeCount: 0,
      geometry: null,
      productivity: null,
      spoilDestination: "unknown",
      spoilLines: [],
      assumptions: [],
      missingInfo: [],
    };
  }

  const facts = [...params.facts];
  const statedDiameter = positive(
    getNumberFact(facts, params.workAreaId, DECK_HOLE_DIAMETER_FACT)
  );
  const statedDepth = positive(
    getNumberFact(facts, params.workAreaId, DECK_HOLE_DEPTH_FACT)
  );
  const diameterMm = statedDiameter ?? DECK_HOLE_ASSUMED_DIAMETER_MM;
  const depthMm = statedDepth ?? DECK_HOLE_ASSUMED_DEPTH_MM;
  const diameterAssumed = statedDiameter == null;
  const depthAssumed = statedDepth == null;
  const groundRaw = parseGround(
    getStringFact(facts, params.workAreaId, DECK_HOLE_GROUND_FACT)
  );
  const ground = groundRaw ?? "ordinary";
  const groundAssumed = groundRaw == null;
  const ordinaryScope = deckHoleOrdinaryScope({ diameterMm, depthMm, ground });
  const volume = circularBankVolumeM3(diameterMm, depthMm, holeCount);
  const geometry: DeckHoleGeometry = {
    shape: "circular",
    diameterMm,
    depthMm,
    diameterAssumed,
    depthAssumed,
    ground,
    groundAssumed,
    ordinaryScope,
    bankVolumeEachM3: volume.eachM3,
    bankVolumeM3: volume.totalM3,
    formula: volume.formula,
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
  const productivity: DeckHoleProductivity = companyHours
    ? {
        applies: resolved.hoursPerUnit > 0,
        hoursPerHole: resolved.hoursPerUnit,
        sourceLabel: resolved.sourceLabel,
        sourceType: resolved.sourceType as "user_rate" | "calibrated_productivity",
        reason: companyHours
          ? "Company or calibrated hours per hole replace the provisional Quotr figure."
          : "",
      }
    : ordinaryScope
      ? {
          applies: true,
          hoursPerHole: DECK_HOLE_PROVISIONAL_HOURS,
          sourceLabel: resolved.sourceLabel,
          sourceType: "benchmark",
          reason: `Provisional Quotr productivity, ordinary scope only: ${DECK_HOLE_PROVISIONAL_HOURS} h/hole. ${DECK_HOLE_ORDINARY_SCOPE}`,
        }
      : {
          applies: false,
          hoursPerHole: 0,
          sourceLabel: "Pricing required",
          sourceType: "missing",
          reason: ground === "unsupported"
            ? "This ground is outside the ordinary hand-dug scope. Enter a job hours-per-hole or a scoped price."
            : "This hole size is outside the ordinary 250–450 mm by 400–900 mm hand-dug scope. Enter a job hours-per-hole or a scoped price.",
        };

  const leaves = getBooleanFact(facts, params.workAreaId, DECK_SPOIL_LEAVES_SITE_FACT);
  const spoilDestination: DeckSpoilDestination =
    leaves === true ? "off_site" : leaves === false ? "on_site" : "unknown";

  const assumptions: string[] = [];
  const sizeWords = `${diameterMm} mm diameter × ${depthMm} mm deep`;
  if (diameterAssumed || depthAssumed) {
    assumptions.push(
      `Assumed circular hole ${sizeWords} — not measured. ${volume.formula} = ${volume.totalM3} m³ bank. Confirm the hole before Pricing.`
    );
  } else {
    assumptions.push(
      `Confirmed circular hole ${sizeWords}. ${volume.formula} = ${volume.totalM3} m³ bank.`
    );
  }
  if (groundAssumed) {
    assumptions.push(
      "Assumed ordinary soil for a hand post-hole spade or auger. Rock, groundwater, or a machine dig needs its own hours or price."
    );
  }
  assumptions.push(
    "Bank volume is in-situ m³. Loose spoil is not calculated, and the roughly 3× swell note is not applied."
  );
  if (spoilDestination === "on_site") {
    assumptions.push(
      `Spoil stays on site (${volume.totalM3} m³ bank). No haulage or tip charge. This is post-hole soil, not deck demolition waste.`
    );
  } else if (spoilDestination === "off_site") {
    assumptions.push(
      `Spoil is taken off site. Quantity is ${volume.totalM3} m³ bank, not loose m³. Haulage and tip are separate unless one all-in company rate covers both.`
    );
  } else {
    assumptions.push(
      `Spoil destination is not confirmed. ${volume.totalM3} m³ bank is shown and disposal money is Pricing Required until the builder keeps it on site or prices haulage and tip.`
    );
  }

  const missingInfo: string[] = [];
  if (!productivity.applies) {
    missingInfo.push("Hole excavation productivity");
  }

  const spoilLines: DeckSpoilMoneyLine[] = [];
  const quantityNote = `${volume.totalM3} m³ bank. ${volume.formula}. Not loose m³ and not deck demolition waste.`;
  if (spoilDestination === "unknown") {
    missingInfo.push("Spoil destination");
    spoilLines.push({
      kind: "pricing_required",
      itemKey: DECK_SPOIL_DECISION_COMPONENT,
      componentKey: DECK_SPOIL_DECISION_COMPONENT,
      label: "Post-hole spoil destination",
      quantityM3: volume.totalM3,
      unitCost: null,
      unitSell: null,
      notes: `${quantityNote} Choose on site (no disposal charge) or off site (haulage and tip).`,
    });
  } else if (spoilDestination === "off_site") {
    const allIn = companySpoilRate(params.rates, DECK_SPOIL_ALL_IN_KEY);
    if (allIn) {
      spoilLines.push({
        kind: "priced",
        itemKey: DECK_SPOIL_ALL_IN_KEY,
        componentKey: DECK_SPOIL_ALL_IN_COMPONENT,
        label: "Post-hole spoil removal",
        quantityM3: volume.totalM3,
        unitCost: allIn.cost,
        unitSell: allIn.sell,
        notes: `${quantityNote} Company all-in rate covers loading, haulage, and tip once. No separate tip line.`,
      });
    } else {
      const haulage = companySpoilRate(params.rates, DECK_SPOIL_HAULAGE_KEY);
      const tip = companySpoilRate(params.rates, DECK_SPOIL_TIP_KEY);
      spoilLines.push({
        kind: haulage ? "priced" : "pricing_required",
        itemKey: DECK_SPOIL_HAULAGE_KEY,
        componentKey: DECK_SPOIL_HAULAGE_COMPONENT,
        label: "Post-hole spoil loading and haulage",
        quantityM3: volume.totalM3,
        unitCost: haulage?.cost ?? null,
        unitSell: haulage?.sell ?? null,
        notes: `${quantityNote} Loading onto a truck and haulage. Not the hand-dig hours, and not a tip fee.`,
      });
      spoilLines.push({
        kind: tip ? "priced" : "pricing_required",
        itemKey: DECK_SPOIL_TIP_KEY,
        componentKey: DECK_SPOIL_TIP_COMPONENT,
        label: "Post-hole spoil tip fee",
        quantityM3: volume.totalM3,
        unitCost: tip?.cost ?? null,
        unitSell: tip?.sell ?? null,
        notes: `${quantityNote} Tip fee only. Not added on top of an all-in removal rate.`,
      });
      if (!haulage) missingInfo.push("Spoil loading and haulage rate");
      if (!tip) missingInfo.push("Spoil tip fee");
    }
  }

  return {
    holeCount,
    geometry,
    productivity,
    spoilDestination,
    spoilLines,
    assumptions,
    missingInfo,
  };
}
