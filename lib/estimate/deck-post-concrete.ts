/**
 * Deck post-hole concrete quantity.
 *
 * Purchased bags come from the concrete fill volume and the 20 kg bag yield.
 * A company bags-per-hole figure replaces that volume. A fixed 2.5 bags per
 * hole is not a takeoff.
 *
 * Bags = ceil(full-precision net m³ / yield) for the job. Display rounding
 * does not change the bag count. No extra waste percentage is added.
 */
import { getBooleanFact, getNumberFact, getStringFact } from "@/lib/estimate/facts";
import type { DeckHoleGeometry } from "@/lib/estimate/deck-hole-excavation";
import {
  DECK_CONCRETE_MATERIAL_ITEM_KEY,
  DECK_CONCRETE_TO_SUPPORTS_FACT_KEY,
  concreteBagsPerHole,
  purchasedConcreteBags,
} from "@/lib/estimate/deck-scope-2c";
import {
  bagCountFromNetConcrete,
  POST_HOLE_PREMIX_20KG_YIELD_M3,
  rectangularSectionDisplacementM3,
} from "@/lib/estimate/post-hole-concrete";
import type { EstimateFact } from "@/lib/estimate/types";

export const DECK_CONCRETE_FILL_FACT = "deck.concrete_fill";
export const DECK_CONCRETE_FILL_DEPTH_FACT = "deck.concrete_fill_depth_mm";
export const DECK_POST_EMBEDMENT_MM_FACT = "deck.post_embedment_mm";
export const DECK_CONCRETE_YIELD_FACT = "deck.concrete_bag_yield_m3";

export const DECK_CONCRETE_YIELD_SOURCE =
  "Quotr 20 kg general-purpose premix mixed yield, 0.01 m³ per bag. Merchant bags vary about 9–11 litres. This is the yield recorded for this 20 kg premix.";

export const DECK_CONCRETE_ROUNDING_RULE =
  "Purchased bags are the full-precision job total divided by the bag yield, rounded up to the next whole bag. No extra waste percentage is added.";

export type DeckConcreteAuthority = "measured" | "provisional" | "company" | "none";
export type DeckConcreteFill = "full" | "partial" | "unconfirmed";

export type DeckPostConcreteStamp = {
  readonly concreteAuthority: DeckConcreteAuthority;
  readonly concreteFill: DeckConcreteFill;
  readonly concreteFillDepthMm: number | null;
  readonly postSection: string | null;
  readonly postEmbedmentMm: number | null;
  readonly concreteYieldM3: number | null;
  readonly concreteBags: number;
  readonly concreteProductKey: string | null;
};

export type DeckPostConcretePlan = {
  readonly included: boolean;
  readonly authority: DeckConcreteAuthority;
  readonly bags: number;
  readonly holeVolumeM3: number | null;
  readonly fillVolumeM3: number | null;
  readonly displacementM3: number | null;
  readonly netM3: number | null;
  readonly yieldM3: number | null;
  readonly yieldSource: string | null;
  readonly postSection: string | null;
  readonly postEmbedmentMm: number | null;
  readonly fill: DeckConcreteFill;
  readonly fillDepthMm: number | null;
  readonly remainingFill: string;
  readonly disclosure: string;
  readonly formula: string;
  readonly stamp: DeckPostConcreteStamp;
};

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function formatM3(value: number): string {
  return round3(value).toFixed(3);
}

function sectionSidesM(section: string | null): { widthM: number; depthM: number } | null {
  const match = /^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)$/i.exec((section ?? "").trim());
  if (!match) return null;
  const widthMm = Number(match[1]);
  const depthMm = Number(match[2]);
  if (!(widthMm > 0) || !(depthMm > 0)) return null;
  return { widthM: widthMm / 1000, depthM: depthMm / 1000 };
}

function holeAreaM2(geometry: DeckHoleGeometry | null): number | null {
  if (!geometry) return null;
  if (geometry.shape === "rectangular") {
    if (geometry.lengthMm == null || geometry.widthMm == null) return null;
    return (geometry.lengthMm / 1000) * (geometry.widthMm / 1000);
  }
  if (geometry.diameterMm == null) return null;
  const radiusM = geometry.diameterMm / 1000 / 2;
  return Math.PI * radiusM * radiusM;
}

function holeShapeLabel(geometry: DeckHoleGeometry | null): string {
  if (!geometry) return "Hole dimensions are not set";
  if (geometry.shape === "rectangular") {
    return `Rectangular hole ${geometry.lengthMm ?? "—"} × ${geometry.widthMm ?? "—"} × ${geometry.depthMm ?? "—"} mm`;
  }
  const assumed = geometry.diameterAssumed || geometry.depthAssumed ? " (assumed size)" : "";
  return `Circular hole ${geometry.diameterMm ?? "—"} mm diameter × ${geometry.depthMm ?? "—"} mm deep${assumed}`;
}

function nonePlan(): DeckPostConcretePlan {
  return {
    included: false,
    authority: "none",
    bags: 0,
    holeVolumeM3: null,
    fillVolumeM3: null,
    displacementM3: null,
    netM3: null,
    yieldM3: null,
    yieldSource: null,
    postSection: null,
    postEmbedmentMm: null,
    fill: "unconfirmed",
    fillDepthMm: null,
    remainingFill: "",
    disclosure: "",
    formula: "",
    stamp: {
      concreteAuthority: "none",
      concreteFill: "unconfirmed",
      concreteFillDepthMm: null,
      postSection: null,
      postEmbedmentMm: null,
      concreteYieldM3: null,
      concreteBags: 0,
      concreteProductKey: null,
    },
  };
}

export function deriveDeckPostConcrete(params: {
  facts: readonly EstimateFact[];
  workAreaId: string;
  holeCount: number;
  geometry: DeckHoleGeometry | null;
}): DeckPostConcretePlan {
  const facts = [...params.facts];
  const included =
    getBooleanFact(facts, params.workAreaId, DECK_CONCRETE_TO_SUPPORTS_FACT_KEY) === true;
  if (!included || params.holeCount <= 0) return nonePlan();

  const geometry = params.geometry;
  const areaM2 = holeAreaM2(geometry);
  const holeDepthMm = geometry?.depthMm ?? null;
  const holeVolumeM3 =
    areaM2 != null && holeDepthMm != null ? areaM2 * (holeDepthMm / 1000) * params.holeCount : null;

  const explicitYield = getNumberFact(facts, params.workAreaId, DECK_CONCRETE_YIELD_FACT);
  const yieldKnown = explicitYield != null && explicitYield > 0;
  const yieldM3 = yieldKnown ? explicitYield : POST_HOLE_PREMIX_20KG_YIELD_M3;
  const yieldSource = yieldKnown
    ? "Company yield for this 20 kg bag."
    : DECK_CONCRETE_YIELD_SOURCE;

  const postSection = getStringFact(facts, params.workAreaId, "deck.support_section")?.trim() || null;
  const sides = sectionSidesM(postSection);
  const embedmentMm = getNumberFact(facts, params.workAreaId, DECK_POST_EMBEDMENT_MM_FACT);
  const embedmentKnown = embedmentMm != null && embedmentMm > 0;
  const postKnown = sides != null && embedmentKnown;

  const fillRaw = getStringFact(facts, params.workAreaId, DECK_CONCRETE_FILL_FACT)?.trim().toLowerCase();
  const requestedFillDepth = getNumberFact(facts, params.workAreaId, DECK_CONCRETE_FILL_DEPTH_FACT);
  let fill: DeckConcreteFill = "unconfirmed";
  let fillDepthMm: number | null = null;
  let remainingFill = "Fill depth is not confirmed. The provisional quantity uses the full hole.";
  if (fillRaw === "full" && holeDepthMm != null) {
    fill = "full";
    fillDepthMm = holeDepthMm;
    remainingFill = "The hole is fully concreted.";
  } else if (
    fillRaw === "partial" &&
    requestedFillDepth != null &&
    requestedFillDepth > 0 &&
    holeDepthMm != null &&
    requestedFillDepth <= holeDepthMm
  ) {
    fill = "partial";
    fillDepthMm = requestedFillDepth;
    const restMm = Math.round(holeDepthMm - requestedFillDepth);
    remainingFill = `Concrete occupies the bottom ${Math.round(requestedFillDepth)} mm. The remaining ${restMm} mm of the hole is left unconcreted.`;
  } else if (fillRaw === "partial") {
    remainingFill = "A partial fill was selected. Enter a fill depth within the hole depth.";
  }

  const fillEstablished = fill !== "unconfirmed" && fillDepthMm != null && areaM2 != null;
  const fillVolumeM3 =
    fillEstablished && fillDepthMm != null && areaM2 != null
      ? areaM2 * (fillDepthMm / 1000) * params.holeCount
      : holeVolumeM3;

  let displacementM3: number | null = null;
  let displacementNote = "Post size and embedded depth are not confirmed, so post displacement is not deducted.";
  if (postKnown && sides && embedmentKnown && embedmentMm != null && fillEstablished && fillDepthMm != null) {
    const displacementDepthMm = Math.min(embedmentMm, fillDepthMm);
    displacementM3 =
      rectangularSectionDisplacementM3(sides.widthM, sides.depthM, displacementDepthMm / 1000) *
      params.holeCount;
    displacementNote = `Post ${postSection}, embedded ${Math.round(embedmentMm)} mm. Displacement uses ${Math.round(displacementDepthMm)} mm inside the concrete.`;
  } else if (sides && !embedmentKnown) {
    displacementNote = `Post ${postSection} is set. Embedded depth is not confirmed, so post displacement is not deducted.`;
  } else if (!sides && embedmentKnown) {
    displacementNote = "Embedded depth is set. Post size is not confirmed, so post displacement is not deducted.";
  }

  const companyBagsEach = concreteBagsPerHole(facts, params.workAreaId);
  const shape = holeShapeLabel(geometry);
  const countLabel = `${params.holeCount} holes`;

  if (companyBagsEach != null) {
    const bags = purchasedConcreteBags(params.holeCount, companyBagsEach);
    const volumeNote =
      holeVolumeM3 != null
        ? ` Hole volume ${formatM3(holeVolumeM3)} m³.`
        : "";
    const disclosure = `${countLabel}. ${shape}.${volumeNote} Company-specified quantity: ${companyBagsEach} bags per hole, ${bags} bags purchased. Whole bags are rounded up. This replaces the volume takeoff. Yield ${yieldM3} m³/bag. ${yieldSource}`;
    return {
      included: true,
      authority: "company",
      bags,
      holeVolumeM3,
      fillVolumeM3,
      displacementM3,
      netM3: fillVolumeM3 != null && displacementM3 != null ? Math.max(fillVolumeM3 - displacementM3, 0) : fillVolumeM3,
      yieldM3,
      yieldSource,
      postSection,
      postEmbedmentMm: embedmentKnown ? embedmentMm : null,
      fill,
      fillDepthMm,
      remainingFill,
      disclosure,
      formula: `${params.holeCount} holes × ${companyBagsEach} company bags/hole, rounded up to whole bags`,
      stamp: {
        concreteAuthority: "company",
        concreteFill: fill,
        concreteFillDepthMm: fillDepthMm,
        postSection,
        postEmbedmentMm: embedmentKnown ? embedmentMm : null,
        concreteYieldM3: yieldM3,
        concreteBags: bags,
        concreteProductKey: DECK_CONCRETE_MATERIAL_ITEM_KEY,
      },
    };
  }

  const provisional = !fillEstablished || !postKnown || holeVolumeM3 == null;
  const gross = provisional ? holeVolumeM3 : fillVolumeM3;
  const displacementApplied = provisional ? 0 : displacementM3 ?? 0;
  const netM3 = gross != null ? Math.max(gross - displacementApplied, 0) : null;
  const bags = netM3 != null && yieldM3 > 0 ? bagCountFromNetConcrete(netM3, yieldM3) : 0;
  const authority: DeckConcreteAuthority = provisional ? "provisional" : "measured";

  const volumeLines = [
    `${countLabel}. ${shape}.`,
    holeVolumeM3 != null ? `Hole volume ${formatM3(holeVolumeM3)} m³.` : "Hole volume cannot be calculated.",
    remainingFill,
    displacementNote,
    displacementM3 != null && !provisional ? `Post displacement ${formatM3(displacementM3)} m³.` : null,
    netM3 != null ? `Net concrete ${formatM3(netM3)} m³.` : null,
    `Yield ${yieldM3} m³ per 20 kg bag. ${yieldSource}`,
    bags > 0 ? `${bags} bags.` : "Bag count cannot be calculated.",
    DECK_CONCRETE_ROUNDING_RULE,
    provisional
      ? "Provisional concrete quantity. Confirm the fill, the post size, and the embedded depth before Pricing."
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");

  return {
    included: true,
    authority,
    bags,
    holeVolumeM3,
    fillVolumeM3: provisional ? holeVolumeM3 : fillVolumeM3,
    displacementM3: provisional ? 0 : displacementM3,
    netM3,
    yieldM3,
    yieldSource,
    postSection,
    postEmbedmentMm: embedmentKnown ? embedmentMm : null,
    fill,
    fillDepthMm,
    remainingFill,
    disclosure: volumeLines,
    formula:
      netM3 != null
        ? `${formatM3(netM3)} m³ ÷ ${yieldM3} m³/bag, rounded up to whole bags`
        : "Concrete volume is not established",
    stamp: {
      concreteAuthority: authority,
      concreteFill: fill,
      concreteFillDepthMm: fillDepthMm,
      postSection,
      postEmbedmentMm: embedmentKnown ? embedmentMm : null,
      concreteYieldM3: yieldM3,
      concreteBags: bags,
      concreteProductKey: DECK_CONCRETE_MATERIAL_ITEM_KEY,
    },
  };
}
